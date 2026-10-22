import { useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { useCreateReviewShare } from '../../api/hooks';

const inputClass =
  'bg-[#111] border border-border focus:border-primary text-foreground text-sm rounded-md px-3 py-2 outline-none transition-colors';

/** Create a client review link for one or more review items. */
export function ShareDialog({ projectId, itemIds, title = '', onClose }) {
  const create = useCreateReviewShare();
  const [name, setName] = useState(title);
  const [password, setPassword] = useState('');
  const [days, setDays] = useState('14');
  const [allowDecisions, setAllowDecisions] = useState(true);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const res = await create.mutateAsync({
      item_ids: itemIds,
      title: name.trim(),
      password: password || undefined,
      expires_in_days: days ? Number(days) : null,
      allow_decisions: allowDecisions,
    });
    setResult(res);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-label="Share with a client">
      <div className="bg-background/90 fixed inset-0 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative glass-panel max-w-md w-full p-5 flex flex-col gap-4" onKeyDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-serif">Share with a client</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        {result ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">
              Anyone with this link{result.has_password ? ' and the password' : ''} can watch {itemIds.length > 1 ? `these ${itemIds.length} items` : 'this item'}, leave notes
              {result.allow_decisions ? ' and approve or ask for changes' : ''}. They never see your internal notes.
            </p>
            <div className="flex gap-2 items-center">
              <code className="flex-1 text-xs bg-[#111] border border-border rounded px-2 py-2 break-all select-all">{result.link}</code>
              <button
                type="button"
                className="btn-secondary gap-1.5 text-xs py-1.5"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(result.link);
                    setCopied(true);
                  } catch (_) {
                    /* clipboard blocked: the link is selectable */
                  }
                }}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            {password && <p className="text-xs text-muted">Send the password separately: <span className="text-foreground font-mono">{password}</span></p>}
            <button type="button" className="btn-primary text-sm" onClick={onClose}>Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">Title the client sees</span>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Teaser cut, week 12" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">Password (optional)</span>
              <input className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave empty for link-only" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">Link expires</span>
              <select className={inputClass} value={days} onChange={(e) => setDays(e.target.value)}>
                <option value="3">in 3 days</option>
                <option value="7">in 7 days</option>
                <option value="14">in 14 days</option>
                <option value="30">in 30 days</option>
                <option value="">never</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={allowDecisions} onChange={(e) => setAllowDecisions(e.target.checked)} />
              Client can approve or request changes
            </label>
            {create.error && <p className="text-sm text-danger">{create.error.message}</p>}
            <button type="submit" className="btn-primary text-sm" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create link'}
            </button>
            <p className="text-[11px] text-muted">You can revoke links any time from Reviews → Client links.</p>
          </form>
        )}
      </div>
    </div>
  );
}
