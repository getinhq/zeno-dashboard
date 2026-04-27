import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Columns, List, Pencil, Plus } from 'lucide-react';
import { useProjectContext } from '../contexts/ProjectContext';
import { useAuth } from '../contexts/AuthContext';
import {
  useAssets,
  useCreateTask,
  useMyTasks,
  useProjects,
  useProjectShots,
  useTasks,
  useUpdateTaskMutation,
  useUsers,
} from '../api/hooks';
import { StatusPill } from '../components/StatusPill';
import { TableSkeleton } from '../components/Loading';
import { ThemedSelect } from '../components/ThemedSelect';
import { SearchableSelect } from '../components/SearchableSelect';
import { canCreateTask, isManagement } from '../lib/permissions';
import { usePersistedView } from '../lib/usePersistedView';

// Sentinel values mirrored on the backend: ``none`` matches "no assignee",
// ``me`` is translated to the current user id before querying.
const FILTER_NONE = 'none';
const FILTER_ME = 'me';

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'completed', label: 'Completed' },
  { value: 'blocked', label: 'Blocked' },
];

const KANBAN_COLUMNS = [
  { key: 'not_started', label: 'Not Started' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'in_review', label: 'In Review' },
  { key: 'completed', label: 'Completed' },
];

const TASK_TYPES = [
  'model',
  'rig',
  'texture',
  'layout',
  'animation',
  'fx',
  'lighting',
  'render',
  'comp',
];

function normalizeStatus(raw) {
  if (!raw) return 'not_started';
  return (
    {
      todo: 'not_started',
      review: 'in_review',
      done: 'completed',
    }[raw] || raw
  );
}

function TaskRow({ task, onUpdate, readOnly, userById, onEdit, canEdit, getEntityLabel }) {
  const [editing, setEditing] = useState(null);
  const updateTask = useUpdateTaskMutation();
  const currentStatus = normalizeStatus(task.status);
  const assigneeNames = [
    ...(task.assignees || []).map((id) => userById.get(id)?.name || userById.get(id)?.username || id),
    ...(
      task.assignee_id && !(task.assignees || []).includes(task.assignee_id)
        ? [userById.get(task.assignee_id)?.name || userById.get(task.assignee_id)?.username || task.assignee_id]
        : []
    ),
  ];

  const handleStatusChange = (status) => {
    setEditing(null);
    if (readOnly) return;
    updateTask.mutate({ taskId: task.id, body: { status } }, { onSuccess: () => onUpdate?.() });
  };
  const handleDueDateChange = (e) => {
    const v = e.target.value;
    if (!v || readOnly) return;
    setEditing(null);
    updateTask.mutate({ taskId: task.id, body: { due_date: v } }, { onSuccess: () => onUpdate?.() });
  };

  return (
    <tr className="hover:bg-card-hover/40 border-b border-border/50 transition-colors group">
      <td className="px-6 py-4 font-medium group-hover:text-primary transition-colors">
        <Link to={`/task/${task.id}`} className="link-hover">
          {task.title || task.type}
        </Link>
      </td>
      <td className="px-6 py-4 font-mono text-muted">
        {getEntityLabel(task)}
      </td>
      <td className="px-6 py-4 text-foreground">{task.type}</td>
      <td className="px-6 py-4 text-muted text-sm">
        {assigneeNames.length ? assigneeNames.join(', ') : 'Unassigned'}
      </td>
      <td className="px-6 py-4">
        {editing === 'status' ? (
          <ThemedSelect
            value={currentStatus}
            onChange={handleStatusChange}
            className="w-36"
            options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
        ) : (
          <button
            type="button"
            onClick={() => !readOnly && setEditing('status')}
            className="text-left"
            disabled={readOnly}
          >
            <StatusPill status={currentStatus} />
          </button>
        )}
      </td>
      <td className="px-6 py-4 text-muted text-sm">
        {editing === 'due_date' ? (
          <input
            type="date"
            defaultValue={task.due_date ? task.due_date.slice(0, 10) : ''}
            onBlur={(e) => {
              handleDueDateChange(e);
              setEditing(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && (handleDueDateChange(e), setEditing(null))}
            className="bg-background border border-border rounded px-2 py-1 text-foreground text-sm w-36 focus:border-primary outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => !readOnly && setEditing('due_date')}
            className="text-left hover:bg-card-hover rounded px-1 -mx-1 text-muted"
            disabled={readOnly}
          >
            {task.due_date ? new Date(task.due_date).toLocaleDateString() : '—'}
          </button>
        )}
      </td>
      <td className="px-6 py-4 text-muted text-sm text-right">
        {task.updated_at ? new Date(task.updated_at).toLocaleString() : '—'}
      </td>
      <td className="px-6 py-4 text-right">
        {canEdit && (
          <button
            type="button"
            onClick={() => onEdit?.(task)}
            className="btn-secondary inline-flex items-center gap-1 px-2 py-1 text-xs"
            disabled={readOnly}
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
        )}
      </td>
    </tr>
  );
}

function TasksTable({ tasks, onUpdate, readOnly, userById, onEdit, canEdit, getEntityLabel }) {
  return (
    <div className="glass-panel rounded-lg overflow-hidden border border-border">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-muted uppercase bg-card/50 backdrop-blur-md">
          <tr>
            <th className="px-6 py-4 font-medium border-b border-border">Task</th>
            <th className="px-6 py-4 font-medium border-b border-border">Entity</th>
            <th className="px-6 py-4 font-medium border-b border-border">Dept</th>
            <th className="px-6 py-4 font-medium border-b border-border">Assignees</th>
            <th className="px-6 py-4 font-medium border-b border-border">Status</th>
            <th className="px-6 py-4 font-medium border-b border-border">Due date</th>
            <th className="px-6 py-4 font-medium border-b border-border text-right">Updated</th>
            <th className="px-6 py-4 font-medium border-b border-border text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onUpdate={onUpdate}
              readOnly={readOnly}
              userById={userById}
              onEdit={onEdit}
              canEdit={canEdit}
              getEntityLabel={getEntityLabel}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskKanbanCard({ task, onDragStart, readOnly, userById, onEdit, canEdit, getEntityLabel }) {
  const assigneeNames = [
    ...(task.assignees || []).map((id) => userById.get(id)?.name || userById.get(id)?.username || id),
    ...(
      task.assignee_id && !(task.assignees || []).includes(task.assignee_id)
        ? [userById.get(task.assignee_id)?.name || userById.get(task.assignee_id)?.username || task.assignee_id]
        : []
    ),
  ];
  return (
    <div
      draggable={!readOnly}
      onDragStart={(e) => onDragStart?.(e, task)}
      className="block group"
    >
      <Link to={`/task/${task.id}`} className="block">
        <div className="glass-panel p-4 flex flex-col gap-3 group-hover:border-primary/50 transition-all cursor-pointer group-hover:-translate-y-0.5">
          <div className="flex justify-between items-start">
            <span className="text-xs font-mono px-2 py-0.5 bg-background border border-border rounded text-muted">
              {getEntityLabel(task)}
            </span>
          </div>
          <h4 className="font-semibold text-sm leading-tight text-foreground group-hover:text-primary transition-colors">
            {task.title || task.type}
          </h4>
          <p className="text-xs text-muted truncate">
            {assigneeNames.length ? `Assignee: ${assigneeNames.join(', ')}` : 'Assignee: Unassigned'}
          </p>
          <div className="flex items-center justify-between text-xs mt-2">
            <span className="text-muted font-mono">
              {task.due_date ? new Date(task.due_date).toLocaleDateString() : '—'}
            </span>
            {canEdit && (
              <button
                type="button"
                className="text-muted hover:text-foreground"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onEdit?.(task);
                }}
                disabled={readOnly}
                title="Edit task"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <StatusPill status={normalizeStatus(task.status)} className="mt-2" />
        </div>
      </Link>
    </div>
  );
}

function KanbanColumn({ column, tasks, onDropTask, readOnly, userById, onEdit, canEdit, getEntityLabel }) {
  const handleDrop = (e) => {
    e.preventDefault();
    if (readOnly) return;
    const taskId = e.dataTransfer.getData('application/zeno-task-id');
    if (taskId && column.key) onDropTask(taskId, column.key);
  };
  const handleDragStart = (e, task) => {
    e.dataTransfer.setData('application/zeno-task-id', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };
  return (
    <div
      className="w-[300px] flex-shrink-0 flex flex-col"
      onDragOver={(e) => {
        if (readOnly) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDrop={handleDrop}
    >
      <div className="flex justify-between items-center mb-4 px-2">
        <h3 className="font-medium text-sm text-foreground uppercase tracking-wider">
          {column.label}
        </h3>
        <span className="bg-card text-muted text-xs border border-border px-2 py-0.5 rounded-full font-mono">
          {tasks.length}
        </span>
      </div>
      <div className="flex-1 space-y-3">
        {tasks.map((task) => (
          <TaskKanbanCard
            key={task.id}
            task={task}
            onDragStart={handleDragStart}
            readOnly={readOnly}
            userById={userById}
            onEdit={onEdit}
            canEdit={canEdit}
            getEntityLabel={getEntityLabel}
          />
        ))}
      </div>
    </div>
  );
}

// Some entity "stages" (e.g. shot stages like "Layout"/"Animation") don't map
// 1:1 to the DB's ``tasks.type`` enum. This table normalises the label we show
// in the dropdown to a valid ``type`` value, so we can still store richer
// stage metadata without blowing up the CHECK constraint.
const STAGE_TO_TYPE = {
  animatics: 'layout',
  layout: 'layout',
  animation: 'animation',
  lighting: 'lighting',
  comp: 'comp',
  model: 'model',
  rig: 'rig',
  texture: 'texture',
  fx: 'fx',
  render: 'render',
};

function resolveTaskType(stageLabel) {
  if (!stageLabel) return 'model';
  return STAGE_TO_TYPE[stageLabel.trim().toLowerCase()] || 'model';
}

function NewTaskModal({ onClose, onCreate, busy, errorMessage, projectId }) {
  const [form, setForm] = useState({
    project_id: projectId || '',
    entityKey: '', // "asset:<id>" | "shot:<id>" | ""
    stage: 'model',
    title: '',
    description: '',
    assignees: [],
    reviewer_id: '',
    collaborators: [],
    due_date: '',
  });
  const { data: projects = [] } = useProjects({ status: 'active' });
  const { data: artists = [] } = useUsers({ app_role: 'artist', is_active: true });
  const { data: reviewers = [] } = useUsers({ is_active: true });
  const { data: assets = [] } = useAssets(form.project_id || undefined);
  const { data: shotList = [] } = useProjectShots(form.project_id || undefined, { limit: 500 });
  const shots = Array.isArray(shotList) ? shotList : shotList?.items || [];

  const entityOptions = useMemo(() => {
    const opts = [{ value: '', label: 'No entity (generic task)' }];
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

  // Stage options depend on the picked entity so artists are steered toward
  // only those stages that make sense for a given asset/shot.
  const stageOptions = useMemo(() => {
    if (!form.entityKey) return TASK_TYPES.map((t) => ({ value: t, label: t }));
    const [kind, id] = form.entityKey.split(':');
    if (kind === 'asset') {
      const a = assets.find((x) => x.id === id);
      const stages = Array.isArray(a?.pipeline_stages) ? a.pipeline_stages : [];
      if (stages.length) {
        return stages.map((s) => ({ value: s, label: s }));
      }
      // Some projects don't declare pipeline_stages — fall back to the full set.
      return TASK_TYPES.map((t) => ({ value: t, label: t }));
    }
    if (kind === 'shot') {
      const s = shots.find((x) => x.id === id);
      const stage = s?.stage;
      if (stage) return [{ value: stage, label: stage }];
    }
    return TASK_TYPES.map((t) => ({ value: t, label: t }));
  }, [form.entityKey, assets, shots]);

  // Keep the picked stage valid as entity changes: if current stage isn't in
  // the new list, snap to the first available option.
  const stageValue = useMemo(() => {
    if (stageOptions.some((o) => o.value === form.stage)) return form.stage;
    return stageOptions[0]?.value || '';
  }, [stageOptions, form.stage]);

  const toggleId = (key) => (id) => {
    setForm((f) => {
      const set = new Set(f[key] || []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...f, [key]: Array.from(set) };
    });
  };

  const canSubmit = !!stageValue && !busy;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-lg bg-card border border-border shadow-xl rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-serif font-semibold text-foreground">New task</h3>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground p-1">
            ×
          </button>
        </div>
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs uppercase text-muted mb-1">Project (optional)</label>
            <ThemedSelect
              value={form.project_id}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  project_id: v || '',
                  entityKey: '',
                }))
              }
              options={[
                { value: '', label: 'No project (general task)' },
                ...projects.map((p) => ({
                  value: p.id,
                  label: `${p.code || p.name || p.id}${p.name && p.code ? ` — ${p.name}` : ''}`,
                })),
              ]}
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-muted mb-1">Entity</label>
            <ThemedSelect
              disabled={!form.project_id}
              value={form.entityKey}
              onChange={(v) => setForm((f) => ({ ...f, entityKey: v }))}
              options={entityOptions}
            />
            <p className="text-[10px] text-muted mt-1">
              {form.project_id
                ? `Optional: pick the asset or shot this task targets so the stage list reflects that entity's pipeline.`
                : 'Pick a project first if you want to link this task to an asset or shot.'}
            </p>
          </div>
          <div>
            <label className="block text-xs uppercase text-muted mb-1">Stage</label>
            <ThemedSelect
              value={stageValue}
              onChange={(v) => setForm((f) => ({ ...f, stage: v }))}
              options={stageOptions}
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-muted mb-1">Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm focus:outline-none focus:border-primary"
              placeholder="Hero character blockout"
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-muted mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-muted mb-1">Due date</label>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              className="rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-muted mb-1">Assignees (Artists)</label>
            <div className="max-h-32 overflow-y-auto border border-border rounded-md">
              {artists.length === 0 ? (
                <p className="text-muted text-xs p-2">No artists found.</p>
              ) : (
                artists.map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-card-hover cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={form.assignees.includes(u.id)}
                      onChange={() => toggleId('assignees')(u.id)}
                      className="accent-primary"
                    />
                    <span className="text-foreground">{u.name || u.username}</span>
                    <span className="text-muted text-xs ml-auto">{u.username}</span>
                  </label>
                ))
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase text-muted mb-1">Reviewer</label>
            <ThemedSelect
              value={form.reviewer_id || ''}
              onChange={(v) => setForm((f) => ({ ...f, reviewer_id: v }))}
              options={[
                { value: '', label: 'No reviewer' },
                ...reviewers.map((u) => ({
                  value: u.id,
                  label: `${u.name || u.username} (${u.app_role || u.role || ''})`,
                })),
              ]}
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-muted mb-1">
              Collaborators (optional)
            </label>
            <div className="max-h-32 overflow-y-auto border border-border rounded-md">
              {reviewers.length === 0 ? (
                <p className="text-muted text-xs p-2">No users yet.</p>
              ) : (
                reviewers.map((u) => (
                  <label
                    key={u.id}
                    className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-card-hover cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={form.collaborators.includes(u.id)}
                      onChange={() => toggleId('collaborators')(u.id)}
                      className="accent-primary"
                    />
                    <span className="text-foreground">{u.name || u.username}</span>
                  </label>
                ))
              )}
            </div>
          </div>
          {errorMessage && <p className="text-danger text-sm">{errorMessage}</p>}
        </div>
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              const [kind, id] = (form.entityKey || '').split(':');
              onCreate({
                project_id: form.project_id || null,
                type: resolveTaskType(stageValue),
                title: form.title.trim() || null,
                description: form.description.trim() || null,
                status: 'not_started',
                reviewer_id: form.reviewer_id || null,
                assignees: form.assignees,
                collaborators: form.collaborators,
                due_date: form.due_date || null,
                asset_id: kind === 'asset' ? id : null,
                shot_id: kind === 'shot' ? id : null,
                // Preserve the original stage label (e.g. "Animatics") which
                // may not survive the ``type`` enum mapping.
                metadata: { stage: stageValue },
              });
            }}
            className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create task'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditTaskModal({ task, users, busy, errorMessage, onClose, onSave }) {
  const [form, setForm] = useState({
    title: task.title || '',
    description: task.description || '',
    type: task.type || 'model',
    status: normalizeStatus(task.status),
    due_date: task.due_date ? task.due_date.slice(0, 10) : '',
    assignees: Array.from(new Set([...(task.assignees || []), ...(task.assignee_id ? [task.assignee_id] : [])])),
    reviewer_id: task.reviewer_id || '',
    collaborators: task.collaborators || [],
  });

  const toggleId = (key) => (id) => {
    setForm((f) => {
      const set = new Set(f[key] || []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...f, [key]: Array.from(set) };
    });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-lg bg-card border border-border shadow-xl rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-serif font-semibold text-foreground">Edit task</h3>
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
              className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-muted mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase text-muted mb-1">Type</label>
              <ThemedSelect
                value={form.type}
                onChange={(v) => setForm((f) => ({ ...f, type: v }))}
                options={TASK_TYPES.map((t) => ({ value: t, label: t }))}
              />
            </div>
            <div>
              <label className="block text-xs uppercase text-muted mb-1">Status</label>
              <ThemedSelect
                value={form.status}
                onChange={(v) => setForm((f) => ({ ...f, status: v }))}
                options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase text-muted mb-1">Due date</label>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              className="rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-muted mb-1">Assignees</label>
            <div className="max-h-36 overflow-y-auto border border-border rounded-md">
              {users.map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-card-hover cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={form.assignees.includes(u.id)}
                    onChange={() => toggleId('assignees')(u.id)}
                    className="accent-primary"
                  />
                  <span className="text-foreground">{u.name || u.username}</span>
                  <span className="text-muted text-xs ml-auto">{u.username}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase text-muted mb-1">Reviewer</label>
            <ThemedSelect
              value={form.reviewer_id}
              onChange={(v) => setForm((f) => ({ ...f, reviewer_id: v }))}
              options={[
                { value: '', label: 'No reviewer' },
                ...users.map((u) => ({ value: u.id, label: u.name || u.username })),
              ]}
            />
          </div>
          {errorMessage && <p className="text-danger text-sm">{errorMessage}</p>}
        </div>
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50"
            onClick={() =>
              onSave({
                title: form.title.trim() || null,
                description: form.description.trim() || null,
                type: form.type,
                status: form.status,
                due_date: form.due_date || null,
                assignees: form.assignees,
                assignee_id: form.assignees[0] || null,
                reviewer_id: form.reviewer_id || null,
                collaborators: form.collaborators,
              })
            }
          >
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Tasks() {
  const { projectId, isReadOnly } = useProjectContext();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = usePersistedView('zeno_view_tasks', 'kanban');
  const statusFilter = searchParams.get('status') || '';
  // "Department" UI label, but the value is the pipeline *stage* label from
  // entities (e.g. "Animation") — which is closer to how studios think of
  // departments/teams than the users.department column.
  const stageFilter = searchParams.get('stage') || '';
  const assigneeFilter = searchParams.get('assignee_id') || '';
  const entityFilter = searchParams.get('entity') || ''; // "asset:<id>" or "shot:<id>"
  const mine = searchParams.get('scope') !== 'all' && !isManagement(user);

  const { data: allUsers = [] } = useUsers({ is_active: true });
  const { data: assets = [] } = useAssets(projectId);
  const { data: shotList = [] } = useProjectShots(projectId, { limit: 500 });
  const shots = Array.isArray(shotList) ? shotList : shotList?.items || [];

  // Union of all pipeline stages declared on the project's entities. Keeps the
  // filter meaningful even if a project uses custom stage names.
  const stageOptions = useMemo(() => {
    const seen = new Set();
    for (const a of assets) {
      for (const s of a.pipeline_stages || []) {
        const v = String(s || '').trim();
        if (v) seen.add(v);
      }
    }
    for (const sh of shots) {
      const v = String(sh.stage || '').trim();
      if (v) seen.add(v);
    }
    // Fall back to the generic task types when no entity-level stages exist
    // yet — keeps the filter usable on a fresh project.
    if (seen.size === 0) TASK_TYPES.forEach((t) => seen.add(t));
    return Array.from(seen).sort().map((v) => ({ value: v, label: v }));
  }, [assets, shots]);

  const [entityKind, entityId] = entityFilter.split(':');
  const apiAssignee = assigneeFilter === FILTER_ME ? user?.id || '' : assigneeFilter;
  // Stage → task.type. STAGE_TO_TYPE handles the "Animatics" style labels;
  // anything unknown (e.g. custom stage) is forwarded verbatim so custom
  // ``tasks.type`` values still work.
  const typeFromStage = stageFilter
    ? STAGE_TO_TYPE[stageFilter.trim().toLowerCase()] || stageFilter
    : '';

  const filters = { project_id: projectId || undefined };
  if (statusFilter) filters.status = statusFilter;
  if (typeFromStage) filters.type = typeFromStage;
  if (apiAssignee) filters.assignee_id = apiAssignee;
  if (entityKind === 'asset' && entityId) filters.asset_id = entityId;
  if (entityKind === 'shot' && entityId) filters.shot_id = entityId;

  const scopedAll = useTasks(filters);
  const scopedMine = useMyTasks(projectId);
  // My-Tasks is an artist-only view that doesn't hit the filter API, so we
  // apply stage/assignee/entity client-side to keep both views consistent.
  const rawTasks = (mine ? scopedMine.data : scopedAll.data) || [];
  const refetch = mine ? scopedMine.refetch : scopedAll.refetch;
  const isLoading = mine ? scopedMine.isLoading : scopedAll.isLoading;

  const tasks = useMemo(() => {
    if (!mine) return rawTasks;
    return rawTasks.filter((t) => {
      if (typeFromStage && t.type !== typeFromStage) return false;
      if (apiAssignee === '' && assigneeFilter === FILTER_NONE) {
        const ids = [t.assignee_id, ...(t.assignees || [])].filter(Boolean);
        if (ids.length > 0) return false;
      } else if (apiAssignee) {
        const ids = new Set([t.assignee_id, ...(t.assignees || [])].filter(Boolean));
        if (!ids.has(apiAssignee)) return false;
      }
      if (entityKind === 'asset' && entityId && t.asset_id !== entityId) return false;
      if (entityKind === 'shot' && entityId && t.shot_id !== entityId) return false;
      return true;
    });
  }, [mine, rawTasks, typeFromStage, apiAssignee, assigneeFilter, entityKind, entityId]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const createTask = useCreateTask();
  const updateTask = useUpdateTaskMutation();
  const canEditTask = canCreateTask(user) && !isReadOnly;
  const userById = useMemo(() => new Map(allUsers.map((u) => [u.id, u])), [allUsers]);
  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const shotById = useMemo(() => new Map(shots.map((s) => [s.id, s])), [shots]);
  const getEntityLabel = (task) => {
    if (task.asset_id) {
      const a = assetById.get(task.asset_id);
      const code = a?.code || a?.name || task.asset_id;
      return `Asset: ${code}`;
    }
    if (task.shot_id) {
      const s = shotById.get(task.shot_id);
      const code = s?.shot_code || s?.code || task.shot_id;
      return `Shot: ${code}`;
    }
    return '—';
  };

  const tasksByStatus = useMemo(() => {
    const map = { not_started: [], in_progress: [], in_review: [], completed: [], blocked: [] };
    for (const t of tasks) {
      const key = normalizeStatus(t.status);
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }
    return map;
  }, [tasks]);

  const setStatusFilter = (s) =>
    setSearchParams((p) => {
      if (s) p.set('status', s);
      else p.delete('status');
      return p;
    });
  const setStageFilter = (s) =>
    setSearchParams((p) => {
      if (s) p.set('stage', s);
      else p.delete('stage');
      // Drop the legacy 'department' key if still lurking in the URL so the
      // filter state is unambiguous after navigating from an old link.
      p.delete('department');
      return p;
    });
  const setAssigneeFilter = (a) =>
    setSearchParams((p) => {
      if (a) p.set('assignee_id', a);
      else p.delete('assignee_id');
      return p;
    });
  const setEntityFilter = (v) =>
    setSearchParams((p) => {
      if (v) p.set('entity', v);
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
      ...(assetOpts.length
        ? [{ id: 'assets', label: 'Assets', options: assetOpts }]
        : []),
      ...(shotOpts.length
        ? [{ id: 'shots', label: 'Shots', options: shotOpts }]
        : []),
    ];
  }, [assets, shots]);

  const stageSections = useMemo(
    () => [
      {
        id: 'quick',
        options: [{ value: '', label: 'All departments' }],
        filterable: false,
      },
      { id: 'all', label: 'Stages', options: stageOptions },
    ],
    [stageOptions],
  );

  const handleDropTask = (taskId, newStatus) => {
    if (isReadOnly) return;
    updateTask.mutate(
      { taskId, body: { status: newStatus } },
      { onSuccess: () => refetch() },
    );
  };

  if (isLoading && tasks.length === 0) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="h-10 w-32 bg-border/50 rounded animate-pulse mb-6" />
        <TableSkeleton rows={8} cols={7} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-4xl font-serif text-foreground font-bold">Tasks</h1>
          <p className="text-muted text-sm tracking-wide mt-1">
            {mine ? 'Tasks you are assigned to or collaborating on.' : 'All tasks on this project.'}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <ThemedSelect
            value={statusFilter}
            onChange={setStatusFilter}
            className="min-w-[160px]"
            options={[
              { value: '', label: 'All statuses' },
              ...STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
            ]}
          />
          <SearchableSelect
            value={stageFilter}
            onChange={setStageFilter}
            placeholder="All departments"
            searchPlaceholder="Search stages…"
            className="min-w-[170px]"
            sections={stageSections}
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
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setView('kanban')}
              className={`p-1.5 rounded transition ${view === 'kanban' ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-foreground hover:bg-card-hover'}`}
            >
              <Columns className="w-4 h-4" />
            </button>
          </div>
          {canCreateTask(user) && !isReadOnly && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="btn-primary flex items-center gap-2 px-3 py-1.5 text-sm"
            >
              <Plus className="w-4 h-4" /> New Task
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {view === 'table' ? (
          <TasksTable
            tasks={tasks}
            onUpdate={refetch}
            readOnly={isReadOnly}
            userById={userById}
            onEdit={setEditTask}
            canEdit={canEditTask}
            getEntityLabel={getEntityLabel}
          />
        ) : (
          <div className="flex gap-6 overflow-x-auto pb-4">
            {KANBAN_COLUMNS.map((col) => (
              <KanbanColumn
                key={col.key}
                column={col}
                tasks={tasksByStatus[col.key] || []}
                onDropTask={handleDropTask}
                readOnly={isReadOnly}
                userById={userById}
                onEdit={setEditTask}
                canEdit={canEditTask}
                getEntityLabel={getEntityLabel}
              />
            ))}
          </div>
        )}
      </div>

      {createOpen && (
        <NewTaskModal
          projectId={projectId}
          onClose={() => setCreateOpen(false)}
          busy={createTask.isPending}
          errorMessage={createTask.error?.message || ''}
          onCreate={async (body) => {
            await createTask.mutateAsync(body);
            setCreateOpen(false);
            refetch();
          }}
        />
      )}
      {editTask && (
        <EditTaskModal
          task={editTask}
          users={allUsers}
          busy={updateTask.isPending}
          errorMessage={updateTask.error?.message || ''}
          onClose={() => setEditTask(null)}
          onSave={async (body) => {
            await updateTask.mutateAsync({ taskId: editTask.id, body });
            setEditTask(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
