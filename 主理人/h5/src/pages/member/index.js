import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 数字会员卡（设计稿 03）。TabBar 中间那格的落点。
 *
 * 关系链只显示**上级**（推荐人 → 二级 → 三级）：设计稿画的是「Victoria → Amy → Jessica」
 * 三个人，语义是「我是怎么被引荐进来的」。下线在「邀请推荐」页展示，两处不混——
 * 混在一起会让人分不清哪个是引荐自己的人。
 *
 * 会员 ID 用 member_no（U-100086）而不是设计稿里的 `HCS PRO 2024 060520`：
 * 那串是设计稿编的展示格式，系统里没有这个字段，编一个格式会让人拿它去对账。
 */
const api = require('../../api/mp.js')
const share = require('../../behaviors/share.js')
const { toast, money, d10 } = require('../../utils/fmt.js')
const { navVars } = require('../../utils/layout.js')
const { isAuthGateError } = require('../../utils/auth.js')
const log = require('../../utils/log.js')
import UiErrbar from '../../components/errbar/index'
import UiApphead from '../../components/apphead/index'
import UiAvatar from '../../components/avatar/index'
import UiArt from '../../components/art/index'
import UiIcon from '../../components/icon/index'
import './index.scss'
const CHAIN_LABEL = {
  1: '推荐人',
  2: '二级推荐',
  3: '三级推荐',
}
cacheOptions.setOptionsToCache(
  share.withShare({
    data: {
      navPad: '',
      loading: true,
      err: '',
      retrying: false,
      me: null,
      growth: null,
      membership: null,
      benefits: [],
      chain: [],
      info: [],
      identityLabel: '',
      tierLabel: '',
      expiryText: '',
    },
    onLoad() {
      this.setData(navVars())
    },
    onShow() {
      const tabBar =
        typeof this.getTabBar === 'function' ? this.getTabBar() : null
      if (tabBar) tabBar.setTab(2)
      this.load()
    },
    onPullDownRefresh() {
      this.load().then(() => Taro.stopPullDownRefresh())
    },
    async load() {
      this.setData({
        retrying: true,
      })
      try {
        const [me, growth, membership, benefits, invite, group] =
          await Promise.all([
            api.getMe(),
            api.getGrowth(1),
            api.getMembership(),
            // 会员卡宫格只摆当前可用的权益：摆一格点进去说「你还不能用」比不摆更糟
            api.getBenefits(true),
            api.getInvite(),
            api.getMyGroup().catch(() => null),
          ])
        this.setShareCode(invite && invite.inviteCode)
        const identity = (me && me.identity) || {}
        this.setData({
          loading: false,
          err: '',
          retrying: false,
          me,
          growth: this.decorateGrowth(growth),
          membership,
          benefits: (benefits || []).slice(0, 6),
          chain: this.buildChain(invite),
          info: this.buildInfo(me, membership, group),
          identityLabel: identity.base_identity || identity.identity || '会员',
          tierLabel: membership && membership.tier ? membership.tier : '',
          expiryText: d10(membership && membership.valid_until),
        })
      } catch (e) {
        if (isAuthGateError(e)) return
        log.error('member load', e.message)
        this.setData({
          loading: false,
          retrying: false,
          err: e.message,
        })
      }
    },
    decorateGrowth(g) {
      if (!g) return null
      return Object.assign({}, g, {
        growthText: money(g.growth),
        remainText: g.remaining == null ? '' : money(g.remaining),
        pctStyle: 'width:' + (g.progressPct || 0) + '%',
        glyph: g.level == null ? '' : String(g.level),
      })
    },
    /** 上级关系链（≤3 级）。没有上级时返回空数组，页面走空态并给出邀请入口。 */
    buildChain(invite) {
      return ((invite && invite.upline) || []).map((u) => ({
        name: u.name || u.member_no,
        role: CHAIN_LABEL[u.level] || '上级',
        label: CHAIN_LABEL[u.level] || '上级',
      }))
    },
    /**
     * 卡面信息行。**每一行都必须有真实来源**——设计稿里的「所属班级 A 班 · 128人」
     * 在没有班级时不显示，而不是显示「— · —」。
     */
    buildInfo(me, membership, group) {
      const rows = []
      const identity = (me && me.identity) || {}
      const region = me && me.city
      if (region) {
        rows.push({
          icon: 'pin',
          label: '所在城市',
          value: region,
        })
      }
      const cohort = group && group.cohort
      const assignment = group && group.assignment
      if (cohort || assignment) {
        rows.push({
          icon: 'members',
          label: '所属班级',
          value:
            ((cohort && cohort.name) || (assignment && assignment.group_name)) +
            (assignment && assignment.member_count != null
              ? ' · ' + assignment.member_count + ' 人'
              : ''),
        })
      }
      rows.push({
        icon: 'contacts',
        label: '会员编号',
        value: me && me.member_no,
        mono: true,
      })
      if (me && me.created_at) {
        rows.push({
          icon: 'calendar',
          label: '加入时间',
          value: d10(me.created_at),
          mono: true,
        })
      }
      rows.push({
        icon: 'crown',
        label: '会员等级',
        value: (membership && membership.tier) || identity.identity || '未开通',
      })
      return rows
    },
    openCode() {
      if (!this.data.me || !this.data.me.member_no) {
        toast('会员档案加载中，请稍后再试')
        return
      }
      Taro.navigateTo({
        url: '/pages/member-code/index',
      })
    },
    /** 权益瓦片：有独立落地页就去落地页，否则去权益详情 */
    openBenefit(e) {
      const { code, page } = getTarget(e.currentTarget, Taro).dataset
      const url =
        page && page !== '/pages/benefit-detail/index'
          ? page
          : '/pages/benefit-detail/index?code=' + code
      Taro.navigateTo({
        url,
        fail: () => toast('页面暂不可用'),
      })
    },
    go(e) {
      const { url, tab } = getTarget(e.currentTarget, Taro).dataset
      if (!url) return
      if (tab)
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
)
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const {
      me,
      err,
      retrying,
      loading,
      tierLabel,
      identityLabel,
      info,
      growth,
      chain,
      benefits,
      membership,
      expiryText,
    } = this.data
    return (
      <View className="screen screen--tab">
        <View className="ambience"></View>
        <View className="layer">
          <UiApphead pro={me.hasPaidEntitlement} big={true}></UiApphead>
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
              <View className="mcard">
                <View className="f-between mb-12">
                  <View
                    className="f"
                    style={{
                      gap: '0.3rem',
                    }}
                  >
                    <UiIcon name="shield" size={30} color="pulse-300"></UiIcon>
                    <Text className="mcard-h">数字会员卡</Text>
                  </View>
                  {tierLabel ? (
                    <Text className="mcard-pro">{tierLabel}</Text>
                  ) : (
                    <Text className="tag tag--gray tag--round">未开通</Text>
                  )}
                </View>
                <View
                  className="f-start"
                  style={{
                    gap: '0.6rem',
                  }}
                >
                  <View className="f-1">
                    <View
                      className="f mb-12"
                      style={{
                        gap: '0.525rem',
                      }}
                    >
                      <UiAvatar
                        name={me.name}
                        path={me.avatarPath}
                        size={108}
                        ring={true}
                      ></UiAvatar>
                      <View className="f-1">
                        <View
                          className="f"
                          style={{
                            gap: '0.25rem',
                          }}
                        >
                          <Text className="mcard-name">
                            {me.name || '主理人'}
                          </Text>
                          {me.hasPaidEntitlement && (
                            <UiIcon
                              name="shield"
                              size={28}
                              color="pulse-300"
                            ></UiIcon>
                          )}
                        </View>
                        <Text className="mc-role">{identityLabel}</Text>
                      </View>
                    </View>
                    <View className="mc-info">
                      {info?.map((item, index) => {
                        return (
                          <View key={item.label} className="mc-row">
                            <UiIcon
                              name={item.icon}
                              size={26}
                              color="signal"
                            ></UiIcon>
                            <Text className="mc-l">{item.label}</Text>
                            <Text
                              className={'mc-v ' + (item.mono ? 'mono' : '')}
                            >
                              {item.value}
                            </Text>
                          </View>
                        )
                      })}
                    </View>
                  </View>
                  <View className="mcard-side">
                    <UiArt
                      kind="medallion"
                      w={168}
                      glyph={growth.glyph}
                      variant="mc"
                    ></UiArt>
                    <View className="mcard-code" onClick={this.openCode}>
                      <UiIcon name="qr" size={52} color="signal-600"></UiIcon>
                      <View
                        className="f"
                        style={{
                          gap: '0.15rem',
                        }}
                      >
                        <Text className="mcard-code-t">会员码</Text>
                        <UiIcon name="chev" size={20} color="signal"></UiIcon>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
              {/*  我的关系链  */}
              <View className="card card-pad gap">
                <View
                  className="f mb-16"
                  style={{
                    gap: '0.3rem',
                  }}
                >
                  <UiIcon name="link" size={30} color="signal"></UiIcon>
                  <Text className="col-h">我的关系链</Text>
                </View>
                {chain?.length ? (
                  <View className="chain">
                    {chain?.map((item, index) => {
                      return (
                        <Block key={index}>
                          <View className="chain-p">
                            <Text className="chain-label">{item.label}</Text>
                            <UiAvatar name={item.name} size={80}></UiAvatar>
                            <Text className="chain-name">{item.name}</Text>
                            <Text className="chain-role">{item.role}</Text>
                          </View>
                          {index < chain?.length - 1 && (
                            <View className="chain-arrow">
                              <UiIcon
                                name="chev"
                                size={28}
                                color="ink-800"
                              ></UiIcon>
                            </View>
                          )}
                        </Block>
                      )
                    })}
                  </View>
                ) : (
                  <View className="blank">
                    <View className="blank-mark">
                      <UiIcon name="link" size={45} color="signal"></UiIcon>
                    </View>
                    <Text className="blank-title">还没有绑定推荐关系</Text>
                    <Text className="blank-hint">
                      通过好友的邀请码注册会自动绑定；你也可以邀请好友，建立自己的关系链。
                    </Text>
                    <View
                      className="btn-sm mt-16"
                      data-url="/pages/invite/index"
                      onClick={this.go}
                    >
                      去邀请好友
                    </View>
                  </View>
                )}
              </View>
              {/*  权益中心  */}
              <View className="card card-pad gap">
                <View className="f-between mb-14">
                  <View
                    className="f"
                    style={{
                      gap: '0.3rem',
                    }}
                  >
                    <UiIcon name="crown" size={30} color="signal"></UiIcon>
                    <Text className="col-h">会员权益中心</Text>
                  </View>
                  <View
                    className="link-trail"
                    data-url="/pages/benefits/index"
                    onClick={this.go}
                  >
                    <Text>全部权益</Text>
                    <UiIcon name="chev" size={22} color="ink-800"></UiIcon>
                  </View>
                </View>
                {benefits?.length ? (
                  <View className="ben-grid">
                    {benefits?.map((item, index) => {
                      return (
                        <View
                          key={item.code}
                          className="ben-tile"
                          data-code={item.code}
                          data-page={item.action_page}
                          onClick={this.openBenefit}
                        >
                          <UiIcon
                            name={item.icon}
                            size={40}
                            color="signal"
                          ></UiIcon>
                          <Text className="bt-t">{item.name}</Text>
                          <Text className="bt-d">{item.summary}</Text>
                          <UiIcon
                            name="chev"
                            size={22}
                            color="ink-800"
                            extStyle="position:absolute;right:0.3rem;bottom:0.3rem;"
                          ></UiIcon>
                        </View>
                      )
                    })}
                  </View>
                ) : (
                  <View className="blank">
                    <View className="blank-mark">
                      <UiIcon name="gem" size={45} color="signal"></UiIcon>
                    </View>
                    <Text className="blank-title">还没有可用权益</Text>
                    <Text className="blank-hint">
                      开通会员后，资源库、专属课程、AI 诊断等权益会在这里解锁。
                    </Text>
                    <View
                      className="btn-grad mt-16"
                      data-url="/pages/subscribe/index"
                      onClick={this.go}
                    >
                      查看会员方案
                    </View>
                  </View>
                )}
              </View>
              {/*  有效期 + 成长值  */}
              <View className="card card-pad gap">
                <View
                  className="f-start"
                  style={{
                    gap: '0.7rem',
                  }}
                >
                  <View className="f-1">
                    <Text className="t-meta">会员有效期</Text>
                    {membership.valid_until ? (
                      <View
                        className="f mt-6"
                        style={{
                          gap: '0.35rem',
                        }}
                      >
                        <Text className="mono expiry">{expiryText}</Text>
                        <Text className="t-tiny">到期</Text>
                      </View>
                    ) : (
                      <Text className="mt-6 block t-sec">未开通</Text>
                    )}
                    {membership.days_left != null && membership.active && (
                      <Text className="day-pill">
                        {'剩余 ' + membership.days_left + ' 天'}
                      </Text>
                    )}
                  </View>
                  <View className="f-1">
                    <View className="f-between">
                      <Text className="t-meta">成长值</Text>
                      <View
                        className="btn-sm"
                        data-url="/pages/points/index"
                        onClick={this.go}
                      >
                        明细
                      </View>
                    </View>
                    <Text className="mono growth-v">{growth.growthText}</Text>
                  </View>
                </View>
                {growth.level != null && (
                  <View className="prog-wrap mt-16">
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
                )}
                {growth.level != null && (
                  <View className="f-between mt-10">
                    <Text className="mono t-pulse fw-700">
                      {'LV.' + growth.level}
                    </Text>
                    {!growth.topLevel ? (
                      <Text className="t-tiny">
                        <Text className="mono t-signal fw-700">
                          {'LV.' + growth.nextLevel}
                        </Text>
                        还需<Text className="mono">{growth.remainText}</Text>
                        升级
                      </Text>
                    ) : (
                      <Text className="t-tiny t-ok">已达最高等级</Text>
                    )}
                  </View>
                )}
              </View>
            </Block>
          )}
        </View>
        {/*  底部动作条  */}
        <View className="action-bar">
          <View className="action-row">
            <View className="cta cta--primary" onClick={this.openCode}>
              <UiIcon name="qr" size={35} color="on-signal"></UiIcon>
              <Text>出示会员码</Text>
            </View>
            <View
              className="cta cta--ghost"
              data-url="/pages/benefits/index"
              onClick={this.go}
            >
              <UiIcon name="gem" size={32} color="signal"></UiIcon>
              <Text>查看全部权益</Text>
            </View>
          </View>
        </View>
      </View>
    )
  }
}
export default _C
