const { Schema, model } = require("mongoose");

const CommunitySchema = new Schema(
  {
    name: { type: String, required: true },
    description: String,
    members: { type: Number, default: 0 },
    dailyPosts: { type: Number, default: 0 },
    category: String,
    moderators: [String],
    recentActivity: String,
    color: String,
    coverUrl: { type: String, default: '' }, // public URL (Cloudinary or local /uploads)
  },
  { timestamps: true }
);

// ensure community names are unique
CommunitySchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

const Community = model("Community", CommunitySchema);
module.exports = { Community };
