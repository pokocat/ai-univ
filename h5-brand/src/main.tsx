import { render } from 'preact';
import 'virtual:brand-tokens.css';
import './styles/fonts.css';
import './styles/base.css';
import './styles/world.css';
import './ui/ui.css';
import './app/shell.css';
import { App } from './app/App';
import { isWeChat, prefersReducedMotion } from './app/env';

const html = document.documentElement;
if (isWeChat()) html.classList.add('is-wechat');
if (prefersReducedMotion()) html.classList.add('is-reduced');

render(<App />, document.getElementById('app')!);
