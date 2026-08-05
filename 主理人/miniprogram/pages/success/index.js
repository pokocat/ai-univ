/**
 * 开通成功（设计稿 04）。
 *
 * 设计稿把五步时间线全画成「已完成」。这里**每一步的完成态都来自服务端状态**：
 * 已入会（订单已支付）/ 已完成缴费（订单已支付）/ 已绑定关系链（有推荐上级）/
 * 已分班（有安置记录）/ 已匹配服务顾问（有服务老师或已建顾问关系）。
 *
 * 为什么不能全打勾：付费到入群之间是有真实间隔的（推荐引擎排群、顾问承接、人工邀请）。
 * 全打勾的成功页会让刚付款的人以为已经进群了，然后来问「群在哪」——
 * 而正确的答案是「等顾问邀请」，那正是这一页应该说清楚的事。
 */
const api = require("../../api/mp");
const { toast, d10 } = require("../../utils/fmt");
const { navVars } = require("../../utils/layout");
const { isAuthGateError } = require("../../utils/auth");
const log = require("../../utils/log");

Page({
  data: {
    navPad: "",
    loading: true,
    err: "",
    retrying: false,
    orderNo: "",
    tier: "",
    steps: [],
    group: null,
    advisorUrl: "/pages/advisor/index",
    advisorTitle: "添加服务顾问",
    advisorDesc: "与专属老师建立联系",
  },

  onLoad(options) {
    this.setData(Object.assign({ orderNo: (options && options.orderNo) || "" }, navVars()));
    this.load();
  },

  async load() {
    this.setData({ retrying: true });
    try {
      const [me, membership, group, invite] = await Promise.all([
        api.getMe(),
        api.getMembership(),
        api.getMyGroup().catch(() => null),
        api.getInvite().catch(() => null),
      ]);
      const order = this.data.orderNo
        ? await api.getOrder(this.data.orderNo).catch(() => null)
        : null;
      const assignment = group && group.assignment;
      const advisor = group && group.advisorStep;
      const teacher = group && group.serviceTeacher;
      const cohort = group && group.cohort;
      const paid = order ? order.status === "已支付" : !!(membership && membership.active);
      const hasUpline = !!(invite && invite.upline && invite.upline.length);

      this.setData({
        loading: false,
        err: "",
        retrying: false,
        tier: (membership && membership.tier) || "",
        steps: [
          {
            icon: "user", title: "已入会",
            desc: paid ? "恭喜你成为主理人公社会员" : "订单尚未确认到账",
            done: paid, state: paid ? "已完成" : "处理中",
          },
          {
            icon: "card", title: "缴费确认",
            desc: order && order.paid_at ? "支付成功于 " + d10(order.paid_at) : (paid ? "支付已确认" : "等待支付回调确认"),
            done: paid, state: paid ? "已完成" : "处理中",
          },
          {
            icon: "link", title: "关系链绑定",
            desc: hasUpline
              ? "已绑定推荐人：" + (invite.upline[0].name || invite.upline[0].member_no)
              : "你不是通过邀请码注册的，没有推荐关系需要绑定",
            done: hasUpline, state: hasUpline ? "已完成" : "无需绑定",
          },
          {
            icon: "members", title: "班级分配",
            desc: assignment
              ? "已为你分配「" + ((cohort && cohort.name) || assignment.group_name) + "」"
              : "运营正在为你匹配最合适的社群",
            done: !!assignment, state: assignment ? "已完成" : "进行中",
          },
          {
            icon: "wechat", title: "服务顾问",
            desc: advisor && advisor.required
              ? "请添加顾问微信，加上之后即可进群"
              : (teacher ? "专属服务老师：" + teacher.name : "顾问匹配中，稍后会通知你"),
            done: !!teacher && !(advisor && advisor.required),
            state: advisor && advisor.required ? "待你操作" : (teacher ? "已完成" : "进行中"),
          },
        ],
        group: group
          ? Object.assign({}, group, {
              title: (cohort && cohort.name) || (assignment && assignment.group_name) || "我的社群",
              joined: assignment && assignment.status === "已入群",
              cohortStart: d10(cohort && cohort.start_date),
            })
          : null,
        advisorTitle: advisor && advisor.required ? "添加服务顾问" : (teacher ? "联系服务老师" : "查看社群进度"),
        advisorDesc: advisor && advisor.required ? "加上顾问才能进入班群" : "获取专属服务支持",
        advisorUrl: advisor && advisor.required || teacher ? "/pages/advisor/index" : "/pages/group/index",
      });
    } catch (e) {
      if (isAuthGateError(e)) return;
      log.error("success load", e.message);
      this.setData({ loading: false, retrying: false, err: e.message });
    }
  },

  go(e) {
    const { url, tab } = e.currentTarget.dataset;
    if (!url) return;
    // 社群是 tab 页，只能 switchTab；猜错会静默失败
    const isTab = tab || /^\/pages\/(index|group|member|notifications|mine)\/index$/.test(url);
    if (isTab) wx.switchTab({ url });
    else wx.navigateTo({ url, fail: () => toast("页面暂不可用") });
  },
});
