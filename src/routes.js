import express from 'express';
import {existsSync, statSync} from 'node:fs';
import {basename, join} from 'node:path';
import {getSkill, loadSkills} from './skills.js';
import {kindOf} from './kinds/index.js';
import {listProjects, readProject, writeProject} from './projects.js';
import {writeScript as realWriteScript, rewriteScene as realRewriteScene} from './scriptWriter.js';
import {pipelineFor} from './pipelines.js';
import {getJob, runningJob, startJob, subscribe} from './jobs.js';
import {listVoices, previewVoice} from './voices.js';
import {IMAGE_NAME, saveImage} from './uploads.js';
import {resolveInside} from './safePath.js';
import {buildBatchImagePrompt} from './imagePrompt.js';

// Wrap an async handler so thrown errors become {error} responses.
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    const status = e.status ?? (/^Không có /.test(e.message) ? 404 : 400);
    if (!res.headersSent) res.status(status).json({error: e.message});
  }
};

// The voice and render scripts rewrite videos/<id>.json while they run; edits made meanwhile would be lost.
const assertNotBusy = (skill, id) => {
  const job = runningJob();
  if (job && job.skillId === skill.id && job.projectId === id) {
    const err = new Error('Video này đang được tạo, chờ xong rồi sửa tiếp.');
    err.status = 409;
    throw err;
  }
};

// The fields whose change makes the stored voice timing stale.
const scriptShape = (video) =>
  JSON.stringify({
    scenes: (video.scenes ?? []).map((s) => [s.voice, s.keywords, s.type]),
    hook: video.hook,
    images: (video.images ?? []).map((i) => i.file),
  });

const imagesOf = (skill, id, video, app) => {
  const dir = join(skill.workspace, 'public', id);
  const info = (file) => {
    const path = join(dir, file);
    const exists = Boolean(file) && existsSync(path);
    return {exists, mtime: exists ? statSync(path).mtimeMs : 0, source: app.imageSources?.[file] ?? (exists ? 'ai' : 'none')};
  };
  if (skill.kind === 'story') return (video.images ?? []).map(({file, prompt}) => ({file, prompt, ...info(file)}));
  return (video.scenes ?? [])
    .map((s, scene) => ({s, scene}))
    .filter(({s}) => s.type === 'image')
    .map(({s, scene}) => {
      const file = s.image ? basename(s.image) : '';
      return {file, scene, prompt: s.title ?? '', ...info(file)};
    });
};

const projectView = (skill, id) => {
  const {video, app} = readProject(skill, id);
  return {video, app, estimateSeconds: kindOf(skill).estimateSeconds(video, skill.wordsPerMinute), images: imagesOf(skill, id, video, app)};
};

export const apiRouter = ({writeScript = realWriteScript, rewriteScene = realRewriteScene, fetchFn = fetch} = {}) => {
  const r = express.Router();

  r.get('/api/projects', handle(async (_req, res) => {
    res.json(loadSkills().filter((s) => s.available).flatMap(listProjects).sort((a, b) => b.updatedAt - a.updatedAt));
  }));

  r.post('/api/projects', handle(async (req, res) => {
    const skill = getSkill(req.body.skillId);
    const topic = String(req.body.topic ?? '').trim();
    if (!topic) throw new Error('Bạn chưa nhập chủ đề.');
    const {id, video, caption} = await writeScript(skill, {topic, options: req.body.options ?? {}});
    res.json({id, video, caption, estimateSeconds: kindOf(skill).estimateSeconds(video, skill.wordsPerMinute)});
  }));

  r.get('/api/projects/:skillId/:id', handle(async (req, res) => {
    res.json(projectView(getSkill(req.params.skillId), req.params.id));
  }));

  r.put('/api/projects/:skillId/:id', handle(async (req, res) => {
    const skill = getSkill(req.params.skillId);
    const {video: stored, app} = readProject(skill, req.params.id);
    assertNotBusy(skill, req.params.id);
    let video = req.body.video;
    if (!video?.scenes) throw new Error('Kịch bản không hợp lệ');
    const kind = kindOf(skill);
    video = scriptShape(video) !== scriptShape(stored) ? kind.resetGenerated(video) : kind.keepGenerated(video, stored);
    if (typeof req.body.caption === 'string') app.caption = req.body.caption;
    writeProject(skill, req.params.id, video, app);
    res.json(projectView(skill, req.params.id));
  }));

  r.post('/api/projects/:skillId/:id/rewrite-scene', handle(async (req, res) => {
    const skill = getSkill(req.params.skillId);
    assertNotBusy(skill, req.params.id);
    const {video} = readProject(skill, req.params.id);
    const index = Number(req.body.index);
    if (!video.scenes[index]) throw new Error('Không có cảnh này');
    res.json({scene: await rewriteScene(skill, video, index, req.body.instruction ?? '')});
  }));

  r.get('/api/projects/:skillId/:id/image-prompt', handle(async (req, res) => {
    const skill = getSkill(req.params.skillId);
    if (skill.step4 !== 'images') throw new Error('Prompt tạo ảnh chỉ dùng cho video có ảnh nền.');
    const {video} = readProject(skill, req.params.id);
    res.json({text: buildBatchImagePrompt(video), count: (video.images ?? []).length + 1});
  }));

  // "generate" is registered before ":file" so it is never taken for a file name.
  r.post('/api/projects/:skillId/:id/images/generate', handle(async (req, res) => {
    const skill = getSkill(req.params.skillId);
    const job = startJob(skill, req.params.id, await pipelineFor(skill, req.params.id, {imagesOnly: true, regenerateImage: req.body.file, fetchFn}));
    res.json({jobId: job.id});
  }));

  r.post('/api/projects/:skillId/:id/images/:file', handle(async (req, res) => {
    const skill = getSkill(req.params.skillId);
    const {id, file} = req.params;
    if (!IMAGE_NAME.test(file)) throw new Error('Tên ảnh không hợp lệ');
    assertNotBusy(skill, id);
    const {video, app} = readProject(skill, id);
    await saveImage(req.body.dataUrl, resolveInside(join(skill.workspace, 'public', id), file));
    if (skill.kind === 'office') {
      const scene = video.scenes[Number(req.query.scene)];
      if (!scene) throw new Error('Không có cảnh này');
      scene.image = `${id}/${file}`;
    }
    app.imageSources = {...app.imageSources, [file]: 'upload'};
    writeProject(skill, id, video, app);
    res.json(projectView(skill, id));
  }));

  r.get('/api/voices', handle(async (_req, res) => res.json(await listVoices({fetchFn}))));

  r.post('/api/voices/preview', handle(async (req, res) => {
    const audio = await previewVoice(req.body, {fetchFn});
    res.type('audio/mpeg').send(audio);
  }));

  r.post('/api/projects/:skillId/:id/render', handle(async (req, res) => {
    const skill = getSkill(req.params.skillId);
    const {id} = req.params;
    if (runningJob()) {
      const err = new Error('Đang tạo một video khác, chờ xong rồi thử lại.');
      err.status = 409;
      throw err;
    }
    const {video, app} = readProject(skill, id);
    // No voice in the request (e.g. "Tạo lại" after reopening the page): keep the one the project already uses.
    const voice = req.body.voice ?? kindOf(skill).savedVoice(video) ?? skill.defaultVoice;
    const before = JSON.stringify([video.tts, video.ttsEngine, video.ttsVoice, video.ttsSpeed, video.ttsRate]);
    let next = kindOf(skill).applyVoice(video, voice);
    const after = JSON.stringify([next.tts, next.ttsEngine, next.ttsVoice, next.ttsSpeed, next.ttsRate]);
    if (before !== after) next = kindOf(skill).resetGenerated(next); // a new voice needs new timing
    writeProject(skill, id, next, app);
    const job = startJob(skill, id, await pipelineFor(skill, id, {fetchFn}));
    res.json({jobId: job.id});
  }));

  r.get('/api/jobs/current', (_req, res) => res.json(runningJob()));

  r.get('/api/jobs/:jobId', (req, res) => {
    const job = getJob(req.params.jobId);
    if (!job) return res.status(404).json({error: 'Không có việc này'});
    res.json(job);
  });

  r.get('/api/jobs/:jobId/events', (req, res) => {
    const job = getJob(req.params.jobId);
    if (!job) return res.status(404).json({error: 'Không có việc này'});
    res.writeHead(200, {'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive'});
    const send = (j) => res.write(`data: ${JSON.stringify(j)}\n\n`);
    send(job);
    const stop = subscribe(job.id, send);
    req.on('close', stop);
  });

  // Only the workspace's public/ and out/ folders are served; .env, videos/, scripts stay private.
  r.get('/files/:skillId/*', (req, res) => {
    try {
      const skill = getSkill(req.params.skillId);
      const [top, ...rest] = req.params[0].split(/[\\/]/);
      if (!['public', 'out'].includes(top)) throw new Error('private');
      const abs = resolveInside(join(skill.workspace, top), rest.join('/'));
      if (!existsSync(abs) || !statSync(abs).isFile()) throw new Error('missing');
      res.sendFile(abs);
    } catch {
      res.status(404).end();
    }
  });

  return r;
};
