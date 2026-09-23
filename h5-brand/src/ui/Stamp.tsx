// 印记：状态是印上去的，不是浮层提示。每一枚都是正式标记。
export type StampKind = '样' | '样张' | '拟定' | '已存到本机' | '示意';

const LABEL: Record<StampKind, string> = {
  样: '样例数据',
  样张: '演示样张，非真实账户',
  拟定: '拟定信息，以主办方公布为准',
  已存到本机: '已存到本机',
  示意: '示意图像',
};

interface Props {
  kind: StampKind;
  class?: string;
}

export function Stamp({ kind, class: cls }: Props) {
  const mod = { 样: 'sample', 样张: 'sheet', 拟定: 'proposed', 已存到本机: 'saved', 示意: 'illus' }[kind];
  return (
    <span class={['stamp', `stamp--${mod}`, cls].filter(Boolean).join(' ')} title={LABEL[kind]}>
      <span aria-hidden="true">{kind}</span>
      <span class="sr-only">{`（${LABEL[kind]}）`}</span>
    </span>
  );
}

/** 页面级「样张」章：每条路由都必须出现一次 */
export function SheetStamp({ class: cls }: { class?: string }) {
  return <Stamp kind="样张" class={['stamp--route', cls].filter(Boolean).join(' ')} />;
}
