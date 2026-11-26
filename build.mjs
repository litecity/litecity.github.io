#!/usr/bin/env node
// 把 src/ 里的样式、页面结构和各个脚本模块拼成一个可以独立运行的 index.html。
// 没有依赖：node build.mjs            生成 index.html
//           node build.mjs --check    只检查仓库里的 index.html 是否和源码一致
//           node build.mjs --artifact <路径>   另外生成一份不带外壳的片段（发布到 Claude 用）
import { readFileSync, writeFileSync } from 'node:fs';
import { Script } from 'node:vm';

// 脚本模块按这个顺序拼进同一个作用域（它们共享状态，顺序就是依赖顺序）
const MODULES = ['core', 'assets', 'state', 'lanes', 'roads', 'tools', 'inspect', 'mesh', 'terrain', 'canals', 'trees', 'theme', 'sky', 'sim', 'shaders', 'render3d',
  'plan2d', 'loop', 'input', 'topbar', 'palette', 'workshop', 'meter', 'seed', 'boot'];
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\n+$/, '') + '\n';

const css = read('src/style.css'), body = read('src/body.html');
const js = "(() => {\n'use strict';\n" + MODULES.map(m => read(`src/js/${m}.js`)).join('') + '})();\n';
new Script(js, { filename: 'litecity.js' });                       // 语法检查：拼出来的脚本必须能解析

const FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@500;600;700&display=swap">';
const RESET = ':root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px);box-sizing:border-box}body{margin:0}img{max-width:100%}[hidden]{display:none!important}';
const DESC = '给造景玩家用的轻量规划沙盘：平面图画路、3D 实景同步、地形与水系、矢量资产，零贴图，浏览器直接运行。非官方工具。';

const page = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<style>${RESET}</style>
<title>LiteCity 轻量造景沙盘</title>
<meta name="description" content="${DESC}">
${FONTS}
<style>
${css}</style>

</head>
<body>
${body}
<script>
${js}</script>

</body>
</html>
`;

const args = process.argv.slice(2), out = new URL('index.html', import.meta.url);
if (args.includes('--check')) {
  if (readFileSync(out, 'utf8') !== page) { console.error('index.html 和 src/ 不一致，请运行 node build.mjs'); process.exit(1); }
  console.log('index.html 与源码一致');
} else {
  writeFileSync(out, page);
  console.log(`index.html  ${(Buffer.byteLength(page) / 1024).toFixed(1)} KB  （${MODULES.length} 个脚本模块）`);
}
const ai = args.indexOf('--artifact');
if (ai >= 0 && args[ai + 1]) {
  const frag = `<meta name="claude:viewport-fit-sides" content="cover">\n<title>矢量城</title>\n${FONTS}\n<style>\n${css}</style>\n\n${body.replace('LiteCity <small>轻量造景沙盘</small>', '矢量城 <small>VECTOR CITY</small>')}\n<script>\n${js}</script>\n`;
  writeFileSync(args[ai + 1], frag); console.log('artifact 片段 → ' + args[ai + 1]);
}
