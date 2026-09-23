// 签名时刻用的补间：指数缓出、无回弹。rAF 驱动；后台标签页里 rAF 会停，
// 所以另挂一个定时器兜底，保证终态一定落地（否则撕到一半切走再回来，会停在半撕状态）。

/** 指数缓出：起步快、收尾稳，永不越过终点 */
export function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/** 从 from 补到 to，每帧回调缓出后的值；返回取消函数（取消时不落终态） */
export function tween(
  from: number,
  to: number,
  ms: number,
  onStep: (v: number) => void,
  onDone?: () => void,
  ease: (t: number) => number = easeOutExpo,
): () => void {
  let raf = 0;
  let over = false;
  const t0 = performance.now();
  const stop = () => {
    over = true;
    cancelAnimationFrame(raf);
    window.clearTimeout(timer);
  };
  const finish = () => {
    if (over) return;
    stop();
    onStep(to);
    onDone?.();
  };
  const frame = (now: number) => {
    if (over) return;
    const t = Math.min(1, (now - t0) / ms);
    if (t >= 1) return finish();
    onStep(from + (to - from) * ease(t));
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  const timer = window.setTimeout(finish, ms + 150);
  return stop;
}
