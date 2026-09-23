// 运行环境探测：只在浏览器里有意义，服务端渲染时一律取保守值

/** 微信内置浏览器：自带返回与标题栏，页面不再自绘返回栏 */
export function isWeChat(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /MicroMessenger/i.test(navigator.userAgent);
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 本会话是否第一次看到某个仪式；存储不可用时当作第一次 */
export function firstTimeThisSession(key: string): boolean {
  try {
    const k = `brand-h5:seen:${key}`;
    if (sessionStorage.getItem(k)) return false;
    sessionStorage.setItem(k, '1');
    return true;
  } catch {
    return true;
  }
}
