import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';

export function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const [globalDoc, setGlobalDoc] = useState(null);
  const [useMinio, setUseMinio] = useState(true);
  const [localCasRoot, setLocalCasRoot] = useState('/tmp/zeno_cas');

  const env = 'development';

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const doc = await api.get(`/settings/global?env=${encodeURIComponent(env)}`);
        if (!mounted) return;
        setGlobalDoc(doc);
        const cas = doc?.extra?.cas || {};
        setUseMinio(typeof cas.use_minio === 'boolean' ? cas.use_minio : true);
        setLocalCasRoot(typeof cas.local_cas_root === 'string' && cas.local_cas_root.trim() ? cas.local_cas_root : '/tmp/zeno_cas');
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || 'Failed to load settings');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const payload = useMemo(() => {
    const resolution = globalDoc?.resolution || { width: 1920, height: 1080 };
    const frame = globalDoc?.frame || { rate: 24.0, handle_in: 0, handle_out: 0 };
    const qc_checks = Array.isArray(globalDoc?.qc_checks) ? globalDoc.qc_checks : [];
    const extra = {
      ...(globalDoc?.extra || {}),
      cas: {
        use_minio: !!useMinio,
        local_cas_root: localCasRoot,
      },
    };
    return { resolution, frame, qc_checks, extra };
  }, [globalDoc, useMinio, localCasRoot]);

  const onSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSaved('');
      const updated = await api.put(`/settings/global?env=${encodeURIComponent(env)}`, payload);
      setGlobalDoc(updated);
      setSaved('Settings saved.');
    } catch (e) {
      setError(e?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-4xl font-serif font-bold text-foreground">Settings</h1>
        <p className="text-muted text-sm tracking-wide mt-1">Global and project configuration</p>
      </div>

      <div className="glass-panel p-6 flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Global CAS Storage</h2>
        <p className="text-sm text-muted">
          Choose where CAS blobs are stored. When MinIO is disabled, API uses the local CAS path.
        </p>

        {loading && <p className="text-sm text-muted">Loading settings...</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
        {saved && <p className="text-sm text-emerald-400">{saved}</p>}

        {!loading && (
          <div className="flex flex-col gap-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={useMinio}
                onChange={(e) => setUseMinio(e.target.checked)}
              />
              <span className="text-sm">Use MinIO Storage (enabled = MinIO/S3, disabled = local CAS path)</span>
            </label>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Local CAS Root Path</label>
              <input
                className="px-3 py-2 rounded bg-black/20 border border-white/20 text-sm"
                value={localCasRoot}
                onChange={(e) => setLocalCasRoot(e.target.value)}
                placeholder="/tmp/zeno_cas (host) or /app/cas_data (Docker)"
              />
              <p className="text-xs text-muted">
                Example path hint: <code>/tmp/zeno_cas</code> on host development, or <code>/app/cas_data</code> inside Docker API container.
              </p>
            </div>

            <div>
              <button className="px-4 py-2 rounded bg-primary text-white text-sm disabled:opacity-60" onClick={onSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Global CAS Settings'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
