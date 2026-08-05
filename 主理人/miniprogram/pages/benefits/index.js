/**
 * 全部权益（设计稿 22）。
 *
 * 与设计稿的差别都在「不编数字」上：
 *  · 设计稿的「18 项全部可用 / 累计已省 ¥3,560」——后者没有事实源（中台不算省了多少钱），
 *    换成「当前可用 / 升级后解锁」两个真实计数；
 *  · 「本周推荐权益」是运营内容位，目前没有配置入口，故不渲染——
 *    摆两张写死的推荐卡等于把设计稿的示例数据当成了功能；
 *  · 锁定的权益**照常列出**并说明「需要哪个档」，而不是藏起来：
 *    藏起来会让人不知道升级能换到什么。
 */
const api = require("../../api/mp");
const { toast } = require("../../utils/fmt");
const { navVars } = require("../../utils/layout");
const { isAuthGateError } = require("../../utils/auth");
const log = require("../../utils/log");

const STEPS = [
  { icon: "grid9", title: "选择权益", desc: "浏览并选择需要的权益" },
  { icon: "calendar", title: "预约或使用", desc: "按提示预约或直接使用" },
  { icon: "award", title: "获得服务", desc: "资源、课程与陪跑支持" },
];

Page({
  data: {
    navPad: "",
    loading: true,
    err: "",
    retrying: false,
    benefits: [],
    availableCount: 0,
    lockedCount: 0,
    tier: "",
    active: false,
    levelText: "—",
    levelName: "",
    steps: STEPS,
  },

  onLoad() {
    this.setData(navVars());
  },

  onShow() {
    this.load();
  },

  async load() {
    this.setData({ retrying: true });
    try {
      const [benefits, membership, growth] = await Promise.all([
        api.getBenefits(false),
        api.getMembership(),
        api.getGrowth(1),
      ]);
      const list = (benefits || []).map(b => Object.assign({}, b, {
        // 有配额的权益显示真实余量；口径未接入时服务端给 quotaHint，如实转述而不是显示「已用 0」
        quotaText: b.quotaTotal == null
          ? ""
          : (b.quotaLeft == null
              ? b.quotaHint || "余量待核对"
              : "本月剩 " + b.quotaLeft + "/" + b.quotaTotal + " 次"),
      }));
      this.setData({
        loading: false,
        err: "",
        retrying: false,
        benefits: list,
        availableCount: list.filter(b => b.available).length,
        lockedCount: list.filter(b => !b.available).length,
        tier: (membership && membership.tier) || "",
        active: !!(membership && membership.active),
        levelText: growth && growth.level != null ? "LV." + growth.level : "—",
        levelName: (growth && growth.levelName) || "",
      });
    } catch (e) {
      if (isAuthGateError(e)) return;
      log.error("benefits load", e.message);
      this.setData({ loading: false, retrying: false, err: e.message });
    }
  },

  openBenefit(e) {
    const { code, page, available, reason } = e.currentTarget.dataset;
    if (available === false || available === "false") {
      // 锁定的权益点了就说清楚差什么，不静默无反应（无反应会被当成按钮坏了）
      wx.showModal({
        title: "该权益尚未解锁",
        content: reason || "升级会员档位后即可使用",
        confirmText: "查看方案",
        success: r => {
          if (r.confirm) wx.navigateTo({ url: "/pages/subscribe/index" });
        },
      });
      return;
    }
    const url = page && page !== "/pages/benefit-detail/index"
      ? page
      : "/pages/benefit-detail/index?code=" + code;
    if (/^\/pages\/(index|group|member|notifications|mine)\/index$/.test(url)) wx.switchTab({ url });
    else wx.navigateTo({ url, fail: () => toast("页面暂不可用") });
  },

  go(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    if (/^\/pages\/(index|group|member|notifications|mine)\/index$/.test(url)) wx.switchTab({ url });
    else wx.navigateTo({ url, fail: () => toast("页面暂不可用") });
  },
});
