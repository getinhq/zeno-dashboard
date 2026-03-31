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
  const [dccApplications, setDccApplications] = useState([]);

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
        const dcc = Array.isArray(doc?.extra?.dcc_applications) ? doc.extra.dcc_applications : [];
        setDccApplications(
          dcc.length
            ? dcc.map((row) => ({
                label: String(row.label || ''),
                path: String(row.path || ''),
                dcc_kind: String(row.dcc_kind || row.dcc || 'blender'),
                default: !!row.default,
              }))
            : [{ label: '', path: '', dcc_kind: 'blender', default: true }],
        );
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
      dcc_applications: dccApplications
        .filter((r) => r.path.trim() && r.label.trim())
        .map((r) => ({
          label: r.label.trim(),
          path: r.path.trim(),
          dcc_kind: r.dcc_kind.trim() || 'blender',
          default: !!r.default,
        })),
    };
    return { resolution, frame, qc_checks, extra };
  }, [globalDoc, useMinio, localCasRoot, dccApplications]);

  const onSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSaved('');
      const updated = await api.put(`/settings/global?env=${encodeURIComponent(env)}`, payload);
      setGlobalDoc(updated);
      const savedDcc = updated?.extra?.dcc_applications;
      if (Array.isArray(savedDcc) && savedDcc.length > 0) {
        setDccApplications(
          savedDcc.map((row) => ({
            label: String(row.label || ''),
            path: String(row.path || ''),
            dcc_kind: String(row.dcc_kind || row.dcc || 'blender'),
            default: !!row.default,
          })),
        );
      } else if (Array.isArray(savedDcc) && savedDcc.length === 0) {
        setDccApplications([{ label: '', path: '', dcc_kind: 'blender', default: true }]);
      }
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
              <button
                type="button"
                className="px-4 py-2 rounded bg-primary text-white text-sm disabled:opacity-60"
                onClick={onSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save settings'}
              </button>
              <p className="text-xs text-muted mt-2">Saves CAS options and everything below (including DCC apps) in one request.</p>
            </div>
          </div>
        )}
      </div>

      <div className="glass-panel p-6 flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Application settings (DCC)</h2>
        <p className="text-sm text-muted">
          Register DCC executables by label (e.g. multiple Blender versions). The web app uses these for &quot;Open in DCC&quot;;
          the API embeds the path in the launch token so Zeno Bridge can spawn the correct binary. Paths must exist on the
          machine where the bridge runs (often your workstation).
        </p>
        {!loading && (
          <div className="flex flex-col gap-4">
            {dccApplications.map((row, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end border border-border rounded-md p-3 bg-card/40"
              >
                <label className="md:col-span-3 flex flex-col gap-1">
                  <span className="text-xs text-muted">Label</span>
                  <input
                    className="px-2 py-1.5 rounded bg-black/20 border border-white/20 text-sm"
                    value={row.label}
                    placeholder="Blender 4.2"
                    onChange={(e) => {
                      const next = [...dccApplications];
                      next[idx] = { ...row, label: e.target.value };
                      setDccApplications(next);
                    }}
                  />
                </label>
                <label className="md:col-span-2 flex flex-col gap-1">
                  <span className="text-xs text-muted">Kind</span>
                  <select
                    className="px-2 py-1.5 rounded bg-black/20 border border-white/20 text-sm"
                    value={row.dcc_kind}
                    onChange={(e) => {
                      const next = [...dccApplications];
                      next[idx] = { ...row, dcc_kind: e.target.value };
                      setDccApplications(next);
                    }}
                  >
                    <option value="blender">blender</option>
                    <option value="maya">maya</option>
                    <option value="nuke">nuke</option>
                    <option value="houdini">houdini</option>
                  </select>
                </label>
                <label className="md:col-span-6 flex flex-col gap-1">
                  <span className="text-xs text-muted">Executable path</span>
                  <input
                    className="px-2 py-1.5 rounded bg-black/20 border border-white/20 text-sm font-mono"
                    value={row.path}
                    placeholder="/Applications/Blender.app/Contents/MacOS/Blender"
                    onChange={(e) => {
                      const next = [...dccApplications];
                      next[idx] = { ...row, path: e.target.value };
                      setDccApplications(next);
                    }}
                  />
                </label>
                <label className="md:col-span-1 flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={row.default}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setDccApplications(
                        dccApplications.map((r, i) => ({
                          ...r,
                          default: checked ? i === idx : i === idx ? false : r.default,
                        })),
                      );
                    }}
                  />
                  Default
                </label>
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary text-sm self-start"
              onClick={() =>
                setDccApplications([...dccApplications, { label: '', path: '', dcc_kind: 'blender', default: false }])
              }
            >
              + Add DCC
            </button>

            <div className="flex flex-col gap-2 pt-4 border-t border-border mt-2">
              {error && <p className="text-sm text-red-400">{error}</p>}
              {saved && <p className="text-sm text-emerald-400">{saved}</p>}
              <button
                type="button"
                className="px-4 py-2 rounded bg-primary text-white text-sm font-medium disabled:opacity-60 w-fit"
                onClick={onSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save settings'}
              </button>
              <p className="text-xs text-muted max-w-xl">
                Click <strong className="text-foreground font-medium">Save settings</strong> after editing DCC rows. Refresh only shows data that was saved to the server.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
