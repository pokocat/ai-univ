import withWeapp, { cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text, Button, Input, Picker } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 收益页（对齐设计稿 EarningsTab）：收益镜像（SPEC §2.2 只读）+ 提现申请（审批协同，底部弹层）。
 * 提现流程：申请 → PC 审批中心 → 外部系统打款；中台不执行打款。
 */
const api = require('../../api/mp.js')
const { isAuthGateError } = require('../../utils/auth.js')
const { money, d16, toast } = require('../../utils/fmt.js')
const share = require('../../behaviors/share.js')
import UiErrbar from '../../components/errbar/index'
import UiSheet from '../../components/sheet/index'
import UiIcon from '../../components/icon/index'
import './index.scss'
const METHODS = ['微信', '支付宝', '银行卡']
const STATUS_TAG = {
  待审核: 'tag',
  已批准: 'tag tag--amber',
  已打款: 'tag tag--green',
  已拒绝: 'tag tag--red',
}
cacheOptions.setOptionsToCache(
  share.withShare({
    data: {
      loadError: '',
      retrying: false,
      withdrawable: 0,
      withdrawableText: '0',
      syncText: '',
      stats: [],
      withdrawals: [],
      canWithdraw: false,
      // 提现表单
      formOpen: false,
      amount: '',
      valid: false,
      hintText: '审批通过后由项目方系统打款',
      hintError: false,
      methods: METHODS,
      methodIdx: 0,
      account: '',
      submitting: false,
      idemKey: '',
    },
    onShow() {
      if (typeof this.getTabBar === 'function' && this.getTabBar()) {
        this.getTabBar().setData({
          selected: 3,
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
        const data = await api.getEarnings()
        const withdrawable = Number(data.summary.withdrawable || 0)
        this.setData({
          withdrawable,
          withdrawableText: money(withdrawable),
          canWithdraw: withdrawable >= 100,
          syncText: data.summary.synced_at
            ? ` · 同步于 ${d16(data.summary.synced_at)}`
            : '',
          stats: [
            {
              label: '累计收益（预估）',
              value: `¥${money(data.summary.total_est)}`,
            },
            {
              label: '待结算',
              value: `¥${money(data.summary.pending)}`,
            },
            {
              label: '已提现',
              value: `¥${money(data.paidOut)}`,
            },
            {
              label: '冻结中',
              value: `¥${money(data.summary.frozen)}`,
            },
          ],
          withdrawals: (data.withdrawals || []).map((w) => ({
            id: w.id,
            label: `提现至${w.method} ¥${money(w.amount)}`,
            timeText: d16(w.created_at),
            statusText: w.status,
            tagClass: STATUS_TAG[w.status] || 'tag',
            paid: w.status === '已打款',
          })),
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
    openForm() {
      if (!this.data.canWithdraw) return
      // 幂等键：一次填单一个键，重复点提交只受理一次
      this.setData({
        formOpen: true,
        amount: '',
        account: '',
        methodIdx: 0,
        valid: false,
        hintText: '审批通过后由项目方系统打款',
        hintError: false,
        idemKey: `mpwd-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 10)}`,
      })
    },
    closeForm() {
      this.setData({
        formOpen: false,
      })
    },
    onAmount(e) {
      const amount = e.detail.value
      const n = Number(amount)
      const valid =
        Number.isInteger(n) && n >= 100 && n <= this.data.withdrawable
      this.setData({
        amount,
        valid,
        hintError: !!amount && !valid,
        hintText:
          amount && !valid
            ? `请输入 100-${this.data.withdrawable} 之间的整数金额`
            : '审批通过后由项目方系统打款',
      })
    },
    onMethod(e) {
      this.setData({
        methodIdx: Number(e.detail.value),
      })
    },
    onAccount(e) {
      this.setData({
        account: e.detail.value,
      })
    },
    async submit() {
      if (!this.data.valid || this.data.submitting) return
      this.setData({
        submitting: true,
      })
      try {
        const r = await api.applyWithdrawal(
          Number(this.data.amount),
          METHODS[this.data.methodIdx],
          this.data.account || undefined,
          this.data.idemKey
        )
        this.setData({
          formOpen: false,
        })
        Taro.showToast({
          title: r.message || '提现申请已提交',
          icon: 'success',
        })
        await this.load()
      } catch (e) {
        toast(e.message)
      } finally {
        this.setData({
          submitting: false,
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
      withdrawableText,
      syncText,
      canWithdraw,
      stats,
      withdrawals,
      formOpen,
      amount,
      hintError,
      hintText,
      methods,
      methodIdx,
      account,
      valid,
      submitting,
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
        {/*
            通栏深墨资产面：余额是这一页唯一的主角。
            与首页会员卡同一套语言（通栏 + 下沿收圆角），两个 tab 之间不再是两种视觉体系。
           */}
        <View className="hero">
          <View className="hero-inner">
            <Text className="hero-title">我的收益</Text>
            <View className="amt-wrap">
              <Text className="amt-cur">¥</Text>
              <Text className="amt mono">{withdrawableText}</Text>
            </View>
            <Text className="hero-k">可提现余额</Text>
            <View className="hero-note">
              <Text className="hero-note-t">
                {'收益由项目方系统结算同步（只读镜像）' + syncText}
              </Text>
            </View>
          </View>
        </View>
        {/*  主操作紧跟余额：中间隔着四格统计的话，看完数字还要再找一遍按钮  */}
        <View className="withdraw-wrap">
          <Button
            className="btn btn--gradient"
            disabled={!canWithdraw}
            onClick={this.openForm}
          >
            <UiIcon
              name="wallet"
              size={30}
              color={canWithdraw ? 'on-accent' : 't3'}
            ></UiIcon>
            申请提现
          </Button>
          {!canWithdraw && (
            <View className="withdraw-hint">
              <Text className="t-muted">可提现余额满 ¥100 才可申请</Text>
            </View>
          )}
        </View>
        {/*  统计四宫格  */}
        <View className="stat-grid stat-grid--wrap">
          {stats?.map((item, index) => {
            return (
              <View key={item.label} className="stat-card stat-card--half">
                <Text className="stat-label">{item.label}</Text>
                <View>
                  <Text className="stat-value stat-value--lg mono">
                    {item.value}
                  </Text>
                </View>
              </View>
            )
          })}
        </View>
        {/*  提现记录  */}
        <View className="section-head">
          <Text className="section-title">提现记录</Text>
        </View>
        <View className="card card--list">
          {withdrawals?.length === 0 && (
            <View className="empty-row">
              <Text className="t-muted">暂无提现记录</Text>
            </View>
          )}
          {withdrawals?.map((item, index) => {
            return (
              <View key={item.id} className="row">
                <View className="f f-1 wd-row">
                  <View
                    className={'li-icon ' + (item.paid ? 'li-icon--ok' : '')}
                  >
                    <UiIcon
                      name="wallet"
                      size={26}
                      color={item.paid ? 'ok' : 'accent'}
                    ></UiIcon>
                  </View>
                  <View className="f-1">
                    <Text className="t-body">{item.label}</Text>
                    <View className="mt-6">
                      <Text className="t-muted">{item.timeText}</Text>
                    </View>
                  </View>
                </View>
                <Text className={item.tagClass}>{item.statusText}</Text>
              </View>
            )
          })}
        </View>
        <View className="foot-note">
          <Text className="t-muted">
            提现申请提交后进入审批流程，审批通过后由项目方系统打款，预计 1-3
            个工作日到账。
          </Text>
        </View>
        {/*  提现表单（底部弹层，对齐设计稿）  */}
        {formOpen && (
          <UiSheet title="申请提现" onClose={this.closeForm}>
            <View className="form-balance">
              <Text className="form-balance-k">可提现金额</Text>
              <View className="mt-6">
                <Text className="form-balance-v mono">
                  {'¥' + withdrawableText}
                </Text>
              </View>
            </View>
            <View className="mt-26">
              <Text className="t-sec">提现金额（100 起，整数）</Text>
              <Input
                type="number"
                value={amount}
                placeholder="最低 100 元"
                placeholderStyle="color:#6E685F"
                className={
                  'field-input ' + (hintError ? 'field-input--error' : '')
                }
                onInput={this.onAmount}
              ></Input>
              <View className="form-hint">
                <Text
                  className={
                    'form-hint-text ' +
                    (hintError ? 'form-hint-text--error' : '')
                  }
                >
                  {hintText}
                </Text>
              </View>
            </View>
            <View className="mt-6">
              <Text className="t-sec">提现渠道</Text>
              <Picker
                mode="selector"
                range={methods}
                value={methodIdx}
                onChange={this.onMethod}
              >
                <View className="f-between method-picker">
                  <Text className="t-body">{methods[methodIdx]}</Text>
                  <UiIcon name="chevron-right" size={28} color="t3"></UiIcon>
                </View>
              </Picker>
            </View>
            <View className="mt-26">
              <Text className="t-sec">收款账户（选填，银行卡请填卡号）</Text>
              <Input
                value={account}
                placeholder="默认使用实名账户"
                placeholderStyle="color:#6E685F"
                className="field-input"
                onInput={this.onAccount}
              ></Input>
            </View>
            <Button
              className="btn btn--gradient mt-40"
              disabled={!valid}
              loading={submitting}
              onClick={this.submit}
            >
              确认提交（进入审批）
            </Button>
          </UiSheet>
        )}
      </View>
    )
  }
}
export default _C
