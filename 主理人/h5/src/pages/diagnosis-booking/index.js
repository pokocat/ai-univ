import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text, Picker, Input, Textarea } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 预约 AI 诊断（设计稿 23）。
 *
 * 诊断类型来自字典（`/mp/diagnosis/options`），不在客户端硬编码——
 * 硬编码那份要过审才能更新，运营新增一个类型就必然与服务端漂移。
 *
 * 幂等键在**打开表单时生成一次**，同一次填单的重复提交只受理一次
 * （护栏 22；服务端另有在途唯一索引兜底并发）。
 *
 * 上传补充材料：设计稿画了两个上传位，但服务端目前没有会员端文件上传通道
 * （只有头像那一条专用的），所以**不摆上传按钮**——摆一个点了报错的入口比不摆更糟。
 * 需要补材料时在诊断进行中由顾问在企微里收，这一点在提交说明里写清楚。
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
const TYPE_ICON = {
  增长诊断: 'chart',
  活跃诊断: 'pulse',
  转化诊断: 'funnel',
  服务诊断: 'headset',
}
const SUBJECTS = ['我的班级', '我的社群', '我的项目']
const SCALES = ['100 人以内', '100-500 人', '500-2000 人', '2000 人以上']
cacheOptions.setOptionsToCache({
  data: {
    navPad: '',
    err: '',
    retrying: false,
    submitting: false,
    types: [],
    subjects: SUBJECTS,
    subjectIdx: 0,
    scales: SCALES,
    scaleIdx: 0,
    form: {
      city: '',
      communityFocus: '',
      coreProblem: '',
      expectGoal: '',
    },
  },
  onLoad() {
    // 一次填单一个幂等键：重复点提交只受理一次
    this.idemKey = api.idemKey('mpdiag')
    this.setData(navVars())
    this.load()
  },
  async load() {
    this.setData({
      retrying: true,
    })
    try {
      const [options, me] = await Promise.all([
        api.getDiagnosisOptions(),
        api.getMe().catch(() => null),
      ])
      this.setData({
        err: '',
        retrying: false,
        types: ((options && options.types) || []).map((t) => ({
          label: t.label,
          icon: TYPE_ICON[t.label] || 'target',
          on: false,
        })),
        // 城市默认填档案里的，省一次输入；用户可改
        form: Object.assign({}, this.data.form, {
          city: (me && me.city) || '',
        }),
      })
    } catch (e) {
      if (isAuthGateError(e)) return
      log.error('diagnosis options', e.message)
      this.setData({
        retrying: false,
        err: e.message,
      })
    }
  },
  onInput(e) {
    const k = getTarget(e.currentTarget, Taro).dataset.k
    this.setData({
      ['form.' + k]: e.detail.value,
    })
  },
  pickSubject(e) {
    this.setData({
      subjectIdx: Number(e.detail.value),
    })
  },
  pickScale(e) {
    this.setData({
      scaleIdx: Number(e.detail.value),
    })
  },
  toggleType(e) {
    const label = getTarget(e.currentTarget, Taro).dataset.label
    this.setData({
      types: this.data.types.map((t) =>
        t.label === label
          ? Object.assign({}, t, {
              on: !t.on,
            })
          : t
      ),
    })
  },
  async submit() {
    if (this.data.submitting) return
    const picked = this.data.types.filter((t) => t.on).map((t) => t.label)
    if (!picked.length) {
      toast('请至少选择一个诊断类型')
      return
    }
    const f = this.data.form
    if (!f.coreProblem.trim()) {
      toast('请填写当前面临的核心问题')
      return
    }
    if (!f.expectGoal.trim()) {
      toast('请填写希望达成的目标')
      return
    }
    this.setData({
      submitting: true,
    })
    try {
      const booking = await api.createDiagnosisBooking(
        {
          types: picked,
          subject: this.data.subjects[this.data.subjectIdx],
          city: f.city.trim(),
          communityFocus: f.communityFocus.trim(),
          memberScale: this.data.scales[this.data.scaleIdx],
          coreProblem: f.coreProblem.trim(),
          expectGoal: f.expectGoal.trim(),
        },
        this.idemKey
      )
      Taro.redirectTo({
        url: '/pages/booking-result/index?bookingNo=' + booking.booking_no,
      })
    } catch (e) {
      this.setData({
        submitting: false,
      })
      // 配额用完 / 已有在途都是可预期结果，如实转述服务端的话
      toast(e.message)
    }
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
      subjects,
      subjectIdx,
      form,
      scales,
      scaleIdx,
      types,
      submitting,
    } = this.data
    return (
      <View className="screen screen--bar">
        <View className="ambience"></View>
        <View className="layer">
          <UiSubhead
            title="预约 AI 诊断"
            home="/pages/diagnosis/index"
          ></UiSubhead>
          {err && (
            <UiErrbar
              msg={err}
              retrying={retrying}
              onRetry={this.load}
            ></UiErrbar>
          )}
          <View className="card card--hero db-hero">
            <View
              className="f-start"
              style={{
                gap: '0.2rem',
              }}
            >
              <View className="f-1">
                <View className="title-grad db-title">AI 诊断预约</View>
                <Text className="lead mt-8">
                  提交社群与业务信息，获取增长、活跃、转化与服务诊断建议
                </Text>
                <View
                  className="f f-wrap mt-12"
                  style={{
                    gap: '0.25rem',
                  }}
                >
                  <View className="pill-outline">
                    <UiIcon name="sparkle" size={21} color="signal"></UiIcon>
                    <Text>智能匹配</Text>
                  </View>
                  <View className="pill-outline">
                    <UiIcon name="clock" size={21} color="signal-600"></UiIcon>
                    <Text>优先排期</Text>
                  </View>
                </View>
              </View>
              <UiArt kind="aigem" w={215} variant="db"></UiArt>
            </View>
          </View>
          {/*  诊断信息  */}
          <View className="card card-pad gap">
            <View className="f-between mb-8">
              <Text className="col-h">诊断信息</Text>
              <Text className="t-tiny t-danger">* 为必填</Text>
            </View>
            <View className="form-row">
              <View className="form-l">
                <UiIcon name="members" size={30} color="signal"></UiIcon>
                <Text>诊断对象</Text>
              </View>
              <Picker
                range={subjects}
                value={subjectIdx}
                onChange={this.pickSubject}
              >
                <View className="field-trail">
                  <Text>{subjects[subjectIdx] || '请选择'}</Text>
                  <UiIcon name="chev" size={26} color="ink-800"></UiIcon>
                </View>
              </Picker>
            </View>
            <View className="form-row">
              <View className="form-l">
                <UiIcon name="pin" size={30} color="signal"></UiIcon>
                <Text>所在城市</Text>
              </View>
              <Input
                className="field-inline"
                value={form.city}
                placeholder="选填"
                data-k="city"
                onInput={this.onInput}
              ></Input>
            </View>
            <View className="form-row">
              <View className="form-l">
                <UiIcon name="bookmark" size={30} color="signal"></UiIcon>
                <Text>社群方向</Text>
              </View>
              <Input
                className="field-inline"
                value={form.communityFocus}
                placeholder="如：本地生活 / 知识付费"
                data-k="communityFocus"
                onInput={this.onInput}
              ></Input>
            </View>
            <View className="form-row">
              <View className="form-l">
                <UiIcon name="user" size={30} color="signal"></UiIcon>
                <Text>会员规模</Text>
              </View>
              <Picker range={scales} value={scaleIdx} onChange={this.pickScale}>
                <View className="field-trail">
                  <Text>{scales[scaleIdx] || '请选择区间'}</Text>
                  <UiIcon name="chev" size={26} color="ink-800"></UiIcon>
                </View>
              </Picker>
            </View>
          </View>
          {/*  诊断类型：来自字典，不在客户端硬编码  */}
          <View className="card card-pad gap">
            <View className="mb-12">
              <Text className="col-h">诊断类型</Text>
              <Text className="star">*</Text>
              <Text className="t-tiny">（可多选）</Text>
            </View>
            <View className="four-col">
              {types?.map((item, index) => {
                return (
                  <View
                    key={item.label}
                    className={'pick ' + (item.on ? 'pick--on' : '')}
                    data-label={item.label}
                    onClick={this.toggleType}
                  >
                    {item.on && (
                      <View className="tile-check">
                        <UiIcon
                          name="check"
                          size={20}
                          color="on-signal"
                        ></UiIcon>
                      </View>
                    )}
                    <UiIcon
                      name={item.icon}
                      size={42}
                      color={item.on ? 'signal' : 'ink-800'}
                    ></UiIcon>
                    <Text>{item.label}</Text>
                  </View>
                )
              })}
            </View>
          </View>
          {/*  核心问题 / 期望目标  */}
          <View className="card card-pad gap">
            <View className="mb-10">
              <Text className="col-h">核心问题</Text>
              <Text className="star">*</Text>
            </View>
            <Textarea
              className="textarea"
              value={form.coreProblem}
              placeholder="简要描述当前面临的核心问题"
              maxlength="200"
              data-k="coreProblem"
              onInput={this.onInput}
            ></Textarea>
            <View className="ta-r mt-6">
              <Text className="t-micro mono">
                {form.coreProblem.length + '/200'}
              </Text>
            </View>
            <View className="mb-10 mt-16">
              <Text className="col-h">期望目标</Text>
              <Text className="star">*</Text>
            </View>
            <Textarea
              className="textarea"
              value={form.expectGoal}
              placeholder="描述希望通过诊断达成的目标"
              maxlength="200"
              data-k="expectGoal"
              onInput={this.onInput}
            ></Textarea>
            <View className="ta-r mt-6">
              <Text className="t-micro mono">
                {form.expectGoal.length + '/200'}
              </Text>
            </View>
          </View>
          <View className="box box--sunk gap">
            <View
              className="f"
              style={{
                gap: '0.3rem',
              }}
            >
              <UiIcon name="shield" size={28} color="signal"></UiIcon>
              <Text className="t-sec fw-600">提交后会发生什么</Text>
            </View>
            <Text className="t-tiny mt-6 block">
              提交后进入排期，服务老师会结合你的社群与业务数据出具诊断报告，一般
              2 个工作日内反馈。 进度会在「诊断记录」与站内消息里同步。
            </Text>
          </View>
        </View>
        <View className="action-bar">
          <View className="action-row">
            <View
              className={'cta cta--primary ' + (submitting ? 'cta--busy' : '')}
              onClick={this.submit}
            >
              <Text>{submitting ? '提交中…' : '提交预约'}</Text>
            </View>
            <View
              className="cta cta--ghost"
              data-url="/pages/advisor/index"
              onClick={this.go}
            >
              <UiIcon name="headset" size={30} color="signal"></UiIcon>
              <Text>咨询老师</Text>
            </View>
          </View>
        </View>
      </View>
    )
  }
}
export default _C
