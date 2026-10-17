// Step 2 (and the "Thư viện" page): every video/script already made, with what is needed to find and reuse it.
const STATUS_PILL = {rendered: 'ok', stale: 'ai', 'missing-images': '', ready: ''};
const FILTERS = [['', 'Tất cả'], ['rendered', 'Đã có video'], ['stale', 'Cần dựng lại'], ['missing-images', 'Thiếu ảnh'], ['ready', 'Chưa dựng']];

const day = (iso) => (iso ? new Date(iso).toLocaleString('vi-VN', {dateStyle: 'short', timeStyle: 'short'}) : '');

const seconds = (item) => (item.durationSec ? `${Math.round(item.durationSec)} giây` : `~${item.estimateSeconds} giây (ước tính)`);

export const render = async (el, {state, go, api, esc, toast, openProject}) => {
  const allSkills = !state.skill;
  let query = '';
  let filter = '';
  let data = {items: [], libraryDir: ''};
  let playing = null;

  const thumb = (item) =>
    item.thumbnail
      ? `<img class="thumb" style="width:110px;flex-shrink:0" src="${esc(api.fileUrl(item.skillId, item.thumbnail, Date.parse(item.updatedAt)))}" alt="">`
      : `<div class="mini" style="width:110px;flex-shrink:0;aspect-ratio:9/16"><div class="k">${esc(item.skillName)}</div><div class="t">${esc(item.title)}</div></div>`;

  const card = (item) => `<div class="card" style="display:flex;gap:14px;margin-bottom:10px" data-skill="${esc(item.skillId)}" data-id="${esc(item.id)}">
      ${playing === `${item.skillId}/${item.id}` && item.video ? `<video controls autoplay src="${esc(api.fileUrl(item.skillId, item.video.path, Date.parse(item.video.renderedAt)))}" style="width:180px;border-radius:8px;background:#000;flex-shrink:0"></video>` : thumb(item)}
      <div class="grow">
        <div class="row" style="justify-content:space-between;align-items:flex-start;gap:8px">
          <div><b style="font-size:16px">${esc(item.title)}</b>
            <div class="note">${allSkills ? `${esc(item.skillName)} · ` : ''}${esc(item.id)}${item.copiedFrom ? ` · nhân bản từ ${esc(item.copiedFrom)}` : ''}</div></div>
          <span class="pill ${STATUS_PILL[item.status.code] ?? ''}">${esc(item.status.label)}</span>
        </div>
        ${item.topic ? `<div style="font-size:13px;margin:6px 0"><span class="note">Chủ đề:</span> ${esc(item.topic)}</div>` : ''}
        <div class="note" style="line-height:1.7">
          Tạo ${esc(day(item.createdAt))} · sửa ${esc(day(item.updatedAt))}<br>
          ${item.scenes} cảnh · ${esc(seconds(item))}${item.voice ? ` · giọng ${esc(item.voice)}` : ''}${item.images ? ` · ảnh ${item.images.ready}/${item.images.total}` : ''}${item.video ? ` · video ${item.video.sizeMB} MB, dựng ${esc(day(item.video.renderedAt))}` : ''}
        </div>
        ${item.caption ? `<div class="note" style="margin-top:4px;max-height:38px;overflow:hidden">📝 ${esc(item.caption)}</div>` : ''}
        ${item.archive ? `<div class="note" style="margin-top:4px">💾 Đã lưu: <code>${esc(item.archive)}</code> <button class="btn ghost small copy-path">Sao chép đường dẫn</button></div>` : ''}
        <div class="row" style="gap:6px;margin-top:8px">
          <button class="btn small open">✏️ Mở để sửa</button>
          <button class="btn ghost small dup">📄 Dùng lại (bản sao mới)</button>
          ${item.video ? `<button class="btn ghost small play">▶ Xem</button><a class="btn ghost small" href="${esc(api.fileUrl(item.skillId, item.video.path))}" download>⬇ Tải video</a>` : ''}
          ${item.video ? `<button class="btn ghost small archive">💾 ${item.archive ? 'Lưu lại vào ổ D' : 'Lưu vào ổ D'}</button>` : ''}
        </div>
      </div>
    </div>`;

  const draw = () => {
    const items = data.items.filter((i) => !filter || i.status.code === filter);
    el.main.querySelector('#list').innerHTML = items.length
      ? items.map(card).join('')
      : `<div class="note" style="padding:20px 0">${data.items.length ? 'Không có video khớp bộ lọc.' : 'Chưa có video nào. Bấm “＋ Tạo video mới” để bắt đầu.'}</div>`;
    el.main.querySelector('#count').textContent = `${items.length}/${data.items.length} video`;
    el.main.querySelectorAll('[data-filter]').forEach((b) => b.classList.toggle('ghost', b.dataset.filter !== filter));
  };

  const load = async () => {
    try {
      data = await api.library(state.skill?.id, query);
      el.main.querySelector('#libdir').textContent = data.libraryDir;
      draw();
    } catch (e) {
      el.main.querySelector('#list').innerHTML = `<div class="error">${esc(e.message)}</div>`;
    }
  };

  el.main.innerHTML = `<div class="row" style="justify-content:space-between;align-items:flex-end">
      <div><h1>${allSkills ? 'Thư viện video' : `Video đã tạo · ${esc(state.skill.name)}`}</h1>
        <div class="sub">Mở lại để sửa, dùng lại làm bản mới, xem hoặc tải video. Video làm xong được tự lưu vào <code id="libdir"></code>.</div></div>
      ${allSkills ? '' : '<button class="btn gold" id="new">＋ Tạo video mới</button>'}
    </div>
    <div class="row" style="gap:6px;align-items:center;margin-bottom:12px">
      <input class="field" id="q" placeholder="Tìm theo tiêu đề, chủ đề, mã…" style="max-width:320px">
      ${FILTERS.map(([v, l]) => `<button class="btn small ghost" data-filter="${v}">${l}</button>`).join('')}
      <span class="note" id="count" style="margin-left:auto"></span>
    </div>
    <div id="list"><span class="spinner"></span></div>`;

  el.foot.innerHTML = allSkills
    ? '<button class="btn ghost" id="back">← Chọn skill</button><span></span>'
    : '<button class="btn ghost" id="back">← Đổi skill</button><button class="btn gold" id="new2">＋ Tạo video mới</button>';

  const startNew = () => {
    state.projectId = null;
    state.project = null;
    state.voice = null;
    go(3);
  };
  el.main.querySelector('#new')?.addEventListener('click', startNew);
  el.foot.querySelector('#new2')?.addEventListener('click', startNew);
  el.foot.querySelector('#back').addEventListener('click', () => go(1));

  let timer;
  el.main.querySelector('#q').addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      query = e.target.value;
      load();
    }, 300);
  });

  el.main.addEventListener('click', async (e) => {
    const f = e.target.closest('[data-filter]');
    if (f) {
      filter = f.dataset.filter;
      return draw();
    }
    const cardEl = e.target.closest('[data-id]');
    if (!cardEl) return;
    const {skill, id} = cardEl.dataset;
    const item = data.items.find((i) => i.skillId === skill && i.id === id);
    try {
      if (e.target.closest('.open')) await openProject(skill, id, 4);
      if (e.target.closest('.dup')) {
        const {id: copy} = await api.duplicate(skill, id);
        toast(`Đã tạo bản sao ${copy}`);
        await openProject(skill, copy, 4);
      }
      if (e.target.closest('.play')) {
        playing = playing === `${skill}/${id}` ? null : `${skill}/${id}`;
        draw();
      }
      if (e.target.closest('.archive')) {
        const btn = e.target.closest('.archive');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Đang lưu…';
        const {dir} = await api.archive(skill, id);
        toast(`Đã lưu vào ${dir}`);
        await load();
      }
      if (e.target.closest('.copy-path')) {
        await navigator.clipboard.writeText(item.archive).catch(() => {});
        toast('Đã sao chép đường dẫn');
      }
    } catch (err) {
      toast(err.message);
      load();
    }
  });

  await load();
};
