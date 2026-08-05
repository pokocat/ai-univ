import withWeapp, { cacheOptions, getTarget } from '@tarojs/with-weapp'
import { Block, View, ScrollView, Image, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
import Tabbar from '../../components/tabbar/index'
const { definePage, demo } = require('../../utils/page.js')
import './index.scss'
definePage({
  tab: 2,
  data: {
    a: demo.assets,
    kind: 0,
  },
  pickKind(e) {
    this.setData({
      kind: Number(getTarget(e.currentTarget, Taro).dataset.i),
    })
  },
})
cacheOptions.setOptionsToCache({})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { padTop, a, kind, safeBottom } = this.data
    return (
      <View className="screen">
        <View
          className="statusbar"
          style={{
            height: `${padTop / 20}rem`,
          }}
        ></View>
        <View className="head">
          <View className="head__row mb13">
            <View className="title">数字资产库</View>
            <View className="meta">{a.total}</View>
          </View>
          {/*  四类资产：形象 / 场景 / 产品 / 声音  */}
          <ScrollView
            scrollX
            className="catbar"
            enableFlex
            showScrollbar={false}
          >
            <View className="chips">
              {a.tabs.map((item, index) => {
                return (
                  <View
                    key={item.name}
                    className={'chip ' + (index === kind ? 'chip--on' : '')}
                    data-i={index}
                    onClick={this.pickKind}
                  >
                    {item.name + ' ' + item.n}
                  </View>
                )
              })}
            </View>
          </ScrollView>
        </View>
        <ScrollView className="body" scrollY enableFlex>
          <View className="stack">
            <View className="card">
              <View className="who">
                <Image
                  className="who__img"
                  src={a.persona.avatar}
                  mode="aspectFill"
                  lazyLoad
                ></Image>
                <View className="who__body">
                  <View className="kicker mb7">{a.persona.reg}</View>
                  <View className="who__n">{a.persona.name}</View>
                  <View className="who__row">
                    <View className="pill pill--g who__ok">
                      <View className="ic ic-12 ic-shield"></View>
                      <Text>{a.persona.status}</Text>
                    </View>
                  </View>
                  <View className="meta-s mt7">{a.persona.verified}</View>
                </View>
              </View>
              <View className="hr hr--v"></View>
              <View className="tl__cap">
                <View className="ic ic-12 ic-time"></View>
                <View className="kicker">形象时间轴 · 3 个时期</View>
              </View>
              <View className="tl">
                {a.persona.eras.map((item, index) => {
                  return (
                    <View className="tl__col" key={item.year}>
                      <Image
                        className={'tl__img ' + (item.active ? 'is-on' : '')}
                        src={item.src}
                        mode="aspectFill"
                        lazyLoad
                      ></Image>
                      <View className={'tl__y ' + (item.active ? 'is-on' : '')}>
                        {item.year}
                      </View>
                    </View>
                  )
                })}
              </View>
              <View className="note note--soft mt12">
                <View className="ic ic-12 ic-info"></View>
                <View className="note__t">{a.persona.note}</View>
              </View>
            </View>
            {/*  场景带空间参数：机位、石阶级数、门的开合、成人儿童身高比  */}
            <View className="card">
              <View className="row-between mb12">
                <View className="h2">场景 · 空间一致性</View>
                <View className="meta-s">{a.tabs[1].n + ' 个'}</View>
              </View>
              <View className="scenes">
                {a.scenes.map((item, index) => {
                  return (
                    <View className="scene" key={item.name}>
                      <Image
                        className="scene__img"
                        src={item.thumb}
                        mode="aspectFill"
                        lazyLoad
                      ></Image>
                      <View className="scene__body">
                        <View className="scene__n">{item.name}</View>
                        <View className="scene__m">{item.meta}</View>
                      </View>
                    </View>
                  )
                })}
              </View>
            </View>
            {/*  资产可外借，协会内部形成素材流通  */}
            <View className="card card--dash lend">
              <View className="lend__body">
                <View className="lend__t">{a.lend.title}</View>
                <View className="lend__b">{a.lend.body}</View>
              </View>
              <View
                className="btn-s btn-s--ghost hit"
                onClick={this.toast}
                data-msg="演示版：按次分成，协会统一结算"
              >
                了解
              </View>
            </View>
          </View>
        </ScrollView>
        <Tabbar selected={2}></Tabbar>
      </View>
    )
  }
}
export default _C
