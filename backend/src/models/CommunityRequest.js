const { Schema, model } = require('mongoose');

const CommunityRequestSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  category: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reason: { type: String, default: '' },
}, { timestamps: true });

// prevent duplicate community requests by same user for the same community name
CommunityRequestSchema.index({ userId: 1, name: 1 }, { unique: true });

const CommunityRequest = model('CommunityRequest', CommunityRequestSchema);
module.exports = { CommunityRequest };
