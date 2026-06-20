/* ============================================
   UNIPREP — TOPICS LIST JS
============================================ */

const SUPABASE_URL = 'https://ivbhpsqlnlundhotgonf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2Ymhwc3Fsbmx1bmRob3Rnb25mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MjUwMjEsImV4cCI6MjA5NzQwMTAyMX0.SnrfpFSv5-2YauC-3ca0pmfi1VM1ikdaeyTdaMBV-KQ';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TOPIC_COLORS = [
  { icon: '🔣', color: 'rgba(37,99,235,0.2)', border: 'rgba(37,99,235,0.5)', text: '#60a5fa' },
  { icon: '🔢', color: 'rgba(6,182,212,0.2)', border: 'rgba(6,182,212,0.5)', text: '#06b6d4' },
  { icon: '📐', color: 'rgba(168,85,247,0.2)', border: 'rgba(168,85,247,0.5)', text: '#a855f7' },
  { icon: '∫', color: 'rgba(34,197,94,0.2)', border: 'rgba(34,197,94,0.5)', text: '#22c55e' },
  { icon: '📊', color: 'rgba(245,158,11,0.2)', border: 'rgba(245,158,11,0.5)', text: '#f59e0b' },
  { icon: '🔷', color: 'rgba(239,68,68,0.2)', border: 'rgba(239,68,68,0.5)', text: '#ef4444' }
];

async function initTopicsList() {
  const params = new URLSearchParams(window.location.search);
  const courseCode = params.get('course');

  try {
    let query = supabaseClient
      .from('exam_prep_questions')
      .select('course_title, topic');
      
    if (courseCode) {
      query = query.ilike('course_code', courseCode);
    }

    const { data, error } = await query;

    if (error) throw error;

    if (!data || data.length === 0) {
      document.getElementById('topics-grid').innerHTML = `<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:60px">No topics found for this course.</p>`;
      return;
    }

    const courseTitle = data[0].course_title || courseCode;
    
    const topicMap = {};
    data.forEach(row => {
      const t = row.topic;
      if (!topicMap[t]) {
        topicMap[t] = {
          id: encodeURIComponent(t),
          title: t,
          questions: 0,
          progress: 0
        };
      }
      topicMap[t].questions++;
    });

    const topicsArray = Object.values(topicMap).map((t, i) => {
      const style = TOPIC_COLORS[i % TOPIC_COLORS.length];
      return { ...t, ...style };
    });

    const course = {
      code: courseCode,
      title: courseTitle,
      topics: topicsArray
    };

  // Update header
  document.getElementById('header-course-title').textContent = course.title;
  document.getElementById('header-course-sub').textContent = `${course.code} · Select a topic to practice`;
  document.getElementById('header-course-badge').textContent = course.code;
  document.title = `${course.code} Topics · UniPrep`;

  // Update Practice All card
  const totalQ = course.topics.reduce((s, t) => s + t.questions, 0);
  document.getElementById('pa-total-q').textContent = totalQ;
  document.getElementById('pa-total-t').textContent = course.topics.length;
  document.getElementById('pa-desc').textContent = `Complete CBT simulation covering all ${course.topics.length} topics in ${course.code}. Questions are shuffled for maximum practice.`;
  document.getElementById('btn-practice-all').href = `../exam_timer.html?course=${courseCode}&mode=all`;

  // Render topic cards
  const grid = document.getElementById('topics-grid');
  grid.innerHTML = course.topics.map(t => `
    <a class="topic-card" href="../exam_timer.html?course=${courseCode}&topic=${t.id}">
      <div class="topic-icon" style="background:${t.color};border:1px solid ${t.border};">${t.icon}</div>
      <div class="topic-body">
        <div class="topic-title">${t.title}</div>
        <div class="topic-meta">
          <span class="topic-meta-chip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
            ${t.questions} Questions
          </span>
          ${t.progress > 0 ? `<span class="topic-meta-chip" style="color:${t.text};">${t.progress}% done</span>` : ''}
        </div>
        <div class="topic-progress-wrap">
          <div class="topic-progress-bg">
            <div class="topic-progress-fg" style="width:${t.progress}%; background: linear-gradient(90deg, ${t.border}, ${t.text});"></div>
          </div>
          <span class="topic-pct" style="color:${t.progress > 0 ? t.text : 'var(--text-muted)'};">${t.progress}%</span>
        </div>
      </div>
      <div class="topic-arrow">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </a>
  `).join('');

  // Animate progress bars
  requestAnimationFrame(() => {
    document.querySelectorAll('.topic-progress-fg').forEach(bar => {
      const w = bar.style.width;
      bar.style.width = '0%';
      setTimeout(() => { bar.style.width = w; }, 150);
    });
  });

  } catch (err) {
    console.error('Error loading topics:', err.message);
    document.getElementById('topics-grid').innerHTML = `<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:60px">Failed to load topics.</p>`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTopicsList);
} else {
  initTopicsList();
}
