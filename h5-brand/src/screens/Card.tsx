// 会员证样张：一张贴在黛蓝盒面上的镭射防伪标。
// 珠光卡面印品牌、档位、样例会员栏与批号式编号；二维码画在纯白底上，只编码一句演示说明；
// 镭射带的光斑跟着指针走。整张卡压一枚「样张」大章，并用一句话写明这不是有效会员码。
// 唯一的胭脂动作：下转小程序——真实会员码开通后在小程序内出示。
import { useRef } from 'preact/hooks';
import { identity, brandFullName } from '../brand';
import { extras } from '../data/pack';
import { Screen, PanelHead, CropMarks, DieLine, Stamp, Qr, HandoffButton, Icon } from '../ui';
import { Hologram } from '../moments/Hologram';
import type { ScreenProps } from '../app/App';
import './card.css';

// 二维码里只有这句说明：扫出来不会跳转、不核验任何人
const QR_PAYLOAD = `${brandFullName} · 会员证样张。演示，非有效会员码；扫码不会跳转，也不能用于核验。`;

export default function Card(_props: ScreenProps) {
  const mc = extras.memberCard;
  const cardRef = useRef<HTMLDivElement>(null);
  const pick = (label: string) => mc.fields.find((f) => f.label === label);
  const tier = pick('档位');
  const no = pick('编号');
  const rows = mc.fields.filter((f) => f !== tier && f !== no);

  return (
    <Screen name="card" surface="carton">
      <div class="card-screen">
        <PanelHead as="h1" title="会员证样张" latin="Member card" />
        <p class="card-lede">开通后，会员证在小程序里出示。这一张只看样式，不对应任何人。</p>

        <figure class="card-sticker" aria-labelledby="card-caption">
          <div class="card-cut">
            <CropMarks offset={10} size={12} />
            <div class="mcard" ref={cardRef}>
              <Hologram laser={mc.laser} latin={identity.nameLatin} field={cardRef}>
                <div class="holo__seal" aria-hidden="true">
                  <span>{mc.laser.slice(0, 2)}</span>
                  <span>{mc.laser.slice(2)}</span>
                </div>
                <p class="holo__label">
                  <span class="caps">Anti-counterfeit</span>
                  <span class="sr-only">镭射防伪标：{mc.laser}</span>
                </p>
              </Hologram>

              <div class="mcard__face">
                <div class="mcard__brand">
                  <p class="mcard__name">
                    <span class="mcard__word">{identity.name}</span>
                    <span class="mcard__note">（{identity.nameNote}）</span>
                  </p>
                  {identity.nameLatin && (
                    <span class="caps mcard__latin" aria-hidden="true">
                      {identity.nameLatin}
                    </span>
                  )}
                </div>
                <p class="mcard__aud">{identity.audienceLabel}的会员社群</p>

                {tier && (
                  <p class="mcard__tier">
                    <span class="mcard__tier-label">{tier.label}</span>
                    <span class="mcard__tier-value">
                      {tier.value}
                      {tier.sample && <Stamp kind="样" />}
                    </span>
                  </p>
                )}

                <dl class="mcard__rows">
                  {rows.map((f) => (
                    <div key={f.label} class="mcard__row">
                      <dt>{f.label}</dt>
                      <dd>
                        {f.value}
                        {f.sample && <Stamp kind="样" />}
                      </dd>
                    </div>
                  ))}
                </dl>

                <div class="mcard__code">
                  <div class="mcard__qr">
                    <Qr payload={QR_PAYLOAD} size={168} label="会员码样张：演示，非有效会员码" />
                  </div>
                  {no && (
                    <p class="mcard__no">
                      <span class="mcard__no-label">{no.label}</span>
                      <span class="mcard__no-value num">{no.value}</span>
                      {no.sample && <Stamp kind="样" />}
                    </p>
                  )}
                  <p class="mcard__qr-cap">
                    <Stamp kind="样" /> 演示 · 非有效会员码
                  </p>
                </div>
              </div>

              <div class="mcard__void" aria-hidden="true">
                <span>{mc.stamp}</span>
              </div>
            </div>
          </div>
          <figcaption id="card-caption" class="card-caption">
            <Stamp kind="样张" />
            <span>这不是有效会员码。{mc.footnote}</span>
          </figcaption>
        </figure>

        <div class="card-act">
          <HandoffButton variant="action" context="会员证 · 开通后出示" class="card-cta">
            开通后在小程序内出示真实会员码
            <Icon name="arrowRight" size={18} />
          </HandoffButton>
          <p class="card-act__note">{identity.handoff.note}</p>
        </div>

        {/* 批号印在页底的印刷信息里，不压在标题上方 */}
        <footer class="card-imprint">
          <DieLine kind="cut" class="card-imprint__cut" />
          <p class="card-imprint__print">
            <span>批号</span>
            <span class="num">{identity.issue.batch}</span>
            <span>{identity.issue.label}</span>
          </p>
        </footer>
      </div>
    </Screen>
  );
}
