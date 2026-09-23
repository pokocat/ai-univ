// 我的：只有游客态。顶上是一枚礼盒吊牌——持有人一栏留空，登录与订单都在小程序里；
// 下面每一行都真能办事：去会员证样张 / 权益 / 入群说明，展开「关于本演示」，重置本机的演示记录。
import { useEffect, useState } from 'preact/hooks';
import { identity, brandFullName, h5, facts } from '../brand';
import { navigate } from '../app/router';
import { Screen, Panel, HandoffButton, Link, Num, Stamp, Icon, CropMarks } from '../ui';
import type { ScreenProps } from '../app/App';
import { clearMomentState } from '../moments/SampleSachet';
import './me.css';

/** 本演示写进浏览器存储的键一律以此开头（开盒仪式、滚动位置、小样撕开状态） */
const DEMO_PREFIX = 'brand-h5:';

type Store = 'sessionStorage' | 'localStorage';
const STORES: Store[] = ['sessionStorage', 'localStorage'];

function demoKeys(): { store: Store; key: string }[] {
  const out: { store: Store; key: string }[] = [];
  for (const store of STORES) {
    try {
      const s = window[store];
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (k && k.startsWith(DEMO_PREFIX)) out.push({ store, key: k });
      }
    } catch {
      /* 隐私模式或存储被禁：没有可清的记录 */
    }
  }
  return out;
}

function clearDemoKeys() {
  // 小样的撕开 / 已存状态由它自己的模块清（与本页同一前缀，这里显式调一次，免得前缀将来再分叉）
  clearMomentState();
  for (const { store, key } of demoKeys()) {
    try {
      window[store].removeItem(key);
    } catch {
      /* 同上 */
    }
  }
}

const ROWS: { to: string; name: string; note: string }[] = [
  { to: '/card', name: '会员证样张', note: '镭射防伪标的样张，不对应任何真实会员' },
  { to: '/benefits', name: '权益', note: '按档位列出的权益目录' },
  { to: '/join', name: '入群说明', note: '开通之后，怎么进班级群' },
];

export default function Me(_props: ScreenProps) {
  const [about, setAbout] = useState(false);
  const [confirm, setConfirm] = useState(false);
  // 本机演示记录条数：真实读数（读自本机存储），服务端渲染时未知，不显示
  const [stored, setStored] = useState<number | null>(null);

  useEffect(() => {
    setStored(demoKeys().length);
  }, [confirm]);

  const proposed = facts().filter((f) => f.status === '拟定');

  function reset() {
    clearDemoKeys();
    setConfirm(false);
    navigate('/', { replace: true });
  }

  return (
    <Screen name="me" surface="carton">
      {/* 礼盒吊牌：持有人一栏留空 */}
      <section class="me-tag on-carton" aria-labelledby="me-title">
        <div class="me-tag__card">
          <CropMarks offset={6} size={10} />
          <h1 class="me-tag__title" id="me-title">
            我的
          </h1>
          <dl class="me-tag__fields">
            <div class="me-tag__field">
              <dt>持有人</dt>
              <dd>
                <span class="me-tag__blank" aria-hidden="true" />
                <span class="me-tag__hint">未登录 · 游客浏览</span>
              </dd>
            </div>
            <div class="me-tag__field">
              <dt>订单</dt>
              <dd>
                <span class="me-tag__blank" aria-hidden="true" />
                <span class="me-tag__hint">在小程序内查看</span>
              </dd>
            </div>
          </dl>
          <p class="me-tag__text">
            本页是{brandFullName}的品牌演示，不登录、不建档。登录、开通与订单都在小程序内完成（筹备中）。
          </p>
          <HandoffButton variant="action" context="我的 · 登录与开通" class="me-tag__cta">
            下转小程序登录
            <Icon name="arrowRight" size={18} />
          </HandoffButton>
        </div>
      </section>

      <Panel face="side" title="本盒目录" latin="Index" class="me-index">
        <ul class="inci" aria-label="我的 · 目录">
          {ROWS.map((r) => (
            <li class="inci__row" key={r.to}>
              <Link class="inci__hit" to={r.to}>
                <span class="inci__name">
                  <b>{r.name}</b>
                  <span class="inci__note">{r.note}</span>
                </span>
                <Icon name="chevronRight" size={18} class="inci__go" />
              </Link>
            </li>
          ))}

          <li class="inci__row">
            <button
              type="button"
              class="inci__hit"
              aria-expanded={about}
              aria-controls="me-about"
              onClick={() => setAbout((v) => !v)}
            >
              <span class="inci__name">
                <b>关于本演示</b>
                <span class="inci__note">哪些是演示数据、图片从哪来、本页收集什么</span>
              </span>
              <Icon name="chevronDown" size={18} class={['inci__go', 'me-caret', about && 'is-open'].filter(Boolean).join(' ')} />
            </button>
            <div class="me-about" id="me-about" hidden={!about}>
              <dl class="me-about__list">
                <div>
                  <dt>演示数据</dt>
                  <dd>
                    课程排期、价格、配额与讲师均为演示内容；盖
                    <Stamp kind="样" />
                    的数字为样例，印「样张」的页面不对应真实账户。
                  </dd>
                </div>
                <div>
                  <dt>图片</dt>
                  <dd>
                    本期开窗图片：{h5.images.window.credit}。
                  </dd>
                </div>
                <div>
                  <dt>展会</dt>
                  <dd>
                    {proposed.length > 0 ? (
                      <>
                        {proposed.map((f) => f.label).join('、')}标
                        <Stamp kind="拟定" />
                        ，以主办方最终公布为准。
                      </>
                    ) : (
                      '展会信息以主办方公布为准。'
                    )}
                  </dd>
                </div>
                <div>
                  <dt>收集</dt>
                  <dd>
                    本页不登录、不收款、不收集任何信息，不连接第三方网络。只在本机浏览器里记下开盒动画、滚动位置、小样是否撕开这类演示记录。
                  </dd>
                </div>
                <div>
                  <dt>品牌</dt>
                  <dd>
                    {brandFullName}；运营：{identity.operator.name}
                    {identity.operator.placeholder && '（占位）'}。
                  </dd>
                </div>
              </dl>
            </div>
          </li>

          <li class="inci__row">
            <button
              type="button"
              class="inci__hit"
              aria-expanded={confirm}
              aria-controls="me-reset"
              onClick={() => setConfirm((v) => !v)}
            >
              <span class="inci__name">
                <b>重置演示</b>
                <span class="inci__note">
                  {stored === null ? (
                    '清除本机的演示记录，回到本期'
                  ) : stored > 0 ? (
                    <>
                      本机有 <Num value={stored} sample={false} class="me-count" /> 条演示记录，清除后回到本期
                    </>
                  ) : (
                    '本机还没有演示记录，重置后回到本期'
                  )}
                </span>
              </span>
              <Icon name="chevronDown" size={18} class={['inci__go', 'me-caret', confirm && 'is-open'].filter(Boolean).join(' ')} />
            </button>
            <div class="me-reset" id="me-reset" hidden={!confirm}>
              <p class="me-reset__text">
                会清掉开盒动画的播放记录、小样撕开状态与滚动位置，只动本机浏览器里的演示记录，不涉及任何账户。
              </p>
              <div class="me-reset__actions">
                <button type="button" class="btn btn--ghost me-reset__go" onClick={reset}>
                  清除并回到本期
                </button>
                <button type="button" class="btn btn--quiet" onClick={() => setConfirm(false)}>
                  取消
                </button>
              </div>
            </div>
          </li>
        </ul>
        <p class="me-foot">{identity.demoRibbon}</p>
      </Panel>
    </Screen>
  );
}
