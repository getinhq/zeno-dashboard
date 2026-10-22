import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, ArrowRight, Check, Clapperboard, Film, Gamepad2, Megaphone, Music, Square, Tv } from 'lucide-react';
import { api } from '../api/client';
import { useTaskTemplates } from '../api/hooks';
import { useProjectContext } from '../contexts/ProjectContext';

const ICONS = { short_film: Film, series: Tv, commercial: Megaphone, music_video: Music, game_cinematic: Gamepad2, blank: Square };
const ASSET_LABELS = { character: 'Characters', prop: 'Props', environment: 'Environments', fx: 'FX elements' };
const ASSET_HINTS = { character: 'Nono, Grandma', prop: 'Coffee mug, Kettle', environment: 'Kitchen, Garden', fx: 'Steam, Rain' };

const inputClass =
  'bg-[#111] border border-border focus:border-primary text-foreground text-sm rounded-md px-3 py-2 outline-none transition-colors w-full';

const STEPS = ['Template', 'Details', 'Structure', 'Starter assets'];

function today(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function codeFromName(name) {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  if (words.length === 1) return words[0].slice(0, 6);
  return words.map((w) => w[0]).join('').slice(0, 6);
}

function splitNames(text) {
  return [...new Set(text.split(/[\n,]/).map((s) => s.trim()).filter(Boolean))];
}

function NumberField({ label, value, onChange, min = 0, max }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider text-muted">{label}</span>
      <input type="number" min={min} max={max} value={value} onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))} className={inputClass} />
    </label>
  );
}

export function NewProject() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { setProjectId } = useProjectContext();
  const { data: templates = [] } = useQuery({ queryKey: ['project_templates'], queryFn: () => api.get('/api/v1/project-templates') });
  const { data: taskTemplates = [] } = useTaskTemplates();
  const create = useMutation({
    mutationFn: (body) => api.post('/api/v1/projects/from-template', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['organization'] });
    },
  });

  const [step, setStep] = useState(0);
  const [templateId, setTemplateId] = useState('short_film');
  const template = templates.find((t) => t.id === templateId);
  const [details, setDetails] = useState({ name: '', code: '', codeTouched: false, start_date: today(), end_date: '' });
  const [structure, setStructure] = useState(null);
  const [assets, setAssets] = useState({});

  // Reset structure/end date to the template's defaults whenever the template changes.
  useEffect(() => {
    if (!template) return;
    setStructure({ ...template.structure });
    setDetails((d) => ({ ...d, end_date: today(template.default_duration_days) }));
  }, [template]);

  const stepsPerKind = useMemo(() => {
    const out = {};
    taskTemplates.filter((t) => t.is_default).forEach((t) => {
      out[t.entity_kind === 'shot' ? 'shot' : t.asset_type] = t.steps.length;
    });
    return out;
  }, [taskTemplates]);

  const assetNames = Object.fromEntries(Object.entries(assets).map(([k, v]) => [k, splitNames(v)]));
  const shotCount = structure ? structure.episodes * structure.sequences_per_episode * structure.shots_per_sequence : 0;
  const assetCount = Object.values(assetNames).reduce((n, list) => n + list.length, 0);
  const taskEstimate =
    shotCount * (stepsPerKind.shot || 0) +
    Object.entries(assetNames).reduce((n, [type, list]) => n + list.length * (stepsPerKind[type] || 0), 0);

  const canNext = [
    Boolean(template),
    Boolean(details.name.trim() && details.code.trim() && details.end_date > details.start_date),
    Boolean(structure) && shotCount <= 500,
    true,
  ][step];

  const submit = async () => {
    const res = await create.mutateAsync({
      template: templateId,
      name: details.name.trim(),
      code: details.code.trim(),
      start_date: details.start_date,
      end_date: details.end_date,
      structure,
      assets: assetNames,
    });
    setProjectId(res.project.id);
    navigate('/entities', { replace: true, state: { created: res.created } });
  };

  return (
    <div className="max-w-4xl flex flex-col gap-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted">New project</p>
        <h1 className="text-3xl font-serif text-foreground flex items-center gap-3">
          <Clapperboard className="w-7 h-7 text-primary" /> Set up a production
        </h1>
      </div>

      <ol className="flex items-center gap-2 text-sm">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${i < step ? 'bg-primary text-primary-foreground border-primary' : i === step ? 'border-primary text-primary' : 'border-border text-muted'}`}>
              {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </span>
            <span className={i === step ? 'text-foreground' : 'text-muted'}>{label}</span>
            {i < STEPS.length - 1 && <span className="w-8 h-px bg-border mx-1" />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.map((t) => {
            const Icon = ICONS[t.id] || Square;
            const selected = t.id === templateId;
            const s = t.structure;
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => setTemplateId(t.id)}
                className={`text-left glass-panel p-4 flex flex-col gap-2 transition-colors ${selected ? 'border-primary bg-primary/5' : 'hover:border-muted'}`}
              >
                <Icon className={`w-6 h-6 ${selected ? 'text-primary' : 'text-muted'}`} />
                <p className="font-semibold text-foreground">{t.name}</p>
                <p className="text-sm text-muted flex-1">{t.description}</p>
                <p className="text-xs text-muted">
                  {t.id === 'blank'
                    ? 'Nothing pre-built'
                    : `${s.episodes > 1 ? `${s.episodes} episodes · ` : ''}${s.episodes * s.sequences_per_episode * s.shots_per_sequence} shots · ~${t.default_duration_days} days · ${t.milestones.length} milestones`}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {step === 1 && (
        <div className="glass-panel p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-muted">Project name</span>
            <input
              className={inputClass}
              value={details.name}
              autoFocus
              placeholder="Nono's Day First Coffee"
              onChange={(e) => {
                const name = e.target.value;
                setDetails((d) => ({ ...d, name, code: d.codeTouched ? d.code : codeFromName(name) }));
              }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-muted">Short code</span>
            <input
              className={`${inputClass} font-mono`}
              value={details.code}
              placeholder="NDFC"
              onChange={(e) => setDetails((d) => ({ ...d, code: e.target.value.replace(/[^A-Za-z0-9_-]/g, ''), codeTouched: true }))}
            />
            <span className="text-xs text-muted">Used in file names and asset:// links.</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-muted">Start date</span>
            <input type="date" className={inputClass} value={details.start_date} onChange={(e) => setDetails((d) => ({ ...d, start_date: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-muted">Delivery date</span>
            <input type="date" className={inputClass} value={details.end_date} onChange={(e) => setDetails((d) => ({ ...d, end_date: e.target.value }))} />
            {details.end_date && details.end_date <= details.start_date && <span className="text-xs text-danger">Delivery must be after the start date.</span>}
          </label>
          {template && template.milestones.length > 0 && (
            <div className="md:col-span-2 text-sm text-muted">
              Milestones spread across these dates: {template.milestones.map((m) => m.name).join(' → ')}
            </div>
          )}
        </div>
      )}

      {step === 2 && structure && (
        <div className="glass-panel p-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <NumberField label={template?.episode_label === 'Episode' ? 'Episodes' : `${template?.episode_label}s`} value={structure.episodes} max={50} onChange={(v) => setStructure((s) => ({ ...s, episodes: v }))} />
            <NumberField label="Sequences each" value={structure.sequences_per_episode} max={50} onChange={(v) => setStructure((s) => ({ ...s, sequences_per_episode: v }))} />
            <NumberField label="Shots per sequence" value={structure.shots_per_sequence} max={200} onChange={(v) => setStructure((s) => ({ ...s, shots_per_sequence: v }))} />
            <NumberField label="Frames per shot" value={structure.frames_per_shot} min={1} onChange={(v) => setStructure((s) => ({ ...s, frames_per_shot: v }))} />
          </div>
          <p className="text-sm text-muted">
            {shotCount} shots, about {Math.round((shotCount * structure.frames_per_shot) / (template?.fps || 24))} seconds at {template?.fps} fps. Shot codes like EP01 / SQ010 / SH0010, frames from 1001.
            {shotCount > 500 && <span className="text-danger ml-1">That is more than 500 shots — reduce the numbers.</span>}
          </p>
        </div>
      )}

      {step === 3 && template && (
        <div className="glass-panel p-5 flex flex-col gap-4">
          <p className="text-sm text-muted">
            Optional. List the main assets you already know about — one per line or comma separated. Each gets its tasks from your task templates.
          </p>
          {template.asset_prompts.length === 0 && <p className="text-sm text-muted">This template does not suggest starter assets.</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {template.asset_prompts.map((type) => (
              <label key={type} className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wider text-muted">{ASSET_LABELS[type] || type}</span>
                <textarea
                  rows={3}
                  className={inputClass}
                  placeholder={`e.g. ${ASSET_HINTS[type]}`}
                  value={assets[type] || ''}
                  onChange={(e) => setAssets((a) => ({ ...a, [type]: e.target.value }))}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="glass-panel p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {template ? (
            <>
              <b className="text-foreground">{template.name}</b>
              {structure && ` · ${shotCount} shots`} · {assetCount} starter assets · about <b className="text-foreground">{taskEstimate}</b> tasks · {template.milestones.length} milestones
            </>
          ) : 'Loading templates…'}
        </p>
        <div className="flex gap-2">
          {step > 0 && (
            <button type="button" className="btn-secondary gap-2 text-sm" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn-primary gap-2 text-sm disabled:opacity-50" disabled={!canNext} onClick={() => setStep(step + 1)}>
              Next <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button type="button" className="btn-primary gap-2 text-sm disabled:opacity-50" disabled={create.isPending} onClick={submit}>
              {create.isPending ? 'Creating…' : 'Create project'}
            </button>
          )}
        </div>
      </div>
      {create.error && (
        <div className="flex items-start gap-2 text-danger text-sm border border-danger/30 rounded-md px-3 py-2 bg-danger/10">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{create.error.message}</span>
        </div>
      )}
    </div>
  );
}

export default NewProject;
