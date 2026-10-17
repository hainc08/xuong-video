import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.js';
import {startJob, subscribe} from '../src/jobs.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const root = mkdtempSync(join(tmpdir(), 'xv-api-'));
const story = join(root, 'story');
const office = join(root, 'office');
let server;
let base;

const call = async (method, path, body) => {
  const res = await fetch(base + path, {method, headers: {'Content-Type': 'application/json'}, body: body && JSON.stringify(body)});
  const type = res.headers.get('content-type') ?? '';
  return {status: res.status, body: type.includes('json') ? await res.json() : await res.text()};
};

before(async () => {
  for (const ws of [story, office]) mkdirSync(join(ws, 'videos'), {recursive: true});
  mkdirSync(join(story, 'public', 'story_x'), {recursive: true});
  writeFileSync(join(story, 'videos', 'story_x.json'), JSON.stringify({...fixture('story'), id: 'story_x', timeline: {durationSec: 50}}));
  writeFileSync(join(story, 'public', 'story_x', 'hook_01.png'), Buffer.from(PNG_1PX.split(',')[1], 'base64'));
  writeFileSync(join(story, '.env'), 'SECRET=1');
  writeFileSync(join(office, 'videos', 'meo-a.json'), JSON.stringify(fixture('office')));
  const skills = join(root, 'skills.json');
  writeFileSync(skills, JSON.stringify([
    {id: 'ke-chuyen-video', name: 'Kể chuyện', kind: 'story', workspace: story, skillDir: story, wordsPerMinute: 188, defaultVoice: {engine: 'cit', voice: 'Thiện Minh', speed: 0.8}, step4: 'images', sampleImage: null},
    {id: 'ai-van-phong-video', name: 'Mẹo AI văn phòng', kind: 'office', workspace: office, skillDir: office, wordsPerMinute: 165, defaultVoice: {engine: 'edge', voice: 'vi-VN-HoaiMyNeural', rate: '+8%'}, step4: 'layouts', sampleImage: null},
  ]));
  process.env.XUONG_SKILLS = skills;
  process.env.XUONG_LIBRARY = join(root, 'thu-vien');
  const writeScript = async (skill, {topic}) => ({id: 'story_y', video: {title: topic, scenes: [{name: 'Hook', voice: 'Một hai ba.'}]}, caption: 'cap'});
  server = createApp({writeScript}).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

test('GET /api/projects lists projects of every skill', async () => {
  const {status, body} = await call('GET', '/api/projects');
  assert.equal(status, 200);
  assert.deepEqual(body.map((p) => p.id).sort(), ['meo-a', 'story_x']);
});

test('POST /api/projects writes a script and returns it with an estimate', async () => {
  const {status, body} = await call('POST', '/api/projects', {skillId: 'ke-chuyen-video', topic: 'lời cảm ơn'});
  assert.equal(status, 200);
  assert.equal(body.id, 'story_y');
  assert.equal(body.video.title, 'lời cảm ơn');
  assert.equal(typeof body.estimateSeconds, 'number');
});

test('GET a story project lists its images with existence and source', async () => {
  const {status, body} = await call('GET', '/api/projects/ke-chuyen-video/story_x');
  assert.equal(status, 200);
  const hook = body.images.find((i) => i.file === 'hook_01.png');
  assert.equal(hook.exists, true);
  assert.equal(body.images.find((i) => i.file === 'scene_03.png').exists, false);
  assert.ok(hook.prompt.length > 10);
});

test('PUT with an edited voice clears the generated timeline', async () => {
  const {body} = await call('GET', '/api/projects/ke-chuyen-video/story_x');
  body.video.scenes[0].voice = 'Lời đọc mới.';
  const put = await call('PUT', '/api/projects/ke-chuyen-video/story_x', {video: body.video});
  assert.equal(put.status, 200);
  const saved = JSON.parse(readFileSync(join(story, 'videos', 'story_x.json'), 'utf8'));
  assert.equal(saved.scenes[0].voice, 'Lời đọc mới.');
  assert.equal('timeline' in saved, false);
});

test('uploading an image crops it to 1080x1920 and records the source', async () => {
  const {status} = await call('POST', '/api/projects/ke-chuyen-video/story_x/images/scene_03.png', {dataUrl: PNG_1PX});
  assert.equal(status, 200);
  const size = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', join(story, 'public', 'story_x', 'scene_03.png')], {encoding: 'utf8'}).trim();
  assert.equal(size, '1080,1920');
  const {body} = await call('GET', '/api/projects/ke-chuyen-video/story_x');
  assert.equal(body.images.find((i) => i.file === 'scene_03.png').source, 'upload');
});

test('an upload with a path in its name is refused', async () => {
  const {status} = await call('POST', '/api/projects/ke-chuyen-video/story_x/images/..%2F..%2F.env', {dataUrl: PNG_1PX});
  assert.equal(status, 400);
});

test('/files serves public/ and out/ but nothing else in the workspace', async () => {
  assert.equal((await fetch(`${base}/files/ke-chuyen-video/public/story_x/hook_01.png`)).status, 200);
  assert.equal((await fetch(`${base}/files/ke-chuyen-video/.env`)).status, 404);
  assert.equal((await fetch(`${base}/files/ke-chuyen-video/public/..%2F.env`)).status, 404);
  assert.equal((await fetch(`${base}/files/ke-chuyen-video/videos/story_x.json`)).status, 404);
});

test('render while another job runs answers 409 with the busy message', async () => {
  const job = startJob({id: 'x', kind: 'story', workspace: root}, 'busy', [{label: 'Chậm', cmd: process.execPath, args: ['-e', 'setTimeout(() => {}, 400)']}]);
  const {status, body} = await call('POST', '/api/projects/ai-van-phong-video/meo-a/render', {voice: {engine: 'edge', voice: 'vi-VN-HoaiMyNeural', rate: '+8%'}});
  assert.equal(status, 409);
  assert.match(body.error, /Đang tạo một video khác/);
  await new Promise((r) => subscribe(job.id, (j) => j.status !== 'running' && r()));
});

test('a caption-only save cannot bring back stale voice timing', async () => {
  const file = join(office, 'videos', 'meo-a.json');
  const stale = fixture('office');
  stale.scenes[1] = {...stale.scenes[1], audio: 'meo-a/01.mp3', audioSec: 8, durationSec: 9.5};
  writeFileSync(file, JSON.stringify(stale));
  const edited = structuredClone(stale);
  edited.scenes[1].voice = 'Lời đọc ngắn hơn.';
  await call('PUT', '/api/projects/ai-van-phong-video/meo-a', {video: edited}); // resets timing
  await call('PUT', '/api/projects/ai-van-phong-video/meo-a', {video: edited, caption: 'mới'}); // client still holds old fields
  const saved = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal('audio' in saved.scenes[1], false);
  assert.equal(saved.scenes[1].durationSec, 6);
});

test('render without a voice keeps the voice saved in the project', async () => {
  const file = join(office, 'videos', 'meo-a.json');
  writeFileSync(file, JSON.stringify({...fixture('office'), ttsEngine: 'edge', ttsVoice: 'vi-VN-NamMinhNeural', ttsRate: '+5%'}));
  const {status, body} = await call('POST', '/api/projects/ai-van-phong-video/meo-a/render', {});
  assert.equal(status, 200);
  const saved = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(saved.ttsVoice, 'vi-VN-NamMinhNeural');
  assert.equal(saved.ttsRate, '+5%');
  await new Promise((r) => subscribe(body.jobId, (j) => j.status !== 'running' && r()));
});

test('editing a project while its video is being made is refused', async () => {
  const job = startJob({id: 'ai-van-phong-video', kind: 'office', workspace: office}, 'meo-a', [{label: 'Chậm', cmd: process.execPath, args: ['-e', 'setTimeout(() => {}, 400)']}]);
  const {body: view} = await call('GET', '/api/projects/ai-van-phong-video/meo-a');
  const put = await call('PUT', '/api/projects/ai-van-phong-video/meo-a', {video: view.video});
  assert.equal(put.status, 409);
  assert.match(put.body.error, /đang được tạo/);
  const up = await call('POST', '/api/projects/ai-van-phong-video/meo-a/images/scene_09.png?scene=0', {dataUrl: PNG_1PX});
  assert.equal(up.status, 409);
  await new Promise((r) => subscribe(job.id, (j) => j.status !== 'running' && r()));
});

test('GET image-prompt returns the ChatGPT batch prompt for a story project', async () => {
  const {status, body} = await call('GET', '/api/projects/ke-chuyen-video/story_x/image-prompt');
  assert.equal(status, 200);
  assert.match(body.text, /ẢNH 0 — character_ref\.png/);
  assert.equal(body.count, fixture('story').images.length + 1);
});

test('GET image-prompt is refused for a skill without background images', async () => {
  const {status, body} = await call('GET', '/api/projects/ai-van-phong-video/meo-a/image-prompt');
  assert.equal(status, 400);
  assert.match(body.error, /chỉ dùng cho video có ảnh nền/);
});

test('GET /api/library lists the projects of one skill with their status', async () => {
  const {status, body} = await call('GET', '/api/library?skillId=ke-chuyen-video');
  assert.equal(status, 200);
  assert.deepEqual(body.items.map((p) => p.id), ['story_x']);
  assert.equal(body.items[0].status.code, 'missing-images');
  assert.equal(body.libraryDir, join(root, 'thu-vien'));
});

test('GET /api/library searches across skills', async () => {
  const {body} = await call('GET', '/api/library?q=zzz-khong-co');
  assert.deepEqual(body.items, []);
});

test('POST duplicate makes a new project from an old one', async () => {
  const {status, body} = await call('POST', '/api/projects/ke-chuyen-video/story_x/duplicate');
  assert.equal(status, 200);
  assert.notEqual(body.id, 'story_x');
  assert.equal((await call('GET', `/api/projects/ke-chuyen-video/${body.id}`)).status, 200);
});

test('POST archive without a video explains why', async () => {
  const {status, body} = await call('POST', '/api/projects/ke-chuyen-video/story_x/archive');
  assert.equal(status, 400);
  assert.match(body.error, /chưa có video/);
});

test('GET /api/jobs/current reports no running job when idle', async () => {
  const {status, body} = await call('GET', '/api/jobs/current');
  assert.equal(status, 200);
  assert.equal(body, null);
});
