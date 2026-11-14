/* ───────── 启动 ───────── */
function boot() {
  readTheme(); initGL();
  let saved = null; try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  if (saved && saved.v === 1) { restore(saved); loadTerr(); } else { restore({}); seed(); }
  normalizeRoads(S.roads.slice());
  syncEnvUI(); syncFx(); save(); renderPalette(); setHint(); updateMeter(); req();
  const retheme = () => { readTheme(); terr.dirty.fill(1); terrDirty = true; dirtyGeom = true; req(); };
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', retheme);
  new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  new ResizeObserver(() => req()).observe($('#stage'));
  addEventListener('resize', req);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(req);
}
boot();
window.LiteCity = { state: S, camera: camCity, redraw: req, sky: skyState };              // 调试和脚本用的入口
