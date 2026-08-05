/** 任务页（对齐设计稿 TaskTab）：头区进度条 + 打卡得积分（member_task + points_ledger，全真实）。 */
const api = require("../../api/mp");
const { isAuthGateError } = require("../../utils/auth");
const { d10, toast } = require("../../utils/fmt");
const share = require("../../behaviors/share");

/**
 * 优先级 → 标签修饰类。
 * 这里下发**类名**而不是色值：色值散进 JS 就绕开了 app.wxss 的调色板，
 * 换主题时改不到（上一版正是这么漂移的）。
 */
const PRIORITY_TAG = {
  高: "tag--red",
  中: "tag--amber",
  低: "",       // 默认朱砂
};

Page(share.withShare({
  data: {
    loadError: "",
    retrying: false,
    loaded: false,
    tasks: [],
    doneCount: 0,
    total: 0,
    donePoints: 0,
    pct: 0,
    busyId: 0,
  },

  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    this.load();
  },

  async onPullDownRefresh() {
    await this.load();
    wx.stopPullDownRefresh();
  },

  /** 错误条重试入口 */
  async retryLoad() {
    if (this.data.retrying) return;
    this.setData({ retrying: true });
    await this.load();
    this.setData({ retrying: false });
  },

  async load() {
    if (this.data.loadError) this.setData({ loadError: "" });
    try {
      const list = await api.getTasks();
      const tasks = (list || []).map(t => ({
        id: t.id,
        title: t.title,
        done: !!t.done,
        typeText: t.task_type,
        tagClass: PRIORITY_TAG[t.priority] !== undefined ? PRIORITY_TAG[t.priority] : "tag--gray",
        urgent: t.priority === "高",
        deadlineText: t.deadline ? d10(t.deadline) : "",
        points: t.points || 0,
      }));
      const done = tasks.filter(t => t.done);
      this.setData({
        loaded: true,
        tasks,
        doneCount: done.length,
        total: tasks.length,
        donePoints: done.reduce((s, t) => s + t.points, 0),
        pct: tasks.length ? Math.round((done.length / tasks.length) * 100) : 0,
      });
    } catch (e) {
      if (isAuthGateError(e)) return; // 未同意协议：已跳登录页，不再打扰
      this.setData({ loadError: e.message, retrying: false });
      toast(e.message);
    }
  },

  async complete(e) {
    const id = Number(e.currentTarget.dataset.id);
    const t = this.data.tasks.find(x => x.id === id);
    if (!t || t.done || this.data.busyId) return;
    this.setData({ busyId: id });
    try {
      const r = await api.completeTask(id);
      wx.showToast({
        title: r.pointsAwarded > 0 ? `+${r.pointsAwarded} 积分，余额 ${r.pointsBalance}` : "已完成",
        icon: "success",
      });
      await this.load();
    } catch (e2) {
      toast(e2.message);
    } finally {
      this.setData({ busyId: 0 });
    }
  },
}));
