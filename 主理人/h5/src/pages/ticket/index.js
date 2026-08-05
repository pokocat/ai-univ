import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text, Textarea } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 服务工单（设计稿 15）。两个页签：提交工单 / 我的工单。
 *
 * 问题类型与 SLA 都读 `ticket_type_rule`（服务端，运营可在线调），
 * 不在小程序里硬编码——硬编码那份要过审才能更新，运营改一次 SLA 就会两边不一致，
 * 而「预计响应时间」是对用户的承诺，不能有两个版本。
 *
 * 设计稿的「上传图片（最多 5 张）」与「AI 智能识别」**刻意不做**：
 * 会员端没有文件上传通道（只有头像那条专用的），也没有工单分类模型。
 * 摆一个点了报错的上传按钮、或一句假的「AI 已识别：登录异常」，
 * 都会让人以为系统已经理解了他的问题。改为如实说明截图怎么给。
 */
const api = require('../../api/mp.js')
const { toast, d16 } = require('../../utils/fmt.js')
const { navVars } = require('../../utils/layout.js')
const { isAuthGateError } = require('../../utils/auth.js')
const log = require('../../utils/log.js')
import UiErrbar from '../../components/errbar/index'
import UiSubhead from '../../components/subhead/index'
import UiArt from '../../components/art/index'
import UiIcon from '../../components/icon/index'
import './index.scss'
const STATUS_TAG = {
  待处理: 'amber',
  进行中: 'purple',
  已解决: 'green',
}
cacheOptions.setOptionsToCache({
  data: {
    navPad: '',
    tab: 'new',
    loading: true,
    err: '',
    retrying: false,
    types: [],
    picked: '',
    pickedRule: null,
    description: '',
    submitting: false,
    tickets: [],
    openCount: 0,
  },
  onLoad(options) {
    // 一次填单一个幂等键：重复点提交只受理一次（避免造出两张单 = 多余的人工工作量）
    this.idemKey = api.idemKey('mpticket')
    this.setData(
      Object.assign(
        {
          tab: (options && options.tab) === 'mine' ? 'mine' : 'new',
        },
        navVars()
      )
    )
  },
  onShow() {
    this.load()
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
      const [types, tickets] = await Promise.all([
        api.getTicketTypes(),
        api.getTickets(),
      ])
      const list = (tickets || []).map((t) => ({
        ticket_no: t.ticket_no,
        ticket_type: t.ticket_type,
        status: t.status,
        description: t.description,
        createdText: d16(t.created_at),
        tagColor: STATUS_TAG[t.status] || 'gray',
        icon: (types || []).reduce(
          (acc, r) => (r.type_code === t.ticket_type ? r.icon : acc),
          'headset'
        ),
      }))
      const picked =
        this.data.picked || ((types || [])[0] && types[0].type_code) || ''
      this.setData({
        loading: false,
        err: '',
        retrying: false,
        types: types || [],
        picked,
        pickedRule: (types || []).find((r) => r.type_code === picked) || null,
        tickets: list,
        openCount: list.filter((t) => t.status !== '已解决').length,
      })
    } catch (e) {
      if (isAuthGateError(e)) return
      log.error('ticket load', e.message)
      this.setData({
        loading: false,
        retrying: false,
        err: e.message,
      })
    }
  },
  pickType(e) {
    const code = getTarget(e.currentTarget, Taro).dataset.code
    this.setData({
      picked: code,
      pickedRule: this.data.types.find((r) => r.type_code === code) || null,
    })
  },
  onInput(e) {
    this.setData({
      description: e.detail.value,
    })
  },
  async submit() {
    if (this.data.submitting) return
    if (!this.data.picked) {
      toast('请选择问题类型')
      return
    }
    if (this.data.description.trim().length < 5) {
      toast('请把问题描述写清楚（至少 5 个字）')
      return
    }
    this.setData({
      submitting: true,
    })
    try {
      const t = await api.createTicket(
        this.data.picked,
        this.data.description.trim(),
        null,
        this.idemKey
      )
      Taro.redirectTo({
        url: '/pages/ticket-result/index?ticketNo=' + t.ticket_no,
      })
    } catch (e) {
      this.setData({
        submitting: false,
      })
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
      tab,
      openCount,
      types,
      picked,
      pickedRule,
      description,
      loading,
      tickets,
      submitting,
    } = this.data
    return (
      <View className="screen screen--bar">
        <View className="ambience"></View>
        <View className="layer">
          <UiSubhead title="服务工单" home="/pages/mine/index"></UiSubhead>
          {err && (
            <UiErrbar
              msg={err}
              retrying={retrying}
              onRetry={this.load}
            ></UiErrbar>
          )}
          <View className="topseg">
            <View
              className={
                'topseg-item ' + (tab === 'new' ? 'topseg-item--on' : '')
              }
              data-tab="new"
              onClick={this.switchTab}
            >
              提交工单
            </View>
            <View
              className={
                'topseg-item ' + (tab === 'mine' ? 'topseg-item--on' : '')
              }
              data-tab="mine"
              onClick={this.switchTab}
            >
              <Text>我的工单</Text>
              {openCount && <Text className="seg-badge">{openCount}</Text>}
            </View>
          </View>
          {/*  ───────── 提交工单 ─────────  */}
          {tab === 'new' ? (
            <Block>
              <View className="card card--hero tk-hero">
                <View
                  className="f-start"
                  style={{
                    gap: '0.2rem',
                  }}
                >
                  <View className="f-1">
                    <View className="eyebrow">
                      <UiIcon name="shield" size={26} color="signal"></UiIcon>
                      <Text>专属服务支持</Text>
                    </View>
                    <View className="title-grad tk-title">
                      快速响应 · 专业服务
                    </View>
                    <Text className="lead">
                      选择问题类型并描述清楚，我们会在承诺时限内响应
                    </Text>
                  </View>
                  <UiArt kind="gem" w={215} icon="headset" variant="tk"></UiArt>
                </View>
              </View>
              {/*  问题类型：来自 ticket_type_rule，含真实 SLA  */}
              <View className="card card-pad gap">
                <View className="f-between mb-12">
                  <Text className="col-h">问题类型</Text>
                  <Text className="req">必填</Text>
                </View>
                {types?.length ? (
                  <View className="type-grid">
                    {types?.map((item, index) => {
                      return (
                        <View
                          key={item.type_code}
                          className={
                            'pick ' +
                            (picked === item.type_code ? 'pick--on' : '')
                          }
                          data-code={item.type_code}
                          onClick={this.pickType}
                        >
                          {picked === item.type_code && (
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
                            size={38}
                            color={
                              picked === item.type_code ? 'signal' : 'ink-800'
                            }
                          ></UiIcon>
                          <Text className="pick-t">{item.type_code}</Text>
                        </View>
                      )
                    })}
                  </View>
                ) : (
                  <View className="blank">
                    <View className="blank-mark">
                      <UiIcon name="warn" size={45} color="warn"></UiIcon>
                    </View>
                    <Text className="blank-title">工单类型未配置</Text>
                    <Text className="blank-hint">
                      运营还没有配置可选的问题类型，可以先联系服务老师。
                    </Text>
                  </View>
                )}
                {pickedRule && (
                  <View className="box box--sunk mt-14">
                    <View className="f-between">
                      <Text className="t-sec fw-600">预计响应时间</Text>
                      <Text className="t-sec mono t-signal">
                        {pickedRule.sla_hours + ' 小时内'}
                      </Text>
                    </View>
                    <Text className="t-tiny mt-6 block">
                      这是该类问题的承诺时限，工作时间内优先处理。
                    </Text>
                  </View>
                )}
              </View>
              {/*  描述  */}
              <View className="card card-pad gap">
                <View className="f-between mb-10">
                  <Text className="col-h">描述问题</Text>
                  <Text className="req">必填</Text>
                </View>
                <Textarea
                  className="textarea"
                  value={description}
                  placeholder="请描述遇到的问题：什么场景、什么操作、看到什么提示。写清楚能让我们一次定位。"
                  maxlength="500"
                  onInput={this.onInput}
                ></Textarea>
                <View className="ta-r mt-6">
                  <Text className="t-micro mono">
                    {description?.length + '/500'}
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
                  <UiIcon name="info" size={28} color="signal"></UiIcon>
                  <Text className="t-sec fw-600">关于截图</Text>
                </View>
                <Text className="t-tiny mt-6 block">
                  目前会员端还没有开放图片上传通道，需要截图时服务老师会在企微里向你索取。
                  描述里写清报错原文同样有效。
                </Text>
              </View>
            </Block>
          ) : (
            <Block>
              {loading ? (
                <View className="card card-pad">
                  <View className="skeleton skeleton-block"></View>
                </View>
              ) : tickets?.length ? (
                <View className="card card-pad">
                  {tickets?.map((item, index) => {
                    return (
                      <View
                        key={item.ticket_no}
                        className="row-item"
                        data-url={
                          '/pages/ticket-result/index?ticketNo=' +
                          item.ticket_no
                        }
                        onClick={this.go}
                      >
                        <View className="row-ico row-ico--lg">
                          <UiIcon
                            name={item.icon}
                            size={38}
                            color="signal"
                          ></UiIcon>
                        </View>
                        <View className="f-1">
                          <View
                            className="f"
                            style={{
                              gap: '0.25rem',
                            }}
                          >
                            <Text className="tk-t f-1 truncate">
                              {item.ticket_type}
                            </Text>
                            <Text className={'tag tag--' + item.tagColor}>
                              {item.status}
                            </Text>
                          </View>
                          <Text className="t-meta mt-6 clamp-2 block">
                            {item.description}
                          </Text>
                          <View
                            className="f mt-6"
                            style={{
                              gap: '0.45rem',
                            }}
                          >
                            <Text className="t-micro mono">
                              {item.ticket_no}
                            </Text>
                            <Text className="t-micro mono">
                              {item.createdText}
                            </Text>
                          </View>
                        </View>
                        <UiIcon
                          name="chev"
                          size={28}
                          color="ink-800"
                          extStyle="align-self:center;"
                        ></UiIcon>
                      </View>
                    )
                  })}
                </View>
              ) : (
                <View className="card card-pad">
                  <View className="blank">
                    <View className="blank-mark">
                      <UiIcon name="headset" size={52} color="signal"></UiIcon>
                    </View>
                    <Text className="blank-title">还没有提交过工单</Text>
                    <Text className="blank-hint">
                      遇到问题时在「提交工单」页描述清楚，我们会在承诺时限内响应。
                    </Text>
                    <View
                      className="btn-sm mt-16"
                      data-tab="new"
                      onClick={this.switchTab}
                    >
                      去提交
                    </View>
                  </View>
                </View>
              )}
            </Block>
          )}
          {/*  ───────── 我的工单 ─────────  */}
        </View>
        {tab === 'new' && types?.length && (
          <View className="action-bar">
            <View
              className={'cta cta--primary ' + (submitting ? 'cta--busy' : '')}
              onClick={this.submit}
            >
              <Text>{submitting ? '提交中…' : '提交工单'}</Text>
              {!submitting && (
                <View className="cta-arrow">
                  <UiIcon name="arrow" size={30} color="on-signal"></UiIcon>
                </View>
              )}
            </View>
            <View
              className="f-center mt-12"
              style={{
                gap: '0.25rem',
              }}
            >
              <UiIcon name="shield" size={24} color="ink-600"></UiIcon>
              <Text className="t-micro">
                提交即表示同意《用户协议》与《隐私政策》
              </Text>
            </View>
          </View>
        )}
      </View>
    )
  }
}
export default _C
