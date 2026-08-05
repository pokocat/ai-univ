/**
 * 邀请推荐（设计稿 14）。
 *
 * 三格读数全部有真实来源——设计稿的「预计收益 ¥2,870」**刻意不做**：
 * 返佣永不进中台（护栏 15），收益只有外部系统的只读镜像，
 * 在邀请页摆一个「预计收益」等于承诺一件中台算不出也不结算的事。
 * 换成「邀请成长值（累计已获得）」，那是真实发生过的。
 *
 * 单次奖励与每日封顶都读服务端（resource_rules），不在前端写死 288（护栏 23 的前端面）。
 */
const api = require("../../api/mp");
const share = require("../../behaviors/share");
const { toast, money, d10 } = require("../../utils/fmt");
const { navVars } = require("../../utils/layout");
const { isAuthGateError } = require("../../utils/auth");
const qrcode = require("../../utils/qrcode");
const log = require("../../utils/log");

const LEVEL_TEXT = { 1: "直接邀请", 2: "二级", 3: "三级" };

Page(
  share.withShare({
    data: {
      navPad: "",
      loading: true,
      err: "",
      retrying: false,
      invite: null,
      influenceText: "0",
      paidCountText: "0",
      inviteGrowthText: "0",
      awardText: "—",
      downline: [],
      qrBase64: "",
      qrHint: "点击生成小程序码",
    },

    onLoad() {
      this.setData(navVars());
    },

    onShow() {
      this.load();
    },

    onPullDownRefresh() {
      this.load().then(() => wx.stopPullDownRefresh());
    },

    async load() {
      this.setData({ retrying: true });
      try {
        const invite = await api.getInvite();
        this.setShareCode(invite.inviteCode);
        const downline = (invite.downline || []).map(d => ({
          member_no: d.member_no,
          name: d.name,
          levelText: LEVEL_TEXT[d.level] || "下线",
          boundText: d.bound_at ? d10(d.bound_at) + " 加入" : "",
          direct_downline: d.direct_downline,
          paid: !!d.has_paid,
        }));
        this.setData({
          loading: false,
          err: "",
          retrying: false,
          invite,
          influenceText: money(invite.influence || 0),
          paidCountText: money(downline.filter(d => d.paid).length),
          inviteGrowthText: money(invite.inviteGrowth || 0),
          awardText: invite.inviteAward == null ? "—" : money(invite.inviteAward),
          downline,
        });
      } catch (e) {
        if (isAuthGateError(e)) return;
        log.error("invite load", e.message);
        this.setData({ loading: false, retrying: false, err: e.message });
      }
    },

    /**
     * 小程序码按需生成：它要打微信接口，进页面就拉会让每次进来都消耗一次配额。
     * Mock 凭证下服务端如实回 mock=true，此时不显示一个假的码图。
     */
    async loadQrcode() {
      try {
        const r = await api.getInviteQrcode();
        if (r && r.qrcodeBase64) {
          this.setData({ qrBase64: "data:image/png;base64," + r.qrcodeBase64 });
          return;
        }
        this.setData({ qrHint: "小程序码暂不可用，可先复制邀请码分享" });
      } catch (e) {
        this.setData({ qrHint: e.message });
      }
    },

    previewQr() {
      // base64 图不能直接 previewImage，写成临时文件后再预览
      const fs = wx.getFileSystemManager();
      const path = `${wx.env.USER_DATA_PATH}/invite-qr.png`;
      try {
        fs.writeFileSync(path, this.data.qrBase64.replace(/^data:image\/png;base64,/, ""), "base64");
        qrcode.preview(path);
      } catch (e) {
        toast("图片预览失败，可长按保存后使用");
      }
    },

    copyCode() {
      const code = this.data.invite && this.data.invite.inviteCode;
      if (!code) return;
      wx.setClipboardData({ data: code, success: () => toast("邀请码已复制") });
    },

    go(e) {
      const url = e.currentTarget.dataset.url;
      if (!url) return;
      if (/^\/pages\/(index|group|member|notifications|mine)\/index$/.test(url)) wx.switchTab({ url });
      else wx.navigateTo({ url, fail: () => toast("页面暂不可用") });
    },
  })
);
