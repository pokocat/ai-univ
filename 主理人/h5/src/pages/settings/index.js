import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text, Button, Input } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 设置页：协议入口 + 隐私指引 + 清除缓存 + 版本信息 + 账号注销。
 *
 * 为什么要单独一页：微信小程序运营规范要求提供**站内**账号注销途径，
 * 此前只在《用户协议》正文里写了"可通过在线客服申请"——文字承诺不等于可点的入口，
 * 上架审核这一条是会被打回的。同时把协议/隐私指引/缓存清理这些低频项从「我的」页挪出来。
 *
 * 注销不即时删档（见后端 MpService.requestAccountDeletion 注释）：会员挂着已付费权益、
 * 群内身份与关系链，直接删会破坏群人数聚合与上游对账，交易记录也依法须留存；
 * 故建高优工单交人工核验后依法删除/匿名化，页面如实告知这个口径，不许诺"立即删除"。
 */
const api = require('../../api/mp.js')
// 退出登录留在「我的」页（用户已熟悉的位置），本页不重复放置
const {
  isAuthGateError,
  ENV,
  logout,
  LOGIN_PAGE,
} = require('../../utils/auth.js')
const { toast } = require('../../utils/fmt.js')
const env = require('../../utils/env.js')
const subscribe = require('../../utils/subscribe.js')
const customerService = require('../../utils/customer-service.js')

/** 环境标签：体验版/开发版把环境显出来，便于用户报障时说清自己用的是哪个包 */
import UiSheet from '../../components/sheet/index'
import UiIcon from '../../components/icon/index'
import './index.scss'
const ENV_LABEL = {
  develop: '开发版',
  trial: '体验版',
  release: '',
}

/** 连点版本号开出后端环境切换面板的次数 */
const ENV_GESTURE_TAPS = 7
cacheOptions.setOptionsToCache({
  data: {
    version: '',
    memberNo: '',
    hasPhone: false,
    phoneText: '',
    notificationTemplates: [],
    notifyConfiguredCount: 0,
    subscribeBusy: '',
    /** 注销确认弹层 */
    delOpen: false,
    delReason: '',
    delSubmitting: false,
    /** 已提交过、仍在处理中的注销工单号 */
    pendingTicket: '',
    // ── 后端环境切换（仅非正式版；连点版本号开出） ──
    /** 是否显式切过环境：切过就常驻提示条，免得忘了自己还连在测试后端上 */
    envOverridden: false,
    envLabel: '',
    envBase: '',
    envOpen: false,
    envList: [],
    envPick: '',
    lanInput: '',
  },
  onLoad() {
    const acc = Taro.getAccountInfoSync
      ? Taro.getAccountInfoSync().miniProgram
      : {}
    const envLabel = ENV_LABEL[ENV] || ''
    this.setData({
      version: `${acc.version || '开发中'}${envLabel ? ` · ${envLabel}` : ''}`,
    })
    this.envTaps = 0
    this.refreshEnv()
  },
  refreshEnv() {
    const cur = env.current()
    this.setData({
      envOverridden: env.isOverridden(),
      envLabel: cur.label,
      envBase: env.base(),
    })
  },
  onShow() {
    this.load()
  },
  async load() {
    try {
      const [profile, notificationData] = await Promise.all([
        api.getProfile(),
        subscribe.prefetch(true),
      ])
      this.setData({
        memberNo: profile.member_no || '',
        hasPhone: !!profile.phone,
        // 手机号脱敏展示：设置页不是核对手机号的地方，没必要把完整号码摊在屏幕上
        phoneText: profile.phone
          ? String(profile.phone).replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2')
          : '未绑定',
        notifyConfiguredCount: notificationData.configuredCount || 0,
        notificationTemplates: (notificationData.templates || []).map(
          (item) => ({
            key: item.key,
            title: item.title,
            description: item.description,
            configured: !!item.configured,
            remaining: item.remaining || 0,
            statusText: !item.configured
              ? '待后台配置'
              : item.remaining > 0
              ? `已授权 ${item.remaining} 次`
              : '点击开启',
          })
        ),
      })
    } catch (e) {
      if (isAuthGateError(e)) return
      toast(e.message)
    }
  },
  /** 每类单独由用户点击授权，避免一次把六类提醒全弹出来造成认知负担。 */
  async enableNotification(e) {
    const key = getTarget(e.currentTarget, Taro).dataset.key
    const item = this.data.notificationTemplates.find((row) => row.key === key)
    if (!item || !item.configured || this.data.subscribeBusy) return
    // request() 在返回 Promise 前就会调用 wx.requestSubscribeMessage，保持在 tap 手势内。
    const pending = subscribe.request([key])
    this.setData({
      subscribeBusy: key,
    })
    const result = await pending
    this.setData({
      subscribeBusy: '',
    })
    if (result.accepted > 0) {
      toast('微信提醒已开启')
      await this.load()
    } else {
      toast('未开启微信提醒，站内消息仍会保留')
    }
  },
  openAgreement(e) {
    Taro.navigateTo({
      url: `/pages/agreement/index?type=${
        getTarget(e.currentTarget, Taro).dataset.type
      }`,
    })
  },
  /** 微信官方《小程序隐私保护指引》（与我们自己的《隐私政策》是两份，都要能看到） */
  openPrivacyContract() {
    if (!Taro.openPrivacyContract) {
      toast('当前微信版本不支持查看，请升级微信')
      return
    }
    Taro.openPrivacyContract({
      fail: () => toast('打开失败，请稍后重试'),
    })
  },
  openCustomerService() {
    customerService.open()
  },
  /**
   * 清除本地缓存：只清接口数据缓存，**不动登录态与协议同意标记**——
   * 全量 clearStorage 会把用户踢回登录页并要求重新勾协议，对"页面数据不对，清一下试试"
   * 这个诉求是过度反应。
   */
  async clearCache() {
    const r = await Taro.showModal({
      title: '清除缓存',
      content: '将清除本地缓存的页面数据，不会退出登录。',
      confirmText: '清除',
    })
    if (!r.confirm) return
    const app = Taro.getApp()
    app.globalData.payConfig = null
    subscribe.clear()
    Taro.showToast({
      title: '已清除',
      icon: 'success',
    })
  },
  // ── 后端环境切换（联调用） ──

  /**
   * 连点版本号 7 次开出环境面板。
   * 为什么藏在手势后而不是直接摆一行：审核版本报的 envVersion 也是 trial，
   * 一个显眼的「后端环境」选择器出现在审核员面前不合适。
   * 正式版连手势也不生效（env.isSwitchable 兜底）。
   */
  tapVersion() {
    if (!env.isSwitchable()) return
    this.envTaps += 1
    if (this.envTaps < ENV_GESTURE_TAPS) {
      // 最后两下给个反馈，否则用户不知道自己在接近什么
      const left = ENV_GESTURE_TAPS - this.envTaps
      if (left <= 2) toast(`再点 ${left} 次打开环境切换`)
      return
    }
    this.envTaps = 0
    this.openEnv()
  },
  openEnv() {
    const cur = env.currentKey()
    this.setData({
      envOpen: true,
      envPick: cur,
      lanInput: Taro.getStorageSync(env.LAN_BASE_KEY) || '',
      envList: env.ENV_LIST.map((e) => ({
        key: e.key,
        label: e.label,
        hint: e.hint,
        editable: !!e.editable,
        base: e.base,
        isDefault: e.key === env.defaultKey(),
      })),
    })
  },
  closeEnv() {
    this.setData({
      envOpen: false,
    })
  },
  pickEnv(e) {
    this.setData({
      envPick: getTarget(e.currentTarget, Taro).dataset.key,
    })
  },
  onLanInput(e) {
    this.setData({
      lanInput: e.detail.value,
    })
  },
  /**
   * 应用环境切换：必须清掉登录态与全局缓存——token 是**上一个后端**签发的，
   * 换库之后 memberNo 也对不上；payConfig / inviteCode 同理属于旧环境。
   * 不清的话表现为一堆莫名其妙的 4030 和错乱数据，比直接要求重新登录难查得多。
   */
  async applyEnv() {
    try {
      const to = env.switchTo(this.data.envPick, this.data.lanInput)
      subscribe.clear()
      logout()
      const app = Taro.getApp()
      app.globalData.payConfig = null
      app.globalData.inviteCode = null
      this.setData({
        envOpen: false,
      })
      this.refreshEnv()
      await Taro.showModal({
        title: '已切换环境',
        content: `当前后端：${to}\n登录态已清除，请重新登录。`,
        showCancel: false,
        confirmText: '去登录',
      })
      Taro.reLaunch({
        url: LOGIN_PAGE,
      })
    } catch (err) {
      toast(err.message)
    }
  },
  /** 恢复默认档（模拟器→本地、真机→测试） */
  resetEnv() {
    env.reset()
    subscribe.clear()
    this.setData({
      envPick: env.currentKey(),
      lanInput: Taro.getStorageSync(env.LAN_BASE_KEY) || '',
    })
    this.refreshEnv()
    toast(`已恢复默认：${env.current().label}`)
  },
  copyEnvBase() {
    if (this.data.envBase)
      Taro.setClipboardData({
        data: this.data.envBase,
      })
  },
  // ── 账号注销 ──
  openDelete() {
    this.setData({
      delOpen: true,
      delReason: '',
    })
  },
  closeDelete() {
    this.setData({
      delOpen: false,
    })
  },
  onReasonInput(e) {
    this.setData({
      delReason: e.detail.value,
    })
  },
  async submitDelete() {
    if (this.data.delSubmitting) return
    const r = await Taro.showModal({
      title: '确认提交注销申请',
      content:
        '提交后运营会在 1 个工作日内核验身份并处理。已购买的会员权益将同时失效，且不可恢复。',
      confirmText: '确认提交',
      // wx.showModal 是原生弹窗，只吃字面色值——保持与 app.wxss 的 --danger 一致
      confirmColor: '#B3261E',
    })
    if (!r.confirm) return
    this.setData({
      delSubmitting: true,
    })
    try {
      const res = await api.requestAccountDeletion(this.data.delReason)
      this.setData({
        delOpen: false,
        pendingTicket: res.ticket_no,
      })
      Taro.showModal({
        title: res.duplicated ? '已有处理中的申请' : '申请已提交',
        content: `工单号 ${res.ticket_no}。运营核验身份后会依法删除或匿名化你的个人信息（法律法规要求保留的交易记录除外）。如需撤回，请联系在线客服。`,
        showCancel: false,
        confirmText: '知道了',
      })
    } catch (e) {
      toast(e.message)
    } finally {
      this.setData({
        delSubmitting: false,
      })
    }
  },
  copyMemberNo() {
    if (!this.data.memberNo) return
    Taro.setClipboardData({
      data: this.data.memberNo,
    })
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const {
      envOverridden,
      envLabel,
      envBase,
      memberNo,
      phoneText,
      notificationTemplates,
      notifyConfiguredCount,
      version,
      pendingTicket,
      envOpen,
      envList,
      envPick,
      lanInput,
      delOpen,
      delReason,
      delSubmitting,
    } = this.data
    return (
      <View className="page">
        {envOverridden && (
          <View className="env-bar" onClick={this.copyEnvBase}>
            <UiIcon name="info" size={26} color="warn"></UiIcon>
            <Text className="env-bar-t">
              {'当前后端：' + envLabel + ' · ' + envBase + '（点击复制）'}
            </Text>
          </View>
        )}
        {/*  账号  */}
        <View className="section-head section-head--first">
          <Text className="section-title">账号</Text>
        </View>
        <View className="card card--list">
          <View className="row" onClick={this.copyMemberNo}>
            <Text className="info-k">会员编号</Text>
            <View className="f set-val">
              <Text className="t-body fw-500">{memberNo || '—'}</Text>
              <UiIcon name="copy" size={24} color="t3"></UiIcon>
            </View>
          </View>
          <View className="row">
            <Text className="info-k">手机号</Text>
            <Text className="t-body fw-500">{phoneText}</Text>
          </View>
        </View>
        {/*  消息提醒：站内消息默认开启；每个微信模板由用户主动点击授权一次  */}
        <View className="section-head">
          <Text className="section-title">消息提醒</Text>
        </View>
        <View className="card">
          <View className="notify-intro">
            <Text className="t-sec">
              支付、分班、入群和权益变化都会保存在站内消息。开启下面的微信提醒后，即使没打开小程序也能收到服务通知。
            </Text>
          </View>
          {notificationTemplates?.map((item, index) => {
            return (
              <View
                key={item.key}
                className={
                  'notify-setting ' +
                  (index < notificationTemplates?.length - 1
                    ? 'notify-setting--line'
                    : '')
                }
                data-key={item.key}
                onClick={this.enableNotification}
              >
                <View className="f set-row f-1">
                  <UiIcon
                    name="bell"
                    size={30}
                    color={item.configured ? 'accent' : 't3'}
                  ></UiIcon>
                  <View className="f-1">
                    <Text className="t-body">{item.title}</Text>
                    <View className="mt-4">
                      <Text className="t-muted">{item.description}</Text>
                    </View>
                  </View>
                </View>
                <View className="f set-val">
                  <Text
                    className={
                      item.remaining > 0 ? 'notify-status--on' : 't-muted'
                    }
                  >
                    {item.statusText}
                  </Text>
                  {item.configured && (
                    <UiIcon name="chevron-right" size={26} color="t3"></UiIcon>
                  )}
                </View>
              </View>
            )
          })}
          {!notifyConfiguredCount && (
            <View className="notify-unconfigured">
              <Text className="t-muted">
                微信模板尚未配置；站内消息功能不受影响。
              </Text>
            </View>
          )}
        </View>
        {/*  协议与隐私  */}
        <View className="section-head">
          <Text className="section-title">协议与隐私</Text>
        </View>
        <View className="card card--list">
          <View className="row" data-type="user" onClick={this.openAgreement}>
            <View className="f set-row">
              <UiIcon name="file-text" size={30} color="accent"></UiIcon>
              <Text className="t-body">用户协议</Text>
            </View>
            <UiIcon name="chevron-right" size={28} color="t3"></UiIcon>
          </View>
          <View
            className="row"
            data-type="privacy"
            onClick={this.openAgreement}
          >
            <View className="f set-row">
              <UiIcon name="shield-check" size={30} color="accent"></UiIcon>
              <Text className="t-body">隐私政策</Text>
            </View>
            <UiIcon name="chevron-right" size={28} color="t3"></UiIcon>
          </View>
          <View
            className="row"
            data-type="membership"
            onClick={this.openAgreement}
          >
            <View className="f set-row">
              <UiIcon name="file-text" size={30} color="accent"></UiIcon>
              <Text className="t-body">会员服务协议</Text>
            </View>
            <UiIcon name="chevron-right" size={28} color="t3"></UiIcon>
          </View>
          <View className="row" onClick={this.openPrivacyContract}>
            <View className="f set-row">
              <UiIcon name="shield-check" size={30} color="accent"></UiIcon>
              <View>
                <Text className="t-body">小程序隐私保护指引</Text>
                <View className="mt-4">
                  <Text className="t-muted">微信官方版本</Text>
                </View>
              </View>
            </View>
            <UiIcon name="chevron-right" size={28} color="t3"></UiIcon>
          </View>
        </View>
        {/*  通用  */}
        <View className="section-head">
          <Text className="section-title">通用</Text>
        </View>
        <View className="card card--list">
          <View className="row" onClick={this.clearCache}>
            <View className="f set-row">
              <UiIcon name="refresh-cw" size={30} color="accent"></UiIcon>
              <View>
                <Text className="t-body">清除缓存</Text>
                <View className="mt-4">
                  <Text className="t-muted">仅清页面数据，不会退出登录</Text>
                </View>
              </View>
            </View>
            <UiIcon name="chevron-right" size={28} color="t3"></UiIcon>
          </View>
          {/*  连点 7 次开出后端环境切换（仅非正式版生效，见 tapVersion 注释）  */}
          <View className="row" onClick={this.tapVersion}>
            <View className="f set-row">
              <UiIcon name="info" size={30} color="accent"></UiIcon>
              <Text className="t-body">当前版本</Text>
            </View>
            <Text className="t-muted">{version}</Text>
          </View>
          <Button className="row row--btn" onClick={this.openCustomerService}>
            <View className="f set-row">
              <UiIcon name="message-circle" size={30} color="accent"></UiIcon>
              <Text className="t-body">在线客服</Text>
            </View>
            <UiIcon name="chevron-right" size={28} color="t3"></UiIcon>
          </Button>
        </View>
        {/*  危险区  */}
        <View className="section-head">
          <Text className="section-title">账号注销</Text>
        </View>
        <View className="card">
          {pendingTicket ? (
            <View className="del-pending">
              <Text className="t-sec">
                {'注销申请已提交（工单 ' +
                  pendingTicket +
                  '），运营核验后会依法处理。'}
              </Text>
            </View>
          ) : (
            <Block>
              <Text className="t-sec">
                注销后，你的会员档案与个人信息将被删除或匿名化，已购买的会员权益同时失效且不可恢复。法律法规要求保留的交易记录除外。
              </Text>
              <View className="mt-12">
                <Text className="t-muted">
                  为核验身份、避免误删，注销采用人工审核：提交后运营会在 1
                  个工作日内处理。
                </Text>
              </View>
              <Button
                className="btn btn--danger mt-26"
                onClick={this.openDelete}
              >
                <UiIcon name="trash-2" size={28} color="danger"></UiIcon>
                申请注销账号
              </Button>
            </Block>
          )}
        </View>
        {/*  后端环境切换弹层（联调用；正式版打不开）  */}
        {envOpen && (
          <UiSheet title="后端环境" onClose={this.closeEnv}>
            <View className="mt-12">
              <Text className="t-muted">
                切换后会清除登录态并回到登录页——token
                属于上一个后端，换库后对不上。
              </Text>
            </View>
            {envList?.map((item, index) => {
              return (
                <View
                  key={item.key}
                  className={
                    'env-item ' + (envPick === item.key ? 'env-item--on' : '')
                  }
                  data-key={item.key}
                  onClick={this.pickEnv}
                >
                  <View className="f-between">
                    <View className="f set-row">
                      <View
                        className={
                          'env-radio ' +
                          (envPick === item.key ? 'env-radio--on' : '')
                        }
                      ></View>
                      <Text className="t-body fw-500">{item.label}</Text>
                      {item.isDefault && (
                        <Text className="tag tag--gray">默认</Text>
                      )}
                    </View>
                  </View>
                  <View className="env-item-sub">
                    <Text className="t-muted">{item.hint}</Text>
                  </View>
                  {item.base && (
                    <View className="env-item-sub">
                      <Text className="t-muted">{item.base}</Text>
                    </View>
                  )}
                  {/*  局域网档没有固定地址，就地填  */}
                  {item.editable && envPick === item.key && (
                    <Input
                      value={lanInput}
                      placeholder="http://192.168.1.8:8080/api/v1"
                      placeholderStyle="color:#6E685F"
                      className="field-input"
                      onInput={this.onLanInput}
                    ></Input>
                  )}
                </View>
              )
            })}
            <View className="mt-16">
              <Text className="t-muted">
                真机连非正式环境需在手机上打开调试模式（开发版/体验版）跳过域名校验。
              </Text>
            </View>
            <Button className="btn btn--primary mt-26" onClick={this.applyEnv}>
              切换并重新登录
            </Button>
            <Button className="btn btn--ghost mt-16" onClick={this.resetEnv}>
              恢复默认
            </Button>
          </UiSheet>
        )}
        {/*  注销原因弹层（原因选填，但问一句能让运营判断是不是误操作/可挽回）  */}
        {delOpen && (
          <UiSheet title="申请注销账号" onClose={this.closeDelete}>
            <View className="mt-16">
              <Text className="t-sec">
                能告诉我们原因吗？（选填，有助于我们改进）
              </Text>
              <Input
                value={delReason}
                placeholder="例如：不再使用 / 重复注册"
                placeholderStyle="color:#6E685F"
                className="field-input"
                maxlength="100"
                onInput={this.onReasonInput}
              ></Input>
            </View>
            <View className="mt-20">
              <Text className="t-muted">
                提交后不会立即删除，运营核验身份后依法处理；处理期间你仍可正常使用。
              </Text>
            </View>
            <Button
              className="btn btn--danger mt-30"
              loading={delSubmitting}
              onClick={this.submitDelete}
            >
              提交注销申请
            </Button>
            <Button className="btn btn--ghost mt-16" onClick={this.closeDelete}>
              再想想
            </Button>
          </UiSheet>
        )}
      </View>
    )
  }
}
export default _C
