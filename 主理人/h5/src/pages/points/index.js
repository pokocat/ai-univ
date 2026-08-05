import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 成长值明细（设计稿 16「成长积分」）。
 *
 * 设计稿把它叫「积分」，库里叫「成长值」（`growth_ledger`）——**是同一个东西**。
 * 刻意不为「积分」再开一套账：两套账会立刻产生「哪个是真的」这个没人能回答的问题
 * （`points_ledger` 自 V1 建表起从未被写入，正是这种历史遗留）。
 * 界面统一用「成长值」这个词，与服务端和运营后台一致。
 *
 * 环比在上月为 0 时不显示：从 0 涨到 500 的「增长率」没有意义。
 */
const api = require('../../api/mp.js')
const { toast, money, d16 } = require('../../utils/fmt.js')
const { navVars } = require('../../utils/layout.js')
const { isAuthGateError } = require('../../utils/auth.js')
const log = require('../../utils/log.js')

/** 流水来源 → 图标。未登记的来源回落 star2，不留空图标位 */
import UiErrbar from '../../components/errbar/index'
import UiSubhead from '../../components/subhead/index'
import UiArt from '../../components/art/index'
import UiIcon from '../../components/icon/index'
import './index.scss'
const REASON_ICON = {
  邀请成功: 'members',
  邀请入会: 'members',
  课程签到: 'calendar',
  完成作业: 'doc',
  社群发言: 'chat',
  续费会员: 'crown',
  任务完成: 'shield',
  期初迁移: 'refresh',
}
cacheOptions.setOptionsToCache({
  data: {
    navPad: '',
    loading: true,
    err: '',
    retrying: false,
    growth: null,
    perks: [],
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
      const g = await api.getGrowth(50)
      this.setData({
        loading: false,
        err: '',
        retrying: false,
        growth: this.decorate(g),
        perks: Array.isArray(g.levelPerks) ? g.levelPerks : [],
      })
    } catch (e) {
      if (isAuthGateError(e)) return
      log.error('points load', e.message)
      this.setData({
        loading: false,
        retrying: false,
        err: e.message,
      })
    }
  },
  decorate(g) {
    return Object.assign({}, g, {
      growthText: money(g.growth),
      remainText: g.remaining == null ? '—' : money(g.remaining),
      monthText: money(g.monthDelta || 0),
      levelText: g.level == null ? '—' : 'LV.' + g.level,
      pctStyle: 'width:' + (g.progressPct || 0) + '%',
      nextHint: g.topLevel
        ? '已达最高等级'
        : g.nextLevel != null
        ? '升到 LV.' + g.nextLevel + ' 所需'
        : '等级阶梯未配置',
      // 上月为 0 时不给环比：那个百分比没有意义
      rateText:
        g.monthGrowthRate == null
          ? '上月无记录，暂不比较'
          : '较上月 ' +
            (g.monthGrowthRate >= 0 ? '↑' : '↓') +
            Math.abs(g.monthGrowthRate) +
            '%',
      ledger: (g.ledger || []).map((r) => ({
        id: r.id,
        reason: r.reason,
        refText: r.ref_type ? '来源：' + r.ref_type : '',
        timeText: d16(r.created_at),
        delta: r.delta,
        deltaText: (r.delta >= 0 ? '+' : '') + money(r.delta),
        icon: REASON_ICON[r.reason] || 'star2',
      })),
    })
  },
  go(e) {
    const url = getTarget(e.currentTarget, Taro).dataset.url
    if (url)
      Taro.navigateTo({
        url,
        fail: () => toast('页面暂不可用'),
      })
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { err, retrying, loading, growth, perks } = this.data
    return (
      <View className="screen screen--bar">
        <View className="ambience"></View>
        <View className="layer">
          <UiSubhead title="成长值明细" home="/pages/member/index"></UiSubhead>
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
              <View className="card card--hero pt-hero">
                <View className="f-start">
                  <View className="f-1">
                    <View className="pill-outline">
                      <UiIcon name="crown" size={24} color="signal"></UiIcon>
                      <Text>会员成长体系</Text>
                    </View>
                    <View className="title-grad pt-title">成长值</View>
                    <View
                      className="f"
                      style={{
                        gap: '0.3rem',
                      }}
                    >
                      <Text className="title-grad pt-num mono">
                        {growth.growthText}
                      </Text>
                      <UiIcon name="gem" size={35} color="signal"></UiIcon>
                    </View>
                    <Text className="t-meta mt-6 block">
                      活跃、学习、共创都会累计成长值
                    </Text>
                  </View>
                  <UiArt kind="gem" w={220} icon="star2" variant="pt"></UiArt>
                </View>
                <View className="stat-3">
                  <View className="stat-3-item">
                    <Text className="s3-l">当前等级</Text>
                    <Text className="s3-v title-grad mono">
                      {growth.levelText}
                    </Text>
                    <Text className="s3-d">
                      {growth.levelName || '等级未配置'}
                    </Text>
                  </View>
                  <View className="stat-3-item">
                    <Text className="s3-l">距离升级</Text>
                    <Text className="s3-v mono">
                      {growth.topLevel ? '已满级' : growth.remainText}
                    </Text>
                    <Text className="s3-d">{growth.nextHint}</Text>
                  </View>
                  <View className="stat-3-item">
                    <Text className="s3-l">本月新增</Text>
                    <Text className="s3-v mono t-signal">
                      {'+' + growth.monthText}
                    </Text>
                    <Text className="s3-d">{growth.rateText}</Text>
                  </View>
                </View>
              </View>
              {/*  明细流水  */}
              <View className="card card-pad gap">
                <View className="f-between mb-8">
                  <Text className="col-h">成长值明细</Text>
                  <Text className="t-tiny">
                    {'最近 ' + growth.ledger.length + ' 条'}
                  </Text>
                </View>
                {growth.ledger.length ? (
                  <View className="timeline">
                    {growth.ledger.map((item, index) => {
                      return (
                        <View key={item.id} className="tl-item">
                          <View className="tl-rail">
                            <View className="tl-node"></View>
                            {index < growth.ledger.length - 1 && (
                              <View className="tl-line"></View>
                            )}
                          </View>
                          <View className="tl-icon">
                            <UiIcon
                              name={item.icon}
                              size={35}
                              color="signal"
                            ></UiIcon>
                          </View>
                          <View className="f-1">
                            <Text className="pt-item-t">{item.reason}</Text>
                            {item.refText && (
                              <Text className="t-tiny mt-2 block">
                                {item.refText}
                              </Text>
                            )}
                            <Text className="t-micro mono mt-4 block">
                              {item.timeText}
                            </Text>
                          </View>
                          <Text
                            className="pt-delta mono"
                            style={{
                              color: `var(--${
                                item.delta >= 0 ? 'pulse-600' : 'danger'
                              })`,
                            }}
                          >
                            {item.deltaText}
                          </Text>
                        </View>
                      )
                    })}
                  </View>
                ) : (
                  <View className="blank">
                    <View className="blank-mark">
                      <UiIcon name="star2" size={45} color="signal"></UiIcon>
                    </View>
                    <Text className="blank-title">还没有成长值记录</Text>
                    <Text className="blank-hint">
                      完成班级任务、参加课程、邀请好友都会累计成长值。
                    </Text>
                    <View
                      className="btn-sm mt-16"
                      data-url="/pages/tasks/index"
                      onClick={this.go}
                    >
                      去看任务
                    </View>
                  </View>
                )}
              </View>
              {/*  等级权益  */}
              {growth.level != null && (
                <View className="card card-pad gap">
                  <View
                    className="f mb-14"
                    style={{
                      gap: '0.3rem',
                    }}
                  >
                    <UiIcon name="shield" size={30} color="signal"></UiIcon>
                    <Text className="col-h">等级权益</Text>
                  </View>
                  <View className="f-between">
                    <View>
                      <Text className="title-grad lv-cur mono">
                        {growth.levelText}
                      </Text>
                      <Text className="t-tiny block">{growth.levelName}</Text>
                    </View>
                    {!growth.topLevel && (
                      <Text className="t-meta">
                        还需<Text className="mono">{growth.remainText}</Text>
                        升级
                      </Text>
                    )}
                    {!growth.topLevel && (
                      <View className="ta-r">
                        <Text className="lv-next mono">
                          {'LV.' + growth.nextLevel}
                        </Text>
                        <Text className="t-tiny block t-signal">
                          {growth.nextLevelName}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View className="prog-wrap mt-14">
                    <View className="prog-track">
                      <View
                        className="prog-fill"
                        style={growth.pctStyle}
                      ></View>
                    </View>
                    <View
                      className="prog-knob"
                      style={{
                        left: `${growth.progressPct}%`,
                      }}
                    ></View>
                  </View>
                  {perks?.length && (
                    <View className="box box--sunk mt-16">
                      <Text className="t-sec fw-600">本档包含</Text>
                      <View
                        className="f f-wrap mt-8"
                        style={{
                          gap: '0.25rem',
                        }}
                      >
                        {perks?.map((item, index) => {
                          return (
                            <Text key={item} className="tag tag--purple">
                              {item}
                            </Text>
                          )
                        })}
                      </View>
                    </View>
                  )}
                </View>
              )}
            </Block>
          )}
        </View>
        <View className="action-bar">
          <View className="action-row">
            <View
              className="cta cta--ghost"
              data-url="/pages/benefits/index"
              onClick={this.go}
            >
              <UiIcon name="gem" size={30} color="signal"></UiIcon>
              <Text>会员权益</Text>
            </View>
            <View
              className="cta cta--primary"
              data-url="/pages/invite/index"
              onClick={this.go}
            >
              <UiIcon name="sparkle" size={32} color="on-signal"></UiIcon>
              <Text>去赚成长值</Text>
            </View>
          </View>
        </View>
      </View>
    )
  }
}
export default _C
