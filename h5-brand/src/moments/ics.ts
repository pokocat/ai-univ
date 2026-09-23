// 本机日历文件（RFC 5545 .ics）生成器：纯函数，零依赖，不碰 window / document。
// 只用可擦除的 TypeScript 语法——同目录的 ics.check.mjs 在 node 里直接 import 本文件。
//
// 口径（体重管理特辑小样撕开后「存到本机日历」）：
// · 行尾一律 CRLF，内容行按 75 个字节折行（UTF-8 计，不劈开多字节字符），续行以一个空格起头；
// · 时间是北京时间墙上时间：DTSTART/DTEND 带 TZID=Asia/Shanghai，并附同名 VTIMEZONE 块；
// · 每个事件一个稳定 UID；SUMMARY 以 eventPrefix 起头；DESCRIPTION 写明 eventNote 与「拟定」；
// · STATUS:TENTATIVE——日程是拟定的，存到本机不等于报名。

export interface IcsItem {
  /** 稳定标识，进 UID */
  id: string;
  /** YYYY-MM-DD（北京时间） */
  date: string;
  /** HH:mm */
  start: string;
  /** HH:mm */
  end: string;
  title: string;
  venue: string;
  note?: string | null;
}

export interface IcsInput {
  /** 日历名（X-WR-CALNAME） */
  calendarName: string;
  /** 事件标题前缀，例「【拟定】」 */
  eventPrefix: string;
  /** 写进每个事件描述的说明 */
  eventNote: string;
  /** 状态词，写进描述，例「拟定」 */
  statusWord: string;
  items: IcsItem[];
  /** UID 的域部分，例 liren.brand-h5；不是网址，不会被请求 */
  uidDomain: string;
  /** 文件生成时刻（DTSTAMP）；测试里传固定值 */
  now: Date;
}

export const ICS_TZID = 'Asia/Shanghai';
export const ICS_MIME = 'text/calendar;charset=utf-8';

const CRLF = '\r\n';

/** TEXT 值转义：反斜杠、分号、逗号、换行（RFC 5545 §3.3.11） */
export function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

function utf8Len(ch: string): number {
  const cp = ch.codePointAt(0) ?? 0;
  if (cp < 0x80) return 1;
  if (cp < 0x800) return 2;
  if (cp < 0x10000) return 3;
  return 4;
}

/** 折行：每一物理行（含续行起头的空格）不超过 75 个字节，按码点切，不劈开 UTF-8 */
export function foldLine(line: string, limit = 75): string {
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  let max = limit;
  for (const ch of line) {
    const n = utf8Len(ch);
    if (bytes + n > max) {
      out.push(cur);
      cur = ' ';
      bytes = 1;
      max = limit;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join(CRLF);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** 2026-10-10 + 10:30 → 20261010T103000（本地墙上时间，配 TZID 使用） */
export function localStamp(date: string, time: string): string {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) throw new Error(`日程时间格式不对：${date} ${time}`);
  return `${d[1]}${d[2]}${d[3]}T${t[1]}${t[2]}00`;
}

function utcStamp(at: Date): string {
  return (
    `${at.getUTCFullYear()}${pad2(at.getUTCMonth() + 1)}${pad2(at.getUTCDate())}` +
    `T${pad2(at.getUTCHours())}${pad2(at.getUTCMinutes())}${pad2(at.getUTCSeconds())}Z`
  );
}

/** UID 只许出现安全字符：id 里的其它字符替换成连字符 */
function uidOf(id: string, domain: string): string {
  return `${id.replace(/[^A-Za-z0-9._-]/g, '-')}@${domain.replace(/[^A-Za-z0-9.-]/g, '-')}`;
}

// 北京时间自 1991 年起不再实行夏令时，全年 +08:00；一个 STANDARD 子块即可完整描述
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  `TZID:${ICS_TZID}`,
  `X-LIC-LOCATION:${ICS_TZID}`,
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0800',
  'TZOFFSETTO:+0800',
  'TZNAME:CST',
  'DTSTART:19700101T000000',
  'END:STANDARD',
  'END:VTIMEZONE',
];

export function buildIcs(input: IcsInput): string {
  const stamp = utcStamp(input.now);
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//brand-h5//sample-sachet//ZH-CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(input.calendarName)}`,
    `X-WR-TIMEZONE:${ICS_TZID}`,
    ...VTIMEZONE,
  ];
  for (const it of input.items) {
    const start = localStamp(it.date, it.start);
    const end = localStamp(it.date, it.end);
    if (end <= start) throw new Error(`日程 ${it.id} 的结束时间不晚于开始时间`);
    const desc = [input.eventNote, it.note ?? '', `状态：${input.statusWord}`].filter(Boolean).join('\n');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uidOf(it.id, input.uidDomain)}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${ICS_TZID}:${start}`,
      `DTEND;TZID=${ICS_TZID}:${end}`,
      `SUMMARY:${escapeText(input.eventPrefix + it.title)}`,
      `LOCATION:${escapeText(it.venue)}`,
      `DESCRIPTION:${escapeText(desc)}`,
      'STATUS:TENTATIVE',
      'TRANSP:OPAQUE',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map((l) => foldLine(l)).join(CRLF) + CRLF;
}

/** 下载用文件名：去掉文件系统不认的字符与全角括号，空白与间隔号换成连字符 */
export function icsFileName(calendarName: string): string {
  const base = calendarName
    .replace(/[\\/:*?"<>|（）()]/g, ' ')
    .replace(/[\s·・]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'calendar'}.ics`;
}
