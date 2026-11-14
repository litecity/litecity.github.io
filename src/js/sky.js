/* ───────── 天空与光照：时辰 → 太阳、月亮、天色 ───────── */
const fx = { shadow: true, cloud: true, local: true, hour: 14.5 }, SHSZ = 2048, sh = { prog: null, tex: null, fbo: null, uVP: null, size: 0 };
try { Object.assign(fx, JSON.parse(localStorage.getItem('litecity-fx') || '{}')); } catch (e) {}
fx.hour = clamp(+fx.hour || 0, 0, 24); let cloudT = 40, lastCT = 0;
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const unit = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
// 按时刻算太阳和月亮在天上的位置（北纬 35°，东 = +x，北 = −z）。勾“本地时间”时用这台电脑的时钟。
// 太阳：由日期得赤纬、由钟点得时角。月亮：由朔望月龄得月相，月亮比太阳晚“月相角”过中天。
function skyState() {
  const now = new Date(), hour = fx.local ? now.getHours() + now.getMinutes() / 60 : fx.hour, lat = 35 * D2R;
  const N = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 864e5);
  const at = (ha, dc) => {
    const se = Math.sin(lat) * Math.sin(dc) + Math.cos(lat) * Math.cos(dc) * Math.cos(ha), el = Math.asin(clamp(se, -1, 1)), ce = Math.cos(el);
    let az = Math.acos(clamp((Math.sin(dc) - se * Math.sin(lat)) / (ce * Math.cos(lat) || 1e-6), -1, 1)); if (Math.sin(ha) > 0) az = TAU - az;
    return { el, dir: [Math.sin(az) * ce, se, -Math.cos(az) * ce] };
  };
  const ha = (hour - 12) * 15 * D2R, sun = at(ha, -23.44 * D2R * Math.cos(TAU * (N + 10) / 365));
  const SYN = 29.530588853, age = ((now / 864e5 + 2440587.5 - 2451550.1) % SYN + SYN) % SYN, ph = age / SYN * TAU, frac = (1 - Math.cos(ph)) / 2;
  const moon = at(ha - ph, 23.44 * D2R * Math.sin(TAU * (N - 80) / 365 + ph));
  const night = sst(0.06, -0.14, sun.el), dusk = Math.exp(-((sun.el / 0.17) ** 2));
  let dir, col;                                                                  // 场景只有一盏主光：太阳在就用太阳，否则用月亮
  if (sun.el > -0.03) { const t = clamp((sun.el - 0.02) / 0.5, 0, 1), k = sst(-0.03, 0.1, sun.el); dir = unit([sun.dir[0], Math.max(sun.dir[1], 0.1), sun.dir[2]]); col = [k, (0.55 + 0.42 * t) * k, (0.3 + 0.62 * t) * k]; }
  else if (moon.el > 0.04) { const k = (0.1 + 0.3 * frac) * sst(0.04, 0.2, moon.el); dir = unit([moon.dir[0], Math.max(moon.dir[1], 0.12), moon.dir[2]]); col = [0.55 * k, 0.66 * k, 0.95 * k]; }
  else { dir = unit([0.3, 0.9, 0.3]); col = [0.05, 0.06, 0.1]; }
  return { hour, sun: sun.dir, moon: moon.dir, ph, frac, night, dir, col,
    zen: mix3(mix3([0.24, 0.52, 0.84], [0.29, 0.38, 0.6], dusk * 0.6), [0.02, 0.04, 0.08], night),
    hor: mix3(mix3([0.77, 0.87, 0.94], [0.96, 0.66, 0.42], dusk * 0.8), [0.07, 0.11, 0.17], night),
    cloud: mix3(mix3([1, 1, 1], [1, 0.8, 0.68], dusk * 0.7), [0.2, 0.26, 0.36], night),
    amb: 0.58 - 0.34 * night - (fx.shadow ? 0.1 * (1 - night) : 0) };
}
const hhmm = h => String(Math.floor(h) % 24).padStart(2, '0') + ':' + String(Math.round((h % 1) * 60) % 60).padStart(2, '0');
function syncFx() {
  $('#fx-sh').checked = fx.shadow; $('#fx-cl').checked = fx.cloud; $('#fx-lt').checked = fx.local;
  const h = skyState().hour; $('#fx-hr').disabled = fx.local; $('#fx-hr').value = h; $('#fx-tm').textContent = hhmm(h);
}
function saveFx() { try { localStorage.setItem('litecity-fx', JSON.stringify(fx)); } catch (e) {} syncFx(); req(); }
$('#fx-sh').onchange = e => { fx.shadow = e.target.checked; shadowSize(fx.shadow ? SHSZ : 1); saveFx(); };
$('#fx-cl').onchange = e => { fx.cloud = e.target.checked; saveFx(); };
$('#fx-lt').onchange = e => { fx.local = e.target.checked; if (!fx.local) fx.hour = +$('#fx-hr').value; saveFx(); };
$('#fx-hr').oninput = e => { fx.hour = +e.target.value; saveFx(); };
setInterval(() => { if (fx.local && !document.hidden) { syncFx(); req(); } }, 60000);   // 跟随本地时间时每分钟对一次表
