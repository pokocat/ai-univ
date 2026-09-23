// 入群说明：盒子背面的「使用方法」展开成真实的分班入群流程。
// 步骤取 extras.joinGuide；每一步下方印一条进度条样张——那是会员在小程序里会看到的样子，
// 不是这位访客的状态。时间不作任何承诺：内容包没有把时限写成事实，这里就不写。
import { extras } from '../data/pack';
import { brandFullName } from '../brand';
import { Screen, Panel, HandoffButton, Link, Qr, Stamp, Icon } from '../ui';
import type { ScreenProps } from '../app/App';
import './join.css';

/**
 * 每一步小程序里显示的状态字样（样张）。内容包还没有这一栏，先在本屏按步序给出；
 * 多出来的步骤不印字样，只印进度格。末项是入群之后的终态。
 */
const STAGE_MARKS = ['待开通', '待添加服务老师', '分班中', '待入群'];
const DONE_MARK = '已入群';

/** 进度条样张：已过的格印满，当前格压斜纹，未到的格只留压痕 */
function Strip({ at, total, mark }: { at: number; total: number; mark?: string }) {
  return (
    <div class="jg-strip">
      <span class="jg-strip__cells" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            class={['jg-strip__cell', i < at && 'is-done', i === at && 'is-now'].filter(Boolean).join(' ')}
          />
        ))}
      </span>
      {mark && (
        <span class="jg-strip__mark">
          <span class="sr-only">样张，小程序此时显示：</span>
          {mark}
        </span>
      )}
    </div>
  );
}

export default function JoinGuide(_props: ScreenProps) {
  const g = extras.joinGuide;
  const total = g.steps.length;

  return (
    <Screen name="join" surface="carton">
      <Panel face="back" title={g.title} latin="Directions" foldTop={false} class="jg-panel">
        {/* 右上角已印整页「样张」章，这里不再重复一枚，只用文字说明进度条是什么 */}
        <p class="jg-legend">每一步下方的进度条，是会员在小程序里会看到的样子，不是你的状态。</p>

        <ol class="jg-steps">
          {g.steps.map((s, i) => (
            <li class="jg-step" key={s.no}>
              <span class="jg-step__no num" aria-hidden="true">
                {s.no}
              </span>
              <div class="jg-step__body">
                <h3 class="jg-step__title">
                  <span class="sr-only">{`第 ${s.no} 步：`}</span>
                  {s.title}
                  {s.sample && <Stamp kind="样" />}
                </h3>
                <p class="jg-step__text">{s.detail}</p>
                <Strip at={i} total={total} mark={STAGE_MARKS[i]} />

                {i === total - 1 && (
                  <figure class="jg-code">
                    <div class="jg-code__qr">
                      <Qr
                        payload={`${brandFullName}入群码样张。扫码不会进群，也不收集任何信息。`}
                        size={176}
                        label={`${brandFullName}班级群入群码（样张）`}
                      />
                    </div>
                    <figcaption class="jg-code__cap">
                      {g.qr.sample && <Stamp kind="样" />}
                      {g.qr.caption}
                    </figcaption>
                  </figure>
                )}
              </div>
            </li>
          ))}

          <li class="jg-step jg-step--done">
            <span class="jg-step__no" aria-hidden="true">
              <Icon name="check" size={28} />
            </span>
            <div class="jg-step__body">
              <h3 class="jg-step__title">
                <span class="sr-only">完成：</span>
                入群之后
              </h3>
              <p class="jg-step__text">小程序里的进度条印满，状态变为「{DONE_MARK}」。</p>
              <Strip at={total} total={total} mark={DONE_MARK} />
            </div>
          </li>
        </ol>

        <p class="jg-notice">{g.notice}</p>

        <div class="jg-cta">
          <HandoffButton variant="action" context="入群说明 · 第 1 步 在小程序开通" class="jg-cta__action">
            下转小程序开通
            <Icon name="arrowRight" size={18} />
          </HandoffButton>
          <Link class="btn btn--quiet jg-cta__quiet" to="/plans">
            先比较会员方案
          </Link>
        </div>
      </Panel>
    </Screen>
  );
}
