// dashboard.js — Advanced mobile sidebar controller and dynamic data loader

async function initDashboard() {
  const overlayClick = (e) => {
    if (e.target && e.target.id === 'sidebar-overlay') {
      if (typeof closeSidebar === 'function') closeSidebar();
    }
  };

  const escapeKey = (e) => {
    if (e.key === 'Escape') {
      if (typeof closeSidebar === 'function') closeSidebar();
    }
  };

  document.addEventListener('click', overlayClick);
  document.addEventListener('keydown', escapeKey);

  // SUPABASE CONFIG
  const SUPABASE_URL = 'https://ivbhpsqlnlundhotgonf.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2Ymhwc3Fsbmx1bmRob3Rnb25mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MjUwMjEsImV4cCI6MjA5NzQwMTAyMX0.SnrfpFSv5-2YauC-3ca0pmfi1VM1ikdaeyTdaMBV-KQ';
  let supabaseClient = null;
  if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  // 1. SET WELCOME NAME & USER PROFILE
  let currentUser = localStorage.getItem('up_current_user') || '';
  const welcomeEl = document.getElementById('welcome-name');
  const matricDisplay = document.getElementById('matric-number-display');
  
  // Prevent showing UUIDs before data loads
  let initialName = currentUser;
  if (!initialName || initialName.length > 30 || initialName.includes('-')) {
      initialName = '--';
  }
  
  if (welcomeEl) welcomeEl.textContent = initialName + '!';
  if (matricDisplay) matricDisplay.textContent = '--';

  async function loadUserProfile() {
    if (!supabaseClient) return;
    try {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const session = sessionData?.session;
      
      if (!session) return; // Not logged in, use fallback

      const userId = session.user.id;
      currentUser = userId; // Use UUID for stats
      localStorage.setItem('up_current_user', userId); // Update local storage for exam_prep.js
      
      // Check if profile exists
      const { data: profile, error } = await supabaseClient
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
        
      if (profile) {
        // Existing user
        if (welcomeEl) welcomeEl.textContent = (profile.full_name || 'Student') + '!';
        if (matricDisplay) matricDisplay.textContent = profile.matric_number;
      } else {
        // FIRST TIME LOGIN
        // Show Step 1 of the modal
        const meta = session.user.user_metadata || {};
        const fName = meta.first_name || '';
        const lName = meta.last_name || '';
        const defaultName = `${fName} ${lName}`.trim();
        
        const nameInput = document.getElementById('modal-name-input');
        if (nameInput && defaultName) nameInput.value = defaultName;
        
        const modalOverlay = document.getElementById('welcome-modal-overlay');
        if (modalOverlay) modalOverlay.style.display = 'flex';

        // Expose global generate function
        window.generateMatric = async function() {
            const btn = document.getElementById('modal-generate-btn');
            const inputName = document.getElementById('modal-name-input').value.trim();
            if (!inputName) {
                alert('Please enter your full name.');
                return;
            }
            
            if(btn) {
                btn.disabled = true;
                btn.textContent = 'Generating...';
            }
            
            const randomNum = Math.floor(1000 + Math.random() * 9000);
            const newMatric = `UNI/26/${randomNum}`;
            
            // Insert profile
            const { error: insertErr } = await supabaseClient
              .from('user_profiles')
              .insert([{
                 id: userId,
                 full_name: inputName,
                 matric_number: newMatric
              }]);
              
            if (insertErr) {
                console.error('Failed to create profile:', insertErr);
                alert('Error generating matric number. Please try again.');
                if(btn) {
                    btn.disabled = false;
                    btn.textContent = 'Generate Matric Number';
                }
            } else {
                // Update UI
                if (welcomeEl) welcomeEl.textContent = inputName + '!';
                if (matricDisplay) matricDisplay.textContent = newMatric;
                
                // Show Step 2
                const modalMatricText = document.getElementById('modal-matric-text');
                if (modalMatricText) modalMatricText.textContent = newMatric;
                
                document.getElementById('modal-step-1').style.display = 'none';
                document.getElementById('modal-step-2').style.display = 'block';
                
                // Re-trigger animation for effect
                const panel = document.querySelector('#welcome-modal-overlay .glass-panel');
                if(panel) {
                    panel.style.animation = 'none';
                    setTimeout(() => panel.style.animation = 'fadeUp 0.4s ease', 10);
                }
            }
        };
      }
    } catch (err) {
      console.error('Error loading user profile:', err);
    }
  }

  // 2. FETCH EXAM STATS
  async function loadStats() {
    if (!supabaseClient) return;
    try {
      // Get all results for this student
      const { data: results, error } = await supabaseClient
        .from('exam_results')
        .select('*')
        .eq('student_id', currentUser)
        .order('submitted_at', { ascending: false });
        
      if (error) throw error;

      let examsTaken = 0;
      let totalPct = 0;
      let totalQuestions = 0;
      let totalCorrect = 0;
      let streak = 0;

      if (results && results.length > 0) {
        examsTaken = results.length;
        
        // Calculate Streak
        let lastDate = null;
        let currentStreak = 0;
        
        // Results are ordered newest first
        for (let row of results) {
            const dateStr = row.submitted_at.split('T')[0];
            if (!lastDate) {
                lastDate = new Date(dateStr);
                currentStreak = 1;
            } else {
                const rowDate = new Date(dateStr);
                const diffTime = Math.abs(lastDate - rowDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                if (diffDays === 1) {
                    currentStreak++;
                    lastDate = rowDate;
                } else if (diffDays > 1) {
                    break;
                }
            }
            totalPct += (row.score_percentage || 0);
            totalQuestions += (row.total_questions || 0);
            totalCorrect += (row.correct_answers || 0);
        }
        
        streak = currentStreak;

        // Populate Chart
        populateChart(results);
      }

      // Update UI
      document.getElementById('stat-exams-taken').textContent = examsTaken;
      document.getElementById('stat-avg-score').textContent = examsTaken > 0 ? Math.round(totalPct / examsTaken) : 0;
      document.getElementById('stat-streak').textContent = streak;
      document.getElementById('stat-accuracy').textContent = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }

  // 3. POPULATE CHART
  function populateChart(results) {
      // Group by day of week (0=Sun, 1=Mon... 6=Sat)
      const dayScores = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      results.forEach(r => {
          const d = new Date(r.submitted_at);
          if (d >= oneWeekAgo) {
              dayScores[d.getDay()].push(r.score_percentage || 0);
          }
      });

      for (let i = 0; i <= 6; i++) {
          const scores = dayScores[i];
          const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
          const bar = document.getElementById(`chart-bar-${i}`);
          if (bar) {
              // Ensure a minimum height so it's visible if > 0
              const h = avg > 0 ? Math.max(10, Math.min(100, avg)) : 0;
              bar.style.height = `${h}%`;
              if (avg > 0) bar.classList.add('active');
          }
      }
  }

  // 4. LOAD RANDOM UPCOMING EXAMS
  async function loadUpcomingExams() {
      if (!supabaseClient) return;
      try {
          const { data, error } = await supabaseClient
              .from('exam_prep_questions')
              .select('course_code, course_title, level');
              
          if (error) throw error;
          if (!data || data.length === 0) return;

          // Deduplicate courses
          const uniqueCourses = [];
          const seen = new Set();
          for (let row of data) {
              if (!seen.has(row.course_code)) {
                  seen.add(row.course_code);
                  uniqueCourses.push(row);
              }
          }

          // Shuffle and pick 3
          uniqueCourses.sort(() => 0.5 - Math.random());
          const selected = uniqueCourses.slice(0, 3);

          const listEl = document.getElementById('upcoming-exams-list');
          if (!listEl) return;
          
          listEl.innerHTML = selected.map((c, i) => {
              // Generate fake upcoming dates for immersion
              const d = new Date();
              d.setDate(d.getDate() + (i * 3) + 2); 
              const month = d.toLocaleString('default', { month: 'short' }).toUpperCase();
              const day = d.getDate().toString().padStart(2, '0');
              
              return `
                <div class="exam-card">
                  <div class="e-date">
                    <span class="e-day">${day}</span>
                    <span class="e-month">${month}</span>
                  </div>
                  <div class="e-details">
                    <h4 class="e-title">${c.course_code.toUpperCase()} - ${c.course_title}</h4>
                    <p class="e-sub">${c.level || 100} Level · CBT Simulation</p>
                  </div>
                  <button class="btn-start" onclick="window.location.href='../exam_prep/exam_list/exam_list.html'">Prepare</button>
                </div>
              `;
          }).join('');

      } catch (err) {
          console.error("Error loading exams:", err);
      }
  }

  // Execute loaders
  async function runLoaders() {
      await loadUserProfile();
      loadStats();
      loadUpcomingExams();
  }
  runLoaders();

  // Register cleanup hook
  window._pageCleanup = function () {
    document.removeEventListener('click', overlayClick);
    document.removeEventListener('keydown', escapeKey);
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboard);
} else {
  initDashboard();
}
