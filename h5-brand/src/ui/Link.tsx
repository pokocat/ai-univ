// 站内链接：真 <a href="#/...">，可长按、可键盘；点击走页面栈
import type { ComponentChildren, JSX } from 'preact';
import { hrefOf, onLinkClick } from '../app/router';

interface Props extends Omit<JSX.HTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'> {
  to: string;
  children: ComponentChildren;
}

export function Link({ to, children, ...rest }: Props) {
  return (
    <a href={hrefOf(to)} onClick={(e) => onLinkClick(e as unknown as MouseEvent, to)} {...rest}>
      {children}
    </a>
  );
}
