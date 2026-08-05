/**
 * 进入班群（设计稿 20「入群二维码」）。
 *
 * 入群方式由服务端裁定，前端只按 `/mp/my-group` 的结论分支——**四种形态，
 * 任何一种都不让会员无路可走**（口径与 MpService.myGroup / advisorStep 一致）：
 *  ① advisor  —— 顾问优先：必须先加顾问，群入口暂不放行；
 *  ② plugin   —— 企微群官方入群插件，可自助一键进群；
 *  ③ qrcode   —— 群二维码（个微群或兜底活码），长按识别；
 *  ④ waiting  —— 还没到可入群的阶段，如实说明在等什么并给「刷新状态」。
 *
 * 绝不在前端自行判断该给哪种码：能不能进群牵涉付费门控与顾问归因，
 * 只有服务端说了算（护栏 20）。
 */
const api = require("../../api/mp");
const { toast, d10 } = require("../../utils/fmt");
const { navVars } = require("../../utils/layout");
const { isAuthGateError } = require("../../utils/auth");
const qrcode = require("../../utils/qrcode");
const wecomJoin = require("../../utils/wecom-join");
const log = require("../../utils/log");

const GAINS = [
  { icon: "bell", title: "课程通知", desc: "第一时间获取课程与活动" },
  { icon: "chat", title: "社群答疑", desc: "老师在线解答学习难题" },
  { icon: "link", title: "资源链接", desc: "优质资料共享与资源对接" },
];

Page({
  data: {
    navPad: "",
    loading: true,
    err: "",
    retrying: false,
    group: null,
    title: "",
    glyph: "",
    joined: false,
    startText: "",
    stage: "waiting",
    qrUrl: "",
    joinPluginId: "",
    heroTitle: "已为你分配班级",
    heroDesc: "",
    waitTitle: "",
    waitHint: "",
    gains: GAINS,
  },

  onLoad() {
    this.setData(navVars());
  },

  onShow() {
    this.load();
  },

  async load() {
    this.setData({ retrying: true });
    try {
      const group = await api.getMyGroup();
      const a = group && group.assignment;
      const cohort = group && group.cohort;
      const advisor = group && group.advisorStep;
      const state = {
        loading: false,
        err: "",
        retrying: false,
        group,
        title: (cohort && cohort.name) || (a && a.group_name) || "我的社群",
        glyph: cohort && cohort.cohort_code ? String(cohort.cohort_code).slice(-2) : "",
        joined: !!(a && a.status === "已入群"),
        startText: d10(cohort && cohort.start_date),
        qrUrl: group && group.groupQrcodeUrl ? group.groupQrcodeUrl : "",
        joinPluginId: (group && group.joinPluginId) || "",
      };
      if (!a) {
        state.stage = "waiting";
        state.heroTitle = "还没有为你分配班级";
        state.heroDesc = group && group.hint ? group.hint : "运营正在为你匹配合适的社群";
        state.waitTitle = "等待分配班级";
        state.waitHint = state.heroDesc;
      } else if (a.status === "已入群") {
        state.stage = state.qrUrl ? "qrcode" : "waiting";
        state.heroTitle = "你已在班群中";
        state.heroDesc = "群消息在微信里查看；二维码可分享给同班同学";
        state.waitTitle = "你已在班群中";
        state.waitHint = "直接在微信里打开群聊即可；如需二维码可联系服务老师获取。";
      } else if (advisor && advisor.required) {
        state.stage = "advisor";
        state.heroTitle = "先加顾问，再进群";
        state.heroDesc = advisor.hint || "添加服务顾问后即可获得入群入口";
      } else if (group && group.selfJoin) {
        state.stage = "plugin";
        state.heroTitle = "可以进群了";
        state.heroDesc = "点击「加入群聊」，按微信提示进入为你安排的社群";
      } else if (state.qrUrl) {
        state.stage = "qrcode";
        state.heroTitle = "扫码进入班级群";
        state.heroDesc = "长按识别二维码，和同频主理人一起成长";
      } else {
        state.stage = "waiting";
        state.heroTitle = "席位已锁定";
        state.heroDesc = group && group.joinHint
          ? group.joinHint
          : "运营正在安排入群，稍后会有专属客服联系你";
        state.waitTitle = "当前状态：" + a.status;
        state.waitHint = state.heroDesc;
      }
      this.setData(state);
    } catch (e) {
      if (isAuthGateError(e)) return;
      log.error("group-qr load", e.message);
      this.setData({ loading: false, retrying: false, err: e.message });
    }
  },

  /**
   * 官方入群组件的回执。
   * **绝不在客户端把状态改成「已入群」**：置「已入群」只有 webhook 事件与人工确认
   * 两条合法路径（护栏 16），客户端回执只用来解释失败原因。
   */
  handleJoinComplete(e) {
    const code = wecomJoin.complete(e);
    if (!code) {
      // 成功也不宣布「已入群」：真正入群以企微回调为准，这里只让用户去微信确认
      toast("已发起入群，请在微信中确认");
      setTimeout(() => this.load(), 1500);
    }
  },

  previewQr() {
    qrcode.preview(this.data.qrUrl);
  },

  /**
   * 保存二维码：微信不允许直接保存远端图，必须先下载到本地临时文件。
   * 相册权限被拒时给出「去设置里开启」的具体指引，而不是一句「保存失败」。
   */
  saveQr() {
    const url = this.data.qrUrl;
    if (!url) {
      toast("当前没有可保存的二维码");
      return;
    }
    wx.showLoading({ title: "保存中" });
    wx.downloadFile({
      url,
      success: res => {
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => {
            wx.hideLoading();
            toast("已保存到相册");
          },
          fail: err => {
            wx.hideLoading();
            if (String(err.errMsg || "").indexOf("auth") >= 0) {
              wx.showModal({
                title: "需要相册权限",
                content: "保存图片需要相册写入权限，可在「设置 → 主理人公社」中开启后重试。",
                confirmText: "去设置",
                success: r => {
                  if (r.confirm) wx.openSetting();
                },
              });
              return;
            }
            toast("保存失败，可长按图片手动保存");
          },
        });
      },
      fail: () => {
        wx.hideLoading();
        toast("图片下载失败，可长按图片手动保存");
      },
    });
  },

  go(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    if (/^\/pages\/(index|group|member|notifications|mine)\/index$/.test(url)) wx.switchTab({ url });
    else wx.navigateTo({ url, fail: () => toast("页面暂不可用") });
  },
});
