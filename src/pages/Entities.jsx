import { useMemo, useState } from 'react';
import { useProjectContext } from '../contexts/ProjectContext';
import { useAssets, useEpisodes, useSequences, useShots, useTasks } from '../api/hooks';
import { StatusPill } from '../components/StatusPill';
import { CardSkeleton } from '../components/Loading';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import { parseCsv } from '../lib/csv';
import { useAssetVersions } from '../api/hooks';

const TABS = [
  { id: 'assets', label: 'Assets' },
  { id: 'episodes', label: 'Episodes' },
  { id: 'shots', label: 'Shots' },
  { id: 'sequences', label: 'Sequences' },
];

export function Entities() {
  const { projectId } = useProjectContext();
  const [tab, setTab] = useState('assets');
  const [typeFilter, setTypeFilter] = useState('');
  const [detailId, setDetailId] = useState(null);
  const [detailType, setDetailType] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: assets = [], isLoading: assetsLoading } = useAssets(projectId, typeFilter ? { type: typeFilter } : {});
  const { data: episodes = [] } = useEpisodes(projectId);
  const { data: tasks = [] } = useTasks(projectId ? { project_id: projectId } : {});

  const assetTypes = [...new Set(assets.map((a) => a.type))].sort();

  const tasksForEntity = (assetId, shotId) =>
    tasks.filter((t) => (assetId && t.asset_id === assetId) || (shotId && t.shot_id === shotId));

  if (!projectId) {
    return (
      <div className="glass-panel p-8 text-center text-muted">
        Select a project to view entities.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-4xl font-serif font-bold text-foreground">Entities</h1>
        <div className="flex items-center justify-between gap-4 mt-1">
          <p className="text-muted text-sm tracking-wide">Assets, episodes, sequences, and shots</p>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-secondary text-sm px-3 py-1.5" onClick={() => setCreateOpen(true)}>
              + Add entity
            </button>
            <button type="button" className="btn-secondary text-sm px-3 py-1.5" onClick={() => setImportOpen(true)}>
              Bulk import (CSV)
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-t text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-primary/10 text-primary border border-border border-b-0 -mb-0.5' : 'text-muted hover:text-foreground hover:bg-card-hover'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'assets' && (
        <>
          {assetsLoading && assets.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <>
              <div className="flex gap-2 items-center">
                <span className="text-muted text-sm">Type:</span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-card-hover border border-border text-foreground px-4 py-1.5 rounded-md text-sm focus:outline-none focus:border-primary"
                >
                  <option value="">All</option>
                  {assetTypes.map((ty) => (
                    <option key={ty} value={ty}>{ty}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {assets.map((asset) => (
                  <div
                    key={asset.id}
                    className="glass-panel p-6 flex flex-col gap-2 relative overflow-hidden group hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => { setDetailId(asset.id); setDetailType('asset'); }}
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <p className="font-semibold text-foreground">{asset.name}</p>
                    <p className="text-sm text-muted font-mono">{asset.code} · {asset.type}</p>
                    <p className="text-xs text-muted mt-2">
                      {tasksForEntity(asset.id, null).length} task(s)
                    </p>
                  </div>
                ))}
              </div>
              {assets.length === 0 && (
                <p className="text-muted py-8 text-center">No assets in this project.</p>
              )}
            </>
          )}
        </>
      )}

      {tab === 'episodes' && (
        <div className="glass-panel p-6">
          <h2 className="text-lg font-semibold text-foreground mb-3">Episodes</h2>
          {episodes.length === 0 ? (
            <p className="text-muted text-sm">No episodes yet. Use “Bulk import (CSV)” or create one via API.</p>
          ) : (
            <ul className="space-y-2">
              {episodes.map((e) => (
                <li key={e.id} className="flex items-center justify-between border border-border rounded-md px-3 py-2 bg-card/60">
                  <div>
                    <div className="text-foreground font-medium">{e.title || e.code}</div>
                    <div className="text-muted text-xs font-mono">ep#{e.episode_number} · {e.code}</div>
                  </div>
                  <span className="text-muted text-xs">{e.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'shots' && (
        <div className="glass-panel p-6 text-center text-muted">
          Use “Bulk import (CSV)” to add shots in bulk (requires episode_code + sequence_code + shot_code).
        </div>
      )}

      {tab === 'sequences' && (
        <div className="glass-panel p-6 text-center text-muted">
          Use “Bulk import (CSV)” to add sequences in bulk (requires episode_code + sequence code + name).
        </div>
      )}

      {detailId && detailType === 'asset' && (
        <EntityDrawer
          asset={assets.find((a) => a.id === detailId)}
          tasks={tasksForEntity(detailId, null)}
          onClose={() => { setDetailId(null); setDetailType(null); }}
        />
      )}

      {importOpen && (
        <BulkImportModal
          projectId={projectId}
          onClose={() => setImportOpen(false)}
        />
      )}

      {createOpen && (
        <CreateEntityModal
          projectId={projectId}
          episodes={episodes}
          onClose={() => setCreateOpen(false)}
        />
      )}
    </div>
  );
}

function CreateEntityModal({ projectId, episodes, onClose }) {
  const [type, setType] = useState('asset'); // asset | episode | sequence | shot
  const [status, setStatus] = useState({ phase: 'idle', message: '' });

  // asset
  const [assetType, setAssetType] = useState('prop');
  const [assetName, setAssetName] = useState('');
  const [assetCode, setAssetCode] = useState('');

  // episode
  const [episodeNumber, setEpisodeNumber] = useState('1');
  const [episodeCode, setEpisodeCode] = useState('ep01');
  const [episodeTitle, setEpisodeTitle] = useState('');

  // sequence
  const [seqEpisodeCode, setSeqEpisodeCode] = useState('');
  const [seqName, setSeqName] = useState('');
  const [seqCode, setSeqCode] = useState('sq01');

  // shot
  const [shotEpisodeCode, setShotEpisodeCode] = useState('');
  const [shotSequenceCode, setShotSequenceCode] = useState('');
  const [shotCode, setShotCode] = useState('sh001');

  const epByCode = useMemo(() => new Map((episodes || []).map((e) => [String(e.code).toLowerCase(), e])), [episodes]);

  const submit = async () => {
    setStatus({ phase: 'saving', message: 'Saving…' });
    try {
      if (type === 'asset') {
        await apiClient.post(`/api/v1/projects/${projectId}/assets`, {
          type: assetType,
          name: assetName.trim(),
          code: assetCode.trim(),
          metadata: {},
        });
      }
      if (type === 'episode') {
        await apiClient.post(`/api/v1/projects/${projectId}/episodes`, {
          episode_number: Number(episodeNumber),
          code: episodeCode.trim(),
          title: episodeTitle.trim() || null,
          status: 'in_production',
          metadata: {},
        });
      }
      if (type === 'sequence') {
        const ep = epByCode.get(seqEpisodeCode.trim().toLowerCase());
        if (!ep) throw new Error('Episode code not found (create episode first)');
        await apiClient.post(`/api/v1/episodes/${ep.id}/sequences`, { name: seqName.trim(), code: seqCode.trim(), metadata: {} });
      }
      if (type === 'shot') {
        const ep = epByCode.get(shotEpisodeCode.trim().toLowerCase());
        if (!ep) throw new Error('Episode code not found (create episode first)');
        const seqs = await apiClient.get(`/api/v1/episodes/${ep.id}/sequences?code=${encodeURIComponent(shotSequenceCode.trim())}`);
        const seq = Array.isArray(seqs) && seqs.length ? seqs[0] : null;
        if (!seq) throw new Error('Sequence code not found (create sequence first)');
        await apiClient.post(`/api/v1/sequences/${seq.id}/shots`, { shot_code: shotCode.trim(), status: 'pending', metadata: {} });
      }
      setStatus({ phase: 'done', message: 'Created.' });
      setTimeout(onClose, 500);
    } catch (e) {
      setStatus({ phase: 'error', message: String(e?.message || e) });
    }
  };

  const canSubmit =
    (type === 'asset' && assetName.trim() && assetCode.trim()) ||
    (type === 'episode' && episodeCode.trim() && episodeNumber) ||
    (type === 'sequence' && seqEpisodeCode.trim() && seqName.trim() && seqCode.trim()) ||
    (type === 'shot' && shotEpisodeCode.trim() && shotSequenceCode.trim() && shotCode.trim());

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4">
      <div className="bg-background/80 fixed inset-0 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-xl bg-card border border-border shadow-xl rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-serif font-semibold text-foreground">Add entity</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground p-1 rounded hover:bg-card-hover transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 space-y-4 max-h-[75vh] overflow-auto">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="bg-card-hover border border-border text-foreground px-3 py-2 rounded-md text-sm focus:outline-none focus:border-primary"
            >
              <option value="asset">Asset</option>
              <option value="episode">Episode</option>
              <option value="sequence">Sequence</option>
              <option value="shot">Shot</option>
            </select>
          </div>

          {type === 'asset' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Asset type</label>
                <select value={assetType} onChange={(e) => setAssetType(e.target.value)} className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm focus:outline-none focus:border-primary">
                  {['character','prop','environment','fx','rig','texture_set','groom','shader'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Code</label>
                <input value={assetCode} onChange={(e) => setAssetCode(e.target.value)} className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary" placeholder="hero_prop" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-muted mb-1">Name</label>
                <input value={assetName} onChange={(e) => setAssetName(e.target.value)} className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm focus:outline-none focus:border-primary" placeholder="Hero Prop" />
              </div>
            </div>
          )}

          {type === 'episode' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Episode number</label>
                <input value={episodeNumber} onChange={(e) => setEpisodeNumber(e.target.value)} className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary" placeholder="1" />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Code</label>
                <input value={episodeCode} onChange={(e) => setEpisodeCode(e.target.value)} className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary" placeholder="ep01" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-muted mb-1">Title (optional)</label>
                <input value={episodeTitle} onChange={(e) => setEpisodeTitle(e.target.value)} className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm focus:outline-none focus:border-primary" placeholder="Episode 1" />
              </div>
            </div>
          )}

          {type === 'sequence' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Episode code</label>
                <input value={seqEpisodeCode} onChange={(e) => setSeqEpisodeCode(e.target.value)} className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary" placeholder="ep01" />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Sequence code</label>
                <input value={seqCode} onChange={(e) => setSeqCode(e.target.value)} className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary" placeholder="sq01" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-muted mb-1">Name</label>
                <input value={seqName} onChange={(e) => setSeqName(e.target.value)} className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm focus:outline-none focus:border-primary" placeholder="Sequence 01" />
              </div>
            </div>
          )}

          {type === 'shot' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Episode code</label>
                <input value={shotEpisodeCode} onChange={(e) => setShotEpisodeCode(e.target.value)} className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary" placeholder="ep01" />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Sequence code</label>
                <input value={shotSequenceCode} onChange={(e) => setShotSequenceCode(e.target.value)} className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary" placeholder="sq01" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-muted mb-1">Shot code</label>
                <input value={shotCode} onChange={(e) => setShotCode(e.target.value)} className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary" placeholder="sh001" />
              </div>
            </div>
          )}

          {status.message ? (
            <p className={`${status.phase === 'error' ? 'text-danger' : status.phase === 'done' ? 'text-success' : 'text-muted'} text-sm break-words`}>
              {status.message}
            </p>
          ) : null}
        </div>
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button type="button" className="btn-secondary px-3 py-1.5 text-sm" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50"
            onClick={submit}
            disabled={!canSubmit || status.phase === 'saving'}
          >
            {status.phase === 'saving' ? 'Saving…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkImportModal({ projectId, onClose }) {
  const [entityType, setEntityType] = useState('assets');
  const [status, setStatus] = useState({ phase: 'idle', message: '', created: 0, updated: 0, errors: 0 });

  const onFile = async (file) => {
    setStatus({ phase: 'parsing', message: 'Parsing CSV…', created: 0, updated: 0, errors: 0 });
    const text = await file.text();
    const rows = parseCsv(text);
    if (!rows.length) {
      setStatus({ phase: 'error', message: 'No rows found in CSV (need header + data rows).', created: 0, updated: 0, errors: 0 });
      return;
    }
    setStatus({ phase: 'importing', message: `Importing ${rows.length} row(s)…`, created: 0, updated: 0, errors: 0 });

    let created = 0;
    let updated = 0;
    let errors = 0;

    try {
      if (entityType === 'assets') {
        for (const r of rows) {
          const type = (r.type || '').trim();
          const name = (r.name || '').trim();
          const code = (r.code || '').trim();
          if (!type || !name || !code) continue;
          const existing = await apiClient.get(`/api/v1/projects/${projectId}/assets?code=${encodeURIComponent(code)}`);
          if (Array.isArray(existing) && existing.length) {
            await apiClient.patch(`/api/v1/assets/${existing[0].id}`, { type, name, metadata: _json(r.metadata) });
            updated++;
          } else {
            await apiClient.post(`/api/v1/projects/${projectId}/assets`, { type, name, code, metadata: _json(r.metadata) });
            created++;
          }
          setStatus((s) => ({ ...s, created, updated, errors }));
        }
      }

      if (entityType === 'episodes') {
        for (const r of rows) {
          const episode_number = _int(r.episode_number);
          const code = (r.code || '').trim();
          if (episode_number == null || !code) continue;
          const list = await apiClient.get(`/api/v1/projects/${projectId}/episodes?code=${encodeURIComponent(code)}`);
          const body = {
            episode_number,
            code,
            title: (r.title || '').trim() || null,
            status: (r.status || '').trim() || 'in_production',
            air_date: (r.air_date || '').trim() || null,
            metadata: _json(r.metadata),
          };
          if (Array.isArray(list) && list.length) {
            await apiClient.patch(`/api/v1/episodes/${list[0].id}`, body);
            updated++;
          } else {
            await apiClient.post(`/api/v1/projects/${projectId}/episodes`, body);
            created++;
          }
          setStatus((s) => ({ ...s, created, updated, errors }));
        }
      }

      if (entityType === 'sequences') {
        // requires episode_code to map to episode id
        const eps = await apiClient.get(`/api/v1/projects/${projectId}/episodes`);
        const epByCode = new Map((eps || []).map((e) => [String(e.code).toLowerCase(), e]));
        for (const r of rows) {
          const episode_code = (r.episode_code || '').trim().toLowerCase();
          const name = (r.name || '').trim();
          const code = (r.code || '').trim();
          if (!episode_code || !name || !code) continue;
          const ep = epByCode.get(episode_code);
          if (!ep) {
            errors++;
            setStatus((s) => ({ ...s, message: `Missing episode_code ${episode_code} (create episode first)`, created, updated, errors }));
            continue;
          }
          const seqs = await apiClient.get(`/api/v1/episodes/${ep.id}/sequences?code=${encodeURIComponent(code)}`);
          const body = { name, code, metadata: _json(r.metadata) };
          if (Array.isArray(seqs) && seqs.length) {
            await apiClient.patch(`/api/v1/sequences/${seqs[0].id}`, body);
            updated++;
          } else {
            await apiClient.post(`/api/v1/episodes/${ep.id}/sequences`, body);
            created++;
          }
          setStatus((s) => ({ ...s, created, updated, errors }));
        }
      }

      if (entityType === 'shots') {
        // requires episode_code + sequence_code
        const eps = await apiClient.get(`/api/v1/projects/${projectId}/episodes`);
        const epByCode = new Map((eps || []).map((e) => [String(e.code).toLowerCase(), e]));
        // cache sequences map per episode
        const seqCache = new Map();
        for (const r of rows) {
          const episode_code = (r.episode_code || '').trim().toLowerCase();
          const sequence_code = (r.sequence_code || '').trim().toLowerCase();
          const shot_code = (r.shot_code || '').trim();
          if (!episode_code || !sequence_code || !shot_code) continue;
          const ep = epByCode.get(episode_code);
          if (!ep) { errors++; continue; }
          if (!seqCache.has(ep.id)) {
            const seqs = await apiClient.get(`/api/v1/episodes/${ep.id}/sequences`);
            seqCache.set(ep.id, new Map((seqs || []).map((s) => [String(s.code).toLowerCase(), s])));
          }
          const seqByCode = seqCache.get(ep.id);
          const seq = seqByCode.get(sequence_code);
          if (!seq) { errors++; continue; }
          const existing = await apiClient.get(`/api/v1/sequences/${seq.id}/shots?shot_code=${encodeURIComponent(shot_code)}`);
          const body = {
            shot_code,
            frame_start: _int(r.frame_start),
            frame_end: _int(r.frame_end),
            handle_in: _int(r.handle_in) ?? 0,
            handle_out: _int(r.handle_out) ?? 0,
            status: (r.status || '').trim() || 'pending',
            metadata: _json(r.metadata),
          };
          if (Array.isArray(existing) && existing.length) {
            await apiClient.patch(`/api/v1/shots/${existing[0].id}`, body);
            updated++;
          } else {
            await apiClient.post(`/api/v1/sequences/${seq.id}/shots`, body);
            created++;
          }
          setStatus((s) => ({ ...s, created, updated, errors }));
        }
      }

      setStatus((s) => ({ ...s, phase: 'done', message: 'Import complete.' }));
    } catch (e) {
      setStatus((s) => ({ ...s, phase: 'error', message: String(e?.message || e) }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="bg-background/80 fixed inset-0 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-xl bg-card border border-border shadow-xl rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-serif font-semibold text-foreground">Bulk import (CSV)</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground p-1 rounded hover:bg-card-hover transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 space-y-4 max-h-[75vh] overflow-auto">
          <div className="flex items-center gap-3">
            <label className="text-sm text-muted">Entity</label>
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="bg-card-hover border border-border text-foreground px-3 py-2 rounded-md text-sm focus:outline-none focus:border-primary"
            >
              <option value="assets">Assets</option>
              <option value="episodes">Episodes</option>
              <option value="sequences">Sequences</option>
              <option value="shots">Shots</option>
            </select>
          </div>
          <div className="glass-panel p-3 text-xs text-muted break-words overflow-auto max-h-40">
            <p className="mb-1">Upload a CSV with a header row.</p>
            <p className="font-mono text-xs">Assets: type,name,code,metadata</p>
            <p className="font-mono text-xs">Episodes: episode_number,code,title,status,air_date,metadata</p>
            <p className="font-mono text-xs">Sequences: episode_code,name,code,metadata</p>
            <p className="font-mono text-xs">Shots: episode_code,sequence_code,shot_code,frame_start,frame_end,handle_in,handle_out,status,metadata</p>
          </div>

          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
            className="block w-full text-sm text-muted file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-card-hover file:text-foreground hover:file:bg-primary/10"
            disabled={status.phase === 'importing' || status.phase === 'parsing'}
          />

          <div className="flex items-center justify-between text-sm">
            <div className="text-muted">
              {status.message || 'Select a CSV to begin.'}
            </div>
            <div className="text-muted font-mono text-xs">
              created={status.created} updated={status.updated} errors={status.errors}
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-border flex justify-end">
          <button type="button" className="btn-secondary px-3 py-1.5 text-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function _int(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function _json(v) {
  if (v == null) return {};
  const s = String(v).trim();
  if (!s) return {};
  try {
    const j = JSON.parse(s);
    return j && typeof j === 'object' && !Array.isArray(j) ? j : {};
  } catch {
    return {};
  }
}

function EntityDrawer({ asset, tasks, onClose }) {
  const { data: versions = [], isLoading: versionsLoading, error: versionsError } = useAssetVersions(asset?.id);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [selectedRep, setSelectedRep] = useState(null);
  const [manifestOpen, setManifestOpen] = useState(false);
  const [manifestJson, setManifestJson] = useState(null);
  const [manifestErr, setManifestErr] = useState('');

  const currentGroup = selectedVersion != null ? versions.find((v) => v.version_number === selectedVersion) : null;
  const reps = currentGroup?.representations || [];
  const currentRep = selectedRep
    ? reps.find((r) => r.representation === selectedRep)
    : reps[0];

  const openManifest = async () => {
    if (!currentRep?.content_id) return;
    setManifestErr('');
    setManifestJson(null);
    setManifestOpen(true);
    try {
      const j = await apiClient.get(`/api/v1/manifests/${currentRep.content_id}`);
      setManifestJson(j);
    } catch (e) {
      setManifestErr(String(e?.message || e));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="bg-background/80 fixed inset-0 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md bg-card border-l border-border shadow-xl overflow-auto">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-xl font-serif font-semibold text-foreground">Asset detail</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground p-1 rounded hover:bg-card-hover transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          {asset && (
            <>
              <p className="font-semibold text-foreground">{asset.name}</p>
              <p className="text-muted text-sm font-mono">{asset.code} · {asset.type}</p>
            </>
          )}

          <div className="glass-panel p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-muted">Published versions</h3>
              {currentRep?.content_id && (
                <button type="button" className="btn-secondary text-xs px-2 py-1" onClick={openManifest}>
                  View manifest JSON
                </button>
              )}
            </div>
            {versionsLoading ? (
              <p className="text-muted text-sm">Loading versions…</p>
            ) : versionsError ? (
              <p className="text-danger text-sm">Failed to load versions</p>
            ) : versions.length === 0 ? (
              <p className="text-muted text-sm">No published versions yet.</p>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted">Version</label>
                  <select
                    value={selectedVersion ?? versions[0].version_number}
                    onChange={(e) => { setSelectedVersion(Number(e.target.value)); setSelectedRep(null); }}
                    className="bg-card-hover border border-border text-foreground px-2 py-1 rounded text-xs focus:outline-none focus:border-primary"
                  >
                    {versions.map((v) => (
                      <option key={`${v.version_number}-${v.publish_batch_id || ''}`} value={v.version_number}>
                        v{String(v.version_number).padStart(3, '0')}
                      </option>
                    ))}
                  </select>

                  <label className="text-xs text-muted ml-2">Rep</label>
                  <select
                    value={selectedRep ?? (reps[0]?.representation || '')}
                    onChange={(e) => setSelectedRep(e.target.value)}
                    className="bg-card-hover border border-border text-foreground px-2 py-1 rounded text-xs focus:outline-none focus:border-primary"
                    disabled={reps.length === 0}
                  >
                    {reps.map((r) => (
                      <option key={r.representation} value={r.representation}>{r.representation}</option>
                    ))}
                  </select>
                </div>
                {currentRep && (
                  <div className="mt-3 text-xs text-muted font-mono break-words">
                    <div>content_id: {currentRep.content_id}</div>
                    <div>filename: {currentRep.filename}</div>
                    {currentRep.size != null && <div>size: {currentRep.size} bytes</div>}
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium text-muted mb-2">Related tasks</h3>
            <ul className="space-y-2">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-2">
                  <Link to={`/task/${t.id}`} className="link-hover text-sm">{t.type}</Link>
                  <StatusPill status={t.status} />
                </li>
              ))}
            </ul>
            {tasks.length === 0 && <p className="text-muted text-sm">No tasks</p>}
          </div>
        </div>
      </div>

      {manifestOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="bg-background/80 fixed inset-0 backdrop-blur-sm" onClick={() => setManifestOpen(false)} aria-hidden />
          <div className="relative w-full max-w-3xl bg-card border border-border shadow-xl rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-serif font-semibold text-foreground">Manifest JSON</h3>
              <button type="button" onClick={() => setManifestOpen(false)} className="text-muted hover:text-foreground p-1 rounded hover:bg-card-hover transition-colors">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 max-h-[70vh] overflow-auto">
              {manifestErr ? (
                <p className="text-danger text-sm">{manifestErr}</p>
              ) : manifestJson ? (
                <pre className="text-xs text-foreground whitespace-pre-wrap break-words bg-background/40 border border-border rounded p-3">
                  {JSON.stringify(manifestJson, null, 2)}
                </pre>
              ) : (
                <p className="text-muted text-sm">Loading…</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
