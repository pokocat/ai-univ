// 成分表（INCI）：整块只用一个字号，层级只靠字重、大小写与反白。
import type { ComponentChildren } from 'preact';
import { Num } from './Num';
import { Link } from './Link';
import { Icon } from './Icon';

export interface InciItem {
  /** 中文成分名，字重 600 */
  name: string;
  /** 拉丁大写代号，例 COURSES */
  code?: string;
  /** 右侧计数 */
  count?: { value: number; sample: boolean; pad?: number };
  /** 次要说明，同字号、常规字重、弱墨 */
  note?: string;
  /** 反白标记，例「直播」：墨底反白，不换字号 */
  flag?: string;
  /** 站内跳转 */
  to?: string;
  onClick?: () => void;
}

interface ListProps {
  items: InciItem[];
  /** 列表的可读名（屏幕阅读器用） */
  label: string;
  class?: string;
}

export function InciList({ items, label, class: cls }: ListProps) {
  return (
    <ul class={['inci', cls].filter(Boolean).join(' ')} aria-label={label}>
      {items.map((it) => (
        <li class="inci__row" key={it.name + (it.code ?? '')}>
          <Row it={it} />
        </li>
      ))}
    </ul>
  );
}

function Row({ it }: { it: InciItem }) {
  const body = (
    <>
      <span class="inci__name">
        <b>{it.name}</b>
        {it.flag && <span class="inci__flag">{it.flag}</span>}
        {it.code && <span class="inci__code caps">{it.code}</span>}
        {it.note && <span class="inci__note">{it.note}</span>}
      </span>
      {it.count && <Num class="inci__count" value={it.count.value} pad={it.count.pad} sample={it.count.sample} />}
      {(it.to || it.onClick) && <Icon name="chevronRight" size={18} class="inci__go" />}
    </>
  );
  if (it.to) return <Link class="inci__hit" to={it.to}>{body}</Link>;
  if (it.onClick)
    return (
      <button type="button" class="inci__hit" onClick={it.onClick}>
        {body}
      </button>
    );
  return <div class="inci__hit inci__hit--static">{body}</div>;
}

/** 成分连写：像真包装那样的一段逗号长句，同字号，成分名加粗 */
export function InciRun({ lead, items, children }: { lead: string; items: string[]; children?: ComponentChildren }) {
  return (
    <p class="inci-run">
      <b>{lead}：</b>
      {items.map((x, i) => (
        <span key={x}>
          {x}
          {i < items.length - 1 ? '、' : '。'}
        </span>
      ))}
      {children}
    </p>
  );
}
