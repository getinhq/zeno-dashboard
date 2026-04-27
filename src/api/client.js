/**
 * API client for Zeno backend. Uses relative /api in dev (Vite proxy to 127.0.0.1:8000).
 *
 * Auth:
 *  - Callers set `setAuthProvider({ getAccessToken, getRefreshToken, onTokensUpdated, onAuthFailure })`
 *    when AuthContext mounts.
 *  - The client injects `Authorization: Bearer <access>` on every request.
 *  - On a 401, it attempts a single `/api/v1/auth/refresh` then replays the call.
 *    A second 401 triggers `onAuthFailure()` which the AuthContext uses to
 *    kick the user back to `/login`.
 */
const BASE = import.meta.env.VITE_API_URL || '';

let _authProvider = null;

export function setAuthProvider(provider) {
  _authProvider = provider;
}

export function clearAuthProvider() {
  _authProvider = null;
}

function _authHeaders() {
  if (!_authProvider) return {};
  try {
    const tok = _authProvider.getAccessToken?.();
    return tok ? { Authorization: `Bearer ${tok}` } : {};
  } catch (_) {
    return {};
  }
}

async function _refreshAccess() {
  if (!_authProvider) return null;
  const refresh = _authProvider.getRefreshToken?.();
  if (!refresh) return null;
  try {
    const res = await fetch(`${BASE}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const next = data?.access_token || null;
    if (next) {
      _authProvider.onTokensUpdated?.({ accessToken: next });
    }
    return next;
  } catch (_) {
    return null;
  }
}

async function _rawRequest(path, options) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  // Let callers opt out of the JSON Content-Type (needed for FormData/raw streams
  // where the browser must set its own multipart boundary).
  const skipJson = options._skipJsonContentType;
  const baseHeaders = skipJson ? {} : { 'Content-Type': 'application/json' };
  const headers = {
    ...baseHeaders,
    ..._authHeaders(),
    ...(options.headers || {}),
  };
  const fetchOpts = { ...options, headers };
  delete fetchOpts._skipJsonContentType;
  return fetch(url, fetchOpts);
}

async function request(path, options = {}) {
  let res = await _rawRequest(path, options);
  if (res.status === 401 && _authProvider?.getRefreshToken?.()) {
    const newAccess = await _refreshAccess();
    if (newAccess) {
      res = await _rawRequest(path, options);
    }
    if (res.status === 401) {
      _authProvider.onAuthFailure?.();
    }
  }
  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const j = JSON.parse(text);
      detail = j.detail ?? text;
    } catch (_) {}
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

/** POST a ``FormData`` (multipart) body with the auth header attached. */
async function postForm(path, formData) {
  return request(path, {
    method: 'POST',
    body: formData,
    _skipJsonContentType: true,
  });
}

/**
 * Fetch a protected binary resource and return an object URL the browser can
 * render directly (image `src`, video `src`, anchor `href`). Callers are
 * responsible for releasing the URL with ``URL.revokeObjectURL`` when the
 * element unmounts.
 */
async function getBlobUrl(path) {
  let res = await _rawRequest(path, { method: 'GET' });
  if (res.status === 401 && _authProvider?.getRefreshToken?.()) {
    const newAccess = await _refreshAccess();
    if (newAccess) res = await _rawRequest(path, { method: 'GET' });
    if (res.status === 401) _authProvider.onAuthFailure?.();
  }
  if (!res.ok) {
    const err = new Error(`Download failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export const api = {
  get: (path, opts = {}) => request(path, { method: 'GET', ...opts }),
  post: (path, body, extra = {}) =>
    request(path, { method: 'POST', body: JSON.stringify(body), ...extra }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: 'DELETE' }),
  postForm,
  getBlobUrl,
};

export default api;
