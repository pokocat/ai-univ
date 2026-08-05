/**
 * 班级社群（设计稿 06）。两个页签：我的社群 / 班级活动。
 *
 * 刻意**不显示**设计稿里的「活跃度 92% · 今日在线 68 人」：库里没有这两个事实源，
 * 编一个百分比是整张设计稿里最容易被当真的假数据（运营会拿它汇报）。
 * 真实可给的是：班级人数、群主/服务老师、已入群成员名单、今日任务、活动报名数。
 *
 * 成员名单只含**已入群**的人（服务端口径），所以卡片里那句
 * 「正在邀请中的同学暂不显示」不是客套，是对名单口径的如实说明。
 */
const api = require("../../api/mp");
const share = require("../../behaviors/share");
const { toast, d16 } = require("../../utils/fmt");
const { navVars } = require("../../utils/layout");
const { isAuthGateError } = require("../../utils/auth");
const log = require("../../utils/log");

const WEEK = ["日", "一", "二", "三", "四", "五", "六"];

/** 任务类型 → 图标。未登记的类型回落到 star2，不留空图标位 */
const TASK_ICON = {
  课程学习: "play",
  每日打卡: "edit",
  互动交流: "chat",
  邀请: "members",
};

Page(
  share.withShare({
    data: {
      navPad: "",
      tab: "mine",
      loading: true,
      err: "",
      retrying: false,
      group: null,
      tasks: [],
      activities: [],
      activityCount: 0,
    },

    onLoad() {
      this.setData(navVars());
    },

    onShow() {
      const tabBar = typeof this.getTabBar === "function" ? this.getTabBar() : null;
      if (tabBar) tabBar.setTab(1);
      this.load();
    },

    onPullDownRefresh() {
      this.load().then(() => wx.stopPullDownRefresh());
    },

    switchTab(e) {
      this.setData({ tab: e.currentTarget.dataset.tab });
    },

    async load() {
      this.setData({ retrying: true });
      try {
        const [group, tasks, activities, invite] = await Promise.all([
          api.getMyGroup(),
          api.getTasks(),
          api.getActivities(),
          api.getInvite().catch(() => null),
        ]);
        if (invite) this.setShareCode(invite.inviteCode);
        this.setData({
          loading: false,
          err: "",
          retrying: false,
          group: this.decorateGroup(group),
          tasks: this.decorateTasks(tasks),
          activities: (activities || []).map(a => this.decorateActivity(a)),
          activityCount: (activities || []).filter(a => a.status === "报名中").length,
        });
      } catch (e) {
        if (isAuthGateError(e)) return;
        log.error("group load", e.message);
        this.setData({ loading: false, retrying: false, err: e.message });
      }
    },

    decorateGroup(g) {
      if (!g) return null;
      const a = g.assignment;
      const cohort = g.cohort;
      const advisor = g.advisorStep;
      const members = (g.members || []).map(m => ({
        name: m.name,
        is_me: m.is_me,
        // 后端只下发 avatar_key（相对路径由 ui-avatar 拼基址）；没有头像就走首字回落
        avatarPath: m.avatar_key ? "/mp/avatar/" + m.avatar_key : "",
      }));
      return Object.assign({}, g, {
        // 有班级用班名，没绑班级就用群名——不编一个班号
        title: (cohort && cohort.name) || (a && a.group_name) || "我的社群",
        glyph: cohort && cohort.cohort_code ? String(cohort.cohort_code).slice(-2) : "",
        joined: a && a.status === "已入群",
        advisorRequired: !!(advisor && advisor.required),
        members,
        membersHint: members.length
          ? "仅显示已入群同学"
          : "",
      });
    },

    /**
     * member_task 的完成态是布尔 `done`（不是三态 status）。
     * 设计稿有「进行中」这一档，但库里没有它——**不伪造**：未完成一律「待完成」，
     * 显示一个不存在的中间态会让人以为系统在跟踪他的进度。
     */
    decorateTasks(tasks) {
      return (tasks || []).slice(0, 3).map(t => ({
        id: t.id,
        title: t.title,
        meta: [t.task_type, t.points ? "+" + t.points + " 积分" : "", t.deadline].filter(Boolean).join(" · "),
        icon: TASK_ICON[t.task_type] || "star2",
        done: t.done,
        stText: t.done ? "已完成" : "待完成",
        stColor: t.done ? "ok" : "signal-800",
      }));
    },

    decorateActivity(a) {
      const at = a.starts_at ? new Date(String(a.starts_at).replace(/-/g, "/").replace(/\..*$/, "")) : null;
      let countdown = "";
      if (at && !isNaN(at.getTime())) {
        const diff = at.getTime() - Date.now();
        if (diff > 0) {
          const d = Math.floor(diff / 86400000);
          const h = Math.floor((diff % 86400000) / 3600000);
          countdown = d > 0 ? d + " 天 " + h + " 时" : h + " 小时";
        }
      }
      return Object.assign({}, a, {
        whenText: at && !isNaN(at.getTime())
          ? d16(a.starts_at) + "（周" + WEEK[at.getDay()] + "）"
          : "",
        countdown,
      });
    },

    async signUp(e) {
      const no = e.currentTarget.dataset.no;
      try {
        await api.signUpActivity(no);
        toast("报名成功");
        this.load();
      } catch (err) {
        // 名额满/状态变化都是可预期的业务结果，如实把服务端的话说出来
        toast(err.message);
      }
    },

    go(e) {
      const { url, tab } = e.currentTarget.dataset;
      if (!url) return;
      if (tab) wx.switchTab({ url });
      else wx.navigateTo({ url, fail: () => toast("页面暂不可用") });
    },
  })
);
