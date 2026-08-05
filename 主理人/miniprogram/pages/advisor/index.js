/**
 * 服务顾问（设计稿 19「添加服务微信」）。
 *
 * 三条真实通道，服务端给结论，前端只呈现（口径同 MpService.advisorStep）：
 *  ① 顾问「联系我」活码（企微，带归因 state）——最优，加上之后入群会自动归因；
 *  ② 顾问个人企微二维码（employee.wecom_qrcode_url）——没有活码时的替代；
 *  ③ 都没有 → 微信客服 / 服务工单兜底。
 *
 * **不显示编的服务数据**：设计稿的「服务学员 328+ ｜ 好评率 98%」库里没有来源。
 * 真实可给的是顾问姓名、角色、服务区域，以及「码有没有就绪」。
 */
const api = require("../../api/mp");
const { toast } = require("../../utils/fmt");
const { navVars } = require("../../utils/layout");
const { isAuthGateError } = require("../../utils/auth");
const qrcode = require("../../utils/qrcode");
const customerService = require("../../utils/customer-service");
const log = require("../../utils/log");

const STEPS = [
  { icon: "user", title: "添加顾问微信", desc: "长按识别上方二维码" },
  { icon: "chat", title: "发送会员姓名", desc: "把会员名与手机号发给顾问" },
  { icon: "members", title: "邀请进入班群", desc: "顾问会邀请你加入班级群" },
];

Page({
  data: {
    navPad: "",
    loading: true,
    err: "",
    retrying: false,
    heroTitle: "专属服务已为你就位",
    heroDesc: "添加服务顾问微信，开启入群、课程、诊断与日常陪跑",
    advisorName: "",
    advisorRole: "专属服务",
    advisorRegion: "",
    advisorAvatar: "",
    advisorQr: "",
    advisorHint: "",
    qrPendingTitle: "",
    qrPendingHint: "",
    teacher: null,
    fallbackHint: "",
    steps: STEPS,
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
      const [group, training] = await Promise.all([
        api.getMyGroup(),
        // 培训链路有自己的顾问码（enrollment 维度）；两条链路都可能是当前有效的那一条
        api.getTrainingContactEntry().catch(() => null),
      ]);
      const advisor = group && group.advisorStep;
      const teacher = group && group.serviceTeacher;
      const state = {
        loading: false,
        err: "",
        retrying: false,
        teacher,
      };

      // 优先培训场景的顾问码（学员在训期间以它为准），其次会员场景的 advisorStep
      const trainingQr = training && training.available ? training.qrcodeUrl : "";
      const memberQr = advisor && advisor.qrcodeUrl ? advisor.qrcodeUrl : "";
      state.advisorQr = trainingQr || memberQr || (teacher && teacher.wecom_qrcode_url) || "";
      state.advisorName = (training && training.advisorName)
        || (advisor && advisor.advisorName)
        || (teacher && teacher.name)
        || "服务顾问";
      state.advisorRole = (teacher && teacher.role) || "专属服务";
      state.advisorRegion = (teacher && teacher.service_region) || "";
      state.advisorAvatar = "";

      if (state.advisorQr) {
        state.advisorHint = trainingQr || memberQr
          ? "加上顾问后，入群与后续服务都由他跟进"
          : "这是顾问的企业微信个人码，加上后可直接联系他";
        state.heroTitle = "加顾问，开启专属服务";
      } else {
        // 码没就绪：把服务端的原话转述出来，不自己编一个「生成中」
        state.qrPendingTitle = advisor && advisor.status === "创建中"
          ? "顾问二维码生成中"
          : "顾问二维码暂不可用";
        state.qrPendingHint = (advisor && advisor.hint)
          || (training && training.hint)
          || "稍后下拉刷新；如仍未出现可提交服务工单，我们会人工跟进。";
        state.heroTitle = teacher ? "你的服务老师" : "服务顾问匹配中";
        state.heroDesc = teacher
          ? "顾问二维码还没就绪，可先通过班群或工单联系他"
          : "运营正在为你匹配专属顾问";
      }
      // 客服是否真的接通了由 utils/customer-service 在点击时判定并给兜底，
      // 这里不预判——预判错了会摆一个点了没反应的按钮
      state.fallbackHint = "可以先联系客服，或提交一张服务工单，我们会在承诺时限内联系你。";
      this.setData(state);
    } catch (e) {
      if (isAuthGateError(e)) return;
      log.error("advisor load", e.message);
      this.setData({ loading: false, retrying: false, err: e.message });
    }
  },

  /** 联系客服：通道是否可用由 utils/customer-service 判定并自带兜底 */
  contactService() {
    customerService.open();
  },

  previewQr() {
    qrcode.preview(this.data.advisorQr);
  },

  saveQr() {
    const url = this.data.advisorQr;
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
