const path = require('path');
const { runGeneratorSync } = require('../backend/src/services/pythonGenerator');

(async () => {
  try {
    const community = process.argv[2] || 'Diabetes';
    const timeslot = process.argv[3] || 'morning';
    console.log('Running runGeneratorSync for', community, timeslot);
    const out = runGeneratorSync(community, timeslot, { num: 1, timeout: 120000 });
    console.log('=== RESULT ===');
    console.log(JSON.stringify(out, null, 2));
  } catch (err) {
    console.error('Debug run failed:', err);
    process.exit(1);
  }
})();
