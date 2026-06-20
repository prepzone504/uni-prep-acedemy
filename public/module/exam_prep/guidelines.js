/* ============================================
   UNIPREP — EXAM GUIDELINES JS
============================================ */

function initGuidelines() {
  const params = new URLSearchParams(window.location.search);
  const courseId = params.get('course') || 'mth101';
  const topicId = params.get('topic');
  const isPracticeAll = params.get('mode') === 'all';

  const subtitle = document.getElementById('gl-subtitle');
  const btnStartNow = document.getElementById('btn-start-now');

  // Set the dynamic subtitle based on parameters
  if (isPracticeAll) {
    subtitle.innerHTML = `You are about to start a <strong>Full Practice Exam</strong> for <strong>${courseId.toUpperCase()}</strong>.`;
  } else if (topicId) {
    subtitle.innerHTML = `You are about to practice <strong>Topic: ${topicId}</strong> for <strong>${courseId.toUpperCase()}</strong>.`;
  } else {
    subtitle.innerHTML = `You are about to start an exam simulation.`;
  }

  // Pass all query parameters forward to the exam simulator
  btnStartNow.setAttribute('href', `exam_prep.html?${params.toString()}`);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGuidelines);
} else {
  initGuidelines();
}
