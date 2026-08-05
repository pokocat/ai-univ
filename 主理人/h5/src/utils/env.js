const Taro = require('@tarojs/taro')
/**
 * 小程序只保留一个在线环境。
 *
 * 开发者工具、真机预览、体验版、正式版以及 iOS/Android 全部使用同一个 `/wxapi`。
 * 旧版本曾允许把环境缓存为 local / lan / staging；这里不再读取这些覆盖，防止已经
 * 切过环境的开发者工具继续连接 127.0.0.1 或已下线的 `/wxapi-dev`。
 */

/** 各环境定义；base 末尾不带斜杠，与 api 层的 `${base}${path}` 拼接口径一致 */
const ENVS = {
  prod: {
    key: 'prod',
    label: '在线',
    base: 'https://bossclub.aibuzz.cn/wxapi',
    // 阿里云 47.98.162.120，nginx /wxapi/ 反代到后端 /api/v1/
    hint: '当前唯一的在线开发测试环境',
  },
}

/** 切换面板里的展示顺序 */
const ENV_LIST = [ENVS.prod]
const ENV_KEY = 'scp-mp-env' // 用户选定的环境 key（仅非 release 生效）
const LAN_BASE_KEY = 'scp-mp-lan-base' // 局域网档位填的地址

function readEnvVersion() {
  try {
    return Taro.getAccountInfoSync().miniProgram.envVersion || 'release'
  } catch (e) {
    return 'release' // 取不到就按最严格的来
  }
}

/** 小程序版本：develop（开发版/真机预览）/ trial（体验版·审核版本）/ release（正式版） */
const ENV_VERSION = readEnvVersion()

/** 单环境期间所有版本都不开放切换入口。 */
function isSwitchable() {
  return false
}

/**
 * 没有显式选择时的默认档位。
 *
 * 当前处于开发测试期，只保留一个在线环境 `/wxapi`：
 * 开发者工具、真机预览、体验版和正式版默认都连接同一后端，避免同一份包因
 * envVersion 或设备不同落到不同数据库。需要本机后端时，仍可在设置的隐藏面板
 * 显式切到 local / lan；旧版本缓存的 staging key 因已不在 ENVS 中会自动回退在线环境。
 */
function defaultKey() {
  return 'prod'
}

/** 当前生效的环境 key */
function currentKey() {
  return 'prod'
}

/** 当前环境对象 */
function current() {
  return ENVS.prod
}

/** 当前 API 基址 */
function base() {
  return ENVS.prod.base
}

/** 单环境模式不存在覆盖。 */
function isOverridden() {
  return false
}

/**
 * 切换环境。仅写入选择，**不负责清登录态**——token 与缓存属于旧后端，
 * 由调用方（设置页）在切换后统一清理并重启到登录页，职责不混在这里。
 * @returns {string} 切换后的 base
 */
function switchTo(key, lanBase) {
  throw new Error('当前只使用在线环境')
}

/** 清除旧版本留下的覆盖缓存。 */
function reset() {
  Taro.removeStorageSync(ENV_KEY)
  Taro.removeStorageSync(LAN_BASE_KEY)
}
module.exports = {
  ENVS,
  ENV_LIST,
  ENV_VERSION,
  LAN_BASE_KEY,
  base,
  current,
  currentKey,
  defaultKey,
  isSwitchable,
  isOverridden,
  switchTo,
  reset,
}
