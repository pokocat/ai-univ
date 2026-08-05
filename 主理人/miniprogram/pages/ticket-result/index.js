/**
 * 工单进度（设计稿 28）。
 *
 * 四步进度读 `ticket_event` 流水，**不由 status 反推**：status 只有三态
 * （待处理/进行中/已解决），而设计稿要回答「几点受理的、谁在处理」——三态反推不出来。
 * 每步时间取该类事件的**首次**发生时间（服务端口径），否则重复标记会让
 * 「14:35 受理」几天后变成「今天 09:12 受理」，用户会以为工单被重置了。
 *
 * 「评价服务」只在工单已解决且尚未评价时出现——没解决就请人打分，
 * 或让人重复评同一件事，都是在制造无意义的动作。
 */
const api = require("../../api/mp");
const { toast, d16 } = require("../../utils/fmt");
const { navVars } = require("../../utils/layout");
const { isAuthGateError } = require("../../utils/auth");
const log = require("../../utils/log");

const STEP_ICONS = ["doc", "headset", "user", "chat"];

Page({
  data: {
    navPad: "",
    loading: true,
    err: "",
    retrying: false,
    ticketNo: "",
    ticket: null,
    events: [],
    createdText: "",
    repliedText: "",
    dueText: "",
    heroTitle: "工单已受理",
    heroDesc: "",
    canReview: false,
    stepIcons: STEP_ICONS,
  },

  onLoad(options) {
    this.setData(Object.assign({ ticketNo: (options && options.ticketNo) || "" }, navVars()));
    this.load();
  },

  onShow() {
    if (this.data.ticket) this.load();
  },

  async load() {
    if (!this.data.ticketNo) {
      this.setData({ loading: false, ticket: null });
      return;
    }
    this.setData({ retrying: true });
    try {
      const t = await api.getTicket(this.data.ticketNo);
      const steps = (t.steps || []).map(s => Object.assign({}, s, { atText: s.at ? d16(s.at).slice(5) : "" }));
      const resolved = t.status === "已解决";
      this.setData({
        loading: false,
        err: "",
        retrying: false,
        ticket: Object.assign({}, t, { steps }),
        events: (t.events || []).map(e => Object.assign({}, e, { timeText: d16(e.created_at) })),
        createdText: d16(t.created_at),
        repliedText: d16(t.replied_at),
        dueText: resolved ? "" : this.dueHint(t.due_at),
        heroTitle: resolved ? "工单已解决" : (t.status === "进行中" ? "正在处理" : "工单已提交"),
        heroDesc: resolved
          ? "如果问题仍未解决，可以再提交一张工单并附上本单编号"
          : "你的问题已进入服务流程，我们会在承诺时限内处理",
        canReview: resolved && !t.reviewed,
      });
    } catch (e) {
      if (isAuthGateError(e)) return;
      log.warn("ticket detail", e.message);
      this.setData({ loading: false, retrying: false, ticket: null });
    }
  },

  /** 承诺时限提示。已超时如实说「已超时」，不显示一个负数小时 */
  dueHint(dueAt) {
    if (!dueAt) return "";
    const diff = new Date(String(dueAt).replace(/-/g, "/").replace(/\..*$/, "")).getTime() - Date.now();
    if (isNaN(diff)) return "";
    if (diff <= 0) return "已超过承诺时限";
    const h = Math.floor(diff / 3600000);
    return h >= 1 ? "还剩约 " + h + " 小时" : "即将到期";
  },

  copyNo() {
    wx.setClipboardData({ data: this.data.ticketNo, success: () => toast("工单编号已复制") });
  },

  review() {
    wx.navigateTo({
      url: "/pages/review/index?targetType=" + encodeURIComponent("服务工单") + "&targetRef=" + this.data.ticketNo,
    });
  },

  go(e) {
    const url = e.currentTarget.dataset.url;
    if (url) wx.navigateTo({ url, fail: () => toast("页面暂不可用") });
  },
});
