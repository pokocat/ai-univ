import withWeapp, { cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
import './index.scss'
/** 加载失败提示条：显示可读原因 + 重试入口，避免请求失败后页面变成无声空壳。 */
cacheOptions.setOptionsToCache({
  properties: {
    msg: {
      type: String,
      value: '',
    },
    retrying: {
      type: Boolean,
      value: false,
    },
  },
  methods: {
    retry() {
      this.triggerEvent('retry')
    },
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { msg, retrying } = this.data
    return (
      <View className="errbar">
        <View className="errbar-body">
          <View className="errbar-dot"></View>
          <View className="errbar-text">
            <Text className="errbar-title">加载失败</Text>
            <Text className="errbar-msg">{msg}</Text>
          </View>
          <View
            className={'errbar-btn ' + (retrying ? 'errbar-btn--busy' : '')}
            onClick={this.retry}
          >
            {retrying ? '重试中' : '重试'}
          </View>
        </View>
      </View>
    )
  }
}
export default _C
