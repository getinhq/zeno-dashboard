import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Gate wrapper: renders children only for authenticated users.
 * While AuthContext is still bootstrapping (`/auth/me` in flight) it shows a
 * neutral splash so we don't flash the login screen for already-signed-in users.
 */
export function RequireAuth({ children }) {
  const { enabled, isAuthenticated, loaded } = useAuth();
  const location = useLocation();

  if (!enabled) return children;
  if (!loaded) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted text-sm">
        Loading session...
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
}

export default RequireAuth;
