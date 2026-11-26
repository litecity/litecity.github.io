/* ───────── 属性面板：选中道路改车道，选中建筑设人流 ───────── */
let inspKey = '';
const LANE_SYM = { F: '↑', B: '↓', S: '急', X: '✕', M: '▮' };
function inspSync() {                                                            // 每帧比一下“选中了什么”，变了才重画面板
  const el = $('#insp'), s = ui.tool === 'select' && !shop.open ? ui.sel : null, r = s && s.k === 'road' ? S.roads[s.i] : null, b = s && s.k === 'bld' ? S.blds[s.i] : null;
  const jn = ui.tool === 'junction' && ui.node && !shop.open ? J.nodes.find(n => nodeKeyOf(n) === ui.node) : null;
  const key = jn ? 'j' + ui.node + jn.arms.length + (ui.jl || '') + JSON.stringify((S.env.jx || {})[ui.node] || 0) : r ? 'r' + s.i + r.ln + (r.m | 0) : b ? 'b' + s.i + b.a + JSON.stringify(b.f || 0) + sim.on + (S.assets[b.a].prop ? 'p' : '') : '';
  if (key === inspKey) { if (b && sim.on) inspLive(s.i); if (jn) jxLive(); return; }
  inspKey = key; el.hidden = !key; if (!key) return;
  if (jn) return jxRender(jn);
  if (r) {
    const li = laneInfo(r);
    el.innerHTML = `<h3>道路 · ${li.w.toFixed(1)} m 宽 · ${['贴地', '桥', '隧道'][r.m | 0]}</h3>
      <div class="lanes">${li.wl ? '<i class="lw">人行</i>' : ''}${li.lanes.map((l, i) => `<button class="ln ln-${l.t}" data-lane="${i}" title="${LANE_NAME[l.t]}，点击切换">${LANE_SYM[l.t]}</button>`).join('')}${li.wr ? '<i class="lw">人行</i>' : ''}</div>
      <div class="note">从左到右（面向这条路的走向）。点一条车道切换：前行 → 逆行 → 应急 → 封闭 → 分隔带。</div>
      <div class="row"><button class="btn sm" data-act="addL">＋左</button><button class="btn sm" data-act="addR">＋右</button><button class="btn sm" data-act="delL">－左</button><button class="btn sm" data-act="delR">－右</button><button class="btn sm" data-act="flip">整体反向</button></div>
      <div class="row"><label><input type="checkbox" data-act="wl" ${li.wl ? 'checked' : ''}> 左人行道</label><label><input type="checkbox" data-act="wr" ${li.wr ? 'checked' : ''}> 右人行道</label></div>
      <label>套用路型 <select data-act="preset"><option value="">—</option>${ROAD_PRESETS.map(p => `<option value="${p[0]}">${p[1]}</option>`).join('')}</select></label>
      <h3>立交与匝道</h3>
      <div class="row"><button class="btn sm" data-act="break">在中点打断</button></div>
      <div class="row"><label>从左数第 <input type="number" id="insp-k" min="1" max="${Math.max(1, li.lanes.length - 1)}" value="${Math.max(1, li.lanes.length - 1)}" style="width:3.2em"> 条之后</label><button class="btn sm" data-act="peel" ${li.lanes.length < 2 ? 'disabled' : ''}>切成两条路</button></div>
      <div class="note">切开后两条路并排、车道原位不动；把其中一条的远端拖走并调弯，就是匝道。车道首尾对齐的地方车会直接开过去，不需要路口。</div>`;
  } else if (S.assets[b.a].prop) {
    const as = S.assets[b.a];
    el.innerHTML = `<h3>${as.name} · 摆件</h3>` + (as.label ? `<label>牌面文字<input type="text" data-act="pt" maxlength="60" value="${(b.t || '').replace(/"/g, '&quot;')}"></label><div class="note">用竖线 | 换行，最多 4 行。可以直接打箭头：↑ ↓ ← → ↖ ↗。</div>` : '') + '<div class="note">摆件不产生人流。拖动可移动，R 旋转。勾着“建筑贴路”时，路牌会立在路边并面向来车，门架会横跨整条路。</div>';
  } else {
    const f = flowOf(b), own = b.f || {};
    el.innerHTML = `<h3>${S.assets[b.a].name} · 人流</h3>
      <label>模式 <select data-act="fp">${[['', '默认（按建筑类型）'], ['none', '无'], ['const', '常量'], ['res', '住宅：早出晚归'], ['work', '办公：早进晚出'], ['shop', '商业：白天进出'], ['custom', '自定义曲线']].map(o => `<option value="${o[0]}" ${(own.p || '') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></label>
      <div class="row"><label>流入峰值 <input type="number" data-act="fi" min="0" max="5000" step="5" value="${f.i}" style="width:5em"> 人/时</label></div>
      <div class="row"><label>流出峰值 <input type="number" data-act="fo" min="0" max="5000" step="5" value="${f.o}" style="width:5em"> 人/时</label></div>
      ${f.p === 'custom' ? `<label>流入曲线（24 个 0–1 的数，逗号分隔，0 点起）<input type="text" data-act="ci" value="${(own.ci || FLOW_SHAPE.const.i).join(',')}"></label><label>流出曲线<input type="text" data-act="co" value="${(own.co || FLOW_SHAPE.const.o).join(',')}"></label>` : ''}
      <canvas id="insp-cv" width="500" height="120" style="width:100%;height:60px"></canvas>
      <div class="note">蓝色是流入，橙色是流出，竖线是当前时刻。实际人数 = 峰值 × 曲线。</div>
      <div class="readout" id="insp-live"></div>`;
    inspCurve(b); inspLive(s.i);
  }
}
function inspCurve(b) {
  const cv = $('#insp-cv'); if (!cv) return; const g = cv.getContext('2d'), f = flowOf(b), W_ = cv.width, H_ = cv.height;
  g.clearRect(0, 0, W_, H_); g.strokeStyle = T.mute; g.strokeRect(0.5, 0.5, W_ - 1, H_ - 1);
  for (const [arr, col] of [[f.ci, '#3D84D6'], [f.co, '#E08A2E']]) { g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); for (let h = 0; h <= 24; h++) { const y = H_ - 6 - arr[h % 24] * (H_ - 12); if (h) g.lineTo(h / 24 * W_, y); else g.moveTo(0, y); } g.stroke(); }
  const x = simHour() / 24 * W_; g.strokeStyle = T.ink; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H_); g.stroke();
}
function inspLive(i) { const el = $('#insp-live'); if (!el) return; el.textContent = sim.on && sim.bIn ? `已到达 ${sim.bIn[i] | 0} · 已出发 ${sim.bOut[i] | 0} · 等待出门 ${sim.bQ[i] | 0} · 流入缺口 ${Math.max(0, sim.need[i]).toFixed(0)}` : '打开顶栏的“模拟”后这里显示实时人数。'; }
$('#insp').addEventListener('click', e => {
  if (e.target.dataset.j) return jxEdit(e);
  const s = ui.sel, r = s && s.k === 'road' ? S.roads[s.i] : null; if (!r) return;
  const li = laneInfo(r), lane = e.target.dataset.lane, act = e.target.dataset.act;
  const put = core => { pushUndo(); setLanes(r, (li.wl ? 'W' : '') + core + (li.wr ? 'W' : '')); changed(); };
  if (lane != null) { const i = +lane, c = li.core[i]; put(li.core.slice(0, i) + LANE_CYCLE[(LANE_CYCLE.indexOf(c) + 1) % LANE_CYCLE.length] + li.core.slice(i + 1)); return; }
  if (act === 'addL' && li.core.length < 14) put('B' + li.core); else if (act === 'addR' && li.core.length < 14) put(li.core + 'F');
  else if (act === 'delL' && li.core.length > 1) put(li.core.slice(1)); else if (act === 'delR' && li.core.length > 1) put(li.core.slice(0, -1));
  else if (act === 'flip') { pushUndo(); const sw = { F: 'B', B: 'F' }; setLanes(r, [...r.ln].reverse().map(c => sw[c] || c).join('')); changed(); }
  else if (act === 'break') { pushUndo(); const p = breakRoad(r, 0.5); ui.sel = { k: 'road', i: S.roads.indexOf(p[1]) }; changed(); }
  else if (act === 'peel') { pushUndo(); const p = peelRoad(r, clamp(+$('#insp-k').value | 0, 1, li.lanes.length - 1)); if (p) { ui.sel = { k: 'road', i: S.roads.indexOf(p[1]) }; changed(); } }
});
$('#insp').addEventListener('change', e => {
  if (e.target.dataset.j) return jxEdit(e);
  const s = ui.sel, act = e.target.dataset.act; if (!s || !act) return;
  if (s.k === 'road') {
    const r = S.roads[s.i], li = laneInfo(r); if (!r) return;
    if (act === 'wl' || act === 'wr') { pushUndo(); setLanes(r, ((act === 'wl' ? e.target.checked : li.wl) ? 'W' : '') + li.core + ((act === 'wr' ? e.target.checked : li.wr) ? 'W' : '')); changed(); }
    else if (act === 'preset' && e.target.value) { pushUndo(); setLanes(r, e.target.value); changed(); }
  } else {
    const b = S.blds[s.i]; if (!b) return; if (act === 'pt') { pushUndo(); b.t = e.target.value.slice(0, 60); changed(); return; }
    const f = flowOf(b), nums = v => { const a = String(v).split(/[,，\s]+/).map(Number).filter(Number.isFinite).map(x => clamp(x, 0, 1)); while (a.length < 24) a.push(a.length ? a[a.length - 1] : 0); return a.slice(0, 24); };
    pushUndo(); b.f = { p: b.f && b.f.p || '', i: f.i, o: f.o, ...(b.f || {}) };
    if (act === 'fp') { if (e.target.value) b.f.p = e.target.value; else delete b.f; }
    else if (act === 'fi') b.f.i = clamp(+e.target.value || 0, 0, 5000); else if (act === 'fo') b.f.o = clamp(+e.target.value || 0, 0, 5000);
    else if (act === 'ci') b.f.ci = nums(e.target.value); else if (act === 'co') b.f.co = nums(e.target.value);
    changed();
  }
});

// ── 路口面板：像 TM:PE 那样给红绿灯编步骤，给进口立让行标志
const COMPASS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
function jxArms(n) {                                                             // 这个路口的各个进口：从哪边来、编号
  return n.arms.map(a => { const p = roadPts(a.r), q = a.e === 'a' ? p[0] : p[p.length - 1], sg = a.e === 'b' ? 1 : -1, hx = q.tx * sg, hz = q.tz * sg, li = laneInfo(a.r);
    return { ak: armKey(hx, hz), hx, hz, x: n.x, z: n.z, name: COMPASS[((Math.round(Math.atan2(-hx, hz) / (Math.PI / 4)) % 8) + 8) % 8] + '侧来车', has: (a.e === 'b' ? li.fwd : li.back).length > 0 }; }).filter(a => a.has);
}
const jxCfg = () => { const jx = S.env.jx || (S.env.jx = {}); return jx[ui.node] || (jx[ui.node] = { m: 'auto', st: [], pri: {} }); };
function jxRender(n) {
  const el = $('#insp'), arms = jxArms(n), cfg = (S.env.jx || {})[ui.node] || { m: 'auto', st: [], pri: {} }, m = cfg.m || 'auto', BT = [[2, '←', '左转'], [1, '↑', '直行'], [4, '→', '右转']];
  el.innerHTML = `<h3>路口 · ${n.arms.length} 岔</h3>
    <label>控制方式 <select data-j="m">${[['auto', '自动红绿灯（两相位）'], ['none', '无信号，按让行标志'], ['timed', '自定义定时红绿灯']].map(o => `<option value="${o[0]}" ${m === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></label>
    ${m === 'none' ? `<h3>让行标志</h3>${arms.map(a => `<div class="jarm"><span>${a.name}</span><select data-j="pri" data-k="${a.ak}">${[[0, '自动（宽路为主路）'], [1, '主路'], [2, '让行'], [3, '停车让行']].map(o => `<option value="${o[0]}" ${((cfg.pri || {})[a.ak] | 0) === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div>`).join('')}<div class="note">次路的车要等主路上快到路口的车过去。左转永远让对向直行和右转。</div>` : ''}
    ${m === 'timed' ? `<h3>定时步骤（循环执行）</h3>${(cfg.st || []).map((s, i) => `<div class="jstep" data-step="${i}"><div class="jarm"><label>第 ${i + 1} 步 <input type="number" data-j="d" data-s="${i}" min="1" max="600" value="${s.d}" style="width:4.2em"> 秒</label><button class="btn sm warn" data-j="del" data-s="${i}">删除</button></div>
      ${arms.map(a => `<div class="jarm"><span>${a.name}</span><span>${BT.map(b => `<button class="tg ${((s.g || {})[a.ak] | 0) & b[0] ? 'on' : ''}" data-j="g" data-s="${i}" data-k="${a.ak}" data-b="${b[0]}" title="${b[2]}">${b[1]}</button>`).join(' ')}</span></div>`).join('')}</div>`).join('')}
      <div class="row"><button class="btn sm" data-j="add">＋ 加一步</button><button class="btn sm" data-j="fill">用自动方案填充</button></div>
      <div class="note">每一步里，绿色的箭头是这一步放行的方向，红色是禁行。一步全红可以当清空时间。左转遇到对向直行仍会让行。</div>` : ''}
    ${m === 'auto' ? '<div class="note">大致同一条直线上的两个进口同时放行 20 秒，然后全红 3 秒，再换另一组。想自己编就选“自定义定时红绿灯”。</div>' : ''}
    <h3>车道连接</h3>
    <div class="note">${ui.jl ? '已选中一条进口车道（蓝色实心点）。点出口车道的空心点，连上或断开；再点一次实心点取消选中。' : '在图上点一条进口车道的实心点，再点它可以去的出口车道的空心点。没连过的车道可以去所有方向；连过的只能去连着的车道。'}</div>
    <div class="row"><button class="btn sm warn" data-j="lcclr" ${cfg.lc && Object.keys(cfg.lc).length ? '' : 'disabled'}>清除本路口的车道连接</button></div>
    <div class="readout" id="jx-live"></div>`;
  jxLive();
}
function jxLive() {
  const el = $('#jx-live'); if (!el) return; let cur = -1;
  if (sim.on && sim.net) { const id = sim.net.nodeByKey.get(ui.node), nd = id != null ? sim.net.nodes[id] : null; if (nd && nd.steps) { cur = simStepOf(nd); el.textContent = `模拟中：现在是第 ${cur + 1} 步，一个周期 ${nd.cyc} 秒`; } else el.textContent = '模拟中：这个路口没有信号灯'; }
  else el.textContent = '打开“模拟”可以看到灯在走。';
  document.querySelectorAll('#insp .jstep').forEach(d => d.classList.toggle('now', +d.dataset.step === cur));
}
function jxEdit(e) {
  const t = e.target, act = t.dataset.j, n = J.nodes.find(q => nodeKeyOf(q) === ui.node); if (!n || (e.type === 'click' && t.tagName !== 'BUTTON') || (e.type === 'change' && t.tagName === 'BUTTON')) return;
  pushUndo(); const cfg = jxCfg(), s = cfg.st[+t.dataset.s];
  if (act === 'm') { cfg.m = t.value; if (cfg.m === 'timed' && !cfg.st.length) cfg.st = autoSteps(jxArms(n)); }
  else if (act === 'pri') { cfg.pri = cfg.pri || {}; if (+t.value) cfg.pri[t.dataset.k] = +t.value; else delete cfg.pri[t.dataset.k]; }
  else if (act === 'd' && s) s.d = clamp(+t.value || 10, 1, 600);
  else if (act === 'del' && s) cfg.st.splice(+t.dataset.s, 1);
  else if (act === 'g' && s) { s.g = s.g || {}; s.g[t.dataset.k] = (s.g[t.dataset.k] | 0) ^ +t.dataset.b; }
  else if (act === 'add' && cfg.st.length < 16) cfg.st.push({ d: 15, g: {} });
  else if (act === 'fill') cfg.st = autoSteps(jxArms(n));
  else if (act === 'lcclr') { delete cfg.lc; ui.jl = null; }
  changed();
}
