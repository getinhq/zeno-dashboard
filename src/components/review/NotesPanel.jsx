import { forwardRef, useMemo, useState } from 'react';
import { Check, CheckCheck, CornerDownRight, Pencil, RotateCcw, Trash2, TriangleAlert } from 'lucide-react';
import { NOTE_COLORS } from './Timeline';

const STATUS_LABEL = { open: 'Open', fixed: 'Fixed · check it', verified: 'Verified' };

export function timeAgo(iso) {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function frameLabel(n) {
  if (n.frame == null) return null;
  return n.frame_end != null && n.frame_end !== n.frame ? `${n.frame}–${n.frame_end}` : String(n.frame);
}

function StatusChip({ status }) {
  if (!status) return null;
  return (
    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border" style={{ color: NOTE_COLORS[status], borderColor: `${NOTE_COLORS[status]}66` }}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function HistoryLine({ r }) {
  if (r.kind === 'status') {
    const to = r.meta?.to;
    const verb = to === 'fixed' ? 'marked fixed' : to === 'verified' ? 'verified the fix' : 'reopened';
    return (
      <p className="text-[11px] text-muted">
        <span className="text-foreground">{r.author_name}</span> {verb}
        {to === 'fixed' && r.raised_in ? ` in ${r.raised_in}` : ''} · {timeAgo(r.created_at)}
        {r.body && <span className="block text-foreground/80 mt-0.5">“{r.body}”</span>}
      </p>
    );
  }
  return (
    <div className="text-xs">
      <span className="text-foreground font-medium">{r.author_name}</span>
      {r.is_guest && <span className="text-muted"> (client)</span>}
      <span className="text-muted"> · {timeAgo(r.created_at)}</span>
      <p className="text-foreground/90 whitespace-pre-wrap break-words mt-0.5">{r.body}</p>
    </div>
  );
}

function DecisionRow({ n }) {
  const ok = n.meta?.decision === 'approve';
  return (
    <div className={`border-l-2 ${ok ? 'border-success' : 'border-warning'} pl-3 py-1`}>
      <p className="text-xs">
        <span className="text-foreground font-medium">{n.author_name}</span>
        {n.is_guest && <span className="text-muted"> (client)</span>}
        <span className={ok ? 'text-success' : 'text-warning'}> {ok ? 'approved' : 'requested changes on'} {n.raised_in}</span>
        <span className="text-muted"> · {timeAgo(n.created_at)}</span>
      </p>
      {n.body && <p className="text-xs text-foreground/90 whitespace-pre-wrap mt-0.5">{n.body}</p>}
    </div>
  );
}

function NoteCard({ n, item, selected, caps, onSelect, onStatus, onReply, onDelete }) {
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState('');
  const [fixComment, setFixComment] = useState(null);
  const fl = frameLabel(n);
  const outside =
    n.frame != null && item.frame_end != null && (n.frame > item.frame_end || (n.frame_end ?? n.frame) < item.frame_start);
  const carried = n.raised_in && n.raised_in !== item.label;

  const sendReply = async () => {
    if (!reply.trim()) return;
    await onReply(n, reply.trim());
    setReply('');
    setReplying(false);
  };

  return (
    <div
      className={`rounded-md border p-3 flex flex-col gap-2 transition-colors ${selected ? 'border-primary/70 bg-primary/5' : 'border-border bg-[#111]'}`}
      data-note-id={n.id}
    >
      <div className="flex items-center gap-2 flex-wrap">
        {fl && (
          <button type="button" onClick={() => onSelect(n)} className="font-mono text-xs px-1.5 py-0.5 rounded-sm bg-card border border-border hover:border-primary text-foreground" title="Go to frame">
            {fl}
          </button>
        )}
        {n.drawing?.shapes?.length > 0 && <Pencil className="w-3.5 h-3.5 text-muted" aria-label="Has drawing" />}
        <StatusChip status={n.status} />
        {carried && <span className="text-[10px] text-muted">from {n.raised_in}</span>}
        <span className="ml-auto text-[11px] text-muted">{timeAgo(n.created_at)}</span>
      </div>
      <button type="button" onClick={() => onSelect(n)} className="text-left">
        <span className="text-xs text-muted">
          {n.author_name}
          {n.is_guest ? ' (client)' : ''}
        </span>
        {n.body && <p className="text-sm text-foreground whitespace-pre-wrap break-words">{n.body}</p>}
      </button>
      {outside && (
        <p className="text-[11px] text-warning flex gap-1 items-start">
          <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-px" />
          Frame {fl} is outside {item.label} ({item.frame_start}–{item.frame_end}). The shot may have been trimmed or retimed; check by eye.
        </p>
      )}

      {n.replies?.length > 0 && (
        <div className="flex flex-col gap-1.5 pl-3 border-l border-border">
          {n.replies.map((r) => (
            <HistoryLine key={r.id} r={r} />
          ))}
        </div>
      )}

      {fixComment !== null && (
        <div className="flex flex-col gap-1.5">
          <input
            autoFocus
            value={fixComment}
            onChange={(e) => setFixComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onStatus(n, 'fixed', fixComment);
                setFixComment(null);
              }
              if (e.key === 'Escape') setFixComment(null);
            }}
            placeholder="What did you change? (optional)"
            className="bg-[#0a0a0a] border border-border focus:border-primary rounded px-2 py-1 text-xs outline-none"
          />
          <div className="flex gap-2">
            <button type="button" className="btn-primary text-xs py-1 px-2" onClick={() => { onStatus(n, 'fixed', fixComment); setFixComment(null); }}>
              Mark fixed in {item.label}
            </button>
            <button type="button" className="text-xs text-muted hover:text-foreground" onClick={() => setFixComment(null)}>Cancel</button>
          </div>
        </div>
      )}

      {replying && (
        <div className="flex flex-col gap-1.5">
          <textarea
            autoFocus
            rows={2}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply();
              if (e.key === 'Escape') setReplying(false);
            }}
            className="bg-[#0a0a0a] border border-border focus:border-primary rounded px-2 py-1 text-xs outline-none resize-none"
            placeholder="Reply…"
          />
          <div className="flex gap-2">
            <button type="button" className="btn-primary text-xs py-1 px-2" onClick={sendReply}>Reply</button>
            <button type="button" className="text-xs text-muted hover:text-foreground" onClick={() => setReplying(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 text-xs">
        {caps.canNote && !replying && (
          <button type="button" className="text-muted hover:text-foreground flex items-center gap-1" onClick={() => setReplying(true)}>
            <CornerDownRight className="w-3.5 h-3.5" /> Reply
          </button>
        )}
        {n.status === 'open' && caps.canSetFixed && fixComment === null && (
          <button type="button" className="text-warning hover:text-warning/80 flex items-center gap-1" onClick={() => setFixComment('')}>
            <Check className="w-3.5 h-3.5" /> Mark fixed
          </button>
        )}
        {n.status === 'fixed' && caps.canVerify(n) && (
          <button type="button" className="text-success hover:text-success/80 flex items-center gap-1" onClick={() => onStatus(n, 'verified')}>
            <CheckCheck className="w-3.5 h-3.5" /> Verify fix
          </button>
        )}
        {(n.status === 'fixed' || n.status === 'verified') && caps.canVerify(n) && (
          <button type="button" className="text-muted hover:text-foreground flex items-center gap-1" onClick={() => onStatus(n, 'open')}>
            <RotateCcw className="w-3.5 h-3.5" /> Reopen
          </button>
        )}
        {caps.canDelete(n) && (
          <button type="button" className="ml-auto text-muted hover:text-danger" onClick={() => onDelete(n)} aria-label="Delete note">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

/** Note composer pinned to the current frame (or the in/out range). */
export const Composer = forwardRef(function Composer(
  { frame, inOut, shapesCount, onClearDrawing, onSubmit, guest, actionableDefault = true },
  ref
) {
  const [body, setBody] = useState('');
  const [useRange, setUseRange] = useState(true);
  const [actionable, setActionable] = useState(actionableDefault);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const ranged = inOut && useRange;
  const canSend = (body.trim() || shapesCount > 0) && !busy && (!guest || guest.name.trim());

  const send = async () => {
    if (!canSend) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        body: body.trim(),
        frame: ranged ? inOut.inFrame : frame,
        frame_end: ranged ? inOut.outFrame : null,
        actionable,
      });
      setBody('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 border border-border rounded-md p-3 bg-[#111]">
      {guest && (
        <input
          value={guest.name}
          onChange={(e) => guest.setName(e.target.value)}
          placeholder="Your name"
          className="bg-[#0a0a0a] border border-border focus:border-primary rounded px-2 py-1 text-sm outline-none"
          maxLength={80}
        />
      )}
      <textarea
        ref={ref}
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send();
          e.stopPropagation();
        }}
        placeholder={shapesCount ? 'Describe the drawing (optional)…' : 'Note on this frame… (N to focus, ⌘↵ to send)'}
        className="bg-[#0a0a0a] border border-border focus:border-primary rounded px-2 py-1.5 text-sm outline-none resize-none"
      />
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="font-mono px-1.5 py-0.5 rounded-sm bg-card border border-border">
          {ranged ? `${inOut.inFrame}–${inOut.outFrame}` : `frame ${frame}`}
        </span>
        {inOut && (
          <label className="flex items-center gap-1 text-muted">
            <input type="checkbox" checked={useRange} onChange={(e) => setUseRange(e.target.checked)} /> in/out range
          </label>
        )}
        {shapesCount > 0 && (
          <span className="text-muted">
            ✎ {shapesCount} mark{shapesCount > 1 ? 's' : ''}{' '}
            <button type="button" className="underline hover:text-foreground" onClick={onClearDrawing}>clear</button>
          </span>
        )}
        {!guest && (
          <label className="flex items-center gap-1 text-muted ml-auto" title="Needs a fix: tracked until verified">
            <input type="checkbox" checked={actionable} onChange={(e) => setActionable(e.target.checked)} /> needs a fix
          </label>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <button type="button" className="btn-primary text-sm py-1.5" disabled={!canSend} onClick={send}>
        {busy ? 'Sending…' : 'Add note'}
      </button>
    </div>
  );
});

export function NotesPanel({ notes, item, selectedNoteId, caps, onSelect, onStatus, onReply, onDelete, composer }) {
  const [filter, setFilter] = useState('todo');
  const { todo, all } = useMemo(() => {
    const byFrame = (x, y) => (x.frame ?? 1e12) - (y.frame ?? 1e12) || new Date(x.created_at) - new Date(y.created_at);
    const threads = notes || [];
    return {
      todo: threads.filter((n) => n.status === 'open' || n.status === 'fixed').sort(byFrame),
      all: [...threads].sort((x, y) => new Date(y.created_at) - new Date(x.created_at)),
    };
  }, [notes]);
  const shown = filter === 'todo' ? todo : all;

  return (
    <div className="flex flex-col gap-3 min-h-0 h-full">
      {composer}
      <div className="flex items-center gap-1 text-xs">
        {[
          ['todo', `To fix (${todo.length})`],
          ['all', `Everything (${all.length})`],
        ].map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`px-2 py-1 rounded-sm ${filter === k ? 'bg-card-hover text-foreground border border-border' : 'text-muted hover:text-foreground'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto min-h-0 flex-1 pr-1">
        {shown.length === 0 && (
          <p className="text-xs text-muted py-6 text-center">{filter === 'todo' ? 'Nothing left to fix.' : 'No notes yet.'}</p>
        )}
        {shown.map((n) =>
          n.kind === 'decision' ? (
            <DecisionRow key={n.id} n={n} />
          ) : (
            <NoteCard
              key={n.id}
              n={n}
              item={item}
              selected={n.id === selectedNoteId}
              caps={caps}
              onSelect={onSelect}
              onStatus={onStatus}
              onReply={onReply}
              onDelete={onDelete}
            />
          )
        )}
      </div>
    </div>
  );
}
