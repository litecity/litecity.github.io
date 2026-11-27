// ── 树：地上只存一张图（每格 1 字节：高 3 位是“哪种林子”，低 5 位是密度）。远处靠地形染色表现成林；
//    镜头附近才生成一棵棵树，而且是实例化的：每个树种只有一份模型，每棵树只占 20 字节（位置、朝向、高度、叶色）。
//    模型都是按“树高 = 1”做的低面数矢量体：树干是棱台，树冠是若干椭球或圆锥。叶子在模型里是灰白的，颜色由每棵树自己带。
const hsh = (a, b, c) => { let n = Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 2246822519) | 0; n = Math.imul(n ^ n >>> 13, 1274126177); return ((n ^ n >>> 16) >>> 0) / 4294967296; };
const BARK = [112, 86, 62], LEAF = 250;
function tTrunk(m, r0, r1, h, col, n = 5, x = 0, z = 0) { const c = [x, h / 2, z]; for (let i = 0; i < n; i++) { const a = i / n * TAU, b = (i + 1) / n * TAU, p = (ang, r, y) => [x + Math.cos(ang) * r, y, z + Math.sin(ang) * r]; tri(m, p(a, r0, 0), p(b, r0, 0), p(b, r1, h), col, 255, c); tri(m, p(a, r0, 0), p(b, r1, h), p(a, r1, h), col, 255, c); } }
function tCone(m, y0, y1, r, n, sh) { const col = [235 * sh, 235 * sh, 235 * sh], c = [0, y0 + (y1 - y0) * 0.3, 0], top = [0, y1, 0]; for (let i = 0; i < n; i++) { const a = i / n * TAU, b = (i + 1) / n * TAU; tri(m, [Math.cos(a) * r, y0, Math.sin(a) * r], [Math.cos(b) * r, y0, Math.sin(b) * r], top, col, LEAF, c); } }
function tBall(m, cx, cy, cz, rx, ry, rz, sh, n = 5, rings = [[-1, 0], [-0.45, 0.9], [0.45, 0.9], [1, 0]]) {
  const col = [235 * sh, 235 * sh, 235 * sh], c = [cx, cy, cz], pt = (k, i) => { const a = (i + k * 0.5) / n * TAU; return [cx + Math.cos(a) * rx * rings[k][1], cy + ry * rings[k][0], cz + Math.sin(a) * rz * rings[k][1]]; };
  for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < n; i++) { const a = pt(k, i), b = pt(k, i + 1), d = pt(k + 1, i), e = pt(k + 1, i + 1); if (k > 0) tri(m, a, b, e, col, LEAF, c); if (k < rings.length - 2) tri(m, a, e, d, col, LEAF, c); }
}
const LOWB = [[-1, 0], [0, 1], [1, 0]];                                          // 远处用的简化椭球：一圈加两个尖
const TREE_SP = {
  spruce: { name: '云杉', h: [14, 26], pal: [[38, 84, 58], [46, 98, 64], [30, 72, 52]], full: m => { tTrunk(m, 0.02, 0.012, 0.3, BARK); tCone(m, 0.14, 0.52, 0.2, 6, 0.9); tCone(m, 0.36, 0.76, 0.155, 6, 0.96); tCone(m, 0.6, 1, 0.1, 6, 1); }, low: m => tCone(m, 0.1, 1, 0.19, 4, 0.95) },
  pine: { name: '松树', h: [12, 22], pal: [[52, 104, 70], [44, 92, 62], [64, 112, 72]], full: m => { tTrunk(m, 0.024, 0.014, 0.8, [128, 84, 60]); tBall(m, 0, 0.62, 0, 0.21, 0.065, 0.21, 0.9); tBall(m, 0.06, 0.78, 0.03, 0.17, 0.06, 0.17, 0.96); tBall(m, -0.03, 0.93, 0, 0.12, 0.06, 0.12, 1); }, low: m => { tTrunk(m, 0.022, 0.014, 0.6, [128, 84, 60], 3); tBall(m, 0, 0.78, 0, 0.19, 0.2, 0.19, 0.95, 4, LOWB); } },
  oak: { name: '橡树', h: [10, 18], pal: [[70, 124, 62], [84, 138, 66], [58, 108, 56]], full: m => { tTrunk(m, 0.036, 0.026, 0.42, BARK); tBall(m, 0, 0.62, 0, 0.3, 0.23, 0.3, 0.92); tBall(m, 0.17, 0.55, 0.08, 0.2, 0.16, 0.2, 0.86); tBall(m, -0.15, 0.58, -0.1, 0.2, 0.17, 0.2, 0.9); tBall(m, 0.02, 0.83, 0, 0.2, 0.16, 0.2, 1); }, low: m => { tTrunk(m, 0.034, 0.026, 0.4, BARK, 3); tBall(m, 0, 0.66, 0, 0.32, 0.33, 0.32, 0.94, 4, LOWB); } },
  maple: { name: '枫树', h: [9, 16], pal: [[92, 142, 62], [204, 96, 44], [226, 150, 46], [176, 60, 44], [110, 150, 64]], full: m => { tTrunk(m, 0.03, 0.022, 0.38, BARK); tBall(m, 0, 0.62, 0, 0.26, 0.26, 0.26, 0.92); tBall(m, 0.1, 0.82, 0.05, 0.17, 0.17, 0.17, 1); tBall(m, -0.11, 0.5, -0.06, 0.17, 0.15, 0.17, 0.86); }, low: m => { tTrunk(m, 0.03, 0.022, 0.36, BARK, 3); tBall(m, 0, 0.66, 0, 0.27, 0.33, 0.27, 0.94, 4, LOWB); } },
  birch: { name: '白桦', h: [10, 18], pal: [[138, 180, 88], [156, 190, 84], [196, 190, 70]], full: m => { tTrunk(m, 0.015, 0.009, 0.62, [226, 226, 216]); tBall(m, 0, 0.72, 0, 0.12, 0.27, 0.12, 0.98); tBall(m, 0.035, 0.5, 0.02, 0.09, 0.13, 0.09, 0.88); }, low: m => { tTrunk(m, 0.014, 0.009, 0.5, [226, 226, 216], 3); tBall(m, 0, 0.7, 0, 0.12, 0.29, 0.12, 0.95, 4, LOWB); } },
  poplar: { name: '杨树', h: [14, 24], pal: [[78, 140, 76], [66, 126, 70]], full: m => { tTrunk(m, 0.018, 0.012, 0.25, BARK); tBall(m, 0, 0.6, 0, 0.085, 0.4, 0.085, 0.95, 6); }, low: m => tBall(m, 0, 0.58, 0, 0.085, 0.42, 0.085, 0.95, 4, LOWB) },
  willow: { name: '柳树', h: [7, 12], pal: [[150, 186, 76], [134, 174, 72]], full: m => { tTrunk(m, 0.034, 0.024, 0.5, BARK); tBall(m, 0, 0.72, 0, 0.27, 0.2, 0.27, 1, 6);
      const n = 7, c = [0, 0.45, 0], col = [205, 205, 205]; for (let i = 0; i < n; i++) { const a = i / n * TAU, b = (i + 1) / n * TAU, p = (ang, r, y) => [Math.cos(ang) * r, y, Math.sin(ang) * r]; tri(m, p(a, 0.26, 0.68), p(b, 0.26, 0.68), p(b, 0.31, 0.26), col, LEAF, c); tri(m, p(a, 0.26, 0.68), p(b, 0.31, 0.26), p(a, 0.31, 0.26), col, LEAF, c); } },        // 垂下来的枝条是一圈帘子
    low: m => { tTrunk(m, 0.03, 0.024, 0.3, BARK, 3); tBall(m, 0, 0.6, 0, 0.3, 0.36, 0.3, 0.94, 4, LOWB); } },
  ginkgo: { name: '银杏', h: [10, 18], pal: [[122, 164, 70], [222, 186, 52], [232, 200, 70], [140, 176, 74]], full: m => { tTrunk(m, 0.026, 0.018, 0.4, BARK); tBall(m, 0, 0.62, 0, 0.2, 0.3, 0.2, 0.94, 6); tBall(m, 0, 0.87, 0, 0.12, 0.13, 0.12, 1); }, low: m => { tTrunk(m, 0.024, 0.018, 0.36, BARK, 3); tBall(m, 0, 0.66, 0, 0.2, 0.34, 0.2, 0.95, 4, LOWB); } },
  gum: { name: '桉树', h: [16, 30], pal: [[122, 146, 112], [108, 134, 100], [136, 150, 104]], full: m => { tTrunk(m, 0.02, 0.012, 0.8, [214, 205, 190]); tBall(m, 0, 0.84, 0, 0.17, 0.1, 0.17, 1); tBall(m, 0.15, 0.71, 0.05, 0.12, 0.075, 0.12, 0.9); tBall(m, -0.13, 0.76, -0.06, 0.12, 0.075, 0.12, 0.94); }, low: m => { tTrunk(m, 0.018, 0.012, 0.74, [214, 205, 190], 3); tBall(m, 0, 0.82, 0, 0.19, 0.14, 0.19, 0.95, 4, LOWB); } },
  shrub: { name: '灌木', h: [1.4, 3], pal: [[84, 140, 76], [70, 124, 66], [100, 150, 74]], full: m => { tBall(m, 0, 0.5, 0, 0.62, 0.5, 0.62, 0.95, 6); tBall(m, 0.4, 0.38, 0.2, 0.4, 0.36, 0.4, 0.86); }, low: m => tBall(m, 0, 0.5, 0, 0.66, 0.5, 0.66, 0.92, 4, LOWB) },
};
const TREE_IDS = Object.keys(TREE_SP);
const TREE_REG = [['混合', TREE_IDS.filter(k => k !== 'gum')], ['美国东部', ['maple', 'maple', 'oak', 'oak', 'pine', 'birch', 'shrub']], ['中国', ['pine', 'willow', 'ginkgo', 'poplar', 'poplar', 'shrub']], ['俄罗斯', ['spruce', 'spruce', 'birch', 'birch', 'pine']],
  ['欧洲', ['oak', 'oak', 'spruce', 'poplar', 'maple', 'shrub']], ['澳大利亚', ['gum', 'gum', 'gum', 'shrub']], ['低矮灌木', ['shrub']], ['高大乔木', ['spruce', 'gum', 'poplar', 'pine']]];
let treeT = null, treeG = [], treeExtra = [], trSt = null; const treeM = { n: 0 };    // treeT 各树种模型的范围；treeG 这一帧要画的分组；treeExtra 资产架里摆的树；treeM.n 当前实例数
function treeTemplates() {                                                       // 每个树种两份模型：近处的完整版、远处的简化版，全放进一个缓冲
  const m = new Mesh(4096), T_ = {}; for (const id of TREE_IDS) for (const lod of [0, 1]) { const first = m.n; TREE_SP[id][lod ? 'low' : 'full'](m); T_[id + lod] = [first, m.n - first]; }
  if (gl) { gl.bindBuffer(gl.ARRAY_BUFFER, bufTr); gl.bufferData(gl.ARRAY_BUFFER, m.u.subarray(0, m.n * 20), gl.STATIC_DRAW); } treeT = T_; treeT.bytes = m.n * 20;
}
function paintTrees(w) {
  ensureTH(); if (!TR) TR = new Uint8Array(VN * VN);
  const r = numIn('tr-rad', 200, 20, 4000), den = numIn('tr-den', 0.7, 0.05, 1) * 31, reg = clamp(+$('#tr-reg').value | 0, 0, 7) << 5, erase = $('#tr-erase').checked, [i0, i1, j0, j1] = cellBox(w, r);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const d = Math.hypot(i * CELL - HALF - w[0], j * CELL - HALF - w[1]) / r; if (d >= 1) continue;
    const o = j * VN + i, f = 1 - sst(0.6, 1, d), cur = TR[o] & 31; if (erase) { const v = Math.floor(cur * (1 - f)); TR[o] = v ? (TR[o] & 224) | v : 0; } else { const v = Math.round(den * f); if (v > cur || (v > 0 && f > 0.5)) TR[o] = reg | Math.max(v, cur); }
  }
  terrChanged([i0, i1, j0, j1]);
}
function treesStale() {
  const c = camCity, far = c.dist > 2800; if (treesDirty || !trSt) return true; if (far) return !trSt.far;
  return trSt.far || Math.abs((c.tx + HALF) / CELL - trSt.ci) > trSt.W / 3 || Math.abs((c.tz + HALF) / CELL - trSt.cj) > trSt.W / 3 || Math.abs(c.dist - trSt.d) > trSt.d * 0.35;
}
function buildTrees() {
  const c = camCity; treesDirty = false; if (!treeT) treeTemplates();
  const W = clamp(Math.round((500 + c.dist * 0.9) / CELL), 30, 150), ci = Math.round((c.tx + HALF) / CELL), cj = Math.round((c.tz + HALF) / CELL), near = 420 + c.dist * 0.25;
  trSt = { ci, cj, W, d: c.dist, far: c.dist > 2800 };
  const G = {}; let cnt = 0;                                                     // 先按“树种 + 精细度”分组收集，再连续写进实例缓冲，这样每组一次绘制
  const put = (id, x, y, z, rot, ht, k) => { const sp = TREE_SP[id], col = sp.pal[(k * 97 | 0) % sp.pal.length], v = 0.86 + 0.28 * ((k * 31) % 1), key = id + (Math.hypot(x - c.tx, z - c.tz) < near ? 0 : 1); (G[key] || (G[key] = [])).push(x, y, z, rot, col[0] * v, col[1] * v, col[2] * v, ht); cnt++; };
  if (!shop.open) for (const b of treeExtra) { const as = S.assets[b.a], k = hsh(Math.round(b.x * 3), Math.round(b.z * 3), 5); put(as.tree, b.x, H(b.x, b.z), b.z, b.r, as.th * (0.88 + 0.24 * k), k); }
  if (TR && TH && !shop.open && !trSt.far) { const wet = terr.wet;
    out: for (let j = Math.max(0, cj - W); j <= Math.min(GN - 1, cj + W); j++) for (let i = Math.max(0, ci - W); i <= Math.min(GN - 1, ci + W); i++) {
      const o = j * VN + i, d = TR[o] & 31; if (!d || (wet && wet[o] > 128)) continue; const set = TREE_REG[TR[o] >> 5][1], n = Math.floor(d / 31 * 1.7 + hsh(i, j, 7));
      for (let q = 0; q < n; q++) { const x = (i + hsh(i, j, q * 4 + 1)) * CELL - HALF, z = (j + hsh(i, j, q * 4 + 2)) * CELL - HALF, k = hsh(i, j, q * 4 + 3), id = set[(hsh(i, j, q * 4 + 4) * set.length) | 0], sp = TREE_SP[id];
        put(id, x, H(x, z), z, k * TAU, sp.h[0] + (sp.h[1] - sp.h[0]) * k, k); if (cnt >= 30000) break out; } } }
  const buf = new ArrayBuffer(Math.max(1, cnt) * 20), Fv = new Float32Array(buf), Uv = new Uint8Array(buf); let at = 0; treeG = [];
  for (const key in G) { const a = G[key], n = a.length / 8, t = treeT[key]; treeG.push({ first: t[0], count: t[1], i0: at, n });
    for (let q = 0; q < n; q++, at++) { const s = q * 8, f = at * 5, u = at * 20 + 16; Fv[f] = a[s]; Fv[f + 1] = a[s + 1]; Fv[f + 2] = a[s + 2]; Fv[f + 3] = a[s + 3]; Uv[u] = Math.min(255, a[s + 4]); Uv[u + 1] = Math.min(255, a[s + 5]); Uv[u + 2] = Math.min(255, a[s + 6]); Uv[u + 3] = clamp(Math.round(a[s + 7] / 40 * 255), 1, 255); } }
  treeM.n = cnt; if (gl) { gl.bindBuffer(gl.ARRAY_BUFFER, bufTi); gl.bufferData(gl.ARRAY_BUFFER, Uv, gl.DYNAMIC_DRAW); }
}
function drawTrees(P, uSway) {                                                   // 每组（树种 × 精细度）一次实例化绘制
  if (!treeG.length) return; gl.useProgram(P); if (uSway) gl.uniform1f(uSway, sim.on ? 1 : 0);
  gl.bindVertexArray(vaoTr); gl.bindBuffer(gl.ARRAY_BUFFER, bufTi);
  for (const g of treeG) { gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 20, g.i0 * 20); gl.vertexAttribPointer(4, 4, gl.UNSIGNED_BYTE, true, 20, g.i0 * 20 + 16); gl.drawArraysInstanced(gl.TRIANGLES, g.first, g.count, g.n); }
}
$('#tr-reg').innerHTML = TREE_REG.map((r, i) => `<option value="${i}">${r[0]}：${[...new Set(r[1])].map(k => TREE_SP[k].name).join('、')}</option>`).join('');
const hasWater = () => S.env.water != null || S.env.lakes || S.env.rivers || S.env.src.length > 0 || S.env.canals.some(k => k.wet);
const terrGpu = () => (CN * CN * CV + SKN) * 20 + (LODN[0] + LODN[1] + LODN[2]) * 2 + treeM.n * 20 + (treeT ? treeT.bytes : 0);
const terrRam = () => TH ? TH.byteLength * 2 + VN * VN * (TR ? 2 : 1) + RV * RV * 8 : 0;      // 高度 ×2、湿度、树密度、平面图底图
function updateTerrRead() {
  if ($('#terra').hidden) return;
  $('#t-read').textContent = TH ? `18×18 km · 每格 ${CELL.toFixed(1)} m · 海拔 ${terr.lo.toFixed(0)} ~ ${terr.hi.toFixed(0)} m · 内存 ${fmtB(terrRam())} · 显存 ${fmtB(terrGpu())}` : '18×18 km · 当前是平地 · 占用 0 B';
}
function syncEnvUI() { $('#tw-on').checked = S.env.water != null; if (S.env.water != null) $('#tw-level').value = S.env.water; $('#tw-lake').checked = S.env.lakes; $('#tw-riv').checked = S.env.rivers; $('#tw-thr').value = S.env.thr; updateSrcRead(); }
function readEnvUI() { S.env.water = $('#tw-on').checked ? numIn('tw-level', -2, -500, 3000) : null; S.env.lakes = $('#tw-lake').checked; S.env.rivers = $('#tw-riv').checked; S.env.thr = numIn('tw-thr', 300, 5, 50000); terrChanged(); save(); }
for (const id of ['tw-on', 'tw-level', 'tw-lake', 'tw-riv', 'tw-thr']) $('#' + id).addEventListener('input', readEnvUI);
$('#tg-go').onclick = genMountains;
$('#tg-reseed').onclick = () => { $('#tg-seed').value = Math.random() * 99999 | 0; genMountains(); };
$('#ti-file').onchange = e => { const f = e.target.files[0]; if (f) importImg(f); e.target.value = ''; };
$('#tb-all').onclick = () => { const t = numIn('tb-elev', 0, -500, 3000); pushUndoTerr(); if (t === 0) { setTH(null); } else { ensureTH(); for (let j = 0; j < VN; j++) for (let i = 0; i < VN; i++) TH[j * VN + i] = t; terrChanged(); saveTerr(); } $('#t-status').textContent = `全图已抹平到 ${t} m。`; };
$('#t-reset').onclick = () => { if (!TH) return; pushUndoTerr(); setTH(null); $('#t-status').textContent = '已恢复平地，地形内存已释放。'; };
$('#terraClose').onclick = () => setTool('select');
function setTmode(m) { ui.tmode = ui.tmode === m ? 'brush' : m; ui.rs = ui.rc = null; $('#ws-mode').setAttribute('aria-pressed', ui.tmode === 'water'); $('#cn-mode').setAttribute('aria-pressed', ui.tmode === 'canal'); $('#tr-mode').setAttribute('aria-pressed', ui.tmode === 'tree'); setHint(); req(); }
$('#ws-mode').onclick = () => setTmode('water');
$('#tr-mode').onclick = () => setTmode('tree');
$('#tr-clear').onclick = () => { if (!TR) return; TR = null; terrChanged(); saveTerr(); $('#t-status').textContent = '树已全部清除。'; };
$('#tr-rad').addEventListener('input', req);
setInterval(() => { if (!document.hidden && (fx.cloud || (!shop.open && TH && $('#tw-anim').checked && hasWater()))) req(); }, 90);   // 云在动或水在闪时约每秒 11 帧；都关掉或切走标签页就停
$('#cn-mode').onclick = () => setTmode('canal');
$('#cn-clear').onclick = () => { if (!S.env.canals.some(k => k.wet)) return; pushUndoTerr(); for (const k of S.env.canals) k.wet = 0; terrChanged(); save(); $('#t-status').textContent = '渠水已排干，渠道本身还在。'; };
$('#ws-clear').onclick = () => { if (!S.env.src.length) return; pushUndo(); S.env.src = []; terrChanged(); save(); updateSrcRead(); };
$('#tb-rad').addEventListener('input', req);
