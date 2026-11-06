import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface MenuItem {
  label: string;
  hint?: string; // 오른쪽에 작게 (안 되는 이유 등)
  icon?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect(): void;
}

/** 오른쪽 클릭 메뉴: 누른 자리에 띄우고 화면 밖으로 나가지 않게 한다. 바깥 클릭·Esc·창 크기 변경으로 닫는다 */
export function ContextMenu({ x, y, label, items, onClose }: { x: number; y: number; label: string; items: MenuItem[]; onClose(): void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 800;
    setPos({ left: Math.max(8, Math.min(x, vw - r.width - 8)), top: Math.max(8, Math.min(y, vh - r.height - 8)) });
    el.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [x, y]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="context-menu" role="menu" aria-label={label} style={pos} onContextMenu={(e) => e.preventDefault()}>
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          role="menuitem"
          className={`context-menu__item${it.danger ? ' context-menu__item--danger' : ''}`}
          disabled={it.disabled}
          onClick={() => {
            onClose();
            it.onSelect();
          }}
        >
          <span className="context-menu__icon" aria-hidden="true">
            {it.icon}
          </span>
          <span className="context-menu__label">{it.label}</span>
          {it.hint && <span className="context-menu__hint">{it.hint}</span>}
        </button>
      ))}
    </div>
  );
}
