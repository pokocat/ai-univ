/**
 * 小程序客服统一入口。
 *
 * 旧实现使用 button open-type="contact"，它连接的是“小程序客服消息”，不是企微客服；
 * 未在小程序后台添加客服人员时，真机上可能表现为点了无反馈。现在优先使用企微官方
 * wx.openCustomerServiceChat（后台按项目配置 corpId + kfid 链接），失败或未配置时
 * 明确给出去社群找服务老师的兜底，不让用户落进死按钮。
 */
const api = require("../api/mp");
const log = require("./log");

async function goGroupFallback(reason) {
  const result = await wx.showModal({
    title: "联系服务老师",
    content: reason || "微信客服暂未接通。你可以先到「我的社群」查看入群入口，并在群里联系服务老师。",
    confirmText: "去我的社群",
    cancelText: "稍后再说",
  });
  if (result.confirm) {
    wx.switchTab({ url: "/pages/group/index" });
  }
}

async function open() {
  try {
    const config = await api.getCustomerService();
    if (!config || !config.configured) {
      await goGroupFallback();
      return;
    }
    if (!wx.openCustomerServiceChat) {
      await goGroupFallback("当前微信版本不支持打开微信客服，请升级微信；也可以先去「我的社群」联系服务老师。");
      return;
    }
    wx.openCustomerServiceChat({
      corpId: config.corpId,
      extInfo: { url: config.url },
      fail: async err => {
        log.warn("open customer service failed", err && err.errMsg ? err.errMsg : "unknown");
        await goGroupFallback("微信客服打开失败。你可以先到「我的社群」查看入群入口，并在群里联系服务老师。");
      },
    });
  } catch (e) {
    log.warn("customer service config unavailable", e && e.message ? e.message : "unknown");
    await goGroupFallback("客服配置暂时无法读取。你可以先到「我的社群」联系服务老师。");
  }
}

module.exports = { open };
