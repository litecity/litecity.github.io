/* ───────── 人流与车流模拟 ─────────
   设计目标是“人多也不卡”，所以：
   · 人和车没有对象，全部放在几条定长的类型数组里（一个人 = 每条数组里的一个下标）；
   · 不给每个人单独寻路：按“目的地所在的那条路”算一张全网的“下一步去哪”表，同一目的地的人共用，走到路口查表即可；
   · 车只在自己的车道里排队跟车（每条车道是一条先进先出的链表），不做全局碰撞检测；
   · 画的时候用实例化：一辆车 = 两个盒子 = 40 字节，一次绘制调用画完所有人和车。
   路网按“路 × 方向”建图：每条路有正、反两个行驶方向，各有若干条可走的车道。
   两种连接：① 车道首尾对齐（位置差不到 1.7 m、方向一致）→ 直接驶入，匝道分流/合流就是这种；
            ② 路的端点汇在同一个路口 → 进口的车道可以去别的路的出口车道，三岔以上有红绿灯。 */
const SIM_CAP = 20000, CAR_GAP = 6.5;
const sim = { on: false, heat: true, tick: 0, speed: 20, t: 8 * 3600, acc: 0, dAcc: 0, net: null, sig: '', dirty: true, nCar: 0, nPed: 0, inCity: 0, outCity: 0, stuck: 0, lost: 0, need: null, outAcc: null, bIn: null, bOut: null, bQ: null, inst: null, instN: 0 };
const aK = new Uint8Array(SIM_CAP), aRd = new Int32Array(SIM_CAP), aLn = new Int8Array(SIM_CAP), aS = new Float32Array(SIM_CAP), aV = new Float32Array(SIM_CAP),
  aLead = new Int32Array(SIM_CAP), aFoll = new Int32Array(SIM_CAP), aDst = new Int32Array(SIM_CAP), aDS = new Float32Array(SIM_CAP), aGate = new Int32Array(SIM_CAP), aB = new Int32Array(SIM_CAP),
  aNx = new Int32Array(SIM_CAP), aLat = new Float32Array(SIM_CAP), aCol = new Uint8Array(SIM_CAP), aWait = new Float32Array(SIM_CAP), aArm = new Uint8Array(SIM_CAP), aCd = new Float32Array(SIM_CAP), aFrom = new Int32Array(SIM_CAP).fill(-1), aFromLn = new Int8Array(SIM_CAP), aJL = new Float32Array(SIM_CAP), aFF = new Array(SIM_CAP);
let aFree = [], aTop = 0;                                                        // 空位栈；aTop = 用到过的最大下标 + 1

// ── 人流曲线：24 个小时各一个 0–1 的系数，乘上峰值就是该小时的人数/时
const FLOW_SHAPE = {
  none: { i: new Array(24).fill(0), o: new Array(24).fill(0) }, const: { i: new Array(24).fill(1), o: new Array(24).fill(1) },
  res: { o: [.05, .03, .03, .03, .05, .15, .5, 1, .9, .5, .3, .3, .3, .3, .3, .3, .3, .35, .4, .35, .25, .15, .1, .07], i: [.1, .05, .03, .03, .03, .05, .1, .15, .2, .25, .3, .35, .4, .35, .3, .35, .5, .9, 1, .8, .6, .4, .25, .15] },
  work: { i: [.02, .02, .02, .02, .03, .1, .4, 1, .95, .5, .3, .25, .3, .35, .25, .2, .15, .1, .08, .05, .04, .03, .02, .02], o: [.02, .02, .02, .02, .02, .03, .05, .08, .1, .15, .2, .3, .4, .3, .25, .3, .5, 1, .9, .6, .4, .25, .1, .05] },
  shop: { i: [0, 0, 0, 0, 0, 0, .05, .15, .3, .5, .7, .9, 1, .9, .8, .8, .85, .95, 1, .9, .6, .3, .1, 0], o: [0, 0, 0, 0, 0, 0, 0, .05, .15, .3, .5, .7, .9, 1, .9, .8, .8, .85, .95, 1, .9, .6, .3, .1] },
};
const FLOW_DEF = { house: ['res', 4, 4], apartment: ['res', 45, 45], office: ['work', 140, 140], shop: ['shop', 35, 35], factory: ['work', 70, 70], park: ['shop', 12, 12] };
function flowOf(b) {
  const d = FLOW_DEF[b.a] || ['none', 0, 0], f = b.f || {}, p = f.p || d[0], sh = FLOW_SHAPE[p] || FLOW_SHAPE.none;
  return { p, i: f.i != null ? f.i : d[1], o: f.o != null ? f.o : d[2], ci: p === 'custom' ? (f.ci || FLOW_SHAPE.const.i) : sh.i, co: p === 'custom' ? (f.co || FLOW_SHAPE.const.o) : sh.o };
}
const simHour = () => sim.on ? (sim.t / 3600) % 24 : skyState().hour;

// 路口进口的编号：按驶入方向每 22.5° 一档（路的下标会变，方向不会），用来存用户设的信号和让行标志
const armKey = (hx, hz) => ((Math.round(Math.atan2(hz, hx) / (Math.PI / 8)) % 16) + 16) % 16;
const nodeKeyOf = n => Math.round(n.x * 2) + ',' + Math.round(n.z * 2);
function autoSteps(arms) {                                                       // 自动方案：大致同一条直线上的进口同时放行，两相位，中间 3 秒全红。位：1 直行 2 左转 4 右转
  const ph = a => Math.round(Math.atan2(a.hz, a.hx) / (Math.PI / 2)) & 1;
  return [0, -1, 1, -1].map(p => { const g = {}; for (const a of arms) g[a.ak] = p >= 0 && ph(a) === p ? 7 : 0; return { d: p < 0 ? 3 : 20, g }; });
}
// ── 把路网编译成紧凑的数组
function simCompile() {
  const R = S.roads.length, n2 = R * 2, pts = S.roads.map(roadPts), infos = S.roads.map(laneInfo);
  const rdLen = new Float32Array(n2), rdV = new Float32Array(n2), rdN = new Uint8Array(n2), rdL0 = new Int32Array(n2), rdS0 = new Float32Array(n2), rdS1 = new Float32Array(n2), walk = new Uint8Array(R);
  const laneOff = []; const cTo = [], cMask = [], cMap = [], cJ = [], cT = [], yl = [], pTo = [];
  for (let i = 0; i < R; i++) {
    const li = infos[i], v = roadSpeed(S.roads[i]), je = J.ends.get(S.roads[i]); walk[i] = li.wl || li.wr ? 1 : 0;
    if (je) { rdS0[i * 2] = rdS1[i * 2 + 1] = je.a; rdS1[i * 2] = rdS0[i * 2 + 1] = je.b; }                         // 路口占掉的那一段：车在这段里走的是路口内的曲线
    for (let d = 0; d < 2; d++) { const rd = i * 2 + d, ls = d ? li.back.slice().reverse() : li.fwd; rdLen[rd] = Math.max(1, pts[i].len); rdV[rd] = v; rdN[rd] = ls.length; rdL0[rd] = laneOff.length; for (const l of ls) laneOff.push(l.o); cTo.push([]); cMask.push([]); cMap.push([]); cJ.push([]); cT.push([]); yl.push([]); pTo.push([]); }
  }
  // 每条路两端的位置、走向和高度
  const endOf = (i, e) => { const p = e ? pts[i][pts[i].length - 1] : pts[i][0], r = S.roads[i]; return { x: p.x, z: p.z, tx: p.tx, tz: p.tz, y: roadYAt(r, e ? 1 : 0, p.x, p.z) }; };
  const ends = []; for (let i = 0; i < R; i++) ends.push([endOf(i, 0), endOf(i, 1)]);
  const lanePos = (i, e, o) => { const q = ends[i][e]; return [q.x - q.tz * o, q.z + q.tx * o]; };
  // ① 车道首尾对齐的连接：把所有“入口车道”的起点放进格子，再让每条“出口车道”的终点去找
  const grid = new Map(), gk = (x, z) => Math.floor(x / 4) * 73856093 ^ Math.floor(z / 4) * 19349663;
  for (let i = 0; i < R; i++) for (let d = 0; d < 2; d++) { const rd = i * 2 + d, e = d ? 1 : 0, q = ends[i][e], sg = d ? -1 : 1;
    for (let k = 0; k < rdN[rd]; k++) { const p = lanePos(i, e, laneOff[rdL0[rd] + k]), key = gk(p[0], p[1]); let l = grid.get(key); if (!l) grid.set(key, l = []); l.push({ rd, k, x: p[0], z: p[1], y: q.y, hx: q.tx * sg, hz: q.tz * sg }); } }
  const link = (from, k, to, tk, junction, turn) => { let c = cTo[from].indexOf(to); if (c < 0) { c = cTo[from].length; cTo[from].push(to); cMask[from].push(0); cMap[from].push(new Int8Array(rdN[from]).fill(-1)); cJ[from].push(junction ? 1 : 0); cT[from].push(turn | 0); yl[from].push(null); } cMask[from][c] |= 1 << k; cMap[from][c][k] = tk; };
  for (let i = 0; i < R; i++) for (let d = 0; d < 2; d++) { const rd = i * 2 + d, e = d ? 0 : 1, q = ends[i][e], sg = d ? -1 : 1;
    for (let k = 0; k < rdN[rd]; k++) { const p = lanePos(i, e, laneOff[rdL0[rd] + k]);
      for (let gx = -1; gx <= 1; gx++) for (let gz = -1; gz <= 1; gz++) { const l = grid.get(gk(p[0] + gx * 4, p[1] + gz * 4)); if (!l) continue;
        for (const t of l) if ((t.rd >> 1) !== i && Math.hypot(t.x - p[0], t.z - p[1]) < 1.7 && Math.abs(t.y - q.y) < 2.5 && t.hx * q.tx * sg + t.hz * q.tz * sg > 0.6) link(rd, k, t.rd, t.k, false); } } }
  // ② 路口：端点落在同一处、高度相近的路
  const nodeMap = new Map();
  for (let i = 0; i < R; i++) for (let e = 0; e < 2; e++) { const q = ends[i][e], key = Math.round(q.x * 2) + ',' + Math.round(q.z * 2); let l = nodeMap.get(key); if (!l) nodeMap.set(key, l = []); l.push({ i, e, y: q.y }); }
  // 每个三岔以上的路口记下：各进口、让行等级、信号步骤（自动两相位，或用户在“路口”工具里编的定时灯）
  const nodes = [], rdNode = new Int32Array(n2).fill(-1), nodeByKey = new Map(), jx = S.env.jx || {};
  const appr = (i, e) => { const q = ends[i][e], sg = e ? 1 : -1; return [q.tx * sg, q.tz * sg]; };                 // 驶入路口的方向
  for (const l of nodeMap.values()) { l.sort((a, b) => a.y - b.y); let g = [l[0]]; const flush = () => {
      if (g.length >= 2) { let made = 0; const q0 = ends[g[0].i][g[0].e], key = Math.round(q0.x * 2) + ',' + Math.round(q0.z * 2), cfg = jx[key] || {}, lc = cfg.lc || {};
        for (const A of g) { const from = A.i * 2 + (A.e ? 0 : 1); if (!rdN[from]) continue; const hA = appr(A.i, A.e), akA = armKey(hA[0], hA[1]), had = cTo[from].slice();
          for (const B of g) { if (B === A) continue; const to = B.i * 2 + (B.e ? 1 : 0); if (!rdN[to] || had.includes(to)) continue; made++;
            const hB = appr(B.i, B.e), akB = armKey(hB[0], hB[1]), side = hB[0] * hA[1] - hB[1] * hA[0], turn = side > 0.35 ? 1 : side < -0.35 ? 2 : 0;           // 驶出方向在右手边 = 右转(1)，左手边 = 左转(2)
            for (let k = 0; k < rdN[from]; k++) { const custom = lc[akA + ':' + k];                                    // 用户连过的车道只按连接走，没连过的可以去所有出口
              if (custom) { for (const t of custom) { const [ak2, tk] = String(t).split(':').map(Number); if (ak2 === akB && tk < rdN[to]) link(from, k, to, tk, true, turn); } }
              else link(from, k, to, rdN[from] > 1 ? Math.round(k / (rdN[from] - 1) * (rdN[to] - 1)) : (rdN[to] - 1) >> 1, true, turn); } } }
        if (g.length >= 3 && made) {
          const id = nodes.length;
          const arms = g.map(A => { const rd = A.i * 2 + (A.e ? 0 : 1), h = appr(A.i, A.e), q = ends[A.i][A.e]; return { rd, hx: h[0], hz: h[1], ak: armKey(h[0], h[1]), x: q.x, z: q.z, has: rdN[rd] > 0, rank: rdV[rd] * 10 + rdN[rd] + rdN[rd ^ 1] }; });
          const top = Math.max(...arms.map(a => a.rank)), flat = arms.every(a => a.rank === top);
          for (const a of arms) { const p = cfg.pri && cfg.pri[a.ak]; a.pri = p >= 1 && p <= 3 ? p : flat || a.rank === top ? 1 : 2; if (a.has) rdNode[a.rd] = id; }   // 没设标志时：路更宽更快的一方是主路
          let steps = null; const mode = cfg.m || 'auto';
          if (mode === 'timed' && Array.isArray(cfg.st) && cfg.st.length) steps = cfg.st.map(s => ({ d: clamp(+s.d || 10, 1, 600), g: new Map(arms.map(a => [a.rd, (s.g && s.g[a.ak]) | 0])) }));
          else if (mode !== 'none') steps = autoSteps(arms).map(s => ({ d: s.d, g: new Map(arms.map(a => [a.rd, s.g[a.ak] | 0])) }));
          let cyc = 0; if (steps) for (const s of steps) cyc += s.d;
          nodes.push({ key, arms, steps, cyc, off: id * 7 }); nodeByKey.set(key, id);
          for (const a of arms) if (a.has) cTo[a.rd].forEach((to, c) => { if (!cJ[a.rd][c]) return; const list = [];                 // 让行：左转让对向；无信号时次路让主路
            for (const b of arms) { if (b === a || !b.has) continue; if ((cT[a.rd][c] === 2 && a.hx * b.hx + a.hz * b.hz < -0.6) || (!steps && b.pri < a.pri)) list.push(b.rd); }
            yl[a.rd][c] = list; });
        }
      } g = []; };
    for (let j = 1; j < l.length; j++) { if (l[j].y - l[j - 1].y > 2.5) flush(); g.push(l[j]); } flush(); }
  // 行人：有人行道的路端点挨得近就能走过去
  const eg = new Map(), ek = (x, z) => Math.floor(x / 24) * 73856093 ^ Math.floor(z / 24) * 19349663;
  for (let i = 0; i < R; i++) if (walk[i]) for (let e = 0; e < 2; e++) { const q = ends[i][e], key = ek(q.x, q.z); let l = eg.get(key); if (!l) eg.set(key, l = []); l.push({ i, e }); }
  for (let i = 0; i < R; i++) if (walk[i]) for (let e = 0; e < 2; e++) { const q = ends[i][e], from = i * 2 + (e ? 0 : 1);
    for (let gx = -1; gx <= 1; gx++) for (let gz = -1; gz <= 1; gz++) { const l = eg.get(ek(q.x + gx * 24, q.z + gz * 24)); if (!l) continue;
      for (const t of l) { if (t.i === i) continue; const p = ends[t.i][t.e]; if (Math.hypot(p.x - q.x, p.z - q.z) < Math.max(3, infos[i].w / 2 + infos[t.i].w / 2 + 2.5) && Math.abs(p.y - q.y) < 2.5) { const to = t.i * 2 + (t.e ? 1 : 0); if (!pTo[from].includes(to)) pTo[from].push(to); } } } }
  // 反向邻接（算“下一步”表用），以及城市出入口：没有下游的方向是出口，没有上游的方向是入口
  const cIn = [], pIn = []; for (let i = 0; i < n2; i++) { cIn.push([]); pIn.push([]); }
  for (let i = 0; i < n2; i++) { for (const t of cTo[i]) cIn[t].push(i); for (const t of pTo[i]) pIn[t].push(i); }
  const gateOut = [], gateIn = []; for (let i = 0; i < n2; i++) if (rdN[i]) { if (!cTo[i].length) gateOut.push(i); if (!cIn[i].length) gateIn.push(i); }
  const gatePos = rd => { const q = ends[rd >> 1][(rd & 1) ? 0 : 1]; return [q.x, q.z]; }, gateInPos = rd => { const q = ends[rd >> 1][(rd & 1) ? 1 : 0]; return [q.x, q.z]; };
  // 建筑挂到最近的路上
  const B = S.blds.length, bRoad = new Int32Array(B).fill(-1), bS = new Float32Array(B), fi = new Float32Array(B), fo = new Float32Array(B), sh = [];
  for (let b = 0; b < B; b++) { const bl = S.blds[b], f = flowOf(bl); fi[b] = f.i; fo[b] = f.o; sh.push(f); if (!f.i && !f.o) continue; let best = 80, bn = null, bi = -1;
    for (let i = 0; i < R; i++) { const bb = pts[i].bb; if (bl.x < bb[0] - 90 || bl.x > bb[2] + 90 || bl.z < bb[1] - 90 || bl.z > bb[3] + 90 || (!rdN[i * 2] && !rdN[i * 2 + 1] && !walk[i])) continue; const n = nearRoad(S.roads[i], bl.x, bl.z), d = n.d - infos[i].w / 2; if (d < best) { best = d; bn = n; bi = i; } }
    if (bi >= 0) { bRoad[b] = bi; const L = rdLen[bi * 2]; bS[b] = clamp(bn.t * L, Math.min(rdS0[bi * 2] + 2, L / 2), Math.max(L - rdS1[bi * 2] - 2, L / 2)); } }
  const laneHead = new Int32Array(laneOff.length).fill(-1), laneTail = new Int32Array(laneOff.length).fill(-1);
  return { R, n2, pts, infos, roads: S.roads.slice(), rdLen, rdV, rdN, rdL0, rdS0, rdS1, rdNode, nodes, nodeByKey, cT, yl, cong: new Float32Array(n2).fill(1), cnt: new Uint16Array(n2), vs: new Float32Array(n2), walk, laneOff: Float32Array.from(laneOff), laneHead, laneTail, cTo, cMask, cMap, cJ, pTo, cIn, pIn, gateOut, gateIn, gatePos, gateInPos, B, bRoad, bS, fi, fo, sh, ff: new Map() };
}
function simSig() { let h = S.roads.length * 7919; for (const r of S.roads) { h = (h * 31 + r.a[0] * 3 + r.a[1] * 5 + r.b[0] * 7 + r.b[1] * 11 + r.c[0] * 13 + r.c[1] * 17 + r.ln.length * 19 + (r.m | 0)) % 2147483647; for (let i = 0; i < r.ln.length; i++) h = (h * 33 + r.ln.charCodeAt(i)) % 2147483647; } return h + '|' + S.blds.length; }
function simReset() { aK.fill(0); aFree = []; aTop = 0; sim.nCar = sim.nPed = 0; if (sim.net) { sim.net.laneHead.fill(-1); sim.net.laneTail.fill(-1); } }
function simRebuild() {                                                          // 城市改动后：路网没变就只刷新人流设置，变了就重建并清空在途的人
  const sig = simSig(), keep = sim.net && sig === sim.sig, old = sim.net; sim.net = simCompile(); sim.sig = sig; sim.dirty = false;
  if (keep) { sim.net.laneHead = old.laneHead; sim.net.laneTail = old.laneTail; sim.net.ff = old.ff; }
  else { simReset(); const B = sim.net.B; sim.need = new Float32Array(B); sim.outAcc = new Float32Array(B); sim.bIn = new Float32Array(B); sim.bOut = new Float32Array(B); sim.bQ = new Float32Array(B); }
}
// ── “下一步去哪”表：从目的地沿反向路网做一遍 Dijkstra，得到每个方向到目的地的时间和该走的下一个方向
function simFF(key, seeds, ped) {
  const net = sim.net; let t = net.ff.get(key); if (t) return t;
  const n = net.n2, cost = new Float32Array(n).fill(Infinity), next = new Int32Array(n).fill(-1), inn = ped ? net.pIn : net.cIn, heap = [], sp = ped ? 1.4 : 0;
  const push = (c, v) => { let i = heap.length; heap.push([c, v]); while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= c) break; heap[i] = heap[p]; i = p; } heap[i] = [c, v]; };
  const pop = () => { const top = heap[0], x = heap.pop(); if (heap.length) { let i = 0; for (;;) { let l = i * 2 + 1; if (l >= heap.length) break; if (l + 1 < heap.length && heap[l + 1][0] < heap[l][0]) l++; if (heap[l][0] >= x[0]) break; heap[i] = heap[l]; i = l; } heap[i] = x; } return top; };
  for (const [rd, c] of seeds) if (ped ? net.walk[rd >> 1] : net.rdN[rd]) { cost[rd] = c; push(c, rd); }
  while (heap.length) { const [c, u] = pop(); if (c > cost[u]) continue; for (const p of inn[u]) { const nc = c + net.rdLen[p] / (sp || net.rdV[p]); if (nc < cost[p]) { cost[p] = nc; next[p] = u; push(nc, p); } } }
  t = { cost, next }; net.ff.set(key, t); if (net.ff.size > 400) net.ff.delete(net.ff.keys().next().value); return t;
}
const ffRoad = (road, ped) => { const net = sim.net, h = net.rdLen[road * 2] / 2 / (ped ? 1.4 : net.rdV[road * 2]); return simFF((ped ? 'p' : 'c') + road, [[road * 2, h], [road * 2 + 1, h]], ped); };
const ffGate = rd => simFF('g' + rd, [[rd, 0]], false);

// ── 人和车的增删、车道链表
function simAlloc() { let i; if (aFree.length) i = aFree.pop(); else if (aTop < SIM_CAP) i = aTop++; else return -1; aLead[i] = aFoll[i] = aFrom[i] = -1; aCd[i] = 0; aWait[i] = 0; aV[i] = 0; aArm[i] = 1; return i; }
function simUnlink(i) { const net = sim.net, g = net.rdL0[aRd[i]] + aLn[i], a = aLead[i], f = aFoll[i]; if (a >= 0) aFoll[a] = f; else net.laneHead[g] = f; if (f >= 0) aLead[f] = a; else net.laneTail[g] = a; }
function simFreeAgent(i) { if (aK[i] === 1) { simUnlink(i); sim.nCar--; } else sim.nPed--; aK[i] = 0; aFF[i] = null; aFree.push(i); }
function simArrive(i) { const b = aB[i]; if (b >= 0 && b < sim.bIn.length) sim.bIn[b]++; simFreeAgent(i); }
function simPickLane(rd, nx, want) {                                             // 进入 rd、之后要去 nx：在允许的车道里挑离 want 最近的
  const net = sim.net, n = net.rdN[rd]; let mask = (1 << n) - 1; if (nx >= 0) { const c = net.cTo[rd].indexOf(nx); if (c >= 0) mask = net.cMask[rd][c]; }
  if (want < 0) want = (Math.random() * n) | 0; let best = -1, bd = 99; for (let k = 0; k < n; k++) if (mask >> k & 1) { const d = Math.abs(k - want); if (d < bd) { bd = d; best = k; } } return best < 0 ? Math.min(want, n - 1) : best;
}
const simNext = (i, rd) => { const t = aFF[i]; return t ? t.next[rd] : -1; };
function simSpawnCar(b, dstRoad, dS, gate, destB, fromGate) {
  const net = sim.net, ff = gate >= 0 ? ffGate(gate) : ffRoad(dstRoad, false); let rd = -1, s0 = 0, arm = 1;
  if (fromGate >= 0) { if (!isFinite(ff.cost[fromGate]) && (fromGate >> 1) !== dstRoad) return false; rd = fromGate; }
  else { const ro = net.bRoad[b]; if (ro < 0) return false; let bc = Infinity;
    for (let d = 0; d < 2; d++) { const c0 = ro * 2 + d; if (!net.rdN[c0]) continue; let c, ar = 1;
      if (gate < 0 && ro === dstRoad) { const ahead = d ? net.bS[b] - dS : dS - net.bS[b]; if (ahead >= 0) c = ahead / net.rdV[c0]; else if (ff.next[c0] >= 0) { c = ff.cost[c0] + 120; ar = 0; } else continue; }
      else if (c0 === gate) c = 0; else if (ff.next[c0] < 0) continue; else c = ff.cost[c0];
      if (c < bc) { bc = c; rd = c0; arm = ar; } }
    if (rd < 0) return false; s0 = (rd & 1) ? net.rdLen[rd] - net.bS[b] : net.bS[b]; }
  if (fromGate >= 0) s0 = net.rdS0[rd];
  const onDest = gate < 0 && (rd >> 1) === dstRoad && arm, nx = onDest || rd === gate ? -1 : ff.next[rd], ln = simPickLane(rd, nx, -1), g = net.rdL0[rd] + ln;
  let p = net.laneHead[g], prev = -1; while (p >= 0 && aS[p] > s0) { prev = p; p = aFoll[p]; }
  if ((prev >= 0 && aS[prev] - s0 < CAR_GAP + 2) || (p >= 0 && s0 - aS[p] < CAR_GAP + 2)) return false;                // 门口这段车道没空位，等一会儿
  const i = simAlloc(); if (i < 0) return false;
  aK[i] = 1; aRd[i] = rd; aLn[i] = ln; aS[i] = s0; aDst[i] = gate >= 0 ? -1 : dstRoad; aDS[i] = dS; aGate[i] = gate; aB[i] = destB; aNx[i] = nx; aFF[i] = ff; aArm[i] = arm; aLat[i] = net.laneOff[g] + (fromGate >= 0 ? 0 : (rd & 1 ? -4 : 4)); aCol[i] = (Math.random() * 8) | 0;
  aLead[i] = prev; aFoll[i] = p; if (prev >= 0) aFoll[prev] = i; else net.laneHead[g] = i; if (p >= 0) aLead[p] = i; else net.laneTail[g] = i;
  sim.nCar++; return true;
}
function simSpawnPed(b, dstRoad, dS, destB) {
  const net = sim.net, ro = net.bRoad[b]; if (ro < 0 || !net.walk[ro] || !net.walk[dstRoad]) return false; const ff = ffRoad(dstRoad, true); let rd = -1, bc = Infinity, arm = 1;
  for (let d = 0; d < 2; d++) { const c0 = ro * 2 + d; let c; if (ro === dstRoad) { const ahead = d ? net.bS[b] - dS : dS - net.bS[b]; if (ahead < 0) continue; c = ahead; } else if (ff.next[c0] < 0) continue; else c = ff.cost[c0]; if (c < bc) { bc = c; rd = c0; } }
  if (rd < 0) return false; const i = simAlloc(); if (i < 0) return false;
  aK[i] = 2; aRd[i] = rd; aLn[i] = 0; aS[i] = (rd & 1) ? net.rdLen[rd] - net.bS[b] : net.bS[b]; aDst[i] = dstRoad; aDS[i] = dS; aGate[i] = -1; aB[i] = destB; aFF[i] = ff; aArm[i] = arm; aCol[i] = 8 + ((Math.random() * 4) | 0);
  aLat[i] = (rd & 1 ? -1 : 1) * (net.infos[ro].w / 2 + 1); sim.nPed++; return true;
}
// ── 需求：每栋楼按曲线累计“想出门的人”和“想进来的人”。出门的人优先去有流入缺口的楼；没有缺口就离开城市；缺口迟迟没人填，就从城外来人
function simDemand(dt) {
  const net = sim.net, B = net.B, h = Math.floor(simHour()) % 24, need = sim.need, out = sim.outAcc; let budget = 300;
  for (let b = 0; b < B; b++) { if (net.bRoad[b] < 0) continue; const f = net.sh[b]; need[b] = Math.min(need[b] + net.fi[b] * f.ci[h] * dt / 3600, 60); out[b] = Math.min(out[b] + net.fo[b] * f.co[h] * dt / 3600, 80); }
  for (let b = 0; b < B && budget > 0; b++) {
    while (out[b] >= 1 && budget-- > 0) {
      const bl = S.blds[b]; let dest = -1, best = 0;
      for (let q = 0; q < 6; q++) { const j = (Math.random() * B) | 0; if (j === b || need[j] < 1 || net.bRoad[j] < 0) continue; const o = S.blds[j], sc = need[j] / (1 + Math.hypot(o.x - bl.x, o.z - bl.z) / 800) * (0.5 + Math.random()); if (sc > best) { best = sc; dest = j; } }
      let ok = false;
      if (dest >= 0) { const o = S.blds[dest], dr = net.bRoad[dest], ds = net.bS[dest], near = Math.hypot(o.x - bl.x, o.z - bl.z) < 450;
        ok = (near && simSpawnPed(b, dr, ds, dest)) || simSpawnCar(b, dr, ds, -1, dest, -1) || (!near && simSpawnPed(b, dr, ds, dest)); if (ok) need[dest] -= 1; }
      if (!ok && dest < 0) {                                                     // 城里没有缺口：开车去最近的出口离开
        let g = -1, gd = Infinity; for (const rd of net.gateOut) { const p = net.gatePos(rd), d = Math.hypot(p[0] - bl.x, p[1] - bl.z); if (d < gd && isFinite(ffGate(rd).cost[net.bRoad[b] * 2]) | isFinite(ffGate(rd).cost[net.bRoad[b] * 2 + 1]) | ((rd >> 1) === net.bRoad[b])) { gd = d; g = rd; } }
        if (g >= 0) ok = simSpawnCar(b, -1, -1, g, -1, -1); else { ok = true; sim.lost++; }                           // 没有出口可走：这个人直接算离开
        if (ok) sim.outCity++;
      }
      if (!ok) { sim.bQ[b] = out[b]; break; } out[b] -= 1; sim.bOut[b]++; sim.bQ[b] = out[b];
    }
  }
  for (let b = 0; b < B && budget > 0; b++) {                                    // 流入缺口积压到一定程度：从最近的入口来一辆车
    if (need[b] < 2 + net.fi[b] * 0.01 || net.bRoad[b] < 0) continue; const bl = S.blds[b], ff = ffRoad(net.bRoad[b], false); let g = -1, gd = Infinity;
    for (const rd of net.gateIn) { if (!isFinite(ff.cost[rd]) && (rd >> 1) !== net.bRoad[b]) continue; const p = net.gateInPos(rd), d = Math.hypot(p[0] - bl.x, p[1] - bl.z); if (d < gd) { gd = d; g = rd; } }
    if (g >= 0 && simSpawnCar(-1, net.bRoad[b], net.bS[b], -1, b, g)) { need[b] -= 1; sim.inCity++; budget--; }
  }
}
// ── 前进一步
function simStepOf(node) { let t = (sim.t + node.off) % node.cyc; for (let i = 0; i < node.steps.length; i++) { if (t < node.steps[i].d) return i; t -= node.steps[i].d; } return 0; }
function simGreen(nd, rd, turn) { const node = sim.net.nodes[nd]; if (!node.steps) return true; return (node.steps[simStepOf(node)].g.get(rd) | 0) >> (turn === 0 ? 0 : turn === 2 ? 1 : 2) & 1; }
function simYield(rd, c, nd) {                                                   // 要让的那些进口上，有没有马上要进路口的车
  const net = sim.net, list = net.yl[rd][c]; if (!list || !list.length) return false; const left = net.cT[rd][c] === 2, node = net.nodes[nd];
  for (const p of list) { const l0 = net.rdL0[p], L = net.rdLen[p] - net.rdS1[p];
    for (let k = 0; k < net.rdN[p]; k++) { const h = net.laneHead[l0 + k]; if (h < 0) continue; const rm = L - aS[h]; if (rm > 70) continue;
      const ch = net.cTo[p].indexOf(aNx[h]), th = ch >= 0 ? net.cT[p][ch] : 0, v = aV[h];
      if ((left && th === 2) || (node.steps && !simGreen(nd, p, th))) continue;   // 对向也左转不冲突；对方是红灯不用让
      if (v < 1 ? rm < 5 && !!node.steps : rm / v < 4.5) return true; } }
  return false;
}
function simChange(i, rd, k, minF) {                                             // 变道：从本车道队列摘下，按位置插进第 k 条车道；前后空档不够就不变
  const net = sim.net, g = net.rdL0[rd] + k, s = aS[i]; let p = net.laneHead[g], prev = -1; while (p >= 0 && aS[p] > s) { prev = p; p = aFoll[p]; }
  if (prev >= 0 && aS[prev] - s < Math.max(minF, CAR_GAP + 1 + Math.max(0, (aV[i] - aV[prev]) * 1.2))) return false;
  if (p >= 0 && s - aS[p] < CAR_GAP + 1 + Math.max(0, (aV[p] - aV[i]) * 1.2)) return false;
  simUnlink(i); aLn[i] = k; aLead[i] = prev; aFoll[i] = p; if (prev >= 0) aFoll[prev] = i; else net.laneHead[g] = i; if (p >= 0) aLead[p] = i; else net.laneTail[g] = i; return true;
}
function simStep(dt) {
  const net = sim.net, rdLen = net.rdLen, rdV = net.rdV, laneOff = net.laneOff, rdL0 = net.rdL0;
  for (let i = 0; i < aTop; i++) {
    const k = aK[i]; if (!k) continue; const rd = aRd[i], LF = rdLen[rd], L = k === 1 ? LF - net.rdS1[rd] : LF; let s = aS[i];
    const onDest = aArm[i] && aDS[i] >= 0 && (rd >> 1) === aDst[i], sd = onDest ? ((rd & 1) ? LF - aDS[i] : aDS[i]) : L;
    if (k === 2) {                                                               // 行人：匀速走，互不影响
      s += 1.4 * dt; if (onDest && s >= sd) { simArrive(i); continue; }
      if (s >= L) { const nx = simNext(i, rd); if (nx < 0) { sim.lost++; simFreeAgent(i); continue; } aRd[i] = nx; aS[i] = s - L; aArm[i] = 1; aLat[i] = (nx & 1 ? -1 : 1) * (net.infos[nx >> 1].w / 2 + 1); continue; }
      aS[i] = s; continue;
    }
    if (onDest && s >= sd - 1) { simArrive(i); continue; }
    let lead = aLead[i]; const room = sd - s; let v = aV[i], vt = rdV[rd];
    if (((sim.tick + i) & 3) === 0 && net.rdN[rd] > 1) {                         // 每 2 秒想一次要不要变道
      if (aCd[i] > 0) aCd[i] -= 2;
      else { const n = net.rdN[rd], nx = aNx[i], c = nx >= 0 ? net.cTo[rd].indexOf(nx) : -1, mask = c >= 0 ? net.cMask[rd][c] : (1 << n) - 1, ln = aLn[i]; let done = false;
        if (!(mask >> ln & 1)) { let bd = 99, k2 = -1; for (let k = 0; k < n; k++) if ((mask >> k & 1) && Math.abs(k - ln) < bd) { bd = Math.abs(k - ln); k2 = ln + Math.sign(k - ln); } done = k2 >= 0 && simChange(i, rd, k2, 0); }   // 必须变：朝能去下一条路的车道挪一条
        else if (lead >= 0 && aV[lead] < rdV[rd] * 0.6 && aS[lead] - s < 30 && room > 90) { const need = aS[lead] - s + 12;                                                   // 值得变：前车慢，旁边前方更空
          for (const k2 of [ln - 1, ln + 1]) if (!done && k2 >= 0 && k2 < n && ((mask >> k2 & 1) || room > 400)) done = simChange(i, rd, k2, need); }
        if (done) { aCd[i] = 4; lead = aLead[i]; } }
    }
    if (lead >= 0) { const gap = aS[lead] - s - CAR_GAP; vt = Math.min(vt, Math.max(0, aV[lead] + (gap - 1.5) / 1.4)); }   // 跟车：间距越小越慢
    else if (!onDest && room < 70) {
      const nx = aNx[i]; let blocked = false, tl = -1;
      if (nx < 0) { if (rd === aGate[i]) { if (room < 1) { simFreeAgent(i); continue; } } else blocked = true; }
      else { const c = net.cTo[rd].indexOf(nx), jn = c >= 0 && net.cJ[rd][c], m = c >= 0 ? net.cMap[rd][c][aLn[i]] : -1;
        if (c >= 0 && !(net.cMask[rd][c] >> aLn[i] & 1) && aWait[i] < 15) blocked = true;                             // 不在能去下一条路的车道上：得先变道（实在并不过去，停 15 秒后放行）
        else { tl = jn || m < 0 ? simPickLane(nx, simNext(i, nx), m < 0 ? aLn[i] : m) : m;
          const tail = net.laneTail[rdL0[nx] + tl], nd = net.rdNode[rd]; blocked = tail >= 0 && aS[tail] < net.rdS0[nx] + (jn ? -2 : CAR_GAP + 1);   // 目标车道的队尾还在路口里（或刚进路）：等它走开
          if (!blocked && jn && nd >= 0) blocked = !simGreen(nd, rd, net.cT[rd][c]) || (room < 30 && aWait[i] < 25 && simYield(rd, c, nd)); }   // 红灯，或者该让的车快到了
        if (jn && room < 30) vt = Math.min(vt, 9);                                                                    // 过路口减速
        if (!blocked && room < 0.6 + v * dt) {                                   // 驶入下一条路：从本车道队首摘下，挂到新车道队尾
          simUnlink(i); const g = rdL0[nx] + tl, t0 = net.laneTail[g]; aLead[i] = t0; aFoll[i] = -1; if (t0 >= 0) aFoll[t0] = i; else net.laneHead[g] = i; net.laneTail[g] = i;
          let jl = 0; if (jn) { simPos(rd, L, laneOff[rdL0[rd] + aLn[i]]); const x0 = PX, z0 = PZ; simPos(nx, net.rdS0[nx], laneOff[g]); jl = Math.max(1, Math.hypot(PX - x0, PZ - z0) * 1.08); aFrom[i] = rd; aFromLn[i] = aLn[i]; aJL[i] = jl; aLat[i] = laneOff[g]; }   // 路口里要走的那段曲线的长度
          aRd[i] = nx; aLn[i] = tl; aS[i] = net.rdS0[nx] - jl; aArm[i] = 1; aWait[i] = 0; aNx[i] = (aDS[i] >= 0 && (nx >> 1) === aDst[i]) || nx === aGate[i] ? -1 : simNext(i, nx); continue; } }
      if (blocked) vt = Math.min(vt, Math.sqrt(5 * Math.max(room - 1, 0)));        // 前面进不去：按能刹住的速度减到停
    }
    else if (onDest) vt = Math.min(vt, Math.sqrt(5 * Math.max(room, 0)) + 2);
    v += clamp(vt - v, -7 * dt, 2.2 * dt); if (v < 0) v = 0; s += v * dt;
    if (lead >= 0 && s > aS[lead] - CAR_GAP) { s = Math.max(aS[i], aS[lead] - CAR_GAP); v = Math.min(v, aV[lead]); }
    if (s > sd) s = sd; aS[i] = s; aV[i] = v;
    const lo = laneOff[rdL0[rd] + aLn[i]], dl = lo - aLat[i]; if (dl) aLat[i] += clamp(dl, -1.6 * dt, 1.6 * dt);          // 换道在画面上是慢慢并过去的
    if (v < 0.3) { aWait[i] += dt; if (aWait[i] > 300) { sim.stuck++; simFreeAgent(i); } } else aWait[i] = 0;                // 堵死五分钟的车直接移走，免得整个路网锁死
  }
}
// 某个行车方向上、沿程 s、横向偏移 o 处的位置和行驶方向（结果放在这几个变量里，免得每次都新建对象）
let PX = 0, PZ = 0, PY = 0, HX = 1, HZ = 0;
function simPos(rd, s, o) {
  const net = sim.net, r = net.roads[rd >> 1], pts = net.pts[rd >> 1], L = pts.len, sr = clamp((rd & 1) ? L - s : s, 0, L);
  let lo = 0, hi = pts.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].s <= sr) lo = m; else hi = m; }
  const a = pts[lo], b = pts[hi], l = (b.s - a.s) || 1, t = (sr - a.s) / l, tx = (b.x - a.x) / l, tz = (b.z - a.z) / l, sg = (rd & 1) ? -1 : 1;
  PX = a.x + (b.x - a.x) * t - tz * o; PZ = a.z + (b.z - a.z) * t + tx * o; HX = tx * sg; HZ = tz * sg;
  PY = r.h ? hAt(r.h, a.t + (b.t - a.t) * t) + 0.4 : H(PX, PZ) + lift() + 0.2;
}
// ── 每帧调用：按倍速推进若干步，再把所有人和车的位置写进实例缓冲
const CAR_COL = [[196, 60, 52], [232, 232, 228], [52, 60, 72], [58, 110, 180], [150, 156, 162], [222, 180, 60], [70, 130, 96], [120, 70, 150], [226, 190, 160], [90, 120, 170], [200, 90, 90], [240, 240, 240]];
function simFrame(realDt) {
  if (!sim.on) return; if (sim.dirty && !ui.drag) simRebuild(); if (!sim.net) return;
  sim.acc += Math.min(realDt, 0.1) * sim.speed; let n = 0;
  while (sim.acc >= 0.5 && n++ < 60) { sim.acc -= 0.5; sim.t += 0.5; sim.tick++; sim.dAcc += 0.5; if (sim.dAcc >= 2) { simDemand(sim.dAcc); sim.dAcc = 0; } simStep(0.5); }
  if (n >= 60) sim.acc = 0;
  if (!sim.inst) { sim.buf = new ArrayBuffer(SIM_CAP * 2 * 20); sim.inst = new Float32Array(sim.buf); sim.instU = new Uint8Array(sim.buf); }
  const net = sim.net, F = sim.inst, U8 = sim.instU; let c = 0; net.cnt.fill(0); net.vs.fill(0);
  for (let i = 0; i < aTop; i++) {
    const k = aK[i]; if (!k) continue; const rd = aRd[i]; if (k === 1) { net.cnt[rd]++; net.vs[rd] += aV[i]; }
    let x, y, z, hd;
    if (k === 1 && aFrom[i] >= 0 && aS[i] < net.rdS0[rd]) {                      // 还在路口里：沿“驶出点 → 驶入点”的曲线走，控制点取两条行驶方向线的交点
      const fr = aFrom[i]; simPos(fr, net.rdLen[fr] - net.rdS1[fr], net.laneOff[net.rdL0[fr] + aFromLn[i]]); const x0 = PX, z0 = PZ, y0 = PY, h0x = HX, h0z = HZ;
      simPos(rd, net.rdS0[rd], net.laneOff[net.rdL0[rd] + aLn[i]]); const x1 = PX, z1 = PZ, den = h0x * HZ - h0z * HX; let cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      if (Math.abs(den) > 0.08) { const u = ((x1 - x0) * HZ - (z1 - z0) * HX) / den; if (u > 0 && u < 80) { cx = x0 + h0x * u; cz = z0 + h0z * u; } }
      const t = clamp(1 - (net.rdS0[rd] - aS[i]) / aJL[i], 0, 1), u = 1 - t; x = u * u * x0 + 2 * u * t * cx + t * t * x1; z = u * u * z0 + 2 * u * t * cz + t * t * z1; y = y0 + (PY - y0) * t;
      hd = Math.atan2(u * (cz - z0) + t * (z1 - cz), u * (cx - x0) + t * (x1 - cx));
    } else { if (aFrom[i] >= 0) aFrom[i] = -1; simPos(rd, aS[i], aLat[i]); x = PX; z = PZ; hd = Math.atan2(HZ, HX); y = PY + (k === 2 && (net.infos[rd >> 1].wl || net.infos[rd >> 1].wr) ? 0.12 : 0); }
    const col = CAR_COL[aCol[i]];
    for (let part = 0; part < (k === 1 ? 2 : 1); part++, c++) { const f = c * 5, u = c * 20 + 16; F[f] = x; F[f + 1] = y; F[f + 2] = z; F[f + 3] = hd;
      if (part) { U8[u] = 40; U8[u + 1] = 52; U8[u + 2] = 66; U8[u + 3] = 1; } else { U8[u] = col[0]; U8[u + 1] = col[1]; U8[u + 2] = col[2]; U8[u + 3] = k === 1 ? 0 : 2; } }
  }
  sim.instN = c;
  for (let rd = 0; rd < net.n2; rd++) net.cong[rd] += ((net.cnt[rd] ? net.vs[rd] / net.cnt[rd] / net.rdV[rd] : 1) - net.cong[rd]) * 0.06;   // 拥堵度：这个方向上的平均车速 ÷ 设计车速，慢慢跟随
  const hr = simHour(); $('#simHud').textContent = `${hhmm(hr)} · 车 ${sim.nCar} · 行人 ${sim.nPed} · 进城 ${sim.inCity} · 出城 ${sim.outCity}` + (sim.stuck ? ` · 堵死移走 ${sim.stuck}` : '');
  req();
}
function simToggle(on) {
  sim.on = on; $('#simBtn').setAttribute('aria-pressed', on); $('#simBtn').textContent = on ? '模拟：开' : '模拟';
  if (on) { sim.t = skyState().hour * 3600; sim.acc = sim.dAcc = 0; sim.inCity = sim.outCity = sim.stuck = sim.lost = 0; sim.sig = ''; sim.dirty = true; lastT = performance.now(); }
  else { simReset(); sim.instN = 0; sim.net = null; $('#simHud').textContent = ''; }
  syncFx(); req();
}
$('#simBtn').onclick = () => simToggle(!sim.on);
$('#simSpd').onchange = e => { sim.speed = +e.target.value; };
$('#simHeat').onchange = e => { sim.heat = e.target.checked; req(); };
const heatCol = c => { const t = clamp((c - 0.15) / 0.75, 0, 1); return [Math.round(235 * (t < 0.5 ? 1 : 2 - 2 * t)), Math.round(200 * (t < 0.5 ? 2 * t : 1)), 50]; };   // 红 → 黄 → 绿
