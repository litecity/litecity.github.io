/* ───────── 建造车间 ───────── */
const scratch = new Mesh(512);
function openShop(id) {
  const src = id && S.assets[id];
  shop.editId = src && !src.builtin ? id : null;
  shop.draft = src ? { name: src.builtin ? src.name + ' 改' : src.name, parts: src.parts.map(p => ({ ...p })) }
    : { name: '新建筑', parts: [P('box', 0, 0, 0, 12, 10, 8, '#D9D2C3', { win: 1 }), P('gable', 0, 0, 8, 13, 11, 3, '#8A4B3C')] };
  if (ui.tool === 'terrain') setTool('select');
  shop.sel = 0; shop.open = true;
  $('#shop').hidden = false; $('#stage').classList.add('shopping'); $('#shopName').value = shop.draft.name; $('#shopDelete').hidden = !shop.editId; $('#aiStatus').textContent = '';
  frameShop(); setHint(); shopRefresh();
}
function frameShop() {
  const f = fp(shop.draft), big = Math.max(f.w, f.d, f.h, 10);
  camShop.ty = f.h * 0.45; camShop.dist = big * 2.3 + 14; camShop.tx = camShop.tz = 0;
  vS.cx = 0; vS.cz = 1; vS.s = Math.max(1.5, Math.min(c2.clientWidth || 300, c2.clientHeight || 300) / (Math.max(f.w, f.d, 12) * 1.7));
}
function closeShop() { shop.open = false; $('#shop').hidden = true; $('#stage').classList.remove('shopping'); if (aiCtl) aiCtl.abort(); setHint(); dirtyGeom = true; req(); }
function shopPick(w) {
  const ps = shop.draft.parts; let best = -1, bh = -1;
  ps.forEach((p, i) => { const c = Math.cos((p.r || 0) * D2R), s = Math.sin((p.r || 0) * D2R), dx = w[0] - p.x, dz = w[1] - p.z;
    if (Math.abs(dx * c + dz * s) <= Math.max(p.w / 2, 0.6) && Math.abs(-dx * s + dz * c) <= Math.max(p.d / 2, 0.6) && p.y + p.h > bh) { bh = p.y + p.h; best = i; } });
  return best;
}
function selectPart(i) { shop.sel = i; shopRefresh(); }
const PF = ['x', 'z', 'y', 'r', 'w', 'd', 'h'];
function shopRefresh(keepFields) {
  fpCache.delete(shop.draft);
  const list = $('#partList'); list.textContent = '';
  shop.draft.parts.forEach((p, i) => {
    const b = document.createElement('button'); b.className = 'part'; b.setAttribute('aria-pressed', i === shop.sel);
    const sw = document.createElement('i'); sw.style.background = p.c; const em = document.createElement('em'); em.textContent = `${p.w}×${p.d}×${p.h}`;
    b.append(sw, SHAPES[p.s] + (p.win ? ' · 窗' : ''), em); b.onclick = () => selectPart(i); list.append(b);
  });
  const p = shop.draft.parts[shop.sel];
  $('#fields').style.opacity = p ? 1 : 0.4;
  document.querySelectorAll('#fields input,#fields select,#fields button').forEach(e => e.disabled = !p);
  if (p && !(keepFields && document.activeElement && document.activeElement.closest('#fields'))) {
    $('#pf-s').value = p.s; $('#pf-c').value = p.c; $('#pf-win').checked = !!p.win; for (const k of PF) $('#pf-' + k).value = p[k] || 0;
  } else if (p) { $('#pf-x').value = p.x; $('#pf-z').value = p.z; }
  const f = fp(shop.draft); scratch.n = 0; emitAsset(scratch, shop.draft, { x: 0, z: 0, r: 0 });
  $('#shopRead').textContent = `占地 ${f.w.toFixed(1)}×${f.d.toFixed(1)} m · 高 ${f.h.toFixed(1)} m · 配方 ${fmtB(JSON.stringify(shop.draft.parts).length)} · ${scratch.n} 顶点`;
  dirtyGeom = true; req();
}
$('#fields').addEventListener('input', e => {
  const p = shop.draft && shop.draft.parts[shop.sel]; if (!p) return; const k = e.target.id.slice(3);
  if (k === 's') p.s = e.target.value; else if (k === 'c') p.c = e.target.value; else if (k === 'win') { if (e.target.checked) p.win = 1; else delete p.win; }
  else { const v = parseFloat(e.target.value); if (!Number.isFinite(v)) return; const q = sanitizeParts([{ ...p, [k]: v }])[0]; if (k === 'r') { if (q.r) p.r = q.r; else delete p.r; } else p[k] = q[k]; }
  shopRefresh(true);
});
$('#addRow').addEventListener('click', e => {
  const s = e.target.dataset.add; if (!s) return; const f = fp(shop.draft), top = shop.draft.parts.length ? f.h : 0, roof = s !== 'box' && s !== 'cyl' && s !== 'ball';
  shop.draft.parts.push(P(s, 0, 0, roof ? top : 0, roof ? Math.min(f.w, 12) : 6, roof ? Math.min(f.d, 12) : 6, roof ? 3 : 6, roof ? '#8A4B3C' : '#C9CFD4'));
  selectPart(shop.draft.parts.length - 1);
});
$('#partDup').onclick = () => { const p = shop.draft.parts[shop.sel]; if (!p) return; shop.draft.parts.push({ ...p, x: p.x + 2, z: p.z + 2 }); selectPart(shop.draft.parts.length - 1); };
$('#partDel').onclick = () => { if (shop.sel < 0) return; shop.draft.parts.splice(shop.sel, 1); selectPart(Math.min(shop.sel, shop.draft.parts.length - 1)); };
$('#shopName').oninput = e => { shop.draft.name = e.target.value; };
$('#shopClose').onclick = closeShop;
$('#shopSave').onclick = () => {
  const parts = sanitizeParts(shop.draft.parts); if (!parts.length) { $('#aiStatus').textContent = '至少要有一个部件才能保存。'; return; }
  pushUndo(); const id = shop.editId || 'u' + Date.now().toString(36);
  S.assets[id] = { id, name: (shop.draft.name || '').trim().slice(0, 16) || '未命名', parts };
  ui.asset = id; closeShop(); renderPalette(); setTool('build'); changed();
};
let delArm = 0;
$('#shopDelete').onclick = e => {
  if (!shop.editId) return;
  if (!delArm) { e.target.textContent = '再点一次确认删除'; delArm = setTimeout(() => { delArm = 0; e.target.textContent = '删除此资产'; }, 3000); return; }
  clearTimeout(delArm); delArm = 0; e.target.textContent = '删除此资产';
  pushUndo(); S.blds = S.blds.filter(b => b.a !== shop.editId); delete S.assets[shop.editId]; if (ui.asset === shop.editId) ui.asset = 'house';
  closeShop(); renderPalette(); changed();
};
// 随机生成（离线也能用）
function randomDraft(hint) {
  const R = Math.random, pick = a => a[R() * a.length | 0], r5 = v => Math.round(v * 2) / 2;
  const walls = ['#D8C7B0', '#C9D3DA', '#E6DCCB', '#B8A898', '#9FB4C4', '#D3B9A0', '#A9B7A6'], roofs = ['#A8503A', '#6F7780', '#4E6B7A', '#8A4B3C', '#5E7355'];
  const kind = /塔|楼|厦|tower|office/i.test(hint) ? 'tower' : /厂|仓|库|factory/i.test(hint) ? 'hall' : /屋|宅|家|别墅|house/i.test(hint) ? 'house' : pick(['tower', 'house', 'hall']);
  const parts = [];
  if (kind === 'tower') {
    let w = r5(14 + R() * 12), y = 0; const col = pick(walls);
    for (let t = 0; t < 3; t++) { const h = r5((t ? 10 : 18) + R() * 22); parts.push(P('box', 0, 0, y, w, w, h, col, { win: 1 })); y += h; parts.push(P('box', 0, 0, y, w + 0.6, w + 0.6, 0.6, pick(roofs))); y += 0.6; w = r5(w * 0.7); }
    parts.push(R() < 0.5 ? P('pyr', 0, 0, y, w, w, r5(4 + R() * 6), pick(roofs)) : P('cyl', 0, 0, y, 0.8, 0.8, r5(6 + R() * 8), '#C9CED2'));
    return { name: '随机塔楼', parts };
  }
  if (kind === 'house') {
    const w = r5(9 + R() * 6), d = r5(7 + R() * 4), h = r5(4 + R() * 3);
    parts.push(P('box', 0, 0, 0, w, d, h, pick(walls)), P('gable', 0, 0, h, w + 1, d + 1, r5(2.5 + R() * 2), pick(roofs)), P('box', r5(w / 4), -1, h + 1, 1.2, 1.2, 3, '#7A6A5E'), P('box', 0, d / 2 + 0.3, 0, 2, 0.6, 2.6, '#6B8FA8'));
    if (R() < 0.6) parts.push(P('box', -w / 2 - 2.5, 0, 0, 5, d * 0.7, 3, pick(walls)), P('box', -w / 2 - 2.5, 0, 3, 5.4, d * 0.7 + 0.4, 0.4, pick(roofs)));
    return { name: '随机住宅', parts };
  }
  const w = r5(24 + R() * 14), d = r5(14 + R() * 8), n = 3 + (R() * 2 | 0), rc = pick(roofs);
  parts.push(P('box', 0, 0, 0, w, d, 8, pick(walls)));
  for (let i = 0; i < n; i++) parts.push(P('gable', -w / 2 + w / n * (i + 0.5), 0, 8, d, w / n, 3, rc, { r: 90 }));
  parts.push(P('cyl', w / 2 - 3, -d / 2 + 3, 8, 2.6, 2.6, r5(12 + R() * 8), '#8E5B4A'));
  return { name: '随机厂房', parts };
}
function loadDraft(d) { fpCache.delete(shop.draft); shop.draft.parts = sanitizeParts(d.parts); if (d.name) { shop.draft.name = String(d.name).slice(0, 16); $('#shopName').value = shop.draft.name; } shop.sel = 0; frameShop(); shopRefresh(); }
$('#aiRand').onclick = () => { loadDraft(randomDraft($('#aiPrompt').value)); $('#aiStatus').textContent = '已随机生成一栋，可继续手动修改。'; };
// AI 生成：Claude 只回一份 JSON 配方
let sample = null, aiCtl = null;
const AI_RULES = `你是低多边形矢量建筑设计器。按描述设计一栋建筑，只回复一个 JSON 对象，不要其他文字：
{"name":"简短中文名","parts":[{"s":"box|gable|pyr|cyl|cone|ball","x":0,"z":0,"y":0,"w":10,"d":8,"h":5,"c":"#rrggbb","r":0,"win":true}]}
规则：单位是米。x 向右，z 向前（建筑正面朝 +z），x、z 是部件中心，原点是整栋建筑的占地中心。y 是部件底面离地高度，w 是 x 向宽度，d 是 z 向进深，h 是高度。
形状：box 方体；gable 双坡屋顶（屋脊沿 x 方向，要转向就加 "r":90）；pyr 四棱锥；cyl 圆柱（w、d 是直径）；cone 圆锥；ball 椭球（w、d、h 是三个方向的直径，y 是最低点的高度，适合树冠、穹顶）。r 是绕竖轴的转角（度），可省略。
部件从地面往上叠：上层的 y 等于下层的 y+h，不要悬空。"win":true 只加在需要成排窗户的墙体 box 上，其余省略。
整栋占地不超过 60×60，高度不超过 150，用 4 到 24 个部件，颜色协调，轮廓要一眼能认出是什么。
示例：{"name":"小住宅","parts":[{"s":"box","x":0,"z":0,"y":0,"w":10,"d":8,"h":5,"c":"#E9E2D0"},{"s":"gable","x":0,"z":0,"y":5,"w":11,"d":9,"h":3.5,"c":"#A8503A"}]}
描述：`;
const AI_ERR = { not_granted: '没有获得使用 Claude 的许可，可用“随机一栋”或手动搭建。', sampling_disabled: '这个账号暂时不能调用 Claude。', rate_limited: '调用太频繁了，稍后再试。',
  session_expired: '登录已过期，请重新登录后再试。', refused: 'Claude 没有接受这段描述，换个说法试试。', invalid_json: '返回的内容不是有效配方，再试一次或把描述写得更具体。', empty_completion: '没有得到结果，换个描述试试。' };
function aiIdle() { $('#aiGo').disabled = !sample; $('#aiGo').textContent = sample ? 'AI 生成' : 'AI 不可用'; $('#aiStop').hidden = true; aiCtl = null; }
$('#aiGo').onclick = async () => {
  const text = $('#aiPrompt').value.trim();
  if (!sample) return; if (!text) { $('#aiStatus').textContent = '先写一句描述。'; return; }
  aiCtl = new AbortController(); $('#aiGo').disabled = true; $('#aiStop').hidden = false; $('#aiStatus').textContent = '思考中…';
  try {
    const d = await sample.json(AI_RULES + text.slice(0, 300), { signal: aiCtl.signal, cache: false, onText: ({ text }) => { $('#aiStatus').textContent = `正在画图纸… 已收到 ${text.length} 字符`; } });
    const parts = sanitizeParts(d && d.parts);
    if (!parts.length) throw { code: 'invalid_json' };
    if (shop.open) { loadDraft({ name: d.name, parts }); $('#aiStatus').textContent = `生成完成：${parts.length} 个部件，配方 ${fmtB(JSON.stringify(parts).length)}。可继续手动修改。`; }
  } catch (e) {
    const code = e && e.code; $('#aiStatus').textContent = code === 'cancelled' ? '已停止。' : (AI_ERR[code] || '生成失败，请稍后再试。');
    if (code === 'not_granted' || code === 'sampling_disabled' || code === 'not_declared' || code === 'capability_disabled' || code === 'capability_removed') sample = null;
  }
  aiIdle();
};
$('#aiStop').onclick = () => { if (aiCtl) aiCtl.abort(); };
(async () => {
  try { sample = window.claude && window.claude.use ? await window.claude.use('sample') : null; } catch (e) { sample = null; }
  aiIdle(); if (!sample) $('#aiStatus').textContent = '这里连不上 Claude。可用“随机一栋”或手动搭建。';
})();
