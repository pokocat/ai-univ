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
const api = require("../../api/mp");
const { toast } = require("../../utils/fmt");
const { navVars } = require("../../utils/layout");
const { isAuthGateError } = require("../../utils/auth");
const log = require("../../utils/log");

const TYPE_ICON = { 增长诊断: "chart", 活跃诊断: "pulse", 转化诊断: "funnel", 服务诊断: "headset" };
const SUBJECTS = ["我的班级", "我的社群", "我的项目"];
const SCALES = ["100 人以内", "100-500 人", "500-2000 人", "2000 人以上"];

Page({
  data: {
    navPad: "",
    err: "",
    retrying: false,
    submitting: false,
    types: [],
    subjects: SUBJECTS,
    subjectIdx: 0,
    scales: SCALES,
    scaleIdx: 0,
    form: { city: "", communityFocus: "", coreProblem: "", expectGoal: "" },
  },

  onLoad() {
    // 一次填单一个幂等键：重复点提交只受理一次
    this.idemKey = api.idemKey("mpdiag");
    this.setData(navVars());
    this.load();
  },

  async load() {
    this.setData({ retrying: true });
    try {
      const [options, me] = await Promise.all([
        api.getDiagnosisOptions(),
        api.getMe().catch(() => null),
      ]);
      this.setData({
        err: "",
        retrying: false,
        types: ((options && options.types) || []).map(t => ({
          label: t.label,
          icon: TYPE_ICON[t.label] || "target",
          on: false,
        })),
        // 城市默认填档案里的，省一次输入；用户可改
        form: Object.assign({}, this.data.form, { city: (me && me.city) || "" }),
      });
    } catch (e) {
      if (isAuthGateError(e)) return;
      log.error("diagnosis options", e.message);
      this.setData({ retrying: false, err: e.message });
    }
  },

  onInput(e) {
    const k = e.currentTarget.dataset.k;
    this.setData({ ["form." + k]: e.detail.value });
  },

  pickSubject(e) {
    this.setData({ subjectIdx: Number(e.detail.value) });
  },

  pickScale(e) {
    this.setData({ scaleIdx: Number(e.detail.value) });
  },

  toggleType(e) {
    const label = e.currentTarget.dataset.label;
    this.setData({
      types: this.data.types.map(t => (t.label === label ? Object.assign({}, t, { on: !t.on }) : t)),
    });
  },

  async submit() {
    if (this.data.submitting) return;
    const picked = this.data.types.filter(t => t.on).map(t => t.label);
    if (!picked.length) {
      toast("请至少选择一个诊断类型");
      return;
    }
    const f = this.data.form;
    if (!f.coreProblem.trim()) {
      toast("请填写当前面临的核心问题");
      return;
    }
    if (!f.expectGoal.trim()) {
      toast("请填写希望达成的目标");
      return;
    }
    this.setData({ submitting: true });
    try {
      const booking = await api.createDiagnosisBooking({
        types: picked,
        subject: this.data.subjects[this.data.subjectIdx],
        city: f.city.trim(),
        communityFocus: f.communityFocus.trim(),
        memberScale: this.data.scales[this.data.scaleIdx],
        coreProblem: f.coreProblem.trim(),
        expectGoal: f.expectGoal.trim(),
      }, this.idemKey);
      wx.redirectTo({ url: "/pages/booking-result/index?bookingNo=" + booking.booking_no });
    } catch (e) {
      this.setData({ submitting: false });
      // 配额用完 / 已有在途都是可预期结果，如实转述服务端的话
      toast(e.message);
    }
  },

  go(e) {
    const url = e.currentTarget.dataset.url;
    if (url) wx.navigateTo({ url, fail: () => toast("页面暂不可用") });
  },
});
