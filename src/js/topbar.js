/* ───────── 键盘与顶栏 ───────── */
addEventListener('keydown', e => {
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target.type !== 'checkbox') return;
  if (e.key === ' ') { space = true; e.preventDefault(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (!shop.open) undo(); return; }
  if (shop.open) return;
  const t = { 1: 'select', 2: 'road', 3: 'build', 4: 'erase', 5: 'terrain' }[e.key];
  if (t) setTool(t);
  else if ((e.key === 'e' || e.key === 'E') && ui.tool === 'terrain' && ui.hover) { const h = elevAt(ui.hover[0], ui.hover[1]); if (ui.tmode === 'water') $('#ws-h').value = Math.ceil(h + 5); else $('#tb-elev').value = Math.round(h); }
  else if (e.key === 'r' || e.key === 'R') rotate(e.shiftKey ? -1 : 1);
  else if (e.key === 'Delete' || e.key === 'Backspace') removeSel();
  else if (e.key === 'Escape') { ui.rs = ui.rc = null; ui.sel = ui.cand = null; req(); }
});
addEventListener('keyup', e => { if (e.key === ' ') space = false; });
$('#tools').addEventListener('click', e => { const b = e.target.closest('button'); if (b && !shop.open) setTool(b.dataset.tool); });
$('#rotBtn').onclick = () => rotate(1);
function setSolo(v) {                                                            // 收起一侧面板，另一侧占满；再点一次还原
  const st = $('#stage'), cur = st.classList.contains('only2') ? '2' : st.classList.contains('only3') ? '3' : '', nv = cur === v ? '' : v;
  st.classList.toggle('only2', nv === '2'); st.classList.toggle('only3', nv === '3');
  for (const k of ['2', '3']) { $('#max' + k).textContent = nv === k ? '还原' : '放大'; $('#max' + k).setAttribute('aria-pressed', nv === k); }
  setEdge(null); req();
}
$('#max2').onclick = () => setSolo('2'); $('#max3').onclick = () => setSolo('3');
$('#roadLv').onchange = req;
$('#undoBtn').onclick = () => { if (!shop.open) undo(); };
$('#snapRoad').onchange = e => { ui.snap = e.target.checked; req(); };
let clearArm = 0;
$('#clearBtn').onclick = e => {
  if (shop.open) return;
  if (!clearArm) { e.target.textContent = '再点一次确认'; clearArm = setTimeout(() => { clearArm = 0; e.target.textContent = '清空'; }, 3000); return; }
  clearTimeout(clearArm); clearArm = 0; e.target.textContent = '清空'; pushUndo(); S.roads = []; S.blds = []; ui.sel = ui.cand = null; ui.rs = ui.rc = null; changed();
};
$('#ledgerBtn').onclick = $('#meter').onclick = () => { $('#ledger').hidden = !$('#ledger').hidden; updateMeter(); };
$('#ledgerClose').onclick = () => { $('#ledger').hidden = true; };
