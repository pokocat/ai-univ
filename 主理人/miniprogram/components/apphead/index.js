/**
 * 页面品牌头（设计稿 components.jsx 的 AppHeader）。
 *
 * 37 个页面都要这一行，抄 37 遍必然漂移——上一版就是每页各写一遍页头，
 * 换一次品牌标记只换掉一半页面。
 *
 * 右侧 padding 按胶囊实测宽度留出：自定义导航下胶囊仍是原生渲染，
 * 不留的话品牌名会被它盖住（见 utils/layout 注释）。
 */
const { navVars } = require("../../utils/layout");

Component({
  options: { addGlobalClass: true },
  properties: {
    title: { type: String, value: "主理人公社" },
    sub: { type: String, value: "" },
    logo: { type: Boolean, value: true },
    pro: { type: Boolean, value: false },
    ai: { type: Boolean, value: false },
    gem: { type: Boolean, value: false },
    big: { type: Boolean, value: false },
    compact: { type: Boolean, value: false },
  },
  data: { navPad: "", capsuleW: 94 },
  lifetimes: {
    attached() {
      const v = navVars();
      this.setData({ navPad: v.navPad, capsuleW: v.navCapsuleW });
    },
  },
});
