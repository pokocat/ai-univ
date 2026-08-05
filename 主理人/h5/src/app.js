import withWeapp, { cacheOptions } from "@tarojs/with-weapp";
import { Block } from "@tarojs/components";
import React from "react";
import Taro from "@tarojs/taro";
const {
  captureInviteCode,
  captureScanTicket,
  getToken,
  hasConsent,
  redirectToLogin
} = require("./utils/auth.js");
const privacy = require("./utils/privacy.js");
const log = require("./utils/log.js");
import "./app.scss";
cacheOptions.setOptionsToCache({
  globalData: {
    /** 支付通道配置缓存（GET /mp/pay/config），首页首次加载时写入 */
    payConfig: null,
    /**
     * 本人专属邀请码缓存（来自 GET /mp/invite）：
     * 供未拉过该接口的页面（社群/任务/收益/课程）拼分享路径做裂变归因，
     * 见 behaviors/share.js —— 不为一个分享参数在每页多打一次接口。
     */
    inviteCode: null
  },
  onLaunch(options) {
    // 裂变归因：冷启动即捕获邀请码（分享 path 查询参数 / 小程序码 scene）
    // 必须在跳登录页之前完成，否则分享链接直达内页时邀请码会丢
    captureInviteCode(options || {});
    // 管理台扫码登录票据同理要在跳登录页之前捕获：下面 gateLogin 会把新用户 reLaunch 到登录页，
    // 扫码页的 onLoad 参数随页面栈一起作废，只有存下来登录后才回得去（utils/auth captureScanTicket）
    captureScanTicket(options || {});
    if (process.env.TARO_ENV !== 'h5') privacy.init();
    this.checkUpdate();
    this.gateLogin();
  },
  onShow(options) {
    captureInviteCode(options || {});
    captureScanTicket(options || {});
  },
  /**
   * 登录门禁：从未同意协议的新用户直接送到登录页。
   * 注意判据是「无 token 且无同意标记」而不是单纯「无 token」——
   * 老用户 token 过期被清时仍应静默重登（见 auth.ensureLogin），不该被弹回登录页。
   * 这里只是提前跳转优化首屏；真正的兜底在 ensureLogin 里。
   */
  gateLogin() {
    if (process.env.TARO_ENV === 'h5') return;
    if (getToken() || hasConsent()) return;
    redirectToLogin();
  },
  /** 版本更新：新包下载完成后提示重启，避免用户长期停在旧版本 */
  checkUpdate() {
    if (process.env.TARO_ENV === 'h5') return;
    if (!Taro.getUpdateManager) return;
    const mgr = Taro.getUpdateManager();
    mgr.onUpdateReady(() => {
      Taro.showModal({
        title: "更新提示",
        content: "新版本已就绪，是否重启应用？",
        confirmText: "立即重启",
        cancelText: "稍后",
        success: r => {
          if (r.confirm) mgr.applyUpdate();
        }
      });
    });
    mgr.onUpdateFailed(() => {
      log.warn("update download failed");
    });
  }
});
@withWeapp(cacheOptions.getOptionsFromCache(), true)
class App extends React.Component {
  render() {
    return this.props.children;
  }
}
export default App;
