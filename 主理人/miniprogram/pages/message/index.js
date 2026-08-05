/**
 * 公告详情（设计稿 13「消息详情」）。
 *
 * 按**公告编号**取详情（不是自增 id）：编号会出现在界面上，用 id 会让人能顺序枚举
 * 别人班级的公告。可见性由服务端按「项目 + 已入群班级」判定，
 * 看不到时页面如实说明原因（可能已下线 / 不在可见范围），而不是空白页。
 *
 * 打开即标已读：这一页的存在本身就是「我看了」，再让用户点一次按钮才算已读，
 * 会让「N 人已查看」永远偏低。底部的「确认已读」保留为显式动作，
 * 但它只是同一个幂等接口，不是另一种语义。
 */
const api = require("../../api/mp");
const share = require("../../behaviors/share");
const { toast, d16 } = require("../../utils/fmt");
const { navVars } = require("../../utils/layout");
const { isAuthGateError } = require("../../utils/auth");
const log = require("../../utils/log");

Page(
  share.withShare({
    data: {
      navPad: "",
      loading: true,
      err: "",
      retrying: false,
      annNo: "",
      ann: null,
      publishText: "",
    },

    onLoad(options) {
      this.setData(Object.assign({ annNo: (options && options.annNo) || "" }, navVars()));
      this.load();
    },

    async load() {
      if (!this.data.annNo) {
        this.setData({ loading: false, ann: null });
        return;
      }
      this.setData({ retrying: true });
      try {
        const ann = await api.getAnnouncement(this.data.annNo);
        this.setData({
          loading: false,
          err: "",
          retrying: false,
          ann,
          publishText: d16(ann.publish_at),
        });
        // 打开即已读（幂等）；失败不打扰用户——它不影响阅读
        if (!ann.read) this.markRead(true);
      } catch (e) {
        if (isAuthGateError(e)) return;
        log.warn("announcement detail", e.message);
        this.setData({ loading: false, retrying: false, ann: null, err: "" });
      }
    },

    async markRead(silent) {
      try {
        const r = await api.readAnnouncement(this.data.annNo);
        this.setData({
          ann: Object.assign({}, this.data.ann, { read: true, read_count: r.readCount }),
        });
        if (silent !== true) toast("已确认阅读");
        // 顶部未读数会变，回列表时让它重新拉
        const app = getApp();
        if (app && app.globalData && app.globalData.unread > 0) {
          app.globalData.unread = app.globalData.unread - 1;
        }
      } catch (e) {
        if (silent === true) {
          log.warn("mark announcement read", e.message);
          return;
        }
        toast(e.message);
      }
    },

    copyNo() {
      wx.setClipboardData({ data: this.data.annNo, success: () => toast("公告编号已复制") });
    },

    /** 转发带上公告编号，好友点开直达同一条（可见性仍由服务端判定） */
    onShareAppMessage() {
      const ann = this.data.ann;
      return {
        title: ann ? ann.title : "主理人公社公告",
        path: "/pages/message/index?annNo=" + this.data.annNo,
      };
    },

    go(e) {
      const { url, tab } = e.currentTarget.dataset;
      if (!url) return;
      if (tab) wx.switchTab({ url });
      else wx.navigateTo({ url, fail: () => toast("页面暂不可用") });
    },
  })
);
