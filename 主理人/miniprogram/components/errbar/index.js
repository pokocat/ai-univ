/** 加载失败提示条：显示可读原因 + 重试入口，避免请求失败后页面变成无声空壳。 */
Component({
  properties: {
    msg: { type: String, value: "" },
    retrying: { type: Boolean, value: false },
  },
  methods: {
    retry() {
      this.triggerEvent("retry");
    },
  },
});
