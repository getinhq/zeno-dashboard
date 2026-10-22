import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Sparkles } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

const inputClass =
  'bg-[#111] border border-border focus:border-primary text-foreground text-sm rounded-md px-3 py-2 outline-none transition-colors';

export function useAuthConfig() {
  return useQuery({
    queryKey: ['auth-config'],
    queryFn: () => api.get('/api/v1/auth/config'),
    staleTime: 5 * 60 * 1000,
  });
}

/** Self-service signup: creates a studio (organization) and its first admin. */
export function Signup() {
  const { isAuthenticated, signup, enabled, loaded } = useAuth();
  const navigate = useNavigate();
  const { data: config, isLoading: configLoading } = useAuthConfig();

  const [form, setForm] = useState({ studio_name: '', name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!enabled) return <Navigate to="/dashboard" replace />;
  if (loaded && isAuthenticated) return <Navigate to="/dashboard" replace />;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signup({
        studio_name: form.studio_name.trim(),
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      // New studios start with the guided setup.
      navigate('/getting-started', { replace: true });
    } catch (err) {
      setError(err?.message || 'Signup failed');
    } finally {
      setSubmitting(false);
    }
  };

  const signupClosed = !configLoading && config && !config.signup_enabled;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="glass-panel w-full max-w-md p-8 flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Create your studio</h1>
          <p className="text-muted text-sm mt-1">
            Set up a workspace for your team. You can invite people right after.
          </p>
        </div>

        {signupClosed ? (
          <div className="text-sm text-muted border border-border rounded-md px-3 py-3">
            Signup is closed on this server. Ask your studio admin for an invite link.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-muted">Studio name</span>
              <input
                type="text"
                value={form.studio_name}
                onChange={set('studio_name')}
                placeholder="e.g. Paper Crane Animation"
                required
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-muted">Your name</span>
              <input
                type="text"
                autoComplete="name"
                value={form.name}
                onChange={set('name')}
                required
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-muted">Email</span>
              <input
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={set('email')}
                required
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-muted">Password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={set('password')}
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

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary flex items-center justify-center gap-2 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-4 h-4" />
              {submitting ? 'Creating studio...' : 'Create studio'}
            </button>
          </form>
        )}

        <p className="text-xs text-muted text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;
