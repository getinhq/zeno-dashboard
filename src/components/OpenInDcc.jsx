import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { ThemedSelect } from './ThemedSelect';
import { launchWithContext, mintHeaders, normalizeDccOptions } from '../lib/dccLaunch';

const STORAGE_KEY = 'zeno_last_dcc_selection';

/**
 * Mint a launch token and open zeno:// — requires Zeno Bridge installed for the OS handler.
 * DCC list comes from Settings → Application settings (dcc_applications) when configured.
 */
export function OpenInDcc({
  projectId,
  projectCode,
  assetId,
  shotId,
  stage,
  intent = 'open_asset',
  className = '',
}) {
  const { data: globalDoc } = useQuery({
    queryKey: ['settings', 'global', 'development'],
    queryFn: () => api.get('/api/v1/settings/global?env=development'),
    staleTime: 60_000,
  });
  const { data: projectSettings } = useQuery({
    queryKey: ['settings', 'project', projectId],
    queryFn: () => api.get(`/api/v1/settings/project/${projectId}`),
    enabled: !!projectId,
    retry: false,
    staleTime: 60_000,
  });

  const apps = useMemo(() => {
    const raw = globalDoc?.extra?.dcc_applications;
    if (!Array.isArray(raw) || raw.length === 0) return [];
    return raw.filter((r) => r && String(r.path || '').trim() && String(r.label || '').trim());
  }, [globalDoc]);

  const options = useMemo(() => {
    return normalizeDccOptions(apps);
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

  const headers = useMemo(() => mintHeaders(), []);

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
      // The project can pin a specific DCC per stage. The mapping value is
      // either a label ("Blender 4.2" — matched against configured apps) or a
      // legacy bare kind ("maya"). Labels win so different stages can target
      // different versions of the same DCC.
      const stageMapping = projectSettings?.extra?.stage_dcc_mapping || {};
      const mapped = stage ? stageMapping[stage] : null;
      const mappedApp = mapped
        ? apps.find((a) => String(a.label || '').trim() === String(mapped).trim())
        : null;
      const finalKind = mappedApp
        ? String(mappedApp.dcc_kind || mappedApp.dcc || opt.kind).toLowerCase()
        : mapped || opt.kind;
      const finalLabel = mappedApp
        ? String(mappedApp.label)
        : fromSettings
          ? fromSettings.label
          : null;

      const body = {
        version: '1',
        intent,
        project_id: projectId,
        project_code: projectCode || undefined,
        asset_id: assetId || undefined,
        shot_id: shotId || undefined,
        stage: stage || undefined,
        representation: 'blend',
        dcc: finalKind,
        ...(finalLabel ? { dcc_label: finalLabel } : {}),
      };
      try {
        const { launched } = await launchWithContext({ context: body, headers });
        setMsg(launched ? 'Launch request sent to local bridge daemon.' : 'Launch request sent to Zeno Bridge.');
      } catch (err) {
        setMsg(String(err.message || err));
      } finally {
        setBusy(false);
      }
    },
    [apps, assetId, effectiveKey, headers, intent, options, projectCode, projectId, projectSettings, shotId, stage],
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
          <ThemedSelect
            value={effectiveKey}
            onChange={setSelectionKey}
            className="max-w-[220px] min-w-[180px]"
            options={options.map((o) => ({
              value: o.key,
              label: apps.length ? o.label : `${o.label} (${o.kind})`,
            }))}
          />
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
