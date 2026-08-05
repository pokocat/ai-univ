const Taro = require('@tarojs/taro')
/**
 * /mp/* API 封装：统一信封 {code,message,data}。
 *
 * 重试策略（资金安全）：**只重试幂等的 GET**。
 * POST 一律不自动重试——下单/支付/完成任务在服务端没有全覆盖的幂等守卫，
 * 弱网重试会造成重复下单、重复发积分。需要幂等的写操作由调用方显式传 Idempotency-Key
 * （如提现），由服务端 IdempotencyGuard 保证「重复键返回首次结果」。
 */
const {
  base,
  ensureLogin,
  getToken,
  logout,
  explainNetworkError,
} = require('../utils/auth.js')
const log = require('../utils/log.js')
function raw(path, opts) {
  const method = (opts && opts.method) || 'GET'
  return new Promise((resolve, reject) => {
    Taro.request({
      url: `${base()}${path}`,
      method,
      data: opts && opts.data,
      timeout: 12000,
      header: Object.assign(
        {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        (opts && opts.headers) || {}
      ),
      success: (res) => {
        if (res.statusCode >= 500) {
          reject(new Error(`服务异常(${res.statusCode})`))
          return
        }
        resolve(res.data)
      },
      fail: (err) => reject(new Error(explainNetworkError(err && err.errMsg))),
    })
  })
}

/** GET 幂等，网络抖动重试一次；写操作绝不自动重试。 */
async function send(path, opts) {
  const method = (opts && opts.method) || 'GET'
  try {
    return await raw(path, opts)
  } catch (e) {
    if (method !== 'GET') throw e
    log.warn('GET retry', path, e.message)
    return raw(path, opts)
  }
}
async function request(path, opts, retried) {
  await ensureLogin()
  const resp = await send(path, opts || {})
  // 登录态失效：清态重登一次（只重试一次，避免死循环）
  if (resp && resp.code === 4030 && !retried) {
    log.warn('token expired, re-login', path)
    logout()
    return request(path, opts, true)
  }
  if (!resp || resp.code !== 0) {
    const msg = (resp && resp.message) || '请求失败'
    log.error('api error', path, msg)
    throw new Error(msg)
  }
  return resp.data
}

/** 生成一次性幂等键（写操作按需使用） */
function idemKey(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * 文件上传（wx.uploadFile 走 multipart，不能复用 wx.request 那套）。
 * 与 request() 的差异：
 * - 响应体是**字符串**，要自己 JSON.parse；
 * - 不自动重试（上传是写操作），也不做 4030 重登——上传前必然刚调过别的接口，token 是新的。
 *
 * 注意：uploadFile 与 request 是**两套**服务器域名白名单，小程序后台
 * 「开发管理 → 服务器域名」的 uploadFile 合法域名要单独配上同一个域名，否则真机传不上去。
 */
async function upload(path, filePath, name) {
  await ensureLogin()
  const resp = await new Promise((resolve, reject) => {
    Taro.uploadFile({
      url: `${base()}${path}`,
      filePath,
      name: name || 'file',
      timeout: 20000,
      header: {
        Authorization: `Bearer ${getToken()}`,
      },
      success: (res) => {
        if (res.statusCode >= 500) {
          reject(new Error(`服务异常(${res.statusCode})`))
          return
        }
        try {
          resolve(JSON.parse(res.data))
        } catch (e) {
          reject(new Error('上传响应解析失败'))
        }
      },
      fail: (err) => reject(new Error(explainNetworkError(err && err.errMsg))),
    })
  })
  if (!resp || resp.code !== 0) {
    const msg = (resp && resp.message) || '上传失败'
    log.error('upload error', path, msg)
    throw new Error(msg)
  }
  return resp.data
}

/**
 * 下单渠道保留真实平台标记，为后续接通商户号后的正式价格与对账做准备。
 * 当前支付通道保持 disabled，页面展示不再按 iOS/安卓做差异化隐藏。
 */
function platformChannel() {
  try {
    const info = Taro.getDeviceInfo
      ? Taro.getDeviceInfo()
      : Taro.getSystemInfoSync()
    return info && info.platform === 'ios' ? 'ios' : 'android'
  } catch (e) {
    return 'android'
  }
}
module.exports = {
  idemKey,
  platformChannel,
  getMe: () => request('/mp/me'),
  /** 站内消息中心（后台状态变化必达） */
  getNotifications: (unreadOnly) =>
    request('/mp/notifications', {
      data: {
        unreadOnly: !!unreadOnly,
      },
    }),
  getNotificationTemplates: () => request('/mp/notification-templates'),
  recordNotificationSubscriptions: (results) =>
    request('/mp/notification-subscriptions', {
      method: 'POST',
      data: {
        results,
      },
    }),
  readNotification: (id) =>
    request(`/mp/notifications/${id}/read`, {
      method: 'POST',
    }),
  readAllNotifications: () =>
    request('/mp/notifications/read-all', {
      method: 'POST',
    }),
  getInvite: () => request('/mp/invite'),
  getPlans: () => request('/mp/plans'),
  /** 支付通道配置：{mode:"mock"|"xpay"|"disabled", iosEnabled:boolean} */
  getPayConfig: () => request('/mp/pay/config'),
  /** 下单：带幂等键，重复提交只受理一次 */
  createOrder: (planCode, key) =>
    request('/mp/orders', {
      method: 'POST',
      data: {
        planCode,
        channel: platformChannel(),
      },
      headers: {
        'Idempotency-Key': key || idemKey('mporder'),
      },
    }),
  /**
   * 虚拟支付签名：{signData(JSON 字符串,原样透传), paySig, signature, mode:"goods"}。
   * session_key 缺失时后端返回 4030，request() 会自动 logout + 重登后重试一次。
   */
  getPaySig: (orderNo) => request(`/mp/orders/${orderNo}/paysig`),
  /** 单订单查询（只能查自己的单），支付后轮询用 */
  getOrder: (orderNo) => request(`/mp/orders/${orderNo}`),
  /** 演示支付（Mock 模式）：直接把订单置为已支付 */
  payOrder: (orderNo) =>
    request(`/mp/orders/${orderNo}/pay`, {
      method: 'POST',
    }),
  /** 关闭自己的待支付订单（支付中断后清理废单，避免订单列表堆满永远付不掉的单） */
  closeOrder: (orderNo) =>
    request(`/mp/orders/${orderNo}/close`, {
      method: 'POST',
    }),
  getMyGroup: () => request('/mp/my-group'),
  getCourses: () => request('/mp/courses'),
  getCourseWatchCode: (id) =>
    request(`/mp/courses/${id}/watch-code`, {
      method: 'POST',
    }),
  getFaq: () => request('/mp/faq'),
  /** 企微“微信客服”接待配置；未配置时客户端转到社群服务老师兜底 */
  getCustomerService: () => request('/mp/customer-service'),
  getProfile: () => request('/mp/profile'),
  getEarnings: () => request('/mp/earnings'),
  /** 提现申请：idemKey 由页面在打开表单时生成一次，同一次填单重复提交只受理一次 */
  applyWithdrawal: (amount, method, accountInfo, key) =>
    request('/mp/withdrawals', {
      method: 'POST',
      data: {
        amount,
        method,
        accountInfo,
      },
      headers: {
        'Idempotency-Key': key,
      },
    }),
  getTasks: () => request('/mp/tasks'),
  completeTask: (id) =>
    request(`/mp/tasks/${id}/complete`, {
      method: 'POST',
    }),
  /** 昵称（头像昵称填写能力回传） */
  updateNickname: (nickname) =>
    request('/mp/profile/nickname', {
      method: 'POST',
      data: {
        nickname,
      },
    }),
  /**
   * 头像（chooseAvatar 回传的是**本地临时文件路径**，不是 URL——微信 2022 年起不再下发远端头像地址，
   * 所以必须上传由我们自己持久化）。返回 {avatarPath} 相对路径，展示由 ui-avatar 拼基址。
   */
  uploadAvatar: (tempFilePath) =>
    upload('/mp/profile/avatar', tempFilePath, 'file'),
  /** 申请注销账号（建「账号问题」工单人工核验；不即时删档，理由见后端注释） */
  requestAccountDeletion: (reason) =>
    request('/mp/account/deletion', {
      method: 'POST',
      data: {
        reason,
      },
    }),
  /** 手机号（open-type=getPhoneNumber 的 code 换号） */
  bindPhone: (code) =>
    request('/mp/phone', {
      method: 'POST',
      data: {
        code,
      },
    }),
  /** 专属小程序码（scene=邀请码）；mock=true 时无图 */
  getInviteQrcode: () => request('/mp/invite/qrcode'),
  /**
   * 培训链路（方案 §6.4 四连状态，单页四段视图共用同一聚合）。
   * phase：none / waiting_assign / add_advisor / join_group / in_cohort。
   * 三个端点都按 JWT 里的会员身份取数，前端不传 memberNo（越权从入口杜绝）。
   */
  /** 代理工作面（我名下的群与学员）；非结构身份返回 available=false，不报错 */
  getAgentPortfolio: () => request('/mp/agent/portfolio'),
  /** 我的身份申请状态（在途 + 最近历史） */
  getAgentApplication: () => request('/mp/agent/application'),
  /** 申请成为代理（建审批单，不立即生效） */
  applyAgent: (identity, reason) =>
    request('/mp/agent/application', {
      method: 'POST',
      data: {
        identity,
        reason,
      },
    }),
  getTrainingEnrollment: () => request('/mp/training/enrollment'),
  /** 班级顾问企微二维码；未分班只回引导文案（available=false），不下发通用码 */
  getTrainingContactEntry: () => request('/mp/training/contact-entry'),
  /** 班级群固定入口（欢迎语未送达时的兜底），口径与 /mp/my-group 一致 */
  getTrainingJoinEntry: () => request('/mp/training/join-entry'),
  // ── 会员身份：成长值 / 权益 / 资格 / 会员码（V40，设计稿 03·12·16·21·22·26） ──

  /** 成长值与等级（总额 / 当前档 / 距升级 / 本月新增 / 明细流水） */
  getGrowth: (limit) =>
    request('/mp/growth', {
      data: {
        limit: limit || 20,
      },
    }),
  /** 权益清单；onlyAvailable=true 只返回当前可用（会员卡宫格用） */
  getBenefits: (onlyAvailable) =>
    request('/mp/benefits', {
      data: {
        onlyAvailable: !!onlyAvailable,
      },
    }),
  getBenefit: (code) => request(`/mp/benefits/${code}`),
  /** 会员资格摘要：当前档 / 到期 / 剩余天数 / 当前方案 / 续费候选 */
  getMembership: () => request('/mp/membership'),
  /**
   * 会员码（60 秒有效）。**每次展示都要重新拉**，不要缓存：
   * 服务端签的是带过期时间的 HMAC，缓存下来的码到点就废，界面会显示一个扫不出来的图。
   */
  getMemberCode: () => request('/mp/member-code'),
  // ── 公告（设计稿 09·13） ──

  getAnnouncements: (category, limit) =>
    request('/mp/announcements', {
      data: {
        category: category || '',
        limit: limit || 20,
      },
    }),
  getAnnouncement: (annNo) => request(`/mp/announcements/${annNo}`),
  readAnnouncement: (annNo) =>
    request(`/mp/announcements/${annNo}/read`, {
      method: 'POST',
    }),
  // ── 课程与课件（设计稿 08·17·29） ──

  getCourseSessions: (courseType) =>
    request('/mp/course-sessions', {
      data: {
        courseType: courseType || '',
      },
    }),
  getCourseSession: (id) => request(`/mp/course-sessions/${id}`),
  enrollCourse: (id) =>
    request(`/mp/course-sessions/${id}/enroll`, {
      method: 'POST',
    }),
  saveChapterProgress: (chapterId, watchedSeconds) =>
    request(`/mp/course-chapters/${chapterId}/progress`, {
      method: 'POST',
      data: {
        watchedSeconds,
      },
    }),
  recordDownload: (materialId) =>
    request(`/mp/course-materials/${materialId}/download`, {
      method: 'POST',
    }),
  // ── 班级活动（设计稿 06） ──

  getActivities: () => request('/mp/activities'),
  signUpActivity: (activityNo) =>
    request('/mp/activities/signup', {
      method: 'POST',
      data: {
        activityNo,
      },
    }),
  // ── AI 诊断（设计稿 07·23·25） ──

  getDiagnosis: () => request('/mp/diagnosis'),
  getDiagnosisOptions: () => request('/mp/diagnosis/options'),
  /** 提交预约：带幂等键，弱网重复提交只受理一次（服务端另有在途唯一索引兜底） */
  createDiagnosisBooking: (payload, key) =>
    request('/mp/diagnosis/bookings', {
      method: 'POST',
      data: payload,
      headers: {
        'Idempotency-Key': key || idemKey('mpdiag'),
      },
    }),
  getDiagnosisBooking: (bookingNo) =>
    request(`/mp/diagnosis/bookings/${bookingNo}`),
  cancelDiagnosisBooking: (bookingNo, reason) =>
    request(`/mp/diagnosis/bookings/${bookingNo}/cancel`, {
      method: 'POST',
      data: {
        reason,
      },
    }),
  // ── 服务工单（设计稿 15·28） ──

  getTicketTypes: () => request('/mp/ticket-types'),
  getTickets: (status) =>
    request('/mp/tickets', {
      data: {
        status: status || '',
      },
    }),
  getTicket: (ticketNo) => request(`/mp/tickets/${ticketNo}`),
  /** 提交工单：带幂等键，避免弱网重复提交造出两张单（多余的人工工作量） */
  createTicket: (ticketType, description, attachments, key) =>
    request('/mp/tickets', {
      method: 'POST',
      data: {
        ticketType,
        description,
        attachments,
      },
      headers: {
        'Idempotency-Key': key || idemKey('mpticket'),
      },
    }),
  // ── 服务评价（设计稿 24） ──

  getReviewSubject: (targetType, targetRef) =>
    request('/mp/reviews', {
      data: {
        targetType,
        targetRef,
      },
    }),
  submitReview: (payload) =>
    request('/mp/reviews', {
      method: 'POST',
      data: payload,
    }),
  // ── 退款（设计稿 18·30） ──

  getRefundOptions: () => request('/mp/refunds/options'),
  /** 申请退款：带幂等键。订单进「退款中」+ 建审批单，真实打款归外部渠道 */
  applyRefund: (orderNo, reason, note, key) =>
    request('/mp/refunds', {
      method: 'POST',
      data: {
        orderNo,
        reason,
        note,
      },
      headers: {
        'Idempotency-Key': key || idemKey('mprefund'),
      },
    }),
  getRefund: (orderNo) => request(`/mp/refunds/${orderNo}`),
  /**
   * 确认管理台扫码登录（W9）：只上报票据，会员身份由服务端取自 JWT。
   * 返回 {confirmed, hasAccount, enabled, pendingApproval, adminHint}——
   * 只有 hasAccount ∧ enabled 才代表电脑那头真的能进去，否则是「待管理员批准」。
   *
   * 不带 Idempotency-Key：服务端 confirm 本身对「同票同人」幂等（重复确认返回同一结果），
   * 而票据本就是一次性凭据，再套一层幂等键只会多一个可能不一致的口径。
   */
  scanLoginConfirm: (ticket) =>
    request('/mp/scan-login/confirm', {
      method: 'POST',
      data: {
        ticket,
      },
    }),
}
