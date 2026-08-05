const Taro = require('@tarojs/taro')
/**
 * 分享（转发给好友 + 分享到朋友圈）。
 *
 * 此前只有首页和邀请页写了 onShareAppMessage，其余页面右上角「···」里的转发是灰的，
 * 朋友圈分享（onShareTimeline）则**全站都没有**——这两条都是裂变的正经入口，白白丢掉。
 *
 * 归因：分享路径统一带上本人邀请码，好友点开即完成归因
 * （app.onLaunch/onShow 的 captureInviteCode 负责捕获）。邀请码从 app.globalData 取——
 * 只有首页/邀请页/我的页会拉 /mp/invite，不为一个分享参数在每个页面都多打一次接口。
 * 拿不到邀请码时退回无参路径：分享照常可用，只是这一跳不计归因，
 * 不能因为缺个参数就把分享按钮变哑。
 *
 * 合规（M3 §1.1）：分享文案不出现任何利益承诺（返现/赚钱/收益），也不做「分享后解锁」式强制分享。
 *
 * 用法：`Page(share.withShare({ ... }))`。
 * 用普通对象合并而不是 Behavior：页面级 behaviors 对生命周期函数的合并语义随基础库版本有差异，
 * 而分享回调（onShareAppMessage/onShareTimeline）漏挂是**静默失效**——按钮变灰但不报错，
 * 很难在测试里发现。Object.assign 是确定的 JS 语义，不依赖框架实现。
 */

const TITLE = '我在主理人公社，邀你一起进圈子'
const TIMELINE_TITLE = '主理人公社 · 同频的人，聚在一个圈子里'

/**
 * 两个入口的封面图不能共用一张：
 *   · 转发给好友按 5:4 原样显示；
 *   · 分享到朋友圈按 1:1 **居中裁剪**——5:4 的图左右各被裁掉 120px，
 *     而封面是左对齐排版，第一个字「主」正好被切掉。
 * 所以方图是单独排的版（居中构图），不是把 5:4 缩一缩。
 * 两张都由 `tools/share-card.py` 生成，改设计改那个脚本，别手改图。
 *   （2026-08-03 底图换成位图插画后存 JPEG：同样的 256 色量化要 369KB，会顶穿主包上限。）
 */
const IMAGE = require('../assets/share.jpg')
const TIMELINE_IMAGE = require('../assets/share-timeline.jpg')
const LANDING = '/pages/index/index'

/** 当前可用的邀请码（页面调 setShareCode 写入；未登录/未拉到时为空） */
function currentCode() {
  try {
    return Taro.getApp().globalData.inviteCode || ''
  } catch (e) {
    return '' // getApp() 在极早期可能未就绪，退回无归因分享
  }
}

/** 邀请码 → 落地路径 */
function pathWithCode(code) {
  return code ? `${LANDING}?inviteCode=${encodeURIComponent(code)}` : LANDING
}

/** 分享能力的默认实现（页面可自行覆写同名方法） */
const mixin = {
  /** 页面拿到 /mp/invite 数据后调用，把邀请码接进全站分享链路 */
  setShareCode(code) {
    if (code) Taro.getApp().globalData.inviteCode = code
  },
  onShareAppMessage() {
    return {
      title: TITLE,
      path: pathWithCode(currentCode()),
      imageUrl: IMAGE,
    }
  },
  /**
   * 分享到朋友圈：微信只接受 query 字符串（落地页固定为当前页，不能另指 path），
   * 故这里只给邀请码参数。
   */
  onShareTimeline() {
    const code = currentCode()
    return {
      title: TIMELINE_TITLE,
      query: code ? `inviteCode=${encodeURIComponent(code)}` : '',
      imageUrl: TIMELINE_IMAGE,
    }
  },
}

/** 合并进页面定义；页面自己定义的同名方法优先 */
function withShare(page) {
  return Object.assign({}, mixin, page)
}
module.exports = {
  withShare,
  mixin,
  pathWithCode,
  TITLE,
  TIMELINE_TITLE,
  IMAGE,
  LANDING,
}
