const { definePage, demo } = require('../../utils/page');

definePage({
  tab: 0,
  inlineTab: true,

  data: {
    dx: demo.diagnosis,
  },
});
