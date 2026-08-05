/**
 * 权益详情（设计稿 26）。
 *
 * 详情行来自 `membership_benefit.detail`（运营可维护的 JSONB），不是写死在小程序里——
 * 写死的那份要过审才能更新，运营改一句权益说明得等一次发版。
 *
 * 「最近使用记录」有真实来源就显示时间，没有就显示「暂无」并说明它什么时候会有；
 * 「使用流程」只在该权益真的有流程时渲染（目前只有 AI 诊断），
 * 给别的权益也摆三步流程等于凭空发明一套不存在的办事路径。
 */
const api = require("../../api/mp");
const { toast, d10 } = require("../../utils/fmt");
const { navVars } = require("../../utils/layout");
const { isAuthGateError } = require("../../utils/auth");
const log = require("../../utils/log");

/** 有真实办事路径的权益才配流程；其余留空 */
const FLOWS = {
  ai_diagnosis: [
    { icon: "edit", title: "提交需求", desc: "填写社群与业务信息" },
    { icon: "sparkle", title: "智能匹配", desc: "匹配服务老师与排期" },
    { icon: "chart", title: "获取报告", desc: "拿到诊断建议与方案" },
  ],
};

Page({
  data: {
    navPad: "",
    loading: true,
    err: "",
    retrying: false,
    code: "",
    benefit: null,
    detail: [],
    flow: [],
    quotaLeftText: "不限",
    quotaUsedText: "无次数限制",
    lastUsedText: "暂无",
    lastUsedHint: "使用后显示记录",
    ctaText: "立即使用",
  },

  onLoad(options) {
    this.setData(Object.assign({ code: (options && options.code) || "ai_diagnosis" }, navVars()));
  },

  onShow() {
    this.load();
  },

  async load() {
    this.setData({ retrying: true });
    try {
      const benefit = await api.getBenefit(this.data.code);
      const state = { loading: false, err: "", retrying: false, benefit };
      state.detail = Array.isArray(benefit.detail) ? benefit.detail : [];
      state.flow = FLOWS[this.data.code] || [];
      if (benefit.quotaTotal == null) {
        state.quotaLeftText = "不限";
        state.quotaUsedText = "无次数限制";
      } else if (benefit.quotaLeft == null) {
        // 服务端说这项权益的用量口径还没接入——如实转述，不显示一个假的「已用 0」
        state.quotaLeftText = "—";
        state.quotaUsedText = benefit.quotaHint || "余量以人工核对为准";
      } else {
        state.quotaLeftText = benefit.quotaLeft + " 次";
        state.quotaUsedText = "已用 " + benefit.quotaUsed + " / " + benefit.quotaTotal;
      }
      // 最近使用记录：目前只有 AI 诊断能给出真实时间（预约记录）
      if (this.data.code === "ai_diagnosis") {
        const diag = await api.getDiagnosis().catch(() => null);
        const last = diag && diag.bookings && diag.bookings[0];
        if (last) {
          state.lastUsedText = d10(last.created_at);
          state.lastUsedHint = last.status;
        }
        state.ctaText = benefit.available ? "预约诊断" : "查看会员方案";
      } else {
        state.lastUsedText = "暂无";
        state.lastUsedHint = "本权益暂未接入使用记录";
        state.ctaText = benefit.available
          ? (benefit.action_page ? "立即使用" : "联系服务老师")
          : "查看会员方案";
      }
      this.setData(state);
    } catch (e) {
      if (isAuthGateError(e)) return;
      log.error("benefit detail load", e.message);
      this.setData({ loading: false, retrying: false, err: e.message, benefit: null });
    }
  },

  use() {
    const b = this.data.benefit;
    if (!b) return;
    if (!b.available) {
      wx.navigateTo({ url: "/pages/subscribe/index" });
      return;
    }
    if (this.data.code === "ai_diagnosis") {
      wx.navigateTo({ url: "/pages/diagnosis-booking/index" });
      return;
    }
    if (b.action_page && b.action_page !== "/pages/benefit-detail/index") {
      const url = b.action_page;
      if (/^\/pages\/(index|group|member|notifications|mine)\/index$/.test(url)) wx.switchTab({ url });
      else wx.navigateTo({ url, fail: () => toast("页面暂不可用") });
      return;
    }
    // 没有落地页的权益（资源库/闭门会）走人工：如实把人送到服务老师那里
    wx.navigateTo({ url: "/pages/advisor/index" });
  },

  go(e) {
    const url = e.currentTarget.dataset.url;
    if (url) wx.navigateTo({ url, fail: () => toast("页面暂不可用") });
  },
});
