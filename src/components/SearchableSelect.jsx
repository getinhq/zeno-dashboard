import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X } from 'lucide-react';

/**
 * Dropdown with an in-menu search box and optional grouped sections.
 *
 * Pass either ``options`` (flat list) or ``sections`` (grouped). Grouped is
 * handy for filters like "Me / Unassigned / <big list of users>" where we want
 * quick picks kept separate from a scrollable search result.
 *
 * Each section is ``{ id, label?, options, filterable? }``. Set
 * ``filterable: false`` to pin a section (e.g. quick-picks) above the search.
 */
export function SearchableSelect({
  value,
  onChange,
  options,
  sections,
  placeholder = 'Select',
  searchPlaceholder = 'Search…',
  emptyMessage = 'No matches',
  className = '',
  disabled = false,
  allowClear = false,
}) {
  const resolvedSections = useMemo(() => {
    if (Array.isArray(sections) && sections.length) return sections;
    return [
      {
        id: '__flat',
        label: '',
        options: Array.isArray(options) ? options : [],
        filterable: true,
      },
    ];
  }, [options, sections]);

  const allOptions = useMemo(() => {
    const out = [];
    for (const sec of resolvedSections) {
      for (const o of sec.options || []) out.push(o);
    }
    return out;
  }, [resolvedSections]);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  const searchRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState(null);

  useEffect(() => {
    if (!open || !ref.current) return;

    const updatePosition = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const viewportHeight =
        window.innerHeight || document.documentElement.clientHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const openUp = spaceBelow < 320 && rect.top > 320;
      const maxHeight = Math.max(
        220,
        Math.min(380, openUp ? rect.top - 8 : spaceBelow - 8),
      );
      setMenuStyle({
        position: 'fixed',
        left: rect.left,
        top: openUp ? undefined : rect.bottom + 4,
        bottom: openUp ? viewportHeight - rect.top + 4 : undefined,
        width: Math.max(rect.width, 260),
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
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  useEffect(() => {
    if (open) {
      // Focus the search box a tick after render so the portal is attached.
      const id = window.setTimeout(() => searchRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [open]);

  const selected = useMemo(
    () => allOptions.find((o) => String(o.value) === String(value)) || null,
    [allOptions, value],
  );

  const q = query.trim().toLowerCase();
  const filteredSections = useMemo(() => {
    // Until the user actually types, hide the (potentially huge) searchable
    // lists and only render pinned "quick pick" sections. Studios routinely
    // have hundreds of users/entities so we avoid scrolling walls of names.
    if (!q) {
      return resolvedSections.filter((sec) => sec.filterable === false);
    }
    return resolvedSections
      .map((sec) => {
        if (sec.filterable === false) return sec;
        const opts = (sec.options || []).filter((o) =>
          String(o.label || '').toLowerCase().includes(q),
        );
        return { ...sec, options: opts };
      })
      .filter((sec) => (sec.options || []).length > 0);
  }, [resolvedSections, q]);

  const totalVisible = filteredSections.reduce(
    (n, s) => n + (s.options || []).length,
    0,
  );

  const handlePick = (v) => {
    onChange(v);
    setOpen(false);
    setQuery('');
  };

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
        {allowClear && selected ? (
          <span
            role="button"
            aria-label="Clear selection"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            className="absolute right-7 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        ) : null}
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
      </button>
      {open && !disabled && menuStyle && createPortal(
        <div
          style={menuStyle}
          className="themed-select-menu rounded-md border border-border bg-card shadow-xl overflow-hidden font-mono text-sm flex flex-col"
        >
          <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border bg-card/60">
            <Search className="w-3.5 h-3.5 text-muted flex-shrink-0" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-muted hover:text-foreground p-0.5"
                aria-label="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
            {totalVisible === 0 ? (
              <div className="px-3 py-3 text-muted text-sm">{emptyMessage}</div>
            ) : (
              filteredSections.map((sec) => (
                <div key={sec.id}>
                  {sec.label ? (
                    <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted bg-background/40 border-b border-border/60">
                      {sec.label}
                    </div>
                  ) : null}
                  {(sec.options || []).map((o) => (
                    <button
                      key={`${sec.id}::${String(o.value)}`}
                      type="button"
                      onClick={() => handlePick(o.value)}
                      className={`block w-full px-3 py-2 text-left text-sm font-mono hover:bg-card-hover transition-colors ${String(o.value) === String(value) ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
                    >
                      <span className="block truncate">{o.label}</span>
                      {o.sublabel && (
                        <span className="block text-[10px] text-muted truncate">
                          {o.sublabel}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

export default SearchableSelect;
