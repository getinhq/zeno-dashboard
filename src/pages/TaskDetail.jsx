import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProjectContext } from '../contexts/ProjectContext';
import {
  useAssets,
  useProjectShots,
  useTask,
  useTaskEvents,
  useTaskVersions,
  useUpdateTaskMutation,
} from '../api/hooks';
import { StatusPill } from '../components/StatusPill';
import { PageSkeleton } from '../components/Loading';
import { ThemedSelect } from '../components/ThemedSelect';

const STATUS_OPTIONS = [
  { value: 'todo', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Approved' },
  { value: 'blocked', label: 'Blocked' },
];

export function TaskDetail() {
  const { id } = useParams();
  const { projectId } = useProjectContext();
  const { data: task, isLoading, error } = useTask(id);
  const scopedProjectId = projectId || task?.project_id;
  const { data: assets = [] } = useAssets(scopedProjectId);
  const { data: shotList = [] } = useProjectShots(scopedProjectId, { limit: 500 });
  const shots = Array.isArray(shotList) ? shotList : shotList?.items || [];
  const { data: taskVersions = [] } = useTaskVersions(id);
  const { data: events = [] } = useTaskEvents(scopedProjectId, id, { limit: 50, refetchInterval: 30_000 });
  const updateTask = useUpdateTaskMutation();
  const [statusEdit, setStatusEdit] = useState(false);

  if (isLoading) return <PageSkeleton cards={2} hasTable={false} />;
  if (error || !task) return <div className="text-danger">Task not found.</div>;

  const handleStatusChange = (status) => {
    setStatusEdit(false);
    updateTask.mutate({ taskId: task.id, body: { status } });
  };

  const entityLabel = (() => {
    if (task.asset_id) {
      const a = assets.find((x) => x.id === task.asset_id);
      return a ? `Asset: ${a.code || a.name || a.id}` : `Asset: ${task.asset_id}`;
    }
    if (task.shot_id) {
      const s = shots.find((x) => x.id === task.shot_id);
      return s ? `Shot: ${s.shot_code || s.code || s.id}` : `Shot: ${task.shot_id}`;
    }
    return '—';
  })();

  const latestVersion = taskVersions[0];
  const latestFeedback = latestVersion?.feedback?.trim();

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-8">
      <div className="flex items-center gap-2 text-sm text-muted">
        <Link to="/tasks" className="link-hover">Tasks</Link>
        <span>/</span>
        <span className="text-foreground">{task.type}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6">
            <h1 className="text-2xl font-serif font-bold text-foreground">{task.type}</h1>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted">Entity</span>
              <span className="text-foreground font-mono">{entityLabel}</span>
              <span className="text-muted">Due date</span>
              <span className="text-foreground">{task.due_date ? new Date(task.due_date).toLocaleDateString() : '—'}</span>
              <span className="text-muted">Estimated hours</span>
              <span className="text-foreground">{task.estimated_hours ?? '—'}</span>
              <span className="text-muted">Actual hours</span>
              <span className="text-foreground">{task.actual_hours ?? '—'}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {statusEdit ? (
                <ThemedSelect
                  value={task.status}
                  onChange={handleStatusChange}
                  className="min-w-[160px]"
                  options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                />
              ) : (
                <button type="button" onClick={() => setStatusEdit(true)}>
                  <StatusPill status={task.status} />
                </button>
              )}
            </div>
          </div>
          <div className="glass-panel p-6">
            <h2 className="text-lg font-serif font-semibold text-foreground mb-2">Latest version</h2>
            {latestVersion ? (
              <div className="text-sm space-y-1">
                <p className="text-muted">
                  {`v${String(latestVersion.version_number).padStart(3, '0')} • ${latestVersion.representation} • ${latestVersion.status || 'pending'}`}
                </p>
                <p className="text-foreground font-mono break-all">{latestVersion.filename}</p>
              </div>
            ) : (
              <p className="text-muted text-sm">No versions linked to this task yet.</p>
            )}
          </div>
        </div>
        <div className="space-y-6">
          <div className="glass-panel p-6">
            <h2 className="text-lg font-serif font-semibold text-foreground mb-2">Activity</h2>
            {events.length === 0 ? (
              <p className="text-muted text-sm">No activity yet.</p>
            ) : (
              <ul className="space-y-2">
                {events.map((ev) => (
                  <li key={ev.id} className="text-sm border-b border-border/50 pb-2">
                    <p className="text-foreground">
                      {ev.kind}
                      {ev.payload?.version_number != null
                        ? ` • v${String(ev.payload.version_number).padStart(3, '0')}`
                        : ''}
                    </p>
                    {ev.payload?.feedback ? (
                      <p className="text-muted">{ev.payload.feedback}</p>
                    ) : null}
                    <p className="text-xs text-muted">
                      {ev.created_at ? new Date(ev.created_at).toLocaleString() : '—'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="glass-panel p-6">
            <h2 className="text-lg font-serif font-semibold text-foreground mb-2">Notes</h2>
            {latestFeedback ? (
              <p className="text-sm text-foreground whitespace-pre-wrap">{latestFeedback}</p>
            ) : (
              <p className="text-muted text-sm">No feedback on latest version.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
