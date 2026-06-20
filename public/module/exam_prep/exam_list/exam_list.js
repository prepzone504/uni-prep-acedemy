/* ============================================
   UNIPREP — EXAM LIST JS
============================================ */

const SUPABASE_URL = 'https://ivbhpsqlnlundhotgonf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2Ymhwc3Fsbmx1bmRob3Rnb25mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MjUwMjEsImV4cCI6MjA5NzQwMTAyMX0.SnrfpFSv5-2YauC-3ca0pmfi1VM1ikdaeyTdaMBV-KQ';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let COURSES = [];
let activeFilter = 'all';
let searchQuery = '';

const PREDEFINED_COLORS = [
  { icon: '🔢', category: 'science', accentColor: 'rgba(37,99,235,0.2)', accentBorder: 'rgba(37,99,235,0.5)', accentText: '#60a5fa' },
  { icon: '⚡', category: 'science', accentColor: 'rgba(6,182,212,0.2)', accentBorder: 'rgba(6,182,212,0.5)', accentText: '#06b6d4' },
  { icon: '🧪', category: 'science', accentColor: 'rgba(168,85,247,0.2)', accentBorder: 'rgba(168,85,247,0.5)', accentText: '#a855f7' },
  { icon: '🧬', category: 'science', accentColor: 'rgba(34,197,94,0.2)', accentBorder: 'rgba(34,197,94,0.5)', accentText: '#22c55e' },
  { icon: '📝', category: 'general', accentColor: 'rgba(245,158,11,0.2)', accentBorder: 'rgba(245,158,11,0.5)', accentText: '#f59e0b' },
  { icon: '💬', category: 'general', accentColor: 'rgba(239,68,68,0.2)', accentBorder: 'rgba(239,68,68,0.5)', accentText: '#ef4444' },
  { icon: '📈', category: 'art', accentColor: 'rgba(37,99,235,0.2)', accentBorder: 'rgba(37,99,235,0.5)', accentText: '#60a5fa' },
  { icon: '🏛️', category: 'art', accentColor: 'rgba(245,158,11,0.2)', accentBorder: 'rgba(245,158,11,0.5)', accentText: '#f59e0b' }
];

async function loadCoursesFromDB() {
  try {
    const { data, error } = await supabaseClient
      .from('exam_prep_questions')
      .select('course_code, course_title, topic, level, institution, created_at');

    if (error) throw error;

    const courseMap = {};
    const uniqueSuggestions = new Set();

    data.forEach(row => {
      const code = row.course_code;
      if (!courseMap[code]) {
        courseMap[code] = {
          id: code.toLowerCase(),
          code: code,
          title: row.course_title || code,
          level: row.level || '100',
          institution: row.institution || 'Federal University',
          desc: 'Comprehensive practice questions for ' + (row.course_title || code),
          topicsSet: new Set(),
          questions: 0,
          progress: 0,
          createdAt: row.created_at ? new Date(row.created_at).getTime() : 0,
          isPinned: false
        };
      } else {
          const rowTime = row.created_at ? new Date(row.created_at).getTime() : 0;
          if (rowTime > courseMap[code].createdAt) {
              courseMap[code].createdAt = rowTime;
          }
      }
      
      courseMap[code].topicsSet.add(row.topic);
      courseMap[code].questions++;
      
      if (row.institution) uniqueSuggestions.add(row.institution);
      if (row.course_title) uniqueSuggestions.add(row.course_title);
      uniqueSuggestions.add(code);
    });

    const pinnedCourses = JSON.parse(localStorage.getItem('up_pinned_courses') || '[]');
    window.SUGGESTIONS = Array.from(uniqueSuggestions);

    COURSES = Object.values(courseMap).map((c, index) => {
      const style = PREDEFINED_COLORS[index % PREDEFINED_COLORS.length];
      return {
        ...c,
        isPinned: pinnedCourses.includes(c.id),
        topics: c.topicsSet.size,
        icon: style.icon,
        category: style.category,
        accentColor: style.accentColor,
        accentBorder: style.accentBorder,
        accentText: style.accentText
      };
    });

    // Sort: pinned first, then by createdAt descending
    COURSES.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return b.createdAt - a.createdAt;
    });

    renderCourses();
    updateSummaryStats();
  } catch (err) {
    console.error('Error loading courses:', err.message);
    document.getElementById('courses-grid').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px;grid-column:1/-1;">Failed to load courses from the database.</p>';
  }
}

function updateSummaryStats() {
  document.getElementById('total-courses').textContent = COURSES.length;
  document.getElementById('total-topics').textContent = COURSES.reduce((s, c) => s + c.topics, 0);
  document.getElementById('total-questions').textContent = COURSES.reduce((s, c) => s + c.questions, 0).toLocaleString();
}


function renderCourses() {
  const grid = document.getElementById('courses-grid');
  const filtered = COURSES.filter(c => {
    const matchSearch = c.title.toLowerCase().includes(searchQuery) || 
                        c.code.toLowerCase().includes(searchQuery) || 
                        c.institution.toLowerCase().includes(searchQuery);
    return matchSearch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="no-results" style="grid-column:1/-1">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <p style="font-size:18px;font-weight:700;color:#fff;margin-bottom:8px">No courses found</p>
        <p>Try a different filter or search term.</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(c => `
    <div class="course-card" data-id="${c.id}" onclick="window.location.href='../topics/topics_list.html?course=${c.id}'" style="position:relative; cursor:pointer;">
      <button class="pin-btn" onclick="togglePin('${c.id}', event)" title="Pin Course" style="position:absolute; top:16px; right:16px; background:rgba(0,0,0,0.3); border:none; border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; cursor:pointer; z-index:10; transition:all 0.2s;">
        <svg viewBox="0 0 24 24" fill="${c.isPinned ? '#facc15' : 'none'}" stroke="${c.isPinned ? '#facc15' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px; ${c.isPinned ? '' : 'color:#94a3b8;'}">
          <line x1="12" y1="17" x2="12" y2="22"></line>
          <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>
        </svg>
      </button>
      <div class="card-top">
        <div class="course-icon" style="background:${c.accentColor};border:1px solid ${c.accentBorder};box-shadow: 0 0 20px ${c.accentColor}; transform: scale(1.1);">${c.icon}</div>
      </div>
      <div class="card-body">
        <div class="university-name">${c.institution} • ${c.level} Level</div>
        <h3 class="course-title">
          <span class="title-text">${c.title}</span>, 
          <span class="code-text" style="color:${c.accentText}">${c.code}</span>
        </h3>
        <p class="course-desc">${c.desc}</p>
      </div>
      <div class="card-meta">
        <div class="meta-chip">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          ${c.topics} Topics
        </div>
        <div class="meta-chip">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
          ${c.questions} Questions
        </div>
      </div>
      <div class="card-footer">
        <div class="progress-wrap">
          <div class="progress-label">
            <span>Progress</span>
            <span style="color:${c.accentText}">${c.progress}%</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fg" style="width:${c.progress}%; background: linear-gradient(90deg, ${c.accentBorder}, ${c.accentText});"></div>
          </div>
        </div>
        <a href="../topics/topics_list.html?course=${c.id}" class="btn-card">
          ${c.progress > 0 ? 'Continue' : 'Start Prep'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </a>
      </div>
    </div>
  `).join('');

  // Animate progress bars in
  requestAnimationFrame(() => {
    document.querySelectorAll('.progress-bar-fg').forEach(bar => {
      const w = bar.style.width;
      bar.style.width = '0%';
      setTimeout(() => { bar.style.width = w; }, 100);
    });
  });
}

// ── EVENT LISTENERS & INIT ──

window.togglePin = function(courseId, event) {
    event.stopPropagation();
    let pinned = JSON.parse(localStorage.getItem('up_pinned_courses') || '[]');
    if (pinned.includes(courseId)) {
        pinned = pinned.filter(id => id !== courseId);
    } else {
        pinned.push(courseId);
    }
    localStorage.setItem('up_pinned_courses', JSON.stringify(pinned));
    
    // Update COURSES array and re-sort
    COURSES.forEach(c => {
        if (c.id === courseId) c.isPinned = !c.isPinned;
    });
    COURSES.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return b.createdAt - a.createdAt;
    });
    renderCourses();
};

function setupAutocomplete(inputId, suggestId) {
    const input = document.getElementById(inputId);
    const suggestList = document.getElementById(suggestId);
    if (!input || !suggestList) return;

    input.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase().trim();
        searchQuery = val;
        renderCourses();
        
        suggestList.innerHTML = '';
        if (!val) {
            suggestList.style.display = 'none';
            return;
        }

        const matches = window.SUGGESTIONS.filter(s => s.toLowerCase().includes(val)).slice(0, 8);
        if (matches.length > 0) {
            suggestList.style.display = 'block';
            suggestList.innerHTML = matches.map(m => `
                <li style="padding:10px 16px; cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.05); color:#e2e8f0; font-size:14px;" 
                    onmouseover="this.style.background='rgba(255,255,255,0.1)'" 
                    onmouseout="this.style.background='transparent'"
                    onclick="applySearch('${m.replace(/'/g, "\\'")}')">
                    ${m}
                </li>
            `).join('');
        } else {
            suggestList.style.display = 'none';
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target !== input && e.target !== suggestList) {
            suggestList.style.display = 'none';
        }
    });
}

window.applySearch = function(val) {
    searchQuery = val.toLowerCase();
    const sInput = document.getElementById('search-input');
    const mInput = document.getElementById('mobile-search-input');
    if (sInput) sInput.value = val;
    if (mInput) mInput.value = val;
    
    const sSug = document.getElementById('search-suggestions');
    const mSug = document.getElementById('mobile-search-suggestions');
    if (sSug) sSug.style.display = 'none';
    if (mSug) mSug.style.display = 'none';
    
    renderCourses();
};

function initExamList() {
  setupAutocomplete('search-input', 'search-suggestions');
  setupAutocomplete('mobile-search-input', 'mobile-search-suggestions');
  loadCoursesFromDB();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initExamList);
} else {
  initExamList();
}
