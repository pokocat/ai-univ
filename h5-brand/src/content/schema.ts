/**
 * 品牌 H5 内容契约（类型 + 零依赖运行时校验）。
 *
 * 两类数据刻意分开，界面据此决定盖不盖「样」：
 *
 * 1. MpPreview —— 与后端 GET /api/v1/mp/preview 响应里的 data 逐字段同形
 *    （会员端游客预览接口；统一响应信封 {code,message,data} 之内那一层）。
 *    演示期由 brands/<id>/content/preview.json 顶替；将来接真实接口时换数据源，界面代码不动。
 *    因此这里的字段名、可空性、取值集合都照数据库列与 SELECT 别名写，不为界面方便改名。
 *
 * 2. BrandExtras —— 品牌自带、没有任何接口来源的演示材料（特辑日程、小样文案、入群说明、会员证样张……）。
 *    每一个条目都带 status（confirmed | 拟定）或 sample 标记，校验器强制。
 *    展会事实（ExpoFact）的内容存放在 brands/<id>/h5.json 的 facts，由品牌层读取；这里只定义同形类型供校验复用。
 *
 * 本文件只用「可擦除」的 TypeScript 语法（无 enum / namespace / 参数属性），
 * 所以 node ≥ 22.18 可以直接 import 它跑测试，Vite 构建也直接用它——校验逻辑只有这一份。
 */

// ───────────────────────────── 一、接口同形：GET /mp/preview ─────────────────────────────

/**
 * 带时区偏移的 ISO 8601 时间串。真实接口经 Jackson 输出为 UTC，形如 `2026-10-10T12:30:00.000+00:00`；
 * 演示数据为便于人工改写用北京时间 `+08:00`。两者都合法——界面必须先解析再按 Asia/Shanghai 格式化，
 * 不得对字符串直接切片取日期。
 */
export type IsoDateTime = string;

/** 金额，单位分（整数）。¥1,280 = 128000。 */
export type Cents = number;

/** 公告重要度（数据库 CHECK）。 */
export const ANNOUNCEMENT_IMPORTANCE = ['普通', '重要'] as const;
export type AnnouncementImportance = (typeof ANNOUNCEMENT_IMPORTANCE)[number];

/** 公告分类取自字典 announcement_category，字典可增项，所以类型放宽为 string；这里列出现行取值供内容校验。 */
export const KNOWN_ANNOUNCEMENT_CATEGORIES = ['系统', '课程', '班级', '活动', '权益'] as const;

/** 公开公告（游客只拿到 group_id IS NULL 的非班级公告）。 */
export interface PreviewAnnouncement {
  ann_no: string;
  category: string;
  importance: AnnouncementImportance;
  title: string;
  summary: string | null;
  source_name: string;
  publish_at: IsoDateTime | null;
  /** 置顶中（pinned_until > now()） */
  pinned: boolean;
  /** 全体已读人数（聚合数）。游客态不展示；演示数据里恒为 0，只为保持形状。 */
  read_count: number;
}

export interface PreviewAnnouncements {
  items: PreviewAnnouncement[];
  /** 服务端多取一条判断「还有更多」 */
  truncated: boolean;
}

/**
 * 课程类型：数据库 CHECK 只允许这三档（字典 course_type 同步登记）。
 * 「体重管理特辑」不是类型而是标签（tags），见 BrandExtras.special.tag。
 */
export const COURSE_TYPES = ['直播课', '录播课', '训练营'] as const;
export type CourseType = (typeof COURSE_TYPES)[number];

/** 字典 course_type 的 sort_order；字典里查不到的类型服务端给 999。 */
export const COURSE_TYPE_SORT: Readonly<Record<CourseType, number>> = { 直播课: 1, 录播课: 2, 训练营: 3 };

/** 课程状态：数据库 CHECK 的全集去掉「已取消」（游客接口过滤掉了）。 */
export const COURSE_STATUSES = ['已排期', '待开播', '直播中', '已结束', '已过期'] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

export interface PreviewCourse {
  id: number;
  title: string;
  speaker: string | null;
  speaker_title: string | null;
  summary: string | null;
  /** 文字封面，两行用 \n 分隔（设计上没有课程图片字段） */
  cover_text: string | null;
  course_type: CourseType;
  scheduled_at: IsoDateTime;
  /** 直播课 / 录播课 = scheduled_at + total_minutes（服务端派生）；训练营需显式填写，可跨周，可为空 */
  ends_at: IsoDateTime | null;
  status: CourseStatus;
  total_minutes: number | null;
  /** JSONB 字符串数组：最多 4 个、每个不超过 8 字；空即 null。会员端列表只显示前 2 个。 */
  tags: string[] | null;
  /** status = 已结束 且有回放地址 */
  replay_ready: boolean;
  /** 真实报名人数（聚合数）。演示数据恒为 0 且界面不展示——不编会员数。 */
  enrolled_count: number;
  chapter_count: number;
}

/** 游客可见窗口里出现过的课程类型档位 */
export interface PreviewCourseType {
  type: CourseType;
  sort_order: number;
}

export const PLAN_TYPES = ['membership', 'training'] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

/** 套餐授予身份（数据库 CHECK）。界面显示名走 BrandExtras.terminology.identity，不直接露出内部档名。 */
export const GRANT_IDENTITIES = ['PRO会员', '尊享官', '黑金', 'VIP'] as const;
export type GrantIdentity = (typeof GRANT_IDENTITIES)[number];

/** 会员身份字典 member_identity 的全部档名（min_identity 取值范围）。 */
export const MEMBER_IDENTITIES = [
  '游客', '体验官', 'PRO会员', '尊享官', '运营商', '代理', '城市合伙人', '学员', '黑金', 'VIP', '团长',
] as const;

export interface PreviewPlan {
  plan_code: string;
  name: string;
  plan_type: PlanType;
  grant_identity: GrantIdentity;
  duration_days: number;
  /** 安卓 / 鸿蒙 / Windows 定价 */
  price_cents: Cents;
  /** iOS 单独定价；null = 与 price_cents 同价 */
  ios_price_cents: Cents | null;
  /** 划线原价；null = 该档无原价，界面不显示划线价与「省多少」，不得用 price 反推 */
  list_price_cents: Cents | null;
  summary: string | null;
  /** 纯展示标签，不产生任何权益 */
  badge: string | null;
  recommended: boolean;
  sort_order: number;
}

export interface PreviewBenefit {
  code: string;
  name: string;
  summary: string;
  /** 会员小程序图标集的图标名；品牌 H5 需自行映射到本品牌图标 */
  icon: string;
  /** 最低可见档；null = 所有会员可见。只是可见门槛，不是个人余量 */
  min_identity: string | null;
  quota_per_month: number | null;
  sort_order: number;
}

/** GET /api/v1/mp/preview 的 data */
export interface MpPreview {
  projectId: string;
  announcements: PreviewAnnouncements;
  courses: PreviewCourse[];
  courseTypes: PreviewCourseType[];
  plans: PreviewPlan[];
  benefits: PreviewBenefit[];
}

/** 真实接口的信封（接入真实数据时用；演示 JSON 只存 data 这一层） */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T | null;
}

// ───────────────────────────── 二、品牌演示材料（无接口来源） ─────────────────────────────

/** 事实状态：confirmed = 有正式公开出处；拟定 = 未最终公布，渲染时必须附「拟定」印记与免责说明 */
export const FACT_STATUSES = ['confirmed', '拟定'] as const;
export type FactStatus = (typeof FACT_STATUSES)[number];

/** 展会事实。内容在 brands/<id>/h5.json 的 facts；与品牌层 BrandFact 同形。 */
export interface ExpoFact {
  key: string;
  label: string;
  value: string;
  status: FactStatus;
  source: string;
}

/**
 * 接口字段在演示期的处理方式（界面按路径查表，不要自己猜）：
 * - stamp：演示值，显示时旁边盖「样」；
 * - hide：演示值且属于「读数」一类（报名数、阅读数），一律不渲染；
 * - fictional：虚构的人名 / 头衔，所在屏必须有「样张」章，不得介绍为真实人物；
 * - structural：主键、排序键，不对外展示。
 * 由演示值推导出来的数（例如按类型数课程条数）同样按 stamp 处理。
 */
export const FIELD_TREATMENTS = ['stamp', 'hide', 'fictional', 'structural'] as const;
export type FieldTreatment = (typeof FIELD_TREATMENTS)[number];

export interface ApiFieldMark {
  /** 规范化路径，数组用 []，例：courses[].enrolled_count */
  path: string;
  treatment: FieldTreatment;
  /** stamp / hide / fictional 必为 true；structural 必为 false */
  sample: boolean;
  /** 给开发看的说明，界面永远不渲染 */
  devNote: string;
}

export interface ExtrasMeta {
  sample: boolean;
  /** 演示数据的基准时刻：preview.json 的排序按这一刻的服务端规则排好 */
  asOf: IsoDateTime;
  timezone: 'Asia/Shanghai';
  devNote: string;
}

export interface Terminology {
  sample: boolean;
  /** 内部身份档名 → 本品牌显示名，例：PRO会员 → 会员 */
  identity: Record<string, string>;
}

export interface ExpoSection {
  status: FactStatus;
  /** 展期（北京时间日期，含首尾）；日程条目必须落在这个窗口内 */
  window: { from: string; to: string };
  /** 引用 h5.json facts 的 key，本文件不重复存事实内容 */
  factKeys: string[];
}

export interface Notice {
  sample: boolean;
  text: string;
}

/** 可撕日程的一条。时间为北京时间墙上时间。 */
export interface SpecialScheduleItem {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm */
  start: string;
  /** HH:mm，须晚于 start，同一天内 */
  end: string;
  title: string;
  venue: string;
  kind: 'onsite' | 'online';
  status: '拟定';
  note: string | null;
  /** 对应的课程（preview.courses[].id），有则时间必须与该课一致 */
  courseId: number | null;
}

export interface SpecialSchedule {
  status: '拟定';
  timezone: 'Asia/Shanghai';
  /** .ics 日历名 */
  calendarName: string;
  /** 每个 .ics 事件标题的前缀，例「【拟定】」 */
  eventPrefix: string;
  /** 写进每个 .ics 事件描述的说明 */
  eventNote: string;
  /** 日程下方常驻的免责条 */
  notice: string;
  items: SpecialScheduleItem[];
}

export interface SachetIngredient {
  label: string;
  /** 引用 SpecialScheduleItem.id */
  refs: string[];
  sample: boolean;
}

export interface Sachet {
  sample: boolean;
  kicker: string;
  title: string;
  dek: string;
  /** 小样背面的「成分」：每一行都能追到日程条目 */
  ingredients: SachetIngredient[];
  /** 小样背面的「用法」 */
  usage: string[];
  tearHint: string;
  /** 与拖拽等效的按钮文案 */
  tearAction: string;
  /** 撕开后印上的状态章；只能写「已存到本机」这类事实，不得写「已报名」 */
  tornStamp: string;
}

export interface SpecialSection {
  sample: boolean;
  /** 课程 tags 里的特辑标签；界面按它从 preview.courses 里筛特辑课程 */
  tag: string;
  title: string;
  dek: string;
  disclaimer: string;
  schedule: SpecialSchedule;
  sachet: Sachet;
}

/**
 * 「本期所含」一行。source 语法：
 * courseType:<直播课|录播课|训练营> · benefit:<code> · benefits · plans · announcements · special
 */
export interface ContentsLine {
  label: string;
  detail: string;
  source: string;
  sample: boolean;
}

export interface JoinStep {
  no: number;
  title: string;
  detail: string;
  sample: boolean;
}

export interface JoinGuide {
  sample: boolean;
  title: string;
  steps: JoinStep[];
  qr: { sample: boolean; caption: string };
  notice: string;
}

export interface MemberCardField {
  label: string;
  value: string;
  sample: boolean;
}

export interface MemberCardSample {
  sample: boolean;
  stamp: '样张';
  /** 镭射防伪标上的字 */
  laser: string;
  fields: MemberCardField[];
  footnote: string;
}

export interface BrandExtras {
  schemaVersion: 1;
  meta: ExtrasMeta;
  terminology: Terminology;
  apiFields: ApiFieldMark[];
  expo: ExpoSection;
  plansNotice: Notice;
  special: SpecialSection;
  contents: ContentsLine[];
  joinGuide: JoinGuide;
  memberCard: MemberCardSample;
}

// ───────────────────────────── 三、运行时校验（零依赖） ─────────────────────────────

type Obj = Record<string, unknown>;
/** 校验器：把问题追加进 out，一律不抛错，便于一次列全 */
type Check = (v: unknown, path: string, out: string[], strict: boolean) => void;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const has = (o: Obj, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const str =
  (opts: { min?: number; max?: number; re?: RegExp; reName?: string } = {}): Check =>
  (v, p, out) => {
    if (typeof v !== 'string') return void out.push(`${p}: 应为字符串`);
    if (opts.min !== undefined && v.trim().length < opts.min) out.push(`${p}: 不能为空`);
    if (opts.max !== undefined && v.length > opts.max) out.push(`${p}: 超过 ${opts.max} 字`);
    if (opts.re && !opts.re.test(v)) out.push(`${p}: 格式应为 ${opts.reName ?? String(opts.re)}，实为「${v}」`);
  };

const int =
  (opts: { min?: number; max?: number } = {}): Check =>
  (v, p, out) => {
    if (typeof v !== 'number' || !Number.isInteger(v)) return void out.push(`${p}: 应为整数，实为 ${JSON.stringify(v)}`);
    if (opts.min !== undefined && v < opts.min) out.push(`${p}: 不应小于 ${opts.min}`);
    if (opts.max !== undefined && v > opts.max) out.push(`${p}: 不应大于 ${opts.max}`);
  };

const bool: Check = (v, p, out) => {
  if (typeof v !== 'boolean') out.push(`${p}: 应为布尔值`);
};

const iso: Check = (v, p, out) => {
  if (typeof v !== 'string' || !ISO_RE.test(v) || Number.isNaN(Date.parse(v))) {
    out.push(`${p}: 应为带时区偏移的 ISO 8601 时间，实为 ${JSON.stringify(v)}`);
  }
};

const oneOf =
  (vals: readonly (string | number)[]): Check =>
  (v, p, out) => {
    if (!vals.includes(v as string | number)) out.push(`${p}: 取值只能是 ${vals.join(' / ')}，实为 ${JSON.stringify(v)}`);
  };

const nullable =
  (c: Check): Check =>
  (v, p, out, strict) => {
    if (v !== null) c(v, p, out, strict);
  };

const arrayOf =
  (c: Check, opts: { min?: number; max?: number } = {}): Check =>
  (v, p, out, strict) => {
    if (!Array.isArray(v)) return void out.push(`${p}: 应为数组`);
    if (opts.min !== undefined && v.length < opts.min) out.push(`${p}: 至少 ${opts.min} 条`);
    if (opts.max !== undefined && v.length > opts.max) out.push(`${p}: 至多 ${opts.max} 条`);
    v.forEach((item, i) => c(item, `${p}[${i}]`, out, strict));
  };

const recordOf =
  (c: Check): Check =>
  (v, p, out, strict) => {
    if (!isObj(v)) return void out.push(`${p}: 应为对象`);
    for (const [k, x] of Object.entries(v)) c(x, `${p}.${k}`, out, strict);
  };

/** 对象形状：键必须齐全（接口对空值下发 null，不会省略键）；strict 下多出来的键也报错 */
const shape =
  (spec: Record<string, Check>): Check =>
  (v, p, out, strict) => {
    if (!isObj(v)) return void out.push(`${p}: 应为对象`);
    for (const [k, c] of Object.entries(spec)) {
      if (!has(v, k)) out.push(`${p}.${k}: 缺字段`);
      else c(v[k], `${p}.${k}`, out, strict);
    }
    if (strict) for (const k of Object.keys(v)) if (!has(spec, k)) out.push(`${p}.${k}: 契约里没有这个字段`);
  };

const text = str({ min: 1 });
const ntext = nullable(str({ min: 1 }));
const count = int({ min: 0 });

const announcementCheck = shape({
  ann_no: text,
  category: text,
  importance: oneOf(ANNOUNCEMENT_IMPORTANCE),
  title: text,
  summary: ntext,
  source_name: text,
  publish_at: nullable(iso),
  pinned: bool,
  read_count: count,
});

const tagsCheck: Check = (v, p, out) => {
  if (v === null) return;
  if (!Array.isArray(v)) return void out.push(`${p}: 应为字符串数组或 null`);
  if (v.length === 0) out.push(`${p}: 空数组在服务端会存成 null`);
  if (v.length > 4) out.push(`${p}: 标签最多 4 个`);
  const seen = new Set<string>();
  v.forEach((t, i) => {
    if (typeof t !== 'string' || t.trim() === '') return void out.push(`${p}[${i}]: 应为非空字符串`);
    if (t !== t.trim()) out.push(`${p}[${i}]: 首尾有空白（服务端会 trim）`);
    if (t.length > 8) out.push(`${p}[${i}]: 「${t}」超过 8 字`);
    if (seen.has(t)) out.push(`${p}[${i}]: 「${t}」重复（服务端会去重）`);
    seen.add(t);
  });
};

const courseCheck = shape({
  id: int({ min: 1 }),
  title: text,
  speaker: ntext,
  speaker_title: ntext,
  summary: ntext,
  cover_text: ntext,
  course_type: oneOf(COURSE_TYPES),
  scheduled_at: iso,
  ends_at: nullable(iso),
  status: oneOf(COURSE_STATUSES),
  total_minutes: nullable(int({ min: 15, max: 1440 })),
  tags: tagsCheck,
  replay_ready: bool,
  enrolled_count: count,
  chapter_count: count,
});

const planCheck = shape({
  plan_code: text,
  name: text,
  plan_type: oneOf(PLAN_TYPES),
  grant_identity: oneOf(GRANT_IDENTITIES),
  duration_days: int({ min: 1 }),
  price_cents: count,
  ios_price_cents: nullable(count),
  list_price_cents: nullable(count),
  summary: ntext,
  badge: ntext,
  recommended: bool,
  sort_order: int(),
});

const benefitCheck = shape({
  code: text,
  name: text,
  summary: text,
  icon: text,
  min_identity: nullable(oneOf(MEMBER_IDENTITIES)),
  quota_per_month: nullable(int({ min: 1 })),
  sort_order: int(),
});

const previewCheck = shape({
  projectId: text,
  announcements: shape({ items: arrayOf(announcementCheck, { max: 50 }), truncated: bool }),
  courses: arrayOf(courseCheck, { max: 20 }),
  courseTypes: arrayOf(shape({ type: oneOf(COURSE_TYPES), sort_order: int() })),
  plans: arrayOf(planCheck),
  benefits: arrayOf(benefitCheck),
});

/**
 * 校验接口形状。strict（默认开）下出现契约外的字段即报错——演示数据不许偷塞 sample 之类的键进接口形状；
 * 将来校验真实接口返回时可传 strict:false，容忍后端新增列。
 */
export function checkPreview(x: unknown, opts: { strict?: boolean } = {}): string[] {
  const out: string[] = [];
  previewCheck(x, 'preview', out, opts.strict ?? true);
  return out;
}

const ms = (s: string): number => Date.parse(s);

/** 北京时间的日期与钟点（固定 +08:00，无夏令时） */
export function shanghaiParts(isoText: string): { date: string; time: string } {
  const d = new Date(ms(isoText) + 8 * 3600_000);
  const p2 = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`,
    time: `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`,
  };
}

function dupes(values: (string | number)[], label: string, out: string[]): void {
  const seen = new Set<string | number>();
  for (const v of values) {
    if (seen.has(v)) out.push(`${label}: 「${v}」重复`);
    seen.add(v);
  }
}

/**
 * 业务不变式：演示数据必须是真实服务端「可能返回」的样子。
 * 排序按 asOf 这一刻的服务端 ORDER BY 复算；派生列按服务端派生规则复算。
 * 前提是 checkPreview 已通过。
 */
export function checkPreviewInvariants(p: MpPreview, asOf: IsoDateTime): string[] {
  const out: string[] = [];
  const now = ms(asOf);
  if (Number.isNaN(now)) return [`asOf 不是合法时间：${asOf}`];

  dupes(p.announcements.items.map((a) => a.ann_no), 'announcements.items[].ann_no', out);
  dupes(p.courses.map((c) => c.id), 'courses[].id', out);
  dupes(p.plans.map((x) => x.plan_code), 'plans[].plan_code', out);
  dupes(p.benefits.map((b) => b.code), 'benefits[].code', out);

  // 公告：置顶优先，再 publish_at DESC（DESC 下 NULL 排最前）
  const annKey = (a: PreviewAnnouncement): [number, number] => [a.pinned ? 0 : 1, a.publish_at ? -ms(a.publish_at) : -Infinity];
  for (let i = 1; i < p.announcements.items.length; i++) {
    const [a1, b1] = annKey(p.announcements.items[i - 1] as PreviewAnnouncement);
    const [a2, b2] = annKey(p.announcements.items[i] as PreviewAnnouncement);
    if (a1 > a2 || (a1 === a2 && b1 > b2)) out.push(`announcements.items[${i}]: 顺序与服务端（置顶优先、发布时间倒序）不一致`);
  }
  p.announcements.items.forEach((a, i) => {
    if (a.publish_at && ms(a.publish_at) > now) out.push(`announcements.items[${i}].publish_at: 晚于 asOf，游客接口此刻还看不到它`);
  });

  // 课程：直播中优先 → 未开的按时间正序 → 已过的按时间倒序 → id 倒序
  const courseKey = (c: PreviewCourse): number[] => {
    const t = ms(c.scheduled_at);
    const past = t < now;
    return [c.status === '直播中' ? 0 : 1, past ? 1 : 0, past ? Infinity : t, -t, -c.id];
  };
  for (let i = 1; i < p.courses.length; i++) {
    const k1 = courseKey(p.courses[i - 1] as PreviewCourse);
    const k2 = courseKey(p.courses[i] as PreviewCourse);
    for (let j = 0; j < k1.length; j++) {
      const a = k1[j] as number;
      const b = k2[j] as number;
      if (a < b) break;
      if (a > b) {
        out.push(`courses[${i}]: 顺序与服务端（直播中优先、未开的由近及远、已过的由近及远）不一致`);
        break;
      }
    }
  }

  p.courses.forEach((c, i) => {
    const at = `courses[${i}]`;
    const start = ms(c.scheduled_at);
    if (c.ends_at !== null && ms(c.ends_at) <= start) out.push(`${at}.ends_at: 必须晚于 scheduled_at`);
    if (c.course_type !== '训练营' && c.ends_at !== null && c.total_minutes !== null) {
      if (ms(c.ends_at) - start !== c.total_minutes * 60_000) {
        out.push(`${at}.ends_at: ${c.course_type}的结束时间由服务端按 scheduled_at + total_minutes 派生，两者对不上`);
      }
    }
    if (c.replay_ready && c.status !== '已结束') out.push(`${at}.replay_ready: 只有已结束的课才可能有回放`);
    // 反过来不查：录播课可以补录一个已经过去的时间而仍是「已排期」
    if ((c.status === '已结束' || c.status === '已过期' || c.status === '直播中') && start > now) {
      out.push(`${at}.status: 尚未到开课时间却标为${c.status}`);
    }
  });

  // 档位：恰为窗口内出现过的类型，按字典顺序
  const present = [...new Set(p.courses.map((c) => c.course_type))];
  const listed = p.courseTypes.map((t) => t.type);
  dupes(listed, 'courseTypes[].type', out);
  for (const t of present) if (!listed.includes(t)) out.push(`courseTypes: 缺「${t}」档（课程里有这一类）`);
  for (const t of listed) if (!present.includes(t)) out.push(`courseTypes: 「${t}」档点开会是空的（课程里没有这一类）`);
  p.courseTypes.forEach((t, i) => {
    if (t.sort_order !== COURSE_TYPE_SORT[t.type]) out.push(`courseTypes[${i}].sort_order: 字典顺序应为 ${COURSE_TYPE_SORT[t.type]}`);
    const prev = p.courseTypes[i - 1];
    if (prev && prev.sort_order > t.sort_order) out.push(`courseTypes[${i}]: 未按 sort_order 升序`);
  });

  // 套餐与权益：sort_order 升序（同序时的次级排序依赖数据库排序规则，这里不复算）
  p.plans.forEach((x, i) => {
    const prev = p.plans[i - 1];
    if (prev && prev.sort_order > x.sort_order) out.push(`plans[${i}]: 未按 sort_order 升序`);
    if (x.list_price_cents !== null && x.list_price_cents <= x.price_cents) out.push(`plans[${i}].list_price_cents: 划线价不高于售价，没有意义`);
  });
  p.benefits.forEach((b, i) => {
    const prev = p.benefits[i - 1];
    if (prev && prev.sort_order > b.sort_order) out.push(`benefits[${i}]: 未按 sort_order 升序`);
  });

  if (p.announcements.truncated && p.announcements.items.length === 0) out.push('announcements.truncated: 没有条目却说还有更多');
  return out;
}

// ── extras ──

const flagged = { sample: bool };

const scheduleItemCheck = shape({
  id: text,
  date: str({ re: DATE_RE, reName: 'YYYY-MM-DD' }),
  start: str({ re: HHMM_RE, reName: 'HH:mm' }),
  end: str({ re: HHMM_RE, reName: 'HH:mm' }),
  title: text,
  venue: text,
  kind: oneOf(['onsite', 'online']),
  status: oneOf(['拟定']),
  note: ntext,
  courseId: nullable(int({ min: 1 })),
});

const extrasCheck = shape({
  schemaVersion: oneOf([1]),
  meta: shape({ ...flagged, asOf: iso, timezone: oneOf(['Asia/Shanghai']), devNote: text }),
  terminology: shape({ ...flagged, identity: recordOf(text) }),
  apiFields: arrayOf(
    shape({ path: text, treatment: oneOf(FIELD_TREATMENTS), ...flagged, devNote: text }),
    { min: 1 },
  ),
  expo: shape({
    status: oneOf(FACT_STATUSES),
    window: shape({ from: str({ re: DATE_RE, reName: 'YYYY-MM-DD' }), to: str({ re: DATE_RE, reName: 'YYYY-MM-DD' }) }),
    factKeys: arrayOf(text, { min: 1 }),
  }),
  plansNotice: shape({ ...flagged, text }),
  special: shape({
    ...flagged,
    tag: str({ min: 1, max: 8 }),
    title: text,
    dek: text,
    disclaimer: text,
    schedule: shape({
      status: oneOf(['拟定']),
      timezone: oneOf(['Asia/Shanghai']),
      calendarName: text,
      eventPrefix: text,
      eventNote: text,
      notice: text,
      items: arrayOf(scheduleItemCheck, { min: 4, max: 6 }),
    }),
    sachet: shape({
      ...flagged,
      kicker: text,
      title: text,
      dek: text,
      ingredients: arrayOf(shape({ label: text, refs: arrayOf(text, { min: 1 }), ...flagged }), { min: 1 }),
      usage: arrayOf(text, { min: 1 }),
      tearHint: text,
      tearAction: text,
      tornStamp: text,
    }),
  }),
  contents: arrayOf(shape({ label: text, detail: text, source: text, ...flagged }), { min: 1 }),
  joinGuide: shape({
    ...flagged,
    title: text,
    steps: arrayOf(shape({ no: int({ min: 1 }), title: text, detail: text, ...flagged }), { min: 3 }),
    qr: shape({ ...flagged, caption: text }),
    notice: text,
  }),
  memberCard: shape({
    ...flagged,
    stamp: oneOf(['样张']),
    laser: text,
    fields: arrayOf(shape({ label: text, value: text, ...flagged }), { min: 1 }),
    footnote: text,
  }),
});

/** 展会事实（h5.json facts）的形状校验 */
export function checkExpoFacts(x: unknown): string[] {
  const out: string[] = [];
  arrayOf(shape({ key: text, label: text, value: text, status: oneOf(FACT_STATUSES), source: text }))(x, 'facts', out, false);
  if (Array.isArray(x)) dupes(x.map((f) => (isObj(f) ? String(f.key) : '')), 'facts[].key', out);
  return out;
}

/** preview 里实际存在的规范化字段路径（数组记作 []），供 apiFields 对账 */
export function fieldPaths(x: unknown, base = ''): Set<string> {
  const acc = new Set<string>();
  const walk = (v: unknown, p: string) => {
    if (Array.isArray(v)) v.forEach((item) => walk(item, `${p}[]`));
    else if (isObj(v)) {
      for (const [k, x2] of Object.entries(v)) {
        const next = p ? `${p}.${k}` : k;
        acc.add(next);
        walk(x2, next);
      }
    }
  };
  walk(x, base);
  return acc;
}

/**
 * 校验品牌演示材料：先查形状，形状通过后再与 preview（与可选的 h5.json facts）对账。
 */
export function checkExtras(x: unknown, preview?: MpPreview, facts?: ExpoFact[]): string[] {
  const out: string[] = [];
  extrasCheck(x, 'extras', out, true);
  if (out.length || !preview) return out;
  const e = x as BrandExtras;

  // apiFields：路径存在、处理方式与 sample 标记一致
  const paths = fieldPaths(preview);
  dupes(e.apiFields.map((f) => f.path), 'extras.apiFields[].path', out);
  e.apiFields.forEach((f, i) => {
    const at = `extras.apiFields[${i}]`;
    if (!paths.has(f.path)) out.push(`${at}.path: preview 里没有「${f.path}」`);
    if ((f.treatment === 'structural') === f.sample) out.push(`${at}.sample: ${f.treatment} 应为 ${f.treatment !== 'structural'}`);
  });

  // 身份显示名：界面不得露出内部档名
  const used = new Set<string>([
    ...preview.plans.map((x2) => x2.grant_identity as string),
    ...preview.benefits.map((b) => b.min_identity).filter((v): v is string => v !== null),
  ]);
  for (const id of used) if (!has(e.terminology.identity, id)) out.push(`extras.terminology.identity: 缺「${id}」的显示名`);
  for (const id of Object.keys(e.terminology.identity)) {
    if (!(MEMBER_IDENTITIES as readonly string[]).includes(id)) out.push(`extras.terminology.identity.${id}: 不是会员身份档名`);
  }

  // 展会窗口与事实引用
  const { from, to } = e.expo.window;
  if (from > to) out.push('extras.expo.window: from 晚于 to');
  if (facts) {
    const keys = new Set(facts.map((f) => f.key));
    e.expo.factKeys.forEach((k, i) => {
      if (!keys.has(k)) out.push(`extras.expo.factKeys[${i}]: h5.json facts 里没有「${k}」`);
    });
  }

  // 特辑：标签有课、日程在展期内、与对应课程时间一致
  const sp = e.special;
  const tagged = preview.courses.filter((c) => (c.tags ?? []).includes(sp.tag));
  if (tagged.length === 0) out.push(`extras.special.tag: preview.courses 里没有带「${sp.tag}」标签的课`);
  const items = sp.schedule.items;
  dupes(items.map((it) => it.id), 'extras.special.schedule.items[].id', out);
  items.forEach((it, i) => {
    const at = `extras.special.schedule.items[${i}]`;
    if (it.date < from || it.date > to) out.push(`${at}.date: ${it.date} 不在展期 ${from}～${to} 内`);
    if (it.start >= it.end) out.push(`${at}: 结束 ${it.end} 不晚于开始 ${it.start}`);
    const prev = items[i - 1];
    if (prev && `${prev.date} ${prev.start}` > `${it.date} ${it.start}`) out.push(`${at}: 日程未按时间先后排列`);
    if (it.courseId !== null) {
      const c = preview.courses.find((x2) => x2.id === it.courseId);
      if (!c) return void out.push(`${at}.courseId: preview.courses 里没有 id=${it.courseId}`);
      if (!(c.tags ?? []).includes(sp.tag)) out.push(`${at}.courseId: 课程 ${c.id} 没有「${sp.tag}」标签`);
      const s = shanghaiParts(c.scheduled_at);
      if (s.date !== it.date || s.time !== it.start) out.push(`${at}: 与课程 ${c.id} 的开课时间 ${s.date} ${s.time} 不一致`);
      if (c.ends_at && shanghaiParts(c.ends_at).time !== it.end) out.push(`${at}.end: 与课程 ${c.id} 的结束时间不一致`);
      if (it.kind !== 'online') out.push(`${at}.kind: 对应线上课程，应为 online`);
    }
  });
  const ids = new Set(items.map((it) => it.id));
  const covered = new Set<string>();
  sp.sachet.ingredients.forEach((g, i) => {
    g.refs.forEach((r, j) => {
      if (!ids.has(r)) out.push(`extras.special.sachet.ingredients[${i}].refs[${j}]: 没有日程条目「${r}」`);
      covered.add(r);
    });
  });
  for (const id of ids) if (!covered.has(id)) out.push(`extras.special.sachet.ingredients: 日程「${id}」没有出现在小样成分里`);

  // 本期所含：每一行都能追到数据
  e.contents.forEach((line, i) => {
    const at = `extras.contents[${i}].source`;
    const [kind, arg] = line.source.split(':');
    if (kind === 'courseType') {
      if (!preview.courseTypes.some((t) => t.type === arg)) out.push(`${at}: 课程档位里没有「${arg}」`);
    } else if (kind === 'benefit') {
      if (!preview.benefits.some((b) => b.code === arg)) out.push(`${at}: 权益目录里没有「${arg}」`);
    } else if (kind === 'benefits' || kind === 'plans' || kind === 'announcements') {
      const list = kind === 'announcements' ? preview.announcements.items : preview[kind];
      if (arg !== undefined) out.push(`${at}: 「${kind}」不带参数`);
      if (list.length === 0) out.push(`${at}: ${kind} 是空的`);
    } else if (kind === 'special') {
      if (arg !== undefined) out.push(`${at}: 「special」不带参数`);
    } else out.push(`${at}: 无法识别的来源「${line.source}」`);
  });

  // 入群步骤连续编号；会员证与价格说明必须是样例
  e.joinGuide.steps.forEach((s, i) => {
    if (s.no !== i + 1) out.push(`extras.joinGuide.steps[${i}].no: 应为 ${i + 1}`);
  });
  if (!e.joinGuide.qr.sample) out.push('extras.joinGuide.qr.sample: 入群码在演示里只能是样张');
  if (!e.memberCard.sample) out.push('extras.memberCard.sample: 会员证只能是样张');
  e.memberCard.fields.forEach((f, i) => {
    if (!f.sample) out.push(`extras.memberCard.fields[${i}].sample: 样张上的每一栏都是样例`);
  });
  if (!e.plansNotice.sample) out.push('extras.plansNotice.sample: 演示价格说明必须标为样例');
  return out;
}

/** 构建期入口：任一问题即抛错并列出全部问题，不静默放行 */
export function assertContent(
  preview: unknown,
  extras: unknown,
  facts?: ExpoFact[],
): { preview: MpPreview; extras: BrandExtras } {
  const issues = checkPreview(preview);
  if (!issues.length) {
    issues.push(...checkExtras(extras, preview as MpPreview, facts));
    if (!issues.length) issues.push(...checkPreviewInvariants(preview as MpPreview, (extras as BrandExtras).meta.asOf));
  }
  if (facts) issues.push(...checkExpoFacts(facts));
  if (issues.length) throw new Error(`内容包校验失败（${issues.length} 项）：\n- ${issues.join('\n- ')}`);
  return { preview: preview as MpPreview, extras: extras as BrandExtras };
}

/** 界面按路径取字段的演示期处理方式；查不到返回 undefined（此时按 stamp 处理最安全） */
export function treatmentOf(extras: BrandExtras, path: string): FieldTreatment | undefined {
  return extras.apiFields.find((f) => f.path === path)?.treatment;
}
