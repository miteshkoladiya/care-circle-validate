const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Run generator asynchronously and return a promise with stdout/stderr + pid
async function runGeneratorAsync(community, timeslot, options = {}) {
  const scriptPath = path.join(__dirname, '..', '..', '..', 'ML_model', 'generate_post_content.py');
  if (!fs.existsSync(scriptPath)) return { ok: false, error: `script_not_found:${scriptPath}` };
  
  const pythonCandidates = [];
  if (process.env.PYTHON_PATH) pythonCandidates.push(process.env.PYTHON_PATH);
  pythonCandidates.push('py', 'python3', 'python', 'python.exe');
  
  const args = [scriptPath, '--dry-run', '--num-per-community', String(options.num || 1)];
  if (community) { args.push('--community', community); }
  if (timeslot) { args.push('--timeslot', timeslot); }
  if (options.csvOnly) args.push('--csv-only');
  
  const timeout = typeof options.timeout === 'number' ? options.timeout : 120000;
  
  for (const py of pythonCandidates) {
    try {
      const proc = spawn(py, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '', stderr = '';
      proc.stdout.on('data', d => stdout += d.toString());
      proc.stderr.on('data', d => stderr += d.toString());
      
      let killed = false;
      const timer = setTimeout(() => {
        try { proc.kill('SIGKILL'); } catch (e) {}
        killed = true;
      }, timeout);
      
      const exit = await new Promise(resolve => proc.on('close', code => resolve({ code })));
      clearTimeout(timer);
      
      if (killed) continue;
      // try parse JSON
      let parsed = null;
      try { parsed = JSON.parse(stdout); } catch (e) {
        const m = stdout.trim().match(/(\[.*\]|\{.*\})/s);
        if (m) try { parsed = JSON.parse(m[0]); } catch (_) { parsed = null; }
      }
      
      if (!parsed) {
        // no JSON from this python exec -> return diagnostic info
        return { ok: false, error: 'no_json_output', raw: stdout, stderr, cmd: [py, ...args].join(' '), pid: proc.pid };
      }
      
      return { ok: true, json: Array.isArray(parsed) ? parsed : [parsed], raw: stdout, stderr, cmd: [py, ...args].join(' '), pid: proc.pid };
    } catch (err) {
      // try next candidate
    }
  }
  return { ok: false, error: 'python_not_found' };
}

module.exports = { runGeneratorAsync };
