// 仅供守卫测试：在 node 里把每条路由渲染成 HTML 字符串（不进浏览器产物）
import { renderToString } from 'preact-render-to-string';
import { App } from './app/App';
import { ROUTES } from './app/router';

export function renderRoute(path: string): string {
  return renderToString(<App initialPath={path} />);
}

export const routePatterns = ROUTES.map((r) => ({ name: r.name, pattern: r.pattern, kind: r.kind }));
