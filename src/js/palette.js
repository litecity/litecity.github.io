/* ───────── 资产架 ───────── */
function renderPalette() {
  const el = $('#palette'); el.textContent = '';
  const nw = document.createElement('button'); nw.className = 'card new'; nw.innerHTML = '<b>＋</b><span>新建资产</span>'; nw.onclick = () => openShop(null); el.append(nw);
  for (const a of Object.values(S.assets)) {
    const c = document.createElement('div'); c.className = 'card'; c.dataset.id = a.id; c.tabIndex = 0; c.setAttribute('role', 'button');
    c.setAttribute('aria-pressed', ui.tool === 'build' && ui.asset === a.id);
    const cv = document.createElement('canvas'); cv.width = cv.height = 88; const g = cv.getContext('2d'), f = fp(a);
    g.translate(44, 44); drawAssetPlan(g, a, 76 / Math.max(f.w, f.d, 8));
    const nm = document.createElement('span'); nm.textContent = a.name;
    const ed = document.createElement('button'); ed.className = 'ed'; ed.textContent = '✎'; ed.title = a.builtin ? '以此为底稿另存一份' : '编辑'; ed.setAttribute('aria-label', '编辑 ' + a.name);
    ed.onclick = ev => { ev.stopPropagation(); openShop(a.id); };
    c.append(cv, nm, ed);
    c.onclick = () => { if (shop.open) return; ui.asset = a.id; setTool('build'); };
    c.onkeydown = ev => { if (ev.key === 'Enter') c.onclick(); };
    el.append(c);
  }
}
