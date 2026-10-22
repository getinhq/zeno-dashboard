import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Lock, XCircle } from 'lucide-react';
import { mediaUrl } from '../api/client';
import { ReviewPlayer } from '../components/review/ReviewPlayer';

const NAME_KEY = 'zeno_review_guest_name';

function store(kind, key, value) {
  try {
    if (value === undefined) return window[kind].getItem(key) || '';
    window[kind].setItem(key, value);
  } catch (_) {
    /* storage blocked: fine, the visitor just retypes */
  }
  return value ?? '';
}

async function call(token, password, path = '', options = {}) {
  const res = await fetch(mediaUrl(`/api/v1/review-shares/public/${token}${path}`), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(password ? { 'X-Share-Password': password } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.detail || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Review page for clients: no account, opened from a share link. */
export function PublicReview() {
  const { token } = useParams();
  const pwKey = `zeno_review_pw:${token}`;
  const [password, setPassword] = useState(() => store('sessionStorage', pwKey));
  const [pwInput, setPwInput] = useState('');
  const [state, setState] = useState({ loading: true });
  const [current, setCurrent] = useState(0);
  const [name, setNameState] = useState(() => store('localStorage', NAME_KEY));
  const [decision, setDecision] = useState(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [decided, setDecided] = useState({});
  const setName = (v) => setNameState(store('localStorage', NAME_KEY, v));

  const load = useCallback(async (pw) => {
    try {
      const data = await call(token, pw);
      setState({ data });
    } catch (e) {
      setState({ error: e });
    }
  }, [token]);

  useEffect(() => {
    load(password);
  }, [load, password]);

  const { data, error, loading } = state;
  const shell = 'dashboard-app min-h-screen bg-background text-foreground';

  if (loading) return <div className={`${shell} p-8 text-muted text-sm`}>Opening review…</div>;
  if (error?.status === 401) {
    return (
      <div className={`${shell} flex items-center justify-center p-4`}>
        <form
          className="glass-panel p-6 w-full max-w-sm flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            store('sessionStorage', pwKey, pwInput);
            setPassword(pwInput);
            setState({ loading: true });
          }}
        >
          <Lock className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-serif">This review is password protected</h1>
          {password && <p className="text-sm text-danger">That password did not work.</p>}
          <input
            type="password"
            autoFocus
            value={pwInput}
            onChange={(e) => setPwInput(e.target.value)}
            className="bg-[#111] border border-border focus:border-primary rounded-md px-3 py-2 text-sm outline-none"
            placeholder="Password"
          />
          <button type="submit" className="btn-primary text-sm">Open</button>
        </form>
      </div>
    );
  }
  if (error) {
    return (
      <div className={`${shell} flex items-center justify-center p-4`}>
        <div className="glass-panel p-6 max-w-sm text-center">
          <h1 className="text-xl font-serif mb-2">Review unavailable</h1>
          <p className="text-sm text-muted">{error.message}. Ask the studio for a new link.</p>
        </div>
      </div>
    );
  }

  const items = data.items || [];
  const item = items[current];
  const setNotes = (itemId, notes) =>
    setState((s) => ({
      data: { ...s.data, items: s.data.items.map((it) => (it.id === itemId ? { ...it, notes } : it)) },
    }));
  const addNote = async (payload) => {
    const res = await call(token, password, `/items/${item.id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ ...payload, guest_name: name }),
    });
    setNotes(item.id, res.notes);
  };
  const sendDecision = async () => {
    const res = await call(token, password, `/items/${item.id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, comment: decisionNote, guest_name: name }),
    });
    setNotes(item.id, res.notes);
    setDecided((d) => ({ ...d, [item.id]: decision }));
    setDecision(null);
    setDecisionNote('');
  };

  return (
    <div className={`${shell} flex flex-col h-screen p-4 gap-3`}>
      <header className="flex items-center gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">{[data.studio, data.project].filter(Boolean).join(' · ')}</p>
          <h1 className="text-2xl font-serif">{data.title}</h1>
        </div>
        {items.length > 1 && (
          <nav className="flex gap-2 overflow-x-auto" aria-label="Items in this review">
            {items.map((it, i) => (
              <button
                key={it.id}
                type="button"
                onClick={() => setCurrent(i)}
                className={`shrink-0 w-28 rounded-sm overflow-hidden border text-left ${i === current ? 'border-primary' : 'border-border opacity-70 hover:opacity-100'}`}
              >
                {it.media?.thumbnail && <img src={mediaUrl(it.media.thumbnail)} alt="" className="w-full aspect-video object-cover bg-black" />}
                <span className="block text-[10px] font-mono px-1 py-0.5 truncate">
                  {it.task.entity_label} {it.label}
                  {decided[it.id] === 'approve' ? ' ✓' : ''}
                </span>
              </button>
            ))}
          </nav>
        )}
        {item && data.allow_decisions && (
          <div className="ml-auto flex gap-2">
            {decided[item.id] ? (
              <span className={`text-sm ${decided[item.id] === 'approve' ? 'text-success' : 'text-warning'}`}>
                You {decided[item.id] === 'approve' ? 'approved' : 'asked for changes on'} {item.label}. The studio has been told.
              </span>
            ) : (
              <>
                <button type="button" className="btn-secondary text-xs py-1.5 gap-1.5 border-warning/50 text-warning" onClick={() => setDecision('changes_requested')}>
                  <XCircle className="w-3.5 h-3.5" /> Request changes
                </button>
                <button type="button" className="btn-primary text-xs py-1.5 gap-1.5" onClick={() => setDecision('approve')}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                </button>
              </>
            )}
          </div>
        )}
      </header>

      {decision && (
        <div className="glass-panel p-3 flex flex-col gap-2">
          <p className="text-sm">{decision === 'approve' ? `Approve ${item.label}?` : `Ask for changes on ${item.label}? Leave notes on the frames so the team knows what to change.`}</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="bg-[#111] border border-border focus:border-primary rounded px-2 py-1.5 text-sm outline-none max-w-xs"
          />
          <textarea
            rows={2}
            value={decisionNote}
            onChange={(e) => setDecisionNote(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Message to the studio (optional)"
            className="bg-[#111] border border-border focus:border-primary rounded px-2 py-1.5 text-sm outline-none resize-none"
          />
          <div className="flex gap-2">
            <button type="button" className="btn-primary text-sm py-1.5" disabled={!name.trim()} onClick={sendDecision}>Send</button>
            <button type="button" className="btn-secondary text-sm py-1.5" onClick={() => setDecision(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0">
        {item ? (
          <ReviewPlayer
            key={item.id}
            item={item}
            notes={item.notes}
            guest={{ name, setName }}
            caps={{ canNote: true, canSetFixed: false, canVerify: () => false, canDelete: () => false }}
            onAddNote={addNote}
            onReply={(n, body) => addNote({ body, parent_id: n.id })}
            onStatus={() => {}}
            onDeleteNote={() => {}}
          />
        ) : (
          <p className="text-muted text-sm">Nothing to review here yet.</p>
        )}
      </div>
      <footer className="text-[10px] text-muted text-center">Shared with Zeno · frame-accurate review</footer>
    </div>
  );
}

export default PublicReview;
