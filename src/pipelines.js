// The commands each skill runs to turn a project into a video, as a list of job steps.
import {existsSync, mkdirSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {kindOf} from './kinds/index.js';
import {readProject} from './projects.js';
import {resolveInside} from './safePath.js';
import {archiveProject} from './library.js';
import {loadConfig} from './config.js';

const CIT_HEALTH = 'http://127.0.0.1:8001/health';
const IMAGE_NAME = /^[\w-]+\.(png|jpg|jpeg)$/;

const remotion = (skill) => join(skill.workspace, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
const tsx = (skill) => join(skill.workspace, 'node_modules', 'tsx', 'dist', 'cli.mjs');

const citCheck = (fetchFn) => async () => {
  try {
    const res = await fetchFn(CIT_HEALTH, {signal: AbortSignal.timeout(4000)});
    if ((await res.json()).status === 'ok') return;
  } catch {
    // fall through
  }
  throw new Error('Mở CIT Voice Studio rồi thử lại.');
};

// Last step of every render: copy the finished video and its script to the library folder (drive D).
const archiveStep = (skill, id) => ({
  label: 'Lưu vào thư viện',
  run: async () => archiveProject(skill, id, loadConfig().libraryDir),
});

const captionStep = (skill, id) => ({
  label: 'Caption',
  run: async () => {
    const file = join(skill.workspace, kindOf(skill).outputs(id).caption);
    mkdirSync(dirname(file), {recursive: true});
    writeFileSync(file, (readProject(skill, id).app.caption ?? '') + '\n', 'utf8');
  },
});

const storyPipeline = (skill, id, {imagesOnly, regenerateImage, fetchFn}) => {
  const {video} = readProject(skill, id);
  const node = process.execPath;
  const imageDir = join(skill.workspace, 'public', id);
  const images = {
    label: 'Tạo ảnh còn thiếu',
    cmd: node,
    args: ['scripts/story_images.mjs', `videos/${id}.json`],
  };
  if (regenerateImage) {
    // Move the old picture aside (the generator only makes missing files) and put it back if generation fails,
    // e.g. when the provider is out of quota.
    const current = resolveInside(imageDir, regenerateImage);
    const aside = `${current}.old`;
    images.before = async () => existsSync(current) && renameSync(current, aside);
    images.onFail = async () => existsSync(aside) && !existsSync(current) && renameSync(aside, current);
    images.onDone = async () => rmSync(aside, {force: true});
  }
  if (imagesOnly) return [images];

  const missing = (video.images ?? []).some(({file}) => !existsSync(join(imageDir, file)));
  const voice = {label: 'Giọng đọc + phụ đề', cmd: 'python', args: ['scripts/story_tts.py', `videos/${id}.json`]};
  if ((video.tts?.engine ?? 'cit') === 'cit') voice.before = citCheck(fetchFn);
  const out = kindOf(skill).outputs(id);
  return [
    ...(missing ? [images] : []),
    voice,
    {
      label: 'Nhạc nền',
      cmd: node,
      // Music must outlast the narration, whose length the voice step has only just written.
      args: () => ['scripts/make-story-music.mjs', id, String(Math.ceil(readProject(skill, id).video.timeline.durationSec) + 2)],
    },
    {label: 'Dựng video', cmd: node, args: [remotion(skill), 'render', 'StoryReel', out.video, `--props=videos/${id}.json`], progress: 'remotion'},
    {label: 'Ảnh bìa', cmd: node, args: [remotion(skill), 'still', 'StoryThumb', out.thumbnail, `--props=videos/${id}.json`]},
    captionStep(skill, id),
    archiveStep(skill, id),
  ];
};

const officePipeline = (skill, id, {fetchFn}) => {
  const {video} = readProject(skill, id);
  const voice = {label: 'Giọng đọc', cmd: 'python', args: ['scripts/tts.py', `videos/${id}.json`]};
  if (video.ttsEngine === 'cit') voice.before = citCheck(fetchFn);
  return [
    voice,
    {label: 'Kiểm tra kịch bản', cmd: process.execPath, args: [tsx(skill), 'scripts/validate.ts', `videos/${id}.json`]},
    {label: 'Dựng video', cmd: process.execPath, args: [remotion(skill), 'render', 'AiVanPhong', kindOf(skill).outputs(id).video, `--props=videos/${id}.json`], progress: 'remotion'},
    captionStep(skill, id),
    archiveStep(skill, id),
  ];
};

export const pipelineFor = async (skill, id, {imagesOnly = false, regenerateImage, fetchFn = fetch} = {}) => {
  if (regenerateImage && !IMAGE_NAME.test(regenerateImage)) throw new Error('Tên ảnh không hợp lệ');
  if (skill.kind === 'story') return storyPipeline(skill, id, {imagesOnly, regenerateImage, fetchFn});
  if (skill.kind === 'office') return officePipeline(skill, id, {fetchFn});
  throw new Error(`Chưa hỗ trợ loại skill "${skill.kind}"`);
};
