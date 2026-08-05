/**
 * 会员订阅（设计稿 02）。
 *
 * 与设计稿的三处**故意不同**，都是诚实度问题：
 *  ① 没有「自动续费」开关。系统里没有周期扣费能力（membership_order 是一次性订单，
 *     到期由 runExpiry 置过期 + enqueueExpiryReminders 发提醒）。摆一个开关就是承诺
 *     一件做不到的事，而且它关系到钱。改为如实说明「到期提醒、不自动扣费」。
 *  ② 权益对比表的行来自 /mp/benefits（真实权益目录），不是写死的六行文案。
 *     普通会员那一列按 min_identity 是否为空判断——那正是「不需要付费档就能用」的定义。
 *  ③ 划线原价与「省多少」只在套餐真的配了 list_price_cents 时显示，
 *     不用现价反推一个假原价。
 *
 * 价格按平台取：iOS 有独立定价（对冲苹果税），取错会让结账金额与展示不一致。
 */
const api = require("../../api/mp");
const { toast, money } = require("../../utils/fmt");
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
    plans: [],
    compare: [],
    selected: "",
    pay: { mode: "disabled", disabled: true, hint: "" },
    iosBlocked: false,
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
      const [membership, benefits, payCfg] = await Promise.all([
        api.getMembership(),
        api.getBenefits(false),
        pay.config(),
      ]);
      const ios = api.platformChannel() === "ios";
      const plans = ((membership && membership.renewPlans) || []).map(p => this.decoratePlan(p, ios));
      const recommended = plans.find(p => p.recommended) || plans[0];
      this.setData({
        loading: false,
        err: "",
        retrying: false,
        plans,
        compare: (benefits || []).slice(0, 8).map(b => ({
          code: b.code,
          name: b.name,
          icon: b.icon,
          // min_identity 为空 = 不需要付费档就能用，即普通会员也有
          freeIncluded: !b.min_identity,
        })),
        selected: recommended ? recommended.plan_code : "",
        pay: payCfg,
        // iOS 通道未开放时**在这一页就说清楚**：等用户选完档、点了下一步才在支付页
        // 撞上「iOS 暂不可用」，那一步是白走的
        iosBlocked: ios && payCfg.iosEnabled === false,
      });
    } catch (e) {
      if (isAuthGateError(e)) return;
      log.error("subscribe load", e.message);
      this.setData({ loading: false, retrying: false, err: e.message });
    }
  },

  decoratePlan(p, ios) {
    const cents = ios && p.ios_price_cents != null ? p.ios_price_cents : p.price_cents;
    const days = p.duration_days;
    const unit = days >= 360 ? "/年" : (days >= 88 ? "/季" : (days >= 28 ? "/月" : ""));
    // 划线价按同平台口径比较：iOS 价与安卓原价相减会算出一个没有意义的「省」
    const list = p.list_price_cents;
    const save = list != null && list > cents ? (list - cents) / 100 : null;
    return Object.assign({}, p, {
      priceText: money(cents / 100),
      unitText: unit,
      durationText: days + " 天",
      saveText: save == null ? "" : money(save),
    });
  },

  pick(e) {
    this.setData({ selected: e.currentTarget.dataset.code });
  },

  next() {
    if (this.data.pay.disabled) {
      toast(this.data.pay.hint);
      return;
    }
    if (this.data.iosBlocked) {
      toast("当前 iOS 通道尚未开放，可在安卓/鸿蒙设备上开通");
      return;
    }
    if (!this.data.selected) {
      toast("请选择一个会员方案");
      return;
    }
    wx.navigateTo({ url: "/pages/payment/index?planCode=" + this.data.selected });
  },

  go(e) {
    const url = e.currentTarget.dataset.url;
    if (url) wx.navigateTo({ url, fail: () => toast("页面暂不可用") });
  },
});
