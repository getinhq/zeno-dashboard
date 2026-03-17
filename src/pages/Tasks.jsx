import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProjectContext } from '../contexts/ProjectContext';
import { useTasks, useUpdateTaskMutation } from '../api/hooks';
import { StatusPill } from '../components/StatusPill';
import { TableSkeleton, KanbanSkeleton } from '../components/Loading';
import { Link } from 'react-router-dom';
import { Columns, List } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'todo', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Approved' },
  { value: 'blocked', label: 'Blocked' },
];

const KANBAN_COLUMNS = [
  { key: 'todo', label: 'Not Started' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Approved' },
  { key: 'blocked', label: 'Blocked' },
];

function TaskRow({ task, onUpdate }) {
  const [editing, setEditing] = useState(null);
  const updateTask = useUpdateTaskMutation();

  const handleStatusChange = (status) => {
    setEditing(null);
    updateTask.mutate({ taskId: task.id, body: { status } }, { onSuccess: () => onUpdate?.() });
  };
  const handleDueDateChange = (e) => {
    const v = e.target.value;
    if (!v) return;
    setEditing(null);
    updateTask.mutate({ taskId: task.id, body: { due_date: v } }, { onSuccess: () => onUpdate?.() });
  };

  return (
    <tr className="hover:bg-card-hover/40 border-b border-border/50 transition-colors group">
      <td className="px-6 py-4 font-medium group-hover:text-primary transition-colors">
        <Link to={`/task/${task.id}`} className="link-hover">{task.type}</Link>
      </td>
      <td className="px-6 py-4 font-mono text-muted">{task.asset_id ? 'Asset' : task.shot_id ? 'Shot' : '—'}</td>
      <td className="px-6 py-4 text-foreground">{task.type}</td>
      <td className="px-6 py-4 text-muted text-sm">{task.assignee_id ? '—' : 'Unassigned'}</td>
      <td className="px-6 py-4">
        {editing === 'status' ? (
          <select
            autoFocus
            defaultValue={task.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            onBlur={() => setEditing(null)}
            className="bg-background text-xs border border-border rounded px-2 py-1 outline-none text-foreground focus:border-primary w-32 cursor-pointer"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : (
          <button type="button" onClick={() => setEditing('status')} className="text-left">
            <StatusPill status={task.status} />
          </button>
        )}
      </td>
      <td className="px-6 py-4 text-muted text-sm">
        {editing === 'due_date' ? (
          <input
            type="date"
            defaultValue={task.due_date ? task.due_date.slice(0, 10) : ''}
            onBlur={(e) => { handleDueDateChange(e); setEditing(null); }}
            onKeyDown={(e) => e.key === 'Enter' && (handleDueDateChange(e), setEditing(null))}
            className="bg-background border border-border rounded px-2 py-1 text-foreground text-sm w-36 focus:border-primary outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing('due_date')}
            className="text-left hover:bg-card-hover rounded px-1 -mx-1 text-muted"
          >
            {task.due_date ? new Date(task.due_date).toLocaleDateString() : '—'}
          </button>
        )}
      </td>
      <td className="px-6 py-4 text-muted text-sm text-right">
        {task.updated_at ? new Date(task.updated_at).toLocaleString() : '—'}
      </td>
    </tr>
  );
}

function TasksTable({ tasks, onUpdate }) {
  return (
    <div className="glass-panel rounded-lg overflow-hidden border border-border">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-muted uppercase bg-card/50 backdrop-blur-md">
          <tr>
            <th className="px-6 py-4 font-medium border-b border-border">Task</th>
            <th className="px-6 py-4 font-medium border-b border-border">Entity</th>
            <th className="px-6 py-4 font-medium border-b border-border">Dept</th>
            <th className="px-6 py-4 font-medium border-b border-border">Assignee</th>
            <th className="px-6 py-4 font-medium border-b border-border">Status</th>
            <th className="px-6 py-4 font-medium border-b border-border">Due date</th>
            <th className="px-6 py-4 font-medium border-b border-border text-right">Updated</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} onUpdate={onUpdate} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskKanbanCard({ task }) {
  return (
    <Link to={`/task/${task.id}`} className="block group">
      <div className="glass-panel p-4 flex flex-col gap-3 group-hover:border-primary/50 transition-all cursor-pointer group-hover:-translate-y-0.5 group-hover:shadow-[0_4px_20px_rgba(212,255,0,0.1)]">
        <div className="flex justify-between items-start">
          <span className="text-xs font-mono px-2 py-0.5 bg-background border border-border rounded text-muted">
            {task.asset_id ? 'Asset' : task.shot_id ? 'Shot' : '—'}
          </span>
        </div>
        <h4 className="font-semibold text-sm leading-tight text-foreground group-hover:text-primary transition-colors">{task.type}</h4>
        <div className="flex items-center justify-between text-xs mt-2">
          <span className="text-muted font-mono">{task.due_date ? new Date(task.due_date).toLocaleDateString() : '—'}</span>
        </div>
        <StatusPill status={task.status} className="mt-2" />
      </div>
    </Link>
  );
}

export function Tasks() {
  const { projectId } = useProjectContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('view') || 'table';
  const statusFilter = searchParams.get('status') || '';

  const filters = { project_id: projectId || undefined };
  if (statusFilter) filters.status = statusFilter;
  const { data: tasks = [], refetch, isLoading } = useTasks(filters);

  const tasksByStatus = (key) => tasks.filter((t) => t.status === key);

  const setView = (v) => setSearchParams((p) => { p.set('view', v); return p; });
  const setStatusFilter = (s) => setSearchParams((p) => {
    if (s) p.set('status', s); else p.delete('status');
    return p;
  });

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
          <p className="text-muted text-sm tracking-wide mt-1">Filter by status or switch view</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-card-hover border border-border text-foreground px-4 py-1.5 rounded-md text-sm focus:outline-none focus:border-primary"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
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
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {view === 'table' ? (
          <TasksTable tasks={tasks} onUpdate={refetch} />
        ) : (
          <div className="flex gap-6 overflow-x-auto pb-4">
            {KANBAN_COLUMNS.map((col) => (
              <div key={col.key} className="w-[320px] flex-shrink-0 flex flex-col">
                <div className="flex justify-between items-center mb-4 px-2">
                  <h3 className="font-medium text-sm text-foreground uppercase tracking-wider">{col.label}</h3>
                  <span className="bg-card text-muted text-xs border border-border px-2 py-0.5 rounded-full font-mono">
                    {tasksByStatus(col.key).length}
                  </span>
                </div>
                <div className="space-y-3">
                  {tasksByStatus(col.key).map((task) => (
                    <TaskKanbanCard key={task.id} task={task} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
