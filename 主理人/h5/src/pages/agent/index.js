import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 我的团队（代理工作面，V39）。
 *
 * 只展示两块**中台真有的**数据：我名下的群（community_group.owner_member_id）与我服务归属的
 * 培训学员（training_enrollment.referrer_member_id）。
 *
 * 刻意不做分成/佣金板块：护栏 15——返佣永不进中台，中台只有 earnings_snapshot 只读镜像。
 * 摆一个算不出数的分成区块，比不摆更糟。收益仍在「我的收益」页（读那个镜像）。
 *
 * 页面全只读：代理在小程序里看进度，动手的操作（分班、改群）在管理台（referrer 角色）。
 */
const api = require('../../api/mp.js')
const { isAuthGateError } = require('../../utils/auth.js')
const { d10, toast } = require('../../utils/fmt.js')
const log = require('../../utils/log.js')
const share = require('../../behaviors/share.js')

/** 报名状态 → 展示分组（与后端 training_enrollment_status 字典同名，不自造标签） */
import UiErrbar from '../../components/errbar/index'
import './index.scss'
const STAGE_ORDER = [
  '待推荐人分班',
  '待运营分班',
  '已分班',
  '在训',
  '结业',
  '已取消',
]
cacheOptions.setOptionsToCache(
  share.withShare({
    data: {
      loading: true,
      loadError: '',
      retrying: false,
      available: false,
      hint: '',
      identity: '',
      groups: [],
      students: [],
      summary: null,
      stageTabs: [],
      stage: '全部',
    },
    onLoad() {
      this.load()
    },
    onPullDownRefresh() {
      this.load().then(() => Taro.stopPullDownRefresh())
    },
    async retryLoad() {
      if (this.data.retrying) return
      this.setData({
        retrying: true,
      })
      await this.load()
      this.setData({
        retrying: false,
      })
    },
    async load() {
      this.setData({
        loading: true,
        loadError: '',
      })
      try {
        const p = await api.getAgentPortfolio()
        const students = (p.students || []).map((s) => ({
          name: s.name,
          city: s.city || '',
          status: s.status,
          cohortName: s.cohort_name || '',
          groupName: s.group_name || '',
          // 时间取最靠后的那个已发生节点，避免一行里堆三个日期
          timeText: s.joined_at
            ? `入群 ${d10(s.joined_at)}`
            : s.assigned_at
            ? `分班 ${d10(s.assigned_at)}`
            : `报名 ${d10(s.created_at)}`,
        }))
        const present = STAGE_ORDER.filter((st) =>
          students.some((s) => s.status === st)
        )
        this.setData({
          available: !!p.available,
          hint: p.hint || '',
          identity: p.identity || '',
          groups: (p.groups || []).map((g) => ({
            id: g.id,
            name: g.name,
            city: g.city || '',
            typeText: g.group_type,
            status: g.status,
            // 水位口径与管理台一致：已占用 + 生效预占 / 上限
            usedText: `${Number(g.member_count) + Number(g.reserved || 0)}/${
              g.target_capacity
            }`,
            full:
              Number(g.member_count) + Number(g.reserved || 0) >=
              Number(g.target_capacity),
          })),
          students,
          summary: p.summary || null,
          stageTabs: ['全部'].concat(present),
          stage: '全部',
        })
      } catch (e) {
        if (isAuthGateError(e)) return
        log.warn('agent portfolio failed', e.message)
        this.setData({
          loadError: e.message,
        })
      } finally {
        this.setData({
          loading: false,
        })
      }
    },
    switchStage(e) {
      this.setData({
        stage: getTarget(e.currentTarget, Taro).dataset.stage,
      })
    },
    copyGroupId(e) {
      const id = getTarget(e.currentTarget, Taro).dataset.id
      Taro.setClipboardData({
        data: id,
        success: () => toast(`已复制 ${id}`),
      })
    },
  })
)
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const {
      loadError,
      retrying,
      identity,
      loading,
      available,
      hint,
      summary,
      groups,
      students,
      stageTabs,
      stage,
    } = this.data
    return (
      <View className="page page--sub">
        {loadError && (
          <UiErrbar
            msg={loadError}
            retrying={retrying}
            onRetry={this.retryLoad}
          ></UiErrbar>
        )}
        <View className="hd">
          <Text className="hd-title">我的团队</Text>
          <View>
            <Text className="hd-sub">
              {identity ? identity + ' · 我名下的群与学员' : '我名下的群与学员'}
            </Text>
          </View>
        </View>
        {/*  非结构身份：如实说明并给下一步（不摆空白页，也不报错）  */}
        {!loading && !available && (
          <View className="card">
            <View className="empty-card">
              <Text className="empty-state-title">
                这里面向代理 / 运营商 / 城市合伙人
              </Text>
              <View className="empty-state-desc">{hint}</View>
            </View>
          </View>
        )}
        {available && (
          <Block>
            {summary && (
              <View className="card card--list">
                <View className="row">
                  <Text className="info-k">学员合计</Text>
                  <Text className="t-body fw-500 mono">{summary.total}</Text>
                </View>
                <View className="row">
                  <Text className="info-k">待分班</Text>
                  <Text className="t-body fw-500 mono">
                    {summary.pending_assign}
                  </Text>
                </View>
                <View className="row">
                  <Text className="info-k">已分班待入群</Text>
                  <Text className="t-body fw-500 mono">{summary.assigned}</Text>
                </View>
                <View className="row">
                  <Text className="info-k">在训</Text>
                  <Text className="t-body fw-500 mono">
                    {summary.in_training}
                  </Text>
                </View>
              </View>
            )}
            {/*  我名下的群  */}
            <View className="section-head">
              <Text className="section-title">
                {'我名下的群（' + groups?.length + '）'}
              </Text>
            </View>
            {groups?.length === 0 ? (
              <View className="card">
                <View className="empty-card">
                  <Text className="empty-state-title">
                    还没有归属到你名下的群
                  </Text>
                  <View className="empty-state-desc">
                    群的归属由运营在管理台设置，设置后这里会出现
                  </View>
                </View>
              </View>
            ) : (
              <View className="card card--list">
                {groups?.map((item, index) => {
                  return (
                    <View
                      key={item.id}
                      className="row"
                      data-id={item.id}
                      onClick={this.copyGroupId}
                    >
                      <View className="f-1">
                        <Text className="t-strong">{item.name}</Text>
                        <View className="mt-4">
                          <Text className="t-muted">
                            {item.typeText +
                              (item.city ? ' · ' + item.city : '') +
                              ' ·\n              ' +
                              item.status}
                          </Text>
                        </View>
                      </View>
                      <Text
                        className={
                          (item.full ? 't-amber' : 't-muted') + ' mono'
                        }
                      >
                        {item.usedText}
                      </Text>
                    </View>
                  )
                })}
              </View>
            )}
            {/*  学员列表：只给姓名/阶段/班级，不给手机号（小程序不是后台）  */}
            <View className="section-head">
              <Text className="section-title">
                {'我的学员（' + students?.length + '）'}
              </Text>
            </View>
            {stageTabs?.length > 1 && (
              <View className="f stage-tabs">
                {stageTabs?.map((item, index) => {
                  return (
                    <Text
                      key={item}
                      className={
                        'stage-tab ' + (stage === item ? 'stage-tab--on' : '')
                      }
                      data-stage={item}
                      onClick={this.switchStage}
                    >
                      {item}
                    </Text>
                  )
                })}
              </View>
            )}
            {students?.length === 0 ? (
              <View className="card">
                <View className="empty-card">
                  <Text className="empty-state-title">还没有学员</Text>
                  <View className="empty-state-desc">
                    学员用你的邀请码注册并购买培训后会出现在这里，可去「邀请好友」拿码
                  </View>
                </View>
              </View>
            ) : (
              <View className="card card--list">
                {students?.map((item, index) => {
                  return (
                    <Block key={index}>
                      {(stage === '全部' || stage === item.status) && (
                        <View className="row">
                          <View className="f-1">
                            <Text className="t-strong">{item.name}</Text>
                            <View className="mt-4">
                              <Text className="t-muted">
                                {(item.cohortName || '未分班') +
                                  (item.groupName
                                    ? ' · ' + item.groupName
                                    : '') +
                                  (item.city ? ' · ' + item.city : '')}
                              </Text>
                            </View>
                          </View>
                          <View className="stu-right">
                            <Text className="tag tag--gray">{item.status}</Text>
                            <View className="mt-4">
                              <Text className="t-muted">{item.timeText}</Text>
                            </View>
                          </View>
                        </View>
                      )}
                    </Block>
                  )
                })}
              </View>
            )}
            <View className="plan-note">
              <Text className="t-muted">
                分班、改群等操作在管理台完成（用你的推荐人账号登录）。本页只读，数据与管理台同源。
              </Text>
            </View>
          </Block>
        )}
      </View>
    )
  }
}
export default _C
