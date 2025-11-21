const { Schema, model } = require("mongoose");

const PostSchema = new Schema(
  {
    title: { type: String, required: true },
    content: String,
  imageUrl: { type: String, default: '' },
    community: { type: String, required: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User" },
    authorName: { type: String, required: true },
  responses: { type: Number, default: 0 },
    comments: [
      {
        authorId: { type: Schema.Types.ObjectId, ref: "User" },
        authorName: String,
        content: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    reactions: {
      type: [
        {
          by: { type: Schema.Types.ObjectId, ref: "User", required: true },
          type: { type: String, enum: ["like", "helpful", "love", "insight", "support", "celebrate"], required: true },
          _id: false,
        },
      ],
      default: [],
    },
    // validation / publishing workflow
    validationStatus: {
      type: String,
      enum: ["pending", "validated", "approved", "rejected"],
      default: "pending",
    },
    published: { type: Boolean, default: false },
    aiGenerated: { type: Boolean, default: false },
    // scheduling / metadata
    timeOfDay: { type: String, enum: ["morning", "evening", "night", ""], default: "" },
    scheduledDate: { type: String, default: "" }, // YYYY-MM-DD
  editedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

const Post = model("Post", PostSchema);
module.exports = { Post };
