import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, UserPlus } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

const inputClass =
  'bg-[#111] border border-border focus:border-primary text-foreground text-sm rounded-md px-3 py-2 outline-none transition-colors';

/** Public page behind an invite link: shows who invited you, then creates your account. */
export function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { startSession, isAuthenticated, user, logout } = useAuth();
  const { data: invite, error: loadError, isLoading } = useQuery({
    queryKey: ['invite-preview', token],
    queryFn: () => api.get(`/api/v1/invites/public/${encodeURIComponent(token)}`),
    retry: false,
  });

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body = { name: form.name.trim(), password: form.password };
      if (!invite?.email) body.email = form.email.trim();
      const data = await api.post(`/api/v1/invites/public/${encodeURIComponent(token)}/accept`, body);
      startSession(data);
      navigate('/getting-started', { replace: true });
    } catch (err) {
      setError(err?.message || 'Could not accept the invite');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="glass-panel w-full max-w-md p-8 flex flex-col gap-6">
        {isLoading && <p className="text-muted text-sm">Checking your invite…</p>}

        {loadError && (
          <>
            <h1 className="text-2xl font-serif font-bold text-foreground">Invite unavailable</h1>
            <div className="flex items-start gap-2 text-danger text-sm border border-danger/30 rounded-md px-3 py-2 bg-danger/10">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{loadError.message}. Ask whoever invited you for a new link.</span>
            </div>
            <Link to="/login" className="text-sm text-primary hover:underline text-center">Go to sign in</Link>
          </>
        )}

        {invite && isAuthenticated && (
          <>
            <h1 className="text-2xl font-serif font-bold text-foreground">You are signed in</h1>
            <p className="text-sm text-muted">
              You are signed in as <b className="text-foreground">{user?.email || user?.username}</b>. To accept an
              invite to <b className="text-foreground">{invite.organization}</b> with a new account, sign out first.
            </p>
            <button type="button" className="btn-secondary" onClick={logout}>Sign out</button>
          </>
        )}

        {invite && !isAuthenticated && (
          <>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted">You are invited to</p>
              <h1 className="text-3xl font-serif font-bold text-foreground">{invite.organization}</h1>
              <p className="text-muted text-sm mt-2">
                {invite.invited_by ? `${invite.invited_by} invited you` : 'You were invited'} to join as{' '}
                <b className="text-foreground capitalize">{invite.app_role}</b>.
              </p>
              {invite.message && (
                <blockquote className="mt-3 border-l-2 border-primary pl-3 text-sm text-foreground/90 italic">
                  {invite.message}
                </blockquote>
              )}
            </div>

            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wider text-muted">Your name</span>
                <input value={form.name} onChange={set('name')} autoComplete="name" required className={inputClass} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wider text-muted">Email</span>
                {invite.email ? (
                  <input value={invite.email} disabled className={`${inputClass} opacity-70`} />
                ) : (
                  <input type="email" value={form.email} onChange={set('email')} autoComplete="email" required className={inputClass} />
                )}
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wider text-muted">Choose a password</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={set('password')}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className={inputClass}
                />
                <span className="text-xs text-muted">At least 8 characters.</span>
              </label>
              {error && (
                <div className="flex items-start gap-2 text-danger text-sm border border-danger/30 rounded-md px-3 py-2 bg-danger/10">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              <button type="submit" disabled={submitting} className="btn-primary gap-2 py-2 disabled:opacity-50">
                <UserPlus className="w-4 h-4" />
                {submitting ? 'Joining…' : `Join ${invite.organization}`}
              </button>
            </form>
            <p className="text-xs text-muted text-center">
              Invite expires {new Date(invite.expires_at).toLocaleDateString()}.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default AcceptInvite;
