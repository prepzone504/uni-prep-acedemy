/* ============================================
   UNIPREP — EXAM PREP CREATOR (MISTRAL AI)
   exam_prep_gen.js
============================================ */

let MISTRAL_KEYS = [];

async function loadMistralApiKeys() {
  if (MISTRAL_KEYS.length > 0) return;
  try {
    const { data, error } = await supabaseClient
      .from('app_settings')
      .select('value')
      .eq('key', 'mistral_api_key')
      .single();
    if (!error && data && data.value) {
      MISTRAL_KEYS = data.value.split(',').map(k => k.trim()).filter(Boolean);
    }
  } catch (err) {
    console.warn('Error loading Mistral API keys from DB:', err.message);
  }
  // Fallback if not loaded or table missing
  if (MISTRAL_KEYS.length === 0) {
    MISTRAL_KEYS = [
      'B6KA3eT9mWb5bUhVU72J6iNbvAiOePrt',
      '8tx333nbwi9Gf10j5RHVbWODonisABoX'
    ];
  }
}

let generatedQuestions = [];

const SUPABASE_URL = 'https://ivbhpsqlnlundhotgonf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2Ymhwc3Fsbmx1bmRob3Rnb25mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MjUwMjEsImV4cCI6MjA5NzQwMTAyMX0.SnrfpFSv5-2YauC-3ca0pmfi1VM1ikdaeyTdaMBV-KQ';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
  // Check auth
  if (sessionStorage.getItem('up_admin_auth') !== '1') {
    const gate = document.getElementById('auth-gate');
    if (gate) gate.style.display = 'flex';
    return;
  }

  loadAutocompleteSuggestions();

  const btnGenerate = document.getElementById('btn-generate');
  const btnClear = document.getElementById('btn-clear');
  const btnSend = document.getElementById('btn-send');

  let selectedModelId = 'mistral-large-latest';
  const modelCards = document.querySelectorAll('#model-grid .model-card');
  modelCards.forEach(card => {
    card.addEventListener('click', () => {
      modelCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      selectedModelId = card.dataset.model;
    });
  });

  // Generation
  if (btnGenerate) {
    btnGenerate.addEventListener('click', async () => {
      const modeAuto = document.getElementById('mode-auto')?.classList.contains('active');
      const count = parseInt(document.getElementById('question-count')?.value || '10');
      const promptText = document.getElementById('ai-prompt')?.value.trim();

      if (modeAuto && !promptText) {
        showToast('Please provide an AI Prompt.', 'error');
        return;
      }

      btnGenerate.disabled = true;
      document.getElementById('gen-loading').classList.add('active');

      try {
        await loadMistralApiKeys();
        if (modeAuto) {
          await generateViaMistral(count, promptText, selectedModelId);
        } else {
          // Manual
          const raw = document.getElementById('manual-questions').value;
          if (typeof validateQuestionSequence === 'function') {
            const seqCheck = validateQuestionSequence(raw);
            if (!seqCheck.valid) throw new Error(seqCheck.error);
          }
          await arrangeManualViaMistral(raw, selectedModelId);
        }
        renderExamPreview();
        btnSend.classList.add('visible');
        showToast(`Successfully generated ${generatedQuestions.length} questions.`, 'success');
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
      } finally {
        btnGenerate.disabled = false;
        document.getElementById('gen-loading').classList.remove('active');
      }
    });
  }

  if (btnClear) {
    btnClear.addEventListener('click', () => {
      generatedQuestions = [];
      renderExamPreview();
      btnSend.classList.remove('visible');
      document.getElementById('manual-questions').value = '';
    });
  }

  if (btnSend) {
    btnSend.addEventListener('click', async () => {
      if (!generatedQuestions.length) {
        showToast('No questions to save!', 'error');
        return;
      }

      // Gather form fields
      const institution = document.getElementById('institution').value.trim();
      const faculty = document.getElementById('faculty').value.trim();
      const department = document.getElementById('department').value.trim();
      const courseCode = document.getElementById('course_code').value.trim();
      const courseTitle = document.getElementById('course_title').value.trim();
      const topic = document.getElementById('topic').value.trim();
      const level = document.getElementById('level').value;

      if (!courseCode || !topic) {
        showToast('Course Code and Topic are required.', 'error');
        return;
      }

      btnSend.disabled = true;
      btnSend.innerHTML = '💾 Saving...';

      let maxOrderId = 0;
      try {
        const { data: maxData } = await supabaseClient
          .from('exam_flashcards')
          .select('order_id')
          .eq('course_code', courseCode)
          .eq('topic', topic)
          .order('order_id', { ascending: false })
          .limit(1)
          .single();

        if (maxData && maxData.order_id) {
          maxOrderId = maxData.order_id;
        }
      } catch (err) {
        // Table might be empty for this course/topic, keep maxOrderId = 0
      }

      const rowsToInsert = generatedQuestions.map((q, idx) => ({
        institution,
        faculty,
        department,
        course_code: courseCode,
        course_title: courseTitle,
        topic,
        level,
        order_id: maxOrderId + idx + 1,
        front: q.front || q.question,
        back: q.back || q.explanation || q.answer
      }));

      try {
        const { error } = await supabaseClient.from('exam_flashcards').insert(rowsToInsert);
        if (error) throw error;

        showToast('Flashcards saved successfully to the database!', 'success');
        generatedQuestions = [];
        renderExamPreview();
        btnSend.classList.remove('visible');
        loadAutocompleteSuggestions(); // Refresh autocomplete with new entries!
      } catch (err) {
        showToast('Failed to save: ' + err.message, 'error');
      } finally {
        btnSend.disabled = false;
        btnSend.innerHTML = '💾 Save Flashcards';
      }
    });
  }

  // Toggles
  const modeAuto = document.getElementById('mode-auto');
  const modeManual = document.getElementById('mode-manual');
  const autoSection = document.getElementById('auto-section');
  const manualSection = document.getElementById('manual-section');
  const promptEl = document.getElementById('ai-prompt');
  const promptLabel = document.getElementById('ai-prompt-label');

  let savedAutoPrompt = '';
  const MANUAL_INSTRUCTION = 'You are a formatting assistant. Take the block of text you receive (flashcard data, front and back sides). Do NOT modify, delete, or rewrite any content. Your task is to convert it into a JSON array of objects with keys: front, back.';

  modeAuto?.addEventListener('click', () => {
    modeAuto.classList.add('active');
    modeManual.classList.remove('active');
    autoSection.classList.remove('hidden');
    manualSection.classList.add('hidden');
    if (promptEl) {
      promptEl.value = savedAutoPrompt;
      promptEl.readOnly = false;
      promptEl.style.opacity = '';
      promptEl.style.cursor = '';
      promptEl.style.background = '';
    }
    if (promptLabel) {
      promptLabel.innerHTML = 'AI Prompt <span class="hint">(topic, syllabus, style)</span>';
    }
  });

  modeManual?.addEventListener('click', () => {
    modeManual.classList.add('active');
    modeAuto.classList.remove('active');
    manualSection.classList.remove('hidden');
    autoSection.classList.add('hidden');
    if (promptEl) {
      savedAutoPrompt = promptEl.value;
      promptEl.value = MANUAL_INSTRUCTION;
      promptEl.readOnly = true;
      promptEl.style.opacity = '0.65';
      promptEl.style.cursor = 'not-allowed';
      promptEl.style.background = 'rgba(255,255,255,0.04)';
    }
    if (promptLabel) {
      promptLabel.innerHTML = 'AI Instruction <span class="hint">(read-only -- sent automatically in manual mode)</span>';
    }
  });

  const qCount = document.getElementById('question-count');
  const qDisp = document.getElementById('question-count-display');
  qCount?.addEventListener('input', () => { qDisp.textContent = qCount.value; });

  const manualTextarea = document.getElementById('manual-questions');
  const manualCount = document.getElementById('manual-count');

  window.validateQuestionSequence = function(rawText) {
    const lines = rawText.split(/\r?\n/);
    let frontCount = 0;
    let backCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*(?:\d+[\)\.\-]\s*)?FRONT\s*:/i.test(line)) frontCount++;
      if (/^\s*(?:\d+[\)\.\-]\s*)?BACK\s*:/i.test(line)) backCount++;
    }
    
    if (frontCount === 0) return { valid: false, error: 'No FRONT: detected.' };
    if (frontCount !== backCount) return { valid: false, error: `Mismatch: ${frontCount} FRONT(s) but ${backCount} BACK(s)` };
    
    return { valid: true };
  };

  window.splitIntoBlocks = function(raw) {
    const lines = raw.split(/\r?\n/);
    let blocks = [];
    let currentBlock = [];
    const startRegex = /^\s*(?:\d+[\)\.\-]\s*)?FRONT\s*:/i;
    for (let line of lines) {
       if (startRegex.test(line)) {
         if (currentBlock.length) blocks.push(currentBlock.join('\n'));
         currentBlock = [line];
       } else {
         if (currentBlock.length) currentBlock.push(line);
       }
    }
    if (currentBlock.length) blocks.push(currentBlock.join('\n'));
    return blocks;
  };

  function updateManualCount() {
    const raw = manualTextarea.value.trim();
    if (!raw) {
      manualCount.style.display = 'none';
      manualCount.classList.add('hidden');
      return;
    }

    const seqCheck = window.validateQuestionSequence(raw);
    if (!seqCheck.valid) {
      manualCount.innerHTML = `<span style="color: #ef4444; font-weight: bold;">[!] ${seqCheck.error}</span>`;
      manualCount.style.display = 'block';
      manualCount.classList.remove('hidden');
      return;
    }

    const blocks = window.splitIntoBlocks(raw);
    const count = blocks.length;
    manualCount.innerHTML = count + ' question' + (count !== 1 ? 's' : '') + ' detected <span style="color: #10b981;">[OK]</span>';
    manualCount.style.display = 'block';
    manualCount.classList.remove('hidden');
  }

  if (manualTextarea && manualCount) {
    manualTextarea.addEventListener('input', updateManualCount);
  }
});

/* ── AUTOCOMPLETE FAST DB FETCH ── */
let uniqueValues = {
  institution: [],
  faculty: [],
  department: [],
  course_code: [],
  course_title: [],
  topic: []
};

async function loadAutocompleteSuggestions() {
  try {
    const { data, error } = await supabaseClient
      .from('exam_flashcards')
      .select('institution, faculty, department, course_code, course_title, topic, level')
      .limit(1000); // fetch recent for fast autocomplete

    if (error) throw error;
    if (!data) return;

    // Use Sets to get unique values
    const uniqueSets = {
      institution: new Set(),
      faculty: new Set(),
      department: new Set(),
      course_code: new Set(),
      course_title: new Set(),
      topic: new Set()
    };

    data.forEach(row => {
      if (row.institution) uniqueSets.institution.add(row.institution);
      if (row.faculty) uniqueSets.faculty.add(row.faculty);
      if (row.department) uniqueSets.department.add(row.department);
      if (row.course_code) uniqueSets.course_code.add(row.course_code);
      if (row.course_title) uniqueSets.course_title.add(row.course_title);
      if (row.topic) uniqueSets.topic.add(row.topic);
    });

    uniqueValues.institution = Array.from(uniqueSets.institution);
    uniqueValues.faculty = Array.from(uniqueSets.faculty);
    uniqueValues.department = Array.from(uniqueSets.department);
    uniqueValues.course_code = Array.from(uniqueSets.course_code);
    uniqueValues.course_title = Array.from(uniqueSets.course_title);
    uniqueValues.topic = Array.from(uniqueSets.topic);

    setupAutocomplete('institution');
    setupAutocomplete('faculty');
    setupAutocomplete('department');
    setupAutocomplete('course_code');
    setupAutocomplete('course_title');
    setupAutocomplete('topic');
  } catch (err) {
    console.warn('Could not load suggestions from DB:', err.message);
  }
}

function setupAutocomplete(fieldId) {
  const input = document.getElementById(fieldId);
  if (!input) return;

  // Create the ul element dynamically if it doesn't exist
  let ul = document.getElementById('ul-' + fieldId);
  if (!ul) {
    ul = document.createElement('ul');
    ul.id = 'ul-' + fieldId;
    ul.className = 'autocomplete-list';
    input.parentNode.appendChild(ul);
  }

  input.addEventListener('input', () => {
    const val = input.value.toLowerCase();
    ul.innerHTML = '';
    if (!val) {
      ul.style.display = 'none';
      return;
    }

    const matches = uniqueValues[fieldId].filter(item => item.toLowerCase().includes(val));
    if (matches.length === 0) {
      ul.style.display = 'none';
      return;
    }

    matches.forEach(match => {
      const li = document.createElement('li');
      li.textContent = match;
      li.addEventListener('click', () => {
        input.value = match;
        ul.style.display = 'none';
      });
      ul.appendChild(li);
    });
    ul.style.display = 'block';
  });

  // Hide when clicking outside
  document.addEventListener('click', function (e) {
    if (e.target !== input && e.target !== ul) {
      ul.style.display = 'none';
    }
  });
}

/* ── MISTRAL INTEGRATION ── */
async function callMistral(promptText, modelId) {
  const schema = {
    type: "object",
    properties: {
      flashcards: {
        type: "array",
        items: {
          type: "object",
          properties: {
            front: { type: "string" },
            back: { type: "string" }
          },
          required: ["front", "back"]
        }
      }
    },
    required: ["flashcards"]
  };

  const fullPrompt = `${promptText}\n\nReturn ONLY valid JSON matching this schema: ${JSON.stringify(schema)}. DO NOT include any markdown code blocks or additional text.`;

  let lastError = null;
  for (const key of MISTRAL_KEYS) {
    try {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: modelId,
          temperature: 0.7,
          messages: [{ role: 'user', content: fullPrompt }],
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || `API error ${response.status}`);
      }
      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (err) {
      lastError = err;
      console.warn(`Key ${key.substring(0, 5)} failed:`, err.message);
    }
  }
  throw new Error(`All Mistral API keys failed. Last error: ${lastError.message}`);
}

async function generateViaMistral(count, topic, modelId) {
  const prompt = `You are an expert educator. Generate exactly ${count} high-quality flashcards about: ${topic}.`;

  const rawText = await callMistral(prompt, modelId);
  parseAndAppendQuestions(rawText);
}

async function arrangeManualViaMistral(rawInput, modelId) {
  if (!rawInput.trim()) throw new Error('Please paste content first.');
  const prompt = `You are a formatting assistant. Convert the following text into structured flashcards:
"""
${rawInput}
"""`;

  const rawText = await callMistral(prompt, modelId);
  parseAndAppendQuestions(rawText);
}

function parseAndAppendQuestions(rawText) {
  let clean = rawText.trim();
  clean = clean.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch (e) {
    const arrStart = clean.indexOf('{');
    const arrEnd = clean.lastIndexOf('}');
    if (arrStart === -1 || arrEnd === -1) throw new Error('AI returned invalid JSON.');
    parsed = JSON.parse(clean.slice(arrStart, arrEnd + 1));
  }

  if (!parsed.flashcards || !Array.isArray(parsed.flashcards)) {
    throw new Error('AI returned invalid schema.');
  }

  generatedQuestions = generatedQuestions.concat(parsed.flashcards);
}

function renderExamPreview() {
  const previewList = document.getElementById('preview-list');
  const previewStats = document.getElementById('preview-stats');
  const previewStatus = document.getElementById('preview-status');
  if (!previewList) return;

  if (!generatedQuestions || generatedQuestions.length === 0) {
    previewList.innerHTML = `
      <div class="preview-empty">
        <div class="icon">🃏</div>
        <h4>Preview your flashcard set</h4>
        <p>Configure parameters and click Generate, or paste your flashcards to arrange them.</p>
      </div>`;
    if (previewStatus) previewStatus.textContent = 'Awaiting input';
    if (previewStats) previewStats.classList.add('hidden');
    return;
  }

  if (previewStatus) previewStatus.textContent = 'Preview Ready';
  if (previewStats) {
    previewStats.classList.remove('hidden');
    previewStats.innerHTML = `<strong>${generatedQuestions.length}</strong> Flashcards Generated`;
  }

  let html = '<div class="fc-deck-grid">';
  generatedQuestions.forEach((q, i) => {
    html += `
      <div class="fc-card" style="animation-delay: ${i * 0.03}s">
        <div class="fc-card-num">Card ${i + 1}</div>
        <div class="fc-front">📖 ${escapeHtml(q.front)}</div>
        <div class="fc-back">${escapeHtml(q.back)}</div>
      </div>
    `;
  });
  html += '</div>';
  previewList.innerHTML = html;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.remove(); }, 3500);
}
