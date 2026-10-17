// Thin wrappers over the server API. Non-2xx responses throw Error(body.error).
const request = async (method, path, body) => {
  const res = await fetch(path, {method, headers: body ? {'Content-Type': 'application/json'} : {}, body: body ? JSON.stringify(body) : undefined});
  const type = res.headers.get('content-type') ?? '';
  const data = type.includes('json') ? await res.json() : await res.blob();
  if (!res.ok) throw new Error(data?.error ?? `Lỗi ${res.status}`);
  return data;
};

const p = (skillId, id) => `/api/projects/${encodeURIComponent(skillId)}/${encodeURIComponent(id)}`;

export const skills = () => request('GET', '/api/skills');
export const projects = () => request('GET', '/api/projects');
export const createProject = (skillId, topic, options) => request('POST', '/api/projects', {skillId, topic, options});
export const getProject = (skillId, id) => request('GET', p(skillId, id));
export const saveProject = (skillId, id, video, caption) => request('PUT', p(skillId, id), {video, caption});
export const rewriteScene = (skillId, id, index, instruction) => request('POST', `${p(skillId, id)}/rewrite-scene`, {index, instruction});
export const uploadImage = (skillId, id, file, dataUrl, scene) =>
  request('POST', `${p(skillId, id)}/images/${encodeURIComponent(file)}${scene === undefined ? '' : `?scene=${scene}`}`, {dataUrl});
export const generateImages = (skillId, id, file) => request('POST', `${p(skillId, id)}/images/generate`, file ? {file} : {});
export const imagePrompt = (skillId, id) => request('GET', `${p(skillId, id)}/image-prompt`);
export const voices = () => request('GET', '/api/voices');
export const previewVoice = (voice, text) => request('POST', '/api/voices/preview', {...voice, text});
export const render = (skillId, id, voice) => request('POST', `${p(skillId, id)}/render`, {voice});
export const job = (jobId) => request('GET', `/api/jobs/${encodeURIComponent(jobId)}`);
export const currentJob = () => request('GET', '/api/jobs/current');

export const fileUrl = (skillId, rel, bust) => `/files/${encodeURIComponent(skillId)}/${rel}${bust ? `?t=${Math.round(bust)}` : ''}`;
