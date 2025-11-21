const { Router } = require("express");
const { Post } = require("../models/Post");
const { authMiddleware } = require("../middleware/auth");
const { requireRoles } = require("../middleware/authorize");
const { getIo } = require("../socket");
const { Community } = require("../models/Community");
const { User } = require("../models/User");

const router = Router();

router.get("/", async (req, res) => {
  const { community } = req.query;
  const filter = {};
  if (community) filter.community = String(community);
  const posts = await Post.find(filter).sort({ createdAt: -1 }).limit(50).lean();
  res.json({ posts });
});

router.get("/pending", authMiddleware, requireRoles("Doctor", "Admin", "SuperAdmin"), async (req, res) => {
  const posts = await Post.find({ aiGenerated: true, validationStatus: "pending" }).sort({ createdAt: -1 }).lean();
  res.json({ posts });
});

// Unified validation feed: pending or doctor-validated, not published, not rejected
// Placed early to avoid any possible confusion with parameterized routes below
router.get('/validation-feed', authMiddleware, requireRoles('Doctor', 'Admin', 'SuperAdmin'), async (req, res) => {
  try {
    const posts = await Post.find({
      aiGenerated: true,
      published: false,
      validationStatus: { $in: ['pending', 'validated'] }
    }).sort({ createdAt: -1 }).lean();
    res.json({ posts });
  } catch (e) {
    console.error('validation-feed error', e);
    res.status(500).json({ message: 'Load failed', error: String(e) });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  const { title, content, community, aiGenerated, imageUrl } = req.body;
  const author = req.user;
  const post = await Post.create({ title, content, community, authorId: author.id, authorName: author.name, aiGenerated: !!aiGenerated, imageUrl: imageUrl || '' });
  try { getIo().emit("post:created", post); } catch {}
  res.json({ post });
});

router.post("/ai", authMiddleware, requireRoles("Admin", "SuperAdmin"), async (req, res) => {
  const { title, content, community, timeOfDay, scheduledDate } = req.body;
  const author = req.user;
  const post = await Post.create({ title, content, community, authorId: author.id, authorName: author.name, aiGenerated: true, validationStatus: "pending", published: false, timeOfDay: timeOfDay || '', scheduledDate: scheduledDate || '' });
  try { getIo().emit("post:ai_created", post); } catch {}
  res.json({ post });
});

// Admin: list posts awaiting admin review/publish
router.get("/admin-review", authMiddleware, requireRoles("Admin", "SuperAdmin"), async (req, res) => {
  const posts = await Post.find({ aiGenerated: true, published: false }).sort({ createdAt: -1 }).lean();
  res.json({ posts });
});

// Admin: approve (final approve + publish)
router.post("/:id/approve", authMiddleware, requireRoles("Admin", "SuperAdmin"), async (req, res) => {
  try {
    const { id } = req.params;
    const admin = req.user;
    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    // allow admin to approve directly from 'pending' or 'validated'
    if (!['pending', 'validated'].includes(post.validationStatus)) {
      return res.status(400).json({ message: 'Post cannot be approved in current status' });
    }

    // set approved + published
    post.validationStatus = 'approved';
    post.published = true;

    // derive community from title (try exact, whole-word contains, then first token)
    try {
      const communities = await Community.find().lean();
      const title = String(post.title || "").trim();
      let derived = null;

      // exact name match (case-insensitive)
      derived = communities.find(c => String(c.name || "").toLowerCase() === title.toLowerCase())?.name || null;

      // contained whole-word match
      if (!derived && title) {
        for (const c of communities) {
          const name = String(c.name || "").trim();
          if (!name) continue;
          const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const rx = new RegExp(`\\b${esc}\\b`, 'i');
          if (rx.test(title)) { derived = c.name; break; }
        }
      }

      // fallback: compare first token (e.g. "Diabetes Tip" -> "Diabetes")
      if (!derived && title) {
        const first = title.split(/[\s—–:,-]+/)[0].trim();
        const match = communities.find(c => String(c.name || "").toLowerCase() === first.toLowerCase());
        if (match) derived = match.name;
      }

      if (derived) {
        post.community = derived;
      }
    } catch (deriveErr) {
      console.error('derive community failed', deriveErr);
      // keep existing community on error
    }

    post.editedBy = admin.name;
    await post.save();
    try { getIo().emit('post:approved', post); getIo().emit('post:published', post); } catch (e) { /* ignore */ }
    res.json({ post });
  } catch (e) {
    console.error('approve post failed', e);
    res.status(500).json({ message: 'Approve failed', error: String(e) });
  }
});

router.post("/:id/validate", authMiddleware, requireRoles("Doctor", "Admin", "SuperAdmin"), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!["validated", "rejected"].includes(status)) return res.status(400).json({ message: "Invalid status" });
  const editor = req.user;
  const post = await Post.findByIdAndUpdate(id, { validationStatus: status, editedBy: editor.name }, { new: true });
  try { getIo().emit("post:validated", { postId: post?._id, status }); } catch {}
  res.json({ post });
});

router.put("/:id", authMiddleware, requireRoles("Doctor", "Admin", "SuperAdmin"), async (req, res) => {
  const { id } = req.params;
  const { content, title } = req.body;
  const editor = req.user;
  const post = await Post.findByIdAndUpdate(id, { content, title, editedBy: editor.name }, { new: true });
  res.json({ post });
});

router.post("/:id/comment", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  const author = req.user;
  const post = await Post.findById(id);
  if (!post) return res.status(404).json({ message: "Post not found" });
  post.comments = post.comments || [];
  post.comments.push({ authorId: author.id, authorName: author.name, content, createdAt: new Date() });
  post.responses = (post.responses || 0) + 1;
  await post.save();
  try { getIo().emit("post:comment", { postId: post._id, comment: post.comments[post.comments.length-1] }); } catch {}
  res.json({ post });
});

// Hardened delete comment endpoint: author-only, uses $pull to avoid race conditions
router.delete("/:postId/comment/:commentId", authMiddleware, async (req, res) => {
  const { postId, commentId } = req.params;
  const user = req.user;
  try {
    // First locate the comment author to verify ownership without mutating array
    const post = await Post.findById(postId).select('comments');
    if (!post) return res.status(404).json({ message: 'Post not found' });
    const target = (post.comments || []).find(c => String(c._id) === String(commentId));
    if (!target) return res.status(404).json({ message: 'Comment not found' });
    if (String(target.authorId) !== String(user.id)) return res.status(403).json({ message: 'You can only delete your own comment' });

    // Perform atomic removal
    await Post.updateOne({ _id: postId }, { $pull: { comments: { _id: commentId } } });
    const updated = await Post.findById(postId).lean();
    try { getIo().emit('post:comment_deleted', { postId, commentId }); } catch {}
    return res.json({ ok: true, post: updated });
  } catch (e) {
    console.error('delete comment error', { postId, commentId, userId: user && user.id, error: e });
    return res.status(500).json({ message: 'Delete failed', error: String(e) });
  }
});

router.post("/:id/react", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.body;
    const user = req.user;
    const allowed = ["like", "helpful", "love", "insight", "support", "celebrate"];
    if (!allowed.includes(type)) return res.status(400).json({ message: "Invalid reaction type" });
    const post = await Post.findById(id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (!Array.isArray(post.reactions)) post.reactions = [];
    const existingIndex = post.reactions.findIndex(r => String(r.by) === String(user.id) && r.type === type);
    if (existingIndex >= 0) {
      post.reactions.splice(existingIndex, 1);
    } else {
      post.reactions.push({ by: user.id, type });
    }
    await post.save();
    try { getIo().emit("post:react", { postId: post._id, reactions: post.reactions }); } catch {}
    const counts = allowed.reduce((acc, t) => { acc[t] = post.reactions.filter(r => r.type === t).length; return acc; }, {});
    return res.json({ post, counts });
  } catch (e) {
    console.error('react endpoint error', e);
    return res.status(500).json({ message: 'Reaction failed', error: String(e) });
  }
});

router.post("/:id/publish", authMiddleware, requireRoles("Admin", "SuperAdmin"), async (req, res) => {
  const { id } = req.params;
  const post = await Post.findByIdAndUpdate(id, { published: true }, { new: true });
  if (!post) return res.status(404).json({ message: "Post not found" });
  try { getIo().emit("post:published", post); } catch {}
  res.json({ post });
});

// NEW helper: mask posts based on membership
async function maskPostsForUser(posts, user) {
  if (!Array.isArray(posts)) return posts;
  // if no user provided, mask everything
  if (!user || !user.id) {
    return posts.map(p => ({ ...p, content: "", comments: [], reactions: [], imageUrl: "" }));
  }
  // strict: require membership to view content for EVERY role
  const u = await User.findById(user.id).select("communities").lean();
  const joinedIds = Array.isArray(u?.communities) ? u.communities.map(x => String(x)) : [];
  // fetch names for joined ids
  const joined = await Community.find({ _id: { $in: joinedIds } }).select("name").lean();
  const joinedNames = new Set((joined || []).map(c => String(c.name)));
  const out = [];
  for (const p of posts) {
    const allowed = joinedNames.has(String(p.community));
    if (!allowed) {
      out.push({ ...p, content: "", comments: [], reactions: [], imageUrl: "" });
    } else {
      out.push(p);
    }
  }
  return out;
}

module.exports = router;
