// 手绘线性图标：统一 24 格、描边 1.5、圆头圆角。不用字符或表情顶替图标。
import type { JSX } from 'preact';

const PATHS = {
  // 底栏：包装盒 / 方案标签 / 会员证 / 我的
  carton: 'M4 7.5 12 3.5l8 4v9l-8 4-8-4v-9Z M4 7.5l8 4 8-4 M12 11.5v9',
  plan: 'M5 4.5h9.5l4.5 4.5v10.5H5z M14.5 4.5V9H19 M8.5 13h7 M8.5 16h4.5',
  card: 'M3.5 6.5h17v11h-17z M3.5 10h17 M6.5 14.5h4',
  person: 'M12 12a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z M4.75 20c.8-3.6 3.7-5.5 7.25-5.5s6.45 1.9 7.25 5.5',
  // 导航
  chevronLeft: 'M14.5 5.5 8 12l6.5 6.5',
  chevronRight: 'M9.5 5.5 16 12l-6.5 6.5',
  chevronDown: 'M5.5 9.5 12 16l6.5-6.5',
  arrowRight: 'M4.5 12h14 M13 6.5l5.5 5.5-5.5 5.5',
  close: 'M6 6l12 12 M18 6 6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  // 使用方法的四步
  select: 'M5 4.5h14v15H5z M8.5 9l1.5 1.5 3-3 M8.5 15h7',
  phone: 'M7.5 3.5h9v17h-9z M10.5 17.5h3',
  group: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M3.5 19c.6-2.9 2.8-4.5 5.5-4.5s4.9 1.6 5.5 4.5 M15.5 5.3a3 3 0 0 1 0 5.4 M17 14.8c1.8.5 3 1.9 3.5 4.2',
  book: 'M4 5.5c2.8-.9 5.5-.6 8 1 2.5-1.6 5.2-1.9 8-1v13c-2.8-.9-5.5-.6-8 1-2.5-1.6-5.2-1.9-8-1z M12 6.5v13',
  calendar: 'M4.5 6h15v14h-15z M4.5 10h15 M8.5 3.5v4 M15.5 3.5v4',
  scissors: 'M7 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M7 19.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M9 8.3 19.5 17 M9 15.7 19.5 7',
} as const;

export type IconName = keyof typeof PATHS;

interface Props extends Omit<JSX.SVGAttributes<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  /** 有语义时给 label；纯装饰不给，自动 aria-hidden */
  label?: string;
}

export function Icon({ name, size = 20, label, class: cls, ...rest }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      stroke-width={1.5}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={['icon', cls].filter(Boolean).join(' ')}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
