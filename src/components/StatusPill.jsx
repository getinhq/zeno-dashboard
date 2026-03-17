const STATUS_STYLES = {
  todo: 'bg-card border border-border text-muted',
  in_progress: 'bg-warning/20 border border-warning/50 text-warning',
  review: 'bg-info/20 border border-info/50 text-info',
  done: 'bg-success/20 border border-success/50 text-success',
  blocked: 'bg-danger/20 border border-danger/50 text-danger',
  active: 'bg-success/20 border border-success/50 text-success',
  on_hold: 'bg-warning/20 border border-warning/50 text-warning',
  archived: 'bg-card border border-border text-muted',
  pending: 'bg-card border border-border text-muted',
  approved: 'bg-success/20 border border-success/50 text-success',
  final: 'bg-success/20 border border-success/50 text-success',
};

const LABELS = {
  todo: 'Not Started',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Approved',
  blocked: 'Blocked',
};

export function StatusPill({ status, label }) {
  const s = (status || '').toLowerCase().replace(/\s+/g, '_');
  const style = STATUS_STYLES[s] || 'bg-card border border-border text-muted';
  const text = label ?? LABELS[s] ?? status;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium font-mono ${style}`}>
      {text}
    </span>
  );
}
