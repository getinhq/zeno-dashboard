import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';

const FALLBACK_DCC = [
  { id: 'blender', label: 'Blender' },
  { id: 'maya', label: 'Maya' },
  { id: 'nuke', label: 'Nuke' },
];

const STORAGE_KEY = 'zeno_last_dcc_selection';

/**
 * Mint a launch token and open zeno:// — requires Zeno Bridge installed for the OS handler.
 * DCC list comes from Settings → Application settings (dcc_applications) when configured.
 */
export function OpenInDcc({
  projectId,
  projectCode,
  assetId,
  intent = 'open_asset',
  className = '',
}) {
  const { data: globalDoc } = useQuery({
    queryKey: ['settings', 'global', 'development'],
    queryFn: () => api.get('/settings/global?env=development'),
    staleTime: 60_000,
  });

  const apps = useMemo(() => {
    const raw = globalDoc?.extra?.dcc_applications;
    if (!Array.isArray(raw) || raw.length === 0) return [];
    return raw.filter((r) => r && String(r.path || '').trim() && String(r.label || '').trim());
  }, [globalDoc]);

  const options = useMemo(() => {
    if (apps.length === 0) {
      return FALLBACK_DCC.map((o) => ({ kind: o.id, label: o.label, key: o.id }));
    }
    return apps.map((a, i) => ({
      kind: String(a.dcc_kind || a.dcc || 'blender').toLowerCase(),
      label: String(a.label),
      key: `${a.dcc_kind || 'blender'}:${a.label}:${i}`,
    }));
  }, [apps]);

  const [selectionKey, setSelectionKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (options.length === 0) return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && options.some((o) => o.key === saved)) {
      setSelectionKey(saved);
      return;
    }
    setSelectionKey(options[0].key);
  }, [options]);

  const effectiveKey = useMemo(() => {
    if (options.some((o) => o.key === selectionKey)) return selectionKey;
    return options[0]?.key || '';
  }, [options, selectionKey]);

  const mintKey = import.meta.env.VITE_ZENO_LAUNCH_MINT_KEY;

  const headers = useMemo(() => {
    const h = {};
    if (mintKey) h['X-Zeno-Launch-Mint-Key'] = mintKey;
    return h;
  }, [mintKey]);

  const open = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();
      setMsg(null);
      setBusy(true);
      const opt = options.find((o) => o.key === effectiveKey) || options[0];
      if (!opt) {
        setMsg('Configure DCC applications in Settings, or use the default list.');
        setBusy(false);
        return;
      }
      localStorage.setItem(STORAGE_KEY, opt.key);

      const fromSettings = apps.find(
        (a, i) =>
          `${String(a.dcc_kind || 'blender')}:${String(a.label)}:${i}` === opt.key,
      );

      const body = {
        context: {
          version: '1',
          intent,
          project_id: projectId,
          project_code: projectCode || undefined,
          asset_id: assetId || undefined,
          representation: 'blend',
          dcc: opt.kind,
          ...(fromSettings ? { dcc_label: fromSettings.label } : {}),
        },
      };
      try {
        const res = await api.post('/api/v1/launch-tokens', body, { headers });
        const token = res.token;
        const url = `zeno://launch?token=${encodeURIComponent(token)}`;
        window.location.href = url;
        setMsg(
          'If the DCC did not open, install Zeno Bridge and register the zeno:// handler. Rebuild the API image if launch returns 404.',
        );
      } catch (err) {
        setMsg(String(err.message || err));
      } finally {
        setBusy(false);
      }
    },
    [apps, assetId, effectiveKey, headers, intent, options, projectCode, projectId],
  );

  return (
    <div
      className={`flex flex-col gap-1 ${className}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <label className="text-xs text-muted flex items-center gap-1">
          DCC
          <select
            value={effectiveKey}
            onChange={(e) => setSelectionKey(e.target.value)}
            className="bg-card-hover border border-border text-foreground text-xs rounded px-2 py-1 max-w-[220px]"
          >
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {apps.length ? o.label : `${o.label} (${o.kind})`}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy || options.length === 0}
          className="btn-secondary text-xs px-2 py-1"
          onClick={open}
        >
          {busy ? '…' : 'Open in DCC'}
        </button>
      </div>
      {apps.length === 0 && (
        <p className="text-xs text-muted">
          Add paths under Settings → Application settings (DCC) for named versions; otherwise generic kinds are used.
        </p>
      )}
      {msg && <p className="text-xs text-amber-600/90 dark:text-amber-400/90">{msg}</p>}
    </div>
  );
}
