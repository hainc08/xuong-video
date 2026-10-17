// Step 2: type a topic; Claude Code writes the script.
const CONTEXTS = ['Để Claude tự chọn', 'Công sở', 'Gia đình', 'Bạn bè', 'Hàng xóm, đời thường'];

export const render = async (el, {state, go, esc, api, openProject}) => {
  if (!state.skill) return go(1);
  const story = state.skill.kind === 'story';
  el.main.innerHTML = `<h1>${story ? 'Câu chuyện hôm nay kể về điều gì?' : 'Video hôm nay nói về gì?'}</h1>
    <div class="sub">Skill: <b>${esc(state.skill.name)}</b>. Gõ chủ đề hoặc bài học, Claude Code trên máy viết kịch bản theo đúng hướng dẫn của skill.</div>
    <div class="label">Chủ đề hoặc bài học</div>
    <textarea class="field" id="topic" rows="4" placeholder="${story ? 'Ví dụ: người bố hay chê con, rồi nhận ra lời khen thật lòng mới khiến con cố gắng' : 'Ví dụ: 3 cách dùng ChatGPT viết email nhanh'}">${esc(state.topic)}</textarea>
    <div class="row" style="margin-top:14px">
      <div><div class="label">Thời lượng</div><select class="field" id="duration">
        ${story ? '<option value="60">~60 giây</option><option value="45">~45 giây</option><option value="90">~90 giây</option>' : '<option value="65">60–70 giây</option><option value="30">20–30 giây (bản ngắn)</option>'}
      </select></div>
      ${story ? `<div><div class="label">Bối cảnh</div><select class="field" id="context">${CONTEXTS.map((c) => `<option>${c}</option>`).join('')}</select></div>` : ''}
    </div>
    <div id="status"></div>`;
  el.foot.innerHTML = '<button class="btn ghost" id="back">← Đổi skill</button><button class="btn gold" id="write">Viết kịch bản →</button>';
  const topic = el.main.querySelector('#topic');
  const status = el.main.querySelector('#status');
  topic.addEventListener('input', () => (state.topic = topic.value));
  el.foot.querySelector('#back').addEventListener('click', () => go(1));
  el.foot.querySelector('#write').addEventListener('click', async () => {
    const text = topic.value.trim();
    if (!text) {
      status.innerHTML = '<div class="error">Bạn chưa nhập chủ đề.</div>';
      return;
    }
    const options = {durationSec: Number(el.main.querySelector('#duration').value)};
    const context = el.main.querySelector('#context')?.value;
    if (context && context !== CONTEXTS[0]) options.context = context;
    const button = el.foot.querySelector('#write');
    button.disabled = true;
    status.innerHTML = '<div class="info"><span class="spinner"></span> Claude đang viết kịch bản… (khoảng 1–2 phút, đừng đóng trang)</div>';
    try {
      const {id} = await api.createProject(state.skill.id, text, options);
      state.topic = '';
      await openProject(state.skill.id, id, 3);
    } catch (e) {
      status.innerHTML = `<div class="error">${esc(e.message)}</div>`;
      button.disabled = false;
    }
  });
};
