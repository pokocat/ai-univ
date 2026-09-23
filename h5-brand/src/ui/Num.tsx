// 数字一律等宽制表列；样例数字强制带「样」印
import { Stamp } from './Stamp';

interface Props {
  value: string | number;
  /** 样例数字：不是来自品牌包的真实事实时必须为 true */
  sample: boolean;
  /** 位数补齐，例 pad=2 → 06 */
  pad?: number;
  class?: string;
}

export function Num({ value, sample, pad, class: cls }: Props) {
  const text = typeof value === 'number' && pad ? String(value).padStart(pad, '0') : String(value);
  return (
    <span class={['num-wrap', cls].filter(Boolean).join(' ')}>
      <span class="num">{text}</span>
      {sample && <Stamp kind="样" />}
    </span>
  );
}
