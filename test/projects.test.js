import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {listProjects, readProject, writeProject, createProject} from '../src/projects.js';

const tempSkill = (kind = 'story') => {
  const workspace = mkdtempSync(join(tmpdir(), 'xv-ws-'));
  mkdirSync(join(workspace, 'videos'));
  return {id: 'test', kind, workspace};
};

test('listProjects skips samples and app metadata files', () => {
  const skill = tempSkill();
  writeFileSync(join(skill.workspace, 'videos', '_sample.json'), '{}');
  writeFileSync(join(skill.workspace, 'videos', 'story_003.json'), JSON.stringify({title: 'Một', scenes: []}));
  writeFileSync(join(skill.workspace, 'videos', 'story_003.app.json'), '{}');
  const list = listProjects(skill);
  assert.deepEqual(list.map((p) => p.id), ['story_003']);
  assert.equal(list[0].title, 'Một');
  assert.equal(list[0].hasVideo, false);
});

test('write then read keeps Vietnamese text and app metadata', () => {
  const skill = tempSkill();
  writeProject(skill, 'story_001', {title: 'Chê vì thương', scenes: [{voice: 'Lời đọc có dấu'}]}, {topic: 'khen'});
  const {video, app} = readProject(skill, 'story_001');
  assert.equal(video.title, 'Chê vì thương');
  assert.equal(video.scenes[0].voice, 'Lời đọc có dấu');
  assert.equal(app.topic, 'khen');
});

test('readProject of a project without app metadata returns an empty app object', () => {
  const skill = tempSkill();
  writeFileSync(join(skill.workspace, 'videos', 'story_002.json'), JSON.stringify({scenes: []}));
  assert.deepEqual(readProject(skill, 'story_002').app, {});
});

test('createProject allocates the next id for the skill kind', () => {
  const skill = tempSkill();
  writeFileSync(join(skill.workspace, 'videos', 'story_004.json'), '{}');
  assert.equal(createProject(skill, 'chủ đề'), 'story_005');
  assert.equal(createProject(tempSkill('office'), 'Mẹo Excel'), 'meo-excel');
});

test('readProject rejects ids that are not plain names', () => {
  assert.throws(() => readProject(tempSkill(), '../x'), /Đường dẫn không hợp lệ|không hợp lệ/);
});
