import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startJob, subscribe} from '../src/jobs.js';
import {friendlyError} from '../src/friendlyErrors.js';

const skill = {id: 's', kind: 'story', workspace: mkdtempSync(join(tmpdir(), 'xv-job-'))};
const node = (code, extra = {}) => ({cmd: process.execPath, args: ['-e', code], ...extra});

const finished = (job) =>
  new Promise((resolve) => {
    const snapshots = [];
    const stop = subscribe(job.id, (j) => {
      snapshots.push(structuredClone(j));
      if (j.status !== 'running') {
        stop();
        resolve({job: j, snapshots});
      }
    });
  });

test('a job of two successful steps ends done with every step done', async () => {
  const job = startJob(skill, 'p1', [node('1', {label: 'Một'}), {label: 'Hai', run: async () => {}}]);
  const {job: end} = await finished(job);
  assert.equal(end.status, 'done');
  assert.deepEqual(end.steps.map((s) => s.status), ['done', 'done']);
});

test('a provider quota error ends the job failed with a friendly message', async () => {
  const job = startJob(skill, 'p2', [node('console.error("AiError: you have used up your daily free allocation of 10,000 neurons"); process.exit(1)', {label: 'Ảnh'})]);
  const {job: end} = await finished(job);
  assert.equal(end.status, 'failed');
  assert.match(end.error, /Cloudflare đã hết hạn mức tạo ảnh miễn phí hôm nay/);
  assert.equal(end.steps[0].status, 'failed');
});

test('a second job while one is running is refused with the busy message', async () => {
  const job = startJob(skill, 'p3', [node('setTimeout(() => {}, 300)', {label: 'Chậm'})]);
  assert.throws(() => startJob(skill, 'p4', [node('1', {label: 'X'})]), (e) => e.status === 409 && /Đang tạo một video khác/.test(e.message));
  await finished(job);
});

test('Remotion progress lines set the step percent', async () => {
  const job = startJob(skill, 'p5', [node('console.log("Rendered 450/900"); setTimeout(() => {}, 200)', {label: 'Dựng video', progress: 'remotion'})]);
  const {snapshots} = await finished(job);
  assert.ok(snapshots.some((j) => j.steps[0].percent === 50), 'percent 50 was reported');
});

test('a failing before() hook fails the job with its message', async () => {
  const job = startJob(skill, 'p6', [node('1', {label: 'Giọng', before: async () => { throw new Error('Mở CIT Voice Studio rồi thử lại.'); }})]);
  const {job: end} = await finished(job);
  assert.equal(end.error, 'Mở CIT Voice Studio rồi thử lại.');
});

test('friendlyError maps known provider errors and ignores the rest', () => {
  assert.equal(friendlyError('OpenAI 429: You have no credits remaining.'), 'Tài khoản OpenAI đã hết tiền.');
  assert.equal(friendlyError('Không kết nối được CIT Voice Studio ở http://127.0.0.1:8001'), 'Mở CIT Voice Studio rồi thử lại.');
  assert.equal(friendlyError('something else'), null);
});
