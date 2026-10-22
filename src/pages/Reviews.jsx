import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, Link2, Loader2, MessageSquareWarning, Plus, Share2, Square, Trash2, TriangleAlert } from 'lucide-react';
import { useProjectContext } from '../contexts/ProjectContext';
import { useAuth } from '../contexts/AuthContext';
import { useReviewItems, useReviewShares, useRevokeReviewShare } from '../api/hooks';
import { mediaUrl } from '../api/client';
import { isManagement } from '../lib/permissions';
import { ReviewStatus } from '../components/review/ReviewStatus';
import { SubmitDialog } from '../components/review/SubmitDialog';
import { ShareDialog } from '../components/review/ShareDialog';
import { timeAgo } from '../components/review/NotesPanel';

const TABS = [
  { id: 'pending', label: 'Waiting for review' },
  { id: 'changes_requested', label: 'Changes requested' },
  { id: 'approved', label: 'Approved' },
  { id: 'history', label: 'All submissions' },
];

/** Thumbnail that scrubs through the filmstrip under the pointer. */
function ScrubThumb({ item }) {
  const [tile, setTile] = useState(null);
  const thumb = mediaUrl(item.media?.thumbnail);
  const strip = mediaUrl(item.media?.filmstrip);
  const tiles = item.filmstrip_tiles || 0;
  return (
    <div
      className="aspect-video bg-black relative overflow-hidden"
      onMouseMove={(e) => {
        if (!strip || tiles < 2) return;
        const r = e.currentTarget.getBoundingClientRect();
        setTile(Math.min(tiles - 1, Math.floor(((e.clientX - r.left) / r.width) * tiles)));
      }}
      onMouseLeave={() => setTile(null)}
    >
      {tile !== null ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("${strip}")`,
            backgroundSize: `${tiles * 100}% 100%`,
            backgroundPosition: `${(tile / (tiles - 1)) * 100}% 0`,
          }}
        />
      ) : thumb ? (
        <img src={thumb} alt="" className="absolute inset-0 w-full h-full object-contain" loading="lazy" />
      ) : null}
      {item.processing_status !== 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs text-muted gap-2">
          {item.processing_status === 'failed' ? (
            <>
              <TriangleAlert className="w-4 h-4 text-danger" /> Conversion failed
            </>
          ) : (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-primary" /> Converting…
            </>
          )}
        </div>
      )}
      <span className="absolute top-2 left-2 text-[11px] font-mono bg-black/70 px-1.5 py-0.5 rounded">{item.label}</span>
      {item.kind === 'video' && item.frame_count && (
        <span className="absolute bottom-2 right-2 text-[10px] font-mono bg-black/70 px-1.5 py-0.5 rounded text-muted">
          {item.frame_start}–{item.frame_end} · {item.frame_count}f
        </span>
      )}
    </div>
  );
}

function ClientLinks({ projectId }) {
  const { data: shares = [], isLoading } = useReviewShares(projectId);
  const revoke = useRevokeReviewShare();
  if (isLoading) return null;
  return (
    <section className="glass-panel p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Link2 className="w-4 h-4 text-primary" />
        <h2 className="text-base font-semibold">Client links</h2>
      </div>
      {shares.length === 0 ? (
        <p className="text-sm text-muted">No links yet. Open a review and press Share, or select cards above.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted text-left">
            <tr>
              <th className="py-2 pr-3">Title</th>
              <th className="py-2 pr-3">Items</th>
              <th className="py-2 pr-3">Last opened</th>
              <th className="py-2 pr-3">Expires</th>
              <th className="py-2 pr-3">State</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shares.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="py-2 pr-3">{s.title || 'Untitled'}{s.has_password && <span className="text-muted text-xs"> · password</span>}</td>
                <td className="py-2 pr-3 text-muted">{s.item_ids.length}</td>
                <td className="py-2 pr-3 text-muted">{s.last_viewed_at ? timeAgo(s.last_viewed_at) : 'Never'}</td>
                <td className="py-2 pr-3 text-muted">{s.expires_at ? new Date(s.expires_at).toLocaleDateString() : 'Never'}</td>
                <td className="py-2 pr-3 capitalize">{s.state}</td>
                <td className="py-2 text-right">
                  {s.state === 'active' && (
                    <button type="button" className="text-muted hover:text-danger" onClick={() => revoke.mutate(s.id)} aria-label={`Revoke ${s.title}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-[11px] text-muted">The full link is shown once, when you create it. Revoke and make a new one if it is lost.</p>
    </section>
  );
}

export function Reviews() {
  const { projectId } = useProjectContext();
  const { user } = useAuth();
  const manager = isManagement(user);
  const [tab, setTab] = useState('pending');
  const [submitting, setSubmitting] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState([]);
  const [sharing, setSharing] = useState(false);

  const latest = useReviewItems({ project_id: projectId, latest_only: true }, { refetchInterval: 30_000 });
  const history = useReviewItems({ project_id: projectId }, { enabled: !!projectId && tab === 'history' });
  const items = useMemo(() => {
    if (tab === 'history') return history.data || [];
    return (latest.data || []).filter((i) => i.review_status === tab);
  }, [tab, latest.data, history.data]);
  const counts = useMemo(() => {
    const c = { pending: 0, changes_requested: 0, approved: 0 };
    (latest.data || []).forEach((i) => {
      c[i.review_status] = (c[i.review_status] || 0) + 1;
    });
    return c;
  }, [latest.data]);
  const loading = tab === 'history' ? history.isLoading : latest.isLoading;

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  if (!projectId) {
    return <div className="glass-panel p-8 text-center text-muted">Pick a project to see its reviews.</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-serif font-bold text-foreground">Reviews</h1>
          <p className="text-muted text-sm tracking-wide mt-1">Playblasts and renders waiting for a decision. Notes follow the shot to its next version.</p>
        </div>
        <div className="ml-auto flex gap-2">
          {manager && (
            <button
              type="button"
              className={`btn-secondary text-sm gap-2 ${selecting ? 'border-primary text-primary' : ''}`}
              onClick={() => {
                setSelecting((v) => !v);
                setSelected([]);
              }}
            >
              <Share2 className="w-4 h-4" /> {selecting ? 'Cancel' : 'Share with client'}
            </button>
          )}
          <button type="button" className="btn-primary text-sm gap-2" onClick={() => setSubmitting(true)}>
            <Plus className="w-4 h-4" /> Submit for review
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm -mb-px border-b-2 ${tab === t.id ? 'border-primary text-foreground' : 'border-transparent text-muted hover:text-foreground'}`}
          >
            {t.label}
            {counts[t.id] > 0 && <span className="ml-1.5 text-xs text-muted">{counts[t.id]}</span>}
          </button>
        ))}
      </div>

      {selecting && (
        <div className="glass-panel p-3 flex items-center gap-3 text-sm">
          <span className="text-muted">Pick the items the client should see.</span>
          <span className="ml-auto">{selected.length} selected</span>
          <button type="button" className="btn-primary text-xs py-1.5" disabled={!selected.length} onClick={() => setSharing(true)}>
            Create link
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-panel overflow-hidden animate-pulse">
              <div className="aspect-video bg-border/50" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-3/4 bg-border/50 rounded" />
                <div className="h-3 w-1/2 bg-border/50 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="glass-panel p-10 text-center text-muted flex flex-col items-center gap-3">
          <MessageSquareWarning className="w-8 h-8" />
          {tab === 'pending' ? (
            <>
              <p className="text-foreground">Nothing is waiting for review.</p>
              <p className="text-sm max-w-md">
                Artists submit a playblast from Blender (Zeno panel → Submit for review) or upload one here. It shows up in this tab and the reviewer is notified.
              </p>
            </>
          ) : (
            <p>No items here.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {items.map((item) => {
            const picked = selected.includes(item.id);
            const body = (
              <>
                <ScrubThumb item={item} />
                <div className="p-3 flex flex-col gap-1.5">
                  <p className="text-sm text-foreground truncate" title={item.task.title}>
                    {item.task.title || item.task.type}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <ReviewStatus status={item.review_status} />
                    {item.open_notes > 0 && <span className="text-[11px] text-danger">{item.open_notes} open</span>}
                    {item.fixed_notes > 0 && <span className="text-[11px] text-warning">{item.fixed_notes} to verify</span>}
                  </div>
                  <p className="text-[11px] text-muted truncate">
                    {item.submitted_by_name || 'Someone'} · {timeAgo(item.created_at)}
                    {item.description ? ` · ${item.description}` : ''}
                  </p>
                </div>
              </>
            );
            return selecting ? (
              <button
                key={item.id}
                type="button"
                onClick={() => item.processing_status === 'ready' && toggle(item.id)}
                className={`glass-panel overflow-hidden text-left relative ${picked ? 'border-primary' : ''} ${item.processing_status !== 'ready' ? 'opacity-50' : ''}`}
              >
                <span className="absolute top-2 right-2 z-10 text-primary">{picked ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-muted" />}</span>
                {body}
              </button>
            ) : (
              <Link key={item.id} to={`/review/${item.id}`} className="glass-panel overflow-hidden hover:border-primary/50 transition-colors">
                {body}
              </Link>
            );
          })}
        </div>
      )}

      {manager && <ClientLinks projectId={projectId} />}

      {submitting && <SubmitDialog projectId={projectId} onClose={() => setSubmitting(false)} />}
      {sharing && (
        <ShareDialog
          projectId={projectId}
          itemIds={selected}
          onClose={() => {
            setSharing(false);
            setSelecting(false);
            setSelected([]);
          }}
        />
      )}
    </div>
  );
}

export default Reviews;
