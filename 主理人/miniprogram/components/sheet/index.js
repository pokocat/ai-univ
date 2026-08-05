/** 底部弹层（对齐设计稿 MobileSheet）：遮罩点击关闭，内容区阻断冒泡与滚动穿透。 */
Component({
  options: { multipleSlots: false },
  properties: {
    title: { type: String, value: "" },
    /** compact：用于字段较少的轻表单，减少无意义的上下留白。 */
    variant: { type: String, value: "default" },
    /** 注册门禁完成前可隐藏关闭入口，避免给出无法执行的跳过暗示。 */
    closable: { type: Boolean, value: true },
  },
  lifetimes: {
    attached() {
      // 自定义 TabBar 由微信单独渲染，层级不受页面 z-index 控制。
      // 弹层出现时主动隐藏，避免底部按钮被 TabBar 压住；组件销毁后恢复。
      this.setTabBarHidden(true);
    },
    detached() {
      this.setTabBarHidden(false);
    },
  },
  pageLifetimes: {
    show() {
      this.setTabBarHidden(true);
    },
    hide() {
      this.setTabBarHidden(false);
    },
  },
  methods: {
    setTabBarHidden(hidden) {
      const pages = getCurrentPages();
      const page = pages.length ? pages[pages.length - 1] : null;
      if (!page || typeof page.getTabBar !== "function") return;
      const tabBar = page.getTabBar();
      if (tabBar && tabBar.data.hidden !== hidden) {
        tabBar.setData({ hidden });
      }
    },
    close() {
      this.triggerEvent("close");
    },
    noop() {},
  },
});
