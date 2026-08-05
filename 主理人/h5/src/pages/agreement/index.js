import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 协议页：一个页面按 ?type=user|privacy|membership 渲染三份协议。
 * 正文常量在 content.js，本页只负责取文与设置标题。
 */
const { DOCS, OPERATOR, UPDATED_AT } = require('./content.js')
import './index.scss'
const VALID_TYPES = ['user', 'privacy', 'membership']
cacheOptions.setOptionsToCache({
  data: {
    title: '',
    intro: '',
    sections: [],
    operator: OPERATOR,
    updatedAt: UPDATED_AT,
    others: [], // 底部互跳入口（另外两份协议）
  },
  onLoad(options) {
    const type =
      VALID_TYPES.indexOf((options && options.type) || '') >= 0
        ? options.type
        : 'user'
    const doc = DOCS[type]
    this.setData({
      title: doc.title,
      intro: doc.intro,
      sections: doc.sections,
      others: VALID_TYPES.filter((t) => t !== type).map((t) => ({
        type: t,
        title: DOCS[t].title,
      })),
    })
    Taro.setNavigationBarTitle({
      title: doc.title,
    })
  },
  /** 底部互跳：用 redirectTo 避免协议之间反复 navigateTo 把页面栈堆满（上限 10 层） */
  goOther(e) {
    Taro.redirectTo({
      url: `/pages/agreement/index?type=${
        getTarget(e.currentTarget, Taro).dataset.type
      }`,
    })
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { title, updatedAt, operator, intro, sections, others } = this.data
    return (
      <View className="page page--sub">
        <View className="hd">
          <View className="hd-title">{title}</View>
          <View className="hd-sub">
            {'更新日期 ' + updatedAt + ' · 生效主体 ' + operator}
          </View>
        </View>
        <View className="card">
          <Text className="doc-intro">{intro}</Text>
        </View>
        {sections?.map((item, index) => {
          return (
            <View key={item.h} className="card">
              <View className="doc-h">{item.h}</View>
              {item.ps.map((p, index) => {
                return (
                  <View key={p} className="doc-p">
                    <Text className="t-body">{p}</Text>
                  </View>
                )
              })}
            </View>
          )
        })}
        {/*  另外两份协议的互跳入口  */}
        <View className="card doc-others">
          <View className="doc-h">相关协议</View>
          {others?.map((item, index) => {
            return (
              <View
                key={item.type}
                className="f-between doc-other-row"
                data-type={item.type}
                onClick={this.goOther}
              >
                <Text className="t-body">{'《' + item.title + '》'}</Text>
                <Text className="t-primary">查看</Text>
              </View>
            )
          })}
        </View>
        <View className="doc-foot">
          <Text className="t-muted">
            {'本页内容为 ' +
              title +
              ' 全文，如有疑问可在「我的 → 在线客服」咨询。'}
          </Text>
        </View>
      </View>
    )
  }
}
export default _C
