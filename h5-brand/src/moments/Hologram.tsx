// 镭射防伪带：会员证样张上那一条会随视角变色的膜。膜面是镭射位图（textures.ts），
// 露出的那一角跟着指针走（CSS 自定义属性 --hx / --hy 驱动 background-position，由 pointermove 写入，不触发重渲染）；
// 没有指针时位图自己很慢地平移。减少动态效果：两者都停，只留一张静止的镭射面。
// 位图还没落地时退回平印铂色，不画假镭射。
// 服务端渲染安全：模块顶层不碰 window / document。
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { prefersReducedMotion } from '../app/env';
import { textureVars } from './textures';
import './hologram.css';

const TEX = textureVars(['holo']);
const HAS_HOLO = '--tex-holo' in TEX;

interface Props {
  /** 膜上的缩微字，例「防伪样张」 */
  laser: string;
  /** 缩微字里夹带的拉丁串，例品牌拉丁名 */
  latin?: string;
  /** 指针感应的范围：默认只在镭射带上；传入外层元素可让整张卡都带动光斑 */
  field?: { current: HTMLElement | null };
  children?: ComponentChildren;
}

export function Hologram({ laser, latin, field, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const band = ref.current;
    const area = field?.current ?? band;
    if (!band || !area || prefersReducedMotion()) return;
    let raf = 0;
    let nx = 0.5;
    let ny = 0.5;
    const paint = () => {
      raf = 0;
      band.style.setProperty('--hx', nx.toFixed(3));
      band.style.setProperty('--hy', ny.toFixed(3));
    };
    const onMove = (e: PointerEvent) => {
      const r = area.getBoundingClientRect();
      if (!r.width || !r.height) return;
      nx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      ny = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
      band.classList.add('is-live');
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const onLeave = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      band.classList.remove('is-live');
      band.style.removeProperty('--hx');
      band.style.removeProperty('--hy');
    };
    area.addEventListener('pointermove', onMove);
    area.addEventListener('pointerdown', onMove);
    area.addEventListener('pointerleave', onLeave);
    area.addEventListener('pointercancel', onLeave);
    return () => {
      onLeave();
      area.removeEventListener('pointermove', onMove);
      area.removeEventListener('pointerdown', onMove);
      area.removeEventListener('pointerleave', onLeave);
      area.removeEventListener('pointercancel', onLeave);
    };
  }, [field]);

  const run = [laser, latin, laser, latin, laser].filter(Boolean).join(' · ');
  return (
    <div class={['holo', HAS_HOLO && 'has-tex'].filter(Boolean).join(' ')} ref={ref} style={TEX}>
      <div class="holo__micro" aria-hidden="true">
        <span>{run}</span>
        <span>{run}</span>
      </div>
      <div class="holo__shimmer" aria-hidden="true" />
      {children}
    </div>
  );
}
