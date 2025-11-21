const mongoose = require('mongoose');

const ChatMessageSchema = new mongoose.Schema({
  communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // ensure all messages are tied to a user
  role: { type: String, enum: ['user', 'assistant', 'system'], default: 'user' },
  content: { type: String, required: true },
}, { timestamps: true });

// helpful indexes
ChatMessageSchema.index({ userId: 1, createdAt: 1 });
ChatMessageSchema.index({ userId: 1, communityId: 1, createdAt: 1 });

const ChatMessage = mongoose.model('ChatMessage', ChatMessageSchema);
module.exports = { ChatMessage };
