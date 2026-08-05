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
const api = require("../../api/mp");
const {
  captureScanTicket,
  getPendingScanTicket,
  clearPendingScanTicket,
  ensureLogin,
  isAuthGateError,
} = require("../../utils/auth");
const { toast, maskPhone } = require("../../utils/fmt");
const share = require("../../behaviors/share");

/** 建档时的占位昵称（后端 /mp/login 写死同一个值）：等于「用户还没填过」 */
const DEFAULT_NAME = "微信用户";

/** 各终局的标题与说明（stage 驱动单页多态，与 pages/training 同一套做法） */
const VIEW = {
  ok: {
    title: "已确认登录",
    hint: "请回到电脑继续操作，页面会自动进入管理台。本页可以关掉了。",
  },
  pending: {
    title: "已登记，等待批准",
    // 具体文案优先用服务端 adminHint（批准口径由服务端裁定），这里只兜底
    hint: "已为你登记后台账号，等待管理员批准后重新扫码即可登录。",
  },
  cancelled: {
    title: "已取消",
    // 不说「电脑上的登录已取消」——服务端没有取消动作，那张码只是没人用，等它自己过期
    hint: "本次没有确认登录。电脑上的二维码会在过期后自动失效，需要时重新扫一次即可。",
  },
};

const NO_TICKET = "没有识别到登录二维码。请在电脑的管理台登录页点「微信扫码登录」，再用微信扫一次。";

Page(share.withShare({
  data: {
    /** loading（校验票据与身份）/ confirm（等用户点确认）/ ok / pending / cancelled / error */
    stage: "loading",
    ticket: "",
    errMsg: "",
    /**
     * 失败态是否给「重试」按钮。
     * 只有**加载身份失败**（网络问题）才给——票据本身失效时按钮点一万次也不会成功，
     * 解法在电脑那头（刷新二维码），摆一个必然失败的按钮就是假出路。
     */
    canRetry: false,
    /** 当前微信身份（让用户看清是"用哪个号登录"，避免多微信混用时确认错人） */
    memberName: "",
    memberNo: "",
    avatarPath: "",
    /**
     * 昵称还是建档占位值（或空）——**确认登录的硬门禁**。
     * 门在这里而不在后端：后端只知道有人拿着有效票据确认，判断不了「这个人管理员认不认得出」。
     */
    isDefaultName: false,
    /** 有昵称但没头像：不阻断（头像取不到的路径真实存在，堵死就登不进来了），只给一个补设入口 */
    avatarMissing: false,
    /** 已绑手机号的脱敏尾号；空串 = 未绑定（此时才显示可选的绑定按钮） */
    phoneText: "",
    /** 完善资料弹层（头像 + 昵称一体，与登录页/我的页同一个组件） */
    profileOpen: false,
    confirming: false,
    title: "",
    hint: "",
  },

  onLoad(options) {
    // 票据优先取本次页面参数，退回 storage（冷启动被登录门禁弹走再回来时走的是后者）
    const ticket = captureScanTicket({ query: options || {} }) || getPendingScanTicket();
    if (!ticket) {
      this.setData({ stage: "error", errMsg: NO_TICKET, canRetry: false });
      return;
    }
    this.setData({ ticket });
    this.loadIdentity();
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
      await ensureLogin();
      const me = await api.getProfile();
      const name = (me && me.name) || "";
      const avatarPath = (me && me.avatarPath) || "";
      const isDefaultName = !name || name === DEFAULT_NAME;
      this.setData({
        stage: "confirm",
        memberName: name || DEFAULT_NAME,
        memberNo: (me && me.member_no) || "",
        avatarPath,
        isDefaultName,
        avatarMissing: !avatarPath,
        phoneText: maskPhone(me && me.phone),
        // 默认昵称：进页面直接把弹层摊开，别让用户自己找入口（他此刻的目标是登录，不是改资料）
        profileOpen: isDefaultName,
      });
    } catch (err) {
      if (isAuthGateError(err)) return; // 未同意协议：已跳登录页，登完会带票据回到本页
      // 身份拉不到就不摆确认按钮：点下去也只会失败，不如让他重试
      this.setData({ stage: "error", errMsg: err.message || "加载失败，请重试", canRetry: true });
    }
  },

  /** 重试：只重新拉身份，票据不变（票据没问题，问题在网络） */
  retry() {
    if (!this.data.canRetry) {
      toast("请回到电脑刷新二维码后重新扫码");
      return;
    }
    this.setData({ stage: "loading", errMsg: "" });
    this.loadIdentity();
  },

  // ── 资料采集（昵称+头像必填，手机号可选） ──

  openProfile() {
    this.setData({ profileOpen: true });
  },

  /**
   * 关闭弹层但没保存：**不放行**。门禁停在原处，主按钮仍是「填写昵称和头像」，
   * 用户随时可以再打开——没有死路，只是没有捷径。
   */
  closeProfile() {
    this.setData({ profileOpen: false });
  },

  /**
   * 保存成功：用组件回传的值就地更新确认卡（不再打一次 /mp/profile——刚写完的值就是它回传的）。
   * 只改了头像没填昵称时组件回传的 name 仍是占位值，门禁照样不放行：
   * 让管理员认出人的是昵称，头像只是辅助。
   */
  onProfileSaved(e) {
    const d = e && e.detail ? e.detail : {};
    const name = d.name || this.data.memberName;
    const avatarPath = d.avatarPath || this.data.avatarPath;
    this.setData({
      profileOpen: false,
      memberName: name || DEFAULT_NAME,
      avatarPath,
      isDefaultName: !name || name === DEFAULT_NAME,
      avatarMissing: !avatarPath,
    });
  },

  /**
   * 手机号绑定（可选）：微信规范明确禁止把 getPhoneNumber 当作使用前提，
   * 所以拒绝、失败、当前环境不支持——一律只提示，不影响确认登录。
   */
  async onPhone(e) {
    const code = e && e.detail ? e.detail.code : "";
    if (!code) {
      const errMsg = (e && e.detail && e.detail.errMsg) || "";
      if (errMsg.indexOf("deny") >= 0) return; // 用户主动取消：静默（这是他的正当选择）
      if (errMsg.indexOf("privacy") >= 0) {
        toast("需先同意《小程序隐私保护指引》才能绑定手机号");
        return;
      }
      toast("当前环境暂不支持手机号快速验证");
      return;
    }
    try {
      const r = await api.bindPhone(code);
      const phone = (r && r.phone) || "";
      this.setData({ phoneText: maskPhone(phone) });
      wx.showToast({ title: "手机号已绑定", icon: "success" });
    } catch (err) {
      // 后端文案已是人话（演示环境会明确说不支持），原样展示，不翻译成"绑定失败"
      toast(err.message);
    }
  },

  async doConfirm() {
    // 资料没填完不允许确认：这不只是"数据不全"——管理员批准时根本认不出申请人是谁
    if (this.data.isDefaultName) {
      toast("请先填写昵称，管理员才能认出是谁在申请");
      this.setData({ profileOpen: true });
      return;
    }
    if (this.data.confirming) return;
    this.setData({ confirming: true });
    try {
      const data = await api.scanLoginConfirm(this.data.ticket);
      clearPendingScanTicket(); // 已表态，别再把用户往本页送
      // 唯一可以说"电脑那头进去了"的条件：有后台账号且已启用
      const loggedIn = !!(data && data.hasAccount && data.enabled);
      const view = loggedIn ? VIEW.ok : VIEW.pending;
      this.setData({
        stage: loggedIn ? "ok" : "pending",
        title: view.title,
        hint: (data && data.adminHint) || view.hint,
      });
    } catch (err) {
      // 票据过期 / 已被另一个微信号确认 / 已完成登录：服务端文案已是人话，原样展示。
      // 票据一并清掉——这三种情形都得回电脑重新出码，留着只会让用户下次登录又被送回本页。
      clearPendingScanTicket();
      this.setData({
        stage: "error",
        errMsg: err.message || "确认失败，请回到电脑刷新二维码后重试",
        canRetry: false,
      });
    } finally {
      this.setData({ confirming: false });
    }
  },

  cancel() {
    clearPendingScanTicket();
    this.setData({ stage: "cancelled", title: VIEW.cancelled.title, hint: VIEW.cancelled.hint });
  },

  goHome() {
    clearPendingScanTicket();
    wx.reLaunch({ url: "/pages/index/index" });
  },
}));
