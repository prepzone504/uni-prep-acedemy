/* ============================================
   UniPrep — Exam Trivial JS (No Supabase)
   exam_trival.js
============================================ */

function initExamTrival() {

    // ── MOCK DATA ──
    const mockTrivials = [
        {
            id: '1',
            title: 'MTH101 - Algebra Challenge',
            level_label: '100 Level',
            course_code: 'MTH101',
            time_limit: 2, // minutes
            rounds: [
                { question: "What is the value of x if 2x + 5 = 15?", options: ["5", "10", "15", "20"], correctAnswer: "5" },
                { question: "Solve for y: 3y - 4 = 11", options: ["3", "4", "5", "6"], correctAnswer: "5" },
                { question: "What is the square root of 144?", options: ["10", "12", "14", "16"], correctAnswer: "12" }
            ]
        },
        {
            id: '2',
            title: 'PHY101 - Kinematics',
            level_label: '100 Level',
            course_code: 'PHY101',
            time_limit: 3,
            rounds: [
                { question: "Velocity is the rate of change of...", options: ["Distance", "Speed", "Displacement", "Acceleration"], correctAnswer: "Displacement" },
                { question: "Acceleration due to gravity is approximately...", options: ["9.8 m/s", "9.8 m/s²", "10 m/s", "9.8 km/s"], correctAnswer: "9.8 m/s²" },
                { question: "A body at rest remains at rest unless acted upon by...", options: ["Inertia", "A force", "Momentum", "Energy"], correctAnswer: "A force" }
            ]
        },
        {
            id: '3',
            title: 'GST101 - Use of English',
            level_label: 'General',
            course_code: 'GST101',
            time_limit: 2,
            rounds: [
                { question: "Which is a synonym for 'Abundant'?", options: ["Scarce", "Plentiful", "Rare", "Empty"], correctAnswer: "Plentiful" },
                { question: "Identify the noun: The quick brown fox jumped.", options: ["quick", "brown", "fox", "jumped"], correctAnswer: "fox" }
            ]
        }
    ];

    // ── STATE ──
    let allTrivials = [];
    let currentTrivialData = null;
    let questions = [];
    let baseTimeLimit = 180;

    let score = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let currentQIdx = 0;

    let timeRemaining = 180;
    let timerInterval;
    let gameLoopReq;
    const ballsData = [];
    let isPlaying = false;

    // ── ONE-TIME EXAM TRACKING ──
    // Hardcode local state for demo purposes without DB
    let completedTrivialIds = new Set();
    let userAttemptsMap = {};
    let isReviewMode = false;
    let userAnswers = [];
    let totalTimeTaken = 0;

    // ── DOM ELEMENTS ──
    const listView = document.getElementById('trivial-list-view');
    const startView = document.getElementById('start-view');
    const gameView = document.getElementById('game-view');
    const resultView = document.getElementById('result-view');

    const trivialCardGrid = document.getElementById('trivial-card-grid');
    const tlTotal = document.getElementById('tl-total');
    const tlCompleted = document.getElementById('tl-completed');
    const tlNew = document.getElementById('tl-new');

    const trivialDetailTitle = document.getElementById('trivial-detail-title');
    const trivialDetailDesc = document.getElementById('trivial-detail-desc');
    const ruleTime = document.getElementById('rule-time');

    const btnStart = document.getElementById('btn-start-game');
    const btnQuit = document.getElementById('btn-quit');
    const btnPlayAgain = document.getElementById('btn-play-again');
    const btnBackList = document.getElementById('btn-back-list');
    const btnBackFromResult = document.getElementById('btn-back-from-result');

    const timeDisplay = document.getElementById('time-display');
    const scoreDisplay = document.getElementById('score-display');
    const scoreBox = document.getElementById('score-box');
    const questionText = document.getElementById('question-text');
    const arena = document.getElementById('arena');
    const feedbackPop = document.getElementById('feedback-pop');

    // Sidebar overlay toggle
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const sidebarToggle = document.getElementById('sidebar-menu-toggle');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');

    
    if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);
    if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', toggleSidebar);
    if (overlay) overlay.addEventListener('click', toggleSidebar);

    // ── LOAD MOCK TRIVIALS ──
    function fetchAllTrivials() {
        allTrivials = mockTrivials;
        renderTrivialCards(allTrivials);
        updateTrivialBadge();
    }

    function updateTrivialBadge() {
        const total = allTrivials.length;
        const completed = completedTrivialIds.size;
        const newCount = total - completed;
        tlCompleted.textContent = completed;
        tlNew.textContent = newCount;
    }

    // ── RENDER CARDS ──
    function renderTrivialCards(trivials) {
        const total = trivials.length;
        const completed = completedTrivialIds.size;
        const newCount = total - completed;

        tlTotal.textContent = total;
        tlCompleted.textContent = completed;
        tlNew.textContent = newCount;

        trivialCardGrid.innerHTML = trivials.map(p => {
            const isCompleted = completedTrivialIds.has(String(p.id));
            const attempt = userAttemptsMap[String(p.id)];

            const emojis = ['🔢', '⚗️', '🧬', '🔭', '📐', '🎯', '🧠', '🔬'];
            const emoji = emojis[Math.abs(String(p.id).split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % emojis.length];

            const roundsCount = p.rounds ? p.rounds.length : 0;

            const statusHtml = isCompleted
              ? `<span class="card-badge" style="background:rgba(16,185,129,0.15);color:#34d399;border:1px solid rgba(16,185,129,0.3);">✅ Completed</span>`
              : `<span class="card-badge new-badge" style="background:rgba(6,182,212,0.15);color:#a5f3fc;border:1px solid rgba(6,182,212,0.4);">New Challenge</span>`;

            const btnHtml = isCompleted
              ? `<button class="trv-play-btn" data-id="${p.id}"
                   style="background:linear-gradient(135deg,#10b981,#059669);">
                   📖 Review Results
                 </button>`
              : `<button class="trv-play-btn" data-id="${p.id}">
                   Play Now
                 </button>`;

            return `
              <div class="trv-card" data-id="${p.id}">
                <div style="flex:1;">
                  <div class="ecf-top">
                    <div class="ecf-subject-badge">${emoji} ${p.level_label || 'Trivial'}</div>
                    ${statusHtml}
                  </div>
                  <h3 class="ecf-title" style="padding: 0 16px;">${p.title || 'Untitled Trivial'}</h3>
                  <p class="ecf-desc" style="padding: 0 16px;">${isCompleted
                  ? `You have completed this trivial. You scored ${attempt.score} points.`
                  : `Test your skills. Catch the correct balls to score points in ${roundsCount} rounds!`
                }</p>
                  <div class="ecf-meta-row" style="padding: 0 16px;">
                    <div class="ecf-meta-item"><span class="ecf-meta-icon">❓</span><span>${roundsCount} Rounds</span></div>
                    <div class="ecf-meta-item"><span class="ecf-meta-icon">⏱</span><span>${p.time_limit || 3} Minutes</span></div>
                    <div class="ecf-meta-item"><span class="ecf-meta-icon">🏷️</span><span>${p.course_code || 'General'}</span></div>
                  </div>
                </div>
                ${btnHtml}
              </div>`;
        }).join('');

        // Click card OR play button → select trivial
        document.querySelectorAll('.trv-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const id = card.dataset.id;
                const trivial = trivials.find(p => p.id === id);
                if (trivial) selectTrivial(trivial);
            });
        });

        document.querySelectorAll('.trv-play-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = btn.closest('.trv-card');
                if (!card) return;
                const id = card.dataset.id;
                const trivial = trivials.find(p => p.id === id);
                if (trivial) selectTrivial(trivial);
            });
        });
    }

    // ── SELECT TRIVIAL → START SCREEN or REVIEW ──
    async function selectTrivial(trivial) {
        const id = String(trivial.id);
        // If already completed, show review instead of playing
        if (completedTrivialIds.has(id)) {
            await showReview(trivial, userAttemptsMap[id]);
            return;
        }

        currentTrivialData = trivial;

        questions = (trivial.rounds || []).map(r => ({
            q: r.question,
            options: r.options,
            ans: r.correctAnswer
        }));

        baseTimeLimit = (trivial.time_limit || 3) * 60;

        trivialDetailTitle.textContent = trivial.title || 'Trivial';
        trivialDetailDesc.textContent = `Test your skills with ${trivial.level_label || 'this challenge'}. Catch the correct balls to score points!`;
        ruleTime.textContent = `${trivial.time_limit || 3}:00 minutes`;

        listView.style.display = 'none';
        startView.style.display = 'flex';
        resultView.style.display = 'none';
        gameView.style.display = 'none';
    }

    // ── SHOW REVIEW ──
    async function showReview(trivial, attempt) {
        isReviewMode = true;
        currentTrivialData = trivial;

        const icon = document.getElementById('res-icon');
        icon.textContent = '📋';

        const reviewTitle = document.getElementById('res-title');
        reviewTitle.textContent = 'Review';

        document.getElementById('res-sub-text').textContent = `Your results for ${trivial.title}:`;

        const finalScore = document.getElementById('final-score');
        finalScore.textContent = attempt?.score ?? 0;
        finalScore.className = 'rsc-val ' + ((attempt?.score ?? 0) < 0 ? 'negative' : '');

        document.getElementById('res-correct').textContent = '—';
        document.getElementById('res-wrong').textContent = '—';

        btnPlayAgain.style.display = 'none';

        listView.style.display = 'none';
        startView.style.display = 'none';
        gameView.style.display = 'none';
        resultView.style.display = 'flex';

        const storedAnswers = attempt?.answers || [];
        const storedQs = (trivial.rounds || []).map(r => ({
            q: r.question,
            options: r.options,
            ans: r.correctAnswer
        }));
        renderReviewSection(storedAnswers, storedQs);
    }

    // ── BACK TO LIST ──
    function goBackToList() {
        stopGame();
        listView.style.display = 'flex';
        startView.style.display = 'none';
        resultView.style.display = 'none';
        gameView.style.display = 'none';

        if (allTrivials.length > 0) {
            renderTrivialCards(allTrivials);
        }
    }

    btnBackList.addEventListener('click', goBackToList);
    btnBackFromResult.addEventListener('click', goBackToList);

    // ── NAVIGATION ──
    btnStart.addEventListener('click', startGame);
    btnQuit.addEventListener('click', quitGame);
    btnPlayAgain.addEventListener('click', startGame);

    function enterFullscreen() {
        if (!document.fullscreenElement) {
            const el = document.documentElement;
            if (el.requestFullscreen) {
                el.requestFullscreen().catch(e => console.log('Fullscreen error:', e));
            }
        }
    }

    function exitFullscreen() {
        if (document.fullscreenElement) {
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(e => console.log('Exit fullscreen error:', e));
            }
        }
    }

    function quitGame() {
        stopGame();
        listView.style.display = 'flex';
        startView.style.display = 'none';
        gameView.style.display = 'none';
        resultView.style.display = 'none';
    }

    function startGame() {
        if (currentTrivialData) {
            const id = String(currentTrivialData.id);
            if (completedTrivialIds.has(id)) {
                showToast('You have already completed this trivial. Replays are not allowed.', 'error');
                goBackToList();
                return;
            }
        }

        if (questions.length === 0) {
            showToast('No questions available for this trivial.', 'error');
            return;
        }

        score = 0;
        correctCount = 0;
        wrongCount = 0;
        currentQIdx = 0;
        timeRemaining = baseTimeLimit;
        userAnswers = [];
        totalTimeTaken = 0;
        updateScoreUI();
        updateTimerUI();

        listView.style.display = 'none';
        startView.style.display = 'none';
        resultView.style.display = 'none';
        gameView.style.display = 'flex';

        document.body.classList.add('game-mode-active');
        isPlaying = true;
        startTimer();
        loadQuestion();
        enterFullscreen();

        if (gameLoopReq) cancelAnimationFrame(gameLoopReq);
        gameLoopReq = requestAnimationFrame(physicsLoop);
    }

    function stopGame() {
        isPlaying = false;
        clearInterval(timerInterval);
        if (gameLoopReq) cancelAnimationFrame(gameLoopReq);
        arena.innerHTML = '';
        ballsData.length = 0;
        document.body.classList.remove('game-mode-active');
        exitFullscreen();
    }

    function gameOver() {
        stopGame();
        gameView.style.display = 'none';
        resultView.style.display = 'flex';

        isReviewMode = true;
        totalTimeTaken = baseTimeLimit - timeRemaining;

        const allDone = currentQIdx >= questions.length;
        document.getElementById('res-title').textContent = allDone ? 'Trivial Complete!' : "Time's Up!";

        const finalScore = document.getElementById('final-score');
        finalScore.textContent = score;
        finalScore.className = 'rsc-val ' + (score < 0 ? 'negative' : '');

        document.getElementById('res-correct').textContent = correctCount;
        document.getElementById('res-wrong').textContent = wrongCount;

        const icon = document.getElementById('res-icon');
        if (score >= 20) icon.textContent = '🏆';
        else if (score >= 0) icon.textContent = '👍';
        else icon.textContent = '💔';

        const subText = currentTrivialData
            ? `Here is how you performed in ${currentTrivialData.title}:`
            : 'Here is how you performed:';
        document.getElementById('res-sub-text').textContent = subText;

        btnPlayAgain.style.display = 'none';

        if (currentTrivialData) {
            markTrivialCompletedLocally(String(currentTrivialData.id), score);
        }
        renderReviewSection(userAnswers, questions);
    }

    function markTrivialCompletedLocally(id, finalScore) {
        completedTrivialIds.add(id);
        userAttemptsMap[id] = {
            score: finalScore,
            answers: userAnswers,
            time_taken: totalTimeTaken
        };
        updateTrivialBadge();
    }

    // ── TIMER ──
    function startTimer() {
        timerInterval = setInterval(() => {
            timeRemaining--;
            updateTimerUI();
            if (timeRemaining <= 0) {
                gameOver();
            }
        }, 1000);
    }

    function updateTimerUI() {
        const m = Math.floor(timeRemaining / 60);
        const s = timeRemaining % 60;
        timeDisplay.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    // ── QUESTION & BALLS ──
    function loadQuestion() {
        if (currentQIdx >= questions.length) {
            gameOver();
            return;
        }
        const qData = questions[currentQIdx];

        const optText = Array.isArray(qData.options) ? qData.options : [];
        const questionDisplay = qData.q || 'Question text unavailable';
        questionText.textContent = questionDisplay;

        arena.innerHTML = '';
        ballsData.length = 0;

        const options = [...optText].sort(() => Math.random() - 0.5);

        const rect = arena.getBoundingClientRect();
        const w = rect.width || window.innerWidth;
        const h = rect.height || (window.innerHeight - 200);

        const ballSize = window.innerWidth <= 600 ? 75 : 90;
        const radius = ballSize / 2;

        options.forEach((opt, idx) => {
            const el = document.createElement('div');
            el.className = `trivial-ball pb-color-${idx % 5}`;
            el.textContent = opt;

            const x = Math.random() * (w - ballSize);
            const y = Math.random() * (h - ballSize);

            let vx = (Math.random() - 0.5);
            let vy = (Math.random() - 0.5);

            if (Math.abs(vx) < 0.2) vx = vx < 0 ? -0.3 : 0.3;
            if (Math.abs(vy) < 0.2) vy = vy < 0 ? -0.3 : 0.3;

            if (window.innerWidth > 768) { vx *= 1.2; vy *= 1.2; }

            el.style.left = `${x}px`;
            el.style.top = `${y}px`;

            el.addEventListener('mousedown', (e) => handleBallClick(e, opt, qData.ans));
            el.addEventListener('touchstart', (e) => { e.preventDefault(); handleBallClick(e, opt, qData.ans); }, { passive: false });

            arena.appendChild(el);
            ballsData.push({ el, x, y, vx, vy, radius, size: ballSize });
        });
    }

    function handleBallClick(e, selectedOpt, correctOpt) {
        if (!isPlaying || window.isAnimatingBall) return;

        const isCorrect = (selectedOpt === correctOpt);
        const currentQ = questions[currentQIdx];
        const ballEl = e.currentTarget;

        userAnswers.push({
            question: currentQ?.q || 'Unknown question',
            selectedAnswer: selectedOpt,
            correctAnswer: correctOpt,
            isCorrect
        });

        let clientX = e.clientX;
        let clientY = e.clientY;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        }

        showFeedback(isCorrect ? "+10" : "-5", isCorrect, clientX, clientY);

        if (isCorrect) {
            window.isAnimatingBall = true;
            score += 10;
            correctCount++;
            animateScoreBox(true);
            
            ballEl.style.transition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            ballEl.style.backgroundColor = '#10b981';
            ballEl.style.borderColor = '#059669';
            ballEl.style.color = '#fff';
            ballEl.style.transform = 'scale(1.2)';
            ballEl.style.zIndex = '100';
            
            updateScoreUI();
            
            setTimeout(() => {
                window.isAnimatingBall = false;
                currentQIdx++;
                loadQuestion();
            }, 600);
        } else {
            score -= 5;
            wrongCount++;
            animateScoreBox(false);
            
            ballEl.style.transition = 'all 0.5s cubic-bezier(0.55, 0.085, 0.68, 0.53)';
            ballEl.style.transform = 'scale(0) rotate(180deg)';
            ballEl.style.opacity = '0';
            ballEl.style.pointerEvents = 'none';
            
            const bIdx = ballsData.findIndex(b => b.el === ballEl);
            if (bIdx !== -1) ballsData.splice(bIdx, 1);
            
            setTimeout(() => {
                if(ballEl.parentNode) ballEl.parentNode.removeChild(ballEl);
            }, 500);

            updateScoreUI();
        }
    }

    // ── PHYSICS LOOP ──
    function physicsLoop() {
        if (!isPlaying) return;

        const rect = arena.getBoundingClientRect();
        const w = rect.width || window.innerWidth;
        const h = rect.height || (window.innerHeight - 200);

        ballsData.forEach(b => {
            b.x += b.vx;
            b.y += b.vy;

            if (b.x <= 0) {
                b.x = 0;
                b.vx *= -1;
            } else if (b.x + b.size >= w) {
                b.x = w - b.size;
                b.vx *= -1;
            }

            if (b.y <= 0) {
                b.y = 0;
                b.vy *= -1;
            } else if (b.y + b.size >= h) {
                b.y = h - b.size;
                b.vy *= -1;
            }
        });

        // Ball-to-ball collision
        for (let i = 0; i < ballsData.length; i++) {
            for (let j = i + 1; j < ballsData.length; j++) {
                const b1 = ballsData[i];
                const b2 = ballsData[j];
                const dx = (b1.x + b1.radius) - (b2.x + b2.radius);
                const dy = (b1.y + b1.radius) - (b2.y + b2.radius);
                const distSq = dx * dx + dy * dy;
                const minDist = b1.radius + b2.radius;
                
                if (distSq < minDist * minDist) {
                    const dist = Math.sqrt(distSq) || 1;
                    const overlap = minDist - dist;
                    const nx = dx / dist;
                    const ny = dy / dist;
                    
                    b1.x += nx * (overlap / 2);
                    b1.y += ny * (overlap / 2);
                    b2.x -= nx * (overlap / 2);
                    b2.y -= ny * (overlap / 2);
                    
                    const dvx = b1.vx - b2.vx;
                    const dvy = b1.vy - b2.vy;
                    const vn = dvx * nx + dvy * ny;
                    
                    if (vn < 0) {
                        b1.vx -= vn * nx;
                        b1.vy -= vn * ny;
                        b2.vx += vn * nx;
                        b2.vy += vn * ny;
                    }
                }
            }
        }

        ballsData.forEach(b => {
            if (b.x <= 0) { b.x = 0; b.vx = Math.abs(b.vx); }
            else if (b.x + b.size >= w) { b.x = w - b.size; b.vx = -Math.abs(b.vx); }
            
            if (b.y <= 0) { b.y = 0; b.vy = Math.abs(b.vy); }
            else if (b.y + b.size >= h) { b.y = h - b.size; b.vy = -Math.abs(b.vy); }

            b.el.style.transform = `translate(${b.x}px, ${b.y}px)`;
            if (!b.initializedTransform) {
                b.el.style.left = '0px';
                b.el.style.top = '0px';
                b.initializedTransform = true;
            }
        });

        gameLoopReq = requestAnimationFrame(physicsLoop);
    }

    // ── UI EFFECTS ──
    function updateScoreUI() {
        scoreDisplay.textContent = score;
        if (score < 0) {
            scoreDisplay.classList.add('negative');
        } else {
            scoreDisplay.classList.remove('negative');
        }
    }

    function animateScoreBox(isPositive) {
        scoreBox.classList.remove('pop', 'pop-neg');
        void scoreBox.offsetWidth;
        scoreBox.classList.add(isPositive ? 'pop' : 'pop-neg');
    }

    function showFeedback(text, isPositive, x, y) {
        const clone = feedbackPop.cloneNode();
        clone.textContent = text;
        clone.className = 'feedback-pop ' + (isPositive ? 'show-pos' : 'show-neg');
        clone.style.left = `${x - 20}px`;
        clone.style.top = `${y - 40}px`;
        document.body.appendChild(clone);

        setTimeout(() => {
            if (document.body.contains(clone)) {
                document.body.removeChild(clone);
            }
        }, 1000);
    }

    function showToast(message, type = 'info') {
        document.querySelectorAll('.trv-toast').forEach(t => t.remove());
        const toast = document.createElement('div');
        toast.className = 'trv-toast';
        const colors = {
            success: { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)', text: '#34d399' },
            warn: { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.3)', text: '#f59e0b' },
            info: { bg: 'rgba(37,99,235,0.15)', border: 'rgba(37,99,235,0.3)', text: '#93c5fd' },
            error: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)', text: '#fca5a5' },
        };
        const c = colors[type] || colors.info;
        toast.style.cssText = `
            position:fixed; bottom:28px; right:28px; z-index:9999;
            background:${c.bg}; border:1px solid ${c.border}; color:${c.text};
            padding:13px 22px; border-radius:12px;
            font-family:'Outfit',sans-serif; font-size:0.9rem; font-weight:600;
            box-shadow:0 8px 32px rgba(0,0,0,0.4); backdrop-filter:blur(12px);
            transform:translateY(20px); opacity:0;
            transition:transform 0.35s cubic-bezier(0.4,0,0.2,1),opacity 0.35s ease;
            max-width:320px;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.transform = 'translateY(0)';
            toast.style.opacity = '1';
        });
        setTimeout(() => {
            toast.style.transform = 'translateY(20px)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    // ── REVIEW SECTION ──
    function renderReviewSection(answers, allQuestions) {
        const container = document.getElementById('review-section');
        if (!container) return;

        if (!answers || answers.length === 0) {
            container.innerHTML = '<p class="review-empty">No answers recorded.</p>';
            container.style.display = 'block';
            return;
        }

        const correctCount = answers.filter(a => a.isCorrect).length;

        container.innerHTML = `
            <div class="review-header">
                <h3>📋 Answer Review</h3>
                <span class="review-summary">${correctCount}/${answers.length} correct</span>
            </div>
            <div class="review-list">
                ${answers.map((a, i) => `
                    <div class="review-item ${a.isCorrect ? 'rev-correct' : 'rev-wrong'}">
                        <div class="rev-q-num">Q${i + 1}</div>
                        <div class="rev-q-body">
                            <p class="rev-question">${a.question}</p>
                            <div class="rev-answers">
                                <span class="rev-label">Your answer:</span>
                                <span class="rev-val ${a.isCorrect ? 'rev-val-correct' : 'rev-val-wrong'}">${a.selectedAnswer}</span>
                            </div>
                            ${!a.isCorrect ? `
                            <div class="rev-answers">
                                <span class="rev-label">Correct answer:</span>
                                <span class="rev-val rev-val-correct">${a.correctAnswer}</span>
                            </div>` : ''}
                        </div>
                        <div class="rev-icon">${a.isCorrect ? '✅' : '❌'}</div>
                    </div>
                `).join('')}
            </div>
        `;
        container.style.display = 'block';
    }

    // ── INIT ──
    fetchAllTrivials();

    // ── CLEANUP HOOK ──
    window._pageCleanup = function() {
        if (timerInterval) clearInterval(timerInterval);
        if (gameLoopReq) cancelAnimationFrame(gameLoopReq);
        isPlaying = false;
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExamTrival);
} else {
    initExamTrival();
}
