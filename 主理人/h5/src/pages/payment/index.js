import withWeapp, { cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 支付确认（设计稿 10）。
 *
 * 与设计稿的三处**故意不同**（都关系到钱，不能靠界面撑场面）：
 *  ① 支付方式只列**服务端确认可用**的通道。设计稿画了微信/支付宝/银联三选，
 *     而系统只接了微信虚拟支付；摆出另外两个，点了必然失败。
 *  ② 没有「自动续费」开关（系统没有周期扣费能力），改为如实说明到期提醒口径。
 *  ③ 「优惠 -¥589」只在套餐真的配了 list_price_cents 时出现，不用现价反推假原价。
 *
 * 支付口径全部复用 utils/pay：下单 → 唤起 → **轮询回查**。
 * 微信 success 回调只代表微信侧扣款完成，权益以服务端回调为准，
 * 所以绝不能凭 success 就跳成功页——那会在回调失败时给用户一个假的「已开通」。
 */
const api = require('../../api/mp.js')
const { toast, money } = require('../../utils/fmt.js')
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
    planCode: '',
    plan: null,
    pay: {
      mode: 'disabled',
      disabled: true,
      hint: '',
    },
    iosBlocked: false,
    paying: false,
  },
  onLoad(options) {
    this.alive = true
    this.setData(
      Object.assign(
        {
          planCode: (options && options.planCode) || '',
        },
        navVars()
      )
    )
    this.load()
  },
  onUnload() {
    // 轮询要能停：对已卸载页面 setData 会告警，且没有意义
    this.alive = false
  },
  async load() {
    this.setData({
      retrying: true,
    })
    try {
      const [membership, payCfg] = await Promise.all([
        api.getMembership(),
        pay.config(),
      ])
      const ios = api.platformChannel() === 'ios'
      const raw = ((membership && membership.renewPlans) || []).find(
        (p) => p.plan_code === this.data.planCode
      )
      this.setData({
        loading: false,
        err: '',
        retrying: false,
        plan: raw ? this.decoratePlan(raw, ios) : null,
        pay: payCfg,
        iosBlocked: ios && payCfg.iosEnabled === false,
      })
    } catch (e) {
      if (isAuthGateError(e)) return
      log.error('payment load', e.message)
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
      listText: list == null ? '' : money(list / 100),
      saveText: save == null ? '' : money(save),
    })
  },
  async submit() {
    if (this.data.paying) return
    if (this.data.pay.disabled) {
      toast(this.data.pay.hint)
      return
    }
    if (this.data.iosBlocked) {
      toast('当前 iOS 通道尚未开放')
      return
    }
    this.setData({
      paying: true,
    })
    try {
      const order = await api.createOrder(this.data.planCode)
      const orderNo = order.order_no || order.orderNo
      if (!orderNo) throw new Error('下单未返回订单号，请稍后重试')
      const paid = await pay.payExistingOrder(
        orderNo,
        this.data.pay.mode,
        () => this.alive
      )
      if (!this.alive) return
      if (paid) {
        // 只有服务端确认到账才跳成功页；否则留在本页并如实说「处理中」
        Taro.redirectTo({
          url: '/pages/success/index?orderNo=' + orderNo,
        })
        return
      }
      pay.notifyResult(false)
      this.setData({
        paying: false,
      })
    } catch (e) {
      this.setData({
        paying: false,
      })
      // 用户主动取消不弹提示（pay.js 打了 silent 标记）
      if (e && e.silent) return
      log.error('payment submit', e.message)
      toast(e.message)
    }
  },
  backToPlans() {
    if (Taro.getCurrentPages().length > 1) Taro.navigateBack()
    else
      Taro.redirectTo({
        url: '/pages/subscribe/index',
      })
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { err, retrying, loading, plan, pay, iosBlocked, paying } = this.data
    return (
      <View className="screen screen--bar">
        <View className="ambience"></View>
        <View className="layer">
          <UiSubhead title="支付确认" home="/pages/member/index"></UiSubhead>
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
          ) : plan ? (
            <Block>
              <View className="card result-hero">
                <View className="result-hero-text">
                  <View className="eyebrow">
                    <UiIcon name="lock" size={26} color="signal"></UiIcon>
                    <Text>安全加密支付</Text>
                  </View>
                  <View className="title-grad pay-title">支付确认</View>
                  <Text className="t-sec mt-6 block">
                    安全便捷 · 权益即时生效
                  </Text>
                </View>
                <View className="result-hero-art">
                  <UiArt kind="check" w={230} variant="pay"></UiArt>
                </View>
              </View>
              {/*  已选方案  */}
              <View className="card card-pad gap">
                <Text className="col-h mb-10 block">已选会员方案</Text>
                <View className="plan-box">
                  <View className="f-1">
                    <View
                      className="f f-wrap"
                      style={{
                        gap: '0.35rem',
                      }}
                    >
                      <Text className="plan-name">{plan.name}</Text>
                      {plan.badge && (
                        <Text className="tag tag--amber">{plan.badge}</Text>
                      )}
                    </View>
                    {plan.summary && (
                      <Text className="t-meta mt-8 block">{plan.summary}</Text>
                    )}
                    <Text className="t-meta mt-4 block">
                      {'有效期 ' + plan.duration_days + ' 天'}
                    </Text>
                  </View>
                  <View className="ta-r">
                    <View className="price">
                      <Text className="price-cur">¥</Text>
                      <Text className="price-v mono">{plan.priceText}</Text>
                    </View>
                    {plan.listText && (
                      <Text className="mono t-micro mt-4 block">
                        {'原价 ¥' + plan.listText}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
              {/*  订单明细  */}
              <View className="card card-pad gap">
                <Text className="col-h mb-12 block">订单明细</Text>
                {plan.listText && (
                  <View className="od-row">
                    <Text>商品原价</Text>
                    <Text className="mono">{'¥' + plan.listText}</Text>
                  </View>
                )}
                {plan.saveText && (
                  <View className="od-row">
                    <Text>优惠</Text>
                    <Text className="mono t-pulse">{'-¥' + plan.saveText}</Text>
                  </View>
                )}
                <View className="hr mt-10 mb-10"></View>
                <View className="od-row od-row--total">
                  <Text>应付金额</Text>
                  <Text className="mono pay-total">{'¥' + plan.priceText}</Text>
                </View>
              </View>
              {/*  支付方式：只列服务端确认可用的通道  */}
              <View className="card card-pad gap">
                <Text className="col-h mb-10 block">支付方式</Text>
                <View className="pay-row pay-row--on">
                  <View className="pay-logo">
                    <UiIcon name="wechat" size={30} color="on-signal"></UiIcon>
                  </View>
                  <View className="f-1">
                    <Text className="pay-t">
                      {pay.mode === 'mock' ? '演示支付（Mock）' : '微信支付'}
                    </Text>
                    <Text className="t-tiny mt-4 block">{pay.hint}</Text>
                  </View>
                  <View className="radio radio--on">
                    <View className="radio-i"></View>
                  </View>
                </View>
                {iosBlocked && (
                  <View className="warn-box mt-12">
                    <UiIcon name="warn" size={32} color="danger"></UiIcon>
                    <Text className="t-meta t-danger">
                      当前 iOS
                      通道尚未开放，请在安卓/鸿蒙设备上开通，或联系服务老师协助。
                    </Text>
                  </View>
                )}
              </View>
              {/*  续费与提醒口径  */}
              <View className="card card-pad gap">
                <View
                  className="f"
                  style={{
                    gap: '0.3rem',
                  }}
                >
                  <UiIcon name="shield" size={30} color="signal"></UiIcon>
                  <Text className="col-h">到期与续费说明</Text>
                </View>
                <Text className="t-meta mt-8 block">
                  有效期自支付成功起算。到期前会通过站内消息与微信服务通知提醒你续费；
                  本平台不做自动扣费，续费需你手动确认。已生效的权益可在「会员权益」中随时查看。
                </Text>
              </View>
            </Block>
          ) : (
            <View className="card card-pad">
              <View className="blank">
                <View className="blank-mark">
                  <UiIcon name="warn" size={52} color="warn"></UiIcon>
                </View>
                <Text className="blank-title">这个方案已经不可购买</Text>
                <Text className="blank-hint">
                  套餐可能已下架或调整，请返回重新选择。
                </Text>
                <View className="btn-sm mt-16" onClick={this.backToPlans}>
                  重新选择方案
                </View>
              </View>
            </View>
          )}
        </View>
        {plan && (
          <View className="action-bar">
            <View
              className={'cta cta--primary ' + (paying ? 'cta--busy' : '')}
              onClick={this.submit}
            >
              <Text>{paying ? '处理中…' : '确认支付 ¥' + plan.priceText}</Text>
              {!paying && (
                <View className="cta-arrow">
                  <UiIcon name="arrow" size={30} color="on-signal"></UiIcon>
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    )
  }
}
export default _C
