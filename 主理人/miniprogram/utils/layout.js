/**
 * 自定义导航栏的布局尺寸。
 *
 * app.json 用了 `navigationStyle: "custom"`（设计稿每屏都自绘品牌头 + 右上胶囊，
 * native 导航栏在场会重一层），代价是**顶部安全区要自己让**：
 * 不让的表现是品牌头压在状态栏文字下面，刘海机尤其明显。
 *
 * 胶囊按钮仍由微信原生渲染在右上角，所以自绘头部右侧必须留出胶囊宽度，
 * 否则页面自己的操作按钮会被胶囊盖住（点不到、也看不出为什么）。
 *
 * 单位一律 rpx：`wx.getWindowInfo()` 给的是 px，按 750/屏宽 换算。
 * 值缓存一次——状态栏高度在小程序生命周期内不变，每页各调一次接口纯浪费。
 */
let cache = null;

function measure() {
  if (cache) return cache;
  let statusBar = 20;
  let screenWidth = 375;
  let capsule = null;
  try {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    statusBar = info.statusBarHeight || statusBar;
    screenWidth = info.screenWidth || info.windowWidth || screenWidth;
  } catch (e) {
    /* 取不到就用兜底值：宁可多让 20px 也不要压在状态栏上 */
  }
  try {
    capsule = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
  } catch (e) {
    capsule = null;
  }
  const k = 750 / screenWidth;
  // 胶囊右侧到屏幕右边的距离通常 ~7px；拿不到胶囊信息时按 (87 + 7) px 兜底
  const capsuleW = capsule && capsule.width ? capsule.width + (screenWidth - capsule.right) : 94;
  cache = {
    /** 状态栏高度（rpx） */
    statusBar: Math.round(statusBar * k),
    /** 胶囊按钮高度（rpx），自绘头部的最小行高 */
    capsuleH: Math.round((capsule && capsule.height ? capsule.height : 32) * k),
    /** 右侧需要为胶囊留出的宽度（rpx） */
    capsuleW: Math.round(capsuleW * k),
    /** 直接可用的 padding-top 样式串 */
    padTop: `padding-top:${Math.round(statusBar * k)}rpx;`,
  };
  return cache;
}

/** 供页面 setData：{ navPad, capsuleW } */
function navVars() {
  const m = measure();
  return { navPad: m.padTop, navCapsuleW: m.capsuleW, navStatusBar: m.statusBar };
}

module.exports = { measure, navVars };
