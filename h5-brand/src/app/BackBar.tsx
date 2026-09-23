// 自绘返回栏：只在微信以外的浏览器出现（微信自带返回与标题）
import { Icon } from '../ui/Icon';
import { back } from './router';

export function BackBar({ title }: { title: string }) {
  return (
    <header class="backbar">
      <button type="button" class="backbar__back" onClick={back} aria-label="返回上一页">
        <Icon name="chevronLeft" size={22} />
        <span>返回</span>
      </button>
      <p class="backbar__title">{title}</p>
    </header>
  );
}
