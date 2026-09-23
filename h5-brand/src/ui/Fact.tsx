// 品牌事实：状态为「拟定」的条目强制附免责条，没有不带免责条的渲染路径。
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { BrandFact } from '../brand';
import { Stamp } from './Stamp';

export const PROPOSED_DISCLAIMER = '标「拟定」的信息以主办方最终公布为准';

const InList = createContext(false);

export function Fact({ f }: { f: BrandFact }) {
  const inList = useContext(InList);
  const proposed = f.status === '拟定';
  return (
    <div class="fact" data-status={proposed ? 'proposed' : 'confirmed'}>
      <dt class="fact__label">{f.label}</dt>
      <dd class="fact__value">
        <span>{f.value}</span>
        {proposed && <Stamp kind="拟定" />}
      </dd>
      {proposed && !inList && <dd class="fact__disclaimer">{PROPOSED_DISCLAIMER}</dd>}
    </div>
  );
}

/** 一组事实：只要有一条拟定，列表尾部就附一条共用免责条 */
export function FactList({ items, class: cls }: { items: BrandFact[]; class?: string }) {
  const anyProposed = items.some((f) => f.status === '拟定');
  return (
    <InList.Provider value={true}>
      <dl class={['facts', cls].filter(Boolean).join(' ')}>
        {items.map((f) => (
          <Fact key={f.key} f={f} />
        ))}
      </dl>
      {anyProposed && (
        <p class="facts__disclaimer">
          <Stamp kind="拟定" /> {PROPOSED_DISCLAIMER}
        </p>
      )}
    </InList.Provider>
  );
}
