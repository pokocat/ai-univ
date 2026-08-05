/**
 * 会员码（设计稿 21）。
 *
 * 码图由服务端渲染成 PNG data-URI 一并返回（小程序里没有二维码库，
 * 而 `<image src>` 也发不出 Authorization 头去取一个鉴权的图）。
 *
 * **60 秒到点必须重新拉**，不能只在本地倒计时到 0 就停：码是带过期时间的签名，
 * 停在那里的图会变成一个扫不出来的方块，而用户看不出为什么。
 * 页面隐藏时停掉定时器——后台标签页里每秒 setData 是纯耗电。
 */
const api = require("../../api/mp");
const { toast } = require("../../utils/fmt");
const { navVars } = require("../../utils/layout");
const { isAuthGateError } = require("../../utils/auth");
const log = require("../../utils/log");

const SCENES = [
  { icon: "calendar", title: "活动签到", desc: "线下活动快速签到" },
  { icon: "shield", title: "服务核验", desc: "专属服务身份核验" },
  { icon: "members", title: "闭门会入场", desc: "高端活动通行凭证" },
];

Page({
  data: {
    navPad: "",
    err: "",
    retrying: false,
    me: null,
    tier: "",
    identityLabel: "",
    levelText: "",
    active: false,
    qrPath: "",
    ttl: 60,
    left: 0,
    scenes: SCENES,
  },

  onLoad() {
    this.setData(navVars());
  },

  onShow() {
    this.loadProfile();
    this.refresh();
    this.startTick();
  },

  onHide() {
    this.stopTick();
  },

  onUnload() {
    this.stopTick();
  },

  startTick() {
    this.stopTick();
    this.timer = setInterval(() => {
      const left = this.data.left - 1;
      if (left <= 0) {
        // 到点自动换码：留一个过期的图在屏幕上，用户扫不出来又不知道为什么
        this.refresh();
        return;
      }
      this.setData({ left });
    }, 1000);
  },

  stopTick() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  async loadProfile() {
    try {
      const [me, membership, growth] = await Promise.all([
        api.getMe(),
        api.getMembership(),
        api.getGrowth(1),
      ]);
      const identity = (me && me.identity) || {};
      this.setData({
        me,
        tier: (membership && membership.tier) || "",
        active: !!(membership && membership.active),
        identityLabel: identity.base_identity || identity.identity || "会员",
        levelText: growth && growth.level != null
          ? "LV." + growth.level + " " + (growth.levelName || "")
          : "",
      });
    } catch (e) {
      if (isAuthGateError(e)) return;
      log.warn("member-code profile", e.message);
    }
  },

  async refresh() {
    this.setData({ retrying: true });
    try {
      const data = await api.getMemberCode();
      this.setData({
        err: "",
        retrying: false,
        qrPath: data.qrDataUri || "",
        ttl: data.ttlSeconds || 60,
        left: data.ttlSeconds || 60,
      });
      if (!data.qrDataUri) {
        // 服务端画图失败：如实说明，并给出可照做的替代（报编号）
        this.setData({ err: "二维码生成失败，可让工作人员按会员编号手工核验" });
      }
    } catch (e) {
      if (isAuthGateError(e)) return;
      log.error("member-code refresh", e.message);
      this.setData({ retrying: false, err: e.message, qrPath: "" });
    }
  },

  copyNo() {
    const no = this.data.me && this.data.me.member_no;
    if (!no) return;
    wx.setClipboardData({ data: no, success: () => toast("会员编号已复制") });
  },

  go(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    if (/^\/pages\/(index|group|member|notifications|mine)\/index$/.test(url)) wx.switchTab({ url });
    else wx.navigateTo({ url, fail: () => toast("页面暂不可用") });
  },
});
