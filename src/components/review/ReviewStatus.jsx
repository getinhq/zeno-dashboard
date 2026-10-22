const STYLES = {
  pending: ['Waiting for review', 'bg-info/20 border-info/50 text-info'],
  approved: ['Approved', 'bg-success/20 border-success/50 text-success'],
  changes_requested: ['Changes requested', 'bg-warning/20 border-warning/50 text-warning'],
};

export function ReviewStatus({ status, className = '' }) {
  const [label, style] = STYLES[status] || [status, 'bg-card border-border text-muted'];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm border text-[11px] font-medium ${style} ${className}`}>
      {label}
    </span>
  );
}
