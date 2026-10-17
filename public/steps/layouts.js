// Step 4 (office skills): choose each scene's layout and edit its on-screen text.

// Fields per scene type, from the ai-van-phong-video SKILL.md scene table.
// kind: text | area | lines (string[] one per line) | pairs (items [{label, value}] as "nhãn | giá trị") |
//       side (compare left/right) | select | check | number | image
const TYPES = {
  hook: {name: 'Mở đầu', fields: [['kicker', 'Nhãn nhỏ'], ['title', 'Câu mở đầu', 'area']]},
  stats: {name: 'Thẻ số liệu', fields: [['kicker', 'Nhãn nhỏ'], ['title', 'Tiêu đề', 'area'], ['items', 'Thẻ số (nhãn | giá trị, mỗi dòng một thẻ)', 'pairs']]},
  compare: {name: 'So sánh', fields: [['kicker', 'Nhãn nhỏ'], ['title', 'Tiêu đề', 'area'], ['left', 'Bên trái', 'side'], ['right', 'Bên phải', 'side'], ['layout', 'Bố cục', 'select', ['row', 'column']], ['badge', 'Huy hiệu giữa (VS, ↓, +, !)']]},
  bullets: {name: 'Gạch đầu dòng', fields: [['kicker', 'Nhãn nhỏ'], ['title', 'Tiêu đề', 'area'], ['items', 'Các ý (mỗi dòng một ý, ≤ 40 ký tự)', 'lines']]},
  steps: {name: 'Các bước', fields: [['kicker', 'Nhãn nhỏ'], ['title', 'Tiêu đề', 'area'], ['items', 'Các bước (mỗi dòng một bước)', 'lines']]},
  code: {name: 'Prompt mẫu', fields: [['kicker', 'Nhãn nhỏ'], ['title', 'Tiêu đề', 'area'], ['window', 'Tên cửa sổ'], ['prompt', 'Ký hiệu đầu dòng'], ['lines', 'Nội dung gõ (mỗi dòng một dòng)', 'lines'], ['output', 'Kết quả (tùy chọn)', 'area']]},
  bignumber: {name: 'Con số lớn', fields: [['kicker', 'Nhãn nhỏ'], ['value', 'Con số'], ['unit', 'Đơn vị'], ['caption', 'Chú thích'], ['note', 'Ghi chú nhỏ (tùy chọn)']]},
  statement: {name: 'Câu khẳng định', fields: [['icon', 'Biểu tượng', 'select', ['bolt', 'check', 'clock', 'star', 'shield', 'alert']], ['text', 'Câu', 'area']]},
  image: {name: 'Ảnh chụp màn hình', fields: [['kicker', 'Nhãn nhỏ'], ['title', 'Tiêu đề', 'area'], ['image', 'Ảnh', 'image']]},
  tip: {name: 'Mẹo (bản ngắn)', fields: [['number', 'Số thứ tự', 'number'], ['title', 'Tiêu đề'], ['body', 'Nội dung', 'area'], ['example', 'Prompt mẫu (tùy chọn)', 'area']]},
  text: {name: 'Chữ', fields: [['title', 'Tiêu đề', 'area'], ['body', 'Nội dung (tùy chọn)', 'area']]},
  cta: {name: 'Kêu gọi theo dõi', fields: [['title', 'Tiêu đề'], ['subtitle', 'Dòng phụ'], ['actions', 'Hiện hàng nút Thích / Chia sẻ / Lưu / Theo dõi', 'check']]},
};

const KEEP = ['type', 'voice', 'keywords', 'durationSec', 'ttsVoice'];

const blank = (kind, opts) =>
  ({lines: ['', ''], pairs: [{label: '', value: ''}, {label: '', value: ''}], side: {label: '', text: ''}, select: opts?.[0], check: true, number: 1})[kind] ?? '';

// Switching layout keeps the narration and any field both layouts share.
const switchType = (scene, type) => {
  const next = Object.fromEntries(KEEP.filter((k) => k in scene).map((k) => [k, scene[k]]));
  next.type = type;
  for (const [key, , kind, opts] of TYPES[type].fields) next[key] = key in scene ? scene[key] : blank(kind, opts);
  return next;
};

const summary = (s) => {
  if (Array.isArray(s.items)) return s.items.map((i) => (typeof i === 'string' ? i : `${i.label}: ${i.value}`)).join(' · ');
  if (s.left) return `${s.left.label} ${s.badge ?? 'VS'} ${s.right?.label ?? ''}`;
  if (s.lines) return s.lines.join(' ');
  return s.value ? `${s.value} ${s.unit ?? ''}` : s.body ?? s.subtitle ?? s.caption ?? (s.image ? '🖼 ảnh đã chọn' : '');
};

export const render = async (el, {state, go, save, api, esc}) => {
  if (!state.project) return go(state.skill ? 3 : 1);
  const video = state.project.video;
  let open = null;

  const input = (i, key, label, kind, opts) => {
    const v = video.scenes[i][key];
    const name = `data-i="${i}" data-key="${key}" data-kind="${kind ?? 'text'}"`;
    const wrap = (html) => `<div style="margin-bottom:8px"><div class="label">${esc(label)}</div>${html}</div>`;
    switch (kind) {
      case 'area': return wrap(`<textarea class="field f" ${name} rows="2">${esc(v)}</textarea>`);
      case 'lines': return wrap(`<textarea class="field f" ${name} rows="4">${esc((v ?? []).join('\n'))}</textarea>`);
      case 'pairs': return wrap(`<textarea class="field f" ${name} rows="3">${esc((v ?? []).map((p) => `${p.label} | ${p.value}`).join('\n'))}</textarea>`);
      case 'side': return wrap(`<input class="field f" ${name} data-part="label" placeholder="Nhãn" value="${esc(v?.label)}" style="margin-bottom:4px"><textarea class="field f" ${name} data-part="text" rows="2">${esc(v?.text)}</textarea>`);
      case 'select': return wrap(`<select class="field f" ${name}>${opts.map((o) => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select>`);
      case 'check': return `<label style="display:block;margin-bottom:8px;font-size:14px"><input type="checkbox" class="f" ${name} ${v ? 'checked' : ''}> ${esc(label)}</label>`;
      case 'number': return wrap(`<input type="number" min="1" class="field f" ${name} value="${esc(v)}">`);
      case 'image': {
        const img = state.project.images.find((x) => x.scene === i);
        return wrap(`${img?.exists ? `<img class="thumb" style="max-width:200px" src="${api.fileUrl(state.skill.id, `public/${state.projectId}/${img.file}`, img.mtime)}">` : '<div class="note">Chưa có ảnh</div>'}
          <button class="btn ghost small upload" data-i="${i}" style="margin-top:6px">⬆ Tải ảnh chụp màn hình</button><input type="file" accept="image/png,image/jpeg" hidden data-i="${i}">`);
      }
      default: return wrap(`<input class="field f" ${name} value="${esc(v)}">`);
    }
  };

  const draw = (message = '') => {
    el.main.innerHTML = `<h1>Bố cục từng cảnh · ${esc(state.skill.name)}</h1>
      <div class="sub">Mỗi cảnh chọn một kiểu bố cục và sửa chữ hiện trên màn hình. Lời đọc giữ nguyên khi đổi kiểu. Bấm một thẻ để sửa.</div>
      <div id="msg">${message}</div>
      <div class="grid">${video.scenes
        .map(
          (s, i) => `<div class="card ${open === i ? 'selected' : ''}" style="padding:10px" data-card="${i}">
            <div class="label">Cảnh ${i + 1}</div>
            <select class="field type" data-i="${i}" style="padding:6px 8px;font-size:13px;margin-bottom:8px">${Object.entries(TYPES).map(([t, d]) => `<option value="${t}" ${t === s.type ? 'selected' : ''}>${d.name}</option>`).join('')}</select>
            <div class="mini" data-open="${i}" style="cursor:pointer"><div class="k">${esc(TYPES[s.type]?.name ?? s.type)}</div><div class="t">${esc(s.title ?? s.text ?? s.caption ?? '')}</div>${summary(s) ? `<div class="b">${esc(summary(s))}</div>` : ''}</div>
          </div>`,
        )
        .join('')}</div>
      ${open === null ? '' : `<div class="card" style="margin-top:14px"><h2 style="margin-top:0">Cảnh ${open + 1} · ${esc(TYPES[video.scenes[open].type]?.name ?? '')}</h2>${(TYPES[video.scenes[open].type]?.fields ?? []).map(([k, l, kind, opts]) => input(open, k, l, kind, opts)).join('')}</div>`}`;
  };

  el.main.addEventListener('click', (e) => {
    const card = e.target.closest('[data-open]');
    if (card) {
      open = Number(card.dataset.open);
      draw();
    }
    const up = e.target.closest('.upload');
    if (up) el.main.querySelector(`input[type=file][data-i="${up.dataset.i}"]`).click();
  });

  el.main.addEventListener('change', async (e) => {
    if (e.target.classList.contains('type')) {
      const i = Number(e.target.dataset.i);
      video.scenes[i] = switchType(video.scenes[i], e.target.value);
      open = i;
      draw();
      save(video).catch(() => {});
      return;
    }
    if (e.target.type === 'file' && e.target.files[0]) {
      const i = Number(e.target.dataset.i);
      const dataUrl = await new Promise((r) => {
        const reader = new FileReader();
        reader.onload = () => r(reader.result);
        reader.readAsDataURL(e.target.files[0]);
      });
      try {
        state.project = await api.uploadImage(state.skill.id, state.projectId, `scene_${String(i + 1).padStart(2, '0')}.png`, dataUrl, i);
        Object.assign(video, state.project.video);
        draw('<div class="info">Đã tải ảnh lên.</div>');
      } catch (err) {
        draw(`<div class="error">${esc(err.message)}</div>`);
      }
    }
  });

  el.main.addEventListener('input', (e) => {
    const f = e.target.closest('.f');
    if (!f) return;
    const scene = video.scenes[Number(f.dataset.i)];
    const key = f.dataset.key;
    const value = f.value;
    switch (f.dataset.kind) {
      case 'lines': scene[key] = value.split('\n').map((l) => l.trim()).filter(Boolean); break;
      case 'pairs': scene[key] = value.split('\n').filter((l) => l.trim()).map((l) => {
        const [label, ...rest] = l.split('|');
        return {label: label.trim(), value: rest.join('|').trim()};
      }); break;
      case 'side': scene[key] = {...scene[key], [f.dataset.part]: value}; break;
      case 'check': scene[key] = f.checked; break;
      case 'number': scene[key] = Number(value) || 1; break;
      default: scene[key] = value;
    }
    const card = el.main.querySelector(`[data-open="${f.dataset.i}"]`);
    if (card) card.querySelector('.t').textContent = scene.title ?? scene.text ?? scene.caption ?? '';
    save(video).catch(() => {});
  });

  draw();
  el.foot.innerHTML = '<button class="btn ghost" id="back">← Kịch bản</button><button class="btn gold" id="next">Tiếp: giọng đọc →</button>';
  el.foot.querySelector('#back').addEventListener('click', () => go(4));
  el.foot.querySelector('#next').addEventListener('click', () => go(6));
};
