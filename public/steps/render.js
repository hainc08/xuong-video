// Step 6: run the skill's pipeline, follow its progress, then show and offer the files.
import {outputsOf, watchJob} from '../jobView.js';

const ICON = {done: '✓', running: '●', failed: '✗', pending: '○'};

const exists = async (url) => (await fetch(url, {method: 'HEAD'}).catch(() => null))?.ok ?? false;

export const render = async (el, {state, go, flush, api, esc, toast}) => {
  if (!state.project) return go(state.skill ? 2 : 1);
  await flush().catch(() => {});
  const out = outputsOf(state.skill, state.projectId);
  const url = (rel) => api.fileUrl(state.skill.id, rel, Date.now());
  let stop = null;

  const result = async () => {
    if (!(await exists(url(out.video)))) return '';
    return `<div class="label">Video đã dựng</div>
      <video controls src="${url(out.video)}" style="width:270px;border-radius:10px;background:#000;display:block"></video>
      <div class="row" style="margin-top:12px;gap:8px">
        <a class="btn" href="${url(out.video)}" download>⬇ Tải video</a>
        ${out.thumbnail && (await exists(url(out.thumbnail))) ? `<a class="btn ghost" href="${url(out.thumbnail)}" download>Ảnh bìa</a>` : ''}
        ${(await exists(url(out.caption))) ? `<a class="btn ghost" href="${url(out.caption)}" download>Caption</a>` : ''}
      </div>`;
  };

  const drawJob = async (job) => {
    const steps = job.steps
      .map(
        (s) => `<div class="card" style="margin-bottom:10px;${s.status === 'running' ? 'border:2px solid #d79a2b' : ''}">
          <div class="row" style="justify-content:space-between"><b style="${s.status === 'pending' ? 'color:#7a8399' : ''}">${ICON[s.status]} ${esc(s.label)}</b>
          ${s.percent !== null && s.status === 'running' ? `<span class="note">${s.percent}%</span>` : ''}</div>
          ${s.percent !== null && s.status === 'running' ? `<div class="bar" style="margin-top:8px"><i style="width:${s.percent}%"></i></div>` : ''}
        </div>`,
      )
      .join('');
    const title = {running: 'Đang tạo video…', done: 'Xong rồi!', failed: 'Chưa tạo được video'}[job.status];
    el.main.innerHTML = `<div class="row" style="align-items:flex-start;gap:24px"><div class="grow">
      <h1>${title}</h1><div class="sub">${job.status === 'running' ? 'Có thể đóng tab, video vẫn được tạo tiếp trên máy. Mở lại trang để xem tiến độ.' : esc(state.project.video.title ?? state.project.video.scenes[0]?.title ?? state.projectId)}</div>
      ${job.status === 'failed' ? `<div class="error">${esc(job.error)}</div>` : ''}
      ${steps}</div><div style="width:330px" id="result">${job.status === 'done' ? await result() : ''}</div></div>`;
    el.foot.innerHTML = job.status === 'running'
      ? '<span class="note">Đang chạy…</span>'
      : `<button class="btn ghost" id="back">← Sửa lại</button><button class="btn gold" id="again">${job.status === 'failed' ? 'Thử lại' : '▶ Tạo lại video'}</button>`;
    el.foot.querySelector('#back')?.addEventListener('click', () => go(3));
    el.foot.querySelector('#again')?.addEventListener('click', start);
  };

  const follow = (jobId) => {
    state.jobId = jobId;
    stop?.();
    stop = watchJob(jobId, (job) => {
      drawJob(job);
      if (job.status !== 'running') api.getProject(state.skill.id, state.projectId).then((p) => (state.project = p)).catch(() => {});
    });
  };

  async function start() {
    try {
      // Without a voice picked in step 5 the server keeps the project's saved voice.
      const {jobId} = await api.render(state.skill.id, state.projectId, state.voice ?? undefined);
      follow(jobId);
    } catch (e) {
      toast(e.message);
      el.main.querySelector('#status')?.replaceChildren();
    }
  }

  // Reconnect to a job that is still running for this project (page reopened mid-render).
  const running = await api.currentJob().catch(() => null);
  if (running && running.projectId === state.projectId) return follow(running.id);

  const saved = state.project.video;
  const voice = state.voice ?? (saved.tts?.voice ? saved.tts : saved.ttsVoice ? {voice: saved.ttsVoice} : state.skill.defaultVoice);
  el.main.innerHTML = `<div class="row" style="align-items:flex-start;gap:24px"><div class="grow">
    <h1>Tạo video</h1><div class="sub">${esc(state.project.video.title ?? state.project.video.scenes[0]?.title ?? state.projectId)} · ước tính ${state.project.estimateSeconds} giây · giọng ${esc(voice.voice)}</div>
    <div class="card"><div class="label">App sẽ chạy lần lượt</div>
      <div style="font-size:14px;line-height:1.9">${state.skill.kind === 'story' ? 'Tạo ảnh còn thiếu (nếu có) → Giọng đọc + phụ đề → Nhạc nền → Dựng video → Ảnh bìa → Caption' : 'Giọng đọc → Kiểm tra kịch bản → Dựng video → Caption'}</div>
      <div class="note">Thường mất 2–5 phút. Chỉ tạo được một video một lúc.</div></div>
    <div id="status"></div></div><div style="width:330px">${await result()}</div></div>`;
  el.foot.innerHTML = `<button class="btn ghost" id="back">← Giọng đọc</button><button class="btn gold" id="go">▶ Tạo video</button>`;
  el.foot.querySelector('#back').addEventListener('click', () => go(5));
  el.foot.querySelector('#go').addEventListener('click', start);
};
