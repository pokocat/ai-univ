// 附赠小样 · 体重管理特辑：可撕的铂银复合膜小袋。
//
// 手势：沿顶部易撕线从易撕口（右）向左拖，撕口跟着手指走——拉条一节节翘起、卷离，
// 齿孔一个个断开；松手不到 55% 缓回原位（指数缓出，无回弹）；过了 55% 就撕到底，
// 拉条飞走，展期日程作为印刷插页从袋口滑出。
// 等效路径：一枚真按钮（extras.special.sachet.tearAction）做同一件事，键盘与读屏都能用。
// 减少动态效果：直接呈现撕开后的终态，不播任何过程。
//
// 撕开后「存到本机日历」：本机生成 .ics（见 ./ics.ts），Blob 下载；之后才印「已存到本机」。
// 微信内置浏览器下载文件不可靠——如实提示换系统浏览器，不假装存好了。
// 文案只取 extras.special：撕开后只印「已存到本机」这类事实，绝不写「已报名」，也不出现席位数。
//
// 服务端渲染安全：模块顶层不碰 window / document / sessionStorage。
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { fact, identity } from '../brand';
import { extras, courseById } from '../data/pack';
import { isWeChat, prefersReducedMotion } from '../app/env';
import { InciRun, Link, Stamp, Icon } from '../ui';
import { buildIcs, icsFileName, ICS_MIME } from './ics';
import { tween } from './motion';
import { SACHET_KEYS, readFlag, writeFlag } from './state';
import { textureVars } from './textures';
import './sachet.css';

export { MOMENT_STORAGE_PREFIX, clearMomentState } from './state';

/** 膜面位图（铂银复合膜 + 封口压纹带）：模块加载时取一次，取不到就退回平印铂色 */
const TEX = textureVars(['foil', 'foil-crimp']);
const HAS_FOIL = '--tex-foil' in TEX;

/** 拉条分成多少节：节越多卷得越圆，每一节对应一个齿孔 */
const N = 28;
/** 松手时撕过这个比例就撕到底 */
const COMMIT = 0.55;
/** 卷曲：撕下的那段绕竖轴朝人卷起——第一节起翘的角度、每节递增、最大角度（度） */
const CURL_START = 8;
const CURL_STEP = 15;
const CURL_MAX = 330;
/** 撕下的那段同时微微抬起：每节抬高、最多抬高（px），以及每节的平面内倾角（度） */
const LIFT_STEP = 1.4;
const LIFT_MAX = 12;
const TILT_STEP = 0.5;
const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

type Phase = 'sealed' | 'dragging' | 'settling' | 'tearing' | 'off' | 'open';

// 撕口的毛边：确定性伪随机，服务端与浏览器画出同一条边
const TORN_EDGE = (() => {
  let seed = 34;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const pts: string[] = [];
  const steps = 56;
  for (let i = 0; i <= steps; i++) {
    const x = ((i / steps) * 100).toFixed(2);
    const y = (i % 2 === 0 ? 0.4 + rnd() * 1.2 : 2 + rnd() * 1.8).toFixed(2);
    pts.push(`${x}% ${y}px`);
  }
  return `polygon(${pts.join(', ')}, 100% 100%, 0% 100%)`;
})();

function weekday(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function md(date: string): string {
  return date.slice(5).replace('-', '.');
}

/** 拉条每一节的位置：从撕口（铰点）往右一节节接起来，每节绕竖轴多转一点，卷成一个朝人的卷 */
interface Seg {
  dx: number;
  dy: number;
  dz: number;
  deg: number;
  tilt: number;
  shade: number;
}
function curl(k: number, w: number): Seg[] {
  const out: Seg[] = [];
  let x = (N - k) * w;
  let z = 0;
  for (let m = 0; m < k; m++) {
    const deg = Math.min(CURL_MAX, CURL_START + m * CURL_STEP);
    const i = N - k + m;
    const rad = (deg * Math.PI) / 180;
    // 受光：正对时亮，侧过去、翻到背面时暗
    const shade = Math.min(0.5, (1 - Math.cos(rad)) * 0.22 + (Math.sin(rad) < 0 ? 0.12 : 0));
    out.push({
      dx: x - i * w,
      dy: -Math.min(LIFT_MAX, m * LIFT_STEP),
      dz: z,
      deg,
      tilt: -Math.min(8, m * TILT_STEP),
      shade,
    });
    x += w * Math.cos(rad);
    z += w * Math.sin(rad);
  }
  return out;
}

export function SampleSachet() {
  const special = extras.special;
  const s = special.sachet;
  const sch = special.schedule;
  const conf = fact('expo.conference');

  const [phase, setPhase] = useState<Phase>(() =>
    // 减少动效只去掉动画、不替用户撕开：初始一律封口，撕没撕只看本会话的真实记录（撕的那一下在 complete 里瞬间完成）
    readFlag(SACHET_KEYS.torn) ? 'open' : 'sealed',
  );
  const [p, setP] = useState(0);
  const [width, setWidth] = useState(300);
  const [saved, setSaved] = useState(() => readFlag(SACHET_KEYS.saved));
  const [saveError, setSaveError] = useState(false);
  const [wechat, setWechat] = useState(false);

  const stripRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const insertRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const drag = useRef<{ id: number; x0: number; p0: number } | null>(null);
  const cancelTween = useRef<(() => void) | null>(null);
  const flipFrom = useRef<number | null>(null);
  const focusAfter = useRef(false);
  const timers = useRef<number[]>([]);
  const pRef = useRef(0);
  const setProg = (v: number) => {
    pRef.current = v;
    setP(v);
  };

  const live = phase !== 'open';

  useEffect(() => {
    setWechat(isWeChat());
    return () => {
      cancelTween.current?.();
      timers.current.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  // 量拉条宽度：卷曲按像素接节
  useLayoutEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const read = () => setWidth(el.getBoundingClientRect().width || 300);
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [live]);

  // 第一次滚到眼前时，易撕口自己翘一下又落回去——告诉人「这里能撕」。每会话一次
  useEffect(() => {
    if (phase !== 'sealed' || readFlag(SACHET_KEYS.nudged) || prefersReducedMotion()) return;
    // 盯的是拉条本身：它整条进入视口上方四分之三时才演示，别在屏幕最底下翘给没人看
    const el = stripRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        writeFlag(SACHET_KEYS.nudged, true);
        const t = window.setTimeout(() => {
          if (drag.current || pRef.current > 0) return;
          cancelTween.current = tween(0, 3.2 / N, 420, setProg, () => {
            cancelTween.current = tween(3.2 / N, 0, 520, setProg);
          });
        }, 450);
        timers.current.push(t);
      },
      { threshold: 1, rootMargin: '0px 0px -25% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [phase]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  function openNow(userInitiated: boolean) {
    if (userInitiated) {
      writeFlag(SACHET_KEYS.torn, true);
      focusAfter.current = true;
    }
    setPhase('open');
  }

  /** 撕到底：补完拉条 → 拉条飞走 → 插页滑出 */
  function complete() {
    cancelTween.current?.();
    drag.current = null;
    if (prefersReducedMotion()) {
      openNow(true);
      return;
    }
    setPhase('tearing');
    cancelTween.current = tween(pRef.current, 1, 200, setProg, () => {
      setPhase('off');
      later(() => {
        flipFrom.current = bodyRef.current?.getBoundingClientRect().top ?? null;
        openNow(true);
      }, 340);
    });
  }

  function settle() {
    cancelTween.current?.();
    drag.current = null;
    setPhase('settling');
    cancelTween.current = tween(pRef.current, 0, 360, setProg, () => setPhase('sealed'));
  }

  function onDown(e: PointerEvent) {
    if (phase !== 'sealed' && phase !== 'settling') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    cancelTween.current?.();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* 指针已失效（极少见）：不捕获也照样能拖，只是手指滑出热区会中断 */
    }
    drag.current = { id: e.pointerId, x0: e.clientX, p0: pRef.current };
    setPhase('dragging');
  }

  function onMove(e: PointerEvent) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const next = Math.max(0, Math.min(1, d.p0 + (d.x0 - e.clientX) / width));
    setProg(next);
    if (next >= 0.985) complete();
  }

  function onUp(e: PointerEvent) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (pRef.current >= COMMIT) complete();
    else settle();
  }

  // 插页滑出：袋子往下退、插页往上抽，裁切线始终贴着袋口（逐帧算，不靠两条过渡碰巧对齐）
  useLayoutEffect(() => {
    if (phase !== 'open') return;
    const body = bodyRef.current;
    const ins = insertRef.current;
    const from = flipFrom.current;
    flipFrom.current = null;
    const done = () => {
      if (!focusAfter.current) return;
      focusAfter.current = false;
      headRef.current?.focus({ preventScroll: from !== null });
    };
    if (from === null || !body || !ins) {
      done();
      return;
    }
    const bodyTop = body.getBoundingClientRect().top;
    const insTop = ins.getBoundingClientRect().top;
    const h = ins.offsetHeight;
    const delta = from - bodyTop; // 袋子起点相对终点（负值：终点更低）
    const lift = from - insTop; // 插页起点：顶边贴着原来的袋口
    const bodyLocal = bodyTop - insTop; // 终态时袋口在插页坐标里的位置
    const apply = (e: number) => {
      const bt = delta * (1 - e);
      const it = lift * (1 - e);
      const mouth = bodyLocal + bt - it;
      body.style.transform = e >= 1 ? '' : `translateY(${bt.toFixed(2)}px)`;
      ins.style.transform = e >= 1 ? '' : `translateY(${it.toFixed(2)}px)`;
      ins.style.clipPath = e >= 1 ? '' : `inset(0 0 ${Math.max(0, h - mouth).toFixed(2)}px 0)`;
    };
    apply(0);
    cancelTween.current = tween(0, 1, 900, apply, done);
  }, [phase]);

  function saveToCalendar() {
    setSaveError(false);
    try {
      const text = buildIcs({
        calendarName: sch.calendarName,
        eventPrefix: sch.eventPrefix,
        eventNote: sch.eventNote,
        statusWord: sch.status,
        items: sch.items,
        uidDomain: `${identity.id}.brand-h5`,
        now: new Date(),
      });
      const url = URL.createObjectURL(new Blob([text], { type: ICS_MIME }));
      const a = document.createElement('a');
      a.href = url;
      a.download = icsFileName(sch.calendarName);
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      writeFlag(SACHET_KEYS.saved, true);
      setSaved(true);
    } catch {
      setSaveError(true);
    }
  }

  // —— 拉条的每一节与每个齿孔 ——
  const k = live ? Math.round(p * N) : 0;
  const w = width / N;
  const chain = curl(k, w);
  const segs = Array.from({ length: N }, (_, i) => {
    const m = i - (N - k);
    const c = m >= 0 ? chain[m] : null;
    // 三层膜面（压纹带位图 / 复合膜位图 / 平印铂色）都按整条拉条排，每节只露自己那一段：
    // 压纹带按原始比例横向平铺（高度撑满），复合膜与平印铂色按整条宽度铺
    const off = `${(-i * w).toFixed(2)}px 0`;
    const style: Record<string, string> = {
      left: `${(i * 100) / N}%`,
      width: `calc(${100 / N}% + 0.5px)`,
      backgroundPosition: `${off}, ${off}, ${off}`,
      backgroundSize: `auto 100%, ${width.toFixed(2)}px auto, ${width.toFixed(2)}px 100%`,
      WebkitMaskPosition: `${(-i * w).toFixed(2)}px 0, 0 100%`,
      maskPosition: `${(-i * w).toFixed(2)}px 0, 0 100%`,
    };
    if (c) {
      style.transform =
        `translate3d(${c.dx.toFixed(2)}px, ${c.dy.toFixed(2)}px, ${c.dz.toFixed(2)}px) ` +
        `rotateZ(${c.tilt.toFixed(2)}deg) rotateY(${-c.deg}deg)`;
      style['--shade'] = c.shade.toFixed(3);
    }
    return (
      <i key={i} class={['sachet__seg', i === N - 1 && 'sachet__seg--notch'].filter(Boolean).join(' ')} style={style} />
    );
  });
  const dots = Array.from({ length: N - 1 }, (_, j) => {
    const b = j + 1; // 第 b 节与第 b-1 节之间的连接点
    const cls = b > N - k ? 'is-split' : b === N - k && k > 0 ? 'is-front' : '';
    return <i key={b} class={['sachet__dot', cls].filter(Boolean).join(' ')} style={{ left: `${(b * 100) / N}%` }} />;
  });

  const days = sch.items.reduce<{ date: string; items: typeof sch.items }[]>((acc, it) => {
    const last = acc[acc.length - 1];
    if (last && last.date === it.date) last.items.push(it);
    else acc.push({ date: it.date, items: [it] });
    return acc;
  }, []);

  const stampMark = () => (
    <span class="stamp stamp--saved sachet__saved" title={s.tornStamp}>
      {s.tornStamp}
    </span>
  );

  return (
    <div class={['sachet', `sachet--${phase}`, HAS_FOIL && 'has-tex'].filter(Boolean).join(' ')} style={TEX}>
      <figure
        class="sachet__pouch"
        aria-label={`附赠小样：${s.title}（${phase === 'open' ? '已撕开，日程插页已取出' : '封口'}）`}
      >
        {live ? (
          <div class="sachet__top" aria-hidden="true">
            <div class="sachet__strip" ref={stripRef}>
              {segs}
            </div>
            <div class="sachet__perf">{dots}</div>
            <div
              class="sachet__hit"
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onLostPointerCapture={onUp}
            />
          </div>
        ) : null}

        {phase === 'open' ? (
          <div class="sachet__insert-wrap" ref={insertRef}>
            <section class="insert on-pearl" aria-labelledby="sachet-insert-title">
              <header class="insert__head">
                <h3 class="insert__title" id="sachet-insert-title" tabIndex={-1} ref={headRef}>
                  {sch.calendarName}
                </h3>
              </header>
              <p class="insert__notice">
                <Stamp kind="拟定" />
                <span>{sch.notice}</span>
              </p>
              <ol class="insert__days" aria-label="展期日程">
                {days.map((d) => (
                  <li key={d.date} class="insert__day">
                    <p class="insert__date">
                      <span class="insert__flag num">{md(d.date)}</span>
                      <span>{weekday(d.date)}</span>
                    </p>
                    <ol class="insert__items">
                      {d.items.map((it) => {
                        const course = it.courseId !== null ? courseById(it.courseId) : undefined;
                        return (
                          <li key={it.id} class="insert__item">
                            <p class="insert__when">
                              <span class="insert__time num">
                                {it.start}
                                <span aria-hidden="true">–</span>
                                <span class="sr-only">至</span>
                                {it.end}
                              </span>
                              <Stamp kind="拟定" />
                            </p>
                            <div class="insert__body">
                              <p class="insert__name">{it.title}</p>
                              <p class="insert__venue">{it.venue}</p>
                              {it.note && <p class="insert__venue">{it.note}</p>}
                              {course && (
                                <Link class="insert__go" to={`/course/${encodeURIComponent(String(course.id))}`}>
                                  看课程详情
                                  <Icon name="chevronRight" size={16} />
                                </Link>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </li>
                ))}
              </ol>
              <div class="insert__foot">
                <p class="insert__fine">{special.disclaimer}</p>
                {saved && <div class="insert__mark">{stampMark()}</div>}
              </div>
            </section>
          </div>
        ) : null}

        <div class="sachet__body" ref={bodyRef} style={live ? undefined : { clipPath: TORN_EDGE }}>
          {live && (
            <>
              <span class="sachet__mouth" style={{ width: `${(k * 100) / N}%` }} aria-hidden="true" />
              <span class="sachet__tearlabel" aria-hidden="true">
                <Icon name="chevronLeft" size={14} />
                易撕口
              </span>
            </>
          )}
          <div class="sachet__crimp sachet__crimp--bottom" aria-hidden="true" />
          <div class="sachet__print">
            <p class="sachet__title">
              {s.title}
              {s.sample && <Stamp kind="样" />}
            </p>
            <p class="sachet__sub">{s.dek}</p>
            <div class="sachet__inci">
              <InciRun lead="成分" items={s.ingredients.map((x) => x.label)} />
            </div>
            <div class="sachet__usage">
              <p class="sachet__usage-head">用法</p>
              <ol>
                {s.usage.map((u, i) => (
                  <li key={u}>
                    <span class="num" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span>{u}</span>
                  </li>
                ))}
              </ol>
            </div>
            <p class="sachet__fine">
              同期 · {conf.value}
              {conf.status === '拟定' && <Stamp kind="拟定" />}
            </p>
          </div>
        </div>
      </figure>

      <div class="sachet__act">
        {phase !== 'open' ? (
          <>
            <p class="sachet__hint" aria-hidden="true">
              <Icon name="scissors" size={18} />
              {s.tearHint}：按住易撕口向左拖
            </p>
            <button
              type="button"
              class="btn btn--ghost sachet__btn"
              onClick={complete}
              disabled={phase === 'tearing' || phase === 'off'}
            >
              <Icon name="scissors" size={18} />
              {s.tearAction}
            </button>
          </>
        ) : wechat ? (
          <p class="sachet__note" role="note">
            <Icon name="calendar" size={18} />
            <span>
              微信里下载文件不可靠，日历文件存不下来。点右上角「···」选择在浏览器中打开本页，再点「存到本机日历」。
            </span>
          </p>
        ) : (
          <button
            type="button"
            class={['btn', saved ? 'btn--ghost' : 'btn--action', 'sachet__btn'].join(' ')}
            onClick={saveToCalendar}
          >
            <Icon name="calendar" size={18} />
            {saved ? '再生成一次日历文件' : '存到本机日历'}
          </button>
        )}
        <p class="sachet__status" role="status">
          {phase === 'open' && saved && !wechat && (
            <>
              <span>
                {s.tornStamp}：在下载或文件里打开这个日历文件（.ics），由手机日历确认加入。存到本机不等于报名。
              </span>
            </>
          )}
          {phase === 'open' && saveError && <span>日历文件没有生成。再点一次；仍不行，换系统浏览器打开本页。</span>}
        </p>
      </div>
    </div>
  );
}
