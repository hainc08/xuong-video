// Adapter for ai-van-phong-video: videos/<slug>.json with typed "scenes" and root tts* fields.
import {applyEdits, clone, estimateFromScenes, slugify} from './common.js';

const DEFAULT_DURATION = {hook: 3, cta: 4, text: 5, tip: 6};

export const SCENE_TYPES = ['hook', 'stats', 'compare', 'bullets', 'steps', 'code', 'bignumber', 'statement', 'image', 'tip', 'text', 'cta'];

export const newId = (existingIds, topic) => {
  const base = slugify(topic);
  if (!existingIds.includes(base)) return base;
  let n = 2;
  while (existingIds.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
};

export const editableScenes = (video) =>
  video.scenes.map((s, index) => ({index, name: s.type, voice: s.voice ?? '', keywords: s.keywords ?? []}));

export const applyScriptEdits = (video, edits) => applyEdits(video, edits);

export const resetGenerated = (video) => {
  const v = clone(video);
  for (const s of v.scenes) {
    delete s.audio;
    delete s.audioSec;
    delete s.words;
    s.durationSec = DEFAULT_DURATION[s.type] ?? 6;
  }
  return v;
};

// The server owns voice timing: take it from the stored file, never from what the browser sends back.
export const keepGenerated = (incoming, stored) => {
  const v = clone(incoming);
  v.scenes.forEach((s, i) => {
    const old = stored.scenes?.[i] ?? {};
    for (const key of ['audio', 'audioSec', 'words', 'durationSec']) {
      if (key in old) s[key] = old[key];
      else delete s[key];
    }
  });
  return v;
};

export const savedVoice = (video) =>
  video.ttsVoice ? {engine: video.ttsEngine ?? 'edge', voice: video.ttsVoice, speed: video.ttsSpeed, rate: video.ttsRate} : null;

export const applyVoice = (video, {engine, voice, speed, rate}) => {
  const v = clone(video);
  v.ttsEngine = engine;
  v.ttsVoice = voice;
  if (engine === 'cit') {
    v.ttsSpeed = speed;
    delete v.ttsRate;
  } else {
    v.ttsRate = rate;
    delete v.ttsSpeed;
  }
  return v;
};

export const estimateSeconds = (video, wordsPerMinute) => estimateFromScenes(video.scenes, wordsPerMinute);

export const outputs = (id) => ({video: `out/${id}.mp4`, thumbnail: null, caption: `out/${id}.txt`});
