import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/** 课程与直播：按本人 openid 换 living_code，跳转企业微信官方直播小程序。 */
const api = require('../../api/mp.js')
const { isAuthGateError } = require('../../utils/auth.js')
const { d16, toast } = require('../../utils/fmt.js')
const share = require('../../behaviors/share.js')

/**
 * 排课状态 → 图标 token + 图标底纹修饰类 + 状态文字色类。
 * 下发类名与 token 名，不下发色值：色值散进 JS 就绕开了 app.wxss 的调色板。
 */
import UiErrbar from '../../components/errbar/index'
import UiIcon from '../../components/icon/index'
import './index.scss'
const STATUS = {
  已排期: {
    icon: 'accent',
    bg: '',
    text: 't-primary',
  },
  直播中: {
    icon: 'warn',
    bg: 'li-icon--warn',
    text: 't-amber',
  },
  已结束: {
    icon: 't3',
    bg: 'li-icon--mute',
    text: 't-muted',
  },
}
const STATUS_FALLBACK = STATUS.已结束
cacheOptions.setOptionsToCache(
  share.withShare({
    data: {
      loadError: '',
      retrying: false,
      loaded: false,
      courses: [],
    },
    onShow() {
      this.load()
    },
    async onPullDownRefresh() {
      await this.load()
      Taro.stopPullDownRefresh()
    },
    /** 错误条重试入口 */
    async retryLoad() {
      if (this.data.retrying) return
      this.setData({
        retrying: true,
      })
      await this.load()
      this.setData({
        retrying: false,
      })
    },
    async load() {
      if (this.data.loadError)
        this.setData({
          loadError: '',
        })
      try {
        const list = await api.getCourses()
        const courses = (list || []).map((c) => {
          const st = STATUS[c.status] || STATUS_FALLBACK
          return {
            id: c.id,
            title: c.title,
            status: c.status,
            iconColor: st.icon,
            iconClass: st.bg,
            statusClass: st.text,
            live: c.status === '直播中',
            canWatch: Boolean(c.can_watch),
            actionText:
              c.status === '已结束'
                ? '观看回放'
                : c.status === '待开播'
                ? '查看预约'
                : '进入直播',
            metaText: `${c.speaker ? `${c.speaker} · ` : ''}${d16(
              c.scheduled_at
            )}`,
          }
        })
        this.setData({
          loaded: true,
          courses,
        })
      } catch (e) {
        if (isAuthGateError(e)) return // 未同意协议：已跳登录页，不再打扰
        this.setData({
          loadError: e.message,
          retrying: false,
        })
        toast(e.message)
      }
    },
    async enterCourse(e) {
      const id = Number(getTarget(e.currentTarget, Taro).dataset.id)
      const canWatch =
        getTarget(e.currentTarget, Taro).dataset.canWatch === true ||
        getTarget(e.currentTarget, Taro).dataset.canWatch === 'true'
      if (!canWatch || !id) {
        Taro.showToast({
          title: '直播入口尚未开放',
          icon: 'none',
        })
        return
      }
      try {
        Taro.showLoading({
          title: '正在进入',
        })
        const entry = await api.getCourseWatchCode(id)
        Taro.hideLoading()
        if (entry.channel === 'mock') {
          Taro.showModal({
            title: '演示直播',
            content: `已生成演示观看凭证：${
              entry.replay ? '回放' : '直播'
            }入口可用。真实环境将直接打开企微直播。`,
            showCancel: false,
          })
          return
        }
        Taro.navigateToMiniProgram({
          appId: entry.appId,
          path: entry.path,
          fail: (err) => {
            console.warn('[courses] navigate live failed', err)
            toast('未能打开企微直播，请稍后重试')
          },
        })
      } catch (e) {
        Taro.hideLoading()
        toast(e.message || '直播入口获取失败')
      }
    },
  })
)
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { loadError, retrying, loaded, courses } = this.data
    return (
      <View className="page page--sub">
        {loadError && (
          <UiErrbar
            msg={loadError}
            retrying={retrying}
            onRetry={this.retryLoad}
          ></UiErrbar>
        )}
        <View className="hd">
          <Text className="hd-title">课程与直播</Text>
          <View>
            <Text className="hd-sub">开课与回放都收在这里</Text>
          </View>
        </View>
        {loaded && courses?.length === 0 ? (
          <View className="card empty-state">
            <View className="empty-state-mark">课</View>
            <Text className="empty-state-title">暂无课程安排</Text>
            <Text className="empty-state-desc">
              新的直播与课程排期会出现在这里。
            </Text>
          </View>
        ) : (
          courses?.length > 0 && (
            <View className="card card--list">
              {courses?.map((item, index) => {
                return (
                  <View
                    key={item.id}
                    className={
                      'course-cell ' + (item.live ? 'course-cell--live' : '')
                    }
                    data-id={item.id}
                    data-can-watch={item.canWatch}
                    onClick={this.enterCourse}
                  >
                    <View className="f course-row">
                      <View className={'li-icon ' + item.iconClass}>
                        <UiIcon
                          name="tv"
                          size={28}
                          color={item.iconColor}
                        ></UiIcon>
                      </View>
                      <View className="f-1">
                        <View className="f-between">
                          <Text className="t-strong">{item.title}</Text>
                          <View className="f status-wrap">
                            {item.live && <View className="dot--pulse"></View>}
                            <Text className={item.statusClass}>
                              {item.status}
                            </Text>
                          </View>
                        </View>
                        <View className="mt-8">
                          <Text className="t-muted">{item.metaText}</Text>
                        </View>
                        {item.canWatch && (
                          <View className="mt-14">
                            <Text className="tag">
                              {item.actionText + ' · 微信内直接打开'}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                )
              })}
            </View>
          )
        )}
        {/*  一张卡承载整张课表：细线分隔，直播中的一条用朱砂竖标提到前面  */}
      </View>
    )
  }
}
export default _C
