/**
 * 消息（设计稿 09「公告中心」）。两个页签：
 *  · 公告中心 —— `announcement`：一份内容多人可见，带分类与已读人数；
 *  · 通知消息 —— `mp_notification`：一人一条待办，后台状态变化必达（不依赖微信订阅授权）。
 *
 * 两者刻意分开（服务端也是两张表）：混在一起「N 位同学已查看」就没有地方算，
 * 而按人复制一份公告会让改一次标题要改 N 行。
 *
 * 订阅提醒横幅只在**服务端确认模板已配置**时出现（subscribe.prefetch 的 configured 位）——
 * 模板 ID 还没拿到就摆一个「开启提醒」，点了必然什么也不会发生。
 */
const api = require("../../api/mp");
const share = require("../../behaviors/share");
const { toast, d16 } = require("../../utils/fmt");
const { navVars } = require("../../utils/layout");
const { isAuthGateError } = require("../../utils/auth");
const subscribe = require("../../utils/subscribe");
const log = require("../../utils/log");

/** 公告分类 → 图标 / 标签配色。未登记的分类回落，不留空图标位 */
const CATEGORY_STYLE = {
  系统: { icon: "bell", tagColor: "red" },
  课程: { icon: "cap", tagColor: "amber" },
  班级: { icon: "members", tagColor: "purple" },
  活动: { icon: "calendar", tagColor: "blue" },
  权益: { icon: "crown", tagColor: "purple" },
};

/** 站内消息事件类型 → 图标 */
const EVENT_ICON = {
  order_paid: "card",
  refund_result: "yrefund",
  assignment_joined: "members",
  course_reminder: "cap",
  expiry_reminder: "clock",
  ticket_update: "headset",
};

Page(
  share.withShare({
    data: {
      navPad: "",
      tab: "ann",
      loading: true,
      err: "",
      retrying: false,
      category: "",
      filters: [],
      announcements: [],
      featured: null,
      truncated: false,
      annUnread: 0,
      messages: [],
      msgUnread: 0,
      subscribable: false,
    },

    onLoad() {
      this.setData(navVars());
    },

    onShow() {
      const tabBar = typeof this.getTabBar === "function" ? this.getTabBar() : null;
      if (tabBar) tabBar.setTab(3);
      // 订阅模板必须先 prefetch：requestSubscribeMessage 要紧跟用户点击，
      // 点击时才拉接口会因为「不是手势触发」被微信拒掉
      subscribe.prefetch().then(cfg => {
        const list = (cfg && cfg.templates) || [];
        this.setData({ subscribable: list.some(t => t.configured) });
      });
      this.load();
    },

    onPullDownRefresh() {
      this.load().then(() => wx.stopPullDownRefresh());
    },

    switchTab(e) {
      this.setData({ tab: e.currentTarget.dataset.tab });
    },

    filterCategory(e) {
      this.setData({ category: e.currentTarget.dataset.value || "" }, () => this.load());
    },

    async load() {
      this.setData({ retrying: true });
      try {
        const [ann, inbox] = await Promise.all([
          api.getAnnouncements(this.data.category, 20),
          api.getNotifications(false),
        ]);
        const items = ((ann && ann.items) || []).map(a => this.decorateAnn(a));
        // 置顶位取「重要且未读」的第一条；全都读过就不再占一整屏，直接进列表
        const featured = items.filter(a => a.importance === "重要" && !a.read)[0] || null;
        const app = getApp();
        if (app && app.globalData) {
          app.globalData.unread = (ann && ann.unread) || 0;
        }
        this.setData({
          loading: false,
          err: "",
          retrying: false,
          filters: [{ label: "全部", value: "" }].concat(
            ((ann && ann.categories) || []).map(c => ({ label: c.label, value: c.label }))
          ),
          announcements: featured ? items.filter(a => a.ann_no !== featured.ann_no) : items,
          featured,
          truncated: !!(ann && ann.truncated),
          annUnread: (ann && ann.unread) || 0,
          messages: ((inbox && inbox.items) || []).map(m => ({
            id: m.id,
            title: m.title,
            body: m.content,
            read_at: m.read_at,
            icon: EVENT_ICON[m.event_type] || "bell",
            timeText: d16(m.created_at),
          })),
          msgUnread: (inbox && inbox.unreadCount) || 0,
        });
        const tabBar = typeof this.getTabBar === "function" ? this.getTabBar() : null;
        if (tabBar) tabBar.syncUnread();
      } catch (e) {
        if (isAuthGateError(e)) return;
        log.error("notifications load", e.message);
        this.setData({ loading: false, retrying: false, err: e.message });
      }
    },

    decorateAnn(a) {
      const style = CATEGORY_STYLE[a.category] || { icon: "megaphone", tagColor: "purple" };
      return Object.assign({}, a, {
        icon: style.icon,
        tagColor: a.importance === "重要" ? "red" : style.tagColor,
        timeText: d16(a.publish_at),
      });
    },

    openAnn(e) {
      wx.navigateTo({ url: "/pages/message/index?annNo=" + e.currentTarget.dataset.no });
    },

    async readMsg(e) {
      const id = e.currentTarget.dataset.id;
      const msg = this.data.messages.find(m => m.id === id);
      if (!msg || msg.read_at) return;
      try {
        await api.readNotification(id);
        this.load();
      } catch (err) {
        log.warn("read notification", err.message);
      }
    },

    async readAll() {
      try {
        await api.readAllNotifications();
        toast("已全部标记为已读");
        this.load();
      } catch (err) {
        toast(err.message);
      }
    },

    /**
     * 开启微信服务通知。必须在 tap handler 里**同步**调用 subscribe.request——
     * 中间插入 await 会让微信判定不是手势触发而静默拒绝（表现是弹不出授权框、也不报错）。
     */
    requestSubscribe() {
      subscribe
        .request(["order_paid", "course_reminder", "expiry_reminder"])
        .then(r => {
          if (r.accepted > 0) toast("已开启，重要节点会通过微信提醒你");
          else if (r.configured === 0) toast("服务通知暂未开放，站内消息不受影响");
          else toast("未开启微信提醒，站内消息仍会照常送达");
        })
        .catch(err => log.warn("subscribe", err.message));
    },

    go(e) {
      const { url, tab } = e.currentTarget.dataset;
      if (!url) return;
      if (tab) wx.switchTab({ url });
      else wx.navigateTo({ url, fail: () => toast("页面暂不可用") });
    },
  })
);
