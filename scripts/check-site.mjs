#!/usr/bin/env node
/**
 * 站点自检（本地和 GitHub Actions 共用）
 * 用法： node scripts/check-site.mjs
 *
 * 检查项（都是这个站过去真踩过的坑）：
 *   1. HTML 标签配平（曾经因为少一个 <div> 开标签，把四张卡片挤出容器）
 *   2. 内联脚本语法（语法错会让整段交互失效）
 *   3. 渐入安全不变式：HTML 里不能硬编码 reveal 类，否则 JS 挂了内容会隐形
 *   4. 本地资源引用是否都存在（src / href / url(...)）
 *   5. 资源体积红线（防止再出现 7MB 的背景图）
 *   6. 仓库总体积提醒
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const HTML = path.join(ROOT, 'index.html');

let failed = 0;
let warned = 0;
const fail = (msg) => { failed++; console.log('  ✗ ' + msg); };
const warn = (msg) => { warned++; console.log('  ! ' + msg); };
const ok = (msg) => console.log('  ✓ ' + msg);

if (!fs.existsSync(HTML)) {
  console.error('找不到 index.html，请在站点根目录运行');
  process.exit(1);
}

const raw = fs.readFileSync(HTML, 'utf8');
// 去掉注释再分析（注释里写着 <div> 之类字样，会干扰判断）
const html = raw.replace(/<!--[\s\S]*?-->/g, '');

console.log('\n[1] HTML 标签配平');
const VOID_TAGS = new Set(['br', 'img', 'input', 'meta', 'link', 'source', 'hr', 'track', 'path', 'circle', 'rect']);
for (const tag of ['div', 'section', 'article', 'p', 'nav', 'span', 'ul', 'ol', 'li', 'h2', 'h3', 'video', 'audio', 'canvas', 'style', 'script']) {
  if (VOID_TAGS.has(tag)) continue;
  const open = (html.match(new RegExp(`<${tag}(?=[\\s>])`, 'g')) || []).length;
  const close = (html.match(new RegExp(`</${tag}\\s*>`, 'g')) || []).length;
  if (open !== close) fail(`<${tag}> 开 ${open} / 闭 ${close} 不匹配`);
}
if (!failed) ok('全部配平');

console.log('\n[2] 内联脚本语法');
let inlineCount = 0;
const scriptRe = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m;
while ((m = scriptRe.exec(raw)) !== null) {
  inlineCount++;
  const line = raw.slice(0, m.index).split('\n').length;
  try {
    new Function(m[1]);
  } catch (e) {
    fail(`第 ${line} 行起的内联脚本语法错误：${e.message}`);
  }
}
if (inlineCount) ok(`${inlineCount} 段内联脚本语法正常`);

console.log('\n[3] 渐入安全不变式');
const hardcodedReveal = html.match(/class="[^"]*\breveal\b[^"]*"/g) || [];
if (hardcodedReveal.length) {
  fail(`HTML 里硬编码了 ${hardcodedReveal.length} 处 reveal 类（应完全由 JS 添加，否则脚本失效时内容会隐形）`);
} else {
  ok('没有硬编码 reveal 类');
}

console.log('\n[4] 本地资源引用');
const refs = new Set();
for (const re of [
  /\bsrc="([^"]+)"/g,
  /\bhref="([^"]+)"/g,
  /url\(['"]?([^'")]+)['"]?\)/g,
]) {
  let r;
  while ((r = re.exec(raw)) !== null) refs.add(r[1]);
}
const skip = (u) => /^(https?:)?\/\//.test(u) || /^(data:|mailto:|tel:|#|javascript:)/.test(u);
let checkedRefs = 0;
for (const ref of refs) {
  if (skip(ref)) continue;
  const clean = ref.split('?')[0].split('#')[0];
  if (!clean) continue;
  checkedRefs++;
  const p = path.join(ROOT, decodeURIComponent(clean));
  if (!fs.existsSync(p)) fail(`引用了不存在的本地文件：${clean}`);
}
ok(`检查了 ${checkedRefs} 个本地引用`);

console.log('\n[5] 资源体积红线');
const LIMITS = {
  image: { warn: 600 * 1024, fail: 2 * 1024 * 1024 },
  video: { warn: 6 * 1024 * 1024, fail: 12 * 1024 * 1024 },
  audio: { warn: 5 * 1024 * 1024, fail: 8 * 1024 * 1024 },
};
const KIND = {
  '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.webp': 'image', '.gif': 'image', '.svg': 'image',
  '.mp4': 'video', '.webm': 'video',
  '.mp3': 'audio', '.wav': 'audio', '.ogg': 'audio', '.m4a': 'audio',
};
const walk = (dir, acc = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
};
let total = 0;
for (const f of walk(ROOT)) {
  const size = fs.statSync(f).size;
  total += size;
  const kind = KIND[path.extname(f).toLowerCase()];
  if (!kind) continue;
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  const lim = LIMITS[kind];
  if (size > lim.fail) fail(`${rel} ${(size / 1048576).toFixed(1)}MB 超过上限 ${(lim.fail / 1048576).toFixed(1)}MB`);
  else if (size > lim.warn) warn(`${rel} ${(size / 1024).toFixed(0)}KB 偏大（建议 < ${(lim.warn / 1024).toFixed(0)}KB）`);
}
ok(`资源体积检查完成`);

console.log('\n[6] 仓库体积');
const totalMB = total / 1048576;
if (totalMB > 800) fail(`仓库工作区 ${totalMB.toFixed(1)}MB，GitHub 建议不超过 1GB`);
else if (totalMB > 300) warn(`仓库工作区 ${totalMB.toFixed(1)}MB，注意别再堆大文件`);
else ok(`工作区 ${totalMB.toFixed(1)}MB`);

console.log(`\n结果：${failed ? `${failed} 项失败` : '全部通过'}${warned ? `，${warned} 项提醒` : ''}\n`);
process.exit(failed ? 1 : 0);
