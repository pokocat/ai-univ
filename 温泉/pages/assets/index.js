const { definePage, demo } = require('../../utils/page');

definePage({
  tab: 2,

  data: {
    a: demo.assets,
    kind: 0,
  },

  pickKind(e) {
    this.setData({ kind: Number(e.currentTarget.dataset.i) });
  },
});
