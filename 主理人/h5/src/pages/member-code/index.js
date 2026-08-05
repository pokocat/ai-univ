import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text, Image } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 会员码（设计稿 21）。
 *
 * 码图由服务端渲染成 PNG data-URI 一并返回（小程序里没有二维码库，
 * 而 `<image src>` 也发不出 Authorization 头去取一个鉴权的图）。
 *
 * **60 秒到点必须重新拉**，不能只在本地倒计时到 0 就停：码是带过期时间的签名，
 * 停在那里的图会变成一个扫不出来的方块，而用户看不出为什么。
 * 页面隐藏时停掉定时器——后台标签页里每秒 setData 是纯耗电。
 */
const api = require('../../api/mp.js')
const { toast } = require('../../utils/fmt.js')
const { navVars } = require('../../utils/layout.js')
const { isAuthGateError } = require('../../utils/auth.js')
const log = require('../../utils/log.js')
import UiErrbar from '../../components/errbar/index'
import UiSubhead from '../../components/subhead/index'
import UiAvatar from '../../components/avatar/index'
import UiArt from '../../components/art/index'
import UiIcon from '../../components/icon/index'
import './index.scss'
const SCENES = [
  {
    icon: 'calendar',
    title: '活动签到',
    desc: '线下活动快速签到',
  },
  {
    icon: 'shield',
    title: '服务核验',
    desc: '专属服务身份核验',
  },
  {
    icon: 'members',
    title: '闭门会入场',
    desc: '高端活动通行凭证',
  },
]
cacheOptions.setOptionsToCache({
  data: {
    navPad: '',
    err: '',
    retrying: false,
    me: null,
    tier: '',
    identityLabel: '',
    levelText: '',
    active: false,
    qrPath: '',
    ttl: 60,
    left: 0,
    scenes: SCENES,
  },
  onLoad() {
    this.setData(navVars())
  },
  onShow() {
    this.loadProfile()
    this.refresh()
    this.startTick()
  },
  onHide() {
    this.stopTick()
  },
  onUnload() {
    this.stopTick()
  },
  startTick() {
    this.stopTick()
    this.timer = setInterval(() => {
      const left = this.data.left - 1
      if (left <= 0) {
        // 到点自动换码：留一个过期的图在屏幕上，用户扫不出来又不知道为什么
        this.refresh()
        return
      }
      this.setData({
        left,
      })
    }, 1000)
  },
  stopTick() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  },
  async loadProfile() {
    try {
      const [me, membership, growth] = await Promise.all([
        api.getMe(),
        api.getMembership(),
        api.getGrowth(1),
      ])
      const identity = (me && me.identity) || {}
      this.setData({
        me,
        tier: (membership && membership.tier) || '',
        active: !!(membership && membership.active),
        identityLabel: identity.base_identity || identity.identity || '会员',
        levelText:
          growth && growth.level != null
            ? 'LV.' + growth.level + ' ' + (growth.levelName || '')
            : '',
      })
    } catch (e) {
      if (isAuthGateError(e)) return
      log.warn('member-code profile', e.message)
    }
  },
  async refresh() {
    this.setData({
      retrying: true,
    })
    try {
      const data = await api.getMemberCode()
      this.setData({
        err: '',
        retrying: false,
        qrPath: data.qrDataUri || '',
        ttl: data.ttlSeconds || 60,
        left: data.ttlSeconds || 60,
      })
      if (!data.qrDataUri) {
        // 服务端画图失败：如实说明，并给出可照做的替代（报编号）
        this.setData({
          err: '二维码生成失败，可让工作人员按会员编号手工核验',
        })
      }
    } catch (e) {
      if (isAuthGateError(e)) return
      log.error('member-code refresh', e.message)
      this.setData({
        retrying: false,
        err: e.message,
        qrPath: '',
      })
    }
  },
  copyNo() {
    const no = this.data.me && this.data.me.member_no
    if (!no) return
    Taro.setClipboardData({
      data: no,
      success: () => toast('会员编号已复制'),
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
      qrPath,
      ttl,
      left,
      me,
      tier,
      identityLabel,
      levelText,
      active,
      scenes,
    } = this.data
    return (
      <View className="screen screen--bar">
        <View className="ambience"></View>
        <View className="layer">
          <UiSubhead title="会员码" home="/pages/member/index"></UiSubhead>
          {err && (
            <UiErrbar
              msg={err}
              retrying={retrying}
              onRetry={this.refresh}
            ></UiErrbar>
          )}
          {/*  hero  */}
          <View className="card card--hero code-hero">
            <View
              className="f-start"
              style={{
                gap: '0.2rem',
              }}
            >
              <View className="f-1">
                <View className="title-grad code-title">会员码</View>
                <Text className="lead mt-6">
                  用于线下活动签到、服务核验与权益识别
                </Text>
                <View
                  className="f mt-12"
                  style={{
                    gap: '0.35rem',
                  }}
                >
                  <View className="pill-outline">
                    <UiIcon name="crown" size={21} color="signal"></UiIcon>
                    <Text>专属身份</Text>
                  </View>
                  <View className="pill-outline">
                    <UiIcon name="shield" size={21} color="pulse"></UiIcon>
                    <Text>签名加密</Text>
                  </View>
                </View>
              </View>
              <UiArt kind="gem" w={210} icon="user" variant="code"></UiArt>
            </View>
          </View>
          {/*  码本体  */}
          <View className="card qr-card gap">
            <View className="qr-frame">
              {qrPath ? (
                <Image
                  className="qr-img"
                  src={qrPath}
                  style={{
                    width: '10rem',
                    height: '10rem',
                  }}
                  mode="aspectFit"
                ></Image>
              ) : (
                <View className="qr-fallback">
                  <View
                    className="skeleton"
                    style={{
                      width: '10rem',
                      height: '10rem',
                      borderRadius: '0.45rem',
                    }}
                  ></View>
                </View>
              )}
            </View>
            <View className="f-between mt-12">
              <Text className="t-tiny">
                {'每 ' + ttl + ' 秒自动更新，截图后的码会失效'}
              </Text>
              <View
                className="f"
                style={{
                  gap: '0.15rem',
                }}
                onClick={this.refresh}
              >
                <UiIcon name="refresh" size={24} color="signal"></UiIcon>
                <Text className="t-meta t-signal mono">{left + 's'}</Text>
              </View>
            </View>
            {/*  身份卡片  */}
            <View className="codeprofile">
              <UiAvatar
                name={me.name}
                path={me.avatarPath}
                size={88}
              ></UiAvatar>
              <View className="f-1">
                <View
                  className="f"
                  style={{
                    gap: '0.3rem',
                  }}
                >
                  <Text className="cp-name">{me.name || '主理人'}</Text>
                  {tier && <Text className="tag tag--purple">{tier}</Text>}
                </View>
                <Text className="t-tiny mt-4 block">
                  {identityLabel + (me.city ? ' · ' + me.city : '')}
                </Text>
                <View
                  className="f mt-8"
                  style={{
                    gap: '0.45rem',
                  }}
                >
                  {levelText && (
                    <View
                      className="f"
                      style={{
                        gap: '0.15rem',
                      }}
                    >
                      <UiIcon name="gem" size={22} color="signal"></UiIcon>
                      <Text className="t-tiny t-signal">{levelText}</Text>
                    </View>
                  )}
                  <View
                    className="f"
                    style={{
                      gap: '0.15rem',
                    }}
                    onClick={this.copyNo}
                  >
                    <Text className="t-tiny mono">{me.member_no}</Text>
                    <UiIcon name="copy" size={22} color="ink-600"></UiIcon>
                  </View>
                </View>
              </View>
            </View>
            <View
              className="f mt-10"
              style={{
                gap: '0.35rem',
              }}
            >
              <View className="status-chip status-chip--purple">
                <UiIcon name="gem" size={24} color="signal-600"></UiIcon>
                <Text>{tier || '普通会员'}</Text>
              </View>
              <View
                className={
                  'status-chip status-chip--' + (active ? 'green' : 'gray')
                }
              >
                <UiIcon
                  name="shield"
                  size={24}
                  color={active ? 'ok' : 'ink-600'}
                ></UiIcon>
                <Text>{active ? '有效中' : '未开通'}</Text>
              </View>
            </View>
          </View>
          {/*  使用场景  */}
          <View className="card card-pad gap">
            <Text className="col-h mb-12 block">会员码使用场景</Text>
            <View className="three-col">
              {scenes.map((item, index) => {
                return (
                  <View key={item.title} className="ta-c">
                    <View className="scene-ico">
                      <UiIcon
                        name={item.icon}
                        size={42}
                        color="signal"
                      ></UiIcon>
                    </View>
                    <Text className="scene-t">{item.title}</Text>
                    <Text className="scene-d">{item.desc}</Text>
                  </View>
                )
              })}
            </View>
          </View>
        </View>
        <View className="action-bar">
          <View className="action-row">
            <View className="cta cta--primary" onClick={this.refresh}>
              <UiIcon name="refresh" size={32} color="on-signal"></UiIcon>
              <Text>刷新会员码</Text>
            </View>
            <View
              className="cta cta--ghost"
              data-url="/pages/member/index"
              onClick={this.go}
            >
              <UiIcon name="card" size={30} color="signal"></UiIcon>
              <Text>返回会员卡</Text>
            </View>
          </View>
          <View
            className="f-center mt-12"
            style={{
              gap: '0.25rem',
            }}
          >
            <UiIcon name="shield" size={24} color="ink-600"></UiIcon>
            <Text className="t-micro">
              会员码由服务端签名，过期或伪造的码在核验端会被拒绝
            </Text>
          </View>
        </View>
      </View>
    )
  }
}
export default _C
