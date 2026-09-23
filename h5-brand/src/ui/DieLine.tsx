// 刀版语言：折线与裁切角标就是网格本身，不是装饰。
import type { ComponentChildren } from 'preact';

interface DieLineProps {
  /** fold = 折线（虚线），cut = 裁切线（实线） */
  kind?: 'fold' | 'cut';
  /** 折线两端是否带角标刻度 */
  ticks?: boolean;
  class?: string;
}

/** 横贯的折线或裁切线；颜色随所在面（盒面铂色 / 面板铂灰） */
export function DieLine({ kind = 'fold', ticks = false, class: cls }: DieLineProps) {
  return (
    <div
      class={['dieline', `dieline--${kind}`, ticks && 'dieline--ticks', cls].filter(Boolean).join(' ')}
      role="presentation"
      aria-hidden="true"
    />
  );
}

interface CropProps {
  /** 角标离开被框元素边缘的距离（px） */
  offset?: number;
  /** 角标臂长（px） */
  size?: number;
}

/** 四角裁切标：放进一个 position:relative 的容器里，自动落在四角外侧 */
export function CropMarks({ offset = 6, size = 12 }: CropProps) {
  const style = { '--crop-o': `${offset}px`, '--crop-s': `${size}px` } as Record<string, string>;
  return (
    <span class="crops" style={style} aria-hidden="true">
      <i class="crop crop--tl" />
      <i class="crop crop--tr" />
      <i class="crop crop--bl" />
      <i class="crop crop--br" />
    </span>
  );
}

/** 带角标的刀版框：内容区即一块「面」 */
export function DieFrame({ children, class: cls, offset, size }: CropProps & { children: ComponentChildren; class?: string }) {
  return (
    <div class={['dieframe', cls].filter(Boolean).join(' ')}>
      <CropMarks offset={offset} size={size} />
      {children}
    </div>
  );
}
