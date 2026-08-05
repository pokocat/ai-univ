/**
 * 课件下载（设计稿 29）。
 *
 * 小程序**不能直接把任意域名的文件存到用户设备**（wx.downloadFile 受合法域名限制，
 * 且非图片类型无法存进相册/文件），所以「下载」= 记录下载状态 + 复制真实地址，
 * 由用户在浏览器里打开保存。这一点在页面上如实写出来，
 * 不做一个点了转圈然后什么都没发生的假下载。
 *
 * 「已下载 / 未下载」是真实状态（`course_material_download` 一人一件一行），
 * 不是本地标记——换设备登录同一账号仍然看得到。
 */
const api = require("../../api/mp");
const { toast, d10 } = require("../../utils/fmt");
const { navVars } = require("../../utils/layout");
const { isAuthGateError } = require("../../utils/auth");
const log = require("../../utils/log");

function sizeText(bytes) {
  if (!bytes) return "";
  const mb = bytes / 1048576;
  return mb >= 1 ? mb.toFixed(1) + "MB" : Math.round(bytes / 1024) + "KB";
}

Page({
  data: {
    navPad: "",
    loading: true,
    err: "",
    retrying: false,
    courseId: 0,
    courseTitle: "",
    materials: [],
    downloadedCount: 0,
    downloadedPct: 0,
    updatedText: "—",
  },

  onLoad(options) {
    this.setData(Object.assign({ courseId: Number((options && options.id) || 0) }, navVars()));
    this.load();
  },

  async load() {
    if (!this.data.courseId) {
      this.setData({ loading: false, materials: [] });
      return;
    }
    this.setData({ retrying: true });
    try {
      const c = await api.getCourseSession(this.data.courseId);
      const materials = (c.materials || []).map(m => Object.assign({}, m, { sizeText: sizeText(m.size_bytes) }));
      const done = materials.filter(m => m.downloaded).length;
      const latest = materials
        .map(m => m.updated_at)
        .filter(Boolean)
        .sort()
        .pop();
      this.setData({
        loading: false,
        err: "",
        retrying: false,
        courseTitle: c.title,
        materials,
        downloadedCount: done,
        downloadedPct: materials.length ? Math.round((done * 100) / materials.length) : 0,
        updatedText: latest ? d10(latest) : "—",
      });
    } catch (e) {
      if (isAuthGateError(e)) return;
      log.warn("courseware load", e.message);
      this.setData({ loading: false, retrying: false, err: e.message });
    }
  },

  async download(e) {
    const { id } = e.currentTarget.dataset;
    try {
      const r = await api.recordDownload(Number(id));
      wx.setClipboardData({
        data: r.url,
        success: () =>
          wx.showModal({
            title: "链接已复制",
            content: "文件地址已复制，可在微信内置浏览器或系统浏览器中打开保存。",
            showCancel: false,
          }),
      });
      this.load();
    } catch (err) {
      toast(err.message);
    }
  },

  /** 复制全部链接：一次给一份清单，比逐个点更实用 */
  downloadAll() {
    const list = this.data.materials;
    if (!list.length) {
      toast("这节课还没有课件");
      return;
    }
    const text = list.map(m => m.name + "：" + m.url).join("\n");
    wx.setClipboardData({
      data: text,
      success: () => {
        toast("已复制 " + list.length + " 条链接");
        // 复制全部也算下载动作，逐个补记状态（失败不打扰用户）
        list.forEach(m => api.recordDownload(m.id).catch(() => {}));
        setTimeout(() => this.load(), 800);
      },
    });
  },

  go(e) {
    const url = e.currentTarget.dataset.url;
    if (url) wx.navigateTo({ url, fail: () => toast("页面暂不可用") });
  },
});
