/**
 * 会员与续费（设计稿 12「续费提醒」）。
 *
 * 与设计稿的两处**故意不同**：
 *  ① 没有「AI 续费建议：可为您节省 ¥589，预计带来 2.8x 的成长效率提升」。
 *     那个 2.8x 没有任何计算依据；「省多少」有依据（划线价差），所以保留在套餐行上。
 *     拿一个编的倍数去劝人付费，是这套设计里最不该照抄的一处。
 *  ② 「续费后继续享受」六格来自真实权益目录，不是写死的六个词。
 *
 * 倒计时按**日历天**算，与到期日期同口径：两处口径不同会出现
 * 「到期 6.05、剩余 364 天」这种对不上的显示，用户会截图来问。
 */
const api = require("../../api/mp");
const { toast, money, d10 } = require("../../utils/fmt");
const { navVars } = require("../../utils/layout");
const { isAuthGateError } = require("../../utils/auth");
const pay = require("../../utils/pay");
const log = require("../../utils/log");

Page({
  data: {
    navPad: "",
    loading: true,
    err: "",
    retrying: false,
    active: false,
    tier: "",
    glyph: "",
    headline: "",
    expiryText: "",
    startText: "",
    currentPriceText: "",
    current: null,
    plans: [],
    selected: "",
    keep: [],
    cd: { d: "--", h: "--", m: "--" },
  },

  onLoad() {
    this.setData(navVars());
  },

  onShow() {
    this.load();
    this.startTick();
  },

  onHide() {
    this.stopTick();
  },

  onUnload() {
    this.stopTick();
  },

  startTick() {
    this.stopTick();
    // 分钟级刷新够了：秒级倒计时对「还有 12 天」这种量级没有意义，只是耗电
    this.timer = setInterval(() => this.tick(), 30000);
  },

  stopTick() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  tick() {
    const until = this.data.until;
    if (!until) return;
    const diff = new Date(until).getTime() - Date.now();
    if (diff <= 0) {
      this.setData({ cd: { d: "0", h: "0", m: "0" } });
      return;
    }
    this.setData({
      cd: {
        d: String(Math.floor(diff / 86400000)),
        h: String(Math.floor((diff % 86400000) / 3600000)).padStart(2, "0"),
        m: String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0"),
      },
    });
  },

  async load() {
    this.setData({ retrying: true });
    try {
      const [membership, benefits, growth] = await Promise.all([
        api.getMembership(),
        api.getBenefits(false),
        api.getGrowth(1),
      ]);
      const ios = api.platformChannel() === "ios";
      const active = !!(membership && membership.active);
      const current = membership && membership.currentPlan;
      const plans = ((membership && membership.renewPlans) || []).map(p => this.decoratePlan(p, ios));
      const recommended = plans.find(p => p.recommended) || plans[0];
      const daysLeft = membership && membership.days_left;
      this.setData({
        loading: false,
        err: "",
        retrying: false,
        active,
        tier: (membership && membership.tier) || "",
        glyph: growth && growth.level != null ? String(growth.level) : "",
        until: membership && membership.valid_until,
        expiryText: d10(membership && membership.valid_until),
        startText: d10(current && (current.paid_at || current.starts_at)),
        currentPriceText: current
          ? "¥" + money((ios && current.ios_price_cents != null ? current.ios_price_cents : current.price_cents) / 100)
          : "",
        current,
        plans,
        selected: recommended ? recommended.plan_code : "",
        // 「继续享受」只列当前可用的权益：把锁着的也列进来等于承诺续费能解锁更高档
        keep: (benefits || []).filter(b => b.available).slice(0, 6),
        headline: !active
          ? "尚未开通会员"
          : (daysLeft != null && daysLeft <= 30 ? "会员即将到期" : "会员有效中"),
      });
      this.tick();
    } catch (e) {
      if (isAuthGateError(e)) return;
      log.error("renewal load", e.message);
      this.setData({ loading: false, retrying: false, err: e.message });
    }
  },

  decoratePlan(p, ios) {
    const cents = ios && p.ios_price_cents != null ? p.ios_price_cents : p.price_cents;
    const list = p.list_price_cents;
    const save = list != null && list > cents ? (list - cents) / 100 : null;
    return Object.assign({}, p, {
      priceText: money(cents / 100),
      saveText: save == null ? "" : money(save),
    });
  },

  pick(e) {
    this.setData({ selected: e.currentTarget.dataset.code });
  },

  async renew() {
    if (!this.data.selected) {
      toast("请选择一个方案");
      return;
    }
    const cfg = await pay.config();
    if (cfg.disabled) {
      toast(cfg.hint);
      return;
    }
    wx.navigateTo({ url: "/pages/payment/index?planCode=" + this.data.selected });
  },

  go(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    if (/^\/pages\/(index|group|member|notifications|mine)\/index$/.test(url)) wx.switchTab({ url });
    else wx.navigateTo({ url, fail: () => toast("页面暂不可用") });
  },
});
