/**
 * 登录页：品牌字标 + 协议勾选 + 微信一键登录。
 *
 * 这是新用户进入系统的唯一入口——未同意协议前不允许静默建档（合规硬要求）。
 * 登录成功后写入协议同意标记，后续 token 过期可静默重登，不再打扰用户。
 */
const api = require("../../api/mp");
const {
  captureInviteCode,
  captureScanTicket,
  getPendingScanTicket,
  ensureLogin,
  setConsent,
  hasConsent,
  NICK_GUIDE_KEY,
} = require("../../utils/auth");
const { maskPhone, toast } = require("../../utils/fmt");
const { navVars } = require("../../utils/layout");

Page({
  data: {
    navPad: "",
    agreed: false,
    shaking: false, // 未勾选时点登录 → 勾选区抖动提示
    logging: false,
    // 登录成功后的完善资料弹层（头像+昵称），只对新建档用户弹一次
    profileOpen: false,
    profileName: "",
    profileAvatar: "",
    profilePhoneText: "",
    profilePhoneRequired: false,
    profileNameRequired: false,
  },

  onLoad(options) {
    // 自定义导航：顶部安全区由页面自己让（见 utils/layout 注释）
    this.setData(navVars());
    // 分享链接/小程序码可能直达登录页，邀请码同样要在这里捕获，否则裂变归因丢失
    captureInviteCode({ query: options || {} });
    // 管理台扫码登录票据：门禁把用户从扫码页弹到这里时参数会丢，故两处都捕获一遍
    captureScanTicket({ query: options || {} });
    // 退出登录后再次登录的老用户：同意状态是真实存在的历史事实，如实回显，不必重复勾选。
    // 新用户（无同意记录）默认不勾选——不做默认勾选那种诱导式设计。
    if (hasConsent()) this.setData({ agreed: true });
  },

  onUnload() {
    if (this.shakeTimer) clearTimeout(this.shakeTimer);
  },

  toggleAgree() {
    this.setData({ agreed: !this.data.agreed, shaking: false });
  },

  openAgreement(e) {
    wx.navigateTo({ url: `/pages/agreement/index?type=${e.currentTarget.dataset.type}` });
  },

  /** 未勾选协议：toast + 抖动，不发起任何网络请求 */
  warnAgree() {
    toast("请先阅读并勾选同意协议");
    if (this.shakeTimer) clearTimeout(this.shakeTimer);
    this.setData({ shaking: true });
    this.shakeTimer = setTimeout(() => this.setData({ shaking: false }), 500);
  },

  async doLogin() {
    if (!this.data.agreed) {
      this.warnAgree();
      return;
    }
    if (this.data.logging) return;
    this.setData({ logging: true });
    try {
      // skipConsentGate：此刻同意标记尚未写入，不跳过门禁会被自己弹回登录页（死循环）
      await ensureLogin({ skipConsentGate: true });
      setConsent();
      await this.afterLogin();
    } catch (e) {
      toast(e.message || "登录失败，请稍后重试");
    } finally {
      this.setData({ logging: false });
    }
  },

  /**
   * 登录成功后的落地：先核验手机号。未绑定时必须在本页完成微信手机号验证，
   * 再进入首页；头像昵称仍可在同一张表里顺手补齐，也可后续修改。
   */
  async afterLogin() {
    try {
      const profile = await api.getProfile();
      const phoneText = maskPhone(profile && profile.phone);
      const phoneRequired = !phoneText;
      const profileName = (profile && profile.name) || "";
      const nameRequired = !profileName || profileName === "微信用户";
      const shouldGuideProfile = !wx.getStorageSync(NICK_GUIDE_KEY)
        && profile
        && !profile.avatarPath;
      if (phoneRequired || nameRequired || shouldGuideProfile) {
        wx.setStorageSync(NICK_GUIDE_KEY, 1); // 无论用户如何选择，引导只出现一次
        this.setData({
          profileOpen: true,
          profileName,
          profileAvatar: (profile && profile.avatarPath) || "",
          profilePhoneText: phoneText,
          profilePhoneRequired: phoneRequired,
          profileNameRequired: nameRequired,
        });
        return;
      }
    } catch (e) {
      // 手机号是注册门禁，资料查询失败不能 fail-open 直接进入。
      throw e;
    }
    this.enterHome();
  },

  onPhoneBound(e) {
    const phoneText = e && e.detail ? e.detail.phoneText : "";
    this.setData({ profilePhoneText: phoneText || this.data.profilePhoneText });
  },

  /** 资料保存完成；手机号必填场景再次做防御校验，避免组件事件漂移时绕过门禁。 */
  onProfileSaved(e) {
    const phoneText = (e && e.detail && e.detail.phoneText) || this.data.profilePhoneText;
    const name = (e && e.detail && e.detail.name) || this.data.profileName;
    if (this.data.profilePhoneRequired && !phoneText) {
      toast("请先验证手机号，完成注册");
      return;
    }
    if (this.data.profileNameRequired && (!name || name === "微信用户")) {
      toast("请填写昵称，完成注册");
      return;
    }
    this.setData({ profileOpen: false, profileName: name, profilePhoneText: phoneText });
    this.enterHome();
  },
  closeProfile() {
    if (this.data.profilePhoneRequired && !this.data.profilePhoneText) {
      toast("完成注册需要验证手机号");
      return;
    }
    if (this.data.profileNameRequired && (!this.data.profileName || this.data.profileName === "微信用户")) {
      toast("完成注册需要填写昵称");
      return;
    }
    this.setData({ profileOpen: false });
    this.enterHome();
  },

  /**
   * 登录后的落地页。
   *
   * 扫码登录（管理台）是唯一的例外分支：用户是为了「确认电脑登录」才打开小程序的，
   * 把他丢进首页等于让他自己再找一遍那个入口——而票据 5 分钟就过期，他找不回来。
   * 票据在 app.onLaunch 就存下了（页面栈被门禁换掉时参数会丢），此刻直接送回扫码页。
   */
  enterHome() {
    const ticket = getPendingScanTicket();
    if (ticket) {
      wx.reLaunch({ url: `/pages/scan-login/index?ticket=${encodeURIComponent(ticket)}` });
      return;
    }
    wx.reLaunch({ url: "/pages/index/index" });
  },
});
