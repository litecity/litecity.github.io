// ── 树：只存一张“密度图”（每格 1 字节）。远处靠地形染色表现成林，镜头附近才按密度现生成树的模型
const treeM = new Mesh(1024); let trSt = null;
const hsh = (a, b, c) => { let n = Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 2246822519) | 0; n = Math.imul(n ^ n >>> 13, 1274126177); return ((n ^ n >>> 16) >>> 0) / 4294967296; };
function paintTrees(w) {
  ensureTH(); if (!TR) TR = new Uint8Array(VN * VN);
  const r = numIn('tr-rad', 200, 20, 4000), den = numIn('tr-den', 0.7, 0.05, 1) * 255, erase = $('#tr-erase').checked, [i0, i1, j0, j1] = cellBox(w, r);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const d = Math.hypot(i * CELL - HALF - w[0], j * CELL - HALF - w[1]) / r; if (d >= 1) continue;
    const o = j * VN + i, f = 1 - sst(0.6, 1, d); if (erase) TR[o] *= 1 - f; else if (den * f > TR[o]) TR[o] = den * f;
  }
  terrChanged([i0, i1, j0, j1]);
}
function treesStale() {
  const c = camCity, far = c.dist > 2800; if (treesDirty || !trSt) return true; if (far) return !trSt.far;
  return trSt.far || Math.abs((c.tx + HALF) / CELL - trSt.ci) > trSt.W / 3 || Math.abs((c.tz + HALF) / CELL - trSt.cj) > trSt.W / 3 || Math.abs(c.dist - trSt.d) > trSt.d * 0.35;
}
function buildTrees() {
  const m = treeM, c = camCity; m.n = 0; treesDirty = false;
  const W = clamp(Math.round((500 + c.dist * 0.9) / CELL), 30, 150), ci = Math.round((c.tx + HALF) / CELL), cj = Math.round((c.tz + HALF) / CELL);
  trSt = { ci, cj, W, d: c.dist, far: c.dist > 2800 };
  if (TR && TH && !shop.open && !trSt.far) {
    const k = 1, cols = [[58, 122, 74], [74, 142, 84], [46, 104, 66], [92, 150, 80]].map(q => q.map(v => v * k)), wet = terr.wet; let cnt = 0;
    out: for (let j = Math.max(0, cj - W); j <= Math.min(GN - 1, cj + W); j++) for (let i = Math.max(0, ci - W); i <= Math.min(GN - 1, ci + W); i++) {
      const o = j * VN + i, d = TR[o]; if (!d || (wet && wet[o] > 128)) continue;
      const n = Math.floor(d / 255 * 1.7 + hsh(i, j, 7));
      for (let q = 0; q < n; q++) {
        const x = (i + hsh(i, j, q * 4 + 1)) * CELL - HALF, z = (j + hsh(i, j, q * 4 + 2)) * CELL - HALF, y = H(x, z), hh = hsh(i, j, q * 4 + 3), ht = 7 + 8 * hh, rd = ht * 0.26, a0 = hh * 6.28, col = cols[(hh * 97 | 0) & 3];
        const top = [x, y + ht, z], ctr = [x, y, z], B = a => [x + Math.cos(a0 + a) * rd, y + ht * 0.1, z + Math.sin(a0 + a) * rd];
        const b0 = B(0), b1 = B(1.571), b2 = B(3.142), b3 = B(4.712);                                                 // 一棵树 = 一个四棱锥，12 个顶点
        tri(m, b0, b1, top, col, 255, ctr); tri(m, b1, b2, top, col, 255, ctr); tri(m, b2, b3, top, col, 255, ctr); tri(m, b3, b0, top, col, 255, ctr);
        if (++cnt >= 40000) break out;
      }
    }
  }
  if (gl) { gl.bindBuffer(gl.ARRAY_BUFFER, bufTr); gl.bufferData(gl.ARRAY_BUFFER, m.u.subarray(0, Math.max(1, m.n) * 20), gl.DYNAMIC_DRAW); }
}
const hasWater = () => S.env.water != null || S.env.lakes || S.env.rivers || S.env.src.length > 0 || S.env.canals.some(k => k.wet);
const terrGpu = () => (CN * CN * CV + SKN) * 20 + (LODN[0] + LODN[1] + LODN[2]) * 2 + treeM.n * 20;
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
