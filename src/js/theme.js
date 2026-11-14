/* ───────── 主题色 ───────── */
const T = {};
function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  for (const k of ['paper', 'grid', 'grid2', 'road', 'walk', 'mark', 'sky', 'ground', 'ggrid', 'win', 'lit', 'ink', 'mute', 'accent', 'sel', 'panel', 'danger', 'water', 'rock', 'snow', 'sand', 'zenith', 'cloud']) T[k] = cs.getPropertyValue('--' + k).trim();
  T.night = cs.colorScheme.includes('dark') || parseInt(T.sky.slice(1, 3), 16) < 90;
}
