/* ============================================
   UNIPREP — EXAM PREP JS
============================================ */

function initExamPrep() {

    // ── MOCK DATA ──
    const mockQuestions = [
        {
            q: "What is the derivative of x² with respect to x?",
            options: ["x", "2x", "x²/2", "2x²"],
            ans: 1,
            exp: "Using the power rule, the derivative of x^n is n*x^(n-1). Therefore, the derivative of x² is 2x."
        },
        {
            q: "Solve for x: 2x + 5 = 15",
            options: ["5", "10", "4", "20"],
            ans: 0,
            exp: "Subtract 5 from both sides: 2x = 10. Divide by 2: x = 5."
        },
        {
            q: "What is the value of Pi (π) to two decimal places?",
            options: ["3.12", "3.16", "3.14", "3.18"],
            ans: 2,
            exp: "Pi is approximately equal to 3.14159... so to two decimal places, it is 3.14."
        },
        {
            q: "Which of the following is a prime number?",
            options: ["9", "12", "15", "17"],
            ans: 3,
            exp: "A prime number is only divisible by 1 and itself. 17 fits this definition. 9=3x3, 12=4x3, 15=5x3."
        },
        {
            q: "What is the area of a rectangle with length 8 and width 5?",
            options: ["40", "13", "26", "45"],
            ans: 0,
            exp: "Area of a rectangle = length × width. 8 × 5 = 40."
        }
    ];

    let questionsData = [];
    let totalQ = 0;
    let currentQ = 0;
    let answers = [];
    let visited = [];
    let flagged = [];

    let examSubmitted = false;
    let examTimer;
    let timeRemaining = 15 * 60; // 15 minutes default for this mock

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
    function initExam() {
        // Load mock data
        questionsData = mockQuestions;
        totalQ = questionsData.length;

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
            btnStartNow.addEventListener('click', () => {
                if (startOverlay) startOverlay.style.display = 'none';
                startTimer();
            });
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

        // Flag State
        if (flagged[currentQ]) {
            btnFlag.classList.add('flagged');
            lblFlag.textContent = 'Flagged';
        } else {
            btnFlag.classList.remove('flagged');
            lblFlag.textContent = 'Flag';
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
        if (btnNext) btnNext.style.opacity = currentQ === totalQ - 1 ? "0.5" : "1";

        if (qnPrev) qnPrev.disabled = currentQ === 0;
        if (qnNext) qnNext.disabled = currentQ === totalQ - 1;
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

            updateGrids();
        });
    });

    // ── FLAG TOGGLE ──
    btnFlag.addEventListener('click', () => {
        flagged[currentQ] = !flagged[currentQ];
        renderQuestion();
        updateGrids();
    });

    // ── NAVIGATION ──
    function goToQuestion(idx) {
        if (idx < 0 || idx >= totalQ) return;
        currentQ = idx;
        visited[currentQ] = true;
        renderQuestion();
        updateGrids();
    }

    if (btnPrev) btnPrev.addEventListener('click', () => goToQuestion(currentQ - 1));
    if (btnNext) btnNext.addEventListener('click', () => goToQuestion(currentQ + 1));
    if (qnPrev) qnPrev.addEventListener('click', () => goToQuestion(currentQ - 1));
    if (qnNext) qnNext.addEventListener('click', () => goToQuestion(currentQ + 1));

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
        updateTimerDisplay();
        examTimer = setInterval(() => {
            if (examSubmitted) {
                clearInterval(examTimer);
                return;
            }

            timeRemaining--;
            updateTimerDisplay();

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
