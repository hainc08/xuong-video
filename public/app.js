// Wizard shell: holds the state, draws the step bar and hands #main/#foot to the current step module.
import * as api from './api.js';

const LABELS = ['Chọn skill', 'Chủ đề', 'Kịch bản', null, 'Giọng đọc', 'Tạo video'];
const MODULES = {1: 'skill', 2: 'topic', 3: 'script', 5: 'voice', 6: 'render'};
const SAVED = 'xuong-video:last';

export const state = {skills: [], skill: null, projectId: null, project: null, voice: null, jobId: null, step: 1, topic: '', options: {}};

const el = {steps: document.getElementById('steps'), main: document.getElementById('main'), foot: document.getElementById('foot'), toast: document.getElementById('toast')};

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);

let toastTimer;
export const toast = (msg) => {
  el.toast.textContent = msg;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2500);
};

const remember = () => {
  try {
    localStorage.setItem(SAVED, JSON.stringify({skillId: state.skill?.id, projectId: state.projectId, step: state.step, jobId: state.jobId}));
  } catch {
    // private mode: the wizard still works, it just will not reopen where it was
  }
};

const step4Label = () => (state.skill?.step4 === 'layouts' ? 'Bố cục' : state.skill ? 'Ảnh' : 'Ảnh / Bố cục');

// The furthest step the user may jump to from the bar.
const reachable = () => (state.projectId ? 6 : state.skill ? 2 : 1);

const drawSteps = () => {
  el.steps.innerHTML = LABELS.map((label, i) => {
    const n = i + 1;
    const cls = n === state.step ? 'on' : n <= reachable() ? 'done' : '';
    return `<button class="step ${cls}" data-step="${n}" ${n <= reachable() && n !== state.step ? '' : 'disabled'}><b>${n}</b>${esc(label ?? step4Label())}</button>`;
  }).join('');
};

el.steps.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-step]');
  if (btn && !btn.disabled) go(Number(btn.dataset.step));
});
document.getElementById('home').addEventListener('click', () => go(1));

let saveTimer;
let savePending = null;
// Save the script 800 ms after the last edit; resolves with the fresh project view.
export const save = (video, caption) =>
  new Promise((resolve, reject) => {
    clearTimeout(saveTimer);
    savePending = {video, caption, resolve, reject};
    saveTimer = setTimeout(flush, 800);
  });

export const flush = async () => {
  clearTimeout(saveTimer);
  const job = savePending;
  savePending = null;
  if (!job) return state.project;
  try {
    state.project = await api.saveProject(state.skill.id, state.projectId, job.video, job.caption);
    job.resolve(state.project);
    return state.project;
  } catch (e) {
    toast(e.message);
    job.reject(e);
    throw e;
  }
};

export const openProject = async (skillId, id, step = 3) => {
  state.skill = state.skills.find((s) => s.id === skillId) ?? null;
  state.projectId = id;
  state.project = await api.getProject(skillId, id);
  await go(step);
};

export const go = async (step) => {
  await flush().catch(() => {});
  state.step = step;
  remember();
  drawSteps();
  el.main.innerHTML = '';
  el.foot.innerHTML = '';
  const name = step === 4 ? (state.skill?.step4 === 'layouts' ? 'layouts' : 'images') : MODULES[step];
  const mod = await import(`./steps/${name}.js`);
  await mod.render(el, {state, go, save, flush, api, toast, esc, openProject});
  window.scrollTo(0, 0);
};

const boot = async () => {
  state.skills = await api.skills();
  let last = null;
  try {
    last = JSON.parse(localStorage.getItem(SAVED) ?? 'null');
  } catch {
    last = null;
  }
  // A link like #ke-chuyen-video/story_004/3 opens that project at that step.
  const [linkSkill, linkId, linkStep] = decodeURIComponent(location.hash.slice(1)).split('/');
  if (linkSkill && linkId) return openProject(linkSkill, linkId, Number(linkStep) || 3);
  const running = await api.currentJob().catch(() => null);
  if (running) {
    state.jobId = running.id;
    return openProject(running.skillId, running.projectId, 6);
  }
  if (last?.skillId && last?.projectId) {
    try {
      state.jobId = last.jobId ?? null;
      return await openProject(last.skillId, last.projectId, Math.max(3, last.step ?? 3));
    } catch {
      // the project was deleted: start over
    }
  }
  return go(1);
};

boot().catch((e) => (el.main.innerHTML = `<div class="error">Không mở được app: ${esc(e.message)}</div>`));
