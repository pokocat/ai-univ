// 品牌层：构建期读取 brands/<id>/ 下的身份与令牌，编译成 CSS 自定义属性与一个虚拟模块。
// 运行时不拉任何主题；新增品牌只需新增 brands/<id>/ 目录。
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function brandId() {
  const id = process.env.BRAND || 'liren';
  if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new Error(`BRAND 名不合法：${id}`);
  return id;
}

export function brandDir(id = brandId()) {
  return resolve(ROOT, 'brands', id);
}

function readJson(p) {
  if (!existsSync(p)) throw new Error(`缺少品牌文件：${p}`);
  return JSON.parse(readFileSync(p, 'utf8'));
}

const REQUIRED_COLORS = [
  'carton', 'carton-raised', 'carton-deep', 'on-carton', 'on-carton-dim', 'foil', 'foil-on-panel',
  'panel', 'panel-object', 'panel-alt', 'ink', 'ink-soft', 'ink-mute', 'rule',
  'action', 'on-action', 'action-ink', 'ok', 'warn', 'glass-dark', 'glass-panel', 'qr-ground', 'stage',
];
const FACT_STATUS = new Set(['confirmed', '拟定']);
const TABS = new Set(['home', 'plans', 'card', 'me']);

// 校验失败即构建失败，不静默放行
export function loadBrand(id = brandId()) {
  const dir = brandDir(id);
  const identity = readJson(resolve(dir, 'brand.json'));
  const h5 = readJson(resolve(dir, 'h5.json'));
  const errs = [];
  if (identity.id !== id) errs.push(`brand.json 的 id（${identity.id}）与目录名（${id}）不一致`);
  for (const k of ['name', 'nameNote', 'audienceLabel', 'operator', 'issue', 'tabLabels', 'handoff']) {
    if (identity[k] == null) errs.push(`brand.json 缺字段 ${k}`);
  }
  const color = h5.tokens?.color ?? {};
  for (const c of REQUIRED_COLORS) if (!color[c]) errs.push(`h5.json tokens.color 缺角色 ${c}`);
  if (color['qr-ground'] && color['qr-ground'].toUpperCase() !== '#FFFFFF') errs.push('二维码底色必须是纯白 #FFFFFF');
  for (const f of h5.facts ?? []) {
    if (!FACT_STATUS.has(f.status)) errs.push(`事实 ${f.key} 的 status 只能是 confirmed 或 拟定`);
    if (!f.source) errs.push(`事实 ${f.key} 缺来源 source`);
  }
  for (const t of h5.modules?.tabs ?? []) if (!TABS.has(t)) errs.push(`未知的底栏入口 ${t}`);
  for (const [k, img] of Object.entries(h5.images ?? {})) {
    if (!img.license) errs.push(`图片 ${k} 缺 license`);
    if (img.license === 'generated-preview' && !/示意/.test(img.credit ?? '')) errs.push(`生成图 ${k} 的图注必须写明「示意」`);
  }
  if (errs.length) throw new Error(`品牌 ${id} 校验失败：\n- ${errs.join('\n- ')}`);
  return { identity, h5 };
}

// 令牌 → CSS 自定义属性
export function compileTokens(h5) {
  const t = h5.tokens;
  const lines = [];
  for (const [k, v] of Object.entries(t.color)) lines.push(`--c-${k}: ${v};`);
  for (const [k, v] of Object.entries(t.font)) lines.push(`--font-${k}: ${v};`);
  for (const [k, [size, lh]] of Object.entries(t.type)) {
    lines.push(`--fs-${k}: ${size};`, `--lh-${k}: ${lh};`);
  }
  for (const [k, v] of Object.entries(t.tracking)) lines.push(`--tr-${k}: ${v};`);
  for (const [k, v] of Object.entries(t.space)) lines.push(`--s${k}: ${v};`);
  for (const [k, v] of Object.entries(t.radius)) lines.push(`--r-${k}: ${v};`);
  for (const [k, v] of Object.entries(t.material)) lines.push(`--m-${k}: ${v};`);
  // 颗粒强度写进噪点本身（alpha 通道），不靠叠加层或混合模式
  const g = Number(t.material.grain ?? 0.05);
  lines.push(`--m-grain-img: ${grainUri('1 1 1', g * 2)};`, `--m-grain-img-ink: ${grainUri(inkRgb(t.color.ink), g * 1.2)};`);
  for (const [k, v] of Object.entries(t.motion)) {
    lines.push(k.startsWith('ease') ? `--${k}: ${v};` : `--dur-${k}: ${v};`);
  }
  return `/* 由 brands/<id>/h5.json 构建期生成，勿手改 */\n:root {\n  ${lines.join('\n  ')}\n}\n`;
}

function inkRgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3)).join(' ');
}

// 约 400B 的 feTurbulence 噪点；rgb 为 0–1 的三通道，alpha = 噪点 × 强度
function grainUri(rgb, strength) {
  const [r, g, b] = rgb.split(' ');
  const a = Math.min(1, Math.max(0, strength)).toFixed(3);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>` +
    `<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/>` +
    `<feColorMatrix values='0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  ${a} 0 0 0 0'/></filter>` +
    `<rect width='100%' height='100%' filter='url(#n)'/></svg>`;
  return `url("data:image/svg+xml;utf8,${svg.replace(/%/g, '%25').replace(/#/g, '%23').replace(/"/g, "'")}")`;
}

const V_BRAND = 'virtual:brand';
const V_TOKENS = 'virtual:brand-tokens.css';

export function brandPlugin() {
  const id = brandId();
  const dir = brandDir(id);
  return {
    name: 'brand-h5:brand',
    enforce: 'pre',
    config() {
      return {
        resolve: { alias: { '@brand': dir } },
        define: { __BRAND_ID__: JSON.stringify(id) },
      };
    },
    resolveId(src) {
      if (src === V_BRAND) return '\0' + V_BRAND;
      if (src === V_TOKENS) return '\0' + V_TOKENS;
      return null;
    },
    load(rid) {
      if (rid === '\0' + V_BRAND) {
        const { identity, h5 } = loadBrand(id);
        this.addWatchFile(resolve(dir, 'brand.json'));
        this.addWatchFile(resolve(dir, 'h5.json'));
        // 只下发运行时需要的部分：令牌走 CSS，不进 JS
        const runtime = { facts: h5.facts, modules: h5.modules, images: h5.images, themeColor: h5.themeColor };
        return `export const identity = ${JSON.stringify(identity)};\nexport const h5 = ${JSON.stringify(runtime)};\n`;
      }
      if (rid === '\0' + V_TOKENS) {
        const { h5 } = loadBrand(id);
        this.addWatchFile(resolve(dir, 'h5.json'));
        return compileTokens(h5);
      }
      return null;
    },
    transformIndexHtml: {
      // post：构建时拿得到带哈希的字体文件名，才能给字标的展示字体加 preload
      order: 'post',
      handler(html, ctx) {
        const { identity, h5 } = loadBrand(id);
        const title = `${identity.name}（${identity.nameNote}）· ${identity.issue.label}`;
        let out = html
          .replaceAll('%BRAND_TITLE%', title)
          .replaceAll('%THEME_COLOR%', h5.themeColor)
          .replaceAll('%BRAND_DESC%', `${identity.name}（${identity.nameNote}）会员社群 · 演示样张`);
        // 字标首屏就用超细展示字：不预加载的话先用系统字画一遍再换，正好撞上开盒仪式的扫光
        const display = ctx.bundle && Object.keys(ctx.bundle).find((f) => /display-[\w-]+-200[^/]*\.woff2$/.test(f));
        if (display) {
          out = out.replace('</head>', `  <link rel="preload" href="./${display}" as="font" type="font/woff2" crossorigin />\n  </head>`);
        }
        return out;
      },
    },
    generateBundle(_opts, bundle) {
      // 字体许可证放在字体旁边一同发布：Archivo 与 Noto Sans SC 各一份（OFL 要求随字体附带许可证）
      const font = Object.keys(bundle).find((f) => f.endsWith('.woff2'));
      if (!font) return;
      const licences = [['OFL.txt', 'src/fonts/OFL.txt']];
      if (Object.keys(bundle).some((f) => /display-[\w-]+\.woff2$/.test(f))) {
        licences.push(['OFL-NotoSansSC.txt', 'src/fonts/OFL-NotoSansSC.txt']);
      }
      for (const [name, src] of licences) {
        this.emitFile({ type: 'asset', fileName: font.replace(/[^/]+$/, name), source: readFileSync(resolve(ROOT, src), 'utf8') });
      }
    },
  };
}
