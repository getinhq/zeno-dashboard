import api from '../api/client';

export const FALLBACK_DCC = [
  { id: 'blender', label: 'Blender' },
  { id: 'maya', label: 'Maya' },
  { id: 'nuke', label: 'Nuke' },
];

export function normalizeDccOptions(apps = []) {
  if (!Array.isArray(apps) || apps.length === 0) {
    return FALLBACK_DCC.map((o) => ({ kind: o.id, label: o.label, key: o.id }));
  }
  return apps.map((a, i) => ({
    kind: String(a.dcc_kind || a.dcc || 'blender').toLowerCase(),
    label: String(a.label),
    key: `${a.dcc_kind || 'blender'}:${a.label}:${i}`,
  }));
}

export function mintHeaders() {
  const mintKey = import.meta.env.VITE_ZENO_LAUNCH_MINT_KEY;
  const h = {};
  if (mintKey) h['X-Zeno-Launch-Mint-Key'] = mintKey;
  return h;
}

export async function launchWithContext({ context, headers }) {
  const res = await api.post('/api/v1/launch-tokens', { context }, { headers: headers || mintHeaders() });
  const token = res.token;
  const daemonBase = import.meta.env.VITE_ZENO_BRIDGE_DAEMON_URL || 'http://127.0.0.1:17373';
  let launched = false;
  try {
    const r = await fetch(`${daemonBase}/launch?token=${encodeURIComponent(token)}`, { method: 'GET' });
    launched = r.ok;
  } catch (_) {
    launched = false;
  }
  if (!launched) {
    const url = `zeno://launch?token=${encodeURIComponent(token)}`;
    window.location.href = url;
  }
  return { launched, token };
}
