/** 展示格式化工具：WXML 无法调函数，所有派生字段在 setData 前算好。 */

/** 千分位（整数或两位小数原样保留） */
function money(n) {
  const v = Number(n || 0);
  const [int, dec] = String(v).split(".");
  const withSep = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec ? `${withSep}.${dec}` : withSep;
}

/** ISO 时间 → YYYY-MM-DD */
function d10(s) {
  return s ? String(s).slice(0, 10) : "";
}

/** ISO 时间 → MM-DD HH:mm */
function d11(s) {
  return s ? String(s).slice(5, 16).replace("T", " ") : "";
}

/** ISO 时间 → YYYY-MM-DD HH:mm */
function d16(s) {
  return s ? String(s).slice(0, 16).replace("T", " ") : "";
}

/**
 * 手机号脱敏：138****1234。
 * 空值返回空串（由调用方决定显示「未绑定」还是「—」，这里不替它编文案）；
 * 长度不足 7 位的非标准号码**原样返回**——假装脱敏会把本来就短的号码遮成认不出来的样子。
 */
function maskPhone(phone) {
  const s = String(phone == null ? "" : phone).trim();
  if (!s) return "";
  if (s.length < 7) return s;
  return `${s.slice(0, 3)}****${s.slice(-4)}`;
}

function toast(msg) {
  wx.showToast({ title: msg, icon: "none" });
}

module.exports = { money, d10, d11, d16, maskPhone, toast };
