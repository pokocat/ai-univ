import withWeapp, { cacheOptions, getTarget } from '@tarojs/with-weapp'
import { Block, View, ScrollView, Image } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
import Tabbar from '../../components/tabbar/index'
const { definePage, demo } = require('../../utils/page.js')
import './index.scss'
definePage({
  tab: 1,
  data: {
    cats: demo.templateTabs,
    cat: 0,
    drama: demo.dramaTemplate,
    templates: demo.templates,
    star: demo.starTemplate,
  },
  pickCat(e) {
    this.setData({
      cat: Number(getTarget(e.currentTarget, Taro).dataset.i),
    })
  },
})
cacheOptions.setOptionsToCache({})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { padTop, cats, cat, drama, templates, tw, star, safeBottom } =
      this.data
    return (
      <View className="screen">
        <View
          className="statusbar"
          style={{
            height: `${padTop / 20}rem`,
          }}
        ></View>
        <View className="head">
          <View className="title mb13">选一个模板开拍</View>
          {/*  按「你想解决什么经营问题」分类，不出现「换脸」「数字人」这类技术词  */}
          <ScrollView
            scrollX
            className="catbar"
            enableFlex
            showScrollbar={false}
          >
            <View className="chips">
              {cats.map((item, index) => {
                return (
                  <View
                    key={item}
                    className={'chip ' + (index === cat ? 'chip--on' : '')}
                    data-i={index}
                    onClick={this.pickCat}
                  >
                    {item}
                  </View>
                )
              })}
            </View>
          </ScrollView>
        </View>
        <ScrollView className="body" scrollY enableFlex>
          <View className="stack">
            <View className="card card--flush">
              <View className="cover">
                <Image
                  className="cover__img"
                  src={drama.cover}
                  mode="aspectFill"
                  lazyLoad
                ></Image>
                <View className="cover__badge">{drama.badge}</View>
                <View className="cover__play">
                  <View className="ic ic-26 ic-play"></View>
                </View>
              </View>
              <View className="cover__foot">
                <View className="drama__t">{drama.title}</View>
                <View className="drama__b">{drama.body}</View>
                <View className="drama__row">
                  <View className="meta">{drama.used}</View>
                  <View className="meta">{drama.dur}</View>
                  <View
                    className="btn-s btn-s--p drama__go hit"
                    data-url="/pages/produce/index"
                    onClick={this.goto}
                  >
                    {drama.btn}
                  </View>
                </View>
              </View>
            </View>
            {/*  单条短视频模板：明码标积分，20 分钟出一批  */}
            <View className="duo">
              {templates.map((item, index) => {
                return (
                  <View
                    className="card card--flush hit"
                    key={item.id}
                    data-url={'/pages/produce/index?tpl=' + item.id}
                    onClick={this.goto}
                  >
                    <Image
                      className="tpl__img"
                      src={item.cover}
                      mode="aspectFill"
                      lazyLoad
                    ></Image>
                    <View className="tpl__foot">
                      <View className="tpl__t">{item.title}</View>
                      <View className="tpl__n">{item.note}</View>
                      <View className="tpl__row">
                        <View className="tpl__cost">
                          {tw.clipCost + ' 积分'}
                        </View>
                        <View className="meta-s">{item.dur}</View>
                      </View>
                    </View>
                  </View>
                )
              })}
            </View>
            {/*  明星背书模板（协会签的形象授权）  */}
            <View className="card">
              <View className="star">
                <Image
                  className="star__img"
                  src={star.thumb}
                  mode="aspectFill"
                  lazyLoad
                ></Image>
                <View className="star__body">
                  <View className="star__head">
                    <View className="h3">{star.title}</View>
                    <View className="pill pill--a">{star.tag}</View>
                  </View>
                  <View className="star__b">{star.body}</View>
                </View>
                <View className="ic ic-18 ic-lock"></View>
              </View>
            </View>
            {/*  从零开一部自己的剧  */}
            <View
              className="card--ink scratch hit"
              onClick={this.toast}
              data-msg="演示版：军师会先问你三个问题，再搭脚本"
            >
              <View className="scratch__body">
                <View className="scratch__t">从零开一部你自己的剧</View>
                <View className="scratch__b">
                  说一句话，军师帮你搭脚本和分镜
                </View>
              </View>
              <View className="btn-s btn-s--onink">开始</View>
            </View>
          </View>
        </ScrollView>
        <Tabbar selected={1}></Tabbar>
      </View>
    )
  }
}
export default _C
