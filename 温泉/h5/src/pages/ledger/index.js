import withWeapp, { cacheOptions } from '@tarojs/with-weapp'
import { Block, View, ScrollView, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
import Tabbar from '../../components/tabbar/index'
const { definePage, demo } = require('../../utils/page.js')
import './index.scss'
definePage({
  tab: 4,
  data: {
    l: demo.ledger,
  },
})
cacheOptions.setOptionsToCache({})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { padTop, l, safeBottom } = this.data
    return (
      <View className="screen">
        <View
          className="statusbar"
          style={{
            height: `${padTop / 20}rem`,
          }}
        ></View>
        <View className="head">
          <View className="head__row">
            <View className="title">{l.month}</View>
            <View className="meta">{l.vs}</View>
          </View>
        </View>
        <ScrollView className="body" scrollY enableFlex>
          <View className="stack">
            <View className="card card--pad16">
              <View className="kicker">总营收</View>
              <View className="tot">
                <View className="tot__n">
                  {l.total}
                  <Text className="tot__u">{l.totalUnit}</Text>
                </View>
                <View className="pill pill--g tot__d">{l.delta}</View>
              </View>
              <View className="stackbar">
                {l.sources.map((item, index) => {
                  return (
                    <View
                      key={item.name}
                      className="stackbar__seg"
                      style={{
                        flex: `${item.flex}`,
                        background: `${item.color}`,
                      }}
                    ></View>
                  )
                })}
              </View>
              <View className="srcs">
                {l.sources.map((item, index) => {
                  return (
                    <View className="src" key={item.name}>
                      <View
                        className="src__dot"
                        style={{
                          background: `${item.color}`,
                        }}
                      ></View>
                      <View className="src__n">{item.name}</View>
                      <View className="src__v">{item.v}</View>
                    </View>
                  )
                })}
              </View>
            </View>
            {/*  两个诊断前后对比读数  */}
            <View className="duo">
              {l.kpis.map((item, index) => {
                return (
                  <View className="card" key={item.k}>
                    <View className="kicker">{item.k}</View>
                    <View className="kpi__v">
                      <Text className="kpi__n">{item.v}</Text>
                      <Text className="kpi__u">{item.unit}</Text>
                    </View>
                    <View className="kpi__was">{item.was}</View>
                  </View>
                )
              })}
            </View>
            {/*  这个月的组合拳：把主线五步复述成老板的语言  */}
            <View className="card--ink combo">
              <View className="kicker--p">{l.combo.kicker}</View>
              <View className="combo__list">
                {l.combo.steps.map((item, index) => {
                  return (
                    <View className="combo__row" key={item}>
                      <View className="combo__i">{'0' + (index + 1)}</View>
                      <View className="combo__s">{item}</View>
                    </View>
                  )
                })}
              </View>
              <View className="hr--onink combo__hr"></View>
              <View className="combo__foot">{l.combo.foot}</View>
            </View>
            {/*  下一轮诊断：经营数据回流，闭环回到 ①  */}
            <View className="card next">
              <View className="next__body">
                <View className="next__t">{l.next.title}</View>
                <View className="next__b">{l.next.body}</View>
              </View>
              <View
                className="btn-s btn-s--p hit"
                data-url="/pages/studio/index"
                data-tab="1"
                onClick={this.goto}
              >
                {l.next.btn}
              </View>
            </View>
          </View>
        </ScrollView>
        <Tabbar selected={4}></Tabbar>
      </View>
    )
  }
}
export default _C
