const { v4: uuidv4 } = require('uuid');

const JOBS = {};

function createJob(meta = {}) {
  const id = uuidv4();
  JOBS[id] = { id, status: 'pending', createdAt: new Date(), updatedAt: new Date(), meta, result: null, errors: [] };
  return JOBS[id];
}

function setJobRunning(id) {
  if (!JOBS[id]) return;
  JOBS[id].status = 'running';
  JOBS[id].updatedAt = new Date();
}

function setJobDone(id, result) {
  if (!JOBS[id]) return;
  JOBS[id].status = 'done';
  JOBS[id].result = result;
  JOBS[id].updatedAt = new Date();
}

function setJobFailed(id, error) {
  if (!JOBS[id]) return;
  JOBS[id].status = 'failed';
  JOBS[id].errors.push(String(error));
  JOBS[id].updatedAt = new Date();
}

function appendJobError(id, err) {
  if (!JOBS[id]) return;
  JOBS[id].errors.push(String(err));
  JOBS[id].updatedAt = new Date();
}

function getJob(id) { return JOBS[id] || null; }

function getAllJobs() { return Object.values(JOBS).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)); }

module.exports = { createJob, setJobRunning, setJobDone, setJobFailed, appendJobError, getAllJobs, getJob };
