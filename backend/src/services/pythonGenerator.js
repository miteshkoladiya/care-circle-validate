const axios = require('axios');

// Run generator remotely via HTTP
async function runGeneratorAsync(community, timeslot, options = {}) {
  const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:7860';
  
  try {
    const payload = {
      community,
      timeslot, // Not used by the simple API but kept for compatibility
      question: `Generate similar content for community: ${community}`, // Adapting to the simple API
      // The API expects: { question, community, contextPosts, user }
      // We'll map the inputs as best as possible
    };

    // If there's extra options, merge them
    if (options.extra) {
      Object.assign(payload, options.extra);
    }
    
    // The previous implementation ran a script with: --dry-run --num-per-community N
    // The new API is a RAG chatbot endpoint generally.
    // However, if we want to trigger generation, we might need a specific endpoint or just ask it to generate.
    // Looking at rag_api.py, it expects: class AskRequest(BaseModel): question, community, contextPosts, user
    
    // Let's assume we want to ask it to generate content.
    const response = await axios.post(`${mlServiceUrl}/ask`, payload);
    
    // The response is { answer: str }
    // The previous implementation expected JSON array/object.
    // If the ML model returns a string, we might need to parse it or wrap it.
    
    // Note: The previous implementation was very specific locally. 
    // We are adapting to the generic /ask endpoint unless we add a specific generation endpoint to rag_api.py.
    // For now, let's return the answer as if it's the result.
    
    return { 
      ok: true, 
      json: response.data.answer, // Depending on what 'answer' contains (JSON string or text)
      raw: JSON.stringify(response.data)
    };

  } catch (err) {
    console.error('ML Service Error:', err.message);
    return { 
      ok: false, 
      error: 'ml_service_error', 
      details: err.response ? err.response.data : err.message 
    };
  }
}

module.exports = { runGeneratorAsync };
