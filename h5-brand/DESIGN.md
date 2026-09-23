---
name: 品牌 H5 演示套件（首个品牌：丽人公社（暂定）· 美博会特刊）
description: 白标会员社群 H5：一只被拆开的高端护肤包装盒，零网络静态包，演示数据一律盖印
colors:
  carton: "#111A2C"
  carton-ground: "#081123"
  carton-raised: "#18233A"
  carton-deep: "#0B111E"
  on-carton: "#CDD1D8"
  on-carton-dim: "#8E97A6"
  foil: "#CDD1D8"
  foil-on-panel: "#A9B0BB"
  panel: "#F4F2ED"
  panel-object: "#FBFAF7"
  panel-alt: "#E9E6DF"
  ink: "#111A2C"
  ink-soft: "#3C4658"
  ink-mute: "#5A6475"
  rule: "rgba(17, 26, 44, 0.16)"
  action: "#B8283F"
  on-action: "#FBF5F1"
  action-ink: "#A3223A"
  ok: "#2F6A45"
  warn: "#8A5A12"
  glass-dark: "rgba(11, 17, 30, 0.58)"
  glass-panel: "rgba(244, 242, 237, 0.80)"
  qr-ground: "#FFFFFF"
  stage: "#070B14"
typography:
  wordmark:
    fontFamily: "'Brand Display SC', 'Archivo Brand', PingFang SC, sans-serif"
    fontSize: "clamp(34px, 10.6vw, 46px)"
    fontWeight: 200
    lineHeight: 1.1
    letterSpacing: "0.42em"
  display:
    fontFamily: "'Brand Display SC', 'Archivo Brand', PingFang SC, sans-serif"
    fontSize: "28px"
    fontWeight: 200
    lineHeight: "36px"
    letterSpacing: "0.16em"
  title:
    fontFamily: "PingFang SC, HarmonyOS Sans SC, MiSans, Noto Sans CJK SC, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: "30px"
  lead:
    fontFamily: "PingFang SC, HarmonyOS Sans SC, MiSans, Noto Sans CJK SC, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "28px"
  body:
    fontFamily: "'Archivo Brand', PingFang SC, HarmonyOS Sans SC, MiSans, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "26px"
  meta:
    fontFamily: "'Archivo Brand', PingFang SC, HarmonyOS Sans SC, MiSans, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "20px"
  label-caps:
    fontFamily: "'Archivo Brand', sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
    letterSpacing: "0.16em"
    fontVariation: "'wdth' 125"
  numeral:
    fontFamily: "'Archivo Brand', sans-serif"
    fontFeature: "'tnum' 1, 'lnum' 1"
    fontVariation: "'wdth' 112"
rounded:
  carton: "0px"
  tag: "2px"
  sheet: "16px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "24px"
  s6: "32px"
  s7: "48px"
  s8: "64px"
  s9: "96px"
  gutter: "20px"
components:
  button-action:
    backgroundColor: "{colors.action}"
    textColor: "{colors.on-action}"
    typography: "{typography.body}"
    rounded: "{rounded.tag}"
    padding: "0 24px"
    height: "48px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.tag}"
    padding: "0 24px"
    height: "48px"
  button-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.carton}"
    height: "56px"
  inci-row:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "12px 0"
    height: "56px"
  stamp-sample:
    textColor: "{colors.ink-mute}"
    rounded: "{rounded.tag}"
    size: "18px"
  tabbar-item:
    backgroundColor: "{colors.carton-deep}"
    textColor: "{colors.on-carton-dim}"
    height: "56px"
  tabbar-item-active:
    textColor: "{colors.foil}"
  handoff-sheet:
    backgroundColor: "{colors.glass-panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "12px 20px 24px"
  qr-plate:
    backgroundColor: "{colors.qr-ground}"
    rounded: "{rounded.tag}"
    padding: "12px"
    size: "200px"
---

# Design System: 品牌 H5 演示套件

> 适用范围：仅 `h5-brand`。仓库根目录的 `DESIGN.md` 属于会员小程序（暖色世界），两套互不继承。
> 令牌的唯一事实源是 `brands/<id>/h5.json`，由 `scripts/brand.mjs` 在构建期编译成 `--c-* / --fs-* / --lh-* / --tr-* / --s* / --r-* / --m-* / --dur-* / --ease-*`；本文件的 frontmatter 记录的是首个品牌 liren 的取值。

## Overview

**Creative North Star: "拆开的护肤盒"**

会员资格被做成一只高端护肤包装盒：正面是本期（字标、开窗、盒舌），侧板是成分表「本期所含」，背面是使用方法（怎么加入），附赠小样是展会特辑，盒底是版权与运营主体。页面从上往下滚，就是把盒子一面一面翻过来看。每一面之间都有一道刀版折线，折线和裁切角标就是网格本身，不是装饰。

大面积是近黑的黛蓝盒面，信息密集处换成珠光白侧板；铂色烫印细线负责一切结构。胭脂红是唯一的饱和色，每个视口只点一处当下最重要的动作。状态不弹 toast，而是印上去的正式印记（样、样张、拟定、示意、已存到本机）。数字一律等宽制表列对齐。

它刻意拒绝两种邻近的样子：美业 SaaS 的粉色渐变卡片流，和奶油纸编辑部刊物。

**Key Characteristics:**
- 黛蓝盒面 + 珠光白侧板两种表面，所有子组件经 `--line / --text / --text-dim / --stamp` 语境变量自动换色。
- 直角刀版：盒面与面板 0 圆角，只有标签 2px、弹层 16px。
- 成分表面板单一字号，层级只靠字重、大小写与反白。
- 演示事实全部盖印：每条路由右上角「样张」，每个样例数字旁「样」，未定信息「拟定」，生成图「示意」。
- 零第三方网络：字体、材质、照片全部自托管入包。

### 共享骨架与品牌层

| 层 | 位置 | 第二个品牌是否改动 |
| --- | --- | --- |
| 品牌身份 | `brands/<id>/brand.json`（名称、暂定注、拉丁名、期号与批号、底栏文案、下转文案、演示横幅） | 必改 |
| 品牌令牌 | `brands/<id>/h5.json` 的 `tokens`（颜色 23 个必备角色 + 字体栈 + 字阶 + 字距 + 间距 + 圆角 + 材质 + 动效）、`themeColor`、`facts`（每条带 status 与 source）、`modules`（底栏与首页模块顺序）、`images`（alt / credit / license） | 必改 |
| 内容包 | `brands/<id>/content/preview.json`（与 `GET /mp/preview` 严格同形）+ `extras.json`（每条带 status 或 sample） | 必改 |
| 签名时刻 | `src/moments/`（小样撕条 + .ics、镭射防伪标）：交互与材质机制共享，文案与日程取自品牌内容包 | 通常只改内容；换时刻需另走方向评审 |
| 展示字体子集 | `src/fonts/display-<id>-{200,400}.woff2` + `display-<id>.json` 清单 | 必须重裁 |
| 共享骨架 | `src/styles/`（基础、世界材质）、`src/ui/`（刀版、面板、成分表、印记、事实、按钮、下转弹层、空态）、`src/app/`（430 机身列、底栏、返回栏）、`src/screens/` 七屏、`test/` 守卫 | 不改 |

**新增第二个品牌的步骤（按代码现状）：**
1. 复制 `brands/liren/` 为 `brands/<新id>/`（id 须匹配 `^[a-z][a-z0-9-]*$` 且与 `brand.json.id` 一致），改身份、令牌、事实与内容包；`qr-ground` 必须保持 `#FFFFFF`，否则构建失败。
2. 改 `carton` / `foil` / `grain` 任一值时，同步重算 `carton-ground`（颗粒会把底色整体提亮，底 + 颗粒的平均值要落回 `carton`），并截图取样复核。
3. 把 `src/styles/fonts.css` 里写死的 liren 子集两条 `@font-face` 挪进 `scripts/brand.mjs` 按 BRAND 生成（代码注释已声明这是第二品牌上线前的前置），然后 `node scripts/subset-display.mjs` 裁出新子集；`test/fonts.test.mjs` 会拦下漏跑。
4. 照片目前在共享的 `src/assets/photo/`（`window` / `hall`），需要按品牌分目录或替换；生成图必须 `license: generated-preview` 且图注含「示意」。
5. `BRAND=<新id> npm run build && npm test`：零外链、禁词、源品牌名泄漏、七条路由都有「样张」、字体 ≤120KB 全部通过才算完成。

## Colors

一片沉静的近黑蓝底，一种铂色画结构，一滴胭脂标出此刻该做的事。

### Primary
- **黛蓝盒面**（carton）：盒正面、背面、盒底、会员证页与方案柜台的大面积底色，也是 `themeColor`。
- **压暗盒底**（carton-ground）：只铺在带颗粒的盒面下面，抵消白噪点的提亮。它不是可见颜色，是 carton 的校正值。
- **盒面抬起**（carton-raised）：开窗内底、插舌刀版填充、图片未落地时的占位底。
- **盒面沉底**（carton-deep）：底栏与滚动条轨道。

### Secondary
- **铂色烫印**（foil）：盒面上的一切结构——折线、角标、字标、选中底栏、使用方法的大号序号、焦点框。
- **侧板铂线**（foil-on-panel）：珠光白面板上的弱细线（`--line-soft`）。

### Tertiary
- **胭脂**（action）：唯一的饱和色，只给当下最重要的那一个动作；**胭脂墨**（action-ink）是它在浅底上当文字用的一档；**胭脂面上的字**（on-action）。

### Neutral
- **珠光白侧板**（panel）：成分表、规格说明、权益、展会信息等密集信息面；**卡面白**（panel-object）：会员证这类实物；**侧板次底**（panel-alt）。
- **墨**（ink）：侧板上的正文与强线；**次墨**（ink-soft）、**弱墨**（ink-mute）：说明文字与印记色；**墨线**（rule）。
- **盒面字**（on-carton）与 **盒面弱字**（on-carton-dim）：盒面上的正文与说明。
- **磨砂玻璃**：弹层遮罩（glass-dark，也用于返回栏）与弹层面板（glass-panel）。
- **二维码白**（qr-ground）：二维码底，恒为纯白。**展台**（stage）：桌面宽屏时 430 机身列四周的更深底。
- **状态**：ok 只用于「已存到本机」印记；warn 为保留角色。

### Named Rules
**The 一滴胭脂 Rule.** 胭脂实底每个视口只许一处，且必须是当下最重要的动作（首屏盒舌「查看本期所含」、小样「存到本机日历」、盒底「去看方案」、方案页与入群说明的下转开通）。长页面上各处胭脂之间至少隔一个视口；其余按钮一律幽灵线框、下划线或整行。小样存好后胭脂退为幽灵。
**The 两面换色 Rule.** 子组件不直接取 `--c-ink` 或 `--c-on-carton`，而是取语境变量 `--line / --line-soft / --text / --text-dim / --stamp`，由所在表面（盒面 / 侧板 / 弹层 / 会员证）赋值。同一枚印记放在哪一面都对。
**The 颗粒校正 Rule.** 颗粒是构建期生成的 SVG 噪点，强度写在 alpha 里；带颗粒的盒面铺 carton-ground 而不是 carton。子元素要自带颗粒时先铺 carton-ground 盖住父级，两层颗粒不叠加。

## Typography

**Display Font:** Brand Display SC（Noto Sans SC 按品牌裁出的子集，仅 200 / 400 两档，自托管）→ Archivo Brand → 系统中文栈
**Body Font:** Archivo Brand（拉丁与数字，OFL，wdth 100–125、wght 200–700 可变轴）→ PingFang SC / HarmonyOS Sans SC / MiSans / Noto Sans CJK SC
**Label Font:** Archivo Brand 宽体（wdth 125）大写

**Character:** 超细宽字距的铂色展示字，像烫印在盒面的字标；正文是系统中文加宽体拉丁，像包装侧板的印刷说明。

### Hierarchy
- **Wordmark**（200，随视口 34–46px，字距 0.42em）：只用于盒正面字标与盒底收尾，末字字距用负外边距抵消以视觉居中。首屏预加载 200 档字体。
- **Display**（200，28px / 36px）：方案柜台标题、使用方法序号、盒底收尾句（用 title 字号）。
- **Title**（600，22px / 30px）：面板栏目名、弹层标题，系统中文。
- **Lead**（600，18px / 28px）：使用方法步骤名。
- **Body**（400 / 600，16px / 26px）：正文与成分表整块。
- **Meta**（400，13px / 20px）：免责条、图注外的说明、盒底版权。
- **Micro**（12px / 16px）：批号、图注、底栏文字、印记。
- **Label Caps**（500，12px，字距 0.16em，大写）：与中文栏目名同行、右对齐的拉丁注记（Ingredients / Directions / Specifications），以及成分表条目代码。

### Named Rules
**The 成分表单字号 Rule.** 成分表、事实表、课程排期整块 16px，层级只靠字重（600 / 400）、拉丁大写与字距、墨底反白标签，不加第二个字号。
**The 等宽制表 Rule.** 机器产生的数字（计数、日期、价格、编号）一律 Archivo 制表数字（tnum + lnum，wdth 112），上下列对齐。
**The 两档展示字 Rule.** 展示字体只有 200 与 400；写 600 以上会被浏览器伪粗，展示位不许这么写。改动字标、页面标题、课程标题后必须重跑子集脚本。
**The 拉丁字距 Rule.** 宽字距大写只给拉丁串；中文正文不加字距（字标与展示标题的宽字距是烫印字标的有意例外）。

## Layout

单列手机机身：内容列最大 430px 居中，521px 以上四周换成展台色并加一圈极淡描边与长投影。左右留白 `gutter` 20px，窄于 375px 时收到 16px。间距取 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 九档；面板上下内边距 48 / 64，栏目头与内容之间 24 + 6（双线让位）。

首屏盒正面占 62svh（夹在 440–680px 之间），自上而下：批号与样张章、拱形开窗（宽度 min(58%, 232px)）、字标、受众一行、折线、盒舌。折线下露出侧板开头。

触控目标：成分表行与整行按钮 56px，按钮 48px，图标按钮 44px。底栏 56px + 安全区，根页面内容区为它让位；非微信环境才出现 48px 粘性返回栏。

**The 刀版网格 Rule.** 面与面之间用折线（6px 实 + 4px 空的虚线）分开，折线两端的竖刻标落在 gutter 上；角标（12px，外偏 6–10px）框住首屏盒面与会员证。对齐都以它们为准。
**The 背面编号 Rule.** 只有真有顺序的地方编号：使用方法四步用超细铂色大号数字；成分表、权益、事实不编号。

## Elevation & Depth

以平印与材质为主，不靠卡片投影分层。深度来自三件事：盒面上的一盏柔光（径向渐变打在开窗 / 柜台上方，其余沉下去）、铂色细线的压痕、以及少数几件「实物」各自的投影。

### Shadow Vocabulary
- **胭脂烫印压痕**（`inset 0 0 0 1px rgba(251,245,241,.28), 0 0 0 1px var(--c-foil), 0 10px 22px -14px rgba(11,17,30,.9)`）：胭脂主按钮，一圈铂边像烫印压痕。
- **弹层上沿**（`0 -1px 0 rgba(255,255,255,.6) inset, 0 -18px 40px -24px rgba(7,11,20,.7)`）：下转小程序磨砂弹层。
- **实物投影**：小样小袋（双层 drop-shadow，落在珠光面板上）、会员证（铂色细描边 + 18px 柔投影）、二维码白底（`0 14px 28px -20px`）。
- **开窗内陷**（`inset 0 10px 18px -8px rgba(7,11,20,.85)`）：首屏开窗像刀版挖空后的内壁。

**The 平印优先 Rule.** 盒面、侧板、成分表、按钮组都是平的；只有被当作独立实物的东西（小袋、卡、二维码底、弹层）才有投影。胭脂盒舌标签是模切平印，不做凸起、斜面或投影。
**The 磨砂只给弹层 Rule.** backdrop blur（18px）只用于下转弹层与返回栏。

## Shapes

直角是默认：盒面、面板、整行按钮、焦点框全部 0 圆角（焦点框 2px 实线，跟随元素原本轮廓，不另加圆角）。标签、印记小方印、按钮、二维码底 2px；只有底部弹层 16px 上圆角。

签名形状都来自包装刀版：首屏拱形开窗（顶端全圆、底角 3px，外圈 6px 铂色压痕线）、盒舌插舌刀版（两肩锁位斜口 + 插舌折线 + 底边大圆弧，SVG 不缩放线宽）、胭脂标签（四角切斜 + 两端 V 口 + 上下两道印刷细线，形状画在伪元素上以免裁掉焦点框）、底栏选中态顶边的梯形插舌、小样顶边 10px 一齿的压齿封口、会员证离边 5px 的虚线模切压痕。

**The 双线栏目 Rule.** 面板栏目头下方是 2px 粗线 + 间隔 + 1 发丝细线的双线；发丝在 2x 屏上为 0.5px。

## Components

### Buttons
- **Shape:** 2px 标签角；整行按钮直角。
- **胭脂主按钮：** 胭脂实底、胭脂面上的字、600 字重、字距 0.06em、48px 高、左右 24px，带烫印压痕投影。一个视口一处。
- **幽灵按钮：** 透明底、1px 语境线框、语境字色。
- **安静按钮：** 透明底、下划线（1px，偏移 4px）、500 字重。
- **整行按钮：** 满宽、上下发丝线、两端对齐、56px 高，用于「下转」类整行入口。
- **按下：** 亮度降到 0.94，140ms 指数缓出；不做位移弹跳。

### 成分表（签名组件）
- 整块 16px；每行最小 56px，名称 600 + 同字号拉丁大写代码 + 弱色说明换行；计数等宽右对齐，样例数字后接「样」印；右端弱色箭头。
- 按下时铺 5% 墨色（盒面上 8% 铂色）。
- 反白标签：语境字色实底、面板色字、2px 角，字号不变。
- 每一行都必须能追到对应的一块（页内锚点或站内路由）。

### 印记（签名组件）
- **样**：18px 小方印，2px 角，发丝框。
- **样张**：双线框（border + 2px 外偏 outline），字距 0.2em；每条路由右上角一枚。
- **拟定**：虚线单框。**示意**：发丝框小印，用于生成图图注。**已存到本机**：ok 绿框。
- 全部 12px、600、取 `--stamp`，屏幕阅读器读全称。

### 事实表
- 两栏网格（标签 4em + 值），值 600 等宽数字；拟定事实下方强制附免责条（meta 字号）。

### Navigation
- **底栏：** 沉底盒面 + 颗粒，顶部 40% 铂色发丝；四格之间是竖向刀版虚线；标签 12px、字距 0.08em；未选盒面弱字，选中铂色 + 600 + 顶边梯形插舌（360ms 展开）。只出现在四个根页面。
- **返回栏：** 仅非微信环境；磨砂深玻璃、三栏网格（88 / 1fr / 88）、标题居中省略。

### 下转小程序弹层
- 自底部滑入（420ms 指数缓出，收起 240ms 缓入），深玻璃遮罩，珠光玻璃面板 + 18px 模糊，16px 上圆角，36×4 拖柄。
- 二维码 200px，纯白底 12px 留白、不压任何纹理，图注带「样张」印；明写本页不收集信息。

### 签名时刻
- **附赠小样：** 铂银复合膜小袋（位图材质），顶部 28 节拉条沿齿孔跟手撕开；拖过 55% 撕到底，不到则指数缓出回位、无回弹；撕开后日程插页抽出，可生成本机 .ics（CRLF、75 字节折行、标注「拟定」、状态暂定）。
- **镭射防伪标：** 镭射位图按 320% 铺开，指针位置写入 `--hx / --hy` 改变露出的角度；上覆 22% 珠光白保证墨字可读；缩微字两行错位压在膜里。
- **开盒仪式：** 仅本会话首次且未要求减少动态：折线描出、角标淡入、开窗照片从 1.06 虚焦落定、字标铂箔过光一次、盒舌标签压入。
- 材质位图未落地时一律退回平印铂色（sachet-foil），不用 CSS 彩虹或条纹仿材质。

### 空态与读取失败
- 上下发丝线夹住的一段：600 标题 + 弱色下一步提示 + 可选动作；读取失败给重试按钮（40px）。

## Do's and Don'ts

### Do:
- **Do** 所有颜色、字阶、间距、圆角、材质、动效都取 `brands/<id>/h5.json` 编译出的变量；新值先进 h5.json，再在 `REQUIRED_COLORS` 里登记必备角色。
- **Do** 每条路由印「样张」，每个样例数字接「样」，未定事实标「拟定」并附来源，生成图图注写「示意 · 生成图像，非实拍」。
- **Do** 组件取 `--line / --text / --text-dim / --stamp` 语境变量，让同一组件在盒面与侧板上都成立。
- **Do** 机器产生的数字用等宽制表数字；成分表整块单一字号。
- **Do** 字体、照片、材质全部自托管入包，字体合计 ≤120KB（中文展示子集 ≤90KB），OFL 许可证随字体同目录发布。
- **Do** 状态用印记表达（已存到本机、拟定），不用 toast。
- **Do** 在 `prefers-reduced-motion` 下把动效压到 1ms，弹层改为淡入。

### Don't:
- **Don't** 在同一个视口里放第二处胭脂实底。
- **Don't** 引任何第三方域名（字体 CDN、脚本 CDN）；产物里除许可证外不许出现 http(s)://。
- **Don't** 出现 AI / 人工智能 / 智能匹配 / 军师 / 智能体字样，或源品牌名（主理人 / 主理人公社 / 公社小助手）。
- **Don't** 编读数：阅读数、报名人数等游客态读数一律不展示；体重管理内容不写功效、不放前后对比与体重数据。
- **Don't** 给二维码底换色或压纹理；`qr-ground` 恒为纯白。
- **Don't** 用 CSS 渐变去仿镭射、复合膜或压纹材质。
- **Don't** 给盒面、面板、整行按钮加圆角，或给平印的盒舌标签加凸起与投影。
- **Don't** 禁止视口缩放（viewport 不写 maximum-scale 或 user-scalable=no）。
- **Don't** 用字符或表情顶替图标；图标是 24 格、1.5 描边、圆头的线性 SVG。
