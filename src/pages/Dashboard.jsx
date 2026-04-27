import {
  AlertTriangle,
  CheckCircle,
  CircleDashed,
  Clock,
  Eye,
  PercentCircle,
  UserX,
  Users,
} from 'lucide-react';
import { useProjectContext } from '../contexts/ProjectContext';
import { useAuth } from '../contexts/AuthContext';
import { overviewMode } from '../lib/permissions';
import { useEvents, useMyTasks, useTaskStats } from '../api/hooks';
import { CardSkeleton } from '../components/Loading';

const POLL_INTERVAL_MS = 30_000;

function StatCard({ title, value, icon, accent = 'text-primary' }) {
  return (
    <div className="glass-panel p-6 flex flex-col gap-4 relative overflow-hidden group hover:border-primary/50 transition-colors">
      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="flex justify-between items-start">
        <h3 className="text-muted font-medium text-sm">{title}</h3>
        <div className={`p-2 bg-background rounded-full ${accent}`}>{icon}</div>
      </div>
      <div className="text-4xl font-bold font-serif">{value}</div>
    </div>
  );
}

function NoProjectSelected() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-muted">
      <h2 className="text-3xl font-serif text-foreground">Overview</h2>
      <p>Select a project from the top-right selector to see its overview.</p>
    </div>
  );
}

function ActivityFeed({ events = [] }) {
  return (
    <div className="glass-panel flex flex-col">
      <div className="p-6 border-b border-border">
        <h2 className="text-2xl font-serif">Recent Activity</h2>
      </div>
      <div className="p-0 overflow-y-auto w-full max-h-[520px]">
        {events.length === 0 ? (
          <div className="p-6 text-muted text-sm text-center">
            Recent activity will appear here.
          </div>
        ) : (
          events.map((e) => (
            <div
              key={e.id}
              className="p-4 border-b border-border/50 hover:bg-card-hover/50 transition-colors flex gap-4 text-sm"
            >
              <div className="w-2 h-2 mt-1.5 flex-shrink-0 bg-primary rounded-full shadow-[0_0_8px_rgba(212,255,0,0.6)]" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">
                  {e.actor_name || e.actor_username || 'system'}{' '}
                  <span className="text-primary font-mono ml-1">{e.kind}</span>
                </p>
                <p className="text-muted text-xs mt-1">
                  {e.created_at ? new Date(e.created_at).toLocaleString() : ''}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ManagementOverview({ projectId }) {
  const { data: stats, isLoading } = useTaskStats(projectId, {
    refetchInterval: POLL_INTERVAL_MS,
  });
  const { data: eventsData } = useEvents(projectId, {
    limit: 20,
    refetchInterval: POLL_INTERVAL_MS,
  });
  const events = Array.isArray(eventsData) ? eventsData : eventsData?.items || [];

  const safe = stats || {
    open: 0,
    overdue: 0,
    in_review: 0,
    completed: 0,
    unassigned: 0,
    completion_pct: 0,
  };

  if (isLoading && !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard title="Open Tasks" value={safe.open} icon={<Clock className="w-4 h-4" />} />
        <StatCard
          title="Overdue"
          value={safe.overdue}
          icon={<AlertTriangle className="w-4 h-4" />}
          accent="text-danger"
        />
        <StatCard
          title="In Review"
          value={safe.in_review}
          icon={<Eye className="w-4 h-4" />}
          accent="text-warning"
        />
        <StatCard
          title="Completed"
          value={safe.completed}
          icon={<CheckCircle className="w-4 h-4" />}
          accent="text-success"
        />
        <StatCard
          title="Unassigned"
          value={safe.unassigned}
          icon={<UserX className="w-4 h-4" />}
          accent="text-muted"
        />
        <StatCard
          title="Completion"
          value={`${Number(safe.completion_pct || 0).toFixed(1)}%`}
          icon={<PercentCircle className="w-4 h-4" />}
        />
      </div>
      <ActivityFeed events={events} />
    </div>
  );
}

function ArtistOverview({ projectId }) {
  const { data: stats, isLoading } = useTaskStats(projectId, {
    mine: true,
    refetchInterval: POLL_INTERVAL_MS,
  });
  const { data: myTasksData } = useMyTasks(projectId, { refetchInterval: POLL_INTERVAL_MS });
  const { data: eventsData } = useEvents(projectId, {
    limit: 20,
    refetchInterval: POLL_INTERVAL_MS,
  });
  const myTasks = Array.isArray(myTasksData) ? myTasksData : myTasksData?.items || [];
  const events = Array.isArray(eventsData) ? eventsData : eventsData?.items || [];

  const approved = myTasks.filter((t) => t.metadata?.final_status === 'approved').length;
  const safe = stats || {
    completed: 0,
    in_progress: 0,
    overdue: 0,
  };

  if (isLoading && !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[0, 1, 2, 3].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Completed"
          value={safe.completed}
          icon={<CheckCircle className="w-4 h-4" />}
          accent="text-success"
        />
        <StatCard
          title="In Progress"
          value={safe.in_progress}
          icon={<CircleDashed className="w-4 h-4" />}
        />
        <StatCard title="Approved" value={approved} icon={<Users className="w-4 h-4" />} />
        <StatCard
          title="Overdue"
          value={safe.overdue}
          icon={<AlertTriangle className="w-4 h-4" />}
          accent="text-danger"
        />
      </div>
      <ActivityFeed events={events} />
    </div>
  );
}

export function Dashboard() {
  const { projectId } = useProjectContext();
  const { user } = useAuth();

  if (!projectId) return <NoProjectSelected />;

  const mode = overviewMode(user);

  return (
    <div className="flex flex-col gap-8 h-full">
      <div>
        <h1 className="text-4xl font-serif font-bold text-foreground mb-1">Project Overview</h1>
        <p className="text-muted text-sm tracking-wide">
          {mode === 'artist' ? 'Your work on this project.' : 'Project operations at a glance.'}
        </p>
      </div>
      {mode === 'artist' ? (
        <ArtistOverview projectId={projectId} />
      ) : (
        <ManagementOverview projectId={projectId} />
      )}
    </div>
  );
}
