import withWeapp, { cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text, Button } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 确认登录「社群管理台」（W9）：PC 登录页出小程序码 → 本页确认 → PC 自动登录。
 *
 * 本页是**授权确认页**，不是登录页：小程序侧的登录（openid → member）由既有 ensureLogin 门禁完成，
 * 这里只把「电脑上那张二维码」与「当前微信身份」绑在一起。
 *
 * 诚实度约定（CLAUDE.md 前端诚实度）：
 * - 只有服务端回 `hasAccount ∧ enabled` 才说「已确认，请回到电脑」。没有后台账号或账号未启用时，
 *   一律如实说「已登记，等待管理员批准」——绝不因为「确认动作成功了」就说「登录成功」，
 *   那是两件事：电脑那头此刻仍然进不去。
 * - 失败原因原样展示服务端人话（票据过期 / 已被另一个微信号确认 / 已完成登录），不翻译成"操作失败"。
 * - 取消只是本地放手，不谎称"已取消电脑上的登录"——服务端没有取消动作，那张码等它自己过期。
 *
 * 票据来源与传递见 utils/auth.js captureScanTicket 的注释（冷启动即落 storage，
 * 否则新用户被登录门禁弹走后票据就丢了）。
 *
 * 【W10】本页还是**身份采集点**：微信 2021+ 不允许静默取昵称头像，扫码新用户在 /mp/login
 * 建档时 name 就是「微信用户」、无头像无手机号，管理台待批准列表因此是一排认不出的「微信用户」，
 * 管理员既判断不了是谁、也联系不上，等于批不了。所以昵称仍是默认值时**先弹完善资料、
 * 填完才给「确认登录」**（授权对象不明的登录请求本就不该确认），手机号则是**可选**采集
 * （微信规范禁止把 getPhoneNumber 当使用前提，拒绝/失败一律不阻断确认）。
 */
const api = require('../../api/mp.js')
const {
  captureScanTicket,
  getPendingScanTicket,
  clearPendingScanTicket,
  ensureLogin,
  isAuthGateError,
} = require('../../utils/auth.js')
const { toast, maskPhone } = require('../../utils/fmt.js')
const share = require('../../behaviors/share.js')

/** 建档时的占位昵称（后端 /mp/login 写死同一个值）：等于「用户还没填过」 */
import UiPrivacy from '../../components/privacy/index'
import UiProfileEdit from '../../components/profile-edit/index'
import UiAvatar from '../../components/avatar/index'
import UiIcon from '../../components/icon/index'
import './index.scss'
const DEFAULT_NAME = '微信用户'

/** 各终局的标题与说明（stage 驱动单页多态，与 pages/training 同一套做法） */
const VIEW = {
  ok: {
    title: '已确认登录',
    hint: '请回到电脑继续操作，页面会自动进入管理台。本页可以关掉了。',
  },
  pending: {
    title: '已登记，等待批准',
    // 具体文案优先用服务端 adminHint（批准口径由服务端裁定），这里只兜底
    hint: '已为你登记后台账号，等待管理员批准后重新扫码即可登录。',
  },
  cancelled: {
    title: '已取消',
    // 不说「电脑上的登录已取消」——服务端没有取消动作，那张码只是没人用，等它自己过期
    hint: '本次没有确认登录。电脑上的二维码会在过期后自动失效，需要时重新扫一次即可。',
  },
}
const NO_TICKET =
  '没有识别到登录二维码。请在电脑的管理台登录页点「微信扫码登录」，再用微信扫一次。'
cacheOptions.setOptionsToCache(
  share.withShare({
    data: {
      /** loading（校验票据与身份）/ confirm（等用户点确认）/ ok / pending / cancelled / error */
      stage: 'loading',
      ticket: '',
      errMsg: '',
      /**
       * 失败态是否给「重试」按钮。
       * 只有**加载身份失败**（网络问题）才给——票据本身失效时按钮点一万次也不会成功，
       * 解法在电脑那头（刷新二维码），摆一个必然失败的按钮就是假出路。
       */
      canRetry: false,
      /** 当前微信身份（让用户看清是"用哪个号登录"，避免多微信混用时确认错人） */
      memberName: '',
      memberNo: '',
      avatarPath: '',
      /**
       * 昵称还是建档占位值（或空）——**确认登录的硬门禁**。
       * 门在这里而不在后端：后端只知道有人拿着有效票据确认，判断不了「这个人管理员认不认得出」。
       */
      isDefaultName: false,
      /** 有昵称但没头像：不阻断（头像取不到的路径真实存在，堵死就登不进来了），只给一个补设入口 */
      avatarMissing: false,
      /** 已绑手机号的脱敏尾号；空串 = 未绑定（此时才显示可选的绑定按钮） */
      phoneText: '',
      /** 完善资料弹层（头像 + 昵称一体，与登录页/我的页同一个组件） */
      profileOpen: false,
      confirming: false,
      title: '',
      hint: '',
    },
    onLoad(options) {
      // 票据优先取本次页面参数，退回 storage（冷启动被登录门禁弹走再回来时走的是后者）
      const ticket =
        captureScanTicket({
          query: options || {},
        }) || getPendingScanTicket()
      if (!ticket) {
        this.setData({
          stage: 'error',
          errMsg: NO_TICKET,
          canRetry: false,
        })
        return
      }
      this.setData({
        ticket,
      })
      this.loadIdentity()
    },
    /**
     * 拉当前微信身份用于确认卡展示 + 判资料完整度；未登录/未同意协议由 ensureLogin 门禁接手。
     *
     * 取 `/mp/profile` 而非 `/mp/me`：一次请求就拿齐昵称 / 头像 / 手机号 / 会员号
     * （`/mp/me` 没有 phone，还得再打一次接口；它返回的会员号键也是 `member_no`，
     * 早先这里写 `me.memberNo` 取到的一直是 undefined，会员号那行从没显示过）。
     */
    async loadIdentity() {
      try {
        await ensureLogin()
        const me = await api.getProfile()
        const name = (me && me.name) || ''
        const avatarPath = (me && me.avatarPath) || ''
        const isDefaultName = !name || name === DEFAULT_NAME
        this.setData({
          stage: 'confirm',
          memberName: name || DEFAULT_NAME,
          memberNo: (me && me.member_no) || '',
          avatarPath,
          isDefaultName,
          avatarMissing: !avatarPath,
          phoneText: maskPhone(me && me.phone),
          // 默认昵称：进页面直接把弹层摊开，别让用户自己找入口（他此刻的目标是登录，不是改资料）
          profileOpen: isDefaultName,
        })
      } catch (err) {
        if (isAuthGateError(err)) return // 未同意协议：已跳登录页，登完会带票据回到本页
        // 身份拉不到就不摆确认按钮：点下去也只会失败，不如让他重试
        this.setData({
          stage: 'error',
          errMsg: err.message || '加载失败，请重试',
          canRetry: true,
        })
      }
    },
    /** 重试：只重新拉身份，票据不变（票据没问题，问题在网络） */
    retry() {
      if (!this.data.canRetry) {
        toast('请回到电脑刷新二维码后重新扫码')
        return
      }
      this.setData({
        stage: 'loading',
        errMsg: '',
      })
      this.loadIdentity()
    },
    // ── 资料采集（昵称+头像必填，手机号可选） ──

    openProfile() {
      this.setData({
        profileOpen: true,
      })
    },
    /**
     * 关闭弹层但没保存：**不放行**。门禁停在原处，主按钮仍是「填写昵称和头像」，
     * 用户随时可以再打开——没有死路，只是没有捷径。
     */
    closeProfile() {
      this.setData({
        profileOpen: false,
      })
    },
    /**
     * 保存成功：用组件回传的值就地更新确认卡（不再打一次 /mp/profile——刚写完的值就是它回传的）。
     * 只改了头像没填昵称时组件回传的 name 仍是占位值，门禁照样不放行：
     * 让管理员认出人的是昵称，头像只是辅助。
     */
    onProfileSaved(e) {
      const d = e && e.detail ? e.detail : {}
      const name = d.name || this.data.memberName
      const avatarPath = d.avatarPath || this.data.avatarPath
      this.setData({
        profileOpen: false,
        memberName: name || DEFAULT_NAME,
        avatarPath,
        isDefaultName: !name || name === DEFAULT_NAME,
        avatarMissing: !avatarPath,
      })
    },
    /**
     * 手机号绑定（可选）：微信规范明确禁止把 getPhoneNumber 当作使用前提，
     * 所以拒绝、失败、当前环境不支持——一律只提示，不影响确认登录。
     */
    async onPhone(e) {
      const code = e && e.detail ? e.detail.code : ''
      if (!code) {
        const errMsg = (e && e.detail && e.detail.errMsg) || ''
        if (errMsg.indexOf('deny') >= 0) return // 用户主动取消：静默（这是他的正当选择）
        if (errMsg.indexOf('privacy') >= 0) {
          toast('需先同意《小程序隐私保护指引》才能绑定手机号')
          return
        }
        toast('当前环境暂不支持手机号快速验证')
        return
      }
      try {
        const r = await api.bindPhone(code)
        const phone = (r && r.phone) || ''
        this.setData({
          phoneText: maskPhone(phone),
        })
        Taro.showToast({
          title: '手机号已绑定',
          icon: 'success',
        })
      } catch (err) {
        // 后端文案已是人话（演示环境会明确说不支持），原样展示，不翻译成"绑定失败"
        toast(err.message)
      }
    },
    async doConfirm() {
      // 资料没填完不允许确认：这不只是"数据不全"——管理员批准时根本认不出申请人是谁
      if (this.data.isDefaultName) {
        toast('请先填写昵称，管理员才能认出是谁在申请')
        this.setData({
          profileOpen: true,
        })
        return
      }
      if (this.data.confirming) return
      this.setData({
        confirming: true,
      })
      try {
        const data = await api.scanLoginConfirm(this.data.ticket)
        clearPendingScanTicket() // 已表态，别再把用户往本页送
        // 唯一可以说"电脑那头进去了"的条件：有后台账号且已启用
        const loggedIn = !!(data && data.hasAccount && data.enabled)
        const view = loggedIn ? VIEW.ok : VIEW.pending
        this.setData({
          stage: loggedIn ? 'ok' : 'pending',
          title: view.title,
          hint: (data && data.adminHint) || view.hint,
        })
      } catch (err) {
        // 票据过期 / 已被另一个微信号确认 / 已完成登录：服务端文案已是人话，原样展示。
        // 票据一并清掉——这三种情形都得回电脑重新出码，留着只会让用户下次登录又被送回本页。
        clearPendingScanTicket()
        this.setData({
          stage: 'error',
          errMsg: err.message || '确认失败，请回到电脑刷新二维码后重试',
          canRetry: false,
        })
      } finally {
        this.setData({
          confirming: false,
        })
      }
    },
    cancel() {
      clearPendingScanTicket()
      this.setData({
        stage: 'cancelled',
        title: VIEW.cancelled.title,
        hint: VIEW.cancelled.hint,
      })
    },
    goHome() {
      clearPendingScanTicket()
      Taro.reLaunch({
        url: '/pages/index/index',
      })
    },
  })
)
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const {
      stage,
      avatarPath,
      memberName,
      memberNo,
      phoneText,
      isDefaultName,
      avatarMissing,
      confirming,
      title,
      hint,
      errMsg,
      canRetry,
      profileOpen,
    } = this.data
    return (
      <View className="page page--sub pt-30">
        {stage === 'loading' ? (
          <View className="card">
            <Text className="t-muted">加载中…</Text>
          </View>
        ) : stage === 'confirm' ? (
          <View className="card-glow">
            <View className="f card-head">
              <View className="li-icon head-icon">
                <UiIcon name="qr-code" size={30} color="accent"></UiIcon>
              </View>
              <View className="f-1">
                <Text className="t-strong">登录社群管理台</Text>
                <View className="mt-6">
                  <Text className="t-muted">电脑上的登录请求等待你确认</Text>
                </View>
              </View>
            </View>
            {/*  身份块：点头像/昵称可随时重新编辑（微信不允许静默取头像昵称，只能用户自己填）  */}
            <View className="who" onClick={this.openProfile}>
              <UiAvatar
                path={avatarPath}
                name={memberName}
                size="lg"
              ></UiAvatar>
              <View className="who-text">
                <Text className="t-body fw-500">{memberName}</Text>
                {memberNo && (
                  <View className="mt-6">
                    <Text className="info-k mono">{memberNo}</Text>
                  </View>
                )}
                {/*  手机号：有就显示尾号，没有也如实说"未绑定"，不留空让人以为是加载中  */}
                <View className="mt-6">
                  <Text className="info-k">
                    {phoneText ? '手机号 ' + phoneText : '未绑定手机号'}
                  </Text>
                </View>
              </View>
              <Text className="who-edit">编辑</Text>
            </View>
            {/*  ②-a 资料没填：说清为什么要填（不是"完善资料得积分"那种空话），主按钮换成填写入口  */}
            {isDefaultName ? (
              <View className="notice notice--warn">
                <Text className="t-sec">请先设置头像和昵称，再确认登录。</Text>
                <View className="mt-10">
                  <Text className="t-muted">
                    微信不允许小程序自动获取你的头像昵称。管理员要在电脑上批准这次开户，
                    看到的只有你在这里填的资料——不填的话列表里是一排「微信用户」，他认不出该批准谁。
                  </Text>
                </View>
              </View>
            ) : (
              <Block>
                <View className="notice">
                  <Text className="t-sec">
                    确认后，电脑上的管理台将以这个身份登录。
                  </Text>
                  <View className="mt-10">
                    <Text className="t-muted">
                      如果这不是你本人在操作，请直接取消——你的账号不会有任何变化。
                    </Text>
                  </View>
                </View>
                {/*  头像缺失不阻断确认（头像授权真有可能被拒，堵死就登不进来了），只给一个补设入口  */}
                {avatarMissing && (
                  <View className="side-row">
                    <Text className="t-muted">
                      还没有头像，管理员看到的是文字头像
                    </Text>
                    <Text className="side-link" onClick={this.openProfile}>
                      设置头像
                    </Text>
                  </View>
                )}
              </Block>
            )}
            {/*  ②-b 资料齐了：正常的授权说明  */}
            {/*  手机号：**可选**采集。微信规范禁止把手机号授权当作使用前提，所以它在主按钮之外、
                   拒绝也不影响登录；已绑定就不再问第二遍  */}
            {!phoneText && (
              <View className="side-row">
                <Text className="t-muted">
                  绑定手机号，便于管理员识别并联系你（选填）
                </Text>
                <Button
                  className="btn btn--ghost btn--mini"
                  openType="getPhoneNumber"
                  onGetphonenumber={this.onPhone}
                >
                  微信快速绑定
                </Button>
              </View>
            )}
            {isDefaultName ? (
              <Button
                className="btn btn--gradient mt-30"
                onClick={this.openProfile}
              >
                填写昵称和头像
              </Button>
            ) : (
              <Button
                className="btn btn--gradient mt-30"
                loading={confirming}
                onClick={this.doConfirm}
              >
                确认登录
              </Button>
            )}
            <Button className="btn btn--ghost mt-14" onClick={this.cancel}>
              取消
            </Button>
          </View>
        ) : stage === 'ok' ? (
          <View className="card-glow">
            <View className="f card-head">
              <View className="li-icon li-icon--ok head-icon">
                <UiIcon name="check-circle" size={30} color="ok"></UiIcon>
              </View>
              <View className="f-1">
                <Text className="t-strong">{title}</Text>
                <View className="mt-6">
                  <Text className="t-muted">{memberName}</Text>
                </View>
              </View>
              <Text className="tag tag--green">已确认</Text>
            </View>
            <View className="mt-22">
              <Text className="t-sec">{hint}</Text>
            </View>
            <Button className="btn btn--ghost mt-30" onClick={this.goHome}>
              回到首页
            </Button>
          </View>
        ) : stage === 'pending' ? (
          <View className="card-glow">
            <View className="f card-head">
              <View className="li-icon li-icon--warn head-icon">
                <UiIcon name="clock" size={30} color="warn"></UiIcon>
              </View>
              <View className="f-1">
                <Text className="t-strong">{title}</Text>
                <View className="mt-6">
                  <Text className="t-muted">{memberName}</Text>
                </View>
              </View>
              <Text className="tag tag--amber">待批准</Text>
            </View>
            <View className="mt-22">
              <Text className="t-sec">{hint}</Text>
            </View>
            <View className="notice">
              <Text className="t-muted">
                批准由管理员在管理台「账号与权限」页完成。批准后回到电脑重新扫码即可登录，本页不需要一直开着。
              </Text>
            </View>
            <Button className="btn btn--ghost mt-30" onClick={this.goHome}>
              回到首页
            </Button>
          </View>
        ) : stage === 'cancelled' ? (
          <View className="card empty-card">
            <Text className="t-title">{title}</Text>
            <View className="mt-14">
              <Text className="t-muted">{hint}</Text>
            </View>
            <Button className="btn btn--gradient mt-40" onClick={this.goHome}>
              回到首页
            </Button>
          </View>
        ) : (
          <View className="card-glow">
            <View className="f card-head">
              <View className="li-icon li-icon--danger head-icon">
                <UiIcon name="info" size={30} color="danger"></UiIcon>
              </View>
              <View className="f-1">
                <Text className="t-strong">无法确认登录</Text>
                <View className="mt-6">
                  <Text className="t-muted">请按下面的说明处理</Text>
                </View>
              </View>
            </View>
            <View className="notice">
              <Text className="t-sec">{errMsg}</Text>
            </View>
            {/*  只有网络类失败才给重试：票据失效时按钮点一万次也不会成功，解法在电脑那头  */}
            {canRetry && (
              <Button className="btn btn--gradient mt-30" onClick={this.retry}>
                重试
              </Button>
            )}
            <Button className="btn btn--ghost mt-14" onClick={this.goHome}>
              回到首页
            </Button>
          </View>
        )}
        {/*  ② 确认卡：先让用户看清"用哪个微信号登录"，再给确认按钮  */}
        {/*  ③ 已确认（有启用账号）：这是唯一可以说"电脑那头能进去了"的分支  */}
        {/*  ④ 待批准：确认动作成功了，但电脑那头**还进不去**——如实说，不写"登录成功"  */}
        {/*  ⑤ 已取消：只说本地放手了，不谎称"电脑上的登录已被取消"  */}
        {/*  ⑥ 失败：原样展示服务端人话（票据过期 / 已被另一个微信号确认 / 已完成登录）  */}
        {/*  完善资料（头像 chooseAvatar + 昵称 input type=nickname 一体）：与登录页/我的页同一个组件  */}
        {profileOpen && (
          <UiProfileEdit
            title="设置头像和昵称"
            subtitle="管理员在电脑上批准这次登录时，看到的就是这里填的头像和昵称。"
            avatarPath={avatarPath}
            name={memberName}
            onSaved={this.onProfileSaved}
            onClose={this.closeProfile}
          ></UiProfileEdit>
        )}
        {/*  隐私授权弹层：本页有头像/昵称填写与手机号（getPhoneNumber），必须挂  */}
        <UiPrivacy></UiPrivacy>
      </View>
    )
  }
}
export default _C
