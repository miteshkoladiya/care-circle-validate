const { Schema, model } = require('mongoose');

const JoinRequestSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  communityId: { type: Schema.Types.ObjectId, ref: 'Community', required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reason: { type: String, default: '' },
}, { timestamps: true });

// prevent duplicate join requests from the same user to the same community
JoinRequestSchema.index({ userId: 1, communityId: 1 }, { unique: true });

const JoinRequest = model('JoinRequest', JoinRequestSchema);
module.exports = { JoinRequest };
