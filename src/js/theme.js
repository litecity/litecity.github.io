/* ───────── 主题色 ───────── */
const T = {};
// 实景里的材质颜色固定用这一套（不跟页面深浅主题走）；白天黑夜由时辰决定，交给光照去压暗
const WORLD = { road: '#57616C', walk: '#B4BEC6', mark: '#F6D15A', ground: '#A7C196', ggrid: '#8FAE80', win: '#33465A', lit: '#FFD98A', water: '#5B9BD0', rock: '#8F8C82', snow: '#EEF2F4', sand: '#CBBF98' };
const W = {};
function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  for (const k of ['paper', 'grid', 'grid2', 'road', 'walk', 'mark', 'sky', 'ground', 'ggrid', 'win', 'lit', 'ink', 'mute', 'accent', 'sel', 'panel', 'danger', 'water', 'rock', 'snow', 'sand', 'zenith', 'cloud']) T[k] = cs.getPropertyValue('--' + k).trim();
  Object.assign(W, T, WORLD);
}
