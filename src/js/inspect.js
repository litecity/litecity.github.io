/* ───────── 属性面板：选中道路改车道，选中建筑设人流 ───────── */
let inspKey = '';
const LANE_SYM = { F: '↑', B: '↓', S: '急', X: '✕', M: '▮' };
function inspSync() {                                                            // 每帧比一下“选中了什么”，变了才重画面板
  const el = $('#insp'), s = ui.tool === 'select' && !shop.open ? ui.sel : null, r = s && s.k === 'road' ? S.roads[s.i] : null, b = s && s.k === 'bld' ? S.blds[s.i] : null;
  const key = r ? 'r' + s.i + r.ln + (r.m | 0) : b ? 'b' + s.i + b.a + JSON.stringify(b.f || 0) + sim.on : '';
  if (key === inspKey) { if (b && sim.on) inspLive(s.i); return; }
  inspKey = key; el.hidden = !key; if (!key) return;
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
  const s = ui.sel, act = e.target.dataset.act; if (!s || !act) return;
  if (s.k === 'road') {
    const r = S.roads[s.i], li = laneInfo(r); if (!r) return;
    if (act === 'wl' || act === 'wr') { pushUndo(); setLanes(r, ((act === 'wl' ? e.target.checked : li.wl) ? 'W' : '') + li.core + ((act === 'wr' ? e.target.checked : li.wr) ? 'W' : '')); changed(); }
    else if (act === 'preset' && e.target.value) { pushUndo(); setLanes(r, e.target.value); changed(); }
  } else {
    const b = S.blds[s.i]; if (!b) return; const f = flowOf(b), nums = v => { const a = String(v).split(/[,，\s]+/).map(Number).filter(Number.isFinite).map(x => clamp(x, 0, 1)); while (a.length < 24) a.push(a.length ? a[a.length - 1] : 0); return a.slice(0, 24); };
    pushUndo(); b.f = { p: b.f && b.f.p || '', i: f.i, o: f.o, ...(b.f || {}) };
    if (act === 'fp') { if (e.target.value) b.f.p = e.target.value; else delete b.f; }
    else if (act === 'fi') b.f.i = clamp(+e.target.value || 0, 0, 5000); else if (act === 'fo') b.f.o = clamp(+e.target.value || 0, 0, 5000);
    else if (act === 'ci') b.f.ci = nums(e.target.value); else if (act === 'co') b.f.co = nums(e.target.value);
    changed();
  }
});
