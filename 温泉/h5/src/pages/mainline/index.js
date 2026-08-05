import withWeapp, { cacheOptions } from '@tarojs/with-weapp'
import { Block, View, ScrollView, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
import Tabbar from '../../components/tabbar/index'
const { definePage, demo } = require('../../utils/page.js')
import './index.scss'
definePage({
  tab: 0,
  data: {
    action: demo.todayAction,
    line: demo.mainline,
    stats: demo.homeStats,
    shortcuts: demo.shortcuts,
  },
})
cacheOptions.setOptionsToCache({})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { padTop, tw, action, line, stats, shortcuts, safeBottom } = this.data
    return (
      <View className="screen">
        <View
          className="statusbar"
          style={{
            height: `${padTop / 20}rem`,
          }}
        ></View>
        {/*  问候 + 积分余额  */}
        <View className="head">
          <View className="head__row">
            <View>
              <View className="hi">{'早上好，' + tw.ownerTitle}</View>
              <View className="title">{tw.hotelName}</View>
            </View>
            <View
              className="points hit"
              onClick={this.toast}
              data-msg="积分可用于出片、抵扣商城消费"
            >
              <View className="points__dot"></View>
              <View className="points__n">{tw.points}</View>
            </View>
          </View>
        </View>
        <ScrollView className="body" scrollY enableFlex>
          <View className="stack">
            <View className="card--ink today">
              <View className="today__kicker">
                <View className="ic ic-12 ic-spark"></View>
                <View className="kicker--p">AI 军师 · 今天该做的一件事</View>
              </View>
              <View className="today__title">{action.title}</View>
              <View className="today__body">{action.body}</View>
              <View className="today__cta">
                <View
                  className="btn btn--p today__go hit"
                  data-url="/pages/produce/index"
                  onClick={this.goto}
                >
                  {action.cta}
                </View>
                <View
                  className="btn btn--onink hit"
                  data-url="/pages/diagnosis/index"
                  onClick={this.goto}
                >
                  {action.ctaAlt}
                </View>
              </View>
            </View>
            {/*  ② 五步主线：诊断 → 内容 → 拉新 → 会员 → 复购  */}
            <View className="card">
              <View className="row-between mb14">
                <View className="h2">我的经营主线</View>
                <View className="sub">
                  {'本周 · 第 ' + line.stuckAt + ' 步卡住了'}
                </View>
              </View>
              <View className="rail">
                {line.steps.map((item, index) => {
                  return (
                    <Block key={item.name}>
                      <View
                        className={'rail__dot rail__dot--' + item.state}
                      ></View>
                      {index < line.steps.length - 1 && (
                        <View
                          className={
                            'rail__seg ' +
                            (item.state === 'done' ? 'is-on' : '')
                          }
                        ></View>
                      )}
                    </Block>
                  )
                })}
              </View>
              <View className="steps">
                {line.steps.map((item, index) => {
                  return (
                    <View className="steps__col" key={item.name}>
                      <View
                        className={'steps__name steps__name--' + item.state}
                      >
                        {item.name}
                      </View>
                      <View className={'steps__val steps__val--' + item.state}>
                        {item.value}
                      </View>
                    </View>
                  )
                })}
              </View>
              <View className="note note--amber mt13">
                <View className="ic ic-12 ic-warn"></View>
                <View className="note__t">{line.hint}</View>
              </View>
            </View>
            {/*  ③ 两个读数  */}
            <View className="duo">
              {stats.map((item, index) => {
                return (
                  <View className="card card--sm" key={item.k}>
                    <View className="kicker">{item.k}</View>
                    <View className="stat__v">
                      <Text className="num stat__num">{item.v}</Text>
                      {item.unit && <Text className="unit">{item.unit}</Text>}
                    </View>
                    <View className={'stat__foot ' + (item.green ? 'pos' : '')}>
                      {item.foot}
                    </View>
                  </View>
                )
              })}
            </View>
            {/*  ④ 常用 —— 四个原本独立的 App，在这里只是主线上的动作入口  */}
            <View className="card">
              <View className="h3 mb12">常用</View>
              <View className="grid4">
                {shortcuts.map((item, index) => {
                  return (
                    <View
                      className="sc hit"
                      key={item.name}
                      data-url={item.route}
                      data-tab={item.tab}
                      onClick={this.goto}
                    >
                      <View className={'tile tile--' + item.bg}>
                        <View className={'ic ic-22 ' + item.icon}></View>
                      </View>
                      <View className="sc__name">{item.name}</View>
                    </View>
                  )
                })}
              </View>
            </View>
          </View>
        </ScrollView>
        <Tabbar selected={0}></Tabbar>
      </View>
    )
  }
}
export default _C
