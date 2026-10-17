// Step 1: pick a skill (one kind of video), or reopen a project.
const STEP4 = {images: '🖼 Chọn ảnh từng cảnh (tải lên hoặc AI tạo)', layouts: '🧩 Chọn kiểu bố cục từng cảnh (thẻ số, so sánh, gạch đầu dòng…)'};

const preview = (skill, api, esc) =>
  skill.sampleImage
    ? `<img class="thumb" style="width:150px;flex-shrink:0" src="${api.fileUrl(skill.id, skill.sampleImage)}" alt="">`
    : `<div class="mini" style="width:150px;flex-shrink:0;aspect-ratio:9/16;display:flex;flex-direction:column;justify-content:center"><div class="k">${esc(skill.name)}</div><div class="t">Chữ và thẻ chuyển động</div><div class="b" style="color:#22d3ee;font-weight:800">3</div><div class="b" style="color:#fbbf24;font-weight:800">0</div></div>`;

export const render = async (el, ctx) => {
  const {state, go, esc, api} = ctx;
  el.main.innerHTML = `<h1>Bước 1 · Chọn skill</h1>
    <div class="sub">Mỗi skill là một loại video riêng, có kịch bản, hình và giọng mặc định riêng. Các bước sau tự đổi theo skill bạn chọn.</div>
    <div class="row" id="skills" style="gap:20px"></div>
    <div style="margin-top:18px"><button class="btn ghost" id="all">📚 Xem tất cả video đã tạo</button></div>`;
  const box = el.main.querySelector('#skills');
  box.innerHTML = state.skills
    .map(
      (s) => `<div class="card pick grow ${state.skill?.id === s.id ? 'selected' : ''} ${s.available ? '' : 'disabled'}" data-skill="${esc(s.id)}" style="display:flex;gap:16px;min-width:380px">
        ${preview(s, api, esc)}
        <div>${state.skill?.id === s.id ? '<span class="pill ai">Đang chọn</span>' : ''}
          <div style="font-size:20px;font-weight:700;margin:8px 0">${esc(s.name)}</div>
          <div class="note" style="font-size:13px;line-height:1.6">${esc(s.description)}</div>
          <div class="label" style="margin-top:12px">Bước 4 sẽ là</div><div style="font-size:14px">${STEP4[s.step4] ?? ''}</div>
          ${s.available ? '' : '<div class="error">Không tìm thấy thư mục làm việc của skill này.</div>'}
        </div></div>`,
    )
    .join('');
  box.addEventListener('click', (e) => {
    const card = e.target.closest('[data-skill]');
    if (!card || card.classList.contains('disabled')) return;
    const skill = state.skills.find((s) => s.id === card.dataset.skill);
    if (state.skill?.id !== skill.id) {
      state.projectId = null;
      state.project = null;
      state.voice = null;
    }
    state.skill = skill;
    go(2);
  });
  el.main.querySelector('#all').addEventListener('click', () => document.getElementById('library').click());
  el.foot.innerHTML = `<span class="note">Có thể thêm skill mới sau này</span>${state.skill ? '<button class="btn gold" id="next">Tiếp: video đã tạo →</button>' : ''}`;
  el.foot.querySelector('#next')?.addEventListener('click', () => go(2));
};
