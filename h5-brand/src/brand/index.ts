// 品牌层唯一入口：屏幕与组件从这里取品牌身份与事实，不直接读 JSON
import * as raw from 'virtual:brand';
import type { BrandFact, BrandIdentity, BrandRuntime } from './types';

// 构建期 scripts/brand.mjs 已校验过形状，这里只收窄类型
export const identity = raw.identity as BrandIdentity;
export const h5 = raw.h5 as BrandRuntime;
export type * from './types';

/** 带「暂定」注记的完整品牌名，例：丽人公社（暂定） */
export const brandFullName = `${identity.name}（${identity.nameNote}）`;

/** 按 key 取一条品牌事实；取不到直接抛错，避免界面静默少一行 */
export function fact(key: string): BrandFact {
  const f = h5.facts.find((x) => x.key === key);
  if (!f) throw new Error(`品牌包缺事实：${key}`);
  return f;
}

export function facts(prefix = ''): BrandFact[] {
  return h5.facts.filter((f) => f.key.startsWith(prefix));
}
