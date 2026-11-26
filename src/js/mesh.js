/* ───────── 网格：一个可增长的交错顶点缓冲，20 字节/顶点 ───────── */
class Mesh {
  constructor(cap) { this.cap = cap; this.n = 0; this.u = null; this.alloc(); }
  alloc() { const b = new ArrayBuffer(this.cap * 20), u = new Uint8Array(b); if (this.u) u.set(this.u.subarray(0, this.n * 20)); this.b = b; this.u = u; this.f = new Float32Array(b); this.i = new Int8Array(b); }
  v(p, nx, ny, nz, c, a) {
    if (this.n >= this.cap) { this.cap *= 2; this.alloc(); }
    const o = this.n * 20, fo = this.n * 5;
    this.f[fo] = p[0]; this.f[fo + 1] = p[1]; this.f[fo + 2] = p[2];
    this.i[o + 12] = nx * 127; this.i[o + 13] = ny * 127; this.i[o + 14] = nz * 127;
    this.u[o + 16] = c[0]; this.u[o + 17] = c[1]; this.u[o + 18] = c[2]; this.u[o + 19] = a; this.n++;
  }
}
function tri(m, a, b, c, col, mat, ctr) {
  let nx = 0, ny = 1, nz = 0;
  if (ctr) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    nx = uy * vz - uz * vy; ny = uz * vx - ux * vz; nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    if (nx * ((a[0] + b[0] + c[0]) / 3 - ctr[0]) + ny * ((a[1] + b[1] + c[1]) / 3 - ctr[1]) + nz * ((a[2] + b[2] + c[2]) / 3 - ctr[2]) < 0) { nx = -nx; ny = -ny; nz = -nz; }
  }
  m.v(a, nx, ny, nz, col, mat); m.v(b, nx, ny, nz, col, mat); m.v(c, nx, ny, nz, col, mat);
}
const ID_TF = (x, y, z) => [x, y, z];
function emitPart(m, p, tf, colOverride) {
  const cr = Math.cos((p.r || 0) * D2R), sr = Math.sin((p.r || 0) * D2R);
  const L = (lx, ly, lz) => tf(p.x + lx * cr - lz * sr, p.y + ly, p.z + lx * sr + lz * cr);
  const col = colOverride || hex2rgb(p.c), mat = p.mat || (p.win ? 128 : 255), hw = p.w / 2, hd = p.d / 2, h = p.h;
  const ctr = L(0, p.s === 'box' || p.s === 'cyl' ? h / 2 : h / 4, 0);
  const T = (a, b, c) => tri(m, a, b, c, col, mat, ctr), Q = (a, b, c, d) => { T(a, b, c); T(a, c, d); };
  if (p.s === 'cyl' || p.s === 'cone') {
    const N = 12, top = L(0, h, 0);
    for (let i = 0; i < N; i++) {
      const a0 = i / N * TAU, a1 = (i + 1) / N * TAU, x0 = Math.cos(a0) * hw, z0 = Math.sin(a0) * hd, x1 = Math.cos(a1) * hw, z1 = Math.sin(a1) * hd;
      if (p.s === 'cone') T(L(x0, 0, z0), L(x1, 0, z1), top);
      else { Q(L(x0, 0, z0), L(x1, 0, z1), L(x1, h, z1), L(x0, h, z0)); T(L(x0, h, z0), L(x1, h, z1), top); }
    }
    return;
  }
  const b0 = L(-hw, 0, -hd), b1 = L(hw, 0, -hd), b2 = L(hw, 0, hd), b3 = L(-hw, 0, hd);
  if (p.s === 'box') {
    const t0 = L(-hw, h, -hd), t1 = L(hw, h, -hd), t2 = L(hw, h, hd), t3 = L(-hw, h, hd);
    Q(b0, b1, t1, t0); Q(b1, b2, t2, t1); Q(b2, b3, t3, t2); Q(b3, b0, t0, t3); Q(t0, t1, t2, t3);
  } else if (p.s === 'gable') {
    const r0 = L(-hw, h, 0), r1 = L(hw, h, 0);
    Q(b0, b1, r1, r0); Q(b3, b2, r1, r0); T(b0, b3, r0); T(b1, b2, r1);
  } else { const a = L(0, h, 0); T(b0, b1, a); T(b1, b2, a); T(b2, b3, a); T(b3, b0, a); }
}
function emitAsset(m, asset, b, col) {
  const c = Math.cos(b.r), s = Math.sin(b.r), y0 = H(b.x, b.z), tf = (x, y, z) => [b.x + x * c - z * s, y0 + y, b.z + x * s + z * c];
  for (const p of asset.parts) emitPart(m, p, tf, col);
}
function ribbon(m, pts, hw, y, col, mat, yf) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], ya = y + (yf ? yf(a) : H(a.x, a.z)), yb = y + (yf ? yf(b) : H(b.x, b.z));
    const al = [a.x - a.tz * hw, ya, a.z + a.tx * hw], ar = [a.x + a.tz * hw, ya, a.z - a.tx * hw], bl = [b.x - b.tz * hw, yb, b.z + b.tx * hw], br = [b.x + b.tz * hw, yb, b.z - b.tx * hw];
    tri(m, al, ar, br, col, mat); tri(m, al, br, bl, col, mat);
  }
}
function strip(m, pts, o0, o1, y, col, mat, yf) {                               // 路面上一条带子：横向从偏移 o0 到 o1（沿右手法线）
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], ya = y + (yf ? yf(a) : H(a.x, a.z)), yb = y + (yf ? yf(b) : H(b.x, b.z));
    const a0 = [a.x - a.tz * o0, ya, a.z + a.tx * o0], a1 = [a.x - a.tz * o1, ya, a.z + a.tx * o1], b0 = [b.x - b.tz * o0, yb, b.z + b.tx * o0], b1 = [b.x - b.tz * o1, yb, b.z + b.tx * o1];
    tri(m, a0, a1, b1, col, mat); tri(m, a0, b1, b0, col, mat);
  }
}
// 车道标线：同向车道之间白虚线，对向之间黄实线，应急车道和封闭车道用白实线隔开；每条车道隔一段画一个行驶方向箭头
function laneMarks(m, r, pts, y, d0, d1, yf) {
  const li = laneInfo(r), ls = li.lanes, hw = li.w / 2, mark = hex2rgb(W.mark), white = [232, 236, 240], car = t => t === 'F' || t === 'B';
  for (const l of ls) { if (l.t === 'X') strip(m, pts, l.o - l.w / 2 + 0.25, l.o + l.w / 2 - 0.25, y - 0.03, [150, 154, 158], 255, yf); else if (l.t === 'M') strip(m, pts, l.o - l.w / 2, l.o + l.w / 2, y + 0.16, CONC, 255, yf); }
  for (let i = 0; i < ls.length - 1; i++) {
    const a = ls[i], b = ls[i + 1], x = a.o + a.w / 2; if (a.t === 'M' || b.t === 'M') continue;
    if (car(a.t) && car(b.t)) { if (a.t === b.t) dashes(m, pts, x, y, white, d0, d1, yf); else strip(m, pts, x - 0.14, x + 0.14, y, mark, 255, yf); }
    else strip(m, pts, x - 0.09, x + 0.09, y, white, 255, yf);
  }
  if (!li.wl) strip(m, pts, -hw + 0.2, -hw + 0.38, y, white, 255, yf); if (!li.wr) strip(m, pts, hw - 0.38, hw - 0.2, y, white, 255, yf);
  for (const l of ls) if (car(l.t)) for (let d = 16; d < pts.len - 10; d += 80) {
    const p = atDist(pts, d), sg = l.t === 'F' ? 1 : -1, yy = y + (yf ? yf(p) : H(p.x, p.z)), cx = p.x - p.tz * l.o, cz = p.z + p.tx * l.o;
    tri(m, [cx + p.tx * sg * 2.4, yy, cz + p.tz * sg * 2.4], [cx - p.tx * sg * 1.2 - p.tz * 0.7, yy, cz - p.tz * sg * 1.2 + p.tx * 0.7], [cx - p.tx * sg * 1.2 + p.tz * 0.7, yy, cz - p.tz * sg * 1.2 - p.tx * 0.7], white, 255);
  }
}
function disc(m, x, z, rad, y, col, mat, base) {
  y += base != null ? base : H(x, z);
  for (let i = 0; i < 12; i++) { const a0 = i / 12 * TAU, a1 = (i + 1) / 12 * TAU; tri(m, [x, y, z], [x + Math.cos(a0) * rad, y, z + Math.sin(a0) * rad], [x + Math.cos(a1) * rad, y, z + Math.sin(a1) * rad], col, mat); }
}
function dashes(m, pts, off, y, col, d0, d1, yf) {
  for (let d = d0; d + 4 < pts.len - d1; d += 9) {
    const a = atDist(pts, d), b = atDist(pts, d + 4); let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    const ox = -tz * off, oz = tx * off, hw = 0.2, ya = y + (yf ? yf(a) : H(a.x, a.z)), yb = y + (yf ? yf(b) : H(b.x, b.z));
    const p = [[a.x + ox - tz * hw, ya, a.z + oz + tx * hw], [a.x + ox + tz * hw, ya, a.z + oz - tx * hw], [b.x + ox + tz * hw, yb, b.z + oz - tx * hw], [b.x + ox - tz * hw, yb, b.z + oz + tx * hw]];
    tri(m, p[0], p[1], p[2], col, 255); tri(m, p[0], p[2], p[3], col, 255);
  }
}
const CONC = [152, 156, 160], TH_T = 6.4;                                         // 混凝土色、隧道净高
let lampN = 0, tunSeg = { a: new Float32Array(192), b: new Float32Array(192), n: 0 };
function emitRoad(m, r) {
  const pts = roadPts(r), hw = r.w / 2, walk = hex2rgb(W.walk), road = hex2rgb(W.road), mark = hex2rgb(W.mark), white = [232, 236, 240];
  const yf = r.h ? p => hAt(r.h, p.t) : null, L = r.h ? 0.35 : lift(), ya = r.h ? r.h[0] : null, yb = r.h ? r.h[r.h.length - 1] : null;
  if (r.m === 2) return emitTunnel(m, r, pts, yf);
  const li = laneInfo(r), sw = li.wl || li.wr ? LW.W : 0;
  ribbon(m, pts, hw, L + 0.14, road, 255, yf);
  if (li.wl) strip(m, pts, -hw - LW.W, -hw, L + 0.26, walk, 255, yf); if (li.wr) strip(m, pts, hw, hw + LW.W, L + 0.26, walk, 255, yf);
  for (const [e, y] of [[r.a, ya], [r.b, yb]]) disc(m, e[0], e[1], hw, L + 0.14, road, 255, y);
  const je = J.ends.get(r), d0 = je && je.a ? je.a + 5 : 3, d1 = je && je.b ? je.b + 5 : 0;           // 标线在路口前停住
  laneMarks(m, r, pts, L + 0.22, d0, d1, yf);
  const Y = p => yf ? yf(p) : H(p.x, p.z);
  if (r.m === 1) {                                                             // 桥：桥面板、两侧挡板和栏杆、够高的地方立桥墩
    const w = hw + sw + 0.3, side = (p, sg, y) => [p.x - p.tz * w * sg, y, p.z + p.tx * w * sg];
    ribbon(m, pts, w, L - 1.3, CONC, 255, yf);
    for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], A = Y(a) + L, B = Y(b) + L, ctr = [(a.x + b.x) / 2, (A + B) / 2, (a.z + b.z) / 2];
      for (const sg of [1, -1]) { const q = [side(a, sg, A - 1.3), side(b, sg, B - 1.3), side(b, sg, B + 1.1), side(a, sg, A + 1.1)]; tri(m, q[0], q[1], q[2], CONC, 255, ctr); tri(m, q[0], q[2], q[3], CONC, 255, ctr); } }
    for (let d = 22; d < pts.len - 18; d += 44) { const p = atDist(pts, d), g = H(p.x, p.z), top = Y(p) + L - 1.3; if (top - g > 2.5) emitPart(m, { s: 'box', x: p.x, z: p.z, y: g - 2, w: Math.min(hw * 1.4, 7), d: 2.2, h: top - g + 2, r: Math.atan2(p.tx, -p.tz) / D2R }, ID_TF, CONC); }
  }
  // 路灯：每 34 m 一盏，左右交替；灯头是不受光照影响的发光面
  const pole = [72, 78, 86], glow = hex2rgb(W.lit); let sg = 1;
  for (let d = (je && je.a ? je.a + 9 : 12); d < pts.len - (je && je.b ? je.b + 9 : 12) && lampN < 1500; d += 34, sg = -sg, lampN++) {
    const p = atDist(pts, d), y = Y(p) + L, nx = -p.tz * sg, nz = p.tx * sg, at = k => [p.x + nx * k, p.z + nz * k], rot = Math.atan2(p.tx, -p.tz) / D2R, P = at(hw + (sw ? 0.9 : 0.45)), A = at(hw - 0.3), G = at(hw - 1.1);
    emitPart(m, { s: 'box', x: P[0], z: P[1], y, w: 0.24, d: 0.24, h: 6.6 }, ID_TF, pole);
    emitPart(m, { s: 'box', x: A[0], z: A[1], y: y + 6.5, w: 2, d: 0.16, h: 0.14, r: rot }, ID_TF, pole);
    emitPart(m, { s: 'box', x: G[0], z: G[1], y: y + 6.34, w: 1, d: 0.4, h: 0.16, r: rot, mat: 240 }, ID_TF, glow);
  }
}
// 隧道：路面、两侧内壁、拱顶和一条灯带。面是双面的，从洞口能看进去；路口处墙留出开口，由圆形的路口大厅接上
function emitTunnel(m, r, pts, yf) {
  const hw = r.w / 2, wi = hw + 0.8, road = hex2rgb(W.road), mark = hex2rgb(W.mark), wallc = [176, 178, 176], roofc = [128, 131, 134], lamp = hex2rgb(W.lit);
  const hall = J.hall.get(r) || { a: 0, b: 0 }, je = J.ends.get(r);
  ribbon(m, pts, wi, 0.1, road, 255, yf); ribbon(m, pts, wi, TH_T, roofc, 255, yf); ribbon(m, pts, 0.4, TH_T - 0.06, lamp, 240, yf);
  laneMarks(m, r, pts, 0.18, je && je.a ? je.a + 5 : 3, je && je.b ? je.b + 5 : 0, yf);
  const d0 = hall.a, d1 = pts.len - hall.b; if (d1 - d0 < 1) return;
  const n = Math.max(1, Math.ceil((d1 - d0) / 9)), P = []; for (let i = 0; i <= n; i++) P.push(atDist(pts, d0 + (d1 - d0) * i / n));
  for (let i = 0; i < n; i++) { const a = P[i], b = P[i + 1], A = yf(a), B = yf(b);
    for (const sg of [1, -1]) { const S0 = (p, y) => [p.x - p.tz * wi * sg, y, p.z + p.tx * wi * sg], q = [S0(a, A), S0(b, B), S0(b, B + TH_T), S0(a, A + TH_T)], out = [a.x - a.tz * 60 * sg, A, a.z + a.tx * 60 * sg];
      tri(m, q[0], q[1], q[2], wallc, 255, out); tri(m, q[0], q[2], q[3], wallc, 255, out); } }
  for (const [e, hl] of [['a', hall.a], ['b', hall.b]]) {                       // 洞门：两根门柱加一道门楣
    if (hl) continue; const p = e === 'a' ? P[0] : P[n], y = yf(p), rot = Math.atan2(p.tx, -p.tz) / D2R, at = k => [p.x - p.tz * k, p.z + p.tx * k];
    for (const sg of [1, -1]) { const c = at((wi + 0.7) * sg); emitPart(m, { s: 'box', x: c[0], z: c[1], y: y - 0.5, w: 1.4, d: 1.6, h: TH_T + 2, r: rot }, ID_TF, CONC); }
    emitPart(m, { s: 'box', x: p.x, z: p.z, y: y + TH_T, w: wi * 2 + 2.8, d: 1.6, h: 1.5, r: rot }, ID_TF, CONC);
  }
}
// 隧道洞口附近，地形会伸进洞里：把这些路段交给着色器，在洞身范围内挖掉地形
function tunnelHoles() {
  const A = tunSeg.a, B = tunSeg.b; let n = 0;
  for (const r of S.roads) {
    if (r.m !== 2 || !r.h || !TH) continue; const pts = roadPts(r), wi = r.w / 2 + 0.8, cover = d => { const p = atDist(pts, d); return H(p.x, p.z) - hAt(r.h, p.t); };
    const add = (d0, d1) => { if (n >= 48) return; const p = atDist(pts, d0), q = atDist(pts, d1); A.set([p.x, p.z, q.x, q.z], n * 4); B.set([hAt(r.h, p.t), hAt(r.h, q.t), wi, TH_T + 0.7], n * 4); n++; };
    const step = 22, half = pts.len / 2;
    for (const dir of [1, -1]) for (let d = 0; d < half; d += step) { const u = Math.min(d + step, half); if (d > 0 && cover(dir > 0 ? d : pts.len - d) > TH_T + 3) break; if (dir > 0) add(d, u); else add(pts.len - u, pts.len - d); }
  }
  tunSeg.n = n;
}
function emitJunctions(m) {
  const road = hex2rgb(W.road), white = [232, 236, 240];
  for (const n of J.nodes) {
    const L = n.y != null ? 0.35 : lift();
    disc(m, n.x, n.z, n.R + 0.5, L + 0.25, road, 255, n.y);
    for (const a of n.arms) {                                                  // 每个进口一条斑马线
      const q = armPoint(a, n.R); if (!q) continue; const hw = a.r.w / 2, y = L + 0.27 + roadYAt(a.r, q.t, q.x, q.z);
      for (let o = -hw + 0.7; o <= hw - 0.7; o += 1.2) {
        const cx = q.x - q.tz * o, cz = q.z + q.tx * o, P = (u, v) => [cx + q.tx * u - q.tz * v, y, cz + q.tz * u + q.tx * v];
        const p0 = P(-1.3, -0.3), p1 = P(1.3, -0.3), p2 = P(1.3, 0.3), p3 = P(-1.3, 0.3); tri(m, p0, p1, p2, white, 255); tri(m, p0, p2, p3, white, 255);
      }
    }
    if (!n.tun) continue;                                                      // 隧道里的路口：一个圆形大厅，墙在每条路的方向上留门
    const rho = n.rho, y = n.y, wallc = [176, 178, 176], roofc = [128, 131, 134], far = [n.x, y - 400, n.z];
    disc(m, n.x, n.z, rho, 0.08, road, 255, y); disc(m, n.x, n.z, rho, TH_T, roofc, 255, y); disc(m, n.x, n.z, 2.2, TH_T - 0.06, hex2rgb(W.lit), 240, y);
    const gaps = n.arms.map(a => { const pts = roadPts(a.r), p = a.e === 'a' ? pts[0] : pts[pts.length - 1], sg = a.e === 'a' ? 1 : -1; return { th: Math.atan2(p.tz * sg, p.tx * sg), al: Math.asin(Math.min(0.99, (a.r.w / 2 + 0.8) / rho)) }; }).sort((p, q) => p.th - q.th);
    gaps.forEach((g, i) => {
      const nx = gaps[(i + 1) % gaps.length]; let t0 = g.th + g.al, t1 = nx.th - nx.al; if (i === gaps.length - 1) t1 += TAU; if (t1 - t0 < 0.02) return;
      const k = Math.max(1, Math.ceil((t1 - t0) / 0.22));
      for (let q = 0; q < k; q++) { const u0 = t0 + (t1 - t0) * q / k, u1 = t0 + (t1 - t0) * (q + 1) / k, W = (u, h) => [n.x + Math.cos(u) * rho, y + h, n.z + Math.sin(u) * rho], c = [n.x + Math.cos(u0) * rho * 3, y, n.z + Math.sin(u0) * rho * 3];
        tri(m, W(u0, 0), W(u1, 0), W(u1, TH_T), wallc, 255, c); tri(m, W(u0, 0), W(u1, TH_T), W(u0, TH_T), wallc, 255, c); }
    });
  }
}
function dashLine(m, a, b, hw, step, y, col) {
  const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz); if (len < 1) return; const tx = dx / len, tz = dz / len;
  for (let d = 0; d < len; d += step * 2) { const e = Math.min(len, d + step); ribbon(m, [{ x: a[0] + tx * d, z: a[1] + tz * d, tx, tz }, { x: a[0] + tx * e, z: a[1] + tz * e, tx, tz }], hw, y, col, 255); }
}
