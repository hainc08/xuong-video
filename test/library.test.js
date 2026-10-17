import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {summarize, listLibrary, duplicateProject, archiveProject} from '../src/library.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));

const storySkill = () => {
  const workspace = mkdtempSync(join(tmpdir(), 'xv-lib-'));
  mkdirSync(join(workspace, 'videos'));
  mkdirSync(join(workspace, 'public', 'story_001'), {recursive: true});
  const video = {...fixture('story'), id: 'story_001', title: 'Chê vì thương', tts: {engine: 'cit', voice: 'Thiện Minh', speed: 0.8}};
  writeFileSync(join(workspace, 'videos', 'story_001.json'), JSON.stringify(video));
  writeFileSync(join(workspace, 'videos', 'story_001.app.json'), JSON.stringify({topic: 'khen thật lòng', caption: 'Lời khen thật lòng…', createdAt: '2026-10-15T08:00:00.000Z'}));
  return {skill: {id: 'ke-chuyen-video', name: 'Kể chuyện', kind: 'story', workspace, wordsPerMinute: 188, step4: 'images', available: true}, video};
};

const addAllImages = (skill, video) => {
  for (const {file} of video.images) writeFileSync(join(skill.workspace, 'public', 'story_001', file), 'png');
};

const addVideo = (skill, when = Date.now() / 1000 + 60) => {
  mkdirSync(join(skill.workspace, 'out', 'story_001'), {recursive: true});
  const mp4 = join(skill.workspace, 'out', 'story_001', 'video_story_001.mp4');
  writeFileSync(mp4, 'mp4');
  utimesSync(mp4, when, when);
  writeFileSync(join(skill.workspace, 'out', 'story_001', 'thumbnail_story_001.png'), 'png');
  writeFileSync(join(skill.workspace, 'out', 'story_001', 'facebook_caption.txt'), 'Lời khen thật lòng…\n');
};

test('summarize gives the facts a person needs to find a video again', () => {
  const {skill, video} = storySkill();
  const s = summarize(skill, 'story_001');
  assert.equal(s.title, 'Chê vì thương');
  assert.equal(s.topic, 'khen thật lòng');
  assert.equal(s.skillName, 'Kể chuyện');
  assert.equal(s.createdAt, '2026-10-15T08:00:00.000Z');
  assert.equal(s.scenes, video.scenes.length);
  assert.equal(s.voice, 'Thiện Minh');
  assert.deepEqual(s.images, {total: video.images.length, ready: 0});
  assert.equal(s.video, null);
  assert.equal(s.caption, 'Lời khen thật lòng…');
  assert.ok(s.estimateSeconds > 40);
});

test('status follows the project through its life', () => {
  const {skill, video} = storySkill();
  assert.equal(summarize(skill, 'story_001').status.code, 'missing-images');
  assert.match(summarize(skill, 'story_001').status.label, new RegExp(`Thiếu ${video.images.length} ảnh`));
  addAllImages(skill, video);
  assert.equal(summarize(skill, 'story_001').status.code, 'ready');
  addVideo(skill);
  const done = summarize(skill, 'story_001');
  assert.equal(done.status.code, 'rendered');
  assert.equal(done.video.path, 'out/story_001/video_story_001.mp4');
  assert.equal(done.thumbnail, 'out/story_001/thumbnail_story_001.png');
});

test('a script edited after the render is flagged as out of date', () => {
  const {skill, video} = storySkill();
  addAllImages(skill, video);
  addVideo(skill, Date.now() / 1000 - 3600);
  assert.equal(summarize(skill, 'story_001').status.code, 'stale');
});

test('listLibrary filters by skill and searches title and topic, newest first', () => {
  const {skill} = storySkill();
  writeFileSync(join(skill.workspace, 'videos', 'story_002.json'), JSON.stringify({...fixture('story'), id: 'story_002', title: 'Lắng nghe'}));
  const hourAgo = Date.now() / 1000 - 3600;
  utimesSync(join(skill.workspace, 'videos', 'story_001.json'), hourAgo, hourAgo);
  assert.deepEqual(listLibrary([skill]).map((s) => s.id), ['story_002', 'story_001']);
  assert.deepEqual(listLibrary([skill], {q: 'khen'}).map((s) => s.id), ['story_001']);
  assert.deepEqual(listLibrary([skill], {q: 'LẮNG'}).map((s) => s.id), ['story_002']);
});

test('duplicating a story copies its script and images under a new id, without the old timing', () => {
  const {skill, video} = storySkill();
  addAllImages(skill, video);
  writeFileSync(join(skill.workspace, 'videos', 'story_001.json'), JSON.stringify({...video, timeline: {durationSec: 50}}));
  const id = duplicateProject(skill, 'story_001');
  assert.equal(id, 'story_002');
  const copy = JSON.parse(readFileSync(join(skill.workspace, 'videos', 'story_002.json'), 'utf8'));
  assert.equal(copy.id, 'story_002');
  assert.equal('timeline' in copy, false);
  assert.equal(copy.scenes[0].voice, video.scenes[0].voice);
  assert.ok(existsSync(join(skill.workspace, 'public', 'story_002', video.images[0].file)));
  const app = JSON.parse(readFileSync(join(skill.workspace, 'videos', 'story_002.app.json'), 'utf8'));
  assert.equal(app.topic, 'khen thật lòng');
  assert.equal(app.copiedFrom, 'story_001');
});

test('archiving writes video, cover, caption and a readable script to a dated folder', () => {
  const {skill, video} = storySkill();
  addAllImages(skill, video);
  addVideo(skill);
  const library = mkdtempSync(join(tmpdir(), 'xv-thu-vien-'));
  const dir = archiveProject(skill, 'story_001', library);
  assert.equal(dir, join(library, 'ke-chuyen-video', '2026-10-15_story_001'));
  for (const f of ['video.mp4', 'anh-bia.png', 'caption.txt', 'kich-ban.json', 'kich-ban.txt', 'thong-tin.json']) assert.ok(existsSync(join(dir, f)), f);
  const script = readFileSync(join(dir, 'kich-ban.txt'), 'utf8');
  assert.match(script, /Chê vì thương/);
  assert.match(script, /Cảnh 1 · Hook/);
  assert.doesNotMatch(script, /~/);
  assert.equal(summarize(skill, 'story_001', library).archive, dir);
});

test('archiving a project without a video is refused', () => {
  const {skill} = storySkill();
  assert.throws(() => archiveProject(skill, 'story_001', mkdtempSync(join(tmpdir(), 'xv-thu-vien-'))), /chưa có video/);
});
