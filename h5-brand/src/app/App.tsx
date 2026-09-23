// 应用外壳：路由 → 屏幕；底栏只在根页面出现；压栈页面在非微信环境自绘返回栏
import type { ComponentType } from 'preact';
import { useLayoutEffect } from 'preact/hooks';
import { brandFullName } from '../brand';
import { useRoute, restoreScroll, type Route, type RouteName } from './router';
import { isWeChat } from './env';
import { TabBar } from './TabBar';
import { BackBar } from './BackBar';
import Home from '../screens/Home';
import CourseDetail from '../screens/CourseDetail';
import Plans from '../screens/Plans';
import Benefits from '../screens/Benefits';
import JoinGuide from '../screens/JoinGuide';
import Card from '../screens/Card';
import Me from '../screens/Me';

export interface ScreenProps {
  route: Route;
}

// 路由名 → 屏幕组件。新增路由：router.ts 的 ROUTES 加一行 + 这里注册
const SCREENS: Record<RouteName, ComponentType<ScreenProps>> = {
  home: Home,
  plans: Plans,
  card: Card,
  me: Me,
  course: CourseDetail,
  benefits: Benefits,
  join: JoinGuide,
};

export function titleOf(route: Route): string {
  return route.def.name === 'home' ? `${brandFullName} · 本期` : `${route.def.title} · ${brandFullName}`;
}

export function App({ initialPath }: { initialPath?: string }) {
  const route = useRoute(initialPath);
  const Screen = SCREENS[route.def.name];
  const isTab = route.def.kind === 'tab';
  const selfBack = !isTab && !isWeChat();

  useLayoutEffect(() => {
    document.title = titleOf(route);
    restoreScroll(route);
  }, [route.key]);

  return (
    <div class={['app', isTab ? 'app--tab' : 'app--push', selfBack && 'app--backbar'].filter(Boolean).join(' ')}>
      <a class="skip" href="#main">
        跳到正文
      </a>
      {selfBack && <BackBar title={route.def.title} />}
      <Screen key={route.key} route={route} />
      {isTab && <TabBar active={route.def.name} />}
    </div>
  );
}
