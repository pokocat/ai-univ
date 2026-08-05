import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text, Textarea } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 服务评价（设计稿 24）。
 *
 * **必须带 targetType + targetRef 进来**：评价要归到具体的服务上（工单号 / 预约号），
 * 否则分数会落到空处、也无法防止同一件事被反复评。服务端会校验对象存在且属于本人。
 *
 * 已评价过时进入**改分态**（同一服务只有一行评价，重复提交是改分而不是追加）——
 * 追加会让「平均分」先要定义取哪一条，而没有人会想清楚这件事。
 *
 * 标签来自字典，不在客户端硬编码。
 */
const api = require('../../api/mp.js')
const { toast, d16 } = require('../../utils/fmt.js')
const { navVars } = require('../../utils/layout.js')
const { isAuthGateError } = require('../../utils/auth.js')
const log = require('../../utils/log.js')
import UiErrbar from '../../components/errbar/index'
import UiSubhead from '../../components/subhead/index'
import UiAvatar from '../../components/avatar/index'
import UiArt from '../../components/art/index'
import UiIcon from '../../components/icon/index'
import './index.scss'
const TAG_ICON = {
  响应及时: 'pulse',
  很专业: 'gem',
  资源有帮助: 'folder',
  诊断清晰: 'sparkle',
  还想继续沟通: 'chat',
}
const RATING_LABEL = {
  1: '很不满意',
  2: '不太满意',
  3: '一般',
  4: '满意',
  5: '非常满意',
}
cacheOptions.setOptionsToCache({
  data: {
    navPad: '',
    loading: true,
    err: '',
    retrying: false,
    targetType: '',
    targetRef: '',
    subject: null,
    existing: null,
    serviceAtText: '',
    rating: 5,
    ratingLabel: RATING_LABEL[5],
    content: '',
    tags: [],
    revisit: true,
    submitting: false,
  },
  onLoad(options) {
    this.setData(
      Object.assign(
        {
          targetType: decodeURIComponent((options && options.targetType) || ''),
          targetRef: (options && options.targetRef) || '',
        },
        navVars()
      )
    )
    this.load()
  },
  async load() {
    if (!this.data.targetType || !this.data.targetRef) {
      this.setData({
        loading: false,
        subject: null,
      })
      return
    }
    this.setData({
      retrying: true,
    })
    try {
      const s = await api.getReviewSubject(
        this.data.targetType,
        this.data.targetRef
      )
      const existing = s.existing
      const pickedTags = (existing && existing.tags) || []
      this.setData({
        loading: false,
        err: '',
        retrying: false,
        subject: s,
        existing,
        serviceAtText: d16(s.service_at),
        rating: existing ? existing.rating : 5,
        ratingLabel: RATING_LABEL[existing ? existing.rating : 5] || '',
        content: (existing && existing.content) || '',
        revisit: existing ? existing.revisit_willing !== false : true,
        tags: (s.tags || []).map((t) => ({
          label: t.label,
          icon: TAG_ICON[t.label] || 'ribbon',
          on: pickedTags.indexOf(t.label) >= 0,
        })),
      })
    } catch (e) {
      if (isAuthGateError(e)) return
      log.warn('review subject', e.message)
      this.setData({
        loading: false,
        retrying: false,
        subject: null,
      })
    }
  },
  setRating(e) {
    const n = Number(getTarget(e.currentTarget, Taro).dataset.n)
    this.setData({
      rating: n,
      ratingLabel: RATING_LABEL[n] || '',
    })
  },
  onInput(e) {
    this.setData({
      content: e.detail.value,
    })
  },
  toggleTag(e) {
    const label = getTarget(e.currentTarget, Taro).dataset.label
    this.setData({
      tags: this.data.tags.map((t) =>
        t.label === label
          ? Object.assign({}, t, {
              on: !t.on,
            })
          : t
      ),
    })
  },
  setRevisit(e) {
    this.setData({
      revisit: getTarget(e.currentTarget, Taro).dataset.v === '1',
    })
  },
  async submit() {
    if (this.data.submitting) return
    this.setData({
      submitting: true,
    })
    try {
      await api.submitReview({
        targetType: this.data.targetType,
        targetRef: this.data.targetRef,
        rating: this.data.rating,
        tags: this.data.tags.filter((t) => t.on).map((t) => t.label),
        content: this.data.content.trim(),
        revisitWilling: this.data.revisit,
      })
      toast('感谢你的反馈')
      setTimeout(() => this.back(), 900)
    } catch (e) {
      this.setData({
        submitting: false,
      })
      toast(e.message)
    }
  },
  back() {
    if (Taro.getCurrentPages().length > 1) Taro.navigateBack()
    else
      Taro.switchTab({
        url: '/pages/mine/index',
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
    const {
      err,
      retrying,
      loading,
      subject,
      existing,
      serviceAtText,
      ratingLabel,
      rating,
      content,
      tags,
      revisit,
      submitting,
    } = this.data
    return (
      <View className="screen screen--bar">
        <View className="ambience"></View>
        <View className="layer">
          <UiSubhead title="服务评价" home="/pages/mine/index"></UiSubhead>
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
          ) : subject ? (
            <Block>
              <View className="card result-hero">
                <View className="result-hero-text">
                  <View className="title-grad rv-title">
                    {existing ? '修改评价' : '服务已完成'}
                  </View>
                  <Text className="t-sec mt-8 block">
                    {existing
                      ? '你之前已评价过，可以直接修改'
                      : '为本次服务体验打个分，帮助我们持续优化'}
                  </Text>
                  <View
                    className="f mt-12"
                    style={{
                      gap: '0.25rem',
                    }}
                  >
                    <View className="pill-outline">
                      <UiIcon name="ribbon" size={21} color="signal"></UiIcon>
                      <Text>真实反馈</Text>
                    </View>
                    <View className="pill-outline">
                      <UiIcon name="shield" size={21} color="ok"></UiIcon>
                      <Text>持续优化</Text>
                    </View>
                  </View>
                </View>
                <View className="result-hero-art">
                  <UiArt kind="check" w={220} variant="rv"></UiArt>
                </View>
              </View>
              {/*  服务信息  */}
              <View className="card card-pad gap">
                <Text className="col-h mb-12 block">服务信息</Text>
                {subject.employee_name && (
                  <View className="f rv-teacher">
                    <UiAvatar
                      name={subject.employee_name}
                      size={96}
                      ring={true}
                    ></UiAvatar>
                    <View className="f-1">
                      <View
                        className="f"
                        style={{
                          gap: '0.3rem',
                        }}
                      >
                        <Text className="t-h3">{subject.employee_name}</Text>
                        <Text className="tag tag--purple">专属服务</Text>
                      </View>
                      {subject.employee_title && (
                        <Text className="t-tiny mt-6 block">
                          {subject.employee_title}
                        </Text>
                      )}
                    </View>
                  </View>
                )}
                <View className="three-col mt-12">
                  <View>
                    <View
                      className="f"
                      style={{
                        gap: '0.2rem',
                      }}
                    >
                      <UiIcon
                        name="calendar"
                        size={24}
                        color="ink-800"
                      ></UiIcon>
                      <Text className="t-tiny">服务类型</Text>
                    </View>
                    <Text className="rv-info-v">{subject.service_type}</Text>
                  </View>
                  <View>
                    <View
                      className="f"
                      style={{
                        gap: '0.2rem',
                      }}
                    >
                      <UiIcon name="clock" size={24} color="ink-800"></UiIcon>
                      <Text className="t-tiny">服务时间</Text>
                    </View>
                    <Text className="rv-info-v mono">{serviceAtText}</Text>
                  </View>
                  <View>
                    <View
                      className="f"
                      style={{
                        gap: '0.2rem',
                      }}
                    >
                      <UiIcon name="members" size={24} color="ink-800"></UiIcon>
                      <Text className="t-tiny">班级归属</Text>
                    </View>
                    <Text className="rv-info-v">
                      {subject.cohort_name || '—'}
                    </Text>
                  </View>
                </View>
              </View>
              {/*  评分  */}
              <View className="card card-pad gap">
                <View className="f-between mb-14">
                  <View>
                    <Text className="col-h">整体评价</Text>
                    <Text className="t-tiny">（点击星星打分）</Text>
                  </View>
                  <Text className="rv-label">{ratingLabel}</Text>
                </View>
                <View className="rv-stars">
                  {[1, 2, 3, 4, 5].map((item, index) => {
                    return (
                      <View
                        key={item}
                        className="rv-star"
                        data-n={item}
                        onClick={this.setRating}
                      >
                        <UiIcon
                          name="star2"
                          size={84}
                          color={item <= rating ? 'signal' : 'ink-400'}
                          fill={item <= rating}
                        ></UiIcon>
                      </View>
                    )
                  })}
                </View>
                <View className="ta-c mt-12">
                  <Text className="t-sec">
                    <Text className="mono">{rating}</Text>
                    {'分 · ' + ratingLabel}
                  </Text>
                </View>
              </View>
              {/*  评价内容  */}
              <View className="card card-pad gap">
                <View className="mb-10">
                  <Text className="col-h">评价内容</Text>
                  <Text className="t-tiny">（选填）</Text>
                </View>
                <Textarea
                  className="textarea"
                  value={content}
                  placeholder="分享你的服务体验、收获与建议…"
                  maxlength="200"
                  onInput={this.onInput}
                ></Textarea>
                <View className="ta-r mt-6">
                  <Text className="t-micro mono">
                    {content?.length + '/200'}
                  </Text>
                </View>
              </View>
              {/*  标签 + 回访意愿  */}
              <View className="card card-pad gap">
                <View className="mb-12">
                  <Text className="col-h">评价标签</Text>
                  <Text className="t-tiny">（可多选）</Text>
                </View>
                <View
                  className="f f-wrap"
                  style={{
                    gap: '0.35rem',
                  }}
                >
                  {tags?.map((item, index) => {
                    return (
                      <View
                        key={item.label}
                        className={
                          'chooser chooser--pill ' +
                          (item.on ? 'chooser--on' : '')
                        }
                        data-label={item.label}
                        onClick={this.toggleTag}
                      >
                        <UiIcon
                          name={item.icon}
                          size={24}
                          color={item.on ? 'signal' : 'ink-800'}
                        ></UiIcon>
                        <Text>{item.label}</Text>
                      </View>
                    )
                  })}
                </View>
                <View className="hr mt-16 mb-16"></View>
                <View className="f-between">
                  <View className="f-1">
                    <Text className="t-h4">是否愿意被回访</Text>
                    <Text className="t-tiny mt-4 block">
                      我们会根据反馈持续改进服务质量
                    </Text>
                  </View>
                  <View
                    className="f"
                    style={{
                      gap: '0.35rem',
                    }}
                  >
                    <View
                      className={
                        'chooser ' + (revisit === true ? 'chooser--on' : '')
                      }
                      data-v="1"
                      onClick={this.setRevisit}
                    >
                      愿意
                    </View>
                    <View
                      className={
                        'chooser ' + (revisit === false ? 'chooser--on' : '')
                      }
                      data-v="0"
                      onClick={this.setRevisit}
                    >
                      暂不
                    </View>
                  </View>
                </View>
              </View>
            </Block>
          ) : (
            <View className="card card-pad">
              <View className="blank">
                <View className="blank-mark">
                  <UiIcon name="ribbon" size={52} color="signal"></UiIcon>
                </View>
                <Text className="blank-title">找不到要评价的服务</Text>
                <Text className="blank-hint">
                  评价需要从具体的工单或诊断进入，这样分数才会归到对应的服务上。
                </Text>
                <View
                  className="btn-sm mt-16"
                  data-url="/pages/ticket/index?tab=mine"
                  onClick={this.go}
                >
                  去我的工单
                </View>
              </View>
            </View>
          )}
        </View>
        {subject && (
          <View className="action-bar">
            <View className="action-row">
              <View
                className={
                  'cta cta--primary ' + (submitting ? 'cta--busy' : '')
                }
                onClick={this.submit}
              >
                <UiIcon name="edit" size={32} color="on-signal"></UiIcon>
                <Text>
                  {submitting ? '提交中…' : existing ? '更新评价' : '提交评价'}
                </Text>
              </View>
              <View className="cta cta--ghost" onClick={this.back}>
                <UiIcon name="xcircle" size={30} color="signal"></UiIcon>
                <Text>稍后再说</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    )
  }
}
export default _C
