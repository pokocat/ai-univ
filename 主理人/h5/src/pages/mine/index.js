import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 我的（设计稿 11「设置中心 / 我的」）。
 *
 * 它是**入口页**，不是设置本体：账号安全/隐私/协议/注销这些合规项在
 * `pages/settings`（更深一层），因为它们的正文很长、且上架规范要求有稳定入口。
 * 这里只负责「我是谁 + 我的三个读数 + 去哪儿」。
 *
 * 功能行按能力显隐，不摆点不动的东西：
 *  · 「我的团队」只在服务端说 isAgent 时出现（判据是 base_identity，服务端给结论，
 *    客户端不硬编码身份名单——保护身份清单在 dict 里由运营维护）；
 *  · 「自动续费管理」只在已开通时出现；
 *  · 「联系专属服务」只在真的匹配到服务老师时出现。
 */
const api = require('../../api/mp.js')
const share = require('../../behaviors/share.js')
const { toast, money, d10 } = require('../../utils/fmt.js')
const { navVars } = require('../../utils/layout.js')
const { isAuthGateError, logout } = require('../../utils/auth.js')
const log = require('../../utils/log.js')
import UiProfileEdit from '../../components/profile-edit/index'
import UiErrbar from '../../components/errbar/index'
import UiApphead from '../../components/apphead/index'
import UiAvatar from '../../components/avatar/index'
import UiArt from '../../components/art/index'
import UiIcon from '../../components/icon/index'
import './index.scss'
cacheOptions.setOptionsToCache(
  share.withShare({
    data: {
      navPad: '',
      loading: true,
      err: '',
      retrying: false,
      me: null,
      membership: null,
      teacher: null,
      identityLabel: '',
      expiryText: '',
      growthGlyph: '',
      stats: [],
      rows: [],
      version: '',
      showProfileEdit: false,
    },
    onLoad() {
      this.setData(
        Object.assign(
          {
            version: this.versionText(),
          },
          navVars()
        )
      )
    },
    onShow() {
      const tabBar =
        typeof this.getTabBar === 'function' ? this.getTabBar() : null
      if (tabBar) tabBar.setTab(4)
      this.load()
    },
    onPullDownRefresh() {
      this.load().then(() => Taro.stopPullDownRefresh())
    },
    versionText() {
      try {
        const info = Taro.getAccountInfoSync()
        const v = info && info.miniProgram ? info.miniProgram.version : ''
        const env = info && info.miniProgram ? info.miniProgram.envVersion : ''
        const envName =
          {
            develop: '开发版',
            trial: '体验版',
            release: '正式版',
          }[env] || env
        return [envName, v && 'v' + v].filter(Boolean).join(' · ')
      } catch (e) {
        return ''
      }
    },
    async load() {
      this.setData({
        retrying: true,
      })
      try {
        const [me, membership, growth, invite, earnings, group] =
          await Promise.all([
            api.getMe(),
            api.getMembership(),
            api.getGrowth(1),
            api.getInvite(),
            api.getEarnings().catch(() => null),
            api.getMyGroup().catch(() => null),
          ])
        this.setShareCode(invite && invite.inviteCode)
        const identity = (me && me.identity) || {}
        this.setData({
          loading: false,
          err: '',
          retrying: false,
          me,
          membership: membership || {},
          teacher: group && group.serviceTeacher,
          identityLabel: identity.base_identity || identity.identity || '会员',
          expiryText:
            membership && membership.active ? d10(membership.valid_until) : '',
          growthGlyph:
            growth && growth.level != null ? String(growth.level) : '',
          stats: this.buildStats(growth, invite, earnings),
          rows: this.buildRows(me, membership),
        })
      } catch (e) {
        if (isAuthGateError(e)) return
        log.error('mine load', e.message)
        this.setData({
          loading: false,
          retrying: false,
          err: e.message,
        })
      }
    },
    /**
     * 三个读数。收益取不到时显示「—」而不是 0：0 表示「确实没有收益」，
     * 而「—」表示「这项数据现在取不到」，两件事不能显示成同一个值。
     */
    buildStats(growth, invite, earnings) {
      return [
        {
          label: '成长值',
          value: growth ? money(growth.growth) : '—',
          url: '/pages/points/index',
        },
        {
          label: '已邀请',
          value:
            invite && invite.influence != null ? money(invite.influence) : '—',
          url: '/pages/invite/index',
        },
        {
          label: '累计收益',
          value:
            earnings && earnings.summary && earnings.summary.total_est != null
              ? '¥' + money(earnings.summary.total_est)
              : '—',
          url: '/pages/earnings/index',
        },
      ]
    },
    buildRows(me, membership) {
      const rows = []
      rows.push({
        title: '我的社群',
        desc: '班级、群成员与入群二维码',
        icon: 'members',
        color: 'signal',
        url: '/pages/group/index',
        tab: true,
      })
      rows.push({
        title: '培训与课程',
        desc: '报名进度、课程回放与课件',
        icon: 'cap',
        color: 'pulse',
        url: '/pages/training/index',
      })
      rows.push({
        title: '会员权益',
        desc: '全部权益、使用方式与本月余量',
        icon: 'crown',
        color: 'signal',
        url: '/pages/benefits/index',
      })
      rows.push({
        title: '我的任务',
        desc: '班级任务与成长值奖励',
        icon: 'shield',
        color: 'signal',
        url: '/pages/tasks/index',
      })
      if (me && me.isAgent) {
        rows.push({
          title: '我的团队',
          desc: '名下社群与服务归属的学员',
          icon: 'handshake',
          color: 'signal-600',
          url: '/pages/agent/index',
          tag: '代理',
        })
      }
      if (membership && membership.active) {
        rows.push({
          title: '会员与续费',
          desc: '当前方案、到期时间与续费',
          icon: 'refresh',
          color: 'signal',
          url: '/pages/renewal/index',
          trail:
            membership.days_left != null
              ? '剩 ' + membership.days_left + ' 天'
              : '',
        })
      }
      rows.push({
        title: '订单与退款',
        desc: '购买记录、待支付订单与退款申请',
        icon: 'receipt',
        color: 'signal',
        url: '/pages/refund/index',
      })
      rows.push({
        title: '帮助与工单',
        desc: '提交问题、查看处理进度',
        icon: 'headset',
        color: 'signal',
        url: '/pages/ticket/index',
      })
      rows.push({
        title: '设置',
        desc: '账号与隐私、协议、缓存与注销',
        icon: 'settings',
        color: 'signal-800',
        url: '/pages/settings/index',
      })
      return rows
    },
    editProfile() {
      this.setData({
        showProfileEdit: true,
      })
    },
    closeProfile() {
      this.setData({
        showProfileEdit: false,
      })
    },
    onProfileSaved() {
      this.setData({
        showProfileEdit: false,
      })
      this.load()
    },
    logout() {
      Taro.showModal({
        title: '退出登录',
        content:
          '退出后需要重新授权登录才能使用会员功能。已购买的会员权益不受影响。',
        confirmText: '退出',
        confirmColor: '#C43149',
        success: (r) => {
          if (!r.confirm) return
          logout()
          Taro.reLaunch({
            url: '/pages/login/index',
          })
        },
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
      err,
      retrying,
      loading,
      me,
      identityLabel,
      membership,
      expiryText,
      growthGlyph,
      stats,
      rows,
      teacher,
      version,
      showProfileEdit,
    } = this.data
    return (
      <View className="screen screen--tab">
        <View className="ambience"></View>
        <View className="layer">
          <UiApphead sub="连接主理人 · 共创新商业"></UiApphead>
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
              <View
                className="card card--hero profile"
                onClick={this.editProfile}
              >
                <UiAvatar
                  name={me.name}
                  path={me.avatarPath}
                  size={115}
                  ring={true}
                ></UiAvatar>
                <View className="f-1 profile-main">
                  <View
                    className="f"
                    style={{
                      gap: '0.25rem',
                    }}
                  >
                    <Text className="profile-name">
                      {me.name || '完善资料'}
                    </Text>
                    <UiIcon name="edit" size={26} color="signal-800"></UiIcon>
                  </View>
                  <Text className="mc-role">{identityLabel}</Text>
                  {membership.active && (
                    <View
                      className="f mt-8"
                      style={{
                        gap: '0.25rem',
                      }}
                    >
                      <UiIcon name="crown" size={24} color="signal"></UiIcon>
                      <Text className="profile-tier">{membership.tier}</Text>
                    </View>
                  )}
                  {expiryText ? (
                    <Text className="t-tiny mono mt-4 block">
                      {'有效期至 ' + expiryText}
                    </Text>
                  ) : (
                    <Text className="t-tiny mt-4 block">尚未开通会员</Text>
                  )}
                </View>
                <UiArt
                  kind="medallion"
                  w={168}
                  glyph={growthGlyph}
                  variant="mine"
                ></UiArt>
              </View>
              {/*  三个读数：成长值 / 邀请 / 收益（都点得进去）  */}
              <View className="card stat-row gap">
                {stats?.map((item, index) => {
                  return (
                    <View
                      key={item.label}
                      className="stat-cell"
                      data-url={item.url}
                      onClick={this.go}
                    >
                      <Text className="stat-v mono">{item.value}</Text>
                      <Text className="stat-l">{item.label}</Text>
                    </View>
                  )
                })}
              </View>
              {/*  未开通时的开通引导（已开通不显示，避免常驻一个无意义的推销位）  */}
              {!membership.active && (
                <View
                  className="card card--signal upsell gap"
                  data-url="/pages/subscribe/index"
                  onClick={this.go}
                >
                  <UiArt
                    kind="gem"
                    w={150}
                    icon="crown"
                    variant="upsell"
                  ></UiArt>
                  <View className="f-1">
                    <Text className="upsell-t">开通会员 · 解锁全部权益</Text>
                    <Text className="upsell-d">
                      资源库、专属课程、闭门会、AI 诊断与专属服务
                    </Text>
                  </View>
                  <View className="upsell-btn">
                    <Text>查看方案</Text>
                    <UiIcon name="arrow" size={24} color="on-signal"></UiIcon>
                  </View>
                </View>
              )}
              {/*  功能行  */}
              <View className="rows gap">
                {rows?.map((item, index) => {
                  return (
                    <View
                      key={item.title}
                      className="card set-row"
                      data-url={item.url}
                      data-tab={item.tab}
                      onClick={this.go}
                    >
                      <View className="set-ico">
                        <UiIcon
                          name={item.icon}
                          size={38}
                          color={item.color}
                        ></UiIcon>
                      </View>
                      <View className="f-1">
                        <View
                          className="f"
                          style={{
                            gap: '0.35rem',
                          }}
                        >
                          <Text className="row-t">{item.title}</Text>
                          {item.tag && (
                            <Text className="tag tag--purple">{item.tag}</Text>
                          )}
                        </View>
                        <Text className="t-meta mt-4 block">{item.desc}</Text>
                      </View>
                      {item.trail && (
                        <Text className="t-meta">{item.trail}</Text>
                      )}
                      <UiIcon name="chev" size={28} color="ink-800"></UiIcon>
                    </View>
                  )
                })}
              </View>
              {/*  联系专属服务  */}
              {teacher && (
                <View
                  className="card card--signal contact gap"
                  data-url="/pages/advisor/index"
                  onClick={this.go}
                >
                  <UiAvatar name={teacher.name} size={80}></UiAvatar>
                  <View className="f-1">
                    <View
                      className="f"
                      style={{
                        gap: '0.3rem',
                      }}
                    >
                      <UiIcon name="chat" size={28} color="on-signal"></UiIcon>
                      <Text className="contact-t">联系专属服务</Text>
                    </View>
                    <Text className="contact-d">
                      {'你的服务老师：' + teacher.name}
                    </Text>
                    {teacher.role && (
                      <Text className="contact-d">
                        {teacher.role +
                          (teacher.service_region
                            ? ' · ' + teacher.service_region
                            : '')}
                      </Text>
                    )}
                  </View>
                  <View className="contact-btn">立即联系</View>
                </View>
              )}
              {/*  退出登录  */}
              <View className="card logout gap" onClick={this.logout}>
                <UiIcon name="logout" size={32} color="pulse"></UiIcon>
                <Text className="logout-t">退出登录</Text>
              </View>
              <View className="ta-c mt-16">
                <Text className="t-micro">{version}</Text>
              </View>
            </Block>
          )}
        </View>
        {showProfileEdit && (
          <UiProfileEdit
            name={me.name}
            avatarPath={me.avatarPath}
            onClose={this.closeProfile}
            onSaved={this.onProfileSaved}
          ></UiProfileEdit>
        )}
      </View>
    )
  }
}
export default _C
