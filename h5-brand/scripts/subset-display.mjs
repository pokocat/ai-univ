#!/usr/bin/env node
// 展示字体：按品牌收集「展示字面」，把 Noto Sans SC（OFL，简体字形）裁成只含这些字的 WOFF2。
//
// 为什么要有它：字标「丽人公社」、课程封面字、页面标题是这套界面的展示声部，靠超细字重 + 宽字距成立。
// 系统字体里只有苹方有超细档；安卓微信没有，200 会退成常规体，字标当场失去身份。
// 整套中文字体几 MB，零网络又不许外链字体，所以只自托管「展示位真的会出现的那些字」。
//
// 用法（在 h5-brand 下）：
//   node scripts/subset-display.mjs              # BRAND 默认 liren；源字体取本机缓存
//   node scripts/subset-display.mjs --fetch      # 缓存里没有源字体时，从固定提交下载并校验 SHA-256
//   node scripts/subset-display.mjs --check      # 只核对：清单是否覆盖当前全部展示字面，不重新出字体
//   BRAND=xxx node scripts/subset-display.mjs --src /path/NotoSansSC[wght].ttf
// 字体侧的工作在同目录 subset-display.py（fontTools），本脚本负责收字、调度与写清单。
//
// 产物：src/fonts/display-<brand>-<字重>.woff2、src/fonts/display-<brand>.json（清单）、
//       src/fonts/OFL-NotoSansSC.txt（许可证原文）。
//
// ———— 什么算「展示字面」（test/fonts.test.mjs 用同一个函数，改规则两边一起生效）————
// S1 品牌身份：brands/<id>/brand.json 的 name 与 nameNote。
// S2 路由标题：src/app/router.ts 里 ROUTES 每一行的 title 字面量。
// S3 组件标题属性：src/**/*.tsx 里 <Panel> / <PanelHead> / <Placeholder> / <BackBar> 的 title 属性。
// S4 页面主标题：src/**/*.tsx 里每个 <h1> 元素的全部文字（含子元素）。
// S5 展示类名：src/**/*.css 里声明了 font-family: var(--font-display)，或声明 100/200/300 字重
//    且没指定拉丁字体的类；带这些类名的元素的全部文字（含子元素）。即「用上展示字体或超细字重的地方」
//    都自动算进来。只认单一复合选择器（.a / .a.b）；带拉丁类名（.num 等走 Archivo）的元素跳过。
// S6 内容包：courses[].title、封面字 cover_text（缺省时封面印 course_type）、plans[].name、joinGuide.title。
// 另加 EXTRA：紧挨展示字出现的数字与标点；DELEGATE 里的字（间隔号「·」）刻意不进子集，交给 Archivo。
//
// S3–S5 里遇到 {表达式} 时，按下方 DYNAMIC 表把它解析成真实取值；表里没有的表达式直接报错
// （测试同样会红）——新加一个展示位却没登记它读什么数据，比漏字更该被拦下来。
// JSX 扫描是一个只认标签、属性、{…} 与字符串的轻量扫描器，不是完整解析器：
// 同名标签嵌套、{…} 里再嵌 JSX 都按层级处理；类名写成模板字符串拼接（`x--${y}`）的认不出来。
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, copyFileSync, rmSync } from 'node:fs';
import { resolve, dirname, join, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { brandId, brandDir } from './brand.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
export const FONTS_DIR = join(SRC, 'fonts');

/** CSS 里用的族名。不含源字体的保留字体名（OFL 第 3 条：改过的版本不得沿用 'Source'） */
export const FAMILY = 'Brand Display SC';
/** 200 = 字标与封面字的超细档（与现有 font-weight: 200 一致）；400 = 课程标题等需要常规字重的展示位 */
export const WEIGHTS = [200, 400];
/** 中文展示字体的体积上限；与 Archivo 合计不超过 120KB */
export const CJK_BUDGET = 90 * 1024;
export const TOTAL_BUDGET = 120 * 1024;

/** 紧挨展示字出现的数字与标点：期号、净含量天数、「开篇：」这类全角标点 */
export const EXTRA = '0123456789 -.–—（）：，。、「」【】！？';

/**
 * 刻意不进子集、交给 Archivo 出的字：间隔号「·」。
 * Noto Sans SC 的 U+00B7 是全角（1000/1000），「体重管理特辑 · 开篇」两侧再各带一个空格，会拉出一大段空；
 * 全页其余的「·」本来就由 Archivo 出（base.css 的 unicode-range 含 U+00B7），所以 --font-display 的字体栈里
 * Archivo 排在展示字体之后、系统中文字体之前。这里列的字必须落在 Archivo 的 unicode-range 里（脚本与测试都核对）。
 */
export const DELEGATE = '·';

/** 源字体：google/fonts 仓库 ofl/notosanssc，钉在一个提交上，下载后核对 SHA-256 */
export const SOURCE = {
  name: 'Noto Sans SC',
  file: 'NotoSansSC[wght].ttf',
  repo: 'google/fonts',
  path: 'ofl/notosanssc',
  commit: 'a85815a42757630ce188fdad368c2dfc444d4773',
  upstream: 'notofonts/noto-cjk Sans2.004（523d033d）',
  sha256: 'a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da',
  licenseSha256: '1c05c68c34f9708415aada51f17e1b0092d2cea709bf4a94cd38114f9e73d7d9',
  license: 'OFL-1.1',
  licenseFile: 'OFL-NotoSansSC.txt',
};
const CACHE = join(ROOT, 'node_modules', '.cache', 'brand-h5-fonts');

// ———————————————————————— 收字 ————————————————————————

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

function walk(dir, ext) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, ext));
    else if (p.endsWith(ext)) out.push(p);
  }
  return out;
}

function loadPack(id) {
  const dir = brandDir(id);
  const identity = readJson(join(dir, 'brand.json'));
  const preview = readJson(join(dir, 'content', 'preview.json'));
  const extras = readJson(join(dir, 'content', 'extras.json'));
  const courses = preview.courses ?? [];
  const coverLines = courses.flatMap((c) => (c.cover_text ?? c.course_type ?? '').split('\n').filter(Boolean));
  const planNames = (preview.plans ?? []).map((p) => p.name);
  // 方案名在盒面上按「 · 」拆成规格与期限两行（Plans.tsx 的 splitName）
  const planParts = planNames.flatMap((n) => n.split(/\s*·\s*/));
  return { identity, preview, extras, courses, coverLines, planNames, planParts };
}

/**
 * 展示位里的 {表达式} → 它实际渲染的取值。键是「文件名:表达式」，`*:` 表示任意文件。
 * 返回 [] 的条目要写明理由：取值已由别的规则收进来。
 */
const DYNAMIC = {
  '*:identity.name': (d) => [d.identity.name],
  '*:identity.nameNote': (d) => [d.identity.nameNote],
  '*:identity.nameLatin': (d) => [d.identity.nameLatin ?? ''],
  'CourseDetail.tsx:c.title': (d) => d.courses.map((c) => c.title),
  'CourseDetail.tsx:l': (d) => d.coverLines,
  'Plans.tsx:plan.name': (d) => d.planNames,
  'Plans.tsx:p.name': (d) => d.planNames,
  'Plans.tsx:head': (d) => d.planParts,
  'Plans.tsx:tail': (d) => d.planParts,
  'JoinGuide.tsx:g.title': (d) => [d.extras.joinGuide?.title ?? ''],
  'JoinGuide.tsx:s.no': (d) => (d.extras.joinGuide?.steps ?? []).map((s) => String(s.no)),
  // 序号是数字，EXTRA 已含 0–9
  'Home.tsx:i + 1': () => [],
  // 组件内部的 {title}：取值来自各调用处，已由 S3（组件标题属性）与 S2（路由标题）收进来
  'Panel.tsx:title': () => [],
  'Screen.tsx:title': () => [],
  'BackBar.tsx:title': () => [],
  'App.tsx:route.def.title': () => [],
};

function resolveExpr(file, expr, data) {
  const e = expr.replace(/\s+/g, ' ').trim();
  const fn = DYNAMIC[`${basename(file)}:${e}`] ?? DYNAMIC[`*:${e}`];
  if (fn) return fn(data);
  // 纯字符串字面量：{'…'} / {"…"} / {`…`}（模板里的 ${…} 逐个再解析）
  const q = e.match(/^(['"])([\s\S]*)\1$/);
  if (q) return [q[2]];
  if (e.startsWith('`') && e.endsWith('`')) {
    const out = [];
    const body = e.slice(1, -1);
    let i = 0;
    let lit = '';
    while (i < body.length) {
      if (body[i] === '$' && body[i + 1] === '{') {
        const end = readBalanced(body, i + 1);
        out.push(...resolveExpr(file, body.slice(i + 2, end - 1), data));
        i = end;
      } else lit += body[i++];
    }
    return [lit, ...out];
  }
  return null;
}

// —— 轻量 JSX 扫描 ——

function skipString(s, i) {
  const q = s[i];
  for (i++; i < s.length; i++) {
    if (s[i] === '\\') i++;
    else if (s[i] === q) return i + 1;
    else if (s[i] === '\n' && q !== '`') return i; // 单引号在 JSX 文字里当撇号用时，别吞掉整份文件
  }
  return i;
}

function skipTemplate(s, i) {
  for (i++; i < s.length; i++) {
    if (s[i] === '\\') i++;
    else if (s[i] === '`') return i + 1;
    else if (s[i] === '$' && s[i + 1] === '{') i = readBalanced(s, i + 1) - 1;
  }
  return i;
}

/** s[i] 是 '{'，返回配对 '}' 之后的下标 */
function readBalanced(s, i) {
  let depth = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '"' || ch === "'") {
      i = skipString(s, i);
      continue;
    }
    if (ch === '`') {
      i = skipTemplate(s, i);
      continue;
    }
    if (ch === '/' && s[i + 1] === '*') {
      const end = s.indexOf('*/', i + 2);
      i = end < 0 ? s.length : end + 2;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
    i++;
  }
  throw new Error('花括号不配对');
}

const TAG_START = /[A-Za-z]/;
/** '<' 前一个非空白字符是这些时才当作 JSX 标签（排除泛型 useState<X> 与比较 a<b） */
function looksLikeTag(s, i) {
  if (!TAG_START.test(s[i + 1] ?? '')) return false;
  let j = i - 1;
  while (j >= 0 && /\s/.test(s[j])) j--;
  if (j < 0) return true;
  if (/[A-Za-z0-9_$]/.test(s[j])) {
    // return <X /> 这类：前面是关键字而不是标识符
    const word = /[A-Za-z0-9_$]+$/.exec(s.slice(Math.max(0, j - 16), j + 1))?.[0];
    return ['return', 'yield', 'case', 'default', 'else', 'await'].includes(word ?? '');
  }
  return !/[)\].]/.test(s[j]);
}

/** 读开标签：s[i] === '<'。返回 { name, attrs, end（'>' 之后）, selfClosing } */
function readOpenTag(s, i) {
  const m = /^<([A-Za-z][\w.]*)/.exec(s.slice(i, i + 64));
  if (!m) return null;
  const name = m[1];
  const attrs = {};
  let k = i + m[0].length;
  while (k < s.length) {
    while (/\s/.test(s[k])) k++;
    if (s[k] === '/' && s[k + 1] === '>') return { name, attrs, end: k + 2, selfClosing: true };
    if (s[k] === '>') return { name, attrs, end: k + 1, selfClosing: false };
    if (s[k] === '{') {
      // {...spread}
      k = readBalanced(s, k);
      continue;
    }
    const an = /^[^\s=>/{]+/.exec(s.slice(k, k + 64));
    if (!an) return null;
    k += an[0].length;
    if (s[k] === '=') {
      k++;
      if (s[k] === '"' || s[k] === "'") {
        const e = skipString(s, k);
        attrs[an[0]] = { kind: 'str', value: s.slice(k + 1, e - 1) };
        k = e;
      } else if (s[k] === '{') {
        const e = readBalanced(s, k);
        attrs[an[0]] = { kind: 'expr', value: s.slice(k + 1, e - 1) };
        k = e;
      } else return null;
    } else attrs[an[0]] = { kind: 'bool', value: true };
  }
  return null;
}

/** 从开标签之后读到配对的闭标签，收集子树里的文字与 {表达式}（属性里的表达式不算） */
function readChildren(s, from, name) {
  const texts = [];
  const exprs = [];
  let depth = 1;
  let i = from;
  let buf = '';
  const flush = () => {
    const t = buf.replace(/\s+/g, ' ').trim();
    if (t) texts.push(t);
    buf = '';
  };
  while (i < s.length) {
    const ch = s[i];
    if (ch === '{') {
      flush();
      const e = readBalanced(s, i);
      const body = s.slice(i + 1, e - 1).trim();
      if (body && !/^\/\*[\s\S]*\*\/$/.test(body)) exprs.push(body);
      i = e;
      continue;
    }
    if (ch === '<' && s[i + 1] === '/') {
      flush();
      const close = /^<\/([A-Za-z][\w.]*)?\s*>/.exec(s.slice(i, i + 64));
      if (close) {
        if (close[1] === name && --depth === 0) return { texts, exprs, end: i + close[0].length };
        i += close[0].length;
        continue;
      }
    }
    if (ch === '<' && TAG_START.test(s[i + 1] ?? '')) {
      flush();
      const t = readOpenTag(s, i);
      if (t) {
        if (!t.selfClosing && t.name === name) depth++;
        i = t.end;
        continue;
      }
    }
    buf += ch;
    i++;
  }
  throw new Error(`<${name}> 没有找到闭标签`);
}

function classTokens(attr) {
  if (!attr) return [];
  if (attr.kind === 'str') return attr.value.split(/\s+/).filter(Boolean);
  if (attr.kind !== 'expr') return [];
  // 表达式里的每个普通字符串字面量都当作候选类名（['a', x && 'b'].join(' ') 这种写法）
  const out = [];
  for (const m of attr.value.matchAll(/(['"])([^'"`$]*?)\1/g)) out.push(...m[2].split(/\s+/).filter(Boolean));
  return out;
}

/**
 * S5：从全部 CSS 里找出展示类名与拉丁类名。
 * 只看单一复合选择器（`.a` / `.a.b`），`.x .num` 这种带上下文的规则不外溢成全局判断。
 * 展示类名：声明 font-family: var(--font-display)，或声明 100–300 字重且没有指定拉丁字体。
 * 拉丁类名：声明 font-family: var(--font-latin)（数字、期号、拉丁注记走 Archivo）——带它的元素不算展示字面。
 */
export function displayClasses() {
  const display = new Set();
  const latin = new Set();
  for (const f of walk(SRC, '.css')) {
    const css = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const body = m[2];
      const isLatin = /font-family\s*:\s*var\(\s*--font-latin\s*\)/.test(body);
      const isDisplay =
        /font-family\s*:\s*var\(\s*--font-display\s*\)/.test(body) ||
        (/font-weight\s*:\s*(100|200|300)\b/.test(body) && !isLatin);
      if (!isLatin && !isDisplay) continue;
      for (const sel of m[1].split(',')) {
        const t = sel.trim();
        if (!/^(\.[A-Za-z_][\w-]*)+(::?[\w-]+(\([^)]*\))?)*$/.test(t)) continue;
        for (const c of t.replace(/::?[\w-]+(\([^)]*\))?/g, '').matchAll(/\.([A-Za-z_][\w-]*)/g)) {
          (isDisplay ? display : latin).add(c[1]);
        }
      }
    }
  }
  return { display, latin };
}

const TITLE_COMPONENTS = new Set(['Panel', 'PanelHead', 'Placeholder', 'BackBar']);

function lineOf(s, i) {
  return s.slice(0, i).split('\n').length;
}

/**
 * 收集一个品牌的全部展示字面。
 * 返回 { strings: [{ text, from }], unresolved: [描述], classes: [展示类名], latinClasses,
 *        chars: 要进子集的字（排好序、去重）, delegated: 出现在展示字面里、交给 Archivo 的字 }
 */
export function collectDisplayStrings(id = brandId()) {
  const data = loadPack(id);
  const strings = [];
  const unresolved = [];
  const add = (text, from) => {
    if (text && String(text).trim()) strings.push({ text: String(text), from });
  };

  // S1
  add(data.identity.name, 'brand.json name');
  add(data.identity.nameNote, 'brand.json nameNote');

  // S2
  const router = readFileSync(join(SRC, 'app', 'router.ts'), 'utf8');
  const routesBlock = router.slice(router.indexOf('export const ROUTES'));
  const routesBody = routesBlock.slice(0, routesBlock.indexOf('];'));
  for (const m of routesBody.matchAll(/\btitle:\s*(['"])(.*?)\1/g)) add(m[2], 'router.ts ROUTES.title');

  // S3–S5
  const { display: classes, latin } = displayClasses();
  const take = (file, src, node, texts, exprs, why) => {
    const where = `${relative(ROOT, file)}:${lineOf(src, node)} ${why}`;
    for (const t of texts) add(t, where);
    for (const e of exprs) {
      const v = resolveExpr(file, e, data);
      if (v === null) unresolved.push(`${where} 的 {${e.replace(/\s+/g, ' ').trim()}}`);
      else for (const t of v) add(t, `${where} {${e.trim()}}`);
    }
  };
  for (const file of walk(SRC, '.tsx')) {
    const src = readFileSync(file, 'utf8');
    for (let i = src.indexOf('<'); i >= 0; i = src.indexOf('<', i + 1)) {
      if (!looksLikeTag(src, i)) continue;
      let tag;
      try {
        tag = readOpenTag(src, i);
      } catch {
        tag = null;
      }
      if (!tag) continue;
      if (TITLE_COMPONENTS.has(tag.name) && tag.attrs.title) {
        const a = tag.attrs.title;
        if (a.kind === 'str') take(file, src, i, [a.value], [], `<${tag.name} title>`);
        else if (a.kind === 'expr') take(file, src, i, [], [a.value], `<${tag.name} title>`);
      }
      if (tag.selfClosing) continue;
      const tokens = classTokens(tag.attrs.class ?? tag.attrs.className);
      const cls = tokens.filter((c) => classes.has(c));
      if (tag.name !== 'h1' && (cls.length === 0 || tokens.some((c) => latin.has(c)))) continue;
      const kids = readChildren(src, tag.end, tag.name);
      take(file, src, i, kids.texts, kids.exprs, tag.name === 'h1' ? '<h1>' : `.${cls.join('.')}`);
    }
  }

  // S6
  for (const c of data.courses) add(c.title, `preview.json courses[${c.id}].title`);
  for (const l of data.coverLines) add(l, 'preview.json courses[].cover_text');
  for (const n of data.planNames) add(n, 'preview.json plans[].name');
  if (data.extras.joinGuide?.title) add(data.extras.joinGuide.title, 'extras.json joinGuide.title');

  const all = charsOf(strings.map((s) => s.text).join('') + EXTRA);
  const chars = [...all].filter((ch) => !DELEGATE.includes(ch)).join('');
  const delegated = [...all].filter((ch) => DELEGATE.includes(ch)).join('');
  return { strings, unresolved, classes: [...classes].sort(), latinClasses: [...latin].sort(), chars, delegated };
}

/** 去重、去掉空白以外的控制字符，保留空格，按码位排序 */
export function charsOf(text) {
  const set = new Set();
  for (const ch of text) {
    if (ch === ' ' || !/\s/.test(ch)) set.add(ch);
  }
  return [...set].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('');
}

/** 读 base.css 里 Archivo 那条 @font-face 的 unicode-range，返回 [起, 止] 码位区间 */
export function archivoRange() {
  const css = readFileSync(join(SRC, 'styles', 'base.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    if (!/font-family\s*:\s*['"]Archivo Brand['"]/.test(m[1])) continue;
    const r = /unicode-range\s*:\s*([^;]+);/.exec(m[1]);
    if (!r) return [[0, 0x10ffff]];
    return r[1].split(',').map((part) => {
      const [a, b] = part.trim().replace(/^U\+/i, '').split('-');
      return [parseInt(a, 16), parseInt(b ?? a, 16)];
    });
  }
  throw new Error('base.css 里找不到 Archivo Brand 的 @font-face');
}

export function inRanges(ch, ranges) {
  const cp = ch.codePointAt(0);
  return ranges.some(([a, b]) => cp >= a && cp <= b);
}

export function manifestPath(id) {
  return join(FONTS_DIR, `display-${id}.json`);
}

export function faceFile(id, weight) {
  return `display-${id}-${weight}.woff2`;
}

// ———————————————————————— 出字体 ————————————————————————

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

async function fetchSource() {
  mkdirSync(CACHE, { recursive: true });
  const base = `https://raw.githubusercontent.com/${SOURCE.repo}/${SOURCE.commit}/${SOURCE.path}/`;
  for (const [name, want] of [
    [SOURCE.file, SOURCE.sha256],
    ['OFL.txt', SOURCE.licenseSha256],
  ]) {
    const url = base + encodeURIComponent(name).replace(/%2F/g, '/');
    console.log(`下载 ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`下载失败：${res.status} ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const got = sha256(buf);
    if (got !== want) throw new Error(`${name} 的 SHA-256 不符：${got}（应为 ${want}）`);
    writeFileSync(join(CACHE, name), buf);
  }
}

function argValue(args, flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const id = brandId();
  const collected = collectDisplayStrings(id);
  if (collected.unresolved.length) {
    throw new Error(
      `这些展示位的 {表达式} 没有在 scripts/subset-display.mjs 的 DYNAMIC 表里登记取值：\n- ${collected.unresolved.join('\n- ')}`,
    );
  }

  const ranges = archivoRange();
  const orphan = [...collected.delegated].filter((ch) => !inRanges(ch, ranges));
  if (orphan.length) throw new Error(`DELEGATE 里的字不在 Archivo 的 unicode-range 内：${orphan.join('')}`);

  if (args.includes('--check')) {
    const mp = manifestPath(id);
    if (!existsSync(mp)) throw new Error(`缺清单 ${relative(ROOT, mp)}，先跑 node scripts/subset-display.mjs`);
    const have = new Set(readJson(mp).chars);
    const lack = [...collected.chars].filter((ch) => !have.has(ch));
    if (lack.length) throw new Error(`展示字体缺字：${lack.join('')}——重跑 node scripts/subset-display.mjs`);
    console.log(`展示字体覆盖完整：${collected.chars.length} 字`);
    return;
  }

  let src = argValue(args, '--src') ?? join(CACHE, SOURCE.file);
  if (!existsSync(src) && args.includes('--fetch')) await fetchSource();
  if (!existsSync(src)) {
    throw new Error(`找不到源字体 ${src}。加 --fetch 从 ${SOURCE.repo}@${SOURCE.commit.slice(0, 8)} 下载，或用 --src 指定本机文件`);
  }
  const srcHash = sha256(readFileSync(src));
  if (srcHash !== SOURCE.sha256) {
    throw new Error(`源字体 SHA-256 为 ${srcHash}，与钉住的 ${SOURCE.name} 不一致；换源要同步改 SOURCE`);
  }
  const licenseSrc = join(dirname(src), 'OFL.txt');
  if (!existsSync(licenseSrc)) throw new Error(`源字体旁边缺 OFL.txt（${licenseSrc}）`);
  if (sha256(readFileSync(licenseSrc)) !== SOURCE.licenseSha256) throw new Error('OFL.txt 与钉住的许可证原文不一致');

  const work = join(tmpdir(), `brand-h5-display-${process.pid}`);
  mkdirSync(work, { recursive: true });
  const textFile = join(work, 'chars.txt');
  writeFileSync(textFile, collected.chars, 'utf8');

  const faces = [];
  let covered = null;
  try {
    for (const w of WEIGHTS) {
      const out = join(FONTS_DIR, faceFile(id, w));
      const r = spawnSync(
        'python3',
        [join(ROOT, 'scripts', 'subset-display.py'), '--src', src, '--text-file', textFile, '--weight', String(w), '--family', FAMILY, '--out', out],
        { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
      );
      if (r.status !== 0) throw new Error(`fontTools 子集化失败（${w}）：\n${r.stderr || r.stdout}`);
      const info = JSON.parse(r.stdout.trim().split('\n').pop());
      if (info.missing) throw new Error(`源字体里没有这些字：${info.missing}`);
      if (covered !== null && covered !== info.chars) throw new Error('两个字重的覆盖不一致');
      covered = info.chars;
      faces.push({ weight: w, file: faceFile(id, w), bytes: info.bytes, glyphs: info.glyphs, sha256: sha256(readFileSync(out)) });
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }

  const cjkBytes = faces.reduce((n, f) => n + f.bytes, 0);
  if (cjkBytes > CJK_BUDGET) throw new Error(`中文展示字体合计 ${cjkBytes} 字节，超过 ${CJK_BUDGET}`);

  copyFileSync(licenseSrc, join(FONTS_DIR, SOURCE.licenseFile));

  const manifest = {
    note: '由 scripts/subset-display.mjs 生成，勿手改；新增或改动展示字面后重跑该脚本',
    brand: id,
    family: FAMILY,
    source: {
      name: SOURCE.name,
      file: SOURCE.file,
      repo: SOURCE.repo,
      path: SOURCE.path,
      commit: SOURCE.commit,
      upstream: SOURCE.upstream,
      sha256: SOURCE.sha256,
      license: SOURCE.license,
      licenseFile: SOURCE.licenseFile,
    },
    faces,
    count: [...covered].length,
    chars: covered,
    delegated: { font: 'Archivo Brand', chars: collected.delegated },
    strings: collected.strings,
  };
  writeFileSync(manifestPath(id), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  console.log(`品牌 ${id}：${manifest.count} 字`);
  for (const f of faces) console.log(`  ${f.file}  ${f.bytes} 字节  ${f.glyphs} 字形`);
  console.log(`  中文展示字体合计 ${cjkBytes} 字节（上限 ${CJK_BUDGET}）`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
