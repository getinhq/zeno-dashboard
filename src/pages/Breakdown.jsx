import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Grid3x3, Search } from 'lucide-react';
import { useBreakdown, useUpdateBreakdown } from '../api/hooks';
import { useAuth } from '../contexts/AuthContext';
import { useProjectContext } from '../contexts/ProjectContext';
import { isManagement } from '../lib/permissions';

const TYPE_ORDER = ['character', 'prop', 'environment', 'fx', 'groom', 'rig', 'texture_set', 'shader'];
const TYPE_LABEL = {
  character: 'Characters',
  prop: 'Props',
  environment: 'Environments',
  fx: 'FX',
  groom: 'Grooms',
  rig: 'Rigs',
  texture_set: 'Texture sets',
  shader: 'Shaders',
};

export function Breakdown() {
  const { user } = useAuth();
  const canEdit = isManagement(user);
  const { projectId, project, isReadOnly } = useProjectContext();
  const { data, isLoading, error } = useBreakdown(projectId);
  const update = useUpdateBreakdown(projectId);
  const [hiddenTypes, setHiddenTypes] = useState(new Set());
  const [query, setQuery] = useState('');

  const editable = canEdit && !isReadOnly;

  const linkSet = useMemo(
    () => new Set((data?.links || []).map((l) => `${l.shot_id}:${l.asset_id}`)),
    [data],
  );

  const assetGroups = useMemo(() => {
    const assets = (data?.assets || []).filter(
      (a) => !query || `${a.code} ${a.name}`.toLowerCase().includes(query.toLowerCase()),
    );
    const types = [...new Set(assets.map((a) => a.type))].sort(
      (x, y) => TYPE_ORDER.indexOf(x) - TYPE_ORDER.indexOf(y),
    );
    return types.map((type) => ({ type, assets: assets.filter((a) => a.type === type), hidden: hiddenTypes.has(type) }));
  }, [data, query, hiddenTypes]);

  const visibleAssets = assetGroups.filter((g) => !g.hidden).flatMap((g) => g.assets);

  const sequences = useMemo(() => {
    const out = [];
    (data?.shots || []).forEach((s) => {
      const key = `${s.episode_code}/${s.sequence_code}`;
      let seq = out.find((x) => x.key === key);
      if (!seq) {
        seq = { key, label: `${s.episode_code} · ${s.sequence_code}`, name: s.sequence_name, shots: [] };
        out.push(seq);
      }
      seq.shots.push(s);
    });
    return out;
  }, [data]);

  const shotsPerAsset = useMemo(() => {
    const counts = {};
    (data?.links || []).forEach((l) => {
      counts[l.asset_id] = (counts[l.asset_id] || 0) + 1;
    });
    return counts;
  }, [data]);

  const toggleCell = (shotId, assetId) => {
    if (!editable) return;
    const pair = { shot_id: shotId, asset_id: assetId };
    update.mutate(linkSet.has(`${shotId}:${assetId}`) ? { remove: [pair] } : { add: [pair] });
  };

  const toggleSequence = (seq, assetId) => {
    if (!editable) return;
    const all = seq.shots.every((s) => linkSet.has(`${s.id}:${assetId}`));
    const pairs = seq.shots.map((s) => ({ shot_id: s.id, asset_id: assetId }));
    update.mutate(all ? { remove: pairs } : { add: pairs.filter((p) => !linkSet.has(`${p.shot_id}:${p.asset_id}`)) });
  };

  if (!projectId) {
    return <div className="glass-panel p-8 text-center text-muted">Select a project to see its breakdown.</div>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">{project?.code} · Casting</p>
          <h1 className="text-3xl font-serif text-foreground flex items-center gap-3">
            <Grid3x3 className="w-7 h-7 text-primary" /> Breakdown
          </h1>
          <p className="text-sm text-muted mt-2 max-w-2xl">
            Which assets appear in which shots. {editable ? 'Click a cell to cast or uncast; click a sequence row to toggle the whole sequence.' : 'Read-only for your role.'}
          </p>
        </div>
        <label className="relative">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter assets"
            className="bg-[#111] border border-border focus:border-primary text-foreground text-sm rounded-md pl-9 pr-3 py-2 outline-none"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {assetGroups.map((g) => (
          <button
            type="button"
            key={g.type}
            onClick={() =>
              setHiddenTypes((h) => {
                const next = new Set(h);
                if (next.has(g.type)) next.delete(g.type);
                else next.add(g.type);
                return next;
              })
            }
            className={`text-xs rounded-full border px-3 py-1 ${g.hidden ? 'border-border text-muted' : 'border-primary text-primary bg-primary/10'}`}
          >
            {TYPE_LABEL[g.type] || g.type} ({g.assets.length})
          </button>
        ))}
      </div>

      {isLoading && <p className="text-muted text-sm">Loading breakdown…</p>}
      {error && <p className="text-danger text-sm">{error.message}</p>}
      {update.error && <p className="text-danger text-sm">Could not save: {update.error.message}</p>}

      {data && (!data.shots.length || !data.assets.length) && (
        <div className="glass-panel p-6 text-sm text-muted">
          {data.shots.length ? 'No assets yet.' : 'No shots yet.'} Add them on the{' '}
          <Link to="/entities" className="text-primary hover:underline">Entities</Link> page.
        </div>
      )}

      {data && data.shots.length > 0 && visibleAssets.length > 0 && (
        <div className="glass-panel overflow-auto max-h-[70vh]">
          <table className="text-sm border-separate border-spacing-0">
            <thead className="sticky top-0 z-20 bg-card">
              <tr>
                <th className="sticky left-0 z-30 bg-card border-b border-border px-3 py-2 text-left text-xs uppercase tracking-wider text-muted min-w-[180px]">
                  Shot
                </th>
                {assetGroups.filter((g) => !g.hidden).map((g) => (
                  <th key={g.type} colSpan={g.assets.length} className="border-b border-l border-border px-2 py-1 text-xs uppercase tracking-wider text-muted text-left">
                    {TYPE_LABEL[g.type] || g.type}
                  </th>
                ))}
              </tr>
              <tr>
                <th className="sticky left-0 z-30 bg-card border-b border-border" />
                {visibleAssets.map((a) => (
                  <th key={a.id} className="border-b border-l border-border px-1 py-2 align-bottom" title={`${a.name} · in ${shotsPerAsset[a.id] || 0} shots`}>
                    <div className="flex flex-col items-center gap-1 w-14">
                      <span className="text-xs text-foreground truncate max-w-[56px]">{a.name}</span>
                      <span className="text-[10px] text-muted">{shotsPerAsset[a.id] || 0}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sequences.map((seq) => (
                <Fragment key={seq.key}>
                  <tr className="bg-card-hover/60">
                    <td className="sticky left-0 z-10 bg-[#171717] border-b border-border px-3 py-1.5 text-xs text-muted">
                      <span className="text-foreground font-medium">{seq.label}</span> {seq.name}
                    </td>
                    {visibleAssets.map((a) => {
                      const n = seq.shots.filter((s) => linkSet.has(`${s.id}:${a.id}`)).length;
                      return (
                        <td
                          key={a.id}
                          onClick={() => toggleSequence(seq, a.id)}
                          className={`border-b border-l border-border text-center text-[10px] ${editable ? 'cursor-pointer hover:bg-primary/10' : ''} ${n ? 'text-primary' : 'text-muted/50'}`}
                          title={editable ? `Toggle ${a.name} for all of ${seq.label}` : undefined}
                        >
                          {n ? `${n}/${seq.shots.length}` : '·'}
                        </td>
                      );
                    })}
                  </tr>
                  {seq.shots.map((s) => (
                    <tr key={s.id} className="hover:bg-card-hover/40">
                      <td className="sticky left-0 z-10 bg-card border-b border-border px-3 py-1.5 font-mono text-xs text-foreground whitespace-nowrap">
                        {s.code}
                        {s.frame_start != null && s.frame_end != null && (
                          <span className="text-muted ml-2">{s.frame_end - s.frame_start + 1}f</span>
                        )}
                      </td>
                      {visibleAssets.map((a) => {
                        const on = linkSet.has(`${s.id}:${a.id}`);
                        return (
                          <td
                            key={a.id}
                            onClick={() => toggleCell(s.id, a.id)}
                            className={`border-b border-l border-border text-center ${editable ? 'cursor-pointer hover:bg-primary/10' : ''}`}
                            aria-label={`${a.name} in ${s.code}: ${on ? 'cast' : 'not cast'}`}
                          >
                            <span className={`inline-block w-3.5 h-3.5 rounded-sm ${on ? 'bg-primary' : 'border border-border'}`} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Breakdown;
