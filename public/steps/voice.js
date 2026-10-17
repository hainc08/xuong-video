// Step 5: pick and preview a voice; the choice is sent with the render request.
const EDGE_RATES = ['-20%', '-15%', '-10%', '-5%', '+0%', '+5%', '+8%', '+10%', '+15%'];

const savedVoice = (skill, video) => {
  if (skill.kind === 'story' && video.tts?.voice) return {...video.tts};
  if (video.ttsVoice) return {engine: video.ttsEngine ?? 'edge', voice: video.ttsVoice, speed: video.ttsSpeed, rate: video.ttsRate};
  return {...skill.defaultVoice};
};

const speak = (text) => (text ?? '').replace(/[~|]/g, ' ').replace(/\s+/g, ' ').trim();

export const render = async (el, {state, go, api, esc, toast}) => {
  if (!state.project) return go(state.skill ? 3 : 1);
  state.voice ??= savedVoice(state.skill, state.project.video);
  if (state.voice.engine === 'cit') state.voice.speed ??= 0.8;
  else state.voice.rate ??= '+8%';
  const filters = {gender: '', region: '', engine: ''};
  el.main.innerHTML = '<span class="spinner"></span> Đang tải danh sách giọng…';
  const {citOnline, voices} = await api.voices();
  let audio = null;

  const draw = () => {
    const shown = voices.filter((v) => (!filters.gender || v.gender === filters.gender) && (!filters.region || v.region === filters.region) && (!filters.engine || v.engine === filters.engine));
    const chip = (key, value, label) => `<button class="btn small ${filters[key] === value ? '' : 'ghost'}" data-f="${key}" data-v="${value}">${label}</button>`;
    const v = state.voice;
    el.main.innerHTML = `<div class="row" style="align-items:flex-start;gap:18px"><div class="grow">
      <h1>Chọn giọng đọc</h1><div class="sub">Bấm ▶ để nghe thử đúng câu mở đầu của video này.</div>
      ${citOnline ? '' : '<div class="error">CIT Voice Studio chưa mở — chỉ dùng được giọng Edge. Mở ứng dụng rồi tải lại trang để thấy đủ giọng.</div>'}
      <div class="row" style="gap:6px;margin-bottom:12px">${chip('gender', '', 'Tất cả')}${chip('gender', 'Nam', 'Nam')}${chip('gender', 'Nữ', 'Nữ')}
        <span style="width:10px"></span>${chip('region', '', 'Mọi miền')}${chip('region', 'Bắc', 'Bắc')}${chip('region', 'Trung', 'Trung')}${chip('region', 'Nam', 'Nam')}
        <span style="width:10px"></span>${chip('engine', '', 'Mọi nguồn')}${chip('engine', 'cit', 'CIT (trên máy)')}${chip('engine', 'edge', 'Edge (cần mạng)')}</div>
      ${shown
        .map(
          (x) => `<div class="card list-item ${x.id === v.voice ? 'selected' : ''}" data-voice="${esc(x.id)}" data-engine="${x.engine}">
            <button class="btn play" style="border-radius:50%;width:40px;height:40px;padding:0;justify-content:center">▶</button>
            <div class="grow"><b>${esc(x.engine === 'edge' ? `${x.id.replace('vi-VN-', '').replace('Neural', '')} (Edge)` : x.id)}</b><div class="note">${esc(x.description)}</div></div>
            ${x.id === v.voice ? '<span class="pill ai">Đang chọn</span>' : ''}</div>`,
        )
        .join('') || '<div class="note">Không có giọng khớp bộ lọc.</div>'}
      </div><div style="width:300px;position:sticky;top:12px">
        <div class="card"><div class="label">${v.engine === 'cit' ? 'Tốc độ đọc' : 'Tốc độ (Edge)'}</div>
          ${
            v.engine === 'cit'
              ? `<input type="range" id="speed" min="0.75" max="1" step="0.05" value="${v.speed}" style="width:100%"><div class="row note" style="justify-content:space-between"><span>chậm 0.75</span><b style="color:#1d2433" id="speedv">${v.speed}</b><span>1.0 nhanh</span></div>`
              : `<select class="field" id="rate">${EDGE_RATES.map((r) => `<option ${r === v.rate ? 'selected' : ''}>${r}</option>`).join('')}</select>`
          }
          <div class="note" style="margin-top:8px">${state.skill.kind === 'story' ? 'Kể chuyện nên để 0.8 cho nhịp trầm, ấm.' : 'Video mẹo nên đọc nhanh, gọn.'}</div></div>
        <div class="card" style="margin-top:12px"><div class="label">Đang chọn</div><b>${esc(v.voice)}</b><div class="note">${v.engine === 'cit' ? 'CIT Voice Studio' : 'Edge TTS'}</div></div>
      </div></div>`;
  };

  el.main.addEventListener('click', async (e) => {
    const f = e.target.closest('[data-f]');
    if (f) {
      filters[f.dataset.f] = f.dataset.v;
      return draw();
    }
    const item = e.target.closest('[data-voice]');
    if (!item) return;
    const engine = item.dataset.engine;
    const choice = {engine, voice: item.dataset.voice, ...(engine === 'cit' ? {speed: state.voice.speed ?? 0.8} : {rate: state.voice.rate ?? '+8%'})};
    if (e.target.closest('.play')) {
      const btn = e.target.closest('.play');
      btn.innerHTML = '<span class="spinner"></span>';
      try {
        const blob = await api.previewVoice(choice, speak(state.project.video.scenes[0]?.voice));
        audio?.pause();
        audio = new Audio(URL.createObjectURL(blob));
        audio.play();
      } catch (err) {
        toast(err.message);
      }
      btn.textContent = '▶';
      return;
    }
    state.voice = choice;
    draw();
  });

  el.main.addEventListener('input', (e) => {
    if (e.target.id === 'speed') {
      state.voice.speed = Number(e.target.value);
      el.main.querySelector('#speedv').textContent = state.voice.speed;
    }
    if (e.target.id === 'rate') state.voice.rate = e.target.value;
  });

  draw();
  el.foot.innerHTML = `<button class="btn ghost" id="back">← ${state.skill.step4 === 'layouts' ? 'Bố cục' : 'Ảnh'}</button><button class="btn gold" id="next">Tiếp: tạo video →</button>`;
  el.foot.querySelector('#back').addEventListener('click', () => go(5));
  el.foot.querySelector('#next').addEventListener('click', () => go(7));
};
