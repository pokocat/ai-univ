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
const api = require("../../api/mp");
const { toast, d16 } = require("../../utils/fmt");
const { navVars } = require("../../utils/layout");
const { isAuthGateError } = require("../../utils/auth");
const log = require("../../utils/log");

const TAG_ICON = {
  响应及时: "pulse",
  很专业: "gem",
  资源有帮助: "folder",
  诊断清晰: "sparkle",
  还想继续沟通: "chat",
};
const RATING_LABEL = { 1: "很不满意", 2: "不太满意", 3: "一般", 4: "满意", 5: "非常满意" };

Page({
  data: {
    navPad: "",
    loading: true,
    err: "",
    retrying: false,
    targetType: "",
    targetRef: "",
    subject: null,
    existing: null,
    serviceAtText: "",
    rating: 5,
    ratingLabel: RATING_LABEL[5],
    content: "",
    tags: [],
    revisit: true,
    submitting: false,
  },

  onLoad(options) {
    this.setData(Object.assign({
      targetType: decodeURIComponent((options && options.targetType) || ""),
      targetRef: (options && options.targetRef) || "",
    }, navVars()));
    this.load();
  },

  async load() {
    if (!this.data.targetType || !this.data.targetRef) {
      this.setData({ loading: false, subject: null });
      return;
    }
    this.setData({ retrying: true });
    try {
      const s = await api.getReviewSubject(this.data.targetType, this.data.targetRef);
      const existing = s.existing;
      const pickedTags = (existing && existing.tags) || [];
      this.setData({
        loading: false,
        err: "",
        retrying: false,
        subject: s,
        existing,
        serviceAtText: d16(s.service_at),
        rating: existing ? existing.rating : 5,
        ratingLabel: RATING_LABEL[existing ? existing.rating : 5] || "",
        content: (existing && existing.content) || "",
        revisit: existing ? existing.revisit_willing !== false : true,
        tags: (s.tags || []).map(t => ({
          label: t.label,
          icon: TAG_ICON[t.label] || "ribbon",
          on: pickedTags.indexOf(t.label) >= 0,
        })),
      });
    } catch (e) {
      if (isAuthGateError(e)) return;
      log.warn("review subject", e.message);
      this.setData({ loading: false, retrying: false, subject: null });
    }
  },

  setRating(e) {
    const n = Number(e.currentTarget.dataset.n);
    this.setData({ rating: n, ratingLabel: RATING_LABEL[n] || "" });
  },

  onInput(e) {
    this.setData({ content: e.detail.value });
  },

  toggleTag(e) {
    const label = e.currentTarget.dataset.label;
    this.setData({
      tags: this.data.tags.map(t => (t.label === label ? Object.assign({}, t, { on: !t.on }) : t)),
    });
  },

  setRevisit(e) {
    this.setData({ revisit: e.currentTarget.dataset.v === "1" });
  },

  async submit() {
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    try {
      await api.submitReview({
        targetType: this.data.targetType,
        targetRef: this.data.targetRef,
        rating: this.data.rating,
        tags: this.data.tags.filter(t => t.on).map(t => t.label),
        content: this.data.content.trim(),
        revisitWilling: this.data.revisit,
      });
      toast("感谢你的反馈");
      setTimeout(() => this.back(), 900);
    } catch (e) {
      this.setData({ submitting: false });
      toast(e.message);
    }
  },

  back() {
    if (getCurrentPages().length > 1) wx.navigateBack();
    else wx.switchTab({ url: "/pages/mine/index" });
  },

  go(e) {
    const url = e.currentTarget.dataset.url;
    if (url) wx.navigateTo({ url, fail: () => toast("页面暂不可用") });
  },
});
