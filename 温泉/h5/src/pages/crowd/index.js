import withWeapp, { cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text, ScrollView } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
import Tabbar from '../../components/tabbar/index'
const { definePage, demo } = require('../../utils/page.js')
import './index.scss'
definePage({
  tab: 3,
  data: {
    c: demo.crowd,
  },
})
cacheOptions.setOptionsToCache({})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { padTop, c, safeBottom } = this.data
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
            <View className="title">客人是怎么进来的</View>
            <View
              className="jump hit"
              data-url="/pages/member/index"
              onClick={this.goto}
            >
              <Text>会员</Text>
              <View className="ic ic-14 ic-chev-p"></View>
            </View>
          </View>
        </View>
        <ScrollView className="body" scrollY enableFlex>
          <View className="stack">
            <View className="card">
              <View className="row-between mb14">
                <View className="h2">本月转化漏斗</View>
                <View className="meta-s">{c.period}</View>
              </View>
              <View className="funnel">
                {c.funnel.map((item, index) => {
                  return (
                    <View className="fn" key={item.name}>
                      <View className="fn__row">
                        <View className={'fn__n fn__n--' + item.tone}>
                          {item.name}
                        </View>
                        <View className={'fn__v fn__v--' + item.tone}>
                          {item.v}
                        </View>
                      </View>
                      <View className="bar">
                        <View
                          className="bar__fill"
                          style={{
                            width: `${item.pct}%`,
                            background: `${
                              item.tone === 'amber' ? '#C08320' : '#7A5C9B'
                            }`,
                          }}
                        ></View>
                      </View>
                    </View>
                  )
                })}
              </View>
              <View className="note note--amber mt13">
                <View className="ic ic-12 ic-warn"></View>
                <View className="note__t">{c.funnelHint}</View>
              </View>
            </View>
            {/*  社群机器人日志：写成人话，不是后台报表  */}
            <View className="card">
              <View className="row-between mb12">
                <View className="bot__head">
                  <View className="ic ic-18 ic-robot"></View>
                  <View className="h2">4 个客户群 · 机器人今天干了什么</View>
                </View>
                <View className="live">
                  <View className="live__dot"></View>
                  <View className="live__t">在跑</View>
                </View>
              </View>
              <View className="log">
                {c.botLog.map((item, index) => {
                  return (
                    <View className="log__row" key={item.t}>
                      <View className="log__t">{item.t}</View>
                      <View className="log__s">{item.s}</View>
                    </View>
                  )
                })}
              </View>
              <View className="act act--p mt13">
                <View className="act__lead act__flex">{c.leadHint}</View>
                <View
                  className="btn-s btn-s--p hit"
                  onClick={this.toast}
                  data-msg="演示版：机器人已把 6 条线索标为「企业客户」"
                >
                  去看
                </View>
              </View>
            </View>
            {/*  扫码入口：台卡 / 前台收银 / 美团  */}
            <View className="card">
              <View className="h2 mb12">扫码入口</View>
              <View className="entries">
                {c.entries.map((item, index) => {
                  return (
                    <View className="entry" key={item.name}>
                      <View className="entry__top">
                        <View className="entry__n">{item.name}</View>
                        <View className={'ic ic-14 ' + item.icon}></View>
                      </View>
                      <View className={'entry__v entry__v--' + item.tone}>
                        {item.v}
                      </View>
                      <View className="entry__u">{item.unit}</View>
                    </View>
                  )
                })}
              </View>
            </View>
          </View>
        </ScrollView>
        <Tabbar selected={3}></Tabbar>
      </View>
    )
  }
}
export default _C
