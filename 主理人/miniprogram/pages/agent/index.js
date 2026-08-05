/**
 * 我的团队（代理工作面，V39）。
 *
 * 只展示两块**中台真有的**数据：我名下的群（community_group.owner_member_id）与我服务归属的
 * 培训学员（training_enrollment.referrer_member_id）。
 *
 * 刻意不做分成/佣金板块：护栏 15——返佣永不进中台，中台只有 earnings_snapshot 只读镜像。
 * 摆一个算不出数的分成区块，比不摆更糟。收益仍在「我的收益」页（读那个镜像）。
 *
 * 页面全只读：代理在小程序里看进度，动手的操作（分班、改群）在管理台（referrer 角色）。
 */
const api = require("../../api/mp");
const { isAuthGateError } = require("../../utils/auth");
const { d10, toast } = require("../../utils/fmt");
const log = require("../../utils/log");
const share = require("../../behaviors/share");

/** 报名状态 → 展示分组（与后端 training_enrollment_status 字典同名，不自造标签） */
const STAGE_ORDER = ["待推荐人分班", "待运营分班", "已分班", "在训", "结业", "已取消"];

Page(share.withShare({
  data: {
    loading: true,
    loadError: "",
    retrying: false,
    available: false,
    hint: "",
    identity: "",
    groups: [],
    students: [],
    summary: null,
    stageTabs: [],
    stage: "全部",
  },

  onLoad() {
    this.load();
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh());
  },

  async retryLoad() {
    if (this.data.retrying) return;
    this.setData({ retrying: true });
    await this.load();
    this.setData({ retrying: false });
  },

  async load() {
    this.setData({ loading: true, loadError: "" });
    try {
      const p = await api.getAgentPortfolio();
      const students = (p.students || []).map(s => ({
        name: s.name,
        city: s.city || "",
        status: s.status,
        cohortName: s.cohort_name || "",
        groupName: s.group_name || "",
        // 时间取最靠后的那个已发生节点，避免一行里堆三个日期
        timeText: s.joined_at
          ? `入群 ${d10(s.joined_at)}`
          : s.assigned_at ? `分班 ${d10(s.assigned_at)}` : `报名 ${d10(s.created_at)}`,
      }));
      const present = STAGE_ORDER.filter(st => students.some(s => s.status === st));
      this.setData({
        available: !!p.available,
        hint: p.hint || "",
        identity: p.identity || "",
        groups: (p.groups || []).map(g => ({
          id: g.id,
          name: g.name,
          city: g.city || "",
          typeText: g.group_type,
          status: g.status,
          // 水位口径与管理台一致：已占用 + 生效预占 / 上限
          usedText: `${Number(g.member_count) + Number(g.reserved || 0)}/${g.target_capacity}`,
          full: Number(g.member_count) + Number(g.reserved || 0) >= Number(g.target_capacity),
        })),
        students,
        summary: p.summary || null,
        stageTabs: ["全部"].concat(present),
        stage: "全部",
      });
    } catch (e) {
      if (isAuthGateError(e)) return;
      log.warn("agent portfolio failed", e.message);
      this.setData({ loadError: e.message });
    } finally {
      this.setData({ loading: false });
    }
  },

  switchStage(e) {
    this.setData({ stage: e.currentTarget.dataset.stage });
  },

  copyGroupId(e) {
    const id = e.currentTarget.dataset.id;
    wx.setClipboardData({ data: id, success: () => toast(`已复制 ${id}`) });
  },
}));
