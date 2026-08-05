import withWeapp, { cacheOptions } from '@tarojs/with-weapp'
import { Block, View } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 环形读数（设计稿 MetricRing / CircPct 的合并实现）。
 *
 * 与 components/art 同一口径：SVG data-URI，无滤镜、无网络。
 * 中心文字放在环内（设计稿 MetricRing 把维度名放环内、数值放环下，
 * 环下那行由页面自己排版——组件只负责画环，避免为两种排版各开一个组件）。
 */
const { resolve } = require('../../utils/icons.js')
import './index.scss'
cacheOptions.setOptionsToCache({
  properties: {
    /** 0-100 */
    pct: {
      type: Number,
      value: 0,
    },
    /** 直径（rpx） */
    size: {
      type: Number,
      value: 100,
    },
    /** 环色：token 名或 # 字面值 */
    color: {
      type: String,
      value: 'signal-600',
    },
    /** 环粗（相对 viewBox 的 58 基准，默认 4） */
    weight: {
      type: Number,
      value: 4,
    },
    /** 环内文字（维度名或百分比） */
    label: {
      type: String,
      value: '',
    },
    /** 环内文字字号（viewBox 单位） */
    labelSize: {
      type: Number,
      value: 9,
    },
    labelColor: {
      type: String,
      value: 'ink-600',
    },
    extStyle: {
      type: String,
      value: '',
    },
  },
  data: {
    ringStyle: '',
  },
  observers: {
    'pct, size, color, weight, label, labelSize, labelColor, extStyle'() {
      this.renderRing()
    },
  },
  lifetimes: {
    attached() {
      this.renderRing()
    },
  },
  methods: {
    renderRing() {
      const {
        pct,
        size,
        color,
        weight,
        label,
        labelSize,
        labelColor,
        extStyle,
      } = this.data
      const r = 22
      const c = 2 * Math.PI * r
      const safe = Math.max(0, Math.min(100, Number(pct) || 0))
      const offset = (c * (1 - safe / 100)).toFixed(2)
      const hex = resolve(color)
      const lhex = resolve(labelColor)
      const text = label
        ? `<text x="29" y="${
            29 + labelSize / 3
          }" text-anchor="middle" font-size="${labelSize}" ` +
          `fill="${lhex}" font-family="ui-monospace, monospace">${label}</text>`
        : ''
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 58 58" fill="none">` +
        `<circle cx="29" cy="29" r="${r}" fill="none" stroke="rgba(120,86,150,0.14)" stroke-width="${weight}"/>` +
        `<circle cx="29" cy="29" r="${r}" fill="none" stroke="${hex}" stroke-width="${weight}" ` +
        `stroke-linecap="round" stroke-dasharray="${c.toFixed(
          2
        )}" stroke-dashoffset="${offset}" ` +
        `transform="rotate(-90 29 29)"/>` +
        text +
        `</svg>`
      this.setData({
        ringStyle:
          `width:${size / 2}px;height:${size / 2}px;` +
          `background-image:url("data:image/svg+xml,${encodeURIComponent(
            svg
          )}");` +
          `background-size:100% 100%;background-repeat:no-repeat;flex-shrink:0;` +
          (extStyle || ''),
      })
    },
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { ringStyle } = this.data
    return <View className="ring" style={ringStyle}></View>
  }
}
export default _C
