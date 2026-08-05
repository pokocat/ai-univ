/**
 * 预约详情 / 预约成功（设计稿 25）。
 *
 * 四步进度由服务端按 status 推导（DiagnosisService.steps），前端只渲染——
 * 前端自己算会在状态定义变化时与服务端分叉，而这条进度条是用户判断
 * 「还要等多久」的唯一依据。
 *
 * 「预计反馈时间」用服务端给的 expected_feedback_at；没有就不显示，
 * 不在前端按「今天 +2 天」编一个日期（那会在排期变化后变成一个错误的承诺）。
 */
const api = require("../../api/mp");
const { toast, d10, d16 } = require("../../utils/fmt");
const { navVars } = require("../../utils/layout");
const { isAuthGateError } = require("../../utils/auth");
const log = require("../../utils/log");

const STEP_ICONS = ["shield", "sparkle", "user", "doc"];
const ENDED = ["已生成报告", "已取消"];

Page({
  data: {
    navPad: "",
    loading: true,
    err: "",
    retrying: false,
    bookingNo: "",
    booking: null,
    typeText: "",
    submitText: "",
    feedbackText: "",
    heroTitle: "预约成功",
    heroDesc: "",
    ended: false,
    stepIcons: STEP_ICONS,
  },

  onLoad(options) {
    this.setData(Object.assign({ bookingNo: (options && options.bookingNo) || "" }, navVars()));
    this.load();
  },

  onShow() {
    if (this.data.booking) this.load();
  },

  async load() {
    if (!this.data.bookingNo) {
      this.setData({ loading: false, booking: null });
      return;
    }
    this.setData({ retrying: true });
    try {
      const b = await api.getDiagnosisBooking(this.data.bookingNo);
      const ended = ENDED.indexOf(b.status) >= 0;
      this.setData({
        loading: false,
        err: "",
        retrying: false,
        booking: b,
        ended,
        typeText: Array.isArray(b.diagnosis_types) ? b.diagnosis_types.join(" · ") : "AI 诊断",
        submitText: d16(b.created_at),
        feedbackText: ended ? "" : d10(b.expected_feedback_at),
        heroTitle: b.status === "已生成报告"
          ? "诊断已完成"
          : (b.status === "已取消" ? "预约已取消" : "预约成功"),
        heroDesc: b.status === "已生成报告"
          ? "报告已生成，可在 AI 诊断页查看完整建议"
          : (b.status === "已取消"
              ? (b.cancel_reason || "本次预约已取消，本月配额已释放")
              : "需求已提交，我们会为你匹配排期与服务老师"),
      });
    } catch (e) {
      if (isAuthGateError(e)) return;
      log.warn("booking detail", e.message);
      this.setData({ loading: false, retrying: false, booking: null });
    }
  },

  copyNo() {
    wx.setClipboardData({ data: this.data.bookingNo, success: () => toast("预约编号已复制") });
  },

  cancel() {
    wx.showModal({
      title: "取消预约",
      content: "取消后本月的诊断配额会释放，可以稍后重新提交。",
      confirmText: "取消预约",
      confirmColor: "#C43149",
      success: async r => {
        if (!r.confirm) return;
        try {
          await api.cancelDiagnosisBooking(this.data.bookingNo, "会员自行取消");
          toast("已取消");
          this.load();
        } catch (e) {
          toast(e.message);
        }
      },
    });
  },

  go(e) {
    const url = e.currentTarget.dataset.url;
    if (url) wx.navigateTo({ url, fail: () => toast("页面暂不可用") });
  },
});
