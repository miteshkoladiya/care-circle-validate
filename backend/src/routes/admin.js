const { Router } = require("express");
const { authMiddleware } = require("../middleware/auth");
const { requireRoles } = require("../middleware/authorize");
const { Community } = require("../models/Community");
const { Post } = require("../models/Post");
const { User } = require("../models/User");
const { JoinRequest } = require("../models/JoinRequest");
const { CommunityRequest } = require("../models/CommunityRequest");
const { getIo } = require('../socket');
const router = Router();



// Admin: list users (without password) - used by Admin UI
router.get('/users', authMiddleware, requireRoles('Admin','SuperAdmin'), async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 }).lean();
    return res.json({ users });
  } catch (e) {
    console.error('[admin] GET /users failed', e);
    return res.status(500).json({ message: 'Load failed', error: String(e) });
  }
});

// Admin: list pending join requests
router.get('/join-requests', authMiddleware, requireRoles('Admin','SuperAdmin'), async (req, res) => {
  try {
    const reqs = await JoinRequest.find({ status: 'pending' }).populate('userId').populate('communityId').lean();
    return res.json({ requests: reqs });
  } catch (e) {
    console.error('[admin] GET /join-requests failed', e);
    return res.status(500).json({ message: 'Load failed', error: String(e) });
  }
});

// Admin: approve a join request
router.post('/join-requests/:id/approve', authMiddleware, requireRoles('Admin','SuperAdmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const jr = await JoinRequest.findById(id);
    if (!jr) return res.status(404).json({ message: 'Not found' });
    jr.status = 'approved';
    await jr.save();
    const community = await Community.findById(jr.communityId);
    if (community) { community.members = (community.members || 0) + 1; await community.save(); }
    try { await User.findByIdAndUpdate(jr.userId, { $addToSet: { communities: community._id } }); } catch (e) { console.error(e); }
    return res.json({ request: jr, community });
  } catch (e) {
    console.error('[admin] POST /join-requests/:id/approve failed', e);
    return res.status(500).json({ message: 'Approve failed', error: String(e) });
  }
});

// Admin: reject a join request
router.post('/join-requests/:id/reject', authMiddleware, requireRoles('Admin','SuperAdmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const jr = await JoinRequest.findById(id);
    if (!jr) return res.status(404).json({ message: 'Not found' });
    jr.status = 'rejected';
    jr.reason = reason || '';
    await jr.save();
    return res.json({ request: jr });
  } catch (e) {
    console.error('[admin] POST /join-requests/:id/reject failed', e);
    return res.status(500).json({ message: 'Reject failed', error: String(e) });
  }
});

// Admin: list pending community creation requests
router.get('/community-requests', authMiddleware, requireRoles('Admin','SuperAdmin'), async (req, res) => {
  try {
    const requests = await CommunityRequest.find({ status: 'pending' }).populate('userId').lean();
    return res.json({ requests });
  } catch (e) {
    console.error('[admin] GET /community-requests failed', e);
    return res.status(500).json({ message: 'Load failed', error: String(e) });
  }
});

// Admin: approve community creation request
router.post('/community-requests/:id/approve', authMiddleware, requireRoles('Admin','SuperAdmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const cr = await CommunityRequest.findById(id);
    if (!cr) return res.status(404).json({ message: 'Not found' });
    cr.status = 'approved';
    await cr.save();
    const community = await Community.create({ name: cr.name, description: cr.description, category: cr.category });
    return res.json({ request: cr, community });
  } catch (e) {
    console.error('[admin] POST /community-requests/:id/approve failed', e);
    return res.status(500).json({ message: 'Approve failed', error: String(e) });
  }
});

// Admin: reject community request
router.post('/community-requests/:id/reject', authMiddleware, requireRoles('Admin','SuperAdmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const cr = await CommunityRequest.findById(id);
    if (!cr) return res.status(404).json({ message: 'Not found' });
    cr.status = 'rejected';
    cr.reason = reason || '';
    await cr.save();
    return res.json({ request: cr });
  } catch (e) {
    console.error('[admin] POST /community-requests/:id/reject failed', e);
    return res.status(500).json({ message: 'Reject failed', error: String(e) });
  }
});

// Ensure Admin can approve / verify a user (POST /api/admin/users/:id/approve)
router.post('/users/:id/approve', authMiddleware, requireRoles('Admin','SuperAdmin'), async (req, res) => {
  try {
    const { id } = req.params;
    console.log('[admin] POST /users/:id/approve', { id, by: req.user && req.user.id });
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    user.isVerified = true;
    user.markModified('isVerified'); // Ensure change is tracked
    await user.save();
    console.log('[admin] User approved:', user._id, user.isVerified);
    
    const { password, ...userData } = user.toObject();
    return res.json({ user: userData });
  } catch (e) {
    console.error('[admin] POST /users/:id/approve failed', e);
    return res.status(500).json({ message: 'Approve failed', error: String(e) });
  }
});

// Optional: Admin reject user endpoint (POST /api/admin/users/:id/reject)
router.post('/users/:id/reject', authMiddleware, requireRoles('Admin','SuperAdmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    console.log('[admin] POST /users/:id/reject', { id, by: req.user && req.user.id, reason });
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    // remove user (or you can set a flag instead)
    await User.findByIdAndDelete(id);
    return res.json({ message: 'User rejected/removed' });
  } catch (e) {
    console.error('[admin] POST /users/:id/reject failed', e);
    return res.status(500).json({ message: 'Reject failed', error: String(e) });
  }
});

router.get("/doctor-count", async (_req, res) => {
  try {
    const count = await User.countDocuments({ role: "Doctor", isVerified: true });
    return res.json({ count });
  } catch (e) {
    console.error("[admin] GET /doctor-count failed", e);
    return res.status(500).json({ message: "Failed to get doctor count" });
  }
});




router.post('/users/:id/role', authMiddleware, requireRoles('Admin','SuperAdmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!['Patient', 'Doctor', 'Admin', 'SuperAdmin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    user.role = role;
    await user.save();
    
    const { password, ...userData } = user.toObject();
    return res.json({ user: userData });
  } catch (e) {
    console.error('[admin] POST /users/:id/role failed', e);
    return res.status(500).json({ message: 'Update failed', error: String(e) });
  }
});

router.delete('/users/:id', authMiddleware, requireRoles('Admin','SuperAdmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    await User.findByIdAndDelete(id);
    return res.json({ message: 'User deleted successfully' });
  } catch (e) {
    console.error('[admin] DELETE /users/:id failed', e);
    return res.status(500).json({ message: 'Delete failed', error: String(e) });
  }
});

module.exports = router;
