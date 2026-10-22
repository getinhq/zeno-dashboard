import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Download, Loader2, MonitorPlay, RefreshCw, Share2, XCircle } from 'lucide-react';
import {
  useAddReviewNote,
  useDeleteReviewNote,
  useReviewDecision,
  useReviewItem,
  useUpdateReviewNote,
} from '../api/hooks';
import { api, mediaUrl } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { isManagement } from '../lib/permissions';
import { bridgeViewers, openInViewer } from '../lib/dccLaunch';
import { ReviewPlayer } from '../components/review/ReviewPlayer';
import { ShareDialog } from '../components/review/ShareDialog';
import { ReviewStatus } from '../components/review/ReviewStatus';

export function ReviewPage() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: item, isLoading, error, refetch } = useReviewItem(itemId);
  const addNote = useAddReviewNote(itemId);
  const updateNote = useUpdateReviewNote(itemId);
  const deleteNote = useDeleteReviewNote(itemId);
  const decide = useReviewDecision(itemId);
  const [deciding, setDeciding] = useState(null); // 'approve' | 'changes_requested'
  const [comment, setComment] = useState('');
  const [sharing, setSharing] = useState(false);
  const manager = isManagement(user);
  const [viewers, setViewers] = useState([]);
  const [viewerMsg, setViewerMsg] = useState(null);

  useEffect(() => {
    bridgeViewers().then(setViewers);
  }, []);

  const openLocally = async (viewer) => {
    setViewerMsg(`Opening in ${viewer}…`);
    try {
      await openInViewer({ path: item.media.original, filename: item.source_filename, viewer });
      setViewerMsg(null);
    } catch (e) {
      setViewerMsg(e.message);
    }
  };

  if (isLoading) return <p className="text-muted text-sm">Loading review…</p>;
  if (error || !item) {
    return (
      <div className="glass-panel p-8 text-center text-muted">
        {error?.status === 404 ? 'This review does not exist (or was deleted).' : error?.message || 'Could not load the review.'}
        <div className="mt-3"><Link to="/reviews" className="link-hover">Back to reviews</Link></div>
      </div>
    );
  }

  const compareOptions = (item.revisions || []).filter((r) => r.id !== item.id && r.processing_status === 'ready');
  const previous = compareOptions.find((r) => r.revision < item.revision);
  const defaultCompareId = item.last_approved_id || previous?.id || compareOptions[0]?.id || null;
  const caps = {
    canNote: true,
    canSetFixed: true,
    canVerify: (n) => manager || n.author_id === user?.id,
    canDelete: (n) => manager || (n.author_id && n.author_id === user?.id),
  };
  const ready = item.processing_status === 'ready';

  const submitDecision = async () => {
    await decide.mutateAsync({ decision: deciding, comment });
    setDeciding(null);
    setComment('');
  };

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-8.5rem)] min-h-[600px]">
      <div className="flex items-center gap-3 flex-wrap">
        <button type="button" onClick={() => navigate('/reviews')} className="text-muted hover:text-foreground" aria-label="Back to reviews">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted truncate">
            {item.task.entity_label || 'Task'} · <Link to={`/task/${item.task_id}`} className="link-hover">{item.task.type}</Link>
          </p>
          <h1 className="text-xl font-serif text-foreground flex items-center gap-2">
            {item.label}
            <ReviewStatus status={item.review_status} />
            <span className="text-xs text-muted">by {item.submitted_by_name || 'someone'} · {new Date(item.created_at).toLocaleString()}</span>
          </h1>
        </div>
        <nav className="flex gap-1 flex-wrap" aria-label="Revisions">
          {(item.revisions || []).slice().reverse().map((r) => (
            <Link
              key={r.id}
              to={`/review/${r.id}`}
              className={`text-xs font-mono px-2 py-1 rounded-sm border ${r.id === item.id ? 'border-primary text-primary' : 'border-border text-muted hover:text-foreground'}`}
              title={r.review_status.replace('_', ' ')}
            >
              {r.label}
              {r.review_status === 'approved' && ' ✓'}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {item.media?.original && (
            <a href={mediaUrl(item.media.original)} className="btn-secondary text-xs py-1.5 gap-1.5" title={item.source_filename}>
              <Download className="w-3.5 h-3.5" /> Original
            </a>
          )}
          {item.media?.original &&
            viewers.map((v) => (
              <button
                key={v}
                type="button"
                className="btn-secondary text-xs py-1.5 gap-1.5"
                onClick={() => openLocally(v)}
                title="Download the original through Zeno Bridge and open it in a local viewer"
              >
                <MonitorPlay className="w-3.5 h-3.5" /> Open in {v.toUpperCase()}
              </button>
            ))}
          {viewerMsg && <span className="text-xs text-muted max-w-[16rem] truncate" title={viewerMsg}>{viewerMsg}</span>}
          {manager && ready && (
            <button type="button" className="btn-secondary text-xs py-1.5 gap-1.5" onClick={() => setSharing(true)}>
              <Share2 className="w-3.5 h-3.5" /> Share
            </button>
          )}
          {manager && ready && (
            <>
              <button type="button" className="btn-secondary text-xs py-1.5 gap-1.5 border-warning/50 text-warning" onClick={() => setDeciding('changes_requested')}>
                <XCircle className="w-3.5 h-3.5" /> Request changes
              </button>
              <button type="button" className="btn-primary text-xs py-1.5 gap-1.5" onClick={() => setDeciding('approve')}>
                <CheckCircle2 className="w-3.5 h-3.5" /> Approve
              </button>
            </>
          )}
        </div>
      </div>

      {item.description && <p className="text-sm text-muted -mt-1">{item.description}</p>}
      {item.sequence && <SequenceStats seq={item.sequence} />}

      {deciding && (
        <div className="glass-panel p-3 flex flex-col gap-2 border-primary/40">
          <p className="text-sm text-foreground">
            {deciding === 'approve' ? `Approve ${item.label}? The task is marked done` : `Send ${item.label} back to the artist? The task goes back to in progress`}
            {deciding === 'approve' && item.fixed_notes > 0 && `, and ${item.fixed_notes} fixed note${item.fixed_notes > 1 ? 's are' : ' is'} verified`}.
          </p>
          {deciding === 'approve' && item.open_notes > 0 && (
            <p className="text-sm text-warning">
              {item.open_notes} note{item.open_notes > 1 ? 's are' : ' is'} still open. They stay open after approval.
            </p>
          )}
          {deciding === 'changes_requested' && item.open_notes === 0 && (
            <p className="text-sm text-warning">There are no open notes. Add notes on the frames so the artist knows what to change.</p>
          )}
          <textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Message to the artist (optional)"
            className="bg-[#111] border border-border focus:border-primary rounded px-2 py-1.5 text-sm outline-none resize-none"
          />
          {decide.error && <p className="text-xs text-danger">{decide.error.message}</p>}
          <div className="flex gap-2">
            <button type="button" className="btn-primary text-sm py-1.5" onClick={submitDecision} disabled={decide.isPending}>
              {decide.isPending ? 'Saving…' : deciding === 'approve' ? 'Approve' : 'Request changes'}
            </button>
            <button type="button" className="btn-secondary text-sm py-1.5" onClick={() => setDeciding(null)}>Cancel</button>
          </div>
        </div>
      )}

      {!ready ? (
        <div className="glass-panel flex-1 flex flex-col items-center justify-center gap-3 text-sm text-muted">
          {item.processing_status === 'failed' ? (
            <>
              <XCircle className="w-8 h-8 text-danger" />
              <p className="text-foreground">This file could not be converted for playback.</p>
              <p className="max-w-lg text-center">{item.processing_error}</p>
              <button
                type="button"
                className="btn-secondary text-xs gap-1.5"
                onClick={async () => {
                  await api.post(`/api/v1/reviews/items/${item.id}/reprocess`, {});
                  refetch();
                }}
              >
                <RefreshCw className="w-3.5 h-3.5" /> Try again
              </button>
            </>
          ) : (
            <>
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p>Converting {item.source_filename} for frame-accurate playback…</p>
            </>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ReviewPlayer
            item={item}
            compareOptions={compareOptions}
            defaultCompareId={defaultCompareId}
            notes={item.notes}
            caps={caps}
            onAddNote={(payload) => addNote.mutateAsync(payload)}
            onReply={(n, body) => addNote.mutateAsync({ body, parent_id: n.id })}
            onStatus={(n, status, c) => updateNote.mutateAsync({ noteId: n.id, status, comment: c || undefined })}
            onDeleteNote={(n) => {
              if (window.confirm('Delete this note and its replies?')) deleteNote.mutate(n.id);
            }}
          />
        </div>
      )}

      {sharing && <ShareDialog projectId={item.project_id} itemIds={[item.id]} title={`${item.task.entity_label} ${item.label}`} onClose={() => setSharing(false)} />}
    </div>
  );
}

function formatBytes(n) {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** Image-sequence storage: how much of this revision was already stored by earlier ones. */
function SequenceStats({ seq }) {
  const pct = Math.round((seq.saved_ratio || 0) * 100);
  return (
    <p className="text-xs text-muted -mt-1 flex flex-wrap gap-x-3 gap-y-1 items-center">
      <span className="font-mono text-foreground">{seq.pattern}</span>
      <span>{seq.frames} frames</span>
      {seq.reused_frames > 0 ? (
        <span className="text-success">
          {seq.reused_frames} unchanged since {seq.reused_from.join(', ')} · stored {formatBytes(seq.new_bytes)} new of{' '}
          {formatBytes(seq.total_bytes)} ({pct}% saved)
        </span>
      ) : (
        <span>{formatBytes(seq.new_bytes)} stored{seq.unique_frames < seq.frames ? ` (${seq.frames - seq.unique_frames} repeated frames kept once)` : ''}</span>
      )}
      {seq.missing_frames?.length > 0 && <span className="text-warning">missing frames held: {seq.missing_frames.slice(0, 8).join(', ')}{seq.missing_frames.length > 8 ? '…' : ''}</span>}
    </p>
  );
}

export default ReviewPage;
