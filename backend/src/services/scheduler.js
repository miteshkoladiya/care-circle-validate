const cron = require("node-cron");
const { Post } = require("../models/Post");
const { Community } = require("../models/Community");
const { getIo } = require("../socket");
const { spawn } = require('child_process');
const path = require('path');

const PYTHON_EXE = process.env.PYTHON_PATH || 'python';
// Resolve to project-root/ML_model/generate_post_content.py
const SCRIPT_PATH = path.join(__dirname, '..', '..', '..', 'ML_model', 'generate_post_content.py');

function runPythonGenerator(communityName, slot, timeout = 120000) {
  return new Promise((resolve) => {
    const args = [SCRIPT_PATH, '--community', communityName, '--timeslot', slot, '--dry-run', '--csv-only'];
    const proc = spawn(PYTHON_EXE, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const killTimer = setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch (e) {}
      resolve({ ok: false, error: 'timeout' , stdout, stderr });
    }, timeout);
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (err) => {
      clearTimeout(killTimer);
      resolve({ ok: false, error: String(err), stdout, stderr });
    });
    proc.on('close', (code) => {
      clearTimeout(killTimer);
      if (code !== 0) {
        return resolve({ ok: false, code, stdout, stderr });
      }
      const out = stdout.trim();
      if (!out) return resolve({ ok: false, error: 'no-output', stdout, stderr });
      try {
        const jsonOut = JSON.parse(out);
        return resolve({ ok: true, json: jsonOut, stdout, stderr });
      } catch (e) {
        return resolve({ ok: false, error: 'invalid-json', stdout, stderr });
      }
    });
  });
}

async function createDailyTipsForDate(date = new Date()) {
  const created = [];
  const errors = [];
  try {
    const communities = await Community.find().lean();
    let io = null;
    try { io = getIo(); } catch (e) { io = null; }
    for (const c of communities) {
      try {
        const slots = ['morning', 'evening', 'night'];
        for (const slot of slots) {
          const res = await runPythonGenerator(c.name, slot);
          if (!res.ok) {
            errors.push({ community: c.name, slot, reason: res.error || res.stderr || `code:${res.code}` });
            continue;
          }
          const jsonOut = res.json;
          const title = (jsonOut && (jsonOut.title || jsonOut.headline)) || `${c.name} Tip ${date.toISOString().slice(0,10)}`;
          const content = (jsonOut && (jsonOut.content || jsonOut.text || '')) || '';
          if (!content || String(content).trim().length < 20) {
            errors.push({ community: c.name, slot, reason: 'empty_or_too_short', raw: jsonOut, stderr: res.stderr });
            continue;
          }
          const exists = await Post.findOne({ title });
          if (exists) continue;
          const post = await Post.create({ title, content: String(content).trim(), community: c.name, authorName: 'DailyTipBot', aiGenerated: true, validationStatus: 'pending', published: false, timeOfDay: jsonOut.timeOfDay || slot, scheduledDate: date.toISOString().slice(0,10) });
          created.push(post);
          try { if (io) io.emit('post:ai_created', post); } catch (e) { /* ignore */ }
        }
      } catch (err) { errors.push({ community: c.name, error: String(err) }); }
    }
  } catch (err) { errors.push({ error: String(err) }); }
  return { createdCount: created.length, titles: created.map(p => p.title), errors };
}

function initScheduler() {
  // intentionally disabled — scheduler removed to focus on manual generation
  console.log("Scheduler init skipped (manual generate-now only).");
}

module.exports = { initScheduler, createDailyTipsForDate };
