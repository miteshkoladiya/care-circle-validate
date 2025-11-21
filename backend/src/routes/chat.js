const { Router } = require('express');
const { ChatMessage } = require('../models/ChatMessage');
const { authMiddleware } = require('../middleware/auth');
const { answerQuestion } = require('../services/ai');
const { getIo } = require("../socket");

const router = Router();

// Private chat history (only this user's messages + their assistant replies)
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const msgs = await ChatMessage.find({ userId }).sort({ createdAt: 1 }).lean();
    res.json({ messages: msgs });
  } catch (err) {
    console.error('[chat] GET /history failed', err);
    res.status(500).json({ message: 'Failed to load history' });
  }
});

// Ask global chatbot (assistant reply stored with same userId)
router.post('/ask', authMiddleware, async (req, res) => {
  const { question } = req.body;
  if (!question || !question.trim()) return res.status(400).json({ message: 'Question required' });
  const userId = req.user.id;
  const user = req.user;

  const userMsg = await ChatMessage.create({ role: 'user', userId, content: question.trim() });
  try {
    const reply = await answerQuestion({ community: 'general', user, question: question.trim() });
    const assistantMsg = await ChatMessage.create({ role: 'assistant', userId, content: reply });

    // emit only to the requesting user room (prevents broadcast)
    try { getIo()?.to(`user:${userId}`).emit('chat:new', assistantMsg); } catch (e) { /* noop */ }

    res.json({ userMessage: userMsg, assistantMessage: assistantMsg });
  } catch (err) {
    console.error('AI error', err);
    res.status(500).json({ message: 'AI error' });
  }
});

// Clear all chat history for current user (DELETE)
router.delete('/history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('[chat] DELETE /history by', userId);
    const result = await ChatMessage.deleteMany({ userId });
    res.json({ deletedCount: result.deletedCount || 0 });
  } catch (err) {
    console.error('Failed to clear chat history', err);
    res.status(500).json({ message: 'Failed to clear chat' });
  }
});

// Alias for clients that cannot use DELETE (POST)
router.post('/history/clear', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('[chat] POST /history/clear by', userId);
    const result = await ChatMessage.deleteMany({ userId });
    res.json({ deletedCount: result.deletedCount || 0 });
  } catch (err) {
    console.error('Failed to clear chat history (alias)', err);
    res.status(500).json({ message: 'Failed to clear chat' });
  }
});

// Also accept GET for legacy clients or proxies that convert methods
router.get('/history/clear', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('[chat] GET /history/clear by', userId);
    const result = await ChatMessage.deleteMany({ userId });
    res.json({ deletedCount: result.deletedCount || 0 });
  } catch (err) {
    console.error('Failed to clear chat history (GET alias)', err);
    res.status(500).json({ message: 'Failed to clear chat' });
  }
});

module.exports = router;



