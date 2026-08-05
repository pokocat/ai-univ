const { definePage, demo } = require('../../utils/page');

definePage({
  tab: 3,
  inlineTab: true,

  data: {
    m: demo.member,
  },
});
