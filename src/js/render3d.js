/* ───────── 3D 渲染：阴影图、相机、拾取、网格组装、出图 ───────── */
function shadowSize(n) {                                                         // 关掉光影时把阴影图缩成 1×1，显存还回去
  if (!gl || sh.size === n) return; sh.size = n;
  gl.bindTexture(gl.TEXTURE_2D, sh.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT16, n, n, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE], [gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  gl.bindFramebuffer(gl.FRAMEBUFFER, sh.fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, sh.tex, 0); gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}
const mul4 = (A, B) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let v = 0; for (let k = 0; k < 4; k++) v += A[k * 4 + r] * B[c * 4 + k]; o[c * 4 + r] = v; } return o; };
function shadowPass(sun, c) {                                                    // 从太阳方向把镜头附近的地形、建筑、树画进一张深度图
  const E = clamp(c.dist * 1.8, 220, 5200), D = E * 2.5 + 900, f = sun.map(v => -v), C = [c.tx, c.ty, c.tz];
  let r = [-f[2], 0, f[0]]; const rl = Math.hypot(r[0], r[2]) || 1; r = [r[0] / rl, 0, r[2] / rl];
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]], dt = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  const V = [r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, -dt(r, C), -dt(u, C), dt(f, C), 1];
  const LVP = mul4([1 / E, 0, 0, 0, 0, 1 / E, 0, 0, 0, 0, -1 / D, 0, 0, 0, 0, 1], V);
  gl.bindFramebuffer(gl.FRAMEBUFFER, sh.fbo); gl.viewport(0, 0, SHSZ, SHSZ); gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.useProgram(sh.prog); gl.uniformMatrix4fv(sh.uVP, false, LVP); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5, 3);
  if (TH && !shop.open && terr.mesh) {
    gl.bindVertexArray(vaoT); gl.bindBuffer(gl.ARRAY_BUFFER, bufT); const cs = CH * CELL;
    for (let k = 0; k < CN * CN; k++) {
      const x = ((k % CN) + 0.5) * cs - HALF, z = (((k / CN) | 0) + 0.5) * cs - HALF, dd = Math.hypot(x - c.tx, z - c.tz); if (dd > E * 1.5 + cs) continue;
      const lod = dd < 2600 ? 0 : dd < 6000 ? 1 : 2; gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, k * CV * 20);
      gl.drawElements(gl.TRIANGLES, LODN[lod], gl.UNSIGNED_SHORT, (lod === 0 ? 0 : lod === 1 ? LODN[0] : LODN[0] + LODN[1]) * 2);
    }
    if (treeM.n) { gl.bindVertexArray(vaoTr); gl.drawArrays(gl.TRIANGLES, 0, treeM.n); }
  }
  gl.bindVertexArray(vaoS); gl.drawArrays(gl.TRIANGLES, 0, stat.n);
  gl.disable(gl.POLYGON_OFFSET_FILL); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { LVP, tex: 2 * E / SHSZ };
}
function initGL() {
  if (!gl) { const d = document.createElement('div'); d.className = 'nogl'; d.textContent = '这个浏览器没有开启 WebGL 2，实景视图无法显示。平面图仍可使用。'; $('#p3').append(d); return; }
  const sh_ = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(o)); return o; };
  prog = gl.createProgram(); gl.attachShader(prog, sh_(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh_(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(prog));
  const UN = ['uVP', 'uSun', 'uSunC', 'uSky', 'uGrid', 'uEye', 'uWin', 'uLit', 'uWater', 'uSand', 'uRock', 'uT', 'uTc', 'uFx', 'uShTex', 'uSh', 'uLVP', 'uTa', 'uTb', 'uTn', 'uAmb', 'uAlpha', 'uFog', 'uNight'];
  for (const n of UN) U[n] = gl.getUniformLocation(prog, n);
  progI = gl.createProgram(); gl.attachShader(progI, sh_(gl.VERTEX_SHADER, VS_I)); gl.attachShader(progI, sh_(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(progI);
  if (!gl.getProgramParameter(progI, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(progI));
  for (const n of UN) UI[n] = gl.getUniformLocation(progI, n);
  skyProg = gl.createProgram(); gl.attachShader(skyProg, sh_(gl.VERTEX_SHADER, SKY_VS)); gl.attachShader(skyProg, sh_(gl.FRAGMENT_SHADER, SKY_FS)); gl.linkProgram(skyProg);
  if (!gl.getProgramParameter(skyProg, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(skyProg));
  for (const n of ['uR', 'uUp', 'uF', 'uZen', 'uHor', 'uCloud', 'uEye', 'uSunD', 'uMoonD', 'uPh', 'uSunC', 'uTan', 'uAsp', 'uTc', 'uNight']) SU[n] = gl.getUniformLocation(skyProg, n);
  vaoSky = gl.createVertexArray();
  { // 实例化用的单位盒子：x、z 在 ±0.5，y 在 0–1
    const P = [[-.5, 0, -.5], [.5, 0, -.5], [.5, 0, .5], [-.5, 0, .5], [-.5, 1, -.5], [.5, 1, -.5], [.5, 1, .5], [-.5, 1, .5]], cube = [];
    for (const [q, n] of [[[0, 1, 5, 4], [0, 0, -1]], [[1, 2, 6, 5], [1, 0, 0]], [[2, 3, 7, 6], [0, 0, 1]], [[3, 0, 4, 7], [-1, 0, 0]], [[4, 5, 6, 7], [0, 1, 0]], [[3, 2, 1, 0], [0, -1, 0]]]) for (const k of [0, 1, 2, 0, 2, 3]) cube.push(...P[q[k]], ...n);
    vaoI = gl.createVertexArray(); gl.bindVertexArray(vaoI); gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cube), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    bufI = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bufI);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 20, 0); gl.vertexAttribDivisor(3, 1); gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 4, gl.UNSIGNED_BYTE, true, 20, 16); gl.vertexAttribDivisor(4, 1);
    gl.bindVertexArray(null);
  }
  sh.prog = gl.createProgram(); gl.attachShader(sh.prog, sh_(gl.VERTEX_SHADER, SH_VS)); gl.attachShader(sh.prog, sh_(gl.FRAGMENT_SHADER, SH_FS)); gl.linkProgram(sh.prog); sh.uVP = gl.getUniformLocation(sh.prog, 'uVP');
  sh.tex = gl.createTexture(); sh.fbo = gl.createFramebuffer(); shadowSize(fx.shadow ? SHSZ : 1);
  const mk = () => { const vao = gl.createVertexArray(), buf = gl.createBuffer(); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.BYTE, true, 20, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, 20, 16); return [vao, buf]; };
  [vaoS, bufS] = mk(); [vaoD, bufD] = mk(); [vaoTr, bufTr] = mk(); [vaoT, bufT] = mk();
  const idx = new Uint16Array(LODN[0] + LODN[1] + LODN[2]), cw = CH + 1; let q = 0;   // 三档精度的索引，所有分块共用
  for (const st of [1, 2, 4]) for (let j = 0; j < CH; j += st) for (let i = 0; i < CH; i += st) { const o = j * cw + i; idx[q++] = o; idx[q++] = o + cw * st; idx[q++] = o + st; idx[q++] = o + st; idx[q++] = o + cw * st; idx[q++] = o + cw * st + st; }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW); gl.bindVertexArray(null);
  gl.enable(gl.DEPTH_TEST); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
}
const camCity = { tx: 0, ty: 0, tz: -30, yaw: 0.55, pitch: 0.62, dist: 430 }, camShop = { tx: 0, ty: 6, tz: 0, yaw: 0.7, pitch: 0.42, dist: 60 };
const cam = () => shop.open ? camShop : camCity, PMIN = 0.06, PUP = -1.4;
function camBasis(c) {
  // c.pitch 是你想要的视线俯仰；c.pe 是镜头实际停的角度（不低于 PMIN，也不低到被山挡住，由 draw3 每帧算好）。
  // 两者相等时镜头绕地面目标点转；视线比 pe 更平或朝上时，镜头停在原地不动，变成原地抬头（仰视）
  const pe = Math.max(c.pe != null ? c.pe : c.pitch, c.pitch, PMIN), cp = Math.cos(c.pitch), sp = Math.sin(c.pitch), sy = Math.sin(c.yaw), cy = Math.cos(c.yaw), ce = Math.cos(pe);
  return { eye: [c.tx + c.dist * ce * sy, c.ty + c.dist * Math.sin(pe) + (c.lift || 0), c.tz + c.dist * ce * cy], f: [-cp * sy, -sp, -cp * cy], r: [cy, 0, -sy], u: [-sy * sp, cp, -cy * sp] };
}
const FOV = 42 * D2R;
function rayAt(ev) {
  const rc = c3.getBoundingClientRect(), b = camBasis(cam()), th = Math.tan(FOV / 2);
  const nx = ((ev.clientX - rc.left) / rc.width * 2 - 1) * th * rc.width / rc.height, ny = (1 - (ev.clientY - rc.top) / rc.height * 2) * th;
  return { o: b.eye, d: [b.f[0] + b.r[0] * nx + b.u[0] * ny, b.f[1] + b.r[1] * nx + b.u[1] * ny, b.f[2] + b.r[2] * nx + b.u[2] * ny] };
}
function groundHit(ray) {
  if (!TH || shop.open) { if (ray.d[1] > -1e-4) return null; const t = -ray.o[1] / ray.d[1]; if (t > 20000) return null; return [ray.o[0] + ray.d[0] * t, ray.o[2] + ray.d[2] * t]; }
  const o = ray.o, d = ray.d, below = t => o[1] + d[1] * t < H(o[0] + d[0] * t, o[2] + d[2] * t);
  let t = 0, st = 5;                                                        // 沿视线步进，再二分求交
  for (let i = 0; i < 500; i++, st *= 1.012) {
    if (below(t + st)) { let a = t, b = t + st; for (let k = 0; k < 10; k++) { const m = (a + b) / 2; if (below(m)) b = m; else a = m; } return [o[0] + d[0] * b, o[2] + d[2] * b]; }
    t += st;
  }
  return null;
}
function pickBld(ray) {
  let best = -1, bt = Infinity;
  S.blds.forEach((b, i) => {
    const f = fp(S.assets[b.a]), c = Math.cos(b.r), s = Math.sin(b.r), ox = ray.o[0] - b.x, oz = ray.o[2] - b.z;
    const o = [ox * c + oz * s, ray.o[1] - H(b.x, b.z), -ox * s + oz * c], d = [ray.d[0] * c + ray.d[2] * s, ray.d[1], -ray.d[0] * s + ray.d[2] * c];
    const lo = [-Math.max(f.w / 2, 1.5), 0, -Math.max(f.d / 2, 1.5)], hi = [-lo[0], f.h, -lo[2]];
    let t0 = 0, t1 = Infinity;
    for (let k = 0; k < 3; k++) {
      if (Math.abs(d[k]) < 1e-9) { if (o[k] < lo[k] || o[k] > hi[k]) return; continue; }
      let a = (lo[k] - o[k]) / d[k], e = (hi[k] - o[k]) / d[k]; if (a > e) [a, e] = [e, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, e); if (t0 > t1) return;
    }
    if (t0 < bt) { bt = t0; best = i; }
  });
  return best;
}
function fit(c) { const dpr = Math.min(devicePixelRatio || 1, 2), w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } return dpr; }

function buildStatic() {
  const m = stat; m.n = 0;
  const G = 40000, gc = hex2rgb(W.ground);
  const gq = (x0, z0, x1, z1) => { tri(m, [x0, 0, z0], [x1, 0, z0], [x1, 0, z1], gc, 0); tri(m, [x0, 0, z0], [x1, 0, z1], [x0, 0, z1], gc, 0); };
  if (shop.open || !TH) gq(-G, -G, G, G);                                    // 有地形时，底面和四周岩壁归地形那一遍画
  if (shop.open) { emitAsset(m, shop.draft, { x: 0, z: 0, r: 0 }); }
  else { computeJ(); lampN = 0; for (const r of S.roads) emitRoad(m, r); emitJunctions(m); tunnelHoles(); for (const b of S.blds) emitAsset(m, S.assets[b.a], b); }
  if (gl) { gl.bindBuffer(gl.ARRAY_BUFFER, bufS); gl.bufferData(gl.ARRAY_BUFFER, m.u.subarray(0, m.n * 20), gl.STATIC_DRAW); }
}
function buildDyn() {
  const m = dyn; m.n = 0;
  const acc = hex2rgb(W.accent), sel = hex2rgb(W.sel), k = cam().dist * 0.016;
  if (shop.open) {
    const f = fp(shop.draft), z = f.d / 2 + 1.5;                              // 正面指示
    tri(m, [-1.5, 0.1, z], [1.5, 0.1, z], [0, 0.1, z + 3], acc, 255);
    const p = shop.draft.parts[shop.sel];
    if (p) {                                                                   // 选中部件：顶面描一圈细框
      const t = Math.max(0.12, k * 0.12), cr = Math.cos((p.r || 0) * D2R), sr = Math.sin((p.r || 0) * D2R), tf = (x, y, z) => [p.x + x * cr - z * sr, y, p.z + x * sr + z * cr];
      for (const [x, z, pw, pd] of [[0, -p.d / 2, p.w + t, t], [0, p.d / 2, p.w + t, t], [-p.w / 2, 0, t, p.d + t], [p.w / 2, 0, t, p.d + t]])
        for (const y of [p.y, p.y + p.h]) emitPart(m, { s: 'box', x, z, y: y - t / 2, w: pw, d: pd, h: t }, tf, sel);
    }
  } else {
    const L = lift() + 0.4;
    if (S.env.water != null) { const y = S.env.water - 0.05, G = 40000, wc = hex2rgb(W.water); tri(m, [-G, y, -G], [G, y, -G], [G, y, G], wc, 204); tri(m, [-G, y, -G], [G, y, G], [-G, y, G], wc, 204); }
    if (ui.tool === 'terrain') for (const q of S.env.src) emitPart(m, { s: 'cone', x: q.x, z: q.z, y: Math.max(q.h, H(q.x, q.z)) + k * 2.2, w: k * 1.6, d: k * 1.6, h: -k * 2.2 }, ID_TF, sel);   // 水点标记：倒锥指向水面
    if (ui.tool === 'terrain' && (ui.tmode === 'brush' || ui.tmode === 'tree') && ui.hover) {
      const r = ui.tmode === 'tree' ? numIn('tr-rad', 200, 20, 4000) : numIn('tb-rad', 150, 20, 4000), t = Math.max(1, k * 0.2), h = ui.hover;
      for (let i = 0; i < 40; i++) {
        const a0 = i / 40 * TAU, a1 = (i + 1) / 40 * TAU, P0 = (a, rr) => { const x = h[0] + Math.cos(a) * rr, z = h[1] + Math.sin(a) * rr; return [x, H(x, z) + 0.8, z]; };
        const p0 = P0(a0, r), p1 = P0(a1, r), p2 = P0(a1, r + t), p3 = P0(a0, r + t); tri(m, p0, p1, p2, acc, 255); tri(m, p0, p2, p3, acc, 255);
      }
    }
    if (sim.on && sim.heat && sim.net && !sim.dirty) { const net = sim.net;    // 拥堵热力：在有车的行车方向上铺一条半透明的色带
      for (let rd = 0; rd < net.n2; rd++) { if (!net.rdN[rd] || (!net.cnt[rd] && net.cong[rd] > 0.93)) continue; const r = net.roads[rd >> 1], l0 = net.rdL0[rd], o0 = net.laneOff[l0], o1 = net.laneOff[l0 + net.rdN[rd] - 1];
        strip(m, net.pts[rd >> 1], Math.min(o0, o1) - 1.6, Math.max(o0, o1) + 1.6, (r.h ? 0.35 : lift()) + 0.3, heatCol(net.cong[rd]), 255, r.h ? p => hAt(r.h, p.t) : null); } }
    if (ui.tool === 'build' && ui.hover && !ui.drag) emitAsset(m, S.assets[ui.asset], poseAt(ui.hover));
    if (pathTool() && ui.hover) {
      const p = pathPt(ui.hover);
      if (ui.rs) {
        const w = pathW(), guide = Math.max(0.5, k * 0.12), step = Math.max(5, k * 1.4);
        if ($('#roadMode').value === 'curve' && !ui.rc) dashLine(m, ui.rs, ui.hover, guide, step, L, acc);                 // 虚线：出发方向
        else { const r = { a: ui.rs, b: p, c: ui.rc || [(ui.rs[0] + p[0]) / 2, (ui.rs[1] + p[1]) / 2], w }; ribbon(m, roadPts(r), w / 2, L, acc, 255); if (ui.rc) dashLine(m, ui.rs, ui.rc, guide, step, L + 0.1, sel); }
        disc(m, ui.rs[0], ui.rs[1], w / 2, L, acc, 255);
      }
      disc(m, p[0], p[1], pathW() / 2, L, acc, 255);
    }
    if (ui.sel && ui.sel.k === 'road' && S.roads[ui.sel.i]) {
      const r = S.roads[ui.sel.i], mid = roadMid(r);
      ribbon(m, roadPts(r), r.w / 2, L + (r.m === 2 ? 0.2 : 0), sel, 255, r.h ? p => hAt(r.h, p.t) : null);
      for (const [e, te] of [[r.a, 0], [r.b, 1]]) emitPart(m, { s: 'cyl', x: e[0], z: e[1], y: roadYAt(r, te, e[0], e[1]), w: k * 1.3, d: k * 1.3, h: k * 1.6 }, ID_TF, sel);
      emitPart(m, { s: 'pyr', x: mid[0], z: mid[1], y: roadYAt(r, 0.5, mid[0], mid[1]), w: k * 1.6, d: k * 1.6, h: k * 2.4, r: 45 }, ID_TF, acc);
    }
    if (ui.cand && ui.cand.k === 'road' && S.roads[ui.cand.i]) ribbon(m, roadPts(S.roads[ui.cand.i]), S.roads[ui.cand.i].w / 5, L, acc, 255);
    for (const [it, colr, thick] of [[ui.sel, sel, 1], [ui.cand, acc, 0.5]]) if (it && it.k === 'bld' && S.blds[it.i]) {
      const b = S.blds[it.i], f = fp(S.assets[b.a]), c = Math.cos(b.r), s = Math.sin(b.r), y0 = H(b.x, b.z), tf = (x, y, z) => [b.x + x * c - z * s, y0 + y, b.z + x * s + z * c];
      const w = f.w + 2, d = f.d + 2, t = Math.max(0.5, k * 0.25) * thick;
      for (const [x, z, pw, pd] of [[0, -d / 2, w, t], [0, d / 2, w, t], [-w / 2, 0, t, d], [w / 2, 0, t, d]]) emitPart(m, { s: 'box', x, z, y: 0, w: pw, d: pd, h: 0.6 }, tf, colr);
    }
  }
  if (gl) { gl.bindBuffer(gl.ARRAY_BUFFER, bufD); gl.bufferData(gl.ARRAY_BUFFER, m.u.subarray(0, m.n * 20), gl.DYNAMIC_DRAW); }
}
// 牌面上的字：不做成贴图，而是把牌子中心投影到屏幕上，在叠在实景上面的一层画布里直接写字。
// 字的大小跟着远近变，横向按牌子朝向压扁；背对镜头或太远太小就不写。字不会被前面的东西挡住，这是这种做法的代价
function drawSignText(VP, eye) {
  const cv = $('#c3t'), g = cv.getContext('2d'); if (cv.width !== c3.width || cv.height !== c3.height) { cv.width = c3.width; cv.height = c3.height; } g.clearRect(0, 0, cv.width, cv.height);
  if (shop.open) return; const Wp = cv.width, Hp = cv.height, th = Math.tan(FOV / 2);
  for (const b of S.blds) {
    const as = S.assets[b.a], lb = as.label; if (!lb || !b.t) continue; const fx_ = -Math.sin(b.r), fz_ = Math.cos(b.r), x = b.x + fx_ * 0.2, z = b.z + fz_ * 0.2, y = baseY(b, as) + lb.y;
    const cw = VP[3] * x + VP[7] * y + VP[11] * z + VP[15]; if (cw < 2 || cw > 1100) continue;
    const dx = eye[0] - x, dz = eye[2] - z, dl = Math.hypot(dx, dz) || 1, facing = (fx_ * dx + fz_ * dz) / dl; if (facing < 0.15) continue;                    // 从背面或侧面看不到字
    const ppm = Hp / 2 / (th * cw), hpx = lb.h * ppm; if (hpx < 7) continue;
    const px = ((VP[0] * x + VP[4] * y + VP[8] * z + VP[12]) / cw * 0.5 + 0.5) * Wp, py = (0.5 - (VP[1] * x + VP[5] * y + VP[9] * z + VP[13]) / cw * 0.5) * Hp;
    const lines = b.t.split('|').slice(0, 4), wpx = lb.w * (b.sx || 1) * ppm; let fs = hpx / lines.length * 0.78;
    g.save(); g.translate(px, py); g.scale(facing, 1); g.font = `600 ${fs}px "Barlow","PingFang SC","Microsoft YaHei",sans-serif`;
    const mw = Math.max(...lines.map(t => g.measureText(t).width)); if (mw > wpx * 0.94) { fs *= wpx * 0.94 / mw; g.font = `600 ${fs}px "Barlow","PingFang SC","Microsoft YaHei",sans-serif`; }
    g.fillStyle = lb.col || '#FFFFFF'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.globalAlpha = clamp((hpx - 7) / 6, 0, 1);
    lines.forEach((t, i) => g.fillText(t, 0, (i - (lines.length - 1) / 2) * fs * 1.15)); g.restore();
  }
}
function draw3() {
  if (!gl || !c3.clientWidth || !c3.clientHeight) return;
  fit(c3); gl.viewport(0, 0, c3.width, c3.height);
  if (!shop.open) {
    const c = camCity; c.ty = H(c.tx, c.tz);
    c.lift = 0; c.pe = Math.max(c.pitch, PMIN);
    if (TH) for (let k = 0; k < 100; k++) {                                    // 镜头和视线都不许钻进山里：被挡就把镜头的位置抬高，但不改你想看的方向
      const e = camBasis(c).eye; let ok = true;
      for (const t of [1, 0.8, 0.6, 0.4, 0.2]) { const x = c.tx + (e[0] - c.tx) * t, z = c.tz + (e[2] - c.tz) * t; if (c.ty + (e[1] - c.ty) * t < H(x, z) + Math.max(2, c.dist * 0.03) * t) { ok = false; break; } }
      if (ok || c.pe >= 1.5) break; c.pe = Math.min(1.5, c.pe + 0.015);
    }
    if (c.pitch < c.pe) { const e = camBasis(c).eye; c.lift = Math.max(0, H(e[0], e[2]) + 1.8 - e[1]); }   // 仰视时人站在地上：眼睛至少离地 1.8 m
  }
  const c = cam(), b = camBasis(c), e = b.eye, asp = c3.width / c3.height, near = Math.max(1, c.dist * 0.05), far = 70000, f = 1 / Math.tan(FOV / 2);
  const dot = (a, v) => a[0] * v[0] + a[1] * v[1] + a[2] * v[2];
  const V = [b.r[0], b.u[0], -b.f[0], 0, b.r[1], b.u[1], -b.f[1], 0, b.r[2], b.u[2], -b.f[2], 0, -dot(b.r, e), -dot(b.u, e), dot(b.f, e), 1];
  const Pm = [f / asp, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0];
  const VP = new Float32Array(16);
  for (let col = 0; col < 4; col++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += Pm[k * 4 + r] * V[col * 4 + k]; VP[col * 4 + r] = s; }
  const v3 = h => hex2rgb(h).map(x => x / 255), st = skyState(), sky = st.hor;
  const shd = fx.shadow ? shadowPass(st.dir, c) : null; gl.viewport(0, 0, c3.width, c3.height);
  gl.clearColor(sky[0], sky[1], sky[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.BLEND); gl.useProgram(skyProg); gl.bindVertexArray(vaoSky);
  gl.uniform3fv(SU.uR, b.r); gl.uniform3fv(SU.uUp, b.u); gl.uniform3fv(SU.uF, b.f); gl.uniform3fv(SU.uEye, e); gl.uniform1f(SU.uTan, Math.tan(FOV / 2)); gl.uniform1f(SU.uAsp, asp);
  gl.uniform3fv(SU.uSunD, st.sun); gl.uniform3fv(SU.uMoonD, st.moon); gl.uniform1f(SU.uPh, st.ph); gl.uniform3fv(SU.uSunC, st.col); gl.uniform1f(SU.uTc, cloudT); gl.uniform1f(SU.uNight, st.night);
  gl.uniform3fv(SU.uZen, st.zen); gl.uniform3fv(SU.uHor, sky); gl.uniform3fv(SU.uCloud, st.cloud);
  gl.drawArrays(gl.TRIANGLES, 0, 3); gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
  const setU = (prog, U) => {                                                  // 两个着色程序（普通网格、实例化的人车）用同一套参数
  gl.useProgram(prog); gl.uniformMatrix4fv(U.uVP, false, VP);
  gl.uniform3fv(U.uSun, st.dir); gl.uniform3fv(U.uSunC, st.col); gl.uniform3fv(U.uRock, v3(W.rock)); gl.uniform1f(U.uTc, cloudT);
  gl.uniform1f(U.uFx, shd ? 1 : 0); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sh.tex); gl.uniform1i(U.uSh, 0);
  if (shd) { gl.uniformMatrix4fv(U.uLVP, false, shd.LVP); gl.uniform1f(U.uShTex, shd.tex); } gl.uniform3fv(U.uSky, sky); gl.uniform3fv(U.uGrid, v3(W.ggrid)); gl.uniform3fv(U.uEye, e);
  gl.uniform3fv(U.uWin, v3(W.win)); gl.uniform3fv(U.uLit, v3(W.lit)); gl.uniform3fv(U.uWater, v3(W.water)); gl.uniform3fv(U.uSand, v3(W.sand));
  gl.uniform1f(U.uAmb, st.amb); gl.uniform1f(U.uNight, st.night); gl.uniform1f(U.uT, (performance.now() / 1000) % 3600);
  gl.uniform1i(U.uTn, shop.open ? 0 : tunSeg.n); gl.uniform4fv(U.uTa, tunSeg.a); gl.uniform4fv(U.uTb, tunSeg.b); gl.uniform1f(U.uFog, Math.max(26000, c.dist * 8));
  gl.uniform1f(U.uAlpha, 1); };
  if (sim.on && sim.instN) setU(progI, UI); setU(prog, U); gl.disable(gl.BLEND);
  const selR = ui.sel && ui.sel.k === 'road' ? S.roads[ui.sel.i] : null, xray = !shop.open && ((ui.tool === 'road' && $('#roadLv').value === '2') || (selR && selR.m === 2));
  const drawTerrain = () => {
  if (TH && !shop.open && terr.mesh) {
    gl.bindVertexArray(vaoT); gl.bindBuffer(gl.ARRAY_BUFFER, bufT);
    const ptr = o => { gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, o); gl.vertexAttribPointer(1, 4, gl.BYTE, true, 20, o + 12); gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, 20, o + 16); };
    const th = Math.tan(FOV / 2), tw = th * asp, kh = Math.sqrt(1 + th * th), kw = Math.sqrt(1 + tw * tw), cs = CH * CELL;
    for (let c = 0; c < CN * CN; c++) {
      const x = ((c % CN) + 0.5) * cs - HALF, z = (((c / CN) | 0) + 0.5) * cs - HALF, y0 = terr.cb[c * 2], y1 = terr.cb[c * 2 + 1], R = Math.hypot(cs * 0.71, (y1 - y0) / 2);
      const dx = x - e[0], dy = (y0 + y1) / 2 - e[1], dz = z - e[2], zz = dx * b.f[0] + dy * b.f[1] + dz * b.f[2];
      if (zz < -R || Math.abs(dx * b.r[0] + dy * b.r[1] + dz * b.r[2]) > zz * tw + R * kw || Math.abs(dx * b.u[0] + dy * b.u[1] + dz * b.u[2]) > zz * th + R * kh) continue;   // 视野外的块不画
      const dd = Math.hypot(dx, dy, dz) - R, lod = dd < 4200 ? 0 : dd < 8500 ? 1 : 2;                                  // 远处的块降档
      ptr(c * CV * 20); gl.drawElements(gl.TRIANGLES, LODN[lod], gl.UNSIGNED_SHORT, (lod === 0 ? 0 : lod === 1 ? LODN[0] : LODN[0] + LODN[1]) * 2);
    }
    ptr(CN * CN * CV * 20); gl.drawArrays(gl.TRIANGLES, 0, terr.skirtN);
    if (treeM.n) { gl.bindVertexArray(vaoTr); gl.drawArrays(gl.TRIANGLES, 0, treeM.n); }
  }
  };
  if (!xray) drawTerrain();
  gl.bindVertexArray(vaoS); gl.drawArrays(gl.TRIANGLES, 0, stat.n);
  if (sim.on && sim.instN && !shop.open) {                                     // 所有人和车：一次实例化绘制
    gl.useProgram(progI); gl.bindVertexArray(vaoI); gl.bindBuffer(gl.ARRAY_BUFFER, bufI); gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(sim.buf, 0, sim.instN * 20), gl.DYNAMIC_DRAW);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, sim.instN); gl.useProgram(prog);
  }
  if (xray) { gl.enable(gl.BLEND); gl.uniform1f(U.uAlpha, 0.55); drawTerrain(); gl.disable(gl.BLEND); gl.uniform1f(U.uAlpha, 1); }   // 修隧道时地形半透明，能看见地下
  drawSignText(VP, e);
  if (dyn.n) { gl.enable(gl.BLEND); gl.uniform1f(U.uAlpha, 0.62); gl.bindVertexArray(vaoD); gl.drawArrays(gl.TRIANGLES, 0, dyn.n); }
}
