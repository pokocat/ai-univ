// 构建产物守卫：跑在 dist/<BRAND> 上（先 npm run build）。
// 零外链、无禁词、无源品牌名、每条路由都有「样张」章、字体体积、允许缩放。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname, extname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BRAND = process.env.BRAND || 'liren';
const DIST = join(ROOT, 'dist', BRAND);
const SSR = join(ROOT, 'dist-ssr', BRAND, 'prerender.js');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const TEXT_EXT = new Set(['.html', '.js', '.mjs', '.css', '.json', '.txt', '.svg', '.webmanifest', '.map']);
const FONT_EXT = new Set(['.woff2', '.woff', '.ttf', '.otf']);

assert.ok(existsSync(DIST), `找不到 ${DIST}，先跑 npm run build`);
const files = walk(DIST);
const texts = files.filter((f) => TEXT_EXT.has(extname(f))).map((f) => ({ f, s: readFileSync(f, 'utf8') }));

// XML 命名空间是标识符不是请求（preact 与二维码库的 SVG 命名空间），逐条放行
const NS_ALLOW = [
  'http://www.w3.org/2000/svg',
  'http://www.w3.org/1999/xlink',
  'http://www.w3.org/1999/xhtml',
  'http://www.w3.org/1998/Math/MathML',
  'http://www.w3.org/XML/1998/namespace',
];

// 字体许可证原文里有网址，按文件名豁免：Archivo 的 OFL.txt 与各展示字体的 OFL-<名字>.txt
const LICENCE = /^OFL(-[\w-]+)?\.txt$/;

test('产物零外链：除字体许可证外不得出现 http(s)://', () => {
  const hits = [];
  for (const { f, s } of texts) {
    if (LICENCE.test(basename(f))) continue;
    let body = s;
    for (const ns of NS_ALLOW) body = body.split(ns).join('');
    const m = body.match(/https?:\/\/[^\s"'`)<>]*/gi);
    if (m) hits.push(`${f.replace(ROOT + '/', '')}: ${[...new Set(m)].slice(0, 5).join(', ')}`);
  }
  assert.deepEqual(hits, []);
});

test('产物不引第三方字体与脚本域名', () => {
  const bad = /fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr|unpkg\.com|cdnjs\./i;
  for (const { f, s } of texts) assert.ok(!bad.test(s), `${f} 引了第三方资源`);
});

const BANNED = [/(?<![A-Za-z])AI(?![A-Za-z])/, /人工智能/, /智能匹配/, /军师/, /智能体/];
const LEAK = [/主理人公社/, /主理人/, /公社小助手/];

// SSR 渲染出的全部路由 HTML，禁词与泄漏扫描也覆盖它
const { renderRoute, routePatterns } = await import(pathToFileURL(SSR).href);
const rendered = routePatterns.map((r) => {
  const path = r.pattern.replace(/:([a-z]+)/g, 'sample');
  return { ...r, path, html: renderRoute(path) };
});

test('禁词：AI / 人工智能 / 智能匹配 / 军师 / 智能体', () => {
  const hits = [];
  for (const { f, s } of [...texts, ...rendered.map((r) => ({ f: `route ${r.path}`, s: r.html }))]) {
    if (LICENCE.test(basename(f))) continue;
    for (const re of BANNED) if (re.test(s)) hits.push(`${f.replace(ROOT + '/', '')} ← ${re}`);
  }
  assert.deepEqual(hits, []);
});

test('源品牌名不得泄漏：主理人 / 主理人公社 / 公社小助手', () => {
  const hits = [];
  for (const { f, s } of [...texts, ...rendered.map((r) => ({ f: `route ${r.path}`, s: r.html }))]) {
    for (const re of LEAK) if (re.test(s)) hits.push(`${f.replace(ROOT + '/', '')} ← ${re}`);
  }
  assert.deepEqual(hits, []);
});

test('7 条路由全部注册，且每条都印了「样张」章', () => {
  assert.equal(rendered.length, 7, `路由数应为 7，实际 ${rendered.length}`);
  for (const r of rendered) {
    assert.ok(r.html.length > 200, `路由 ${r.path} 渲染为空`);
    assert.match(r.html, /样张/, `路由 ${r.path} 没有「样张」章`);
  }
});

test('底栏四格：本期 / 方案 / 会员证 / 我的，只出现在根页面', () => {
  for (const r of rendered) {
    const hasBar = /class="tabbar"/.test(r.html);
    assert.equal(hasBar, r.kind === 'tab', `路由 ${r.path} 底栏出现与否不对`);
    if (hasBar) for (const t of ['本期', '方案', '会员证', '我的']) assert.match(r.html, new RegExp(t));
  }
});

test('生成图必须带「示意 · 生成图像，非实拍」图注', () => {
  const home = rendered.find((r) => r.name === 'home');
  assert.match(home.html, /示意 · 生成图像，非实拍/);
});

test('字体合计 ≤ 120KB，且许可证与字体同目录', () => {
  const fonts = files.filter((f) => FONT_EXT.has(extname(f)));
  assert.ok(fonts.length >= 1, '产物里没有自托管字体');
  const total = fonts.reduce((n, f) => n + statSync(f).size, 0);
  assert.ok(total <= 120 * 1024, `字体合计 ${total} 字节，超过 120KB`);
  for (const f of fonts) assert.ok(existsSync(join(dirname(f), 'OFL.txt')), `${f} 旁边没有 OFL.txt`);
  // 中文展示字体（Noto Sans SC 子集）另有自己的许可证，必须同目录发布
  for (const f of fonts.filter((x) => /display-[\w-]+\.woff2$/.test(basename(x)))) {
    assert.ok(existsSync(join(dirname(f), 'OFL-NotoSansSC.txt')), `${f} 旁边没有 OFL-NotoSansSC.txt`);
  }
});

test('viewport 允许缩放，lang 为 zh-CN，theme-color 已由品牌注入', () => {
  const html = readFileSync(join(DIST, 'index.html'), 'utf8');
  const vp = html.match(/<meta name="viewport" content="([^"]+)"/);
  assert.ok(vp, '缺 viewport');
  assert.doesNotMatch(vp[1], /maximum-scale/);
  assert.doesNotMatch(vp[1], /user-scalable\s*=\s*(no|0)/);
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /<meta name="theme-color" content="#[0-9A-Fa-f]{6}"/);
  assert.doesNotMatch(html, /%[A-Z_]+%/, '有未替换的品牌占位符');
});
