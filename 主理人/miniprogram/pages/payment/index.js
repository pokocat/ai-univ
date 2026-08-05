/**
 * 支付确认（设计稿 10）。
 *
 * 与设计稿的三处**故意不同**（都关系到钱，不能靠界面撑场面）：
 *  ① 支付方式只列**服务端确认可用**的通道。设计稿画了微信/支付宝/银联三选，
 *     而系统只接了微信虚拟支付；摆出另外两个，点了必然失败。
 *  ② 没有「自动续费」开关（系统没有周期扣费能力），改为如实说明到期提醒口径。
 *  ③ 「优惠 -¥589」只在套餐真的配了 list_price_cents 时出现，不用现价反推假原价。
 *
 * 支付口径全部复用 utils/pay：下单 → 唤起 → **轮询回查**。
 * 微信 success 回调只代表微信侧扣款完成，权益以服务端回调为准，
 * 所以绝不能凭 success 就跳成功页——那会在回调失败时给用户一个假的「已开通」。
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
    planCode: "",
    plan: null,
    pay: { mode: "disabled", disabled: true, hint: "" },
    iosBlocked: false,
    paying: false,
  },

  onLoad(options) {
    this.alive = true;
    this.setData(Object.assign({ planCode: (options && options.planCode) || "" }, navVars()));
    this.load();
  },

  onUnload() {
    // 轮询要能停：对已卸载页面 setData 会告警，且没有意义
    this.alive = false;
  },

  async load() {
    this.setData({ retrying: true });
    try {
      const [membership, payCfg] = await Promise.all([api.getMembership(), pay.config()]);
      const ios = api.platformChannel() === "ios";
      const raw = ((membership && membership.renewPlans) || [])
        .find(p => p.plan_code === this.data.planCode);
      this.setData({
        loading: false,
        err: "",
        retrying: false,
        plan: raw ? this.decoratePlan(raw, ios) : null,
        pay: payCfg,
        iosBlocked: ios && payCfg.iosEnabled === false,
      });
    } catch (e) {
      if (isAuthGateError(e)) return;
      log.error("payment load", e.message);
      this.setData({ loading: false, retrying: false, err: e.message });
    }
  },

  decoratePlan(p, ios) {
    const cents = ios && p.ios_price_cents != null ? p.ios_price_cents : p.price_cents;
    const list = p.list_price_cents;
    const save = list != null && list > cents ? (list - cents) / 100 : null;
    return Object.assign({}, p, {
      priceText: money(cents / 100),
      listText: list == null ? "" : money(list / 100),
      saveText: save == null ? "" : money(save),
    });
  },

  async submit() {
    if (this.data.paying) return;
    if (this.data.pay.disabled) {
      toast(this.data.pay.hint);
      return;
    }
    if (this.data.iosBlocked) {
      toast("当前 iOS 通道尚未开放");
      return;
    }
    this.setData({ paying: true });
    try {
      const order = await api.createOrder(this.data.planCode);
      const orderNo = order.order_no || order.orderNo;
      if (!orderNo) throw new Error("下单未返回订单号，请稍后重试");
      const paid = await pay.payExistingOrder(orderNo, this.data.pay.mode, () => this.alive);
      if (!this.alive) return;
      if (paid) {
        // 只有服务端确认到账才跳成功页；否则留在本页并如实说「处理中」
        wx.redirectTo({ url: "/pages/success/index?orderNo=" + orderNo });
        return;
      }
      pay.notifyResult(false);
      this.setData({ paying: false });
    } catch (e) {
      this.setData({ paying: false });
      // 用户主动取消不弹提示（pay.js 打了 silent 标记）
      if (e && e.silent) return;
      log.error("payment submit", e.message);
      toast(e.message);
    }
  },

  backToPlans() {
    if (getCurrentPages().length > 1) wx.navigateBack();
    else wx.redirectTo({ url: "/pages/subscribe/index" });
  },
});
