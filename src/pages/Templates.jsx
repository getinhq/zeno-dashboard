import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, LayoutTemplate, Plus, Star, Trash2, Wand2 } from 'lucide-react';
import {
  useApplyTaskTemplate,
  useAssets,
  useDeleteTaskTemplate,
  useProjectShots,
  useSaveTaskTemplate,
  useTaskTemplates,
  useTaskVocabulary,
} from '../api/hooks';
import { ThemedSelect } from '../components/ThemedSelect';
import { useProjectContext } from '../contexts/ProjectContext';

const inputClass =
  'bg-[#111] border border-border focus:border-primary text-foreground text-sm rounded-md px-3 py-2 outline-none transition-colors w-full';

const label = (s) => (s ? s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : '');

const EMPTY = {
  id: null,
  name: 'New template',
  entity_kind: 'asset',
  asset_type: 'prop',
  is_default: false,
  steps: [{ type: 'model', title: 'Model', duration_days: 2, depends_on: [] }],
};

function totalDays(steps) {
  // Longest chain through depends_on (critical path), not just the sum.
  const finish = [];
  steps.forEach((s, i) => {
    const start = Math.max(0, ...(s.depends_on || []).map((d) => finish[d] || 0));
    finish[i] = start + (Number(s.duration_days) || 0);
  });
  return Math.max(0, ...finish);
}

function StepRow({ step, index, steps, taskTypes, onChange, onMove, onRemove }) {
  const toggleDep = (d) => {
    const deps = new Set(step.depends_on || []);
    if (deps.has(d)) deps.delete(d);
    else deps.add(d);
    onChange({ ...step, depends_on: [...deps].sort((a, b) => a - b) });
  };
  return (
    <div className="border border-border rounded-md p-3 flex flex-col gap-3 bg-card">
      <div className="flex items-center gap-3">
        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0">
          {index + 1}
        </span>
        <div className="w-40 shrink-0">
          <ThemedSelect
            value={step.type}
            onChange={(v) => onChange({ ...step, type: v, title: step.title || label(v) })}
            options={taskTypes.map((t) => ({ value: t, label: label(t) }))}
          />
        </div>
        <input
          className={inputClass}
          value={step.title}
          onChange={(e) => onChange({ ...step, title: e.target.value })}
          placeholder="Task title"
        />
        <label className="flex items-center gap-2 shrink-0 text-xs text-muted">
          <input
            type="number"
            min={0}
            max={365}
            value={step.duration_days}
            onChange={(e) => onChange({ ...step, duration_days: Number(e.target.value) })}
            className={`${inputClass} w-20`}
          />
          days
        </label>
        <div className="flex gap-1 shrink-0">
          <button type="button" className="p-1.5 text-muted hover:text-foreground disabled:opacity-30" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up">
            <ArrowUp className="w-4 h-4" />
          </button>
          <button type="button" className="p-1.5 text-muted hover:text-foreground disabled:opacity-30" disabled={index === steps.length - 1} onClick={() => onMove(1)} aria-label="Move down">
            <ArrowDown className="w-4 h-4" />
          </button>
          <button type="button" className="p-1.5 text-muted hover:text-danger disabled:opacity-30" disabled={steps.length === 1} onClick={onRemove} aria-label="Remove step">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      {index > 0 && (
        <div className="flex flex-wrap items-center gap-2 pl-9">
          <span className="text-xs text-muted">Starts after:</span>
          {steps.slice(0, index).map((prev, d) => {
            const on = (step.depends_on || []).includes(d);
            return (
              <button
                type="button"
                key={d}
                onClick={() => toggleDep(d)}
                className={`text-xs rounded-full border px-2 py-0.5 transition-colors ${on ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted hover:text-foreground'}`}
              >
                {d + 1}. {prev.title || label(prev.type)}
              </button>
            );
          })}
          {!(step.depends_on || []).length && <span className="text-xs text-muted italic">can start any time</span>}
        </div>
      )}
    </div>
  );
}

function moveStep(steps, from, delta) {
  // Reorder while keeping dependencies pointing at the same steps; drop any that would
  // now point forward (a step can only wait on earlier steps).
  const to = from + delta;
  const order = steps.map((_, i) => i);
  [order[from], order[to]] = [order[to], order[from]];
  const newIndexOf = Object.fromEntries(order.map((old, i) => [old, i]));
  return order.map((old, i) => ({
    ...steps[old],
    depends_on: (steps[old].depends_on || []).map((d) => newIndexOf[d]).filter((d) => d < i).sort((a, b) => a - b),
  }));
}

function removeStep(steps, index) {
  return steps
    .filter((_, i) => i !== index)
    .map((s) => ({
      ...s,
      depends_on: (s.depends_on || []).filter((d) => d !== index).map((d) => (d > index ? d - 1 : d)),
    }));
}

function ApplyPanel({ template }) {
  const { projectId, project } = useProjectContext();
  const { data: assets = [] } = useAssets(template.entity_kind === 'asset' ? projectId : null);
  const { data: shots = [] } = useProjectShots(template.entity_kind === 'shot' ? projectId : null);
  const apply = useApplyTaskTemplate();
  const [result, setResult] = useState(null);

  const targets = template.entity_kind === 'asset' ? assets.filter((a) => a.type === template.asset_type) : shots;
  if (!projectId) return <p className="text-sm text-muted">Pick a project in the top bar to apply this template to existing work.</p>;
  if (!template.id) return <p className="text-sm text-muted">Save the template first.</p>;

  const run = async () => {
    const key = template.entity_kind === 'asset' ? 'asset_ids' : 'shot_ids';
    const res = await apply.mutateAsync({ id: template.id, body: { [key]: targets.map((t) => t.id) } });
    setResult(res.tasks_created);
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
      <p className="text-sm text-muted">
        {targets.length
          ? `${targets.length} existing ${template.entity_kind === 'asset' ? `${label(template.asset_type).toLowerCase()} asset` : 'shot'}${targets.length === 1 ? '' : 's'} in ${project?.code || 'this project'}. Missing task types will be added; existing tasks are left alone.`
          : `No matching ${template.entity_kind}s in ${project?.code || 'this project'} yet.`}
        {result != null && <span className="text-success ml-2">Created {result} task{result === 1 ? '' : 's'}.</span>}
      </p>
      <button type="button" className="btn-secondary gap-2 text-sm" disabled={!targets.length || apply.isPending} onClick={run}>
        <Wand2 className="w-4 h-4" /> {apply.isPending ? 'Applying…' : 'Apply to existing'}
      </button>
    </div>
  );
}

export function Templates() {
  const { data: templates = [], isLoading } = useTaskTemplates();
  const { data: vocab } = useTaskVocabulary();
  const save = useSaveTaskTemplate();
  const remove = useDeleteTaskTemplate();
  const [draft, setDraft] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!draft && templates.length) setDraft(structuredClone(templates[0]));
  }, [templates, draft]);

  const groups = useMemo(() => {
    const assets = templates.filter((t) => t.entity_kind === 'asset');
    const shots = templates.filter((t) => t.entity_kind === 'shot');
    return [
      { title: 'Assets', items: assets },
      { title: 'Shots', items: shots },
    ];
  }, [templates]);

  const taskTypes = vocab?.task_types || [];
  const assetTypes = vocab?.asset_types || [];

  const setSteps = (steps) => setDraft((d) => ({ ...d, steps }));

  const onSave = async () => {
    const body = {
      name: draft.name,
      entity_kind: draft.entity_kind,
      asset_type: draft.entity_kind === 'asset' ? draft.asset_type : null,
      is_default: draft.is_default,
      steps: draft.steps.map((s) => ({ ...s, duration_days: Number(s.duration_days) || 0 })),
    };
    const saved = await save.mutateAsync({ id: draft.id, body });
    setDraft(structuredClone(saved));
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted">Production setup</p>
        <h1 className="text-3xl font-serif text-foreground flex items-center gap-3">
          <LayoutTemplate className="w-7 h-7 text-primary" /> Task templates
        </h1>
        <p className="text-sm text-muted mt-2 max-w-2xl">
          When you add an asset or shot, Zeno creates its tasks from the default template for that type — in order,
          with durations and “starts after” links that feed the schedule.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
        <aside className="glass-panel p-3 flex flex-col gap-4">
          {isLoading && <p className="text-sm text-muted p-2">Loading…</p>}
          {groups.map((g) => (
            <div key={g.title}>
              <p className="text-xs uppercase tracking-wider text-muted px-2 mb-1">{g.title}</p>
              {g.items.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setDraft(structuredClone(t))}
                  className={`w-full text-left px-2 py-2 rounded-md flex items-center justify-between gap-2 ${draft?.id === t.id ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-card-hover'}`}
                >
                  <span className="truncate text-sm">
                    {t.name}
                    {t.entity_kind === 'asset' && t.name.toLowerCase() !== label(t.asset_type).toLowerCase() && (
                      <span className="text-muted text-xs ml-1">· {label(t.asset_type)}</span>
                    )}
                  </span>
                  {t.is_default && <Star className="w-3.5 h-3.5 fill-current shrink-0" aria-label="Default" />}
                </button>
              ))}
            </div>
          ))}
          <button type="button" className="btn-secondary gap-2 text-sm" onClick={() => setDraft(structuredClone(EMPTY))}>
            <Plus className="w-4 h-4" /> New template
          </button>
        </aside>

        {draft && (
          <section className="flex flex-col gap-4">
            <div className="glass-panel p-5 flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="flex flex-col gap-1 md:col-span-1">
                  <span className="text-xs uppercase tracking-wider text-muted">Name</span>
                  <input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-wider text-muted">Used for</span>
                  <ThemedSelect
                    value={draft.entity_kind}
                    onChange={(v) => setDraft({ ...draft, entity_kind: v, asset_type: v === 'asset' ? draft.asset_type || 'prop' : null })}
                    options={[{ value: 'asset', label: 'Assets' }, { value: 'shot', label: 'Shots' }]}
                  />
                </label>
                {draft.entity_kind === 'asset' && (
                  <label className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wider text-muted">Asset type</span>
                    <ThemedSelect
                      value={draft.asset_type}
                      onChange={(v) => setDraft({ ...draft, asset_type: v })}
                      options={assetTypes.map((t) => ({ value: t, label: label(t) }))}
                    />
                  </label>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" className="accent-primary" checked={draft.is_default} onChange={(e) => setDraft({ ...draft, is_default: e.target.checked })} />
                Use automatically for every new {draft.entity_kind === 'asset' ? `${label(draft.asset_type).toLowerCase()} asset` : 'shot'}
              </label>
            </div>

            <div className="flex flex-col gap-2">
              {draft.steps.map((step, i) => (
                <StepRow
                  key={i}
                  step={step}
                  index={i}
                  steps={draft.steps}
                  taskTypes={taskTypes}
                  onChange={(next) => setSteps(draft.steps.map((s, j) => (j === i ? next : s)))}
                  onMove={(delta) => setSteps(moveStep(draft.steps, i, delta))}
                  onRemove={() => setSteps(removeStep(draft.steps, i))}
                />
              ))}
              <button
                type="button"
                className="btn-secondary gap-2 text-sm self-start"
                onClick={() =>
                  setSteps([
                    ...draft.steps,
                    { type: 'model', title: '', duration_days: 1, depends_on: [draft.steps.length - 1] },
                  ])
                }
              >
                <Plus className="w-4 h-4" /> Add step
              </button>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <p className="text-sm text-muted">
                {draft.steps.length} steps · about <b className="text-foreground">{totalDays(draft.steps)} working days</b> end to end
              </p>
              <div className="flex gap-2">
                {draft.id && (
                  <>
                    <button type="button" className="btn-secondary gap-2 text-sm" onClick={() => setDraft({ ...structuredClone(draft), id: null, name: `${draft.name} copy`, is_default: false })}>
                      <Copy className="w-4 h-4" /> Duplicate
                    </button>
                    <button
                      type="button"
                      className="btn-secondary gap-2 text-sm text-danger"
                      onClick={async () => {
                        await remove.mutateAsync(draft.id);
                        setDraft(null);
                      }}
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </>
                )}
                <button type="button" className="btn-primary text-sm" disabled={save.isPending} onClick={onSave}>
                  {save.isPending ? 'Saving…' : savedFlash ? 'Saved' : 'Save template'}
                </button>
              </div>
            </div>
            {(save.error || remove.error) && <p className="text-sm text-danger">{(save.error || remove.error).message}</p>}

            <div className="glass-panel p-4">
              <ApplyPanel template={draft} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default Templates;
