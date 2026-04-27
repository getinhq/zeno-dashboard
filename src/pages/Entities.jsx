import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useProjectContext } from '../contexts/ProjectContext';
import {
  useAsset,
  useAssets,
  useEpisodes,
  useProjectSequences,
  useProjectShots,
  useSequence,
  useShot,
  useTasks,
  useUpdateAsset,
  useUpdateSequence,
  useUpdateShot,
  useAssetVersions,
  useUpdateVersion,
} from '../api/hooks';
import { StatusPill } from '../components/StatusPill';
import { CardSkeleton } from '../components/Loading';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import { parseCsv } from '../lib/csv';
import { ThemedSelect } from '../components/ThemedSelect';

const TABS = [
  { id: 'assets', label: 'Assets' },
  { id: 'episodes', label: 'Episodes' },
  { id: 'shots', label: 'Shots' },
  { id: 'sequences', label: 'Sequences' },
];
const STAGES = ['Animatics', 'Layout', 'Animation', 'Lighting', 'Comp'];
const ASSET_PIPELINE_STAGES = ['modelling', 'texturing', 'rigging', 'lookdev'];
const PIPELINE_STAGE_STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
  { value: 'approved', label: 'Approved' },
  { value: 'na', label: 'N/A' },
];
const VERSION_STAGE_FILTER_OPTIONS = [
  { value: '', label: 'General (legacy)' },
  ...ASSET_PIPELINE_STAGES.map((s) => ({
    value: s,
    label: s.charAt(0).toUpperCase() + s.slice(1),
  })),
];
const SHOT_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'review', label: 'Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'final', label: 'Final' },
];
const VERSION_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_review', label: 'In review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

function overallStatusLabel(statusByStage = {}, stages = []) {
  const allApproved = stages.length > 0 && stages.every((stage) => String(statusByStage[stage] || '').toLowerCase() === 'approved');
  return allApproved ? 'Approved' : 'Not Approved';
}

function RelatedTasksSection({ tasks, emptyHint = 'No tasks linked to this entity.' }) {
  // Sort by stage/type then due date so like-work sits together and urgent
  // tasks bubble up — otherwise the list reflects DB insertion order which
  // is confusing on a busy show.
  const ordered = useMemo(() => {
    const copy = [...(tasks || [])];
    copy.sort((a, b) => {
      const ta = String(a.type || '').localeCompare(String(b.type || ''));
      if (ta !== 0) return ta;
      const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      return da - db;
    });
    return copy;
  }, [tasks]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-muted">
          Related tasks {ordered.length ? `(${ordered.length})` : ''}
        </h3>
      </div>
      {ordered.length === 0 ? (
        <p className="text-muted text-sm italic">{emptyHint}</p>
      ) : (
        <ul className="divide-y divide-border/60 border border-border rounded-md overflow-hidden">
          {ordered.map((t) => {
            const stage = t.metadata?.stage || t.type;
            const assigneeCount = Array.isArray(t.assignees) ? t.assignees.length : 0;
            return (
              <li
                key={t.id}
                className="flex items-center gap-3 px-3 py-2 bg-card/40 hover:bg-card-hover/60 transition-colors"
              >
                <span className="text-[10px] font-mono uppercase text-primary/80 tracking-wider min-w-[72px]">
                  {stage}
                </span>
                <Link
                  to={`/task/${t.id}`}
                  className="flex-1 text-sm text-foreground truncate link-hover"
                  title={t.title || t.type}
                >
                  {t.title || <span className="text-muted">{t.type}</span>}
                </Link>
                <span className="text-[11px] text-muted font-mono whitespace-nowrap">
                  {assigneeCount
                    ? `${assigneeCount} assignee${assigneeCount > 1 ? 's' : ''}`
                    : t.assignee_id
                      ? '1 assignee'
                      : 'Unassigned'}
                </span>
                <span className="text-[11px] text-muted font-mono whitespace-nowrap hidden sm:inline">
                  {t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}
                </span>
                <StatusPill status={t.status} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function EditIconButton({ onClick, active, label }) {
  return (
    <button
      type="button"
      className={`btn-secondary text-xs px-2 py-1 ${active ? 'border-primary text-primary' : ''}`}
      onClick={onClick}
      title={label}
    >
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    </button>
  );
}

export function Entities() {
  const { projectId } = useProjectContext();
  const [tab, setTab] = useState('assets');
  const [typeFilter, setTypeFilter] = useState('');
  const [detailId, setDetailId] = useState(null);
  const [detailType, setDetailType] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [shotEpisodeFilter, setShotEpisodeFilter] = useState([]);
  const [shotSequenceFilter, setShotSequenceFilter] = useState([]);
  const [shotSearch, setShotSearch] = useState('');
  const [sequenceEpisodeFilter, setSequenceEpisodeFilter] = useState([]);

  const { data: assets = [], isLoading: assetsLoading } = useAssets(projectId, typeFilter ? { type: typeFilter } : {});
  const { data: episodes = [] } = useEpisodes(projectId);
  const { data: tasks = [] } = useTasks(projectId ? { project_id: projectId } : {});
  const { data: projectSequences = [] } = useProjectSequences(projectId, {
    episode_ids: sequenceEpisodeFilter,
  });
  const { data: projectShots = [] } = useProjectShots(projectId, {
    episode_ids: shotEpisodeFilter,
    sequence_ids: shotSequenceFilter,
    search: shotSearch.trim() || undefined,
  });

  const assetTypes = [...new Set(assets.map((a) => a.type))].sort();
  const episodeCodeById = useMemo(
    () => new Map((episodes || []).map((e) => [e.id, e.code])),
    [episodes],
  );
  const sequenceCodeById = useMemo(
    () => new Map((projectSequences || []).map((s) => [s.id, s.code])),
    [projectSequences],
  );

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
                <ThemedSelect
                  value={typeFilter}
                  onChange={setTypeFilter}
                  className="min-w-[150px]"
                  options={[
                    { value: '', label: 'All' },
                    ...assetTypes.map((ty) => ({ value: ty, label: ty })),
                  ]}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {assets.map((asset) => (
                  <AssetEntityCard
                    key={asset.id}
                    asset={asset}
                    taskCount={tasksForEntity(asset.id, null).length}
                    onOverview={() => { setDetailId(asset.id); setDetailType('asset'); }}
                  />
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
        <div className="glass-panel p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Shots</h2>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Episode</label>
              <ThemedSelect
                value={shotEpisodeFilter[0] || ''}
                onChange={(v) => setShotEpisodeFilter(v ? [v] : [])}
                options={[{ value: '', label: 'All Episodes' }, ...episodes.map((e) => ({ value: e.id, label: e.code }))]}
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Sequence</label>
              <ThemedSelect
                value={shotSequenceFilter[0] || ''}
                onChange={(v) => setShotSequenceFilter(v ? [v] : [])}
                options={[
                  { value: '', label: 'All Sequences' },
                  ...projectSequences
                    .filter((s) => shotEpisodeFilter.length === 0 || shotEpisodeFilter.includes(s.episode_id))
                    .map((s) => ({ value: s.id, label: s.code })),
                ]}
              />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs text-muted mb-1">Search Shot</label>
              <input
                value={shotSearch}
                onChange={(e) => setShotSearch(e.target.value)}
                className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
                placeholder="Search shot code..."
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {projectShots.map((shot) => (
              <ShotCard
                key={shot.id}
                shot={shot}
                episodeCode={episodeCodeById.get(shot.episode_id) || shot.episode_id}
                sequenceCode={sequenceCodeById.get(shot.sequence_id) || shot.sequence_id}
                onOpenDetail={() => { setDetailId(shot.id); setDetailType('shot'); }}
              />
            ))}
          </div>
          {projectShots.length === 0 && (
            <p className="text-muted text-sm">No shots match current filters.</p>
          )}
        </div>
      )}

      {tab === 'sequences' && (
        <div className="glass-panel p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Sequences</h2>
          <div className="max-w-sm">
            <label className="block text-xs text-muted mb-1">Episode</label>
            <ThemedSelect
              value={sequenceEpisodeFilter[0] || ''}
              onChange={(v) => setSequenceEpisodeFilter(v ? [v] : [])}
              options={[{ value: '', label: 'All Episodes' }, ...episodes.map((e) => ({ value: e.id, label: e.code }))]}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {projectSequences.map((sequence) => (
              <SequenceCard
                key={sequence.id}
                sequence={sequence}
                episodeCode={episodeCodeById.get(sequence.episode_id) || sequence.episode_id}
                onOpenDetail={() => { setDetailId(sequence.id); setDetailType('sequence'); }}
              />
            ))}
          </div>
          {projectSequences.length === 0 && (
            <p className="text-muted text-sm">No sequences found for this selection.</p>
          )}
        </div>
      )}

      {detailId && detailType === 'asset' && (
        <AssetDetailModal
          assetId={detailId}
          tasks={tasksForEntity(detailId, null)}
          onClose={() => { setDetailId(null); setDetailType(null); }}
        />
      )}
      {detailId && detailType === 'shot' && (
        <ShotDetailModal
          shotId={detailId}
          tasks={tasksForEntity(null, detailId)}
          episodeCode={episodeCodeById.get(projectShots.find((s) => s.id === detailId)?.episode_id)}
          sequenceCode={sequenceCodeById.get(projectShots.find((s) => s.id === detailId)?.sequence_id)}
          onClose={() => { setDetailId(null); setDetailType(null); }}
        />
      )}
      {detailId && detailType === 'sequence' && (
        <SequenceDetailModal
          sequenceId={detailId}
          episodeCode={episodeCodeById.get(projectSequences.find((s) => s.id === detailId)?.episode_id)}
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
          sequences={projectSequences}
          onClose={() => setCreateOpen(false)}
        />
      )}
    </div>
  );
}

function AssetEntityCard({ asset, taskCount, onOverview }) {
  return (
    <div className="glass-panel p-6 flex flex-col gap-2 relative overflow-hidden group hover:border-primary/50 transition-colors">
      <button
        type="button"
        className="absolute top-3 right-3 z-10 btn-secondary text-xs px-2 py-1"
        onClick={onOverview}
      >
        Overview
      </button>
      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <p className="font-serif font-semibold text-foreground pr-24">{asset.name}</p>
      <p className="text-sm text-muted font-mono">{asset.code} · {asset.type}</p>
      <p className="text-xs text-muted mt-2">{taskCount} task(s)</p>
    </div>
  );
}

function SequenceCard({ sequence, episodeCode, onOpenDetail }) {
  return (
    <div className="border border-border rounded-md p-4 bg-card/60 space-y-2 relative">
      <button
        type="button"
        className="absolute top-3 right-3 btn-secondary text-xs px-2 py-1 z-10"
        onClick={(e) => {
          e.stopPropagation();
          onOpenDetail();
        }}
      >
        Overview
      </button>
      <p className="font-semibold text-foreground pr-24">{sequence.name}</p>
      <p className="text-xs font-mono text-muted">Episode: {episodeCode}</p>
      <p className="text-xs font-mono text-muted">{sequence.code}</p>
    </div>
  );
}

function ShotCard({ shot, episodeCode, sequenceCode, onOpenDetail }) {
  return (
    <div className="border border-border rounded-md p-4 bg-card/60 space-y-2 relative">
      <button
        type="button"
        className="absolute top-3 right-3 btn-secondary text-xs px-2 py-1 z-10"
        onClick={(e) => {
          e.stopPropagation();
          onOpenDetail();
        }}
      >
        Overview
      </button>
      <p className="font-semibold text-foreground pr-24">{shot.shot_code}</p>
      <p className="text-xs text-muted font-mono">Episode: {episodeCode}</p>
      <p className="text-xs text-muted font-mono">Sequence: {sequenceCode}</p>
    </div>
  );
}

function DetailModalFrame({
  title,
  onClose,
  tab,
  setTab,
  overview,
  versions,
  stageStatus = null,
  tasks = null,
  taskCount = null,
}) {
  // Collect tabs declaratively so the footer (Tasks) can be added conditionally
  // without another bespoke branch for every entity type.
  const tabsConfig = [
    { id: 'overview', label: 'Overview', content: overview, visible: true },
    { id: 'versions', label: 'Versions', content: versions, visible: true },
    { id: 'stage_status', label: 'Stage-Status', content: stageStatus, visible: !!stageStatus },
    {
      id: 'tasks',
      label: taskCount != null ? `Tasks (${taskCount})` : 'Tasks',
      content: tasks,
      visible: !!tasks,
    },
  ].filter((t) => t.visible);

  const active = tabsConfig.find((t) => t.id === tab) || tabsConfig[0];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="bg-background/80 fixed inset-0 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-2xl max-h-[88vh] bg-card border border-border shadow-xl rounded-lg overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
          <h2 className="text-lg font-serif font-semibold text-foreground">{title}</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground p-1 rounded hover:bg-card-hover transition-colors" aria-label="Close">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex border-b border-border shrink-0">
          {tabsConfig.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                active.id === t.id
                  ? 'bg-primary/10 text-primary border-b-2 border-primary'
                  : 'text-muted hover:text-foreground'
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="p-4 overflow-y-auto flex-1 min-h-0">{active.content}</div>
      </div>
    </div>
  );
}

function AssetDetailModal({ assetId, tasks, onClose }) {
  const [tab, setTab] = useState('overview');
  const { data: asset, isLoading } = useAsset(assetId);
  const updateAsset = useUpdateAsset(assetId);
  const [editing, setEditing] = useState(false);
  const [assetDraft, setAssetDraft] = useState({ name: '', code: '', type: '' });

  useEffect(() => {
    if (!asset) return;
    setAssetDraft({ name: asset.name || '', code: asset.code || '', type: asset.type || 'prop' });
  }, [asset]);

  const assetStageStatus = asset?.pipeline_stage_status || {};
  const assetOverallStatus = overallStatusLabel(assetStageStatus, ASSET_PIPELINE_STAGES);
  const assetDirty = (assetDraft.name || '').trim() !== (asset?.name || '')
    || (assetDraft.code || '').trim() !== (asset?.code || '')
    || (assetDraft.type || '') !== (asset?.type || '');

  const overview = (
    <div className="space-y-4">
      {isLoading || !asset ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : (
        <>
          <div className="flex justify-end">
            <EditIconButton
              onClick={() => {
                if (editing) {
                  setAssetDraft({ name: asset.name || '', code: asset.code || '', type: asset.type || 'prop' });
                  setEditing(false);
                  return;
                }
                setEditing(true);
              }}
              active={editing}
              label="Edit asset attributes"
            />
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div><dt className="text-muted">Name</dt><dd className="font-medium text-foreground">{asset.name}</dd></div>
            <div><dt className="text-muted">Code</dt><dd className="font-mono text-foreground">{asset.code}</dd></div>
            <div><dt className="text-muted">Type</dt><dd className="text-foreground">{asset.type}</dd></div>
            <div><dt className="text-muted">Overall status</dt><dd className="text-foreground">{assetOverallStatus}</dd></div>
            <div><dt className="text-muted">Updated</dt><dd className="text-foreground">{asset.updated_at || '—'}</dd></div>
          </dl>
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted mb-1">Name</label>
                <input
                  value={assetDraft.name}
                  onChange={(e) => setAssetDraft((s) => ({ ...s, name: e.target.value }))}
                  className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Code</label>
                <input
                  value={assetDraft.code}
                  onChange={(e) => setAssetDraft((s) => ({ ...s, code: e.target.value }))}
                  className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Type</label>
                <ThemedSelect
                  value={assetDraft.type}
                  onChange={(v) => setAssetDraft((s) => ({ ...s, type: v }))}
                  options={['character','prop','environment','fx','rig','texture_set','groom','shader'].map((t) => ({ value: t, label: t }))}
                />
              </div>
              {assetDirty && (
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    className="btn-secondary text-sm px-3 py-1.5"
                    onClick={() => {
                      updateAsset.mutate({ name: assetDraft.name.trim(), code: assetDraft.code.trim(), type: assetDraft.type });
                      setEditing(false);
                    }}
                  >
                    Save Settings
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );

  const tasksTab = (
    <RelatedTasksSection
      tasks={tasks}
      emptyHint="No tasks have been created against this asset yet."
    />
  );

  const versions = <AssetVersionsTab assetId={assetId} />;
  const stageStatus = (
    <div className="space-y-4">
      <div className="mt-3 space-y-2">
        {ASSET_PIPELINE_STAGES.map((stage) => (
          <div key={stage} className="grid grid-cols-[1fr_auto] items-center gap-2 text-sm">
            <span className="text-foreground capitalize">{stage}</span>
            <span className="text-muted capitalize">{(assetStageStatus[stage] || 'not_started').replaceAll('_', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <DetailModalFrame
      title={asset ? `${asset.name}` : 'Asset'}
      onClose={onClose}
      tab={tab}
      setTab={setTab}
      overview={overview}
      versions={versions}
      stageStatus={stageStatus}
      tasks={tasksTab}
      taskCount={tasks.length}
    />
  );
}

function AssetVersionsTab({ assetId }) {
  const [pipelineStage, setPipelineStage] = useState('');
  const { data: versions = [], isLoading: versionsLoading, error: versionsError } = useAssetVersions(assetId, pipelineStage);
  const updateVersion = useUpdateVersion();
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [selectedRep, setSelectedRep] = useState(null);
  const [editingAttrs, setEditingAttrs] = useState(false);
  const [versionFeedback, setVersionFeedback] = useState('');
  const [versionStatus, setVersionStatus] = useState('pending');

  useEffect(() => {
    setSelectedVersion(null);
    setSelectedRep(null);
  }, [pipelineStage, assetId]);

  useEffect(() => {
    if (!versions.length) {
      setSelectedVersion(null);
      setSelectedRep(null);
      return;
    }
    const hasSelected = selectedVersion != null && versions.some((v) => v.version_number === selectedVersion);
    if (!hasSelected) {
      setSelectedVersion(versions[0].version_number);
      setSelectedRep(null);
    }
  }, [versions, selectedVersion]);

  const currentGroup = selectedVersion != null ? versions.find((v) => v.version_number === selectedVersion) : versions[0] || null;
  const reps = currentGroup?.representations || [];
  useEffect(() => {
    if (!reps.length) {
      setSelectedRep(null);
      return;
    }
    if (!selectedRep || !reps.some((r) => r.representation === selectedRep)) {
      setSelectedRep(reps[0].representation);
    }
  }, [reps, selectedRep]);
  const currentRep = selectedRep
    ? reps.find((r) => r.representation === selectedRep)
    : reps[0];
  useEffect(() => {
    setVersionFeedback(currentRep?.feedback || '');
    setVersionStatus(currentRep?.status || 'pending');
    setEditingAttrs(false);
  }, [currentRep?.version_id, currentRep?.feedback, currentRep?.status]);

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs text-muted">Pipeline stage</label>
        <ThemedSelect
          value={pipelineStage}
          onChange={(v) => setPipelineStage(v)}
          className="min-w-[160px]"
          options={VERSION_STAGE_FILTER_OPTIONS}
        />
      </div>

      <div className="glass-panel p-4 mt-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-muted">Published versions</h3>
        </div>
        {versionsLoading ? (
          <p className="text-muted text-sm">Loading versions…</p>
        ) : versionsError ? (
          <p className="text-danger text-sm">Failed to load versions</p>
        ) : (
          <>
            {versions.length === 0 ? (
              <p className="text-muted text-sm">No published versions for this pipeline stage yet.</p>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-xs text-muted">Version</label>
                  <ThemedSelect
                    value={selectedVersion ?? versions[0].version_number}
                    onChange={(v) => { setSelectedVersion(Number(v)); setSelectedRep(null); }}
                    className="min-w-[120px]"
                    options={versions.map((v) => ({
                      value: v.version_number,
                      label: `v${String(v.version_number).padStart(3, '0')}`,
                    }))}
                  />
                  <label className="text-xs text-muted ml-2">Rep</label>
                  <ThemedSelect
                    value={selectedRep ?? (reps[0]?.representation || '')}
                    onChange={setSelectedRep}
                    className="min-w-[120px]"
                    disabled={reps.length === 0}
                    options={reps.map((r) => ({ value: r.representation, label: r.representation }))}
                  />
                </div>
                {currentRep && (
                  <div className="mt-3 text-xs text-muted font-mono break-words">
                    <div>content_id: {currentRep.content_id}</div>
                    <div>filename: {currentRep.filename}</div>
                    {currentRep.size != null && <div>size: {currentRep.size} bytes</div>}
                  </div>
                )}
                {currentRep && (
                  <div className="mt-3 border border-border rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-foreground">Version attributes</h4>
                      <EditIconButton
                        onClick={() => setEditingAttrs((v) => !v)}
                        active={editingAttrs}
                        label="Edit version attributes"
                      />
                    </div>
                    {editingAttrs ? (
                      <>
                        <div>
                          <label className="block text-xs text-muted mb-1">Status</label>
                          <ThemedSelect
                            value={versionStatus}
                            onChange={setVersionStatus}
                            options={VERSION_STATUS_OPTIONS}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-muted mb-1">Feedback</label>
                          <textarea
                            value={versionFeedback}
                            onChange={(e) => setVersionFeedback(e.target.value)}
                            className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm min-h-24"
                          />
                        </div>
                        <button
                          type="button"
                          className="btn-secondary text-xs px-2 py-1"
                          onClick={() => {
                            updateVersion.mutate({
                              versionId: currentRep.version_id,
                              body: { status: versionStatus, feedback: versionFeedback },
                            });
                            setEditingAttrs(false);
                          }}
                        >
                          Save version attributes
                        </button>
                      </>
                    ) : (
                      <div className="text-sm space-y-1">
                        <div><span className="text-muted">Status:</span> <span className="text-foreground">{currentRep.status || 'pending'}</span></div>
                        <div><span className="text-muted">Feedback:</span> <span className="text-foreground">{currentRep.feedback || '—'}</span></div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

    </>
  );
}

function ShotDetailModal({ shotId, episodeCode, sequenceCode, tasks = [], onClose }) {
  const [tab, setTab] = useState('overview');
  const { data: shot, isLoading } = useShot(shotId);
  const updateShot = useUpdateShot(shotId);
  const [editing, setEditing] = useState(false);
  const [shotCodeDraft, setShotCodeDraft] = useState('');
  const [handleInDraft, setHandleInDraft] = useState('');
  const [handleOutDraft, setHandleOutDraft] = useState('');
  const [frameStart, setFrameStart] = useState('');
  const [frameEnd, setFrameEnd] = useState('');

  useEffect(() => {
    if (!shot) return;
    setShotCodeDraft(shot.shot_code || '');
    setHandleInDraft(shot.handle_in != null ? String(shot.handle_in) : '0');
    setHandleOutDraft(shot.handle_out != null ? String(shot.handle_out) : '0');
    setFrameStart(shot.frame_start != null ? String(shot.frame_start) : '');
    setFrameEnd(shot.frame_end != null ? String(shot.frame_end) : '');
  }, [shot]);

  const saveSettings = () => {
    const fs = frameStart.trim() === '' ? null : Number(frameStart);
    const fe = frameEnd.trim() === '' ? null : Number(frameEnd);
    const hi = handleInDraft.trim() === '' ? 0 : Number(handleInDraft);
    const ho = handleOutDraft.trim() === '' ? 0 : Number(handleOutDraft);
    if ((fs != null && !Number.isFinite(fs)) || (fe != null && !Number.isFinite(fe)) || !Number.isFinite(hi) || !Number.isFinite(ho)) return;
    updateShot.mutate({
      shot_code: shotCodeDraft.trim() || shot.shot_code,
      frame_start: fs,
      frame_end: fe,
      handle_in: Math.trunc(hi),
      handle_out: Math.trunc(ho),
    });
  };

  const shotStageStatus = {
    ...(shot?.metadata?.stage_status || {}),
    [shot?.stage || 'Layout']: shot?.status || 'pending',
  };
  const shotOverallStatus = overallStatusLabel(shotStageStatus, STAGES);
  const shotDirty = (shotCodeDraft || '').trim() !== (shot?.shot_code || '')
    || (handleInDraft.trim() === '' ? 0 : Number(handleInDraft)) !== (shot?.handle_in ?? 0)
    || (handleOutDraft.trim() === '' ? 0 : Number(handleOutDraft)) !== (shot?.handle_out ?? 0)
    || (frameStart.trim() === '' ? null : Number(frameStart)) !== (shot?.frame_start ?? null)
    || (frameEnd.trim() === '' ? null : Number(frameEnd)) !== (shot?.frame_end ?? null);

  const overview = (
    <div className="space-y-4">
      {isLoading || !shot ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : (
        <>
          <div className="flex justify-end">
            <EditIconButton
              onClick={() => setEditing((v) => !v)}
              active={editing}
              label="Edit shot attributes"
            />
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-muted">Shot code</dt>
              <dd className="font-mono font-medium text-foreground">
                {editing ? (
                  <input
                    value={shotCodeDraft}
                    onChange={(e) => setShotCodeDraft(e.target.value)}
                    className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-1.5 text-sm font-mono"
                  />
                ) : shot.shot_code}
              </dd>
            </div>
            <div><dt className="text-muted">Episode</dt><dd className="font-mono text-foreground">{episodeCode || '—'}</dd></div>
            <div><dt className="text-muted">Sequence</dt><dd className="font-mono text-foreground">{sequenceCode || '—'}</dd></div>
            <div><dt className="text-muted">Overall status</dt><dd className="text-foreground">{shotOverallStatus}</dd></div>
            <div>
              <dt className="text-muted">Handles</dt>
              <dd className="text-foreground">
                {editing ? (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={handleInDraft}
                      onChange={(e) => setHandleInDraft(e.target.value)}
                      className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-1.5 text-sm font-mono"
                      placeholder="in"
                    />
                    <input
                      value={handleOutDraft}
                      onChange={(e) => setHandleOutDraft(e.target.value)}
                      className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-1.5 text-sm font-mono"
                      placeholder="out"
                    />
                  </div>
                ) : `in ${shot.handle_in ?? 0} / out ${shot.handle_out ?? 0}`}
              </dd>
            </div>
          </dl>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <div>
              <label className="block text-xs text-muted mb-1">Start frame</label>
              <input
                value={frameStart}
                onChange={(e) => setFrameStart(e.target.value)}
                disabled={!editing}
                className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm font-mono disabled:opacity-60"
                placeholder="1001"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">End frame</label>
              <input
                value={frameEnd}
                onChange={(e) => setFrameEnd(e.target.value)}
                disabled={!editing}
                className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm font-mono disabled:opacity-60"
                placeholder="1100"
              />
            </div>
          </div>
          {editing && shotDirty && (
            <button type="button" className="btn-secondary text-sm px-3 py-1.5" onClick={saveSettings}>
              Save Settings
            </button>
          )}
        </>
      )}
    </div>
  );

  const tasksTab = (
    <RelatedTasksSection
      tasks={tasks}
      emptyHint="No tasks have been created against this shot yet."
    />
  );

  const versions = (
    <p className="text-muted text-sm">
      Shot-level published versions are not tracked here yet. Published files are tied to asset versions.
    </p>
  );
  const stageStatus = (
    <div className="space-y-4">
      <div className="mt-3 space-y-2">
        {STAGES.map((stage) => (
          <div key={stage} className="grid grid-cols-[1fr_auto] items-center gap-2 text-sm">
            <span className="text-foreground">{stage}</span>
            <span className="text-muted">{(shotStageStatus[stage] || 'pending').replaceAll('_', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <DetailModalFrame
      title={shot ? `Shot ${shot.shot_code}` : 'Shot'}
      onClose={onClose}
      tab={tab}
      setTab={setTab}
      overview={overview}
      versions={versions}
      stageStatus={stageStatus}
      tasks={tasksTab}
      taskCount={tasks.length}
    />
  );
}

function SequenceDetailModal({ sequenceId, episodeCode, onClose }) {
  const [tab, setTab] = useState('overview');
  const { data: sequence, isLoading } = useSequence(sequenceId);
  const updateSequence = useUpdateSequence(sequenceId);
  const [editing, setEditing] = useState(false);
  const [sequenceNameDraft, setSequenceNameDraft] = useState('');
  const [sequenceCodeDraft, setSequenceCodeDraft] = useState('');
  const [startFrame, setStartFrame] = useState('');
  const [endFrame, setEndFrame] = useState('');

  useEffect(() => {
    if (!sequence) return;
    setSequenceNameDraft(sequence.name || '');
    setSequenceCodeDraft(sequence.code || '');
    setStartFrame(sequence.start_frame != null ? String(sequence.start_frame) : '');
    setEndFrame(sequence.end_frame != null ? String(sequence.end_frame) : '');
  }, [sequence]);

  const saveSettings = () => {
    const sf = startFrame.trim() === '' ? null : Number(startFrame);
    const ef = endFrame.trim() === '' ? null : Number(endFrame);
    if ((sf != null && !Number.isFinite(sf)) || (ef != null && !Number.isFinite(ef))) return;
    updateSequence.mutate({
      name: sequenceNameDraft.trim() || sequence.name,
      code: sequenceCodeDraft.trim() || sequence.code,
      start_frame: sf,
      end_frame: ef,
    });
  };

  const sequenceStageStatus = sequence?.metadata?.stage_status || {};
  const sequenceOverallStatus = overallStatusLabel(sequenceStageStatus, STAGES);
  const sequenceDirty = (sequenceNameDraft || '').trim() !== (sequence?.name || '')
    || (sequenceCodeDraft || '').trim() !== (sequence?.code || '')
    || (startFrame.trim() === '' ? null : Number(startFrame)) !== (sequence?.start_frame ?? null)
    || (endFrame.trim() === '' ? null : Number(endFrame)) !== (sequence?.end_frame ?? null);

  const overview = (
    <div className="space-y-4">
      {isLoading || !sequence ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : (
        <>
          <div className="flex justify-end">
            <EditIconButton
              onClick={() => setEditing((v) => !v)}
              active={editing}
              label="Edit sequence attributes"
            />
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-muted">Name</dt>
              <dd className="font-medium text-foreground">
                {editing ? (
                  <input
                    value={sequenceNameDraft}
                    onChange={(e) => setSequenceNameDraft(e.target.value)}
                    className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-1.5 text-sm"
                  />
                ) : sequence.name}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Code</dt>
              <dd className="font-mono text-foreground">
                {editing ? (
                  <input
                    value={sequenceCodeDraft}
                    onChange={(e) => setSequenceCodeDraft(e.target.value)}
                    className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-1.5 text-sm font-mono"
                  />
                ) : sequence.code}
              </dd>
            </div>
            <div><dt className="text-muted">Episode</dt><dd className="font-mono text-foreground">{episodeCode || '—'}</dd></div>
            <div><dt className="text-muted">Overall status</dt><dd className="text-foreground">{sequenceOverallStatus}</dd></div>
          </dl>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <div>
              <label className="block text-xs text-muted mb-1">Start frame</label>
              <input
                value={startFrame}
                onChange={(e) => setStartFrame(e.target.value)}
                disabled={!editing}
                className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm font-mono disabled:opacity-60"
                placeholder="optional"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">End frame</label>
              <input
                value={endFrame}
                onChange={(e) => setEndFrame(e.target.value)}
                disabled={!editing}
                className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm font-mono disabled:opacity-60"
                placeholder="optional"
              />
            </div>
          </div>
          {editing && sequenceDirty && (
            <button type="button" className="btn-secondary text-sm px-3 py-1.5" onClick={saveSettings}>
              Save Settings
            </button>
          )}
        </>
      )}
    </div>
  );

  const versions = (
    <p className="text-muted text-sm">
      Sequences do not have published file versions. Use shots and assets for versioned publishes.
    </p>
  );
  const stageStatus = (
    <div className="space-y-4">
      <div className="mt-3 space-y-2">
        {STAGES.map((stage) => (
          <div key={stage} className="grid grid-cols-[1fr_auto] items-center gap-2 text-sm">
            <span className="text-foreground">{stage}</span>
            <span className="text-muted">{(sequenceStageStatus[stage] || 'pending').replaceAll('_', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <DetailModalFrame
      title={sequence ? sequence.name : 'Sequence'}
      onClose={onClose}
      tab={tab}
      setTab={setTab}
      overview={overview}
      versions={versions}
      stageStatus={stageStatus}
    />
  );
}

function CreateEntityModal({ projectId, episodes, sequences, onClose }) {
  const qc = useQueryClient();
  const { data: allProjectSequences = [] } = useProjectSequences(projectId, {});
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
  const [seqEpisodeId, setSeqEpisodeId] = useState('');
  const [seqName, setSeqName] = useState('');
  const [seqCode, setSeqCode] = useState('sq01');
  const [sequenceStage, setSequenceStage] = useState('Layout');

  // shot
  const [shotEpisodeId, setShotEpisodeId] = useState('');
  const [shotSequenceId, setShotSequenceId] = useState('');
  const [shotCode, setShotCode] = useState('sh001');
  const [shotStage, setShotStage] = useState('Layout');

  useEffect(() => {
    if (!seqEpisodeId) return;
    const usedCodes = allProjectSequences
      .filter((s) => s.episode_id === seqEpisodeId)
      .map((s) => String(s.code || '').toLowerCase());
    let next = 1;
    while (usedCodes.includes(`sq${String(next).padStart(2, '0')}`)) {
      next += 1;
    }
    setSeqCode(`sq${String(next).padStart(2, '0')}`);
  }, [seqEpisodeId, allProjectSequences]);

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
        if (!seqEpisodeId) throw new Error('Select an episode');
        await apiClient.post(`/api/v1/episodes/${seqEpisodeId}/sequences`, {
          name: seqName.trim(),
          code: seqCode.trim(),
          stage: sequenceStage,
          metadata: {},
        });
      }
      if (type === 'shot') {
        if (!shotSequenceId) throw new Error('Select a sequence');
        await apiClient.post(`/api/v1/sequences/${shotSequenceId}/shots`, {
          shot_code: shotCode.trim(),
          stage: shotStage,
          status: 'pending',
          metadata: {},
        });
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['assets'] }),
        qc.invalidateQueries({ queryKey: ['episodes'] }),
        qc.invalidateQueries({ queryKey: ['sequences'] }),
        qc.invalidateQueries({ queryKey: ['project_sequences'] }),
        qc.invalidateQueries({ queryKey: ['shots'] }),
        qc.invalidateQueries({ queryKey: ['project_shots'] }),
      ]);
      setStatus({ phase: 'done', message: 'Created.' });
      setTimeout(onClose, 500);
    } catch (e) {
      const raw = String(e?.message || e);
      if (raw.includes('Sequence code must be unique per episode')) {
        setStatus({ phase: 'error', message: 'Sequence code already exists in this episode. Try a different code (e.g. next sq##).' });
      } else {
        setStatus({ phase: 'error', message: raw });
      }
    }
  };

  const canSubmit =
    (type === 'asset' && assetName.trim() && assetCode.trim()) ||
    (type === 'episode' && episodeCode.trim() && episodeNumber) ||
    (type === 'sequence' && seqEpisodeId && seqName.trim() && seqCode.trim()) ||
    (type === 'shot' && shotSequenceId && shotCode.trim());

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
            <ThemedSelect
              value={type}
              onChange={setType}
              className="min-w-[170px]"
              options={[
                { value: 'asset', label: 'Asset' },
                { value: 'episode', label: 'Episode' },
                { value: 'sequence', label: 'Sequence' },
                { value: 'shot', label: 'Shot' },
              ]}
            />
          </div>

          {type === 'asset' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Asset type</label>
                <ThemedSelect
                  value={assetType}
                  onChange={setAssetType}
                  className="w-full"
                  options={['character','prop','environment','fx','rig','texture_set','groom','shader'].map((t) => ({ value: t, label: t }))}
                />
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
                <ThemedSelect
                  value={seqEpisodeId}
                  onChange={setSeqEpisodeId}
                  options={[{ value: '', label: 'Select episode' }, ...episodes.map((e) => ({ value: e.id, label: `${e.code} (${e.title || ''})` }))]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Sequence code</label>
                <input value={seqCode} onChange={(e) => setSeqCode(e.target.value)} className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary" placeholder="sq01" />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Stage</label>
                <ThemedSelect value={sequenceStage} onChange={setSequenceStage} options={STAGES.map((s) => ({ value: s, label: s }))} />
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
                <ThemedSelect
                  value={shotEpisodeId}
                  onChange={(value) => {
                    setShotEpisodeId(value);
                    setShotSequenceId('');
                  }}
                  options={[{ value: '', label: 'Select episode' }, ...episodes.map((e) => ({ value: e.id, label: `${e.code} (${e.title || ''})` }))]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Sequence code</label>
                <ThemedSelect
                  value={shotSequenceId}
                  onChange={setShotSequenceId}
                  options={[
                    { value: '', label: 'Select sequence' },
                    ...sequences
                      .filter((s) => !shotEpisodeId || s.episode_id === shotEpisodeId)
                      .map((s) => ({ value: s.id, label: `${s.code} (${s.name})` })),
                  ]}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-muted mb-1">Shot code</label>
                <input value={shotCode} onChange={(e) => setShotCode(e.target.value)} className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary" placeholder="sh001" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-muted mb-1">Stage</label>
                <ThemedSelect value={shotStage} onChange={setShotStage} options={STAGES.map((s) => ({ value: s, label: s }))} />
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
            <ThemedSelect
              value={entityType}
              onChange={setEntityType}
              className="min-w-[170px]"
              options={[
                { value: 'assets', label: 'Assets' },
                { value: 'episodes', label: 'Episodes' },
                { value: 'sequences', label: 'Sequences' },
                { value: 'shots', label: 'Shots' },
              ]}
            />
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
