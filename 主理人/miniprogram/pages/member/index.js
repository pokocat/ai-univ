/**
 * 数字会员卡（设计稿 03）。TabBar 中间那格的落点。
 *
 * 关系链只显示**上级**（推荐人 → 二级 → 三级）：设计稿画的是「Victoria → Amy → Jessica」
 * 三个人，语义是「我是怎么被引荐进来的」。下线在「邀请推荐」页展示，两处不混——
 * 混在一起会让人分不清哪个是引荐自己的人。
 *
 * 会员 ID 用 member_no（U-100086）而不是设计稿里的 `HCS PRO 2024 060520`：
 * 那串是设计稿编的展示格式，系统里没有这个字段，编一个格式会让人拿它去对账。
 */
const api = require("../../api/mp");
const share = require("../../behaviors/share");
const { toast, money, d10 } = require("../../utils/fmt");
const { navVars } = require("../../utils/layout");
const { isAuthGateError } = require("../../utils/auth");
const log = require("../../utils/log");

const CHAIN_LABEL = { 1: "推荐人", 2: "二级推荐", 3: "三级推荐" };

Page(
  share.withShare({
    data: {
      navPad: "",
      loading: true,
      err: "",
      retrying: false,
      me: null,
      growth: null,
      membership: null,
      benefits: [],
      chain: [],
      info: [],
      identityLabel: "",
      tierLabel: "",
      expiryText: "",
    },

    onLoad() {
      this.setData(navVars());
    },

    onShow() {
      const tabBar = typeof this.getTabBar === "function" ? this.getTabBar() : null;
      if (tabBar) tabBar.setTab(2);
      this.load();
    },

    onPullDownRefresh() {
      this.load().then(() => wx.stopPullDownRefresh());
    },

    async load() {
      this.setData({ retrying: true });
      try {
        const [me, growth, membership, benefits, invite, group] = await Promise.all([
          api.getMe(),
          api.getGrowth(1),
          api.getMembership(),
          // 会员卡宫格只摆当前可用的权益：摆一格点进去说「你还不能用」比不摆更糟
          api.getBenefits(true),
          api.getInvite(),
          api.getMyGroup().catch(() => null),
        ]);
        this.setShareCode(invite && invite.inviteCode);
        const identity = (me && me.identity) || {};
        this.setData({
          loading: false,
          err: "",
          retrying: false,
          me,
          growth: this.decorateGrowth(growth),
          membership,
          benefits: (benefits || []).slice(0, 6),
          chain: this.buildChain(invite),
          info: this.buildInfo(me, membership, group),
          identityLabel: identity.base_identity || identity.identity || "会员",
          tierLabel: membership && membership.tier ? membership.tier : "",
          expiryText: d10(membership && membership.valid_until),
        });
      } catch (e) {
        if (isAuthGateError(e)) return;
        log.error("member load", e.message);
        this.setData({ loading: false, retrying: false, err: e.message });
      }
    },

    decorateGrowth(g) {
      if (!g) return null;
      return Object.assign({}, g, {
        growthText: money(g.growth),
        remainText: g.remaining == null ? "" : money(g.remaining),
        pctStyle: "width:" + (g.progressPct || 0) + "%",
        glyph: g.level == null ? "" : String(g.level),
      });
    },

    /** 上级关系链（≤3 级）。没有上级时返回空数组，页面走空态并给出邀请入口。 */
    buildChain(invite) {
      return ((invite && invite.upline) || []).map(u => ({
        name: u.name || u.member_no,
        role: CHAIN_LABEL[u.level] || "上级",
        label: CHAIN_LABEL[u.level] || "上级",
      }));
    },

    /**
     * 卡面信息行。**每一行都必须有真实来源**——设计稿里的「所属班级 A 班 · 128人」
     * 在没有班级时不显示，而不是显示「— · —」。
     */
    buildInfo(me, membership, group) {
      const rows = [];
      const identity = (me && me.identity) || {};
      const region = me && me.city;
      if (region) {
        rows.push({ icon: "pin", label: "所在城市", value: region });
      }
      const cohort = group && group.cohort;
      const assignment = group && group.assignment;
      if (cohort || assignment) {
        rows.push({
          icon: "members",
          label: "所属班级",
          value: ((cohort && cohort.name) || (assignment && assignment.group_name)) +
            (assignment && assignment.member_count != null ? " · " + assignment.member_count + " 人" : ""),
        });
      }
      rows.push({ icon: "contacts", label: "会员编号", value: me && me.member_no, mono: true });
      if (me && me.created_at) {
        rows.push({ icon: "calendar", label: "加入时间", value: d10(me.created_at), mono: true });
      }
      rows.push({
        icon: "crown",
        label: "会员等级",
        value: (membership && membership.tier) || identity.identity || "未开通",
      });
      return rows;
    },

    openCode() {
      if (!this.data.me || !this.data.me.member_no) {
        toast("会员档案加载中，请稍后再试");
        return;
      }
      wx.navigateTo({ url: "/pages/member-code/index" });
    },

    /** 权益瓦片：有独立落地页就去落地页，否则去权益详情 */
    openBenefit(e) {
      const { code, page } = e.currentTarget.dataset;
      const url = page && page !== "/pages/benefit-detail/index"
        ? page
        : "/pages/benefit-detail/index?code=" + code;
      wx.navigateTo({ url, fail: () => toast("页面暂不可用") });
    },

    go(e) {
      const { url, tab } = e.currentTarget.dataset;
      if (!url) return;
      if (tab) wx.switchTab({ url });
      else wx.navigateTo({ url, fail: () => toast("页面暂不可用") });
    },
  })
);
