/* ───────── 车道：一条路的横断面是一串车道，从左到右（面向 a→b） ─────────
   F 前行车道  B 逆行车道  S 应急车道（不走车）  X 封闭（不走车）  M 分隔带  W 人行道（只能在最外侧）
   r.ln 存这串字母；r.w 是不含人行道的路面宽度，始终由 r.ln 算出。右侧通行：双向路写成 “BBFF”。 */
const LW = { F: 3.5, B: 3.5, S: 2.5, X: 3.5, M: 1.2, W: 2 };
const LANE_NAME = { F: '车道 ↑', B: '车道 ↓', S: '应急车道', X: '封闭', M: '分隔带', W: '人行道' };
const LANE_CYCLE = 'FBSXM';
const ROAD_PRESETS = [['WBFW', '街道 · 双向 2 车道'], ['WBBFFW', '大道 · 双向 4 车道'], ['WBBBMFFFW', '主干道 · 双向 6 车道'], ['FFS', '快速路 · 单向 2 车道'], ['FFFS', '快速路 · 单向 3 车道'], ['FFFFS', '快速路 · 单向 4 车道'], ['FS', '匝道 · 单向 1 车道'], ['F', '连接线 · 单车道']];
const lanesOk = s => typeof s === 'string' && /^W?[FBSXM]{1,14}W?$/.test(s);
const liCache = new WeakMap();
function laneInfo(r) {                                                           // 每条车道的中心偏移（沿右手法线，左负右正）和宽度
  let li = liCache.get(r); if (li && li.ln === r.ln) return li;
  const ln = r.ln, wl = ln[0] === 'W', wr = ln.length > 1 && ln[ln.length - 1] === 'W', core = ln.slice(wl ? 1 : 0, wr ? -1 : undefined);
  let w = 0; for (const c of core) w += LW[c];
  const lanes = []; let x = -w / 2; for (const c of core) { lanes.push({ t: c, o: x + LW[c] / 2, w: LW[c] }); x += LW[c]; }
  li = { ln, w, wl, wr, core, lanes, fwd: lanes.filter(l => l.t === 'F'), back: lanes.filter(l => l.t === 'B') };
  liCache.set(r, li); return li;
}
function setLanes(r, ln) { r.ln = lanesOk(ln) ? ln : 'WBFW'; r.w = laneInfo(r).w; return r; }
function ensureLanes(r) { return setLanes(r, lanesOk(r.ln) ? r.ln : r.w >= 12 ? 'WBBFFW' : 'WBFW'); }
const roadSpeed = r => { const li = laneInfo(r), one = !li.fwd.length || !li.back.length, n = li.fwd.length + li.back.length; return one ? (n >= 2 ? 25 : 16) : n >= 4 ? 16 : 11; };   // 设计车速 m/s
// 把一条路整体平移 d 米（沿右手法线）。二次贝塞尔的平行线不是贝塞尔，这里取两端平移后切线的交点当新控制点，缓弯足够准
function offsetRoad(r, d) {
  const un = (x, z) => { const l = Math.hypot(x, z) || 1; return [x / l, z / l]; };
  let ta = un(r.c[0] - r.a[0], r.c[1] - r.a[1]), tb = un(r.b[0] - r.c[0], r.b[1] - r.c[1]);
  if (dist2(r.a, r.c) < 0.01) ta = un(r.b[0] - r.a[0], r.b[1] - r.a[1]); if (dist2(r.b, r.c) < 0.01) tb = ta;
  const a = [r.a[0] - ta[1] * d, r.a[1] + ta[0] * d], b = [r.b[0] - tb[1] * d, r.b[1] + tb[0] * d], den = ta[0] * tb[1] - ta[1] * tb[0];
  let c;
  if (Math.abs(den) < 1e-3) c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  else { const u = ((b[0] - a[0]) * tb[1] - (b[1] - a[1]) * tb[0]) / den; c = [a[0] + ta[0] * u, a[1] + ta[1] * u]; }
  return { a, c, b };
}
// 从第 k 条车道后面切开：变成并排的两条路，各自的车道还在原来的位置上。之后把其中一条的远端拖走，就是匝道
function peelRoad(r, k) {
  const li = laneInfo(r); if (k < 1 || k >= li.lanes.length) return null;
  const L = li.core.slice(0, k), Rt = li.core.slice(k); let wL = 0, wR = 0; for (const c of L) wL += LW[c]; for (const c of Rt) wR += LW[c];
  const mk = (ln, d) => setLanes({ ...offsetRoad(r, d), m: r.m | 0, h: r.h ? r.h.slice() : undefined }, ln);
  const left = mk((li.wl ? 'W' : '') + L, -li.w / 2 + wL / 2), right = mk(Rt + (li.wr ? 'W' : ''), li.w / 2 - wR / 2);
  S.roads.splice(S.roads.indexOf(r), 1, left, right); return [left, right];
}
function breakRoad(r, t) {                                                       // 在 t 处打断成前后两段，车道不变
  const u = 1 - t, X = [u * u * r.a[0] + 2 * u * t * r.c[0] + t * t * r.b[0], u * u * r.a[1] + 2 * u * t * r.c[1] + t * t * r.b[1]];
  return splitRoad(r, t, X);
}
function isLaneJoint(r, e) {                                                     // 这一端是不是“车道对齐的接头”：旁边紧挨着别的路的端点，但中心线端点不重合
  const P = r[e]; let near = false;
  for (const o of S.roads) { if (o === r) continue; for (const q of [o.a, o.b]) { const d = dist2(P, q); if (d < 0.3) return false; if (d < (r.w + o.w) / 2 + 1) near = true; } }
  return near;
}
