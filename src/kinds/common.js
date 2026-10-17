// Helpers shared by the kind adapters.

export const clone = (v) => structuredClone(v);

// Words actually spoken: the skills' subtitle markers ~ and | are not read aloud.
export const spokenWords = (text = '') =>
  text.replace(/~/g, ' ').replace(/\|/g, ' ').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

export const estimateFromScenes = (scenes, wordsPerMinute) => {
  const words = scenes.reduce((n, s) => n + spokenWords(s.voice), 0);
  return Math.round((words / wordsPerMinute) * 60 + 0.7 * scenes.length);
};

export const applyEdits = (video, edits = []) => {
  const v = clone(video);
  for (const {index, voice, keywords} of edits) {
    const scene = v.scenes[index];
    if (!scene) continue;
    if (voice !== undefined) scene.voice = voice;
    if (keywords !== undefined) scene.keywords = keywords;
  }
  return v;
};

export const slugify = (text) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '') || 'video';
