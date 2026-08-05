/**
 * 登录与裂变归因。
 * - inviteCode 来源：分享 path 查询参数 / 小程序码 scene（≤32 可见字符，直接放邀请码）
 * - 登录：wx.login → POST /mp/login（后端 code2Session，WX_MOCK 决定真假）
 *
 * 关键约束：wx.login 的 code 一次性且短时效，**绝不允许并发登录**。
 * 页面常并发拉多个接口，故 ensureLogin 用「单例 in-flight Promise」把并发登录收敛成一次。
 *
 * 协议门禁（合规要求）：首次使用必须在登录页勾选协议后才允许建档。
 * 分享链接可以直达任意内页，若内页直接静默登录就绕过了协议同意——故 ensureLogin
 * 在「无 token 且无同意标记」时拒绝登录并把用户送回登录页（见 ensureLogin 注释）。
 */
const log = require("./log");
const env = require("./env");

/**
 * API 基址：定义与切换都在 utils/env.js，这里只转发。
 *
 * 必须用 base() 现取，**不要缓存成常量**——小程序模块只在冷启动求值一次，
 * wx.reLaunch 不会重新 require，存成常量的话切完环境要杀掉小程序重进才生效。
 */
const ENV = env.ENV_VERSION;
const base = env.base;

const TOKEN_KEY = "scp-mp-token";
const MEMBER_KEY = "scp-mp-member";
const INVITE_KEY = "scp-mp-invite-code";
/** 协议同意标记：一旦写入永久保留（退出登录不清，用户不必重复勾选） */
const CONSENT_KEY = "scp-mp-consent";
/** 完善资料引导只弹一次的标记（登录页在原地弹，用户拒绝后不再打扰） */
const NICK_GUIDE_KEY = "scp-mp-nick-guided";
/**
 * 待处理的管理台扫码登录票据（scene 里带进来的 'S'+24hex）。
 *
 * 为什么必须落 storage 而不是只靠页面参数：新用户扫码进来时，`app.onLaunch` 的登录门禁
 * 会先把他 reLaunch 到登录页——页面栈被换掉，扫码页的 onLoad 参数随之作废。
 * 冷启动即把票据存下来，登录页登完再据此回到扫码页（见 pages/login/index.js enterHome）。
 */
const SCAN_TICKET_KEY = "scp-mp-scan-ticket";

const LOGIN_PAGE = "/pages/login/index";
/** ensureLogin 因未同意协议而拒绝时抛出的错误码（页面据此静默处理，不弹错误条） */
const NEED_CONSENT = "NEED_CONSENT";

/** 从启动/页面参数捕获邀请码（分享 path: ?inviteCode=FLM-XXXX；小程序码 scene 直接是邀请码） */
function captureInviteCode(options) {
  const q = (options && options.query) || options || {};
  const fromQuery = q.inviteCode || undefined;
  let fromScene;
  try {
    fromScene = typeof q.scene === "string" ? decodeURIComponent(q.scene) : undefined;
  } catch (e) {
    fromScene = undefined; // scene 非法编码不应中断启动
  }
  const code = fromQuery || (fromScene && fromScene.indexOf("FLM-") === 0 ? fromScene : undefined);
  if (code) {
    wx.setStorageSync(INVITE_KEY, code);
    log.info("invite code captured", code);
  }
}

/**
 * 从启动/页面参数捕获管理台扫码登录票据。
 * 与 captureInviteCode 并列调用而不是合并：两者共用 scene 通道但前缀不同
 * （票据 'S'+24hex / 邀请码 'FLM-'），各自只认自己的形状，互不误吞。
 */
function captureScanTicket(options) {
  const q = (options && options.query) || options || {};
  let fromScene;
  try {
    fromScene = typeof q.scene === "string" ? decodeURIComponent(q.scene) : undefined;
  } catch (e) {
    fromScene = undefined; // scene 非法编码不应中断启动
  }
  const candidate = q.ticket || fromScene;
  const ticket = isScanTicket(candidate) ? candidate : undefined;
  if (ticket) {
    wx.setStorageSync(SCAN_TICKET_KEY, ticket);
    log.info("scan-login ticket captured");
  }
  return ticket || null;
}

/** 票据形状校验：'S' + 24 位小写 hex（与后端 WechatScanLoginService 同一口径）。 */
function isScanTicket(value) {
  return typeof value === "string" && /^S[0-9a-f]{24}$/.test(value);
}

/** 取待处理票据（不清除——确认成功/取消后才由扫码页显式清） */
function getPendingScanTicket() {
  const t = wx.getStorageSync(SCAN_TICKET_KEY);
  return isScanTicket(t) ? t : null;
}

function clearPendingScanTicket() {
  wx.removeStorageSync(SCAN_TICKET_KEY);
}

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || null;
}
function getMemberNo() {
  return wx.getStorageSync(MEMBER_KEY) || null;
}

/**
 * 是否已同意协议。
 * 存量兼容：协议门禁上线前建档的用户本地没有 CONSENT_KEY，但有 token——
 * 视为此前已走过登录流程，一次性补写标记，避免老用户被强制回登录页。
 */
function hasConsent() {
  if (wx.getStorageSync(CONSENT_KEY)) return true;
  if (wx.getStorageSync(TOKEN_KEY)) {
    wx.setStorageSync(CONSENT_KEY, 1);
    return true;
  }
  return false;
}

/**
 * 跳登录页的防抖闸：多个页面/多个并发请求可能同时命中门禁，
 * 不防抖会连发多次 reLaunch，表现为页面闪烁甚至跳转失败。
 */
let redirecting = false;

/** 登录页勾选协议并登录成功后写入 */
function setConsent() {
  wx.setStorageSync(CONSENT_KEY, 1);
  redirecting = false; // 已进入登录流程，解除跳转防抖
}

/** 跳转失败重试上限：防止 reLaunch 持续失败时无限自旋 */
const REDIRECT_MAX_RETRY = 3;
let redirectRetry = 0;

function redirectToLogin() {
  if (redirecting) return;
  // 已经在登录页就不必再跳（例如登录页自身的接口触发了门禁）
  try {
    const pages = getCurrentPages();
    const route = pages.length ? pages[pages.length - 1].route : "";
    if (`/${route}` === LOGIN_PAGE) return;
  } catch (e) {
    // getCurrentPages 在 App.onLaunch 阶段可能为空，忽略即可
  }
  redirecting = true;
  wx.reLaunch({
    url: LOGIN_PAGE,
    success: () => {
      redirectRetry = 0;
      // 留一小段静默期吸收同一批并发调用，之后恢复以便后续（如退出登录）能再次跳转
      setTimeout(() => {
        redirecting = false;
      }, 1000);
    },
    fail: err => {
      // 典型失败场景：在 App.onLaunch 阶段页面栈尚未就绪。
      // 此时必须立刻解除防抖并短延时重试，否则后续 ensureLogin 会被防抖挡掉，
      // 用户停在一个拉不到数据的空白内页，没有任何出路。
      log.warn("redirect to login failed", (err && err.errMsg) || "");
      redirecting = false;
      if (redirectRetry < REDIRECT_MAX_RETRY) {
        redirectRetry += 1;
        setTimeout(redirectToLogin, 300);
      }
    },
  });
}

/** 判断是否为「未同意协议」导致的静默错误：页面据此直接 return，不弹 toast/错误条 */
function isAuthGateError(e) {
  return !!(e && e.code === NEED_CONSENT);
}

function wxLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: res => (res && res.code ? resolve(res.code) : reject(new Error("wx.login 未返回 code"))),
      fail: err => reject(new Error((err && err.errMsg) || "wx.login 失败")),
    });
  });
}

/** 把底层网络失败翻译成能自诊断的中文提示（"没登录"类问题的排查入口） */
function explainNetworkError(errMsg) {
  const m = String(errMsg || "");
  if (m.indexOf("not in domain list") >= 0 || m.indexOf("域名") >= 0) {
    return ENV === "develop"
      ? "请求被域名校验拦截：开发者工具右上角「详情 → 本地设置」勾选「不校验合法域名…」"
      : "服务器域名未在小程序后台配置，请联系管理员";
  }
  if (m.indexOf("timeout") >= 0) return "网络超时，请检查网络后重试";
  if (m.indexOf("fail") >= 0 || m.indexOf("ERR_CONNECTION") >= 0 || m.indexOf("ECONNREFUSED") >= 0) {
    // 联调期把当前环境一并报出来：连不上时第一个要确认的就是"我现在打的是哪个后端"
    return env.isSwitchable()
      ? `连不上后端（${env.current().label} · ${base()}）：确认服务已启动，或在「我的 → 设置」里换个环境`
      : "服务暂时不可用，请稍后重试";
  }
  return m || "网络错误";
}

function postLogin(data) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${base()}/mp/login`,
      method: "POST",
      data,
      timeout: 10000,
      header: { "Content-Type": "application/json" },
      success: res => resolve(res.data),
      fail: err => reject(new Error(explainNetworkError(err && err.errMsg))),
    });
  });
}

/** 单例：并发调用只发一次登录请求（wx.login 的 code 不可复用） */
let inflight = null;

async function doLogin() {
  const code = await wxLogin();
  const inviteCode = wx.getStorageSync(INVITE_KEY) || undefined;
  const resp = await postLogin({ code, inviteCode });
  if (!resp || resp.code !== 0) {
    throw new Error((resp && resp.message) || "登录失败");
  }
  wx.setStorageSync(TOKEN_KEY, resp.data.token);
  wx.setStorageSync(MEMBER_KEY, resp.data.memberNo);
  log.info("login ok", resp.data.memberNo);
  return { memberNo: resp.data.memberNo };
}

/**
 * 静默登录（幂等 + 并发收敛 + 协议门禁）。
 * - 已有 token：直接返回。
 * - 无 token 但已同意过协议（如 token 过期被清）：静默重登，不打扰用户。
 * - 无 token 且从未同意协议：拒绝并送回登录页——防止分享链接直达内页时绕过协议静默建档。
 * @param {{skipConsentGate?: boolean}} [opts] 登录页自身调用时传 skipConsentGate，否则会自跳自
 */
function ensureLogin(opts) {
  const token = getToken();
  const memberNo = getMemberNo();
  if (token && memberNo) return Promise.resolve({ memberNo });

  if (!(opts && opts.skipConsentGate) && !hasConsent()) {
    redirectToLogin();
    const err = new Error("请先阅读并同意用户协议");
    err.code = NEED_CONSENT;
    return Promise.reject(err);
  }

  if (inflight) return inflight; // 复用进行中的登录，避免并发消耗 code
  inflight = doLogin().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** 退出登录：只清登录态，协议同意标记保留（用户已表达过同意，不必重复勾选） */
function logout() {
  wx.removeStorageSync(TOKEN_KEY);
  wx.removeStorageSync(MEMBER_KEY);
  inflight = null;
}

/**
 * 服务端换发了新 token 时就地替换（并档场景）。
 *
 * 绑定手机号可能触发按手机号自动并档，主档取**较早建档者**——运营预录的档案通常早于本人注册，
 * 于是当前 token 里的会员号会变成败档，而服务端解析会员一律要求 merged_into IS NULL。
 * 不换 token 的话，用户绑完手机号之后每个接口都会失败，表现为「绑了手机号就用不了了」。
 */
function adoptToken(token, memberNo) {
  if (!token) return;
  wx.setStorageSync(TOKEN_KEY, token);
  if (memberNo) wx.setStorageSync(MEMBER_KEY, memberNo);
  inflight = null;
  log.info("token adopted after merge", memberNo);
}

module.exports = {
  base,
  ENV,
  LOGIN_PAGE,
  NEED_CONSENT,
  NICK_GUIDE_KEY,
  SCAN_TICKET_KEY,
  captureInviteCode,
  captureScanTicket,
  isScanTicket,
  getPendingScanTicket,
  clearPendingScanTicket,
  getToken,
  getMemberNo,
  hasConsent,
  setConsent,
  redirectToLogin,
  isAuthGateError,
  ensureLogin,
  logout,
  adoptToken,
  explainNetworkError,
};
