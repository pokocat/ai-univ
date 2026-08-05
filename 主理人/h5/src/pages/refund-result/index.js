import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 退款进度（设计稿 30）。
 *
 * 四步进度由服务端按「订单状态 + 审批状态」推导（RefundRequestService.steps）。
 * 「预计到账时间」**不编具体日期**：中台不掌握支付渠道的打款时效（护栏 15），
 * 编一个日期到期没到账用户就会来问，而我们无法回答。
 */
const api = require('../../api/mp.js')
const { toast, money, d16 } = require('../../utils/fmt.js')
const { navVars } = require('../../utils/layout.js')
const { isAuthGateError } = require('../../utils/auth.js')
const log = require('../../utils/log.js')
import UiErrbar from '../../components/errbar/index'
import UiSubhead from '../../components/subhead/index'
import UiArt from '../../components/art/index'
import UiIcon from '../../components/icon/index'
import './index.scss'
const STEP_ICONS = ['doc', 'shield', 'card', 'bell']
cacheOptions.setOptionsToCache({
  data: {
    navPad: '',
    loading: true,
    err: '',
    retrying: false,
    orderNo: '',
    refund: null,
    amountText: '',
    appliedText: '',
    decisionComment: '',
    heroTitle: '退款处理中',
    heroDesc: '',
    stepIcons: STEP_ICONS,
  },
  onLoad(options) {
    this.setData(
      Object.assign(
        {
          orderNo: (options && options.orderNo) || '',
        },
        navVars()
      )
    )
    this.load()
  },
  onShow() {
    if (this.data.refund) this.load()
  },
  async load() {
    if (!this.data.orderNo) {
      this.setData({
        loading: false,
        refund: null,
      })
      return
    }
    this.setData({
      retrying: true,
    })
    try {
      const r = await api.getRefund(this.data.orderNo)
      const approval = r.approval || null
      const steps = (r.steps || []).map((s) =>
        Object.assign({}, s, {
          atText: s.at ? d16(s.at).slice(5) : '',
        })
      )
      const refunded = r.status === '已退款'
      const rejected = approval && approval.status === '已拒绝'
      this.setData({
        loading: false,
        err: '',
        retrying: false,
        refund: Object.assign({}, r, {
          steps,
        }),
        amountText: money((r.amount_cents || 0) / 100),
        appliedText: d16(approval && approval.created_at),
        decisionComment: (approval && approval.decision_comment) || '',
        heroTitle: refunded
          ? '退款已完成'
          : rejected
          ? '退款未通过'
          : '退款审核中',
        heroDesc: refunded
          ? '本单授予的会员时长已回收，款项由支付渠道退回'
          : rejected
          ? '本次申请未通过审核，订单权益保持不变'
          : '申请已提交，平台正在审核，请留意站内消息',
      })
    } catch (e) {
      if (isAuthGateError(e)) return
      log.warn('refund detail', e.message)
      this.setData({
        loading: false,
        retrying: false,
        refund: null,
      })
    }
  },
  copyNo() {
    Taro.setClipboardData({
      data: this.data.orderNo,
      success: () => toast('订单编号已复制'),
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
      refund,
      heroTitle,
      heroDesc,
      stepIcons,
      amountText,
      appliedText,
      decisionComment,
    } = this.data
    return (
      <View className="screen screen--bar">
        <View className="ambience"></View>
        <View className="layer">
          <UiSubhead title="退款进度" home="/pages/refund/index"></UiSubhead>
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
          ) : refund ? (
            <Block>
              <View className="card result-hero">
                <View className="result-hero-text">
                  <Text className="tag tag--purple tag--round">退款进度</Text>
                  <View className="title-grad rr-title">{heroTitle}</View>
                  <Text className="t-sec mt-8 block">{heroDesc}</Text>
                </View>
                <View className="result-hero-art">
                  <UiArt kind="gem" w={220} icon="yrefund" variant="rr"></UiArt>
                </View>
              </View>
              {/*  四步进度  */}
              <View className="card card-pad gap">
                <View className="f-between mb-16">
                  <Text className="col-h">处理进度</Text>
                  <View className="link-trail" onClick={this.load}>
                    <Text>刷新</Text>
                    <UiIcon name="refresh" size={22} color="ink-800"></UiIcon>
                  </View>
                </View>
                <View className="hprog">
                  {refund.steps.map((item, index) => {
                    return (
                      <Block key={item.title}>
                        <View className="hprog-step">
                          <View
                            className={
                              'hprog-node ' +
                              (item.done
                                ? 'hprog-node--done'
                                : item.active
                                ? 'hprog-node--pulse'
                                : '')
                            }
                          >
                            <UiIcon
                              name={stepIcons[index]}
                              size={32}
                              color={
                                item.done || item.active
                                  ? 'on-signal'
                                  : 'ink-800'
                              }
                            ></UiIcon>
                          </View>
                          <Text
                            className={
                              'hprog-t ' +
                              (item.done || item.active ? '' : 'hprog-t--off')
                            }
                          >
                            {item.title}
                          </Text>
                          <Text
                            className="hprog-s"
                            style={item.active ? 'color:var(--pulse-600);' : ''}
                          >
                            {item.state}
                          </Text>
                          {item.atText && (
                            <Text className="hprog-d mono">{item.atText}</Text>
                          )}
                        </View>
                        {index < refund.steps.length - 1 && (
                          <View
                            className={
                              'hprog-line ' +
                              (item.done ? 'hprog-line--on' : '')
                            }
                          ></View>
                        )}
                      </Block>
                    )
                  })}
                </View>
              </View>
              {/*  退款信息  */}
              <View className="card card-pad gap">
                <Text className="col-h mb-10 block">退款信息</Text>
                <View className="info-card">
                  <View className="ic-row">
                    <View className="ic-l">
                      <UiIcon name="doc" size={26} color="ink-800"></UiIcon>
                      <Text>订单编号</Text>
                    </View>
                    <View
                      className="f"
                      style={{
                        gap: '0.2rem',
                      }}
                      onClick={this.copyNo}
                    >
                      <Text className="ic-v mono">{refund.order_no}</Text>
                      <UiIcon name="copy" size={22} color="ink-600"></UiIcon>
                    </View>
                  </View>
                  <View className="ic-row">
                    <View className="ic-l">
                      <UiIcon name="crown" size={26} color="ink-800"></UiIcon>
                      <Text>会员方案</Text>
                    </View>
                    <Text className="ic-v">{refund.plan_name}</Text>
                  </View>
                  <View className="ic-row">
                    <View className="ic-l">
                      <UiIcon name="card" size={26} color="ink-800"></UiIcon>
                      <Text>退款金额</Text>
                    </View>
                    <Text className="ic-v mono t-pulse">
                      {'¥' + amountText}
                    </Text>
                  </View>
                  {appliedText && (
                    <View className="ic-row">
                      <View className="ic-l">
                        <UiIcon name="clock" size={26} color="ink-800"></UiIcon>
                        <Text>申请时间</Text>
                      </View>
                      <Text className="ic-v mono">{appliedText}</Text>
                    </View>
                  )}
                  <View className="ic-row">
                    <View className="ic-l">
                      <UiIcon name="shield" size={26} color="ink-800"></UiIcon>
                      <Text>当前状态</Text>
                    </View>
                    <Text className="ic-v t-signal">{refund.status}</Text>
                  </View>
                  <View className="ic-row">
                    <View className="ic-l">
                      <UiIcon name="info" size={26} color="ink-800"></UiIcon>
                      <Text>到账说明</Text>
                    </View>
                    <Text className="ic-v">{refund.etaHint}</Text>
                  </View>
                </View>
              </View>
              {decisionComment && (
                <View className="card card-pad gap">
                  <Text className="col-h mb-8 block">审核意见</Text>
                  <Text className="rr-comment">{decisionComment}</Text>
                </View>
              )}
              <View className="warn-box gap">
                <UiIcon name="warn" size={32} color="danger"></UiIcon>
                <Text className="t-meta t-danger">
                  已使用的部分权益可能影响退款结果，最终以平台审核为准；
                  实际到账时间由支付渠道决定，中台只负责审批与权益回收。
                </Text>
              </View>
            </Block>
          ) : (
            <View className="card card-pad">
              <View className="blank">
                <View className="blank-mark">
                  <UiIcon name="yrefund" size={52} color="signal"></UiIcon>
                </View>
                <Text className="blank-title">找不到这笔退款</Text>
                <Text className="blank-hint">
                  订单可能不属于你，或还没有提交过退款申请。
                </Text>
                <View
                  className="btn-sm mt-16"
                  data-url="/pages/refund/index"
                  onClick={this.go}
                >
                  返回订单与退款
                </View>
              </View>
            </View>
          )}
        </View>
        {refund && (
          <View className="action-bar">
            <View className="action-row">
              <View
                className="cta cta--primary"
                data-url="/pages/advisor/index"
                onClick={this.go}
              >
                <UiIcon name="headset" size={32} color="on-signal"></UiIcon>
                <Text>联系服务老师</Text>
              </View>
              <View
                className="cta cta--ghost"
                data-url="/pages/mine/index"
                onClick={this.go}
              >
                <UiIcon name="user" size={30} color="signal"></UiIcon>
                <Text>返回我的</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    )
  }
}
export default _C
