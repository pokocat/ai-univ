import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
import './index.scss'
const TABS = [
  {
    key: 'line',
    label: '主线',
    path: '/pages/mainline/index',
  },
  {
    key: 'clip',
    label: '出片',
    path: '/pages/studio/index',
  },
  {
    key: 'asset',
    label: '资产',
    path: '/pages/assets/index',
  },
  {
    key: 'crowd',
    label: '社群',
    path: '/pages/crowd/index',
  },
  {
    key: 'me',
    label: '我的',
    path: '/pages/ledger/index',
  },
]
cacheOptions.setOptionsToCache({
  options: {
    addGlobalClass: true,
  },
  properties: {
    // 当前高亮的 tab 下标（0–4）
    selected: {
      type: Number,
      value: 0,
    },
  },
  data: {
    tabs: TABS,
    safeBottom: 0,
  },
  attached() {
    const app = Taro.getApp()
    if (app && app.globalData) {
      this.setData({
        safeBottom: app.globalData.safeBottom || 0,
      })
    }
  },
  methods: {
    onTap(e) {
      const i = getTarget(e.currentTarget, Taro).dataset.i
      if (i === this.data.selected) return
      Taro.switchTab({
        url: TABS[i].path,
        fail: () =>
          Taro.reLaunch({
            url: TABS[i].path,
          }),
      })
    },
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { safeBottom, tabs, selected } = this.data
    return (
      <View
        className="tabbar"
        style={{
          paddingBottom: `${safeBottom / 20}rem`,
        }}
      >
        {tabs.map((item, index) => {
          return (
            <View
              key={item.key}
              className="tabbar__item hit"
              data-i={index}
              onClick={this.onTap}
            >
              <View
                className={
                  'ic ic-18 ic-tab-' +
                  item.key +
                  (index === selected ? '-on' : '')
                }
              ></View>
              <View
                className={
                  'tabbar__label ' + (index === selected ? 'is-on' : '')
                }
              >
                {item.label}
              </View>
            </View>
          )
        })}
      </View>
    )
  }
}
export default _C
