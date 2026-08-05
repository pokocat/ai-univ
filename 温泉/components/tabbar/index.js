const TABS = [
  { key: 'line', label: '主线', path: '/pages/mainline/index' },
  { key: 'clip', label: '出片', path: '/pages/studio/index' },
  { key: 'asset', label: '资产', path: '/pages/assets/index' },
  { key: 'crowd', label: '社群', path: '/pages/crowd/index' },
  { key: 'me', label: '我的', path: '/pages/ledger/index' },
];

Component({
  options: { addGlobalClass: true },

  properties: {
    // 当前高亮的 tab 下标（0–4）
    selected: { type: Number, value: 0 },
  },

  data: {
    tabs: TABS,
    safeBottom: 0,
  },

  attached() {
    const app = getApp();
    if (app && app.globalData) {
      this.setData({ safeBottom: app.globalData.safeBottom || 0 });
    }
  },

  methods: {
    onTap(e) {
      const i = e.currentTarget.dataset.i;
      if (i === this.data.selected) return;
      wx.switchTab({
        url: TABS[i].path,
        fail: () => wx.reLaunch({ url: TABS[i].path }),
      });
    },
  },
});
