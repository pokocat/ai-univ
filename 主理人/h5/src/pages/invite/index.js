import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text, Image, Button } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 邀请推荐（设计稿 14）。
 *
 * 三格读数全部有真实来源——设计稿的「预计收益 ¥2,870」**刻意不做**：
 * 返佣永不进中台（护栏 15），收益只有外部系统的只读镜像，
 * 在邀请页摆一个「预计收益」等于承诺一件中台算不出也不结算的事。
 * 换成「邀请成长值（累计已获得）」，那是真实发生过的。
 *
 * 单次奖励与每日封顶都读服务端（resource_rules），不在前端写死 288（护栏 23 的前端面）。
 */
const api = require('../../api/mp.js')
const share = require('../../behaviors/share.js')
const { toast, money, d10 } = require('../../utils/fmt.js')
const { navVars } = require('../../utils/layout.js')
const { isAuthGateError } = require('../../utils/auth.js')
const qrcode = require('../../utils/qrcode.js')
const log = require('../../utils/log.js')
import UiErrbar from '../../components/errbar/index'
import UiSubhead from '../../components/subhead/index'
import UiAvatar from '../../components/avatar/index'
import UiArt from '../../components/art/index'
import UiIcon from '../../components/icon/index'
import './index.scss'
const LEVEL_TEXT = {
  1: '直接邀请',
  2: '二级',
  3: '三级',
}
cacheOptions.setOptionsToCache(
  share.withShare({
    data: {
      navPad: '',
      loading: true,
      err: '',
      retrying: false,
      invite: null,
      influenceText: '0',
      paidCountText: '0',
      inviteGrowthText: '0',
      awardText: '—',
      downline: [],
      qrBase64: '',
      qrHint: '点击生成小程序码',
    },
    onLoad() {
      this.setData(navVars())
    },
    onShow() {
      this.load()
    },
    onPullDownRefresh() {
      this.load().then(() => Taro.stopPullDownRefresh())
    },
    async load() {
      this.setData({
        retrying: true,
      })
      try {
        const invite = await api.getInvite()
        this.setShareCode(invite.inviteCode)
        const downline = (invite.downline || []).map((d) => ({
          member_no: d.member_no,
          name: d.name,
          levelText: LEVEL_TEXT[d.level] || '下线',
          boundText: d.bound_at ? d10(d.bound_at) + ' 加入' : '',
          direct_downline: d.direct_downline,
          paid: !!d.has_paid,
        }))
        this.setData({
          loading: false,
          err: '',
          retrying: false,
          invite,
          influenceText: money(invite.influence || 0),
          paidCountText: money(downline.filter((d) => d.paid).length),
          inviteGrowthText: money(invite.inviteGrowth || 0),
          awardText:
            invite.inviteAward == null ? '—' : money(invite.inviteAward),
          downline,
        })
      } catch (e) {
        if (isAuthGateError(e)) return
        log.error('invite load', e.message)
        this.setData({
          loading: false,
          retrying: false,
          err: e.message,
        })
      }
    },
    /**
     * 小程序码按需生成：它要打微信接口，进页面就拉会让每次进来都消耗一次配额。
     * Mock 凭证下服务端如实回 mock=true，此时不显示一个假的码图。
     */
    async loadQrcode() {
      try {
        const r = await api.getInviteQrcode()
        if (r && r.qrcodeBase64) {
          this.setData({
            qrBase64: 'data:image/png;base64,' + r.qrcodeBase64,
          })
          return
        }
        this.setData({
          qrHint: '小程序码暂不可用，可先复制邀请码分享',
        })
      } catch (e) {
        this.setData({
          qrHint: e.message,
        })
      }
    },
    previewQr() {
      // base64 图不能直接 previewImage，写成临时文件后再预览
      const fs = Taro.getFileSystemManager()
      const path = `${Taro.env.USER_DATA_PATH}/invite-qr.png`
      try {
        fs.writeFileSync(
          path,
          this.data.qrBase64.replace(/^data:image\/png;base64,/, ''),
          'base64'
        )
        qrcode.preview(path)
      } catch (e) {
        toast('图片预览失败，可长按保存后使用')
      }
    },
    copyCode() {
      const code = this.data.invite && this.data.invite.inviteCode
      if (!code) return
      Taro.setClipboardData({
        data: code,
        success: () => toast('邀请码已复制'),
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
)
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const {
      err,
      retrying,
      loading,
      influenceText,
      paidCountText,
      inviteGrowthText,
      invite,
      awardText,
      qrBase64,
      qrHint,
      downline,
    } = this.data
    return (
      <View className="screen screen--bar">
        <View className="ambience"></View>
        <View className="layer">
          <UiSubhead title="邀请推荐" home="/pages/mine/index"></UiSubhead>
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
              <View className="card card--hero iv-hero">
                <View
                  className="f-start"
                  style={{
                    gap: '0.2rem',
                  }}
                >
                  <View className="f-1">
                    <View className="iv-title">
                      邀请好友 ·<Text className="title-grad">共创增长</Text>
                    </View>
                    <Text className="lead mt-8">
                      邀请好友加入主理人公社，一起链接资源、共创价值
                    </Text>
                    <View
                      className="ghost-pill mt-12"
                      data-url="/pages/invite-poster/index"
                      onClick={this.go}
                    >
                      <Text>查看邀请规则</Text>
                      <UiIcon name="arrow" size={26} color="signal"></UiIcon>
                    </View>
                  </View>
                  <UiArt
                    kind="trophy"
                    w={160}
                    variant="iv"
                    extStyle="margin-top:0.35rem;"
                  ></UiArt>
                </View>
              </View>
              {/*  三格读数（都有真实来源）  */}
              <View className="card three-col iv-stat gap">
                <View className="stat-3-item">
                  <Text className="s3-l">已邀请</Text>
                  <Text className="s3-v mono">
                    {influenceText}
                    <Text className="s3-unit">人</Text>
                  </Text>
                  <Text className="s3-d">含一至三级</Text>
                </View>
                <View className="stat-3-item">
                  <Text className="s3-l">已开通</Text>
                  <Text className="s3-v mono">
                    {paidCountText}
                    <Text className="s3-unit">人</Text>
                  </Text>
                  <Text className="s3-d">下线中已付费</Text>
                </View>
                <View className="stat-3-item">
                  <Text className="s3-l">邀请成长值</Text>
                  <Text className="s3-v mono t-signal">{inviteGrowthText}</Text>
                  <Text className="s3-d">累计已获得</Text>
                </View>
              </View>
              {/*  邀请码 + 小程序码  */}
              <View className="card card-pad gap">
                <View className="f-start">
                  <View className="f-1">
                    <View
                      className="f"
                      style={{
                        gap: '0.25rem',
                      }}
                    >
                      <Text className="t-meta">我的邀请码</Text>
                      <UiIcon name="info" size={22} color="ink-600"></UiIcon>
                    </View>
                    <View
                      className="f mt-8"
                      style={{
                        gap: '0.45rem',
                      }}
                    >
                      <Text className="iv-code mono">{invite.inviteCode}</Text>
                      <View className="copy-pill" onClick={this.copyCode}>
                        复制
                      </View>
                    </View>
                    <Text className="t-tiny mt-8 block">
                      好友经你的码注册即绑定关系链，每位可得
                      <Text className="mono">{awardText}</Text>成长值
                    </Text>
                    {invite.inviteDailyCap && (
                      <Text className="t-micro mt-4 block">
                        {'每日奖励上限 ' +
                          invite.inviteDailyCap +
                          ' 位，超出仅绑定关系不发奖励'}
                      </Text>
                    )}
                  </View>
                  <View className="ta-c">
                    {qrBase64 ? (
                      <View className="qr-frame iv-qr" onClick={this.previewQr}>
                        <Image
                          className="qr-img"
                          src={qrBase64}
                          style={{
                            width: '4.5rem',
                            height: '4.5rem',
                          }}
                          mode="aspectFit"
                        ></Image>
                      </View>
                    ) : (
                      <View className="iv-qr-empty" onClick={this.loadQrcode}>
                        <UiIcon name="qr" size={52} color="signal"></UiIcon>
                        <Text className="t-micro mt-6">{qrHint}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
              {/*  邀请记录（真实下线）  */}
              <View className="card card-pad gap">
                <View className="f-between mb-8">
                  <Text className="col-h">邀请记录</Text>
                  <Text className="t-tiny">
                    {'最近 ' + downline?.length + ' 位'}
                  </Text>
                </View>
                {downline?.length ? (
                  <Block>
                    {downline?.map((item, index) => {
                      return (
                        <View key={item.member_no} className="row-item">
                          <UiAvatar name={item.name} size={72}></UiAvatar>
                          <View className="f-1">
                            <View
                              className="f"
                              style={{
                                gap: '0.25rem',
                              }}
                            >
                              <Text className="iv-name">
                                {item.name || item.member_no}
                              </Text>
                              <Text className="tag tag--purple">
                                {item.levelText}
                              </Text>
                            </View>
                            <Text className="t-micro mono mt-4 block">
                              {item.boundText}
                            </Text>
                          </View>
                          <View className="ta-r">
                            <Text
                              className="iv-st"
                              style={{
                                color: `var(--${item.paid ? 'ok' : 'ink-600'})`,
                              }}
                            >
                              {item.paid ? '已开通' : '已注册'}
                            </Text>
                            {item.direct_downline && (
                              <Text className="t-micro mt-4 block">
                                {'直推 ' + item.direct_downline + ' 人'}
                              </Text>
                            )}
                          </View>
                        </View>
                      )
                    })}
                  </Block>
                ) : (
                  <View className="blank">
                    <View className="blank-mark">
                      <UiIcon name="members" size={45} color="signal"></UiIcon>
                    </View>
                    <Text className="blank-title">还没有人通过你的码加入</Text>
                    <Text className="blank-hint">
                      把邀请码或小程序码分享给同频的朋友，他们注册后会出现在这里。
                    </Text>
                  </View>
                )}
              </View>
              <View className="box box--sunk gap">
                <View
                  className="f"
                  style={{
                    gap: '0.3rem',
                  }}
                >
                  <UiIcon name="shield" size={28} color="signal"></UiIcon>
                  <Text className="t-sec fw-600">邀请规则</Text>
                </View>
                <Text className="t-tiny mt-6 block">
                  好友通过你的邀请码注册即绑定关系链（最多三级）。奖励为成长值等虚拟权益，
                  不涉及现金返利；平台不做返佣结算。
                </Text>
              </View>
            </Block>
          )}
        </View>
        <View className="action-bar">
          <View className="action-row">
            <View
              className="cta cta--primary"
              data-url="/pages/invite-poster/index"
              onClick={this.go}
            >
              <UiIcon name="chart" size={32} color="on-signal"></UiIcon>
              <Text>生成海报</Text>
            </View>
            <Button className="cta cta--ghost" openType="share">
              <UiIcon name="wechat" size={30} color="ok"></UiIcon>
              <Text>微信分享</Text>
            </Button>
          </View>
        </View>
      </View>
    )
  }
}
export default _C
