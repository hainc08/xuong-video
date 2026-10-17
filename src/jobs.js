// Runs one job (a list of steps) at a time and tells subscribers about every change.
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {kindOf} from './kinds/index.js';
import {friendlyError} from './friendlyErrors.js';

const jobs = new Map();
const listeners = new Map();
const logs = new Map();
let running = null;

const MAX_LOG = 200;
const PROGRESS = /(\d+)\s*\/\s*(\d+)/g;

const notify = (job) => {
  for (const fn of listeners.get(job.id) ?? []) fn(job);
};

const appendLog = (job, chunk, step) => {
  const lines = logs.get(job.id);
  for (const line of String(chunk).split(/\r?\n|\r/)) {
    if (!line.trim()) continue;
    lines.push(line);
    if (step.progress === 'remotion') {
      const last = [...line.matchAll(PROGRESS)].at(-1);
      if (last && Number(last[2]) > 0) {
        const percent = Math.min(100, Math.round((Number(last[1]) / Number(last[2])) * 100));
        const view = job.steps[job.current];
        if (percent !== view.percent) {
          view.percent = percent;
          notify(job);
        }
      }
    }
  }
  if (lines.length > MAX_LOG) lines.splice(0, lines.length - MAX_LOG);
};

const runCommand = (job, step, cwd) =>
  new Promise((resolve, reject) => {
    const args = typeof step.args === 'function' ? step.args() : step.args;
    const child = spawn(step.cmd, args, {cwd, windowsHide: true, env: {...process.env, PYTHONIOENCODING: 'utf-8'}});
    child.stdout.on('data', (d) => appendLog(job, d, step));
    child.stderr.on('data', (d) => appendLog(job, d, step));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
  });

const failureMessage = (job, step, err) => {
  const log = logs.get(job.id).join('\n');
  const last = logs.get(job.id).filter((l) => /error|lỗi|Error/i.test(l)).at(-1) ?? err.message;
  return friendlyError(`${err.message}\n${log}`) ?? (err.message.startsWith('exit ') ? `Bước "${step.label}" bị lỗi: ${last.slice(0, 300)}` : err.message);
};

const execute = async (job, skill, steps) => {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    job.current = i;
    job.steps[i].status = 'running';
    notify(job);
    try {
      if (step.before) await step.before();
      if (step.run) await step.run();
      else await runCommand(job, step, skill.workspace);
      job.steps[i].status = 'done';
      if (step.progress) job.steps[i].percent = 100;
      await step.onDone?.();
    } catch (err) {
      await Promise.resolve(step.onFail?.()).catch(() => {});
      job.steps[i].status = 'failed';
      job.status = 'failed';
      job.error = failureMessage(job, step, err);
      break;
    }
  }
  if (job.status === 'running') {
    job.status = 'done';
    job.outputs = kindOf(skill).outputs(job.projectId);
  }
  running = null;
  notify(job);
};

export const startJob = (skill, projectId, steps) => {
  if (running) {
    const err = new Error('Đang tạo một video khác, chờ xong rồi thử lại.');
    err.status = 409;
    throw err;
  }
  const job = {
    id: randomUUID(),
    skillId: skill.id,
    projectId,
    status: 'running',
    current: 0,
    steps: steps.map((s) => ({label: s.label, status: 'pending', percent: s.progress ? 0 : null})),
    error: null,
    outputs: null,
  };
  jobs.set(job.id, job);
  logs.set(job.id, []);
  running = job;
  setImmediate(() => execute(job, skill, steps));
  return job;
};

export const getJob = (jobId) => jobs.get(jobId) ?? null;

export const runningJob = () => running;

export const subscribe = (jobId, listener) => {
  if (!listeners.has(jobId)) listeners.set(jobId, new Set());
  listeners.get(jobId).add(listener);
  return () => listeners.get(jobId)?.delete(listener);
};
