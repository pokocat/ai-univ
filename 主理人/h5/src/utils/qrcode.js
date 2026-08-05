const Taro = require('@tarojs/taro')
const { toast } = require('./fmt.js')

/**
 * 微信官方全屏图片预览层支持长按识别普通群码、互通群码与企微个人码。
 * 页面内直接长按 <image> 只保证图片菜单，不保证出现「识别二维码」。
 */
function preview(url) {
  if (!url) {
    toast('二维码暂不可用，请稍后刷新')
    return
  }
  Taro.previewImage({
    current: url,
    urls: [url],
    showmenu: true,
    fail: () => toast('二维码打开失败，请保存图片后从微信扫一扫识别'),
  })
}
module.exports = {
  preview,
}
