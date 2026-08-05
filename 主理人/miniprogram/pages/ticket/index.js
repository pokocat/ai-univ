/**
 * 服务工单（设计稿 15）。两个页签：提交工单 / 我的工单。
 *
 * 问题类型与 SLA 都读 `ticket_type_rule`（服务端，运营可在线调），
 * 不在小程序里硬编码——硬编码那份要过审才能更新，运营改一次 SLA 就会两边不一致，
 * 而「预计响应时间」是对用户的承诺，不能有两个版本。
 *
 * 设计稿的「上传图片（最多 5 张）」与「AI 智能识别」**刻意不做**：
 * 会员端没有文件上传通道（只有头像那条专用的），也没有工单分类模型。
 * 摆一个点了报错的上传按钮、或一句假的「AI 已识别：登录异常」，
 * 都会让人以为系统已经理解了他的问题。改为如实说明截图怎么给。
 */
const api = require("../../api/mp");
const { toast, d16 } = require("../../utils/fmt");
const { navVars } = require("../../utils/layout");
const { isAuthGateError } = require("../../utils/auth");
const log = require("../../utils/log");

const STATUS_TAG = { 待处理: "amber", 进行中: "purple", 已解决: "green" };

Page({
  data: {
    navPad: "",
    tab: "new",
    loading: true,
    err: "",
    retrying: false,
    types: [],
    picked: "",
    pickedRule: null,
    description: "",
    submitting: false,
    tickets: [],
    openCount: 0,
  },

  onLoad(options) {
    // 一次填单一个幂等键：重复点提交只受理一次（避免造出两张单 = 多余的人工工作量）
    this.idemKey = api.idemKey("mpticket");
    this.setData(Object.assign({ tab: (options && options.tab) === "mine" ? "mine" : "new" }, navVars()));
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
      const [types, tickets] = await Promise.all([api.getTicketTypes(), api.getTickets()]);
      const list = (tickets || []).map(t => ({
        ticket_no: t.ticket_no,
        ticket_type: t.ticket_type,
        status: t.status,
        description: t.description,
        createdText: d16(t.created_at),
        tagColor: STATUS_TAG[t.status] || "gray",
        icon: (types || []).reduce((acc, r) => (r.type_code === t.ticket_type ? r.icon : acc), "headset"),
      }));
      const picked = this.data.picked || ((types || [])[0] && types[0].type_code) || "";
      this.setData({
        loading: false,
        err: "",
        retrying: false,
        types: types || [],
        picked,
        pickedRule: (types || []).find(r => r.type_code === picked) || null,
        tickets: list,
        openCount: list.filter(t => t.status !== "已解决").length,
      });
    } catch (e) {
      if (isAuthGateError(e)) return;
      log.error("ticket load", e.message);
      this.setData({ loading: false, retrying: false, err: e.message });
    }
  },

  pickType(e) {
    const code = e.currentTarget.dataset.code;
    this.setData({
      picked: code,
      pickedRule: this.data.types.find(r => r.type_code === code) || null,
    });
  },

  onInput(e) {
    this.setData({ description: e.detail.value });
  },

  async submit() {
    if (this.data.submitting) return;
    if (!this.data.picked) {
      toast("请选择问题类型");
      return;
    }
    if (this.data.description.trim().length < 5) {
      toast("请把问题描述写清楚（至少 5 个字）");
      return;
    }
    this.setData({ submitting: true });
    try {
      const t = await api.createTicket(this.data.picked, this.data.description.trim(), null, this.idemKey);
      wx.redirectTo({ url: "/pages/ticket-result/index?ticketNo=" + t.ticket_no });
    } catch (e) {
      this.setData({ submitting: false });
      toast(e.message);
    }
  },

  go(e) {
    const url = e.currentTarget.dataset.url;
    if (url) wx.navigateTo({ url, fail: () => toast("页面暂不可用") });
  },
});
