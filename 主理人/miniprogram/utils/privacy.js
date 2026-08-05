/**
 * 隐私授权协调器（微信官方 __usePrivacyCheck__ 流程）。
 *
 * 机制：app.json 打开 __usePrivacyCheck__ 后，用户首次调用隐私相关接口
 * （昵称填写 / 手机号 / 剪切板等）时微信不会直接放行，而是回调
 * wx.onNeedPrivacyAuthorization(resolve)，等业务侧弹层拿到用户表态后再 resolve。
 *
 * 由于 onNeedPrivacyAuthorization 只能全局注册一次（app.onLaunch），而弹层要挂在页面上，
 * 这里做一个中转：app 注册 → 暂存 resolve → 通知当前页面挂载的 <ui-privacy> 展示 →
 * 用户点「同意/拒绝」→ settle() 回调 resolve。
 *
 * 兜底：若当前页面没有挂弹层，直接按「拒绝」结束——否则隐私接口会永久挂起，
 * 用户看到的是「点了没反应」，比明确拒绝更难排查。
 */
const log = require("./log");

/** 待表态的 resolve（同一时刻最多一个；微信会把并发请求合并） */
let pending = null;
/** 已挂载的弹层展示回调栈（页面 attached 入栈、detached 出栈） */
let showers = [];

/** app.onLaunch 调用一次 */
function init() {
  if (!wx.onNeedPrivacyAuthorization) return; // 基础库过低：微信不会拦截，无需处理
  wx.onNeedPrivacyAuthorization(resolve => {
    pending = resolve;
    const show = showers[showers.length - 1];
    if (show) {
      show();
    } else {
      log.warn("privacy: 当前页面未挂载隐私弹层，按拒绝处理");
      settle({ event: "disagree" });
    }
  });
}

/** 弹层组件 attached 时注册 */
function bind(show) {
  showers.push(show);
}

/** 弹层组件 detached 时注销（按引用移除，避免误清掉其他页面的弹层） */
function unbind(show) {
  showers = showers.filter(f => f !== show);
}

/** 用户表态后回调微信；重复调用无副作用 */
function settle(result) {
  const resolve = pending;
  pending = null;
  if (resolve) resolve(result);
}

module.exports = { init, bind, unbind, settle };
