import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 会员订阅（设计稿 02）。
 *
 * 与设计稿的三处**故意不同**，都是诚实度问题：
 *  ① 没有「自动续费」开关。系统里没有周期扣费能力（membership_order 是一次性订单，
 *     到期由 runExpiry 置过期 + enqueueExpiryReminders 发提醒）。摆一个开关就是承诺
 *     一件做不到的事，而且它关系到钱。改为如实说明「到期提醒、不自动扣费」。
 *  ② 权益对比表的行来自 /mp/benefits（真实权益目录），不是写死的六行文案。
 *     普通会员那一列按 min_identity 是否为空判断——那正是「不需要付费档就能用」的定义。
 *  ③ 划线原价与「省多少」只在套餐真的配了 list_price_cents 时显示，
 *     不用现价反推一个假原价。
 *
 * 价格按平台取：iOS 有独立定价（对冲苹果税），取错会让结账金额与展示不一致。
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
    plans: [],
    compare: [],
    selected: '',
    pay: {
      mode: 'disabled',
      disabled: true,
      hint: '',
    },
    iosBlocked: false,
  },
  onLoad() {
    this.setData(navVars())
  },
  onShow() {
    this.load()
  },
  async load() {
    this.setData({
      retrying: true,
    })
    try {
      const [membership, benefits, payCfg] = await Promise.all([
        api.getMembership(),
        api.getBenefits(false),
        pay.config(),
      ])
      const ios = api.platformChannel() === 'ios'
      const plans = ((membership && membership.renewPlans) || []).map((p) =>
        this.decoratePlan(p, ios)
      )
      const recommended = plans.find((p) => p.recommended) || plans[0]
      this.setData({
        loading: false,
        err: '',
        retrying: false,
        plans,
        compare: (benefits || []).slice(0, 8).map((b) => ({
          code: b.code,
          name: b.name,
          icon: b.icon,
          // min_identity 为空 = 不需要付费档就能用，即普通会员也有
          freeIncluded: !b.min_identity,
        })),
        selected: recommended ? recommended.plan_code : '',
        pay: payCfg,
        // iOS 通道未开放时**在这一页就说清楚**：等用户选完档、点了下一步才在支付页
        // 撞上「iOS 暂不可用」，那一步是白走的
        iosBlocked: ios && payCfg.iosEnabled === false,
      })
    } catch (e) {
      if (isAuthGateError(e)) return
      log.error('subscribe load', e.message)
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
    const days = p.duration_days
    const unit =
      days >= 360 ? '/年' : days >= 88 ? '/季' : days >= 28 ? '/月' : ''
    // 划线价按同平台口径比较：iOS 价与安卓原价相减会算出一个没有意义的「省」
    const list = p.list_price_cents
    const save = list != null && list > cents ? (list - cents) / 100 : null
    return Object.assign({}, p, {
      priceText: money(cents / 100),
      unitText: unit,
      durationText: days + ' 天',
      saveText: save == null ? '' : money(save),
    })
  },
  pick(e) {
    this.setData({
      selected: getTarget(e.currentTarget, Taro).dataset.code,
    })
  },
  next() {
    if (this.data.pay.disabled) {
      toast(this.data.pay.hint)
      return
    }
    if (this.data.iosBlocked) {
      toast('当前 iOS 通道尚未开放，可在安卓/鸿蒙设备上开通')
      return
    }
    if (!this.data.selected) {
      toast('请选择一个会员方案')
      return
    }
    Taro.navigateTo({
      url: '/pages/payment/index?planCode=' + this.data.selected,
    })
  },
  go(e) {
    const url = getTarget(e.currentTarget, Taro).dataset.url
    if (url)
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
      compare,
      plans,
      selected,
      pay,
      iosBlocked,
    } = this.data
    return (
      <View className="screen screen--bar">
        <View className="ambience"></View>
        <View className="layer">
          <UiSubhead title="会员订阅" home="/pages/member/index"></UiSubhead>
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
              <View className="card card--hero sub-hero">
                <View className="sub-hero-top">
                  <Text className="sub-hero-t">
                    AI 驱动 · 资源链接 · 共同成长
                  </Text>
                  <Text className="sub-hero-d">主理人公社会员计划</Text>
                  <UiArt
                    kind="gem"
                    w={230}
                    icon="crown"
                    variant="sub"
                    extStyle="margin:0.35rem auto 0;"
                  ></UiArt>
                  <Text className="sub-hero-d mt-8">
                    连接优质资源，放大商业影响力
                  </Text>
                </View>
                {compare?.length && (
                  <View className="cmp">
                    <View className="cmp-head">
                      <Text className="cmp-c1">权益对比</Text>
                      <Text className="cmp-c2">普通会员</Text>
                      <Text className="cmp-c3">付费会员</Text>
                    </View>
                    {compare?.map((item, index) => {
                      return (
                        <View key={item.code} className="cmp-row">
                          <View className="cmp-c1">
                            <UiIcon
                              name={item.icon}
                              size={28}
                              color="ink-800"
                            ></UiIcon>
                            <Text>{item.name}</Text>
                          </View>
                          <View className="cmp-c2">
                            {item.freeIncluded ? (
                              <UiIcon
                                name="shield"
                                size={28}
                                color="ok"
                              ></UiIcon>
                            ) : (
                              <UiIcon
                                name="xcircle"
                                size={28}
                                color="ink-500"
                              ></UiIcon>
                            )}
                          </View>
                          <View className="cmp-c3">
                            <UiIcon
                              name="shield"
                              size={28}
                              color="signal"
                            ></UiIcon>
                          </View>
                        </View>
                      )
                    })}
                  </View>
                )}
              </View>
              {/*  套餐选项  */}
              {plans?.length ? (
                <Block>
                  {plans?.map((item, index) => {
                    return (
                      <View
                        key={item.plan_code}
                        className={
                          'plan-row gap ' +
                          (selected === item.plan_code ? 'plan-row--on' : '')
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
                              gap: '0.35rem',
                            }}
                          >
                            <Text className="plan-name">{item.name}</Text>
                            {item.badge && (
                              <Text className="tag tag--amber">
                                {item.badge}
                              </Text>
                            )}
                            {item.recommended && (
                              <Text className="tag tag--purple">推荐</Text>
                            )}
                          </View>
                          <Text className="t-tiny mt-4 block">
                            {item.durationText +
                              (item.summary ? ' · ' + item.summary : '')}
                          </Text>
                        </View>
                        <View className="ta-r">
                          <View className="price">
                            <Text className="price-cur">¥</Text>
                            <Text className="price-v mono">
                              {item.priceText}
                            </Text>
                            <Text className="price-unit">{item.unitText}</Text>
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
                <View className="card card-pad">
                  <View className="blank">
                    <View className="blank-mark">
                      <UiIcon name="crown" size={52} color="signal"></UiIcon>
                    </View>
                    <Text className="blank-title">暂无可购买的会员方案</Text>
                    <Text className="blank-hint">
                      运营还没有上架会员套餐，可以先联系服务老师了解，或稍后再来。
                    </Text>
                    <View
                      className="btn-sm mt-16"
                      data-url="/pages/advisor/index"
                      onClick={this.go}
                    >
                      联系服务老师
                    </View>
                  </View>
                </View>
              )}
              {/*  支付通道如实说明：不摆一个必然失败的支付入口  */}
              {plans?.length && (
                <View className="box box--sunk gap">
                  <View
                    className="f"
                    style={{
                      gap: '0.3rem',
                    }}
                  >
                    <UiIcon
                      name={pay.disabled ? 'warn' : 'shield'}
                      size={28}
                      color={pay.disabled ? 'warn' : 'signal'}
                    ></UiIcon>
                    <Text className="t-sec fw-600">{pay.hint}</Text>
                  </View>
                  <Text className="t-tiny mt-6 block">
                    到期前会通过站内消息与微信服务通知提醒你续费。本平台不做自动扣费，续费需你手动确认。
                  </Text>
                </View>
              )}
              {/*  iOS 通道未开放：在选档这一页就说清楚，不让用户白走一步  */}
              {iosBlocked && (
                <View className="warn-box gap">
                  <UiIcon name="warn" size={32} color="danger"></UiIcon>
                  <Text className="t-meta t-danger">
                    当前 iOS
                    通道尚未开放，可在安卓/鸿蒙设备上开通，或联系服务老师协助。
                  </Text>
                </View>
              )}
            </Block>
          )}
        </View>
        {plans?.length && (
          <View className="action-bar">
            <View
              className={
                'cta cta--primary ' + (pay.disabled ? 'cta--muted' : '')
              }
              onClick={this.next}
            >
              <Text>
                {pay.disabled ? '支付通道开通中' : '下一步 · 确认订单'}
              </Text>
              {!pay.disabled && (
                <View className="cta-arrow">
                  <UiIcon name="arrow" size={30} color="on-signal"></UiIcon>
                </View>
              )}
            </View>
            <View
              className="f-center mt-12"
              style={{
                gap: '0.25rem',
              }}
            >
              <UiIcon name="shield" size={24} color="ink-600"></UiIcon>
              <Text className="t-micro">开通即表示同意</Text>
              <Text
                className="t-micro t-signal"
                data-url="/pages/agreement/index?type=membership"
                onClick={this.go}
              >
                《会员服务协议》
              </Text>
            </View>
          </View>
        )}
      </View>
    )
  }
}
export default _C
