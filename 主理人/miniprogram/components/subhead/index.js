/**
 * 子页头（返回 · 标题 · 右侧插槽），设计稿 .subbar。
 *
 * 自定义导航下**必须自己提供返回**：没有 native 导航栏，只剩系统手势/物理键，
 * iOS 上从内页返回全靠左划，一部分用户根本不会用。
 *
 * 返回策略：有页面栈就 navigateBack，栈空（分享/小程序码直达内页）则回首页 tab——
 * 直接 navigateBack 失败会静默什么都不发生，用户以为按钮坏了。
 */
const { navVars } = require("../../utils/layout");

Component({
  options: { addGlobalClass: true },
  properties: {
    title: { type: String, value: "" },
    /** 栈空时的兜底落点，默认首页 */
    home: { type: String, value: "/pages/index/index" },
  },
  data: { navPad: "", capsuleW: 94 },
  lifetimes: {
    attached() {
      const v = navVars();
      this.setData({ navPad: v.navPad, capsuleW: v.navCapsuleW });
    },
  },
  methods: {
    onBack() {
      if (getCurrentPages().length > 1) {
        wx.navigateBack();
        return;
      }
      const url = this.data.home;
      // tab 页只能 switchTab，普通页只能 redirectTo，猜错会静默失败
      const isTab = /^\/pages\/(index|group|member|notifications|mine)\/index$/.test(url);
      if (isTab) wx.switchTab({ url });
      else wx.redirectTo({ url });
    },
  },
});
