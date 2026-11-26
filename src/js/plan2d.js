/* ───────── 平面图（Canvas 2D，直接读同一份状态） ───────── */
const v2 = { cx: 0, cz: -30, s: 1.1 }, vS = { cx: 0, cz: 0, s: 8 };
const view = () => shop.open ? vS : v2;
function toWorld2(ev) { const rc = c2.getBoundingClientRect(), v = view(); return [(ev.clientX - rc.left - rc.width / 2) / v.s + v.cx, (ev.clientY - rc.top - rc.height / 2) / v.s + v.cz]; }
function drawAssetPlan(g, asset, s) {
  for (const p of fp(asset).sorted) {
    g.save(); g.translate(p.x * s, p.z * s); if (p.r) g.rotate(p.r * D2R);
    const w = p.w * s, d = p.d * s; g.fillStyle = p.c; g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1;
    if (p.s === 'cyl' || p.s === 'cone') {
      g.beginPath(); g.ellipse(0, 0, w / 2, d / 2, 0, 0, TAU); g.fill(); g.stroke();
      if (p.s === 'cone') { g.fillStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.ellipse(0, 0, w / 5, d / 5, 0, 0, TAU); g.fill(); }
    } else {
      g.fillRect(-w / 2, -d / 2, w, d);
      if (p.s === 'gable') { g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(-w / 2, 0, w, d / 2); g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(w / 2, 0); g.stroke(); }
      if (p.s === 'pyr') { g.beginPath(); g.moveTo(-w / 2, -d / 2); g.lineTo(w / 2, d / 2); g.moveTo(w / 2, -d / 2); g.lineTo(-w / 2, d / 2); g.stroke(); }
      g.strokeRect(-w / 2, -d / 2, w, d);
    }
    g.restore();
  }
}
function roadPath(g, r, s) { g.beginPath(); g.moveTo(r.a[0] * s, r.a[1] * s); g.quadraticCurveTo(r.c[0] * s, r.c[1] * s, r.b[0] * s, r.b[1] * s); }
function draw2() {
  const W = c2.clientWidth, Hh = c2.clientHeight; if (!W || !Hh) return;
  const dpr = fit(c2), g = g2, v = view(), s = v.s, ox = W / 2 - v.cx * s, oy = Hh / 2 - v.cz * s;
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = T.paper; g.fillRect(0, 0, W, Hh);
  if (TH && !shop.open && terrCv) { const o = (-HALF - CELL) * s, e = (GN + 2) * CELL * s; g.imageSmoothingEnabled = true; g.drawImage(terrCv, o + ox, o + oy, e, e); }
  for (const [step, col] of shop.open ? [[1, T.grid], [5, T.grid2]] : [[16, T.grid], [80, T.grid2]]) {
    if (step * s < 5) continue; g.strokeStyle = col; g.lineWidth = 1; g.globalAlpha = TH && !shop.open ? 0.3 : 1; g.beginPath();
    for (let x = Math.floor(-ox / s / step) * step; x * s + ox < W; x += step) { const px = Math.round(x * s + ox) + 0.5; g.moveTo(px, 0); g.lineTo(px, Hh); }
    for (let z = Math.floor(-oy / s / step) * step; z * s + oy < Hh; z += step) { const py = Math.round(z * s + oy) + 0.5; g.moveTo(0, py); g.lineTo(W, py); }
    g.stroke();
  }
  g.globalAlpha = 1; g.save(); g.translate(ox, oy); g.lineCap = 'round'; g.lineJoin = 'round';
  if (shop.open) {
    const f = fp(shop.draft);
    g.setLineDash([5, 4]); g.strokeStyle = T.mute; g.lineWidth = 1; g.strokeRect(-f.w / 2 * s, -f.d / 2 * s, f.w * s, f.d * s); g.setLineDash([]);
    drawAssetPlan(g, shop.draft, s);
    const p = shop.draft.parts[shop.sel];
    if (p) { g.save(); g.translate(p.x * s, p.z * s); g.rotate((p.r || 0) * D2R); g.strokeStyle = T.sel; g.lineWidth = 2; g.strokeRect(-p.w / 2 * s - 2, -p.d / 2 * s - 2, p.w * s + 4, p.d * s + 4); g.restore(); }
    const z = (f.d / 2 + 1.5) * s; g.fillStyle = T.accent; g.beginPath(); g.moveTo(-1.5 * s, z); g.lineTo(1.5 * s, z); g.lineTo(0, z + 3 * s); g.fill();
    g.fillStyle = T.mute; g.font = '600 12px ' + 'Barlow Condensed, sans-serif'; g.textAlign = 'center'; g.fillText('正面', 0, z + 3 * s + 14);
  } else {
    const fade = r => { g.globalAlpha = r.m === 2 ? 0.38 : 1; };                 // 隧道画得淡，桥加一圈深色边
    for (const r of S.roads) if (r.m === 1) { roadPath(g, r, s); g.lineCap = 'butt'; g.strokeStyle = T.ink; g.lineWidth = (r.w + 4) * s + 4; g.stroke(); g.lineCap = 'round'; }
    for (const r of S.roads) { const li = laneInfo(r); if (!li.wl && !li.wr) continue; fade(r); roadPath(g, r, s); g.strokeStyle = T.walk; g.lineWidth = (r.w + 4) * s; g.stroke(); }
    for (const r of S.roads) { fade(r); roadPath(g, r, s); g.strokeStyle = T.road; g.lineWidth = r.w * s; g.stroke(); }
    g.globalAlpha = 1; g.lineCap = 'butt';
    const offPath = (r, o) => { const p = roadPts(r); g.beginPath(); for (let i = 0; i < p.length; i++) { const x = (p[i].x - p[i].tz * o) * s, z = (p[i].z + p[i].tx * o) * s; if (i) g.lineTo(x, z); else g.moveTo(x, z); } };
    for (const r of S.roads) {                                                 // 车道线：放大了才画全，缩小时只画对向分隔线
      const li = laneInfo(r), ls = li.lanes, car = t => t === 'F' || t === 'B'; g.globalAlpha = r.m === 2 ? 0.5 : 1;
      for (const l of ls) if (l.t === 'X' || l.t === 'M') { offPath(r, l.o); g.strokeStyle = l.t === 'M' ? T.mute : T.walk; g.lineWidth = (l.w - 0.4) * s; g.setLineDash(l.t === 'X' ? [2 * s, 2 * s] : []); g.stroke(); }
      for (let i = 0; i < ls.length - 1; i++) {
        const a = ls[i], b = ls[i + 1]; if (a.t === 'M' || b.t === 'M') continue; const opp = car(a.t) && car(b.t) && a.t !== b.t; if (!opp && s < 1.1) continue;
        offPath(r, a.o + a.w / 2); g.strokeStyle = opp ? T.mark : '#E8ECF0'; g.lineWidth = Math.max(1, (opp ? 0.4 : 0.22) * s); g.setLineDash(car(a.t) && car(b.t) && !opp ? [3 * s, 5 * s] : []); g.stroke();
      }
      g.setLineDash([]);
      if (s > 0.45 && (!li.fwd.length || !li.back.length) && (li.fwd.length || li.back.length)) {      // 单行路：沿路画方向箭头
        const p = roadPts(r), sg = li.fwd.length ? 1 : -1; g.fillStyle = '#E8ECF0';
        for (let d = 18; d < p.len - 8; d += Math.max(40, 30 / s)) { const q = atDist(p, d), k = Math.min(r.w * 0.3, 3) * s; g.beginPath(); g.moveTo((q.x + q.tx * sg * 3) * s, (q.z + q.tz * sg * 3) * s); g.lineTo(q.x * s - q.tz * k - q.tx * sg * k, q.z * s + q.tx * k - q.tz * sg * k); g.lineTo(q.x * s + q.tz * k - q.tx * sg * k, q.z * s - q.tx * k - q.tz * sg * k); g.fill(); }
      }
    }
    g.globalAlpha = 1; g.setLineDash([]);
    for (const n of J.nodes) {
      if (n.poly) for (const [P, col] of [[n.polyW, T.walk], [n.poly, T.road]]) { g.fillStyle = col; g.beginPath(); P.forEach((p, i) => i ? g.lineTo(p[0] * s, p[1] * s) : g.moveTo(p[0] * s, p[1] * s)); g.closePath(); g.fill(); }
      else { g.fillStyle = T.road; g.beginPath(); g.arc(n.x * s, n.z * s, (n.R + 0.5) * s, 0, TAU); g.fill(); }
      if (s > 0.6) for (const a of n.arms) { const q = armPoint(a, a.sb); if (!q) continue; const hw = a.r.w / 2 - 0.4;
        g.strokeStyle = '#E8ECF0'; g.lineWidth = 2.6 * s; g.setLineDash([0.6 * s, 0.6 * s]); g.beginPath(); g.moveTo((q.x - q.tz * hw) * s, (q.z + q.tx * hw) * s); g.lineTo((q.x + q.tz * hw) * s, (q.z - q.tx * hw) * s); g.stroke(); }
    }
    g.setLineDash([]); g.lineCap = 'round';
    const drawB = b => { g.save(); g.translate(b.x * s, b.z * s); g.rotate(b.r); if (b.sx) g.scale(b.sx, 1); drawAssetPlan(g, S.assets[b.a], s); g.restore(); };
    for (const b of S.blds) drawB(b);
    if (s > 1.4) { g.font = '600 11px Barlow Condensed, sans-serif'; g.textAlign = 'center'; for (const b of S.blds) if (b.t && S.assets[b.a].label) { g.fillStyle = T.panel; const tx = b.t.split('|')[0], wd = g.measureText(tx).width + 8; g.fillRect(b.x * s - wd / 2, b.z * s + 6, wd, 14); g.fillStyle = T.ink; g.fillText(tx, b.x * s, b.z * s + 17); } }
    if (sim.on && sim.net && !sim.dirty) {
      const net = sim.net;
      if (sim.heat) { g.lineCap = 'butt'; g.globalAlpha = 0.5;                 // 拥堵热力：每个行车方向按“车速 ÷ 设计车速”上色，没车的方向不画
        for (let rd = 0; rd < net.n2; rd++) { if (!net.rdN[rd] || (!net.cnt[rd] && net.cong[rd] > 0.93)) continue; const l0 = net.rdL0[rd], o0 = net.laneOff[l0], o1 = net.laneOff[l0 + net.rdN[rd] - 1], c = heatCol(net.cong[rd]);
          offPath(net.roads[rd >> 1], (o0 + o1) / 2); g.strokeStyle = `rgb(${c[0]},${c[1]},${c[2]})`; g.lineWidth = Math.max(3, (Math.abs(o1 - o0) + 2.2) * s); g.stroke(); }
        g.globalAlpha = 1; g.lineCap = 'round'; }
      if (s > 0.7) for (const nd of net.nodes) { if (!nd.steps) continue; const st = nd.steps[simStepOf(nd)];                 // 红绿灯：每个进口一个小圆点
        for (const a of nd.arms) { if (!a.has) continue; const bits = st.g.get(a.rd) | 0; g.fillStyle = bits === 7 ? '#2E9B57' : bits ? '#E3A400' : '#C8402E'; g.beginPath(); g.arc((a.x - a.hx * 9) * s, (a.z - a.hz * 9) * s, clamp(1.6 * s, 3, 7), 0, TAU); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke(); } }
    }
    if (ui.tool === 'junction') for (const n of J.nodes) {                     // 路口工具：所有可设置的路口画一圈，选中的加粗并标出各进口和车道连接
      const selN = nodeKeyOf(n) === ui.node, rr = Math.max(n.R, ...n.arms.map(a => a.sb)) + 4; g.strokeStyle = selN ? T.sel : T.accent; g.lineWidth = selN ? 3 : 1.5; g.setLineDash(selN ? [] : [5, 4]); g.beginPath(); g.arc(n.x * s, n.z * s, rr * s, 0, TAU); g.stroke(); g.setLineDash([]);
      if (!selN) continue;
      g.font = '600 12px Barlow Condensed, sans-serif'; g.textAlign = 'center'; for (const a of jxArms(n)) { const x = (a.x - a.hx * (rr + 14)) * s, z = (a.z - a.hz * (rr + 14)) * s; g.fillStyle = T.panel; g.fillRect(x - 26, z - 9, 52, 16); g.fillStyle = T.ink; g.fillText(a.name, x, z + 3); }
      const ln = jxLanes(n), lc = ((S.env.jx || {})[ui.node] || {}).lc || {}, rad = clamp(1.3 * s, 4, 9), outBy = new Map(ln.outs.map(o => [o.key, o]));
      for (const q of ln.ins) for (const t of lc[q.key] || []) { const o = outBy.get(t); if (!o) continue; const on = q.key === ui.jl; g.strokeStyle = on ? T.sel : T.accent; g.lineWidth = on ? 3 : 1.5; g.beginPath(); g.moveTo(q.x * s, q.z * s); g.quadraticCurveTo(n.x * s, n.z * s, o.x * s, o.z * s); g.stroke(); }
      for (const o of ln.outs) { g.beginPath(); g.arc(o.x * s, o.z * s, rad, 0, TAU); g.fillStyle = T.panel; g.fill(); g.strokeStyle = T.ink; g.lineWidth = 2; g.stroke(); }
      for (const q of ln.ins) { const on = q.key === ui.jl; g.beginPath(); g.arc(q.x * s, q.z * s, rad * (on ? 1.4 : 1), 0, TAU); g.fillStyle = on ? T.sel : lc[q.key] ? T.accent : T.mute; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke(); }
    }
    if (sim.on && sim.instN) {                                                 // 人和车在平面图上是小方点
      const F = sim.inst, U8 = sim.instU;
      for (let c = 0; c < sim.instN; c++) { const u = c * 20 + 16, k = U8[u + 3]; if (k === 1) continue; g.fillStyle = `rgb(${U8[u]},${U8[u + 1]},${U8[u + 2]})`; const d = k === 2 ? Math.max(2, 0.7 * s) : Math.max(3, 2.2 * s); g.fillRect(F[c * 5] * s - d / 2, F[c * 5 + 2] * s - d / 2, d, d); }
    }
    if (ui.tool === 'build' && ui.hover && !ui.drag) { g.globalAlpha = 0.6; drawB(poseAt(ui.hover)); g.globalAlpha = 1; }
    if (pathTool() && ui.hover) {
      const p = pathPt(ui.hover), w = pathW();
      if (ui.rs) {
        g.strokeStyle = T.accent; g.globalAlpha = 0.6; g.lineWidth = w * s; const curve = $('#roadMode').value === 'curve', h = ui.hover, M = q => g.moveTo(q[0] * s, q[1] * s), Ln = q => g.lineTo(q[0] * s, q[1] * s);
        if (curve && !ui.rc) { g.globalAlpha = 1; g.lineWidth = 2; g.setLineDash([9, 7]); g.beginPath(); M(ui.rs); Ln(h); g.stroke(); g.setLineDash([]); }
        else {
          g.beginPath(); M(ui.rs); if (ui.rc) g.quadraticCurveTo(ui.rc[0] * s, ui.rc[1] * s, p[0] * s, p[1] * s); else Ln(p); g.stroke(); g.globalAlpha = 1;
          if (ui.rc) { g.strokeStyle = T.sel; g.lineWidth = 1.5; g.setLineDash([6, 5]); g.beginPath(); M(ui.rs); Ln(ui.rc); Ln(p); g.stroke(); g.setLineDash([]); }
        }
        const len = Math.hypot(p[0] - ui.rs[0], p[1] - ui.rs[1]);
        g.font = '600 13px Barlow Condensed, sans-serif'; g.fillStyle = T.ink; g.textAlign = 'left'; g.fillText(Math.round(len) + ' m', p[0] * s + 10, p[1] * s - 10);
      }
      g.fillStyle = T.accent; g.beginPath(); g.arc(p[0] * s, p[1] * s, 5, 0, TAU); g.fill();
    }
    if (ui.sel && ui.sel.k === 'road' && S.roads[ui.sel.i]) {
      const r = S.roads[ui.sel.i], m = roadMid(r);
      roadPath(g, r, s); g.strokeStyle = T.sel; g.lineWidth = 2; g.stroke();
      g.setLineDash([4, 4]); g.lineWidth = 1; g.beginPath(); g.moveTo(r.a[0] * s, r.a[1] * s); g.lineTo(r.b[0] * s, r.b[1] * s); g.stroke(); g.setLineDash([]);
      for (const e of [r.a, r.b]) { g.beginPath(); g.arc(e[0] * s, e[1] * s, 6, 0, TAU); g.fillStyle = T.panel; g.fill(); g.lineWidth = 2; g.strokeStyle = T.sel; g.stroke(); }
      g.save(); g.translate(m[0] * s, m[1] * s); g.rotate(Math.PI / 4); g.fillStyle = T.accent; g.fillRect(-6, -6, 12, 12); g.strokeStyle = T.ink; g.lineWidth = 1.5; g.strokeRect(-6, -6, 12, 12); g.restore();
    }
    if (ui.cand) {                                                             // 预选：虚线
      g.strokeStyle = T.accent; g.lineWidth = 2; g.setLineDash([6, 5]);
      if (ui.cand.k === 'road' && S.roads[ui.cand.i]) { roadPath(g, S.roads[ui.cand.i], s); g.stroke(); }
      if (ui.cand.k === 'bld' && S.blds[ui.cand.i]) { const b = S.blds[ui.cand.i], f = fp(S.assets[b.a]); g.save(); g.translate(b.x * s, b.z * s); g.rotate(b.r); g.strokeRect(-f.w / 2 * s - 3, -f.d / 2 * s - 3, f.w * s + 6, f.d * s + 6); g.restore(); }
      g.setLineDash([]);
    }
    if (ui.sel && ui.sel.k === 'bld' && S.blds[ui.sel.i]) {
      const b = S.blds[ui.sel.i], f = fp(S.assets[b.a]);
      g.save(); g.translate(b.x * s, b.z * s); g.rotate(b.r); g.strokeStyle = T.sel; g.lineWidth = 2; g.strokeRect(-f.w / 2 * s - 3, -f.d / 2 * s - 3, f.w * s + 6, f.d * s + 6); g.restore();
    }
    if (ui.tool === 'terrain' && ui.hover) {
      const h = ui.hover, r = numIn('tb-rad', 150, 20, 4000);
      if (ui.tmode === 'brush' || ui.tmode === 'tree') { g.strokeStyle = T.accent; g.lineWidth = 2; g.beginPath(); g.arc(h[0] * s, h[1] * s, (ui.tmode === 'tree' ? numIn('tr-rad', 200, 20, 4000) : r) * s, 0, TAU); g.stroke(); }
      g.font = '600 13px Barlow Condensed, sans-serif'; g.fillStyle = T.ink; g.textAlign = 'left'; g.fillText('海拔 ' + elevAt(h[0], h[1]).toFixed(1) + ' m', h[0] * s + 10, h[1] * s - 10);
    }
    if (ui.tool === 'terrain') for (const q of S.env.src) {
      g.fillStyle = T.sel; g.strokeStyle = T.panel; g.lineWidth = 2; g.beginPath(); g.arc(q.x * s, q.z * s, 6, 0, TAU); g.fill(); g.stroke();
      g.font = '600 12px Barlow Condensed, sans-serif'; g.fillStyle = T.ink; g.textAlign = 'left'; g.fillText('水面 ' + q.h + ' m', q.x * s + 10, q.z * s + 4);
    }
    // 实景相机在图上的位置与朝向
    const cb = camBasis(camCity), ex = camCity.tx * s, ez = camCity.tz * s, ang = Math.atan2(cb.f[2], cb.f[0]);
    g.save(); g.translate(ex, ez); g.rotate(ang); g.strokeStyle = T.sel; g.fillStyle = T.sel; g.globalAlpha = 0.85; g.lineWidth = 1.5;
    g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(15, 0); g.lineTo(7, -4.5); g.lineTo(7, 4.5); g.fill(); g.restore();
  }
  g.restore();
  // 比例尺与指北
  let m = 90 / s, e = Math.pow(10, Math.floor(Math.log10(m))); m = m / e >= 5 ? 5 * e : m / e >= 2 ? 2 * e : e;
  const bw = m * s, bx = W - 14 - bw, by = 22;
  g.strokeStyle = T.ink; g.fillStyle = T.ink; g.lineWidth = 1.5; g.beginPath(); g.moveTo(bx, by - 4); g.lineTo(bx, by); g.lineTo(bx + bw, by); g.lineTo(bx + bw, by - 4); g.stroke();
  g.font = '600 12px Barlow Condensed, sans-serif'; g.textAlign = 'right'; g.fillText(m + ' m', bx + bw, by - 7);
  if (!shop.open) { g.textAlign = 'center'; g.fillText('N', bx - 18, by + 1); g.beginPath(); g.moveTo(bx - 18, by - 22); g.lineTo(bx - 22, by - 11); g.lineTo(bx - 14, by - 11); g.fill(); }
}
