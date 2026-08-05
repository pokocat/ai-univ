/**
 * 成长值明细（设计稿 16「成长积分」）。
 *
 * 设计稿把它叫「积分」，库里叫「成长值」（`growth_ledger`）——**是同一个东西**。
 * 刻意不为「积分」再开一套账：两套账会立刻产生「哪个是真的」这个没人能回答的问题
 * （`points_ledger` 自 V1 建表起从未被写入，正是这种历史遗留）。
 * 界面统一用「成长值」这个词，与服务端和运营后台一致。
 *
 * 环比在上月为 0 时不显示：从 0 涨到 500 的「增长率」没有意义。
 */
const api = require("../../api/mp");
const { toast, money, d16 } = require("../../utils/fmt");
const { navVars } = require("../../utils/layout");
const { isAuthGateError } = require("../../utils/auth");
const log = require("../../utils/log");

/** 流水来源 → 图标。未登记的来源回落 star2，不留空图标位 */
const REASON_ICON = {
  邀请成功: "members",
  邀请入会: "members",
  课程签到: "calendar",
  完成作业: "doc",
  社群发言: "chat",
  续费会员: "crown",
  任务完成: "shield",
  期初迁移: "refresh",
};

Page({
  data: {
    navPad: "",
    loading: true,
    err: "",
    retrying: false,
    growth: null,
    perks: [],
  },

  onLoad() {
    this.setData(navVars());
  },

  onShow() {
    this.load();
  },

  async load() {
    this.setData({ retrying: true });
    try {
      const g = await api.getGrowth(50);
      this.setData({
        loading: false,
        err: "",
        retrying: false,
        growth: this.decorate(g),
        perks: Array.isArray(g.levelPerks) ? g.levelPerks : [],
      });
    } catch (e) {
      if (isAuthGateError(e)) return;
      log.error("points load", e.message);
      this.setData({ loading: false, retrying: false, err: e.message });
    }
  },

  decorate(g) {
    return Object.assign({}, g, {
      growthText: money(g.growth),
      remainText: g.remaining == null ? "—" : money(g.remaining),
      monthText: money(g.monthDelta || 0),
      levelText: g.level == null ? "—" : "LV." + g.level,
      pctStyle: "width:" + (g.progressPct || 0) + "%",
      nextHint: g.topLevel
        ? "已达最高等级"
        : (g.nextLevel != null ? "升到 LV." + g.nextLevel + " 所需" : "等级阶梯未配置"),
      // 上月为 0 时不给环比：那个百分比没有意义
      rateText: g.monthGrowthRate == null
        ? "上月无记录，暂不比较"
        : "较上月 " + (g.monthGrowthRate >= 0 ? "↑" : "↓") + Math.abs(g.monthGrowthRate) + "%",
      ledger: (g.ledger || []).map(r => ({
        id: r.id,
        reason: r.reason,
        refText: r.ref_type ? "来源：" + r.ref_type : "",
        timeText: d16(r.created_at),
        delta: r.delta,
        deltaText: (r.delta >= 0 ? "+" : "") + money(r.delta),
        icon: REASON_ICON[r.reason] || "star2",
      })),
    });
  },

  go(e) {
    const url = e.currentTarget.dataset.url;
    if (url) wx.navigateTo({ url, fail: () => toast("页面暂不可用") });
  },
});
