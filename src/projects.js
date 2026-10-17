// A project is the skill's own videos/<id>.json; app-only data sits beside it in videos/<id>.app.json.
import {existsSync, readdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {kindOf} from './kinds/index.js';
import {assertPlainName} from './safePath.js';

const videosDir = (skill) => join(skill.workspace, 'videos');
const videoFile = (skill, id) => join(videosDir(skill), `${assertPlainName(id)}.json`);
const appFile = (skill, id) => join(videosDir(skill), `${assertPlainName(id)}.app.json`);
const readJson = (file, fallback) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback);
const writeJson = (file, data) => writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');

const projectIds = (skill) =>
  existsSync(videosDir(skill))
    ? readdirSync(videosDir(skill))
        .filter((f) => f.endsWith('.json') && !f.endsWith('.app.json') && !f.startsWith('_'))
        .map((f) => f.slice(0, -5))
    : [];

export const listProjects = (skill) =>
  projectIds(skill)
    .map((id) => {
      const file = videoFile(skill, id);
      const video = readJson(file, {});
      return {
        skillId: skill.id,
        id,
        title: video.title ?? video.scenes?.[0]?.title ?? id,
        updatedAt: statSync(file).mtimeMs,
        hasVideo: existsSync(join(skill.workspace, kindOf(skill).outputs(id).video)),
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);

export const readProject = (skill, id) => {
  const file = videoFile(skill, id);
  if (!existsSync(file)) throw new Error(`Không có dự án ${id}`);
  return {video: readJson(file), app: readJson(appFile(skill, id), {})};
};

export const writeProject = (skill, id, video, app) => {
  writeJson(videoFile(skill, id), video);
  if (app) writeJson(appFile(skill, id), app);
};

export const createProject = (skill, topic) => kindOf(skill).newId(projectIds(skill), topic);
