// 底栏：像盒底的四格压印。刀版虚线分格，选中格顶边压出一枚铂色插舌。
import { identity, h5 } from '../brand';
import type { TabKey } from '../brand';
import { Icon, type IconName } from '../ui/Icon';
import { hrefOf, navigate, type RouteName } from './router';

const TAB: Record<TabKey, { path: string; icon: IconName }> = {
  home: { path: '/', icon: 'carton' },
  plans: { path: '/plans', icon: 'plan' },
  card: { path: '/card', icon: 'card' },
  me: { path: '/me', icon: 'person' },
};

export function TabBar({ active }: { active: RouteName }) {
  return (
    <nav class="tabbar" aria-label="主导航">
      <ul class="tabbar__list" style={{ '--tabs': h5.modules.tabs.length } as Record<string, number>}>
        {h5.modules.tabs.map((k) => {
          const on = k === active;
          return (
            <li key={k} class="tabbar__item">
              <a
                class={['tabbar__link', on && 'is-on'].filter(Boolean).join(' ')}
                href={hrefOf(TAB[k].path)}
                aria-current={on ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  if (!on) navigate(TAB[k].path);
                  else window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                <Icon name={TAB[k].icon} size={22} />
                <span class="tabbar__label">{identity.tabLabels[k]}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
