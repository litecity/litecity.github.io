/* ───────── 地形模块 ───────── */
const sst = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
const lift = () => TH && !shop.open ? 0.5 : 0;
function numIn(id, def, lo, hi) { const v = parseFloat($('#' + id).value); return Number.isFinite(v) ? clamp(v, lo, hi) : def; }
function gridAt(A, x, z) {
  const fx = (x + HALF) / CELL, fz = (z + HALF) / CELL; if (!(fx >= 0 && fz >= 0 && fx < GN && fz < GN)) return 0;
  const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, o = j * VN + i;
  return (A[o] * (1 - u) + A[o + 1] * u) * (1 - v) + (A[o + VN] * (1 - u) + A[o + VN + 1] * u) * v;
}
function H(x, z) { return !TH || shop.open ? 0 : gridAt(RH, x, z); }            // 显示用高度（湖面已填平）
function elevAt(x, z) { return TH ? gridAt(TH, x, z) : 0; }
function ensureTH() {
  if (TH) return; TH = new Float32Array(VN * VN); RH = new Float32Array(VN * VN); ptsCache = new WeakMap();
  if (gl) { gl.bindBuffer(gl.ARRAY_BUFFER, bufT); gl.bufferData(gl.ARRAY_BUFFER, (CN * CN * CV + SKN) * 20, gl.DYNAMIC_DRAW); }
}
function terrChanged(rect) {                                                   // rect = [i0,i1,j0,j1]：只重建碰到的分块
  terrDirty = true; dirtyGeom = true;
  if (!rect) { terr.full = true; terr.dirty.fill(1); }
  else for (let cy = clamp(Math.floor((rect[2] - 2) / CH), 0, CN - 1); cy <= clamp(Math.floor((rect[3] + 2) / CH), 0, CN - 1); cy++)
    for (let cx = clamp(Math.floor((rect[0] - 2) / CH), 0, CN - 1); cx <= clamp(Math.floor((rect[1] + 2) / CH), 0, CN - 1); cx++) terr.dirty[cy * CN + cx] = 1;
  req();
}
const quant = () => { const q = new Int16Array(TH.length); for (let i = 0; i < q.length; i++) q[i] = Math.round(clamp(TH[i], -3000, 3000) * 10); return q; };
function setTH(q) {                                                            // q：0.1 m 精度的 Int16 快照，或 null = 平地
  if (q) { ensureTH(); for (let i = 0; i < q.length; i++) TH[i] = q[i] / 10; }
  else { TH = RH = TR = null; terr.skirt = null; terr.skirtN = 0; treesDirty = true; S.env.canals = []; terr.wet = terr.img = terr.mesh = terrCv = null; ptsCache = new WeakMap(); if (gl) { gl.bindBuffer(gl.ARRAY_BUFFER, bufT); gl.bufferData(gl.ARRAY_BUFFER, 4, gl.DYNAMIC_DRAW); } }
  terrChanged(); saveTerr();
}
function pushUndoTerr() {
  undoStack.push({ terr: TH ? quant() : null, canals: JSON.stringify(S.env.canals) });
  for (let i = undoStack.length - 1, c = 0; i >= 0; i--) if (typeof undoStack[i] !== 'string' && ++c > 2) undoStack.splice(i, 1);   // 地形快照每份约 2 MB，只留 2 步
  if (undoStack.length > 40) undoStack.shift();
}
const cellBox = (w, r) => [Math.max(0, Math.floor((w[0] - r + HALF) / CELL)), Math.min(GN, Math.ceil((w[0] + r + HALF) / CELL)), Math.max(0, Math.floor((w[1] - r + HALF) / CELL)), Math.min(GN, Math.ceil((w[1] + r + HALF) / CELL))];
// 地形和树存在 IndexedDB 里（二进制，容量比 localStorage 大得多），改动后稍等片刻再写
let idbP = null, saveTimer = 0;
function idbOpen() { return idbP || (idbP = new Promise(res => { try { const q = indexedDB.open('litecity', 1); q.onupgradeneeded = () => q.result.createObjectStore('kv'); q.onsuccess = () => res(q.result); q.onerror = () => res(null); } catch (e) { res(null); } })); }
async function idbPut(k, v) { const db = await idbOpen(); if (!db) return; try { const st = db.transaction('kv', 'readwrite').objectStore('kv'); if (v == null) st.delete(k); else st.put(v, k); } catch (e) {} }
async function idbGet(k) { const db = await idbOpen(); if (!db) return null; return new Promise(res => { try { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); } catch (e) { res(null); } }); }
function flushTerr() { clearTimeout(saveTimer); saveTimer = 0; idbPut('terr', TH ? quant() : null); idbPut('trees', TH && TR ? TR : null); }
function saveTerr() { clearTimeout(saveTimer); saveTimer = setTimeout(flushTerr, 700); }
addEventListener('pagehide', () => { if (saveTimer) flushTerr(); });
function upsample(q, vn) {                                                       // 旧版较粗的高度格放大到当前精度
  const out = new Int16Array(VN * VN), k = (vn - 1) / GN;
  for (let j = 0; j < VN; j++) for (let i = 0; i < VN; i++) { const fx = Math.min(i * k, vn - 1.001), fz = Math.min(j * k, vn - 1.001), a = fx | 0, b = fz | 0, u = fx - a, v = fz - b, o = b * vn + a;
    out[j * VN + i] = (q[o] * (1 - u) + q[o + 1] * u) * (1 - v) + (q[o + vn] * (1 - u) + q[o + vn + 1] * u) * v; }
  return out;
}
async function loadTerr() {
  try {
    let q = await idbGet('terr');
    if (!q) { const s = localStorage.getItem(KEY + '-t'); if (s) { const bin = atob(s), b = new Uint8Array(bin.length); for (let i = 0; i < b.length; i++) b[i] = bin.charCodeAt(i); q = new Int16Array(b.buffer); localStorage.removeItem(KEY + '-t'); } }
    if (!q || !q.length) return;
    if (q.length !== VN * VN) { const vn = Math.round(Math.sqrt(q.length)); if (vn * vn !== q.length || vn < 3) return; q = upsample(q, vn); }
    ensureTH(); for (let i = 0; i < q.length; i++) TH[i] = q[i] / 10;
    const t = await idbGet('trees'); if (t && t.length === VN * VN) TR = new Uint8Array(t);
    terrChanged(); saveTerr();
  } catch (e) {}
}
// 抹平笔刷：把半径内的格点朝目标海拔拉
function brush(w) {
  ensureTH();
  const tgt = numIn('tb-elev', 0, -500, 3000), r = numIn('tb-rad', 150, 20, 4000), str = numIn('tb-str', 0.5, 0.05, 1);
  const [i0, i1, j0, j1] = cellBox(w, r);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const d = Math.hypot(i * CELL - HALF - w[0], j * CELL - HALF - w[1]) / r; if (d >= 1) continue;
    const o = j * VN + i; TH[o] += (tgt - TH[o]) * str * (1 - sst(0.55, 1, d));
  }
  terrChanged([i0, i1, j0, j1]);
}
// 随机山脉：各向异性的脊状分形噪声 + 平原阈值 + 中央留平
function vnoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const h = (a, b) => { let n = Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(seed, 1274126177) | 0; n = Math.imul(n ^ n >>> 13, 1274126177); return ((n ^ n >>> 16) >>> 0) / 4294967296; };
  const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10), v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
  return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
}
function genMountains() {
  const seed = numIn('tg-seed', 7, -1e9, 1e9) | 0, maxH = numIn('tg-max', 600, 1, 3000), scale = numIn('tg-scale', 3000, 100, 30000), oct = numIn('tg-oct', 6, 1, 9) | 0;
  const gain = numIn('tg-gain', 0.5, 0.2, 0.8), ridge = numIn('tg-ridge', 0.7, 0, 1), ang = numIn('tg-angle', 25, -360, 360) * D2R, st = numIn('tg-stretch', 2, 1, 6);
  const plain = numIn('tg-plain', 0.35, 0, 0.9), cr = numIn('tg-center', 700, 0, 9000), crag = numIn('tg-crag', 0.7, 0, 1);
  pushUndoTerr(); ensureTH();
  const ca = Math.cos(ang), sa = Math.sin(ang); let mx = 0;
  for (let j = 0; j < VN; j++) for (let i = 0; i < VN; i++) {
    const wx = i * CELL - HALF, wz = j * CELL - HALF;
    let u = (wx * ca + wz * sa) / (scale * st), v = (-wx * sa + wz * ca) / scale;      // 沿走向拉伸，山才成“脉”
    const wp = vnoise(u * 0.7 + 31.4, v * 0.7 + 7.7, seed + 99) - 0.5; u += wp * 0.5; v -= wp * 0.5;   // 轻微扭曲，避免笔直
    let amp = 1, f = 1, tot = 0, norm = 0, wgt = 1;
    for (let k = 0; k < oct; k++) {
      const n = vnoise(u * f + k * 17.3, v * f + k * 5.1, seed + k); let rg = 1 - Math.abs(2 * n - 1); rg *= rg;
      rg *= 1 - crag + crag * wgt; wgt = clamp(rg * 2.4, 0, 1);                  // 山脊上细节多，谷底平滑
      tot += (n * (1 - ridge) + rg * ridge) * amp; norm += amp; amp *= gain; f *= 2;
    }
    let h = tot / norm; h = Math.pow(Math.max(0, (h - plain) / (1 - plain)), 1.25 + 0.6 * crag);                    // 嶙峋：峰更尖、谷更平
    if (crag > 0 && h > 0) {                                                   // 再叠两层只长在高处的细碎山脊，做出棱线和沟壑
      const r1 = 1 - Math.abs(2 * vnoise(u * 11 + 3.1, v * 11 + 7.7, seed + 41) - 1), r2 = 1 - Math.abs(2 * vnoise(u * 27 + 1.3, v * 27 + 9.2, seed + 57) - 1);
      h = Math.max(0, h + crag * Math.pow(h, 1.3) * (0.3 * (r1 * r1 - 0.38) + 0.13 * (r2 * r2 - 0.38)));
    }
    if (cr > 0) h *= sst(cr, cr + 600, Math.hypot(wx, wz));
    TH[j * VN + i] = h; if (h > mx) mx = h;
  }
  const k = mx > 0 ? maxH / mx : 0; for (let i = 0; i < TH.length; i++) TH[i] *= k;
  terrChanged(); saveTerr(); $('#t-status').textContent = `已生成：种子 ${seed}，最高 ${maxH} m。Ctrl+Z 可撤销。`;
}
async function importImg(file) {
  try {
    const bmp = await createImageBitmap(file), cv = document.createElement('canvas'); cv.width = cv.height = VN;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(bmp, 0, 0, VN, VN); if (bmp.close) bmp.close();
    const d = g.getImageData(0, 0, VN, VN).data, lo = numIn('ti-min', 0, -500, 3000), hi = numIn('ti-max', 600, -500, 3000);
    pushUndoTerr(); ensureTH();
    for (let j = 0; j < VN; j++) for (let i = 0; i < VN; i++) { const o = j * VN + i, q = o * 4; TH[o] = lo + (d[q] * 0.299 + d[q + 1] * 0.587 + d[q + 2] * 0.114) / 255 * (hi - lo); }
    terrChanged(); saveTerr(); $('#t-status').textContent = '已导入。图片被缩放到 1025×1025 格，铺满 18 km 见方。';
  } catch (e) { $('#t-status').textContent = '这个文件读不出来，请换一张 PNG 或 JPG。'; }
}
// 水文：优先级洪泛一次求出“每格流向哪”和“洼地填到多高”，再反向累加汇水量
const NB = [-VN - 1, -VN, -VN + 1, -1, 1, VN - 1, VN, VN + 1];
function hydro(wet) {
  const n = VN * VN;
  hyd = { fill: new Float32Array(n), down: new Int32Array(n), order: new Int32Array(n), acc: new Float32Array(n), seen: new Uint8Array(n), heap: new Int32Array(n), city: new Uint8Array(n) };
  const { fill, down, order, acc, seen, heap, city } = hyd; let hn = 0;
  const push = c => { let i = hn++; while (i > 0) { const p = (i - 1) >> 1; if (fill[heap[p]] <= fill[c]) break; heap[i] = heap[p]; i = p; } heap[i] = c; };
  const pop = () => { const top = heap[0], c = heap[--hn]; let i = 0; for (;;) { let l = i * 2 + 1; if (l >= hn) break; if (l + 1 < hn && fill[heap[l + 1]] < fill[heap[l]]) l++; if (fill[heap[l]] >= fill[c]) break; heap[i] = heap[l]; i = l; } heap[i] = c; return top; };
  // 定河道时给地面加一点低频起伏，平原上的河才会蜿蜒而不是走直线（先在 1/8 精度上算好，用时插值）
  const MS = 8, MW = GN / MS + 1, mg = new Float32Array(MW * MW);
  for (let j = 0; j < MW; j++) for (let i = 0; i < MW; i++) mg[j * MW + i] = (vnoise(i * MS / 9, j * MS / 9, 77) - 0.5) * 1.3 + (vnoise(i * MS / 28, j * MS / 28, 78) - 0.5) * 2.2;
  const mnd = (i, j) => { const fx = i / MS, fz = j / MS, a = Math.min(fx | 0, MW - 2), b = Math.min(fz | 0, MW - 2), u = fx - a, v = fz - b, o = b * MW + a; return (mg[o] * (1 - u) + mg[o + 1] * u) * (1 - v) + (mg[o + MW] * (1 - u) + mg[o + MW + 1] * u) * v; };
  const flood = (plain, eps) => {                                              // 优先级洪泛：从出水口往里淹，记下每格流向哪、会被淹到多高
    seen.fill(0); hn = 0; let k = 0;
    for (let j = 0; j < VN; j++) for (let i = 0; i < VN; i++) { const c = j * VN + i; if (i === 0 || j === 0 || i === GN || j === GN || (plain && Math.abs(TH[c]) <= 0.5)) { seen[c] = 1; fill[c] = TH[c]; down[c] = -1; push(c); } }
    while (hn) {
      const c = pop(), ci = c % VN, cj = (c / VN) | 0; order[k++] = c;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni > GN || nj > GN) continue;
        const nb = nj * VN + ni; if (seen[nb]) continue; seen[nb] = 1; fill[nb] = Math.max(TH[nb] + (plain ? 0 : city[nb] * 6 + mnd(ni, nj)), fill[c] + eps); down[nb] = c; push(nb);
      }
    }
  };
  // 第一遍定湖：平原当出水口，所以平地不积水；只留够深、够大的洼地，零碎小坑不算
  if (S.env.lakes) {
  flood(true, 0);
  for (let c = 0; c < n; c++) if (fill[c] - TH[c] > 1.5) { wet[c] = 1; RH[c] = fill[c]; }
  for (let j = 1; j < GN; j++) for (let i = 1; i < GN; i++) { const c = j * VN + i; if (!wet[c]) continue; let q = 0; for (const d of NB) if (wet[c + d]) q++; if (q >= 6) wet[c] = 2; }
  for (let j = 1; j < GN; j++) for (let i = 1; i < GN; i++) { const c = j * VN + i; if (wet[c] !== 1) continue; for (const d of NB) if (wet[c + d] === 2) { wet[c] = 3; break; } }
  for (let c = 0; c < n; c++) { if (wet[c] >= 2) wet[c] = 255; else if (wet[c]) { wet[c] = 0; RH[c] = TH[c]; } }
  }
  if (S.env.rivers) {
  // 第二遍定河：只有地图边缘是出水口，水一路汇到干流再流出去；城市所在的格子垫高一点，河会绕开
  const mark = (x, z) => { const i = Math.round((x + HALF) / CELL), j = Math.round((z + HALF) / CELL); if (i > 1 && j > 1 && i < GN - 1 && j < GN - 1) { const c = j * VN + i; city[c] = 1; for (const d of NB) city[c + d] = 1; } };
  for (const r of S.roads) for (const p of roadPts(r)) mark(p.x, p.z);
  for (const b of S.blds) mark(b.x, b.z);
  flood(false, 0.003);
  acc.fill(1); for (let k = n - 1; k >= 0; k--) { const c = order[k]; if (down[c] >= 0) acc[down[c]] += acc[c]; }
  const thr = S.env.thr;
  for (let j = 1; j < GN; j++) for (let i = 1; i < GN; i++) {
    const c = j * VN + i; if (acc[c] < thr) continue;
    const v = Math.min(255, 170 + 28 * Math.log2(acc[c] / thr)), side = acc[c] >= thr * 10 ? 245 : 190;              // 汇水越多河越宽
    if (wet[c] < v) wet[c] = v; for (const d of [-VN, -1, 1, VN]) if (wet[c + d] < side) wet[c + d] = side;
  }
  }
  hyd = null;                                                                  // 求解表约 6 MB，用完即放
}
// 人工水点：从水点出发漫水，凡是连通且低于水面海拔的格子都淹到同一高度——所以这片水一定是平的
function floodSources(wet) {
  if (!S.env.src.length) return; const stack = new Int32Array(VN * VN);
  for (const q of S.env.src) {
    const i = clamp(Math.round((q.x + HALF) / CELL), 1, GN - 1), j = clamp(Math.round((q.z + HALF) / CELL), 1, GN - 1), h = q.h; let sp = 0;
    const want = c => TH[c] < h && !(wet[c] === 255 && RH[c] >= h);
    if (!want(j * VN + i)) continue; stack[sp++] = j * VN + i; RH[j * VN + i] = h; wet[j * VN + i] = 255;
    while (sp) {
      const c = stack[--sp], ci = c % VN, cj = (c / VN) | 0;
      for (const d of [-VN, -1, 1, VN]) { const nb = c + d, ni = ci + (d === -1 ? -1 : d === 1 ? 1 : 0), nj = cj + (d === -VN ? -1 : d === VN ? 1 : 0); if (ni < 0 || nj < 0 || ni > GN || nj > GN || !want(nb)) continue; RH[nb] = h; wet[nb] = 255; stack[sp++] = nb; }
    }
  }
}
function smoothWet(wet) {                                                        // 湿度场抹一遍 3×3 均值：岸线和河道由阶梯变圆顺
  const tmp = new Uint8Array(VN * VN);
  for (let j = 1; j < GN; j++) for (let i = 1; i < GN; i++) { const c = j * VN + i; let q = wet[c]; for (const d of NB) q += wet[c + d]; tmp[c] = wet[c] === 255 ? 255 : Math.min(255, q / 9 * 1.15); }
  for (let j = 1; j < GN; j++) for (let i = 1; i < GN; i++) { const c = j * VN + i; wet[c] = tmp[c]; }
}
