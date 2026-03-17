import { useState } from 'react';
import { useProjectContext } from '../contexts/ProjectContext';
import { useTasksWithPolling, useTask, useUpdateTaskMutation } from '../api/hooks';
import { StatusPill } from '../components/StatusPill';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';

const POLL_INTERVAL_MS = 30_000;

export function Reviews() {
  const { projectId } = useProjectContext();
  const { data: tasks = [], isLoading } = useTasksWithPolling(
    projectId ? { project_id: projectId, status: 'review' } : {},
    POLL_INTERVAL_MS
  );
  const updateTask = useUpdateTaskMutation();
  const [modalTaskId, setModalTaskId] = useState(null);

  const handleApprove = (taskId) => {
    updateTask.mutate({ taskId, body: { status: 'done' } });
    setModalTaskId(null);
  };
  const handleReject = (taskId) => {
    updateTask.mutate({ taskId, body: { status: 'blocked' } });
    setModalTaskId(null);
  };

  if (isLoading && tasks.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <div className="h-10 w-32 bg-border/50 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="glass-panel overflow-hidden animate-pulse">
              <div className="aspect-video bg-border/50" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-3/4 bg-border/50 rounded" />
                <div className="h-3 w-1/2 bg-border/50 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-4xl font-serif font-bold text-foreground">Reviews</h1>
        <p className="text-muted text-sm tracking-wide mt-1">Tasks in review. Click a card to open the review player.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="glass-panel overflow-hidden group hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => setModalTaskId(task.id)}
          >
            <div className="aspect-video bg-background/50 flex items-center justify-center text-muted text-sm">
              Thumbnail (stub)
            </div>
            <div className="p-4">
              <p className="font-semibold text-foreground text-sm truncate">{task.type}</p>
              <p className="text-xs text-muted mt-0.5 font-mono">
                Due {task.due_date ? new Date(task.due_date).toLocaleDateString() : '—'}
              </p>
              <StatusPill status={task.status} className="mt-2" />
            </div>
          </div>
        ))}
      </div>

      {tasks.length === 0 && (
        <div className="glass-panel p-8 text-center text-muted">
          No items in review.
        </div>
      )}

      {modalTaskId && (
        <ReviewPlayerModal
          taskId={modalTaskId}
          onClose={() => setModalTaskId(null)}
          onApprove={() => handleApprove(modalTaskId)}
          onReject={() => handleReject(modalTaskId)}
        />
      )}
    </div>
  );
}

function ReviewPlayerModal({ taskId, onClose, onApprove, onReject }) {
  const { data: taskData } = useTask(taskId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="bg-background/90 fixed inset-0 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative glass-panel max-w-2xl w-full overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-xl font-serif font-semibold text-foreground">Review</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground p-1 rounded hover:bg-card-hover transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="aspect-video bg-background/50 flex items-center justify-center text-muted">
          Image/Video player (stub). Annotations overlay (client-only) can be added.
        </div>
        <div className="p-6 flex items-center justify-between gap-4">
          <div>
            {taskData && <p className="text-foreground text-sm font-medium">{taskData.type}</p>}
            <Link to={`/task/${taskId}`} className="link-hover text-sm">Open task</Link>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onReject}
              className="btn-secondary border-danger/50 text-danger hover:bg-danger/10"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={onApprove}
              className="btn-primary bg-success text-primary-foreground hover:bg-success/90"
            >
              Approve
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
