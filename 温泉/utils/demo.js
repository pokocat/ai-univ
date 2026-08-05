/**
 * 演示数据 · 单一改动点
 * ---------------------------------------------------------------------------
 * 路演时只改这个文件。设计稿 README §8「可调项」对应下面的 tweaks。
 * 换行业（美博会版 / 减肥博览会版）改 templates + skus + card，布局全部不动。
 */

const tweaks = {
  // 演示酒店名 —— 出现在首页问候区
  hotelName: '云栖温泉度假酒店',
  // 每条视频消耗积分
  clipCost: 12,
  // 游客自助出片开关：关掉后 04 屏隐藏该模块，用于对比讲解
  guestSelfServe: true,
  // 老板称呼
  ownerTitle: '陈总',
  // 积分余额
  points: 4820,
};

/** 五步主线的当前读数 —— 首页那条线 */
const mainline = {
  stuckAt: 3, // 卡在第几步（1–5）
  hint: '扫码的 1,864 人里只有 726 加了企微。缺一张汤池边的台卡。',
  steps: [
    { name: '诊断', value: '已出', state: 'done' },
    { name: '内容', value: '12 条', state: 'done' },
    { name: '拉新', value: '+386', state: 'stuck' },
    { name: '会员', value: '2,140', state: 'todo' },
    { name: '复购', value: '1.3 次', state: 'todo' },
  ],
};

/** 军师算出的「今天该做的一件事」 */
const todayAction = {
  title: '周中空房率涨到 62%，先把「亲子泡汤」这条内容铺出去',
  body: '同城家庭客搜索量周涨 34%，你的账号上周只发了 2 条。军师算的是：铺 8 条能补回 40 间夜。',
  cta: '一键开工 · 出 8 条',
  ctaAlt: '看诊断',
};

/** 02 诊断报告 */
const diagnosis = {
  regId: 'REG · DX-2026-0731',
  headline: '你的问题不在客流，\n在留不住人',
  score: 62,
  summary:
    '7 月到店 14,200 人次，同比只差 3%。但复购 1.3 次/年、私域承接率 39%——花钱买来的客人，玩完就走了。军师把它拆成三件能马上动手的事。',
  issues: [
    {
      no: '01',
      title: '周中空房率 62%',
      urgent: true,
      body:
        '周末满房、周一到周四空一半。同城亲子客搜「泡温泉」的量涨了 34%，但你的账号一周只出 2 条内容。',
      action: '动作：用「亲子泡汤」模板出 8 条，投同城',
      meta: '预计 96 积分 · 20 分钟出完',
      btn: '去出片',
      tone: 'purple',
      route: '/pages/studio/index',
      tab: 1,
    },
    {
      no: '02',
      title: '到店客人 61% 没进私域',
      body:
        '1,864 人扫了码，只有 726 加了企微。断点在汤池区——扫码的人拿不到值得留联系方式的东西。',
      action: '动作：汤池台卡换成「扫码抽卡出片」',
      meta: '开通即生成 12 张台卡二维码',
      btn: '去开通',
      tone: 'teal',
      route: '/pages/crowd/index',
      tab: 3,
    },
    {
      no: '03',
      title: '会员一年只来 1.3 次',
      body:
        '泡完汤没有第二次消费的理由。协会统一选品的面膜货柜 + 积分抵扣，是最省力的那根钩子。',
      action: '动作：配 10 台货柜 + 开积分抵扣',
      meta: '品牌方承担铺货 · 你只出场地',
      btn: '去配置',
      tone: 'purple',
      route: '/pages/member/index',
    },
  ],
};

/** 03 模板库 —— 按「解决什么经营问题」分类，不按技术能力分类 */
const templateTabs = ['周中拉客流', '亲子', '养生', '同城券'];

const dramaTemplate = {
  badge: '协会统一脚本',
  cover: '/assets/img/drama-cover.jpg',
  title: '《汤泉客栈》第一集 · 你店里的版本',
  body: '100 家温泉共用一套脚本，你只换人物和场地。观众追的是同一个故事，来的是你家。',
  used: '已被 47 家使用',
  dur: '60s',
  btn: '套用开拍',
};

const templates = [
  {
    id: 'family',
    cover: '/assets/img/tpl-family.jpg',
    title: '带娃泡汤一日游',
    note: '投同城 · 周中转化最好',
    dur: '15s',
  },
  {
    id: 'wellness',
    cover: '/assets/img/tpl-wellness.jpg',
    title: '中医师聊泡汤',
    note: '养生客群 · 涨粉最快',
    dur: '30s',
  },
];

const starTemplate = {
  thumb: '/assets/img/star-thumb.jpg',
  title: '明星背书模板',
  tag: '授权中',
  body: '协会已签 2 位艺人形象授权，7 月 20 日开放给会员酒店。',
};

/** 04 出片与分发 */
const produce = {
  templateName: '带娃泡汤一日游 · 15s',
  faces: [
    { label: '妈妈 正面', src: '/assets/img/face-mom.jpg' },
    { label: '孩子 正面', src: '/assets/img/face-kid.jpg' },
  ],
  faceHint: '脸型和光线自动对齐汤池场景的机位，不用你调。',
  done: 6,
  total: 8,
  clips: [
    '/assets/img/clip-a.jpg',
    '/assets/img/clip-b.jpg',
    '/assets/img/clip-c.jpg',
  ],
  pendingPct: 72,
  spend: '已耗 72 积分 · 余 4,820',
  channels: [
    { name: '酒店抖音号 · 云栖温泉', count: '8 条', tone: 'purple' },
    { name: '视频号 + 小红书', count: '8 条', tone: 'purple' },
    { name: '推进 4 个客户群', count: '机器人发', tone: 'teal' },
  ],
  // 「9.9 元一条」要加粗，所以拆三段
  selfServe: {
    title: '同时开给游客自助玩',
    pre: '游客扫台卡换脸，',
    bold: '9.9 元一条',
    post: '，上月挣了 1.8 万。',
    offTitle: '游客自助出片已关闭',
    offBody: '这一项本身产生收入，关掉后拉新只是纯成本',
  },
};

/** 05 数字资产库 */
const assets = {
  total: '142 项 · 12.4 GB',
  tabs: [
    { name: '形象', n: 8 },
    { name: '场景', n: 26 },
    { name: '产品', n: 41 },
    { name: '声音', n: 6 },
  ],
  persona: {
    reg: 'REG · DH-0041',
    name: '温老板（你本人）',
    avatar: '/assets/img/avatar-boss.jpg',
    status: '授权已生效',
    verified: '刷脸核验 · 5 月 12 日',
    eras: [
      { year: '2018 开业', src: '/assets/img/era-2018.jpg' },
      { year: '2022 改造', src: '/assets/img/era-2022.jpg' },
      { year: '2026 在用', src: '/assets/img/era-2026.jpg', active: true },
    ],
    note: '每个时期单独核验、单独授权，讲老故事就调老形象。',
  },
  scenes: [
    {
      thumb: '/assets/img/scene-pool-dusk.jpg',
      name: '露天汤池 · 黄昏',
      meta: 'SC-0142 · 机位 由下往上 · 池边石阶 3 级',
    },
    {
      thumb: '/assets/img/scene-washitsu.jpg',
      name: '和室汤屋 · 门 关',
      meta: 'SC-0143 · 机位 平视 · 与 0144（门开）成对',
    },
    {
      thumb: '/assets/img/scene-kids.jpg',
      name: '亲子戏水区 · 正午',
      meta: 'SC-0151 · 机位 俯拍 · 成人／儿童身高比已锁',
    },
  ],
  lend: {
    title: '这些资产也能借给协会',
    body: '别家用你的汤池场景拍片，按次分你钱',
  },
};

/** 06 扫码进私域 */
const crowd = {
  period: '7 月 1—31 日',
  funnel: [
    { name: '扫码（台卡 + 前台）', v: '1,864', pct: 100, tone: 'purple' },
    { name: '生成了自己的小视频', v: '1,102', pct: 59, tone: 'purple' },
    { name: '加了企微', v: '726', pct: 39, tone: 'amber' },
    { name: '进了客户群', v: '512', pct: 27, tone: 'purple' },
  ],
  funnelHint: '卡在「加企微」这一层。军师建议：生成的视频要加企微才能下载原片。',
  botLog: [
    { t: '09:00', s: '往「亲子泡汤群」发了今天新出的 3 条视频，17 人转发' },
    { t: '11:30', s: '回了 42 条「周中有没有优惠」，推了周中亲子套餐' },
    { t: '14:00', s: '给上周泡过汤没复购的 88 人发了面膜领取券' },
    { t: '17:20', s: '挑出 6 个问企业团建的人，标了「企业客户」交给你' },
  ],
  leadHint: '6 个企业客户线索等你跟',
  entries: [
    { name: '汤池台卡', v: '12', unit: '张 · 已铺', tone: 'purple', icon: 'ic-qr' },
    { name: '前台收银', v: '已通', unit: '买票即入群', tone: 'purple', icon: 'ic-scan' },
    { name: '美团订单', v: '待接', unit: '3 步开通', tone: 'amber', icon: 'ic-bag' },
  ],
};

/** 07 会员与权益 */
const member = {
  count: '2,140 人',
  card: {
    kicker: '云栖汤泉卡 · 年卡',
    price: '¥1,980',
    per: ' / 年',
    newCount: '386',
    newLabel: '本月新办',
    perks: [
      { icon: 'ic-crown', text: '泡汤 12 次，工作日不限时' },
      { icon: 'ic-gift', text: '货柜面膜每月免费领 2 片' },
      { icon: 'ic-team', text: '带朋友来，两人各得 200 积分' },
    ],
  },
  vending: {
    title: '无人货柜 · 10 台',
    tag: '品牌方铺货',
    stats: [
      { k: '今日领取', v: '86' },
      { k: '连带复购', v: '31%' },
      { k: '你的分成', v: '4.2', unit: '万', green: true },
    ],
    note: '你只出场地和会员，货和补货都是品牌方的事。',
  },
  skus: {
    title: '协会统一选品',
    meta: '100 家共采',
    items: [
      {
        img: '/assets/img/sku-mask.jpg',
        name: '泡后修护面膜',
        note: '进价 ¥4.2 · 会员免费领 · 品牌赞助',
        state: '已上',
        on: true,
      },
      {
        img: '/assets/img/sku-bath.jpg',
        name: '温泉沐浴礼盒',
        note: '你的品牌贴牌 · 积分可抵 50%',
        state: '已上',
        on: true,
      },
      {
        img: '/assets/img/sku-supp.jpg',
        name: '海外营养补充剂',
        note: '高端客定制 · 8 月开放',
        state: '待开',
        on: false,
      },
    ],
  },
};

/** 08 经营账 */
const ledger = {
  month: '7 月经营账',
  vs: '对比 6 月',
  total: '227.6',
  totalUnit: ' 万',
  delta: '+19.4%',
  // flex 权重 = 各来源占比，用于那条堆叠色条
  sources: [
    { name: '客房与门票', v: '132.0 万', flex: 58, color: '#7A5C9B' },
    { name: '会员卡与续卡', v: '43.2 万', flex: 19, color: '#9A80B8' },
    { name: '商城与货柜复购', v: '27.4 万', flex: 12, color: '#3E96A3' },
    { name: '企业团建（军师带来）', v: '16.2 万', flex: 7, color: '#6FB4BD' },
    { name: '游客出片 9.9 元／条', v: '8.8 万', flex: 4, color: '#C08320' },
  ],
  kpis: [
    { k: '会员年复购', v: '1.9', unit: '次', was: '3 月还是 1.3' },
    { k: '周中出租率', v: '61', unit: '%', was: '诊断前 38%' },
  ],
  combo: {
    kicker: '你这个月的组合拳',
    steps: [
      '军师指出周中空房，出了 96 条内容投同城',
      '1,864 人扫码玩换脸，726 人留在你的企微里',
      '机器人在 4 个群里日常盯着，挑出 6 个企业客户',
      '386 张年卡 + 10 台货柜，把人留到第二次消费',
    ],
    foot: '同一套打法，协会里 100 家店换一下人物和场地就能跑。',
  },
  next: {
    title: '下个月军师给的目标',
    body: '把企业团建做到 30 万 · 需要 12 条案例视频',
    btn: '接单',
  },
};

/** 首页两个数字卡 */
const homeStats = [
  { k: '本月新增客资', v: '386', foot: '↑ 环比 +41%', green: true },
  { k: '会员消费额', v: '86.4', unit: ' 万', foot: '占总营收 38%' },
];

/** 首页「常用」四宫格 */
const shortcuts = [
  { icon: 'ic-magic', bg: 'lilac', name: 'AI 出片', route: '/pages/studio/index', tab: 1 },
  { icon: 'ic-compass', bg: 'teal', name: '军师问策', route: '/pages/diagnosis/index' },
  { icon: 'ic-robot', bg: 'lilac', name: '群机器人', route: '/pages/crowd/index', tab: 3 },
  { icon: 'ic-fridge', bg: 'teal', name: '无人货柜', route: '/pages/member/index' },
];

module.exports = {
  tweaks,
  mainline,
  todayAction,
  diagnosis,
  templateTabs,
  dramaTemplate,
  templates,
  starTemplate,
  produce,
  assets,
  crowd,
  member,
  ledger,
  homeStats,
  shortcuts,
};
