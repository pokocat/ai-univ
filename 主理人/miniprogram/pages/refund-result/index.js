/**
 * 退款进度（设计稿 30）。
 *
 * 四步进度由服务端按「订单状态 + 审批状态」推导（RefundRequestService.steps）。
 * 「预计到账时间」**不编具体日期**：中台不掌握支付渠道的打款时效（护栏 15），
 * 编一个日期到期没到账用户就会来问，而我们无法回答。
 */
const api = require("../../api/mp");
const { toast, money, d16 } = require("../../utils/fmt");
const { navVars } = require("../../utils/layout");
const { isAuthGateError } = require("../../utils/auth");
const log = require("../../utils/log");

const STEP_ICONS = ["doc", "shield", "card", "bell"];

Page({
  data: {
    navPad: "",
    loading: true,
    err: "",
    retrying: false,
    orderNo: "",
    refund: null,
    amountText: "",
    appliedText: "",
    decisionComment: "",
    heroTitle: "退款处理中",
    heroDesc: "",
    stepIcons: STEP_ICONS,
  },

  onLoad(options) {
    this.setData(Object.assign({ orderNo: (options && options.orderNo) || "" }, navVars()));
    this.load();
  },

  onShow() {
    if (this.data.refund) this.load();
  },

  async load() {
    if (!this.data.orderNo) {
      this.setData({ loading: false, refund: null });
      return;
    }
    this.setData({ retrying: true });
    try {
      const r = await api.getRefund(this.data.orderNo);
      const approval = r.approval || null;
      const steps = (r.steps || []).map(s => Object.assign({}, s, { atText: s.at ? d16(s.at).slice(5) : "" }));
      const refunded = r.status === "已退款";
      const rejected = approval && approval.status === "已拒绝";
      this.setData({
        loading: false,
        err: "",
        retrying: false,
        refund: Object.assign({}, r, { steps }),
        amountText: money((r.amount_cents || 0) / 100),
        appliedText: d16(approval && approval.created_at),
        decisionComment: (approval && approval.decision_comment) || "",
        heroTitle: refunded ? "退款已完成" : (rejected ? "退款未通过" : "退款审核中"),
        heroDesc: refunded
          ? "本单授予的会员时长已回收，款项由支付渠道退回"
          : (rejected
              ? "本次申请未通过审核，订单权益保持不变"
              : "申请已提交，平台正在审核，请留意站内消息"),
      });
    } catch (e) {
      if (isAuthGateError(e)) return;
      log.warn("refund detail", e.message);
      this.setData({ loading: false, retrying: false, refund: null });
    }
  },

  copyNo() {
    wx.setClipboardData({ data: this.data.orderNo, success: () => toast("订单编号已复制") });
  },

  go(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    if (/^\/pages\/(index|group|member|notifications|mine)\/index$/.test(url)) wx.switchTab({ url });
    else wx.navigateTo({ url, fail: () => toast("页面暂不可用") });
  },
});
