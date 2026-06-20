/* ============================================
   UNIPREP — EXAM PREP JS
============================================ */

function initExamPrep() {

    const SUPABASE_URL = 'https://ivbhpsqlnlundhotgonf.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2Ymhwc3Fsbmx1bmRob3Rnb25mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MjUwMjEsImV4cCI6MjA5NzQwMTAyMX0.SnrfpFSv5-2YauC-3ca0pmfi1VM1ikdaeyTdaMBV-KQ';
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let questionsData = [];
    let totalQ = 0;
    let currentQ = 0;
    let answers = [];
    let visited = [];
    let flagged = [];

    let examSubmitted = false;
    let examTimer;
    let timeRemaining = 15 * 60; // 15 minutes default for this mock
    let endTime = null;

    // ── STATE PERSISTENCE ──
    const examStateKey = () => {
        const params = new URLSearchParams(window.location.search);
        const courseCode = params.get('course') || 'MTH101';
        const topic = params.get('topic') || 'all';
        return `up_exam_state_${courseCode}_${topic}`;
    };

    function saveExamState() {
        if (questionsData.length === 0) return;
        const state = {
            endTime,
            answers,
            visited,
            flagged,
            currentQ,
            questionsData,
            totalQ,
            examSubmitted
        };
        localStorage.setItem(examStateKey(), JSON.stringify(state));
    }

    function clearExamState() {
        localStorage.removeItem(examStateKey());
    }

    // ── OFFLINE-FIRST DB SYNC ──
    function getSessionUser() {
        return localStorage.getItem('up_current_user') || 'Anonymous Student';
    }

    async function syncOfflineSubmissions() {
        const pending = JSON.parse(localStorage.getItem('up_pending_submissions') || '[]');
        if (pending.length === 0) return;
        if (!navigator.onLine) return;

        let remaining = [];
        for (let payload of pending) {
            try {
                const { error } = await supabaseClient.from('exam_results').insert([payload]);
                if (error) {
                    console.error('Failed to sync payload, keeping in queue', error);
                    remaining.push(payload);
                }
            } catch (err) {
                remaining.push(payload);
            }
        }
        localStorage.setItem('up_pending_submissions', JSON.stringify(remaining));
    }

    async function submitToDatabase(scorePct, correctCount) {
        const params = new URLSearchParams(window.location.search);
        const courseCode = params.get('course') || 'MTH101';
        
        const payload = {
            student_id: getSessionUser(),
            course_code: courseCode,
            total_questions: totalQ,
            correct_answers: correctCount,
            score_percentage: scorePct * 100,
            time_taken_seconds: ((15 * 60 * totalQ) - timeRemaining) || 0,
            submitted_at: new Date().toISOString()
        };

        const pending = JSON.parse(localStorage.getItem('up_pending_submissions') || '[]');
        
        if (!navigator.onLine) {
            pending.push(payload);
            localStorage.setItem('up_pending_submissions', JSON.stringify(pending));
            return;
        }

        try {
            const { error } = await supabaseClient.from('exam_results').insert([payload]);
            if (error) {
                pending.push(payload);
                localStorage.setItem('up_pending_submissions', JSON.stringify(pending));
            }
        } catch (err) {
            pending.push(payload);
            localStorage.setItem('up_pending_submissions', JSON.stringify(pending));
        }
    }

    // ── NETWORK STATUS LOGIC ──
    const networkBlock = document.getElementById('network-block');
    function updateNetworkStatus() {
        if (!networkBlock) return;
        if (!navigator.onLine) {
            networkBlock.className = 'network-block status-offline';
            networkBlock.title = 'Offline - No Internet Connection';
            return;
        }
        
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (connection) {
            const type = connection.effectiveType;
            if (type === 'slow-2g' || type === '2g') {
                networkBlock.className = 'network-block status-warn';
                networkBlock.title = 'Weak Connection';
            } else {
                networkBlock.className = 'network-block status-good';
                networkBlock.title = 'Strong Connection';
            }
        } else {
            networkBlock.className = 'network-block status-good';
            networkBlock.title = 'Online';
        }
    }

    window.addEventListener('online', () => {
        updateNetworkStatus();
        syncOfflineSubmissions();
    });
    window.addEventListener('offline', updateNetworkStatus);
    if (navigator.connection) {
        navigator.connection.addEventListener('change', updateNetworkStatus);
    }
    updateNetworkStatus();
    syncOfflineSubmissions();

    // ── DOM ELEMENTS ──
    const qNumBadge = document.getElementById('q-number-badge');
    const qText = document.getElementById('question-text');
    const btnFlag = document.getElementById('flag-btn');
    const lblFlag = document.getElementById('flag-label');
    const progFill = document.getElementById('progress-fill');
    const optBtns = document.querySelectorAll('.option-btn');
    const ansRevBox = document.getElementById('answer-review-box');

    const gridDrawer = document.getElementById('q-grid-drawer');
    const gridDesktop = document.getElementById('q-grid-desktop'); // may be null if sidebar removed

    const btnPrev = document.getElementById('bn-prev');
    const btnNext = document.getElementById('bn-next');
    const qnPrev = document.getElementById('qn-prev');
    const qnNext = document.getElementById('qn-next');
    
    const startOverlay = document.getElementById('start-screen-overlay');
    const btnStartNow = document.getElementById('btn-start-now');

    // ── INIT EXAM ──
    async function initExam() {
        const params = new URLSearchParams(window.location.search);
        const courseCode = params.get('course');
        const topic = params.get('topic');
        const mode = params.get('mode');

        try {
            const existingStateStr = localStorage.getItem(examStateKey());
            if (existingStateStr) {
                const state = JSON.parse(existingStateStr);
                
                questionsData = state.questionsData;
                answers = state.answers;
                visited = state.visited;
                flagged = state.flagged;
                currentQ = state.currentQ;
                totalQ = state.totalQ || questionsData.length;
                endTime = state.endTime;
                examSubmitted = state.examSubmitted || false;
                
                if (endTime) {
                    timeRemaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
                } else {
                    timeRemaining = Math.max(15 * 60, totalQ * 60);
                }
                
                generateGrids();
                renderQuestion();
                updateGrids();
                
                if (startOverlay) startOverlay.style.display = 'none';
                
                if (examSubmitted) {
                    document.getElementById('timer-display').textContent = '✅ Review Mode';
                    if (document.getElementById('submit-btn-top')) document.getElementById('submit-btn-top').style.display = 'none';
                    if (document.getElementById('submit-btn-sidebar')) document.getElementById('submit-btn-sidebar').style.display = 'none';
                    goToQuestion(currentQ);
                } else {
                    startTimer();
                }
                
                return;
            }

            document.querySelector('.start-desc').textContent = `Loading questions from database...`;
            if (btnStartNow) btnStartNow.disabled = true;

            let query = supabaseClient
                .from('exam_prep_questions')
                .select('*');

            if (courseCode) {
                query = query.ilike('course_code', courseCode);
            }

            if (topic && mode !== 'all') {
                query = query.ilike('topic', topic);
            }

            const { data, error } = await query;
            if (error) throw error;

            if (!data || data.length === 0) {
                document.querySelector('.start-desc').textContent = `No questions found.`;
                return;
            }

            // Dynamically update the header with course info and level
            const firstRow = data[0];
            const tagEl = document.querySelector('.exam-subject-tag');
            const titleEl = document.querySelector('.exam-title-text');
            
            if (tagEl) {
                tagEl.textContent = firstRow.course_code || courseCode || 'Exam';
            }
            if (titleEl) {
                const cTitle = firstRow.course_title || '';
                const cLevel = firstRow.level ? `(${firstRow.level} Level)` : '';
                titleEl.textContent = `${cTitle} ${cLevel}`.trim() || 'CBT Practice';
            }

            // Map data to expected format
            questionsData = data.map(row => {
                const mapAns = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
                const dbAns = row.correct_answer ? row.correct_answer.toString().trim().toUpperCase() : '';
                return {
                    q: row.question,
                    options: [row.option_a, row.option_b, row.option_c, row.option_d],
                    ans: mapAns[dbAns] !== undefined ? mapAns[dbAns] : 0,
                    exp: row.explanation || 'No explanation provided.'
                };
            });

            // Always shuffle questions for practice
            for (let i = questionsData.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [questionsData[i], questionsData[j]] = [questionsData[j], questionsData[i]];
            }

            totalQ = questionsData.length;
            
            const timerParam = params.get('timer');
            if (timerParam) {
                timeRemaining = parseInt(timerParam, 10) * 60;
            } else {
                timeRemaining = Math.max(15 * 60, totalQ * 60); // 1 minute per question as default
            }

            // Init arrays
            answers = Array(totalQ).fill(-1);
            visited = Array(totalQ).fill(false);
            flagged = Array(totalQ).fill(false);
            visited[0] = true;

            generateGrids();
            renderQuestion();
            updateGrids();

            // Update Start Screen text
            document.querySelector('.start-desc').textContent = `You have ${Math.floor(timeRemaining/60)} minutes to complete ${totalQ} questions. The timer will start as soon as you click the button below.`;

            if (btnStartNow) {
                btnStartNow.disabled = false;
                btnStartNow.addEventListener('click', () => {
                    if (startOverlay) startOverlay.style.display = 'none';
                    startTimer();
                });
            }
        } catch (err) {
            console.error('Error fetching questions:', err.message);
            document.querySelector('.start-desc').textContent = `Failed to load questions.`;
        }
    }

    initExam();

    // ── RENDER QUESTION ──
    function renderQuestion() {
        const qData = questionsData[currentQ];

        // Header
        qNumBadge.textContent = `Q ${currentQ + 1} / ${totalQ}`;
        qText.textContent = qData.q;
        progFill.style.width = `${((currentQ + 1) / totalQ) * 100}%`;

        // Flag/Deep Think State
        const topSvg = btnFlag.querySelector('svg');
        const botFlagBtn = document.getElementById('bn-flag');
        const botSvg = botFlagBtn ? botFlagBtn.querySelector('svg') : null;
        const botLbl = botFlagBtn ? botFlagBtn.querySelector('span') : null;

        const flagPath = `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />`;
        const bulbPath = `<path d="M9 18h6" /><path d="M10 22h4" /><path d="M15 8.5a3 3 0 1 0 -6 0c0 1.553 .605 3.106 2 4.5v3h2v-3c1.395 -1.394 2 -2.947 2 -4.5z" />`;

        if (examSubmitted) {
            // ALWAYS SHOW DEEP THINK IN REVIEW MODE
            lblFlag.textContent = 'Deep Think';
            if (botLbl) botLbl.textContent = 'Deep Think';

            btnFlag.style.backgroundColor = 'rgba(250, 204, 21, 0.15)';
            btnFlag.style.color = '#facc15';
            btnFlag.style.borderColor = 'rgba(250, 204, 21, 0.4)';
            btnFlag.classList.remove('flagged');
            
            if (botFlagBtn) {
                botFlagBtn.style.color = '#facc15';
                botFlagBtn.classList.remove('flagged');
            }

            if (topSvg) { topSvg.style.display = 'block'; topSvg.innerHTML = bulbPath; topSvg.style.stroke = '#facc15'; }
            if (botSvg) { botSvg.innerHTML = bulbPath; botSvg.style.stroke = '#facc15'; }
        } else {
            // EXAM MODE - SHOW FLAG
            btnFlag.style = '';
            if (botFlagBtn) botFlagBtn.style.color = '';

            if (flagged[currentQ]) {
                btnFlag.classList.add('flagged');
                if (botFlagBtn) botFlagBtn.classList.add('flagged');
                lblFlag.textContent = 'Flagged';
                if (botLbl) botLbl.textContent = 'Flagged';
            } else {
                btnFlag.classList.remove('flagged');
                if (botFlagBtn) botFlagBtn.classList.remove('flagged');
                lblFlag.textContent = 'Flag';
                if (botLbl) botLbl.textContent = 'Flag';
            }

            if (topSvg) { topSvg.style.display = 'block'; topSvg.innerHTML = flagPath; topSvg.style.stroke = 'currentColor'; }
            if (botSvg) { botSvg.innerHTML = flagPath; botSvg.style.stroke = 'currentColor'; }
        }

        // Options
        optBtns.forEach((btn, idx) => {
            if (idx >= qData.options.length) {
                btn.style.display = 'none';
                return;
            } else {
                btn.style.display = 'flex';
            }

            // clear styles
            btn.classList.remove('selected', 'correct-ans', 'wrong-ans');
            btn.disabled = examSubmitted;

            // set text
            const textSpan = btn.querySelector('.opt-text');
            textSpan.textContent = qData.options[idx];

            // set selection
            if (answers[currentQ] === idx) {
                btn.classList.add('selected');
            }

            // Review mode styles
            if (examSubmitted) {
                if (idx === qData.ans) {
                    btn.classList.add('correct-ans');
                } else if (answers[currentQ] === idx && idx !== qData.ans) {
                    btn.classList.add('wrong-ans');
                }
            }
        });

        // Review Box
        if (examSubmitted) {
            ansRevBox.classList.add('visible');
            document.getElementById('arb-correct-val').textContent = qData.options[qData.ans];
            document.getElementById('arb-explain').textContent = qData.exp;
        } else {
            ansRevBox.classList.remove('visible');
        }

        // Nav Buttons State
        if (btnPrev) btnPrev.style.opacity = currentQ === 0 ? "0.5" : "1";
        
        if (btnNext) {
            btnNext.style.opacity = (currentQ === totalQ - 1 && examSubmitted) ? "0.5" : "1";
            const botSpan = btnNext.querySelector('span');
            if (botSpan) {
                botSpan.textContent = (currentQ === totalQ - 1 && !examSubmitted) ? 'Submit' : 'Next';
            }
        }

        if (qnPrev) qnPrev.disabled = currentQ === 0;
        
        if (qnNext) {
            qnNext.disabled = (currentQ === totalQ - 1 && examSubmitted);
            qnNext.textContent = (currentQ === totalQ - 1 && !examSubmitted) ? 'Submit ✓' : 'Next →';
            if (currentQ === totalQ - 1 && !examSubmitted) {
                qnNext.classList.remove('btn-secondary');
                qnNext.classList.add('btn-primary'); // Make sure it looks prominent
            }
        }
        
        // Trigger MathJax for LaTeX
        if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise().catch((err) => console.log('MathJax error: ', err.message));
        }
    }

    // ── OPTION SELECTION ──
    optBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            if (examSubmitted) return; // disabled

            const optIdx = parseInt(btn.dataset.opt);

            if (answers[currentQ] === optIdx) {
                answers[currentQ] = -1;
                btn.classList.remove('selected');
            } else {
                answers[currentQ] = optIdx;
                optBtns.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            }

            saveExamState();
            updateGrids();
        });
    });

    // ── FLAG TOGGLE ──
    btnFlag.addEventListener('click', () => {
        if (examSubmitted) {
            // Deep Think Mode
            const qData = questionsData[currentQ];
            const qContext = {
                q: qData.q,
                options: qData.options,
                correctIdx: qData.ans,
                userIdx: answers[currentQ],
                explanation: qData.exp
            };
            sessionStorage.setItem('deepThinkContext', JSON.stringify(qContext));
            window.location.href = 'deep_explaination.html';
            return;
        }

        flagged[currentQ] = !flagged[currentQ];
        saveExamState();
        renderQuestion();
        updateGrids();
    });

    // ── NAVIGATION ──
    function goToQuestion(idx) {
        if (idx < 0 || idx >= totalQ) return;
        currentQ = idx;
        visited[currentQ] = true;
        saveExamState();
        renderQuestion();
        updateGrids();
    }

    if (btnPrev) btnPrev.addEventListener('click', () => goToQuestion(currentQ - 1));
    if (btnNext) btnNext.addEventListener('click', () => {
        if (currentQ === totalQ - 1 && !examSubmitted) openSubmitModal();
        else goToQuestion(currentQ + 1);
    });
    if (qnPrev) qnPrev.addEventListener('click', () => goToQuestion(currentQ - 1));
    if (qnNext) qnNext.addEventListener('click', () => {
        if (currentQ === totalQ - 1 && !examSubmitted) openSubmitModal();
        else goToQuestion(currentQ + 1);
    });

    // ── GRIDS ──
    function generateGrids() {
        if (gridDrawer) gridDrawer.innerHTML = '';
        if (gridDesktop) gridDesktop.innerHTML = '';

        for (let i = 0; i < totalQ; i++) {
            // drawer cell
            if (gridDrawer) {
                const dCell = document.createElement('div');
                dCell.className = 'q-cell';
                dCell.textContent = i + 1;
                dCell.onclick = () => { goToQuestion(i); closeDrawer(); };
                gridDrawer.appendChild(dCell);
            }

            // desktop cell
            if (gridDesktop) {
                const deskCell = document.createElement('div');
                deskCell.className = 'q-cell';
                deskCell.textContent = i + 1;
                deskCell.onclick = () => goToQuestion(i);
                gridDesktop.appendChild(deskCell);
            }
        }
    }

    function updateGrids() {
        const dCells = gridDrawer ? gridDrawer.children : [];
        const deskCells = gridDesktop ? gridDesktop.children : [];

        for (let i = 0; i < totalQ; i++) {
            let classes = 'q-cell';

            if (i === currentQ) classes += ' active';

            if (flagged[i]) {
                classes += ' flag';
            } else if (answers[i] !== -1) {
                classes += ' ans';
            } else if (visited[i]) {
                classes += ' not-ans';
            }

            // In review mode, show correct/wrong
            if (examSubmitted) {
                classes = 'q-cell'; // reset
                if (i === currentQ) classes += ' active';

                if (answers[i] === questionsData[i].ans) {
                    classes += ' ans'; // green/blue (correct)
                } else if (answers[i] !== -1) {
                    classes += ' not-ans'; // red
                } else {
                    classes += ' not-vis'; // skipped
                }
            }

            if(dCells[i]) dCells[i].className = classes;
            if(deskCells[i]) deskCells[i].className = classes;
        }
    }

    // ── DRAWER (MOBILE) ──
    const drawer = document.getElementById('nav-drawer');
    const drawerOverlay = document.getElementById('nav-drawer-overlay');
    const btnNavigator = document.getElementById('bn-navigator');
    const btnCloseDrawer = document.getElementById('nav-drawer-close');

    function openDrawer() {
        drawerOverlay.classList.add('visible');
        drawer.classList.add('open');
    }

    function closeDrawer() {
        drawerOverlay.classList.remove('visible');
        drawer.classList.remove('open');
    }

    if (btnNavigator) btnNavigator.addEventListener('click', openDrawer);
    if (btnCloseDrawer) btnCloseDrawer.addEventListener('click', closeDrawer);
    if (drawerOverlay) drawerOverlay.addEventListener('click', closeDrawer);

    // Bottom flag button
    const bnFlag = document.getElementById('bn-flag');
    if (bnFlag) {
        bnFlag.addEventListener('click', () => {
            btnFlag.click(); // trigger top flag button
        });
    }

    // ── TIMER ──
    const timerDisplay = document.getElementById('timer-display');

    function startTimer() {
        if (!endTime) {
            endTime = Date.now() + (timeRemaining * 1000);
            saveExamState();
        }
        updateTimerDisplay();
        examTimer = setInterval(() => {
            if (examSubmitted) {
                clearInterval(examTimer);
                return;
            }

            timeRemaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
            updateTimerDisplay();

            // Auto save every 10 seconds
            if (timeRemaining % 10 === 0) saveExamState();

            if (timeRemaining <= 0) {
                clearInterval(examTimer);
                submitExam(true); // auto submit
            }
        }, 1000);
    }

    function updateTimerDisplay() {
        const m = Math.floor(timeRemaining / 60);
        const s = timeRemaining % 60;
        timerDisplay.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }


    // ── SUBMISSION ──
    const submitTopBtn = document.getElementById('submit-btn-top');
    const submitSideBtn = document.getElementById('submit-btn-sidebar');
    const submitDrawerBtn = document.getElementById('submit-btn-drawer');
    const modal = document.getElementById('submit-modal');
    const modCancel = document.getElementById('modal-cancel');
    const modConfirm = document.getElementById('modal-confirm');
    const modSummary = document.getElementById('modal-summary');
    const resultScreen = document.getElementById('result-screen');
    const reviewBtn = document.getElementById('result-review-btn');

    function openSubmitModal() {
        if (examSubmitted) return;
        const answeredCount = answers.filter(a => a !== -1).length;
        const notAnsCount = totalQ - answeredCount;

        modSummary.innerHTML = `
          <div class="ms-item"><span class="ms-val ans">${answeredCount}</span><span>Answered</span></div>
          <div class="ms-item"><span class="ms-val not">${notAnsCount}</span><span>Unanswered</span></div>
        `;
        modal.classList.add('visible');
    }

    if (submitTopBtn) submitTopBtn.addEventListener('click', openSubmitModal);
    if (submitSideBtn) submitSideBtn.addEventListener('click', openSubmitModal);
    if (submitDrawerBtn) submitDrawerBtn.addEventListener('click', () => { closeDrawer(); openSubmitModal(); });
    if (modCancel) modCancel.addEventListener('click', () => modal.classList.remove('visible'));
    if (modConfirm) modConfirm.addEventListener('click', () => {
        modal.classList.remove('visible');
        submitExam(false);
    });

    function submitExam(auto = false) {
        examSubmitted = true;
        clearInterval(examTimer);

        // Calculate score
        let correct = 0;
        let wrong = 0;
        let skipped = 0;

        answers.forEach((ans, i) => {
            if (ans === -1) skipped++;
            else if (ans === questionsData[i].ans) correct++;
            else wrong++;
        });

        const pct = correct / totalQ;

        submitToDatabase(pct, correct);
        saveExamState(); // Save the submitted state instead of clearing it

        // Show Results Screen
        document.getElementById('result-score-num').textContent = correct;
        document.getElementById('result-score-total').textContent = `/ ${totalQ}`;
        document.getElementById('rs-correct').textContent = correct;
        document.getElementById('rs-wrong').textContent = wrong;
        document.getElementById('rs-skipped').textContent = skipped;

        const circle = document.getElementById('score-ring-circle');
        const offset = 314 - (314 * pct);
        setTimeout(() => {
            circle.style.strokeDashoffset = offset;
        }, 100);

        if (pct >= 0.7) {
            document.getElementById('result-emoji').textContent = "🎉";
            document.getElementById('result-title').textContent = "Excellent Work!";
        } else if (pct >= 0.5) {
            document.getElementById('result-emoji').textContent = "👍";
            document.getElementById('result-title').textContent = "Good Effort!";
        } else {
            document.getElementById('result-emoji').textContent = "📚";
            document.getElementById('result-title').textContent = "Keep Practicing";
        }

        resultScreen.classList.add('visible');

        // Update Grids & UI for Review Mode
        updateGrids();
        renderQuestion();
    }

    // Review mode button in results
    if (reviewBtn) {
        reviewBtn.addEventListener('click', () => {
            resultScreen.classList.remove('visible');
            document.getElementById('timer-display').textContent = '✅ Review Mode';
            
            // Hide submit buttons
            if(submitTopBtn) submitTopBtn.style.display = 'none';
            if(submitSideBtn) submitSideBtn.style.display = 'none';
            
            // Jump to first question
            goToQuestion(0);
        });
    }

    // Register cleanup hook
    window._pageCleanup = function() {
        if (examTimer) {
            clearInterval(examTimer);
        }
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExamPrep);
} else {
    initExamPrep();
}
