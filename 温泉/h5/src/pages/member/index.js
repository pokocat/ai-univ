import withWeapp, { cacheOptions } from '@tarojs/with-weapp'
import { Block, View, ScrollView, Text, Image } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
const { definePage, demo } = require('../../utils/page.js')
import Tabbar from '../../components/tabbar/index'
import './index.scss'
definePage({
  tab: 3,
  inlineTab: true,
  data: {
    m: demo.member,
  },
})
cacheOptions.setOptionsToCache({})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { padTop, m, tab } = this.data
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
            <View className="title">会员经营</View>
            <View className="meta nav__tail">{m.count}</View>
          </View>
        </View>
        <ScrollView className="body" scrollY enableFlex>
          <View className="stack">
            <View className="card--ink vipcard">
              <View className="vip__top">
                <View>
                  <View className="kicker--p">{m.card.kicker}</View>
                  <View className="vip__price">
                    <Text className="vip__num">{m.card.price}</Text>
                    <Text className="vip__per">{m.card.per}</Text>
                  </View>
                </View>
                <View className="vip__new">
                  <View className="vip__newn">{m.card.newCount}</View>
                  <View className="vip__newl">{m.card.newLabel}</View>
                </View>
              </View>
              <View className="hr--onink vip__hr"></View>
              <View className="perks">
                {m.card.perks.map((item, index) => {
                  return (
                    <View className="perk" key={item.text}>
                      <View className={'ic ic-14 ' + item.icon}></View>
                      <View className="perk__t">{item.text}</View>
                    </View>
                  )
                })}
              </View>
            </View>
            {/*  无人货柜：品牌方铺货，酒店零库存  */}
            <View className="card">
              <View className="row-between mb13">
                <View className="vend__head">
                  <View className="ic ic-18 ic-fridge"></View>
                  <View className="h2">{m.vending.title}</View>
                </View>
                <View className="pill pill--g">{m.vending.tag}</View>
              </View>
              <View className="trio">
                {m.vending.stats.map((item, index) => {
                  return (
                    <View key={item.k}>
                      <View className="kicker">{item.k}</View>
                      <View className={'trio__v ' + (item.green ? 'pos' : '')}>
                        <Text>{item.v}</Text>
                        {item.unit && (
                          <Text className="trio__u">{item.unit}</Text>
                        )}
                      </View>
                    </View>
                  )
                })}
              </View>
              <View className="note note--soft mt13">
                <View className="ic ic-12 ic-info"></View>
                <View className="note__t">{m.vending.note}</View>
              </View>
            </View>
            {/*  协会统一选品：100 家共采，积分可抵扣  */}
            <View className="card">
              <View className="row-between mb12">
                <View className="h2">{m.skus.title}</View>
                <View className="meta-s">{m.skus.meta}</View>
              </View>
              <View className="skus">
                {m.skus.items.map((item, index) => {
                  return (
                    <View className="sku" key={item.name}>
                      <Image
                        className="sku__img"
                        src={item.img}
                        mode="aspectFill"
                        lazyLoad
                      ></Image>
                      <View className="sku__body">
                        <View className="sku__n">{item.name}</View>
                        <View className="sku__m">{item.note}</View>
                      </View>
                      <View
                        className={'sku__s ' + (item.on ? 'is-on' : 'is-wait')}
                      >
                        {item.state}
                      </View>
                    </View>
                  )
                })}
              </View>
            </View>
            {/*  积分把内容生产成本和消费闭环连起来  */}
            <View className="card points3">
              <View className="ic ic-20 ic-coin"></View>
              <View className="points3__body">
                <View className="lend__t">积分是那根线</View>
                <View className="lend__b">
                  出片消耗 · 裂变赠送 · 商城抵扣，三处用的是同一套积分
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
        <Tabbar selected={tab}></Tabbar>
      </View>
    )
  }
}
export default _C
