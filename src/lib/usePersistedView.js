import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Keep a `?view=…` URL param in sync with localStorage under ``storageKey`` so
 * the user's list/kanban preference survives full reloads. URL wins when
 * present (so sharing deep links still works); otherwise we rehydrate from
 * storage on mount and fall back to ``defaultView`` only when neither is set.
 *
 * Returns [view, setView]. setView always writes BOTH the URL and storage.
 */
export function usePersistedView(storageKey, defaultView = 'kanban') {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlView = searchParams.get('view');

  // On first render with no URL param, hydrate from storage.
  useEffect(() => {
    if (urlView) return;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored && stored !== defaultView) {
        setSearchParams(
          (p) => {
            p.set('view', stored);
            return p;
          },
          { replace: true },
        );
      }
    } catch {
      // localStorage can throw in private mode / SSR; ignore.
    }
    // Only run once per storageKey change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const view = urlView || defaultView;

  const setView = useCallback(
    (v) => {
      setSearchParams((p) => {
        p.set('view', v);
        return p;
      });
      try {
        window.localStorage.setItem(storageKey, v);
      } catch {
        // Ignore storage errors, URL is source of truth.
      }
    },
    [setSearchParams, storageKey],
  );

  return [view, setView];
}
