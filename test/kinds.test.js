import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as story from '../src/kinds/story.js';
import * as office from '../src/kinds/office.js';
import {kindOf} from '../src/kinds/index.js';
import {resolveInside} from '../src/safePath.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));

test('story ids count up from the highest existing story number', () => {
  assert.equal(story.newId(['story_001', 'story_003'], 'x'), 'story_004');
  assert.equal(story.newId([], 'x'), 'story_001');
});

test('office ids are a diacritic-free slug of the topic, suffixed when taken', () => {
  assert.equal(office.newId([], 'Claude trong Excel, Word!'), 'claude-trong-excel-word');
  assert.equal(office.newId([], 'Mẹo đọc tài liệu dài'), 'meo-doc-tai-lieu-dai');
  assert.equal(office.newId(['claude-trong-excel-word'], 'Claude trong Excel, Word!'), 'claude-trong-excel-word-2');
});

test('editableScenes exposes index, name, voice and keywords', () => {
  const [first] = story.editableScenes(fixture('story'));
  assert.deepEqual(Object.keys(first).sort(), ['index', 'keywords', 'name', 'voice']);
  assert.equal(first.name, 'Hook');
  assert.equal(office.editableScenes(fixture('office'))[0].name, 'stats');
});

test('applyScriptEdits changes only the edited scene', () => {
  const v = story.applyScriptEdits(fixture('story'), [{index: 1, voice: 'Lời mới.', keywords: ['mới']}]);
  assert.equal(v.scenes[1].voice, 'Lời mới.');
  assert.deepEqual(v.scenes[1].keywords, ['mới']);
  assert.equal(v.scenes[0].voice, fixture('story').scenes[0].voice);
});

test('story resetGenerated drops the timeline', () => {
  const v = story.resetGenerated({...fixture('story'), timeline: {durationSec: 50}});
  assert.equal('timeline' in v, false);
});

test('office resetGenerated drops audio fields and restores default durations', () => {
  const v = fixture('office');
  v.scenes[1] = {...v.scenes[1], audio: 'x/01.wav', audioSec: 8.4, words: [{t: 0, d: 1, w: 'a'}], durationSec: 9.12};
  v.scenes[0].durationSec = 7.7;
  const r = office.resetGenerated(v);
  assert.equal('audio' in r.scenes[1], false);
  assert.equal('audioSec' in r.scenes[1], false);
  assert.equal('words' in r.scenes[1], false);
  assert.equal(r.scenes[1].durationSec, 6);
  assert.equal(r.scenes.at(-1).durationSec, 4); // cta
});

test('applyVoice writes each skill its own way', () => {
  const s = story.applyVoice(fixture('story'), {engine: 'cit', voice: 'Thanh Bình', speed: 0.85});
  assert.deepEqual(s.tts, {engine: 'cit', voice: 'Thanh Bình', speed: 0.85});
  const o = office.applyVoice(fixture('office'), {engine: 'edge', voice: 'vi-VN-NamMinhNeural', rate: '+5%'});
  assert.equal(o.ttsEngine, 'edge');
  assert.equal(o.ttsVoice, 'vi-VN-NamMinhNeural');
  assert.equal(o.ttsRate, '+5%');
  const c = office.applyVoice(fixture('office'), {engine: 'cit', voice: 'Minh Đức', speed: 0.9});
  assert.equal(c.ttsSpeed, 0.9);
});

test('estimateSeconds of the story sample is about a minute', () => {
  const sec = story.estimateSeconds(fixture('story'), 188);
  assert.ok(sec >= 52 && sec <= 62, `got ${sec}`);
});

test('outputs name the files each pipeline writes', () => {
  assert.deepEqual(story.outputs('story_009'), {
    video: 'out/story_009/video_story_009.mp4',
    thumbnail: 'out/story_009/thumbnail_story_009.png',
    caption: 'out/story_009/facebook_caption.txt',
  });
  assert.deepEqual(office.outputs('meo-a'), {video: 'out/meo-a.mp4', thumbnail: null, caption: 'out/meo-a.txt'});
});

test('kindOf maps a skill to its adapter', () => {
  assert.equal(kindOf({kind: 'story'}), story);
  assert.equal(kindOf({kind: 'office'}), office);
});

test('resolveInside rejects paths that leave the root', () => {
  assert.throws(() => resolveInside('D:\\ws', '../.env'), /Đường dẫn không hợp lệ/);
  assert.throws(() => resolveInside('D:\\ws', 'C:\\Windows\\x'), /Đường dẫn không hợp lệ/);
  assert.throws(() => resolveInside('D:\\ws', '/etc/passwd'), /Đường dẫn không hợp lệ/);
  assert.match(resolveInside('D:\\ws', 'public/a.png'), /public[\\/]a\.png$/);
});
