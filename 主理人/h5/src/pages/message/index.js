import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text, Button } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 公告详情（设计稿 13「消息详情」）。
 *
 * 按**公告编号**取详情（不是自增 id）：编号会出现在界面上，用 id 会让人能顺序枚举
 * 别人班级的公告。可见性由服务端按「项目 + 已入群班级」判定，
 * 看不到时页面如实说明原因（可能已下线 / 不在可见范围），而不是空白页。
 *
 * 打开即标已读：这一页的存在本身就是「我看了」，再让用户点一次按钮才算已读，
 * 会让「N 人已查看」永远偏低。底部的「确认已读」保留为显式动作，
 * 但它只是同一个幂等接口，不是另一种语义。
 */
const api = require('../../api/mp.js')
const share = require('../../behaviors/share.js')
const { toast, d16 } = require('../../utils/fmt.js')
const { navVars } = require('../../utils/layout.js')
const { isAuthGateError } = require('../../utils/auth.js')
const log = require('../../utils/log.js')
import UiErrbar from '../../components/errbar/index'
import UiSubhead from '../../components/subhead/index'
import UiArt from '../../components/art/index'
import UiIcon from '../../components/icon/index'
import './index.scss'
cacheOptions.setOptionsToCache(
  share.withShare({
    data: {
      navPad: '',
      loading: true,
      err: '',
      retrying: false,
      annNo: '',
      ann: null,
      publishText: '',
    },
    onLoad(options) {
      this.setData(
        Object.assign(
          {
            annNo: (options && options.annNo) || '',
          },
          navVars()
        )
      )
      this.load()
    },
    async load() {
      if (!this.data.annNo) {
        this.setData({
          loading: false,
          ann: null,
        })
        return
      }
      this.setData({
        retrying: true,
      })
      try {
        const ann = await api.getAnnouncement(this.data.annNo)
        this.setData({
          loading: false,
          err: '',
          retrying: false,
          ann,
          publishText: d16(ann.publish_at),
        })
        // 打开即已读（幂等）；失败不打扰用户——它不影响阅读
        if (!ann.read) this.markRead(true)
      } catch (e) {
        if (isAuthGateError(e)) return
        log.warn('announcement detail', e.message)
        this.setData({
          loading: false,
          retrying: false,
          ann: null,
          err: '',
        })
      }
    },
    async markRead(silent) {
      try {
        const r = await api.readAnnouncement(this.data.annNo)
        this.setData({
          ann: Object.assign({}, this.data.ann, {
            read: true,
            read_count: r.readCount,
          }),
        })
        if (silent !== true) toast('已确认阅读')
        // 顶部未读数会变，回列表时让它重新拉
        const app = Taro.getApp()
        if (app && app.globalData && app.globalData.unread > 0) {
          app.globalData.unread = app.globalData.unread - 1
        }
      } catch (e) {
        if (silent === true) {
          log.warn('mark announcement read', e.message)
          return
        }
        toast(e.message)
      }
    },
    copyNo() {
      Taro.setClipboardData({
        data: this.data.annNo,
        success: () => toast('公告编号已复制'),
      })
    },
    /** 转发带上公告编号，好友点开直达同一条（可见性仍由服务端判定） */
    onShareAppMessage() {
      const ann = this.data.ann
      return {
        title: ann ? ann.title : '主理人公社公告',
        path: '/pages/message/index?annNo=' + this.data.annNo,
      }
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
    const { err, retrying, loading, ann, publishText } = this.data
    return (
      <View className="screen screen--bar">
        <View className="ambience"></View>
        <View className="layer">
          <UiSubhead
            title="公告详情"
            home="/pages/notifications/index"
          ></UiSubhead>
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
          ) : ann ? (
            <Block>
              <View className="card card--hero msg-hero">
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
                        (ann.importance === '重要' ? 'red' : 'purple') +
                        ' tag--round'
                      }
                    >
                      {ann.category}
                    </Text>
                    {ann.group_name && (
                      <Text className="t-sec mt-12 block">
                        {ann.group_name}
                      </Text>
                    )}
                    <Text className="msg-title">{ann.title}</Text>
                    {ann.summary && (
                      <Text className="lead mt-8">{ann.summary}</Text>
                    )}
                    <View className="viewed-chip">
                      <Text className="t-tiny">
                        {(ann.read_count || 0) + ' 人已查看'}
                      </Text>
                    </View>
                  </View>
                  <UiArt kind="megaphone" w={196} variant="msg"></UiArt>
                </View>
              </View>
              {/*  元信息  */}
              <View className="card card-pad gap">
                <View className="info-card">
                  <View className="ic-row">
                    <View className="ic-l">
                      <UiIcon name="clock" size={26} color="ink-800"></UiIcon>
                      <Text>发布时间</Text>
                    </View>
                    <Text className="ic-v mono">{publishText}</Text>
                  </View>
                  <View className="ic-row">
                    <View className="ic-l">
                      <UiIcon name="doc" size={26} color="ink-800"></UiIcon>
                      <Text>公告编号</Text>
                    </View>
                    <View
                      className="f"
                      style={{
                        gap: '0.2rem',
                      }}
                      onClick={this.copyNo}
                    >
                      <Text className="ic-v mono">{ann.ann_no}</Text>
                      <UiIcon name="copy" size={22} color="ink-600"></UiIcon>
                    </View>
                  </View>
                  <View className="ic-row">
                    <View className="ic-l">
                      <UiIcon name="user" size={26} color="ink-800"></UiIcon>
                      <Text>发布人</Text>
                    </View>
                    <Text className="ic-v">
                      {ann.source_member_name || ann.source_name}
                    </Text>
                  </View>
                </View>
              </View>
              {/*  正文  */}
              <View className="card card-pad gap">
                <Text className="msg-body">{ann.body}</Text>
                <View className="hr mt-16 mb-12"></View>
                <View className="f-between">
                  <Text className="t-meta">{ann.source_name}</Text>
                  <Text className="t-meta mono">
                    {(ann.read_count || 0) + ' 人阅读'}
                  </Text>
                </View>
              </View>
            </Block>
          ) : (
            <View className="card card-pad">
              <View className="blank">
                <View className="blank-mark">
                  <UiIcon name="megaphone" size={52} color="signal"></UiIcon>
                </View>
                <Text className="blank-title">这条公告看不到了</Text>
                <Text className="blank-hint">
                  它可能已下线，或不在你的可见范围（班级公告只对已入群的同学可见）。
                </Text>
                <View
                  className="btn-sm mt-16"
                  data-url="/pages/notifications/index"
                  data-tab={true}
                  onClick={this.go}
                >
                  返回公告中心
                </View>
              </View>
            </View>
          )}
        </View>
        {ann && (
          <View className="action-bar">
            <View className="action-row">
              <View className="cta cta--ghost" onClick={this.markRead}>
                <UiIcon name="shield" size={30} color="signal"></UiIcon>
                <Text>{ann.read ? '已确认阅读' : '确认已读'}</Text>
              </View>
              <Button className="cta cta--primary" openType="share">
                <UiIcon name="arrow" size={30} color="on-signal"></UiIcon>
                <Text>转发</Text>
              </Button>
            </View>
          </View>
        )}
      </View>
    )
  }
}
export default _C
