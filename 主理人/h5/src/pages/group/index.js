import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 班级社群（设计稿 06）。两个页签：我的社群 / 班级活动。
 *
 * 刻意**不显示**设计稿里的「活跃度 92% · 今日在线 68 人」：库里没有这两个事实源，
 * 编一个百分比是整张设计稿里最容易被当真的假数据（运营会拿它汇报）。
 * 真实可给的是：班级人数、群主/服务老师、已入群成员名单、今日任务、活动报名数。
 *
 * 成员名单只含**已入群**的人（服务端口径），所以卡片里那句
 * 「正在邀请中的同学暂不显示」不是客套，是对名单口径的如实说明。
 */
const api = require('../../api/mp.js')
const share = require('../../behaviors/share.js')
const { toast, d16 } = require('../../utils/fmt.js')
const { navVars } = require('../../utils/layout.js')
const { isAuthGateError } = require('../../utils/auth.js')
const log = require('../../utils/log.js')
import UiErrbar from '../../components/errbar/index'
import UiApphead from '../../components/apphead/index'
import UiAvatar from '../../components/avatar/index'
import UiArt from '../../components/art/index'
import UiIcon from '../../components/icon/index'
import './index.scss'
const WEEK = ['日', '一', '二', '三', '四', '五', '六']

/** 任务类型 → 图标。未登记的类型回落到 star2，不留空图标位 */
const TASK_ICON = {
  课程学习: 'play',
  每日打卡: 'edit',
  互动交流: 'chat',
  邀请: 'members',
}
cacheOptions.setOptionsToCache(
  share.withShare({
    data: {
      navPad: '',
      tab: 'mine',
      loading: true,
      err: '',
      retrying: false,
      group: null,
      tasks: [],
      activities: [],
      activityCount: 0,
    },
    onLoad() {
      this.setData(navVars())
    },
    onShow() {
      const tabBar =
        typeof this.getTabBar === 'function' ? this.getTabBar() : null
      if (tabBar) tabBar.setTab(1)
      this.load()
    },
    onPullDownRefresh() {
      this.load().then(() => Taro.stopPullDownRefresh())
    },
    switchTab(e) {
      this.setData({
        tab: getTarget(e.currentTarget, Taro).dataset.tab,
      })
    },
    async load() {
      this.setData({
        retrying: true,
      })
      try {
        const [group, tasks, activities, invite] = await Promise.all([
          api.getMyGroup(),
          api.getTasks(),
          api.getActivities(),
          api.getInvite().catch(() => null),
        ])
        if (invite) this.setShareCode(invite.inviteCode)
        this.setData({
          loading: false,
          err: '',
          retrying: false,
          group: this.decorateGroup(group),
          tasks: this.decorateTasks(tasks),
          activities: (activities || []).map((a) => this.decorateActivity(a)),
          activityCount: (activities || []).filter((a) => a.status === '报名中')
            .length,
        })
      } catch (e) {
        if (isAuthGateError(e)) return
        log.error('group load', e.message)
        this.setData({
          loading: false,
          retrying: false,
          err: e.message,
        })
      }
    },
    decorateGroup(g) {
      if (!g) return null
      const a = g.assignment
      const cohort = g.cohort
      const advisor = g.advisorStep
      const members = (g.members || []).map((m) => ({
        name: m.name,
        is_me: m.is_me,
        // 后端只下发 avatar_key（相对路径由 ui-avatar 拼基址）；没有头像就走首字回落
        avatarPath: m.avatar_key ? '/mp/avatar/' + m.avatar_key : '',
      }))
      return Object.assign({}, g, {
        // 有班级用班名，没绑班级就用群名——不编一个班号
        title: (cohort && cohort.name) || (a && a.group_name) || '我的社群',
        glyph:
          cohort && cohort.cohort_code
            ? String(cohort.cohort_code).slice(-2)
            : '',
        joined: a && a.status === '已入群',
        advisorRequired: !!(advisor && advisor.required),
        members,
        membersHint: members.length ? '仅显示已入群同学' : '',
      })
    },
    /**
     * member_task 的完成态是布尔 `done`（不是三态 status）。
     * 设计稿有「进行中」这一档，但库里没有它——**不伪造**：未完成一律「待完成」，
     * 显示一个不存在的中间态会让人以为系统在跟踪他的进度。
     */
    decorateTasks(tasks) {
      return (tasks || []).slice(0, 3).map((t) => ({
        id: t.id,
        title: t.title,
        meta: [
          t.task_type,
          t.points ? '+' + t.points + ' 积分' : '',
          t.deadline,
        ]
          .filter(Boolean)
          .join(' · '),
        icon: TASK_ICON[t.task_type] || 'star2',
        done: t.done,
        stText: t.done ? '已完成' : '待完成',
        stColor: t.done ? 'ok' : 'signal-800',
      }))
    },
    decorateActivity(a) {
      const at = a.starts_at
        ? new Date(String(a.starts_at).replace(/-/g, '/').replace(/\..*$/, ''))
        : null
      let countdown = ''
      if (at && !isNaN(at.getTime())) {
        const diff = at.getTime() - Date.now()
        if (diff > 0) {
          const d = Math.floor(diff / 86400000)
          const h = Math.floor((diff % 86400000) / 3600000)
          countdown = d > 0 ? d + ' 天 ' + h + ' 时' : h + ' 小时'
        }
      }
      return Object.assign({}, a, {
        whenText:
          at && !isNaN(at.getTime())
            ? d16(a.starts_at) + '（周' + WEEK[at.getDay()] + '）'
            : '',
        countdown,
      })
    },
    async signUp(e) {
      const no = getTarget(e.currentTarget, Taro).dataset.no
      try {
        await api.signUpActivity(no)
        toast('报名成功')
        this.load()
      } catch (err) {
        // 名额满/状态变化都是可预期的业务结果，如实把服务端的话说出来
        toast(err.message)
      }
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
      tab,
      activityCount,
      err,
      retrying,
      loading,
      group,
      tasks,
      activities,
    } = this.data
    return (
      <View className="screen screen--tab">
        <View className="ambience"></View>
        <View className="layer">
          <UiApphead sub="连接主理人 · 共创新商业"></UiApphead>
          <View className="topseg">
            <View
              className={
                'topseg-item ' + (tab === 'mine' ? 'topseg-item--on' : '')
              }
              data-tab="mine"
              onClick={this.switchTab}
            >
              我的社群
            </View>
            <View
              className={
                'topseg-item ' + (tab === 'activity' ? 'topseg-item--on' : '')
              }
              data-tab="activity"
              onClick={this.switchTab}
            >
              <Text>班级活动</Text>
              {activityCount && (
                <Text className="seg-badge">{activityCount}</Text>
              )}
            </View>
          </View>
          {err && (
            <UiErrbar
              msg={err}
              retrying={retrying}
              onRetry={this.load}
            ></UiErrbar>
          )}
          {/*  ───────── 我的社群 ─────────  */}
          {tab === 'mine' ? (
            <Block>
              {loading ? (
                <View className="card card-pad">
                  <View className="skeleton skeleton-block"></View>
                </View>
              ) : !group.assignment ? (
                <View className="card card-pad">
                  <View className="blank">
                    <View className="blank-mark">
                      <UiIcon name="members" size={52} color="signal"></UiIcon>
                    </View>
                    <Text className="blank-title">还没有为你分配班级</Text>
                    <Text className="blank-hint">{group.hint}</Text>
                    {!group.hasPaidEntitlement && (
                      <View
                        className="btn-grad mt-16"
                        data-url="/pages/subscribe/index"
                        onClick={this.go}
                      >
                        去开通会员
                      </View>
                    )}
                  </View>
                </View>
              ) : (
                <Block>
                  <View className="card card--hero-3 class-hero">
                    <View className="tag tag--purple tag--round">
                      <UiIcon name="grid" size={21} color="signal"></UiIcon>
                      <Text>我的班级</Text>
                    </View>
                    <View
                      className="f-start mt-8"
                      style={{
                        gap: '0.2rem',
                      }}
                    >
                      <View className="f-1">
                        <View
                          className="f f-wrap"
                          style={{
                            gap: '0.35rem',
                          }}
                        >
                          <Text className="title-grad class-name">
                            {group.title}
                          </Text>
                          <View
                            className={
                              'tag tag--' +
                              (group.joined ? 'green' : 'amber') +
                              ' tag--round'
                            }
                          >
                            <UiIcon
                              name="shield"
                              size={21}
                              color={group.joined ? 'ok' : 'warn'}
                            ></UiIcon>
                            <Text>{group.assignment.status}</Text>
                          </View>
                        </View>
                        <Text className="lead mt-6">
                          链接资源 · 共同成长 · 放大影响力
                        </Text>
                      </View>
                      <UiArt
                        kind="medallion"
                        w={175}
                        glyph={group.glyph}
                        variant="cohort"
                        extStyle="margin-top:-0.25rem;"
                      ></UiArt>
                    </View>
                    <View className="box mt-12">
                      <View
                        className="f"
                        style={{
                          gap: '0.25rem',
                        }}
                      >
                        <UiIcon
                          name="members"
                          size={26}
                          color="ink-800"
                        ></UiIcon>
                        <Text className="t-sec">班级人数</Text>
                      </View>
                      <Text className="class-count mono">
                        {group.assignment.member_count + ' 人'}
                      </Text>
                    </View>
                    <View
                      className="two-col mt-8"
                      style={{
                        gap: '0.35rem',
                      }}
                    >
                      {group.owner && (
                        <View
                          className="box f"
                          style={{
                            gap: '0.35rem',
                          }}
                        >
                          <UiAvatar
                            name={group.owner.name}
                            size={56}
                          ></UiAvatar>
                          <View className="f-1">
                            <Text className="mini-t">{group.owner.name}</Text>
                            <Text className="mini-d">
                              {group.owner.identity || '群主'}
                            </Text>
                          </View>
                        </View>
                      )}
                      {group.serviceTeacher && (
                        <View
                          className="box f"
                          style={{
                            gap: '0.35rem',
                          }}
                        >
                          <UiAvatar
                            name={group.serviceTeacher.name}
                            size={56}
                          ></UiAvatar>
                          <View className="f-1">
                            <Text className="mini-t">
                              {group.serviceTeacher.name}
                            </Text>
                            <Text className="mini-d">
                              {group.serviceTeacher.role || '服务老师'}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                  {/*  两个大动作  */}
                  <View className="two-col gap">
                    <View
                      className="big-action big-action--grad"
                      data-url="/pages/group-qr/index"
                      onClick={this.go}
                    >
                      <UiIcon name="chat" size={45} color="on-signal"></UiIcon>
                      <View>
                        <Text className="ba-t ba-t--on">进入班群</Text>
                        <Text className="ba-d ba-d--on">
                          与同学一起交流成长
                        </Text>
                      </View>
                      <UiIcon
                        name="arrow"
                        size={28}
                        color="on-signal"
                        extStyle="position:absolute;right:0.6rem;top:0.6rem;"
                      ></UiIcon>
                    </View>
                    <View
                      className="big-action big-action--ghost"
                      data-url="/pages/advisor/index"
                      onClick={this.go}
                    >
                      <UiIcon name="wechat" size={45} color="ok"></UiIcon>
                      <View>
                        <Text className="ba-t">
                          {group.advisorRequired
                            ? '添加服务顾问'
                            : '联系服务老师'}
                        </Text>
                        <Text className="ba-d">
                          {group.advisorRequired
                            ? '加上顾问才能进群'
                            : '获取专属服务支持'}
                        </Text>
                      </View>
                      <UiIcon
                        name="arrow"
                        size={28}
                        color="signal"
                        extStyle="position:absolute;right:0.6rem;top:0.6rem;"
                      ></UiIcon>
                    </View>
                  </View>
                  {/*  班级成员  */}
                  <View className="card card-pad gap">
                    <View className="f-between mb-12">
                      <View
                        className="f"
                        style={{
                          gap: '0.2rem',
                        }}
                      >
                        <Text className="col-h">班级成员</Text>
                        <Text className="t-tiny mono">
                          {'(' + group.assignment.member_count + ')'}
                        </Text>
                      </View>
                      <Text className="t-tiny">{group.membersHint}</Text>
                    </View>
                    {group.members.length ? (
                      <View className="roster">
                        {group.members.map((item, index) => {
                          return (
                            <View key={index} className="roster-i">
                              <UiAvatar
                                name={item.name}
                                path={item.avatarPath}
                                size={84}
                                ring={item.is_me}
                              ></UiAvatar>
                              <Text className="roster-n">
                                {item.name || '会员'}
                              </Text>
                              {item.is_me && (
                                <Text className="me-pill">我</Text>
                              )}
                            </View>
                          )
                        })}
                      </View>
                    ) : (
                      <View className="blank">
                        <View className="blank-mark">
                          <UiIcon
                            name="members"
                            size={45}
                            color="signal"
                          ></UiIcon>
                        </View>
                        <Text className="blank-title">名单还没有人</Text>
                        <Text className="blank-hint">
                          已确认入群的同学会出现在这里；正在邀请中的同学暂不显示。
                        </Text>
                      </View>
                    )}
                  </View>
                  {/*  今日班级任务  */}
                  <View className="card card-pad gap">
                    <View className="f-between mb-8">
                      <Text className="col-h">今日班级任务</Text>
                      <View
                        className="link-trail"
                        data-url="/pages/tasks/index"
                        onClick={this.go}
                      >
                        <Text>查看全部任务</Text>
                        <UiIcon name="chev" size={22} color="ink-800"></UiIcon>
                      </View>
                    </View>
                    {tasks?.length ? (
                      <Block>
                        {tasks?.map((item, index) => {
                          return (
                            <View key={item.id} className="row-item">
                              <View className="row-ico">
                                <UiIcon
                                  name={item.icon}
                                  size={32}
                                  color="signal"
                                ></UiIcon>
                              </View>
                              <View className="f-1">
                                <Text className="task-t">{item.title}</Text>
                                <Text className="t-tiny mt-4 block">
                                  {item.meta}
                                </Text>
                              </View>
                              <View
                                className="f"
                                style={{
                                  gap: '0.15rem',
                                }}
                              >
                                <Text
                                  className="task-st"
                                  style={{
                                    color: `var(--${item.stColor})`,
                                  }}
                                >
                                  {item.stText}
                                </Text>
                                {item.done ? (
                                  <UiIcon
                                    name="shield"
                                    size={24}
                                    color="ok"
                                  ></UiIcon>
                                ) : (
                                  <UiIcon
                                    name="chev"
                                    size={24}
                                    color="signal"
                                  ></UiIcon>
                                )}
                              </View>
                            </View>
                          )
                        })}
                      </Block>
                    ) : (
                      <View className="blank">
                        <View className="blank-mark">
                          <UiIcon
                            name="shield"
                            size={45}
                            color="signal"
                          ></UiIcon>
                        </View>
                        <Text className="blank-title">今天没有待完成任务</Text>
                        <Text className="blank-hint">
                          班级任务由运营发布，有新任务时会出现在这里。
                        </Text>
                      </View>
                    )}
                  </View>
                </Block>
              )}
              {/*  未分配：如实说明下一步，不摆一个空的班级卡  */}
            </Block>
          ) : (
            <Block>
              {loading ? (
                <View className="card card-pad">
                  <View className="skeleton skeleton-block"></View>
                </View>
              ) : activities?.length ? (
                <Block>
                  {activities?.map((item, index) => {
                    return (
                      <View
                        key={item.activity_no}
                        className={'card card-pad ' + (index ? 'gap' : '')}
                      >
                        <View
                          className="f-start"
                          style={{
                            gap: '0.525rem',
                          }}
                        >
                          <View className="act-thumb">
                            {item.status === '报名中' && (
                              <Text className="tag tag--pink act-badge">
                                报名中
                              </Text>
                            )}
                            <Text className="act-cover">
                              {item.cover_text || item.title}
                            </Text>
                          </View>
                          <View className="f-1">
                            <Text className="act-t">{item.title}</Text>
                            <Text className="t-tiny mono mt-6 block">
                              {item.whenText}
                            </Text>
                            {item.venue && (
                              <Text className="t-tiny mt-4 block">
                                {item.venue}
                              </Text>
                            )}
                            <View
                              className="f mt-8"
                              style={{
                                gap: '0.25rem',
                              }}
                            >
                              <Text className="t-tiny">
                                已有
                                <Text className="mono">
                                  {item.signup_count}
                                </Text>
                                人报名
                              </Text>
                              {item.capacity && (
                                <Text className="t-tiny">
                                  / 限
                                  <Text className="mono">{item.capacity}</Text>
                                  人
                                </Text>
                              )}
                            </View>
                          </View>
                          <View className="ta-c act-side">
                            {item.countdown && (
                              <Text className="t-micro">距开始</Text>
                            )}
                            {item.countdown && (
                              <Text className="act-cd mono">
                                {item.countdown}
                              </Text>
                            )}
                            {item.signed_up ? (
                              <View className="btn-outline">已报名</View>
                            ) : item.status === '报名中' ? (
                              <View
                                className="btn-grad"
                                data-no={item.activity_no}
                                onClick={this.signUp}
                              >
                                我要报名
                              </View>
                            ) : (
                              <Text className="t-tiny">{item.status}</Text>
                            )}
                          </View>
                        </View>
                        {item.summary && (
                          <View className="box box--sunk mt-12">
                            <Text className="t-meta">{item.summary}</Text>
                          </View>
                        )}
                      </View>
                    )
                  })}
                </Block>
              ) : (
                <View className="card card-pad">
                  <View className="blank">
                    <View className="blank-mark">
                      <UiIcon name="calendar" size={52} color="signal"></UiIcon>
                    </View>
                    <Text className="blank-title">近期没有活动排期</Text>
                    <Text className="blank-hint">
                      线下沙龙与闭门会开放报名时会出现在这里，也可以先在公告中心看看最新动态。
                    </Text>
                    <View
                      className="btn-sm mt-16"
                      data-url="/pages/notifications/index"
                      data-tab={true}
                      onClick={this.go}
                    >
                      去公告中心
                    </View>
                  </View>
                </View>
              )}
            </Block>
          )}
          {/*  ───────── 班级活动 ─────────  */}
        </View>
      </View>
    )
  }
}
export default _C
