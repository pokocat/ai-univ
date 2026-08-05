/**
 * 图标与调色板的单一事实源。
 *
 * 字形本身**来自图标集**（lucide，见 utils/icon-paths.js 与 tools/gen-icons.js），
 * 不在这里手画：上一版 64 个字形是照设计稿手写的，画在同一个 24×24 viewBox 里却各占
 * 12~22 格，同一个 size 下最大差 47%，还有几个重心不在格心——并排成列就高低不齐，
 * 而且不报错。图标集本身就是按同一网格、同一光学重量做的，这类毛病从根上没有了。
 *
 * components/icon（界面图标）、custom-tab-bar（tabBar）、components/art（插画中心图标）
 * 都从这里取，且**渲染只有一份实现**（svgUri）——两处各拼一遍 svg 模板必然漂移：
 * 上一版 tabBar 那份默认描边 1.8、组件那份 1.7，同一个图标两处不一样粗。
 */
const { PATHS } = require('./icon-paths.js')

/**
 * 兼容别名：旧页面用的是 lucide 名字，改名一次性铺开风险太大
 * （漏一个的表现是图标不渲染、且不报错）。新代码一律用上面的设计稿名字。
 */
const ALIASES = {
  users: 'members',
  'check-square': 'shield',
  'trending-up': 'chart',
  sparkles: 'sparkle',
  star: 'star2',
  'qr-code': 'qr',
  tv: 'play',
  'message-circle': 'chat',
  'chevron-right': 'chev',
  package: 'folder',
  heart: 'ribbon',
  headphones: 'headset',
  'check-circle': 'shield',
  'share-2': 'link',
  'log-out': 'logout',
  'help-circle': 'info',
  'file-text': 'doc',
  'trash-2': 'trash',
  'shield-check': 'shield',
  'refresh-cw': 'refresh',
}

/**
 * 调色板镜像。
 *
 * 颜色必须烘焙进 SVG data-URI，var(--token) 在里面不生效——所以这里不得不存一份字面值。
 * 这是全站**仅有的两处**允许写字面色值的地方之一（另一处是 custom-tab-bar/index.wxss），
 * 改 app.wxss 的调色板时必须同步改这里，否则图标颜色会和界面其余部分脱节。
 *
 * 调用方一律传 token 名（color="signal"），不要再传 #7C3AED。
 * 仍然接受 # 开头的字面值，只为兼容个别一次性用法。
 */
const TOKENS = {
  ink: '#33210F',
  'ink-800': '#5A4433',
  'ink-700': '#7A5236',
  'ink-600': '#94795E',
  'ink-500': '#A9906F',
  signal: '#7C3AED',
  'signal-600': '#6D28D9',
  'signal-800': '#57189E',
  'signal-200': '#DDC5FF',
  pulse: '#E88C4A',
  'pulse-300': '#F7B65C',
  'pulse-600': '#C2652A',
  ok: '#22A070',
  warn: '#C2652A',
  danger: '#E0455D',
  'on-signal': '#FFF7EC',
  /* ── 旧 token 名的兼容别名 ──
     未被设计稿覆盖的工具页（任务/收益/团队/设置/协议/扫码登录/培训/课程）
     还在用上一版的名字。这里给它们指到暖色体系的等价色，
     否则那些页面的图标会集体回落到弱化文字色（不报错，只是全变灰）。
     重写完一个页面就从这里删掉它独用的那条；与 app.wxss 的兼容层同进同退。 */
  t1: '#33210F',
  t2: '#7A5236',
  t3: '#94795E',
  accent: '#6D28D9',
  'on-accent': '#FFF7EC',
  'on-ink': '#33210F',
  'accent-on-ink': '#6D28D9',
}
module.exports = {
  PATHS,
  ALIASES,
  TOKENS,
  resolve,
  svgUri,
}

/** token 名 / # 字面值 → 字面色值；未知名字回落到弱化文字色 */
function resolve(color) {
  return String(color).charAt(0) === '#'
    ? color
    : TOKENS[color] || TOKENS['ink-600']
}

/**
 * 视觉尺寸校准：图标集按 live area 20/24 出图（2 格留白的网格），
 * 而这套界面所有 size 值（37 个页面上百处 `<ui-icon size="…">`、tabBar 的 42rpx、
 * 按钮里的 21rpx…）都是照设计稿 17/24 的字形调出来的。
 * 直接换成图标集会让**每个图标凭空大一圈**（20/17 = +18%），间距与对齐要重调上百处。
 *
 * 所以统一乘 17/20 = 0.85 摆回设计稿的视觉尺寸——**一个常数，不是一张逐图标的表**。
 * FIT_T = 12(1-FIT) 保证缩放绕格心进行。
 */
const FIT = 0.85
const FIT_T = +(12 * (1 - FIT)).toFixed(3)

/**
 * 图标 SVG data-URI 的**唯一实现**：components/icon、custom-tab-bar、components/art 都调它。
 *
 * 此前两处各写一遍 svg 模板，默认描边一处 1.7 一处 1.8——同一个图标在 tabBar 里
 * 和在页面里不一样粗，而两边代码看起来都对。
 *
 * **没有光学归一层**：字形来自图标集，本身就同网格同重量（实测外接尺寸中位数 20/24、
 * 除天生窄的折角与加减号外全部 19~20，重心全部在格心）。手画那版需要一张
 * 逐图标的缩放/位移表才能对齐，那张表是手画的代价，不是这里的常态——
 * 若哪天又出现需要单独校正的图标，先问它是不是该换成图标集里的字形。
 *
 * @param name   图标名（支持 ALIASES）
 * @param opts   {color, stroke, fill}；color 传 token 名，stroke 默认 1.7（设计稿口径，
 *               比 lucide 默认的 2 细一档——暖色卡片上 2 会显得压手）
 * @returns      data:image/svg+xml,...（空字符串 = 没有这个图标）
 */
function svgUri(name, opts) {
  const o = opts || {}
  const key = PATHS[name] ? name : ALIASES[name]
  const paths = PATHS[key]
  if (!paths) return ''
  const hex = resolve(o.color || 'ink-600')
  const body = paths.split('{C}').join(hex)
  // 描边按 1/FIT 补偿：缩放会连带缩描边，1.7 / 0.85 = 2 缩回去正好还是 1.7
  // （2 也正是 lucide 的原生描边宽度，这不是巧合——0.85 就是两套 live area 的比）
  const stroke = +((o.stroke || 1.7) / FIT).toFixed(3)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${
      o.fill ? hex : 'none'
    }" ` +
    `stroke="${hex}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">` +
    `<g transform="translate(${FIT_T} ${FIT_T}) scale(${FIT})">${body}</g></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
