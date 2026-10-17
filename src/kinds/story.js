// Adapter for ke-chuyen-video: videos/<id>.json with "scenes", "images", "hook", "tts" and a generated "timeline".
import {applyEdits, clone, estimateFromScenes} from './common.js';

export const newId = (existingIds) => {
  const max = existingIds.reduce((m, id) => Math.max(m, Number(/^story_(\d+)$/.exec(id)?.[1] ?? 0)), 0);
  return `story_${String(max + 1).padStart(3, '0')}`;
};

export const editableScenes = (video) =>
  video.scenes.map((s, index) => ({index, name: s.name, voice: s.voice, keywords: s.keywords ?? []}));

export const applyScriptEdits = (video, edits, hookLines) => {
  const v = applyEdits(video, edits);
  if (hookLines) v.hook = {...v.hook, lines: hookLines};
  return v;
};

export const resetGenerated = (video) => {
  const v = clone(video);
  delete v.timeline;
  return v;
};

export const applyVoice = (video, {engine, voice, speed, rate}) => ({
  ...clone(video),
  tts: engine === 'cit' ? {engine, voice, speed} : {engine, voice, rate},
});

export const estimateSeconds = (video, wordsPerMinute) => estimateFromScenes(video.scenes, wordsPerMinute);

export const outputs = (id) => ({
  video: `out/${id}/video_${id}.mp4`,
  thumbnail: `out/${id}/thumbnail_${id}.png`,
  caption: `out/${id}/facebook_caption.txt`,
});
