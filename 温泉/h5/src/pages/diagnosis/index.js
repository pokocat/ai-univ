import withWeapp, { cacheOptions } from '@tarojs/with-weapp'
import { Block, View, ScrollView } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
const { definePage, demo } = require('../../utils/page.js')
import Tabbar from '../../components/tabbar/index'
import './index.scss'
definePage({
  tab: 0,
  inlineTab: true,
  data: {
    dx: demo.diagnosis,
  },
})
cacheOptions.setOptionsToCache({})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { padTop, dx, tab } = this.data
    return (
      <View className="screen">
        <View
          className="statusbar"
          style={{
            height: `${padTop / 20}rem`,
          }}
        ></View>
        <View className="head">
          <View className="nav">
            <View className="nav__back hit" onClick={this.back}>
              <View className="ic ic-26 ic-back"></View>
            </View>
            <View className="title">经营诊断报告</View>
          </View>
        </View>
        <ScrollView className="body" scrollY enableFlex>
          <View className="stack stack--tight">
            <View className="card card--pad16">
              <View className="verdict">
                <View className="verdict__left">
                  <View className="kicker">{dx.regId}</View>
                  <View className="verdict__h">{dx.headline}</View>
                </View>
                <View className="verdict__score">
                  <View className="score__n">{dx.score}</View>
                  <View className="score__cap">健康分 / 100</View>
                </View>
              </View>
              <View className="hr hr--v"></View>
              <View className="lede">{dx.summary}</View>
            </View>
            {/*  三件能马上动手的事：每条都挂一个本 App 内的动作按钮  */}
            {dx.issues.map((item, index) => {
              return (
                <View className="card" key={item.no}>
                  <View className="issue__top">
                    <View
                      className={
                        'issue__no issue__no--' + (item.urgent ? 'r' : 'a')
                      }
                    >
                      {item.no}
                    </View>
                    <View className="h2">{item.title}</View>
                    {item.urgent && (
                      <View className="pill pill--r issue__flag">最急</View>
                    )}
                  </View>
                  <View className="body-s">{item.body}</View>
                  <View
                    className={
                      'act act--' + (item.tone === 'teal' ? 't' : 'p') + ' mt12'
                    }
                  >
                    <View className="act__body">
                      <View className="act__lead">{item.action}</View>
                      <View className="act__meta">{item.meta}</View>
                    </View>
                    <View
                      className={
                        'btn-s btn-s--' +
                        (item.tone === 'teal' ? 't' : 'p') +
                        ' hit'
                      }
                      data-url={item.route}
                      data-tab={item.tab}
                      onClick={this.goto}
                    >
                      {item.btn}
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        </ScrollView>
        <Tabbar selected={tab}></Tabbar>
      </View>
    )
  }
}
export default _C
