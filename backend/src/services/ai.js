// Simple AI service wrapper. Prefers local RAG service (RAG_API_URL) and otherwise returns a canned fallback.
// Exports: answerQuestion({ community, user, question, contextPosts }) => string
async function answerQuestion({ community, user, question, contextPosts = [] }) {
  const RAG_API_URL = process.env.RAG_API_URL || null;
  if (RAG_API_URL) {
    // prefer calling a local/remote RAG Python service that wraps your rag_service
    try {
      const resp = await fetch(RAG_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, community, contextPosts, user: { id: user?.id, name: user?.name } }),
      });

      let j = null;
      try {
        j = await resp.json();
      } catch (parseErr) {
        const text = await resp.text().catch(() => null);
        console.warn('RAG service returned non-JSON response', { status: resp.status, text });
      }

      // expect { answer: '...' } from the RAG service
      if (resp.ok && j && (j.answer || j.text)) return j.answer || j.text;
      // log details for debugging
      console.warn('RAG service returned non-OK or no answer', { status: resp.status, body: j });
    } catch (err) {
      console.error('RAG service call failed', err);
      // fall through to canned fallback
    }
    }

    // If no RAG service or it failed, return a safe canned fallback
    console.warn('RAG service not configured or failed; returning canned fallback');
    return `Assistant (fallback): Based on your question "${question}" about ${community || 'this topic'}, here's a general suggestion — please consult a medical professional for personalised advice.`;
}

module.exports = { answerQuestion };

