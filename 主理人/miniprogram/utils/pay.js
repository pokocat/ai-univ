/**
 * 支付通道（首页「开通会员」与「我的」页「继续支付」共用）。
 *
 * 通道模式由后端 GET /mp/pay/config 裁定，前端不猜环境：
 * - mock：演示支付（下单后直接置已支付），仅 dev profile 提供该端点
 * - xpay：微信虚拟支付 wx.requestVirtualPayment + 订单轮询
 * - disabled：通道未开通（拉取失败也按此处理，fail-closed——
 *   宁可显示「支付通道开通中」，也不要把用户送进一个必然失败的支付流程）
 *
 * 抽出来的原因：支付中断后的续付要和首次购买走**完全相同**的签名与轮询口径，
 * 两处各写一份迟早会漂移（比如一处忘了轮询就报成功）。
 */
const api = require("../api/mp");
const log = require("./log");

/** 轮询节奏：1s × 12 次 ≈ 12s，覆盖虚拟支付回调的正常时延 */
const POLL_INTERVAL_MS = 1000;
const POLL_MAX = 12;

const HINT = {
  mock: "当前为演示支付（Mock）；正式版走微信虚拟支付",
  xpay: "由微信虚拟支付提供，支付成功后权益立即生效",
  disabled: "支付通道开通中，请稍后再来",
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 拉一次支付通道配置并缓存到 app.globalData（整个生命周期只请求一次）。
 * @returns {Promise<{mode:string, iosEnabled:boolean, hint:string, disabled:boolean}>}
 */
async function config() {
  const app = getApp();
  let cfg = app.globalData.payConfig;
  if (!cfg) {
    try {
      cfg = await api.getPayConfig();
      app.globalData.payConfig = cfg;
    } catch (e) {
      log.warn("pay config unavailable", e.message);
      cfg = { mode: "disabled", iosEnabled: false };
    }
  }
  const mode = cfg.mode === "mock" || cfg.mode === "xpay" ? cfg.mode : "disabled";
  return { mode, iosEnabled: cfg.iosEnabled !== false, hint: HINT[mode], disabled: mode === "disabled" };
}

/**
 * 微信虚拟支付：signData 是后端签好的 JSON 字符串，必须原样透传（改一个字节签名即失效）。
 * 用户主动取消时抛出带 silent 标记的错误，调用方据此静默处理、不弹提示。
 */
async function requestVirtualPayment(orderNo) {
  const sig = await api.getPaySig(orderNo);
  await new Promise((resolve, reject) => {
    if (!wx.requestVirtualPayment) {
      reject(new Error("当前微信版本不支持虚拟支付，请升级微信后重试"));
      return;
    }
    wx.requestVirtualPayment({
      signData: sig.signData,
      paySig: sig.paySig,
      signature: sig.signature,
      mode: sig.mode || "goods",
      success: () => resolve(),
      fail: err => {
        const msg = (err && err.errMsg) || "支付失败";
        if (msg.indexOf("cancel") >= 0) {
          const canceled = new Error("已取消支付");
          canceled.silent = true;
          reject(canceled);
          return;
        }
        log.warn("virtual pay fail", orderNo, msg);
        reject(new Error("支付未完成，请稍后重试"));
      },
    });
  });
}

/**
 * 轮询订单状态直到「已支付」。
 * 微信 success 回调只代表**微信侧扣款完成**，权益以我们收到的服务端回调为准，故必须回查。
 * 超时不当作失败——钱可能已经扣了，只是回调慢；引导用户去订单列表确认。
 * @param {() => boolean} alive 页面是否还在（已销毁则停止轮询，避免对已卸载页面 setData）
 * @returns {Promise<boolean>} 是否已确认到账
 */
async function pollPaid(orderNo, alive) {
  for (let i = 0; i < POLL_MAX; i++) {
    await sleep(POLL_INTERVAL_MS);
    if (alive && !alive()) return false;
    try {
      const o = await api.getOrder(orderNo);
      if (o && o.status === "已支付") return true;
    } catch (e) {
      // 单次查询失败（弱网）不中断轮询，继续下一轮
      log.warn("poll order fail", orderNo, e.message);
    }
  }
  return false;
}

/**
 * 对一张**已存在**的待支付订单发起支付并确认结果（首次购买与续付共用）。
 * @param {string} orderNo 订单号
 * @param {string} mode config().mode
 * @param {() => boolean} alive 页面存活判定
 * @returns {Promise<boolean>} true=已确认到账；false=已扣款但回调未到（调用方提示"处理中"）
 */
async function payExistingOrder(orderNo, mode, alive) {
  if (mode === "xpay") {
    await requestVirtualPayment(orderNo);
    return pollPaid(orderNo, alive);
  }
  // 显式挡住 disabled/未知模式：不能让它顺着 else 掉进演示支付分支——
  // 生产 /mp/orders/{no}/pay 是 fail-closed 的，掉进去只会拿到一个看不懂的 403。
  if (mode !== "mock") {
    throw new Error("支付通道开通中，请稍后再试");
  }
  // Mock 支付：直接置已支付（仅 dev profile 提供该端点）
  await api.payOrder(orderNo);
  return true;
}

/** 支付结果的统一提示（到账 toast / 处理中 modal），两个页面表现一致 */
function notifyResult(paid) {
  if (paid) {
    wx.showToast({ title: "开通成功，权益已生效", icon: "success" });
    return;
  }
  wx.showModal({
    title: "支付处理中",
    content: "支付处理中，稍后在「我的 - 订单」查看",
    showCancel: false,
    confirmText: "知道了",
  });
}

module.exports = { config, payExistingOrder, pollPaid, notifyResult, HINT };
