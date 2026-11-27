/* ───────── 资产：矢量配方 ───────── */
const P = (s, x, z, y, w, d, h, c, o) => Object.assign({ s, x, z, y, w, d, h, c }, o || {});
const treeAt = (x, z) => [P('cyl', x, z, 0.3, 0.8, 0.8, 2.6, '#7A5B40'), P('cone', x, z, 2.2, 5, 5, 5.5, '#3F8F56')];
const BUILTIN = [
  { id: 'house', name: '小住宅', parts: [P('box', 0, 0, 0, 10, 8, 5, '#E9E2D0'), P('gable', 0, 0, 5, 11, 9, 3.5, '#A8503A'), P('box', 3, -1.5, 6, 1.2, 1.2, 3.4, '#7A6A5E'), P('box', 0, 4.3, 0, 2, 0.6, 2.6, '#6B8FA8')] },
  { id: 'shop', name: '商店', parts: [P('box', 0, 0, 0, 16, 10, 5, '#EFE7DA'), P('box', 0, 5.8, 3, 16, 2, 0.4, '#D9483B'), P('box', 0, 0, 5, 16.6, 10.6, 0.5, '#6F7780'), P('box', 0, 4.9, 5.5, 8, 0.5, 1.8, '#2F6FB0')] },
  { id: 'apartment', name: '公寓楼', parts: [P('box', 0, 0, 0, 18, 12, 24, '#D8C7B0', { win: 1 }), P('box', 0, 0, 24, 19, 13, 0.8, '#8C8377'), P('box', -4, 0, 24.8, 5, 4, 2.5, '#9AA3A8'), P('box', 0, 6.2, 0, 5, 1, 3.2, '#5C6B78')] },
  { id: 'office', name: '写字楼', parts: [P('box', 0, 0, 0, 22, 22, 6, '#56616B'), P('box', 0, 0, 6, 18, 18, 46, '#7FA6C4', { win: 1 }), P('box', 0, 0, 52, 12, 12, 14, '#93B7D1', { win: 1 }), P('cyl', 0, 0, 66, 1, 1, 10, '#C9CED2')] },
  { id: 'factory', name: '工厂', parts: [P('box', 0, 0, 0, 30, 18, 9, '#B9B2A6'), P('gable', -10, 0, 9, 18, 10, 3, '#7D8790', { r: 90 }), P('gable', 0, 0, 9, 18, 10, 3, '#7D8790', { r: 90 }), P('gable', 10, 0, 9, 18, 10, 3, '#7D8790', { r: 90 }), P('cyl', 12, -6, 9, 3, 3, 17, '#8E5B4A')] },
  { id: 'watertower', name: '水塔', parts: [P('cyl', 0, 0, 0, 2.4, 2.4, 13, '#8D979E'), P('cyl', 0, 0, 13, 9, 9, 5, '#C4D3DC'), P('cone', 0, 0, 18, 9.6, 9.6, 2.5, '#6E8FA3')] },
  { id: 'tree', name: '行道树', parts: [P('cyl', 0, 0, 0, 0.9, 0.9, 3, '#7A5B40'), P('cone', 0, 0, 2.2, 5.5, 5.5, 5, '#3F8F56'), P('cone', 0, 0, 5, 4, 4, 4.5, '#4FA568')] },
  // 树：tree 指向 trees.js 里的树种，实景里画的是那个树种的模型（会随风摆动）；这里的 parts 只用于平面图和图标
  ...[['t_oak', '橡树', 'oak', 15, '#4E8F4A', 9], ['t_maple', '枫树', 'maple', 13, '#C8642E', 8], ['t_birch', '白桦', 'birch', 15, '#8DBB5E', 5], ['t_spruce', '云杉', 'spruce', 20, '#2E6A48', 7], ['t_pine', '松树', 'pine', 17, '#356F4A', 7],
    ['t_willow', '柳树', 'willow', 10, '#9BBF4E', 8], ['t_ginkgo', '银杏', 'ginkgo', 14, '#D9B93A', 6], ['t_poplar', '杨树', 'poplar', 20, '#4F9150', 4], ['t_gum', '桉树', 'gum', 24, '#7E9A72', 7], ['t_shrub', '灌木', 'shrub', 2.2, '#5B9A52', 3]]
    .map(([id, name, tree, th, c, w]) => ({ id, name, tree, th, prop: 1, parts: [P('cyl', 0, 0, 0, Math.min(0.9, w / 6), Math.min(0.9, w / 6), th * 0.4, '#7A5B40'), P('ball', 0, 0, th * 0.3, w, w, th * 0.7, c)] })),
  // 摆件：不产生人流，可以摆在任何地方；sign 的会贴着路边并面向来车，gantry 的会横跨在路上。
  // 路牌有两套样式（variants）：us 美式，cn 中国高速式；label 是牌面上写字的位置（高度、宽、高）、默认文字和字色
  ...(() => { const PL = '#8D979E', WH = '#F4F6F7', US = '#006B54', CN = '#0B7A45', BK = '#1B1F24', pole = (x, h, r = 0.16) => P('cyl', x, 0, 0, r, r, h, PL);
    const board = (y, w, h, col, z = 0.08) => [P('box', 0, z, y - 0.1, w + 0.2, 0.1, h + 0.2, WH), P('box', 0, z + 0.05, y, w, 0.1, h, col)];                  // 白边 + 底色
    const mk = (id, name, extra, us, cn) => ({ id, name, prop: 1, sign: 1, ...extra, parts: us.parts, label: us.label, variants: { us, cn } });
    return [
      mk('sign_name', '路名牌', {}, { parts: [pole(0, 3.4), ...board(2.75, 2.7, 0.5, US)], label: { y: 3.0, w: 2.55, h: 0.42, def: 'MAIN ST' } }, { parts: [pole(0, 3.4), ...board(2.6, 2.5, 0.7, '#1F5FA8')], label: { y: 2.95, w: 2.3, h: 0.58, def: '中山路|ZHONGSHAN RD' } }),
      mk('sign_limit', '限速牌', {}, { parts: [pole(0, 3.3, 0.14), P('box', 0, 0.05, 2.0, 0.98, 0.08, 1.28, BK), P('box', 0, 0.09, 2.06, 0.86, 0.06, 1.16, WH)], label: { y: 2.64, w: 0.8, h: 1.05, def: 'SPEED|LIMIT|55', col: BK } },
        { parts: [pole(0, 3.3, 0.14), P('ball', 0, 0.06, 2.2, 1.05, 0.1, 1.05, '#C8402E'), P('ball', 0, 0.1, 2.31, 0.83, 0.08, 0.83, WH)], label: { y: 2.72, w: 0.7, h: 0.62, def: '60', col: BK } }),
      mk('sign_dir', '指路牌', {}, { parts: [pole(-1.8, 5.6, 0.2), pole(1.8, 5.6, 0.2), ...board(3.4, 4.9, 2.2, US)], label: { y: 4.5, w: 4.6, h: 1.9, def: 'Downtown ↑|Airport →' } }, { parts: [pole(-1.8, 5.6, 0.2), pole(1.8, 5.6, 0.2), ...board(3.4, 4.9, 2.2, CN)], label: { y: 4.5, w: 4.6, h: 1.9, def: '市中心 ↑|机场 →|DOWNTOWN  AIRPORT' } }),
      mk('sign_gantry', '门架指路牌', { gantry: 1 }, { parts: [P('box', -7, 0, 0, 0.5, 0.5, 7.4, PL), P('box', 7, 0, 0, 0.5, 0.5, 7.4, PL), P('box', 0, 0, 7, 14.5, 0.45, 0.45, PL), ...board(7.2, 8.4, 2.6, US, 0.3)], label: { y: 8.5, w: 8.0, h: 2.3, def: 'EXIT 12|Main St  ↗' } },
        { parts: [P('box', -7, 0, 0, 0.5, 0.5, 7.4, PL), P('box', 7, 0, 0, 0.5, 0.5, 7.4, PL), P('box', 0, 0, 7, 14.5, 0.45, 0.45, PL), ...board(7.2, 8.4, 2.6, CN, 0.3)], label: { y: 8.5, w: 8.0, h: 2.3, def: '人民广场 ↑|高速入口 ↗|PEOPLE\'S SQ  EXPWY' } }),
    ]; })(),
  { id: 'cone', name: '交通锥', prop: 1, parts: [P('box', 0, 0, 0, 0.5, 0.5, 0.06, '#2B2F36'), P('cone', 0, 0, 0.06, 0.4, 0.4, 0.72, '#F07A1A')] },
  { id: 'bench', name: '长椅', prop: 1, parts: [P('box', 0, 0, 0.35, 1.8, 0.5, 0.1, '#9A6B43'), P('box', 0, -0.22, 0.45, 1.8, 0.08, 0.5, '#9A6B43'), P('box', -0.75, 0, 0, 0.1, 0.45, 0.35, '#4A4F56'), P('box', 0.75, 0, 0, 0.1, 0.45, 0.35, '#4A4F56')] },
  { id: 'park', name: '小公园', parts: [P('box', 0, 0, 0, 26, 26, 0.3, '#8DBB79'), P('box', -2, -2, 0.3, 1.4, 24, 0.1, '#D9CFB8', { r: 35 }), P('cyl', 6, 5, 0.3, 10, 7, 0.15, '#6FB2D6'), ...treeAt(-9, -8), ...treeAt(-8, 7), ...treeAt(8, -8)] },
];
const SHAPE_SET = new Set(Object.keys(SHAPES));
function sanitizeParts(arr) {
  if (!Array.isArray(arr)) return [];
  const num = (v, a, b, d) => { v = Number(v); return Number.isFinite(v) ? Math.round(clamp(v, a, b) * 100) / 100 : d; };
  const out = [];
  for (const p of arr.slice(0, 40)) {
    if (!p || typeof p !== 'object' || !SHAPE_SET.has(p.s)) continue;
    const q = { s: p.s, x: num(p.x, -60, 60, 0), z: num(p.z, -60, 60, 0), y: num(p.y, 0, 200, 0), w: num(p.w, 0.2, 80, 4), d: num(p.d, 0.2, 80, 4), h: num(p.h, 0.05, 200, 3),
      c: /^#[0-9a-f]{6}$/i.test(p.c) ? p.c : '#B0B8BF' };
    const r = num(p.r, -360, 360, 0); if (r) q.r = r;
    if (p.win) q.win = 1;
    out.push(q);
  }
  return out;
}
const fpCache = new WeakMap();
function fp(a) {
  let f = fpCache.get(a); if (f) return f;
  let mx = 1, mz = 1, h = 0.1;
  for (const p of a.parts) {
    const c = Math.abs(Math.cos((p.r || 0) * D2R)), s = Math.abs(Math.sin((p.r || 0) * D2R));
    mx = Math.max(mx, Math.abs(p.x) + p.w / 2 * c + p.d / 2 * s);
    mz = Math.max(mz, Math.abs(p.z) + p.w / 2 * s + p.d / 2 * c);
    h = Math.max(h, p.y + p.h);
  }
  f = { w: mx * 2, d: mz * 2, h, sorted: a.parts.slice().sort((p, q) => (p.y + p.h) - (q.y + q.h)) };
  fpCache.set(a, f); return f;
}
const partsOf = (as, b) => as.variants ? (as.variants[b && b.st] || as.variants.us).parts : as.parts;     // 路牌按这块牌子选的样式取模型和牌面
const labelOf = (as, b) => as.variants ? (as.variants[b && b.st] || as.variants.us).label : as.label;
