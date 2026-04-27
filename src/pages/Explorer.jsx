import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useProjectContext } from '../contexts/ProjectContext';
import { useAssets, useProject, useProjectShots } from '../api/hooks';
import api from '../api/client';
import { ThemedSelect } from '../components/ThemedSelect';
import { launchWithContext, mintHeaders, normalizeDccOptions } from '../lib/dccLaunch';

const ASSET_STAGES = ['modelling', 'texturing', 'rigging', 'lookdev'];
const SHOT_STAGES = ['Animatics', 'Layout', 'Animation', 'Lighting', 'Comp'];
const DEFAULTS_KEY = 'zeno_explorer_defaults';
const RECENTS_KEY = 'zeno_explorer_recents';
const AUTO_DCC = '__auto__';
const MAX_RECENTS = 8;

function readDefaults() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DEFAULTS_KEY) || '{}');
    return {
      entityType: parsed.entityType === 'shot' ? 'shot' : 'asset',
      dccKey: parsed.dccKey || AUTO_DCC,
      assetStage: ASSET_STAGES.includes(parsed.assetStage) ? parsed.assetStage : 'modelling',
      shotStage: SHOT_STAGES.includes(parsed.shotStage) ? parsed.shotStage : 'Layout',
    };
  } catch (_) {
    return { entityType: 'asset', dccKey: AUTO_DCC, assetStage: 'modelling', shotStage: 'Layout' };
  }
}

function readRecents() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

export function Explorer() {
  const { projectId } = useProjectContext();
  const { data: projectMeta } = useProject(projectId);
  const { data: assets = [] } = useAssets(projectId, {});
  const { data: shots = [] } = useProjectShots(projectId, { limit: 1000 });
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

  const initialDefaults = useMemo(() => readDefaults(), []);
  const [entityType, setEntityType] = useState(initialDefaults.entityType);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedShotId, setSelectedShotId] = useState('');
  const [assetStage, setAssetStage] = useState(initialDefaults.assetStage);
  const [shotStage, setShotStage] = useState(initialDefaults.shotStage);
  const [dccKey, setDccKey] = useState(initialDefaults.dccKey);
  const [recents, setRecents] = useState(() => readRecents());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const apps = useMemo(() => {
    const raw = globalDoc?.extra?.dcc_applications;
    if (!Array.isArray(raw) || raw.length === 0) return [];
    return raw.filter((r) => r && String(r.path || '').trim() && String(r.label || '').trim());
  }, [globalDoc]);
  const dccOptions = useMemo(() => normalizeDccOptions(apps), [apps]);

  useEffect(() => {
    if (assets.length > 0 && !selectedAssetId) setSelectedAssetId(assets[0].id);
  }, [assets, selectedAssetId]);
  useEffect(() => {
    if (shots.length > 0 && !selectedShotId) setSelectedShotId(shots[0].id);
  }, [shots, selectedShotId]);

  useEffect(() => {
    const payload = { entityType, dccKey, assetStage, shotStage };
    localStorage.setItem(DEFAULTS_KEY, JSON.stringify(payload));
  }, [entityType, dccKey, assetStage, shotStage]);

  const selectedAsset = useMemo(
    () => assets.find((a) => a.id === selectedAssetId) || null,
    [assets, selectedAssetId],
  );
  const selectedShot = useMemo(
    () => shots.find((s) => s.id === selectedShotId) || null,
    [shots, selectedShotId],
  );
  const selectedStage = entityType === 'asset' ? assetStage : shotStage;

  const resolvedDccKind = useMemo(() => {
    const stageMap = projectSettings?.extra?.stage_dcc_mapping || {};
    if (dccKey !== AUTO_DCC) {
      const selected = dccOptions.find((o) => o.key === dccKey);
      if (selected) return selected.kind;
    }
    return stageMap[selectedStage] || dccOptions[0]?.kind || 'blender';
  }, [projectSettings, dccKey, dccOptions, selectedStage]);

  const selectedLabel = useMemo(() => {
    if (entityType === 'asset') return selectedAsset ? `${selectedAsset.code} · ${selectedAsset.name}` : '';
    return selectedShot ? selectedShot.shot_code : '';
  }, [entityType, selectedAsset, selectedShot]);

  const applyRecent = (r) => {
    setEntityType(r.entityType === 'shot' ? 'shot' : 'asset');
    if (r.entityType === 'shot') {
      setSelectedShotId(r.entityId);
      if (SHOT_STAGES.includes(r.stage)) setShotStage(r.stage);
    } else {
      setSelectedAssetId(r.entityId);
      if (ASSET_STAGES.includes(r.stage)) setAssetStage(r.stage);
    }
    if (r.dccKey) setDccKey(r.dccKey);
  };

  const onLaunch = async () => {
    if (!projectId) return;
    if (entityType === 'asset' && !selectedAsset) return;
    if (entityType === 'shot' && !selectedShot) return;
    setBusy(true);
    setMsg('');
    try {
      const context = {
        version: '1',
        intent: entityType === 'asset' ? 'open_asset' : 'open_shot_stage',
        project_id: projectId,
        project_code: projectMeta?.code || undefined,
        asset_id: entityType === 'asset' ? selectedAsset.id : undefined,
        shot_id: entityType === 'shot' ? selectedShot.id : undefined,
        stage: selectedStage,
        representation: 'blend',
        dcc: resolvedDccKind,
      };
      const { launched } = await launchWithContext({ context, headers: mintHeaders() });
      setMsg(launched ? 'Launch request sent to local bridge daemon.' : 'Launch request sent to Zeno Bridge.');

      const record = {
        entityType,
        entityId: entityType === 'asset' ? selectedAsset.id : selectedShot.id,
        label: selectedLabel,
        stage: selectedStage,
        dccKey,
        ts: Date.now(),
      };
      const next = [record, ...recents.filter((r) => !(r.entityType === record.entityType && r.entityId === record.entityId))].slice(0, MAX_RECENTS);
      setRecents(next);
      localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    } catch (e) {
      setMsg(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  if (!projectId) {
    return (
      <div className="glass-panel p-8 text-center text-muted">
        Select a project to open the Explorer.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-4xl font-serif font-bold text-foreground">Explorer</h1>
        <p className="text-muted text-sm tracking-wide mt-1">Launch DCC workspaces with project, entity, stage, and application context.</p>
      </div>

      <div className="glass-panel p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted mb-1">Entity type</label>
            <ThemedSelect
              value={entityType}
              onChange={setEntityType}
              options={[
                { value: 'asset', label: 'Asset' },
                { value: 'shot', label: 'Shot' },
              ]}
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">DCC</label>
            <ThemedSelect
              value={dccKey}
              onChange={setDccKey}
              options={[
                { value: AUTO_DCC, label: `Auto (${resolvedDccKind})` },
                ...dccOptions.map((o) => ({ value: o.key, label: apps.length ? o.label : `${o.label} (${o.kind})` })),
              ]}
            />
          </div>
        </div>

        {entityType === 'asset' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Asset</label>
              <ThemedSelect
                value={selectedAssetId}
                onChange={setSelectedAssetId}
                options={assets.map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` }))}
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Stage</label>
              <ThemedSelect
                value={assetStage}
                onChange={setAssetStage}
                options={ASSET_STAGES.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Shot</label>
              <ThemedSelect
                value={selectedShotId}
                onChange={setSelectedShotId}
                options={shots.map((s) => ({ value: s.id, label: s.shot_code }))}
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Stage</label>
              <ThemedSelect
                value={shotStage}
                onChange={setShotStage}
                options={SHOT_STAGES.map((s) => ({ value: s, label: s }))}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn-primary text-sm px-4 py-2"
            disabled={busy || !selectedLabel}
            onClick={onLaunch}
          >
            {busy ? 'Launching…' : 'Launch Environment'}
          </button>
          <div className="text-xs text-muted">
            {selectedLabel ? `Selection: ${selectedLabel} · ${selectedStage} · ${resolvedDccKind}` : 'Pick an entity to launch.'}
          </div>
        </div>
        {msg ? <p className="text-xs text-amber-600/90 dark:text-amber-400/90">{msg}</p> : null}
      </div>

      <div className="glass-panel p-5 space-y-2">
        <h2 className="text-sm font-medium text-muted">Recent launches</h2>
        {recents.length === 0 ? (
          <p className="text-sm text-muted">No launches yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {recents.map((r) => (
              <button
                key={`${r.entityType}:${r.entityId}`}
                type="button"
                className="btn-secondary text-xs px-2 py-1"
                onClick={() => applyRecent(r)}
              >
                {r.entityType === 'asset' ? 'Asset' : 'Shot'} · {r.label} · {r.stage}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
