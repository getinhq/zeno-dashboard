import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useProjectContext } from '../contexts/ProjectContext';
import { useNotifications, useMarkNotificationsRead } from '../api/hooks';

function formatKind(kind) {
  if (!kind) return 'event';
  return kind.replace(/\./g, ' ').replace(/_/g, ' ');
}

function describe(item) {
  const p = item.payload || {};
  switch (item.kind) {
    case 'task.created':
      return `New task: ${p.title || p.task_id || 'untitled'}`;
    case 'task.status.changed':
      return `Task moved to ${p.to || 'new status'}`;
    case 'issue.created':
      return `New issue: ${p.title || 'untitled'}`;
    case 'issue.status.changed':
      return `Issue ${p.title || ''} → ${p.to || ''}`;
    case 'version.published':
      return `Version published${p.filename ? `: ${p.filename}` : ''}`;
    case 'project.member.added':
      return `Team member added${p.username ? `: ${p.username}` : ''}`;
    default:
      return formatKind(item.kind);
  }
}

export function NotificationsButton() {
  const { projectId } = useProjectContext();
  const [open, setOpen] = useState(false);
  const popRef = useRef(null);
  const { data } = useNotifications(projectId, { refetchInterval: 30_000 });
  const markRead = useMarkNotificationsRead();

  useEffect(() => {
    function onDoc(e) {
      if (popRef.current && !popRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const items = data?.items || [];
  const unread = data?.unread_count || 0;
  const disabled = !projectId;

  const onToggle = () => {
    if (disabled) return;
    setOpen((o) => {
      const next = !o;
      if (next && unread > 0) {
        markRead.mutate({ all_for_project: projectId });
      }
      return next;
    });
  };

  return (
    <div className="relative" ref={popRef}>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className={`relative transition-colors p-2 rounded-full ${disabled ? 'text-muted/50 cursor-not-allowed' : 'text-muted hover:text-foreground hover:bg-card-hover'}`}
        title={disabled ? 'Select a project to see notifications' : 'Notifications'}
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && !disabled && (
          <span className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold font-mono rounded-full px-1 min-w-[16px] h-4 flex items-center justify-center ring-2 ring-card">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && !disabled && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-[480px] overflow-y-auto rounded-md border border-border bg-card shadow-xl z-50">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            <span className="text-xs text-muted">{items.length}</span>
          </div>
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted">You're all caught up.</div>
          ) : (
            items.map((n) => (
              <div
                key={n.id}
                className={`p-3 border-b border-border/50 text-sm ${!n.read_at ? 'bg-primary/5' : ''}`}
              >
                <p className="text-foreground">{describe(n)}</p>
                <p className="text-muted text-xs mt-0.5">
                  {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationsButton;
