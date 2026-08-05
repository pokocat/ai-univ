import withWeapp, { cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text, Button } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 隐私授权弹层（半屏）。挂在会触发隐私接口的页面上：
 * 「我的」（昵称填写 input type=nickname / 手机号 getPhoneNumber）、
 * 「邀请」「课程」（wx.setClipboardData 复制）、首页（购买链路）。
 *
 * 同意必须由 <button open-type="agreePrivacyAuthorization"> 触发——
 * 这是微信规定的唯一合法同意入口，普通 tap 不算数。
 */
const privacy = require('../../utils/privacy.js')
import './index.scss'
cacheOptions.setOptionsToCache({
  data: {
    visible: false,
  },
  lifetimes: {
    attached() {
      // 保存函数引用，detached 时按引用注销
      this._show = () =>
        this.setData({
          visible: true,
        })
      privacy.bind(this._show)
    },
    detached() {
      privacy.unbind(this._show)
    },
  },
  methods: {
    /** 打开微信官方《小程序隐私保护指引》 */
    openContract() {
      if (!Taro.openPrivacyContract) {
        Taro.showToast({
          title: '当前微信版本不支持查看，请升级微信',
          icon: 'none',
        })
        return
      }
      Taro.openPrivacyContract({
        fail: () =>
          Taro.showToast({
            title: '打开失败，请稍后重试',
            icon: 'none',
          }),
      })
    },
    onDisagree() {
      this.setData({
        visible: false,
      })
      privacy.settle({
        event: 'disagree',
      })
    },
    onAgree() {
      this.setData({
        visible: false,
      })
      // buttonId 必须与 wxml 上按钮的 id 一致，微信据此校验同意来源
      privacy.settle({
        event: 'agree',
        buttonId: 'privacy-agree-btn',
      })
    },
    noop() {},
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { visible } = this.data
    return (
      visible && (
        <View className="pv-mask" onTouchMove={this.noop}>
          <View className="pv-body">
            <View className="pv-title">隐私保护指引</View>
            <View className="pv-text">
              在你使用昵称填写、手机号绑定、复制邀请码等功能前，需要你阅读并同意
              <Text className="pv-link" onClick={this.openContract}>
                《主理人公社小程序隐私保护指引》
              </Text>
              。同意后我们才会收集对应信息；你可以随时在微信「设置 → 隐私 →
              小程序」中撤回授权。
            </View>
            <View className="pv-btns">
              <Button
                className="pv-btn pv-btn--ghost"
                onClick={this.onDisagree}
              >
                拒绝
              </Button>
              <Button
                id="privacy-agree-btn"
                className="pv-btn pv-btn--primary"
                openType="agreePrivacyAuthorization"
                onAgreeprivacyauthorization={this.onAgree}
              >
                同意并继续
              </Button>
            </View>
          </View>
        </View>
      )
    )
  }
}
export default _C
