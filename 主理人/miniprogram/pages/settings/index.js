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
const api = require("../../api/mp");
// 退出登录留在「我的」页（用户已熟悉的位置），本页不重复放置
const { isAuthGateError, ENV, logout, LOGIN_PAGE } = require("../../utils/auth");
const { toast } = require("../../utils/fmt");
const env = require("../../utils/env");
const subscribe = require("../../utils/subscribe");
const customerService = require("../../utils/customer-service");

/** 环境标签：体验版/开发版把环境显出来，便于用户报障时说清自己用的是哪个包 */
const ENV_LABEL = { develop: "开发版", trial: "体验版", release: "" };

/** 连点版本号开出后端环境切换面板的次数 */
const ENV_GESTURE_TAPS = 7;

Page({
  data: {
    version: "",
    memberNo: "",
    hasPhone: false,
    phoneText: "",
    notificationTemplates: [],
    notifyConfiguredCount: 0,
    subscribeBusy: "",
    /** 注销确认弹层 */
    delOpen: false,
    delReason: "",
    delSubmitting: false,
    /** 已提交过、仍在处理中的注销工单号 */
    pendingTicket: "",
    // ── 后端环境切换（仅非正式版；连点版本号开出） ──
    /** 是否显式切过环境：切过就常驻提示条，免得忘了自己还连在测试后端上 */
    envOverridden: false,
    envLabel: "",
    envBase: "",
    envOpen: false,
    envList: [],
    envPick: "",
    lanInput: "",
  },

  onLoad() {
    const acc = wx.getAccountInfoSync ? wx.getAccountInfoSync().miniProgram : {};
    const envLabel = ENV_LABEL[ENV] || "";
    this.setData({
      version: `${acc.version || "开发中"}${envLabel ? ` · ${envLabel}` : ""}`,
    });
    this.envTaps = 0;
    this.refreshEnv();
  },

  refreshEnv() {
    const cur = env.current();
    this.setData({
      envOverridden: env.isOverridden(),
      envLabel: cur.label,
      envBase: env.base(),
    });
  },

  onShow() {
    this.load();
  },

  async load() {
    try {
      const [profile, notificationData] = await Promise.all([
        api.getProfile(),
        subscribe.prefetch(true),
      ]);
      this.setData({
        memberNo: profile.member_no || "",
        hasPhone: !!profile.phone,
        // 手机号脱敏展示：设置页不是核对手机号的地方，没必要把完整号码摊在屏幕上
        phoneText: profile.phone ? String(profile.phone).replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2") : "未绑定",
        notifyConfiguredCount: notificationData.configuredCount || 0,
        notificationTemplates: (notificationData.templates || []).map(item => ({
          key: item.key,
          title: item.title,
          description: item.description,
          configured: !!item.configured,
          remaining: item.remaining || 0,
          statusText: !item.configured
            ? "待后台配置"
            : (item.remaining > 0 ? `已授权 ${item.remaining} 次` : "点击开启"),
        })),
      });
    } catch (e) {
      if (isAuthGateError(e)) return;
      toast(e.message);
    }
  },

  /** 每类单独由用户点击授权，避免一次把六类提醒全弹出来造成认知负担。 */
  async enableNotification(e) {
    const key = e.currentTarget.dataset.key;
    const item = this.data.notificationTemplates.find(row => row.key === key);
    if (!item || !item.configured || this.data.subscribeBusy) return;
    // request() 在返回 Promise 前就会调用 wx.requestSubscribeMessage，保持在 tap 手势内。
    const pending = subscribe.request([key]);
    this.setData({ subscribeBusy: key });
    const result = await pending;
    this.setData({ subscribeBusy: "" });
    if (result.accepted > 0) {
      toast("微信提醒已开启");
      await this.load();
    } else {
      toast("未开启微信提醒，站内消息仍会保留");
    }
  },

  openAgreement(e) {
    wx.navigateTo({ url: `/pages/agreement/index?type=${e.currentTarget.dataset.type}` });
  },

  /** 微信官方《小程序隐私保护指引》（与我们自己的《隐私政策》是两份，都要能看到） */
  openPrivacyContract() {
    if (!wx.openPrivacyContract) {
      toast("当前微信版本不支持查看，请升级微信");
      return;
    }
    wx.openPrivacyContract({ fail: () => toast("打开失败，请稍后重试") });
  },

  openCustomerService() {
    customerService.open();
  },

  /**
   * 清除本地缓存：只清接口数据缓存，**不动登录态与协议同意标记**——
   * 全量 clearStorage 会把用户踢回登录页并要求重新勾协议，对"页面数据不对，清一下试试"
   * 这个诉求是过度反应。
   */
  async clearCache() {
    const r = await wx.showModal({
      title: "清除缓存",
      content: "将清除本地缓存的页面数据，不会退出登录。",
      confirmText: "清除",
    });
    if (!r.confirm) return;
    const app = getApp();
    app.globalData.payConfig = null;
    subscribe.clear();
    wx.showToast({ title: "已清除", icon: "success" });
  },

  // ── 后端环境切换（联调用） ──

  /**
   * 连点版本号 7 次开出环境面板。
   * 为什么藏在手势后而不是直接摆一行：审核版本报的 envVersion 也是 trial，
   * 一个显眼的「后端环境」选择器出现在审核员面前不合适。
   * 正式版连手势也不生效（env.isSwitchable 兜底）。
   */
  tapVersion() {
    if (!env.isSwitchable()) return;
    this.envTaps += 1;
    if (this.envTaps < ENV_GESTURE_TAPS) {
      // 最后两下给个反馈，否则用户不知道自己在接近什么
      const left = ENV_GESTURE_TAPS - this.envTaps;
      if (left <= 2) toast(`再点 ${left} 次打开环境切换`);
      return;
    }
    this.envTaps = 0;
    this.openEnv();
  },

  openEnv() {
    const cur = env.currentKey();
    this.setData({
      envOpen: true,
      envPick: cur,
      lanInput: wx.getStorageSync(env.LAN_BASE_KEY) || "",
      envList: env.ENV_LIST.map(e => ({
        key: e.key,
        label: e.label,
        hint: e.hint,
        editable: !!e.editable,
        base: e.base,
        isDefault: e.key === env.defaultKey(),
      })),
    });
  },
  closeEnv() {
    this.setData({ envOpen: false });
  },
  pickEnv(e) {
    this.setData({ envPick: e.currentTarget.dataset.key });
  },
  onLanInput(e) {
    this.setData({ lanInput: e.detail.value });
  },

  /**
   * 应用环境切换：必须清掉登录态与全局缓存——token 是**上一个后端**签发的，
   * 换库之后 memberNo 也对不上；payConfig / inviteCode 同理属于旧环境。
   * 不清的话表现为一堆莫名其妙的 4030 和错乱数据，比直接要求重新登录难查得多。
   */
  async applyEnv() {
    try {
      const to = env.switchTo(this.data.envPick, this.data.lanInput);
      subscribe.clear();
      logout();
      const app = getApp();
      app.globalData.payConfig = null;
      app.globalData.inviteCode = null;
      this.setData({ envOpen: false });
      this.refreshEnv();
      await wx.showModal({
        title: "已切换环境",
        content: `当前后端：${to}\n登录态已清除，请重新登录。`,
        showCancel: false,
        confirmText: "去登录",
      });
      wx.reLaunch({ url: LOGIN_PAGE });
    } catch (err) {
      toast(err.message);
    }
  },

  /** 恢复默认档（模拟器→本地、真机→测试） */
  resetEnv() {
    env.reset();
    subscribe.clear();
    this.setData({ envPick: env.currentKey(), lanInput: wx.getStorageSync(env.LAN_BASE_KEY) || "" });
    this.refreshEnv();
    toast(`已恢复默认：${env.current().label}`);
  },

  copyEnvBase() {
    if (this.data.envBase) wx.setClipboardData({ data: this.data.envBase });
  },

  // ── 账号注销 ──
  openDelete() {
    this.setData({ delOpen: true, delReason: "" });
  },
  closeDelete() {
    this.setData({ delOpen: false });
  },
  onReasonInput(e) {
    this.setData({ delReason: e.detail.value });
  },

  async submitDelete() {
    if (this.data.delSubmitting) return;
    const r = await wx.showModal({
      title: "确认提交注销申请",
      content: "提交后运营会在 1 个工作日内核验身份并处理。已购买的会员权益将同时失效，且不可恢复。",
      confirmText: "确认提交",
      // wx.showModal 是原生弹窗，只吃字面色值——保持与 app.wxss 的 --danger 一致
      confirmColor: "#B3261E",
    });
    if (!r.confirm) return;
    this.setData({ delSubmitting: true });
    try {
      const res = await api.requestAccountDeletion(this.data.delReason);
      this.setData({ delOpen: false, pendingTicket: res.ticket_no });
      wx.showModal({
        title: res.duplicated ? "已有处理中的申请" : "申请已提交",
        content: `工单号 ${res.ticket_no}。运营核验身份后会依法删除或匿名化你的个人信息（法律法规要求保留的交易记录除外）。如需撤回，请联系在线客服。`,
        showCancel: false,
        confirmText: "知道了",
      });
    } catch (e) {
      toast(e.message);
    } finally {
      this.setData({ delSubmitting: false });
    }
  },

  copyMemberNo() {
    if (!this.data.memberNo) return;
    wx.setClipboardData({ data: this.data.memberNo });
  },
});
