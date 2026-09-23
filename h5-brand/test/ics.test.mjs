// .ics 生成器自检（由 B3 的 src/moments/ics.check.mjs 原样挪入）：node --test test/ics.test.mjs。
// 按 package.json 向上找包根，挪位置不用改路径。
// 需要 Node ≥ 22.18（原生擦除 TypeScript 类型，直接 import ics.ts）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

function findRoot(from) {
  let dir = from;
  for (;;) {
    const pkg = join(dir, 'package.json');
    if (existsSync(pkg) && JSON.parse(readFileSync(pkg, 'utf8')).name === 'brand-h5') return dir;
    const up = dirname(dir);
    if (up === dir) throw new Error('找不到 brand-h5 包根');
    dir = up;
  }
}

const ROOT = findRoot(dirname(fileURLToPath(import.meta.url)));
const BRAND = process.env.BRAND || 'liren';

// 模块顶层不得碰浏览器全局：node 里没有 window / document，import 成功即证明
assert.equal(typeof globalThis.window, 'undefined');
const ics = await import(pathToFileURL(join(ROOT, 'src/moments/ics.ts')).href);

const extras = JSON.parse(readFileSync(resolve(ROOT, 'brands', BRAND, 'content', 'extras.json'), 'utf8'));
const sch = extras.special.schedule;
const NOW = new Date(Date.UTC(2026, 9, 1, 1, 0, 0));

const build = (items = sch.items) =>
  ics.buildIcs({
    calendarName: sch.calendarName,
    eventPrefix: sch.eventPrefix,
    eventNote: sch.eventNote,
    statusWord: sch.status,
    items,
    uidDomain: `${BRAND}.brand-h5`,
    now: NOW,
  });

const text = build();
const unfold = (s) => s.replace(/\r\n /g, '');
const logical = unfold(text).split('\r\n').slice(0, -1);
const prop = (name) => logical.filter((l) => l.startsWith(name));

test('行尾一律 CRLF，文件以 CRLF 结尾，没有孤立的 LF / CR', () => {
  assert.ok(text.endsWith('\r\n'));
  assert.equal(text.replace(/\r\n/g, '').match(/[\r\n]/), null);
});

test('每个物理行不超过 75 个字节，且折行不劈开 UTF-8 字符', () => {
  for (const line of text.split('\r\n')) {
    const bytes = Buffer.byteLength(line, 'utf8');
    assert.ok(bytes <= 75, `超长 ${bytes}：${line}`);
    assert.ok(!line.includes('\uFFFD'));
  }
  // 确实发生了折行（中文描述必然超过 75 字节）
  assert.ok(/\r\n /.test(text), '应有折行');
});

test('VCALENDAR / VTIMEZONE 骨架完整', () => {
  assert.equal(logical[0], 'BEGIN:VCALENDAR');
  assert.equal(logical.at(-1), 'END:VCALENDAR');
  assert.ok(logical.includes('VERSION:2.0'));
  assert.equal(prop('PRODID:').length, 1);
  assert.ok(logical.includes('BEGIN:VTIMEZONE'));
  assert.ok(logical.includes('TZID:Asia/Shanghai'));
  assert.ok(logical.includes('TZOFFSETTO:+0800'));
  assert.ok(logical.includes('END:VTIMEZONE'));
});

test('每条日程一个 VEVENT，UID 唯一，时间带 TZID 且与内容包一致', () => {
  assert.equal(prop('BEGIN:VEVENT').length, sch.items.length);
  assert.equal(prop('END:VEVENT').length, sch.items.length);
  const uids = prop('UID:');
  assert.equal(new Set(uids).size, sch.items.length);
  const starts = prop('DTSTART;TZID=Asia/Shanghai:');
  const ends = prop('DTEND;TZID=Asia/Shanghai:');
  sch.items.forEach((it, i) => {
    const d = it.date.replace(/-/g, '');
    assert.equal(starts[i], `DTSTART;TZID=Asia/Shanghai:${d}T${it.start.replace(':', '')}00`);
    assert.equal(ends[i], `DTEND;TZID=Asia/Shanghai:${d}T${it.end.replace(':', '')}00`);
  });
  assert.equal(
    prop('DTSTAMP:').every((l) => l === 'DTSTAMP:20261001T010000Z'),
    true,
  );
});

test('SUMMARY 以前缀起头；DESCRIPTION 写明说明与「拟定」；状态为暂定', () => {
  const sums = prop('SUMMARY:');
  sch.items.forEach((it, i) => assert.equal(sums[i], `SUMMARY:${ics.escapeText(sch.eventPrefix + it.title)}`));
  for (const d of prop('DESCRIPTION:')) {
    assert.ok(d.includes(ics.escapeText(sch.eventNote)), d);
    assert.ok(d.includes('拟定'), d);
  }
  assert.equal(prop('STATUS:TENTATIVE').length, sch.items.length);
});

test('TEXT 转义：逗号、分号、反斜杠、换行', () => {
  assert.equal(ics.escapeText('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne');
  const t = build([
    {
      id: 'x 1',
      date: '2026-10-10',
      start: '09:00',
      end: '10:00',
      title: 'A,B',
      venue: 'V;1',
      note: null,
    },
  ]);
  const u = unfold(t);
  assert.ok(u.includes('SUMMARY:' + ics.escapeText(sch.eventPrefix) + 'A\\,B'));
  assert.ok(u.includes('LOCATION:V\\;1'));
  assert.ok(u.includes('UID:x-1@'), 'UID 里的空格应被替换');
});

test('结束不晚于开始、格式不对都直接抛错', () => {
  assert.throws(() =>
    build([
      {
        id: 'a',
        date: '2026-10-10',
        start: '10:00',
        end: '10:00',
        title: 't',
        venue: 'v',
      },
    ]),
  );
  assert.throws(() =>
    build([
      {
        id: 'a',
        date: '2026/10/10',
        start: '10:00',
        end: '11:00',
        title: 't',
        venue: 'v',
      },
    ]),
  );
});

test('折行边界：恰好 75 字节不折，76 字节折一次', () => {
  assert.equal(ics.foldLine('x'.repeat(75)), 'x'.repeat(75));
  assert.equal(ics.foldLine('x'.repeat(76)), 'x'.repeat(75) + '\r\n x');
  const zh = ics.foldLine('中'.repeat(30)); // 90 字节
  for (const l of zh.split('\r\n')) assert.ok(Buffer.byteLength(l) <= 75);
  assert.equal(zh.replace(/\r\n /g, ''), '中'.repeat(30));
});

test('文件名不含路径与保留字符', () => {
  const n = ics.icsFileName(sch.calendarName);
  assert.match(n, /\.ics$/);
  assert.doesNotMatch(n, /[\\/:*?"<>|\s（）()]/);
});
