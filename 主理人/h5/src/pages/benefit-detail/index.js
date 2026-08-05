import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 权益详情（设计稿 26）。
 *
 * 详情行来自 `membership_benefit.detail`（运营可维护的 JSONB），不是写死在小程序里——
 * 写死的那份要过审才能更新，运营改一句权益说明得等一次发版。
 *
 * 「最近使用记录」有真实来源就显示时间，没有就显示「暂无」并说明它什么时候会有；
 * 「使用流程」只在该权益真的有流程时渲染（目前只有 AI 诊断），
 * 给别的权益也摆三步流程等于凭空发明一套不存在的办事路径。
 */
const api = require('../../api/mp.js')
const { toast, d10 } = require('../../utils/fmt.js')
const { navVars } = require('../../utils/layout.js')
const { isAuthGateError } = require('../../utils/auth.js')
const log = require('../../utils/log.js')

/** 有真实办事路径的权益才配流程；其余留空 */
import UiErrbar from '../../components/errbar/index'
import UiSubhead from '../../components/subhead/index'
import UiArt from '../../components/art/index'
import UiIcon from '../../components/icon/index'
import './index.scss'
const FLOWS = {
  ai_diagnosis: [
    {
      icon: 'edit',
      title: '提交需求',
      desc: '填写社群与业务信息',
    },
    {
      icon: 'sparkle',
      title: '智能匹配',
      desc: '匹配服务老师与排期',
    },
    {
      icon: 'chart',
      title: '获取报告',
      desc: '拿到诊断建议与方案',
    },
  ],
}
cacheOptions.setOptionsToCache({
  data: {
    navPad: '',
    loading: true,
    err: '',
    retrying: false,
    code: '',
    benefit: null,
    detail: [],
    flow: [],
    quotaLeftText: '不限',
    quotaUsedText: '无次数限制',
    lastUsedText: '暂无',
    lastUsedHint: '使用后显示记录',
    ctaText: '立即使用',
  },
  onLoad(options) {
    this.setData(
      Object.assign(
        {
          code: (options && options.code) || 'ai_diagnosis',
        },
        navVars()
      )
    )
  },
  onShow() {
    this.load()
  },
  async load() {
    this.setData({
      retrying: true,
    })
    try {
      const benefit = await api.getBenefit(this.data.code)
      const state = {
        loading: false,
        err: '',
        retrying: false,
        benefit,
      }
      state.detail = Array.isArray(benefit.detail) ? benefit.detail : []
      state.flow = FLOWS[this.data.code] || []
      if (benefit.quotaTotal == null) {
        state.quotaLeftText = '不限'
        state.quotaUsedText = '无次数限制'
      } else if (benefit.quotaLeft == null) {
        // 服务端说这项权益的用量口径还没接入——如实转述，不显示一个假的「已用 0」
        state.quotaLeftText = '—'
        state.quotaUsedText = benefit.quotaHint || '余量以人工核对为准'
      } else {
        state.quotaLeftText = benefit.quotaLeft + ' 次'
        state.quotaUsedText =
          '已用 ' + benefit.quotaUsed + ' / ' + benefit.quotaTotal
      }
      // 最近使用记录：目前只有 AI 诊断能给出真实时间（预约记录）
      if (this.data.code === 'ai_diagnosis') {
        const diag = await api.getDiagnosis().catch(() => null)
        const last = diag && diag.bookings && diag.bookings[0]
        if (last) {
          state.lastUsedText = d10(last.created_at)
          state.lastUsedHint = last.status
        }
        state.ctaText = benefit.available ? '预约诊断' : '查看会员方案'
      } else {
        state.lastUsedText = '暂无'
        state.lastUsedHint = '本权益暂未接入使用记录'
        state.ctaText = benefit.available
          ? benefit.action_page
            ? '立即使用'
            : '联系服务老师'
          : '查看会员方案'
      }
      this.setData(state)
    } catch (e) {
      if (isAuthGateError(e)) return
      log.error('benefit detail load', e.message)
      this.setData({
        loading: false,
        retrying: false,
        err: e.message,
        benefit: null,
      })
    }
  },
  use() {
    const b = this.data.benefit
    if (!b) return
    if (!b.available) {
      Taro.navigateTo({
        url: '/pages/subscribe/index',
      })
      return
    }
    if (this.data.code === 'ai_diagnosis') {
      Taro.navigateTo({
        url: '/pages/diagnosis-booking/index',
      })
      return
    }
    if (b.action_page && b.action_page !== '/pages/benefit-detail/index') {
      const url = b.action_page
      if (/^\/pages\/(index|group|member|notifications|mine)\/index$/.test(url))
        Taro.switchTab({
          url,
        })
      else
        Taro.navigateTo({
          url,
          fail: () => toast('页面暂不可用'),
        })
      return
    }
    // 没有落地页的权益（资源库/闭门会）走人工：如实把人送到服务老师那里
    Taro.navigateTo({
      url: '/pages/advisor/index',
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
      benefit,
      detail,
      quotaLeftText,
      quotaUsedText,
      lastUsedText,
      lastUsedHint,
      flow,
      ctaText,
    } = this.data
    return (
      <View className="screen screen--bar">
        <View className="ambience"></View>
        <View className="layer">
          <UiSubhead title="权益详情" home="/pages/benefits/index"></UiSubhead>
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
          ) : benefit ? (
            <Block>
              <View className="card card--hero bd-hero">
                <View
                  className="f-start"
                  style={{
                    gap: '0.2rem',
                  }}
                >
                  <View className="f-1">
                    <Text
                      className={
                        'tag tag--' +
                        (benefit.available ? 'purple' : 'gray') +
                        ' tag--round'
                      }
                    >
                      {benefit.available
                        ? benefit.min_identity
                          ? benefit.min_identity + ' 专享'
                          : '全体会员'
                        : '未解锁'}
                    </Text>
                    <View className="title-grad bd-title">{benefit.name}</View>
                    <Text className="lead">{benefit.summary}</Text>
                    <View
                      className="f f-wrap mt-12"
                      style={{
                        gap: '0.25rem',
                      }}
                    >
                      {benefit.quotaTotal && (
                        <View className="pill-outline">
                          <UiIcon
                            name="calendar"
                            size={21}
                            color="signal"
                          ></UiIcon>
                          <Text>{'每月 ' + benefit.quotaTotal + ' 次'}</Text>
                        </View>
                      )}
                      <View className="pill-outline">
                        <UiIcon
                          name="shield"
                          size={21}
                          color="signal-600"
                        ></UiIcon>
                        <Text>{benefit.status_hint}</Text>
                      </View>
                    </View>
                  </View>
                  <UiArt kind="aigem" w={220} variant="bd"></UiArt>
                </View>
              </View>
              {/*  权益详情行：来自 membership_benefit.detail，运营可维护  */}
              {detail?.length && (
                <View className="card card-pad gap">
                  <Text className="col-h mb-8 block">权益详情</Text>
                  {detail?.map((item, index) => {
                    return (
                      <View key={item.label} className="detail-row">
                        <View className="detail-l">
                          <UiIcon name="doc" size={30} color="signal"></UiIcon>
                          <Text>{item.label}</Text>
                        </View>
                        <Text className="detail-v">{item.value}</Text>
                      </View>
                    )
                  })}
                </View>
              )}
              {/*  三格状态  */}
              <View className="card three-col bd-stat gap">
                <View className="stat-3-item">
                  <UiIcon
                    name="star2"
                    size={42}
                    color="signal"
                    extStyle="margin:0 auto;"
                  ></UiIcon>
                  <Text className="s3-l">本月剩余</Text>
                  <Text className="s3-v">{quotaLeftText}</Text>
                  <Text className="s3-d">{quotaUsedText}</Text>
                </View>
                <View className="stat-3-item">
                  <UiIcon
                    name="shield"
                    size={42}
                    color={benefit.available ? 'ok' : 'ink-500'}
                    extStyle="margin:0 auto;"
                  ></UiIcon>
                  <Text className="s3-l">当前状态</Text>
                  <Text
                    className="s3-v"
                    style={{
                      color: `var(--${benefit.available ? 'ok' : 'ink-600'})`,
                    }}
                  >
                    {benefit.available ? '可使用' : '未解锁'}
                  </Text>
                  <Text className="s3-d">
                    {benefit.available
                      ? benefit.status_hint
                      : benefit.lockReason}
                  </Text>
                </View>
                <View className="stat-3-item">
                  <UiIcon
                    name="clock"
                    size={42}
                    color="signal"
                    extStyle="margin:0 auto;"
                  ></UiIcon>
                  <Text className="s3-l">最近使用</Text>
                  <Text className="s3-v">{lastUsedText}</Text>
                  <Text className="s3-d">{lastUsedHint}</Text>
                </View>
              </View>
              {/*  使用流程（AI 诊断有真实三步；其他权益不摆一个编的流程）  */}
              {flow?.length && (
                <View className="card card-pad gap">
                  <Text className="col-h mb-16 block">使用流程</Text>
                  <View className="flow3">
                    {flow?.map((item, index) => {
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
                          {index < flow?.length - 1 && (
                            <View className="flow-line"></View>
                          )}
                        </Block>
                      )
                    })}
                  </View>
                </View>
              )}
            </Block>
          ) : (
            <View className="card card-pad">
              <View className="blank">
                <View className="blank-mark">
                  <UiIcon name="gem" size={52} color="signal"></UiIcon>
                </View>
                <Text className="blank-title">这个权益不存在或已下架</Text>
                <Text className="blank-hint">
                  返回权益中心看看当前开放的权益。
                </Text>
                <View
                  className="btn-sm mt-16"
                  data-url="/pages/benefits/index"
                  onClick={this.go}
                >
                  返回权益中心
                </View>
              </View>
            </View>
          )}
        </View>
        {benefit && (
          <View className="action-bar">
            <View className="action-row">
              <View className="cta cta--primary" onClick={this.use}>
                <UiIcon name="pulse" size={32} color="on-signal"></UiIcon>
                <Text>{ctaText}</Text>
              </View>
              <View
                className="cta cta--ghost"
                data-url="/pages/benefits/index"
                onClick={this.go}
              >
                <UiIcon name="gem" size={30} color="signal"></UiIcon>
                <Text>全部权益</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    )
  }
}
export default _C
