import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 会员与续费（设计稿 12「续费提醒」）。
 *
 * 与设计稿的两处**故意不同**：
 *  ① 没有「AI 续费建议：可为您节省 ¥589，预计带来 2.8x 的成长效率提升」。
 *     那个 2.8x 没有任何计算依据；「省多少」有依据（划线价差），所以保留在套餐行上。
 *     拿一个编的倍数去劝人付费，是这套设计里最不该照抄的一处。
 *  ② 「续费后继续享受」六格来自真实权益目录，不是写死的六个词。
 *
 * 倒计时按**日历天**算，与到期日期同口径：两处口径不同会出现
 * 「到期 6.05、剩余 364 天」这种对不上的显示，用户会截图来问。
 */
const api = require('../../api/mp.js')
const { toast, money, d10 } = require('../../utils/fmt.js')
const { navVars } = require('../../utils/layout.js')
const { isAuthGateError } = require('../../utils/auth.js')
const pay = require('../../utils/pay.js')
const log = require('../../utils/log.js')
import UiErrbar from '../../components/errbar/index'
import UiSubhead from '../../components/subhead/index'
import UiArt from '../../components/art/index'
import UiIcon from '../../components/icon/index'
import './index.scss'
cacheOptions.setOptionsToCache({
  data: {
    navPad: '',
    loading: true,
    err: '',
    retrying: false,
    active: false,
    tier: '',
    glyph: '',
    headline: '',
    expiryText: '',
    startText: '',
    currentPriceText: '',
    current: null,
    plans: [],
    selected: '',
    keep: [],
    cd: {
      d: '--',
      h: '--',
      m: '--',
    },
  },
  onLoad() {
    this.setData(navVars())
  },
  onShow() {
    this.load()
    this.startTick()
  },
  onHide() {
    this.stopTick()
  },
  onUnload() {
    this.stopTick()
  },
  startTick() {
    this.stopTick()
    // 分钟级刷新够了：秒级倒计时对「还有 12 天」这种量级没有意义，只是耗电
    this.timer = setInterval(() => this.tick(), 30000)
  },
  stopTick() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  },
  tick() {
    const until = this.data.until
    if (!until) return
    const diff = new Date(until).getTime() - Date.now()
    if (diff <= 0) {
      this.setData({
        cd: {
          d: '0',
          h: '0',
          m: '0',
        },
      })
      return
    }
    this.setData({
      cd: {
        d: String(Math.floor(diff / 86400000)),
        h: String(Math.floor((diff % 86400000) / 3600000)).padStart(2, '0'),
        m: String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0'),
      },
    })
  },
  async load() {
    this.setData({
      retrying: true,
    })
    try {
      const [membership, benefits, growth] = await Promise.all([
        api.getMembership(),
        api.getBenefits(false),
        api.getGrowth(1),
      ])
      const ios = api.platformChannel() === 'ios'
      const active = !!(membership && membership.active)
      const current = membership && membership.currentPlan
      const plans = ((membership && membership.renewPlans) || []).map((p) =>
        this.decoratePlan(p, ios)
      )
      const recommended = plans.find((p) => p.recommended) || plans[0]
      const daysLeft = membership && membership.days_left
      this.setData({
        loading: false,
        err: '',
        retrying: false,
        active,
        tier: (membership && membership.tier) || '',
        glyph: growth && growth.level != null ? String(growth.level) : '',
        until: membership && membership.valid_until,
        expiryText: d10(membership && membership.valid_until),
        startText: d10(current && (current.paid_at || current.starts_at)),
        currentPriceText: current
          ? '¥' +
            money(
              (ios && current.ios_price_cents != null
                ? current.ios_price_cents
                : current.price_cents) / 100
            )
          : '',
        current,
        plans,
        selected: recommended ? recommended.plan_code : '',
        // 「继续享受」只列当前可用的权益：把锁着的也列进来等于承诺续费能解锁更高档
        keep: (benefits || []).filter((b) => b.available).slice(0, 6),
        headline: !active
          ? '尚未开通会员'
          : daysLeft != null && daysLeft <= 30
          ? '会员即将到期'
          : '会员有效中',
      })
      this.tick()
    } catch (e) {
      if (isAuthGateError(e)) return
      log.error('renewal load', e.message)
      this.setData({
        loading: false,
        retrying: false,
        err: e.message,
      })
    }
  },
  decoratePlan(p, ios) {
    const cents =
      ios && p.ios_price_cents != null ? p.ios_price_cents : p.price_cents
    const list = p.list_price_cents
    const save = list != null && list > cents ? (list - cents) / 100 : null
    return Object.assign({}, p, {
      priceText: money(cents / 100),
      saveText: save == null ? '' : money(save),
    })
  },
  pick(e) {
    this.setData({
      selected: getTarget(e.currentTarget, Taro).dataset.code,
    })
  },
  async renew() {
    if (!this.data.selected) {
      toast('请选择一个方案')
      return
    }
    const cfg = await pay.config()
    if (cfg.disabled) {
      toast(cfg.hint)
      return
    }
    Taro.navigateTo({
      url: '/pages/payment/index?planCode=' + this.data.selected,
    })
  },
  go(e) {
    const url = getTarget(e.currentTarget, Taro).dataset.url
    if (!url) return
    if (/^\/pages\/(index|group|member|notifications|mine)\/index$/.test(url))
      Taro.switchTab({
        url,
      })
    else
      Taro.navigateTo({
        url,
        fail: () => toast('页面暂不可用'),
      })
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const {
      err,
      retrying,
      loading,
      headline,
      active,
      expiryText,
      cd,
      current,
      tier,
      glyph,
      currentPriceText,
      startText,
      plans,
      selected,
      keep,
    } = this.data
    return (
      <View className="screen screen--bar">
        <View className="ambience"></View>
        <View className="layer">
          <UiSubhead title="会员与续费" home="/pages/member/index"></UiSubhead>
          {err && (
            <UiErrbar
              msg={err}
              retrying={retrying}
              onRetry={this.load}
            ></UiErrbar>
          )}
          {loading ? (
            <View className="card card-pad">
              <View className="skeleton skeleton-block"></View>
            </View>
          ) : (
            <Block>
              <View className="card card--hero rn-hero">
                <View
                  className="f-start"
                  style={{
                    gap: '0.2rem',
                  }}
                >
                  <View className="f-1">
                    <Text className="t-meta">{headline}</Text>
                    <View className="title-grad rn-title">
                      {active ? '及时续费 · 不断成长' : '开通会员 · 解锁权益'}
                    </View>
                    <Text className="lead">持续享受优质资源与专属服务</Text>
                  </View>
                  <UiArt kind="gem" w={220} icon="crown" variant="rn"></UiArt>
                </View>
                {active && (
                  <Block>
                    <View className="mt-14">
                      <Text className="t-tiny">到期时间</Text>
                      <Text className="rn-expiry mono">{expiryText}</Text>
                    </View>
                    <Text className="t-tiny mt-10 block">剩余时间</Text>
                    <View
                      className="f mt-6"
                      style={{
                        gap: '0.3rem',
                      }}
                    >
                      <Text className="cd-box mono">{cd.d}</Text>
                      <Text className="t-meta">天</Text>
                      <Text className="cd-box mono">{cd.h}</Text>
                      <Text className="t-meta">时</Text>
                      <Text className="cd-box mono">{cd.m}</Text>
                      <Text className="t-meta">分</Text>
                    </View>
                  </Block>
                )}
              </View>
              {/*  当前方案  */}
              {current && (
                <View className="card card-pad gap">
                  <View
                    className="f mb-12"
                    style={{
                      gap: '0.3rem',
                    }}
                  >
                    <Text className="col-h">当前会员方案</Text>
                    {tier && <Text className="mcard-pro">{tier}</Text>}
                  </View>
                  <View
                    className="f"
                    style={{
                      gap: '0.525rem',
                    }}
                  >
                    <UiArt
                      kind="medallion"
                      w={110}
                      glyph={glyph}
                      variant="rncur"
                    ></UiArt>
                    <View className="f-1">
                      <View
                        className="f f-wrap"
                        style={{
                          gap: '0.35rem',
                        }}
                      >
                        <Text className="t-h3">{current.name}</Text>
                        {current.badge && (
                          <Text className="tag tag--amber">
                            {current.badge}
                          </Text>
                        )}
                      </View>
                      <View className="f-between mt-8">
                        <Text className="t-tiny mono">
                          {'有效期至 ' + expiryText}
                        </Text>
                        <Text className="t-tiny mono">{currentPriceText}</Text>
                      </View>
                      <View className="f-between mt-4">
                        <Text className="t-tiny mono">
                          {'开通于 ' + startText}
                        </Text>
                        <View
                          className="link-trail"
                          data-url="/pages/member/index"
                          onClick={this.go}
                        >
                          <Text>会员卡</Text>
                          <UiIcon
                            name="chev"
                            size={22}
                            color="ink-800"
                          ></UiIcon>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              )}
              {/*  续费方案  */}
              <View className="card card-pad gap">
                <Text className="col-h mb-12 block">
                  {active ? '续费方案' : '会员方案'}
                </Text>
                {plans?.length ? (
                  <Block>
                    {plans?.map((item, index) => {
                      return (
                        <View
                          key={item.plan_code}
                          className={
                            'rn-plan ' +
                            (selected === item.plan_code ? 'rn-plan--on' : '')
                          }
                          data-code={item.plan_code}
                          onClick={this.pick}
                        >
                          <View
                            className={
                              'radio ' +
                              (selected === item.plan_code ? 'radio--on' : '')
                            }
                          >
                            {selected === item.plan_code && (
                              <View className="radio-i"></View>
                            )}
                          </View>
                          <View className="f-1">
                            <View
                              className="f f-wrap"
                              style={{
                                gap: '0.3rem',
                              }}
                            >
                              <Text className="t-h4">{item.name}</Text>
                              {item.recommended && (
                                <Text className="tag tag--purple">推荐</Text>
                              )}
                              {item.badge && (
                                <Text className="tag tag--amber">
                                  {item.badge}
                                </Text>
                              )}
                            </View>
                            <Text className="t-tiny mt-4 block">
                              {item.duration_days +
                                ' 天' +
                                (item.summary ? ' · ' + item.summary : '')}
                            </Text>
                          </View>
                          <View className="ta-r">
                            <View className="price">
                              <Text className="price-cur">¥</Text>
                              <Text className="price-v mono">
                                {item.priceText}
                              </Text>
                            </View>
                            {item.saveText && (
                              <Text className="mono save">
                                {'省 ¥' + item.saveText}
                              </Text>
                            )}
                          </View>
                        </View>
                      )
                    })}
                  </Block>
                ) : (
                  <View className="blank">
                    <View className="blank-mark">
                      <UiIcon name="crown" size={45} color="signal"></UiIcon>
                    </View>
                    <Text className="blank-title">暂无可购买的方案</Text>
                    <Text className="blank-hint">
                      运营还没有上架套餐，可以联系服务老师了解。
                    </Text>
                  </View>
                )}
              </View>
              {/*  续费后继续享受：来自真实权益目录  */}
              {keep?.length && (
                <View className="card card-pad gap">
                  <Text className="col-h mb-12 block">
                    {active ? '续费后继续享受' : '开通后可享受'}
                  </Text>
                  <View className="keep-grid">
                    {keep?.map((item, index) => {
                      return (
                        <View key={item.code} className="keep-tile">
                          <View className="keep-ico">
                            <UiIcon
                              name={item.icon}
                              size={38}
                              color="signal"
                            ></UiIcon>
                          </View>
                          <Text className="keep-t">{item.name}</Text>
                          <Text className="keep-d">
                            {item.quotaTotal
                              ? '每月 ' + item.quotaTotal + ' 次'
                              : item.status_hint}
                          </Text>
                        </View>
                      )
                    })}
                  </View>
                </View>
              )}
              <View className="box box--sunk gap">
                <View
                  className="f"
                  style={{
                    gap: '0.3rem',
                  }}
                >
                  <UiIcon name="shield" size={28} color="signal"></UiIcon>
                  <Text className="t-sec fw-600">续费与到期口径</Text>
                </View>
                <Text className="t-tiny mt-6 block">
                  续费后有效期从当前到期日顺延，不覆盖剩余天数。本平台不做自动扣费；
                  到期前会通过站内消息与微信服务通知提醒你。
                </Text>
              </View>
            </Block>
          )}
        </View>
        {plans?.length && (
          <View className="action-bar">
            <View className="cta cta--primary" onClick={this.renew}>
              {active && <Text className="cta-flag">继续成长</Text>}
              <Text>{active ? '立即续费' : '立即开通'}</Text>
              <View className="cta-arrow">
                <UiIcon name="arrow" size={30} color="on-signal"></UiIcon>
              </View>
            </View>
          </View>
        )}
      </View>
    )
  }
}
export default _C
