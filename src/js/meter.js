/* ───────── 内存表 ───────── */
function updateMeter() {
  const ab = JSON.stringify(Object.values(S.assets).map(a => a.parts)).length, na = Object.keys(S.assets).length, tb = TH ? terrGpu() : 0, nv = stat.n + (TH ? CN * CN * CV + terr.skirtN + treeM.n : 0), vb = stat.n * 20 + tb;
  $('#meter').innerHTML = `<dt>资产配方</dt><dd>${fmtB(ab)}</dd><dt>顶点 / 显存</dt><dd>${nv.toLocaleString()} / ${fmtB(vb)}</dd>`;
  if ($('#ledger').hidden) return;
  $('#lg-assets').textContent = `${na} 件 · ${fmtB(ab)}`;
  $('#lg-verts').textContent = `${stat.n.toLocaleString()} 顶点 · ${fmtB(stat.n * 20)}`;
  $('#lg-terr').textContent = TH ? `内存 ${fmtB(terrRam())} · 显存 ${fmtB(tb)}` : '平地 · 0 B';
  $('#lg-water').textContent = (S.env.water != null ? '水面 2 个三角形' : '水面关闭') + (S.env.lakes || S.env.rivers ? ' · 求解时临时 ' + fmtB(VN * VN * 22) : '');
  $('#lg-save').textContent = `${S.roads.length} 路 ${S.blds.length} 栋 · ${fmtB(saveBytes)}`;
  $('#lg-frames').textContent = `累计 ${frames} 帧`;
  const mem = performance.memory; $('#lg-heaprow').hidden = !mem; if (mem) $('#lg-heap').textContent = fmtB(mem.usedJSHeapSize);
  $('#lg-compare').textContent = `对照：${na} 件资产若各配 3 张 1024² 不压缩贴图，约 ${(na * 3 * 5.33).toFixed(0)} MB；这里全部配方加整座城的网格一共 ${fmtB(ab + vb)}。`;
}
