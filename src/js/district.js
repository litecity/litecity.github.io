/* ───────── 圈一片地，说一句话，生成街区 ─────────
   三步：① 在平面图上圈出地块，程序量出这片地的情况（面积、坡度、高差、水面、周边道路）；
        ② 把“一句话 + 地块情况”变成一小组规划参数（有 Claude 时让它来定，没有就按关键词和地块情况定）；
        ③ 按参数用固定的规则，只在圈定范围内、避开水面和陡坡，生成路和建筑。
   生成出来的就是普通的路、路口和建筑，和手画的没有区别，所以所有工具都能接着改；参数也摆在面板上，可以调了再生成。 */
const DS_DEF = { layout: 'grid', block: 110, res: 50, com: 20, off: 15, ind: 5, park: 10, den: 0.5, trees: true, seed: 1 };
let dsSite = null, dsLast = null;                                                // 当前圈定的地块；上一次生成的记录（用来“换个样子重新生成”）
function dsRead() {
  return { layout: $('#ds-layout').value, block: numIn('ds-block', 110, 60, 220), res: numIn('ds-res', 50, 0, 100), com: numIn('ds-com', 20, 0, 100), off: numIn('ds-off', 15, 0, 100), ind: numIn('ds-ind', 5, 0, 100), park: numIn('ds-park', 10, 0, 100),
    den: numIn('ds-den', 0.5, 0, 1), trees: $('#ds-trees').checked, seed: numIn('ds-seed', 1, 0, 1e6) | 0 };
}
function dsWrite(s) {
  const v = { ...DS_DEF, ...s }; $('#ds-layout').value = ['grid', 'radial', 'organic'].includes(v.layout) ? v.layout : 'grid';
  for (const k of ['block', 'res', 'com', 'off', 'ind', 'park', 'den', 'seed']) if (Number.isFinite(+v[k])) $('#ds-' + k).value = +v[k];
  $('#ds-trees').checked = !!v.trees;
}
// ── 地块：多边形、朝向、外接尺寸，以及这片地的情况
const inPoly = (P, x, z) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > z) !== (P[j][1] > z) && x < (P[j][0] - P[i][0]) * (z - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c; return c; };
const slopeAt = (x, z) => TH ? Math.hypot(elevAt(x + 8, z) - elevAt(x - 8, z), elevAt(x, z + 8) - elevAt(x, z - 8)) / 16 : 0;
const waterAt = (x, z) => !!TH && (H(x, z) > elevAt(x, z) + 0.3 || (S.env.water != null && elevAt(x, z) < S.env.water));
function dsMakeSite(poly) {
  while (poly.length > 48) poly = poly.filter((_, i) => i % 2 === 0);              // 手画的线点太多，抽稀
  let area = 0, mx = 0, mz = 0; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { area += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1]; mx += poly[i][0]; mz += poly[i][1]; } area = Math.abs(area) / 2; mx /= poly.length; mz /= poly.length;
  // 朝向：旁边有路就顺着最近的那条路，否则取地块的长轴方向
  let rot = 0, nearest = null, adj = 0; const types = new Set();
  for (const r of S.roads) { const n = nearRoad(r, mx, mz); let touch = inPoly(poly, r.a[0], r.a[1]) || inPoly(poly, r.b[0], r.b[1]); if (!touch) for (const p of roadPts(r)) if (inPoly(poly, p.x, p.z)) { touch = true; break; }
    if (touch || n.d < Math.sqrt(area) * 0.9) { adj++; types.add(laneInfo(r).fwd.length + laneInfo(r).back.length >= 4 ? '大道' : '街道'); if (!nearest || n.d < nearest.d) nearest = n; } }
  if (nearest) rot = Math.atan2(nearest.tz, nearest.tx);
  else { let sxx = 0, szz = 0, sxz = 0; for (const p of poly) { sxx += (p[0] - mx) ** 2; szz += (p[1] - mz) ** 2; sxz += (p[0] - mx) * (p[1] - mz); } rot = 0.5 * Math.atan2(2 * sxz, sxx - szz); }
  const cs = Math.cos(rot), sn = Math.sin(rot); let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const p of poly) { const u = (p[0] - mx) * cs + (p[1] - mz) * sn, v = -(p[0] - mx) * sn + (p[1] - mz) * cs; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2, at = [mx + cu * cs - cv * sn, mz + cu * sn + cv * cs], w = u1 - u0, d = v1 - v0;
  // 在地块里撒一批采样点，量坡度、高差和水面
  const st = Math.max(12, Math.sqrt(area) / 16); let n = 0, lo = Infinity, hi = -Infinity, ss = 0, smax = 0, wet = 0, bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
  for (const p of poly) { bx0 = Math.min(bx0, p[0]); bx1 = Math.max(bx1, p[0]); bz0 = Math.min(bz0, p[1]); bz1 = Math.max(bz1, p[1]); }
  for (let z = bz0; z <= bz1; z += st) for (let x = bx0; x <= bx1; x += st) { if (!inPoly(poly, x, z)) continue; n++; const e = elevAt(x, z), s = slopeAt(x, z); lo = Math.min(lo, e); hi = Math.max(hi, e); ss += s; smax = Math.max(smax, s); if (waterAt(x, z)) wet++; }
  let inside = 0; for (const b of S.blds) if (inPoly(poly, b.x, b.z)) inside++;
  const ctx = { area_ha: +(area / 1e4).toFixed(1), width_m: Math.round(w), depth_m: Math.round(d), elev_min_m: n ? Math.round(lo) : 0, elev_max_m: n ? Math.round(hi) : 0, slope_mean_pct: n ? +(ss / n * 100).toFixed(1) : 0, slope_max_pct: +(smax * 100).toFixed(0),
    water_pct: n ? Math.round(wet / n * 100) : 0, roads_nearby: adj, nearby_road_types: [...types], buildings_already_inside: inside };
  return { poly, at, rot, w, d, area, ctx };
}
function dsEndLasso() {                                                          // 松手：圈出来的线变成地块；只是点了一下就给一块默认大小的方地
  let P = ui.lasso || []; ui.lasso = null;
  if (P.length < 6 || dsMakeSite(P.slice()).area < 3000) { const c = P[0] || ui.hover; if (!c) return; const cs = Math.cos(ui.rot), sn = Math.sin(ui.rot); P = [[-240, -180], [240, -180], [240, 180], [-240, 180]].map(q => [c[0] + q[0] * cs - q[1] * sn, c[1] + q[0] * sn + q[1] * cs]); }
  dsSite = dsMakeSite(P); dsShowSite(); req();
}
function dsShowSite() {
  const c = dsSite && dsSite.ctx;
  $('#ds-site').textContent = c ? `地块：${c.area_ha} 公顷（约 ${c.width_m}×${c.depth_m} m）· 海拔 ${c.elev_min_m}–${c.elev_max_m} m · 平均坡度 ${c.slope_mean_pct}%，最陡 ${c.slope_max_pct}% · 水面 ${c.water_pct}% · 周边道路 ${c.roads_nearby} 条` + (c.buildings_already_inside ? ` · 里面已有 ${c.buildings_already_inside} 个建筑` : '') : '还没有圈地。在平面图上按住拖动圈出一片地；只点一下则放一块 480×360 m 的方地。';
}
// 没有 AI 时：按关键词和地块情况定参数
function dsParse(text, ctx) {
  const s = { ...DS_DEF }, has = re => re.test(text);
  if (has(/环|放射|圆|广场为中心|radial/i)) s.layout = 'radial'; else if (has(/老城|古城|自然|弯|小镇|村|有机|organic/i) || (ctx && ctx.slope_mean_pct > 7)) s.layout = 'organic';      // 坡地用顺着地势的弯路
  const mix = { res: 0, com: 0, off: 0, ind: 0, park: 0 };
  if (has(/住宅|居民|居住|小区|公寓|别墅|宿舍|社区/)) mix.res += 70; if (has(/商业|商圈|步行街|购物|商店|夜市/)) mix.com += 45; if (has(/CBD|办公|金融|写字楼|总部|科技园/i)) mix.off += 50;
  if (has(/工业|工厂|厂区|物流|仓储|港口/)) mix.ind += 60; if (has(/公园|绿地|花园|生态|绿化/)) mix.park += 25;
  if (mix.res + mix.com + mix.off + mix.ind + mix.park > 0) { Object.assign(s, mix); if (mix.res && !mix.com) s.com = 8; if (!mix.ind && !mix.park) s.park = 10; }
  if (has(/高密度|密集|拥挤|高楼|摩天|高层/)) s.den = 0.85; else if (has(/低密度|稀疏|别墅|郊区|宽松|田园/)) s.den = 0.2; else if (ctx && ctx.slope_mean_pct > 10) s.den = 0.3;
  if (has(/别墅|郊区|小镇|村/)) s.block = 90; if (has(/CBD|金融|工业|厂区/i)) s.block = 140; if (ctx && ctx.area_ha < 6) s.block = Math.min(s.block, 80);
  s.trees = !has(/没有树|不要树|无树/); return s;
}
const DS_RULES = `你是城市规划助手。用户在地图上圈了一片地，并用一句话说了想建什么。请结合“地块情况”把这句话翻译成规划参数，只回复一个 JSON 对象，不要其他文字：
{"layout":"grid|radial|organic","block":110,"res":50,"com":20,"off":15,"ind":5,"park":10,"den":0.5,"trees":true}
含义：layout 路网形态（grid 方格网；radial 环形加放射；organic 略带弯曲、顺着地势的路网）；block 一个街块的边长（米，60–220；住宅区小，工业区和 CBD 大；地块小就取小值，保证至少能分出两三个街块）；
res、com、off、ind、park 是住宅、商业、办公、工业、公园各占的比重（0–100，不必加起来等于 100）；den 开发强度 0–1（0 是独栋小屋，1 是高楼林立）；trees 要不要行道树。
怎么用地块情况：平均坡度超过 7% 用 organic 并降低强度；有水面就多留公园；周边已有大道可以把强度定高一些；地块里已有建筑说明是加建，强度不要比周围高太多。
地块情况：`;
// ── 生成
function dsMakeRoad(a, b, c, ln) { const r = { a, c: c || [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b, m: 0 }; setLanes(r, ln); if (TH) { setProfile(r, endY(a), endY(b)); gradeRoad(r); } S.roads.push(r); return r; }
function dsGenerate(site, sp) {
  let sd = (sp.seed * 9301 + 49297) | 0; const rnd = () => { sd = sd + 0x6D2B79F5 | 0; let t = Math.imul(sd ^ sd >>> 15, 1 | sd); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const { at, rot, poly } = site, w = site.w, d = site.d, cs = Math.cos(rot), sn = Math.sin(rot), W_ = (u, v) => [Math.round((at[0] + u * cs - v * sn) * 10) / 10, Math.round((at[1] + u * sn + v * cs) * 10) / 10];
  const ok = p => inPoly(poly, p[0], p[1]) && !waterAt(p[0], p[1]) && slopeAt(p[0], p[1]) < 0.38;                          // 能不能用：在圈里、不是水、不太陡
  const roads = [], AVE = 'WBBFFW', ST = 'WBFW', road = (a, b, c, ln) => { if (ok(a) && ok(b) && ok([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])) roads.push(dsMakeRoad(a, b, c, ln)); };
  const cell = new Map(), mixKeys = ['res', 'com', 'off', 'ind', 'park']; let zoneOf;
  const pick = (key, t) => {                                                     // 每个街块定一种用途：按比重抽，越靠中心越偏办公和商业，越靠边越偏工业
    if (cell.has(key)) return cell.get(key);
    const wts = { res: sp.res * (0.8 + 0.4 * t), com: sp.com * (1.4 - 0.8 * t), off: sp.off * (1.6 - 1.2 * t), ind: sp.ind * (0.4 + 1.2 * t), park: sp.park };
    let tot = 0; for (const k of mixKeys) tot += Math.max(0, wts[k]); let x = rnd() * (tot || 1), z = 'res'; for (const k of mixKeys) { x -= Math.max(0, wts[k]); if (x <= 0) { z = k; break; } }
    cell.set(key, z); return z;
  };
  if (sp.layout === 'radial') {
    const Rm = Math.max(w, d) / 2, nr = Math.max(1, Math.round(Rm / sp.block)), dr = Rm / nr, ns = clamp(Math.round(TAU * Rm / sp.block / 1.6), 6, 14);
    const P = (k, i) => { const a = i / ns * TAU; return W_(Math.cos(a) * dr * k, Math.sin(a) * dr * k); }, ctr = W_(0, 0);
    for (let i = 0; i < ns; i++) for (let k = 0; k < nr; k++) road(k ? P(k, i) : ctr, P(k + 1, i), null, i % 2 === 0 ? AVE : ST);                                            // 放射路
    for (let k = 1; k <= nr; k++) for (let i = 0; i < ns; i++) { const a = P(k, i), b = P(k, i + 1), am = (i + 0.5) / ns * TAU, mid = W_(Math.cos(am) * dr * k, Math.sin(am) * dr * k);
      road(a, b, [2 * mid[0] - (a[0] + b[0]) / 2, 2 * mid[1] - (a[1] + b[1]) / 2], ST); }                                                                                    // 环路：每一段是一条弯路
    zoneOf = (x, z) => { const u = (x - at[0]) * cs + (z - at[1]) * sn, v = -(x - at[0]) * sn + (z - at[1]) * cs, rr = Math.hypot(u, v), k = Math.min(nr - 1, Math.floor(rr / dr)), i = Math.floor(((Math.atan2(v, u) / TAU + 1) % 1) * ns); return pick(k + ':' + i, rr / Rm); };
  } else {
    const nx = clamp(Math.round(w / sp.block), 1, 18), nz = clamp(Math.round(d / sp.block), 1, 18), bx = w / nx, bz = d / nz, org = sp.layout === 'organic', jit = org ? 0.18 : 0, inset = 6;
    const N = []; for (let j = 0; j <= nz; j++) { N.push([]); for (let i = 0; i <= nx; i++) { const eu = i === 0 ? inset : i === nx ? -inset : 0, ev = j === 0 ? inset : j === nz ? -inset : 0; N[j].push(W_(-w / 2 + i * bx + eu + (rnd() - 0.5) * bx * jit * 2, -d / 2 + j * bz + ev + (rnd() - 0.5) * bz * jit * 2)); } }
    const big = (i, n) => n >= 5 && i === Math.round(n / 2);                                                                 // 街区够大时中轴是大道，其余是街道
    const bend = (a, b) => org ? [(a[0] + b[0]) / 2 + (rnd() - 0.5) * 18, (a[1] + b[1]) / 2 + (rnd() - 0.5) * 18] : null;
    for (let j = 0; j <= nz; j++) for (let i = 0; i < nx; i++) road(N[j][i], N[j][i + 1], bend(N[j][i], N[j][i + 1]), big(j, nz) ? AVE : ST);
    for (let i = 0; i <= nx; i++) for (let j = 0; j < nz; j++) road(N[j][i], N[j + 1][i], bend(N[j][i], N[j + 1][i]), big(i, nx) ? AVE : ST);
    zoneOf = (x, z) => { const u = (x - at[0]) * cs + (z - at[1]) * sn, v = -(x - at[0]) * sn + (z - at[1]) * cs, i = clamp(Math.floor((u + w / 2) / bx), 0, nx - 1), j = clamp(Math.floor((v + d / 2) / bz), 0, nz - 1); return pick(i + ':' + j, Math.min(1, Math.hypot(u / (w / 2), v / (d / 2)))); };
  }
  normalizeRoads(roads.slice());                                                 // 和已有的路相交的地方接成路口
  const mine = S.roads.filter(r => roads.includes(r) || (inPoly(poly, r.a[0], r.a[1]) && inPoly(poly, r.b[0], r.b[1])));
  // 沿圈内每条路的两侧摆建筑：用途决定摆什么，强度决定摆得多密、楼多高
  const D = sp.den, POOL = { res: D < 0.35 ? ['house', 'house', 'house', 't_maple'] : D < 0.7 ? ['house', 'apartment', 'house', 'apartment'] : ['apartment', 'apartment', 'apartment', 'shop'],
    com: D < 0.6 ? ['shop', 'shop', 'apartment'] : ['shop', 'office', 'shop', 'apartment'], off: D < 0.4 ? ['office', 'shop', 'apartment'] : ['office', 'office', 'office', 'apartment'],
    ind: ['factory', 'factory', 'watertower', 'shop'], park: ['park', 't_oak', 't_willow', 't_ginkgo', 't_oak', 'bench'] };
  const TREES = ['t_maple', 't_oak', 't_ginkgo', 't_poplar'], b0 = S.blds.length, m = Math.max(w, d), near = S.roads.filter(r => { const bb = roadPts(r).bb; return !(bb[2] < at[0] - m || bb[0] > at[0] + m || bb[3] < at[1] - m || bb[1] > at[1] + m); });
  for (const r of mine) for (const sg of [1, -1]) {
    const pts = roadPts(r); let dd = 15 + rnd() * 6;
    while (dd < pts.len - 15 && S.blds.length - b0 < 2500) {
      const p0 = atDist(pts, dd), zone = zoneOf(p0.x - p0.tz * sg * 30, p0.z + p0.tx * sg * 30), pool = POOL[zone], id = pool[(rnd() * pool.length) | 0], f = fp(S.assets[id]);
      dd += f.w / 2; if (dd > pts.len - 12) break;
      const p = atDist(pts, dd), nx_ = -p.tz, nz_ = p.tx, off = r.w / 2 + 3.5 + f.d / 2, b = { a: id, x: p.x + nx_ * sg * off, z: p.z + nz_ * sg * off, r: Math.atan2(nx_ * sg, -nz_ * sg) }, rad = Math.max(f.w, f.d) / 2;
      let good = ok([b.x, b.z]); if (good) for (const o of near) { if (o === r) continue; const bb = roadPts(o).bb; if (b.x < bb[0] - 40 || b.x > bb[2] + 40 || b.z < bb[1] - 40 || b.z > bb[3] + 40) continue; if (nearRoad(o, b.x, b.z).d < o.w / 2 + f.d / 2 + 3) { good = false; break; } }
      if (good) for (let k = S.blds.length - 1; k >= 0; k--) { const o = S.blds[k], g = fp(S.assets[o.a]); if (Math.abs(o.x - b.x) < 80 && Math.hypot(o.x - b.x, o.z - b.z) < (rad + Math.max(g.w, g.d) / 2) * 0.9) { good = false; break; } }
      if (good) { S.blds.push(b); if (sp.trees && zone !== 'ind' && rnd() < 0.5) { const q = atDist(pts, Math.min(pts.len - 8, dd + f.w / 2 + 2)); S.blds.push({ a: TREES[(rnd() * TREES.length) | 0], x: q.x - q.tz * sg * (r.w / 2 + 1.2), z: q.z + q.tx * sg * (r.w / 2 + 1.2), r: rnd() * TAU }); } }   // 楼与楼之间的行道树
      dd += f.w / 2 + 2 + (1 - D) * 12 * rnd() + (zone === 'park' ? 8 : 0);
    }
  }
  return { roads: roads.length, blds: S.blds.length - b0 };
}
function dsBuild() {
  if (!dsSite) { $('#ds-status').textContent = '先在平面图上圈一片地。'; return; }
  pushUndo(); const n0 = undoStack.length, site = dsSite, res = dsGenerate(site, dsRead());
  dsLast = { site, len: n0, roads: S.roads.length, blds: S.blds.length }; ui.sel = ui.cand = null; changed();
  $('#ds-status').textContent = res.roads ? `已生成：${res.roads} 段路、${res.blds} 个建筑和树。它们就是普通的路和建筑，切到“选择”就能拖动、改车道、删除。不满意可以“换个样子重新生成”，或 Ctrl+Z 撤销。` : '这片地上没能排出路：可能太小、太陡或者大部分是水。把地圈大一点，或者把街块边长调小再试。';
}
$('#ds-build').onclick = dsBuild;
$('#ds-regen').onclick = () => {
  if (!dsLast) { $('#ds-status').textContent = '还没有生成过。'; return; }
  if (undoStack.length !== dsLast.len || S.roads.length !== dsLast.roads || S.blds.length !== dsLast.blds) { $('#ds-status').textContent = '生成之后你已经改过了，不能整体重来（会丢掉你的修改）。想重来请先撤销到生成之前。'; return; }
  const site = dsLast.site; undo(); dsSite = site; $('#ds-seed').value = (numIn('ds-seed', 1, 0, 1e6) | 0) + 1; dsBuild();
};
$('#ds-go').onclick = async () => {                                              // 一句话 + 地块情况 → 参数 → 生成
  if (!dsSite) { $('#ds-status').textContent = '先在平面图上圈一片地。'; return; }
  const t = $('#ds-prompt').value.trim(), seed = numIn('ds-seed', 1, 0, 1e6) | 0; if (!t) { $('#ds-status').textContent = '写一句话说说想建什么，比如“建一个安静的住宅小区，带一个小公园”。'; return; }
  let how = '按关键词和地块情况';
  if (sample) { $('#ds-go').disabled = true; $('#ds-status').textContent = 'Claude 正在看地块情况并定参数…';
    try { const d = await sample.json(DS_RULES + JSON.stringify(dsSite.ctx) + '\n用户的话：' + t.slice(0, 300), { modelTier: 'quick' }); if (!d || typeof d !== 'object') throw 0; dsWrite({ ...d, seed }); how = 'Claude 结合地块情况'; }
    catch (e) { dsWrite({ ...dsParse(t, dsSite.ctx), seed }); }
    $('#ds-go').disabled = false; }
  else dsWrite({ ...dsParse(t, dsSite.ctx), seed });
  dsBuild(); $('#ds-status').textContent = `（参数由${how}定出，已填在下面，可以改了再点“按下面的参数生成”。）` + $('#ds-status').textContent;
};
$('#distClose').onclick = () => setTool('select');
dsWrite(DS_DEF); dsShowSite();
