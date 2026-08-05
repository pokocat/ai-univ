import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text, Image } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 进入班群（设计稿 20「入群二维码」）。
 *
 * 入群方式由服务端裁定，前端只按 `/mp/my-group` 的结论分支——**四种形态，
 * 任何一种都不让会员无路可走**（口径与 MpService.myGroup / advisorStep 一致）：
 *  ① advisor  —— 顾问优先：必须先加顾问，群入口暂不放行；
 *  ② plugin   —— 企微群官方入群插件，可自助一键进群；
 *  ③ qrcode   —— 群二维码（个微群或兜底活码），长按识别；
 *  ④ waiting  —— 还没到可入群的阶段，如实说明在等什么并给「刷新状态」。
 *
 * 绝不在前端自行判断该给哪种码：能不能进群牵涉付费门控与顾问归因，
 * 只有服务端说了算（护栏 20）。
 */
const api = require('../../api/mp.js')
const { toast, d10 } = require('../../utils/fmt.js')
const { navVars } = require('../../utils/layout.js')
const { isAuthGateError } = require('../../utils/auth.js')
const qrcode = require('../../utils/qrcode.js')
const wecomJoin = require('../../utils/wecom-join.js')
const log = require('../../utils/log.js')
import UiErrbar from '../../components/errbar/index'
import UiSubhead from '../../components/subhead/index'
import UiArt from '../../components/art/index'
import UiIcon from '../../components/icon/index'
import './index.scss'
const GAINS = [
  {
    icon: 'bell',
    title: '课程通知',
    desc: '第一时间获取课程与活动',
  },
  {
    icon: 'chat',
    title: '社群答疑',
    desc: '老师在线解答学习难题',
  },
  {
    icon: 'link',
    title: '资源链接',
    desc: '优质资料共享与资源对接',
  },
]
cacheOptions.setOptionsToCache({
  data: {
    navPad: '',
    loading: true,
    err: '',
    retrying: false,
    group: null,
    title: '',
    glyph: '',
    joined: false,
    startText: '',
    stage: 'waiting',
    qrUrl: '',
    joinPluginId: '',
    heroTitle: '已为你分配班级',
    heroDesc: '',
    waitTitle: '',
    waitHint: '',
    gains: GAINS,
  },
  onLoad() {
    this.setData(navVars())
  },
  onShow() {
    this.load()
  },
  async load() {
    this.setData({
      retrying: true,
    })
    try {
      const group = await api.getMyGroup()
      const a = group && group.assignment
      const cohort = group && group.cohort
      const advisor = group && group.advisorStep
      const state = {
        loading: false,
        err: '',
        retrying: false,
        group,
        title: (cohort && cohort.name) || (a && a.group_name) || '我的社群',
        glyph:
          cohort && cohort.cohort_code
            ? String(cohort.cohort_code).slice(-2)
            : '',
        joined: !!(a && a.status === '已入群'),
        startText: d10(cohort && cohort.start_date),
        qrUrl: group && group.groupQrcodeUrl ? group.groupQrcodeUrl : '',
        joinPluginId: (group && group.joinPluginId) || '',
      }
      if (!a) {
        state.stage = 'waiting'
        state.heroTitle = '还没有为你分配班级'
        state.heroDesc =
          group && group.hint ? group.hint : '运营正在为你匹配合适的社群'
        state.waitTitle = '等待分配班级'
        state.waitHint = state.heroDesc
      } else if (a.status === '已入群') {
        state.stage = state.qrUrl ? 'qrcode' : 'waiting'
        state.heroTitle = '你已在班群中'
        state.heroDesc = '群消息在微信里查看；二维码可分享给同班同学'
        state.waitTitle = '你已在班群中'
        state.waitHint =
          '直接在微信里打开群聊即可；如需二维码可联系服务老师获取。'
      } else if (advisor && advisor.required) {
        state.stage = 'advisor'
        state.heroTitle = '先加顾问，再进群'
        state.heroDesc = advisor.hint || '添加服务顾问后即可获得入群入口'
      } else if (group && group.selfJoin) {
        state.stage = 'plugin'
        state.heroTitle = '可以进群了'
        state.heroDesc = '点击「加入群聊」，按微信提示进入为你安排的社群'
      } else if (state.qrUrl) {
        state.stage = 'qrcode'
        state.heroTitle = '扫码进入班级群'
        state.heroDesc = '长按识别二维码，和同频主理人一起成长'
      } else {
        state.stage = 'waiting'
        state.heroTitle = '席位已锁定'
        state.heroDesc =
          group && group.joinHint
            ? group.joinHint
            : '运营正在安排入群，稍后会有专属客服联系你'
        state.waitTitle = '当前状态：' + a.status
        state.waitHint = state.heroDesc
      }
      this.setData(state)
    } catch (e) {
      if (isAuthGateError(e)) return
      log.error('group-qr load', e.message)
      this.setData({
        loading: false,
        retrying: false,
        err: e.message,
      })
    }
  },
  /**
   * 官方入群组件的回执。
   * **绝不在客户端把状态改成「已入群」**：置「已入群」只有 webhook 事件与人工确认
   * 两条合法路径（护栏 16），客户端回执只用来解释失败原因。
   */
  handleJoinComplete(e) {
    const code = wecomJoin.complete(e)
    if (!code) {
      // 成功也不宣布「已入群」：真正入群以企微回调为准，这里只让用户去微信确认
      toast('已发起入群，请在微信中确认')
      setTimeout(() => this.load(), 1500)
    }
  },
  previewQr() {
    qrcode.preview(this.data.qrUrl)
  },
  /**
   * 保存二维码：微信不允许直接保存远端图，必须先下载到本地临时文件。
   * 相册权限被拒时给出「去设置里开启」的具体指引，而不是一句「保存失败」。
   */
  saveQr() {
    const url = this.data.qrUrl
    if (!url) {
      toast('当前没有可保存的二维码')
      return
    }
    Taro.showLoading({
      title: '保存中',
    })
    Taro.downloadFile({
      url,
      success: (res) => {
        Taro.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => {
            Taro.hideLoading()
            toast('已保存到相册')
          },
          fail: (err) => {
            Taro.hideLoading()
            if (String(err.errMsg || '').indexOf('auth') >= 0) {
              Taro.showModal({
                title: '需要相册权限',
                content:
                  '保存图片需要相册写入权限，可在「设置 → 主理人公社」中开启后重试。',
                confirmText: '去设置',
                success: (r) => {
                  if (r.confirm) Taro.openSetting()
                },
              })
              return
            }
            toast('保存失败，可长按图片手动保存')
          },
        })
      },
      fail: () => {
        Taro.hideLoading()
        toast('图片下载失败，可长按图片手动保存')
      },
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
      heroTitle,
      heroDesc,
      glyph,
      group,
      joined,
      title,
      startText,
      stage,
      qrUrl,
      waitTitle,
      waitHint,
      gains,
    } = this.data
    return (
      <View className="screen screen--bar">
        <View className="ambience"></View>
        <View className="layer">
          <UiSubhead title="进入班群" home="/pages/group/index"></UiSubhead>
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
              <View className="card card--hero gq-hero">
                <View
                  className="f-start"
                  style={{
                    gap: '0.2rem',
                  }}
                >
                  <View className="f-1">
                    <View className="title-grad gq-title">{heroTitle}</View>
                    <Text className="lead mt-8">{heroDesc}</Text>
                    <View
                      className="f mt-12"
                      style={{
                        gap: '0.35rem',
                      }}
                    >
                      <View className="pill-outline">
                        <UiIcon name="crown" size={21} color="signal"></UiIcon>
                        <Text>专属社群</Text>
                      </View>
                      <View className="pill-outline">
                        <UiIcon
                          name="shield"
                          size={21}
                          color="signal-600"
                        ></UiIcon>
                        <Text>已锁定席位</Text>
                      </View>
                    </View>
                  </View>
                  <UiArt
                    kind="medallion"
                    w={200}
                    glyph={glyph}
                    variant="gq"
                  ></UiArt>
                </View>
              </View>
              {/*  班级信息  */}
              {group.assignment && (
                <View className="card card-pad gap">
                  <View className="f-between mb-12">
                    <View
                      className="f"
                      style={{
                        gap: '0.3rem',
                      }}
                    >
                      <UiIcon name="shield" size={28} color="signal"></UiIcon>
                      <Text className="col-h">班级信息</Text>
                    </View>
                    <View
                      className={
                        'tag tag--' +
                        (joined ? 'green' : 'amber') +
                        ' tag--round'
                      }
                    >
                      {group.assignment.status}
                    </View>
                  </View>
                  <View className="info-card">
                    <View className="ic-row">
                      <View className="ic-l">
                        <UiIcon
                          name="members"
                          size={26}
                          color="ink-800"
                        ></UiIcon>
                        <Text>班级</Text>
                      </View>
                      <Text className="ic-v">{title}</Text>
                    </View>
                    {group.cohort && group.cohort.start_date && (
                      <View className="ic-row">
                        <View className="ic-l">
                          <UiIcon
                            name="calendar"
                            size={26}
                            color="ink-800"
                          ></UiIcon>
                          <Text>开班时间</Text>
                        </View>
                        <Text className="ic-v mono">{startText}</Text>
                      </View>
                    )}
                    <View className="ic-row">
                      <View className="ic-l">
                        <UiIcon name="user" size={26} color="ink-800"></UiIcon>
                        <Text>班级人数</Text>
                      </View>
                      <Text className="ic-v mono">
                        {group.assignment.member_count + ' 人'}
                      </Text>
                    </View>
                    {group.serviceTeacher && (
                      <View className="ic-row">
                        <View className="ic-l">
                          <UiIcon
                            name="headset"
                            size={26}
                            color="ink-800"
                          ></UiIcon>
                          <Text>服务老师</Text>
                        </View>
                        <Text className="ic-v">
                          {group.serviceTeacher.name}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
              {/*  入群方式：按服务端给的真实通道分支，任何一支都不让人无路可走  */}
              {/*  ① 顾问优先：必须先加顾问  */}
              {stage === 'advisor' ? (
                <View className="card card-pad gap">
                  <View className="warn-box">
                    <UiIcon name="warn" size={32} color="warn"></UiIcon>
                    <View className="f-1">
                      <Text className="t-sec fw-600">还需先添加服务顾问</Text>
                      <Text className="t-meta mt-6 block">
                        {group.joinHint}
                      </Text>
                    </View>
                  </View>
                  <View
                    className="cta cta--primary mt-16"
                    data-url="/pages/advisor/index"
                    onClick={this.go}
                  >
                    <UiIcon name="wechat" size={32} color="on-signal"></UiIcon>
                    <Text>去添加顾问</Text>
                  </View>
                </View>
              ) : stage === 'plugin' ? (
                <View className="card qr-card gap">
                  <Text className="gq-sec">· 一键加入班级群 ·</Text>
                  {/*  企微官方入群组件（materialPlugin）。**不能用自绘按钮代替**：
                           入群动作必须由官方组件发起，自绘按钮拿不到 completemessage 回执。  */}
                  <View className="join-cell mt-14">
                    <JoinGroupCell
                      url={group.groupJoinUrl}
                      contactText="加入群聊"
                      contactTextBlod={true}
                      paddingStyle={0}
                      onCompletemessage={this.handleJoinComplete}
                    ></JoinGroupCell>
                  </View>
                  <Text className="t-tiny ta-c mt-12 block">
                    由企业微信官方提供入群服务，按微信提示确认即可
                  </Text>
                </View>
              ) : stage === 'qrcode' ? (
                <View className="card qr-card gap">
                  <Text className="gq-sec">· 群二维码 ·</Text>
                  <View className="qr-frame mt-14" onClick={this.previewQr}>
                    <Image
                      className="qr-img"
                      src={qrUrl}
                      style={{
                        width: '10rem',
                        height: '10rem',
                      }}
                      mode="aspectFit"
                    ></Image>
                  </View>
                  <View
                    className="f-center mt-12"
                    style={{
                      gap: '0.25rem',
                    }}
                  >
                    <UiIcon name="scan" size={26} color="ink-800"></UiIcon>
                    <Text className="t-meta">点击放大后长按识别二维码加入</Text>
                  </View>
                </View>
              ) : (
                <View className="card card-pad gap">
                  <View className="blank">
                    <View className="blank-mark">
                      <UiIcon name="clock" size={52} color="signal"></UiIcon>
                    </View>
                    <Text className="blank-title">{waitTitle}</Text>
                    <Text className="blank-hint">{waitHint}</Text>
                    <View className="btn-sm mt-16" onClick={this.load}>
                      刷新状态
                    </View>
                  </View>
                </View>
              )}
              {/*  ② 官方入群插件（企微群，可自助）  */}
              {/*  ③ 群二维码（个微群 / 兜底活码）  */}
              {/*  ④ 还没到可入群的阶段：如实说明在等什么  */}
              {/*  群内可获得  */}
              <View className="card card-pad gap">
                <View
                  className="f mb-12"
                  style={{
                    gap: '0.3rem',
                  }}
                >
                  <UiIcon name="award" size={28} color="signal"></UiIcon>
                  <Text className="col-h">群内可获得</Text>
                </View>
                <View className="three-col">
                  {gains.map((item, index) => {
                    return (
                      <View key={item.title} className="tile">
                        <UiIcon
                          name={item.icon}
                          size={38}
                          color="signal"
                        ></UiIcon>
                        <Text className="gain-t">{item.title}</Text>
                        <Text className="gain-d">{item.desc}</Text>
                      </View>
                    )
                  })}
                </View>
              </View>
            </Block>
          )}
        </View>
        <View className="action-bar">
          <View className="action-row">
            {qrUrl ? (
              <View className="cta cta--primary" onClick={this.saveQr}>
                <UiIcon name="download" size={32} color="on-signal"></UiIcon>
                <Text>保存二维码</Text>
              </View>
            ) : (
              <View className="cta cta--primary" onClick={this.load}>
                <UiIcon name="refresh" size={32} color="on-signal"></UiIcon>
                <Text>刷新状态</Text>
              </View>
            )}
            <View
              className="cta cta--ghost"
              data-url="/pages/advisor/index"
              onClick={this.go}
            >
              <UiIcon name="headset" size={30} color="signal"></UiIcon>
              <Text>联系老师</Text>
            </View>
          </View>
          <View
            className="f-center mt-12"
            style={{
              gap: '0.25rem',
            }}
          >
            <UiIcon name="shield" size={24} color="ink-600"></UiIcon>
            <Text className="t-micro">二维码失效时可联系服务老师重新获取</Text>
          </View>
        </View>
      </View>
    )
  }
}
export default _C
