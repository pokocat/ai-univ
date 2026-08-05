import withWeapp, { cacheOptions } from "@tarojs/with-weapp";
import { Block } from "@tarojs/components";
import React from "react";
import Taro from "@tarojs/taro";
import "./app.scss";
cacheOptions.setOptionsToCache({
  globalData: {
    statusBarHeight: 20,
    tabBarHeight: 70,
    safeBottom: 0
  },
  onLaunch() {
    // 自绘导航栏 + 自绘 tabBar，需要自己拿状态栏和底部安全区高度
    let info = {};
    try {
      info = Taro.getWindowInfo && Taro.getWindowInfo() || Taro.getSystemInfoSync();
    } catch (e) {
      info = {};
    }
    this.globalData.statusBarHeight = info.statusBarHeight || 20;
    const safeArea = info.safeArea;
    const screenH = info.screenHeight || info.windowHeight || 0;
    this.globalData.safeBottom = process.env.TARO_ENV === 'h5'
      ? 0
      : (safeArea && screenH ? Math.max(0, screenH - safeArea.bottom) : 0);
  }
});
@withWeapp(cacheOptions.getOptionsFromCache(), true)
class App extends React.Component {
  render() {
    return this.props.children;
  }
}
export default App;
