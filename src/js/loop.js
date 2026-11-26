/* ───────── 按需渲染 ───────── */
let raf = 0, dirtyGeom = true, frames = 0;
function req() { if (!raf) raf = requestAnimationFrame(frame); }
let fly = null;
function flyTo(x, z, d) { fly = { x0: camCity.tx, z0: camCity.tz, d0: camCity.dist, x, z, d, t0: performance.now() }; req(); }
function frame() {
  raf = 0; frames++;
  const now = performance.now(), rdt = (now - lastT) / 1000, dt = Math.min(0.05, rdt); lastT = now;
  if (fx.cloud) cloudT += Math.min(0.5, (now - lastCT) / 1000); lastCT = now;
  if (edge && !shop.open) {                                                    // 鼠标停在边缘区：镜头朝那边匀速走（先停顿 0.2 秒，免得路过时误触）
    if (now - edge.t0 > 220) { const c = camCity, v = c.dist * 0.9 * dt, sy = Math.sin(c.yaw), cy = Math.cos(c.yaw);
      c.tx = clamp(c.tx + (cy * edge.fx - sy * edge.fz) * v, -HALF * 1.3, HALF * 1.3); c.tz = clamp(c.tz + (-sy * edge.fx - cy * edge.fz) * v, -HALF * 1.3, HALF * 1.3); }
    req();
  }
  if (fly) {                                                                   // 飞行只在这几百毫秒里连续出帧
    const k = Math.min(1, (performance.now() - fly.t0) / 480), e = k * k * (3 - 2 * k);
    camCity.tx = fly.x0 + (fly.x - fly.x0) * e; camCity.tz = fly.z0 + (fly.z - fly.z0) * e; camCity.dist = fly.d0 + (fly.d - fly.d0) * e;
    if (k >= 1) fly = null; else req();
  }
  if (terrDirty) buildTerrain();
  if (!shop.open && treesStale()) buildTrees();
  if (dirtyGeom) { buildStatic(); dirtyGeom = false; updateMeter(); }
  simFrame(rdt);
  buildDyn(); draw3(); draw2(); inspSync();
}
function changed() { dirtyGeom = true; sim.dirty = true; save(); req(); }
