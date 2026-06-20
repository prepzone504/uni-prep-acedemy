/* ============================================
   UNIPREP — EXAM DISCUSSION CREATOR (MISTRAL AI)
   exam_discuss_gen.js
============================================ */

const SUPABASE_URL = 'https://ivbhpsqlnlundhotgonf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2Ymhwc3Fsbmx1bmRob3Rnb25mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MjUwMjEsImV4cCI6MjA5NzQwMTAyMX0.SnrfpFSv5-2YauC-3ca0pmfi1VM1ikdaeyTdaMBV-KQ';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let MISTRAL_KEYS = [];
async function loadMistralApiKeys() {
  if (MISTRAL_KEYS.length > 0) return MISTRAL_KEYS;
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
  if (MISTRAL_KEYS.length === 0) {
    MISTRAL_KEYS = [
      'B6KA3eT9mWb5bUhVU72J6iNbvAiOePrt',
      '8tx333nbwi9Gf10j5RHVbWODonisABoX'
    ];
  }
  return MISTRAL_KEYS;
}

async function callMistralApiWithKey(apiKey, modelId, prompt) {
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Mistral API error ${response.status}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function setGenerating(loadingEl, active, textEl, message) {
  if (!loadingEl) return;
  loadingEl.classList.toggle('active', active);
  if (textEl && message) textEl.innerHTML = message;
}

function splitIntoBlocks(rawText) {
  let text = (rawText || '').replace(/\r\n/g, '\n').trim();
  if (!text) return [];
  const lines = text.split('\n');
  const extractNumRegex = /^\s*(?:(?:question|q|ques)\s*:?\s*(\d+)[\)\.\-]?|(\d+)\s*[\)\.\-])(?:[ \t]+|$)/i;
  const questionStarts = [];
  let expectedNumber = 1;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(extractNumRegex);
    if (match) {
      const num = parseInt(match[1] || match[2], 10);
      if (num === expectedNumber) {
        questionStarts.push({ lineIdx: i, num });
        expectedNumber++;
      }
    }
  }
  if (questionStarts.length === 0) {
    return text.split(/\n\s*\n+/).map(b => b.trim()).filter(Boolean);
  }
  const blocks = [];
  for (let q = 0; q < questionStarts.length; q++) {
    const startLine = questionStarts[q].lineIdx;
    const endLine = (q + 1 < questionStarts.length) ? questionStarts[q + 1].lineIdx : lines.length;
    const blockLines = [];
    for (let i = startLine; i < endLine; i++) blockLines.push(lines[i]);
    const joined = blockLines.join('\n').trim();
    if (joined) blocks.push(joined);
  }
  return blocks;
}

function validateQuestionSequence(rawText) {
  const lines = rawText.split(/\r?\n/);
  let expectedNumber = 1;
  const questionStartRegex = /^\s*(?:(?:question|q|ques)\s*:?\s*(\d+)[\)\.\-]?|(\d+)\s*[\)\.\-])(?:[ \t]+|$)/i;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(questionStartRegex);
    if (match) {
      const numStr = match[1] || match[2];
      if (numStr) {
        const num = parseInt(numStr, 10);
        if (num !== expectedNumber) {
          let snippet = lines[i].trim();
          if (snippet.length > 30) snippet = snippet.substring(0, 30) + '...';
          return { valid: false, error: `Sequence broken at line ${i + 1}: Expected ${expectedNumber}, found ${num} ("${snippet}")` };
        }
        expectedNumber++;
      }
    }
  }
  return { valid: true };
}

document.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('up_admin_auth') !== '1') {
    const gate = document.getElementById('auth-gate');
    if (gate) gate.style.display = 'flex';
    return;
  }

  const modeAuto = document.getElementById('mode-auto');
  const modeManual = document.getElementById('mode-manual');
  const autoSection = document.getElementById('auto-section');
  const manualSection = document.getElementById('manual-section');
  const promptEl = document.getElementById('ai-prompt');
  const promptLabel = document.getElementById('ai-prompt-label');
  let savedAutoPrompt = '';
  const MANUAL_INSTRUCTION = 'You are a formatting assistant. Take the block of text you receive. Do NOT modify, delete, or rewrite any question, option, answer, or explanation. Your task is to convert it into JSON array format.';

  let currentMode = 'auto';

  modeAuto?.addEventListener('click', () => {
    currentMode = 'auto';
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
    if (promptLabel) promptLabel.innerHTML = 'AI Prompt <span class="hint">(topic, syllabus, style)</span>';
  });

  modeManual?.addEventListener('click', () => {
    currentMode = 'manual';
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
    if (promptLabel) promptLabel.innerHTML = 'AI Instruction <span class="hint">(read-only -- sent automatically in manual mode)</span>';
  });

  const qCount = document.getElementById('question-count');
  const qDisp = document.getElementById('question-count-display');
  qCount?.addEventListener('input', () => { qDisp.textContent = qCount.value; });

  const manualTextarea = document.getElementById('manual-questions');
  const manualCount = document.getElementById('manual-count');
  manualTextarea?.addEventListener('input', () => {
    const raw = manualTextarea.value.trim();
    if (!raw) { manualCount.classList.add('hidden'); return; }
    const seqCheck = validateQuestionSequence(raw);
    if (!seqCheck.valid) {
      manualCount.innerHTML = `<span style="color: #ef4444; font-weight: bold;">[!] ${seqCheck.error}</span>`;
      manualCount.classList.remove('hidden');
      return;
    }
    const blocks = splitIntoBlocks(raw);
    const count = blocks.length;
    manualCount.innerHTML = count + ' question' + (count !== 1 ? 's' : '') + ' detected <span style="color: #10b981;">[OK]</span>';
    manualCount.classList.remove('hidden');
  });

  let getModel = () => {
    const activeCard = document.querySelector('#model-grid .model-card.active');
    return activeCard ? activeCard.dataset.model : 'mistral-large-latest';
  };
  const modelCards = document.querySelectorAll('#model-grid .model-card');
  modelCards.forEach(card => {
    card.addEventListener('click', () => {
      modelCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    });
  });

  let generatedItems = [];
  const loading = document.getElementById('gen-loading');
  const loadingText = document.getElementById('gen-loading-text');
  const previewList = document.getElementById('preview-list');
  const previewStatus = document.getElementById('preview-status');
  const btnSend = document.getElementById('btn-send');
  const btnGenerate = document.getElementById('btn-generate');

  function renderExamPreview(items) {
    if (!items.length) {
      previewList.innerHTML = `<div class="preview-empty"><div class="icon">💬</div><h4>Preview your discussion round</h4><p>Set your prompt, choose questions, then click Preview Round.</p></div>`;
      return;
    }
    previewList.innerHTML = items.map((item, i) => `
      <div class="preview-card" style="animation-delay: ${i * 0.02}s;">
        <div class="preview-card-header">
          <span class="preview-card-num">Q${item.num}</span>
          <span class="preview-card-diff diff-${item.difficulty || 'medium'}">${item.difficulty || 'medium'}</span>
        </div>
        <p class="preview-card-q">${item.question}</p>
        <div class="preview-options">
          ${item.options.map(o => `<div class="preview-opt ${o.correct ? 'correct' : ''}">${o.letter}. ${o.text}</div>`).join('')}
        </div>
        ${item.explanation ? `<div style="margin-top:10px;font-size:0.8rem;color:var(--ad-muted);line-height:1.5;padding-top:8px;border-top:1px dashed rgba(255,255,255,0.05)">💡 ${item.explanation}</div>` : ''}
      </div>
    `).join('');
  }

  btnGenerate?.addEventListener('click', async () => {
    const subject = document.getElementById('subject-select').value;
    if (!subject) { showToast('Please select a course code.', 'error'); return; }

    const modelId = getModel();
    btnGenerate.disabled = true;

    if (currentMode === 'manual') {
      const raw = manualTextarea.value.trim();
      if (!raw) {
        showToast('Paste at least one question block first.', 'error');
        btnGenerate.disabled = false;
        return;
      }
      const seqCheck = validateQuestionSequence(raw);
      if (!seqCheck.valid) {
        showToast('Validation Error: ' + seqCheck.error, 'error');
        btnGenerate.disabled = false;
        return;
      }
      const blocks = splitIntoBlocks(raw);
      if (!blocks.length) {
        showToast('Paste at least one question block first.', 'error');
        btnGenerate.disabled = false;
        return;
      }

      generatedItems = [];
      setGenerating(loading, true, loadingText, 'Sending to <strong>Mistral AI</strong> for arrangement...');
      previewList.innerHTML = '';

      try {
        const BATCH_SIZE = 5;
        const keys = await loadMistralApiKeys();
        const batches = [];
        for (let i = 0; i < blocks.length; i += BATCH_SIZE) {
           batches.push({ index: batches.length, blocks: blocks.slice(i, i + BATCH_SIZE) });
        }

        const batchResults = new Array(batches.length).fill(null);
        const batchQueue = [...batches];
        let queuePointer = 0;
        let hasFatalError = false;
        const startTime = Date.now();
        let lastRenderedCount = 0;

        const updateUI = () => {
          let currentFlatted = [];
          for (let i = 0; i < batchResults.length; i++) {
            if (batchResults[i]) currentFlatted = currentFlatted.concat(batchResults[i]);
            else break;
          }
          generatedItems = currentFlatted.map((item, idx) => ({
            num: idx + 1,
            question: item.question || ('Question ' + (idx + 1)),
            options: (item.options || []).map(o => ({ letter: o.letter, text: o.text, correct: !!o.correct })),
            difficulty: item.difficulty || 'medium',
            explanation: item.explanation || 'No explanation provided.',
          }));

          const newItems = generatedItems.slice(lastRenderedCount);
          if (newItems.length > 0) {
            const fragment = document.createDocumentFragment();
            newItems.forEach(item => {
              const card = document.createElement('div');
              card.className = 'preview-card';
              card.innerHTML = `<div class="preview-card-header"><span class="preview-card-num">Q${item.num}</span></div><p class="preview-card-q">${item.question}</p><div class="preview-options">${item.options.map(o => `<div class="preview-opt ${o.correct ? 'correct' : ''}">${o.letter}. ${o.text}</div>`).join('')}</div>`;
              fragment.appendChild(card);
            });
            previewList.appendChild(fragment);
            lastRenderedCount = generatedItems.length;
          }

          const done = generatedItems.length;
          const remaining = blocks.length - done;
          const elapsed = (Date.now() - startTime) / 1000;
          let etaText = '';
          if (done > 0) {
            const secsPerQ = elapsed / done;
            const etaSecs = Math.round(secsPerQ * remaining);
            etaText = etaSecs >= 60 ? ` | ~${Math.floor(etaSecs / 60)}m ${etaSecs % 60}s left` : ` | ~${etaSecs}s left`;
          }
          previewStatus.textContent = `${done} / ${blocks.length} done | ${remaining} remaining${etaText}`;
          previewList.scrollTop = previewList.scrollHeight;
        };

        updateUI();

        const worker = async (keyToUse, keyIndex) => {
          while (!hasFatalError) {
            if (queuePointer >= batchQueue.length) break;
            const batch = batchQueue[queuePointer++];
            if (batchResults[batch.index]) continue;

            const chunkText = batch.blocks.join('\n\n');
            const manualPrompt = [
              'You are a formatting assistant.',
              'CRITICAL RULES:',
              '- Do NOT change or rephrase any text.',
              '- Do NOT add, remove, or reorder questions.',
              '- Return a JSON array with NO markdown.',
              '- Use ONLY standard double quotes (") for JSON keys. For inside strings use SINGLE QUOTES (\').',
              '- Keys needed: "question", "options" (array of {letter, text, correct:bool}), "explanation".',
              '- Mark correct:true on the correct option.',
              'PASTED QUESTIONS:',
              chunkText
            ].join('\n');

            let retries = 3;
            let delay = 1500;
            let success = false;

            while (!success && !hasFatalError) {
              try {
                const rawText = await callMistralApiWithKey(keyToUse, modelId, manualPrompt);
                let clean = rawText.trim().replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
                let parsed = JSON.parse(clean);
                if (!Array.isArray(parsed) || !parsed.length) throw new Error('AI returned no questions.');
                
                batchResults[batch.index] = parsed.slice(0, batch.blocks.length);
                success = true;
                updateUI();
              } catch (err) {
                retries--;
                if (retries <= 0) {
                  batchQueue.push(batch);
                  break;
                }
                await new Promise(r => setTimeout(r, delay));
                delay = Math.min(delay * 2, 16000);
              }
            }
          }
        };

        await Promise.all(keys.map((key, idx) => worker(key, idx)));
        const incomplete = batchResults.filter(r => r === null).length;
        if (incomplete > 0) throw new Error(`${incomplete * BATCH_SIZE} questions could not be generated.`);

        renderExamPreview(generatedItems);
        setGenerating(loading, false);
        previewStatus.textContent = `${generatedItems.length} questions arranged. Done!`;
        btnSend.classList.add('visible');
        showToast(`Arranged ${generatedItems.length} questions`, 'success');
      } catch (err) {
        setGenerating(loading, false);
        showToast('Fatal Error: ' + err.message, 'error');
      } finally {
        btnGenerate.disabled = false;
      }
      return;
    }

    // AUTO MODE
    const prompt = document.getElementById('ai-prompt').value.trim();
    if (!prompt) { showToast('Please enter an AI prompt.', 'error'); btnGenerate.disabled = false; return; }
    const count = parseInt(qCount.value, 10);

    setGenerating(loading, true, loadingText, `Connecting to <strong>Mistral AI (${modelId})</strong>...`);
    generatedItems = [];

    try {
      const keys = await loadMistralApiKeys();
      const CONCURRENCY = keys.length;
      
      while (generatedItems.length < count) {
        const remaining = count - generatedItems.length;
        const batchCount = Math.min(CONCURRENCY, remaining);
        
        const promises = [];
        for (let k = 0; k < batchCount; k++) {
          const keyToUse = keys[k % keys.length];
          const fullPrompt = `You are an expert exam question creator.
Generate exactly 1 discussion exam question for the subject: ${subject}.
Context: ${prompt}
Rules:
- Return ONLY valid JSON array with NO markdown. 
- Format: [{"question":"...","options":[{"letter":"A","text":"...","correct":false},{"letter":"B","text":"...","correct":true},...],"explanation":"..."}]
- Exactly one correct option.`;

          promises.push((async () => {
            let retries = 3;
            while (retries > 0) {
              try {
                const rawText = await callMistralApiWithKey(keyToUse, modelId, fullPrompt);
                let clean = rawText.trim().replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
                let parsed = JSON.parse(clean);
                return parsed;
              } catch (err) {
                retries--;
                if (retries === 0) return [];
              }
            }
            return [];
          })());
        }

        const results = await Promise.allSettled(promises);
        for (const result of results) {
          if (generatedItems.length >= count) break;
          const batchItems = result.status === 'fulfilled' ? result.value : [];
          if (!batchItems.length) continue;
          const numberedBatch = batchItems.map((item, idx) => ({ ...item, num: generatedItems.length + idx + 1 }));
          generatedItems = generatedItems.concat(numberedBatch);
          renderExamPreview(generatedItems);
          previewStatus.textContent = `${generatedItems.length} / ${count} questions ready ...`;
          previewList.scrollTop = previewList.scrollHeight;
        }
      }

      setGenerating(loading, false);
      previewStatus.textContent = `${generatedItems.length} questions ready [OK]`;
      btnSend.classList.add('visible');
      showToast(`Generated ${generatedItems.length} questions`, 'success');
    } catch (err) {
      setGenerating(loading, false);
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      btnGenerate.disabled = false;
    }
  });

  document.getElementById('btn-clear')?.addEventListener('click', () => {
    generatedItems = [];
    renderExamPreview([]);
    previewStatus.textContent = 'Awaiting generation';
    if(manualTextarea) manualTextarea.value = '';
    if(promptEl) promptEl.value = '';
    btnSend.classList.remove('visible');
  });

  btnSend?.addEventListener('click', async () => {
    if (!generatedItems.length) { showToast('Generate questions first.', 'error'); return; }
    
    const title = document.getElementById('exam-title').value.trim() || 'Untitled Session';
    const subject = document.getElementById('subject-select').value;
    const topic = document.getElementById('topic')?.value.trim() || '';
    const institution = document.getElementById('institution').value.trim();
    const level = document.getElementById('level').value;
    const voteTime = parseInt(document.getElementById('vote-time').value, 10) || 60;
    const passMark = parseInt(document.getElementById('pass-mark').value, 10) || 50;
    
    btnSend.disabled = true;
    showToast('Saving to Supabase...', 'info');
    
    try {
      const batchId = crypto.randomUUID();
      const rows = generatedItems.map(item => ({
        exam_batch_id: batchId,
        exam_title: title,
        subject: subject,
        topic: topic,
        institution: institution,
        level: level,
        order_id: item.num,
        question_text: item.question,
        options: item.options,
        explanation: item.explanation || null,
        duration_mins: voteTime,
        pass_mark: passMark,
        dispatched_to: 'everyone'
      }));

      const { error } = await supabaseClient.from('exam_discussions').insert(rows);
      if (error) throw new Error(error.message);

      showToast(`[OK] Discussion "${title}" saved!`, 'success');
      previewStatus.textContent = `Saved to Database [OK]`;
    } catch (err) {
      showToast(`Save failed: ${err.message}`, 'error');
      console.error(err);
    } finally {
      btnSend.disabled = false;
    }
  });

});
