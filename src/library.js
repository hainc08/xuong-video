// The video library: what each project is, where it stands, and a copy of finished videos in a folder
// outside the workspaces (on drive D by default) so they can be found again without the app.
import {copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {kindOf} from './kinds/index.js';
import {createProject, listProjects, readProject, writeProject} from './projects.js';

const IMAGE_FILE = /\.(png|jpe?g)$/i;

const fold = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase();

const voiceName = (skill, video) => (skill.kind === 'story' ? video.tts?.voice : video.ttsVoice) ?? null;

// Seconds of the last render's narration, when the voice has been generated.
const renderedSeconds = (skill, video) => {
  if (skill.kind === 'story') return video.timeline?.durationSec ?? null;
  const scenes = video.scenes ?? [];
  return scenes.length && scenes.every((s) => s.audio) ? Math.round(scenes.reduce((n, s) => n + s.durationSec, 0) * 10) / 10 : null;
};

const imagesOf = (skill, id, video) => {
  if (skill.kind !== 'story') return null;
  const dir = join(skill.workspace, 'public', id);
  const files = (video.images ?? []).map((i) => i.file);
  return {total: files.length, ready: files.filter((f) => existsSync(join(dir, f))).length};
};

const createdDay = (createdAt) => String(createdAt).slice(0, 10);

const archiveDir = (skill, id, app, libraryDir) => join(libraryDir, skill.id, `${createdDay(app.createdAt)}_${id}`);

const createdAtOf = (skill, id, app) => app.createdAt ?? statSync(join(skill.workspace, 'videos', `${id}.json`)).birthtime.toISOString();

const statusOf = (skill, images, video, scriptMtime) => {
  if (video) {
    // A save after the render (2 s slack for the files the render itself writes) means the video is behind the script.
    return scriptMtime > video.mtime + 2000
      ? {code: 'stale', label: 'Kịch bản đã sửa sau lần dựng'}
      : {code: 'rendered', label: 'Đã có video'};
  }
  if (images && images.ready < images.total) return {code: 'missing-images', label: `Thiếu ${images.total - images.ready} ảnh`};
  return {code: 'ready', label: 'Chưa dựng video'};
};

export const summarize = (skill, id, libraryDir = null) => {
  const {video, app} = readProject(skill, id);
  const kind = kindOf(skill);
  const out = kind.outputs(id);
  const scriptMtime = statSync(join(skill.workspace, 'videos', `${id}.json`)).mtimeMs;
  const mp4 = join(skill.workspace, out.video);
  const rendered = existsSync(mp4) ? statSync(mp4) : null;
  const images = imagesOf(skill, id, video);
  const firstImage = (video.images ?? []).map((i) => i.file).find((f) => existsSync(join(skill.workspace, 'public', id, f)));
  const createdAt = createdAtOf(skill, id, {...app});
  const archive = libraryDir ? archiveDir(skill, id, {createdAt}, libraryDir) : null;
  const videoInfo = rendered ? {path: out.video, sizeMB: Math.round((rendered.size / 1048576) * 10) / 10, renderedAt: rendered.mtime.toISOString(), mtime: rendered.mtimeMs} : null;
  return {
    skillId: skill.id,
    skillName: skill.name,
    kind: skill.kind,
    id,
    title: video.title ?? video.scenes?.[0]?.title ?? id,
    topic: app.topic ?? '',
    createdAt,
    updatedAt: new Date(scriptMtime).toISOString(),
    scenes: video.scenes?.length ?? 0,
    estimateSeconds: kind.estimateSeconds(video, skill.wordsPerMinute ?? 170),
    durationSec: renderedSeconds(skill, video),
    voice: voiceName(skill, video),
    images,
    video: videoInfo && {path: videoInfo.path, sizeMB: videoInfo.sizeMB, renderedAt: videoInfo.renderedAt},
    thumbnail: out.thumbnail && existsSync(join(skill.workspace, out.thumbnail)) ? out.thumbnail : firstImage ? `public/${id}/${firstImage}` : null,
    caption: (app.caption ?? '').trim().slice(0, 300),
    copiedFrom: app.copiedFrom ?? null,
    status: statusOf(skill, images, videoInfo, scriptMtime),
    archive: archive && existsSync(archive) ? archive : null,
  };
};

export const listLibrary = (skills, {q = '', libraryDir = null} = {}) => {
  const needle = fold(q.trim());
  return skills
    .filter((s) => s.available !== false)
    .flatMap((skill) => listProjects(skill).map(({id}) => summarize(skill, id, libraryDir)))
    .filter((s) => !needle || fold(`${s.title} ${s.topic} ${s.id}`).includes(needle))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
};

// Reuse: a new project with the same script, topic and pictures, ready to edit and render again.
export const duplicateProject = (skill, id) => {
  const {video, app} = readProject(skill, id);
  const kind = kindOf(skill);
  const newId = createProject(skill, app.topic || video.title || id);
  const copy = kind.resetGenerated(video);
  if (skill.kind === 'story') copy.id = newId;
  const from = join(skill.workspace, 'public', id);
  const to = join(skill.workspace, 'public', newId);
  if (existsSync(from)) {
    mkdirSync(to, {recursive: true});
    for (const f of readdirSync(from)) if (IMAGE_FILE.test(f) && statSync(join(from, f)).isFile()) copyFileSync(join(from, f), join(to, f));
  }
  for (const s of copy.scenes ?? []) if (typeof s.image === 'string' && s.image.startsWith(`${id}/`)) s.image = `${newId}/${s.image.slice(id.length + 1)}`;
  writeProject(skill, newId, copy, {...app, createdAt: new Date().toISOString(), copiedFrom: id});
  return newId;
};

const readableScript = (skill, id, video, app) => {
  const clean = (t) => String(t ?? '').replace(/~/g, ' ').replace(/\s*\|\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const lines = [
    video.title ?? video.scenes?.[0]?.title ?? id,
    `Skill: ${skill.name ?? skill.id} · Mã: ${id}`,
    app.topic ? `Chủ đề: ${app.topic}` : null,
    `Ngày tạo: ${createdDay(app.createdAt)}`,
    voiceName(skill, video) ? `Giọng: ${voiceName(skill, video)}` : null,
    video.hook?.lines ? `Chữ đầu video: ${video.hook.lines.join(' / ')}` : null,
    '',
    ...(video.scenes ?? []).flatMap((s, i) => [`Cảnh ${i + 1} · ${s.name ?? s.type}`, clean(s.voice), '']),
    app.caption ? `--- Caption ---\n${app.caption.trim()}` : null,
  ];
  return lines.filter((l) => l !== null).join('\n') + '\n';
};

export const archiveProject = (skill, id, libraryDir) => {
  const {video, app} = readProject(skill, id);
  const out = kindOf(skill).outputs(id);
  const mp4 = join(skill.workspace, out.video);
  if (!existsSync(mp4)) throw new Error('Dự án này chưa có video để lưu vào thư viện.');
  const meta = {...app, createdAt: createdAtOf(skill, id, app)};
  const dir = archiveDir(skill, id, meta, libraryDir);
  mkdirSync(dir, {recursive: true});
  copyFileSync(mp4, join(dir, 'video.mp4'));
  if (out.thumbnail && existsSync(join(skill.workspace, out.thumbnail))) copyFileSync(join(skill.workspace, out.thumbnail), join(dir, 'anh-bia.png'));
  writeFileSync(join(dir, 'caption.txt'), (app.caption ?? '').trim() + '\n', 'utf8');
  writeFileSync(join(dir, 'kich-ban.json'), JSON.stringify(video, null, 2) + '\n', 'utf8');
  writeFileSync(join(dir, 'kich-ban.txt'), readableScript(skill, id, video, meta), 'utf8');
  const s = summarize(skill, id);
  writeFileSync(join(dir, 'thong-tin.json'), JSON.stringify({...s, archive: dir, workspace: skill.workspace}, null, 2) + '\n', 'utf8');
  return dir;
};
