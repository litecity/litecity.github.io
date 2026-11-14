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
