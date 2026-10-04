const fetch = require('node-fetch');

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:11434/api/chat';
const AI_MODEL = process.env.AI_MODEL || 'llama3.3:8b';

const handleAIRequest = async (req, res) => {
  const { prompt, context = '' } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt is required." });

  try {
    const response = await fetch(AI_ENGINE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: 'You are CipherAI, a privacy-focused assistant in CipherChat.' },
          { role: 'user', content: context ? `Context:\n${context}\n\nQuery: ${prompt}` : prompt }
        ],
        stream: false
      })
    });

    const data = await response.json();
    res.json({ success: true, reply: data.message?.content || "No response." });
  } catch (err) {
    res.status(500).json({ error: "CipherAI engine offline", details: err.message });
  }
};

module.exports = { handleAIRequest };
