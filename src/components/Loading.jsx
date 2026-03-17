/** Reusable loading states – pipeline-os theme */

export function Spinner({ className = '' }) {
  return (
    <div
      className={`inline-block h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="glass-panel p-6 flex flex-col gap-4 animate-pulse">
      <div className="h-4 w-20 bg-border/50 rounded" />
      <div className="h-8 w-16 bg-border/50 rounded" />
    </div>
  );
}

export function PageSkeleton({ cards = 4, hasTable = false }) {
  return (
    <div className="flex flex-col gap-8">
      <div className="h-10 w-48 bg-border/50 rounded animate-pulse" />
      <div className={`grid gap-6 ${cards === 4 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-2'}`}>
        {Array.from({ length: cards }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      {hasTable && (
        <div className="glass-panel overflow-hidden animate-pulse">
          <div className="h-12 bg-card-hover/50 border-b border-border" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-card/50 border-b border-border/50 flex gap-4 px-6 items-center">
              <div className="h-4 flex-1 bg-border/50 rounded" />
              <div className="h-4 w-20 bg-border/50 rounded" />
              <div className="h-4 w-24 bg-border/50 rounded" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 6 }) {
  return (
    <div className="glass-panel rounded-md overflow-hidden animate-pulse">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-card/50">
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-6 py-4 text-left"><div className="h-4 bg-border/50 rounded w-20" /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx} className="border-b border-border/50">
              {Array.from({ length: cols }).map((_, colIdx) => (
                <td key={colIdx} className="px-6 py-4"><div className="h-4 bg-border/40 rounded max-w-[120px]" /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KanbanSkeleton() {
  return (
    <div className="flex gap-6 overflow-x-auto pb-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="min-w-[200px] glass-panel flex flex-col animate-pulse flex-shrink-0">
          <div className="p-4 border-b border-border">
            <div className="h-4 w-24 bg-border/50 rounded mb-1" />
            <div className="h-3 w-8 bg-border/50 rounded" />
          </div>
          <div className="p-4 space-y-3 min-h-[120px]">
            {[1, 2, 3].map((j) => (
              <div key={j} className="h-20 bg-border/30 rounded-md" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
