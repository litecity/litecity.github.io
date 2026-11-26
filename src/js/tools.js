/* ───────── 命中测试与工具逻辑（两个视图共用） ───────── */
function hit(w, tol) {
  if (ui.sel && ui.sel.k === 'road') {
    const r = S.roads[ui.sel.i];
    if (r) { const m = roadMid(r); for (const [h, p] of [['m', m], ['a', r.a], ['b', r.b]]) if (Math.hypot(p[0] - w[0], p[1] - w[1]) < tol * 1.4) return { k: 'h', h }; }
  }
  for (let i = S.blds.length - 1; i >= 0; i--) {
    const b = S.blds[i], f = fp(S.assets[b.a]), c = Math.cos(b.r), s = Math.sin(b.r), dx = w[0] - b.x, dz = w[1] - b.z;
    if (Math.abs(dx * c + dz * s) <= Math.max(f.w / 2, 2) && Math.abs(-dx * s + dz * c) <= Math.max(f.d / 2, 2)) return { k: 'bld', i };
  }
  let best = null;
  S.roads.forEach((r, i) => { const n = nearRoad(r, w[0], w[1]); if (n && n.d <= r.w / 2 + tol * 0.5 && (!best || n.d < best.d)) best = { k: 'road', i, d: n.d }; });
  return best;
}
const canalMode = () => ui.tool === 'terrain' && ui.tmode === 'canal';
const pathTool = () => ui.tool === 'road' || canalMode();
const pathW = () => canalMode() ? numIn('cn-w', 80, 40, 600) : laneInfo({ ln: $('#roadW').value }).w;
const pathPt = w => canalMode() ? [w[0], w[1]] : snapPt(w);
function addRoad(a, b, c) {
  pushUndo(); const r = { a, c: c ? c.slice() : [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b, m: +$('#roadLv').value | 0 }; setLanes(r, $('#roadW').value);
  if (TH || r.m) { setProfile(r, endY(a), endY(b)); gradeRoad(r); }
  S.roads.push(r); normalizeRoads([r]); const i = S.roads.indexOf(r); ui.sel = i >= 0 ? { k: 'road', i } : null; changed();
}
function press(w, forced) {
  if (ui.tool === 'junction' && ui.node) {                                       // 车道连接：先点进口车道的实心点，再点它能去的出口车道的空心点
    const n = J.nodes.find(q => nodeKeyOf(q) === ui.node), ln = n && jxLanes(n), near = l => l.find(q => Math.hypot(q.x - w[0], q.z - w[1]) < Math.max(2, ui.tol * 0.6));
    const i = ln && near(ln.ins), o = ln && ui.jl && near(ln.outs);
    if (o) { pushUndo(); const cfg = jxCfg(), lc = cfg.lc || (cfg.lc = {}), l = lc[ui.jl] || (lc[ui.jl] = []), k = l.indexOf(o.key); if (k >= 0) l.splice(k, 1); else l.push(o.key); if (!l.length) delete lc[ui.jl]; changed(); return false; }
    if (i) { ui.jl = ui.jl === i.key ? null : i.key; req(); return false; }
  }
  if (ui.tool === 'junction') { ui.jl = null; let best = null, bd = Infinity; for (const n of J.nodes) { const d = Math.hypot(n.x - w[0], n.z - w[1]); if (d < Math.max(n.R, ...n.arms.map(a => a.sb)) + 8 && d < bd) { bd = d; best = n; } } ui.node = best ? nodeKeyOf(best) : null; req(); return false; }
  if (ui.tool === 'terrain' && ui.tmode === 'water') {                           // 点一下放水点，点在已有水点上则删除
    pushUndo(); const i = S.env.src.findIndex(q => dist2([q.x, q.z], w) < ui.tol * 2);
    if (i >= 0) S.env.src.splice(i, 1); else if (S.env.src.length < 50) S.env.src.push({ x: Math.round(w[0]), z: Math.round(w[1]), h: numIn('ws-h', 20, -500, 3000) });
    terrChanged(); save(); updateSrcRead(); return true;
  }
  if (ui.tool === 'terrain' && ui.tmode === 'brush') { pushUndoTerr(); ui.drag = { k: 'brush' }; brush(w); return true; }
  if (ui.tool === 'terrain' && ui.tmode === 'tree') { ui.drag = { k: 'tbrush' }; paintTrees(w); return true; }
  if (ui.tool === 'select') {
    const h = forced || hit(w, ui.tol);
    if (!h) { ui.sel = ui.cand = null; req(); return false; }
    if (h.k === 'h') {
      pushUndo(); const r0 = S.roads[ui.sel.i], group = [];
      if (h.h !== 'm') for (const r of S.roads) for (const e of ['a', 'b']) if (dist2(r[e], r0[h.h]) < 0.3) group.push({ r, e, keep: isLaneJoint(r, e === 'a' ? 'b' : 'a') });   // 同一节点上的路一起动
      ui.drag = { k: 'h', h: h.h, group, skip: new Set(group.map(g => g.r)) }; return true;
    }
    if (ui.sel && ui.sel.k === h.k && ui.sel.i === h.i) {                        // 已选中：建筑可以直接拖
      if (h.k === 'bld') { const b = S.blds[h.i]; pushUndo(); ui.drag = { k: 'bld', dx: b.x - w[0], dz: b.z - w[1] }; req(); return true; }
      return false;
    }
    if (ui.cand && ui.cand.k === h.k && ui.cand.i === h.i) { ui.sel = { k: h.k, i: h.i }; ui.cand = null; }   // 第二下：选中
    else { ui.sel = null; ui.cand = { k: h.k, i: h.i }; }                          // 第一下：只是预选，不会被误拖
    req(); return false;
  }
  if (pathTool()) {
    const p = pathPt(w), curve = $('#roadMode').value === 'curve';
    if (!ui.rs) ui.rs = p;
    else if (curve && !ui.rc) { if (dist2(w, ui.rs) > 4) ui.rc = [w[0], w[1]]; }                 // 第二下：定出发方向
    else if (dist2(p, ui.rs) > 4) { if (canalMode()) carveCanal(ui.rs, p, ui.rc); else addRoad(ui.rs, p, ui.rc); ui.rs = ui.rc = null; }             // 最后一下：定终点
    req(); return true;
  }
  if (ui.tool === 'build') { pushUndo(); S.blds.push(poseAt(w)); changed(); return true; }
  if (ui.tool === 'erase') {
    const h = hit(w, ui.tol);
    if (h && h.k !== 'h') { pushUndo(); (h.k === 'bld' ? S.blds : S.roads).splice(h.i, 1); ui.sel = ui.cand = null; changed(); }
    return true;
  }
  return false;
}
function dragTo(w) {
  ui.hover = w;
  const d = ui.drag;
  if (d && d.k === 'h' && ui.sel) {
    const r = S.roads[ui.sel.i]; if (!r) return;
    if (d.h === 'm') {
      const mx = (r.a[0] + r.b[0]) / 2, mz = (r.a[1] + r.b[1]) / 2;
      r.c = [2 * w[0] - mx, 2 * w[1] - mz];
      if (Math.hypot(r.c[0] - mx, r.c[1] - mz) < 3) r.c = [mx, mz];      // 接近直线时吸回直线
    } else {
      const p = snapPt(w, d.skip), e = r[d.h], dx = p[0] - e[0], dz = p[1] - e[1];
      for (const g of d.group) {
        const fix = g.r[g.e === 'a' ? 'b' : 'a'], l = dist2(fix, g.r.c);
        g.r[g.e] = p.slice();
        if (g.keep && l > 0.5) { const k = dist2(fix, p) / 2 / l; g.r.c = [fix[0] + (g.r.c[0] - fix[0]) * k, fix[1] + (g.r.c[1] - fix[1]) * k]; }   // 另一端是车道对齐的接头：保持那一端的走向，这条路自然弯出去
        else g.r.c = [g.r.c[0] + dx / 2, g.r.c[1] + dz / 2];
        ptsCache.delete(g.r);
      }   // 端点移动时弯度保持
    }
    ptsCache.delete(r); dirtyGeom = true;
  } else if (d && d.k === 'bld' && ui.sel) {
    const b = S.blds[ui.sel.i]; if (!b) return;
    b.x = w[0] + d.dx; b.z = w[1] + d.dz; if (ui.snap) snapToRoad(b); dirtyGeom = true;
  } else if (d && d.k === 'brush') brush(w);
  else if (d && d.k === 'tbrush') paintTrees(w);
  req();
}
function release(w, isDrag) {
  if (ui.drag) { const dg = ui.drag, k = dg.k; ui.drag = null; if (k === 'brush') { saveTerr(); terrChanged(); } else if (k === 'tbrush') { saveTerr(); req(); }
    else { if (k === 'h' && ui.sel) { const r = S.roads[ui.sel.i]; if (r) {
        const set = new Set([r, ...dg.group.map(g => g.r)]);                       // 拖过的路：端点落到新位置的地面高度，重算纵断面并重新平整
        if (TH && dg.h !== 'm' && dg.group.length) { const p = r[dg.h], y = Math.round(elevAt(p[0], p[1]) * 10) / 10; for (const g of dg.group) if (g.r.h) g.r.h[g.e === 'a' ? 0 : g.r.h.length - 1] = y; }
        for (const q of set) if (q.h) { setProfile(q, q.h[0], q.h[q.h.length - 1]); gradeRoad(q); }
        normalizeRoads([r]); const i = S.roads.indexOf(r); ui.sel = i >= 0 ? { k: 'road', i } : null; } } changed(); }
    return; }
  if (pathTool() && ui.rs && isDrag && w && $('#roadMode').value !== 'curve') { const p = pathPt(w); if (dist2(p, ui.rs) > 4) { if (canalMode()) carveCanal(ui.rs, p); else addRoad(ui.rs, p); ui.rs = ui.rc = null; } }
  req();
}
function setTool(t) {
  ui.tool = t; ui.rs = ui.rc = null; if (t !== 'select') ui.sel = ui.cand = null; if (t !== 'junction') ui.node = null;
  $('#terra').hidden = t !== 'terrain'; $('#stage').classList.toggle('shopping', t === 'terrain'); if (t === 'terrain') updateTerrRead();
  document.querySelectorAll('#tools button').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === t));
  document.querySelectorAll('#palette .card[data-id]').forEach(c => c.setAttribute('aria-pressed', t === 'build' && c.dataset.id === ui.asset));
  setHint(); req();
}
function setHint() {
  const H = { select: '点一下预选（虚线框），再点一下才选中。选中的路可拖菱形手柄调弯、拖端点改走向；选中的建筑可拖动，R 旋转，Delete 删除。双击空地让实景飞过去。',
    road: '直线：按住拖出或点两下。自由曲线：点三下。贴地的路会自动平整地形；“路面”选桥或隧道时，路在两端之间架空或穿山，同一高度相交才生成路口。选隧道时地形半透明。', build: '在任意一侧点击放置。靠近道路会自动贴边并面向道路，R 旋转 15°。', erase: '点击道路或建筑即可拆除。', junction: '点一个三岔以上的路口：设红绿灯的每一步放行哪些方向，或给各进口立主路、让行标志。',
    terrain: '按住拖动，把地面抹到目标海拔（挖湖就填负数）。按 E 吸取光标处海拔。' };
  $('#hint2').textContent = shop.open ? '车间平面：点选并拖动部件。下方是正面（朝路的一侧）。' : ui.tool === 'terrain' && ui.tmode === 'tree' ? '按住拖动刷树；勾“擦除”则刷掉。远处显示为林地的深色，镜头拉近才出现一棵棵树。' : ui.tool === 'terrain' && ui.tmode === 'canal' ? '像修路一样画沟渠：直线拖出或点两下，自由曲线点三下（顶栏“画法”）。渠底从起点向终点一路下降，上游陡、下游缓。' : ui.tool === 'terrain' && ui.tmode === 'water' ? '点一下放水点：与它连通、低于水面海拔的地方会淹成一片平的水面。再点水点可删除。按 E 取光标处海拔 +5 m。' : H[ui.tool];
  $('#tag2').textContent = shop.open ? '车间 · 俯视' : '平面图 · 俯视';
  $('#tag3').textContent = shop.open ? '车间 · 3D 预览' : '实景 · 3D';
  $('#hint3').textContent = ui.tool === 'terrain' && !shop.open ? (ui.tmode === 'brush' || ui.tmode === 'tree' ? '左键拖动刷 · 右键拖动旋转 · Shift 拖动平移' : '点击落点 · 拖动旋转 · 滚轮缩放 · Shift 或右键拖动平移') : '拖动旋转（贴地后继续上抬可仰视）· 滚轮缩放 · 鼠标移到四边可走动 · 双击前往';
}
function rotate(dir) {
  const st = 15 * D2R * dir;
  if (shop.open) return;
  if (ui.sel && ui.sel.k === 'bld') { pushUndo(); S.blds[ui.sel.i].r += st; changed(); } else { ui.rot += st; req(); }
}
function removeSel() {
  if (!ui.sel) return; pushUndo(); (ui.sel.k === 'bld' ? S.blds : S.roads).splice(ui.sel.i, 1); ui.sel = ui.cand = null; changed();
}
