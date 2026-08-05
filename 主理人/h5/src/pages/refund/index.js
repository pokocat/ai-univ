import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text, Textarea } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 订单与退款（设计稿 18「退款申请」）。
 *
 * 退款走「审批单 → 回调执行器」（护栏 18）：提交后订单进「退款中」并生成审批单，
 * 运营同意才置「已退款」并回收本单授予的权益时长（V38 的权益链重排）。
 * **真实资金退回归外部支付渠道**（护栏 15：中台只做审批协同），
 * 所以页面上不承诺具体到账日期，只说「以渠道回执为准」。
 *
 * 可退款订单只列「已支付」的；退款中/已退款的订单在下方记录里给进度入口——
 * 把它们混进选择列表会让人以为可以再退一次。
 */
const api = require('../../api/mp.js')
const { toast, money, d10 } = require('../../utils/fmt.js')
const { navVars } = require('../../utils/layout.js')
const { isAuthGateError } = require('../../utils/auth.js')
const log = require('../../utils/log.js')
import UiErrbar from '../../components/errbar/index'
import UiSubhead from '../../components/subhead/index'
import UiArt from '../../components/art/index'
import UiIcon from '../../components/icon/index'
import './index.scss'
const REASON_ICON = {
  误购: 'card',
  时间冲突: 'clock',
  服务未使用: 'folder',
  其他原因: 'more',
}
const STATUS_TAG = {
  已支付: 'green',
  退款中: 'amber',
  已退款: 'gray',
  待支付: 'blue',
  已关闭: 'gray',
}
const FLOW = [
  {
    icon: 'edit',
    title: '提交申请',
    desc: '选择订单与原因',
  },
  {
    icon: 'shield',
    title: '平台审核',
    desc: '1-2 个工作日内审核',
  },
  {
    icon: 'bell',
    title: '结果通知',
    desc: '站内消息与微信通知',
  },
]
cacheOptions.setOptionsToCache({
  data: {
    navPad: '',
    loading: true,
    err: '',
    retrying: false,
    orders: [],
    history: [],
    reasons: [],
    selected: '',
    reason: '',
    note: '',
    submitting: false,
    flow: FLOW,
  },
  onLoad() {
    this.idemKey = api.idemKey('mprefund')
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
      const [opts, me] = await Promise.all([
        api.getRefundOptions(),
        api.getMe(),
      ])
      const orders = ((opts && opts.orders) || []).map((o) => ({
        order_no: o.order_no,
        plan_name: o.plan_name,
        amountText: money((o.amount_cents || 0) / 100),
        paidText: o.paid_at ? d10(o.paid_at) + ' 支付' : '',
      }))
      const reasons = ((opts && opts.reasons) || []).map((r) => ({
        label: r.label,
        icon: REASON_ICON[r.label] || 'more',
      }))
      this.setData({
        loading: false,
        err: '',
        retrying: false,
        orders,
        reasons,
        selected: orders.length ? orders[0].order_no : '',
        reason: reasons.length ? reasons[0].label : '',
        // 订单记录：所有订单（含退款中/已退款），给进度入口
        history: ((me && me.orders) || []).map((o) => ({
          order_no: o.order_no,
          plan_name: o.plan_name,
          status: o.status,
          amountText: money((o.amount_cents || 0) / 100),
          tagColor: STATUS_TAG[o.status] || 'gray',
        })),
      })
    } catch (e) {
      if (isAuthGateError(e)) return
      log.error('refund load', e.message)
      this.setData({
        loading: false,
        retrying: false,
        err: e.message,
      })
    }
  },
  pickOrder(e) {
    this.setData({
      selected: getTarget(e.currentTarget, Taro).dataset.no,
    })
  },
  pickReason(e) {
    this.setData({
      reason: getTarget(e.currentTarget, Taro).dataset.label,
    })
  },
  onInput(e) {
    this.setData({
      note: e.detail.value,
    })
  },
  submit() {
    if (this.data.submitting) return
    if (!this.data.selected) {
      toast('请选择要退款的订单')
      return
    }
    if (!this.data.reason) {
      toast('请选择退款原因')
      return
    }
    // 退款是不可逆的资金动作，二次确认里把后果说清楚
    Taro.showModal({
      title: '确认提交退款申请',
      content:
        '提交后订单进入「退款中」，审核通过时会回收本单授予的会员时长。是否继续？',
      confirmText: '提交申请',
      confirmColor: '#C43149',
      success: async (r) => {
        if (!r.confirm) return
        this.setData({
          submitting: true,
        })
        try {
          await api.applyRefund(
            this.data.selected,
            this.data.reason,
            this.data.note.trim(),
            this.idemKey
          )
          Taro.redirectTo({
            url: '/pages/refund-result/index?orderNo=' + this.data.selected,
          })
        } catch (e) {
          this.setData({
            submitting: false,
          })
          toast(e.message)
        }
      },
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
      orders,
      selected,
      reasons,
      reason,
      note,
      flow,
      history,
      submitting,
    } = this.data
    return (
      <View className="screen screen--bar">
        <View className="ambience"></View>
        <View className="layer">
          <UiSubhead title="订单与退款" home="/pages/mine/index"></UiSubhead>
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
              <View className="card result-hero">
                <View className="result-hero-text">
                  <View className="title-grad rf-title">退款申请</View>
                  <Text className="t-sec mt-8 block">
                    提交原因后由平台审核，审核通过即回收权益并由支付渠道退回
                  </Text>
                  <View
                    className="f mt-12"
                    style={{
                      gap: '0.25rem',
                    }}
                  >
                    <View className="pill-outline">
                      <UiIcon name="shield" size={21} color="ok"></UiIcon>
                      <Text>审批留痕</Text>
                    </View>
                    <View className="pill-outline">
                      <UiIcon name="lock" size={21} color="signal"></UiIcon>
                      <Text>信息保密</Text>
                    </View>
                  </View>
                </View>
                <View className="result-hero-art">
                  <UiArt kind="gem" w={220} icon="yrefund" variant="rf"></UiArt>
                </View>
              </View>
              {/*  可退款订单  */}
              <View className="card card-pad gap">
                <View className="f-between mb-12">
                  <Text className="col-h">选择要退款的订单</Text>
                  <Text className="req">必填</Text>
                </View>
                {orders?.length ? (
                  <Block>
                    {orders?.map((item, index) => {
                      return (
                        <View
                          key={item.order_no}
                          className={
                            'rf-order ' +
                            (selected === item.order_no ? 'rf-order--on' : '')
                          }
                          data-no={item.order_no}
                          onClick={this.pickOrder}
                        >
                          <View
                            className={
                              'radio ' +
                              (selected === item.order_no ? 'radio--on' : '')
                            }
                          >
                            {selected === item.order_no && (
                              <View className="radio-i"></View>
                            )}
                          </View>
                          <View className="f-1">
                            <Text className="rf-plan">{item.plan_name}</Text>
                            <Text className="t-tiny mono mt-4 block">
                              {item.order_no + ' · ' + item.paidText}
                            </Text>
                          </View>
                          <View className="price">
                            <Text className="price-cur">¥</Text>
                            <Text className="price-v mono">
                              {item.amountText}
                            </Text>
                          </View>
                        </View>
                      )
                    })}
                  </Block>
                ) : (
                  <View className="blank">
                    <View className="blank-mark">
                      <UiIcon name="receipt" size={45} color="signal"></UiIcon>
                    </View>
                    <Text className="blank-title">没有可申请退款的订单</Text>
                    <Text className="blank-hint">
                      只有「已支付」的订单可以申请退款。退款中与已退款的订单可在下方记录里查看进度。
                    </Text>
                  </View>
                )}
              </View>
              {/*  退款原因  */}
              {orders?.length && (
                <View className="card card-pad gap">
                  <View className="mb-12">
                    <Text className="col-h">退款原因</Text>
                    <Text className="star">*</Text>
                  </View>
                  <View className="four-col">
                    {reasons?.map((item, index) => {
                      return (
                        <View
                          key={item.label}
                          className={
                            'pick ' + (reason === item.label ? 'pick--on' : '')
                          }
                          data-label={item.label}
                          onClick={this.pickReason}
                        >
                          <UiIcon
                            name={item.icon}
                            size={38}
                            color={reason === item.label ? 'signal' : 'ink-800'}
                          ></UiIcon>
                          <Text className="pick-t">{item.label}</Text>
                        </View>
                      )
                    })}
                  </View>
                  <View className="mt-16 mb-10">
                    <Text className="t-h4">补充说明</Text>
                    <Text className="t-tiny">（选填）</Text>
                  </View>
                  <Textarea
                    className="textarea"
                    value={note}
                    placeholder="补充说明有助于加快审核"
                    maxlength="200"
                    onInput={this.onInput}
                  ></Textarea>
                  <View className="ta-r mt-6">
                    <Text className="t-micro mono">
                      {note?.length + '/200'}
                    </Text>
                  </View>
                </View>
              )}
              {/*  退款流程  */}
              {orders?.length && (
                <View className="card card-pad gap">
                  <Text className="col-h mb-16 block">退款流程</Text>
                  <View className="flow3">
                    {flow.map((item, index) => {
                      return (
                        <Block key={item.title}>
                          <View className="flow-item">
                            <Text className="flow-n mono">{index + 1}</Text>
                            <View className="flow-ico">
                              <UiIcon
                                name={item.icon}
                                size={38}
                                color="signal"
                              ></UiIcon>
                            </View>
                            <Text className="flow-t">{item.title}</Text>
                            <Text className="flow-d">{item.desc}</Text>
                          </View>
                          {index < flow.length - 1 && (
                            <View className="flow-line"></View>
                          )}
                        </Block>
                      )
                    })}
                  </View>
                </View>
              )}
              {orders?.length && (
                <View className="warn-box gap">
                  <UiIcon name="warn" size={32} color="danger"></UiIcon>
                  <Text className="t-meta t-danger">
                    提交后订单进入「退款中」，本单授予的会员时长会在审核通过时回收。
                    已使用的权益可能影响审核结果，请如实填写原因。
                  </Text>
                </View>
              )}
              {/*  退款/订单记录  */}
              {history?.length && (
                <View className="card card-pad gap">
                  <Text className="col-h mb-8 block">订单记录</Text>
                  {history?.map((item, index) => {
                    return (
                      <View
                        key={item.order_no}
                        className="row-item"
                        data-url={
                          '/pages/refund-result/index?orderNo=' + item.order_no
                        }
                        onClick={this.go}
                      >
                        <View className="row-ico">
                          <UiIcon
                            name="receipt"
                            size={32}
                            color="signal"
                          ></UiIcon>
                        </View>
                        <View className="f-1">
                          <Text className="rf-plan">{item.plan_name}</Text>
                          <Text className="t-micro mono mt-4 block">
                            {item.order_no}
                          </Text>
                        </View>
                        <View className="ta-r">
                          <Text className={'tag tag--' + item.tagColor}>
                            {item.status}
                          </Text>
                          <Text className="t-micro mono mt-6 block">
                            {'¥' + item.amountText}
                          </Text>
                        </View>
                      </View>
                    )
                  })}
                </View>
              )}
            </Block>
          )}
        </View>
        {orders?.length && (
          <View className="action-bar">
            <View className="action-row">
              <View
                className={
                  'cta cta--primary ' + (submitting ? 'cta--busy' : '')
                }
                onClick={this.submit}
              >
                <UiIcon name="edit" size={32} color="on-signal"></UiIcon>
                <Text>{submitting ? '提交中…' : '提交退款申请'}</Text>
              </View>
              <View
                className="cta cta--ghost"
                data-url="/pages/advisor/index"
                onClick={this.go}
              >
                <UiIcon name="headset" size={30} color="signal"></UiIcon>
                <Text>先问老师</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    )
  }
}
export default _C
