// 课程详情：一张折起来的产品说明书。
// 封面印在黛蓝盒面上（只有文字封面，没有图片字段）；展开是珠光白的说明页，按折线分成【用法用量】【主题】【注意事项】，
// 同一字号，层级只靠字重与方头括号。报名人数、阅读数这类读数一律不渲染。
import { identity } from '../brand';
import { extras, courseById, courseWhen, isSampleField } from '../data/pack';
import { back } from '../app/router';
import type { ScreenProps } from '../app/App';
import { Screen, Blank, Link, Num, Stamp, HandoffButton, CropMarks, DieLine, Icon } from '../ui';
import './course.css';

type Course = NonNullable<ReturnType<typeof courseById>>;

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** 「2026-10-08」→「2026.10.08」与星期；只按日期字符串算，不看设备时区 */
function dayOf(date: string): { dotted: string; week: string } {
  const [y, m, d] = date.split('-').map(Number);
  return { dotted: date.replace(/-/g, '.'), week: WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] };
}

/** 状态决定动作名：没开播是预约，直播中是观看，已结束且有回放是看回放 */
function verbOf(c: Course): string {
  if (c.status === '直播中') return '观看';
  if (c.status === '已结束' || c.status === '已过期') return c.replay_ready ? '看回放' : '查看';
  return '预约';
}

export default function CourseDetail({ route }: ScreenProps) {
  const c = courseById(route.params.id ?? '');
  if (!c) {
    return (
      <Screen name="course" surface="pearl">
        <div class="lf-missing">
          <Blank
            title="没有找到这门课"
            hint="这门课不在本期排期里，可能已调整或链接有误。回「本期」看完整的课程排期。"
            action={
              <Link class="btn btn--ghost" to="/">
                回本期看排期
                <Icon name="arrowRight" size={18} />
              </Link>
            }
          />
        </div>
      </Screen>
    );
  }
  return (
    <Screen name="course" surface="carton">
      <article class="lf" aria-labelledby="lf-title">
        <Cover c={c} />
        <div class="lf-sheet on-pearl">
          <Usage c={c} />
          {c.summary && (
            <section class="lf-fold" aria-labelledby="lf-h-topic">
              <DieLine kind="fold" ticks class="lf-fold__line" />
              <LeafHead id="lf-h-topic">主题</LeafHead>
              <p class="lf-text">{c.summary}</p>
            </section>
          )}
          <Cautions c={c} />
          <Imprint c={c} />
        </div>
      </article>
    </Screen>
  );
}

/** 说明书的方头括号栏目名：括号是印刷记号，读屏跳过 */
function LeafHead({ id, children }: { id: string; children: string }) {
  return (
    <h2 class="lf-h" id={id}>
      <span aria-hidden="true">【</span>
      {children}
      <span aria-hidden="true">】</span>
    </h2>
  );
}

/* —— 封面：文字封面 + 课程名 + 主讲 + 印记 —— */
function Cover({ c }: { c: Course }) {
  const lines = (c.cover_text ?? c.course_type).split('\n').filter(Boolean);
  const special = !!c.tags?.includes(extras.special.tag);
  const who = [c.speaker, c.speaker_title].filter(Boolean).join(' · ');
  return (
    <header class="lf-cover">
      <div class="lf-art" aria-hidden="true">
        <CropMarks offset={4} size={12} />
        {lines.map((l) => (
          <span class="lf-art__line" key={l}>
            {l}
          </span>
        ))}
      </div>

      <DieLine kind="fold" class="lf-cover__fold" />

      <h1 class="lf-title" id="lf-title">
        {c.title}
      </h1>
      {who && (
        <p class="lf-by">
          {who}
          {isSampleField('courses[].speaker') && <Stamp kind="样" />}
        </p>
      )}
      <p class="lf-marks">
        <span class="lf-mark lf-mark--solid">{c.course_type}</span>
        {special && <span class="lf-mark">{extras.special.tag}</span>}
      </p>
    </header>
  );
}

/* —— 【用法用量】：时间、形式、时长、讲次、状态、标签；末尾是下转小程序 —— */
function Usage({ c }: { c: Course }) {
  const start = courseWhen(c);
  const end = c.ends_at ? courseWhen({ ...c, scheduled_at: c.ends_at }) : null;
  const multiDay = !!end && end.date !== start.date;
  const d0 = dayOf(start.date);
  const timeSample = isSampleField('courses[].scheduled_at');
  const tags = (c.tags ?? []).filter((t) => t !== extras.special.tag);

  return (
    <section class="lf-fold lf-fold--first" aria-labelledby="lf-h-usage">
      <LeafHead id="lf-h-usage">用法用量</LeafHead>
      <dl class="lf-dl">
        <div class="lf-dl__row">
          <dt>日期</dt>
          <dd>
            {multiDay ? (
              <span class="num">
                {d0.dotted} – {end!.md}
              </span>
            ) : (
              <>
                <span class="num">{d0.dotted}</span> {d0.week}
              </>
            )}
            {timeSample && <Stamp kind="样" />}
          </dd>
        </div>
        <div class="lf-dl__row">
          <dt>时间</dt>
          <dd>
            {multiDay ? '首次 ' : ''}
            <span class="num">
              {start.time}
              {end && !multiDay ? ` – ${end.time}` : ''}
            </span>
            <span class="lf-dim">（北京时间）</span>
            {timeSample && <Stamp kind="样" />}
          </dd>
        </div>
        <div class="lf-dl__row">
          <dt>形式</dt>
          <dd>{c.course_type}</dd>
        </div>
        {c.total_minutes !== null && (
          <div class="lf-dl__row">
            <dt>时长</dt>
            <dd>
              <Num value={c.total_minutes} sample={isSampleField('courses[].total_minutes')} /> 分钟
            </dd>
          </div>
        )}
        {c.chapter_count > 0 && (
          <div class="lf-dl__row">
            <dt>讲次</dt>
            <dd>
              <Num value={c.chapter_count} sample={isSampleField('courses[].chapter_count')} /> 讲
            </dd>
          </div>
        )}
        <div class="lf-dl__row">
          <dt>状态</dt>
          <dd>
            {c.status}
            {c.replay_ready && <span class="lf-dim"> · 可看回放</span>}
          </dd>
        </div>
        {tags.length > 0 && (
          <div class="lf-dl__row">
            <dt>标签</dt>
            <dd>{tags.join('、')}</dd>
          </div>
        )}
      </dl>
      <HandoffButton variant="row" context={`课程 · ${c.title}`} class="lf-go">
        <span>下转小程序 · {verbOf(c)}</span>
        <Icon name="chevronRight" size={18} />
      </HandoffButton>
    </section>
  );
}

/* —— 【注意事项】：特辑课程先写合规边界；再写本页不收集信息与演示说明 —— */
function Cautions({ c }: { c: Course }) {
  const special = !!c.tags?.includes(extras.special.tag);
  return (
    <section class="lf-fold" aria-labelledby="lf-h-caution">
      <DieLine kind="fold" ticks class="lf-fold__line" />
      <LeafHead id="lf-h-caution">注意事项</LeafHead>
      <ul class="lf-list">
        {special && <li>{extras.special.disclaimer}</li>}
        <li>{identity.handoff.note}；预约、观看与回放都在小程序内完成。</li>
        <li>
          <Stamp kind="样" class="lf-list__stamp" />
          盖「样」的日期、时间、时长、讲次与主讲均为演示数据；正式排期以小程序内为准。
        </li>
      </ul>
    </section>
  );
}

/* —— 说明书末尾的印刷信息 —— */
function Imprint({ c }: { c: Course }) {
  return (
    <footer class="lf-imprint">
      <DieLine kind="cut" class="lf-imprint__cut" />
      <p class="lf-imprint__print">
        <span>批号</span>
        <span class="num">
          {identity.issue.batch}-{c.id}
        </span>
      </p>
      <button type="button" class="btn btn--quiet lf-back" onClick={back}>
        <Icon name="chevronLeft" size={18} />
        返回
      </button>
    </footer>
  );
}
