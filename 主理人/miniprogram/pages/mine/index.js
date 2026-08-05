/**
 * 我的（设计稿 11「设置中心 / 我的」）。
 *
 * 它是**入口页**，不是设置本体：账号安全/隐私/协议/注销这些合规项在
 * `pages/settings`（更深一层），因为它们的正文很长、且上架规范要求有稳定入口。
 * 这里只负责「我是谁 + 我的三个读数 + 去哪儿」。
 *
 * 功能行按能力显隐，不摆点不动的东西：
 *  · 「我的团队」只在服务端说 isAgent 时出现（判据是 base_identity，服务端给结论，
 *    客户端不硬编码身份名单——保护身份清单在 dict 里由运营维护）；
 *  · 「自动续费管理」只在已开通时出现；
 *  · 「联系专属服务」只在真的匹配到服务老师时出现。
 */
const api = require("../../api/mp");
const share = require("../../behaviors/share");
const { toast, money, d10 } = require("../../utils/fmt");
const { navVars } = require("../../utils/layout");
const { isAuthGateError, logout } = require("../../utils/auth");
const log = require("../../utils/log");

Page(
  share.withShare({
    data: {
      navPad: "",
      loading: true,
      err: "",
      retrying: false,
      me: null,
      membership: null,
      teacher: null,
      identityLabel: "",
      expiryText: "",
      growthGlyph: "",
      stats: [],
      rows: [],
      version: "",
      showProfileEdit: false,
    },

    onLoad() {
      this.setData(Object.assign({ version: this.versionText() }, navVars()));
    },

    onShow() {
      const tabBar = typeof this.getTabBar === "function" ? this.getTabBar() : null;
      if (tabBar) tabBar.setTab(4);
      this.load();
    },

    onPullDownRefresh() {
      this.load().then(() => wx.stopPullDownRefresh());
    },

    versionText() {
      try {
        const info = wx.getAccountInfoSync();
        const v = info && info.miniProgram ? info.miniProgram.version : "";
        const env = info && info.miniProgram ? info.miniProgram.envVersion : "";
        const envName = { develop: "开发版", trial: "体验版", release: "正式版" }[env] || env;
        return [envName, v && "v" + v].filter(Boolean).join(" · ");
      } catch (e) {
        return "";
      }
    },

    async load() {
      this.setData({ retrying: true });
      try {
        const [me, membership, growth, invite, earnings, group] = await Promise.all([
          api.getMe(),
          api.getMembership(),
          api.getGrowth(1),
          api.getInvite(),
          api.getEarnings().catch(() => null),
          api.getMyGroup().catch(() => null),
        ]);
        this.setShareCode(invite && invite.inviteCode);
        const identity = (me && me.identity) || {};
        this.setData({
          loading: false,
          err: "",
          retrying: false,
          me,
          membership: membership || {},
          teacher: group && group.serviceTeacher,
          identityLabel: identity.base_identity || identity.identity || "会员",
          expiryText: membership && membership.active ? d10(membership.valid_until) : "",
          growthGlyph: growth && growth.level != null ? String(growth.level) : "",
          stats: this.buildStats(growth, invite, earnings),
          rows: this.buildRows(me, membership),
        });
      } catch (e) {
        if (isAuthGateError(e)) return;
        log.error("mine load", e.message);
        this.setData({ loading: false, retrying: false, err: e.message });
      }
    },

    /**
     * 三个读数。收益取不到时显示「—」而不是 0：0 表示「确实没有收益」，
     * 而「—」表示「这项数据现在取不到」，两件事不能显示成同一个值。
     */
    buildStats(growth, invite, earnings) {
      return [
        {
          label: "成长值",
          value: growth ? money(growth.growth) : "—",
          url: "/pages/points/index",
        },
        {
          label: "已邀请",
          value: invite && invite.influence != null ? money(invite.influence) : "—",
          url: "/pages/invite/index",
        },
        {
          label: "累计收益",
          value: earnings && earnings.summary && earnings.summary.total_est != null
            ? "¥" + money(earnings.summary.total_est)
            : "—",
          url: "/pages/earnings/index",
        },
      ];
    },

    buildRows(me, membership) {
      const rows = [];
      rows.push({
        title: "我的社群", desc: "班级、群成员与入群二维码",
        icon: "members", color: "signal", url: "/pages/group/index", tab: true,
      });
      rows.push({
        title: "培训与课程", desc: "报名进度、课程回放与课件",
        icon: "cap", color: "pulse", url: "/pages/training/index",
      });
      rows.push({
        title: "会员权益", desc: "全部权益、使用方式与本月余量",
        icon: "crown", color: "signal", url: "/pages/benefits/index",
      });
      rows.push({
        title: "我的任务", desc: "班级任务与成长值奖励",
        icon: "shield", color: "signal", url: "/pages/tasks/index",
      });
      if (me && me.isAgent) {
        rows.push({
          title: "我的团队", desc: "名下社群与服务归属的学员",
          icon: "handshake", color: "signal-600", url: "/pages/agent/index", tag: "代理",
        });
      }
      if (membership && membership.active) {
        rows.push({
          title: "会员与续费", desc: "当前方案、到期时间与续费",
          icon: "refresh", color: "signal", url: "/pages/renewal/index",
          trail: membership.days_left != null ? "剩 " + membership.days_left + " 天" : "",
        });
      }
      rows.push({
        title: "订单与退款", desc: "购买记录、待支付订单与退款申请",
        icon: "receipt", color: "signal", url: "/pages/refund/index",
      });
      rows.push({
        title: "帮助与工单", desc: "提交问题、查看处理进度",
        icon: "headset", color: "signal", url: "/pages/ticket/index",
      });
      rows.push({
        title: "设置", desc: "账号与隐私、协议、缓存与注销",
        icon: "settings", color: "signal-800", url: "/pages/settings/index",
      });
      return rows;
    },

    editProfile() {
      this.setData({ showProfileEdit: true });
    },

    closeProfile() {
      this.setData({ showProfileEdit: false });
    },

    onProfileSaved() {
      this.setData({ showProfileEdit: false });
      this.load();
    },

    logout() {
      wx.showModal({
        title: "退出登录",
        content: "退出后需要重新授权登录才能使用会员功能。已购买的会员权益不受影响。",
        confirmText: "退出",
        confirmColor: "#C43149",
        success: r => {
          if (!r.confirm) return;
          logout();
          wx.reLaunch({ url: "/pages/login/index" });
        },
      });
    },

    go(e) {
      const { url, tab } = e.currentTarget.dataset;
      if (!url) return;
      if (tab) wx.switchTab({ url });
      else wx.navigateTo({ url, fail: () => toast("页面暂不可用") });
    },
  })
);
