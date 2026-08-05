const { definePage, demo } = require('../../utils/page');

definePage({
  tab: 0,

  data: {
    action: demo.todayAction,
    line: demo.mainline,
    stats: demo.homeStats,
    shortcuts: demo.shortcuts,
  },
});
