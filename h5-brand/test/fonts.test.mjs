// 字体守卫：跑在源码上（不依赖 npm run build）。
// ① 展示字面全部被子集覆盖——新加一个标题却没重跑 scripts/subset-display.mjs，这里就红；
// ② 清单与字体文件一致（按 WOFF2 里真实的 cmap 核对，不只信清单）；
// ③ 字体合计 ≤ 120KB，中文展示子集 ≤ 90KB；④ 许可证齐全；⑤ 不出现繁体字形的字体；
// ⑥ fonts.css 与清单、main.tsx 的接线对得上。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { brotliDecompressSync } from 'node:zlib';
import {
  collectDisplayStrings,
  archivoRange,
  inRanges,
  manifestPath,
  FAMILY,
  WEIGHTS,
  CJK_BUDGET,
  TOTAL_BUDGET,
  DELEGATE,
  SOURCE,
  FONTS_DIR,
} from '../scripts/subset-display.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BRANDS = readdirSync(join(ROOT, 'brands')).filter((d) => statSync(join(ROOT, 'brands', d)).isDirectory());
const FONT_EXT = /\.(woff2?|ttf|otf)$/i;

// —— 最小 WOFF2 读取：只为拿 cmap / name / OS/2 这几张不做变换的表 ——
const KNOWN_TAGS = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ',
  'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS',
  'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc',
  'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop',
  'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill',
];

function base128(buf, pos) {
  let v = 0;
  for (let i = 0; i < 5; i++) {
    const b = buf[pos.i++];
    if (i === 0 && b === 0x80) throw new Error('UIntBase128 前导零');
    v = v * 128 + (b & 0x7f);
    if (!(b & 0x80)) return v;
  }
  throw new Error('UIntBase128 过长');
}

function woff2Tables(buf) {
  assert.equal(buf.toString('latin1', 0, 4), 'wOF2', '不是 WOFF2 文件');
  assert.notEqual(buf.toString('latin1', 4, 8), 'ttcf', '不支持字体集合');
  const numTables = buf.readUInt16BE(12);
  const compressed = buf.readUInt32BE(20);
  const pos = { i: 48 };
  const dir = [];
  for (let t = 0; t < numTables; t++) {
    const flags = buf[pos.i++];
    let tag = KNOWN_TAGS[flags & 0x3f];
    if ((flags & 0x3f) === 63) {
      tag = buf.toString('latin1', pos.i, pos.i + 4);
      pos.i += 4;
    }
    const ver = flags >> 6;
    const orig = base128(buf, pos);
    const transformed = tag === 'glyf' || tag === 'loca' ? ver === 0 : ver !== 0;
    dir.push({ tag, length: transformed ? base128(buf, pos) : orig });
  }
  const data = brotliDecompressSync(buf.subarray(pos.i, pos.i + compressed));
  const tables = {};
  let off = 0;
  for (const d of dir) {
    tables[d.tag] = data.subarray(off, off + d.length);
    off += d.length;
  }
  return tables;
}

function cmapChars(t) {
  const n = t.readUInt16BE(2);
  let pick = null;
  for (let i = 0; i < n; i++) {
    const pid = t.readUInt16BE(4 + i * 8);
    const eid = t.readUInt16BE(6 + i * 8);
    const off = t.readUInt32BE(8 + i * 8);
    const fmt = t.readUInt16BE(off);
    if (fmt === 12 && (pid === 3 || pid === 0)) pick = { off, fmt };
    else if (fmt === 4 && (pid === 3 || pid === 0) && eid !== 0 && !pick) pick = { off, fmt };
  }
  assert.ok(pick, '字体里没有 Unicode cmap');
  const set = new Set();
  const { off } = pick;
  if (pick.fmt === 12) {
    const groups = t.readUInt32BE(off + 12);
    for (let g = 0; g < groups; g++) {
      const p = off + 16 + g * 12;
      for (let c = t.readUInt32BE(p); c <= t.readUInt32BE(p + 4); c++) set.add(String.fromCodePoint(c));
    }
    return set;
  }
  const seg = t.readUInt16BE(off + 6) / 2;
  const ends = off + 14;
  const starts = ends + seg * 2 + 2;
  const deltas = starts + seg * 2;
  const ranges = deltas + seg * 2;
  for (let s = 0; s < seg; s++) {
    const end = t.readUInt16BE(ends + s * 2);
    const start = t.readUInt16BE(starts + s * 2);
    const delta = t.readInt16BE(deltas + s * 2);
    const ro = t.readUInt16BE(ranges + s * 2);
    for (let c = start; c <= end && c !== 0xffff; c++) {
      let g;
      if (ro === 0) g = (c + delta) & 0xffff;
      else {
        g = t.readUInt16BE(ranges + s * 2 + ro + (c - start) * 2);
        if (g) g = (g + delta) & 0xffff;
      }
      if (g) set.add(String.fromCodePoint(c));
    }
  }
  return set;
}

function nameRecords(t) {
  const count = t.readUInt16BE(2);
  const strOff = t.readUInt16BE(4);
  const out = [];
  for (let i = 0; i < count; i++) {
    const p = 6 + i * 12;
    const pid = t.readUInt16BE(p);
    const nameID = t.readUInt16BE(p + 6);
    const len = t.readUInt16BE(p + 8);
    const at = strOff + t.readUInt16BE(p + 10);
    const raw = Buffer.from(t.subarray(at, at + len));
    const text = pid === 3 || pid === 0 ? raw.swap16().toString('utf16le') : raw.toString('latin1');
    out.push({ nameID, text });
  }
  return out;
}

function readFont(file) {
  const tables = woff2Tables(readFileSync(file));
  return {
    chars: cmapChars(tables.cmap),
    names: nameRecords(tables.name),
    weight: tables['OS/2'].readUInt16BE(4),
  };
}

const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const fontFiles = readdirSync(FONTS_DIR).filter((f) => FONT_EXT.test(f));
const archivoFile = join(FONTS_DIR, 'archivo-latin.woff2');
const fontsCss = readFileSync(join(ROOT, 'src', 'styles', 'fonts.css'), 'utf8');

for (const brand of BRANDS) {
  test(`${brand}：展示位里的 {表达式} 全部在 DYNAMIC 表登记了取值`, () => {
    const { unresolved } = collectDisplayStrings(brand);
    assert.deepEqual(unresolved, [], '在 scripts/subset-display.mjs 的 DYNAMIC 表里登记这些表达式读什么数据');
  });

  test(`${brand}：每个展示字面都被子集或 Archivo 覆盖（改了标题要重跑 node scripts/subset-display.mjs）`, () => {
    const mp = manifestPath(brand);
    assert.ok(existsSync(mp), `缺 ${basename(mp)}：跑 BRAND=${brand} node scripts/subset-display.mjs`);
    const manifest = JSON.parse(readFileSync(mp, 'utf8'));
    const have = new Set(manifest.chars);
    const { strings, chars, delegated } = collectDisplayStrings(brand);
    assert.ok(strings.length > 0, '一个展示字面都没收到，收字规则坏了');
    const lack = [...chars].filter((ch) => !have.has(ch));
    const where = lack.map((ch) => `「${ch}」← ${strings.find((s) => s.text.includes(ch))?.from ?? 'EXTRA'}`);
    assert.deepEqual(where, [], '展示字体缺字');
    // 交给 Archivo 的字：必须在它的 unicode-range 里，且它的字体文件真有这个字形
    const ranges = archivoRange();
    const archivo = readFont(archivoFile).chars;
    for (const ch of delegated) {
      assert.ok(DELEGATE.includes(ch));
      assert.ok(inRanges(ch, ranges), `「${ch}」不在 Archivo 的 unicode-range 里`);
      assert.ok(archivo.has(ch), `Archivo 字体里没有「${ch}」`);
    }
    // 子集里不该出现 DELEGATE 的字，否则它会先于 Archivo 被选中
    for (const ch of DELEGATE) assert.ok(!have.has(ch), `「${ch}」应交给 Archivo，却进了子集`);
  });

  test(`${brand}：清单与字体文件一致（哈希、字节数、实际 cmap、字重）`, () => {
    const manifest = JSON.parse(readFileSync(manifestPath(brand), 'utf8'));
    assert.equal(manifest.family, FAMILY);
    assert.deepEqual(manifest.faces.map((f) => f.weight), WEIGHTS);
    for (const face of manifest.faces) {
      const p = join(FONTS_DIR, face.file);
      assert.ok(existsSync(p), `缺字体文件 ${face.file}`);
      assert.equal(sha256(p), face.sha256, `${face.file} 与清单不符：重跑子集脚本，别手换文件`);
      assert.equal(statSync(p).size, face.bytes);
      const font = readFont(p);
      assert.equal([...font.chars].sort().join(''), [...manifest.chars].sort().join(''), `${face.file} 的实际覆盖与清单不一致`);
      assert.equal(font.weight, face.weight, `${face.file} 的 usWeightClass 不是 ${face.weight}`);
      const fam = font.names.filter((n) => n.nameID === 16 || n.nameID === 1).map((n) => n.text);
      assert.ok(fam.some((t) => t.startsWith(FAMILY)), `${face.file} 内部族名不是 ${FAMILY}`);
    }
  });

  test(`${brand}：字体合计 ≤ 120KB，中文展示子集 ≤ 90KB`, () => {
    const display = fontFiles.filter((f) => f.startsWith(`display-${brand}-`));
    assert.ok(display.length > 0, `没有 ${brand} 的展示字体`);
    const cjk = display.reduce((n, f) => n + statSync(join(FONTS_DIR, f)).size, 0);
    const total = cjk + statSync(archivoFile).size;
    assert.ok(cjk <= CJK_BUDGET, `中文展示子集 ${cjk} 字节，超过 ${CJK_BUDGET}`);
    assert.ok(total <= TOTAL_BUDGET, `字体合计 ${total} 字节，超过 ${TOTAL_BUDGET}`);
  });
}

test('许可证齐全：Archivo 与 Noto Sans SC 各一份 OFL 原文', () => {
  const archivo = readFileSync(join(FONTS_DIR, 'OFL.txt'), 'utf8');
  assert.match(archivo, /Archivo/);
  assert.match(archivo, /SIL Open Font License/);
  const noto = join(FONTS_DIR, SOURCE.licenseFile);
  assert.ok(existsSync(noto), `缺 ${SOURCE.licenseFile}`);
  assert.equal(sha256(noto), SOURCE.licenseSha256, `${SOURCE.licenseFile} 不是上游原文`);
  assert.match(readFileSync(noto, 'utf8'), /SIL Open Font License, Version 1\.1/);
  // OFL 第 3 条：改过的版本不得使用保留字体名 'Source'
  assert.doesNotMatch(FAMILY, /Source/);
});

test('不出现繁体字形的字体：文件名、内部族名、清单来源与 CSS 族名逐一核对', () => {
  const TRAD = /(^|[\s_-])(TC|HK|TW|Hant)(\b|[\s_.-])|Traditional|繁/i;
  for (const f of fontFiles) {
    assert.doesNotMatch(f, TRAD, `字体文件名像是繁体字形：${f}`);
    if (!f.endsWith('.woff2')) continue;
    for (const n of readFont(join(FONTS_DIR, f)).names.filter((x) => [1, 4, 6, 16].includes(x.nameID))) {
      assert.doesNotMatch(n.text, TRAD, `${f} 的内部名像是繁体字形：${n.text}`);
    }
  }
  for (const brand of BRANDS) {
    const mp = manifestPath(brand);
    if (!existsSync(mp)) continue;
    const src = JSON.parse(readFileSync(mp, 'utf8')).source;
    assert.equal(src.name, 'Noto Sans SC', '展示字体来源必须是简体字形的 Noto Sans SC');
    assert.equal(src.sha256, SOURCE.sha256);
  }
  // src 下所有 @font-face 只许这两个族名，且只引 src/fonts 下的本地文件
  const cssFiles = [];
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.css')) cssFiles.push(p);
    }
  };
  walk(join(ROOT, 'src'));
  for (const f of cssFiles) {
    const css = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
      const fam = /font-family\s*:\s*['"]([^'"]+)['"]/.exec(m[1])?.[1];
      assert.ok(['Archivo Brand', FAMILY].includes(fam), `${basename(f)} 声明了未登记的字体族 ${fam}`);
      for (const u of m[1].matchAll(/url\(\s*['"]?([^'")]+)/g)) {
        assert.match(u[1], /^\.\.\/fonts\/[\w.-]+\.woff2$/, `${basename(f)} 的字体地址必须是本地 src/fonts：${u[1]}`);
      }
    }
  }
});

test('fonts.css 接线：每个字重一条 @font-face（swap），--font-display 以展示字体开头、以系统中文字体栈兜底', () => {
  const css = fontsCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);
  const refs = faces.map((body) => {
    const file = /url\(\s*['"]?\.\.\/fonts\/([^'")]+)/.exec(body)?.[1];
    const weight = Number(/font-weight\s*:\s*(\d+)/.exec(body)?.[1]);
    assert.match(body, /font-display\s*:\s*swap/);
    assert.match(body, new RegExp(`font-family\\s*:\\s*['"]${FAMILY}['"]`));
    const m = /^display-([a-z][a-z0-9-]*)-(\d+)\.woff2$/.exec(file ?? '');
    assert.ok(m, `@font-face 引用的不是展示子集：${file}`);
    assert.equal(Number(m[2]), weight, `${file} 声明的字重与文件名不符`);
    return { brand: m[1], weight, file };
  });
  // 文件名写死了品牌：只有一个品牌时成立。出现第二个品牌时这里会红——把 @font-face 挪进 scripts/brand.mjs 按 BRAND 生成
  const brands = [...new Set(refs.map((r) => r.brand))];
  assert.deepEqual(brands, BRANDS, 'fonts.css 写死的品牌与 brands/ 不一致：多品牌时改由 scripts/brand.mjs 生成 @font-face');
  const manifest = JSON.parse(readFileSync(manifestPath(brands[0]), 'utf8'));
  assert.deepEqual(
    refs.map((r) => r.file).sort(),
    manifest.faces.map((f) => f.file).sort(),
    'fonts.css 引用的文件与清单不一致',
  );
  const decl = /--font-display\s*:\s*([^;]+);/.exec(css)?.[1]?.trim();
  assert.ok(decl, 'fonts.css 没有定义 --font-display');
  assert.ok(decl.startsWith(`'${FAMILY}'`) || decl.startsWith(`"${FAMILY}"`), `--font-display 必须以 ${FAMILY} 开头`);
  assert.match(decl, /var\(--font-zh\)\s*$/, '--font-display 必须以系统中文字体栈 var(--font-zh) 兜底');
  assert.match(decl, /'Archivo Brand'|"Archivo Brand"/, '间隔号交给 Archivo：它得在字体栈里');
});

test('main.tsx 引入了 fonts.css', () => {
  const main = readFileSync(join(ROOT, 'src', 'main.tsx'), 'utf8');
  assert.match(main, /^import '\.\/styles\/fonts\.css';$/m);
});
