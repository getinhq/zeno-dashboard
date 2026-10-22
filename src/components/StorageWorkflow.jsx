import { useEffect, useMemo, useState } from 'react';
import { Code2, Layers, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useSaveStoragePolicy, useStoragePolicy } from '../api/hooks';

const STRATEGY_LABEL = {
  chunked: 'Chunked dedup',
  whole: 'Whole file',
  per_frame: 'Per-frame dedup',
  off: 'Off (movies only)',
};

const STATUS_STYLE = {
  stable: 'text-success border-success/50',
  beta: 'text-info border-info/50',
  experimental: 'text-warning border-warning/50',
};

const GROUPS = [
  { kind: 'scene', title: 'Scene files (publishing from DCCs)', hint: 'Chunked: only changed parts of a file are uploaded and stored. Whole file: one upload per version (identical files still stored once).' },
  { kind: 'review_image', title: 'Review image sequences', hint: 'Per-frame: each frame stored once, so unchanged frames cost nothing. Off: artists submit movies instead.' },
  { kind: 'review_movie', title: 'Review movies', hint: 'Always stored as one file: compressed video changes on every frame, so chunking saves nothing.' },
];

const selectClass = 'bg-[#111] border border-border focus:border-primary text-foreground text-sm rounded-md px-2 py-1.5 outline-none';

/** Settings → Storage workflow: which files use chunked/per-frame dedup, per extension. */
export function StorageWorkflow({ canEdit }) {
  const { data, isLoading, error } = useStoragePolicy();
  const save = useSaveStoragePolicy();
  const [draft, setDraft] = useState(null);
  const [newExt, setNewExt] = useState('');
  const [newStrategy, setNewStrategy] = useState('whole');
  const [showDev, setShowDev] = useState(false);

  useEffect(() => {
    if (data) {
      setDraft({
        chunking_enabled: data.chunking_enabled,
        default_scene_strategy: data.default_scene_strategy,
        rules: { ...data.rules },
      });
    }
  }, [data]);

  const catalog = useMemo(() => Object.fromEntries((data?.catalog || []).map((c) => [c.extension, c])), [data]);
  const custom = useMemo(() => Object.keys(draft?.rules || {}).filter((e) => !catalog[e]).sort(), [draft, catalog]);
  const dirty = data && draft && JSON.stringify({ ...draft }) !== JSON.stringify({
    chunking_enabled: data.chunking_enabled,
    default_scene_strategy: data.default_scene_strategy,
    rules: data.rules,
  });

  if (isLoading || !draft) return <section className="glass-panel p-6 text-sm text-muted">Loading storage workflow…</section>;
  if (error) return <section className="glass-panel p-6 text-sm text-danger">{error.message}</section>;

  const enabled = draft.chunking_enabled;
  const valueFor = (ext) => draft.rules[ext] ?? catalog[ext]?.recommended ?? draft.default_scene_strategy;
  const setRule = (ext, strategy) =>
    setDraft((d) => {
      const rules = { ...d.rules };
      // Keep only real choices: picking the recommended strategy removes the rule.
      if (catalog[ext] && strategy === catalog[ext].recommended) delete rules[ext];
      else rules[ext] = strategy;
      return { ...d, rules };
    });
  const removeRule = (ext) =>
    setDraft((d) => {
      const rules = { ...d.rules };
      delete rules[ext];
      return { ...d, rules };
    });
  const addCustom = () => {
    const ext = newExt.trim().toLowerCase().replace(/^\./, '');
    if (!/^[a-z0-9]{1,12}$/.test(ext) || catalog[ext]) return;
    setDraft((d) => ({ ...d, rules: { ...d.rules, [ext]: newStrategy } }));
    setNewExt('');
  };

  const row = (ext, entry) => {
    const value = valueFor(ext);
    const strategies = entry ? entry.strategies : ['chunked', 'whole'];
    const effective = !enabled ? (entry?.kind === 'review_movie' ? 'whole' : entry?.kind === 'review_image' ? 'off' : 'whole') : value;
    return (
      <tr key={ext} className="border-t border-border align-top">
        <td className="py-2 pr-3 font-mono text-foreground">.{ext}</td>
        <td className="py-2 pr-3">
          <p className="text-foreground">{entry?.label || 'Custom file type'}</p>
          {entry?.notes && <p className="text-[11px] text-muted max-w-md">{entry.notes}</p>}
        </td>
        <td className="py-2 pr-3 whitespace-nowrap">
          {entry ? (
            <span className="flex flex-wrap gap-1">
              <span className={`text-[10px] uppercase tracking-wider border rounded-sm px-1.5 py-0.5 ${STATUS_STYLE[entry.status] || ''}`}>{entry.status}</span>
              {entry.canonicalizer && (
                <span className="text-[10px] uppercase tracking-wider border border-border rounded-sm px-1.5 py-0.5 text-muted" title="DCC canonicalizer strips volatile bytes before chunking">canonicalizer</span>
              )}
            </span>
          ) : (
            <span className="text-[11px] text-muted">raw chunking</span>
          )}
        </td>
        <td className="py-2 pr-3">
          {strategies.length > 1 ? (
            <select
              className={selectClass}
              value={value}
              disabled={!canEdit || !enabled}
              onChange={(e) => setRule(ext, e.target.value)}
              aria-label={`Strategy for .${ext}`}
            >
              {strategies.map((s) => (
                <option key={s} value={s}>
                  {STRATEGY_LABEL[s]}
                  {entry && s === entry.recommended ? ' (recommended)' : ''}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm text-muted">{STRATEGY_LABEL[strategies[0]]}</span>
          )}
          {!enabled && entry?.kind !== 'review_movie' && (
            <p className="text-[11px] text-warning mt-1">Now: {STRATEGY_LABEL[effective]} (master switch)</p>
          )}
        </td>
        <td className="py-2 text-right">
          {!entry && canEdit && (
            <button type="button" className="text-muted hover:text-danger" onClick={() => removeRule(ext)} aria-label={`Remove .${ext}`}>
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </td>
      </tr>
    );
  };

  return (
    <section className="glass-panel p-6 flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <Layers className="w-5 h-5 text-primary mt-1" />
        <div className="flex-1">
          <h2 className="text-xl font-semibold">Storage workflow</h2>
          <p className="text-sm text-muted">
            Choose, per file type, whether Zeno splits files into chunks so only what changed is uploaded and stored. The
            algorithms are still improving: each type shows its status, and you can switch any of them off. Algorithm version{' '}
            <span className="font-mono text-foreground">{data.algorithm_version}</span>.
          </p>
        </div>
      </div>

      <label className={`flex items-start gap-3 rounded-md border p-4 ${enabled ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
        <input
          type="checkbox"
          className="mt-1"
          checked={enabled}
          disabled={!canEdit}
          onChange={(e) => setDraft((d) => ({ ...d, chunking_enabled: e.target.checked }))}
        />
        <span>
          <span className="text-foreground font-medium">Chunking &amp; dedup</span>
          <span className="block text-sm text-muted">
            {enabled
              ? 'On: each file type follows the strategy below.'
              : 'Off: every file is published as one whole file and image sequences are not accepted. Your per-type choices are kept for when you turn it back on.'}
          </span>
        </span>
      </label>

      {GROUPS.map((g) => {
        const exts = Object.values(catalog).filter((c) => c.kind === g.kind).map((c) => c.extension);
        return (
          <div key={g.kind} className="flex flex-col gap-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{g.title}</h3>
              <p className="text-xs text-muted">{g.hint}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="text-[11px] uppercase tracking-wider text-muted text-left">
                  <tr>
                    <th className="py-1.5 pr-3 w-20">Type</th>
                    <th className="py-1.5 pr-3">Format</th>
                    <th className="py-1.5 pr-3 w-40">Algorithm</th>
                    <th className="py-1.5 pr-3 w-52">Strategy</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {exts.map((e) => row(e, catalog[e]))}
                  {g.kind === 'scene' && custom.map((e) => row(e, null))}
                </tbody>
              </table>
            </div>
            {g.kind === 'scene' && (
              <div className="flex flex-wrap items-end gap-3 text-sm">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted">Other file types</span>
                  <select
                    className={selectClass}
                    value={draft.default_scene_strategy}
                    disabled={!canEdit || !enabled}
                    onChange={(e) => setDraft((d) => ({ ...d, default_scene_strategy: e.target.value }))}
                  >
                    <option value="chunked">Chunked dedup</option>
                    <option value="whole">Whole file</option>
                  </select>
                </label>
                {canEdit && (
                  <div className="flex items-end gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-muted">Add a file type</span>
                      <input
                        className={`${selectClass} w-28 font-mono`}
                        placeholder=".hda"
                        value={newExt}
                        onChange={(e) => setNewExt(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())}
                      />
                    </label>
                    <select className={selectClass} value={newStrategy} onChange={(e) => setNewStrategy(e.target.value)}>
                      <option value="whole">Whole file</option>
                      <option value="chunked">Chunked dedup</option>
                    </select>
                    <button type="button" className="btn-secondary text-xs py-1.5 gap-1" onClick={addCustom}>
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {canEdit ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <button type="button" className="btn-primary text-sm" disabled={!dirty || save.isPending} onClick={() => save.mutate(draft)}>
            {save.isPending ? 'Saving…' : 'Save storage workflow'}
          </button>
          <button
            type="button"
            className="btn-secondary text-sm gap-1.5"
            disabled={save.isPending}
            onClick={() => {
              if (window.confirm('Go back to the recommended storage workflow? Your per-type choices are removed.')) save.mutate('reset');
            }}
          >
            <RotateCcw className="w-3.5 h-3.5" /> Recommended defaults
          </button>
          {dirty && <span className="text-xs text-warning">Unsaved changes</span>}
          {save.error && <span className="text-xs text-danger">{save.error.message}</span>}
          {data.updated_at && (
            <span className="text-xs text-muted ml-auto">
              Last changed {new Date(data.updated_at).toLocaleString()}
              {data.updated_by ? ` by ${data.updated_by}` : ''}
            </span>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted">Only the pipeline role can change the storage workflow.</p>
      )}
      <p className="text-xs text-muted">
        Changes apply to the next publish or submission; files already stored stay as they are. Each version records the strategy
        it used.
      </p>

      <div>
        <button type="button" className="text-xs text-muted hover:text-foreground flex items-center gap-1.5" onClick={() => setShowDev((v) => !v)}>
          <Code2 className="w-3.5 h-3.5" /> {showDev ? 'Hide' : 'Show'} developer reference
        </button>
        {showDev && (
          <pre className="mt-2 text-xs bg-[#111] border border-border rounded-md p-3 overflow-x-auto text-foreground/90">{`# What happens to a file (any studio member's token)
GET /api/v1/storage-policy/resolve?filename=shot010.blend
→ {"strategy": "chunked", "source": "recommended", "reason": "...", "algorithm_version": "${data.algorithm_version}"}

# Python (zeno_client); publish_chunked_file() already does this per file
client.resolve_storage("shot010.blend")
publish_chunked_file(..., strategy="whole")   # force one publish

# Change the policy (pipeline role)
PUT /api/v1/storage-policy  {"chunking_enabled": true, "rules": {"fbx": "whole", "exr": "off"}}
POST /api/v1/storage-policy/reset

# Every version records what was used: metadata.storage = {"strategy", "reason", "algorithm_version"}`}</pre>
        )}
      </div>
    </section>
  );
}
