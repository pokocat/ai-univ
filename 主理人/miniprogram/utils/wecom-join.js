const { toast } = require("./fmt");

/** 企微官方「加入群聊」插件回调。状态只用于解释失败，绝不在客户端伪造已入群。 */
function complete(event) {
  const detail = (event && event.detail) || {};
  const code = Number(detail.errcode || 0);
  if (!code) return code;
  const messages = {
    [-3002]: "群聊入口获取失败，请稍后刷新",
    [-3004]: "需要完成微信授权后才能加入群聊",
    [-3005]: "入群信息发送失败，请稍后重试",
    [-3006]: "你已经加入这个群聊",
    [-3009]: "当前群聊已满，请联系服务老师",
    [-3010]: "当前群聊已解散，请联系服务老师",
    [-3011]: "当前微信暂时无法加入该群聊",
    [-3012]: "你已在群聊中",
  };
  toast(messages[code] || "群聊入口暂不可用，请稍后重试");
  return code;
}

module.exports = { complete };
