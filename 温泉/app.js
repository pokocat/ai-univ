App({
  globalData: {
    statusBarHeight: 20,
    tabBarHeight: 70,
    safeBottom: 0,
  },

  onLaunch() {
    // 自绘导航栏 + 自绘 tabBar，需要自己拿状态栏和底部安全区高度
    let info = {};
    try {
      info = (wx.getWindowInfo && wx.getWindowInfo()) || wx.getSystemInfoSync();
    } catch (e) {
      info = {};
    }
    this.globalData.statusBarHeight = info.statusBarHeight || 20;
    const safeArea = info.safeArea;
    const screenH = info.screenHeight || info.windowHeight || 0;
    this.globalData.safeBottom =
      safeArea && screenH ? Math.max(0, screenH - safeArea.bottom) : 0;
  },
});
