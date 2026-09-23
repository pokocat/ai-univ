// 面板：盒子的各个面。正面 / 背面 / 底面印在黛蓝盒面上，侧板是珠光白。
import type { ComponentChildren } from 'preact';
import { DieLine } from './DieLine';

export type Face = 'front' | 'side' | 'back' | 'bottom';

interface Props {
  face: Face;
  /** 面上印的栏目名（中文），例：本期所含 */
  title?: string;
  /** 与栏目名同行的拉丁大写注记，例：INGREDIENTS */
  latin?: string;
  id?: string;
  /** 面与上一面之间的折线 */
  foldTop?: boolean;
  class?: string;
  children: ComponentChildren;
}

const SURFACE: Record<Face, 'carton' | 'pearl'> = { front: 'carton', back: 'carton', bottom: 'carton', side: 'pearl' };

export function Panel({ face, title, latin, id, foldTop = true, class: cls, children }: Props) {
  const surface = SURFACE[face];
  return (
    <section
      id={id}
      class={['panel', `panel--${face}`, `on-${surface}`, cls].filter(Boolean).join(' ')}
      aria-label={title}
    >
      {foldTop && <DieLine kind="fold" ticks class="panel__fold" />}
      {title && <PanelHead title={title} latin={latin} />}
      {children}
    </section>
  );
}

/** 面板栏目头：栏目名 + 拉丁注记，下接双线（粗墨线 + 细线） */
export function PanelHead({ title, latin, as: Tag = 'h2' }: { title: string; latin?: string; as?: 'h1' | 'h2' | 'h3' }) {
  return (
    <header class="panel-head">
      <Tag class="panel-head__title">{title}</Tag>
      {latin && (
        <span class="panel-head__latin caps" aria-hidden="true">
          {latin}
        </span>
      )}
    </header>
  );
}
