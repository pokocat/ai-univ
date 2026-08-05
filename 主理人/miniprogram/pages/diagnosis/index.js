/**
 * AI 诊断（设计稿 07）。
 *
 * **报告不是服务端算出来的**（见 DiagnosisService 类注释）：它由服务老师结合数据出具后回填。
 * 所以这一页有报告就显示真实评分与建议，没有报告就如实说明它是怎么来的——
 * 绝不显示一个 0 分的空壳报告，那会让人以为系统真的评估过他。
 *
 * 维度环的百分比来自报告里的 metrics；「续费概率」这类带 % 的值原样解析，
 * 拿不到数值的维度不画环（画一个 0% 的环等于说「你这项是 0 分」）。
 */
const api = require("../../api/mp");
const { toast, d16 } = require("../../utils/fmt");
const { navVars } = require("../../utils/layout");
const { isAuthGateError } = require("../../utils/auth");
const log = require("../../utils/log");

const RING_COLORS = ["signal-600", "signal", "pulse", "pulse-300"];
const LEVEL_TAG = { 高: "red", 中等: "amber", 中: "amber", 低: "green", 优先: "pink", 建议: "blue" };

Page({
  data: {
    navPad: "",
    tab: "report",
    loading: true,
    err: "",
    retrying: false,
    benefit: null,
    quotaTitle: "",
    quotaHint: "",
    report: null,
    reportAt: "",
    metrics: [],
    issues: [],
    advices: [],
    pending: null,
    pendingAt: "",
    bookings: [],
    ctaText: "预约 AI 诊断",
  },

  onLoad() {
    this.setData(navVars());
  },

  onShow() {
    this.load();
  },

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab });
  },

  async load() {
    this.setData({ retrying: true });
    try {
      const d = await api.getDiagnosis();
      const benefit = d.benefit || {};
      const report = d.report;
      const pending = d.pending;
      this.setData({
        loading: false,
        err: "",
        retrying: false,
        benefit,
        quotaTitle: this.quotaTitle(benefit),
        quotaHint: benefit.available
          ? (benefit.status_hint || "提交后 2 个工作日内反馈")
          : (benefit.lockReason || "升级会员后可使用"),
        report,
        reportAt: d16(report && report.diagnosed_at),
        metrics: this.buildMetrics(report),
        issues: ((report && report.issues) || []).map(i => ({
          text: i.text || i.title || "",
          level: i.level || "",
          tagColor: LEVEL_TAG[i.level] || "amber",
        })),
        advices: ((report && report.advices) || []).map(a => ({
          title: a.title || "",
          desc: a.desc || "",
          icon: a.icon || "star2",
          level: a.level || "",
          tagColor: LEVEL_TAG[a.level] || "blue",
        })),
        pending,
        pendingAt: d16(pending && pending.created_at),
        bookings: (d.bookings || []).map(b => ({
          booking_no: b.booking_no,
          status: b.status,
          advisor_name: b.advisor_name,
          typeText: Array.isArray(b.diagnosis_types) ? b.diagnosis_types.join(" · ") : "AI 诊断",
          timeText: d16(b.created_at),
        })),
        ctaText: pending
          ? "查看当前诊断进度"
          : (benefit.available ? "预约 AI 诊断" : "查看会员方案"),
      });
    } catch (e) {
      if (isAuthGateError(e)) return;
      log.error("diagnosis load", e.message);
      this.setData({ loading: false, retrying: false, err: e.message });
    }
  },

  quotaTitle(benefit) {
    if (!benefit || benefit.quotaTotal == null) return "AI 诊断权益";
    if (benefit.quotaLeft == null) return "本月余量待人工核对";
    return "本月剩余 " + benefit.quotaLeft + " / " + benefit.quotaTotal + " 次";
  },

  /** 维度环：解析不出数值的维度**不画环**，避免把「没数据」显示成 0 分 */
  buildMetrics(report) {
    const list = (report && report.metrics) || [];
    return list
      .map((m, i) => {
        const raw = m.value;
        const num = typeof raw === "number" ? raw : parseFloat(String(raw));
        if (isNaN(num)) return null;
        return {
          label: m.label || m.key || "",
          pct: Math.max(0, Math.min(100, num)),
          valueText: String(raw),
          note: m.note || "",
          color: RING_COLORS[i % RING_COLORS.length],
        };
      })
      .filter(Boolean)
      .slice(0, 4);
  },

  book() {
    if (this.data.pending) {
      wx.navigateTo({ url: "/pages/booking-result/index?bookingNo=" + this.data.pending.booking_no });
      return;
    }
    if (!this.data.benefit || !this.data.benefit.available) {
      wx.navigateTo({ url: "/pages/subscribe/index" });
      return;
    }
    wx.navigateTo({ url: "/pages/diagnosis-booking/index" });
  },

  go(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    if (/^\/pages\/(index|group|member|notifications|mine)\/index$/.test(url)) wx.switchTab({ url });
    else wx.navigateTo({ url, fail: () => toast("页面暂不可用") });
  },
});
