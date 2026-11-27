/* ───────── 道路几何：二次贝塞尔 a → c → b ───────── */
let ptsCache = new WeakMap();
function roadPts(r) {
  let out = ptsCache.get(r); if (out) return out;
  const mx = (r.a[0] + r.b[0]) / 2, mz = (r.a[1] + r.b[1]) / 2;
  const chord = Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]), bend = Math.hypot(r.c[0] - mx, r.c[1] - mz);
  let n = TH ? clamp(Math.ceil((chord + bend) / 10), bend < 0.5 ? 1 : 6, 64)   // 有地形时加密，好贴着地面起伏
    : bend < 0.5 ? 1 : clamp(Math.ceil((chord + bend) / 7), 6, 40);            // 平地上直路只用 1 段
  if (r.h && n < r.h.length - 1) n = r.h.length - 1;
  out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const x = u * u * r.a[0] + 2 * u * t * r.c[0] + t * t * r.b[0], z = u * u * r.a[1] + 2 * u * t * r.c[1] + t * t * r.b[1];
    let tx = 2 * u * (r.c[0] - r.a[0]) + 2 * t * (r.b[0] - r.c[0]), tz = 2 * u * (r.c[1] - r.a[1]) + 2 * t * (r.b[1] - r.c[1]);
    let l = Math.hypot(tx, tz); if (l < 1e-6) { tx = r.b[0] - r.a[0]; tz = r.b[1] - r.a[1]; l = Math.hypot(tx, tz) || 1; }
    out.push({ x, z, tx: tx / l, tz: tz / l, t });
  }
  let acc = 0; out[0].s = 0;
  for (let i = 1; i < out.length; i++) { acc += Math.hypot(out[i].x - out[i - 1].x, out[i].z - out[i - 1].z); out[i].s = acc; }
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const p of out) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.z < z0) z0 = p.z; if (p.z > z1) z1 = p.z; }
  out.bb = [x0, z0, x1, z1]; out.len = acc; ptsCache.set(r, out); return out;
}
function atDist(pts, d) {
  for (let i = 1; i < pts.length; i++) if (d <= pts[i].s || i === pts.length - 1) {
    const a = pts[i - 1], b = pts[i], l = (b.s - a.s) || 1, t = clamp((d - a.s) / l, 0, 1);
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, tx: (b.x - a.x) / l, tz: (b.z - a.z) / l, t: a.t + (b.t - a.t) * t };
  }
}
function nearRoad(r, x, z) {
  const p = roadPts(r); let best = null;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
    const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / l2, 0, 1), px = a.x + dx * t, pz = a.z + dz * t, d = Math.hypot(x - px, z - pz);
    if (!best || d < best.d) { const l = Math.sqrt(l2); best = { d, x: px, z: pz, tx: dx / l, tz: dz / l, t: (i + t) / (p.length - 1) }; }
  }
  return best;
}
const roadMid = r => [(r.a[0] + 2 * r.c[0] + r.b[0]) / 4, (r.a[1] + 2 * r.c[1] + r.b[1]) / 4];
function snapPt(w, skip) {                                                    // 先吸端点，再吸到路身上（接出丁字口），最后吸 2 m 网格
  let best = null, bd = ui.tol;
  for (const r of S.roads) { if (skip && skip.has(r)) continue; for (const e of [r.a, r.b]) { const d = Math.hypot(e[0] - w[0], e[1] - w[1]); if (d < bd) { bd = d; best = e; } } }
  if (best) return [best[0], best[1]];
  bd = Infinity;                                                              // 点在路面范围内（含一点余量）就吸到这条路的中线上
  for (const r of S.roads) { if (skip && skip.has(r)) continue; const n = nearRoad(r, w[0], w[1]); if (n && n.d < r.w / 2 + ui.tol * 0.5 && n.d < bd) { bd = n.d; best = [n.x, n.z]; } }
  return best || [Math.round(w[0] / 2) * 2, Math.round(w[1] / 2) * 2];
}
// ── 路口：相交处把路切开，三条以上路端汇合的点就是路口
const dist2 = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const farEnds = (r, X, m = 3) => dist2(X, r.a) > m && dist2(X, r.b) > m;
const hAt = (h, t) => { const f = clamp(t, 0, 1) * (h.length - 1), i = Math.min(f | 0, h.length - 2); return h[i] + (h[i + 1] - h[i]) * (f - i); };
const roadYAt = (r, t, x, z) => r.h ? hAt(r.h, t) : H(x, z);                    // 路面高度：有纵断面用纵断面，老路贴着地形
function splitRoad(r, t, X) {
  const sub = (t0, t1) => { if (!r.h) return undefined; const K = Math.max(1, Math.round((r.h.length - 1) * (t1 - t0))); return Array.from({ length: K + 1 }, (_, i) => Math.round(hAt(r.h, t0 + (t1 - t0) * i / K) * 10) / 10); };
  const l = { a: r.a.slice(), c: [r.a[0] + (r.c[0] - r.a[0]) * t, r.a[1] + (r.c[1] - r.a[1]) * t], b: X.slice(), w: r.w, ln: r.ln, m: r.m | 0, h: sub(0, t) };
  const q = { a: X.slice(), c: [r.c[0] + (r.b[0] - r.c[0]) * t, r.c[1] + (r.b[1] - r.c[1]) * t], b: r.b.slice(), w: r.w, ln: r.ln, m: r.m | 0, h: sub(t, 1) };
  S.roads.splice(S.roads.indexOf(r), 1, l, q); return [l, q];
}
// 纵断面：贴地的路取沿线地形并抹顺（两端钉住）；桥和隧道在两端之间走直线，桥再略微起拱
function setProfile(r, ya, yb) {
  const len = dist2(r.a, r.b) + dist2(r.c, [(r.a[0] + r.b[0]) / 2, (r.a[1] + r.b[1]) / 2]), K = clamp(Math.ceil(len / 12), 2, 48), h = new Array(K + 1);
  for (let i = 0; i <= K; i++) {
    const t = i / K, u = 1 - t;
    if (r.m) h[i] = ya + (yb - ya) * t + (r.m === 1 ? Math.min(5, len * 0.025) * Math.sin(Math.PI * t) : 0);
    else h[i] = elevAt(u * u * r.a[0] + 2 * u * t * r.c[0] + t * t * r.b[0], u * u * r.a[1] + 2 * u * t * r.c[1] + t * t * r.b[1]);
  }
  if (!r.m) { h[0] = ya; h[K] = yb; for (let q = 0; q < 8; q++) for (let i = 1; i < K; i++) h[i] = (h[i - 1] + 2 * h[i] + h[i + 1]) / 4; }
  r.h = h.map(v => Math.round(v * 10) / 10); ptsCache.delete(r);
}
function endY(p, skip) {                                                         // 新路端点的高度：接在别的路上就取那条路的高度，否则取地面
  for (const o of S.roads) { if (skip && skip.has(o)) continue; const n = nearRoad(o, p[0], p[1]); if (n && n.d < 0.7) return roadYAt(o, n.t, n.x, n.z); }
  return elevAt(p[0], p[1]);
}
// 修路自动平整地形：路面范围内的格点落到路面高度，两侧一段距离内放坡接回原地面
function gradeRoad(r) {
  if (!TH || r.m || !r.h) return;
  const hw = r.w / 2, core = hw + 3.5, out = core + Math.max(2.2 * CELL, 16), rect = canalField(r, out);
  for (let j = rect[2]; j <= rect[3]; j++) for (let i = rect[0]; i <= rect[1]; i++) {
    const o = j * VN + i, d = cTmp.d[o]; if (d >= out) continue; const y = hAt(r.h, cTmp.t[o]);
    if (d <= core) { TH[o] = y; if (TR) TR[o] = 0; } else TH[o] = y + (TH[o] - y) * sst(core, out, d);
  }
  cTmp = null; terr.copy = true; terrChanged(rect); if (S.env.lakes || S.env.rivers || S.env.src.length || S.env.canals.length) terrChanged(); saveTerr();
}
function pullEnd(r, X) { const e = dist2(X, r.a) < dist2(X, r.b) ? 'a' : 'b'; if (r[e][0] !== X[0] || r[e][1] !== X[1]) { r[e] = X.slice(); ptsCache.delete(r); } }
function crossAt(r, o) {
  const pr = roadPts(r), po = roadPts(o), A = pr.bb, B = po.bb;
  if (A[0] > B[2] + 1 || B[0] > A[2] + 1 || A[1] > B[3] + 1 || B[1] > A[3] + 1) return null;
  const lvl = (p, q, tp, tq, x, z) => Math.abs(roadYAt(p, tp, x, z) - roadYAt(q, tq, x, z)) < 2.5;                  // 高度差太大就是立体交叉，不算路口
  for (const [e, te] of [[r.a, 0], [r.b, 1]]) { const n = nearRoad(o, e[0], e[1]); if (n.d < 0.6 && farEnds(o, e) && lvl(r, o, te, n.t, n.x, n.z)) return { tr: null, to: n.t, X: e.slice() }; }     // r 的端点顶在 o 身上
  for (const [e, te] of [[o.a, 0], [o.b, 1]]) { const n = nearRoad(r, e[0], e[1]); if (n.d < 0.6 && farEnds(r, e) && lvl(o, r, te, n.t, n.x, n.z)) return { tr: n.t, to: null, X: e.slice() }; }
  for (let i = 0; i < pr.length - 1; i++) for (let j = 0; j < po.length - 1; j++) {
    const a = pr[i], b = pr[i + 1], c = po[j], d = po[j + 1], rx = b.x - a.x, rz = b.z - a.z, sx = d.x - c.x, sz = d.z - c.z, den = rx * sz - rz * sx;
    if (Math.abs(den) < 1e-9) continue;
    const u = ((c.x - a.x) * sz - (c.z - a.z) * sx) / den, v = ((c.x - a.x) * rz - (c.z - a.z) * rx) / den;
    if (u < 0 || u > 1 || v < 0 || v > 1) continue;
    const X = [a.x + rx * u, a.z + rz * u]; if (!lvl(r, o, (i + u) / (pr.length - 1), (j + v) / (po.length - 1), X[0], X[1])) continue;
    const okR = farEnds(r, X, o.w / 2 + 2.5), okO = farEnds(o, X, r.w / 2 + 2.5);   // 只伸过对方路面一点点的短头不算穿过，直接收到交点上
    if (!okR) pullEnd(r, X); if (!okO) pullEnd(o, X);
    if (okR || okO) return { tr: okR ? (i + u) / (pr.length - 1) : null, to: okO ? (j + v) / (po.length - 1) : null, X };
  }
  return null;
}
function normalizeRoads(list) {
  const q = list.slice(); let guard = 0;
  while (q.length && guard++ < 600) {
    const r = q.pop(); if (!S.roads.includes(r)) continue;
    for (const o of S.roads) {
      if (o === r) continue; const x = crossAt(r, o); if (!x) continue;
      if (x.to != null) q.push(...splitRoad(o, x.to, x.X));
      if (x.tr != null) q.push(...splitRoad(r, x.tr, x.X)); else q.push(r);
      break;
    }
  }
}
let J = { nodes: [], ends: new Map(), hall: new Map() };
function computeJ() {
  const map = new Map(), nodes = [], ends = new Map(), hall = new Map();
  for (const r of S.roads) for (const e of ['a', 'b']) { const k = Math.round(r[e][0] * 2) + ',' + Math.round(r[e][1] * 2); let l = map.get(k); if (!l) map.set(k, l = []); l.push({ r, e, y: roadYAt(r, e === 'a' ? 0 : 1, r[e][0], r[e][1]) }); }
  const groups = [];                                                           // 同一平面位置上，高度相近的路端才算同一个节点（桥和桥下的路不相连）
  for (const l of map.values()) { l.sort((p, q) => p.y - q.y); let g = [l[0]]; for (let i = 1; i < l.length; i++) { if (l[i].y - l[i - 1].y > 2.5) { groups.push(g); g = []; } g.push(l[i]); } groups.push(g); }
  for (const arms of groups) if (arms.length >= 3) {
    const R = Math.max(...arms.map(a => a.r.w)) / 2 + 1, a0 = arms[0], p = a0.r[a0.e], tun = arms.every(a => a.r.m === 2 && a.r.h), rho = R * 1.7 + 3;
    const node = { x: p[0], z: p[1], R, arms, y: a0.r.h ? a0.r.h[a0.e === 'a' ? 0 : a0.r.h.length - 1] : null, tun, rho, poly: null, polyW: null };
    // 路口的形状：每条路从中心往外退一段（退距），退到相邻两条路的路缘不再重叠为止；相邻路缘之间用圆角连起来
    for (const a of arms) { const pts = roadPts(a.r), q = a.e === 'a' ? pts[0] : pts[pts.length - 1], sg = a.e === 'a' ? 1 : -1, li = laneInfo(a.r);
      a.dx = q.tx * sg; a.dz = q.tz * sg; a.ang = Math.atan2(a.dz, a.dx); a.hw = a.r.w / 2; a.hwW = a.hw + (li.wl || li.wr ? LW.W : 0); a.len = pts.len; }
    arms.sort((p1, p2) => p1.ang - p2.ang);
    const n = arms.length;
    for (let i = 0; i < n; i++) { const a = arms[i]; let need = 0;
      for (const b of [arms[(i + 1) % n], arms[(i + n - 1) % n]]) { const cs = a.dx * b.dx + a.dz * b.dz, sn = Math.abs(a.dx * b.dz - a.dz * b.dx); if (sn > 0.12) need = Math.max(need, (b.hwW + a.hwW * cs) / sn); else if (cs > 0) need = Math.max(need, 30); }
      a.sb = tun ? R : clamp(need + 1.5, 3, Math.min(45, a.len / 2.5)); }
    if (!tun) for (const [key, hk] of [['poly', 'hw'], ['polyW', 'hwW']]) { const P = [];
      for (let i = 0; i < n; i++) { const a = arms[i], b = arms[(i + 1) % n], cx = node.x + a.dx * a.sb, cz = node.z + a.dz * a.sb, bx = node.x + b.dx * b.sb, bz = node.z + b.dz * b.sb;
        const A = [cx + a.dz * a[hk], cz - a.dx * a[hk]], A2 = [cx - a.dz * a[hk], cz + a.dx * a[hk]], B = [bx + b.dz * b[hk], bz - b.dx * b[hk]];     // A：这条路靠上一条路的路缘角；A2：靠下一条路的；B：下一条路靠这边的
        P.push(A, A2);
        const den = a.dx * b.dz - a.dz * b.dx; let C = [(A2[0] + B[0]) / 2, (A2[1] + B[1]) / 2];
        if (Math.abs(den) > 0.12) { const u = ((B[0] - A2[0]) * b.dz - (B[1] - A2[1]) * b.dx) / den; if (u < 0 && u > -80) C = [A2[0] + a.dx * u, A2[1] + a.dz * u]; }                    // 两条路缘线的交点当圆角的控制点
        for (let k = 1; k < 5; k++) { const t = k / 5, u = 1 - t; P.push([u * u * A2[0] + 2 * u * t * C[0] + t * t * B[0], u * u * A2[1] + 2 * u * t * C[1] + t * t * B[1]]); } }
      node[key] = P; }
    nodes.push(node);
    for (const a of arms) { let o = ends.get(a.r); if (!o) ends.set(a.r, o = { a: 0, b: 0 }); o[a.e] = a.sb;
      if (tun) { let h = hall.get(a.r); if (!h) hall.set(a.r, h = { a: 0, b: 0 }); const wi = a.r.w / 2 + 0.8; h[a.e] = Math.sqrt(Math.max(0, rho * rho - wi * wi)); } }
  }
  J = { nodes, ends, hall };
}
function armPoint(a, R, extra) { const pts = roadPts(a.r), d = R + (extra == null ? 2.4 : extra); if (pts.len < 2 * R + 10) return null; return atDist(pts, a.e === 'a' ? d : pts.len - d); }
function trimPts(pts, d0, d1) {                                                  // 一条路去掉两头各一段之后的折线（路口范围内不画人行道）
  if (!d0 && !d1) return pts; const s0 = d0, s1 = pts.len - d1; if (s1 - s0 < 1) return [];
  const out = [atDist(pts, s0)]; for (const p of pts) if (p.s > s0 + 0.5 && p.s < s1 - 0.5) out.push(p); out.push(atDist(pts, s1)); return out;
}
// 路口各条进口车道、出口车道在停止线处的位置（车道连接器用）。编号 = 进口方向编号:从左数第几条
function jxLanes(n) {
  const ins = [], outs = [];
  for (const a of n.arms) { const pts = roadPts(a.r), q = atDist(pts, a.e === 'a' ? a.sb : pts.len - a.sb), li = laneInfo(a.r), ak = armKey(-a.dx, -a.dz);
    const inL = a.e === 'b' ? li.fwd : li.back.slice().reverse(), outL = a.e === 'a' ? li.fwd : li.back.slice().reverse();
    inL.forEach((l, k) => ins.push({ key: ak + ':' + k, x: q.x - q.tz * l.o, z: q.z + q.tx * l.o })); outL.forEach((l, k) => outs.push({ key: ak + ':' + k, x: q.x - q.tz * l.o, z: q.z + q.tx * l.o })); }
  return { ins, outs };
}
function snapToRoad(b) {
  const f = fp(S.assets[b.a]); let best = null, br = null;
  for (const r of S.roads) { const n = nearRoad(r, b.x, b.z); if (n && (!best || n.d - r.w / 2 < best.d - br.w / 2)) { best = n; br = r; } }
  if (!best || best.d > br.w / 2 + f.d / 2 + 14) return false;
  const nx = -best.tz, nz = best.tx, sg = ((b.x - best.x) * nx + (b.z - best.z) * nz) >= 0 ? 1 : -1, off = br.w / 2 + 3.5 + f.d / 2;
  b.x = best.x + nx * sg * off; b.z = best.z + nz * sg * off; b.r = Math.atan2(nx * sg, -nz * sg);
  return true;
}
function poseAt(w) {
  const b = { a: ui.asset, x: w[0], z: w[1], r: ui.rot }, as = S.assets[ui.asset];
  if (as.prop) { if (as.variants) b.st = ui.signStyle || 'us'; if (as.label) b.t = labelOf(as, b).def; if (ui.snap && as.sign) snapSign(b, as); } else if (ui.snap) snapToRoad(b);
  return b;
}
function snapSign(b, as) {                                                       // 路牌贴路：普通牌子立在路边、面向这一侧的来车；门架横跨整条路，宽度跟着路宽
  let best = null, br = null; for (const r of S.roads) { const n = nearRoad(r, b.x, b.z); if (n && n.d < r.w / 2 + 12 && (!best || n.d < best.d)) { best = n; br = r; } }
  if (!best) return; const li = laneInfo(br), nx = -best.tz, nz = best.tx, sg = ((b.x - best.x) * nx + (b.z - best.z) * nz) >= 0 ? 1 : -1;
  const fwdFacing = Math.atan2(best.tx, -best.tz), face = as.gantry ? (li.fwd.length ? 1 : -1) : !li.back.length ? 1 : !li.fwd.length ? -1 : sg;      // 面向哪个方向开来的车
  b.r = face > 0 ? fwdFacing : fwdFacing + Math.PI;
  if (as.gantry) { b.x = best.x; b.z = best.z; b.sx = Math.round((br.w + 3) / 14.5 * 100) / 100; }
  else { const off = br.w / 2 + (li.wl || li.wr ? 1.1 : 0.9); b.x = best.x + nx * sg * off; b.z = best.z + nz * sg * off; }
}
