// 权益：按浓度分级的成分表。
// 按最低可用档位分组（「会员 及以上可用」），档位越高刻度格越满；每行只写目录值（每月 N 次），
// 不写个人余量——这是游客态，没有「人」，余量无从谈起。
import { preview, extras, isSampleField } from '../data/pack';
import type { PreviewBenefit } from '../content/schema';
import { Screen, Panel, HandoffButton, Link, Num, Stamp, Icon, Blank } from '../ui';
import type { ScreenProps } from '../app/App';
import './benefits.css';

interface Tier {
  /** 内部档名；null = 不设门槛 */
  key: string | null;
  /** 界面显示名（取自 terminology） */
  label: string;
  /** 档位高低：terminology 里的先后，越靠后越高 */
  rank: number;
  items: PreviewBenefit[];
  /** 开通即授予这一档的方案名 */
  plans: string[];
}

function tierLabel(key: string | null): string {
  if (key === null) return '全部会员';
  return extras.terminology.identity[key] ?? key;
}

function tierRank(key: string | null, order: string[]): number {
  if (key === null) return 0;
  const i = order.indexOf(key);
  return i === -1 ? order.length + 1 : i + 1;
}

function tiers(): { list: Tier[]; top: number } {
  const order = Object.keys(extras.terminology.identity);
  const map = new Map<string | null, Tier>();
  for (const b of [...preview.benefits].sort((a, c) => a.sort_order - c.sort_order)) {
    const key = b.min_identity;
    let t = map.get(key);
    if (!t) {
      t = { key, label: tierLabel(key), rank: tierRank(key, order), items: [], plans: [] };
      map.set(key, t);
    }
    t.items.push(b);
  }
  const list = [...map.values()].sort((a, b) => a.rank - b.rank);
  // 一档的权益，开通它或更高档的方案都能用；这里只列「正好授予这一档」的方案，免得一行太长
  for (const t of list) {
    t.plans = [...preview.plans]
      .sort((a, b) => a.sort_order - b.sort_order)
      .filter((p) => p.grant_identity === t.key)
      .map((p) => p.name);
  }
  return { list, top: Math.max(1, ...list.map((t) => t.rank)) };
}

/** 浓度刻度：档位几格满几格，像成分表旁印的浓度标 */
function Grade({ rank, top }: { rank: number; top: number }) {
  return (
    <span class="bn-grade" aria-hidden="true">
      {Array.from({ length: top }, (_, i) => (
        <span key={i} class={['bn-grade__cell', i < rank && 'is-on'].filter(Boolean).join(' ')} />
      ))}
    </span>
  );
}

export default function Benefits(_props: ScreenProps) {
  const { list, top } = tiers();
  const quotaSample = isSampleField('benefits[].quota_per_month');
  const anyQuota = preview.benefits.some((b) => b.quota_per_month !== null);

  return (
    <Screen name="benefits" surface="pearl">
      <Panel face="side" title="权益" latin="Benefits" foldTop={false} class="bn-panel">
        <p class="bn-lead">
          按最低可用档位分组。档位越高，右侧刻度越满；高一档的会员同时可用低一档的全部权益。
        </p>

        {list.length === 0 ? (
          <Blank title="权益目录整理中" hint="先回「本期」看本期所含，或到「方案」比较会员档位。" />
        ) : (
          list.map((t) => (
            <section class="bn-tier" key={t.key ?? 'all'} aria-labelledby={`bn-tier-${t.rank}`}>
              <header class="bn-tier__head">
                <h3 class="bn-tier__title" id={`bn-tier-${t.rank}`}>
                  <span class="bn-tier__name">{t.label}</span>
                  {t.key !== null && <span class="bn-tier__rest">及以上可用</span>}
                </h3>
                <Grade rank={t.rank} top={top} />
                <span class="sr-only">{`档位 ${t.rank} / ${top}`}</span>
              </header>
              {t.plans.length > 0 && (
                <p class="bn-tier__plans">
                  开通
                  {t.plans.map((p, i) => (
                    <span key={p}>
                      「{p}」{i < t.plans.length - 1 ? '或' : ''}
                    </span>
                  ))}
                  即属这一档
                  <Link class="bn-tier__to" to="/plans">
                    看方案
                    <Icon name="chevronRight" size={16} />
                  </Link>
                </p>
              )}
              <ul class="inci bn-list" aria-label={`${t.label}${t.key !== null ? '及以上' : ''}可用的权益`}>
                {t.items.map((b) => (
                  <li class="inci__row" key={b.code}>
                    <div class="inci__hit inci__hit--static bn-row">
                      <span class="inci__name">
                        <b>{b.name}</b>
                        <span class="inci__note">{b.summary}</span>
                      </span>
                      {b.quota_per_month !== null && (
                        <span class="bn-quota">
                          <span class="bn-quota__unit">每月</span>
                          {/* 「样」印在整句之后：印在数字和「次」之间会把一句话截断 */}
                          <Num value={b.quota_per_month} sample={false} />
                          <span class="bn-quota__unit">次</span>
                          {quotaSample && <Stamp kind="样" />}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}

        <p class="bn-foot">
          {anyQuota && quotaSample && (
            <>
              <Stamp kind="样" /> 次数为权益目录上的配额（演示值），不是个人余量。
            </>
          )}
          开通后，自己的可用次数在小程序里看。
        </p>

        <HandoffButton variant="row" context="权益 · 开通后查看可用次数" class="bn-handoff">
          <span>下转小程序，开通后查看可用次数</span>
          <Icon name="arrowRight" size={18} />
        </HandoffButton>
      </Panel>
    </Screen>
  );
}
