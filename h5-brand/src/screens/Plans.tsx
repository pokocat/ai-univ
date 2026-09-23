// 会员方案：同一件产品的三个规格。
// 上半屏是柜台：选规格，盒子的比例与标签跟着变；下面是珠光白侧板「规格说明」，一张单一字号的对照表。
// H5 不登录、不收款：唯一的胭脂动作是「下转小程序 · 开通 <方案>」。
import { useState } from 'preact/hooks';
import { identity } from '../brand';
import { preview, extras, isSampleField } from '../data/pack';
import type { ScreenProps } from '../app/App';
import { Screen, Panel, DieLine, Num, Stamp, HandoffButton, Blank, Link, Icon } from '../ui';
import './plans.css';

type Plan = (typeof preview.plans)[number];
type Benefit = (typeof preview.benefits)[number];

/* —— 身份阶梯 ——
   只列会员档；min_identity ≤ grant_identity 才算「含」。阶梯里查不到的档一律按「不含」处理（最保守）。
   pack.ts 暂未导出阶梯，这里就地写一份（见交付说明里的共享改动建议）。 */
const LADDER = ['游客', '体验官', 'PRO会员', '尊享官', '黑金', 'VIP'];
const rank = (id: string) => LADDER.indexOf(id);
const tierName = (id: string) => extras.terminology.identity[id] ?? id;

function includes(b: Benefit, p: Plan): boolean {
  if (b.min_identity === null) return true;
  const need = rank(b.min_identity);
  const have = rank(p.grant_identity);
  return need >= 0 && have >= need;
}

/** 分 → 元，整数不带小数，千分位 */
function yuan(cents: number): string {
  const whole = Math.floor(cents / 100);
  const rest = cents % 100;
  const head = whole.toLocaleString('en-US');
  return rest ? `${head}.${String(rest).padStart(2, '0')}` : head;
}

/** 「体验装 · 季度」→ 规格名「体验装」+ 期别「季度」 */
function splitName(name: string): { head: string; tail: string } {
  const [head, ...rest] = name.split(/\s*·\s*/);
  return { head, tail: rest.join(' · ') };
}

const SORTED: Plan[] = [...preview.plans].sort((a, b) => a.sort_order - b.sort_order);

function defaultCode(): string | undefined {
  return (SORTED.find((p) => p.recommended) ?? SORTED[0])?.plan_code;
}

/** 深链 #/plans?plan=<code> 预选；只认包里有的 code */
function codeFromUrl(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const q = window.location.hash.split('?')[1];
  if (!q) return undefined;
  const code = new URLSearchParams(q).get('plan');
  return SORTED.some((p) => p.plan_code === code) ? code ?? undefined : undefined;
}

/** 选中的规格写回地址，分享出去就是这一档；不压栈，沿用路由的历史条目 */
function writeUrl(code: string) {
  if (typeof window === 'undefined') return;
  try {
    const url = `${location.pathname}${location.search}#/plans?plan=${encodeURIComponent(code)}`;
    history.replaceState(history.state, '', url);
  } catch {
    /* 某些内嵌浏览器禁止改地址：只是不能分享这一档 */
  }
}

/* —— 盒型：按价位排出大小，授予更高身份的那档是礼盒（更宽、更矮、带盒盖） —— */
interface Geometry {
  w: number;
  h: number;
  dx: number;
  gift: boolean;
}

function geometryOf(p: Plan): Geometry {
  const byPrice = [...SORTED].sort((a, b) => a.price_cents - b.price_cents);
  const i = byPrice.findIndex((x) => x.plan_code === p.plan_code);
  const t = byPrice.length > 1 ? i / (byPrice.length - 1) : 1;
  const base = Math.min(...SORTED.map((x) => rank(x.grant_identity)).filter((r) => r >= 0));
  const gift = rank(p.grant_identity) > base;
  if (gift) return { w: 196, h: 128, dx: 46, gift };
  return { w: Math.round(94 + 38 * t), h: Math.round(134 + 58 * t), dx: Math.round(22 + 14 * t), gift };
}

export default function Plans(_props: ScreenProps) {
  const [code, setCode] = useState<string | undefined>(() => codeFromUrl() ?? defaultCode());
  const plan = SORTED.find((p) => p.plan_code === code) ?? SORTED[0];

  if (!plan) {
    return (
      <Screen name="plans" surface="carton">
        <div class="pl-empty">
          <Blank
            title="本期方案还在整理"
            hint="方案上架前，可以先回「本期」看课程排期与本期所含。"
            action={
              <Link class="btn btn--ghost" to="/">
                回本期
              </Link>
            }
          />
        </div>
      </Screen>
    );
  }

  const choose = (c: string) => {
    setCode(c);
    writeUrl(c);
  };

  return (
    <Screen name="plans" surface="carton">
      <section class="pl-counter" aria-labelledby="pl-title">
        <header class="pl-head">
          <h1 class="pl-title" id="pl-title">
            会员方案
          </h1>
          <p class="pl-lede">同一盒内容，按规格分装：选一个适合自家门店的。</p>
        </header>

        <CartonStage plan={plan} />

        <SizePicker plans={SORTED} value={plan.plan_code} onChange={choose} />

        <PlanLabel plan={plan} />
      </section>

      <Panel face="side" title="规格说明" latin="Specifications" class="pl-spec-panel">
        <SpecTable plans={SORTED} selected={plan.plan_code} onSelect={choose} />
        {/* 批号印在侧板末尾的印刷信息里，不压在标题上方 */}
        <footer class="pl-imprint">
          <DieLine kind="cut" class="pl-imprint__cut" />
          <p class="pl-imprint__print">
            <span>批号</span>
            <span class="num">{identity.issue.batch}</span>
            <span>{identity.issue.label}</span>
          </p>
        </footer>
      </Panel>
    </Screen>
  );
}

/* —— 柜台上的那只盒子：比例随规格变，标签印着规格名与「净含量」 —— */
function CartonStage({ plan }: { plan: Plan }) {
  const g = geometryOf(plan);
  const { head, tail } = splitName(plan.name);
  const style = { '--w': `${g.w}px`, '--h': `${g.h}px`, '--dx': `${g.dx}px` } as Record<string, string>;
  return (
    <div class="pl-stage" aria-hidden="true">
      <div class={['pl-box', g.gift && 'pl-box--gift'].filter(Boolean).join(' ')} style={style}>
        <span class="pl-box__shadow" />
        <span class="pl-box__top" />
        <span class="pl-box__side">
          <span class="pl-box__spine latin-wide">{identity.issue.batch}</span>
        </span>
        <span class="pl-box__front">
          <span class="pl-box__mark">{identity.name}</span>
          <span class="pl-box__label">
            <span class="pl-box__size">{head}</span>
            {tail && <span class="pl-box__term">{tail}</span>}
            <span class="pl-box__net">
              净含量 <Num value={plan.duration_days} sample={isSampleField('plans[].duration_days')} /> 天
            </span>
          </span>
        </span>
      </div>
    </div>
  );
}

/* —— 规格：柜台上的「30ml / 50ml / 100ml」，单选组，方向键可切 —— */
function SizePicker({ plans, value, onChange }: { plans: Plan[]; value: string; onChange: (c: string) => void }) {
  const onKey = (e: KeyboardEvent) => {
    const i = plans.findIndex((p) => p.plan_code === value);
    let j = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % plans.length;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + plans.length) % plans.length;
    if (e.key === 'Home') j = 0;
    if (e.key === 'End') j = plans.length - 1;
    if (j < 0) return;
    e.preventDefault();
    onChange(plans[j].plan_code);
    const btn = (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="radio"]')[j];
    btn?.focus();
  };
  return (
    <div class="pl-sizes">
      <p class="pl-sizes__label" id="pl-sizes-label">
        规格
      </p>
      <div
        class="pl-sizes__row"
        role="radiogroup"
        aria-labelledby="pl-sizes-label"
        style={{ '--n': plans.length } as Record<string, number>}
        onKeyDown={onKey}
      >
        {plans.map((p) => {
          const on = p.plan_code === value;
          const { head, tail } = splitName(p.name);
          return (
            <button
              key={p.plan_code}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              class={['pl-size', on && 'is-on'].filter(Boolean).join(' ')}
              onClick={() => onChange(p.plan_code)}
            >
              {p.badge && <span class="pl-size__badge">{p.badge}</span>}
              <span class="pl-size__head">{head}</span>
              {tail && <span class="pl-size__tail">{tail}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* —— 选中规格的标签：名称、档位、有效期、说明、价格与唯一的胭脂动作 —— */
function PlanLabel({ plan }: { plan: Plan }) {
  const iosDiffers = plan.ios_price_cents !== null && plan.ios_price_cents !== plan.price_cents;
  const listPrice = plan.list_price_cents !== null && plan.list_price_cents > plan.price_cents ? plan.list_price_cents : null;
  const notice = extras.plansNotice;
  return (
    <div class="pl-label">
      <DieLine kind="fold" ticks class="pl-label__fold" />
      <div class="pl-label__head">
        <h2 class="pl-label__name">{plan.name}</h2>
        {plan.badge && <span class="pl-badge">{plan.badge}</span>}
      </div>
      <p class="pl-label__meta">
        <span>{tierName(plan.grant_identity)}</span>
        <span class="pl-label__sep" aria-hidden="true" />
        <span>
          有效期 <Num value={plan.duration_days} sample={isSampleField('plans[].duration_days')} /> 天
        </span>
      </p>
      {plan.summary && <p class="pl-label__summary">{plan.summary}</p>}

      <div class="pl-price">
        <p class="pl-price__now">
          <span class="sr-only">价格</span>
          <span class="pl-price__cur" aria-hidden="true">
            ¥
          </span>
          <Num value={yuan(plan.price_cents)} sample={isSampleField('plans[].price_cents')} />
        </p>
        {listPrice !== null && (
          <p class="pl-price__list">
            <span class="sr-only">原价</span>
            <Num value={`¥${yuan(listPrice)}`} sample={isSampleField('plans[].list_price_cents')} />
          </p>
        )}
      </div>
      {iosDiffers && <p class="pl-price__ios">iPhone 以小程序内价格为准</p>}
      <p class="pl-notice">
        {notice.sample && <Stamp kind="样" />}
        <span>{notice.text}</span>
      </p>

      <HandoffButton variant="action" context={`会员方案 · ${plan.name}`} class="pl-cta">
        {/* 按钮只写规格名（整名在窄屏放不下一行），弹层里写全名 */}
        <span>下转小程序 · 开通 {splitName(plan.name).head}</span>
        <Icon name="arrowRight" size={18} />
      </HandoffButton>
    </div>
  );
}

/* —— 规格说明：单一字号的对照表。层级只靠字重、反白与细线 —— */
function SpecTable({ plans, selected, onSelect }: { plans: Plan[]; selected: string; onSelect: (c: string) => void }) {
  const benefits = [...preview.benefits].sort((a, b) => a.sort_order - b.sort_order);
  const cols = { '--n': plans.length } as Record<string, number>;
  const colClass = (p: Plan) => ['pl-spec__cell', p.plan_code === selected && 'is-on'].filter(Boolean).join(' ');
  const quotaSample = isSampleField('benefits[].quota_per_month');
  // 最低一档方案授予的身份：高于它的权益才标「××起」
  const baseRank = Math.min(...plans.map((p) => rank(p.grant_identity)).filter((r) => r >= 0));

  return (
    <>
      <div class="pl-spec" role="table" aria-label="各规格对照" style={cols}>
        <div class="pl-spec__row pl-spec__row--head" role="row">
          <span class="pl-spec__rh" role="columnheader">
            规格
          </span>
          {plans.map((p) => (
            <span class={colClass(p)} role="columnheader" key={p.plan_code}>
              <button
                type="button"
                class="pl-spec__pick"
                aria-pressed={p.plan_code === selected}
                onClick={() => onSelect(p.plan_code)}
              >
                {splitName(p.name).head}
              </button>
            </span>
          ))}
        </div>

        <div class="pl-spec__row" role="row">
          <span class="pl-spec__rh" role="rowheader">
            <b>档位</b>
          </span>
          {plans.map((p) => (
            <span class={colClass(p)} role="cell" key={p.plan_code}>
              {tierName(p.grant_identity)}
            </span>
          ))}
        </div>
        <div class="pl-spec__row" role="row">
          <span class="pl-spec__rh" role="rowheader">
            <b>有效期（天）</b>
          </span>
          {plans.map((p) => (
            <span class={colClass(p)} role="cell" key={p.plan_code}>
              <Num value={p.duration_days} sample={isSampleField('plans[].duration_days')} />
            </span>
          ))}
        </div>
        <div class="pl-spec__row" role="row">
          <span class="pl-spec__rh" role="rowheader">
            <b>价格（元）</b>
          </span>
          {plans.map((p) => (
            <span class={colClass(p)} role="cell" key={p.plan_code}>
              <Num value={yuan(p.price_cents)} sample={isSampleField('plans[].price_cents')} />
            </span>
          ))}
        </div>

        <div class="pl-spec__row pl-spec__row--group" role="row">
          <span class="pl-spec__group" role="rowheader">
            所含权益
          </span>
        </div>

        {benefits.map((b) => (
          <div class="pl-spec__row pl-spec__row--benefit" role="row" key={b.code}>
            <span class="pl-spec__rh" role="rowheader">
              <b>{b.name}</b>
              <span class="pl-spec__note">
                {b.summary}
                {b.quota_per_month !== null && (
                  <>
                    {' · 每月 '}
                    <Num value={b.quota_per_month} sample={quotaSample} />
                    {' 次'}
                  </>
                )}
                {b.min_identity !== null && rank(b.min_identity) > baseRank && (
                  <span class="pl-spec__gate">{tierName(b.min_identity)}起</span>
                )}
              </span>
            </span>
            {plans.map((p, i) => {
              const yes = includes(b, p);
              return (
                <span class={colClass(p)} role="cell" key={p.plan_code} style={{ gridColumn: i + 2 }}>
                  {yes ? <Icon name="check" size={20} class="pl-spec__yes" /> : <span class="pl-spec__no" aria-hidden="true" />}
                  <span class="sr-only">{yes ? '含' : '不含'}</span>
                </span>
              );
            })}
          </div>
        ))}
      </div>

      <p class="pl-spec__foot">
        <Stamp kind="样" />
        <span>有效期、价格与配额为演示数据；配额是目录值，不是个人余量。</span>
      </p>
      <Link class="btn btn--row pl-spec__more" to="/benefits">
        <span>看权益目录</span>
        <Icon name="chevronRight" size={18} />
      </Link>
    </>
  );
}
