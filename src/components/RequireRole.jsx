import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { hasRole } from '../lib/permissions';

/**
 * Role gate. Renders children only if the current user's app_role is in
 * ``roles``. Otherwise redirects to ``/dashboard`` (Settings is the only
 * gated route today — silent redirect is friendlier than a 403 page).
 */
export function RequireRole({ roles = [], children }) {
  const { enabled, user, loaded } = useAuth();
  if (!enabled) return children;
  if (!loaded) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted text-sm">
        Loading session...
      </div>
    );
  }
  if (!user || !hasRole(user, ...roles)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export default RequireRole;
