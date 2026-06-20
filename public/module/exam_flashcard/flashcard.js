document.addEventListener('DOMContentLoaded', async () => {

  // ── DATA ──
  let flashcards = []; 
  
  // ── STATE ──
  let currentCardIdx = 0;
  let isFlipped = false;
  let gotItCount = 0;
  let hardCount = 0;

  // ── DOM ELEMENTS ──
  const viewCard = document.getElementById('card-view');
  const viewComp = document.getElementById('completion-view');

  const btnQuit = document.getElementById('btn-quit');
  const btnRestart = document.getElementById('btn-restart');
  const btnHome = document.getElementById('btn-home');

  const flashcardOuter = document.getElementById('flashcard');
  const flashcardInner = document.getElementById('flashcard-inner');
  const txtQuestion = document.getElementById('fc-question');
  const txtAnswer = document.getElementById('fc-answer');
  const txtExplanation = document.getElementById('fc-explanation');

  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const rateRow = document.getElementById('rate-row');
  const btnWrong = document.getElementById('btn-wrong');
  const btnCorrect = document.getElementById('btn-correct');

  const progFill = document.getElementById('progress-fill');
  const deckBadge = document.getElementById('cv-deck-badge');
  const compDeckName = document.getElementById('comp-deck-name');

  // Load from URL
  const urlParams = new URLSearchParams(window.location.search);
  const courseCode = urlParams.get('course_code');
  const topic = urlParams.get('topic');

  if (!courseCode || !topic) {
    alert("No deck selected!");
    window.location.href = 'list_of_flashcard.html';
    return;
  }

  deckBadge.textContent = `🧬 ${courseCode} - ${topic}`;

  // ── FETCH LOGIC ──
  async function initFlashCards() {
    if (!window.supabase) {
      alert("Database client not loaded.");
      return;
    }
    const SUPABASE_URL = 'https://ivbhpsqlnlundhotgonf.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2Ymhwc3Fsbmx1bmRob3Rnb25mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MjUwMjEsImV4cCI6MjA5NzQwMTAyMX0.SnrfpFSv5-2YauC-3ca0pmfi1VM1ikdaeyTdaMBV-KQ';
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    try {
      const { data, error } = await client
        .from('exam_flashcards')
        .select('*')
        .eq('course_code', courseCode)
        .eq('topic', topic)
        .order('order_id', { ascending: true });
        
      if (error) throw error;
      
      if (!data || data.length === 0) {
        alert("No cards found for this deck.");
        window.location.href = 'list_of_flashcard.html';
        return;
      }
      
      // Shuffle cards occasionally or just keep order. We'll keep order.
      flashcards = data.map(c => ({
        id: c.id,
        q: c.front,
        a: c.back,
        exp: '', // Back already contains everything needed, explanation can be empty or added later
        viewCount: 0 // Optional track views locally
      }));

      startStudySession();

    } catch (err) {
      console.error('Error fetching flashcards:', err);
      alert("Error loading flashcards.");
      window.location.href = 'list_of_flashcard.html';
    }
  }

  function startStudySession() {
    currentCardIdx = 0;
    gotItCount = 0;
    hardCount = 0;
    
    viewCard.style.display = 'flex';
    viewComp.style.display = 'none';
    
    renderCard();
  }

  // ── FLASHCARD LOGIC ──
  flashcardOuter.addEventListener('click', () => {
    isFlipped = !isFlipped;
    flashcardInner.classList.toggle('flipped', isFlipped);
    
    // Show rating buttons when back is revealed
    if (isFlipped) {
      rateRow.style.opacity = '1';
      rateRow.style.pointerEvents = 'auto';
      rateRow.style.transform = 'translateY(0)';
    }
  });

  function renderCard() {
    isFlipped = false;
    flashcardInner.classList.remove('flipped');
    
    // Hide rating buttons initially
    rateRow.style.opacity = '0';
    rateRow.style.pointerEvents = 'none';
    rateRow.style.transform = 'translateY(10px)';

    const card = flashcards[currentCardIdx];
    
    // Animate text change slightly
    txtQuestion.style.opacity = 0;
    txtAnswer.style.opacity = 0;
    
    setTimeout(() => {
      txtQuestion.textContent = card.q;
      txtAnswer.textContent = card.a;
      txtExplanation.textContent = card.exp;
      txtQuestion.style.opacity = 1;
      txtAnswer.style.opacity = 1;
      
      const vcEl = document.getElementById('fc-view-count');
      const vcElBack = document.getElementById('fc-view-count-back');
      
      if (vcEl) vcEl.style.display = 'none';
      if (vcElBack) vcElBack.style.display = 'none';
    }, 150);

    // Update Progress
    const humanNum = currentCardIdx + 1;
    progFill.style.width = `${(humanNum / flashcards.length) * 100}%`;

    // Button states
    btnPrev.disabled = (currentCardIdx === 0);
  }

  btnPrev.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentCardIdx > 0) {
      currentCardIdx--;
      renderCard();
    }
  });

  btnNext.addEventListener('click', (e) => {
    e.stopPropagation();
    advanceCard();
  });

  // Rating buttons
  btnWrong.addEventListener('click', (e) => {
    e.stopPropagation();
    hardCount++;
    advanceCard();
  });

  btnCorrect.addEventListener('click', (e) => {
    e.stopPropagation();
    gotItCount++;
    advanceCard();
  });

  function advanceCard() {
    if (currentCardIdx < flashcards.length - 1) {
      currentCardIdx++;
      renderCard();
    } else {
      showCompletion();
    }
  }

  function showCompletion() {
    viewCard.style.display = 'none';
    viewComp.style.display = 'flex';

    compDeckName.textContent = `You've successfully reviewed ${flashcards.length} cards in ${courseCode}.`;
    document.getElementById('cs-gotit').textContent = gotItCount;
    document.getElementById('cs-hard').textContent = hardCount;
  }

  btnQuit.addEventListener('click', () => {
    window.location.href = 'list_of_flashcard.html';
  });
  btnHome.addEventListener('click', () => {
    window.location.href = 'list_of_flashcard.html';
  });
  btnRestart.addEventListener('click', () => {
    startStudySession();
  });

  // Kick off
  initFlashCards();
});
