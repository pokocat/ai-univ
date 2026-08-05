const { definePage, demo } = require('../../utils/page');

definePage({
  tab: 1,

  data: {
    cats: demo.templateTabs,
    cat: 0,
    drama: demo.dramaTemplate,
    templates: demo.templates,
    star: demo.starTemplate,
  },

  pickCat(e) {
    this.setData({ cat: Number(e.currentTarget.dataset.i) });
  },
});
