// 品牌层的类型：与 brands/<id>/brand.json、h5.json 对应（令牌只进 CSS，不在此列）

export type FactStatus = 'confirmed' | '拟定';

export interface BrandFact {
  key: string;
  label: string;
  value: string;
  status: FactStatus;
  source: string;
}

export type TabKey = 'home' | 'plans' | 'card' | 'me';

export interface BrandIdentity {
  id: string;
  name: string;
  nameNote: string;
  nameLatin?: string;
  audienceLabel: string;
  audienceDetail?: string;
  operator: { name: string; placeholder: boolean; note: string };
  issue: { no: string; latin: string; label: string; batch: string };
  tabLabels: Record<TabKey, string>;
  handoff: { title: string; qrPayload: string; note: string };
  demoRibbon: string;
}

export type HomeModule =
  | 'carton-front'
  | 'side-contents'
  | 'back-usage'
  | 'sample-sachet'
  | 'expo-facts'
  | 'carton-bottom';

export interface BrandImage {
  alt: string;
  credit: string;
  license: string;
}

export interface BrandRuntime {
  themeColor: string;
  facts: BrandFact[];
  modules: { tabs: TabKey[]; home: HomeModule[] };
  images: Record<string, BrandImage>;
}
