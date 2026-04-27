import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, setAuthProvider } from '../api/client';

const STORAGE_KEY = 'zeno_auth_v1';
const AuthContext = createContext(null);

const AUTH_ENABLED = String(import.meta.env.VITE_ENABLE_AUTH ?? 'true').toLowerCase() !== 'false';

function _loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function _saveStored(state) {
  try {
    if (!state) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch (_) {}
}

export function AuthProvider({ children }) {
  const [loaded, setLoaded] = useState(false);
  const [authState, setAuthState] = useState(() => _loadStored());
  const stateRef = useRef(authState);
  stateRef.current = authState;

  const setState = useCallback((next) => {
    stateRef.current = next;
    setAuthState(next);
    _saveStored(next);
  }, []);

  const clearAuth = useCallback(() => setState(null), [setState]);

  useEffect(() => {
    setAuthProvider({
      getAccessToken: () => stateRef.current?.accessToken || null,
      getRefreshToken: () => stateRef.current?.refreshToken || null,
      onTokensUpdated: ({ accessToken }) => {
        if (!stateRef.current) return;
        setState({ ...stateRef.current, accessToken });
      },
      onAuthFailure: () => {
        clearAuth();
      },
    });
  }, [setState, clearAuth]);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      if (!AUTH_ENABLED) {
        setLoaded(true);
        return;
      }
      if (!authState?.accessToken) {
        setLoaded(true);
        return;
      }
      try {
        const me = await api.get('/api/v1/auth/me');
        if (cancelled) return;
        setState({ ...(stateRef.current || {}), user: me });
      } catch (_) {
        if (!cancelled) clearAuth();
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await api.post('/api/v1/auth/login', { username, password });
    const next = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      user: data.user,
    };
    setState(next);
    return next.user;
  }, [setState]);

  const logout = useCallback(async () => {
    const refresh = stateRef.current?.refreshToken;
    clearAuth();
    if (refresh) {
      try {
        await api.post('/api/v1/auth/logout', { refresh_token: refresh });
      } catch (_) {}
    }
  }, [clearAuth]);

  const stubUser = useMemo(
    () => ({
      id: '00000000-0000-0000-0000-000000000000',
      username: 'dev',
      email: 'dev@local',
      name: 'Dev',
      role: null,
      app_role: 'pipeline',
    }),
    [],
  );

  const value = useMemo(() => {
    const effectiveUser = AUTH_ENABLED ? authState?.user || null : stubUser;
    return {
      enabled: AUTH_ENABLED,
      user: effectiveUser,
      isAuthenticated: AUTH_ENABLED ? Boolean(authState?.accessToken && authState?.user) : true,
      loaded,
      login,
      logout,
    };
  }, [authState, loaded, login, logout, stubUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
