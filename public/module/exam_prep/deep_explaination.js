/* ============================================
   UNIPREP — DEEP THINK AI JS
============================================ */

async function initDeepThink() {
    const contextStr = sessionStorage.getItem('deepThinkContext');
    if (!contextStr) {
        document.getElementById('dt-explanation-content').innerHTML = "<p style='color:red'>Error: No question context found. Please return to the exam review.</p>";
        return;
    }

    const ctx = JSON.parse(contextStr);
    
    const labels = ['A', 'B', 'C', 'D'];

    // Trigger MathJax for the question
    if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise().catch((err) => console.log('MathJax error: ', err.message));
    }

    // Cache Implementation
    // Hash or simply slice the question to create a unique key
    const cacheKey = 'dt_cache_' + btoa(unescape(encodeURIComponent(ctx.q.substring(0, 100))));
    const cachedResponse = sessionStorage.getItem(cacheKey);

    if (cachedResponse) {
        renderAIResponse(cachedResponse);
        return;
    }

    // Initialize Supabase
    const SUPABASE_URL = 'https://ivbhpsqlnlundhotgonf.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2Ymhwc3Fsbmx1bmRob3Rnb25mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MjUwMjEsImV4cCI6MjA5NzQwMTAyMX0.SnrfpFSv5-2YauC-3ca0pmfi1VM1ikdaeyTdaMBV-KQ';
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    try {
        // Fetch Mistral Keys
        const { data, error } = await supabaseClient
            .from('app_settings')
            .select('value')
            .eq('key', 'mistral_api_key')
            .single();

        if (error || !data) throw new Error("Could not fetch AI configuration.");

        const MISTRAL_KEYS = data.value.split(',').map(k => k.trim()).filter(Boolean);
        if (MISTRAL_KEYS.length === 0) throw new Error("No AI keys found.");

        const prompt = `You are a highly intelligent and expert exam evaluator. 
Given the following multiple-choice question, the correct answer, and the user's selected answer, 
please provide a very detailed, deep explanation.

Question: ${ctx.q}
Options:
A) ${ctx.options[0]}
B) ${ctx.options[1]}
C) ${ctx.options[2]}
D) ${ctx.options[3]}

Correct Option: ${labels[ctx.correctIdx]}
User's Option: ${ctx.userIdx === -1 ? 'None (Skipped)' : labels[ctx.userIdx]}
Original Explanation Hint (if any): ${ctx.explanation}

Provide a deep, step-by-step logical breakdown of why the Correct Option is right. 
Then, meticulously explain why each of the other options is incorrect. 
Format your response beautifully using Markdown. YOU MUST USE LaTeX FORMAT FOR ALL EQUATIONS, FORMULAS, AND MATH SYMBOLS. 
Use $$ ... $$ for block equations and \\( ... \\) for inline math equations. Do not use plain text for any math.`;

        // We will try the keys one by one until success
        let aiResponse = null;
        let lastError = null;

        for (const key of MISTRAL_KEYS) {
            try {
                const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${key}`
                    },
                    body: JSON.stringify({
                        model: 'mistral-small-latest',
                        messages: [{ role: 'user', content: prompt }]
                    })
                });

                if (!response.ok) {
                    throw new Error(`Mistral API Error: ${response.statusText}`);
                }

                const result = await response.json();
                aiResponse = result.choices[0].message.content;
                break; // Success, exit loop
            } catch (err) {
                lastError = err;
            }
        }

        if (!aiResponse) throw lastError || new Error("AI request failed on all keys.");

        // Cache the successful response so it persists on refresh
        sessionStorage.setItem(cacheKey, aiResponse);

        renderAIResponse(aiResponse);

    } catch (err) {
        document.getElementById('dt-explanation-content').innerHTML = `
            <div style="padding: 20px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 12px; color: #fca5a5;">
                <h3 style="margin-top:0; color: #ef4444;">AI Evaluation Failed</h3>
                <p>${err.message}</p>
            </div>
        `;
    }
}

function renderAIResponse(aiResponse) {
    try {
        // Clean double backslashes which might break MathJax
        let cleanedResponse = aiResponse
            .replace(/\\\\\(/g, '\\(')
            .replace(/\\\\\)/g, '\\)')
            .replace(/\\\\\[/g, '\\[')
            .replace(/\\\\\]/g, '\\]');

        // Strip raw markdown block wrapper if AI used it
        cleanedResponse = cleanedResponse.trim();
        if (cleanedResponse.startsWith('```markdown')) {
            cleanedResponse = cleanedResponse.replace(/^```markdown\n?/i, '').replace(/```$/i, '').trim();
        } else if (cleanedResponse.startsWith('```')) {
            cleanedResponse = cleanedResponse.replace(/^```\n?/i, '').replace(/```$/i, '').trim();
        }

        // Advanced Algorithm: Protect LaTeX blocks from marked.js mangling
        let mathBlocks = [];
        let processedText = cleanedResponse.replace(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g, (match) => {
            mathBlocks.push(match);
            return `@@MATH_BLOCK_${mathBlocks.length - 1}@@`;
        });

        // Parse Markdown
        let htmlContent = marked.parse(processedText);

        // Restore LaTeX blocks exactly as they were
        htmlContent = htmlContent.replace(/@@MATH_BLOCK_(\d+)@@/g, (match, index) => {
            return mathBlocks[index];
        });

        const expContainer = document.getElementById('dt-explanation-content');
        expContainer.innerHTML = htmlContent;

        // Run MathJax
        if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise([expContainer]).catch((err) => console.log('MathJax error: ', err.message));
        }

    } catch (err) {
        document.getElementById('dt-explanation-content').innerHTML = `
            <div style="padding: 20px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 12px; color: #fca5a5;">
                <h3 style="margin-top:0; color: #ef4444;">AI Evaluation Failed</h3>
                <p>${err.message}</p>
            </div>
        `;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDeepThink);
} else {
    initDeepThink();
}
