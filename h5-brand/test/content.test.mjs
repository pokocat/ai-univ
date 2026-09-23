// 内容包守卫：node --test，零 npm 依赖。
//
// 校验逻辑只有一份，在 src/content/schema.ts；这里直接 import 那个 .ts 文件。
// 能这么做是因为 schema.ts 只用可擦除的 TypeScript 语法，node ≥ 22.18 原生擦除类型即可运行，
// 不需要编译产物，也不需要维护一份镜像的 .mjs 校验器（两份迟早分叉，而分叉不报错）。
//
// 覆盖 brands/*/content/ 下每一个有 preview.json 的品牌。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let S;
try {
  S = await import('../src/content/schema.ts');
} catch (err) {
  throw new Error(
    `无法直接加载 src/content/schema.ts：需要 Node ≥ 22.18（原生擦除 TypeScript 类型），当前 ${process.version}。\n${err.message}`,
  );
}

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const clone = (x) => structuredClone(x);

// ───────────── 禁词表（扫描两个内容文件里的全部字符串值，含 devNote） ─────────────

// 系统没有任何生成能力，界面不得出现相关字样
const AI_WORDING = [/(?<![A-Za-z])AI(?![A-Za-z])/i, /人工智能/, /智能/, /军师/, /深度合成/, /大模型/, /GPT/i];

// 体重管理：不写功效、不出现身体指标与前后对比。「减肥」只允许出现在官方大会名里
const EFFICACY = [
  '减重', '减脂', '瘦', '掉秤', '斤', '公斤', 'BMI', '体脂', '腰围', '臀围', '体重数据', '体重秤',
  '前后对比', '对比照', '见效', '燃脂', '排毒', '根治', '疗效', '治愈', '治疗', '保证', '卡路里',
  '热量缺口', '目标体重', '代谢', /(?<![A-Za-z])kg(?![A-Za-z])/i,
];

// 不夸大、不催促
const HYPE = [
  '最好', '最强', '最佳', '最全', '第一', '顶级', '爆款', '爆单', '引爆', '躺赚', '暴利', '月入', '翻倍',
  '限时', '仅剩', '名额有限', '抢购', '秒杀', '错过再等', '赋能', '颠覆', '稳赚', '零风险', '神器',
];

// 精确的伪统计：百分比、倍数、人数 / 门店数
const FAKE_STATS = [
  /\d+(\.\d+)?\s*%/,
  /\d+(\.\d+)?\s*倍/,
  /\d[\d,]*\s*\+?\s*[万千]?\s*(人|位|名|家)/,
];

// 可撕日程只能写「已存到本机」，不暗示报名、席位或支付
const COMMITMENT = ['已报名', '报名成功', '席位', '名额', '剩余', '预约成功', '立即支付', '立即购买', '马上抢'];

// 个人信息
const PERSONAL = [
  /(?<!\d)1[3-9]\d{9}(?!\d)/,
  /[\w.+-]+@[\w-]+\.[A-Za-z]{2,}/,
  /(?<!\d)\d{17}[\dXx](?!\d)/,
  /(?<!\d)0\d{2,3}-?\d{7,8}(?!\d)/,
];

// 开发口径不进内容
const DEV_JARGON = ['护栏', '驳回', 'mock', 'fixture', 'TODO', 'FIXME', 'lorem', /(?<![A-Za-z])V\d{1,3}(?![\d.])/];

// 真实第三方品牌（微信 / 企业微信 / 小程序是交付渠道本身，允许）
const THIRD_PARTY = [
  '美团', '大众点评', '抖音', '快手', '小红书', '淘宝', '天猫', '京东', '拼多多', '支付宝',
  '搜瘦', 'CIBE', '联合美业', '佳美', '腾讯会议', '飞书', '钉钉',
];

// 源品牌与平台名不得泄漏进别家品牌的内容
const SOURCE_BRAND = ['主理人', '公社', '蜂乐玛'];

const RULES = [
  ['无生成能力字样', AI_WORDING],
  ['功效或身体指标', EFFICACY],
  ['夸大或催促', HYPE],
  ['伪统计', FAKE_STATS],
  ['报名或支付暗示', COMMITMENT],
  ['个人信息', PERSONAL],
  ['开发口径', DEV_JARGON],
  ['第三方品牌', THIRD_PARTY],
  ['源品牌名', SOURCE_BRAND],
];

function hit(textValue, term) {
  return typeof term === 'string' ? textValue.includes(term) : term.test(textValue);
}

/** 返回 [{rule, term, text}]；「减肥」只在官方大会名里放行 */
function scanText(textValue, extraTerms = []) {
  const found = [];
  const t = textValue.split('减肥产业大会').join('');
  for (const [rule, terms] of RULES) for (const term of terms) if (hit(t, term)) found.push({ rule, term: String(term) });
  if (t.includes('减肥')) found.push({ rule: '功效或身体指标', term: '减肥' });
  for (const term of extraTerms) if (hit(t, term)) found.push({ rule: '品牌名只经品牌包出现', term: String(term) });
  return found;
}

/** 遍历全部叶子：path 为规范化路径（数组记 []），at 为带下标的定位 */
function* leaves(v, path = '', at = '') {
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) yield* leaves(v[i], `${path}[]`, `${at}[${i}]`);
  } else if (v !== null && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) yield* leaves(x, path ? `${path}.${k}` : k, at ? `${at}.${k}` : k);
  } else {
    yield { path, at, value: v };
  }
}

const ISO_LIKE = /^\d{4}-\d{2}-\d{2}T/;

// ───────────── 按品牌跑 ─────────────

const brandsDir = resolve(ROOT, 'brands');
const brandIds = existsSync(brandsDir)
  ? readdirSync(brandsDir).filter((id) => existsSync(resolve(brandsDir, id, 'content', 'preview.json')))
  : [];

test('至少有一个品牌带内容包', () => {
  assert.ok(brandIds.length > 0, 'brands/*/content/preview.json 一个都没有');
});

for (const id of brandIds) {
  const dir = resolve(brandsDir, id);
  const preview = readJson(resolve(dir, 'content', 'preview.json'));
  const extrasPath = resolve(dir, 'content', 'extras.json');
  const extras = existsSync(extrasPath) ? readJson(extrasPath) : null;
  const h5 = existsSync(resolve(dir, 'h5.json')) ? readJson(resolve(dir, 'h5.json')) : null;
  const identity = existsSync(resolve(dir, 'brand.json')) ? readJson(resolve(dir, 'brand.json')) : null;
  const facts = Array.isArray(h5?.facts) ? h5.facts : undefined;

  test(`[${id}] preview.json 与 GET /mp/preview 严格同形`, () => {
    assert.deepEqual(S.checkPreview(preview), []);
  });

  test(`[${id}] extras.json 存在`, () => {
    assert.ok(extras, `${extrasPath} 不存在`);
  });

  test(`[${id}] preview.json 符合服务端在 asOf 时刻的排序与派生规则`, () => {
    assert.deepEqual(S.checkPreviewInvariants(preview, extras.meta.asOf), []);
  });

  test(`[${id}] extras.json 形状正确，且与 preview / h5.json 对得上`, () => {
    assert.deepEqual(S.checkExtras(extras, preview, facts), []);
  });

  test(`[${id}] h5.json 的展会事实形状正确，且与 extras 的展期一致`, (t) => {
    if (!facts) return t.skip('h5.json 没有 facts');
    assert.deepEqual(S.checkExpoFacts(facts), []);
    const dates = facts.find((f) => f.key === 'expo.dates');
    if (!dates) return t.skip('h5.json 没有 expo.dates');
    const md = (d) => d.slice(5).replace('-', '.');
    const { from, to } = extras.expo.window;
    assert.ok(dates.value.includes(md(from)) && dates.value.includes(md(to)), `展期事实「${dates.value}」与 extras.expo.window ${from}～${to} 不一致`);
    assert.equal(dates.status, extras.expo.status, 'expo.dates 的状态与 extras.expo.status 不一致');
  });

  test(`[${id}] extras 的每个条目都带 status 或 sample 标记`, () => {
    const ok = (o) => typeof o.sample === 'boolean' || S.FACT_STATUSES.includes(o.status);
    const bad = [];
    for (const [k, v] of Object.entries(extras)) {
      if (v && typeof v === 'object' && !Array.isArray(v) && !ok(v)) bad.push(`extras.${k}`);
    }
    const walk = (v, p) => {
      if (Array.isArray(v)) {
        v.forEach((x, i) => {
          if (x && typeof x === 'object' && !Array.isArray(x) && !ok(x)) bad.push(`${p}[${i}]`);
          walk(x, `${p}[${i}]`);
        });
      } else if (v && typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) walk(x, `${p}.${k}`);
      }
    };
    walk(extras, 'extras');
    assert.deepEqual(bad, [], '这些条目既没有 status 也没有 sample');
  });

  test(`[${id}] preview 的每个数字与时间都登记了演示期处理方式`, () => {
    const marks = new Map(extras.apiFields.map((f) => [f.path, f]));
    const unmarked = new Set();
    const leaked = [];
    for (const { path, at, value } of leaves(preview)) {
      const isNum = typeof value === 'number';
      const isTime = typeof value === 'string' && ISO_LIKE.test(value);
      if ((isNum || isTime) && !marks.has(path)) unmarked.add(path);
      if (marks.get(path)?.treatment === 'hide' && value !== 0 && value !== null) leaked.push(`${at} = ${value}`);
    }
    assert.deepEqual([...unmarked], [], '这些字段是数字或时间，却没有在 extras.apiFields 里说明怎么处理');
    assert.deepEqual(leaked, [], '标为 hide 的读数只能是 0 或 null——万一被误渲染也不能是一个编出来的数');
  });

  test(`[${id}] 内容文字不含禁词`, () => {
    const brandTerms = identity ? [identity.name, identity.nameLatin, identity.name?.slice(0, 2)].filter(Boolean) : [];
    const problems = [];
    for (const [file, data] of [['preview.json', preview], ['extras.json', extras]]) {
      for (const { at, value } of leaves(data)) {
        if (typeof value !== 'string') continue;
        for (const f of scanText(value, brandTerms)) problems.push(`${file} ${at}: ${f.rule}「${f.term}」← ${value}`);
      }
    }
    assert.deepEqual(problems, []);
  });
}

// ───────────── 守卫自身：确认它们会拒绝错误数据，而不是永远为真 ─────────────

test('禁词扫描能抓到典型违规', () => {
  const cases = [
    ['AI 诊断报告', '无生成能力字样'],
    ['智能匹配服务老师', '无生成能力字样'],
    ['一个月轻松掉秤', '功效或身体指标'],
    ['专业减肥门店', '功效或身体指标'],
    ['全网最好的课程', '夸大或催促'],
    ['92% 的会员续费', '伪统计'],
    ['已有 1200 位店主加入', '伪统计'],
    ['已报名，席位保留', '报名或支付暗示'],
    ['联系 13812345678', '个人信息'],
    ['按护栏 55 处理', '开发口径'],
    ['同步到小红书', '第三方品牌'],
    ['主理人公社官方', '源品牌名'],
  ];
  for (const [textValue, rule] of cases) {
    assert.ok(scanText(textValue).some((f) => f.rule === rule), `「${textValue}」应命中「${rule}」`);
  }
  assert.deepEqual(scanText('2026减肥产业大会（拟定）'), [], '官方大会名应放行');
  assert.deepEqual(scanText('Asia/Shanghai'), [], '时区名里的字母组合不应误报');
});

const sampleId = brandIds[0];
if (sampleId) {
  const dir = resolve(brandsDir, sampleId);
  const preview = readJson(resolve(dir, 'content', 'preview.json'));
  const extras = readJson(resolve(dir, 'content', 'extras.json'));
  const asOf = extras.meta.asOf;
  const h5 = existsSync(resolve(dir, 'h5.json')) ? readJson(resolve(dir, 'h5.json')) : null;
  const facts = Array.isArray(h5?.facts) ? h5.facts : undefined;

  const rejects = (issues, why) => assert.ok(issues.length > 0, `校验器应拒绝：${why}`);
  const shapeOf = (mutate) => {
    const p = clone(preview);
    mutate(p);
    return S.checkPreview(p);
  };
  const invOf = (mutate) => {
    const p = clone(preview);
    mutate(p);
    return S.checkPreviewInvariants(p, asOf);
  };
  const extrasOf = (mutate) => {
    const e = clone(extras);
    mutate(e);
    return S.checkExtras(e, preview, facts);
  };

  test('形状校验会拒绝错误的接口数据', () => {
    rejects(shapeOf((p) => delete p.courses[0].speaker), '缺字段');
    rejects(shapeOf((p) => (p.courses[0].sample = true)), '往接口形状里塞演示标记');
    rejects(shapeOf((p) => (p.plans[0].price_cents = 399.5)), '金额不是整数分');
    rejects(shapeOf((p) => (p.courses[0].scheduled_at = '2026-10-08 20:00')), '时间不带时区');
    rejects(shapeOf((p) => (p.courses[0].course_type = '体重管理特辑')), '课程类型超出数据库约束');
    rejects(shapeOf((p) => (p.announcements = p.announcements.items)), '公告不是 {items,truncated}');
    rejects(shapeOf((p) => (p.courses[0].tags = ['这是一个超过八个字的标签'])), '标签超长');
    rejects(shapeOf((p) => (p.courses[0].status = '已取消')), '游客接口不下发已取消的课');
    rejects(shapeOf((p) => (p.benefits[0].min_identity = '钻石会员')), '不存在的身份档');
  });

  test('不变式校验会拒绝服务端不可能返回的数据', () => {
    rejects(invOf((p) => p.courses.reverse()), '课程顺序颠倒');
    rejects(invOf((p) => (p.courses[0].ends_at = '2026-10-08T22:00:00+08:00')), '结束时间与时长对不上');
    rejects(invOf((p) => p.courseTypes.pop()), '缺一个课程档位');
    rejects(invOf((p) => p.announcements.items.reverse()), '公告顺序颠倒');
    rejects(invOf((p) => (p.courses[1].id = p.courses[0].id)), '课程 id 重复');
  });

  test('extras 校验会拒绝缺标记或对不上的数据', () => {
    rejects(extrasOf((e) => delete e.special.schedule.items[0].status), '日程条目缺 status');
    rejects(extrasOf((e) => (e.special.schedule.items[0].date = '2026-10-13')), '日程超出展期');
    rejects(
      extrasOf((e) => {
        const it = e.special.schedule.items.find((x) => x.courseId !== null);
        it.start = '19:00';
      }),
      '日程与对应课程时间不一致',
    );
    rejects(extrasOf((e) => (e.contents[0].source = 'courseType:体重管理特辑')), '本期所含追不到数据');
    rejects(extrasOf((e) => delete e.terminology.identity['尊享官']), '身份缺显示名');
    rejects(extrasOf((e) => (e.memberCard.fields[0].sample = false)), '会员证样张上出现非样例栏');
    rejects(extrasOf((e) => (e.apiFields[0].path = 'courses[].not_a_field')), '登记了不存在的字段');
    rejects(extrasOf((e) => e.special.sachet.ingredients.pop()), '日程条目没出现在小样成分里');
  });
}
