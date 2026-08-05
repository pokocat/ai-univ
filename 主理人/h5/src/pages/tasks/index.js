import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/** 任务页（对齐设计稿 TaskTab）：头区进度条 + 打卡得积分（member_task + points_ledger，全真实）。 */
const api = require('../../api/mp.js')
const { isAuthGateError } = require('../../utils/auth.js')
const { d10, toast } = require('../../utils/fmt.js')
const share = require('../../behaviors/share.js')

/**
 * 优先级 → 标签修饰类。
 * 这里下发**类名**而不是色值：色值散进 JS 就绕开了 app.wxss 的调色板，
 * 换主题时改不到（上一版正是这么漂移的）。
 */
import UiErrbar from '../../components/errbar/index'
import UiIcon from '../../components/icon/index'
import './index.scss'
const PRIORITY_TAG = {
  高: 'tag--red',
  中: 'tag--amber',
  低: '', // 默认朱砂
}
cacheOptions.setOptionsToCache(
  share.withShare({
    data: {
      loadError: '',
      retrying: false,
      loaded: false,
      tasks: [],
      doneCount: 0,
      total: 0,
      donePoints: 0,
      pct: 0,
      busyId: 0,
    },
    onShow() {
      if (typeof this.getTabBar === 'function' && this.getTabBar()) {
        this.getTabBar().setData({
          selected: 2,
        })
      }
      this.load()
    },
    async onPullDownRefresh() {
      await this.load()
      Taro.stopPullDownRefresh()
    },
    /** 错误条重试入口 */
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
      if (this.data.loadError)
        this.setData({
          loadError: '',
        })
      try {
        const list = await api.getTasks()
        const tasks = (list || []).map((t) => ({
          id: t.id,
          title: t.title,
          done: !!t.done,
          typeText: t.task_type,
          tagClass:
            PRIORITY_TAG[t.priority] !== undefined
              ? PRIORITY_TAG[t.priority]
              : 'tag--gray',
          urgent: t.priority === '高',
          deadlineText: t.deadline ? d10(t.deadline) : '',
          points: t.points || 0,
        }))
        const done = tasks.filter((t) => t.done)
        this.setData({
          loaded: true,
          tasks,
          doneCount: done.length,
          total: tasks.length,
          donePoints: done.reduce((s, t) => s + t.points, 0),
          pct: tasks.length
            ? Math.round((done.length / tasks.length) * 100)
            : 0,
        })
      } catch (e) {
        if (isAuthGateError(e)) return // 未同意协议：已跳登录页，不再打扰
        this.setData({
          loadError: e.message,
          retrying: false,
        })
        toast(e.message)
      }
    },
    async complete(e) {
      const id = Number(getTarget(e.currentTarget, Taro).dataset.id)
      const t = this.data.tasks.find((x) => x.id === id)
      if (!t || t.done || this.data.busyId) return
      this.setData({
        busyId: id,
      })
      try {
        const r = await api.completeTask(id)
        Taro.showToast({
          title:
            r.pointsAwarded > 0
              ? `+${r.pointsAwarded} 积分，余额 ${r.pointsBalance}`
              : '已完成',
          icon: 'success',
        })
        await this.load()
      } catch (e2) {
        toast(e2.message)
      } finally {
        this.setData({
          busyId: 0,
        })
      }
    },
  })
)
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const {
      loadError,
      retrying,
      doneCount,
      total,
      donePoints,
      pct,
      loaded,
      tasks,
      busyId,
    } = this.data
    return (
      <View className="page">
        {loadError && (
          <UiErrbar
            msg={loadError}
            retrying={retrying}
            onRetry={this.retryLoad}
          ></UiErrbar>
        )}
        {/*  头区：进度是这一页的主对象，用大号数字直接承载，不再包进卡片  */}
        <View className="hd">
          <Text className="hd-title">我的任务</Text>
          <View className="f-between prog-row">
            <View className="f prog-count">
              <Text className="prog-num mono">{doneCount}</Text>
              <Text className="prog-total mono">{'/ ' + total}</Text>
              <Text className="t-muted">已完成</Text>
            </View>
            {donePoints > 0 && (
              <Text className="t-amber">{'今日 +' + donePoints + ' 积分'}</Text>
            )}
          </View>
          <View className="progress-track mt-20">
            <View
              className="progress-fill"
              style={{
                width: `${pct}%`,
              }}
            ></View>
          </View>
        </View>
        {!loaded ? (
          <View className="card card--list">
            <View className="task-cell">
              <View className="skeleton skeleton-line skeleton-line--title"></View>
              <View className="skeleton skeleton-line skeleton-line--body"></View>
            </View>
            <View className="task-cell">
              <View className="skeleton skeleton-line skeleton-line--title"></View>
              <View className="skeleton skeleton-line skeleton-line--body"></View>
            </View>
            <View className="task-cell">
              <View className="skeleton skeleton-line skeleton-line--title"></View>
              <View className="skeleton skeleton-line skeleton-line--body"></View>
            </View>
          </View>
        ) : tasks?.length === 0 ? (
          <View className="card empty-state">
            <View className="empty-state-mark">务</View>
            <Text className="empty-state-title">今天暂时没有任务</Text>
            <Text className="empty-state-desc">
              新的社群任务会出现在这里，稍后再来看看。
            </Text>
          </View>
        ) : (
          <View className="card card--list">
            {tasks?.map((item, index) => {
              return (
                <View
                  key={item.id}
                  className={
                    'task-cell ' + (item.done ? 'task-cell--done' : '')
                  }
                  data-id={item.id}
                  onClick={this.complete}
                >
                  <View className="f task-row">
                    <View
                      className={
                        'task-check ' +
                        (item.done ? 'task-check--done' : '') +
                        ' ' +
                        (item.urgent && !item.done ? 'task-check--urgent' : '')
                      }
                    >
                      {item.done && (
                        <UiIcon
                          name="check-circle"
                          size={22}
                          color="on-accent"
                        ></UiIcon>
                      )}
                    </View>
                    <View className="f-1">
                      <Text
                        className={
                          'task-title ' + (item.done ? 'task-title--done' : '')
                        }
                      >
                        {item.title}
                      </Text>
                      <View className="f task-meta">
                        <Text className={'tag ' + item.tagClass}>
                          {item.typeText}
                        </Text>
                        {item.deadlineText && (
                          <View className="f meta-clock">
                            <UiIcon name="clock" size={20} color="t3"></UiIcon>
                            <Text className="t-muted">{item.deadlineText}</Text>
                          </View>
                        )}
                        {item.points > 0 && (
                          <Text className="t-amber">
                            {'+' + item.points + ' 积分'}
                          </Text>
                        )}
                        {busyId === item.id && (
                          <Text className="t-muted">提交中…</Text>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        )}
        {/*
            列表是「一张卡 + 细线分隔」，不是「每条任务一张卡」。
            十条任务十张浮动卡片时，页面上只剩容器，没有内容层级。
           */}
      </View>
    )
  }
}
export default _C
