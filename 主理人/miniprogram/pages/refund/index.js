/**
 * 订单与退款（设计稿 18「退款申请」）。
 *
 * 退款走「审批单 → 回调执行器」（护栏 18）：提交后订单进「退款中」并生成审批单，
 * 运营同意才置「已退款」并回收本单授予的权益时长（V38 的权益链重排）。
 * **真实资金退回归外部支付渠道**（护栏 15：中台只做审批协同），
 * 所以页面上不承诺具体到账日期，只说「以渠道回执为准」。
 *
 * 可退款订单只列「已支付」的；退款中/已退款的订单在下方记录里给进度入口——
 * 把它们混进选择列表会让人以为可以再退一次。
 */
const api = require("../../api/mp");
const { toast, money, d10 } = require("../../utils/fmt");
const { navVars } = require("../../utils/layout");
const { isAuthGateError } = require("../../utils/auth");
const log = require("../../utils/log");

const REASON_ICON = { 误购: "card", 时间冲突: "clock", 服务未使用: "folder", 其他原因: "more" };
const STATUS_TAG = { 已支付: "green", 退款中: "amber", 已退款: "gray", 待支付: "blue", 已关闭: "gray" };
const FLOW = [
  { icon: "edit", title: "提交申请", desc: "选择订单与原因" },
  { icon: "shield", title: "平台审核", desc: "1-2 个工作日内审核" },
  { icon: "bell", title: "结果通知", desc: "站内消息与微信通知" },
];

Page({
  data: {
    navPad: "",
    loading: true,
    err: "",
    retrying: false,
    orders: [],
    history: [],
    reasons: [],
    selected: "",
    reason: "",
    note: "",
    submitting: false,
    flow: FLOW,
  },

  onLoad() {
    this.idemKey = api.idemKey("mprefund");
    this.setData(navVars());
  },

  onShow() {
    this.load();
  },

  async load() {
    this.setData({ retrying: true });
    try {
      const [opts, me] = await Promise.all([api.getRefundOptions(), api.getMe()]);
      const orders = ((opts && opts.orders) || []).map(o => ({
        order_no: o.order_no,
        plan_name: o.plan_name,
        amountText: money((o.amount_cents || 0) / 100),
        paidText: o.paid_at ? d10(o.paid_at) + " 支付" : "",
      }));
      const reasons = ((opts && opts.reasons) || []).map(r => ({
        label: r.label,
        icon: REASON_ICON[r.label] || "more",
      }));
      this.setData({
        loading: false,
        err: "",
        retrying: false,
        orders,
        reasons,
        selected: orders.length ? orders[0].order_no : "",
        reason: reasons.length ? reasons[0].label : "",
        // 订单记录：所有订单（含退款中/已退款），给进度入口
        history: ((me && me.orders) || []).map(o => ({
          order_no: o.order_no,
          plan_name: o.plan_name,
          status: o.status,
          amountText: money((o.amount_cents || 0) / 100),
          tagColor: STATUS_TAG[o.status] || "gray",
        })),
      });
    } catch (e) {
      if (isAuthGateError(e)) return;
      log.error("refund load", e.message);
      this.setData({ loading: false, retrying: false, err: e.message });
    }
  },

  pickOrder(e) {
    this.setData({ selected: e.currentTarget.dataset.no });
  },

  pickReason(e) {
    this.setData({ reason: e.currentTarget.dataset.label });
  },

  onInput(e) {
    this.setData({ note: e.detail.value });
  },

  submit() {
    if (this.data.submitting) return;
    if (!this.data.selected) {
      toast("请选择要退款的订单");
      return;
    }
    if (!this.data.reason) {
      toast("请选择退款原因");
      return;
    }
    // 退款是不可逆的资金动作，二次确认里把后果说清楚
    wx.showModal({
      title: "确认提交退款申请",
      content: "提交后订单进入「退款中」，审核通过时会回收本单授予的会员时长。是否继续？",
      confirmText: "提交申请",
      confirmColor: "#C43149",
      success: async r => {
        if (!r.confirm) return;
        this.setData({ submitting: true });
        try {
          await api.applyRefund(this.data.selected, this.data.reason, this.data.note.trim(), this.idemKey);
          wx.redirectTo({ url: "/pages/refund-result/index?orderNo=" + this.data.selected });
        } catch (e) {
          this.setData({ submitting: false });
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
