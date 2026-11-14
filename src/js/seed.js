/* ───────── 示例城市 ───────── */
function seed() {
  const R = (a, b, w) => ({ a, c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b, w });
  S.roads = [R([-220, 0], [220, 0], 14), R([-120, 0], [-120, -200], 8), { a: [-120, -200], c: [20, -275], b: [150, -160], w: 8 }, R([150, -160], [150, 0], 8), R([40, 0], [40, 150], 8), { a: [40, 150], c: [-90, 205], b: [-200, 90], w: 8 }, R([-200, 90], [-200, 0], 8)];
  let sd = 11; const rnd = () => { sd |= 0; sd = sd + 0x6D2B79F5 | 0; let t = Math.imul(sd ^ sd >>> 15, 1 | sd); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const pool = ['house', 'house', 'shop', 'apartment', 'house', 'tree', 'office', 'apartment', 'tree', 'park', 'house', 'factory', 'shop', 'watertower'];
  S.blds = [];
  S.roads.forEach((r, ri) => { for (const sg of [1, -1]) {
    const pts = roadPts(r); let d = 14;
    while (d < pts.len - 14) {
      const id = pool[rnd() * pool.length | 0], f = fp(S.assets[id]); d += f.w / 2;
      if (d > pts.len - 10) break;
      const p = atDist(pts, d), nx = -p.tz, nz = p.tx, off = r.w / 2 + 3.5 + f.d / 2;
      const b = { a: id, x: p.x + nx * sg * off, z: p.z + nz * sg * off, r: Math.atan2(nx * sg, -nz * sg) }, rad = Math.max(f.w, f.d) / 2;
      const ok = S.roads.every((o, j) => j === ri || nearRoad(o, b.x, b.z).d > o.w / 2 + f.d / 2 + 3)
        && nearRoad(r, b.x, b.z).d > off - 1.5
        && S.blds.every(o => { const g = fp(S.assets[o.a]); return Math.hypot(o.x - b.x, o.z - b.z) > (rad + Math.max(g.w, g.d) / 2) * 0.92; });
      if (ok) S.blds.push(b);
      d += f.w / 2 + 3 + rnd() * 7;
    }
  } });
}
