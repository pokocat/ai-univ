import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text, Image } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 服务顾问（设计稿 19「添加服务微信」）。
 *
 * 三条真实通道，服务端给结论，前端只呈现（口径同 MpService.advisorStep）：
 *  ① 顾问「联系我」活码（企微，带归因 state）——最优，加上之后入群会自动归因；
 *  ② 顾问个人企微二维码（employee.wecom_qrcode_url）——没有活码时的替代；
 *  ③ 都没有 → 微信客服 / 服务工单兜底。
 *
 * **不显示编的服务数据**：设计稿的「服务学员 328+ ｜ 好评率 98%」库里没有来源。
 * 真实可给的是顾问姓名、角色、服务区域，以及「码有没有就绪」。
 */
const api = require('../../api/mp.js')
const { toast } = require('../../utils/fmt.js')
const { navVars } = require('../../utils/layout.js')
const { isAuthGateError } = require('../../utils/auth.js')
const qrcode = require('../../utils/qrcode.js')
const customerService = require('../../utils/customer-service.js')
const log = require('../../utils/log.js')
import UiErrbar from '../../components/errbar/index'
import UiSubhead from '../../components/subhead/index'
import UiAvatar from '../../components/avatar/index'
import UiArt from '../../components/art/index'
import UiIcon from '../../components/icon/index'
import './index.scss'
const STEPS = [
  {
    icon: 'user',
    title: '添加顾问微信',
    desc: '长按识别上方二维码',
  },
  {
    icon: 'chat',
    title: '发送会员姓名',
    desc: '把会员名与手机号发给顾问',
  },
  {
    icon: 'members',
    title: '邀请进入班群',
    desc: '顾问会邀请你加入班级群',
  },
]
cacheOptions.setOptionsToCache({
  data: {
    navPad: '',
    loading: true,
    err: '',
    retrying: false,
    heroTitle: '专属服务已为你就位',
    heroDesc: '添加服务顾问微信，开启入群、课程、诊断与日常陪跑',
    advisorName: '',
    advisorRole: '专属服务',
    advisorRegion: '',
    advisorAvatar: '',
    advisorQr: '',
    advisorHint: '',
    qrPendingTitle: '',
    qrPendingHint: '',
    teacher: null,
    fallbackHint: '',
    steps: STEPS,
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
      const [group, training] = await Promise.all([
        api.getMyGroup(),
        // 培训链路有自己的顾问码（enrollment 维度）；两条链路都可能是当前有效的那一条
        api.getTrainingContactEntry().catch(() => null),
      ])
      const advisor = group && group.advisorStep
      const teacher = group && group.serviceTeacher
      const state = {
        loading: false,
        err: '',
        retrying: false,
        teacher,
      }

      // 优先培训场景的顾问码（学员在训期间以它为准），其次会员场景的 advisorStep
      const trainingQr =
        training && training.available ? training.qrcodeUrl : ''
      const memberQr = advisor && advisor.qrcodeUrl ? advisor.qrcodeUrl : ''
      state.advisorQr =
        trainingQr || memberQr || (teacher && teacher.wecom_qrcode_url) || ''
      state.advisorName =
        (training && training.advisorName) ||
        (advisor && advisor.advisorName) ||
        (teacher && teacher.name) ||
        '服务顾问'
      state.advisorRole = (teacher && teacher.role) || '专属服务'
      state.advisorRegion = (teacher && teacher.service_region) || ''
      state.advisorAvatar = ''
      if (state.advisorQr) {
        state.advisorHint =
          trainingQr || memberQr
            ? '加上顾问后，入群与后续服务都由他跟进'
            : '这是顾问的企业微信个人码，加上后可直接联系他'
        state.heroTitle = '加顾问，开启专属服务'
      } else {
        // 码没就绪：把服务端的原话转述出来，不自己编一个「生成中」
        state.qrPendingTitle =
          advisor && advisor.status === '创建中'
            ? '顾问二维码生成中'
            : '顾问二维码暂不可用'
        state.qrPendingHint =
          (advisor && advisor.hint) ||
          (training && training.hint) ||
          '稍后下拉刷新；如仍未出现可提交服务工单，我们会人工跟进。'
        state.heroTitle = teacher ? '你的服务老师' : '服务顾问匹配中'
        state.heroDesc = teacher
          ? '顾问二维码还没就绪，可先通过班群或工单联系他'
          : '运营正在为你匹配专属顾问'
      }
      // 客服是否真的接通了由 utils/customer-service 在点击时判定并给兜底，
      // 这里不预判——预判错了会摆一个点了没反应的按钮
      state.fallbackHint =
        '可以先联系客服，或提交一张服务工单，我们会在承诺时限内联系你。'
      this.setData(state)
    } catch (e) {
      if (isAuthGateError(e)) return
      log.error('advisor load', e.message)
      this.setData({
        loading: false,
        retrying: false,
        err: e.message,
      })
    }
  },
  /** 联系客服：通道是否可用由 utils/customer-service 判定并自带兜底 */
  contactService() {
    customerService.open()
  },
  previewQr() {
    qrcode.preview(this.data.advisorQr)
  },
  saveQr() {
    const url = this.data.advisorQr
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
      advisorQr,
      teacher,
      advisorName,
      advisorAvatar,
      advisorRole,
      advisorRegion,
      advisorHint,
      qrPendingTitle,
      qrPendingHint,
      fallbackHint,
      steps,
    } = this.data
    return (
      <View className="screen screen--bar">
        <View className="ambience"></View>
        <View className="layer">
          <UiSubhead title="服务顾问" home="/pages/group/index"></UiSubhead>
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
              <View className="card card--hero ad-hero">
                <View
                  className="f-start"
                  style={{
                    gap: '0.2rem',
                  }}
                >
                  <View className="f-1">
                    <View className="title-grad ad-title">{heroTitle}</View>
                    <Text className="lead mt-8">{heroDesc}</Text>
                    <View
                      className="f mt-12"
                      style={{
                        gap: '0.35rem',
                      }}
                    >
                      <View className="pill-outline">
                        <UiIcon name="crown" size={21} color="signal"></UiIcon>
                        <Text>专属服务</Text>
                      </View>
                      <View className="pill-outline pill-outline--pulse">
                        <UiIcon name="ribbon" size={21} color="pulse"></UiIcon>
                        <Text>全程陪伴</Text>
                      </View>
                    </View>
                  </View>
                  <UiArt kind="gem" w={210} icon="wechat" variant="ad"></UiArt>
                </View>
              </View>
              {/*  顾问名片 + 码  */}
              {advisorQr || teacher ? (
                <View className="card card-pad gap">
                  <View
                    className="f"
                    style={{
                      gap: '0.6rem',
                    }}
                  >
                    <UiAvatar
                      name={advisorName}
                      path={advisorAvatar}
                      size={140}
                      ring={true}
                    ></UiAvatar>
                    <View className="f-1">
                      <View
                        className="f f-wrap"
                        style={{
                          gap: '0.3rem',
                        }}
                      >
                        <Text className="ad-name">{advisorName}</Text>
                        <Text className="tag tag--purple">{advisorRole}</Text>
                      </View>
                      {advisorRegion && (
                        <Text className="t-meta mt-8 block">
                          {advisorRegion}
                        </Text>
                      )}
                      <Text className="t-tiny mt-6 block">{advisorHint}</Text>
                    </View>
                  </View>
                  {advisorQr && (
                    <View className="qr-frame mt-16" onClick={this.previewQr}>
                      <Image
                        className="qr-img"
                        src={advisorQr}
                        style={{
                          width: '10rem',
                          height: '10rem',
                        }}
                        mode="aspectFit"
                      ></Image>
                    </View>
                  )}
                  {advisorQr && (
                    <View
                      className="f-center mt-12"
                      style={{
                        gap: '0.25rem',
                      }}
                    >
                      <UiIcon name="scan" size={26} color="signal"></UiIcon>
                      <Text className="t-meta t-signal">
                        点击放大后长按识别，添加顾问企业微信
                      </Text>
                    </View>
                  )}
                  {/*  码还没就绪：如实说在等什么，并给刷新，不摆一个空的白框  */}
                  {!advisorQr && (
                    <View className="box box--sunk mt-16">
                      <View
                        className="f"
                        style={{
                          gap: '0.3rem',
                        }}
                      >
                        <UiIcon name="clock" size={28} color="warn"></UiIcon>
                        <Text className="t-sec fw-600">{qrPendingTitle}</Text>
                      </View>
                      <Text className="t-tiny mt-6 block">{qrPendingHint}</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View className="card card-pad gap">
                  <View className="blank">
                    <View className="blank-mark">
                      <UiIcon name="headset" size={52} color="signal"></UiIcon>
                    </View>
                    <Text className="blank-title">还没有为你匹配专属顾问</Text>
                    <Text className="blank-hint">{fallbackHint}</Text>
                    <View
                      className="btn-grad mt-16"
                      onClick={this.contactService}
                    >
                      联系客服
                    </View>
                    <View
                      className="btn-sm mt-12"
                      data-url="/pages/ticket/index"
                      onClick={this.go}
                    >
                      提交服务工单
                    </View>
                  </View>
                </View>
              )}
              {/*  完全没有顾问：兜底到微信客服 / 群聊  */}
              {/*  添加后如何入群：三步  */}
              <View className="card card-pad gap">
                <View className="f-between mb-16">
                  <View
                    className="f"
                    style={{
                      gap: '0.3rem',
                    }}
                  >
                    <UiIcon name="shield" size={28} color="signal"></UiIcon>
                    <Text className="col-h">添加后如何入群</Text>
                  </View>
                  <Text className="t-tiny">三步即完成</Text>
                </View>
                <View className="flow3">
                  {steps.map((item, index) => {
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
                        {index < steps.length - 1 && (
                          <View className="flow-line"></View>
                        )}
                      </Block>
                    )
                  })}
                </View>
              </View>
            </Block>
          )}
        </View>
        <View className="action-bar">
          <View className="action-row">
            {advisorQr ? (
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
              data-url="/pages/group-qr/index"
              onClick={this.go}
            >
              <UiIcon name="chat" size={30} color="signal"></UiIcon>
              <Text>入群入口</Text>
            </View>
          </View>
        </View>
      </View>
    )
  }
}
export default _C
