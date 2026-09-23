// 签名时刻的会话级记忆：小样撕没撕、日历存没存。只进 sessionStorage，只存「发生过」这一位。
// 键一律带 MOMENT_STORAGE_PREFIX 前缀，「我的 → 重置演示」调 clearMomentState() 一把清掉。
// 存储不可用（隐私模式 / 被禁 / 服务端渲染）时读作「没发生过」，写入静默放弃——只是不跨刷新记忆。

// 与 app/env.ts、路由的键同一前缀：「我的 → 重置演示」按这一个前缀就能清干净（两个前缀并存时重置会漏掉小样且不报错）
export const MOMENT_STORAGE_PREFIX = 'brand-h5:';

export const SACHET_KEYS = {
  /** 小样已撕开 */
  torn: `${MOMENT_STORAGE_PREFIX}sachet:torn`,
  /** 已生成并交出 .ics 文件 */
  saved: `${MOMENT_STORAGE_PREFIX}sachet:saved`,
  /** 本会话已演示过一次「易撕口」提示 */
  nudged: `${MOMENT_STORAGE_PREFIX}sachet:nudged`,
} as const;

function store(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function readFlag(key: string): boolean {
  try {
    return store()?.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function writeFlag(key: string, on: boolean): void {
  try {
    const s = store();
    if (!s) return;
    if (on) s.setItem(key, '1');
    else s.removeItem(key);
  } catch {
    /* 存储被禁：本次会话内照常，刷新后回到封口 */
  }
}

/** 清掉本前缀下的全部键；返回清掉的条数 */
export function clearMomentState(): number {
  const s = store();
  if (!s) return 0;
  try {
    const keys: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && k.startsWith(MOMENT_STORAGE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => s.removeItem(k));
    return keys.length;
  } catch {
    return 0;
  }
}
