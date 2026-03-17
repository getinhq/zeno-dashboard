import { useProjectContext } from '../contexts/ProjectContext';
import { useProjects, useTasksWithPolling, useUpdateTaskMutation } from '../api/hooks';
import { StatusPill } from '../components/StatusPill';
import { PageSkeleton, KanbanSkeleton, CardSkeleton } from '../components/Loading';
import { Link } from 'react-router-dom';
import { Briefcase, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

const KANBAN_COLUMNS = [
  { key: 'todo', label: 'Not Started' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Approved' },
  { key: 'blocked', label: 'Blocked' },
];

const MOCK_USER_ID = null;

function TaskCard({ task }) {
  const handleDragStart = (e) => {
    e.dataTransfer.setData('application/zeno-task-id', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="glass-panel p-4 flex flex-col gap-3 cursor-grab active:cursor-grabbing group hover:border-primary/50 transition-all relative overflow-hidden group-hover:-translate-y-0.5 group-hover:shadow-[0_4px_20px_rgba(212,255,0,0.1)]"
    >
      <Link to={`/task/${task.id}`} className="block">
        <div className="flex justify-between items-start">
          <span className="text-xs font-mono px-2 py-0.5 bg-background border border-border rounded text-muted">
            {task.asset_id ? 'Asset' : task.shot_id ? 'Shot' : '—'}
          </span>
        </div>
        <p className="font-semibold text-sm leading-tight text-foreground group-hover:text-primary transition-colors mt-1">{task.type}</p>
        <p className="text-xs text-muted mt-1 font-mono">
          Due {task.due_date ? new Date(task.due_date).toLocaleDateString() : '—'}
        </p>
      </Link>
      <div className="mt-2">
        <StatusPill status={task.status} />
      </div>
    </div>
  );
}

function KanbanColumn({ column, tasks, onDropTask }) {
  const handleDrop = (e) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('application/zeno-task-id');
    if (taskId && column.key) {
      onDropTask(taskId, column.key);
    }
  };

  return (
    <div
      className="w-[280px] flex-shrink-0 flex flex-col"
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
      onDrop={handleDrop}
    >
      <div className="flex justify-between items-center mb-4 px-2">
        <h3 className="font-medium text-sm text-foreground uppercase tracking-wider">{column.label}</h3>
        <span className="bg-card text-muted text-xs border border-border px-2 py-0.5 rounded-full font-mono">
          {tasks.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 pb-8">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
        <button type="button" className="w-full py-3 border border-dashed border-border/50 text-muted rounded-md hover:bg-card-hover/30 hover:text-foreground hover:border-primary transition-all text-sm font-medium">
          + Add Task
        </button>
      </div>
    </div>
  );
}

const POLL_INTERVAL_MS = 30_000;

export function Dashboard() {
  const { projectId } = useProjectContext();
  const { data: projects = [], isLoading: projectsLoading } = useProjects({ status: 'active' });
  const filters = { project_id: projectId || undefined, assignee_id: MOCK_USER_ID || undefined };
  const { data: tasks = [], refetch: refetchTasks, isLoading: tasksLoading } = useTasksWithPolling(filters, POLL_INTERVAL_MS);
  const updateTask = useUpdateTaskMutation();

  const handleDropTask = (taskId, newStatus) => {
    updateTask.mutate({ taskId, body: { status: newStatus } }, { onSuccess: () => refetchTasks() });
  };

  const activeCount = projects.length;
  const openTasks = tasks.filter((t) => !['done', 'blocked'].includes(t.status)).length;
  const overdue = tasks.filter((t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').length;
  const inReview = tasks.filter((t) => t.status === 'review').length;

  const tasksByStatus = (status) => tasks.filter((t) => t.status === status);
  const isLoading = projectsLoading || tasksLoading;

  const cards = [
    { title: 'Active Projects', value: String(activeCount), icon: <Briefcase className="text-primary" /> },
    { title: 'Open Tasks', value: String(openTasks), icon: <Clock className="text-info" /> },
    { title: 'Overdue', value: String(overdue), icon: <AlertTriangle className="text-danger" /> },
    { title: 'In Review', value: String(inReview), icon: <CheckCircle className="text-warning" /> },
  ];

  if (isLoading && tasks.length === 0 && projects.length === 0) {
    return (
      <div className="flex flex-col gap-8 h-full">
        <div className="h-10 w-48 bg-border/50 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <div>
          <div className="h-7 w-32 bg-border/50 rounded animate-pulse mb-4" />
          <KanbanSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 h-full">
      <div className="flex justify-between items-center mb-2">
        <div>
          <h1 className="text-4xl font-serif font-bold text-foreground mb-1">Overview</h1>
          <p className="text-muted text-sm tracking-wide">Studio operations at a glance</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((k) => (
          <div key={k.title} className="glass-panel p-6 flex flex-col gap-4 relative overflow-hidden group hover:border-primary/50 transition-colors">
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex justify-between items-start">
              <h3 className="text-muted font-medium text-sm">{k.title}</h3>
              <div className="p-2 bg-background rounded-full">{k.icon}</div>
            </div>
            <div className="text-4xl font-bold font-serif">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 min-h-0 pb-8">
        <div className="lg:col-span-2 glass-panel p-6 flex flex-col">
          <h2 className="text-2xl font-serif border-b border-border pb-4 mb-4">My Tasks</h2>
          <div className="flex gap-6 overflow-x-auto pb-4">
            {KANBAN_COLUMNS.map((col) => (
              <KanbanColumn
                key={col.key}
                column={col}
                tasks={tasksByStatus(col.key)}
                onDropTask={handleDropTask}
              />
            ))}
          </div>
        </div>

        <div className="glass-panel flex flex-col">
          <div className="p-6 border-b border-border">
            <h2 className="text-2xl font-serif">Activity Feed</h2>
          </div>
          <div className="p-0 overflow-y-auto w-full">
            {inReview === 0 ? (
              <div className="p-6 text-muted text-sm text-center">Recent activity will appear here.</div>
            ) : (
              tasks.filter((t) => t.status === 'review').slice(0, 5).map((t) => (
                <div key={t.id} className="p-4 border-b border-border/50 hover:bg-card-hover/50 transition-colors flex gap-4 text-sm">
                  <div className="w-2 h-2 mt-1.5 flex-shrink-0 bg-primary rounded-full shadow-[0_0_8px_rgba(212,255,0,0.6)]" />
                  <div>
                    <p className="font-medium">
                      <Link to={`/task/${t.id}`} className="link-hover">{t.type}</Link>
                      <span className="text-primary font-mono ml-1">review</span>
                    </p>
                    <p className="text-muted text-xs mt-1">Due {t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="p-6 border-t border-border">
            <h3 className="text-lg font-serif mb-2">Upcoming reviews</h3>
            {inReview === 0 ? (
              <p className="text-muted text-sm">No items in review.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {tasks.filter((t) => t.status === 'review').slice(0, 5).map((t) => (
                  <li key={t.id}>
                    <Link to={`/task/${t.id}`} className="link-hover">
                      {t.type} — {t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
