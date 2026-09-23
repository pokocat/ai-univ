// 本期：一只被拆开的护肤包装盒。
// 正面（本期）→ 侧板「本期所含」→ 背面「使用方法」→ 附赠小样 → 展会信息 → 盒底。
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { HomeModule } from '../brand';
import { identity, h5, facts } from '../brand';
import { homeView, type HomeView } from '../data/pack';
import { firstTimeThisSession, prefersReducedMotion } from '../app/env';
import {
  Panel,
  InciList,
  InciRun,
  FactList,
  HandoffSheet,
  CropMarks,
  DieLine,
  Stamp,
  SheetStamp,
  Link,
  Icon,
  type InciItem,
  type IconName,
} from '../ui';
import { SampleSachet } from '../moments/SampleSachet';
import type { ScreenProps } from '../app/App';
import './home.css';

// 示意图（开窗、展馆）：文件还不存在时开窗退回黛色底、展馆图整块不出，图注照旧
const PHOTO = import.meta.glob('../assets/photo/{window,hall}.{jpg,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const photo = (k: string): string | undefined => PHOTO[`../assets/photo/${k}.webp`] ?? PHOTO[`../assets/photo/${k}.jpg`];
const windowSrc = photo('window');
const hallSrc = photo('hall');

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  // 焦点跟过去，读屏与键盘用户也落在侧板上
  el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}

export default function Home(_props: ScreenProps) {
  const view = homeView();
  const [intro, setIntro] = useState(false);
  const [handoff, setHandoff] = useState(false);

  useEffect(() => {
    // 开盒仪式：每个会话只播一次；减少动态效果时直接呈现终态
    if (!prefersReducedMotion() && firstTimeThisSession('carton-open')) setIntro(true);
  }, []);

  const blocks: Record<HomeModule, () => JSX.Element> = {
    'carton-front': () => <CartonFront intro={intro} />,
    'side-contents': () => <SideContents view={view} />,
    'back-usage': () => <BackUsage onOpenHandoff={() => setHandoff(true)} />,
    'sample-sachet': () => <SachetSlot />,
    'expo-facts': () => <ExpoFacts />,
    'carton-bottom': () => <CartonBottom />,
  };

  return (
    <main class={['screen', 'screen--home', intro && 'is-intro'].filter(Boolean).join(' ')} data-screen="home" id="main">
      {h5.modules.home.map((m) => (
        <div key={m} class="home-module" data-module={m}>
          {blocks[m]()}
        </div>
      ))}
      <HandoffSheet open={handoff} onClose={() => setHandoff(false)} context="使用方法 · 第 2 步" />
    </main>
  );
}

/* —— 盒正面：首屏 62svh —— */
function CartonFront({ intro }: { intro: boolean }) {
  const img = h5.images.window;
  return (
    <section class="carton-front on-carton" aria-labelledby="wordmark">
      <div class="cf-face">
        <CropMarks offset={6} size={12} />
        <div class="cf-top">
          <p class="cf-batch">
            <span class="latin-wide cf-batch__no">{identity.issue.latin}</span>
            <span class="cf-batch__dot" aria-hidden="true">
              ·
            </span>
            <span>{identity.issue.label}</span>
          </p>
          <SheetStamp class="cf-stamp" />
        </div>

        <figure class="cf-window">
          <div class={['cf-window__cut', !windowSrc && 'is-empty'].filter(Boolean).join(' ')}>
            {windowSrc ? (
              <img src={windowSrc} alt={img.alt} decoding="async" fetchpriority="high" width={600} height={800} />
            ) : (
              <span class="sr-only">{img.alt}</span>
            )}
          </div>
          <figcaption class="cf-window__caption">{img.credit}</figcaption>
        </figure>

        <h1 class="cf-wordmark" id="wordmark">
          <span class={['cf-wordmark__foil', intro && 'is-sweep'].filter(Boolean).join(' ')} data-text={identity.name}>
            {identity.name}
          </span>
          <span class="cf-wordmark__note">（{identity.nameNote}）</span>
        </h1>
        <p class="cf-audience">{identity.audienceLabel}的会员社群</p>
      </div>

      <DieLine kind="fold" class="cf-fold" />

      <div class="cf-tongue">
        <TuckFlap />
        <button type="button" class="btn btn--action cf-cta" onClick={() => scrollToId('contents')}>
          查看本期所含
          <Icon name="chevronDown" size={18} />
        </button>
      </div>
    </section>
  );
}

/* 盒舌：从折线垂下的插舌刀版——两肩各切一道斜口（插舌卡住盒身的锁位），
   肩下一道插舌折线，底边两角是插舌的大圆弧。按固定画布画，宽度随屏拉伸，线宽不随之变粗 */
function TuckFlap() {
  return (
    <svg class="cf-flap" viewBox="0 0 300 88" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path
        class="cf-flap__body"
        d="M0 0 V9 L10 15 V58 C10 78 20 87 42 87 H258 C280 87 290 78 290 58 V15 L300 9 V0 Z"
      />
      <path class="cf-flap__cut" d="M0 0 V9 L10 15 V58 C10 78 20 87 42 87 H258 C280 87 290 78 290 58 V15 L300 9 V0" />
      <path class="cf-flap__fold" d="M10 15 H290" />
    </svg>
  );
}

/* —— 侧板：本期所含（单一字号） —— */
function SideContents({ view }: { view: HomeView }) {
  // 每一行都能追到对应的一块：本页锚点就滚过去，站内路由就压栈
  const items: InciItem[] = view.contents.map((r) => ({
    name: r.label,
    note: r.detail,
    count: r.count === null ? undefined : { value: r.count, sample: r.sample, pad: 2 },
    ...(r.target?.startsWith('#')
      ? { onClick: () => scrollToId(r.target!.slice(1)) }
      : r.target
        ? { to: r.target }
        : {}),
  }));

  return (
    <Panel face="side" id="contents" title="本期所含" latin="Ingredients">
      <InciRun lead="成分" items={view.runItems} />
      <InciList class="side-inci" items={items} label="本期所含清单" />

      <h3 class="side-sub" id="courses">
        课程排期
        <span class="caps" aria-hidden="true">
          Schedule
        </span>
      </h3>
      {view.courses.length ? (
        <ol class="schedule" aria-label="课程排期">
          {view.courses.map((c) => (
            <li key={c.id}>
              <Link class="schedule__row" to={`/course/${encodeURIComponent(c.id)}`}>
                <span class="schedule__date num">{c.md}</span>
                <span class="schedule__body">
                  <b>{c.title}</b>
                  {c.meta && <span class="schedule__meta">{c.meta}</span>}
                </span>
                <Icon name="chevronRight" size={18} class="inci__go" />
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p class="schedule__empty">本期排期整理中，先看「使用方法」了解怎么加入。</p>
      )}
      <p class="side-foot">
        <Stamp kind="样" /> 计数与排期为演示数据，按样例课程包计算
      </p>
    </Panel>
  );
}

/* —— 背面：使用方法（真有顺序，才编号） —— */
function BackUsage({ onOpenHandoff }: { onOpenHandoff: () => void }) {
  const steps: { title: string; body: string; icon: IconName; go: { to?: string; onClick?: () => void; label: string } }[] = [
    { title: '选方案', body: '在「方案」里比较会员方案，价格为样例。', icon: 'select', go: { to: '/plans', label: '去看方案' } },
    {
      title: '小程序开通',
      body: '登录与支付在小程序内完成（筹备中），本页不收集信息。',
      icon: 'phone',
      go: { onClick: onOpenHandoff, label: '下转小程序' },
    },
    { title: '顾问拉你进班级群', body: '开通后由顾问添加你，再邀请进本期班级群。', icon: 'group', go: { to: '/join', label: '入群说明' } },
    { title: '上课与权益', body: '按排期上课；权益目录写明哪一档可用。', icon: 'book', go: { to: '/benefits', label: '看权益' } },
  ];
  return (
    <Panel face="back" title="使用方法" latin="Directions">
      <ol class="usage">
        {steps.map((s, i) => (
          <li class="usage__step" key={s.title}>
            <span class="usage__no num" aria-hidden="true">
              {i + 1}
            </span>
            <div class="usage__body">
              <p class="usage__title">
                <Icon name={s.icon} size={20} />
                {s.title}
              </p>
              <p class="usage__text">{s.body}</p>
              {s.go.to ? (
                <Link class="usage__go" to={s.go.to}>
                  {s.go.label}
                  <Icon name="arrowRight" size={16} />
                </Link>
              ) : (
                <button type="button" class="usage__go" onClick={s.go.onClick} aria-haspopup="dialog">
                  {s.go.label}
                  <Icon name="arrowRight" size={16} />
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/* —— 附赠小样（撕开是第二阶段） —— */
function SachetSlot() {
  return (
    <Panel face="side" id="sample" title="附赠小样" latin="Sample enclosed" class="sachet-panel">
      <SampleSachet />
    </Panel>
  );
}

/* —— 展会信息：拟定的强制附免责条；上方一张印在侧板上的展馆示意图 —— */
function ExpoFacts() {
  const img = h5.images.hall;
  return (
    <Panel face="side" title="展会信息" latin="Expo" class="facts-panel" foldTop={false}>
      {hallSrc && img && (
        <figure class="expo-photo">
          <div class="expo-photo__print">
            <img src={hallSrc} alt={img.alt} loading="lazy" decoding="async" width={1280} height={853} />
          </div>
          <figcaption class="expo-photo__caption">{img.credit}</figcaption>
        </figure>
      )}
      <FactList items={facts('expo.')} />
    </Panel>
  );
}

/* —— 盒底：收尾 —— */
function CartonBottom() {
  return (
    <section class="carton-bottom on-carton" aria-label="本期收尾">
      <DieLine kind="fold" ticks class="cb-fold" />
      <div class="cb-inner">
        <p class="cb-line">选一个方案，开通后顾问拉你进班级群。</p>
        <Link class="btn btn--action cb-cta" to="/plans">
          看会员方案
          <Icon name="arrowRight" size={18} />
        </Link>
        <dl class="cb-print">
          <div>
            <dt>批号</dt>
            <dd class="num">{identity.issue.batch}</dd>
          </div>
          <div>
            <dt>运营</dt>
            <dd>
              {identity.operator.name}
              {identity.operator.placeholder && <span class="cb-ph">占位</span>}
            </dd>
          </div>
          <div>
            <dt>说明</dt>
            <dd>
              {identity.demoRibbon}。盖「样」的数字为演示数据，标「拟定」的以主办方公布为准，开窗与展馆图片为示意生成图像。
            </dd>
          </div>
        </dl>
        <p class="cb-mark" aria-hidden="true">
          {identity.name}
        </p>
      </div>
    </section>
  );
}
