import withWeapp, { cacheOptions } from '@tarojs/with-weapp'
import { Block, View } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 线性图标组件（设计稿 24×24 / 1.7 描边，SVG data-URI 渲染）。
 *
 * WXML 不支持内联 SVG，用 background-image 承载；颜色/实心烘焙进 URI。
 * size 单位 rpx（750 设计稿基准）。
 *
 * 路径里的 `{C}` 是颜色占位符，渲染时替换成解析后的字面色值——
 * 少数图标（more/chat/play）内部既有描边件也有实心件，用占位符就能就地写死 fill，
 * 不必为它们另开一套「实心图标」分支。
 */
const { svgUri } = require('../../utils/icons.js')
import './index.scss'
cacheOptions.setOptionsToCache({
  properties: {
    name: {
      type: String,
      value: '',
    },
    size: {
      type: Number,
      value: 32,
    },
    // rpx
    /** token 名（见上方 TOKENS）；传 # 开头的字面值亦可，但新代码不要这么写 */
    color: {
      type: String,
      value: 'ink-600',
    },
    /** 实心（如评分星、已选态） */
    fill: {
      type: Boolean,
      value: false,
    },
    /** 描边粗细，默认 1.7（设计稿口径） */
    stroke: {
      type: Number,
      value: 1.7,
    },
    extStyle: {
      type: String,
      value: '',
    },
  },
  data: {
    iconStyle: '',
  },
  observers: {
    'name, size, color, fill, stroke, extStyle'() {
      this.renderIcon()
    },
  },
  lifetimes: {
    attached() {
      this.renderIcon()
    },
  },
  methods: {
    renderIcon() {
      const { name, size, color, fill, stroke, extStyle } = this.data
      // data-URI 由 utils/icons 的 svgUri 统一生成（含光学归一 + 描边补偿），
      // 这里**不要**再自己拼 svg——custom-tab-bar 曾各拼一份，两处大小就此分叉。
      const uri = svgUri(name, {
        color,
        stroke,
        fill,
      })
      if (!uri) {
        this.setData({
          iconStyle: 'display:none',
        })
        return
      }
      const style =
        `width:${size / 2}px;height:${size / 2}px;` +
        `background-image:url("${uri}");` +
        `background-size:100% 100%;background-repeat:no-repeat;flex-shrink:0;` +
        (extStyle || '')
      this.setData({
        iconStyle: style,
      })
    },
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { iconStyle } = this.data
    return <View className="ico" style={iconStyle}></View>
  }
}
export default _C
