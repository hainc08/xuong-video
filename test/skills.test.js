import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadSkills, getSkill} from '../src/skills.js';
import {createApp} from '../server.js';

test('loadSkills reads the two configured skills with their settings', () => {
  const skills = loadSkills();
  assert.deepEqual(skills.map((s) => s.id), ['ke-chuyen-video', 'ai-van-phong-video']);
  const story = skills[0];
  assert.equal(story.kind, 'story');
  assert.equal(story.step4, 'images');
  assert.equal(story.wordsPerMinute, 188);
  assert.deepEqual(story.defaultVoice, {engine: 'cit', voice: 'Thiện Minh', speed: 0.8});
  assert.equal(skills[1].step4, 'layouts');
});

test('getSkill throws for an unknown id', () => {
  assert.throws(() => getSkill('khong-co'), /Không có skill khong-co/);
});

test('a skill whose workspace is missing is marked unavailable instead of throwing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'xv-'));
  const file = join(dir, 'skills.json');
  writeFileSync(file, JSON.stringify([{id: 'x', name: 'X', kind: 'story', workspace: join(dir, 'missing'), skillDir: dir, wordsPerMinute: 1, defaultVoice: {}, step4: 'images', sampleImage: null}]));
  const [x] = loadSkills(file);
  assert.equal(x.available, false);
});

test('GET /api/skills lists skills without local paths', async () => {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/skills`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.length, 2);
    assert.equal(body[0].name, 'Kể chuyện');
    assert.equal('workspace' in body[0], false);
    assert.equal('skillDir' in body[0], false);
  } finally {
    server.close();
  }
});
