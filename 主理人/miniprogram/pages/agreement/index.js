/**
 * 协议页：一个页面按 ?type=user|privacy|membership 渲染三份协议。
 * 正文常量在 content.js，本页只负责取文与设置标题。
 */
const { DOCS, OPERATOR, UPDATED_AT } = require("./content");

const VALID_TYPES = ["user", "privacy", "membership"];

Page({
  data: {
    title: "",
    intro: "",
    sections: [],
    operator: OPERATOR,
    updatedAt: UPDATED_AT,
    others: [], // 底部互跳入口（另外两份协议）
  },

  onLoad(options) {
    const type = VALID_TYPES.indexOf((options && options.type) || "") >= 0 ? options.type : "user";
    const doc = DOCS[type];
    this.setData({
      title: doc.title,
      intro: doc.intro,
      sections: doc.sections,
      others: VALID_TYPES.filter(t => t !== type).map(t => ({ type: t, title: DOCS[t].title })),
    });
    wx.setNavigationBarTitle({ title: doc.title });
  },

  /** 底部互跳：用 redirectTo 避免协议之间反复 navigateTo 把页面栈堆满（上限 10 层） */
  goOther(e) {
    wx.redirectTo({ url: `/pages/agreement/index?type=${e.currentTarget.dataset.type}` });
  },
});
