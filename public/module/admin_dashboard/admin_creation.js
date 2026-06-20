/* ============================================
   UNIPREP — ADMIN CREATION SHARED JS
   admin_creation.js
   Handles auth gate, question parsing, preview,
   and local-storage save for all creation pages.
   No Supabase — fully offline.
============================================ */

/* ── AUTH GATE ── */
function checkAdminAuth() {
  if (sessionStorage.getItem('up_admin_auth') !== '1') {
    var gate = document.getElementById('auth-gate');
    if (gate) gate.style.display = 'flex';
    return false;
  }
  return true;
}

/* ── TOAST ── */
function showToast(msg, type) {
  var tc = document.getElementById('toast-container');
  if (!tc) return;
  var t = document.createElement('div');
  t.className = 'toast toast-' + (type || 'info');
  t.textContent = msg;
  tc.appendChild(t);
  setTimeout(function () { t.remove(); }, 3500);
}

/* ── PILLS / CHIPS INIT ── */
function initPillGroup(containerId) {
  var container = document.getElementById(containerId);
  if (!container) return function () { return null; };
  container.querySelectorAll('button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      container.querySelectorAll('button').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });
  return function () {
    var active = container.querySelector('button.active');
    return active ? (active.dataset.count || active.dataset.diff || active.textContent.trim()) : null;
  };
}

/* ── QUESTION BLOCK PARSER ── */
/* Handles both MCQ (with Answer:) and Flashcard (FRONT:/BACK:) */
function parseBlocks(raw, type) {
  var items = [];

  if (type === 'flashcard') {
    // Split on numbered prefixes: "1)", "2.", etc.
    var chunks = raw.split(/\n(?=\d+[\)\.]?\s*\n?FRONT:|^\d+[\)\.]\s)/mi);
    chunks.forEach(function (chunk) {
      chunk = chunk.trim();
      if (!chunk) return;
      var frontMatch = chunk.match(/FRONT:\s*([\s\S]*?)(?=BACK:|$)/i);
      var backMatch  = chunk.match(/BACK:\s*([\s\S]*?)$/i);
      if (frontMatch && backMatch) {
        items.push({
          front: frontMatch[1].trim(),
          back:  backMatch[1].trim()
        });
      }
    });
    return items;
  }

  // MCQ parsing — split on numbered question starters
  var questionRegex = /(?:^|\n)(?:Q(?:uestion)?\s*\.?\s*)?(\d+)\s*[\)\.]\s+/gi;
  var parts = raw.split(/\n(?=(?:Q(?:uestion)?\s*\.?\s*)?\d+\s*[\)\.]\s)/i);

  parts.forEach(function (part) {
    part = part.trim();
    if (!part) return;

    // Strip leading number
    var cleaned = part.replace(/^(?:Q(?:uestion)?\s*\.?\s*)?\d+\s*[\)\.]\s*/, '').trim();
    var lines = cleaned.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    if (!lines.length) return;

    var question = lines[0];
    var options  = [];
    var answer   = null;
    var explanation = '';
    var answerFound = false;

    lines.slice(1).forEach(function (line) {
      var optMatch  = line.match(/^([A-Ea-e])\s*[\)\.]\s+(.+)/);
      var ansMatch  = line.match(/^(?:Answer|Ans)\s*:\s*([A-Ea-e])/i);
      var expMatch  = line.match(/^(?:Explanation|Exp)\s*:\s*(.+)/i);

      if (optMatch)  { options.push({ letter: optMatch[1].toUpperCase(), text: optMatch[2].trim(), correct: false }); }
      else if (ansMatch) { answer = ansMatch[1].toUpperCase(); answerFound = true; }
      else if (expMatch) { explanation = expMatch[1].trim(); }
      else if (answerFound && !explanation && line.length > 5 && !/^[A-E][\)\.]/.test(line)) {
        explanation = line; // treat trailing text as explanation if no explicit label
      }
    });

    if (answer) {
      options.forEach(function (o) { if (o.letter === answer) o.correct = true; });
    }

    if (question && options.length >= 2) {
      items.push({ question: question, options: options, answer: answer, explanation: explanation || 'No explanation provided.' });
    }
  });

  return items;
}

/* ── RENDER PREVIEW ── */
function renderPreview(listEl, items, type) {
  listEl.innerHTML = '';
  if (!items.length) {
    listEl.innerHTML = '<div class="preview-empty"><div class="icon">⚠️</div><h4>No items parsed</h4><p>Check your format and try again.</p></div>';
    return;
  }

  if (type === 'flashcard') {
    var grid = document.createElement('div');
    grid.className = 'fc-deck-grid';
    items.forEach(function (card, i) {
      var el = document.createElement('div');
      el.className = 'fc-card';
      el.innerHTML =
        '<div class="fc-card-num">Card ' + (i + 1) + '</div>' +
        '<div class="fc-front">📖 ' + escHtml(card.front) + '</div>' +
        '<div class="fc-back">' + escHtml(card.back) + '</div>';
      grid.appendChild(el);
    });
    listEl.appendChild(grid);
    return;
  }

  items.forEach(function (item, i) {
    var diff = item.difficulty || 'medium';
    var card = document.createElement('div');
    card.className = 'preview-card';
    card.style.animationDelay = (i * 0.03) + 's';
    card.innerHTML =
      '<div class="preview-card-header">' +
        '<span class="preview-card-num">Q' + (i + 1) + '</span>' +
        (item.difficulty ? '<span class="preview-card-diff ' + diff + '">' + diff + '</span>' : '') +
      '</div>' +
      '<p class="preview-card-q">' + escHtml(item.question) + '</p>' +
      '<div class="preview-options">' +
        item.options.map(function (o) {
          return '<div class="preview-opt ' + (o.correct ? 'correct' : '') + '">' + o.letter + '. ' + escHtml(o.text) + '</div>';
        }).join('') +
      '</div>' +
      (item.explanation ? '<div style="margin-top:10px;font-size:0.8rem;color:var(--ad-muted);line-height:1.5;padding-top:8px;border-top:1px dashed rgba(255,255,255,0.05)">💡 ' + escHtml(item.explanation) + '</div>' : '');
    listEl.appendChild(card);
  });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

/* ── MAIN INIT ── */
function initCreationPage(opts) {
  var type       = opts.type;
  var storageKey = opts.storageKey;
  var pageTitle  = opts.pageTitle;

  var textarea    = document.getElementById('manual-questions');
  var manualCount = document.getElementById('manual-count');
  var previewList = document.getElementById('preview-list');
  var previewStat = document.getElementById('preview-stats');
  var previewStatus = document.getElementById('preview-status');
  var btnGenerate = document.getElementById('btn-generate');
  var btnClear    = document.getElementById('btn-clear');
  var btnSend     = document.getElementById('btn-send');
  var loading     = document.getElementById('gen-loading');

  var parsedItems = [];
  var currentMode = 'auto';

  /* Mode Toggle */
  var btnAuto = document.getElementById('mode-auto');
  var btnManual = document.getElementById('mode-manual');
  var autoSection = document.getElementById('auto-section');
  var manualSection = document.getElementById('manual-section');
  var promptLabel = document.getElementById('ai-prompt-label');
  var promptArea = document.getElementById('ai-prompt');

  function switchMode(mode) {
    currentMode = mode;
    if (mode === 'auto') {
      if(btnAuto) btnAuto.classList.add('active');
      if(btnManual) btnManual.classList.remove('active');
      if(autoSection) autoSection.classList.remove('hidden');
      if(manualSection) manualSection.classList.add('hidden');
      if(btnGenerate) btnGenerate.innerHTML = '✨ Generate with AI';
      if(promptLabel) promptLabel.innerHTML = 'AI Prompt <span class="hint">(topic, syllabus, style)</span>';
      if(promptArea) {
        promptArea.readOnly = false;
        promptArea.style.opacity = '1';
        promptArea.style.background = '';
        if(promptArea._savedPrompt) promptArea.value = promptArea._savedPrompt;
      }
    } else {
      if(btnAuto) btnAuto.classList.remove('active');
      if(btnManual) btnManual.classList.add('active');
      if(autoSection) autoSection.classList.add('hidden');
      if(manualSection) manualSection.classList.remove('hidden');
      if(btnGenerate) btnGenerate.innerHTML = '📋 Preview Content';
      if(promptLabel) promptLabel.innerHTML = 'AI Instruction <span class="hint">(read-only — sent automatically in manual mode)</span>';
      if(promptArea) {
        promptArea._savedPrompt = promptArea.value;
        promptArea.value = 'You are a formatting assistant. Take the block of text you receive. Do NOT modify, delete, or rewrite any question, option, answer, or explanation. Your task is to convert it into JSON.';
        promptArea.readOnly = true;
        promptArea.style.opacity = '0.65';
        promptArea.style.background = 'rgba(255,255,255,0.04)';
      }
    }
  }

  if (btnAuto && btnManual) {
    btnAuto.addEventListener('click', function() { switchMode('auto'); });
    btnManual.addEventListener('click', function() { switchMode('manual'); });
    switchMode('auto');
  }

  /* Slider updates */
  var qCount = document.getElementById('question-count');
  var qDisplay = document.getElementById('question-count-display');
  if (qCount && qDisplay) {
    qCount.addEventListener('input', function() {
      qDisplay.textContent = qCount.value;
    });
  }

  /* Model selection */
  var modelCards = document.querySelectorAll('.model-card');
  modelCards.forEach(function(card) {
    card.addEventListener('click', function() {
      modelCards.forEach(function(c) { c.classList.remove('active'); });
      card.classList.add('active');
    });
  });

  /* Live count */
  if (textarea && manualCount) {
    textarea.addEventListener('input', function () {
      var raw = textarea.value.trim();
      if (!raw) { manualCount.classList.add('hidden'); return; }
      var items = parseBlocks(raw, type);
      var n = items.length;
      manualCount.textContent = n + ' ' + (type === 'flashcard' ? 'card' : 'question') + (n !== 1 ? 's' : '') + ' detected';
      manualCount.classList.remove('hidden');
    });
  }

  /* Preview */
  if (btnGenerate) {
    btnGenerate.addEventListener('click', function () {
      if (currentMode === 'auto') {
         showToast('AI Generation requires the backend Mistral AI API key (not included in static demo). Switch to Manual mode to paste questions.', 'error');
         return;
      }

      var raw = textarea ? textarea.value.trim() : '';
      if (!raw) { showToast('Please paste some content first.', 'error'); return; }

      loading && loading.classList.add('active');
      btnGenerate.disabled = true;

      setTimeout(function () {
        parsedItems = parseBlocks(raw, type);

        loading && loading.classList.remove('active');
        btnGenerate.disabled = false;

        if (!parsedItems.length) {
          showToast('No items could be parsed. Check your format.', 'error');
          previewStatus && (previewStatus.textContent = 'Parse failed');
          return;
        }

        renderPreview(previewList, parsedItems, type);
        if (previewStat) {
          previewStat.textContent = parsedItems.length + ' ' + (type === 'flashcard' ? 'cards' : 'questions') + ' ready — from "' + (document.getElementById('exam-title').value || 'Untitled') + '"';
          previewStat.classList.remove('hidden');
        }
        if (previewStatus) previewStatus.textContent = parsedItems.length + ' items ready';
        showToast('Parsed ' + parsedItems.length + ' ' + (type === 'flashcard' ? 'cards' : 'questions') + '!', 'success');
      }, 400);
    });
  }

  /* Clear */
  if (btnClear) {
    btnClear.addEventListener('click', function () {
      if (textarea) textarea.value = '';
      parsedItems = [];
      previewList.innerHTML = '<div class="preview-empty"><div class="icon">📄</div><h4>Cleared</h4><p>Paste new content and click Preview.</p></div>';
      if (previewStat) { previewStat.textContent = ''; previewStat.classList.add('hidden'); }
      if (previewStatus) previewStatus.textContent = 'Awaiting input';
      if (manualCount) manualCount.classList.add('hidden');
    });
  }

  /* Save (localStorage) */
  if (btnSend) {
    btnSend.addEventListener('click', function () {
      if (!parsedItems.length) {
        showToast('Preview your content first before saving.', 'error');
        return;
      }
      var title   = (document.getElementById('exam-title') || {}).value || 'Untitled';
      var subject = (document.getElementById('subject-select') || {}).value || '';
      var saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      saved.push({
        id:      Date.now(),
        title:   title,
        subject: subject,
        type:    type,
        items:   parsedItems,
        savedAt: new Date().toISOString()
      });
      localStorage.setItem(storageKey, JSON.stringify(saved));
      showToast('Saved "' + title + '" (' + parsedItems.length + ' items) to local storage!', 'success');
    });
  }

  /* Restore autosave */
  var STATE_KEY = 'up_creation_autosave_' + type;
  function autoSave() {
    if (!textarea) return;
    localStorage.setItem(STATE_KEY, JSON.stringify({
      textarea: textarea.value,
      title:   (document.getElementById('exam-title') || {}).value || '',
      subject: (document.getElementById('subject-select') || {}).value || ''
    }));
  }
  function autoRestore() {
    try {
      var s = JSON.parse(localStorage.getItem(STATE_KEY) || 'null');
      if (!s) return;
      if (textarea && s.textarea) textarea.value = s.textarea;
      var titleEl = document.getElementById('exam-title');
      var subjectEl = document.getElementById('subject-select');
      if (titleEl && s.title) titleEl.value = s.title;
      if (subjectEl && s.subject) subjectEl.value = s.subject;
    } catch (e) {}
  }
  autoRestore();
  if (textarea) textarea.addEventListener('input', autoSave);
  var titleEl = document.getElementById('exam-title');
  var subjectEl = document.getElementById('subject-select');
  if (titleEl) titleEl.addEventListener('input', autoSave);
  if (subjectEl) subjectEl.addEventListener('input', autoSave);
}
