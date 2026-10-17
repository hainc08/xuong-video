// Step 4 (story skills): one card per background image: upload, AI-generate, edit the description.
import {watchJob} from '../jobView.js';

const SOURCE = {upload: '<span class="pill up">Ảnh tải lên</span>', ai: '<span class="pill ai">AI tạo</span>', none: '<span class="pill">Trống</span>'};

const readFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Không đọc được file ảnh'));
    reader.readAsDataURL(file);
  });

export const render = async (el, {state, go, save, flush, api, esc, toast}) => {
  if (!state.project) return go(state.skill ? 2 : 1);
  let busy = false;

  const draw = (message = '') => {
    const {images} = state.project;
    const missing = images.filter((i) => !i.exists).length;
    el.main.innerHTML = `<div class="row" style="justify-content:space-between;align-items:flex-end">
        <div><h1>Ảnh cho từng cảnh</h1><div class="sub">Tải ảnh của bạn lên, hoặc để AI tạo theo mô tả. Ảnh AI giữ cùng một khuôn mặt nhân vật. Ảnh tải lên được cắt về khung dọc 9:16.</div></div>
        <div style="text-align:right"><button class="btn" id="all" ${busy || !missing ? 'disabled' : ''}>✨ Tạo tất cả ảnh còn thiếu (${missing})</button>
        <div class="note" style="margin-top:4px">Gói Cloudflare miễn phí đủ khoảng 10 ảnh mỗi ngày</div></div>
      </div>
      <div id="msg">${message}</div>
      <div class="grid">${images
        .map(
          (img, i) => `<div class="card" style="padding:8px" data-i="${i}">
            <div class="label">${esc(img.file.replace(/\.\w+$/, ''))}</div>
            ${img.exists ? `<img class="thumb" src="${api.fileUrl(state.skill.id, `public/${state.projectId}/${img.file}`, img.mtime)}" alt="">` : '<div class="thumb" style="display:flex;align-items:center;justify-content:center;color:#7a8399;font-size:12px;border:2px dashed #b7c0d1;background:#f6f8fb">chưa có ảnh</div>'}
            <div style="margin-top:6px">${SOURCE[img.source] ?? SOURCE.none}</div>
            <textarea class="field prompt" rows="3" style="font-size:12px;margin:6px 0;padding:6px">${esc(img.prompt)}</textarea>
            <div style="display:flex;gap:4px"><button class="btn ghost small up" ${busy ? 'disabled' : ''}>⬆ Tải</button><button class="btn ghost small ai" ${busy ? 'disabled' : ''}>✨ ${img.exists ? 'Tạo lại' : 'AI'}</button></div>
            <input type="file" accept="image/png,image/jpeg" hidden>
          </div>`,
        )
        .join('')}</div>`;
    el.main.querySelector('#all').addEventListener('click', () => generate());
  };

  const refresh = async (message) => {
    state.project = await api.getProject(state.skill.id, state.projectId);
    draw(message);
  };

  const generate = async (file) => {
    await flush().catch(() => {});
    try {
      const {jobId} = await api.generateImages(state.skill.id, state.projectId, file);
      busy = true;
      draw(`<div class="info"><span class="spinner"></span> AI đang tạo ${file ? `ảnh ${esc(file)}` : 'các ảnh còn thiếu'}… (khoảng 10–60 giây)</div>`);
      watchJob(jobId, (job) => {
        if (job.status === 'running') return;
        busy = false;
        refresh(job.status === 'done' ? '<div class="info">Đã tạo xong ảnh.</div>' : `<div class="error">${esc(job.error)}</div>`).catch((e) => toast(e.message));
      });
    } catch (e) {
      draw(`<div class="error">${esc(e.message)}</div>`);
    }
  };

  el.main.addEventListener('click', (e) => {
    const card = e.target.closest('[data-i]');
    if (!card || busy) return;
    const img = state.project.images[Number(card.dataset.i)];
    if (e.target.closest('.up')) card.querySelector('input[type=file]').click();
    if (e.target.closest('.ai')) generate(img.file);
  });

  el.main.addEventListener('change', async (e) => {
    if (e.target.type !== 'file' || !e.target.files[0]) return;
    const img = state.project.images[Number(e.target.closest('[data-i]').dataset.i)];
    try {
      const dataUrl = await readFile(e.target.files[0]);
      draw(`<div class="info"><span class="spinner"></span> Đang tải ${esc(img.file)}…</div>`);
      state.project = await api.uploadImage(state.skill.id, state.projectId, img.file, dataUrl);
      draw('<div class="info">Đã tải ảnh lên.</div>');
    } catch (err) {
      draw(`<div class="error">${esc(err.message)}</div>`);
    }
  });

  el.main.addEventListener('input', (e) => {
    if (!e.target.classList.contains('prompt')) return;
    const i = Number(e.target.closest('[data-i]').dataset.i);
    const video = state.project.video;
    const entry = video.images.find((x) => x.file === state.project.images[i].file);
    if (entry) entry.prompt = e.target.value;
    state.project.images[i].prompt = e.target.value;
    save(video).catch(() => {});
  });

  draw();
  el.foot.innerHTML = '<button class="btn ghost" id="back">← Kịch bản</button><button class="btn gold" id="next">Tiếp: giọng đọc →</button>';
  el.foot.querySelector('#back').addEventListener('click', () => go(3));
  el.foot.querySelector('#next').addEventListener('click', () => go(5));
};
