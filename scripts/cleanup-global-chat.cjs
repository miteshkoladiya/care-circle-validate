// Cleanup legacy global assistant chat messages lacking a userId
// Usage:
//   node scripts/cleanup-global-chat.cjs
// Requires MONGO_URI in environment (.env at project root)

// Load env from root .env; if missing MONGO_URI, also try backend/.env
require('dotenv').config();
if (!process.env.MONGO_URI) {
  try {
    require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });
  } catch (_) { /* ignore */ }
}
// Load backend dependencies from backend/node_modules so this works from repo root
const path = require('path');
const { createRequire } = require('module');
const backendPkgPath = path.join(__dirname, '..', 'backend', 'package.json');
const backendRequire = createRequire(backendPkgPath);
const mongoose = backendRequire('mongoose');

// Import ChatMessage model from backend
// Import ChatMessage model via backend's module resolver to share the same mongoose
const { ChatMessage } = backendRequire('./src/models/ChatMessage');

(async () => {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      console.error('Missing MONGO_URI environment variable. Add it to your .env file.');
      process.exit(1);
    }
    await mongoose.connect(uri);
    const filter = { role: 'assistant', userId: { $exists: false } };
    if (process.env.DRY_RUN === '1') {
      const count = await ChatMessage.countDocuments(filter);
      console.log('[DRY_RUN] Would remove assistant messages without userId:', count);
    } else {
      const result = await ChatMessage.deleteMany(filter);
      console.log('Removed global assistant messages:', result.deletedCount);
    }
  } catch (err) {
    console.error('Cleanup failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
