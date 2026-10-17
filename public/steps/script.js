// Step 3: edit the script scene by scene; saved automatically.
const HOOK_MAX = 18;

const sceneName = (scene, kind) => (kind === 'story' ? scene.name : scene.type);

export const render = async (el, {state, go, save, api, esc, toast}) => {
  if (!state.project) return go(state.skill ? 2 : 1);
  const kind = state.skill.kind;
  const video = state.project.video;

  const draw = () => {
    el.main.innerHTML = `<div class="row" style="align-items:flex-start;gap:18px">
      <div class="grow">
        <h1>Kịch bản · ${esc(video.title ?? state.projectId)}</h1>
        <div class="sub">Sửa thẳng vào từng cảnh, app tự lưu. Từ khóa được tô màu trên phụ đề và phải có nguyên văn trong lời đọc.${kind === 'story' ? ' Dấu ~ nối từ ghép, dấu | ép xuống dòng phụ đề.' : ''}</div>
        <div id="scenes">${video.scenes
          .map(
            (s, i) => `<div class="card scene" data-i="${i}">
              <div class="head"><div class="label">Cảnh ${i + 1}</div><b style="font-size:14px">${esc(sceneName(s, kind))}</b></div>
              <div class="grow">
                <textarea class="field voice" rows="3">${esc(s.voice ?? '')}</textarea>
                <input class="field keywords" style="margin-top:6px;font-size:13px" placeholder="Từ khóa, cách nhau bằng dấu phẩy" value="${esc((s.keywords ?? []).join(', '))}">
              </div>
              <div style="width:90px;text-align:right"><button class="btn ghost small rewrite">↻ Viết lại</button></div>
            </div>`,
          )
          .join('')}</div>
      </div>
      <div style="width:270px;position:sticky;top:12px">
        <div class="card" style="margin-bottom:12px"><div class="label">Ước tính</div><div style="font-size:26px;font-weight:700" id="estimate">${state.project.estimateSeconds} giây</div><div class="note">${state.skill.kind === 'story' ? 'Mục tiêu 55–70 giây' : 'Mục tiêu 60–70 giây'}</div></div>
        ${
          kind === 'story'
            ? `<div class="card" style="margin-bottom:12px"><div class="label">Chữ to đầu video</div>
              ${(video.hook?.lines ?? ['', '']).map((l, i) => `<input class="field hook" data-line="${i}" style="margin-bottom:6px" value="${esc(l)}"><div class="note count" data-count="${i}"></div>`).join('')}
              <div class="note">Tối đa ${HOOK_MAX} ký tự mỗi dòng</div></div>`
            : ''
        }
        <div class="card"><div class="label">Caption</div><textarea class="field" id="caption" rows="6" style="font-size:13px">${esc(state.project.app.caption ?? '')}</textarea></div>
      </div></div>`;
    updateCounts();
  };

  const updateCounts = () => {
    el.main.querySelectorAll('.hook').forEach((input) => {
      const n = [...input.value].length;
      const out = el.main.querySelector(`[data-count="${input.dataset.line}"]`);
      out.textContent = `${n}/${HOOK_MAX} ký tự`;
      out.className = `note count ${n > HOOK_MAX ? 'over' : ''}`;
    });
  };

  const persist = async () => {
    const caption = el.main.querySelector('#caption').value;
    try {
      const view = await save(video, caption);
      el.main.querySelector('#estimate').textContent = `${view.estimateSeconds} giây`;
    } catch {
      // save() already showed the error
    }
  };

  draw();

  el.main.addEventListener('input', (e) => {
    const card = e.target.closest('[data-i]');
    if (card) {
      const scene = video.scenes[Number(card.dataset.i)];
      if (e.target.classList.contains('voice')) scene.voice = e.target.value;
      if (e.target.classList.contains('keywords')) scene.keywords = e.target.value.split(',').map((k) => k.trim()).filter(Boolean);
    }
    if (e.target.classList.contains('hook')) {
      video.hook = {...video.hook, lines: [...el.main.querySelectorAll('.hook')].map((i) => i.value)};
      updateCounts();
    }
    persist();
  });

  el.main.addEventListener('click', async (e) => {
    const btn = e.target.closest('.rewrite');
    if (!btn) return;
    const i = Number(btn.closest('[data-i]').dataset.i);
    const instruction = prompt('Muốn cảnh này khác đi thế nào? (để trống cũng được)', '') ?? null;
    if (instruction === null) return;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    try {
      const {scene} = await api.rewriteScene(state.skill.id, state.projectId, i, instruction);
      video.scenes[i] = scene;
      draw();
      persist();
      toast(`Đã viết lại cảnh ${i + 1}`);
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
      btn.textContent = '↻ Viết lại';
    }
  });

  el.foot.innerHTML = `<button class="btn ghost" id="back">← Đổi chủ đề</button><button class="btn gold" id="next">Tiếp: ${state.skill.step4 === 'layouts' ? 'bố cục' : 'chọn ảnh'} →</button>`;
  el.foot.querySelector('#back').addEventListener('click', () => go(2));
  el.foot.querySelector('#next').addEventListener('click', () => go(4));
};
