import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 预约详情 / 预约成功（设计稿 25）。
 *
 * 四步进度由服务端按 status 推导（DiagnosisService.steps），前端只渲染——
 * 前端自己算会在状态定义变化时与服务端分叉，而这条进度条是用户判断
 * 「还要等多久」的唯一依据。
 *
 * 「预计反馈时间」用服务端给的 expected_feedback_at；没有就不显示，
 * 不在前端按「今天 +2 天」编一个日期（那会在排期变化后变成一个错误的承诺）。
 */
const api = require('../../api/mp.js')
const { toast, d10, d16 } = require('../../utils/fmt.js')
const { navVars } = require('../../utils/layout.js')
const { isAuthGateError } = require('../../utils/auth.js')
const log = require('../../utils/log.js')
import UiErrbar from '../../components/errbar/index'
import UiSubhead from '../../components/subhead/index'
import UiAvatar from '../../components/avatar/index'
import UiArt from '../../components/art/index'
import UiIcon from '../../components/icon/index'
import './index.scss'
const STEP_ICONS = ['shield', 'sparkle', 'user', 'doc']
const ENDED = ['已生成报告', '已取消']
cacheOptions.setOptionsToCache({
  data: {
    navPad: '',
    loading: true,
    err: '',
    retrying: false,
    bookingNo: '',
    booking: null,
    typeText: '',
    submitText: '',
    feedbackText: '',
    heroTitle: '预约成功',
    heroDesc: '',
    ended: false,
    stepIcons: STEP_ICONS,
  },
  onLoad(options) {
    this.setData(
      Object.assign(
        {
          bookingNo: (options && options.bookingNo) || '',
        },
        navVars()
      )
    )
    this.load()
  },
  onShow() {
    if (this.data.booking) this.load()
  },
  async load() {
    if (!this.data.bookingNo) {
      this.setData({
        loading: false,
        booking: null,
      })
      return
    }
    this.setData({
      retrying: true,
    })
    try {
      const b = await api.getDiagnosisBooking(this.data.bookingNo)
      const ended = ENDED.indexOf(b.status) >= 0
      this.setData({
        loading: false,
        err: '',
        retrying: false,
        booking: b,
        ended,
        typeText: Array.isArray(b.diagnosis_types)
          ? b.diagnosis_types.join(' · ')
          : 'AI 诊断',
        submitText: d16(b.created_at),
        feedbackText: ended ? '' : d10(b.expected_feedback_at),
        heroTitle:
          b.status === '已生成报告'
            ? '诊断已完成'
            : b.status === '已取消'
            ? '预约已取消'
            : '预约成功',
        heroDesc:
          b.status === '已生成报告'
            ? '报告已生成，可在 AI 诊断页查看完整建议'
            : b.status === '已取消'
            ? b.cancel_reason || '本次预约已取消，本月配额已释放'
            : '需求已提交，我们会为你匹配排期与服务老师',
      })
    } catch (e) {
      if (isAuthGateError(e)) return
      log.warn('booking detail', e.message)
      this.setData({
        loading: false,
        retrying: false,
        booking: null,
      })
    }
  },
  copyNo() {
    Taro.setClipboardData({
      data: this.data.bookingNo,
      success: () => toast('预约编号已复制'),
    })
  },
  cancel() {
    Taro.showModal({
      title: '取消预约',
      content: '取消后本月的诊断配额会释放，可以稍后重新提交。',
      confirmText: '取消预约',
      confirmColor: '#C43149',
      success: async (r) => {
        if (!r.confirm) return
        try {
          await api.cancelDiagnosisBooking(this.data.bookingNo, '会员自行取消')
          toast('已取消')
          this.load()
        } catch (e) {
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
      booking,
      heroTitle,
      heroDesc,
      feedbackText,
      stepIcons,
      typeText,
      submitText,
      ended,
    } = this.data
    return (
      <View className="screen screen--bar">
        <View className="ambience"></View>
        <View className="layer">
          <UiSubhead title="预约详情" home="/pages/diagnosis/index"></UiSubhead>
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
          ) : booking ? (
            <Block>
              <View className="card result-hero">
                <View className="result-hero-text">
                  <View className="title-grad br-title">{heroTitle}</View>
                  <Text className="t-sec mt-8 block">{heroDesc}</Text>
                  <View
                    className="f f-wrap mt-12"
                    style={{
                      gap: '0.25rem',
                    }}
                  >
                    <View className="pill-outline">
                      <UiIcon name="sparkle" size={21} color="signal"></UiIcon>
                      <Text>{booking.status}</Text>
                    </View>
                    {feedbackText && (
                      <View className="pill-outline pill-outline--pulse">
                        <UiIcon name="clock" size={21} color="pulse"></UiIcon>
                        <Text>{feedbackText + ' 前反馈'}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View className="result-hero-art">
                  <UiArt kind="check" w={230} variant="br"></UiArt>
                </View>
              </View>
              {/*  四步进度：由服务端 status 推导，与诊断状态一一对应  */}
              <View className="card card-pad gap">
                <View className="f-between mb-16">
                  <Text className="col-h">预约进度</Text>
                  <View className="link-trail" onClick={this.load}>
                    <Text>实时更新</Text>
                    <UiIcon name="refresh" size={22} color="ink-800"></UiIcon>
                  </View>
                </View>
                <View className="hprog">
                  {booking.steps.map((item, index) => {
                    return (
                      <Block key={item.title}>
                        <View className="hprog-step">
                          <View
                            className={
                              'hprog-node ' +
                              (item.done
                                ? 'hprog-node--done'
                                : item.active
                                ? 'hprog-node--active'
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
                            style={
                              item.active ? 'color:var(--signal-800);' : ''
                            }
                          >
                            {item.state}
                          </Text>
                        </View>
                        {index < booking.steps.length - 1 && (
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
              {/*  预约信息  */}
              <View className="card card-pad gap">
                <View className="f-between mb-8">
                  <Text className="col-h">预约信息</Text>
                  <View className="pill-outline" onClick={this.copyNo}>
                    <UiIcon name="copy" size={21} color="signal"></UiIcon>
                    <Text>复制编号</Text>
                  </View>
                </View>
                <View className="info-card">
                  <View className="ic-row">
                    <View className="ic-l">
                      <UiIcon name="doc" size={26} color="ink-800"></UiIcon>
                      <Text>预约编号</Text>
                    </View>
                    <Text className="ic-v mono">{booking.booking_no}</Text>
                  </View>
                  <View className="ic-row">
                    <View className="ic-l">
                      <UiIcon name="crown" size={26} color="ink-800"></UiIcon>
                      <Text>诊断类型</Text>
                    </View>
                    <Text className="ic-v">{typeText}</Text>
                  </View>
                  <View className="ic-row">
                    <View className="ic-l">
                      <UiIcon name="clock" size={26} color="ink-800"></UiIcon>
                      <Text>提交时间</Text>
                    </View>
                    <Text className="ic-v mono">{submitText}</Text>
                  </View>
                  {booking.city && (
                    <View className="ic-row">
                      <View className="ic-l">
                        <UiIcon name="pin" size={26} color="ink-800"></UiIcon>
                        <Text>所在城市</Text>
                      </View>
                      <Text className="ic-v">{booking.city}</Text>
                    </View>
                  )}
                  <View className="ic-row">
                    <View className="ic-l">
                      <UiIcon name="target" size={26} color="ink-800"></UiIcon>
                      <Text>当前状态</Text>
                    </View>
                    <Text className="ic-v t-signal">{booking.status}</Text>
                  </View>
                </View>
              </View>
              {/*  我提交的内容  */}
              <View className="card card-pad gap">
                <Text className="col-h mb-10 block">我提交的内容</Text>
                <View className="detail-row">
                  <View className="detail-l">
                    <UiIcon name="info" size={30} color="signal"></UiIcon>
                    <Text>核心问题</Text>
                  </View>
                  <Text className="detail-v">{booking.core_problem}</Text>
                </View>
                <View className="detail-row">
                  <View className="detail-l">
                    <UiIcon name="target" size={30} color="signal"></UiIcon>
                    <Text>期望目标</Text>
                  </View>
                  <Text className="detail-v">{booking.expect_goal}</Text>
                </View>
              </View>
              {/*  服务老师：只在真的分配了才显示  */}
              {booking.advisor_name ? (
                <View className="card card-pad gap">
                  <Text className="col-h mb-12 block">为你分配的服务老师</Text>
                  <View
                    className="f"
                    style={{
                      gap: '0.525rem',
                    }}
                  >
                    <UiAvatar
                      name={booking.advisor_name}
                      size={100}
                      ring={true}
                    ></UiAvatar>
                    <View className="f-1">
                      <View
                        className="f"
                        style={{
                          gap: '0.3rem',
                        }}
                      >
                        <Text className="t-h3">{booking.advisor_name}</Text>
                        <Text className="tag tag--purple">专属服务</Text>
                      </View>
                      {booking.advisor_title && (
                        <Text className="t-tiny mt-6 block">
                          {booking.advisor_title}
                        </Text>
                      )}
                    </View>
                    <View
                      className="btn-soft"
                      data-url="/pages/advisor/index"
                      onClick={this.go}
                    >
                      联系
                    </View>
                  </View>
                </View>
              ) : (
                !ended && (
                  <View className="box box--sunk gap">
                    <View
                      className="f"
                      style={{
                        gap: '0.3rem',
                      }}
                    >
                      <UiIcon name="clock" size={28} color="signal"></UiIcon>
                      <Text className="t-sec fw-600">服务老师匹配中</Text>
                    </View>
                    <Text className="t-tiny mt-6 block">
                      匹配完成后会在这里显示，并通过站内消息通知你。
                    </Text>
                  </View>
                )
              )}
              {/*  报告已出：直接给入口  */}
              {booking.report_no && (
                <View
                  className="card card--signal gap br-report"
                  data-url="/pages/diagnosis/index"
                  onClick={this.go}
                >
                  <UiIcon name="chart" size={45} color="on-signal"></UiIcon>
                  <View className="f-1">
                    <Text className="br-report-t">诊断报告已生成</Text>
                    <Text className="br-report-d">
                      {'报告编号 ' + booking.report_no}
                    </Text>
                  </View>
                  <View className="br-report-btn">
                    <Text>去查看</Text>
                    <UiIcon name="arrow" size={24} color="on-signal"></UiIcon>
                  </View>
                </View>
              )}
            </Block>
          ) : (
            <View className="card card-pad">
              <View className="blank">
                <View className="blank-mark">
                  <UiIcon name="doc" size={52} color="signal"></UiIcon>
                </View>
                <Text className="blank-title">找不到这条预约</Text>
                <Text className="blank-hint">
                  它可能不属于你，或编号不正确。
                </Text>
                <View
                  className="btn-sm mt-16"
                  data-url="/pages/diagnosis/index"
                  onClick={this.go}
                >
                  返回 AI 诊断
                </View>
              </View>
            </View>
          )}
        </View>
        {booking && (
          <View className="action-bar">
            <View className="action-row">
              {!ended && (
                <View className="cta cta--ghost" onClick={this.cancel}>
                  <UiIcon name="xcircle" size={30} color="signal"></UiIcon>
                  <Text>取消预约</Text>
                </View>
              )}
              <View
                className="cta cta--primary"
                data-url="/pages/diagnosis/index"
                onClick={this.go}
              >
                <UiIcon name="sparkle" size={32} color="on-signal"></UiIcon>
                <Text>返回 AI 诊断</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    )
  }
}
export default _C
