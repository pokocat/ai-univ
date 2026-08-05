import withWeapp, { cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text, Button, Image } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
/**
 * 我的培训（方案 §6.4）：「等待分班 → 添加班级顾问 → 加入班级群 → 我的班级」四个连续状态
 * 做成**一个页面的四段式视图**，由后端 GET /mp/training/enrollment 的 phase 驱动。
 *
 * 为什么不做四个页面：这四态是同一条链路上的先后时刻，用户每次进来只可能落在其中一态，
 * 拆页会带来「该跳哪一页」的判定与页面栈成本，而后端那个聚合本来就是为单页四态设计的
 * （phase + enrollment + contactWay + hint 一次给全）。
 *
 * 诚实度约定（CLAUDE.md 前端诚实度）：
 * - 阶段推进全部由服务端事件驱动（企微加顾问回调 / 入群回调），本页**只读**，
 *   任何按钮都不会伪造状态；「刷新状态」只是重新拉接口，phase 没变就如实说没变。
 * - 后端没给的字段（企业认证信息、顾问头像）一律不展示，不用占位图硬凑；
 *   有字段但为空的（讲师/开课时间）显示「—」。
 * - 引导文案优先用接口 hint（推荐人轨与运营轨措辞不同，由后端裁定），不在前端另编一套；
 *   唯一例外是运营轨已分班（见 OPS_PLACED_VIEW，后端文案指代一个本页不存在的入口名）。
 */
const api = require('../../api/mp.js')
const { isAuthGateError } = require('../../utils/auth.js')
const { d10, toast } = require('../../utils/fmt.js')
const share = require('../../behaviors/share.js')
const qrcode = require('../../utils/qrcode.js')
const wecomJoin = require('../../utils/wecom-join.js')

/** 进度条四段（方案 §6.4 的四个连续状态，压成短标签） */
import UiErrbar from '../../components/errbar/index'
import UiIcon from '../../components/icon/index'
import './index.scss'
const STEP_LABELS = ['分班', '加顾问', '进群', '在训']
const PHASE_INDEX = {
  waiting_assign: 0,
  add_advisor: 1,
  join_group: 2,
  in_cohort: 3,
}

/**
 * 运营轨已分班压成三段：这条轨道**没有「加顾问」这一步**（顾问码只在推荐人轨分班时生成）。
 * 留着四段就只能在「加顾问」上二选一地撒谎——标成 current 是指一个他做不到的动作，
 * 标成 done 是说一件没发生的事，而卡片标题此时已经是「加入班级群」。
 */
const OPS_STEP_LABELS = ['分班', '进群', '在训']

/** 主卡标题：口径统一为「班级顾问」，不出现「机器人自动拉群」（方案 §6.4） */
const PHASE_TITLE = {
  waiting_assign: '等待分班',
  add_advisor: '添加班级顾问',
  join_group: '加入班级群',
  in_cohort: '我的班级',
}

/**
 * 运营轨已分班（phase 仍是 add_advisor，但没有本人专属顾问码）的页面自有标题与文案。
 * 不照抄后端 hint 的原因只剩「入口指代」：后端说「请从「加入班级群」入口扫码」，
 * 而本页的官方按钮就在眼前。两种子态分开说——
 * 有插件入口就让他点击，没入口才说等客服对接。
 */
const OPS_PLACED_VIEW = {
  withEntry: {
    title: '加入班级群',
    hint: '本次分班由运营安置，点击下方「加入群聊」进入班级群',
  },
  waiting: {
    title: '运营安置中',
    hint: '本次分班由运营安置，入群由专属客服与你对接',
  },
}

/** 刷新后 phase 没变时的如实说明（不同阶段等的事件不同） */
const NO_CHANGE_TIP = {
  waiting_assign: '班级还在安排中，安排好后这里会自动更新',
  add_advisor: '还没收到顾问添加成功的通知，添加后请稍等几秒再刷新',
  join_group: '还没收到入群成功的通知，进群后这里会自动更新',
  in_cohort: '已是最新状态',
}

/** 分段进度：当前段高亮，之前的段置完成，连接线随进度点亮（运营轨已分班走三段，当前段=进群） */
function buildSteps(phase, opsPlaced) {
  const labels = opsPlaced ? OPS_STEP_LABELS : STEP_LABELS
  const idx = opsPlaced ? OPS_STEP_LABELS.indexOf('进群') : PHASE_INDEX[phase]
  if (idx === undefined) return []
  return labels.map((label, i) => ({
    label,
    state: i < idx ? 'done' : i === idx ? 'current' : 'todo',
    linked: i > 0 && i <= idx,
  }))
}

/** 开课周期：起止都有给区间，只有开课日给「起」，都没有给「—」（不写死基准日） */
function periodText(start, end) {
  if (start && end) return `${d10(start)} → ${d10(end)}`
  if (start) return `${d10(start)} 起`
  return '—'
}
cacheOptions.setOptionsToCache(
  share.withShare({
    data: {
      loadError: '',
      retrying: false,
      refreshing: false,
      loaded: false,
      phase: '',
      title: '',
      hint: '',
      steps: [],
      /** 报名信息行（全部真实字段，缺失显示 —） */
      info: [],
      /** 班级信息（分班后才有） */
      cohortName: '',
      instructor: '',
      periodText: '',
      groupName: '',
      joinedAtText: '',
      trackText: '',
      statusText: '',
      /** 顾问卡：{name, metaText} —— 后端无姓名时退回「班级顾问」，无认证信息则整段不显示 */
      advisor: null,
      /** 顾问二维码入口（contact-entry） */
      contactAvailable: false,
      contactQr: '',
      contactHint: '',
      contactExpiresText: '',
      /** 运营轨：分班由运营安置、没有顾问码；有官方插件入口则本页自助进群。 */
      opsPlaced: false,
      /** 班级群入口（join-entry） */
      joinAvailable: false,
      joinUrl: '',
      joinHint: '',
    },
    onShow() {
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
    /**
     * 「刷新状态」：阶段推进靠企微回调，用户加完顾问/进完群会想立刻确认。
     * 拉完发现 phase 没变就照实说没变——不做「已提交」这类看不出真假的提示。
     */
    async refreshStatus() {
      if (this.data.refreshing) return
      const before = this.data.phase
      // 运营轨已分班等的是入群事件，不是「加顾问成功」——他压根没有顾问可加，
      // 照 phase 取 add_advisor 那句会说一件与他无关的事（load 后 opsPlaced 会被覆盖，先存下来）
      const opsBefore = this.data.opsPlaced
      this.setData({
        refreshing: true,
      })
      await this.load()
      this.setData({
        refreshing: false,
      })
      if (this.data.phase === before && !this.data.loadError) {
        toast(
          (opsBefore ? NO_CHANGE_TIP.join_group : NO_CHANGE_TIP[before]) ||
            '已是最新状态'
        )
      }
    },
    async load() {
      if (this.data.loadError)
        this.setData({
          loadError: '',
        })
      try {
        const data = await api.getTrainingEnrollment()
        const phase = data.phase || 'none'
        const e = data.enrollment || null
        if (phase === 'none' || !e) {
          this.setData({
            loaded: true,
            phase: 'none',
            title: '尚无培训报名',
            hint: data.hint || '',
            steps: [],
            info: [],
            advisor: null,
            contactAvailable: false,
            joinAvailable: false,
            opsPlaced: false,
          })
          return
        }

        /**
         * 顾问码只在「加顾问/进群」阶段有意义；官方入群入口在「已分班之后」都可能有：
         * 运营轨已分班（phase 仍是 add_advisor）后端也会放行入口，本页直接展示就不用再绕「我的社群」。
         *
         * 为什么已分班阶段**一律**取一次 join-entry，而不按 `data.track === "OPS"` 省这个请求：
         * ①判轨真正的依据是「有没有发过顾问码」（contact-entry 的 contactWayStatus 是否缺席），
         *   而归属转交会把运营轨报名的 track 改成 REFERRER 却不追发顾问码——按 track 判会正好漏掉这类；
         * ②contact-entry 与 join-entry 是并发的，想先判轨再决定就得串成两跳。
         * 两个 GET 都是只读无副作用，宁可多打一个，不为省一次请求换来判错轨或多一跳等待。
         */
        const needContact = phase === 'add_advisor' || phase === 'join_group'
        const needJoin =
          phase === 'add_advisor' ||
          phase === 'join_group' ||
          phase === 'in_cohort'
        const [contact, join] = await Promise.all([
          needContact ? api.getTrainingContactEntry() : Promise.resolve(null),
          needJoin ? api.getTrainingJoinEntry() : Promise.resolve(null),
        ])
        const info = [
          {
            k: '培训套餐',
            v: e.plan_name || '—',
          },
          {
            k: '订单号',
            v: e.order_no || '—',
          },
          {
            k: '报名时间',
            v: e.created_at ? d10(e.created_at) : '—',
          },
          {
            k: '报名状态',
            v: e.status || '—',
          },
        ]
        if (e.referrer_name)
          info.push({
            k: '班主任（推荐人）',
            v: e.referrer_name,
          })
        if (e.cohort_code)
          info.push({
            k: '班级编号',
            v: e.cohort_code,
          })

        // 顾问展示信息：姓名缺失退回「班级顾问」；服务区域/部门有才拼，认证信息后端没有就不显示
        const ap = (contact && contact.advisor) || null
        const advisor = needContact
          ? {
              name: (ap && ap.name) || '班级顾问',
              char: ((ap && ap.name) || '顾').charAt(0),
              metaText: ap
                ? [ap.service_region, ap.department].filter(Boolean).join(' · ')
                : '',
            }
          : null

        // contactWayStatus 只在存在「联系我」配置时才有：没有 = 运营轨安置（沿既有入群链路，无顾问码）
        const opsPlaced =
          phase === 'add_advisor' && !!contact && !contact.contactWayStatus
        // scene=1 官方插件入口可用 = 后端放行且真给了 url；scene=2 活码图片绝不再进本页。
        const joinAvailable = !!(join && join.available && join.joinUrl)
        const ops = opsPlaced
          ? joinAvailable
            ? OPS_PLACED_VIEW.withEntry
            : OPS_PLACED_VIEW.waiting
          : null
        this.setData({
          loaded: true,
          phase,
          title: ops ? ops.title : PHASE_TITLE[phase] || '我的培训',
          hint: ops ? ops.hint : data.hint || '',
          steps: buildSteps(phase, opsPlaced),
          info,
          cohortName: e.cohort_name || '—',
          instructor: e.instructor || '—',
          periodText: periodText(e.start_date, e.end_date),
          groupName: e.group_name || '—',
          joinedAtText: e.joined_at ? d10(e.joined_at) : '',
          trackText: e.referrer_name
            ? `班主任（推荐人）${e.referrer_name}`
            : '由运营为你安排班级',
          statusText: e.status || '',
          advisor,
          contactAvailable: !!(
            contact &&
            contact.available &&
            contact.qrcodeUrl
          ),
          contactQr: (contact && contact.qrcodeUrl) || '',
          contactHint: (contact && contact.hint) || '',
          contactExpiresText:
            contact && contact.expiresAt ? d10(contact.expiresAt) : '',
          opsPlaced,
          joinAvailable,
          joinUrl: (join && join.joinUrl) || '',
          joinHint: (join && join.hint) || '',
        })
      } catch (err) {
        if (isAuthGateError(err)) return // 未同意协议：已跳登录页，不再打扰
        this.setData({
          loadError: err.message,
          retrying: false,
        })
        toast(err.message)
      }
    },
    goHome() {
      Taro.switchTab({
        url: '/pages/index/index',
      })
    },
    goGroup() {
      Taro.switchTab({
        url: '/pages/group/index',
      })
    },
    goCourses() {
      Taro.navigateTo({
        url: '/pages/courses/index',
      })
    },
    handleJoinComplete(event) {
      wecomJoin.complete(event)
    },
    previewContactQR() {
      qrcode.preview(this.data.contactQr)
    },
  })
)
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const {
      loadError,
      retrying,
      loaded,
      phase,
      title,
      hint,
      steps,
      trackText,
      statusText,
      refreshing,
      opsPlaced,
      cohortName,
      groupName,
      periodText,
      joinAvailable,
      joinUrl,
      joinHint,
      advisor,
      contactAvailable,
      contactQr,
      contactExpiresText,
      contactHint,
      instructor,
      joinedAtText,
      info,
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
          <Text className="hd-title">我的培训</Text>
          <View>
            <Text className="hd-sub">报名进度与班级信息</Text>
          </View>
        </View>
        {/*  骨架而不是「加载中…」：与社群页/任务页同一套等待反馈  */}
        {!loaded ? (
          <View className="card">
            <View className="skeleton skeleton-line skeleton-line--title"></View>
            <View className="skeleton skeleton-line skeleton-line--body"></View>
            <View className="skeleton skeleton-block mt-30"></View>
          </View>
        ) : phase === 'none' ? (
          <View className="card empty-card">
            <Text className="t-title">{title}</Text>
            <View className="mt-14">
              <Text className="t-muted">{hint}</Text>
            </View>
            <Button className="btn btn--gradient mt-40" onClick={this.goHome}>
              去看培训套餐
            </Button>
          </View>
        ) : (
          <Block>
            <View className="card steps-card">
              <View className="steps">
                {steps?.map((item, index) => {
                  return (
                    <View key={item.label} className="step">
                      {index > 0 && (
                        <View
                          className={
                            'step-link ' + (item.linked ? 'step-link--on' : '')
                          }
                        ></View>
                      )}
                      <View className={'step-dot step-dot--' + item.state}>
                        <Text className="step-idx">
                          {item.state === 'done' ? '✓' : index + 1}
                        </Text>
                      </View>
                      <Text className={'step-label step-label--' + item.state}>
                        {item.label}
                      </Text>
                    </View>
                  )
                })}
              </View>
              <View className="steps-hint">
                <Text className="t-sec">{hint}</Text>
              </View>
            </View>
            {/*  ② 等待分班  */}
            {phase === 'waiting_assign' ? (
              <View className="card-glow">
                <View className="f card-head">
                  <View className="li-icon li-icon--warn head-icon">
                    <UiIcon name="clock" size={30} color="warn"></UiIcon>
                  </View>
                  <View className="f-1">
                    <Text className="t-strong">{title}</Text>
                    <View className="mt-6">
                      <Text className="t-muted">{trackText}</Text>
                    </View>
                  </View>
                  <Text className="tag tag--amber">{statusText}</Text>
                </View>
                <View className="mt-22">
                  <Text className="t-sec">
                    分班完成后，这里会显示你的班级顾问与班级群入口。
                  </Text>
                </View>
                <Button
                  className="btn btn--ghost mt-30"
                  loading={refreshing}
                  onClick={this.refreshStatus}
                >
                  刷新状态
                </Button>
              </View>
            ) : phase === 'add_advisor' ? (
              <Block>
                {opsPlaced ? (
                  <View className="card-glow">
                    <View className="f card-head">
                      <View className="li-icon head-icon">
                        <UiIcon name="users" size={30} color="accent"></UiIcon>
                      </View>
                      <View className="f-1">
                        <Text className="t-strong">{title}</Text>
                        <View className="mt-6">
                          <Text className="t-muted">{cohortName}</Text>
                        </View>
                      </View>
                      <Text className="tag">已分班</Text>
                    </View>
                    <View className="row-line">
                      <View className="f-between kv">
                        <Text className="t-muted">班级群</Text>
                        <Text className="t-body fw-500">{groupName}</Text>
                      </View>
                      <View className="f-between kv">
                        <Text className="t-muted">开课时间</Text>
                        <Text className="t-body fw-500">{periodText}</Text>
                      </View>
                    </View>
                    {/*  scene=1 官方插件入口已下发：本页直接入群。  */}
                    {joinAvailable ? (
                      <Block>
                        <View className="mt-22">
                          <Text className="t-sec">
                            点击下方「加入群聊」，按微信提示进入班级群，无需等待客服邀请。
                          </Text>
                        </View>
                        <View className="join-panel">
                          <JoinGroupCell
                            url={joinUrl}
                            contactText="加入班级群"
                            contactTextBlod={true}
                            paddingStyle={0}
                            onCompletemessage={this.handleJoinComplete}
                          ></JoinGroupCell>
                          <Text className="join-panel-tip">
                            由企业微信官方提供入群服务
                          </Text>
                        </View>
                        <Button
                          className="btn btn--ghost mt-30"
                          loading={refreshing}
                          onClick={this.refreshStatus}
                        >
                          我已进群，刷新状态
                        </Button>
                        <Button
                          className="btn btn--ghost mt-14"
                          onClick={this.goGroup}
                        >
                          去我的社群
                        </Button>
                      </Block>
                    ) : (
                      <Block>
                        {joinHint && (
                          <View className="notice">
                            <Text className="t-sec">{joinHint}</Text>
                          </View>
                        )}
                        <Button
                          className="btn btn--primary mt-30"
                          onClick={this.goGroup}
                        >
                          去我的社群
                        </Button>
                        <Button
                          className="btn btn--ghost mt-14"
                          loading={refreshing}
                          onClick={this.refreshStatus}
                        >
                          刷新状态
                        </Button>
                      </Block>
                    )}
                    {/*  官方入口未下发：如实用接口文案（不摆假入口），入群进度与客服在「我的社群」。
                           接口没给文案就不摆空盒子——顶部 hint 已经说清这一态在等什么  */}
                  </View>
                ) : (
                  <View className="card-glow">
                    <View className="f card-head">
                      <View className="avatar avatar--sm">{advisor.char}</View>
                      <View className="f-1">
                        <Text className="t-strong">{advisor.name}</Text>
                        {/*  服务区域/部门后端有才显示；企业认证信息后端未提供，故不展示  */}
                        {advisor.metaText && (
                          <View className="mt-6">
                            <Text className="t-muted">{advisor.metaText}</Text>
                          </View>
                        )}
                      </View>
                      <Text className="tag">班级顾问</Text>
                    </View>
                    <View className="row-line">
                      <View className="f-between kv">
                        <Text className="t-muted">班级</Text>
                        <Text className="t-body fw-500">{cohortName}</Text>
                      </View>
                      <View className="f-between kv">
                        <Text className="t-muted">开课时间</Text>
                        <Text className="t-body fw-500">{periodText}</Text>
                      </View>
                    </View>
                    {/*  顾问活码：本人专属、一次性，摊开展示（白底保证识别率）  */}
                    {contactAvailable ? (
                      <Block>
                        <View className="qr-panel">
                          <Image
                            src={contactQr}
                            className="qr-lg"
                            mode="aspectFit"
                            onClick={this.previewContactQR}
                          ></Image>
                          <View className="qr-preview-tip">
                            点击二维码放大，再长按识别添加顾问
                          </View>
                          <Text className="qr-tip">
                            点开二维码 · 再长按识别
                          </Text>
                          {contactExpiresText && (
                            <Text className="t-muted">
                              {'二维码有效期至 ' + contactExpiresText}
                            </Text>
                          )}
                        </View>
                        <View className="mt-22">
                          <Text className="t-muted">
                            添加后，班级顾问会把你拉进班级群，并发送开课信息与课表。
                          </Text>
                        </View>
                      </Block>
                    ) : (
                      <View className="notice">
                        <Text className="t-sec">{contactHint}</Text>
                      </View>
                    )}
                    {/*  已过期/已回收：如实说明并给出补救路径（用接口 hint，不摆失效的假二维码）  */}
                    <Button
                      className="btn btn--ghost mt-30"
                      loading={refreshing}
                      onClick={this.refreshStatus}
                    >
                      我已添加，刷新状态
                    </Button>
                  </View>
                )}
                {/*  推荐人轨：本人专属一次性活码  */}
              </Block>
            ) : phase === 'join_group' ? (
              <Block>
                <View className="card-glow">
                  <View className="f card-head">
                    <View className="li-icon head-icon">
                      <UiIcon name="users" size={30} color="accent"></UiIcon>
                    </View>
                    <View className="f-1">
                      <Text className="t-strong">{groupName}</Text>
                      <View className="mt-6">
                        <Text className="t-muted">{cohortName}</Text>
                      </View>
                    </View>
                    <Text className="tag">待入群</Text>
                  </View>
                  {/*  scene=1 官方插件入口；不再展示无法长按识别的 scene=2 活码图片。  */}
                  <View className="mt-22">
                    <Text className="t-sec">
                      班级顾问已发送邀请，也可以点击下方「加入群聊」进入班级群。
                    </Text>
                  </View>
                  {joinAvailable ? (
                    <View className="join-panel">
                      <JoinGroupCell
                        url={joinUrl}
                        contactText="加入班级群"
                        contactTextBlod={true}
                        paddingStyle={0}
                        onCompletemessage={this.handleJoinComplete}
                      ></JoinGroupCell>
                      <Text className="join-panel-tip">
                        由企业微信官方提供入群服务
                      </Text>
                    </View>
                  ) : (
                    <View className="notice">
                      <Text className="t-sec">{joinHint}</Text>
                    </View>
                  )}
                  <Button
                    className="btn btn--ghost mt-30"
                    loading={refreshing}
                    onClick={this.refreshStatus}
                  >
                    我已进群，刷新状态
                  </Button>
                </View>
                {/*  顾问小卡（同页保留，进群遇到问题找同一个人）  */}
                {advisor && (
                  <View className="card f card-head">
                    <View className="avatar avatar--sm">{advisor.char}</View>
                    <View className="f-1">
                      <Text className="t-strong">{advisor.name}</Text>
                      <View className="mt-6">
                        <Text className="t-muted">
                          {advisor.metaText ? advisor.metaText : '班级顾问'}
                        </Text>
                      </View>
                    </View>
                    <UiIcon name="headphones" size={32} color="ok"></UiIcon>
                  </View>
                )}
              </Block>
            ) : (
              phase === 'in_cohort' && (
                <Block>
                  <View className="card-glow">
                    <View className="f card-head">
                      <View className="li-icon li-icon--ok head-icon">
                        <UiIcon
                          name="check-circle"
                          size={30}
                          color="ok"
                        ></UiIcon>
                      </View>
                      <View className="f-1">
                        <Text className="t-strong">{cohortName}</Text>
                        {/*  副标题不复述状态（标题右侧已有「在训」标签），只给同页最有用的下一步信息  */}
                        <View className="mt-6">
                          <Text className="t-muted">
                            开课信息以班级群通知为准
                          </Text>
                        </View>
                      </View>
                      <Text className="tag tag--green">在训</Text>
                    </View>
                    <View className="row-line">
                      <View className="f-between kv">
                        <Text className="t-muted">讲师</Text>
                        <Text className="t-body fw-500">{instructor}</Text>
                      </View>
                      <View className="f-between kv">
                        <Text className="t-muted">开课周期</Text>
                        <Text className="t-body fw-500">{periodText}</Text>
                      </View>
                      <View className="f-between kv">
                        <Text className="t-muted">班级群</Text>
                        <Text className="t-body fw-500">{groupName}</Text>
                      </View>
                      {joinedAtText && (
                        <View className="f-between kv">
                          <Text className="t-muted">入群时间</Text>
                          <Text className="t-body fw-500">{joinedAtText}</Text>
                        </View>
                      )}
                    </View>
                    <View className="mt-22">
                      <Text className="t-sec">{joinHint}</Text>
                    </View>
                    {joinAvailable && (
                      <View className="join-panel mt-30">
                        <JoinGroupCell
                          url={joinUrl}
                          contactText="重新打开群聊入口"
                          contactTextBlod={true}
                          paddingStyle={0}
                          onCompletemessage={this.handleJoinComplete}
                        ></JoinGroupCell>
                      </View>
                    )}
                  </View>
                  {/*  课程入口（课表与回放在既有课程页）  */}
                  <View className="card f card-head" onClick={this.goCourses}>
                    <View className="li-icon li-icon--warn head-icon">
                      <UiIcon name="tv" size={30} color="warn"></UiIcon>
                    </View>
                    <View className="f-1">
                      <Text className="t-strong">课程与直播</Text>
                      <View className="mt-6">
                        <Text className="t-muted">课表 · 回放</Text>
                      </View>
                    </View>
                    <UiIcon name="chevron-right" size={30} color="t3"></UiIcon>
                  </View>
                </Block>
              )
            )}
            {/*  ③ 添加班级顾问  */}
            {/*  ④ 加入班级群  */}
            {/*  ⑤ 我的班级（在训）  */}
            {/*  报名信息（全部真实字段，缺失显示 —）  */}
            <View className="section-head">
              <Text className="section-title">报名信息</Text>
            </View>
            <View className="card card--list">
              {info?.map((item, index) => {
                return (
                  <View key={item.k} className="row">
                    <Text className="info-k">{item.k}</Text>
                    <Text className="t-body fw-500">{item.v}</Text>
                  </View>
                )
              })}
            </View>
          </Block>
        )}
        {/*  ① 尚无报名：只引导去看套餐，不摆任何班级/顾问占位  */}
      </View>
    )
  }
}
export default _C
