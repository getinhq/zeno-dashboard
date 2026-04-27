import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

export function ThemedSelect({
  value,
  onChange,
  options,
  placeholder = 'Select',
  className = '',
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const [menuStyle, setMenuStyle] = useState(null);

  useEffect(() => {
    if (!open || !ref.current) return;

    const updatePosition = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const openUp = spaceBelow < 280 && rect.top > 280;
      const maxHeight = Math.max(160, Math.min(320, openUp ? rect.top - 8 : spaceBelow - 8));

      setMenuStyle({
        position: 'fixed',
        left: rect.left,
        top: openUp ? undefined : rect.bottom + 4,
        bottom: openUp ? viewportHeight - rect.top + 4 : undefined,
        width: rect.width,
        maxHeight,
        zIndex: 120,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const selected = useMemo(
    () => options.find((o) => String(o.value) === String(value)) || null,
    [options, value],
  );

  /* font-mono: portaled menu is under document.body, outside .dashboard-app Space Mono scope */
  return (
    <div className={`relative font-mono ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={`appearance-none bg-card-hover border border-border text-foreground px-4 py-1.5 pr-8 rounded-md text-sm font-medium font-mono focus:outline-none focus:border-primary transition-colors cursor-pointer min-w-[120px] w-full text-left ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <span className={selected ? '' : 'text-muted'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
      </button>
      {open && !disabled && menuStyle && createPortal(
        <div
          style={menuStyle}
          className="themed-select-menu rounded-md border border-border bg-card shadow-xl overflow-y-auto overflow-x-hidden overscroll-contain font-mono text-sm"
        >
          {options.length === 0 ? (
            <div className="px-3 py-2 text-muted text-sm font-mono">No options</div>
          ) : (
            options.map((o) => (
              <button
                key={String(o.value)}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`block w-full px-3 py-2 text-left text-sm font-mono hover:bg-card-hover transition-colors ${String(o.value) === String(value) ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
              >
                {o.label}
              </button>
            ))
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
