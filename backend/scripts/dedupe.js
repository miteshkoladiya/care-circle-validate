// Safe dedupe script: keeps the earliest (by createdAt) document and removes other duplicates.
// Usage: node scripts/dedupe.js --mongoUri mongodb://... (or set MONGO_URI env var)

const mongoose = require('mongoose');
const { User } = require('../src/models/User');
const { Community } = require('../src/models/Community');
const { JoinRequest } = require('../src/models/JoinRequest');
const { CommunityRequest } = require('../src/models/CommunityRequest');

async function connect() {
  const uri = process.argv.find(a => a.startsWith('--mongoUri='))?.split('=')[1] || process.env.MONGO_URI;
  if (!uri) {
    console.error('Provide --mongoUri or set MONGO_URI');
    process.exit(1);
  }
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
}

async function dedupe(model, keyFn, name) {
  console.log(`Deduping ${name}...`);
  const all = await model.find().sort({ createdAt: 1 }).lean();
  const seen = new Map();
  const toRemove = [];
  for (const doc of all) {
    const key = keyFn(doc);
    if (!key) continue;
    if (seen.has(key)) {
      toRemove.push(doc._id);
    } else {
      seen.set(key, doc._id);
    }
  }
  if (toRemove.length === 0) {
    console.log(`No duplicates found for ${name}`);
    return;
  }
  console.log(`Removing ${toRemove.length} duplicate documents from ${name}`);
  await model.deleteMany({ _id: { $in: toRemove } });
}

async function run() {
  await connect();
  try {
    await dedupe(User, (d) => (d.email || '').toLowerCase().trim(), 'User(email)');
    await dedupe(Community, (d) => (d.name || '').toLowerCase().trim(), 'Community(name)');
    await dedupe(JoinRequest, (d) => `${d.userId}_${d.communityId}`, 'JoinRequest(userId_communityId)');
    await dedupe(CommunityRequest, (d) => `${d.userId}_${(d.name||'').toLowerCase().trim()}`, 'CommunityRequest(userId_name)');
    console.log('Dedupe complete.');
  } catch (err) {
    console.error('Dedupe error', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
