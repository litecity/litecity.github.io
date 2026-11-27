// ── 沟渠：沿一条贝塞尔线往下挖。纵向：渠底从起点到终点单调下降，上游陡下游缓（真实河流的凹形纵剖面）；
//    横向：渠内是抛物线形河床，渠外按约 1:3 的岸坡放坡到原地面，所以穿山时会切出一条河谷。
let cTmp = null;
const canalBed = (k, t) => k.z0 + (k.z1 - k.z0) * (1 - Math.pow(1 - t, 1.6));
function canalField(k, reach) {                                                  // 每个格点到渠线的最近距离和对应的沿程位置
  if (!cTmp) cTmp = { d: new Float32Array(VN * VN), t: new Float32Array(VN * VN) }; cTmp.d.fill(Infinity);
  const len = dist2(k.a, k.b) + dist2(k.c, [(k.a[0] + k.b[0]) / 2, (k.a[1] + k.b[1]) / 2]), n = Math.max(2, Math.ceil(len / (CELL * 0.4))), rc = Math.ceil(reach / CELL) + 1;
  let i0 = GN, i1 = 0, j0 = GN, j1 = 0;
  for (let q = 0; q <= n; q++) {
    const t = q / n, u = 1 - t, x = u * u * k.a[0] + 2 * u * t * k.c[0] + t * t * k.b[0], z = u * u * k.a[1] + 2 * u * t * k.c[1] + t * t * k.b[1];
    const ci = Math.round((x + HALF) / CELL), cj = Math.round((z + HALF) / CELL);
    for (let j = Math.max(1, cj - rc); j <= Math.min(GN - 1, cj + rc); j++) for (let i = Math.max(1, ci - rc); i <= Math.min(GN - 1, ci + rc); i++) {
      const o = j * VN + i, d = Math.hypot(i * CELL - HALF - x, j * CELL - HALF - z);
      if (d < cTmp.d[o]) { cTmp.d[o] = d; cTmp.t[o] = t; if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; }
    }
  }
  return [i0, i1, j0, j1];
}
function carveCanal(a, b, c) {
  const w = numIn('cn-w', 80, 40, 600), D = numIn('cn-d', 8, 1, 200), g = numIn('cn-g', 2, 0, 200) / 1000, hw = w / 2;
  c = c ? c.slice() : [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const len = dist2(a, b) + dist2(c, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]), z0 = elevAt(a[0], a[1]) - D, z1 = Math.min(elevAt(b[0], b[1]) - D, z0 - g * len);   // 终点渠底至少比起点低“坡降×长度”
  pushUndoTerr(); ensureTH();
  const k = { a: a.slice(), c, b: b.slice(), w, d: D, z0: Math.round(z0 * 10) / 10, z1: Math.round(z1 * 10) / 10, wet: $('#cn-water').checked ? 1 : 0 };
  const rect = canalField(k, hw + 380);
  for (let j = rect[2]; j <= rect[3]; j++) for (let i = rect[0]; i <= rect[1]; i++) {
    const o = j * VN + i, r = cTmp.d[o]; if (r === Infinity) continue;
    const bed = canalBed(k, cTmp.t[o]), zc = r <= hw ? bed + D * (r / hw) * (r / hw) : bed + D + (r - hw) * 0.33;
    if (zc < TH[o]) TH[o] = zc;
  }
  cTmp = null; S.env.canals.push(k); if (S.env.canals.length > 200) S.env.canals.shift();
  terrChanged(); saveTerr(); save();
  $('#t-status').textContent = `沟渠已挖：长约 ${Math.round(len)} m，渠底 ${k.z0} → ${k.z1} m，落差 ${(k.z0 - k.z1).toFixed(1)} m。Ctrl+Z 可撤销。`;
}
function canalWater(wet) {                                                       // 渠水：水面跟着渠底的坡度走，横向是平的
  for (const k of S.env.canals) {
    if (!k.wet) continue; const hw = k.w / 2, rect = canalField(k, hw);
    for (let j = rect[2]; j <= rect[3]; j++) for (let i = rect[0]; i <= rect[1]; i++) {
      const o = j * VN + i; if (cTmp.d[o] > hw) continue; const ws = canalBed(k, cTmp.t[o]) + k.d * 0.45;
      if (TH[o] < ws && !(wet[o] === 255 && RH[o] >= ws)) { RH[o] = ws; wet[o] = 255; }
    }
  }
  cTmp = null;
}
function updateSrcRead() { $('#ws-read').textContent = S.env.src.length ? `已放 ${S.env.src.length} 个水点：` + S.env.src.map(q => q.h + ' m').join('、') : '还没有水点'; }
function buildTerrain() {
  terrDirty = false; if (!TH) { updateTerrRead(); return; }
  const n = VN * VN, live = ui.drag && ui.drag.k === 'brush', cp = live || (terr.copy && !terr.full); terr.copy = false;
  if (!terr.wet) terr.wet = new Uint8Array(n); const wet = terr.wet;
  if (terr.full && !live) {                                                    // 整图：重算水文（拖笔刷时先不算，松手再算）
    terr.full = false; terr.dirty.fill(1); RH.set(TH); wet.fill(0);
    let lo = Infinity, hi = -Infinity; for (let i = 0; i < n; i++) { const h = TH[i]; if (h < lo) lo = h; if (h > hi) hi = h; } terr.lo = lo; terr.hi = hi;
    if (S.env.lakes || S.env.rivers) hydro(wet);
    canalWater(wet); floodSources(wet);
    if (S.env.lakes || S.env.rivers || S.env.src.length || S.env.canals.length) smoothWet(wet);
  }
  const sea = S.env.water, cg = hex2rgb(W.ground), ck = hex2rgb(W.rock), cs = hex2rgb(W.snow), cd = hex2rgb(W.sand), cw = hex2rgb(W.water), snow0 = Math.max(140, terr.hi * 0.62);
  if (!terr.mesh) terr.mesh = new Mesh(CV); const m = terr.mesh;
  if (!terrCv) { terrCv = document.createElement('canvas'); terrCv.width = terrCv.height = RV; terr.img = terrCv.getContext('2d').createImageData(RV, RV); }
  const px = terr.img.data, col = [0, 0, 0], pos = [0, 0, 0], FT = [0.52, 0.3, 0.5]; let any = false;
  if (gl) gl.bindBuffer(gl.ARRAY_BUFFER, bufT);
  for (let c = 0; c < CN * CN; c++) {
    if (!terr.dirty[c]) continue; terr.dirty[c] = 0; m.n = 0; any = true; let cmin = Infinity, cmax = -Infinity;
    const i0 = (c % CN) * CH, j0 = ((c / CN) | 0) * CH;
    for (let j = j0; j <= j0 + CH; j++) for (let i = i0; i <= i0 + CH; i++) {
      const o = j * VN + i; if (cp) { RH[o] = TH[o]; wet[o] = 0; }
      const h = RH[o];
      let nx = (RH[o - (i > 0 ? 1 : 0)] - RH[o + (i < GN ? 1 : 0)]) / (2 * CELL), nz = (RH[o - (j > 0 ? VN : 0)] - RH[o + (j < GN ? VN : 0)]) / (2 * CELL), ny = 1;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      if (h < cmin) cmin = h; if (h > cmax) cmax = h;
      const fr = TR ? (TR[o] & 31) / 31 : 0, rk = clamp((1 - ny - 0.06) / 0.14, 0, 1) * clamp(h / 20, 0, 1) * (1 - 0.7 * fr), sn = clamp((h - snow0) / (snow0 * 0.3), 0, 1) * (1 - 0.6 * rk), sd = clamp(-h / 4, 0, 1), dk = 1 - 0.22 * clamp(h / 150, 0, 1), w = wet[o] / 255;
      for (let q = 0; q < 3; q++) { let v = cg[q] * dk; v += (ck[q] - v) * rk; v += (cs[q] - v) * sn; v += (cd[q] - v) * sd; col[q] = v * (1 - FT[q] * fr); }          // 有树的地方压成林地的深绿
      pos[0] = i * CELL - HALF; pos[1] = h; pos[2] = j * CELL - HALF; m.v(pos, nx, ny, nz, col, wet[o] * 0.3);          // 湿度放进 alpha，岸线由着色器按等值线画，不是一格一格的
      if (!(i & 1) && !(j & 1)) {                                              // 平面图底图取隔点，带一点山影
        const sh = clamp(0.3 + 0.85 * (nx * 0.44 + ny * 0.82 + nz * 0.36), 0.45, 1.1), under = sea != null && h < sea - 0.05, p4 = ((j >> 1) * RV + (i >> 1)) * 4;
        for (let q = 0; q < 3; q++) px[p4 + q] = under || w > 0.5 ? cw[q] : Math.min(255, col[q] * sh);
        px[p4 + 3] = 255;
      }
    }
    terr.cb[c * 2] = cmin; terr.cb[c * 2 + 1] = cmax;
    if (gl) gl.bufferSubData(gl.ARRAY_BUFFER, c * CV * 20, m.u.subarray(0, CV * 20));
  }
  if (any) { buildSkirt(); treesDirty = true; }
  terrCv.getContext('2d').putImageData(terr.img, 0, 0);
  updateTerrRead();
}
// 地图边缘：地形保持原海拔一直到边，四周用一圈岩壁接到下方的底面
function buildSkirt() {
  if (!terr.skirt) terr.skirt = new Mesh(SKN); const m = terr.skirt; m.n = 0;
  const yb = Math.min(terr.lo, 0) - 60, rock = hex2rgb(W.rock), gc = hex2rgb(W.ground), G = 40000, ctr = [0, yb, 0];
  tri(m, [-G, yb, -G], [G, yb, -G], [G, yb, G], gc, 0); tri(m, [-G, yb, -G], [G, yb, G], [-G, yb, G], gc, 0);
  const P = (i, j) => [i * CELL - HALF, RH[j * VN + i], j * CELL - HALF], B = (i, j) => [i * CELL - HALF, yb, j * CELL - HALF];
  const wall = (a, b, c, d) => { tri(m, a, b, c, rock, 255, ctr); tri(m, a, c, d, rock, 255, ctr); };
  for (let k = 0; k < GN; k++) { wall(P(k, 0), P(k + 1, 0), B(k + 1, 0), B(k, 0)); wall(P(k, GN), P(k + 1, GN), B(k + 1, GN), B(k, GN)); wall(P(0, k), P(0, k + 1), B(0, k + 1), B(0, k)); wall(P(GN, k), P(GN, k + 1), B(GN, k + 1), B(GN, k)); }
  terr.skirtN = m.n; if (gl) gl.bufferSubData(gl.ARRAY_BUFFER, CN * CN * CV * 20, m.u.subarray(0, m.n * 20));
}
