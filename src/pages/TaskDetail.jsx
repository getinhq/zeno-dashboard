import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTask, useUpdateTaskMutation } from '../api/hooks';
import { StatusPill } from '../components/StatusPill';
import { PageSkeleton } from '../components/Loading';

const STATUS_OPTIONS = [
  { value: 'todo', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Approved' },
  { value: 'blocked', label: 'Blocked' },
];

export function TaskDetail() {
  const { id } = useParams();
  const { data: task, isLoading, error } = useTask(id);
  const updateTask = useUpdateTaskMutation();
  const [statusEdit, setStatusEdit] = useState(false);

  if (isLoading) return <PageSkeleton cards={2} hasTable={false} />;
  if (error || !task) return <div className="text-danger">Task not found.</div>;

  const handleStatusChange = (status) => {
    setStatusEdit(false);
    updateTask.mutate({ taskId: task.id, body: { status } });
  };

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
              <span className="text-foreground font-mono">{task.asset_id ? 'Asset' : task.shot_id ? 'Shot' : '—'}</span>
              <span className="text-muted">Due date</span>
              <span className="text-foreground">{task.due_date ? new Date(task.due_date).toLocaleDateString() : '—'}</span>
              <span className="text-muted">Estimated hours</span>
              <span className="text-foreground">{task.estimated_hours ?? '—'}</span>
              <span className="text-muted">Actual hours</span>
              <span className="text-foreground">{task.actual_hours ?? '—'}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {statusEdit ? (
                <select
                  autoFocus
                  defaultValue={task.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  onBlur={() => setStatusEdit(false)}
                  className="bg-background border border-border rounded px-2 py-1 text-foreground text-sm focus:border-primary outline-none"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <button type="button" onClick={() => setStatusEdit(true)}>
                  <StatusPill status={task.status} />
                </button>
              )}
            </div>
          </div>
          <div className="glass-panel p-6">
            <h2 className="text-lg font-serif font-semibold text-foreground mb-2">Latest version</h2>
            <p className="text-muted text-sm">Version preview and thumbnails (stub). Use Quick Publish to register versions.</p>
            <Link to="/publish" className="btn-primary inline-flex mt-4 py-1.5 px-3 text-sm">
              Publish
            </Link>
          </div>
        </div>
        <div className="space-y-6">
          <div className="glass-panel p-6">
            <h2 className="text-lg font-serif font-semibold text-foreground mb-2">Activity</h2>
            <p className="text-muted text-sm">Activity timeline (stub).</p>
          </div>
          <div className="glass-panel p-6">
            <h2 className="text-lg font-serif font-semibold text-foreground mb-2">Notes</h2>
            <p className="text-muted text-sm">Notes thread (stub).</p>
          </div>
        </div>
      </div>
    </div>
  );
}
