const { Router } = require("express");
const { Community } = require("../models/Community");
const { JoinRequest } = require("../models/JoinRequest");
const { CommunityRequest } = require("../models/CommunityRequest");
const { authMiddleware } = require("../middleware/auth");
const { requireRoles } = require("../middleware/authorize");
const { Post } = require("../models/Post");
const { User } = require("../models/User");
const { ChatMessage } = require("../models/ChatMessage");
const { answerQuestion } = require("../services/ai");
const mongoose = require("mongoose");
const { getIo } = require("../socket");
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const router = Router();

// simple logger for all incoming community route requests (helps debug 404s)
router.use((req, res, next) => {
  try {
    console.log('[communities] incoming route', { method: req.method, url: req.originalUrl });
  } catch (e) {}
  next();
});

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// configure Cloudinary if env provided
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// memory storage for direct upload to Cloudinary
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// List all communities (must be BEFORE any parameterized routes)
router.get("/", async (req, res) => {
  try {
    const communities = await Community.find().limit(200).lean();
    return res.json({ communities });
  } catch (err) {
    console.error("[communities] GET / error", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// Members-only posts for a community by ObjectId (place BEFORE generic '/:id')
router.get("/id/:id/posts", authMiddleware, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid id" });
  try {
    const community = await Community.findById(id).lean();
    if (!community) return res.status(404).json({ message: "Not found" });

    // Require membership for ALL users (Admins/Doctors must join to view content)
    const u = await User.findById(req.user.id).select("communities").lean();
    const isMember = Array.isArray(u?.communities) && u.communities.some(cid => String(cid) === String(community._id));
    if (!isMember) return res.status(403).json({ message: "Join this community to view posts" });

    const posts = await Post.find({ community: community.name, published: true }).sort({ createdAt: -1 }).limit(100).lean();
    return res.json({ posts });
  } catch (err) {
    console.error("[communities] GET /id/:id/posts error", err);
    return res.status(500).json({ message: "Failed to load posts" });
  }
});

// Generic community fetch (after the posts route)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    let community = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      community = await Community.findById(id).lean();
    }
    if (!community) {
      const name = decodeURIComponent(id || '');
      const rx = new RegExp(`^${escapeRegex(name)}$`, 'i');
      community = await Community.findOne({ name: rx }).lean();
    }
    if (!community) return res.status(404).json({ message: 'Not found' });
    res.json({ community });
  } catch (err) {
    console.error('[communities] GET /:id error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post("/:id/join", authMiddleware, async (req, res) => {
  const { id } = req.params;
  console.log('[communities] POST /:id/join', { params: req.params, user: req.user && { id: req.user.id, email: req.user.email, role: req.user.role } });
  // immediate join (used for simple join/unjoin)
  const community = await Community.findById(id);
  if (!community) return res.status(404).json({ message: 'Not found' });
  // increment members and respond
  community.members = (community.members || 0) + 1;
  await community.save();
  try {
    await User.findByIdAndUpdate(req.user.id, { $addToSet: { communities: community._id } });
  } catch (err) { console.error('Failed to add community to user', err); }
  res.json({ community });
});

// leave a community
router.post("/:id/leave", authMiddleware, async (req, res) => {
  const { id } = req.params;
  // log incoming headers and user for diagnostics
  console.log('[communities] POST /:id/leave', {
    params: req.params,
    user: req.user && req.user.id,
    headers: { authorization: req.headers.authorization }
  });

  // defensive checks
  if (!req.user || !req.user.id) {
    console.error('[communities] leave: missing req.user or req.user.id', { user: req.user });
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const community = await Community.findById(id);
  if (!community) return res.status(404).json({ message: 'Not found' });

  try {
    community.members = Math.max(0, (community.members || 0) - 1);
    await community.save();
  } catch (err) {
    console.error('[communities] failed to decrement members', err);
    return res.status(500).json({ message: 'Failed to update community' });
  }

  try {
    const u = await User.findById(req.user.id);
    if (!u) {
      console.error('[communities] leave: user not found in DB', { userId: req.user.id });
      return res.status(404).json({ message: 'User not found' });
    }
    await User.findByIdAndUpdate(req.user.id, { $pull: { communities: community._id } });
  } catch (err) {
    console.error('Failed to remove community from user', err);
    return res.status(500).json({ message: 'Failed to update user' });
  }

  res.json({ community });
});

// create a join request (user requests to join and admin can approve)
router.post("/:id/request-join", authMiddleware, async (req, res) => {
  const { id } = req.params;
  console.log('[communities] POST /:id/request-join', { params: req.params, user: req.user && { id: req.user.id, email: req.user.email, role: req.user.role } });
  const userId = req.user.id;
  const existing = await JoinRequest.findOne({ userId, communityId: id, status: 'pending' });
  if (existing) return res.status(400).json({ message: 'Request already pending' });
  const jr = await JoinRequest.create({ userId, communityId: id });
  res.json({ request: jr });
});

// admin: list join requests
router.get('/join-requests', authMiddleware, async (req, res) => {
  console.log('[communities] GET /join-requests by', req.user && req.user.id);
  const reqs = await JoinRequest.find({ status: 'pending' }).populate('userId').populate('communityId').lean();
  res.json({ requests: reqs });
});

// admin: approve join request
router.post('/join-requests/:id/approve', authMiddleware, async (req, res) => {
  console.log('[communities] POST /join-requests/:id/approve', { params: req.params, user: req.user && req.user.id });
  const { id } = req.params;
  const jr = await JoinRequest.findById(id);
  if (!jr) return res.status(404).json({ message: 'Not found' });
  jr.status = 'approved';
  await jr.save();
  const community = await Community.findById(jr.communityId);
  community.members = (community.members || 0) + 1;
  await community.save();
  try {
    await User.findByIdAndUpdate(jr.userId, { $addToSet: { communities: community._id } });
  } catch (err) { console.error('Failed to add community to user on approval', err); }
  res.json({ request: jr, community });
});

// admin: reject join request
router.post('/join-requests/:id/reject', authMiddleware, async (req, res) => {
  console.log('[communities] POST /join-requests/:id/reject', { params: req.params, body: req.body, user: req.user && req.user.id });
  const { id } = req.params;
  const { reason } = req.body;
  const jr = await JoinRequest.findById(id);
  if (!jr) return res.status(404).json({ message: 'Not found' });
  jr.status = 'rejected';
  jr.reason = reason || '';
  await jr.save();
  res.json({ request: jr });
});

// patient: request creation of a new community (goes to admin review)
router.post('/request', authMiddleware, async (req, res) => {
  console.log('[communities] POST /request', { body: req.body, user: req.user && req.user.id });
  const { name, description, category } = req.body;
  const userId = req.user.id;
  const cr = await CommunityRequest.create({ userId, name, description, category });
  res.json({ request: cr });
});

// admin: list community creation requests
router.get('/requests', authMiddleware, async (req, res) => {
  console.log('[communities] GET /requests by', req.user && req.user.id);
  const requests = await CommunityRequest.find({ status: 'pending' }).populate('userId').lean();
  res.json({ requests });
});

// admin: approve community request
router.post('/requests/:id/approve', authMiddleware, async (req, res) => {
  console.log('[communities] POST /requests/:id/approve', { params: req.params, user: req.user && req.user.id });
  const { id } = req.params;
  const cr = await CommunityRequest.findById(id);
  if (!cr) return res.status(404).json({ message: 'Not found' });
  cr.status = 'approved';
  await cr.save();
  const community = await Community.create({ name: cr.name, description: cr.description, category: cr.category });
  res.json({ request: cr, community });
});

// admin: reject community request
router.post('/requests/:id/reject', authMiddleware, async (req, res) => {
  console.log('[communities] POST /requests/:id/reject', { params: req.params, body: req.body, user: req.user && req.user.id });
  const { id } = req.params;
  const { reason } = req.body;
  const cr = await CommunityRequest.findById(id);
  if (!cr) return res.status(404).json({ message: 'Not found' });
  cr.status = 'rejected';
  cr.reason = reason || '';
  await cr.save();
  res.json({ request: cr });
});

router.post("/", authMiddleware, requireRoles("Admin", "SuperAdmin"), async (req, res) => {
  const { name, description, category, color } = req.body;
  const community = await Community.create({ name, description, category, color });
  res.json({ community });
});

router.put("/:id", authMiddleware, requireRoles("Admin", "SuperAdmin"), async (req, res) => {
  const { id } = req.params;
  const community = await Community.findByIdAndUpdate(id, req.body, { new: true });
  res.json({ community });
});

router.delete("/:id", authMiddleware, requireRoles("Admin", "SuperAdmin"), async (req, res) => {
  const { id } = req.params;
  await Community.findByIdAndDelete(id);
  res.json({ ok: true });
});

// Chat endpoints for community-specific Q&A
// Get chat messages for a community (scoped to current user)
router.get('/:id/chat', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const msgs = await ChatMessage.find({ communityId: id, userId: req.user.id }).sort({ createdAt: 1 }).lean();
  res.json({ messages: msgs });
});

// Ask a question in a community - store per-user messages and replies
router.post('/:id/ask', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { question } = req.body;
  if (!question || !question.trim()) return res.status(400).json({ message: 'Question required' });
  const userId = req.user.id;
  const user = req.user;

  const userMsg = await ChatMessage.create({ communityId: id, userId, role: 'user', content: question.trim() });
  try {
    const community = await Community.findById(id).lean();
    const replyText = await answerQuestion({ community: community?.name || 'community', user, question: question.trim() });
    const assistantMsg = await ChatMessage.create({ communityId: id, userId, role: 'assistant', content: replyText });

    // emit only to the requesting user
    try { getIo()?.to(`user:${userId}`).emit('chat:new', assistantMsg); } catch (e) { /* noop */ }

    return res.json({ userMessage: userMsg, assistantMessage: assistantMsg });
  } catch (err) {
    console.error('AI error', err);
    return res.status(500).json({ message: 'AI error' });
  }
});

// Admin: upload / update community cover photo (multipart/form-data: field 'photo')
router.post("/:id/photo", authMiddleware, requireRoles("Admin", "SuperAdmin"), upload.single('photo'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const community = await Community.findById(id);
    if (!community) return res.status(404).json({ message: "Community not found" });

    // attempt Cloudinary upload if configured
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      try {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream({ folder: `carecircle/communities` }, (error, result) => {
            if (error) return reject(error);
            resolve(result);
          });
          stream.end(req.file.buffer);
        });
        console.log('[communities] cloudinary upload success', { url: uploadResult.secure_url, public_id: uploadResult.public_id });
        community.coverUrl = uploadResult.secure_url;
        await community.save();
        // return fresh community after save (lean to avoid mongoose doc methods)
        const fresh = await Community.findById(id).lean();
        return res.json({ community: fresh });
      } catch (err) {
        console.error('[communities] cloudinary upload failed', err);
        // fall through to local save
      }
    }

    // fallback: save locally in uploads/
    const localName = `${Date.now()}-${(req.file.originalname || 'photo').replace(/\s+/g, '-')}`;
    const localPath = path.join(UPLOAD_DIR, localName);
    fs.writeFileSync(localPath, req.file.buffer);
    // public path served from /uploads/* in backend
    community.coverUrl = `/uploads/${localName}`;
    await community.save();
    const freshLocal = await Community.findById(id).lean();
    console.log('[communities] saved local upload', { path: freshLocal.coverUrl });
    return res.json({ community: freshLocal });
  } catch (err) {
    console.error('[communities] POST /:id/photo failed', err);
    return res.status(500).json({ message: 'Upload failed', error: String(err) });
  }
});

// Admin: remove community cover photo (Cloudinary or local /uploads/)
router.delete("/:id/photo", authMiddleware, requireRoles("Admin", "SuperAdmin"), async (req, res) => {
  console.log('[communities] handler DELETE /:id/photo', { params: req.params, user: req.user && req.user.id });
  try {
    const { id } = req.params;
    const community = await Community.findById(id);
    if (!community) return res.status(404).json({ message: "Community not found" });

    if (!community.coverUrl) {
      return res.json({ ok: true, community: await Community.findById(id).lean() });
    }

    // If Cloudinary configured and URL looks like Cloudinary, try to delete by public_id
    try {
      if (process.env.CLOUDINARY_CLOUD_NAME && community.coverUrl && community.coverUrl.includes(`res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}`)) {
        // derive public_id from the URL: strip until /upload/, remove version and extension
        const idx = community.coverUrl.indexOf("/upload/");
        if (idx >= 0) {
          let publicId = community.coverUrl.slice(idx + "/upload/".length);
          publicId = publicId.replace(/v[0-9]+\//, ""); // remove version if present
          publicId = publicId.replace(/\.[a-zA-Z0-9]+$/, ""); // remove extension
          try { await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true }); }
          catch (e) { console.error("[communities] cloudinary destroy failed", e); }
        }
      } else if (String(community.coverUrl).startsWith("/uploads/")) {
        // local file: remove from uploads directory
        const localRel = String(community.coverUrl).replace(/^\/uploads\//, "");
        const localPath = path.join(UPLOAD_DIR, localRel);
        try { if (fs.existsSync(localPath)) fs.unlinkSync(localPath); } catch (e) { console.error("[communities] unlink failed", e); }
      }
    } catch (e) {
      console.error("[communities] delete photo helper error", e);
    }

    // clear coverUrl and save
    community.coverUrl = "";
    await community.save();
    const fresh = await Community.findById(id).lean();
    return res.json({ ok: true, community: fresh });
  } catch (err) {
    console.error("[communities] DELETE /:id/photo failed", err);
    return res.status(500).json({ message: "Delete failed", error: String(err) });
  }
});

module.exports = router;

