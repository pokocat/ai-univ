const { definePage, demo } = require('../../utils/page');

definePage({
  tab: 4,

  data: {
    l: demo.ledger,
  },
});
