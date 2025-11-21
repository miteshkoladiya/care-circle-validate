const { Router } = require("express");
const { authMiddleware } = require("../middleware/auth");
const { requireRoles } = require("../middleware/authorize");
const { Community } = require("../models/Community");
const { Post } = require("../models/Post");
const { User } = require("../models/User");
const { JoinRequest } = require("../models/JoinRequest");
const { CommunityRequest } = require("../models/CommunityRequest");
const { createJob, setJobRunning, setJobDone, appendJobError, registerRunningProcess, clearRunningProcess } = require('../services/generationJobs');
const { runGeneratorAsync } = require('../services/pythonGenerator');
const { getIo } = require('../socket');
const router = Router();

// Replace synchronous generate-now with background job creator
router.post("/generate-now", authMiddleware, requireRoles("Admin","SuperAdmin"), async (req, res) => {
  try {
    const job = createJob({ type: 'generate-now', requestedBy: req.user?.id });
    // respond immediately with jobId
    res.json({ ok: true, jobId: job.id });

    // start background worker (not awaited)
    (async () => {
      try {
        setJobRunning(job.id);
        // emit job started
        try { getIo()?.emit?.('job:updated', { jobId: job.id, state: 'running', progress: { createdCount: 0, processed: 0 } }); } catch (e) { /* ignore */ }
        const slots = ["morning","evening","night"];
        const communities = await Community.find().lean();
        const created = [];
        const errors = [];
        const today = new Date().toISOString().slice(0,10);
        let processed = 0;
        for (const c of communities) {
          for (const slot of slots) {
            // run generator async
            const out = await runGeneratorAsync(c.name, slot, { num: 1, timeout: 120000, csvOnly: false });
            // register process for potential cancellation/inspection
            if (out && out.pid) registerRunningProcess(job.id, out.pid);
            if (!out || !out.ok) {
              const info = { community: c.name, slot, error: out?.error || 'no_output', stdout: out?.raw || '', stderr: out?.stderr || '' };
              errors.push(info);
              appendJobError(job.id, JSON.stringify(info));
              // emit progress update with error recorded
              try { getIo()?.emit?.('job:updated', { jobId: job.id, state: 'running', progress: { createdCount: created.length, processed: ++processed }, lastError: info }); } catch (e) { /* ignore */ }
              continue;
            }
            const items = Array.isArray(out.json) ? out.json : [out.json];
            for (const item of items) {
              const title = String(item.title || `${c.name} Tip`).trim();
              const content = String(item.content || item.text || '').trim();
              if (!content || content.length < 20) {
                const info = { community: c.name, slot, reason: 'empty_or_too_short', raw: item };
                errors.push(info);
                appendJobError(job.id, JSON.stringify(info));
                try { getIo()?.emit?.('job:updated', { jobId: job.id, state: 'running', progress: { createdCount: created.length, processed: ++processed }, lastError: info }); } catch (e) { /* ignore */ }
                continue;
              }
              const exists = await Post.findOne({ community: c.name, $or: [{ title }, { content }], validationStatus: { $ne: 'rejected' } });
              if (exists) { processed++; continue; }
              const p = await Post.create({ title, content, community: c.name, authorName: 'DailyTipBot', aiGenerated: true, validationStatus: 'pending', published: false, timeOfDay: slot, scheduledDate: today });
              created.push({ _id: p._id, title: p.title, community: p.community });
              // emit progress after creating an item
              try { getIo()?.emit?.('job:updated', { jobId: job.id, state: 'running', progress: { createdCount: created.length, processed: ++processed } }); } catch (e) { /* ignore */ }
            }
          }
        }

        // emit final update before marking done
        try { getIo()?.emit?.('job:updated', { jobId: job.id, state: 'done', result: { createdCount: created.length, created, errors } }); } catch (e) { /* ignore */ }
        setJobDone(job.id, { createdCount: created.length, created, errors });
      } catch (bgErr) {
        appendJobError(job.id, JSON.stringify({ error: String(bgErr) }));
        try { getIo()?.emit?.('job:updated', { jobId: job.id, state: 'failed', error: String(bgErr) }); } catch (e) { /* ignore */ }
        setJobDone(job.id, { createdCount: 0, created: [], errors: [String(bgErr)] });
      } finally {
        // clear any registered processes for this job
        clearRunningProcess(job.id);
      }
    })();
  } catch (err) {
    console.error('generate-now failed', err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

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
    await user.save();
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




module.exports = router;
