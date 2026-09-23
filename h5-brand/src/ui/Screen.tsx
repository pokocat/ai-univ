// 屏幕外框：每条路由的根节点。默认在右上角印「样张」章。
import type { ComponentChildren } from 'preact';
import { SheetStamp } from './Stamp';

interface Props {
  /** 路由名，落在 data-screen 上，方便样式与检查 */
  name: string;
  /** 首屏是黛蓝盒面还是珠光白面板 */
  surface?: 'carton' | 'pearl';
  /** 已在页面内容里自行印了样张章时置 false */
  stamp?: boolean;
  children: ComponentChildren;
}

export function Screen({ name, surface = 'pearl', stamp = true, children }: Props) {
  return (
    <main class={['screen', `screen--${surface}`, `on-${surface}`].join(' ')} data-screen={name} id="main">
      {stamp && <SheetStamp class="screen__stamp" />}
      {children}
    </main>
  );
}

/** 占位屏（第二阶段替换）：刻意保持极简，不做设计 */
export function Placeholder({ name, title }: { name: string; title: string }) {
  return (
    <Screen name={name}>
      <div class="placeholder">
        <h1 class="placeholder__title">{title}</h1>
        <p class="placeholder__hint">本屏在下一版补齐，先回「本期」看本期所含。</p>
      </div>
    </Screen>
  );
}
