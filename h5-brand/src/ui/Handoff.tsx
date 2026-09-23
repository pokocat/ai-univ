// 「下转小程序 · 开通」：H5 不登录、不收款，交易点一律转到小程序。
// 磨砂玻璃弹层 + 纯白底二维码（样张），写明本页不收集信息。
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { identity, brandFullName } from '../brand';
import { Qr } from './Qr';
import { Stamp } from './Stamp';
import { Icon } from './Icon';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** 从哪里下转，例「会员方案 · 年度会员」；只作展示 */
  context?: string;
}

export function HandoffSheet({ open, onClose, context }: SheetProps) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<Element | null>(null);

  useEffect(() => {
    if (open) {
      lastFocus.current = document.activeElement;
      setMounted(true);
      return;
    }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), 260);
    (lastFocus.current as HTMLElement | null)?.focus?.();
    return () => window.clearTimeout(t);
  }, [open]);

  // 挂载后先强制一次布局，再切到展开态，过渡才有起点（不依赖 rAF：后台标签页里 rAF 会停）
  useEffect(() => {
    if (!open || !mounted) return;
    void sheetRef.current?.getBoundingClientRect();
    const t = window.setTimeout(() => setShown(true), 16);
    return () => window.clearTimeout(t);
  }, [open, mounted]);

  useEffect(() => {
    if (!shown) return;
    sheetRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && sheetRef.current) {
        const f = sheetRef.current.querySelectorAll<HTMLElement>('button, a[href]');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const html = document.documentElement;
    html.classList.add('is-locked');
    return () => {
      document.removeEventListener('keydown', onKey);
      html.classList.remove('is-locked');
    };
  }, [shown, onClose]);

  if (!mounted) return null;
  return (
    <div class={['handoff', shown && 'is-shown'].filter(Boolean).join(' ')}>
      <div class="handoff__scrim" onClick={onClose} aria-hidden="true" />
      <div
        class="handoff__sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="handoff-title"
        tabIndex={-1}
        ref={sheetRef}
      >
        <div class="handoff__grip" aria-hidden="true" />
        <header class="handoff__head">
          <h2 id="handoff-title" class="handoff__title">
            {identity.handoff.title}
          </h2>
          <button type="button" class="handoff__close" onClick={onClose} aria-label="关闭，返回本页">
            <Icon name="close" size={20} />
          </button>
        </header>
        {context && <p class="handoff__context">{context}</p>}
        <figure class="handoff__code">
          <div class="handoff__qr">
            <Qr payload={identity.handoff.qrPayload} size={200} label={`${brandFullName}小程序码（样张）`} />
          </div>
          <figcaption>
            <Stamp kind="样" /> 小程序码样张 · 长按识别不会跳转
          </figcaption>
        </figure>
        <p class="handoff__note">{identity.handoff.note}</p>
        <button type="button" class="btn btn--quiet handoff__back" onClick={onClose}>
          返回本页
        </button>
      </div>
    </div>
  );
}

interface ButtonProps {
  children: ComponentChildren;
  /** action = 胭脂实底（每屏只许一处）；row = 整行转版行；ghost = 描边 */
  variant?: 'action' | 'row' | 'ghost';
  context?: string;
  class?: string;
}

/** 自带状态的下转按钮：点开即弹层 */
export function HandoffButton({ children, variant = 'row', context, class: cls }: ButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        class={['btn', `btn--${variant}`, cls].filter(Boolean).join(' ')}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      <HandoffSheet open={open} onClose={() => setOpen(false)} context={context} />
    </>
  );
}
