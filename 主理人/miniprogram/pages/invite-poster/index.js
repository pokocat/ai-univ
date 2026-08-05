/**
 * 邀请海报（设计稿 27）。
 *
 * 海报在**本机 canvas 绘制**后保存到相册：服务端没有出图能力，
 * 而「保存海报」如果只是保存一张静态背景图，那张图上就不会有本人的邀请码——
 * 那等于给了一张对谁都一样的图。
 *
 * 小程序码取不到时（Mock 凭证 / 接口异常）**照样出图**，只是把码位换成邀请码大字，
 * 并在页面上如实说明好友可以手输邀请码。不给一张扫不出来的图。
 *
 * 颜色在这里不得不写字面值：canvas 绘图 API 不认 CSS 变量。
 * 这是全站第三处调色板镜像，改 app.wxss 的暖色令牌时要同步改 PALETTE。
 */
const api = require("../../api/mp");
const { toast } = require("../../utils/fmt");
const { navVars } = require("../../utils/layout");
const { isAuthGateError } = require("../../utils/auth");
const log = require("../../utils/log");

/** canvas 用调色板（与 app.wxss 的暖色令牌对齐；改一处要同步改另一处） */
const PALETTE = {
  bgTop: "#FFEFDA",
  bgBottom: "#F5EBFF",
  ink: "#33210F",
  inkSoft: "#7A5236",
  signal: "#6D28D9",
  signalDeep: "#57189E",
  paper: "#FFFCF6",
  line: "rgba(124,58,237,0.25)",
};

const RULES = [
  { icon: "award", title: "邀请奖励", desc: "好友经你的邀请码注册成功即发放成长值奖励（以页面展示为准）" },
  { icon: "link", title: "关系绑定", desc: "注册即自动绑定关系链，最多三级；绑定后不可更改" },
  { icon: "shield", title: "奖励性质", desc: "奖励为成长值等虚拟权益，不涉及现金返利，平台不做返佣结算" },
];

Page({
  data: {
    navPad: "",
    loading: true,
    err: "",
    retrying: false,
    drawn: false,
    cw: 300,
    ch: 480,
    invite: null,
    rules: RULES,
  },

  onLoad() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    // 画布逻辑尺寸按屏宽定，保证不同机型上海报比例一致
    const cw = Math.min(320, Math.round((info.windowWidth || 375) - 90));
    this.setData(Object.assign({ cw, ch: Math.round(cw * 1.6) }, navVars()));
    this.load();
  },

  async load() {
    this.setData({ retrying: true });
    try {
      const invite = await api.getInvite();
      let qr = "";
      try {
        const r = await api.getInviteQrcode();
        qr = r && r.qrcodeBase64 ? r.qrcodeBase64 : "";
      } catch (e) {
        log.warn("invite qrcode", e.message);
      }
      this.setData({ loading: false, err: "", retrying: false, invite });
      this.draw(invite, qr);
    } catch (e) {
      if (isAuthGateError(e)) return;
      log.error("poster load", e.message);
      this.setData({ loading: false, retrying: false, err: e.message });
    }
  },

  /** 绘制海报。任何一步失败都如实提示，不留一张半成品图 */
  draw(invite, qrBase64) {
    wx.createSelectorQuery()
      .select("#poster")
      .fields({ node: true, size: true })
      .exec(res => {
        const node = res && res[0] && res[0].node;
        if (!node) {
          this.setData({ err: "海报绘制失败，请退出重进本页" });
          return;
        }
        const ctx = node.getContext("2d");
        const dpr = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).pixelRatio || 2;
        const w = this.data.cw;
        const h = this.data.ch;
        node.width = w * dpr;
        node.height = h * dpr;
        ctx.scale(dpr, dpr);

        // 背景：暖奶油 → 淡紫
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, PALETTE.bgTop);
        grad.addColorStop(1, PALETTE.bgBottom);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // 品牌
        ctx.fillStyle = PALETTE.signalDeep;
        ctx.font = "bold 20px sans-serif";
        ctx.fillText("主理人公社", 24, 46);
        ctx.fillStyle = PALETTE.inkSoft;
        ctx.font = "11px sans-serif";
        ctx.fillText("连接资源 · 共创商业", 24, 66);

        // 主标题（两行，显式断行：中文自动换行在 canvas 里没有 API）
        ctx.fillStyle = PALETTE.ink;
        ctx.font = "bold 26px sans-serif";
        ctx.fillText("连接优秀主理人", 24, 118);
        ctx.fillText("共创新商业未来", 24, 150);

        ctx.fillStyle = PALETTE.inkSoft;
        ctx.font = "12px sans-serif";
        ctx.fillText("邀请你加入主理人公社会员计划", 24, 178);

        // 三条卖点
        const feats = ["优质资源共享 · 精选课程与项目对接", "专属陪跑支持 · 服务老师全程跟进", "AI 智能加速 · 诊断建议与运营优化"];
        ctx.font = "11px sans-serif";
        feats.forEach((t, i) => {
          const y = 212 + i * 24;
          ctx.fillStyle = PALETTE.signal;
          ctx.beginPath();
          ctx.arc(28, y - 4, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = PALETTE.inkSoft;
          ctx.fillText(t, 40, y);
        });

        // 码位白底
        const boxY = h - 150;
        ctx.fillStyle = PALETTE.paper;
        ctx.strokeStyle = PALETTE.line;
        ctx.lineWidth = 1;
        this.roundRect(ctx, 24, boxY, w - 48, 120, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = PALETTE.inkSoft;
        ctx.font = "11px sans-serif";
        ctx.fillText("邀请码", 42, boxY + 34);
        ctx.fillStyle = PALETTE.ink;
        ctx.font = "bold 22px sans-serif";
        ctx.fillText(invite.inviteCode || "—", 42, boxY + 64);
        ctx.fillStyle = PALETTE.inkSoft;
        ctx.font = "10px sans-serif";
        ctx.fillText(qrBase64 ? "长按识别右侧小程序码" : "注册时手动输入邀请码即可", 42, boxY + 90);

        const finish = () => this.setData({ drawn: true });
        if (!qrBase64) {
          finish();
          return;
        }
        // 小程序码：base64 要先落成临时文件，canvas 的 Image 不吃 data-URI
        const fs = wx.getFileSystemManager();
        const path = `${wx.env.USER_DATA_PATH}/poster-qr.png`;
        try {
          fs.writeFileSync(path, qrBase64, "base64");
        } catch (e) {
          log.warn("write qr temp file", e.message);
          finish();
          return;
        }
        const img = node.createImage();
        img.onload = () => {
          ctx.drawImage(img, w - 116, boxY + 16, 88, 88);
          finish();
        };
        img.onerror = () => finish();
        img.src = path;
      });
  },

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  savePoster() {
    if (!this.data.drawn) {
      toast("海报还在生成，请稍候");
      return;
    }
    wx.canvasToTempFilePath({
      canvasId: "poster",
      canvas: this.canvasNode,
      success: res => this.saveToAlbum(res.tempFilePath),
      fail: () => {
        // 2D canvas 需要用 node 方式导出，这里补一次带 node 的调用
        wx.createSelectorQuery()
          .select("#poster")
          .fields({ node: true })
          .exec(r => {
            const node = r && r[0] && r[0].node;
            if (!node) {
              toast("海报导出失败，可截屏保存");
              return;
            }
            wx.canvasToTempFilePath({
              canvas: node,
              success: res2 => this.saveToAlbum(res2.tempFilePath),
              fail: () => toast("海报导出失败，可截屏保存"),
            });
          });
      },
    });
  },

  saveToAlbum(filePath) {
    wx.saveImageToPhotosAlbum({
      filePath,
      success: () => toast("海报已保存到相册"),
      fail: err => {
        if (String(err.errMsg || "").indexOf("auth") >= 0) {
          wx.showModal({
            title: "需要相册权限",
            content: "保存海报需要相册写入权限，可在「设置 → 主理人公社」中开启后重试。",
            confirmText: "去设置",
            success: r => {
              if (r.confirm) wx.openSetting();
            },
          });
          return;
        }
        toast("保存失败，可截屏保存");
      },
    });
  },

  onShareAppMessage() {
    const code = this.data.invite && this.data.invite.inviteCode;
    return {
      title: "我在主理人公社，邀你一起进圈子",
      path: code ? "/pages/index/index?inviteCode=" + encodeURIComponent(code) : "/pages/index/index",
    };
  },
});
