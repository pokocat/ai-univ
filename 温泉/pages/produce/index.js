const { definePage, demo } = require('../../utils/page');

definePage({
  tab: 1,
  inlineTab: true,

  data: {
    p: demo.produce,
    // 04 屏的进度条是活的：进演示时从 6/8 跑到 8/8，讲「后台跑，可以退出」
    done: demo.produce.done,
    total: demo.produce.total,
    pct: Math.round((demo.produce.done / demo.produce.total) * 100),
    // 游客自助出片开关 —— README §8 的 guestSelfServe，路演现场可当场关掉对比讲
    selfServe: demo.tweaks.guestSelfServe,
  },

  onShow() {
    this.tick();
  },

  onHide() {
    this.stop();
  },

  onUnload() {
    this.stop();
  },

  tick() {
    this.stop();
    this._t = setInterval(() => {
      const done = this.data.done;
      if (done >= this.data.total) return this.stop();
      const next = done + 1;
      this.setData({
        done: next,
        pct: Math.round((next / this.data.total) * 100),
      });
    }, 2600);
  },

  stop() {
    if (this._t) {
      clearInterval(this._t);
      this._t = null;
    }
  },

  toggleSelfServe(e) {
    this.setData({ selfServe: e.detail.value });
  },
});
