import withWeapp, { cacheOptions } from '@tarojs/with-weapp'
import {
  Block,
  View,
  ScrollView,
  Image,
  Switch,
  Text,
} from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
const { definePage, demo } = require('../../utils/page.js')
import Tabbar from '../../components/tabbar/index'
import './index.scss'
definePage({
  tab: 1,
  inlineTab: true,
  data: {
    p: demo.produce,
    // 04 屏的进度条是活的：进演示时从 6/8 跑到 8/8，讲「后台跑，可以退出」
    done: demo.produce.done,
    total: demo.produce.total,
    pct: Math.round((demo.produce.done / demo.produce.total) * 100),
    // 游客自助出片开关 —— README §8 的 guestSelfServe，路演现场可当场关掉对比讲
    selfServe: demo.tweaks.guestSelfServe,
  },
  onShow() {
    this.tick()
  },
  onHide() {
    this.stop()
  },
  onUnload() {
    this.stop()
  },
  tick() {
    this.stop()
    this._t = setInterval(() => {
      const done = this.data.done
      if (done >= this.data.total) return this.stop()
      const next = done + 1
      this.setData({
        done: next,
        pct: Math.round((next / this.data.total) * 100),
      })
    }, 2600)
  },
  stop() {
    if (this._t) {
      clearInterval(this._t)
      this._t = null
    }
  },
  toggleSelfServe(e) {
    this.setData({
      selfServe: e.detail.value,
    })
  },
})
cacheOptions.setOptionsToCache({})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { padTop, p, done, total, pct, selfServe, tab } = this.data
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
            <View className="meta">{p.templateName}</View>
          </View>
          {/*  固定四步：选模板 → 传照片 → 后台生成 → 一键分发  */}
          <View className="steps3">
            <View className="s3 is-on">
              <View className="s3__n">1</View>
              <View className="s3__t">选模板</View>
            </View>
            <View className="s3__seg is-on"></View>
            <View className="s3 is-on">
              <View className="s3__n">2</View>
              <View className="s3__t">传照片</View>
            </View>
            <View className="s3__seg"></View>
            <View className="s3">
              <View className="s3__n">3</View>
              <View className="s3__t">分发</View>
            </View>
          </View>
        </View>
        <ScrollView className="body" scrollY enableFlex>
          <View className="stack stack--loose">
            <View className="card">
              <View className="h2 mb11">换进来的人</View>
              <View className="faces">
                {p.faces.map((item, index) => {
                  return (
                    <View className="face" key={item.label}>
                      <Image
                        className="face__img"
                        src={item.src}
                        mode="aspectFill"
                        lazyLoad
                      ></Image>
                      <View className="face__cap">{item.label}</View>
                    </View>
                  )
                })}
                <View
                  className="face face--add hit"
                  onClick={this.toast}
                  data-msg="演示版：从相册选一张正面照即可"
                >
                  <View className="ic ic-20 ic-plus"></View>
                  <View className="face__addt">加一张</View>
                </View>
              </View>
              <View className="note note--soft mt12">
                <View className="ic ic-12 ic-info"></View>
                <View className="note__t">{p.faceHint}</View>
              </View>
            </View>
            {/*  正在出片  */}
            <View className="card">
              <View className="row-between mb12">
                <View className="h2">正在出片</View>
                <View className="prog__n">{done + ' / ' + total + ' 条'}</View>
              </View>
              <View className="bar bar--thin mb12">
                <View
                  className="bar__fill"
                  style={{
                    width: `${pct}%`,
                    background: 'var(--purple)',
                  }}
                ></View>
              </View>
              <View className="clips">
                {p.clips.map((item, index) => {
                  return (
                    <Image
                      key={item}
                      className="clip"
                      src={item}
                      mode="aspectFill"
                      lazyLoad
                    ></Image>
                  )
                })}
                <View className="clip clip--wip">
                  <View className="clip__pct">{p.pendingPct + '%'}</View>
                </View>
              </View>
              <View className="row-between mt13">
                <View className="meta">{p.spend}</View>
                <View className="prog__hint">后台跑，可以退出</View>
              </View>
            </View>
            {/*  出完发到哪  */}
            <View
              className="card hit"
              onClick={this.toast}
              data-msg="演示版：8 条已排入分发队列"
            >
              <View className="h2 mb12">出完发到哪</View>
              <View className="chans">
                {p.channels.map((item, index) => {
                  return (
                    <View className="chan" key={item.name}>
                      <View
                        className={'chan__dot chan__dot--' + item.tone}
                      ></View>
                      <View className="chan__n">{item.name}</View>
                      <View className="meta-s">{item.count}</View>
                    </View>
                  )
                })}
              </View>
            </View>
            {/*  游客自助出片：拉新环节本身就赚钱。关掉这个开关做对比讲解  */}
            {selfServe ? (
              <View className="selfserve">
                <View className="row-between mb9">
                  <View className="ss__t">{p.selfServe.title}</View>
                  <Switch
                    className="ss__sw"
                    checked={selfServe}
                    color="#3E96A3"
                    onChange={this.toggleSelfServe}
                  ></Switch>
                </View>
                <View className="ss__b">
                  <Text>{p.selfServe.pre}</Text>
                  <Text className="ss__b--b">{p.selfServe.bold}</Text>
                  <Text>{p.selfServe.post}</Text>
                </View>
              </View>
            ) : (
              <View className="card card--dash ss__off">
                <View className="ss__offbody">
                  <View className="ss__offt">{p.selfServe.offTitle}</View>
                  <View className="ss__offb">{p.selfServe.offBody}</View>
                </View>
                <Switch
                  className="ss__sw"
                  checked={selfServe}
                  color="#3E96A3"
                  onChange={this.toggleSelfServe}
                ></Switch>
              </View>
            )}
          </View>
        </ScrollView>
        <Tabbar selected={tab}></Tabbar>
      </View>
    )
  }
}
export default _C
