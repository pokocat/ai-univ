import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 工单进度（设计稿 28）。
 *
 * 四步进度读 `ticket_event` 流水，**不由 status 反推**：status 只有三态
 * （待处理/进行中/已解决），而设计稿要回答「几点受理的、谁在处理」——三态反推不出来。
 * 每步时间取该类事件的**首次**发生时间（服务端口径），否则重复标记会让
 * 「14:35 受理」几天后变成「今天 09:12 受理」，用户会以为工单被重置了。
 *
 * 「评价服务」只在工单已解决且尚未评价时出现——没解决就请人打分，
 * 或让人重复评同一件事，都是在制造无意义的动作。
 */
const api = require('../../api/mp.js')
const { toast, d16 } = require('../../utils/fmt.js')
const { navVars } = require('../../utils/layout.js')
const { isAuthGateError } = require('../../utils/auth.js')
const log = require('../../utils/log.js')
import UiErrbar from '../../components/errbar/index'
import UiSubhead from '../../components/subhead/index'
import UiAvatar from '../../components/avatar/index'
import UiArt from '../../components/art/index'
import UiIcon from '../../components/icon/index'
import './index.scss'
const STEP_ICONS = ['doc', 'headset', 'user', 'chat']
cacheOptions.setOptionsToCache({
  data: {
    navPad: '',
    loading: true,
    err: '',
    retrying: false,
    ticketNo: '',
    ticket: null,
    events: [],
    createdText: '',
    repliedText: '',
    dueText: '',
    heroTitle: '工单已受理',
    heroDesc: '',
    canReview: false,
    stepIcons: STEP_ICONS,
  },
  onLoad(options) {
    this.setData(
      Object.assign(
        {
          ticketNo: (options && options.ticketNo) || '',
        },
        navVars()
      )
    )
    this.load()
  },
  onShow() {
    if (this.data.ticket) this.load()
  },
  async load() {
    if (!this.data.ticketNo) {
      this.setData({
        loading: false,
        ticket: null,
      })
      return
    }
    this.setData({
      retrying: true,
    })
    try {
      const t = await api.getTicket(this.data.ticketNo)
      const steps = (t.steps || []).map((s) =>
        Object.assign({}, s, {
          atText: s.at ? d16(s.at).slice(5) : '',
        })
      )
      const resolved = t.status === '已解决'
      this.setData({
        loading: false,
        err: '',
        retrying: false,
        ticket: Object.assign({}, t, {
          steps,
        }),
        events: (t.events || []).map((e) =>
          Object.assign({}, e, {
            timeText: d16(e.created_at),
          })
        ),
        createdText: d16(t.created_at),
        repliedText: d16(t.replied_at),
        dueText: resolved ? '' : this.dueHint(t.due_at),
        heroTitle: resolved
          ? '工单已解决'
          : t.status === '进行中'
          ? '正在处理'
          : '工单已提交',
        heroDesc: resolved
          ? '如果问题仍未解决，可以再提交一张工单并附上本单编号'
          : '你的问题已进入服务流程，我们会在承诺时限内处理',
        canReview: resolved && !t.reviewed,
      })
    } catch (e) {
      if (isAuthGateError(e)) return
      log.warn('ticket detail', e.message)
      this.setData({
        loading: false,
        retrying: false,
        ticket: null,
      })
    }
  },
  /** 承诺时限提示。已超时如实说「已超时」，不显示一个负数小时 */
  dueHint(dueAt) {
    if (!dueAt) return ''
    const diff =
      new Date(
        String(dueAt).replace(/-/g, '/').replace(/\..*$/, '')
      ).getTime() - Date.now()
    if (isNaN(diff)) return ''
    if (diff <= 0) return '已超过承诺时限'
    const h = Math.floor(diff / 3600000)
    return h >= 1 ? '还剩约 ' + h + ' 小时' : '即将到期'
  },
  copyNo() {
    Taro.setClipboardData({
      data: this.data.ticketNo,
      success: () => toast('工单编号已复制'),
    })
  },
  review() {
    Taro.navigateTo({
      url:
        '/pages/review/index?targetType=' +
        encodeURIComponent('服务工单') +
        '&targetRef=' +
        this.data.ticketNo,
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
      ticket,
      heroTitle,
      heroDesc,
      dueText,
      stepIcons,
      createdText,
      repliedText,
      events,
      canReview,
    } = this.data
    return (
      <View className="screen screen--bar">
        <View className="ambience"></View>
        <View className="layer">
          <UiSubhead title="工单进度" home="/pages/ticket/index"></UiSubhead>
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
          ) : ticket ? (
            <Block>
              <View className="card result-hero">
                <View className="result-hero-text">
                  <View className="title-grad tr-title">{heroTitle}</View>
                  <Text className="t-sec mt-8 block">{heroDesc}</Text>
                  <View
                    className="f f-wrap mt-12"
                    style={{
                      gap: '0.25rem',
                    }}
                  >
                    <View className="pill-outline">
                      <UiIcon name="clock" size={21} color="signal"></UiIcon>
                      <Text>{ticket.status}</Text>
                    </View>
                    {dueText && (
                      <View className="pill-outline pill-outline--pulse">
                        <UiIcon name="alarm" size={21} color="pulse"></UiIcon>
                        <Text>{dueText}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View className="result-hero-art">
                  <UiArt kind="gem" w={230} icon="headset" variant="tr"></UiArt>
                </View>
              </View>
              {/*  四步进度：读 ticket_event 流水（status 只有三态，反推不出「几点受理」）  */}
              <View className="card card-pad gap">
                <View className="f-between mb-16">
                  <Text className="col-h">处理进度</Text>
                  <View className="link-trail" onClick={this.load}>
                    <Text>刷新</Text>
                    <UiIcon name="refresh" size={22} color="ink-800"></UiIcon>
                  </View>
                </View>
                <View className="hprog">
                  {ticket.steps.map((item, index) => {
                    return (
                      <Block key={item.title}>
                        <View className="hprog-step">
                          <View
                            className={
                              'hprog-node ' +
                              (item.reached
                                ? item.active
                                  ? 'hprog-node--active'
                                  : 'hprog-node--done'
                                : '')
                            }
                          >
                            <UiIcon
                              name={stepIcons[index]}
                              size={32}
                              color={item.reached ? 'on-signal' : 'ink-800'}
                            ></UiIcon>
                          </View>
                          <Text
                            className={
                              'hprog-t ' + (item.reached ? '' : 'hprog-t--off')
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
                          {item.atText && (
                            <Text className="hprog-d mono">{item.atText}</Text>
                          )}
                        </View>
                        {index < ticket.steps.length - 1 && (
                          <View
                            className={
                              'hprog-line ' +
                              (item.reached ? 'hprog-line--on' : '')
                            }
                          ></View>
                        )}
                      </Block>
                    )
                  })}
                </View>
              </View>
              {/*  工单信息  */}
              <View className="card card-pad gap">
                <Text className="col-h mb-10 block">工单信息</Text>
                <View className="info-card">
                  <View className="ic-row">
                    <View className="ic-l">
                      <UiIcon name="doc" size={26} color="ink-800"></UiIcon>
                      <Text>工单编号</Text>
                    </View>
                    <View
                      className="f"
                      style={{
                        gap: '0.2rem',
                      }}
                      onClick={this.copyNo}
                    >
                      <Text className="ic-v mono">{ticket.ticket_no}</Text>
                      <UiIcon name="copy" size={22} color="ink-600"></UiIcon>
                    </View>
                  </View>
                  <View className="ic-row">
                    <View className="ic-l">
                      <UiIcon name="grid9" size={26} color="ink-800"></UiIcon>
                      <Text>问题类型</Text>
                    </View>
                    <Text className="ic-v">{ticket.ticket_type}</Text>
                  </View>
                  <View className="ic-row">
                    <View className="ic-l">
                      <UiIcon name="clock" size={26} color="ink-800"></UiIcon>
                      <Text>提交时间</Text>
                    </View>
                    <Text className="ic-v mono">{createdText}</Text>
                  </View>
                  <View className="ic-row">
                    <View className="ic-l">
                      <UiIcon name="alarm" size={26} color="ink-800"></UiIcon>
                      <Text>承诺时限</Text>
                    </View>
                    <Text className="ic-v mono">
                      {ticket.sla_total_hours + ' 小时'}
                    </Text>
                  </View>
                  <View className="ic-row">
                    <View className="ic-l">
                      <UiIcon name="shield" size={26} color="ink-800"></UiIcon>
                      <Text>当前状态</Text>
                    </View>
                    <Text className="ic-v t-signal">{ticket.status}</Text>
                  </View>
                </View>
              </View>
              {/*  我的描述  */}
              <View className="card card-pad gap">
                <Text className="col-h mb-10 block">我提交的问题</Text>
                <Text className="tr-desc">{ticket.description}</Text>
              </View>
              {/*  处理反馈：有才显示  */}
              {ticket.reply && (
                <View className="card card-pad gap">
                  <View className="f-between mb-10">
                    <Text className="col-h">处理反馈</Text>
                    <Text className="t-tiny mono">{repliedText}</Text>
                  </View>
                  <Text className="tr-desc">{ticket.reply}</Text>
                </View>
              )}
              {/*  处理人：有才显示  */}
              {ticket.assignee_name ? (
                <View className="card card-pad gap">
                  <Text className="col-h mb-12 block">为你处理的服务老师</Text>
                  <View
                    className="f"
                    style={{
                      gap: '0.525rem',
                    }}
                  >
                    <UiAvatar
                      name={ticket.assignee_name}
                      size={96}
                      ring={true}
                    ></UiAvatar>
                    <View className="f-1">
                      <View
                        className="f"
                        style={{
                          gap: '0.3rem',
                        }}
                      >
                        <Text className="t-h3">{ticket.assignee_name}</Text>
                        <Text className="tag tag--purple">专属服务</Text>
                      </View>
                      {ticket.assignee_title && (
                        <Text className="t-tiny mt-6 block">
                          {ticket.assignee_title}
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
                ticket.status !== '已解决' && (
                  <View className="box box--sunk gap">
                    <View
                      className="f"
                      style={{
                        gap: '0.3rem',
                      }}
                    >
                      <UiIcon name="clock" size={28} color="signal"></UiIcon>
                      <Text className="t-sec fw-600">等待分配处理人</Text>
                    </View>
                    <Text className="t-tiny mt-6 block">
                      分配后会在这里显示，并通过站内消息通知你。
                    </Text>
                  </View>
                )
              )}
              {/*  进度流水（完整时间线）  */}
              {events?.length && (
                <View className="card card-pad gap">
                  <Text className="col-h mb-10 block">处理记录</Text>
                  <View className="timeline">
                    {events?.map((item, index) => {
                      return (
                        <View key={item.created_at} className="tl-item">
                          <View className="tl-rail">
                            <View className="tl-node"></View>
                            {index < events?.length - 1 && (
                              <View className="tl-line"></View>
                            )}
                          </View>
                          <View className="f-1 tr-event">
                            <Text className="tr-event-t">
                              {item.event_type}
                            </Text>
                            {item.detail && (
                              <Text className="t-tiny mt-4 block">
                                {item.detail}
                              </Text>
                            )}
                            <Text className="t-micro mono mt-4 block">
                              {item.timeText}
                            </Text>
                          </View>
                        </View>
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
                  <UiIcon name="doc" size={52} color="signal"></UiIcon>
                </View>
                <Text className="blank-title">找不到这张工单</Text>
                <Text className="blank-hint">
                  它可能不属于你，或编号不正确。
                </Text>
                <View
                  className="btn-sm mt-16"
                  data-url="/pages/ticket/index"
                  onClick={this.go}
                >
                  返回服务工单
                </View>
              </View>
            </View>
          )}
        </View>
        {ticket && (
          <View className="action-bar">
            <View className="action-row">
              {canReview ? (
                <View className="cta cta--primary" onClick={this.review}>
                  <UiIcon name="ribbon" size={32} color="on-signal"></UiIcon>
                  <Text>评价服务</Text>
                </View>
              ) : (
                <View
                  className="cta cta--primary"
                  data-url="/pages/advisor/index"
                  onClick={this.go}
                >
                  <UiIcon name="headset" size={32} color="on-signal"></UiIcon>
                  <Text>联系服务老师</Text>
                </View>
              )}
              <View
                className="cta cta--ghost"
                data-url="/pages/ticket/index?tab=mine"
                onClick={this.go}
              >
                <UiIcon name="doc" size={30} color="signal"></UiIcon>
                <Text>我的工单</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    )
  }
}
export default _C
