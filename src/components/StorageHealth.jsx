import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, HeartPulse, Loader2, RefreshCw, TriangleAlert, Wrench } from 'lucide-react';
import { api } from '../api/client';
import { useRunStorageCheck, useStorageCheck } from '../api/hooks';

const SEVERITY = {
  broken: { label: 'Broken', style: 'text-danger border-danger/50', hint: 'cannot be opened' },
  degraded: { label: 'Degraded', style: 'text-warning border-warning/50', hint: 'opens, something optional is missing' },
};

/** Settings → Storage health: does every file the database points at still exist? */
export function StorageHealth() {
  const { data: report, isLoading } = useStorageCheck();
  const run = useRunStorageCheck();
  const [rebuilding, setRebuilding] = useState({});

  const rebuild = async (id) => {
    setRebuilding((r) => ({ ...r, [id]: 'working' }));
    try {
      await api.post(`/api/v1/reviews/items/${id}/reprocess`, {});
      setRebuilding((r) => ({ ...r, [id]: 'queued' }));
    } catch (e) {
      setRebuilding((r) => ({ ...r, [id]: e.message }));
    }
  };

  const s = report?.summary;
  return (
    <section className="glass-panel p-6 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <HeartPulse className="w-5 h-5 text-primary mt-1" />
        <div className="flex-1">
          <h2 className="text-xl font-semibold">Storage health</h2>
          <p className="text-sm text-muted">
            Checks that every file your studio&apos;s versions, reviews and issue attachments point at is still in storage,
            including every chunk of chunked files.
          </p>
        </div>
        <button type="button" className="btn-primary text-sm gap-2" onClick={() => run.mutate()} disabled={run.isPending}>
          {run.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {run.isPending ? 'Checking…' : 'Check now'}
        </button>
      </div>
      {run.error && <p className="text-sm text-danger">{run.error.message}</p>}

      {isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !report ? (
        <p className="text-sm text-muted">Not checked yet.</p>
      ) : (
        <>
          <div className={`rounded-md border p-4 flex items-center gap-3 ${report.ok ? 'border-success/40 bg-success/5' : 'border-danger/40 bg-danger/5'}`}>
            {report.ok ? <CheckCircle2 className="w-5 h-5 text-success" /> : <TriangleAlert className="w-5 h-5 text-danger" />}
            <div className="text-sm">
              <p className="text-foreground">
                {report.ok
                  ? 'Everything is stored.'
                  : `${s.broken} broken, ${s.degraded} degraded (${s.missing_blobs} missing file${s.missing_blobs === 1 ? '' : 's'}).`}
              </p>
              <p className="text-xs text-muted">
                {s.versions} versions, {s.reviews} reviews, {s.attachments} attachments · {s.blobs_checked} stored files checked in{' '}
                {report.duration_seconds}s · {new Date(report.checked_at).toLocaleString()}
                {report.checked_by ? ` by ${report.checked_by}` : ''}
              </p>
            </div>
          </div>

          {report.problems.length > 0 && (
            <ul className="flex flex-col gap-2">
              {report.problems.map((p) => {
                const sev = SEVERITY[p.severity];
                const roles = [...new Set(p.missing.map((m) => m.role.replace(/^frame \d+$/, 'frames')))];
                return (
                  <li key={`${p.kind}:${p.id}`} className="border border-border rounded-md p-3 flex flex-col gap-1.5 text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] uppercase tracking-wider border rounded-sm px-1.5 py-0.5 ${sev.style}`} title={sev.hint}>
                        {sev.label}
                      </span>
                      <span className="text-muted text-xs capitalize">{p.kind}</span>
                      {p.kind === 'review' ? (
                        <Link to={`/review/${p.id}`} className="text-foreground hover:text-primary">{p.label}</Link>
                      ) : (
                        <span className="text-foreground">{p.label}</span>
                      )}
                      <span className="text-xs text-muted">· {p.project}</span>
                    </div>
                    <p className="text-xs text-muted">
                      Missing {p.missing_count}: {roles.join(', ')}{' '}
                      <span className="font-mono">({p.missing.slice(0, 2).map((m) => m.hash.slice(0, 12)).join(', ')}{p.missing_count > 2 ? ', …' : ''})</span>
                    </p>
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-foreground/90 flex items-center gap-1.5"><Wrench className="w-3.5 h-3.5 text-muted" /> {p.fix}</p>
                      {p.can_rebuild && (
                        <button
                          type="button"
                          className="btn-secondary text-xs py-1 px-2 ml-auto"
                          disabled={!!rebuilding[p.id]}
                          onClick={() => rebuild(p.id)}
                        >
                          {rebuilding[p.id] === 'queued' ? 'Rebuilding… check again shortly' : rebuilding[p.id] === 'working' ? 'Starting…' : rebuilding[p.id] || 'Rebuild previews'}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
      <p className="text-xs text-muted">
        On the server: <code className="text-foreground">docker compose exec api python -m app.storage_check --orphans</code> checks every
        studio (exit code 1 when something is broken, for cron) and counts files nothing uses any more. Nothing is deleted.
      </p>
    </section>
  );
}
