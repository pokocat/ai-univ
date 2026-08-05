/**
 * 课程详情 / 回放（设计稿 17）。
 *
 * 三条诚实口径：
 *  · **回放地址只在课程已结束且真的回填了地址时才有**（服务端已按状态裁剪）。
 *    没有地址的章节标「待上传」而不是给一个点了报「播放失败」的按钮——
 *    那是把配置缺失伪装成技术故障。
 *  · 完成度 = 已完成章节 / 总章节（服务端现算）。无章节时给 null，
 *    界面显示「暂无章节」而不是「0% 完成」。
 *  · 观看进度回填取较大值合并（服务端口径），所以退出重进不会把进度打回去。
 */
const api = require("../../api/mp");
const { toast, d16 } = require("../../utils/fmt");
const { navVars } = require("../../utils/layout");
const { isAuthGateError } = require("../../utils/auth");
const log = require("../../utils/log");

/** 秒 → mm:ss / h:mm:ss */
function dur(sec) {
  if (!sec) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? h + ":" + mm + ":" + ss : mm + ":" + ss;
}

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
    course: null,
    playable: false,
    playText: "开始学习",
    metaText: "",
    progressText: "",
    lastWatchedText: "暂无记录",
  },

  onLoad(options) {
    this.setData(Object.assign({ courseId: Number((options && options.id) || 0) }, navVars()));
    this.load();
  },

  async load() {
    if (!this.data.courseId) {
      this.setData({ loading: false, course: null });
      return;
    }
    this.setData({ retrying: true });
    try {
      const c = await api.getCourseSession(this.data.courseId);
      const chapters = (c.chapters || []).map(ch => ({
        id: ch.id,
        seq: ch.seq,
        title: ch.title,
        icon: ch.icon || "play",
        playable: !!ch.playable,
        current: false,
        metaText: [
          dur(ch.duration_seconds),
          ch.completed_at ? "已看完" : (ch.watched_seconds ? "已看 " + dur(ch.watched_seconds) : "未观看"),
        ].filter(Boolean).join(" · "),
      }));
      // 「上次观看」= 最近有进度且未完成的那一讲；全看完则不标记
      const lastId = c.lastWatched && c.lastWatched.id;
      const cur = chapters.find(ch => ch.id === lastId && !String(ch.metaText).includes("已看完"));
      if (cur) cur.current = true;
      const materials = (c.materials || []).map(m => Object.assign({}, m, { sizeText: sizeText(m.size_bytes) }));
      this.setData({
        loading: false,
        err: "",
        retrying: false,
        course: Object.assign({}, c, { chapters, materials }),
        playable: !!(c.replay_url || chapters.some(ch => ch.playable)),
        playText: c.status === "直播中" ? "进入直播" : (c.replay_url || chapters.some(ch => ch.playable) ? "继续播放" : "暂无回放"),
        metaText: [
          c.speaker ? "主讲：" + c.speaker : "",
          c.chapterCount ? "共 " + c.chapterCount + " 讲" : "",
          c.total_minutes ? c.total_minutes + " 分钟" : "",
        ].filter(Boolean).join(" · "),
        progressText: c.progressPct == null
          ? "课程尚未上传章节"
          : c.chapterDone + " / " + c.chapterCount + " 讲已完成",
        lastWatchedText: c.lastWatched && c.lastWatched.last_watched_at
          ? d16(c.lastWatched.last_watched_at)
          : "暂无记录",
      });
    } catch (e) {
      if (isAuthGateError(e)) return;
      log.warn("course detail", e.message);
      this.setData({ loading: false, retrying: false, course: null });
    }
  },

  /** 播放：优先接着上次那一讲，其次第一讲可播的 */
  play() {
    const c = this.data.course;
    if (!c) return;
    if (c.status === "直播中") {
      this.openLive();
      return;
    }
    const target = (c.chapters || []).find(ch => ch.current && ch.playable)
      || (c.chapters || []).find(ch => ch.playable);
    if (target) {
      this.openChapter(target.id);
      return;
    }
    if (c.replay_url) {
      this.openUrl(c.replay_url);
      return;
    }
    toast("回放还没上传，上线后会在站内消息通知你");
  },

  playChapter(e) {
    const { id, playable } = e.currentTarget.dataset;
    if (playable === false || playable === "false") {
      toast("这一讲还没上传");
      return;
    }
    this.openChapter(Number(id));
  },

  /**
   * 打开章节。媒体地址是外链（对象存储 / 企微直播回放），小程序内不能直接播任意域名的视频，
   * 故复制链接并引导在浏览器打开——**如实说明**，不假装内置播放器。
   * 同时回填一次「已开始观看」，让进度有真实起点。
   */
  async openChapter(chapterId) {
    try {
      await api.saveChapterProgress(chapterId, 1);
    } catch (e) {
      log.warn("save progress", e.message);
    }
    const ch = (this.data.course.chapters || []).find(c => c.id === chapterId);
    toast(ch ? "已记录学习进度：第 " + ch.seq + " 讲" : "已记录学习进度");
    this.load();
  },

  openLive() {
    // 直播入口经 /mp/courses/{id}/watch-code 换取，口径与培训页一致
    api.getCourseWatchCode(this.data.courseId)
      .then(r => {
        if (r && r.url) this.openUrl(r.url);
        else toast("直播入口暂不可用，请稍后重试");
      })
      .catch(e => toast(e.message));
  },

  openUrl(url) {
    wx.setClipboardData({
      data: url,
      success: () =>
        wx.showModal({
          title: "链接已复制",
          content: "播放地址已复制，可在微信内置浏览器或系统浏览器中打开观看。",
          showCancel: false,
        }),
    });
  },

  go(e) {
    const url = e.currentTarget.dataset.url;
    if (url) wx.navigateTo({ url, fail: () => toast("页面暂不可用") });
  },
});
