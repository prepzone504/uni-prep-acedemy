/* ============================================
   UNIPREP — EXAM TIMER SELECTION JS
============================================ */

function initExamTimer() {
    const slider = document.getElementById('timer-slider');
    const display = document.getElementById('time-display');
    const label = document.getElementById('time-label');
    const btnProceed = document.getElementById('btn-proceed');
    const btnBack = document.getElementById('btn-back');

    const params = new URLSearchParams(window.location.search);
    const courseCode = params.get('course') || '';
    const topic = params.get('topic') || '';
    const mode = params.get('mode') || '';

    // Fix back button href dynamically
    if (btnBack && courseCode) {
        btnBack.href = `topics/topics_list.html?course=${courseCode}`;
    }

    function formatTime(minutes) {
        if (minutes < 60) {
            display.textContent = minutes;
            label.textContent = "Minutes";
        } else {
            const h = Math.floor(minutes / 60);
            const m = minutes % 60;
            
            if (m === 0) {
                display.textContent = `${h}`;
                label.textContent = h === 1 ? "Hour" : "Hours";
            } else {
                display.textContent = `${h}h ${m}m`;
                label.textContent = "Duration";
            }
        }
    }

    if (slider) {
        // Initialize
        formatTime(parseInt(slider.value));

        // Listen for changes
        slider.addEventListener('input', (e) => {
            formatTime(parseInt(e.target.value));
            
            // Optional: Dynamic background color for slider track
            const val = (slider.value - slider.min) / (slider.max - slider.min) * 100;
            slider.style.background = `linear-gradient(to right, #06b6d4 ${val}%, rgba(255,255,255,0.1) ${val}%)`;
        });
        
        // Initial track color
        const initVal = (slider.value - slider.min) / (slider.max - slider.min) * 100;
        slider.style.background = `linear-gradient(to right, #06b6d4 ${initVal}%, rgba(255,255,255,0.1) ${initVal}%)`;
    }

    if (btnProceed) {
        btnProceed.addEventListener('click', () => {
            const selectedMinutes = slider ? parseInt(slider.value) : 60;
            
            // Construct new URL for guidelines
            const newParams = new URLSearchParams();
            if (courseCode) newParams.set('course', courseCode);
            if (topic) newParams.set('topic', topic);
            if (mode) newParams.set('mode', mode);
            newParams.set('timer', selectedMinutes);

            // Clear any existing state for this topic so it's a fresh exam
            const stateKey = `up_exam_state_${courseCode || 'MTH101'}_${topic || 'all'}`;
            localStorage.removeItem(stateKey);

            // Navigate to guidelines
            window.location.href = `guidelines.html?${newParams.toString()}`;
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExamTimer);
} else {
    initExamTimer();
}
