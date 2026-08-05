/**
 * 隐私授权弹层（半屏）。挂在会触发隐私接口的页面上：
 * 「我的」（昵称填写 input type=nickname / 手机号 getPhoneNumber）、
 * 「邀请」「课程」（wx.setClipboardData 复制）、首页（购买链路）。
 *
 * 同意必须由 <button open-type="agreePrivacyAuthorization"> 触发——
 * 这是微信规定的唯一合法同意入口，普通 tap 不算数。
 */
const privacy = require("../../utils/privacy");

Component({
  data: { visible: false },

  lifetimes: {
    attached() {
      // 保存函数引用，detached 时按引用注销
      this._show = () => this.setData({ visible: true });
      privacy.bind(this._show);
    },
    detached() {
      privacy.unbind(this._show);
    },
  },

  methods: {
    /** 打开微信官方《小程序隐私保护指引》 */
    openContract() {
      if (!wx.openPrivacyContract) {
        wx.showToast({ title: "当前微信版本不支持查看，请升级微信", icon: "none" });
        return;
      }
      wx.openPrivacyContract({
        fail: () => wx.showToast({ title: "打开失败，请稍后重试", icon: "none" }),
      });
    },
    onDisagree() {
      this.setData({ visible: false });
      privacy.settle({ event: "disagree" });
    },
    onAgree() {
      this.setData({ visible: false });
      // buttonId 必须与 wxml 上按钮的 id 一致，微信据此校验同意来源
      privacy.settle({ event: "agree", buttonId: "privacy-agree-btn" });
    },
    noop() {},
  },
});
