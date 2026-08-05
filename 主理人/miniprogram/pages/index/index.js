/**
 * 首页（设计稿 05）。
 *
 * 五个区块，每一块的数据都有真实来源——**没有来源的区块不编数字**：
 *  ① 今日洞察轮播：最新诊断报告的建议 / 重要公告 / 到期提醒。三者都没有时
 *     换成「了解 AI 诊断」的引导卡，而不是摆一条编的洞察文案。
 *     轮播点数量随真实条数变化，不是固定三点。
 *  ② 会员成长进度：/mp/growth（成长值现算 + 等级阶梯投影）。
 *  ③ 2×2 快捷入口：四项全部有落地页。
 *  ④ 近期课程 / 服务提醒：服务提醒只显示**当前真正待办的那一件**并且点了就能办；
 *     没有待办时显示专属老师与联系入口，而不是常驻一句「顾问待跟进」。
 *  ⑤ 邀请横幅：奖励成长值读 /mp/invite 的服务端口径，不在前端写死 288（护栏 23 的前端面）。
 */
const api = require("../../api/mp");
const share = require("../../behaviors/share");
const { toast, money, d10 } = require("../../utils/fmt");
const { navVars } = require("../../utils/layout");
const { isAuthGateError } = require("../../utils/auth");
const log = require("../../utils/log");

const WEEK = ["日", "一", "二", "三", "四", "五", "六"];

Page(
  share.withShare({
    data: {
      navPad: "",
      loading: true,
      err: "",
      retrying: false,
      me: null,
      growth: null,
      insights: [],
      insightIdx: 0,
      course: null,
      reminder: null,
      inviteAward: null,
      unread: 0,
      quick: [
        { title: "班级社群", desc: "进入我的班级", icon: "members", color: "signal", url: "/pages/group/index", tab: true },
        { title: "培训服务", desc: "专属课程与服务", icon: "cap", color: "pulse", url: "/pages/training/index" },
        { title: "AI 诊断", desc: "智能商业诊断", icon: "sparkle", color: "signal-600", url: "/pages/diagnosis/index" },
        { title: "公告中心", desc: "最新通知与公告", icon: "megaphone", color: "signal", url: "/pages/notifications/index", tab: true },
      ],
    },

    onLoad() {
      this.setData(navVars());
    },

    onShow() {
      const tabBar = typeof this.getTabBar === "function" ? this.getTabBar() : null;
      if (tabBar) tabBar.setTab(0);
      this.load();
    },

    onPullDownRefresh() {
      this.load().then(() => wx.stopPullDownRefresh());
    },

    async load() {
      this.setData({ retrying: true });
      try {
        // 并发拉取：串起来首屏要等六个 RTT，而这些接口互不依赖
        const [me, growth, courses, announcements, diagnosis, invite] = await Promise.all([
          api.getMe(),
          api.getGrowth(5),
          api.getCourseSessions(),
          api.getAnnouncements("", 5),
          api.getDiagnosis(),
          api.getInvite(),
        ]);
        this.setShareCode(invite && invite.inviteCode);
        const app = getApp();
        if (app && app.globalData) {
          app.globalData.unread = (announcements && announcements.unread) || 0;
        }
        this.setData({
          loading: false,
          err: "",
          retrying: false,
          me,
          growth: this.decorateGrowth(growth),
          insights: this.buildInsights(diagnosis, announcements, me),
          insightIdx: 0,
          course: this.pickCourse(courses),
          inviteAward: invite && invite.inviteAward != null ? money(invite.inviteAward) : null,
          unread: (announcements && announcements.unread) || 0,
        });
        // 服务提醒依赖另外两个接口，单独拉：它是辅助区块，慢一点不该拖住首屏
        this.setData({ reminder: await this.buildReminder(diagnosis) });
        const tabBar = typeof this.getTabBar === "function" ? this.getTabBar() : null;
        if (tabBar) tabBar.syncUnread();
      } catch (e) {
        if (isAuthGateError(e)) return;
        log.error("home load", e.message);
        this.setData({ loading: false, retrying: false, err: e.message });
      }
    },

    /** 成长值：千分位与进度条宽度在 setData 前算好（WXML 不能调函数） */
    decorateGrowth(g) {
      if (!g) return null;
      return Object.assign({}, g, {
        growthText: money(g.growth),
        nextText: g.nextThreshold == null ? "" : money(g.nextThreshold),
        remainText: g.remaining == null ? "" : money(g.remaining),
        pctStyle: `width:${g.progressPct || 0}%`,
        levelText: g.level == null ? "—" : "LV." + g.level,
        glyph: g.level == null ? "" : String(g.level),
      });
    },

    /**
     * 洞察轮播。**优先个人化**：诊断建议最贴身，其次重要公告，最后到期提醒。
     * 全空时给一张如实说明的引导卡。
     */
    buildInsights(diagnosis, announcements, me) {
      const out = [];
      const report = diagnosis && diagnosis.report;
      if (report && report.advices && report.advices.length) {
        report.advices.slice(0, 2).forEach(a => {
          out.push({
            eyebrow: "你的 AI 诊断建议",
            title: a.title || "增长建议",
            body: a.desc || "",
            actionText: "查看完整分析",
            url: "/pages/diagnosis/index",
          });
        });
      }
      const items = (announcements && announcements.items) || [];
      const major = items.filter(a => a.importance === "重要")[0];
      if (major) {
        out.push({
          eyebrow: "重要公告",
          title: major.title,
          body: major.summary || "",
          actionText: "查看详情",
          url: "/pages/message/index?annNo=" + major.ann_no,
        });
      }
      const identity = (me && me.identity) || {};
      if (identity.valid_until) {
        const days = Math.ceil((new Date(identity.valid_until).getTime() - Date.now()) / 86400000);
        if (days >= 0 && days <= 30) {
          out.push({
            eyebrow: "会员到期提醒",
            title: "会员还有 " + days + " 天到期",
            body: "到期时间 " + d10(identity.valid_until) + "，续费后有效期自动延长，权益不中断。",
            actionText: "查看续费方案",
            url: "/pages/renewal/index",
          });
        }
      }
      if (!out.length) {
        out.push({
          eyebrow: "今日 AI 增长洞察",
          title: "还没有你的洞察",
          body: "提交一次 AI 诊断，我们会基于你的社群与业务数据给出增长、活跃、转化与服务建议。",
          actionText: "了解 AI 诊断",
          url: "/pages/diagnosis/index",
        });
      }
      return out;
    },

    /** 近期课程：直播中 > 最近一场排期 > 最近一场可回放 */
    pickCourse(courses) {
      const list = courses || [];
      const live = list.find(c => c.status === "直播中");
      if (live) return this.decorateCourse(live);
      const upcoming = list
        .filter(c => c.status === "已排期")
        .sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)))[0];
      if (upcoming) return this.decorateCourse(upcoming);
      const replay = list.find(c => c.replay_ready);
      return replay ? this.decorateCourse(replay) : null;
    },

    decorateCourse(c) {
      const at = c.scheduled_at ? new Date(String(c.scheduled_at).replace(/-/g, "/").replace(/\..*$/, "")) : null;
      return Object.assign({}, c, {
        live: c.status === "直播中",
        whenText: at && !isNaN(at.getTime())
          ? String(at.getMonth() + 1).padStart(2, "0") + "." + String(at.getDate()).padStart(2, "0") +
            "（周" + WEEK[at.getDay()] + "）" +
            String(at.getHours()).padStart(2, "0") + ":" + String(at.getMinutes()).padStart(2, "0")
          : "",
        countdown: this.countdown(at),
        actionText: c.status === "直播中"
          ? "进入直播"
          : (c.replay_ready ? "看回放" : (c.enrolled ? "已预约" : "去预约")),
      });
    },

    /** 距开始倒计时；已开始或无时间时返回空串（不显示一个负数） */
    countdown(at) {
      if (!at || isNaN(at.getTime())) return "";
      const diff = at.getTime() - Date.now();
      if (diff <= 0) return "";
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
    },

    /**
     * 服务提醒：只显示当前真正待办的那一件。
     * 紧急度：待加顾问 > 未解决工单 > 在途诊断 > 无待办（显示专属老师与联系入口）。
     */
    async buildReminder(diagnosis) {
      try {
        const [group, tickets] = await Promise.all([api.getMyGroup(), api.getTickets()]);
        const advisor = group && group.advisorStep;
        if (advisor && advisor.required) {
          return {
            title: "请先添加你的专属服务顾问",
            desc: advisor.hint || "加上顾问后即可进入你的社群",
            actionText: "去添加",
            url: "/pages/advisor/index",
          };
        }
        const open = (tickets || []).filter(t => t.status !== "已解决")[0];
        if (open) {
          return {
            title: "工单处理中：" + open.ticket_type,
            desc: "工单 " + open.ticket_no + " 已提交，处理进度可随时查看",
            actionText: "查看进度",
            url: "/pages/ticket-result/index?ticketNo=" + open.ticket_no,
          };
        }
        const pending = diagnosis && diagnosis.pending;
        if (pending) {
          return {
            title: "AI 诊断" + pending.status,
            desc: pending.expected_feedback_at
              ? "预计 " + d10(pending.expected_feedback_at) + " 前反馈结果"
              : "我们会尽快为你匹配服务老师",
            actionText: "查看详情",
            url: "/pages/booking-result/index?bookingNo=" + pending.booking_no,
          };
        }
        const teacher = group && group.serviceTeacher;
        if (teacher) {
          return {
            title: "专属服务老师：" + teacher.name,
            desc: (teacher.role || "社群服务") +
              (teacher.service_region ? " · " + teacher.service_region : "") + "，有问题随时找他",
            actionText: "立即联系",
            url: "/pages/advisor/index",
          };
        }
        return {
          title: "暂无待办",
          desc: "有需要时可以提交服务工单，我们会在承诺时限内响应。",
          actionText: "提交工单",
          url: "/pages/ticket/index",
        };
      } catch (e) {
        // 辅助区块拉不到不该拖垮首页——如实降级成一个可点的入口，不显示假的「一切正常」
        log.warn("home reminder", e.message);
        return {
          title: "服务提醒暂时取不到",
          desc: "网络或服务异常，可下拉刷新重试；有急事可直接提交工单。",
          actionText: "提交工单",
          url: "/pages/ticket/index",
        };
      }
    },

    onInsightChange(e) {
      this.setData({ insightIdx: e.detail.current });
    },

    go(e) {
      const { url, tab } = e.currentTarget.dataset;
      if (!url) return;
      if (tab) wx.switchTab({ url });
      else wx.navigateTo({ url, fail: () => toast("页面暂不可用") });
    },
  })
);
