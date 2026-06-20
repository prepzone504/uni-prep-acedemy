/* ============================================
   UniPrep — Exam Discussion JS (No Supabase)
   exam_discussion.js
============================================ */

(function () {
    const SUPABASE_URL = 'https://ivbhpsqlnlundhotgonf.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2Ymhwc3Fsbmx1bmRob3Rnb25mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MjUwMjEsImV4cCI6MjA5NzQwMTAyMX0.SnrfpFSv5-2YauC-3ca0pmfi1VM1ikdaeyTdaMBV-KQ';
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let DISCUSSIONS = [];
    let SUGGESTIONS = [];
    let searchQuery = '';
    let activeDiscussionsInterval = null;
    let displayItems = [];

    async function initExamDiscussion() {

        // ── STATE ──
        let currentDiscussion = null;
        let gameTimer = null;
        let phase = 'waiting';       // 'waiting' | 'question' | 'discussion' | 'ended'
        let currentRound = 0;
        let timeLeft = 0;
        let chatChannel = null;
    let userCurrentVote = null;
    let userScore = 0;
    let clockOffsetMs = 0; // The difference between Server Time and Local Time

        let myUserId = localStorage.getItem('up_userid');
        if (!myUserId) {
            myUserId = 'user_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('up_userid', myUserId);
        }

        let myUserName = localStorage.getItem('up_username');
        if (!myUserName) {
            myUserName = 'Student_' + Math.floor(Math.random() * 10000);
            localStorage.setItem('up_username', myUserName);
        }

        let roundSeconds = 0;
        let pendingVoteOption = null;
        let pendingVoteIndex = null;
        let leaderboardData = {};

        // ── MediaRecorder ──
        let mediaRecorder = null;
        let audioChunks = [];
        let recordingInterval = null;
        let recordingSeconds = 0;
        let isRecording = false;

        // ── DOM ──
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        const sidebarToggle = document.getElementById('sidebar-menu-toggle');
        const closeSidebarBtn = document.getElementById('close-sidebar-btn');

        const listView = document.getElementById('list-view');
        const guidelinesView = document.getElementById('guidelines-view');
        const chatView = document.getElementById('chat-view');

        const discGrid = document.getElementById('disc-grid');
        const btnAgree = document.getElementById('btn-agree');
        const btnBackFromGuidelines = document.getElementById('btn-back-from-guidelines');

        const chatTitle = document.getElementById('chat-title');
        const chatArea = document.getElementById('chat-area');
        const chatInput = document.getElementById('chat-input');
        const sendBtn = document.getElementById('chat-send-btn');
        const micBtn = document.getElementById('chat-mic-btn');
        const leaveRoomBtn = document.getElementById('leave-room-btn');
        const chatTimerBadge = document.getElementById('chat-timer-badge');

        const confirmModal = document.getElementById('confirm-modal');
        const confirmOptDisplay = document.getElementById('confirm-opt-display');
        const cancelVoteBtn = document.getElementById('cancel-vote-btn');
        const confirmVoteBtn = document.getElementById('confirm-vote-btn');

        const leaderboardModal = document.getElementById('leaderboard-modal');
        const leaderboardBtn = document.getElementById('leaderboard-btn');
        const closeLbBtn = document.getElementById('close-lb-btn');
        const lbNativeBody = document.getElementById('lb-native-body');

        const searchInput = document.getElementById('search-input');
        const searchSuggestions = document.getElementById('search-suggestions');

        // ── SIDEBAR TOGGLE ──
        if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);
        if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', toggleSidebar);
        if (overlay) overlay.addEventListener('click', toggleSidebar);

        let ALL_SCHEDULES = [];

        // ── FETCH DATA ──
        async function loadDiscussions() {
            discGrid.innerHTML = '<div class="loading-msg">Loading discussions...</div>';
            try {
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (session && session.user) {
                    myUserId = session.user.id;
                    const { data: profile } = await supabaseClient.from('user_profiles').select('full_name').eq('id', session.user.id).single();
                    if (profile && profile.full_name) {
                        myUserName = profile.full_name;
                        localStorage.setItem('up_username', myUserName);
                    }
                }
            } catch (e) { console.warn("Auth check failed", e); }

            try {
            // 0. Sync Clock with Supabase Server
            try {
                const { data: serverTimeStr, error: rpcErr } = await supabaseClient.rpc('get_server_time_ms');
                if (!rpcErr && serverTimeStr) {
                    const serverTimeMs = parseInt(serverTimeStr);
                    clockOffsetMs = serverTimeMs - Date.now();
                    console.log("Clock synced perfectly. Offset:", clockOffsetMs, "ms");
                }
            } catch (syncErr) {
                console.warn("Could not sync server clock. Using local time.", syncErr);
            }

            // 1. Fetch schedules first
            const { data: schedData, error: schedErr } = await supabaseClient
                .from('exam_discussion_schedules')
                .select('*')
                .order('start_time', { ascending: true });

            if (schedErr && schedErr.code !== '42P01') {
                console.error("Schedule fetch error:", schedErr);
            }
            ALL_SCHEDULES = schedData || [];

            const activeBatchIds = [...new Set(ALL_SCHEDULES.map(s => s.exam_batch_id))];

            // 2. Fetch only the batches that are scheduled
            let discData = [];
            if (activeBatchIds.length > 0) {
                const { data, error } = await supabaseClient
                    .from('exam_discussions')
                    .select('*')
                    .in('exam_batch_id', activeBatchIds)
                    .order('order_id', { ascending: true });
                if (error) throw error;
                discData = data || [];
            }

            const uniqueBatches = {};
            const suggestionsSet = new Set();

            discData.forEach(row => {
                const batchId = row.exam_batch_id;
                if (!uniqueBatches[batchId]) {
                    uniqueBatches[batchId] = {
                        id: batchId,
                        title: row.exam_title,
                        subject: row.subject,
                        topic: row.topic || 'General Topic',
                        institution: row.institution || 'Federal University',
                        level: row.level || '100',
                        questions: [],
                        totalQuestions: 0
                    };
                }

                uniqueBatches[batchId].questions.push({
                    q: row.question_text,
                    options: Array.isArray(row.options) ? row.options.map(o => `${o.letter}. ${o.text}`) : [],
                    answer: Array.isArray(row.options) ? row.options.findIndex(o => o.correct) : 0,
                    explanation: row.explanation
                });

                uniqueBatches[batchId].totalQuestions++;

                if (row.institution) suggestionsSet.add(row.institution);
                if (row.subject) suggestionsSet.add(row.subject);
                if (row.exam_title) suggestionsSet.add(row.exam_title);
                if (row.level) suggestionsSet.add(row.level + ' Level');
            });

            DISCUSSIONS = Object.values(uniqueBatches);
            SUGGESTIONS = Array.from(suggestionsSet);

                ALL_SCHEDULES.forEach(s => {
                    const disc = DISCUSSIONS.find(d => d.id === s.exam_batch_id);
                    if (disc) {
                        const safeDateString = typeof s.start_time === 'string' ? s.start_time.replace(' ', 'T') : s.start_time;
                        disc.startTime = new Date(safeDateString).getTime();
                    }
                });

                renderDiscussionList();

                // Restore active session
                const savedDiscStr = localStorage.getItem('up_active_discussion');
                if (savedDiscStr) {
                    const savedDisc = JSON.parse(savedDiscStr);
                    const schedule = ALL_SCHEDULES.find(s => s.id === savedDisc.scheduleId);
                    if (schedule) {
                        const baseDisc = DISCUSSIONS.find(d => d.id === schedule.exam_batch_id);
                        if (baseDisc) {
                            const safeDateString = typeof schedule.start_time === 'string' ? schedule.start_time.replace(' ', 'T') : schedule.start_time;
                            const activeDisc = {
                                ...baseDisc,
                                scheduleId: schedule.id,
                                startTime: new Date(safeDateString).getTime()
                            };
                            listView.style.display = 'none';
                            activeDisc.isEnded = savedDisc.isEnded;
                            currentDiscussion = activeDisc;
                            if (savedDisc.view === 'guidelines') {
                                openGuidelines(activeDisc, activeDisc.isEnded);
                            } else {
                                enterChatRoom();
                            }
                        } else {
                            localStorage.removeItem('up_active_discussion');
                        }
                    } else {
                        localStorage.removeItem('up_active_discussion');
                    }
                }
            } catch (err) {
                console.error(err);
                discGrid.innerHTML = '<div class="loading-msg" style="color:#ef4444;">Failed to load discussions.</div>';
            }
        }

        // ── RENDER LIST ──
        function renderDiscussionList() {
            const completedBatchIds = JSON.parse(localStorage.getItem('up_completed_discussions') || '[]');
            const now = Date.now();

            // Match schedules with batches to create display items
            displayItems = [];
            ALL_SCHEDULES.forEach(schedule => {
                const disc = DISCUSSIONS.find(d => d.id === schedule.exam_batch_id);
                if (disc) {
                    // If the user hasn't explicitly searched, or if it matches the search
                    if (!searchQuery ||
                        disc.title.toLowerCase().includes(searchQuery) ||
                        disc.subject.toLowerCase().includes(searchQuery) ||
                        disc.institution.toLowerCase().includes(searchQuery) ||
                        disc.level.toString().includes(searchQuery)) {

                        const safeDateString = typeof schedule.start_time === 'string' ? schedule.start_time.replace(' ', 'T') : schedule.start_time;
                        displayItems.push({
                            ...disc,
                            scheduleId: schedule.id,
                            startTime: new Date(safeDateString).getTime()
                        });
                    }
                }
            });

            if (displayItems.length === 0) {
                if (ALL_SCHEDULES.length === 0) {
                    discGrid.innerHTML = '<div class="loading-msg">No discussions have been scheduled yet. Check back later!</div>';
                } else {
                    discGrid.innerHTML = '<div class="loading-msg">No scheduled discussions found matching your filter.</div>';
                }
                return;
            }

            // Sort items: Live first, Upcoming next, Ended last. Then by start time.
            displayItems.sort((a, b) => {
                const endA = a.startTime + (a.totalQuestions * 90 * 1000);
                const endB = b.startTime + (b.totalQuestions * 90 * 1000);

                const getRank = (st, en) => {
                    if (now >= st && now < en) return 1; // Live
                    if (now < st) return 2; // Upcoming
                    return 3; // Ended
                };

                const rA = getRank(a.startTime, endA);
                const rB = getRank(b.startTime, endB);

                if (rA !== rB) return rA - rB;
                return a.startTime - b.startTime;
            });

            const subjectEmojis = { Mathematics: '🔢', Physics: '⚗️', Chemistry: '🧪', Biology: '🧬', English: '📖' };

            discGrid.innerHTML = displayItems.map(disc => {
                const emoji = subjectEmojis[disc.subject] || '💬';
                // Use the schedule ID + batch ID for completion tracking so you can take it again if scheduled twice?
                // Actually, let's keep it tied to the batch ID so reviewing works
                const isDone = completedBatchIds.includes(disc.id);

                let startText = "";
                let canJoin = false;
                let badgeStyle = '';
                let btnText = '';

                const totalDurationSecs = disc.totalQuestions * 90;
                const endTime = disc.startTime + (totalDurationSecs * 1000);

                if (now < disc.startTime) {
                    startText = `Starts: <span class="upcoming-countdown" data-starttime="${disc.startTime}">--:--</span>`;
                    badgeStyle = 'color: #fbbf24; border-color: #fbbf24; background: rgba(245,158,11,0.1);';
                    btnText = 'Starts Soon';
                    canJoin = false;
                } else if (now >= disc.startTime && now < endTime) {
                    startText = `Time Left: <span class="live-countdown" data-endtime="${endTime}">--:--</span>`;
                    badgeStyle = 'color: #34d399; border-color: #34d399; background: rgba(52, 211, 153, 0.1);';
                    btnText = 'Join Discussion';
                    canJoin = true;
                } else {
                    startText = isDone ? "✅ Completed" : "Ended";
                    badgeStyle = 'color: rgba(191,219,254,0.5); border-color: rgba(191,219,254,0.15); background: transparent;';
                    btnText = 'Review Discussion';
                    canJoin = true;
                }

                return `
                <div class="pzl-card" data-id="${disc.id}" data-sch="${disc.scheduleId}">
                    <div class="pzl-card-top">
                        <div class="pzl-emoji">${emoji}</div>
                        <div class="pzl-badge time-badge" style="${badgeStyle}">${startText}</div>
                    </div>
                    <div class="pzl-card-body">
                        <h3 class="pzl-name">${disc.title}</h3>
                        <p class="pzl-desc"><strong>${disc.subject}</strong> • ${disc.topic} • ${disc.institution} (${disc.level}L)</p>
                        <div class="pzl-meta-row">
                            <div class="pzl-meta-item">💬 ${disc.totalQuestions} Questions</div>
                            <div class="pzl-meta-item">🎙 Voice & Chat</div>
                        </div>
                    </div>
                    <button class="pzl-play-btn" data-id="${disc.id}" data-sch="${disc.scheduleId}" data-st="${disc.startTime}" data-ended="${now >= endTime ? 'true' : 'false'}" ${canJoin ? (now >= endTime ? 'style="background:rgba(5,150,105,0.1); color:#34d399; border: 1px solid #34d399;"' : '') : 'disabled style="background: var(--border-light); color: var(--text-muted);"'} >
                        ${btnText}
                    </button>
                </div>
            `;
            }).join('');

            document.querySelectorAll('.pzl-play-btn:not(:disabled)').forEach(btn => {
                btn.addEventListener('click', e => {
                    e.stopPropagation();
                    const sch = btn.dataset.sch;
                    const discItem = displayItems.find(d => d.scheduleId === sch);
                    const isEnded = btn.getAttribute('data-ended') === 'true';
                    if (discItem) openGuidelines(discItem, isEnded);
                });
            });

            document.querySelectorAll('.pzl-card').forEach(card => {
                card.addEventListener('click', () => {
                    const btn = card.querySelector('.pzl-play-btn');
                    if (!btn.disabled) {
                        const sch = btn.dataset.sch;
                        const discItem = displayItems.find(d => d.scheduleId === sch);
                        const isEnded = btn.getAttribute('data-ended') === 'true';
                        if (discItem) openGuidelines(discItem, isEnded);
                    }
                });
            });

            if (activeDiscussionsInterval) clearInterval(activeDiscussionsInterval);
            activeDiscussionsInterval = setInterval(() => {
                const currentNow = Date.now();

                // Upcoming countdowns
                document.querySelectorAll('.upcoming-countdown').forEach(el => {
                    const st = parseInt(el.getAttribute('data-starttime'));
                    const left = Math.max(0, Math.floor((st - currentNow) / 1000));
                    if (left === 0) {
                        renderDiscussionList(); // reload if a session just became live!
                    } else {
                        const h = Math.floor(left / 3600);
                        const m = Math.floor((left % 3600) / 60);
                        const s = left % 60;
                        if (h > 24) {
                            el.textContent = `In ${Math.floor(h / 24)}d`;
                        } else if (h > 0) {
                            el.textContent = `${h}h ${m}m`;
                        } else {
                            el.textContent = `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
                        }
                    }
                });

                // Live countdowns
                document.querySelectorAll('.live-countdown').forEach(el => {
                    const end = parseInt(el.getAttribute('data-endtime'));
                    const left = Math.max(0, Math.floor((end - currentNow) / 1000));
                    if (left === 0) {
                        el.parentElement.innerHTML = "Ended";
                        const btn = el.closest('.pzl-card').querySelector('.pzl-play-btn');
                        if (btn && !btn.textContent.includes('Review')) {
                            btn.disabled = false;
                            btn.textContent = 'Review Discussion';
                            btn.setAttribute('data-ended', 'true');
                            btn.style.background = 'rgba(5,150,105,0.1)';
                            btn.style.color = '#34d399';
                            btn.style.border = '1px solid #34d399';
                        }
                    } else {
                        const m = Math.floor(left / 60);
                        const s = left % 60;
                        el.textContent = `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
                    }
                });
            }, 1000);
        }

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const val = e.target.value.toLowerCase();
                searchQuery = val;

                if (!val) {
                    searchSuggestions.style.display = 'none';
                } else {
                    const matches = SUGGESTIONS.filter(s => s.toLowerCase().includes(val)).slice(0, 5);
                    if (matches.length > 0) {
                        searchSuggestions.innerHTML = matches.map(m => `<li style="padding:12px 16px; cursor:pointer; color:#e2e8f0; border-bottom:1px solid rgba(255,255,255,0.05); transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">${m}</li>`).join('');
                        searchSuggestions.style.display = 'block';

                        searchSuggestions.querySelectorAll('li').forEach(li => {
                            li.addEventListener('click', () => {
                                searchInput.value = li.textContent;
                                searchQuery = li.textContent.toLowerCase();
                                searchSuggestions.style.display = 'none';
                                renderDiscussionList();
                            });
                        });
                    } else {
                        searchSuggestions.style.display = 'none';
                    }
                }
                renderDiscussionList();
            });

            document.addEventListener('click', (e) => {
                if (e.target !== searchInput && e.target !== searchSuggestions) {
                    searchSuggestions.style.display = 'none';
                }
            });
        }

        // ── GUIDELINES ──
        function openGuidelines(disc, isEnded = false) {
            currentDiscussion = disc;
            currentDiscussion.isEnded = isEnded;
            listView.style.display = 'none';
            guidelinesView.style.display = 'flex';
            chatView.style.display = 'none';

            localStorage.setItem('up_active_discussion', JSON.stringify({
                scheduleId: currentDiscussion.scheduleId,
                isEnded: currentDiscussion.isEnded,
                view: 'guidelines'
            }));
        }

        btnBackFromGuidelines.addEventListener('click', () => {
            guidelinesView.style.display = 'none';
            listView.style.display = 'flex';
            localStorage.removeItem('up_active_discussion');
        });

        btnAgree.addEventListener('click', () => {
            guidelinesView.style.display = 'none';
            enterChatRoom();
        });

        // ── CHAT ROOM ──
        function enterChatRoom() {
            // Reset state
            phase = 'waiting';
            currentRound = -1;
            timeLeft = 0;
            userCurrentVote = null;
            userScore = 0;
            roundSeconds = 0;
            leaderboardData = {};
            window.globalVoteStats = { total: 0, correct: 0, correctUsers: [] };
            chatArea.innerHTML = '';

            chatTitle.innerHTML = `<span>💬</span> ${currentDiscussion.title} - ${currentDiscussion.topic}`;
            chatView.style.display = 'flex';

            localStorage.setItem('up_active_discussion', JSON.stringify({
                scheduleId: currentDiscussion.scheduleId,
                isEnded: currentDiscussion.isEnded,
                view: 'chat'
            }));

            const now = Date.now() + clockOffsetMs;
            const elapsedMs = now - currentDiscussion.startTime;
            const isActuallyEnded = currentDiscussion.isEnded || (elapsedMs > 0 && Math.floor(elapsedMs / (90 * 1000)) >= currentDiscussion.questions.length);

            if (isActuallyEnded) {
                currentDiscussion.isEnded = true;
                phase = 'ended';
                chatInput.disabled = true;
                sendBtn.disabled = true;
                micBtn.disabled = true;
                chatInput.placeholder = "Discussion has ended.";

                addMessage(`Welcome to the review of <strong>${currentDiscussion.title}</strong>. This session has ended. Loading history...`, 'bot', 'Believe');

                setTimeout(async () => {
                    for (let idx = 0; idx < currentDiscussion.questions.length; idx++) {
                        showReviewQuestion(currentDiscussion.questions[idx], idx);
                        await loadRoundHistory(idx);
                    }
                    addMessage(`🎉 <strong>Discussion has ended!</strong> Check the leaderboard for rankings! 🏆`, 'bot', 'Believe');
                }, 800);
                return;
            }

            // Inputs will be enabled during discussion phase
            chatInput.disabled = true;
            sendBtn.disabled = true;
            micBtn.disabled = true;
            chatInput.placeholder = "Waiting for session to start...";

            // Realtime Subscription
            if (chatChannel) supabaseClient.removeChannel(chatChannel);
            chatChannel = supabaseClient.channel(`room_${currentDiscussion.scheduleId}`)
                .on('broadcast', { event: 'chat' }, payload => {
                    const msg = payload.payload;
                    if (msg.user_id !== myUserId && msg.round_index === currentRound) {
                        addMessage(msg.message, 'other', msg.user_name);
                    }
                })
                .on('broadcast', { event: 'audio' }, payload => {
                    const msg = payload.payload;
                    if (msg.user_id !== myUserId && msg.round_index === currentRound) {
                        addAudioMessage(msg.audio_url, 'other', msg.user_name);
                    }
                })
                .on('broadcast', { event: 'vote' }, payload => {
                    if (payload.payload.round === currentRound) {
                        window.globalVoteStats.total++;
                        if (payload.payload.isCorrect) {
                            window.globalVoteStats.correct++;
                            if (payload.payload.user && !window.globalVoteStats.correctUsers.includes(payload.payload.user)) {
                                window.globalVoteStats.correctUsers.push(payload.payload.user);
                            }
                        }

                        const roomStatsEl = document.getElementById(`room-stats-${currentRound}`);
                        if (roomStatsEl) {
                            roomStatsEl.innerHTML = `👥 <strong>Total Voted: ${window.globalVoteStats.total}</strong> | ✅ <strong>Correct Vote: ${window.globalVoteStats.correct}</strong>`;
                        }
                    }
                })
                .subscribe();

            clearInterval(gameTimer);
            gameTimer = setInterval(tickTimer, 1000);
            tickTimer(); // Run immediately to sync state
        }

        async function startRound(roundIndex) {
            if (!currentDiscussion || roundIndex >= currentDiscussion.questions.length) {
                endDiscussion();
                return;
            }

            currentRound = roundIndex;
            userCurrentVote = null;
            window.globalVoteStats = { total: 0, correct: 0, correctUsers: [] };

            // Lock chat during voting synchronously BEFORE any fetches
            chatInput.disabled = true;
            sendBtn.disabled = true; // Fixed typo (was sendBtn.sendBtn = true)
            micBtn.disabled = true;
            chatInput.placeholder = "Voting in progress... Chat is disabled";

            const q = currentDiscussion.questions[roundIndex];
            showQuestionMessage(q, roundIndex);

            // Load chat history for this round if any (useful on page refresh)
            loadRoundHistory(roundIndex);

            // Fetch historical votes for this round from Supabase async
            try {
                const { data: votes } = await supabaseClient
                    .from('exam_discussion_votes')
                    .select('*')
                    .eq('discussion_id', currentDiscussion.scheduleId)
                    .eq('round_index', roundIndex);
                
                if (votes && votes.length > 0) {
                    let myPastVote = null;
                    votes.forEach(v => {
                        window.globalVoteStats.total++;
                        if (v.is_correct) {
                            window.globalVoteStats.correct++;
                            if (!window.globalVoteStats.correctUsers.includes(v.user_name)) {
                                window.globalVoteStats.correctUsers.push(v.user_name);
                            }
                        }
                        if (v.user_id === myUserId) {
                            myPastVote = v;
                        }
                    });

                    if (myPastVote) {
                        userCurrentVote = myPastVote.selected_option !== null ? myPastVote.selected_option : -1;
                        userVoteTimeTaken = myPastVote.time_taken || 0;
                        
                        setTimeout(() => {
                            document.querySelectorAll(`.vote-btn[data-round="${roundIndex}"]`).forEach(btn => {
                                btn.disabled = true;
                                if (parseInt(btn.dataset.index) === userCurrentVote) {
                                    btn.style.background = 'rgba(96,165,250,0.2)';
                                    btn.style.borderColor = '#60a5fa';
                                }
                            });
                            const statsEl = document.getElementById(`vote-stats-${roundIndex}`);
                            if (statsEl) statsEl.textContent = `Your vote: ${q.options[userCurrentVote] || 'Saved'}. Waiting for timer...`;
                            
                            const roomStatsEl = document.getElementById(`room-stats-${roundIndex}`);
                            if (roomStatsEl) roomStatsEl.innerHTML = `👥 <strong>Total Voted: ${window.globalVoteStats.total}</strong> | ✅ <strong>Correct Vote: ${window.globalVoteStats.correct}</strong>`;

                            // If we already entered discussion phase while awaiting votes, re-trigger reveal visual
                            if (phase === 'discussion') {
                                document.querySelectorAll(`.vote-btn[data-round="${roundIndex}"]`).forEach(btn => {
                                    const bIdx = parseInt(btn.dataset.index);
                                    if (bIdx === q.answer) {
                                        btn.style.background = 'rgba(52,211,153,0.15)';
                                        btn.style.borderColor = '#34d399';
                                        if (!btn.innerHTML.includes('✅')) btn.innerHTML += ' <span style="float:right;">✅</span>';
                                    } else if (bIdx === userCurrentVote) {
                                        btn.style.background = 'rgba(239,68,68,0.15)';
                                        btn.style.borderColor = '#ef4444';
                                        if (!btn.innerHTML.includes('❌')) btn.innerHTML += ' <span style="float:right;">❌</span>';
                                    }
                                });
                                if (statsEl) statsEl.textContent = `Your vote: ${q.options[userCurrentVote]} ${userCurrentVote === q.answer ? '✅' : '❌'}`;
                            }
                        }, 500);
                    } else if (phase === 'discussion') {
                        // If they didn't vote but we are already in discussion phase, they shouldn't vote anymore
                        setTimeout(() => {
                            document.querySelectorAll(`.vote-btn[data-round="${roundIndex}"]`).forEach(btn => {
                                btn.disabled = true;
                                const bIdx = parseInt(btn.dataset.index);
                                if (bIdx === q.answer) {
                                    btn.style.background = 'rgba(52,211,153,0.15)';
                                    btn.style.borderColor = '#34d399';
                                    if (!btn.innerHTML.includes('✅')) btn.innerHTML += ' <span style="float:right;">✅</span>';
                                }
                            });
                        }, 500);
                    }
                }
            } catch (e) {
                console.log("Error fetching historical votes:", e);
            }
        }

        async function loadRoundHistory(roundIndex) {
            try {
                const { data: history } = await supabaseClient
                    .from('exam_discussion_messages')
                    .select('*')
                    .eq('discussion_id', currentDiscussion.scheduleId)
                    .eq('round_index', roundIndex)
                    .order('created_at', { ascending: true });

                if (history && history.length > 0) {
                    history.forEach(msg => {
                        const isMe = (msg.user_id === myUserId) || (msg.user_name === myUserName);
                        const type = isMe ? 'user' : 'other';
                        if (msg.audio_url) {
                            addAudioMessage(msg.audio_url, type, msg.user_name);
                        } else if (msg.message) {
                            addMessage(msg.message, type, msg.user_name);
                        }
                    });
                }
            } catch (e) {
                console.log("Error loading chat history:", e);
            }
        }

        function tickTimer() {
        if (phase === 'ended') return;

        // Apply our synced offset to guarantee perfect real-time synchronization across all devices
        const now = Date.now() + clockOffsetMs;
        const elapsedMs = now - currentDiscussion.startTime;

            if (elapsedMs < 0) {
                phase = 'waiting';
                timeLeft = Math.ceil(-elapsedMs / 1000);
                updateTimerBadge();
                return;
            }

            const roundLengthMs = 90 * 1000;
            const calcRound = Math.floor(elapsedMs / roundLengthMs);

            if (calcRound >= currentDiscussion.questions.length) {
                if (phase !== 'ended') endDiscussion();
                return;
            }

            const roundElapsedMs = elapsedMs % roundLengthMs;
            const votingTimeMs = 30 * 1000;

            let targetPhase = 'question';
            let newTimeLeft = 0;

            if (roundElapsedMs < votingTimeMs) {
                targetPhase = 'question';
                newTimeLeft = Math.ceil((votingTimeMs - roundElapsedMs) / 1000);
            } else {
                targetPhase = 'discussion';
                newTimeLeft = Math.ceil((roundLengthMs - roundElapsedMs) / 1000);
            }

            if (currentRound !== calcRound) {
                startRound(calcRound);
            }

            if (phase !== targetPhase) {
                phase = targetPhase;
                if (phase === 'discussion') {
                    revealAnswer();
                }
            }

            timeLeft = newTimeLeft;
            roundSeconds = Math.floor(roundElapsedMs / 1000);
            updateTimerBadge();
        }

        function updateTimerBadge() {
            const m = Math.floor(timeLeft / 60);
            const s = timeLeft % 60;
            const timeStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            if (phase === 'question') {
                chatTimerBadge.textContent = `❓ Vote: ${timeStr}`;
                chatTimerBadge.style.color = timeLeft <= 10 ? '#ef4444' : '';
                chatTimerBadge.style.borderColor = timeLeft <= 10 ? 'rgba(239,68,68,0.4)' : '';
            } else if (phase === 'discussion') {
                chatTimerBadge.textContent = `💬 Chat: ${timeStr}`;
                chatTimerBadge.style.color = '';
                chatTimerBadge.style.borderColor = '';
            } else if (phase === 'waiting') {
                chatTimerBadge.textContent = `⏳ Starts in: ${timeStr}`;
                chatTimerBadge.style.color = '#fbbf24';
                chatTimerBadge.style.borderColor = 'rgba(245,158,11,0.4)';
            } else {
                chatTimerBadge.textContent = '✅ Done';
            }
        }

        function showQuestionMessage(q, roundIndex) {
            const bubble = document.createElement('div');
            bubble.className = 'msg bot';

            const optionsHTML = q.options.map((opt, i) => `
            <button class="vote-btn" data-index="${i}" data-round="${roundIndex}" id="vote-${roundIndex}-${i}">
                ${opt}
            </button>
        `).join('');

            bubble.innerHTML = `
            <div class="msg-avatar">🤖</div>
            <div class="msg-bubble">
                <strong style="color:#93c5fd; font-size:0.85rem; display:block; margin-bottom:8px;">Q${roundIndex + 1} of ${currentDiscussion.questions.length}</strong>
                <p style="font-weight:700; font-size:1.05rem; margin-bottom:4px;">${q.q}</p>
                <div class="vote-options">${optionsHTML}</div>
                <div id="room-stats-${roundIndex}" style="margin-top:10px; font-size:0.85rem; color:#60a5fa;">👥 <strong>Total Voted: 0</strong> | ✅ <strong>Correct Vote: 0</strong></div>
                <div id="vote-stats-${roundIndex}" style="margin-top:6px; font-size:0.82rem; color:rgba(191,219,254,0.6); font-style:italic;"></div>
            </div>
        `;

            chatArea.appendChild(bubble);
            scrollToBottom();

            // Attach vote handlers
            bubble.querySelectorAll('.vote-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (phase !== 'question' || userCurrentVote !== null) return;
                    const idx = parseInt(btn.dataset.index);
                    const round = parseInt(btn.dataset.round);
                    if (round !== currentRound) return;
                    showVoteConfirmModal(idx, q.options[idx], q, round);
                });
            });
        }

        function showReviewQuestion(q, roundIndex) {
            const bubble = document.createElement('div');
            bubble.className = 'msg bot';

            const optionsHTML = q.options.map((opt, i) => {
                const isCorrect = i === q.answer;
                const bg = isCorrect ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.02)';
                const border = isCorrect ? '#34d399' : 'rgba(255,255,255,0.04)';
                const color = isCorrect ? '#34d399' : 'var(--ad-muted)';
                return `
            <div style="padding:10px 14px; margin-bottom:8px; border-radius:10px; border:1px solid ${border}; background:${bg}; color:${color}; font-size:0.9rem;">
                ${opt} ${isCorrect ? '<span style="float:right;">✅</span>' : ''}
            </div>
            `;
            }).join('');

            bubble.innerHTML = `
            <div class="msg-avatar">🤖</div>
            <div class="msg-bubble">
                <strong style="color:#93c5fd; font-size:0.85rem; display:block; margin-bottom:8px;">Q${roundIndex + 1} of ${currentDiscussion.questions.length}</strong>
                <p style="font-weight:700; font-size:1.05rem; margin-bottom:12px;">${q.q}</p>
                <div class="vote-options">${optionsHTML}</div>
                <div style="margin-top:16px; padding:12px; background:rgba(37,99,235,0.08); border-left:3px solid #3b82f6; border-radius:6px; font-size:0.86rem; color:#93c5fd; line-height:1.6;">
                    <strong style="display:block; margin-bottom:6px;">Explanation:</strong>
                    ${q.explanation || 'No explanation provided.'}
                </div>
            </div>
        `;

            chatArea.appendChild(bubble);
            scrollToBottom();
        }

        function showVoteConfirmModal(idx, optText, q, round) {
            pendingVoteOption = optText;
            pendingVoteIndex = { idx, q, round };
            confirmOptDisplay.textContent = optText;
            confirmModal.style.display = 'flex';
        }

        cancelVoteBtn.addEventListener('click', () => { confirmModal.style.display = 'none'; });

        confirmVoteBtn.addEventListener('click', () => {
            confirmModal.style.display = 'none';
            if (pendingVoteIndex === null) return;
            submitVote(pendingVoteIndex.idx, pendingVoteIndex.q, pendingVoteIndex.round);
        });

        let userVoteTimeTaken = 0;

        async function submitVote(idx, q, round) {
            if (userCurrentVote !== null || round !== currentRound) return;
            userCurrentVote = idx;
            userVoteTimeTaken = roundSeconds;

            // Lock all vote buttons for this round and highlight the user's pick
            document.querySelectorAll(`.vote-btn[data-round="${round}"]`).forEach(btn => {
                btn.disabled = true;
                if (parseInt(btn.dataset.index) === idx) {
                    btn.style.background = 'rgba(96,165,250,0.2)';
                    btn.style.borderColor = '#60a5fa';
                }
            });

            // Update stats UI silently (wait for answer)
            const statsEl = document.getElementById(`vote-stats-${round}`);
            if (statsEl) statsEl.textContent = `Your vote: ${q.options[idx]}. Waiting for timer...`;

            const isCorrect = idx === q.answer;

            // Insert into Supabase
            try {
                await supabaseClient.from('exam_discussion_votes').insert({
                    discussion_id: currentDiscussion.scheduleId,
                    round_index: round,
                    user_id: myUserId,
                    user_name: myUserName,
                    selected_option: idx,
                    is_correct: isCorrect,
                    time_taken: userVoteTimeTaken
                });
            } catch (err) {
                console.log("Error inserting vote:", err);
            }

            // Broadcast vote
            if (chatChannel) {
                chatChannel.send({
                    type: 'broadcast',
                    event: 'vote',
                    payload: { user: myUserName, round, isCorrect, timeTaken: userVoteTimeTaken }
                }).catch(err => console.log('Broadcast error:', err));
            }

            // Locally apply our own vote to the global stats instantly
            window.globalVoteStats.total++;
            if (idx === q.answer) {
                window.globalVoteStats.correct++;
                if (!window.globalVoteStats.correctUsers.includes(myUserName)) {
                    window.globalVoteStats.correctUsers.push(myUserName);
                }
            }
            const roomStatsEl = document.getElementById(`room-stats-${round}`);
            if (roomStatsEl) roomStatsEl.innerHTML = `👥 <strong>Total Voted: ${window.globalVoteStats.total}</strong> | ✅ <strong>Correct Vote: ${window.globalVoteStats.correct}</strong>`;
        }

        function revealAnswer() {
            const q = currentDiscussion.questions[currentRound];

            if (userCurrentVote !== null) {
                const isCorrect = userCurrentVote === q.answer;
                const timeTaken = userVoteTimeTaken;

                // Track leaderboard
                const entry = leaderboardData[myUserName] || { name: myUserName, correct: 0, totalTime: 0, score: 0 };
                if (isCorrect) {
                    entry.correct++;
                    entry.totalTime += timeTaken;
                    entry.score = (entry.score || 0) + 10;
                    userScore += 10;
                }
                leaderboardData[myUserName] = entry;

                // Update stats UI
                const statsEl = document.getElementById(`vote-stats-${currentRound}`);
                if (statsEl) statsEl.textContent = `Your vote: ${q.options[userCurrentVote]} ${isCorrect ? '✅' : '❌'}`;

                addMessage(isCorrect
                    ? `<strong style="color:#34d399;">✅ You voted correctly!</strong> (+10 pts) Time taken: ${timeTaken}s`
                    : `<strong style="color:#ef4444;">❌ Wrong vote!</strong> The correct answer is: <strong>${q.options[q.answer]}</strong>`,
                    'bot', 'Believe'
                );
            } else {
                addMessage(`⏰ Voting time's up! The correct answer is <strong style="color:#34d399;">${q.options[q.answer]}</strong>.`, 'bot', 'Believe');
            }

            // Show correct users
            const correctList = window.globalVoteStats.correctUsers;
            if (correctList && correctList.length > 0) {
                let userTags = correctList.map((u, i) => `
                <div style="display:flex; align-items:center; gap:12px; margin:8px 0; padding:12px 16px; background:linear-gradient(135deg, rgba(52,211,153,0.1), rgba(5,150,105,0.05)); border:1px solid rgba(52,211,153,0.3); border-radius:10px; color:#34d399; font-weight:600; font-size:1rem; box-shadow:0 2px 8px rgba(5,150,105,0.1); text-align:left;">
                    <span style="font-size:1.3rem;">${['🥇', '🥈', '🥉'][i] || '👏'}</span>
                    <span>${u}</span>
                </div>`).join('');

                addMessage(`
                <div style="background:rgba(0,0,0,0.2); padding:16px; border-radius:12px; border:1px solid rgba(52,211,153,0.2); text-align:center; margin-top:6px;">
                    <div style="font-size:1.1rem; margin-bottom:12px;">🎉 <strong style="color:#34d399;">Brainiacs of the Round</strong></div>
                    <div>${userTags}</div>
                </div>
            `, 'bot', 'Believe');
            } else {
                addMessage(`
                <div style="background:rgba(0,0,0,0.2); padding:16px; border-radius:12px; border:1px solid rgba(239,68,68,0.2); text-align:center; margin-top:6px;">
                    <div style="font-size:1.05rem;">😢 <strong style="color:#ef4444;">No one got it right this round!</strong></div>
                </div>
            `, 'bot', 'Believe');
            }

            // Color the buttons
            document.querySelectorAll(`.vote-btn[data-round="${currentRound}"]`).forEach(btn => {
                btn.disabled = true;
                const btnIdx = parseInt(btn.dataset.index);
                if (btnIdx === q.answer) {
                    btn.style.background = 'rgba(52,211,153,0.15)';
                    btn.style.borderColor = '#34d399';
                    if (!btn.innerHTML.includes('✅')) btn.innerHTML += ' <span style="float:right;">✅</span>';
                } else if (btnIdx === userCurrentVote) {
                    btn.style.background = 'rgba(239,68,68,0.15)';
                    btn.style.borderColor = '#ef4444';
                    if (!btn.innerHTML.includes('❌')) btn.innerHTML += ' <span style="float:right;">❌</span>';
                }
            });

            // Show Explanation
            if (q.explanation) {
                addMessage(`<strong style="color:#60a5fa;">Explanation:</strong><br>${q.explanation}`, 'bot', 'Believe');
            }

            // Enable inputs for discussion
            chatInput.disabled = false;
            sendBtn.disabled = false;
            micBtn.disabled = false;
            chatInput.placeholder = "Discuss the answer...";

            addMessage(`Let's discuss! 💬`, 'bot', 'Believe');
        }

        function endDiscussion() {
            phase = 'ended';
            clearInterval(gameTimer);
            chatTimerBadge.textContent = '🏁 Finished';
            updateTimerBadge();

            // Disable inputs
            chatInput.disabled = true;
            sendBtn.disabled = true;
            micBtn.disabled = true;

            addMessage(`🎉 <strong>Discussion has ended!</strong> Your final score: <strong style="color:#60a5fa;">${userScore} pts</strong>. Check the leaderboard for rankings! 🏆`, 'bot', 'Believe');

            let completed = JSON.parse(localStorage.getItem('up_completed_discussions') || '[]');
            if (!completed.includes(currentDiscussion.scheduleId)) {
                completed.push(currentDiscussion.scheduleId);
                localStorage.setItem('up_completed_discussions', JSON.stringify(completed));
            }

            // Save leaderboard data
            let globalLB = JSON.parse(localStorage.getItem('up_discussion_leaderboard')) || {};
            const myEntry = leaderboardData[myUserName];
            if (myEntry) {
                if (!globalLB[myUserName]) {
                    globalLB[myUserName] = myEntry;
                } else {
                    globalLB[myUserName].score = (globalLB[myUserName].score || 0) + myEntry.score;
                    globalLB[myUserName].correct = (globalLB[myUserName].correct || 0) + myEntry.correct;
                }
            }
            localStorage.setItem('up_discussion_leaderboard', JSON.stringify(globalLB));
        }

        // ── CHAT MESSAGING ──
        async function sendChatMessage() {
            const text = chatInput.value.trim();
            if (!text || phase !== 'discussion') return;

            // Optimistic UI
            addMessage(text, 'user', myUserName);
            chatInput.value = '';

            // Realtime Broadcast
            if (chatChannel) {
                chatChannel.send({
                    type: 'broadcast',
                    event: 'chat',
                    payload: { user_id: myUserId, user_name: myUserName, message: text, round_index: currentRound }
                }).catch(err => console.log('Chat broadcast error:', err));
            }

            // Database Insert
            try {
                await supabaseClient.from('exam_discussion_messages').insert([{
                    discussion_id: currentDiscussion.scheduleId,
                    round_index: currentRound,
                    user_name: myUserName,
                    message: text
                }]);
            } catch (err) {
                console.error("Chat Error:", err);
            }
        }

        sendBtn.addEventListener('click', sendChatMessage);
        chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendChatMessage(); });

        // ── VOICE RECORDING ──
        micBtn.addEventListener('click', async () => {
            if (!isRecording) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    mediaRecorder = new MediaRecorder(stream);
                    audioChunks = [];
                    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
                    mediaRecorder.onstop = () => {
                        stream.getTracks().forEach(t => t.stop());
                    };
                    mediaRecorder.start();
                    isRecording = true;
                    recordingSeconds = 0;
                    micBtn.style.background = 'rgba(239,68,68,0.2)';
                    micBtn.style.borderColor = '#ef4444';
                    micBtn.style.color = '#ef4444';
                    recordingInterval = setInterval(() => {
                        recordingSeconds++;
                        micBtn.title = `Recording... ${recordingSeconds}s (click to stop)`;
                        if (recordingSeconds >= 60) stopRecording();
                    }, 1000);
                } catch (e) {
                    showToast('Microphone access denied.', 'error');
                }
            } else {
                stopRecording();
            }
        });

        async function stopRecording() {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
            isRecording = false;
            clearInterval(recordingInterval);
            micBtn.style.background = '';
            micBtn.style.borderColor = '';
            micBtn.style.color = '';
            micBtn.title = '';

            if (audioChunks.length > 0) {
                const blob = new Blob(audioChunks, { type: 'audio/webm' });
                const localUrl = URL.createObjectURL(blob);

                // Optimistic UI
                addAudioMessage(localUrl, 'user', myUserName);

                const fileName = `${currentDiscussion.id}_${Date.now()}.webm`;
                try {
                    const { error: uploadErr } = await supabaseClient.storage
                        .from('discussion_audio')
                        .upload(fileName, blob, { contentType: 'audio/webm' });

                    if (!uploadErr) {
                        const { data: publicData } = supabaseClient.storage.from('discussion_audio').getPublicUrl(fileName);
                        // Realtime Broadcast
                        if (chatChannel) {
                            chatChannel.send({
                                type: 'broadcast',
                                event: 'audio',
                                payload: { user_id: myUserId, user_name: myUserName, audio_url: publicData.publicUrl, round_index: currentRound }
                            }).catch(err => console.log('Audio broadcast error:', err));
                        }

                        // Database Insert
                        await supabaseClient.from('exam_discussion_messages').insert([{
                            discussion_id: currentDiscussion.id,
                            round_index: currentRound,
                            user_name: myUserName,
                            audio_url: publicData.publicUrl
                        }]);
                    }
                } catch (err) {
                    console.error("Audio Upload Error:", err);
                }
            }
        }

        function addAudioMessage(src, type = 'user', name = '') {
            const bubble = document.createElement('div');
            bubble.className = `msg ${type}`;

            let avatarContent = '👤';
            if (type === 'bot') avatarContent = '🤖';
            else if (type === 'user') avatarContent = myUserName.charAt(0).toUpperCase();
            else if (name) avatarContent = name.charAt(0).toUpperCase();

            bubble.innerHTML = `
            <div class="msg-avatar">${avatarContent}</div>
            <div class="msg-bubble">
                ${name && type !== 'user' ? `<strong style="color:#bfdbfe; font-size:0.82rem; display:block; margin-bottom:4px;">${name}</strong>` : ''}
                <div style="display: flex; align-items: center; gap: 12px; background: rgba(37,99,235,0.3); padding: 8px 16px; border-radius: 20px; min-width: 220px;">
                    <button class="play-pause-btn" style="width: 36px; height: 36px; border-radius: 50%; background: transparent; border: none; color: #60a5fa; cursor: pointer; font-size: 1.3rem;">▶</button>
                    <div style="flex: 1; height: 6px; background: rgba(255,255,255,0.2); border-radius: 3px; position: relative; cursor: pointer;">
                        <div class="progress-bar" style="width: 0%; height: 100%; background: #60a5fa; border-radius: 3px;"></div>
                    </div>
                    <span class="audio-time" style="font-size: 0.75rem; color: rgba(191,219,254,0.7);">0:00</span>
                    <audio src="${src}" style="display:none;" preload="metadata"></audio>
                </div>
            </div>
        `;

            const audio = bubble.querySelector('audio');
            const playBtn = bubble.querySelector('.play-pause-btn');
            const progressBar = bubble.querySelector('.progress-bar');
            const timeEl = bubble.querySelector('.audio-time');

            playBtn.addEventListener('click', () => {
                if (audio.paused) { audio.play(); playBtn.textContent = '⏸'; }
                else { audio.pause(); playBtn.textContent = '▶'; }
            });
            audio.addEventListener('timeupdate', () => {
                if (audio.duration) {
                    progressBar.style.width = (audio.currentTime / audio.duration * 100) + '%';
                    const s = Math.floor(audio.currentTime);
                    timeEl.textContent = `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
                }
            });
            audio.addEventListener('ended', () => { playBtn.textContent = '▶'; progressBar.style.width = '0%'; });

            chatArea.appendChild(bubble);
            scrollToBottom();
        }

        // ── LEADERBOARD MODAL ──
        leaderboardBtn.addEventListener('click', () => {
            leaderboardModal.style.display = 'flex';
            renderLeaderboard();
        });
        closeLbBtn.addEventListener('click', () => { leaderboardModal.style.display = 'none'; });
        leaderboardModal.addEventListener('click', e => { if (e.target === leaderboardModal) leaderboardModal.style.display = 'none'; });

        async function renderLeaderboard() {
            lbNativeBody.innerHTML = '<div class="loading-msg">Loading ranks...</div>';
            
            try {
                const { data: votes, error } = await supabaseClient
                    .from('exam_discussion_votes')
                    .select('*')
                    .eq('discussion_id', currentDiscussion.scheduleId);

                if (error) throw error;

                const usersData = {};

                if (votes && votes.length > 0) {
                    votes.forEach(v => {
                        if (!usersData[v.user_name]) {
                            usersData[v.user_name] = { name: v.user_name, correct: 0, totalTime: 0, score: 0 };
                        }
                        if (v.is_correct) {
                            usersData[v.user_name].correct++;
                            usersData[v.user_name].totalTime += (v.time_taken || 0);
                            usersData[v.user_name].score += 10;
                        }
                    });
                }

                // Make sure current user is in the list
                if (!usersData[myUserName]) {
                    usersData[myUserName] = { name: myUserName, correct: 0, totalTime: 0, score: 0 };
                }

                // Show all students that have a score > 0, plus the current user
                let entries = Object.values(usersData).filter(e => e.score > 0 || e.name === myUserName);
                entries.sort((a, b) => b.correct - a.correct || a.totalTime - b.totalTime);

                if (entries.length === 0) {
                    lbNativeBody.innerHTML = '<div class="loading-msg">No votes recorded yet.</div>';
                    return;
                }

                const medals = ['🥇', '🥈', '🥉'];
                const rankClasses = ['native-lb-rank-1', 'native-lb-rank-2', 'native-lb-rank-3'];

                lbNativeBody.innerHTML = entries.map((e, i) => `
                <div class="native-lb-item ${rankClasses[i] || ''} ${e.name === myUserName ? 'native-lb-you' : ''}">
                    <div style="display:flex; align-items:center; gap:14px;">
                        <div style="font-size:1.5rem; width:36px; text-align:center;">${medals[i] || `#${i + 1}`}</div>
                        <div>
                            <div style="font-weight:700; color:#fff;">${e.name} ${e.name === myUserName ? '<span style="font-size:0.75rem; color:#60a5fa;">(You)</span>' : ''}</div>
                            <div style="font-size:0.85rem; color:rgba(191,219,254,0.6);">Avg time: ${e.correct > 0 ? Math.round(e.totalTime / e.correct) : 0}s</div>
                        </div>
                    </div>
                    <div style="font-family:'Outfit',sans-serif; font-size:1.4rem; font-weight:900; color:#60a5fa;">${e.score} pts</div>
                </div>
                `).join('');
                
            } catch (err) {
                console.error("Leaderboard error:", err);
                lbNativeBody.innerHTML = '<div class="loading-msg" style="color:#ef4444;">Failed to load leaderboard.</div>';
            }
        }

        // ── LEAVE ROOM ──
        leaveRoomBtn.addEventListener('click', () => {
            clearInterval(gameTimer);
            stopRecording();
            if (chatChannel) supabaseClient.removeChannel(chatChannel);
            chatView.style.display = 'none';
            listView.style.display = 'flex';
            localStorage.removeItem('up_active_discussion');
        });

        // ── ADD MESSAGE HELPER ──
        function addMessage(html, type, name = '') {
            const msg = document.createElement('div');
            msg.className = `msg ${type}`;

            let avatarContent = '👤';
            if (type === 'bot') avatarContent = '🤖';
            else if (type === 'user') avatarContent = myUserName.charAt(0).toUpperCase();
            else if (name) avatarContent = name.charAt(0).toUpperCase();

            msg.innerHTML = `
            <div class="msg-avatar">${avatarContent}</div>
            <div class="msg-bubble">
                ${name && type !== 'user' ? `<strong style="color:#bfdbfe; font-size:0.82rem; display:block; margin-bottom:4px;">${name}</strong>` : ''}
                ${html}
            </div>
        `;
            chatArea.appendChild(msg);
            scrollToBottom();
        }

        function scrollToBottom() {
            chatArea.scrollTop = chatArea.scrollHeight;
        }

        // ── TOAST ──
        function showToast(message, type = 'info') {
            document.querySelectorAll('.trv-toast').forEach(t => t.remove());
            const toast = document.createElement('div');
            const colors = {
                success: { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)', text: '#34d399' },
                error: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)', text: '#fca5a5' },
                info: { bg: 'rgba(37,99,235,0.15)', border: 'rgba(37,99,235,0.3)', text: '#93c5fd' },
            };
            const c = colors[type] || colors.info;
            toast.style.cssText = `
            position:fixed; bottom:28px; right:28px; z-index:9999;
            background:${c.bg}; border:1px solid ${c.border}; color:${c.text};
            padding:13px 22px; border-radius:12px; font-family:'Outfit',sans-serif; font-size:0.9rem; font-weight:600;
            box-shadow:0 8px 32px rgba(0,0,0,0.4); backdrop-filter:blur(12px);
            transform:translateY(20px); opacity:0; transition:0.35s ease;
        `;
            toast.textContent = message;
            document.body.appendChild(toast);
            requestAnimationFrame(() => { toast.style.transform = 'translateY(0)'; toast.style.opacity = '1'; });
            setTimeout(() => {
                toast.style.opacity = '0'; toast.style.transform = 'translateY(20px)';
                setTimeout(() => toast.remove(), 400);
            }, 3000);
        }

        // ── CLEANUP ON SPA NAVIGATION ──
        window._pageCleanup = function () {
            clearInterval(gameTimer);
            clearInterval(recordingInterval);
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
                if (mediaRecorder.stream) {
                    mediaRecorder.stream.getTracks().forEach(t => t.stop());
                }
            }
        };

        // ── INIT ──
        loadDiscussions();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initExamDiscussion);
    } else {
        initExamDiscussion();
    }
})();
