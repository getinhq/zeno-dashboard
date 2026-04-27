import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bug, Columns, List, Paperclip, Plus, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useProjectContext } from '../contexts/ProjectContext';
import { useAuth } from '../contexts/AuthContext';
import {
  useAssets,
  useCreateIssue,
  useIssues,
  useProjectShots,
  useUsers,
} from '../api/hooks';
import { api } from '../api/client';
import { StatusPill } from '../components/StatusPill';
import { ThemedSelect } from '../components/ThemedSelect';
import { SearchableSelect } from '../components/SearchableSelect';
import { canCreateIssueFromWeb } from '../lib/permissions';
import { usePersistedView } from '../lib/usePersistedView';
import { IssueDetail } from './IssueDetail';

const COLUMNS = [
  { key: 'not_started', label: 'Not Started' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'testing', label: 'Testing' },
  { key: 'closed', label: 'Closed' },
];

const DCC_OPTIONS = ['maya', 'blender', 'nuke', 'houdini'];

// Sentinel values used in URL params and forwarded to the API. Keep them in
// sync with backend normalisation (``?assignee_id=none`` → ``IS NULL``).
const FILTER_NONE = 'none';
const FILTER_ME = 'me';

function EntityChip({ entity }) {
  if (!entity) return null;
  return (
    <span className="text-[10px] font-mono uppercase text-primary/80 tracking-wider truncate max-w-[140px]">
      {entity.type === 'asset' ? 'ASSET' : 'SHOT'}: {entity.code || entity.name || entity.id}
    </span>
  );
}

function IssueCard({ issue, onDragStart, onClick, readOnly }) {
  return (
    <div
      draggable={!readOnly}
      onDragStart={(e) => onDragStart?.(e, issue)}
      onClick={() => onClick?.(issue)}
      className="glass-panel p-4 flex flex-col gap-2 cursor-pointer hover:border-primary/60 transition-all"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono uppercase text-muted tracking-wider">
          {issue.dcc ? issue.dcc : 'N/A'}
        </span>
        <StatusPill status={issue.status} />
      </div>
      <h4 className="font-semibold text-sm text-foreground leading-tight">{issue.title}</h4>
      {issue.entity && <EntityChip entity={issue.entity} />}
      {issue.body && <p className="text-muted text-xs line-clamp-2">{issue.body}</p>}
      <div className="text-[10px] text-muted font-mono mt-1">
        {issue.created_at ? new Date(issue.created_at).toLocaleString() : ''}
      </div>
    </div>
  );
}

function IssueColumn({ column, items, onDrop, onDragStart, onOpen, readOnly }) {
  return (
    <div
      className="w-[300px] flex-shrink-0 flex flex-col"
      onDragOver={(e) => {
        if (readOnly) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (readOnly) return;
        const id = e.dataTransfer.getData('application/zeno-issue-id');
        if (id) onDrop(id, column.key);
      }}
    >
      <div className="flex justify-between items-center mb-4 px-2">
        <h3 className="font-medium text-sm text-foreground uppercase tracking-wider">
          {column.label}
        </h3>
        <span className="bg-card text-muted text-xs border border-border px-2 py-0.5 rounded-full font-mono">
          {items.length}
        </span>
      </div>
      <div className="flex-1 space-y-3">
        {items.map((issue) => (
          <IssueCard
            key={issue.id}
            issue={issue}
            onDragStart={onDragStart}
            onClick={onOpen}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  );
}

function IssuesTable({ issues, onOpen }) {
  if (!issues.length) {
    return (
      <div className="glass-panel p-8 text-center text-muted text-sm">
        No issues match the current filter.
      </div>
    );
  }
  return (
    <div className="glass-panel rounded-lg overflow-hidden border border-border">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-muted uppercase bg-card/50 backdrop-blur-md">
          <tr>
            <th className="px-6 py-4 font-medium border-b border-border">Title</th>
            <th className="px-6 py-4 font-medium border-b border-border">Entity</th>
            <th className="px-6 py-4 font-medium border-b border-border">DCC</th>
            <th className="px-6 py-4 font-medium border-b border-border">Reporter</th>
            <th className="px-6 py-4 font-medium border-b border-border">Assignee</th>
            <th className="px-6 py-4 font-medium border-b border-border">Status</th>
            <th className="px-6 py-4 font-medium border-b border-border text-right">Updated</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((i) => (
            <tr
              key={i.id}
              onClick={() => onOpen?.(i)}
              className="hover:bg-card-hover/40 border-b border-border/50 transition-colors group cursor-pointer"
            >
              <td className="px-6 py-4 font-medium group-hover:text-primary transition-colors">
                {i.title}
              </td>
              <td className="px-6 py-4 text-muted text-xs font-mono uppercase">
                {i.entity
                  ? `${i.entity.type === 'asset' ? 'Asset' : 'Shot'}: ${i.entity.code || i.entity.name || ''}`
                  : '—'}
              </td>
              <td className="px-6 py-4 font-mono uppercase text-muted text-xs">
                {i.dcc || 'N/A'}
              </td>
              <td className="px-6 py-4 text-muted text-sm">
                {i.reporter_name || i.reporter_username || '—'}
              </td>
              <td className="px-6 py-4 text-muted text-sm">
                {i.assignee_name || i.assignee_username || 'Unassigned'}
              </td>
              <td className="px-6 py-4">
                <StatusPill status={i.status} />
              </td>
              <td className="px-6 py-4 text-muted text-sm text-right">
                {i.updated_at ? new Date(i.updated_at).toLocaleString() : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NewIssueModal({ onClose, onCreate, busy, errorMessage, projectId }) {
  const [form, setForm] = useState({
    title: '',
    body: '',
    assignee_id: '',
    dcc: '',
    entityKey: '',
  });
  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);
  const { data: users = [] } = useUsers({ is_active: true });
  const { data: assets = [] } = useAssets(projectId);
  const { data: shotList = [] } = useProjectShots(projectId, { limit: 500 });
  const shots = Array.isArray(shotList) ? shotList : shotList?.items || [];

  const entityOptions = useMemo(() => {
    const opts = [{ value: '', label: 'No entity (project-level)' }];
    for (const a of assets) {
      opts.push({
        value: `asset:${a.id}`,
        label: `Asset — ${a.code || a.name || a.id}`,
      });
    }
    for (const s of shots) {
      opts.push({
        value: `shot:${s.id}`,
        label: `Shot — ${s.shot_code || s.code || s.id}`,
      });
    }
    return opts;
  }, [assets, shots]);

  const addFiles = (list) => {
    if (!list) return;
    const picked = Array.from(list);
    setFiles((prev) => {
      // Dedupe by name+size so re-picking the same file doesn't double it up.
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
      const merged = [...prev];
      for (const f of picked) {
        const key = `${f.name}:${f.size}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(f);
        }
      }
      return merged;
    });
  };

  const removeFile = (idx) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-lg bg-card border border-border shadow-xl rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-serif font-semibold text-foreground">New issue</h3>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground p-1">
            ×
          </button>
        </div>
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs uppercase text-muted mb-1">Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm focus:outline-none focus:border-primary"
              placeholder="Short, descriptive summary"
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-muted mb-1">Details</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              rows={5}
              className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-muted mb-1">Assignee</label>
            <ThemedSelect
              value={form.assignee_id}
              onChange={(v) => setForm((f) => ({ ...f, assignee_id: v }))}
              options={[
                { value: '', label: 'Unassigned' },
                ...users.map((u) => ({ value: u.id, label: u.name || u.username })),
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase text-muted mb-1">Entity</label>
              <ThemedSelect
                value={form.entityKey}
                onChange={(v) => setForm((f) => ({ ...f, entityKey: v }))}
                options={entityOptions}
              />
            </div>
            <div>
              <label className="block text-xs uppercase text-muted mb-1">DCC</label>
              <ThemedSelect
                value={form.dcc}
                onChange={(v) => setForm((f) => ({ ...f, dcc: v }))}
                options={[
                  { value: '', label: 'None' },
                  ...DCC_OPTIONS.map((d) => ({ value: d, label: d })),
                ]}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase text-muted mb-1">Attachments</label>
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary text-xs px-2 py-1 inline-flex items-center gap-1"
              >
                <Paperclip className="w-3 h-3" /> Add files
              </button>
              <span className="text-xs text-muted">
                Images, videos, or any supporting files.
              </span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>
            {files.length > 0 && (
              <ul className="space-y-1 text-xs">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}:${f.size}:${i}`}
                    className="flex items-center gap-2 bg-background/60 border border-border rounded px-2 py-1"
                  >
                    <span className="truncate flex-1 text-foreground" title={f.name}>
                      {f.name}
                    </span>
                    <span className="text-muted font-mono">
                      {(f.size / 1024).toFixed(0)} KB
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="text-muted hover:text-danger p-0.5"
                      aria-label={`Remove ${f.name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {errorMessage && <p className="text-danger text-sm">{errorMessage}</p>}
        </div>
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !form.title.trim()}
            onClick={() => {
              const [kind, id] = (form.entityKey || '').split(':');
              onCreate(
                {
                  title: form.title.trim(),
                  body: form.body.trim() || null,
                  assignee_id: form.assignee_id || null,
                  status: form.assignee_id ? 'in_progress' : 'not_started',
                  dcc: form.dcc || null,
                  asset_id: kind === 'asset' ? id : null,
                  shot_id: kind === 'shot' ? id : null,
                  source: 'web',
                },
                files,
              );
            }}
            className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create issue'}
          </button>
        </div>
      </div>
    </div>
  );
}

function useIssueStatusMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => api.patch(`/api/v1/issues/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['issues'] }),
  });
}

export function Issues() {
  const { projectId, isReadOnly } = useProjectContext();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = usePersistedView('zeno_view_issues', 'kanban');
  const statusFilter = searchParams.get('status') || '';
  const dccFilter = searchParams.get('dcc') || '';
  const reporterFilter = searchParams.get('reporter_id') || '';
  const assigneeFilter = searchParams.get('assignee_id') || '';
  const entityFilter = searchParams.get('entity') || ''; // "asset:<id>" or "shot:<id>"

  const { data: allUsers = [] } = useUsers({ is_active: true });
  const { data: assets = [] } = useAssets(projectId);
  const { data: shotList = [] } = useProjectShots(projectId, { limit: 500 });
  const shots = Array.isArray(shotList) ? shotList : shotList?.items || [];

  // Translate "me" sentinel to the real current user id before hitting the
  // API. Keep the URL sentinel untouched so the filter survives user switches.
  const apiAssignee = assigneeFilter === FILTER_ME ? user?.id || '' : assigneeFilter;
  const apiReporter = reporterFilter === FILTER_ME ? user?.id || '' : reporterFilter;
  const [entityKind, entityId] = entityFilter.split(':');

  const { data: allIssues = [], refetch } = useIssues(projectId, {
    status: statusFilter || undefined,
    dcc: dccFilter || undefined,
    reporter_id: apiReporter || undefined,
    assignee_id: apiAssignee || undefined,
    asset_id: entityKind === 'asset' ? entityId : undefined,
    shot_id: entityKind === 'shot' ? entityId : undefined,
    refetchInterval: 30_000,
  });
  const createIssue = useCreateIssue();
  const moveIssue = useIssueStatusMutation();
  const [createOpen, setCreateOpen] = useState(false);
  const [openId, setOpenId] = useState(null);

  const issues = allIssues;

  const byStatus = useMemo(() => {
    const out = { not_started: [], in_progress: [], testing: [], closed: [] };
    for (const i of issues) {
      // Older rows that still say 'unassigned' bucket into not_started until
      // a mutation rewrites them.
      const key = i.status === 'unassigned' ? 'not_started' : i.status;
      (out[key] || out.not_started).push(i);
    }
    return out;
  }, [issues]);

  const setStatusFilter = (s) =>
    setSearchParams((p) => {
      if (s) p.set('status', s);
      else p.delete('status');
      return p;
    });
  const setDccFilter = (s) =>
    setSearchParams((p) => {
      if (s) p.set('dcc', s);
      else p.delete('dcc');
      return p;
    });
  const setReporterFilter = (s) =>
    setSearchParams((p) => {
      if (s) p.set('reporter_id', s);
      else p.delete('reporter_id');
      return p;
    });
  const setAssigneeFilter = (s) =>
    setSearchParams((p) => {
      if (s) p.set('assignee_id', s);
      else p.delete('assignee_id');
      return p;
    });
  const setEntityFilter = (s) =>
    setSearchParams((p) => {
      if (s) p.set('entity', s);
      else p.delete('entity');
      return p;
    });

  const userOption = (u) => ({
    value: u.id,
    label: u.name || u.username || u.email || u.id,
    sublabel: u.department || u.username || '',
  });

  const assigneeSections = useMemo(
    () => [
      {
        id: 'quick',
        options: [
          { value: '', label: 'All assignees' },
          ...(user?.id
            ? [{ value: FILTER_ME, label: 'Me (current user)' }]
            : []),
          { value: FILTER_NONE, label: 'Unassigned' },
        ],
        filterable: false,
      },
      {
        id: 'all',
        label: 'All users',
        options: allUsers.map(userOption),
      },
    ],
    [allUsers, user?.id],
  );

  const reporterSections = useMemo(
    () => [
      {
        id: 'quick',
        options: [
          { value: '', label: 'All reporters' },
          ...(user?.id
            ? [{ value: FILTER_ME, label: 'Me (current user)' }]
            : []),
        ],
        filterable: false,
      },
      {
        id: 'all',
        label: 'All users',
        options: allUsers.map(userOption),
      },
    ],
    [allUsers, user?.id],
  );

  const entitySections = useMemo(() => {
    const assetOpts = assets.map((a) => ({
      value: `asset:${a.id}`,
      label: a.code || a.name || a.id,
      sublabel: `Asset${a.name && a.code ? ` — ${a.name}` : ''}`,
    }));
    const shotOpts = shots.map((s) => ({
      value: `shot:${s.id}`,
      label: s.shot_code || s.code || s.id,
      sublabel: 'Shot',
    }));
    return [
      {
        id: 'quick',
        options: [{ value: '', label: 'All entities' }],
        filterable: false,
      },
      ...(assetOpts.length ? [{ id: 'assets', label: 'Assets', options: assetOpts }] : []),
      ...(shotOpts.length ? [{ id: 'shots', label: 'Shots', options: shotOpts }] : []),
    ];
  }, [assets, shots]);

  const handleDragStart = (e, issue) => {
    e.dataTransfer.setData('application/zeno-issue-id', issue.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted gap-2">
        <Bug className="w-6 h-6" />
        <p>Select a project to see its issues.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-4xl font-serif text-foreground font-bold">Issues</h1>
          <p className="text-muted text-sm tracking-wide mt-1">
            Triage, assign, and track issues raised from DCCs or the web.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <ThemedSelect
            value={statusFilter}
            onChange={setStatusFilter}
            className="min-w-[160px]"
            options={[
              { value: '', label: 'All statuses' },
              ...COLUMNS.map((c) => ({ value: c.key, label: c.label })),
            ]}
          />
          <ThemedSelect
            value={dccFilter}
            onChange={setDccFilter}
            className="min-w-[140px]"
            options={[
              { value: '', label: 'All DCCs' },
              { value: FILTER_NONE, label: 'N/A' },
              ...DCC_OPTIONS.map((d) => ({ value: d, label: d })),
            ]}
          />
          <SearchableSelect
            value={reporterFilter}
            onChange={setReporterFilter}
            placeholder="All reporters"
            searchPlaceholder="Search reporters…"
            className="min-w-[180px]"
            sections={reporterSections}
          />
          <SearchableSelect
            value={assigneeFilter}
            onChange={setAssigneeFilter}
            placeholder="All assignees"
            searchPlaceholder="Search assignees…"
            className="min-w-[180px]"
            sections={assigneeSections}
          />
          <SearchableSelect
            value={entityFilter}
            onChange={setEntityFilter}
            placeholder="All entities"
            searchPlaceholder="Search assets or shots…"
            className="min-w-[180px]"
            sections={entitySections}
          />
          <div className="flex bg-card p-1 rounded-md border border-border">
            <button
              type="button"
              onClick={() => setView('table')}
              className={`p-1.5 rounded transition ${view === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-foreground hover:bg-card-hover'}`}
              aria-label="List view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setView('kanban')}
              className={`p-1.5 rounded transition ${view === 'kanban' ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-foreground hover:bg-card-hover'}`}
              aria-label="Kanban view"
            >
              <Columns className="w-4 h-4" />
            </button>
          </div>
          {canCreateIssueFromWeb(user) && !isReadOnly && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="btn-primary flex items-center gap-2 px-3 py-1.5 text-sm"
            >
              <Plus className="w-4 h-4" /> New Issue
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {view === 'table' ? (
          <IssuesTable issues={issues} onOpen={(i) => setOpenId(i.id)} />
        ) : (
          <div className="flex gap-6 overflow-x-auto pb-4">
            {COLUMNS.map((col) => (
              <IssueColumn
                key={col.key}
                column={col}
                items={byStatus[col.key] || []}
                onDrop={(id, status) =>
                  moveIssue.mutate({ id, status }, { onSuccess: () => refetch() })
                }
                onDragStart={handleDragStart}
                onOpen={(i) => setOpenId(i.id)}
                readOnly={isReadOnly}
              />
            ))}
          </div>
        )}
      </div>

      {createOpen && (
        <NewIssueModal
          projectId={projectId}
          onClose={() => setCreateOpen(false)}
          busy={createIssue.isPending}
          errorMessage={createIssue.error?.message || ''}
          onCreate={async (body, files) => {
            const created = await createIssue.mutateAsync({
              ...body,
              project_id: projectId,
            });
            if (created?.id && files?.length) {
              // Upload attachments sequentially — sequential is nicer than parallel
              // here because the user can see a failure mid-batch and retry
              // from the detail view without duplicates.
              for (const f of files) {
                const fd = new FormData();
                fd.append('file', f, f.name);
                try {
                  await api.postForm(
                    `/api/v1/issues/${created.id}/attachments/upload`,
                    fd,
                  );
                } catch (err) {
                  console.error('Attachment upload failed:', f.name, err);
                }
              }
            }
            setCreateOpen(false);
            refetch();
          }}
        />
      )}

      {openId && <IssueDetail issueId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

export default Issues;
