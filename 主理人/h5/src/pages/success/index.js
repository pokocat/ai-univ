import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 开通成功（设计稿 04）。
 *
 * 设计稿把五步时间线全画成「已完成」。这里**每一步的完成态都来自服务端状态**：
 * 已入会（订单已支付）/ 已完成缴费（订单已支付）/ 已绑定关系链（有推荐上级）/
 * 已分班（有安置记录）/ 已匹配服务顾问（有服务老师或已建顾问关系）。
 *
 * 为什么不能全打勾：付费到入群之间是有真实间隔的（推荐引擎排群、顾问承接、人工邀请）。
 * 全打勾的成功页会让刚付款的人以为已经进群了，然后来问「群在哪」——
 * 而正确的答案是「等顾问邀请」，那正是这一页应该说清楚的事。
 */
const api = require('../../api/mp.js')
const { toast, d10 } = require('../../utils/fmt.js')
const { navVars } = require('../../utils/layout.js')
const { isAuthGateError } = require('../../utils/auth.js')
const log = require('../../utils/log.js')
import UiErrbar from '../../components/errbar/index'
import UiApphead from '../../components/apphead/index'
import UiAvatar from '../../components/avatar/index'
import UiArt from '../../components/art/index'
import UiIcon from '../../components/icon/index'
import './index.scss'
cacheOptions.setOptionsToCache({
  data: {
    navPad: '',
    loading: true,
    err: '',
    retrying: false,
    orderNo: '',
    tier: '',
    steps: [],
    group: null,
    advisorUrl: '/pages/advisor/index',
    advisorTitle: '添加服务顾问',
    advisorDesc: '与专属老师建立联系',
  },
  onLoad(options) {
    this.setData(
      Object.assign(
        {
          orderNo: (options && options.orderNo) || '',
        },
        navVars()
      )
    )
    this.load()
  },
  async load() {
    this.setData({
      retrying: true,
    })
    try {
      const [me, membership, group, invite] = await Promise.all([
        api.getMe(),
        api.getMembership(),
        api.getMyGroup().catch(() => null),
        api.getInvite().catch(() => null),
      ])
      const order = this.data.orderNo
        ? await api.getOrder(this.data.orderNo).catch(() => null)
        : null
      const assignment = group && group.assignment
      const advisor = group && group.advisorStep
      const teacher = group && group.serviceTeacher
      const cohort = group && group.cohort
      const paid = order
        ? order.status === '已支付'
        : !!(membership && membership.active)
      const hasUpline = !!(invite && invite.upline && invite.upline.length)
      this.setData({
        loading: false,
        err: '',
        retrying: false,
        tier: (membership && membership.tier) || '',
        steps: [
          {
            icon: 'user',
            title: '已入会',
            desc: paid ? '恭喜你成为主理人公社会员' : '订单尚未确认到账',
            done: paid,
            state: paid ? '已完成' : '处理中',
          },
          {
            icon: 'card',
            title: '缴费确认',
            desc:
              order && order.paid_at
                ? '支付成功于 ' + d10(order.paid_at)
                : paid
                ? '支付已确认'
                : '等待支付回调确认',
            done: paid,
            state: paid ? '已完成' : '处理中',
          },
          {
            icon: 'link',
            title: '关系链绑定',
            desc: hasUpline
              ? '已绑定推荐人：' +
                (invite.upline[0].name || invite.upline[0].member_no)
              : '你不是通过邀请码注册的，没有推荐关系需要绑定',
            done: hasUpline,
            state: hasUpline ? '已完成' : '无需绑定',
          },
          {
            icon: 'members',
            title: '班级分配',
            desc: assignment
              ? '已为你分配「' +
                ((cohort && cohort.name) || assignment.group_name) +
                '」'
              : '运营正在为你匹配最合适的社群',
            done: !!assignment,
            state: assignment ? '已完成' : '进行中',
          },
          {
            icon: 'wechat',
            title: '服务顾问',
            desc:
              advisor && advisor.required
                ? '请添加顾问微信，加上之后即可进群'
                : teacher
                ? '专属服务老师：' + teacher.name
                : '顾问匹配中，稍后会通知你',
            done: !!teacher && !(advisor && advisor.required),
            state:
              advisor && advisor.required
                ? '待你操作'
                : teacher
                ? '已完成'
                : '进行中',
          },
        ],
        group: group
          ? Object.assign({}, group, {
              title:
                (cohort && cohort.name) ||
                (assignment && assignment.group_name) ||
                '我的社群',
              joined: assignment && assignment.status === '已入群',
              cohortStart: d10(cohort && cohort.start_date),
            })
          : null,
        advisorTitle:
          advisor && advisor.required
            ? '添加服务顾问'
            : teacher
            ? '联系服务老师'
            : '查看社群进度',
        advisorDesc:
          advisor && advisor.required
            ? '加上顾问才能进入班群'
            : '获取专属服务支持',
        advisorUrl:
          (advisor && advisor.required) || teacher
            ? '/pages/advisor/index'
            : '/pages/group/index',
      })
    } catch (e) {
      if (isAuthGateError(e)) return
      log.error('success load', e.message)
      this.setData({
        loading: false,
        retrying: false,
        err: e.message,
      })
    }
  },
  go(e) {
    const { url, tab } = getTarget(e.currentTarget, Taro).dataset
    if (!url) return
    // 社群是 tab 页，只能 switchTab；猜错会静默失败
    const isTab =
      tab ||
      /^\/pages\/(index|group|member|notifications|mine)\/index$/.test(url)
    if (isTab)
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
      steps,
      group,
      advisorUrl,
      advisorTitle,
      advisorDesc,
    } = this.data
    return (
      <View className="screen screen--bar">
        <View className="ambience"></View>
        <View className="layer">
          <UiApphead pro={true}></UiApphead>
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
              <View className="card card--hero suc-hero">
                {tier && (
                  <Text className="tag tag--purple tag--round">{tier}</Text>
                )}
                <View className="f-start mt-8">
                  <View className="f-1">
                    <View className="title-grad suc-title">开通成功</View>
                    <Text className="t-h3 mt-8 block">欢迎加入主理人公社</Text>
                  </View>
                  <UiArt
                    kind="check"
                    w={240}
                    variant="suc"
                    extStyle="margin-right:-0.25rem;"
                  ></UiArt>
                </View>
                <Text className="t-meta mt-16 block">
                  你的主理人之旅已正式启航
                </Text>
              </View>
              {/*  真实进度时间线：每一步的「已完成 / 进行中」都来自服务端状态  */}
              <View className="card card-pad gap">
                <View className="timeline">
                  {steps?.map((item, index) => {
                    return (
                      <View key={item.title} className="tl-item">
                        <View className="tl-rail">
                          <View
                            className="tl-node"
                            style={
                              item.done
                                ? ''
                                : 'background:var(--track);box-shadow:none;'
                            }
                          ></View>
                          {index < steps?.length - 1 && (
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
                          <Text className="tl-t">{item.title}</Text>
                          <Text className="t-meta mt-4 block">{item.desc}</Text>
                        </View>
                        <View className="tl-done">
                          <Text
                            style={{
                              color: `var(--${item.done ? 'ok' : 'ink-600'})`,
                            }}
                          >
                            {item.state}
                          </Text>
                          {item.done && (
                            <UiIcon name="shield" size={28} color="ok"></UiIcon>
                          )}
                        </View>
                      </View>
                    )
                  })}
                </View>
              </View>
              {/*  班级：只在真的分配了才显示  */}
              {group.assignment && (
                <View className="card card-pad gap suc-class">
                  <Text className="t-meta">你的班级已分配</Text>
                  <View
                    className="f f-wrap mt-6"
                    style={{
                      gap: '0.35rem',
                    }}
                  >
                    <Text className="title-grad suc-class-name">
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
                  {group.serviceTeacher && (
                    <View
                      className="f mt-16"
                      style={{
                        gap: '0.45rem',
                      }}
                    >
                      <UiAvatar
                        name={group.serviceTeacher.name}
                        size={80}
                      ></UiAvatar>
                      <View className="f-1">
                        <View
                          className="f"
                          style={{
                            gap: '0.3rem',
                          }}
                        >
                          <Text className="t-h4">
                            {'服务老师：' + group.serviceTeacher.name}
                          </Text>
                          <Text className="tag tag--purple">专属服务</Text>
                        </View>
                        <Text className="t-tiny mt-4 block">
                          {(group.serviceTeacher.role || '社群服务') +
                            (group.serviceTeacher.service_region
                              ? ' · ' + group.serviceTeacher.service_region
                              : '')}
                        </Text>
                      </View>
                    </View>
                  )}
                  <View className="info-card mt-16">
                    {group.cohort && group.cohort.start_date && (
                      <View className="ic-row">
                        <View className="ic-l">
                          <UiIcon
                            name="calendar"
                            size={26}
                            color="ink-800"
                          ></UiIcon>
                          <Text>开班时间</Text>
                        </View>
                        <Text className="ic-v mono">{group.cohortStart}</Text>
                      </View>
                    )}
                    <View className="ic-row">
                      <View className="ic-l">
                        <UiIcon
                          name="members"
                          size={26}
                          color="ink-800"
                        ></UiIcon>
                        <Text>班群状态</Text>
                      </View>
                      <Text
                        className="ic-v"
                        style={{
                          color: `var(--${group.joined ? 'ok' : 'warn'})`,
                        }}
                      >
                        {group.assignment.status}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
              {/*  两个下一步  */}
              <View className="two-col gap">
                <View
                  className="card ghost-action"
                  data-url="/pages/member/index"
                  data-tab={true}
                  onClick={this.go}
                >
                  <UiIcon name="card" size={42} color="signal"></UiIcon>
                  <View className="f-1">
                    <Text className="ga-t">查看会员卡</Text>
                    <Text className="ga-d">权益、有效期与会员码</Text>
                  </View>
                  <UiIcon name="chev" size={28} color="ink-800"></UiIcon>
                </View>
                <View
                  className="card ghost-action"
                  data-url={advisorUrl}
                  onClick={this.go}
                >
                  <UiIcon name="wechat" size={42} color="ok"></UiIcon>
                  <View className="f-1">
                    <Text className="ga-t">{advisorTitle}</Text>
                    <Text className="ga-d">{advisorDesc}</Text>
                  </View>
                  <UiIcon name="chev" size={28} color="ink-800"></UiIcon>
                </View>
              </View>
            </Block>
          )}
        </View>
        <View className="action-bar">
          <View
            className="cta cta--primary"
            data-url="/pages/index/index"
            data-tab={true}
            onClick={this.go}
          >
            <Text>进入主理人公社</Text>
            <View className="cta-arrow">
              <UiIcon name="arrow" size={30} color="on-signal"></UiIcon>
            </View>
          </View>
          <View className="ta-c mt-14">
            <Text className="t-micro">探索 · 连接 · 共创 · 成长</Text>
          </View>
        </View>
      </View>
    )
  }
}
export default _C
