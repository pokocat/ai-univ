const { getTarget, cacheOptions } = require('@tarojs/with-weapp')
const Taro = require('@tarojs/taro')
const demo = require('./demo.js')

/**
 * 页面工厂：统一注入状态栏高度、底部安全区、tab 高亮，以及演示用的导航兜底。
 *
 * definePage({
 *   tab: 0,          // 属于哪个 tab（0–4）。tab 页会同步框架 tabBar 的高亮，
 *                    // 下钻页（02/04/07）用它给页内 <tabbar> 传 selected。
 *   inlineTab: true, // 该页自己渲染 tabbar（非 tabBar 页必须设）
 *   data / onLoad / onShow / 其他 Page 选项照常写
 * })
 */
function definePage(options) {
  const {
    tab = 0,
    inlineTab = false,
    data = {},
    onLoad,
    onShow,
    ...rest
  } = options
  return cacheOptions.setOptionsToCache(
    Object.assign({}, rest, {
      data: Object.assign(
        {
          padTop: 20,
          safeBottom: 0,
          tab,
          inlineTab,
          tw: demo.tweaks,
        },
        data
      ),
      onLoad(query) {
        const app = Taro.getApp()
        const g = (app && app.globalData) || {}
        this.setData({
          padTop: g.statusBarHeight || 20,
          safeBottom: g.safeBottom || 0,
        })
        if (onLoad) onLoad.call(this, query)
      },
      onShow() {
        // 框架 tabBar 的高亮只能在 tab 页里同步
        if (!inlineTab && typeof this.getTabBar === 'function') {
          const bar = this.getTabBar()
          if (bar)
            bar.setData({
              selected: tab,
            })
        }
        if (onShow) onShow.call(this)
      },
      /** 通用跳转：tab 页走 switchTab，其余走 navigateTo */
      goto(e) {
        const { url, tab: toTab } = getTarget(e.currentTarget, Taro).dataset
        if (!url) return
        if (toTab !== undefined && toTab !== '') {
          Taro.switchTab({
            url,
            fail: () =>
              Taro.reLaunch({
                url,
              }),
          })
        } else {
          Taro.navigateTo({
            url,
            fail: () =>
              Taro.reLaunch({
                url,
              }),
          })
        }
      },
      back() {
        const pages = Taro.getCurrentPages()
        if (pages && pages.length > 1) Taro.navigateBack()
        else
          Taro.switchTab({
            url: '/pages/mainline/index',
          })
      },
      /** 演示态提示：没接后端的按钮点了要有回响，别让老板以为卡住了 */
      toast(e) {
        const msg = (
          getTarget(e.currentTarget, Taro).dataset.msg || '演示版：该动作已记录'
        ).toString()
        Taro.showToast({
          title: msg,
          icon: 'none',
          duration: 1600,
        })
      },
    })
  )
}
module.exports = {
  definePage,
  demo,
}
