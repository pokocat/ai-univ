import withWeapp, { cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Image, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
import UiIcon from '../icon/index'
import './index.scss'
/**
 * ui-art：区块插画。
 *
 * 2026-08-03 起插画是**本地位图**（`/assets/art/<kind>.png`，420×420 带 alpha），
 * 不再是手绘 SVG。换掉的原因：上一版七个里有三个（gem/medallion/check）其实是同一个紫色
 * 立方体换着贴东西，trophy 淡到在奶油卡上几乎看不见——那是占位货，不是插画。
 * 现素材由 codex 的 imagegen skill 成套生成（统一材质/打光/视角/体量），
 * 经 chroma-key 去背 + 残留修复 + 128 色量化，七张合计 ~183KB。详见 CLAUDE.md 护栏 45。
 *
 * **对外 API 与上一版逐字相同**（kind/w/h/glyph/icon/check/variant/extStyle），
 * 所以 30 处调用一个字都没改。三条口径别动：
 *
 * ① **BOX 表保留各 kind 原来的宽高比**（gem 150×140、aicube 170×150…）。素材是正方形，
 *    靠 `mode="aspectFit"` 内嵌居中。这样布局盒子与上一版**逐字节一致**，
 *    30 处调用点的版式不会因为换素材而位移——改成正方形会让其中四个 kind 高出 7~14%。
 * ② **字形与图标由组件叠加，不烘进素材**。等级是 `LV3` 这类动态值，烘进图就得为每个等级
 *    出一张图；素材里也刻意没有文字（生成 brief 明确禁止），medallion 中心留了
 *    一块干净平面就是给它叠字用的。
 * ③ **`variant` 仍然接收但不再使用**。它原本用于给 SVG 渐变 id 加前缀防撞车，位图没这个问题。
 *    保留是因为 14 处调用点还在传它，删掉属性会让那些页面在开发者工具里报「未定义属性」。
 */
const KINDS = [
  'gem',
  'medallion',
  'check',
  'aigem',
  'aicube',
  'megaphone',
  'trophy',
]

/** 各 kind 的布局宽高比，沿用手绘版每个 builder 的 viewBox，见上面口径① */
const BOX = {
  gem: [150, 140],
  medallion: [120, 120],
  check: [150, 150],
  aigem: [160, 150],
  aicube: [170, 150],
  megaphone: [160, 140],
  trophy: [84, 84],
}

/** 中心叠加物相对宽度的比例，沿用手绘版 centerGlyph / centerIcon 的取值 */
const GLYPH_RATIO_MULTI = 0.25 // 「LV3」这类多字符
const GLYPH_RATIO_SINGLE = 0.33 // 单字符
const ICON_RATIO = 0.24
cacheOptions.setOptionsToCache({
  properties: {
    /** gem / medallion / check / aigem / aicube / megaphone / trophy */
    kind: {
      type: String,
      value: 'gem',
    },
    /** 宽高（rpx）；h 传 0 时按 BOX 的比例推算 */
    w: {
      type: Number,
      value: 210,
    },
    h: {
      type: Number,
      value: 0,
    },
    /** 中心叠加：字形优先于图标，check 优先于两者 */
    glyph: {
      type: String,
      value: '',
    },
    icon: {
      type: String,
      value: '',
    },
    check: {
      type: Boolean,
      value: false,
    },
    /** 已不再使用，仅为兼容存量调用点保留（见口径③） */
    variant: {
      type: String,
      value: '',
    },
    extStyle: {
      type: String,
      value: '',
    },
  },
  data: {
    box: '',
    src: '',
    glyphText: '',
    glyphSize: 0,
    overlayIcon: '',
    iconSize: 0,
  },
  observers: {
    'kind, w, h, glyph, icon, check, extStyle'() {
      this.renderArt()
    },
  },
  lifetimes: {
    attached() {
      this.renderArt()
    },
  },
  methods: {
    renderArt() {
      const { kind, w, h, glyph, icon, check, extStyle } = this.data
      if (KINDS.indexOf(kind) < 0) {
        // 未知 kind 直接隐藏而不是留一个空盒子——空盒子会把版式撑开，排查时看不出原因
        this.setData({
          box: 'display:none',
          src: '',
        })
        return
      }
      const [vw, vh] = BOX[kind]
      const height = h || Math.round((w * vh) / vw)
      const box = w
        ? `width:${w / 2}px;height:${height / 2}px;`
        : 'width:100%;height:100%;'
      const text = check ? '' : String(glyph || '')
      this.setData({
        box: box + 'flex-shrink:0;' + (extStyle || ''),
        src: '/assets/art/' + kind + '.png',
        glyphText: text,
        glyphSize: Math.round(
          w * (text.length > 1 ? GLYPH_RATIO_MULTI : GLYPH_RATIO_SINGLE)
        ),
        // check 这个 kind 的素材里已经画了对勾，所以只有「gem 上叠 check」才需要图标层
        overlayIcon: text
          ? ''
          : check && kind !== 'check'
          ? 'check'
          : icon || '',
        iconSize: Math.round(w * ICON_RATIO),
      })
    },
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { box, src, glyphText, glyphSize, overlayIcon, iconSize } = this.data
    return (
      <View className="art" style={box}>
        <Image className="art-img" src={src} mode="aspectFit"></Image>
        {/*  中心叠加物：字形优先，其次图标。素材里刻意没有文字，等级值是动态的，只能叠  */}
        {glyphText ? (
          <Text
            className="art-glyph"
            style={{
              fontSize: `${glyphSize / 40}rem`,
            }}
          >
            {glyphText}
          </Text>
        ) : (
          overlayIcon && (
            <View className="art-ico">
              <UiIcon
                name={overlayIcon}
                size={iconSize}
                color="on-signal"
              ></UiIcon>
            </View>
          )
        )}
      </View>
    )
  }
}
export default _C
