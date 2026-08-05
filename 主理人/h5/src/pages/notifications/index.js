import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 消息（设计稿 09「公告中心」）。两个页签：
 *  · 公告中心 —— `announcement`：一份内容多人可见，带分类与已读人数；
 *  · 通知消息 —— `mp_notification`：一人一条待办，后台状态变化必达（不依赖微信订阅授权）。
 *
 * 两者刻意分开（服务端也是两张表）：混在一起「N 位同学已查看」就没有地方算，
 * 而按人复制一份公告会让改一次标题要改 N 行。
 *
 * 订阅提醒横幅只在**服务端确认模板已配置**时出现（subscribe.prefetch 的 configured 位）——
 * 模板 ID 还没拿到就摆一个「开启提醒」，点了必然什么也不会发生。
 */
const api = require('../../api/mp.js')
const share = require('../../behaviors/share.js')
const { toast, d16 } = require('../../utils/fmt.js')
const { navVars } = require('../../utils/layout.js')
const { isAuthGateError } = require('../../utils/auth.js')
const subscribe = require('../../utils/subscribe.js')
const log = require('../../utils/log.js')

/** 公告分类 → 图标 / 标签配色。未登记的分类回落，不留空图标位 */
import UiErrbar from '../../components/errbar/index'
import UiApphead from '../../components/apphead/index'
import UiArt from '../../components/art/index'
import UiIcon from '../../components/icon/index'
import './index.scss'
const CATEGORY_STYLE = {
  系统: {
    icon: 'bell',
    tagColor: 'red',
  },
  课程: {
    icon: 'cap',
    tagColor: 'amber',
  },
  班级: {
    icon: 'members',
    tagColor: 'purple',
  },
  活动: {
    icon: 'calendar',
    tagColor: 'blue',
  },
  权益: {
    icon: 'crown',
    tagColor: 'purple',
  },
}

/** 站内消息事件类型 → 图标 */
const EVENT_ICON = {
  order_paid: 'card',
  refund_result: 'yrefund',
  assignment_joined: 'members',
  course_reminder: 'cap',
  expiry_reminder: 'clock',
  ticket_update: 'headset',
}
cacheOptions.setOptionsToCache(
  share.withShare({
    data: {
      navPad: '',
      tab: 'ann',
      loading: true,
      err: '',
      retrying: false,
      category: '',
      filters: [],
      announcements: [],
      featured: null,
      truncated: false,
      annUnread: 0,
      messages: [],
      msgUnread: 0,
      subscribable: false,
    },
    onLoad() {
      this.setData(navVars())
    },
    onShow() {
      const tabBar =
        typeof this.getTabBar === 'function' ? this.getTabBar() : null
      if (tabBar) tabBar.setTab(3)
      // 订阅模板必须先 prefetch：requestSubscribeMessage 要紧跟用户点击，
      // 点击时才拉接口会因为「不是手势触发」被微信拒掉
      subscribe.prefetch().then((cfg) => {
        const list = (cfg && cfg.templates) || []
        this.setData({
          subscribable: list.some((t) => t.configured),
        })
      })
      this.load()
    },
    onPullDownRefresh() {
      this.load().then(() => Taro.stopPullDownRefresh())
    },
    switchTab(e) {
      this.setData({
        tab: getTarget(e.currentTarget, Taro).dataset.tab,
      })
    },
    filterCategory(e) {
      this.setData(
        {
          category: getTarget(e.currentTarget, Taro).dataset.value || '',
        },
        () => this.load()
      )
    },
    async load() {
      this.setData({
        retrying: true,
      })
      try {
        const [ann, inbox] = await Promise.all([
          api.getAnnouncements(this.data.category, 20),
          api.getNotifications(false),
        ])
        const items = ((ann && ann.items) || []).map((a) => this.decorateAnn(a))
        // 置顶位取「重要且未读」的第一条；全都读过就不再占一整屏，直接进列表
        const featured =
          items.filter((a) => a.importance === '重要' && !a.read)[0] || null
        const app = Taro.getApp()
        if (app && app.globalData) {
          app.globalData.unread = (ann && ann.unread) || 0
        }
        this.setData({
          loading: false,
          err: '',
          retrying: false,
          filters: [
            {
              label: '全部',
              value: '',
            },
          ].concat(
            ((ann && ann.categories) || []).map((c) => ({
              label: c.label,
              value: c.label,
            }))
          ),
          announcements: featured
            ? items.filter((a) => a.ann_no !== featured.ann_no)
            : items,
          featured,
          truncated: !!(ann && ann.truncated),
          annUnread: (ann && ann.unread) || 0,
          messages: ((inbox && inbox.items) || []).map((m) => ({
            id: m.id,
            title: m.title,
            body: m.content,
            read_at: m.read_at,
            icon: EVENT_ICON[m.event_type] || 'bell',
            timeText: d16(m.created_at),
          })),
          msgUnread: (inbox && inbox.unreadCount) || 0,
        })
        const tabBar =
          typeof this.getTabBar === 'function' ? this.getTabBar() : null
        if (tabBar) tabBar.syncUnread()
      } catch (e) {
        if (isAuthGateError(e)) return
        log.error('notifications load', e.message)
        this.setData({
          loading: false,
          retrying: false,
          err: e.message,
        })
      }
    },
    decorateAnn(a) {
      const style = CATEGORY_STYLE[a.category] || {
        icon: 'megaphone',
        tagColor: 'purple',
      }
      return Object.assign({}, a, {
        icon: style.icon,
        tagColor: a.importance === '重要' ? 'red' : style.tagColor,
        timeText: d16(a.publish_at),
      })
    },
    openAnn(e) {
      Taro.navigateTo({
        url:
          '/pages/message/index?annNo=' +
          getTarget(e.currentTarget, Taro).dataset.no,
      })
    },
    async readMsg(e) {
      const id = getTarget(e.currentTarget, Taro).dataset.id
      const msg = this.data.messages.find((m) => m.id === id)
      if (!msg || msg.read_at) return
      try {
        await api.readNotification(id)
        this.load()
      } catch (err) {
        log.warn('read notification', err.message)
      }
    },
    async readAll() {
      try {
        await api.readAllNotifications()
        toast('已全部标记为已读')
        this.load()
      } catch (err) {
        toast(err.message)
      }
    },
    /**
     * 开启微信服务通知。必须在 tap handler 里**同步**调用 subscribe.request——
     * 中间插入 await 会让微信判定不是手势触发而静默拒绝（表现是弹不出授权框、也不报错）。
     */
    requestSubscribe() {
      subscribe
        .request(['order_paid', 'course_reminder', 'expiry_reminder'])
        .then((r) => {
          if (r.accepted > 0) toast('已开启，重要节点会通过微信提醒你')
          else if (r.configured === 0)
            toast('服务通知暂未开放，站内消息不受影响')
          else toast('未开启微信提醒，站内消息仍会照常送达')
        })
        .catch((err) => log.warn('subscribe', err.message))
    },
    go(e) {
      const { url, tab } = getTarget(e.currentTarget, Taro).dataset
      if (!url) return
      if (tab)
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
)
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const {
      tab,
      annUnread,
      msgUnread,
      err,
      retrying,
      loading,
      announcements,
      featured,
      filters,
      category,
      truncated,
      messages,
      subscribable,
    } = this.data
    return (
      <View className="screen screen--tab">
        <View className="ambience"></View>
        <View className="layer">
          <UiApphead sub="连接主理人 · 共创新商业"></UiApphead>
          <View className="topseg">
            <View
              className={
                'topseg-item ' + (tab === 'ann' ? 'topseg-item--on' : '')
              }
              data-tab="ann"
              onClick={this.switchTab}
            >
              <Text>公告中心</Text>
              {annUnread && <Text className="seg-badge">{annUnread}</Text>}
            </View>
            <View
              className={
                'topseg-item ' + (tab === 'msg' ? 'topseg-item--on' : '')
              }
              data-tab="msg"
              onClick={this.switchTab}
            >
              <Text>通知消息</Text>
              {msgUnread && <Text className="seg-badge">{msgUnread}</Text>}
            </View>
          </View>
          {err && (
            <UiErrbar
              msg={err}
              retrying={retrying}
              onRetry={this.load}
            ></UiErrbar>
          )}
          {/*  ───────── 公告中心 ─────────  */}
          {tab === 'ann' ? (
            <Block>
              {loading ? (
                <View className="card card-pad">
                  <View className="skeleton skeleton-block"></View>
                </View>
              ) : announcements?.length ? (
                <Block>
                  {featured && (
                    <View
                      className="card card--hero-3 ann-hero"
                      data-no={featured.ann_no}
                      onClick={this.openAnn}
                    >
                      <Text className="tag tag--pink tag--round">
                        {featured.category + ' · 重要'}
                      </Text>
                      <View
                        className="f-start mt-10"
                        style={{
                          gap: '0.25rem',
                        }}
                      >
                        <View className="f-1">
                          <Text className="ann-hero-t">{featured.title}</Text>
                          <Text className="lead mt-8 clamp-3">
                            {featured.summary}
                          </Text>
                          <View className="ghost-pill mt-12">
                            <Text>查看详情</Text>
                            <UiIcon
                              name="arrow"
                              size={26}
                              color="signal"
                            ></UiIcon>
                          </View>
                        </View>
                        <UiArt
                          kind="megaphone"
                          w={196}
                          extStyle="margin-top:0.2rem;"
                        ></UiArt>
                      </View>
                    </View>
                  )}
                  {/*  全部公告  */}
                  <View className="card card-pad gap">
                    <View className="f-between mb-8">
                      <Text className="col-h">全部公告</Text>
                      <View
                        className="f"
                        style={{
                          gap: '0.25rem',
                        }}
                      >
                        {filters?.map((item, index) => {
                          return (
                            <View
                              key={item.value}
                              className={
                                'chip ' +
                                (category === item.value ? 'chip--on' : '')
                              }
                              data-value={item.value}
                              onClick={this.filterCategory}
                            >
                              {item.label}
                            </View>
                          )
                        })}
                      </View>
                    </View>
                    {announcements?.map((item, index) => {
                      return (
                        <View
                          key={item.ann_no}
                          className="ann-row"
                          data-no={item.ann_no}
                          onClick={this.openAnn}
                        >
                          <View className="row-ico row-ico--lg">
                            <UiIcon
                              name={item.icon}
                              size={38}
                              color="signal"
                            ></UiIcon>
                          </View>
                          <View className="f-1">
                            <View
                              className="f"
                              style={{
                                gap: '0.25rem',
                              }}
                            >
                              <Text className={'tag tag--' + item.tagColor}>
                                {item.category}
                              </Text>
                              <Text className="ann-t truncate f-1">
                                {item.title}
                              </Text>
                              {!item.read && <View className="red-dot"></View>}
                            </View>
                            <Text className="t-meta mt-6 clamp-2 block">
                              {item.summary}
                            </Text>
                            <View
                              className="f mt-8"
                              style={{
                                gap: '0.525rem',
                              }}
                            >
                              <Text className="t-tiny">{item.source_name}</Text>
                              <Text className="t-tiny mono">
                                {item.timeText}
                              </Text>
                              {item.read_count && (
                                <Text className="t-tiny mono">
                                  {item.read_count + ' 人已读'}
                                </Text>
                              )}
                            </View>
                          </View>
                          <UiIcon
                            name="chev"
                            size={28}
                            color="ink-800"
                            extStyle="align-self:center;"
                          ></UiIcon>
                        </View>
                      )
                    })}
                    {truncated && (
                      <View className="ta-c mt-12">
                        <Text className="t-tiny">
                          {'仅显示最近 ' +
                            announcements?.length +
                            '\n              条，更多历史公告可联系服务老师查询'}
                        </Text>
                      </View>
                    )}
                  </View>
                </Block>
              ) : (
                <View className="card card-pad">
                  <View className="blank">
                    <View className="blank-mark">
                      <UiIcon
                        name="megaphone"
                        size={52}
                        color="signal"
                      ></UiIcon>
                    </View>
                    <Text className="blank-title">
                      {category ? '这个分类下还没有公告' : '还没有公告'}
                    </Text>
                    <Text className="blank-hint">
                      {category
                        ? '换一个分类看看，或者查看全部。'
                        : '平台通知、课程与班级公告会出现在这里。'}
                    </Text>
                    {category && (
                      <View
                        className="btn-sm mt-16"
                        data-value
                        onClick={this.filterCategory}
                      >
                        看全部
                      </View>
                    )}
                  </View>
                </View>
              )}
            </Block>
          ) : (
            <Block>
              {loading ? (
                <View className="card card-pad">
                  <View className="skeleton skeleton-block"></View>
                </View>
              ) : messages?.length ? (
                <Block>
                  <View className="card card-pad">
                    <View className="f-between mb-8">
                      <Text className="col-h">通知消息</Text>
                      {msgUnread && (
                        <View className="btn-sm" onClick={this.readAll}>
                          全部标已读
                        </View>
                      )}
                    </View>
                    {messages?.map((item, index) => {
                      return (
                        <View
                          key={item.id}
                          className="row-item"
                          data-id={item.id}
                          onClick={this.readMsg}
                        >
                          <View className="row-ico">
                            <UiIcon
                              name={item.icon}
                              size={32}
                              color="signal"
                            ></UiIcon>
                          </View>
                          <View className="f-1">
                            <View
                              className="f"
                              style={{
                                gap: '0.25rem',
                              }}
                            >
                              <Text className="msg-t f-1 truncate">
                                {item.title}
                              </Text>
                              {!item.read_at && (
                                <View className="red-dot"></View>
                              )}
                            </View>
                            <Text className="t-meta mt-4 clamp-2 block">
                              {item.body}
                            </Text>
                            <Text className="t-tiny mono mt-4 block">
                              {item.timeText}
                            </Text>
                          </View>
                        </View>
                      )
                    })}
                  </View>
                </Block>
              ) : (
                <View className="card card-pad">
                  <View className="blank">
                    <View className="blank-mark">
                      <UiIcon name="bell" size={52} color="signal"></UiIcon>
                    </View>
                    <Text className="blank-title">没有新通知</Text>
                    <Text className="blank-hint">
                      订单、入群、课程、工单的状态变化会在这里通知你，不依赖微信订阅授权。
                    </Text>
                  </View>
                </View>
              )}
            </Block>
          )}
          {/*  ───────── 通知消息（站内待办，来自后台状态变化） ─────────  */}
          {/*  订阅提醒：只在服务端确认模板已配置时才出现  */}
          {subscribable && (
            <View
              className="card card--signal sub-banner gap"
              onClick={this.requestSubscribe}
            >
              <UiIcon name="bell" size={45} color="on-signal"></UiIcon>
              <View className="f-1">
                <Text className="sub-t">开启微信服务通知</Text>
                <Text className="sub-d">
                  开课、入群、工单结果会通过微信提醒你，不错过重要节点
                </Text>
              </View>
              <View className="sub-btn">
                <Text>开启</Text>
                <UiIcon name="arrow" size={24} color="on-signal"></UiIcon>
              </View>
            </View>
          )}
        </View>
      </View>
    )
  }
}
export default _C
