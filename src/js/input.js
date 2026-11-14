/* ───────── 指针手势 ───────── */
function gestures(el, h) {
  const pts = new Map(); let pin = null, pinched = false;
  const info = () => { const [a, b] = [...pts.values()]; return { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 }; };
  el.addEventListener('pointerdown', e => {
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { if (!pinched) h.cancel(); pinched = true; pin = info(); } else if (pts.size === 1) h.down(e);
  });
  el.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) { h.hover(e); return; }
    const p = pts.get(e.pointerId), dx = e.clientX - p[0], dy = e.clientY - p[1]; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size >= 2 && pin) { const n = info(); h.pinch(n.d / pin.d, n.x - pin.x, n.y - pin.y, n); pin = n; }
    else if (!pinched) h.move(e, dx, dy);
  });
  const up = e => { if (!pts.delete(e.pointerId)) return; pin = null; if (pts.size === 0) { if (!pinched) h.up(e); pinched = false; } };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('pointerleave', () => { if (!pts.size) { ui.hover = null; req(); } });
  el.addEventListener('contextmenu', e => e.preventDefault());
}
const dropDrag = () => { if (ui.drag) release(null, false); };
// 左：平面图
let m2 = null, space = false;
gestures(c2, {
  down(e) {
    const w = toWorld2(e); ui.tol = Math.max(2, 9 / v2.s); m2 = { mode: 'pan', moved: 0 };
    if (e.button !== 0 || space) return;
    if (shop.open) { const i = shopPick(w); selectPart(i); if (i >= 0) { const p = shop.draft.parts[i]; m2 = { mode: 'part', dx: p.x - w[0], dz: p.z - w[1], moved: 0 }; } return; }
    if (press(w)) m2.mode = 'tool';
  },
  move(e, dx, dy) {
    if (!m2) return; m2.moved += Math.abs(dx) + Math.abs(dy); const w = toWorld2(e);
    if (m2.mode === 'tool') dragTo(w);
    else if (m2.mode === 'part') { const p = shop.draft.parts[shop.sel]; if (p) { p.x = Math.round((w[0] + m2.dx) * 2) / 2; p.z = Math.round((w[1] + m2.dz) * 2) / 2; shopRefresh(true); } }
    else { const v = view(); v.cx -= dx / v.s; v.cz -= dy / v.s; req(); }
  },
  up(e) { if (m2 && m2.mode === 'tool') release(toWorld2(e), m2.moved > 6); m2 = null; },
  hover(e) { ui.tol = Math.max(2, 9 / v2.s); ui.hover = shop.open ? null : toWorld2(e); if (ui.tool !== 'select' || ui.rs) req(); },
  cancel() { dropDrag(); m2 = null; },
  pinch(k, dx, dy) { const v = view(); v.s = clamp(v.s * k, shop.open ? 1.5 : 0.015, shop.open ? 40 : 12); v.cx -= dx / v.s; v.cz -= dy / v.s; req(); },
});
c2.addEventListener('wheel', e => {
  e.preventDefault(); const v = view(), w = toWorld2(e), k = Math.exp(-e.deltaY * 0.0015);
  const ns = clamp(v.s * k, shop.open ? 1.5 : 0.015, shop.open ? 40 : 12); v.cx = w[0] - (w[0] - v.cx) * v.s / ns; v.cz = w[1] - (w[1] - v.cz) * v.s / ns; v.s = ns; req();
}, { passive: false });
c2.addEventListener('dblclick', e => { if (shop.open || ui.tool !== 'select') return; const w = toWorld2(e); if (hit(w, ui.tol)) return; flyTo(w[0], w[1], camCity.dist); });
c3.addEventListener('dblclick', e => { if (shop.open || ui.tool !== 'select') return; const ray = rayAt(e), w = groundHit(ray); if (pickBld(ray) >= 0 || (w && hit(w, ui.tol))) return; if (w) flyTo(w[0], w[1], Math.max(140, camCity.dist * 0.55)); });
// 右：实景
let m3 = null, edge = null, lastT = 0;
function setEdge(v) { edge = v; const on = (c, f) => $('.edge.' + c).classList.toggle('on', !!f); on('e-t', v && v.fz > 0); on('e-b', v && v.fz < 0); on('e-l', v && v.fx < 0); on('e-r', v && v.fx > 0); }
c3.addEventListener('pointerleave', () => setEdge(null));
c3.addEventListener('pointerdown', () => setEdge(null));
gestures(c3, {
  down(e) {
    const brushing = ui.tool === 'terrain' && (ui.tmode === 'brush' || ui.tmode === 'tree') && !shop.open;
    m3 = { mode: (e.button === 1 || e.shiftKey || (e.button === 2 && !brushing)) ? 'pan' : 'orbit', moved: 0, btn: e.button };
    if (shop.open || e.button !== 0 || e.shiftKey) return;
    ui.tol = Math.max(2, camCity.dist * 0.02);
    if (brushing) { const w = groundHit(rayAt(e)); if (w && press(w)) m3.mode = 'tool'; return; }
    if (ui.tool === 'select') {
      const ray = rayAt(e), w = groundHit(ray), bi = pickBld(ray);
      const h = bi >= 0 ? { k: 'bld', i: bi } : (w && hit(w, ui.tol));
      if (h && (h.k === 'h' || (h.k === 'bld' && ui.sel && ui.sel.k === 'bld' && ui.sel.i === h.i))) { const b = S.blds[h.i]; if (press(w || [b.x, b.z], h)) m3.mode = 'tool'; }   // 只有手柄和已选中的建筑能拖
    }
  },
  move(e, dx, dy) {
    if (!m3) return; m3.moved += Math.abs(dx) + Math.abs(dy); const c = cam();
    if (m3.mode === 'tool') { const w = groundHit(rayAt(e)); if (w) dragTo(w); return; }
    if (m3.mode === 'orbit') { c.yaw -= dx * 0.006; c.pitch = clamp(c.pitch + dy * 0.005, 0.06, 1.5); }
    else { const k = c.dist * 0.0017, sy = Math.sin(c.yaw), cy = Math.cos(c.yaw); c.tx += -cy * dx * k - sy * dy * k; c.tz += sy * dx * k - cy * dy * k; }
    req();
  },
  up(e) {
    if (!m3) return; const w = groundHit(rayAt(e));
    if (m3.mode === 'tool') release(w, true);
    else if (m3.moved < 6 && m3.btn === 0 && !shop.open) {
      ui.tol = Math.max(2, camCity.dist * 0.02);
      const bi = ui.tool === 'select' ? pickBld(rayAt(e)) : -1, p = w || (bi >= 0 ? [S.blds[bi].x, S.blds[bi].z] : null);
      if (p) { press(p, bi >= 0 ? { k: 'bld', i: bi } : undefined); release(p, false); }
    }
    m3 = null;
  },
  hover(e) {
    if (shop.open) return; ui.tol = Math.max(2, camCity.dist * 0.02); ui.hover = groundHit(rayAt(e));
    const rc = c3.getBoundingClientRect(), x = e.clientX - rc.left, y = e.clientY - rc.top, Z = 46;                      // 四边 46 px 是“往那边走”的区域
    const fx = e.pointerType !== 'mouse' ? 0 : x < Z ? -1 : x > rc.width - Z ? 1 : 0, fz = e.pointerType !== 'mouse' ? 0 : y < Z ? 1 : y > rc.height - Z ? -1 : 0;
    if (!fx && !fz) setEdge(null); else if (!edge || edge.fx !== fx || edge.fz !== fz) setEdge({ fx, fz, t0: performance.now() });
    if (edge || ui.tool !== 'select' || ui.rs) req();
  },
  cancel() { dropDrag(); m3 = null; },
  pinch(k, dx, dy) { const c = cam(); c.dist = clamp(c.dist / k, 12, 24000); const q = c.dist * 0.0017, sy = Math.sin(c.yaw), cy = Math.cos(c.yaw); c.tx += -cy * dx * q - sy * dy * q; c.tz += sy * dx * q - cy * dy * q; req(); },
});
c3.addEventListener('wheel', e => { e.preventDefault(); const c = cam(); c.dist = clamp(c.dist * Math.exp(e.deltaY * 0.0012), 12, 24000); req(); }, { passive: false });
