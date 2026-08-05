import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * AI 诊断（设计稿 07）。
 *
 * **报告不是服务端算出来的**（见 DiagnosisService 类注释）：它由服务老师结合数据出具后回填。
 * 所以这一页有报告就显示真实评分与建议，没有报告就如实说明它是怎么来的——
 * 绝不显示一个 0 分的空壳报告，那会让人以为系统真的评估过他。
 *
 * 维度环的百分比来自报告里的 metrics；「续费概率」这类带 % 的值原样解析，
 * 拿不到数值的维度不画环（画一个 0% 的环等于说「你这项是 0 分」）。
 */
const api = require('../../api/mp.js')
const { toast, d16 } = require('../../utils/fmt.js')
const { navVars } = require('../../utils/layout.js')
const { isAuthGateError } = require('../../utils/auth.js')
const log = require('../../utils/log.js')
import UiRing from '../../components/ring/index'
import UiErrbar from '../../components/errbar/index'
import UiSubhead from '../../components/subhead/index'
import UiArt from '../../components/art/index'
import UiIcon from '../../components/icon/index'
import './index.scss'
const RING_COLORS = ['signal-600', 'signal', 'pulse', 'pulse-300']
const LEVEL_TAG = {
  高: 'red',
  中等: 'amber',
  中: 'amber',
  低: 'green',
  优先: 'pink',
  建议: 'blue',
}
cacheOptions.setOptionsToCache({
  data: {
    navPad: '',
    tab: 'report',
    loading: true,
    err: '',
    retrying: false,
    benefit: null,
    quotaTitle: '',
    quotaHint: '',
    report: null,
    reportAt: '',
    metrics: [],
    issues: [],
    advices: [],
    pending: null,
    pendingAt: '',
    bookings: [],
    ctaText: '预约 AI 诊断',
  },
  onLoad() {
    this.setData(navVars())
  },
  onShow() {
    this.load()
  },
  switchTab(e) {
    this.setData({
      tab: getTarget(e.currentTarget, Taro).dataset.tab,
    })
  },
  async load() {
    this.setData({
      retrying: true,
    })
    try {
      const d = await api.getDiagnosis()
      const benefit = d.benefit || {}
      const report = d.report
      const pending = d.pending
      this.setData({
        loading: false,
        err: '',
        retrying: false,
        benefit,
        quotaTitle: this.quotaTitle(benefit),
        quotaHint: benefit.available
          ? benefit.status_hint || '提交后 2 个工作日内反馈'
          : benefit.lockReason || '升级会员后可使用',
        report,
        reportAt: d16(report && report.diagnosed_at),
        metrics: this.buildMetrics(report),
        issues: ((report && report.issues) || []).map((i) => ({
          text: i.text || i.title || '',
          level: i.level || '',
          tagColor: LEVEL_TAG[i.level] || 'amber',
        })),
        advices: ((report && report.advices) || []).map((a) => ({
          title: a.title || '',
          desc: a.desc || '',
          icon: a.icon || 'star2',
          level: a.level || '',
          tagColor: LEVEL_TAG[a.level] || 'blue',
        })),
        pending,
        pendingAt: d16(pending && pending.created_at),
        bookings: (d.bookings || []).map((b) => ({
          booking_no: b.booking_no,
          status: b.status,
          advisor_name: b.advisor_name,
          typeText: Array.isArray(b.diagnosis_types)
            ? b.diagnosis_types.join(' · ')
            : 'AI 诊断',
          timeText: d16(b.created_at),
        })),
        ctaText: pending
          ? '查看当前诊断进度'
          : benefit.available
          ? '预约 AI 诊断'
          : '查看会员方案',
      })
    } catch (e) {
      if (isAuthGateError(e)) return
      log.error('diagnosis load', e.message)
      this.setData({
        loading: false,
        retrying: false,
        err: e.message,
      })
    }
  },
  quotaTitle(benefit) {
    if (!benefit || benefit.quotaTotal == null) return 'AI 诊断权益'
    if (benefit.quotaLeft == null) return '本月余量待人工核对'
    return '本月剩余 ' + benefit.quotaLeft + ' / ' + benefit.quotaTotal + ' 次'
  },
  /** 维度环：解析不出数值的维度**不画环**，避免把「没数据」显示成 0 分 */
  buildMetrics(report) {
    const list = (report && report.metrics) || []
    return list
      .map((m, i) => {
        const raw = m.value
        const num = typeof raw === 'number' ? raw : parseFloat(String(raw))
        if (isNaN(num)) return null
        return {
          label: m.label || m.key || '',
          pct: Math.max(0, Math.min(100, num)),
          valueText: String(raw),
          note: m.note || '',
          color: RING_COLORS[i % RING_COLORS.length],
        }
      })
      .filter(Boolean)
      .slice(0, 4)
  },
  book() {
    if (this.data.pending) {
      Taro.navigateTo({
        url:
          '/pages/booking-result/index?bookingNo=' +
          this.data.pending.booking_no,
      })
      return
    }
    if (!this.data.benefit || !this.data.benefit.available) {
      Taro.navigateTo({
        url: '/pages/subscribe/index',
      })
      return
    }
    Taro.navigateTo({
      url: '/pages/diagnosis-booking/index',
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
      tab,
      bookings,
      benefit,
      quotaTitle,
      quotaHint,
      pending,
      pendingAt,
      report,
      reportAt,
      metrics,
      issues,
      advices,
      ctaText,
    } = this.data
    return (
      <View className="screen screen--bar">
        <View className="ambience"></View>
        <View className="layer">
          <UiSubhead title="AI 诊断" home="/pages/index/index"></UiSubhead>
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
              <View className="topseg">
                <View
                  className={
                    'topseg-item ' + (tab === 'report' ? 'topseg-item--on' : '')
                  }
                  data-tab="report"
                  onClick={this.switchTab}
                >
                  诊断报告
                </View>
                <View
                  className={
                    'topseg-item ' + (tab === 'log' ? 'topseg-item--on' : '')
                  }
                  data-tab="log"
                  onClick={this.switchTab}
                >
                  <Text>诊断记录</Text>
                  {bookings?.length && (
                    <Text className="seg-badge">{bookings?.length}</Text>
                  )}
                </View>
              </View>
              {/*  hero  */}
              <View className="card card--hero dg-hero">
                <View className="eyebrow">
                  <UiIcon name="sparkle" size={26} color="signal"></UiIcon>
                  <Text>AI 智能诊断</Text>
                </View>
                <View
                  className="f-start"
                  style={{
                    gap: '0.2rem',
                  }}
                >
                  <View className="f-1">
                    <View className="title-grad dg-title">
                      洞察问题 · 驱动增长
                    </View>
                    <Text className="lead">
                      结合你的社群与业务数据，输出增长、活跃、转化与服务四个维度的诊断建议。
                    </Text>
                  </View>
                  <UiArt kind="aigem" w={215} variant="dg"></UiArt>
                </View>
                {benefit && (
                  <View className="box box--sunk mt-14">
                    <View className="f-between">
                      <Text className="t-sec fw-600">{quotaTitle}</Text>
                      <View
                        className="link-trail link-trail--signal"
                        data-url="/pages/benefit-detail/index?code=ai_diagnosis"
                        onClick={this.go}
                      >
                        <Text>权益说明</Text>
                        <UiIcon name="chev" size={22} color="signal"></UiIcon>
                      </View>
                    </View>
                    <Text className="t-tiny mt-6 block">{quotaHint}</Text>
                  </View>
                )}
              </View>
              {tab === 'report' ? (
                <Block>
                  {pending && (
                    <View
                      className="card card-pad gap"
                      data-url={
                        '/pages/booking-result/index?bookingNo=' +
                        pending.booking_no
                      }
                      onClick={this.go}
                    >
                      <View className="f-between mb-12">
                        <Text className="col-h">进行中的诊断</Text>
                        <View className="tag tag--purple">
                          {pending.status}
                        </View>
                      </View>
                      <Text className="t-sec">{pending.core_problem}</Text>
                      <View className="f-between mt-12">
                        <Text className="t-tiny mono">
                          {'提交于 ' + pendingAt}
                        </Text>
                        <View className="link-trail">
                          <Text>查看进度</Text>
                          <UiIcon
                            name="chev"
                            size={22}
                            color="ink-800"
                          ></UiIcon>
                        </View>
                      </View>
                    </View>
                  )}
                  {/*  有报告：真实评分与建议  */}
                  {report ? (
                    <Block>
                      <View className="card card-pad gap">
                        <View className="f-between mb-14">
                          <Text className="col-h">综合评分</Text>
                          <Text className="t-tiny mono">
                            {'诊断于 ' + reportAt}
                          </Text>
                        </View>
                        <View
                          className="f"
                          style={{
                            gap: '0.35rem',
                          }}
                        >
                          <View className="dg-grade ta-c">
                            <View className="title-grad dg-grade-v">
                              {report.grade || '—'}
                            </View>
                            {report.percentile != null && (
                              <Text className="t-tiny mt-6 block">
                                超过
                                <Text className="mono">
                                  {report.percentile + '%'}
                                </Text>
                                的主理人
                              </Text>
                            )}
                          </View>
                          {metrics?.length && (
                            <View
                              className="f-1 f"
                              style={{
                                gap: '0.15rem',
                              }}
                            >
                              {metrics?.map((item, index) => {
                                return (
                                  <View key={item.label} className="f-1 ta-c">
                                    <UiRing
                                      pct={item.pct}
                                      size={100}
                                      color={item.color}
                                      label={item.label}
                                      extStyle="margin:0 auto;"
                                    ></UiRing>
                                    <Text className="dg-metric-v mono">
                                      {item.valueText}
                                    </Text>
                                    <Text className="t-micro">{item.note}</Text>
                                  </View>
                                )
                              })}
                            </View>
                          )}
                        </View>
                        {report.summary && (
                          <Text className="t-meta mt-14 block">
                            {report.summary}
                          </Text>
                        )}
                      </View>
                      {issues?.length && (
                        <View className="card card-pad gap">
                          <View
                            className="f mb-12"
                            style={{
                              gap: '0.3rem',
                            }}
                          >
                            <UiIcon
                              name="warn"
                              size={28}
                              color="pulse"
                            ></UiIcon>
                            <Text className="col-h">问题识别</Text>
                          </View>
                          {issues?.map((item, index) => {
                            return (
                              <View key={item.text} className="issue-row">
                                <View className="issue-dot"></View>
                                <Text className="f-1 t-sec">{item.text}</Text>
                                <Text className={'tag tag--' + item.tagColor}>
                                  {item.level}
                                </Text>
                              </View>
                            )
                          })}
                        </View>
                      )}
                      {advices?.length && (
                        <View className="card card-pad gap">
                          <View
                            className="f mb-8"
                            style={{
                              gap: '0.3rem',
                            }}
                          >
                            <UiIcon
                              name="star2"
                              size={28}
                              color="signal"
                            ></UiIcon>
                            <Text className="col-h">建议动作</Text>
                          </View>
                          {advices?.map((item, index) => {
                            return (
                              <View key={item.title} className="row-item">
                                <View className="row-ico">
                                  <UiIcon
                                    name={item.icon}
                                    size={32}
                                    color="signal"
                                  ></UiIcon>
                                </View>
                                <View className="f-1">
                                  <Text className="dg-advice-t">
                                    {item.title}
                                  </Text>
                                  <Text className="t-tiny mt-4 block">
                                    {item.desc}
                                  </Text>
                                </View>
                                {item.level && (
                                  <Text className={'tag tag--' + item.tagColor}>
                                    {item.level}
                                  </Text>
                                )}
                              </View>
                            )
                          })}
                        </View>
                      )}
                    </Block>
                  ) : (
                    <View className="card card-pad gap">
                      <View className="blank">
                        <View className="blank-mark">
                          <UiIcon
                            name="sparkle"
                            size={52}
                            color="signal"
                          ></UiIcon>
                        </View>
                        <Text className="blank-title">还没有你的诊断报告</Text>
                        <Text className="blank-hint">
                          诊断报告不是自动算出来的：提交需求后由服务老师结合你的数据出具，
                          一般 2 个工作日内反馈。提交一次即可。
                        </Text>
                      </View>
                    </View>
                  )}
                  {/*  没有报告：如实说明它是怎么来的，不显示一个 0 分的假报告  */}
                </Block>
              ) : (
                <Block>
                  {bookings?.length ? (
                    <View className="card card-pad">
                      <Text className="col-h mb-8 block">诊断记录</Text>
                      {bookings?.map((item, index) => {
                        return (
                          <View
                            key={item.booking_no}
                            className="row-item"
                            data-url={
                              '/pages/booking-result/index?bookingNo=' +
                              item.booking_no
                            }
                            onClick={this.go}
                          >
                            <View className="row-ico">
                              <UiIcon
                                name="doc"
                                size={32}
                                color="signal"
                              ></UiIcon>
                            </View>
                            <View className="f-1">
                              <Text className="dg-advice-t">
                                {item.typeText}
                              </Text>
                              <Text className="t-tiny mono mt-4 block">
                                {item.timeText}
                              </Text>
                            </View>
                            <View className="ta-r">
                              <Text
                                className={
                                  'tag tag--' +
                                  (item.status === '已生成报告'
                                    ? 'green'
                                    : item.status === '已取消'
                                    ? 'gray'
                                    : 'purple')
                                }
                              >
                                {item.status}
                              </Text>
                              {item.advisor_name && (
                                <Text className="t-micro mt-6 block">
                                  {item.advisor_name}
                                </Text>
                              )}
                            </View>
                          </View>
                        )
                      })}
                    </View>
                  ) : (
                    <View className="card card-pad">
                      <View className="blank">
                        <View className="blank-mark">
                          <UiIcon
                            name="clock"
                            size={52}
                            color="signal"
                          ></UiIcon>
                        </View>
                        <Text className="blank-title">还没有诊断记录</Text>
                        <Text className="blank-hint">
                          提交第一次诊断需求后，进度与历史都会出现在这里。
                        </Text>
                      </View>
                    </View>
                  )}
                </Block>
              )}
              {/*  诊断记录  */}
            </Block>
          )}
        </View>
        <View className="action-bar">
          <View className="cta cta--primary" onClick={this.book}>
            <Text>{ctaText}</Text>
            <View className="cta-arrow">
              <UiIcon name="arrow" size={30} color="on-signal"></UiIcon>
            </View>
          </View>
        </View>
      </View>
    )
  }
}
export default _C
