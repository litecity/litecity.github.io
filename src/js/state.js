/* ───────── 城市状态（两个视图共用的唯一一份） ───────── */
const S = { assets: {}, roads: [], blds: [], env: { water: null, lakes: false, rivers: false, thr: 300, src: [], canals: [] } };
const GN = 1024, VN = GN + 1, HALF = 9000, CELL = HALF * 2 / GN;  // 地形：18×18 km，1025×1025 高度格，每格约 17.6 m
const CH = 64, CN = GN / CH, CV = (CH + 1) * (CH + 1), RV = GN / 2 + 1;   // 16×16 个分块，每块 65×65 顶点；平面图底图 513×513
const SKN = 4 * GN * 6 + 6, LODN = [CH * CH * 6, CH * CH * 6 / 4, CH * CH * 6 / 16];
let TH = null, RH = null, TR = null, terrDirty = false, terrCv = null, hyd = null, treesDirty = true;
const terr = { mesh: null, wet: null, img: null, dirty: new Uint8Array(CN * CN), cb: new Float32Array(CN * CN * 2), skirt: null, skirtN: 0, full: false, lo: 0, hi: 0 };
const ui = { tool: 'select', asset: 'house', rot: 0, snap: true, sel: null, hover: null, rs: null, rc: null, tmode: 'brush', cand: null, drag: null, tol: 4 };
const shop = { open: false, draft: null, sel: -1, editId: null };
const KEY = 'vector-city-1';
const serialize = () => ({ v: 1, assets: Object.values(S.assets).filter(a => !a.builtin).map(a => ({ id: a.id, name: a.name, parts: a.parts })), roads: S.roads, blds: S.blds, env: S.env });
function restore(d) {
  S.assets = {}; for (const a of BUILTIN) S.assets[a.id] = { ...a, builtin: true };
  for (const a of d.assets || []) { const parts = sanitizeParts(a.parts); if (a.id && parts.length) S.assets[a.id] = { id: String(a.id), name: String(a.name || '资产').slice(0, 16), parts }; }
  const pt = p => Array.isArray(p) && isFinite(p[0]) && isFinite(p[1]);
  S.roads = (d.roads || []).filter(r => r && pt(r.a) && pt(r.b) && pt(r.c)).map(r => ({ a: [+r.a[0], +r.a[1]], c: [+r.c[0], +r.c[1]], b: [+r.b[0], +r.b[1]], w: r.w >= 12 ? 14 : 8, ln: r.ln, m: r.m === 1 || r.m === 2 ? r.m : 0,
    h: Array.isArray(r.h) && r.h.length >= 2 && r.h.length <= 64 && r.h.every(Number.isFinite) ? r.h.map(Number) : undefined }));
  S.blds = (d.blds || []).filter(b => b && S.assets[b.a] && isFinite(b.x) && isFinite(b.z)).map(b => ({ a: b.a, x: +b.x, z: +b.z, r: +b.r || 0, ...(b.f && typeof b.f === 'object' ? { f: b.f } : {}) }));
  S.roads.forEach(ensureLanes);
  if (!S.assets[ui.asset]) ui.asset = 'house';
  const e = d.env || {}; S.env = { water: Number.isFinite(e.water) ? e.water : null, lakes: e.lakes != null ? !!e.lakes : !!e.rivers, rivers: !!e.rivers, thr: clamp(+e.thr || 300, 5, 50000),
    src: (Array.isArray(e.src) ? e.src : []).filter(q => q && isFinite(q.x) && isFinite(q.z) && isFinite(q.h)).slice(0, 50).map(q => ({ x: +q.x, z: +q.z, h: +q.h })),
    jx: e.jx && typeof e.jx === 'object' && !Array.isArray(e.jx) ? e.jx : {},
    canals: (Array.isArray(e.canals) ? e.canals : []).filter(k => k && Array.isArray(k.a) && Array.isArray(k.b) && Array.isArray(k.c) && [k.w, k.d, k.z0, k.z1].every(Number.isFinite)).slice(0, 200) };
  ui.sel = ui.cand = null; ui.rs = ui.rc = null; ui.drag = null; terr.full = true; terrDirty = true;
}
let saveBytes = 0;
function save() { const s = JSON.stringify(serialize()); saveBytes = s.length; try { localStorage.setItem(KEY, s); } catch (e) {} }
const undoStack = [];
function pushUndo() { undoStack.push(JSON.stringify(serialize())); if (undoStack.length > 40) undoStack.shift(); }
function undo() { const s = undoStack.pop(); if (!s) return; if (typeof s !== 'string') { if (s.canals) { S.env.canals = JSON.parse(s.canals); save(); } setTH(s.terr); return; } restore(JSON.parse(s)); syncEnvUI(); renderPalette(); changed(); }
