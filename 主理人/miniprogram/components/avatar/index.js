/**
 * 会员头像：有真实头像显示图片，没有则回落到暖紫渐变盘 + 文字首字。
 *
 * 后端刻意只下发**相对路径**（/mp/avatar/xxx，见 MpService.avatarPath 注释）——
 * 小程序与管理台的 API 基址不同（线上小程序走 nginx 的 /wxapi/ 前缀反代），
 * 服务端拼不出对小程序有效的绝对地址，故由本组件拼当前环境的 API 基址。
 *
 * 基址现取（base() 而非常量）：切换环境后已渲染的页面重新 setData 即刷新，
 * 不需要杀掉小程序重进。
 *
 * 加载失败（图被删/网络异常）自动回落文字块，不留破图占位。
 *
 * 尺寸：`size` 直接传 rpx 数值（设计稿 px × 1.744）。也接受旧的
 * sm/md/lg/card 修饰名，映射到等价数值——改名一次性铺开风险太大。
 */
const { base } = require("../../utils/auth");

const LEGACY_SIZE = { sm: 84, md: 92, lg: 152, card: 92 };

Component({
  properties: {
    /** 后端下发的相对路径；空则直接走渐变盘 */
    path: { type: String, value: "" },
    /** 文字回落用的显示名（取首字） */
    name: { type: String, value: "" },
    /** rpx 数值，或旧修饰名 sm/md/lg/card */
    size: { type: null, value: 80 },
    /** 外发光描边（「这是我」/重点人物） */
    ring: { type: Boolean, value: false },
    extClass: { type: String, value: "" },
  },
  data: {
    src: "",
    char: "主",
    boxStyle: "",
    iniStyle: "",
  },
  observers: {
    "path, name, size"() {
      this.render();
    },
  },
  lifetimes: {
    attached() {
      this.render();
    },
  },
  methods: {
    render() {
      const { path, name, size } = this.data;
      const px = typeof size === "number" ? size : LEGACY_SIZE[size] || Number(size) || 80;
      this.setData({
        src: path ? `${base()}${path}` : "",
        char: (name || "主").trim().charAt(0) || "主",
        boxStyle: `width:${px}rpx;height:${px}rpx;`,
        // 首字随盘径缩放（设计稿 0.42 倍），不然小头像里的字会顶满
        iniStyle: `font-size:${Math.round(px * 0.42)}rpx;`,
      });
    },
    /** 图片加载失败：回落渐变盘（把 src 清掉即可，WXML 用 wx:if 分支） */
    onError() {
      this.setData({ src: "" });
    },
    onTap() {
      this.triggerEvent("tap");
    },
  },
});
