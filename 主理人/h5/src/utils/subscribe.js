const Taro = require('@tarojs/taro')
/**
 * 微信一次性订阅消息授权。
 *
 * requestSubscribeMessage 必须紧跟用户点击调用；不能先发网络请求再弹授权框。
 * 因此页面 onShow 先 prefetch，按钮点击时只读内存缓存并立即调用微信 API。
 * 授权失败/拒绝不阻断支付等主业务，后台仍会写站内消息。
 */
const api = require('../api/mp.js')
const log = require('./log.js')
let cached = null
let loading = null
async function prefetch(force) {
  if (cached && !force) return cached
  if (loading && !force) return loading
  loading = api
    .getNotificationTemplates()
    .then((data) => {
      cached = data || {
        templates: [],
      }
      return cached
    })
    .catch((err) => {
      log.warn('notification templates unavailable', err.message)
      return {
        templates: [],
      }
    })
    .finally(() => {
      loading = null
    })
  return loading
}
function configured(keys) {
  const wanted = Array.isArray(keys) ? keys : [keys]
  return ((cached && cached.templates) || [])
    .filter((t) => t.configured && wanted.indexOf(t.key) >= 0 && t.templateId)
    .slice(0, 5)
}

/**
 * 必须从 tap/click handler 直接调用；函数内部在第一个 await 前就执行 wx.requestSubscribeMessage。
 * 返回 accepted 数，拒绝/关闭面板返回 0，不抛错打断主业务。
 */
function request(keys) {
  const templates = configured(keys)
  if (!templates.length || !Taro.requestSubscribeMessage)
    return Promise.resolve({
      accepted: 0,
      configured: templates.length,
    })
  const tmplIds = templates.map((t) => t.templateId)
  return new Promise((resolve) => {
    Taro.requestSubscribeMessage({
      tmplIds,
      success: async (result) => {
        const results = tmplIds.map((templateId) => ({
          templateId,
          status: result[templateId] || 'reject',
        }))
        try {
          const saved = await api.recordNotificationSubscriptions(results)
          resolve({
            accepted: saved.accepted || 0,
            configured: templates.length,
          })
        } catch (err) {
          log.warn('record notification subscription failed', err.message)
          resolve({
            accepted: 0,
            configured: templates.length,
          })
        }
      },
      fail: (err) => {
        log.warn('requestSubscribeMessage failed', err && err.errMsg)
        resolve({
          accepted: 0,
          configured: templates.length,
        })
      },
    })
  })
}
function clear() {
  cached = null
  loading = null
}
module.exports = {
  prefetch,
  request,
  configured,
  clear,
}
