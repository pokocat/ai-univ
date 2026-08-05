/**
 * 自定义 TabBar（设计稿 components.jsx 的 TabBar，member 变体）。
 *
 * 五格：首页 / 社群 / 会员 / 消息 / 我的。中间「会员」是**抬起的宝石圆钮**——
 * 设计稿另有一个 inert 的 ＋ FAB 变体，这里刻意不用：常驻一个点了没反应的按钮
 * 比不摆更糟，它承诺了不存在的能力。抬起的造型保留，落点是真实的会员卡页。
 *
 * 选中态双保险：① 页面 onShow 调 setTab(i)（标准做法）；
 * ② 组件 attached 时按当前路由自推断，避免页面漏调用或时序错位导致高亮丢失。
 *
 * 图标**在 JS 里用共享的 utils/icons 现算 data-URI**，不写进 wxss。
 * 上一版把 10 条 data-URI 手写在 wxss 里当调色板镜像，改一次颜色要同步改两处，
 * 漏改的表现是「同一个 tab 图标是黑的、文字是红的」。现在图标只有一份事实源。
 * 剩下的栏体颜色（底/边/文字）仍不得不写字面值：自定义 tabBar 由框架单独实例化，
 * 不保证挂在 page 元素之下，app.wxss 声明在 `page {}` 上的 CSS 变量未必继承得到，
 * 赌错的代价是整条 tabBar 没背景没文字色，等于首屏就崩。见 index.wxss 顶部注释。
 *
 * 同理**不能在这里引 ui-icon 组件**：自定义 tabBar 在 lazyCodeLoading
 * 按需注入下引用全局组件会渲染成空白栏。
 */
const { TOKENS, svgUri } = require("../utils/icons");

const LIST = [
  { path: "/pages/index/index", text: "首页", icon: "home" },
  { path: "/pages/group/index", text: "社群", icon: "members" },
  { path: "/pages/member/index", text: "会员", icon: "gem", center: true },
  { path: "/pages/notifications/index", text: "消息", icon: "chat" },
  { path: "/pages/mine/index", text: "我的", icon: "user" },
];

/**
 * 图标 background-image 片段。**渲染本身走 utils/icons 的 svgUri**——
 * 这里原来自己拼了一份 svg 模板，默认描边 1.8（页面图标是 1.7），
 * 光学归一也只会加在组件那一份上，结果是同一个图标在 tabBar 里与页面里不一样大/不一样粗。
 */
function iconStyle(name, hex, weight) {
  return `background-image:url("${svgUri(name, { color: hex, stroke: weight || 1.7 })}");`;
}

Component({
  data: { selected: 0, hidden: false, list: [], unread: 0 },

  lifetimes: {
    attached() {
      this.buildIcons();
      this.syncFromRoute();
      this.syncUnread();
    },
  },

  pageLifetimes: {
    show() {
      this.syncUnread();
    },
  },

  methods: {
    /** 一次性把选中/未选中两套图标样式算好；tap 时只切类名，不重算 URI */
    buildIcons() {
      this.setData({
        list: LIST.map(t => ({
          path: t.path,
          text: t.text,
          center: !!t.center,
          off: iconStyle(t.icon, TOKENS["ink-500"]),
          on: iconStyle(t.icon, TOKENS["signal-600"]),
          // 中间钮在紫底上，一律暖白描边，比其余四格粗一档（1.9）撑住紫色圆面
          centerIco: t.center ? iconStyle(t.icon, TOKENS["on-signal"], 1.9) : "",
        })),
      });
    },

    /** 按当前页面路由推断选中项（兜底） */
    syncFromRoute() {
      const pages = getCurrentPages();
      const route = pages.length ? pages[pages.length - 1].route : "";
      const idx = LIST.findIndex(t => t.path === `/${route}`);
      if (idx >= 0 && idx !== this.data.selected) this.setData({ selected: idx });
    },

    /**
     * 消息未读数：读 app.globalData.unread 缓存，**不在 tabBar 里打接口**。
     * tabBar 每次切页都 show 一次，让它自己拉接口等于给 /mp/notifications 加一个
     * 与用户点击频率成正比的放大器；真实数字由首页与消息页拉取后写进 globalData。
     */
    syncUnread() {
      const app = getApp();
      const n = (app && app.globalData && app.globalData.unread) || 0;
      if (n !== this.data.unread) this.setData({ unread: n });
    },

    switchTab(e) {
      const { index, path } = e.currentTarget.dataset;
      if (index === this.data.selected) return;
      this.setData({ selected: index });
      wx.switchTab({
        url: path,
        fail: () => this.syncFromRoute(), // 跳转失败则回滚高亮
      });
    },

    /** 供页面 onShow 显式同步（标准做法） */
    setTab(index) {
      if (index !== this.data.selected) this.setData({ selected: index });
      this.syncUnread();
    },
  },
});
