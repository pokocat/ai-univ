import withWeapp, { cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 页面品牌头（设计稿 components.jsx 的 AppHeader）。
 *
 * 37 个页面都要这一行，抄 37 遍必然漂移——上一版就是每页各写一遍页头，
 * 换一次品牌标记只换掉一半页面。
 *
 * 右侧 padding 按胶囊实测宽度留出：自定义导航下胶囊仍是原生渲染，
 * 不留的话品牌名会被它盖住（见 utils/layout 注释）。
 */
const { navVars } = require('../../utils/layout.js')
import UiIcon from '../icon/index'
import './index.scss'
cacheOptions.setOptionsToCache({
  options: {
    addGlobalClass: true,
  },
  properties: {
    title: {
      type: String,
      value: '主理人公社',
    },
    sub: {
      type: String,
      value: '',
    },
    logo: {
      type: Boolean,
      value: true,
    },
    pro: {
      type: Boolean,
      value: false,
    },
    ai: {
      type: Boolean,
      value: false,
    },
    gem: {
      type: Boolean,
      value: false,
    },
    big: {
      type: Boolean,
      value: false,
    },
    compact: {
      type: Boolean,
      value: false,
    },
  },
  data: {
    navPad: '',
    capsuleW: 94,
  },
  lifetimes: {
    attached() {
      const v = navVars()
      this.setData({
        navPad: v.navPad,
        capsuleW: v.navCapsuleW,
      })
    },
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { navPad, capsuleW, logo, compact, big, title, pro, ai, gem, sub } =
      this.data
    return (
      <View className="apphead" style={navPad}>
        <View
          className="app-head"
          style={{
            paddingRight: `${capsuleW / 40}rem`,
          }}
        >
          {logo && (
            <View className={'app-logo ' + (compact ? 'app-logo--sm' : '')}>
              <UiIcon
                name="gem"
                size={compact ? 32 : 40}
                color="signal-200"
                stroke={1.3}
              ></UiIcon>
            </View>
          )}
          <View className="app-brand">
            <View className="app-brand-row">
              <Text className={'app-name ' + (big ? 'app-name--lg' : '')}>
                {title}
              </Text>
              {pro && <Text className="badge-pro">PRO</Text>}
              {ai && <Text className="badge-ai">AI</Text>}
              {gem && (
                <View className="gem-mini">
                  <UiIcon name="gem" size={26} color="signal"></UiIcon>
                </View>
              )}
            </View>
            {sub && <Text className="app-sub">{sub}</Text>}
          </View>
        </View>
      </View>
    )
  }
}
export default _C
