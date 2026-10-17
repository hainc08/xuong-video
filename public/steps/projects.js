// "Dự án đã làm": every saved project across skills, newest first.
export const renderProjects = async (container, {state, api, esc, openProject, toast}) => {
  let list;
  try {
    list = await api.projects();
  } catch (e) {
    container.innerHTML = `<div class="error">${esc(e.message)}</div>`;
    return;
  }
  if (!list.length) {
    container.innerHTML = '<div class="note">Chưa có dự án nào.</div>';
    return;
  }
  const name = (id) => state.skills.find((s) => s.id === id)?.name ?? id;
  container.innerHTML = list
    .slice(0, 30)
    .map(
      (p) => `<div class="card list-item" data-skill="${esc(p.skillId)}" data-id="${esc(p.id)}">
        <span class="pill">${esc(name(p.skillId))}</span>
        <div class="grow"><b>${esc(p.title)}</b><div class="note">${esc(p.id)} · ${new Date(p.updatedAt).toLocaleString('vi-VN')}</div></div>
        ${p.hasVideo ? '<span class="pill ok">Đã có video</span>' : '<span class="pill">Chưa dựng</span>'}
      </div>`,
    )
    .join('');
  container.addEventListener('click', (e) => {
    const item = e.target.closest('[data-id]');
    if (item) openProject(item.dataset.skill, item.dataset.id).catch((err) => toast(err.message));
  });
};
