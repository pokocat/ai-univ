// 哈希路由 + 页面栈：文档滚动，逐条历史记录恢复滚动位置。
// 前进（push）一律回到顶部；后退（pop）回到离开时的位置。
import { useEffect, useState } from 'preact/hooks';

export type RouteName = 'home' | 'plans' | 'card' | 'me' | 'course' | 'benefits' | 'join';

export interface RouteDef {
  name: RouteName;
  pattern: string;
  /** 路由标题：进 document.title 与返回栏 */
  title: string;
  /** 底栏入口（根页面）还是压栈页面 */
  kind: 'tab' | 'push';
}

// 新增路由：在这里加一行，再到 App.tsx 的 SCREENS 注册同名组件
export const ROUTES: RouteDef[] = [
  { name: 'home', pattern: '/', title: '本期', kind: 'tab' },
  { name: 'plans', pattern: '/plans', title: '会员方案', kind: 'tab' },
  { name: 'card', pattern: '/card', title: '会员证样张', kind: 'tab' },
  { name: 'me', pattern: '/me', title: '我的', kind: 'tab' },
  { name: 'course', pattern: '/course/:id', title: '课程详情', kind: 'push' },
  { name: 'benefits', pattern: '/benefits', title: '权益', kind: 'push' },
  { name: 'join', pattern: '/join', title: '入群说明', kind: 'push' },
];

export interface Route {
  def: RouteDef;
  params: Record<string, string>;
  path: string;
  /** 本条历史记录的键：滚动位置按它存 */
  key: string;
  /** 距入口的压栈深度；0 表示没有可退回的本站页面 */
  depth: number;
  /** 这次到达的方式 */
  via: 'init' | 'push' | 'pop' | 'replace';
}

function match(path: string): { def: RouteDef; params: Record<string, string> } | null {
  for (const def of ROUTES) {
    const ps = def.pattern.split('/').filter(Boolean);
    const xs = path.split('/').filter(Boolean);
    if (ps.length !== xs.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < ps.length; i++) {
      if (ps[i].startsWith(':')) params[ps[i].slice(1)] = decodeURIComponent(xs[i]);
      else if (ps[i] !== xs[i]) ok = false;
    }
    if (ok) return { def, params };
  }
  return null;
}

export function resolve(path: string, extra: Partial<Route> = {}): Route {
  const clean = path.split('?')[0] || '/';
  const hit = match(clean);
  const m = hit ?? match('/')!;
  return {
    def: m.def,
    params: m.params,
    path: hit ? clean : '/',
    key: extra.key ?? 'k0',
    depth: extra.depth ?? 0,
    via: extra.via ?? 'init',
  };
}

export function hrefOf(path: string): string {
  return '#' + path;
}

// —— 以下只在浏览器里运行 ——

type Entry = { key: string; depth: number };
type Listener = (r: Route) => void;

const listeners = new Set<Listener>();
const scrollMemo = new Map<string, number>();
const MEMO_KEY = 'brand-h5:scroll';
let current: Route | null = null;
let seq = 0;

function currentPath(): string {
  const h = location.hash.replace(/^#/, '');
  return h.startsWith('/') ? h : '/';
}

function newKey(): string {
  seq += 1;
  return `k${Date.now().toString(36)}${seq}`;
}

function loadMemo() {
  try {
    const raw = sessionStorage.getItem(MEMO_KEY);
    if (raw) for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, number>)) scrollMemo.set(k, v);
  } catch {
    /* 隐私模式或存储被禁：只是不跨刷新记位置 */
  }
}

function saveMemo() {
  try {
    sessionStorage.setItem(MEMO_KEY, JSON.stringify(Object.fromEntries(scrollMemo)));
  } catch {
    /* 同上 */
  }
}

function emit(r: Route) {
  current = r;
  listeners.forEach((fn) => fn(r));
}

function rememberScroll() {
  if (current) scrollMemo.set(current.key, window.scrollY);
}

let started = false;
function start() {
  if (started || typeof window === 'undefined') return;
  started = true;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  loadMemo();
  const st = history.state as Entry | null;
  const entry: Entry = st && st.key ? st : { key: newKey(), depth: 0 };
  history.replaceState(entry, '', location.href);
  current = resolve(currentPath(), { ...entry, via: 'init' });

  let ticking = false;
  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        rememberScroll();
      });
    },
    { passive: true },
  );
  window.addEventListener('pagehide', () => {
    rememberScroll();
    saveMemo();
  });
  // 浏览器后退/前进、微信返回键、手改地址栏都走这里
  window.addEventListener('popstate', (e) => {
    let entry = e.state as Entry | null;
    if (!entry || !entry.key) {
      entry = { key: newKey(), depth: (current?.depth ?? 0) + 1 };
      history.replaceState(entry, '', location.href);
    }
    emit(resolve(currentPath(), { ...entry, via: 'pop' }));
  });
}

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  start();
  rememberScroll();
  const url = location.pathname + location.search + hrefOf(path);
  if (opts.replace) {
    const entry: Entry = { key: newKey(), depth: current?.depth ?? 0 };
    history.replaceState(entry, '', url);
    emit(resolve(path, { ...entry, via: 'replace' }));
  } else {
    const entry: Entry = { key: newKey(), depth: (current?.depth ?? 0) + 1 };
    history.pushState(entry, '', url);
    emit(resolve(path, { ...entry, via: 'push' }));
  }
}

/** 返回：本站有上一页就退回去，否则（深链直达）替换成首页 */
export function back() {
  if (current && current.depth > 0) history.back();
  else navigate('/', { replace: true });
}

/** 渲染完成后调用：push 回顶部，pop 恢复位置 */
export function restoreScroll(r: Route) {
  const y = r.via === 'pop' || r.via === 'init' ? scrollMemo.get(r.key) ?? 0 : 0;
  window.scrollTo(0, y);
}

export function useRoute(initialPath?: string): Route {
  const [route, setRoute] = useState<Route>(() => {
    if (typeof window === 'undefined') return resolve(initialPath ?? '/');
    start();
    return current!;
  });
  useEffect(() => {
    const fn: Listener = (r) => setRoute(r);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return route;
}

/** 站内链接点击：拦下默认跳转，走 push，保持页面栈与滚动记忆一致 */
export function onLinkClick(e: MouseEvent, path: string) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  navigate(path);
}
