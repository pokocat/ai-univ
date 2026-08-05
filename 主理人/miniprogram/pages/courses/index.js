/** 课程与直播：按本人 openid 换 living_code，跳转企业微信官方直播小程序。 */
const api = require("../../api/mp");
const { isAuthGateError } = require("../../utils/auth");
const { d16, toast } = require("../../utils/fmt");
const share = require("../../behaviors/share");

/**
 * 排课状态 → 图标 token + 图标底纹修饰类 + 状态文字色类。
 * 下发类名与 token 名，不下发色值：色值散进 JS 就绕开了 app.wxss 的调色板。
 */
const STATUS = {
  已排期: { icon: "accent", bg: "", text: "t-primary" },
  直播中: { icon: "warn", bg: "li-icon--warn", text: "t-amber" },
  已结束: { icon: "t3", bg: "li-icon--mute", text: "t-muted" },
};
const STATUS_FALLBACK = STATUS.已结束;

Page(share.withShare({
  data: {
    loadError: "",
    retrying: false,
    loaded: false,
    courses: [],
  },

  onShow() {
    this.load();
  },

  async onPullDownRefresh() {
    await this.load();
    wx.stopPullDownRefresh();
  },

  /** 错误条重试入口 */
  async retryLoad() {
    if (this.data.retrying) return;
    this.setData({ retrying: true });
    await this.load();
    this.setData({ retrying: false });
  },

  async load() {
    if (this.data.loadError) this.setData({ loadError: "" });
    try {
      const list = await api.getCourses();
      const courses = (list || []).map(c => {
        const st = STATUS[c.status] || STATUS_FALLBACK;
        return {
          id: c.id,
          title: c.title,
          status: c.status,
          iconColor: st.icon,
          iconClass: st.bg,
          statusClass: st.text,
          live: c.status === "直播中",
          canWatch: Boolean(c.can_watch),
          actionText: c.status === "已结束" ? "观看回放" : c.status === "待开播" ? "查看预约" : "进入直播",
          metaText: `${c.speaker ? `${c.speaker} · ` : ""}${d16(c.scheduled_at)}`,
        };
      });
      this.setData({ loaded: true, courses });
    } catch (e) {
      if (isAuthGateError(e)) return; // 未同意协议：已跳登录页，不再打扰
      this.setData({ loadError: e.message, retrying: false });
      toast(e.message);
    }
  },

  async enterCourse(e) {
    const id = Number(e.currentTarget.dataset.id);
    const canWatch = e.currentTarget.dataset.canWatch === true || e.currentTarget.dataset.canWatch === "true";
    if (!canWatch || !id) {
      wx.showToast({ title: "直播入口尚未开放", icon: "none" });
      return;
    }
    try {
      wx.showLoading({ title: "正在进入" });
      const entry = await api.getCourseWatchCode(id);
      wx.hideLoading();
      if (entry.channel === "mock") {
        wx.showModal({
          title: "演示直播",
          content: `已生成演示观看凭证：${entry.replay ? "回放" : "直播"}入口可用。真实环境将直接打开企微直播。`,
          showCancel: false,
        });
        return;
      }
      wx.navigateToMiniProgram({
        appId: entry.appId,
        path: entry.path,
        fail: err => {
          console.warn("[courses] navigate live failed", err);
          toast("未能打开企微直播，请稍后重试");
        },
      });
    } catch (e) {
      wx.hideLoading();
      toast(e.message || "直播入口获取失败");
    }
  },
}));
