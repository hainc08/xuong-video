import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pipelineFor} from '../src/pipelines.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));

const storyWorkspace = ({missing = []} = {}) => {
  const workspace = mkdtempSync(join(tmpdir(), 'xv-pipe-'));
  const video = {...fixture('story'), id: 'story_x'};
  mkdirSync(join(workspace, 'videos'));
  mkdirSync(join(workspace, 'public', 'story_x'), {recursive: true});
  writeFileSync(join(workspace, 'videos', 'story_x.json'), JSON.stringify(video));
  for (const {file} of video.images) if (!missing.includes(file)) writeFileSync(join(workspace, 'public', 'story_x', file), 'png');
  return {skill: {id: 'ke-chuyen-video', kind: 'story', workspace}, video};
};

test('story pipeline skips image generation when every image exists', async () => {
  const {skill} = storyWorkspace();
  const steps = await pipelineFor(skill, 'story_x');
  assert.deepEqual(steps.map((s) => s.label), ['Giọng đọc + phụ đề', 'Nhạc nền', 'Dựng video', 'Ảnh bìa', 'Caption']);
});

test('story pipeline starts with image generation when an image is missing', async () => {
  const {skill, video} = storyWorkspace({missing: ['scene_03.png']});
  const steps = await pipelineFor(skill, 'story_x');
  assert.equal(steps[0].label, 'Tạo ảnh còn thiếu');
  assert.deepEqual(steps[0].args.slice(-2), ['scripts/story_images.mjs', 'videos/story_x.json']);
  assert.ok(video.images.length > 1);
});

test('music length is read from the timeline written by the voice step', async () => {
  const {skill, video} = storyWorkspace();
  const steps = await pipelineFor(skill, 'story_x');
  writeFileSync(join(skill.workspace, 'videos', 'story_x.json'), JSON.stringify({...video, timeline: {durationSec: 56.4}}));
  const music = steps.find((s) => s.label === 'Nhạc nền');
  assert.deepEqual(music.args(), ['scripts/make-story-music.mjs', 'story_x', '59']);
});

test('render steps call Remotion directly with the project props', async () => {
  const {skill} = storyWorkspace();
  const render = (await pipelineFor(skill, 'story_x')).find((s) => s.label === 'Dựng video');
  assert.equal(render.cmd, process.execPath);
  assert.match(render.args[0], /remotion-cli\.js$/);
  assert.deepEqual(render.args.slice(1), ['render', 'StoryReel', 'out/story_x/video_story_x.mp4', '--props=videos/story_x.json']);
  assert.equal(render.progress, 'remotion');
});

test('imagesOnly with regenerateImage deletes that image and runs only the image step', async () => {
  const {skill} = storyWorkspace();
  const steps = await pipelineFor(skill, 'story_x', {imagesOnly: true, regenerateImage: 'scene_03.png'});
  assert.deepEqual(steps.map((s) => s.label), ['Tạo ảnh còn thiếu']);
  assert.equal(typeof steps[0].before, 'function');
});

test('a failed regeneration puts the old image back', async () => {
  const {skill} = storyWorkspace();
  const file = join(skill.workspace, 'public', 'story_x', 'scene_03.png');
  const [step] = await pipelineFor(skill, 'story_x', {imagesOnly: true, regenerateImage: 'scene_03.png'});
  await step.before();
  assert.equal(existsSync(file), false); // moved aside so the generator makes a new one
  await step.onFail();
  assert.equal(readFileSync(file, 'utf8'), 'png');
});

test('a successful regeneration drops the old copy', async () => {
  const {skill} = storyWorkspace();
  const dir = join(skill.workspace, 'public', 'story_x');
  const [step] = await pipelineFor(skill, 'story_x', {imagesOnly: true, regenerateImage: 'scene_03.png'});
  await step.before();
  writeFileSync(join(dir, 'scene_03.png'), 'new');
  await step.onDone();
  assert.deepEqual(readdirSync(dir).filter((f) => f.startsWith('scene_03.')), ['scene_03.png']);
  assert.equal(readFileSync(join(dir, 'scene_03.png'), 'utf8'), 'new');
});

test('regenerateImage refuses names that are not plain image files', async () => {
  const {skill} = storyWorkspace();
  await assert.rejects(pipelineFor(skill, 'story_x', {imagesOnly: true, regenerateImage: '../.env'}), /không hợp lệ/);
});

test('office pipeline: voice, validate, render, caption', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'xv-pipe-'));
  mkdirSync(join(workspace, 'videos'));
  writeFileSync(join(workspace, 'videos', 'meo-a.json'), JSON.stringify(fixture('office')));
  const steps = await pipelineFor({id: 'ai-van-phong-video', kind: 'office', workspace}, 'meo-a');
  assert.deepEqual(steps.map((s) => s.label), ['Giọng đọc', 'Kiểm tra kịch bản', 'Dựng video', 'Caption']);
  assert.deepEqual(steps[0].args, ['scripts/tts.py', 'videos/meo-a.json']);
  assert.match(steps[1].args[0], /tsx[\\/]dist[\\/]cli\.mjs$/);
  assert.deepEqual(steps[2].args.slice(1), ['render', 'AiVanPhong', 'out/meo-a.mp4', '--props=videos/meo-a.json']);
});

test('a CIT voice step checks that CIT Voice Studio is running first', async () => {
  const {skill, video} = storyWorkspace();
  writeFileSync(join(skill.workspace, 'videos', 'story_x.json'), JSON.stringify({...video, tts: {engine: 'cit', voice: 'Thiện Minh', speed: 0.8}}));
  const fetchFn = async () => {
    throw new Error('ECONNREFUSED');
  };
  const voice = (await pipelineFor(skill, 'story_x', {fetchFn}))[0];
  await assert.rejects(voice.before(), /Mở CIT Voice Studio rồi thử lại\./);
});
