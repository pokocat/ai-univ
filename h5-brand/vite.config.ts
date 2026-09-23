import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
// @ts-expect-error 纯 JS 构建脚本，无类型声明
import { brandPlugin, brandId } from './scripts/brand.mjs';

const id: string = brandId();

export default defineConfig(({ isSsrBuild }) => ({
  base: './',
  plugins: [brandPlugin(), preact()],
  build: {
    outDir: isSsrBuild ? `dist-ssr/${id}` : `dist/${id}`,
    emptyOutDir: true,
    target: 'es2019',
    assetsInlineLimit: 0,
    cssCodeSplit: false,
    reportCompressedSize: true,
    modulePreload: { polyfill: false },
  },
  server: { host: '127.0.0.1' },
}));
