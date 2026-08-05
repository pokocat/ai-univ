import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 全部权益（设计稿 22）。
 *
 * 与设计稿的差别都在「不编数字」上：
 *  · 设计稿的「18 项全部可用 / 累计已省 ¥3,560」——后者没有事实源（中台不算省了多少钱），
 *    换成「当前可用 / 升级后解锁」两个真实计数；
 *  · 「本周推荐权益」是运营内容位，目前没有配置入口，故不渲染——
 *    摆两张写死的推荐卡等于把设计稿的示例数据当成了功能；
 *  · 锁定的权益**照常列出**并说明「需要哪个档」，而不是藏起来：
 *    藏起来会让人不知道升级能换到什么。
 */
const api = require('../../api/mp.js')
const { toast } = require('../../utils/fmt.js')
const { navVars } = require('../../utils/layout.js')
const { isAuthGateError } = require('../../utils/auth.js')
const log = require('../../utils/log.js')
import UiErrbar from '../../components/errbar/index'
import UiSubhead from '../../components/subhead/index'
import UiArt from '../../components/art/index'
import UiIcon from '../../components/icon/index'
import './index.scss'
const STEPS = [
  {
    icon: 'grid9',
    title: '选择权益',
    desc: '浏览并选择需要的权益',
  },
  {
    icon: 'calendar',
    title: '预约或使用',
    desc: '按提示预约或直接使用',
  },
  {
    icon: 'award',
    title: '获得服务',
    desc: '资源、课程与陪跑支持',
  },
]
cacheOptions.setOptionsToCache({
  data: {
    navPad: '',
    loading: true,
    err: '',
    retrying: false,
    benefits: [],
    availableCount: 0,
    lockedCount: 0,
    tier: '',
    active: false,
    levelText: '—',
    levelName: '',
    steps: STEPS,
  },
  onLoad() {
    this.setData(navVars())
  },
  onShow() {
    this.load()
  },
  async load() {
    this.setData({
      retrying: true,
    })
    try {
      const [benefits, membership, growth] = await Promise.all([
        api.getBenefits(false),
        api.getMembership(),
        api.getGrowth(1),
      ])
      const list = (benefits || []).map((b) =>
        Object.assign({}, b, {
          // 有配额的权益显示真实余量；口径未接入时服务端给 quotaHint，如实转述而不是显示「已用 0」
          quotaText:
            b.quotaTotal == null
              ? ''
              : b.quotaLeft == null
              ? b.quotaHint || '余量待核对'
              : '本月剩 ' + b.quotaLeft + '/' + b.quotaTotal + ' 次',
        })
      )
      this.setData({
        loading: false,
        err: '',
        retrying: false,
        benefits: list,
        availableCount: list.filter((b) => b.available).length,
        lockedCount: list.filter((b) => !b.available).length,
        tier: (membership && membership.tier) || '',
        active: !!(membership && membership.active),
        levelText: growth && growth.level != null ? 'LV.' + growth.level : '—',
        levelName: (growth && growth.levelName) || '',
      })
    } catch (e) {
      if (isAuthGateError(e)) return
      log.error('benefits load', e.message)
      this.setData({
        loading: false,
        retrying: false,
        err: e.message,
      })
    }
  },
  openBenefit(e) {
    const { code, page, available, reason } = getTarget(
      e.currentTarget,
      Taro
    ).dataset
    if (available === false || available === 'false') {
      // 锁定的权益点了就说清楚差什么，不静默无反应（无反应会被当成按钮坏了）
      Taro.showModal({
        title: '该权益尚未解锁',
        content: reason || '升级会员档位后即可使用',
        confirmText: '查看方案',
        success: (r) => {
          if (r.confirm)
            Taro.navigateTo({
              url: '/pages/subscribe/index',
            })
        },
      })
      return
    }
    const url =
      page && page !== '/pages/benefit-detail/index'
        ? page
        : '/pages/benefit-detail/index?code=' + code
    if (/^\/pages\/(index|group|member|notifications|mine)\/index$/.test(url))
      Taro.switchTab({
        url,
      })
    else
      Taro.navigateTo({
        url,
        fail: () => toast('页面暂不可用'),
      })
  },
  go(e) {
    const url = getTarget(e.currentTarget, Taro).dataset.url
    if (!url) return
    if (/^\/pages\/(index|group|member|notifications|mine)\/index$/.test(url))
      Taro.switchTab({
        url,
      })
    else
      Taro.navigateTo({
        url,
        fail: () => toast('页面暂不可用'),
      })
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const {
      err,
      retrying,
      loading,
      tier,
      availableCount,
      lockedCount,
      levelText,
      levelName,
      benefits,
      steps,
      active,
    } = this.data
    return (
      <View className="screen screen--bar">
        <View className="ambience"></View>
        <View className="layer">
          <UiSubhead title="会员权益" home="/pages/member/index"></UiSubhead>
          {err && (
            <UiErrbar
              msg={err}
              retrying={retrying}
              onRetry={this.load}
            ></UiErrbar>
          )}
          {loading ? (
            <View className="card card-pad">
              <View className="skeleton skeleton-block"></View>
            </View>
          ) : (
            <Block>
              <View className="card card--hero ben-hero">
                <View
                  className="f-start"
                  style={{
                    gap: '0.2rem',
                  }}
                >
                  <View className="f-1">
                    {tier ? (
                      <Text className="tag tag--purple tag--round">
                        {tier + ' 专享'}
                      </Text>
                    ) : (
                      <Text className="tag tag--gray tag--round">未开通</Text>
                    )}
                    <View className="title-grad ben-title">会员权益</View>
                    <Text className="lead">
                      连接资源、提升能力、获得陪跑与增长支持
                    </Text>
                  </View>
                  <UiArt kind="gem" w={210} icon="crown" variant="ben"></UiArt>
                </View>
                <View className="stat-3">
                  <View className="stat-3-item">
                    <UiIcon
                      name="gem"
                      size={35}
                      color="signal"
                      extStyle="margin:0 auto;"
                    ></UiIcon>
                    <Text className="s3-v mono">
                      {availableCount}
                      <Text className="s3-unit">项</Text>
                    </Text>
                    <Text className="s3-d">当前可用</Text>
                  </View>
                  <View className="stat-3-item">
                    <UiIcon
                      name="lock"
                      size={35}
                      color="signal"
                      extStyle="margin:0 auto;"
                    ></UiIcon>
                    <Text className="s3-v mono">
                      {lockedCount}
                      <Text className="s3-unit">项</Text>
                    </Text>
                    <Text className="s3-d">升级后解锁</Text>
                  </View>
                  <View className="stat-3-item">
                    <UiIcon
                      name="shield"
                      size={35}
                      color="signal"
                      extStyle="margin:0 auto;"
                    ></UiIcon>
                    <Text className="s3-v title-grad mono">{levelText}</Text>
                    <Text className="s3-d">{levelName}</Text>
                  </View>
                </View>
              </View>
              {/*  全部权益  */}
              <View className="card card-pad gap">
                <View className="f-between mb-12">
                  <Text className="col-h">全部权益</Text>
                  <Text className="t-tiny">
                    {'共 ' + benefits?.length + ' 项'}
                  </Text>
                </View>
                <View className="ben-grid">
                  {benefits?.map((item, index) => {
                    return (
                      <View
                        key={item.code}
                        className={
                          'ben-tile ' + (item.available ? '' : 'ben-tile--lock')
                        }
                        data-code={item.code}
                        data-page={item.action_page}
                        data-available={item.available}
                        data-reason={item.lockReason}
                        onClick={this.openBenefit}
                      >
                        <View className="ben-ico">
                          <UiIcon
                            name={item.icon}
                            size={45}
                            color={item.available ? 'signal' : 'ink-500'}
                          ></UiIcon>
                        </View>
                        <Text className="bt-t">{item.name}</Text>
                        <Text className="bt-d">{item.summary}</Text>
                        {item.available ? (
                          <View className="ben-st">
                            <UiIcon name="shield" size={22} color="ok"></UiIcon>
                            <Text>{item.quotaText || item.status_hint}</Text>
                          </View>
                        ) : (
                          <View className="ben-st ben-st--lock">
                            <UiIcon
                              name="lock"
                              size={22}
                              color="ink-500"
                            ></UiIcon>
                            <Text>{item.min_identity + '起'}</Text>
                          </View>
                        )}
                      </View>
                    )
                  })}
                </View>
              </View>
              {/*  如何使用  */}
              <View className="card card-pad gap">
                <Text className="col-h mb-14 block">如何使用权益</Text>
                <View className="flow3">
                  {steps.map((item, index) => {
                    return (
                      <Block key={item.title}>
                        <View className="flow-item">
                          <Text className="flow-n mono">{index + 1}</Text>
                          <View className="flow-ico">
                            <UiIcon
                              name={item.icon}
                              size={38}
                              color="signal"
                            ></UiIcon>
                          </View>
                          <Text className="flow-t">{item.title}</Text>
                          <Text className="flow-d">{item.desc}</Text>
                        </View>
                        {index < steps.length - 1 && (
                          <View className="flow-line"></View>
                        )}
                      </Block>
                    )
                  })}
                </View>
              </View>
            </Block>
          )}
        </View>
        <View className="action-bar">
          <View className="action-row">
            {!active ? (
              <View
                className="cta cta--primary"
                data-url="/pages/subscribe/index"
                onClick={this.go}
              >
                <UiIcon name="crown" size={32} color="on-signal"></UiIcon>
                <Text>开通会员</Text>
              </View>
            ) : (
              <View
                className="cta cta--primary"
                data-url="/pages/diagnosis/index"
                onClick={this.go}
              >
                <UiIcon name="sparkle" size={32} color="on-signal"></UiIcon>
                <Text>使用 AI 诊断</Text>
              </View>
            )}
            <View
              className="cta cta--ghost"
              data-url="/pages/member/index"
              onClick={this.go}
            >
              <UiIcon name="card" size={30} color="signal"></UiIcon>
              <Text>返回会员卡</Text>
            </View>
          </View>
        </View>
      </View>
    )
  }
}
export default _C
