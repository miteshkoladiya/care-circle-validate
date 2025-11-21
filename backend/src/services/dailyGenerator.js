const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', '..', 'ML_model', 'Daily_Post_Content_Dataset.csv');

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (!lines.length) return [];
  const header = lines[0].split(',').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const cells = [];
    let cur = '';
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === '"') {
        if (inQuotes && line[j+1] === '"') { cur += '"'; j++; } else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        cells.push(cur); cur = '';
      } else { cur += ch; }
    }
    cells.push(cur);
    const obj = {};
    for (let k = 0; k < header.length; k++) obj[header[k]] = (cells[k] || '').trim();
    rows.push(obj);
  }
  return rows;
}

let CACHE = null;
function loadBank() {
  if (CACHE) return CACHE;
  try {
    const raw = fs.readFileSync(CSV_PATH, 'utf8');
    const rows = parseCSV(raw);
    const byCommunity = {};
    for (const r of rows) {
      const community = (r.Community || 'General').trim();
      const tag = (r.Tag || '').trim();
      const content = (r.Content || '').trim();
      if (!byCommunity[community]) byCommunity[community] = [];
      byCommunity[community].push({ tag, content });
    }
    CACHE = byCommunity;
  } catch (e) { CACHE = {}; }
  return CACHE;
}

function chooseRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const SLOT_TAG_PREFERENCE = {
  morning: ['Diet', 'Exercise', 'Awareness'],
  evening: ['Exercise', 'Diet', 'Awareness'],
  night: ['Awareness', 'Diet', 'Exercise']
};

function generateDailyForCommunity(communityObj = {}, slot = 'morning', date = new Date()) {
  const bank = loadBank();
  const name = communityObj.name || communityObj || 'Community';
  const communityKey = Object.keys(bank).find(k => k.toLowerCase() === String(name).toLowerCase()) || 'Generic';
  const candidates = bank[communityKey] || [];
  const prefs = SLOT_TAG_PREFERENCE[slot] || [];
  let pick = null;
  for (const p of prefs) {
    const filtered = candidates.filter(c => String(c.tag).toLowerCase() === String(p).toLowerCase());
    if (filtered.length) { pick = chooseRandom(filtered); break; }
  }
  if (!pick && candidates.length) pick = chooseRandom(candidates);
  if (!pick) pick = { content: `Daily tip for ${name}: stay active and eat balanced meals.` };
  const dateStr = (date instanceof Date) ? date.toISOString().slice(0,10) : String(date);
  const slotLabel = slot[0].toUpperCase() + slot.slice(1);
  const title = `${name} — ${slotLabel} Tip — ${dateStr}`;
  const content = String(pick.content).replace(/\$communityName/g, name);
  return { title, content, timeOfDay: slot, scheduledDate: dateStr };
}

module.exports = { generateDailyForCommunity, loadBank };
