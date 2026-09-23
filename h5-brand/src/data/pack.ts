// 内容包读取层：屏幕只从这里拿「算好的视图模型」，不直接读 JSON。
// preview.json 与接口 /mp/preview 同形；extras.json 是品牌自带、无接口来源的演示材料。
// 校验失败即抛错（守卫测试在 node 里加载本模块，内容包坏了测试直接红）。
import previewRaw from '@brand/content/preview.json';
import extrasRaw from '@brand/content/extras.json';
import {
  assertContent,
  shanghaiParts,
  treatmentOf,
  type MpPreview,
  type BrandExtras,
  type PreviewCourse,
} from '../content/schema';
import { h5 } from '../brand';

const content = assertContent(previewRaw, extrasRaw, h5.facts);

export const preview: MpPreview = content.preview;
export const extras: BrandExtras = content.extras;

/** 某个接口字段在演示期是否要盖「样」：查不到按「要盖」处理（最安全） */
export function isSampleField(path: string): boolean {
  const t = treatmentOf(extras, path);
  return t === undefined || t === 'stamp' || t === 'fictional';
}

/** 某个接口字段在演示期是否一律不渲染（报名数、阅读数这类读数） */
export function isHiddenField(path: string): boolean {
  return treatmentOf(extras, path) === 'hide';
}

/** 课程时间 → 北京时间「10.10」「14:00」 */
export function courseWhen(c: PreviewCourse): { md: string; time: string; date: string } {
  const p = shanghaiParts(c.scheduled_at);
  return { md: p.date.slice(5).replace('-', '.'), time: p.time, date: p.date };
}

export function courseById(id: string | number): PreviewCourse | undefined {
  return preview.courses.find((c) => String(c.id) === String(id));
}

/** 「本期所含」一行：成分名 + 计数 + 它能追到哪一块 */
export interface ContentsRow {
  label: string;
  detail: string;
  count: number | null;
  /** 计数由演示内容包推导而来，一律盖「样」 */
  sample: boolean;
  /** 站内路由或本页锚点（#xxx） */
  target: string | null;
}

function countOf(source: string): number | null {
  const [kind, arg] = source.split(':');
  switch (kind) {
    case 'courseType':
      return preview.courses.filter((c) => c.course_type === arg).length;
    case 'benefits':
      return preview.benefits.length;
    case 'plans':
      return preview.plans.length;
    case 'announcements':
      return preview.announcements.items.length;
    case 'special':
      return extras.special.schedule.items.length;
    default:
      return null;
  }
}

function targetOf(source: string): string | null {
  const [kind] = source.split(':');
  switch (kind) {
    case 'courseType':
      return '#courses';
    case 'benefit':
    case 'benefits':
      return '/benefits';
    case 'plans':
      return '/plans';
    case 'special':
      return '#sample';
    default:
      return null;
  }
}

export interface ScheduleRow {
  id: string;
  md: string;
  title: string;
  meta: string;
  live: boolean;
}

export interface HomeView {
  contents: ContentsRow[];
  /** 成分连写的一段长句 */
  runItems: string[];
  courses: ScheduleRow[];
}

let cached: HomeView | null = null;

export function homeView(): HomeView {
  if (cached) return cached;
  const contents = extras.contents.map((l) => ({
    label: l.label,
    detail: l.detail,
    count: countOf(l.source),
    sample: true,
    target: targetOf(l.source),
  }));
  const courses = [...preview.courses]
    .sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at))
    .map((c) => {
      const w = courseWhen(c);
      const who = [c.speaker, c.speaker_title].filter(Boolean).join(' · ');
      return {
        id: String(c.id),
        md: w.md,
        title: c.title,
        meta: [w.time, c.course_type, who].filter(Boolean).join(' · '),
        live: c.course_type === '直播课',
      };
    });
  cached = { contents, runItems: contents.map((c) => c.label), courses };
  return cached;
}
