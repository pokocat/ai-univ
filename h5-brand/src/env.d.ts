/// <reference types="vite/client" />

declare const __BRAND_ID__: string;

// 品牌虚拟模块：类型在 src/brand/index.ts 里收窄（环境模块声明里不能用相对路径引类型）
declare module 'virtual:brand' {
  export const identity: unknown;
  export const h5: unknown;
}

declare module 'virtual:brand-tokens.css';
