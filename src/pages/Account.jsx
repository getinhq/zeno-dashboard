import { useState } from 'react';
import { Check, Copy, KeyRound, Trash2 } from 'lucide-react';
import { useApiTokens, useCreateApiToken, useRevokeApiToken } from '../api/hooks';
import { useAuth } from '../contexts/AuthContext';

const inputClass =
  'bg-[#111] border border-border focus:border-primary text-foreground text-sm rounded-md px-3 py-2 outline-none transition-colors';

const EXPIRY = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
  { value: '', label: 'Never' },
];

/** Profile + personal access tokens for the Blender add-on and scripts. */
export function Account() {
  const { user } = useAuth();
  const { data: tokens = [], isLoading } = useApiTokens();
  const create = useCreateApiToken();
  const revoke = useRevokeApiToken();
  const [name, setName] = useState('Blender');
  const [expiry, setExpiry] = useState('90');
  const [fresh, setFresh] = useState(null);
  const [copied, setCopied] = useState(false);

  const onCreate = async (e) => {
    e.preventDefault();
    const res = await create.mutateAsync({ name: name.trim(), expires_in_days: expiry ? Number(expiry) : null });
    setFresh(res);
    setCopied(false);
  };

  return (
    <div className="max-w-3xl flex flex-col gap-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted">Account</p>
        <h1 className="text-3xl font-serif text-foreground">{user?.name || user?.username}</h1>
        <p className="text-sm text-muted mt-1">
          {user?.email} · <span className="capitalize">{user?.app_role}</span>
          {user?.organization?.name && ` · ${user.organization.name}`}
        </p>
      </div>

      <section className="glass-panel p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">API tokens</h2>
        </div>
        <p className="text-sm text-muted">
          Blender opened with <b className="text-foreground">Open in DCC</b> signs in automatically. If you start Blender yourself,
          create a token here and paste it in <i>Edit → Preferences → Add-ons → Chimera Zeno → API Token</i> (or set the{' '}
          <code className="text-foreground">ZENO_API_TOKEN</code> environment variable). A token acts as you, so keep it private.
        </p>

        <form onSubmit={onCreate} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Name</span>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required placeholder="Blender workstation" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Expires</span>
            <select className={inputClass} value={expiry} onChange={(e) => setExpiry(e.target.value)}>
              {EXPIRY.map((o) => <option key={o.label} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <button type="submit" className="btn-primary text-sm" disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create token'}
          </button>
        </form>
        {create.error && <p className="text-sm text-danger">{create.error.message}</p>}

        {fresh && (
          <div className="border border-primary/40 bg-primary/5 rounded-md p-3 flex flex-col gap-2">
            <p className="text-sm text-foreground">Copy “{fresh.name}” now — it will not be shown again.</p>
            <div className="flex gap-2 items-center">
              <code className="flex-1 text-xs bg-[#111] border border-border rounded px-2 py-2 break-all select-all">{fresh.token}</code>
              <button
                type="button"
                className="btn-secondary gap-2 text-xs py-1.5"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(fresh.token);
                    setCopied(true);
                  } catch (_) {
                    /* clipboard blocked: the token is selectable */
                  }
                }}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : tokens.length === 0 ? (
          <p className="text-sm text-muted">No tokens yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted text-left">
              <tr>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Token</th>
                <th className="py-2 pr-3">Last used</th>
                <th className="py-2 pr-3">Expires</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tokens.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="py-2 pr-3">{t.name}</td>
                  <td className="py-2 pr-3 font-mono text-xs text-muted">{t.prefix}…</td>
                  <td className="py-2 pr-3 text-muted">{t.last_used_at ? new Date(t.last_used_at).toLocaleString() : 'Never'}</td>
                  <td className="py-2 pr-3 text-muted">{t.expires_at ? new Date(t.expires_at).toLocaleDateString() : 'Never'}</td>
                  <td className="py-2 text-right">
                    <button type="button" className="text-muted hover:text-danger" onClick={() => revoke.mutate(t.id)} aria-label={`Revoke ${t.name}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

export default Account;
