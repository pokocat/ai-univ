/**
 * 实时日志（wx.getRealtimeLogManager）：上线后在小程序后台「运维中心-实时日志」
 * 按用户/时间检索——线上问题排查的唯一通道（上架审阅项）。
 * 开发者工具同时输出到 console，基础库不支持时静默降级。
 */
const rt = wx.getRealtimeLogManager ? wx.getRealtimeLogManager() : null;

function fmt(args) {
  return args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a)));
}

module.exports = {
  info(...args) {
    if (rt) rt.info(...fmt(args));
  },
  warn(...args) {
    if (rt) rt.warn(...fmt(args));
    console.warn(...args);
  },
  error(...args) {
    if (rt) rt.error(...fmt(args));
    console.error(...args);
  },
};
