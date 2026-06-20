document.addEventListener('DOMContentLoaded', async () => {
  const deckGrid = document.getElementById('deck-grid');

  async function loadDecks() {
    if (!window.supabase) {
      deckGrid.innerHTML = `<div class="empty-state">Supabase client not loaded.</div>`;
      return;
    }
    const SUPABASE_URL = 'https://ivbhpsqlnlundhotgonf.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2Ymhwc3Fsbmx1bmRob3Rnb25mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MjUwMjEsImV4cCI6MjA5NzQwMTAyMX0.SnrfpFSv5-2YauC-3ca0pmfi1VM1ikdaeyTdaMBV-KQ';
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    deckGrid.innerHTML = `<div class="empty-state">Loading decks...</div>`;

    try {
      // Fetch all flashcards to group them
      // Alternatively, we could fetch distinct if Supabase supported it natively, 
      // but fetching all is fine for small/medium datasets.
      const { data, error } = await client.from('exam_flashcards').select('*');
      if (error) throw error;

      if (!data || data.length === 0) {
        deckGrid.innerHTML = `<div class="empty-state">No flash card decks available yet.</div>`;
        return;
      }

      // Group by topic and course_code
      const decksMap = new Map();
      data.forEach(fc => {
        // Use a composite key to ensure uniqueness
        const key = `${fc.course_code}::${fc.topic}`;
        if (!decksMap.has(key)) {
          decksMap.set(key, {
            institution: fc.institution || '',
            faculty: fc.faculty || '',
            department: fc.department || '',
            course_code: fc.course_code || 'Unknown',
            course_title: fc.course_title || '',
            topic: fc.topic || 'General',
            level: fc.level || '',
            cardCount: 1
          });
        } else {
          decksMap.get(key).cardCount++;
        }
      });

      const uniqueDecks = Array.from(decksMap.values());
      renderDeckGrid(uniqueDecks);
    } catch (err) {
      console.error('Error fetching flashcards:', err);
      deckGrid.innerHTML = `<div class="empty-state" style="color: #ff7070;">Error loading decks. Please try again.</div>`;
    }
  }

  function escapeHtml(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderDeckGrid(uniqueDecks) {
    deckGrid.innerHTML = uniqueDecks.map((deck, index) => {
      // Create URL parameters for the flashcard.html link
      const params = new URLSearchParams({
        course_code: deck.course_code,
        topic: deck.topic
      });
      const linkUrl = `flashcard.html?${params.toString()}`;

      // We use the same styles ported from imo_tutorial
      return `
        <div class="exam-card-full fc-theme" style="margin:0; padding:0; width:100%; display: flex; flex-direction: column;">
          <div style="padding: 24px; flex: 1;">
            <div class="ecf-top">
              <div class="ecf-subject-badge">🧬 ${escapeHtml(deck.course_code)}</div>
            </div>
            <h3 class="ecf-title">${escapeHtml(deck.topic)}</h3>
            <p class="ecf-desc">${escapeHtml(deck.course_title)} ${deck.level ? `(${escapeHtml(deck.level)})` : ''}</p>
            
            <div class="ecf-meta-row" style="margin-bottom: 16px;">
               <div class="ecf-meta-item"><span class="ecf-meta-icon">📝</span><span>${deck.cardCount} Cards</span></div>
               ${deck.institution ? `<div class="ecf-meta-item"><span class="ecf-meta-icon">🏫</span><span>${escapeHtml(deck.institution)}</span></div>` : ''}
               ${deck.faculty ? `<div class="ecf-meta-item"><span class="ecf-meta-icon">🏢</span><span>${escapeHtml(deck.faculty)}</span></div>` : ''}
               ${deck.department ? `<div class="ecf-meta-item"><span class="ecf-meta-icon">🏛️</span><span>${escapeHtml(deck.department)}</span></div>` : ''}
            </div>
          </div>
          <button class="btn-begin-exam" onclick="window.location.href='${linkUrl}'" style="display: block; width: calc(100% - 48px); margin: 0 24px 24px;">
            Study Now <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;vertical-align:middle;"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        </div>
      `;
    }).join('');
  }

  loadDecks();
});
