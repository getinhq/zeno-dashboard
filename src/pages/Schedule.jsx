import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CalendarRange, ChevronDown, ChevronRight, Diamond, Flag, Link2, Sparkles, Trash2, X } from 'lucide-react';
import {
  useAddDependency,
  useAutoSchedule,
  useDeleteMilestone,
  useRemoveDependency,
  useSaveMilestone,
  useSchedule,
  useSetTaskDates,
  useUsers,
} from '../api/hooks';
import { SearchableSelect } from '../components/SearchableSelect';
import { ThemedSelect } from '../components/ThemedSelect';
import { useAuth } from '../contexts/AuthContext';
import { useProjectContext } from '../contexts/ProjectContext';
import { isManagement } from '../lib/permissions';

// ---- dates (UTC day numbers so time zones never shift a bar) -------------------------
const DAY_MS = 86400000;
const toDay = (iso) => (iso ? Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / DAY_MS) : null);
const toIso = (day) => new Date(day * DAY_MS).toISOString().slice(0, 10);
const weekday = (day) => new Date(day * DAY_MS).getUTCDay(); // 0 Sun .. 6 Sat
const todayDay = () => toDay(new Date().toISOString());
const fmt = (day, opts) => new Date(day * DAY_MS).toLocaleDateString(undefined, { timeZone: 'UTC', ...opts });

const ZOOMS = { day: 34, week: 14, month: 5 };
const ROW_H = 30;
const LEFT_W = 300;
const HEADER_H = 52;

const STATUS_COLOR = {
  todo: 'bg-[#3a3a3a] border-[#555]',
  in_progress: 'bg-info/70 border-info',
  review: 'bg-warning/70 border-warning',
  done: 'bg-success/60 border-success',
  blocked: 'bg-danger/70 border-danger',
};
const STATUS_LABEL = { todo: 'Not started', in_progress: 'In progress', review: 'In review', done: 'Done', blocked: 'Blocked' };
const MILESTONE_COLOR = { delivery: 'text-primary', review: 'text-warning', milestone: 'text-info' };
const TYPE_ORDER = ['character', 'prop', 'environment', 'fx', 'groom', 'rig', 'texture_set', 'shader'];

// Task titles are "<Step> · <entity>"; next to the group label only the step is needed.
const stepName = (t) => (t.title || '').split(' · ')[0];
const taskLabel = (t) => `${t.group.label} · ${stepName(t)}`;

const inputClass =
  'bg-[#111] border border-border focus:border-primary text-foreground text-sm rounded-md px-3 py-1.5 outline-none transition-colors';

function useGroups(tasks, filter) {
  return useMemo(() => {
    const q = filter.query.trim().toLowerCase();
    const groups = new Map();
    tasks.forEach((t) => {
      if (filter.kind !== 'all' && t.group.kind !== filter.kind) return;
      if (filter.status !== 'all' && t.status !== filter.status) return;
      if (q && !`${t.title} ${t.group.label}`.toLowerCase().includes(q)) return;
      const key = `${t.group.kind}:${t.group.id}`;
      if (!groups.has(key)) groups.set(key, { key, ...t.group, tasks: [] });
      groups.get(key).tasks.push(t);
    });
    const kindRank = { asset: 0, shot: 1, project: 2 };
    return [...groups.values()]
      .map((g) => ({
        ...g,
        tasks: g.tasks.sort((a, b) => (toDay(a.start_date) ?? 1e9) - (toDay(b.start_date) ?? 1e9)),
      }))
      .sort(
        (a, b) =>
          kindRank[a.kind] - kindRank[b.kind] ||
          (a.kind === 'asset' ? TYPE_ORDER.indexOf(a.sub) - TYPE_ORDER.indexOf(b.sub) : 0) ||
          a.label.localeCompare(b.label),
      );
  }, [tasks, filter]);
}

function TimelineHeader({ start, days, dayW }) {
  const months = [];
  const weeks = [];
  for (let i = 0; i < days; i += 1) {
    const d = start + i;
    const date = new Date(d * DAY_MS);
    if (i === 0 || date.getUTCDate() === 1) months.push({ i, label: fmt(d, { month: 'short', year: 'numeric' }) });
    if (weekday(d) === 1) weeks.push({ i, label: fmt(d, { day: 'numeric' }) });
  }
  return (
    <div className="relative" style={{ width: days * dayW, height: HEADER_H }}>
      {months.map((m) => (
        <div key={m.i} className="absolute top-1 text-xs text-foreground font-medium whitespace-nowrap border-l border-border pl-1" style={{ left: m.i * dayW }}>
          {m.label}
        </div>
      ))}
      {dayW >= 20
        ? Array.from({ length: days }, (_, i) => (
            <div key={i} className={`absolute bottom-1 text-[10px] text-center ${weekday(start + i) % 6 === 0 ? 'text-muted/50' : 'text-muted'}`} style={{ left: i * dayW, width: dayW }}>
              {new Date((start + i) * DAY_MS).getUTCDate()}
            </div>
          ))
        : weeks.map((w) => (
            <div key={w.i} className="absolute bottom-1 text-[10px] text-muted border-l border-border/60 pl-0.5" style={{ left: w.i * dayW }}>
              {w.label}
            </div>
          ))}
    </div>
  );
}

function TaskPanel({ task, tasksById, deps, projectId, editable, onClose, userNames }) {
  const setDates = useSetTaskDates(projectId);
  const addDep = useAddDependency(projectId);
  const removeDep = useRemoveDependency(projectId);
  const waitsFor = deps.filter((d) => d.task_id === task.id).map((d) => ({ ...d, other: tasksById[d.depends_on] }));
  const blocks = deps.filter((d) => d.depends_on === task.id).map((d) => ({ ...d, other: tasksById[d.task_id] }));
  const candidates = Object.values(tasksById)
    .filter((t) => t.id !== task.id && !waitsFor.some((w) => w.depends_on === t.id))
    .map((t) => ({ value: t.id, label: taskLabel(t) }));
  const err = setDates.error || addDep.error || removeDep.error;

  return (
    <aside className="glass-panel p-4 flex flex-col gap-4 w-full lg:w-[340px] shrink-0 self-start">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">{task.group.label}</p>
          <p className="text-foreground font-semibold">{task.title}</p>
          <p className="text-xs text-muted mt-1">
            {STATUS_LABEL[task.status] || task.status} · {task.duration_days} day{task.duration_days === 1 ? '' : 's'} planned
            {task.assignees.length > 0 && ` · ${task.assignees.map((id) => userNames[id] || 'someone').join(', ')}`}
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-muted hover:text-foreground" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {['start_date', 'due_date'].map((field) => (
          <label key={field} className="flex flex-col gap-1">
            <span className="text-xs text-muted">{field === 'start_date' ? 'Start' : 'Due'}</span>
            <input
              type="date"
              disabled={!editable}
              className={inputClass}
              value={task[field] || ''}
              onChange={(e) => setDates.mutate({ taskId: task.id, start_date: task.start_date, due_date: task.due_date, [field]: e.target.value || null })}
            />
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-wider text-muted">Waits for</p>
        {waitsFor.length === 0 && <p className="text-sm text-muted">Nothing — can start any time.</p>}
        {waitsFor.map((w) => (
          <div key={w.depends_on} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">
              {w.other ? taskLabel(w.other) : 'Other task'}
              <span className="text-[10px] text-muted ml-1">({w.source})</span>
            </span>
            {editable && (
              <button type="button" className="text-muted hover:text-danger" onClick={() => removeDep.mutate({ taskId: task.id, dependsOn: w.depends_on })} aria-label="Remove link">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
        {editable && (
          <SearchableSelect
            value=""
            onChange={(v) => v && addDep.mutate({ taskId: task.id, dependsOn: v })}
            options={candidates}
            placeholder="+ Add a task this waits for"
            searchPlaceholder="Search tasks…"
          />
        )}
      </div>

      {blocks.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wider text-muted">Blocks</p>
          {blocks.map((b) => (
            <p key={b.task_id} className="text-sm truncate">{b.other ? taskLabel(b.other) : 'Other task'}</p>
          ))}
        </div>
      )}
      {err && <p className="text-sm text-danger">{err.message}</p>}
    </aside>
  );
}

function MilestoneForm({ projectId, milestone, onDone }) {
  const save = useSaveMilestone(projectId);
  const remove = useDeleteMilestone(projectId);
  const [form, setForm] = useState({
    name: milestone?.name || '',
    due_date: milestone?.due_date || new Date().toISOString().slice(0, 10),
    kind: milestone?.kind || 'milestone',
  });
  return (
    <form
      className="glass-panel p-3 flex flex-wrap items-end gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        await save.mutateAsync({ id: milestone?.id, body: form });
        onDone();
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">Milestone</span>
        <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Client review" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">Date</span>
        <input type="date" className={inputClass} value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} required />
      </label>
      <div className="flex flex-col gap-1 w-36">
        <span className="text-xs text-muted">Kind</span>
        <ThemedSelect
          value={form.kind}
          onChange={(v) => setForm({ ...form, kind: v })}
          options={[{ value: 'milestone', label: 'Milestone' }, { value: 'review', label: 'Review' }, { value: 'delivery', label: 'Delivery' }]}
        />
      </div>
      <button type="submit" className="btn-primary text-sm py-1.5">{milestone ? 'Save' : 'Add'}</button>
      {milestone && (
        <>
          <button type="button" className="btn-secondary text-sm py-1.5" onClick={async () => { await save.mutateAsync({ id: milestone.id, body: { done: !milestone.done } }); onDone(); }}>
            {milestone.done ? 'Mark not done' : 'Mark done'}
          </button>
          <button type="button" className="btn-secondary text-sm py-1.5 text-danger" onClick={async () => { await remove.mutateAsync(milestone.id); onDone(); }}>
            <Trash2 className="w-4 h-4" />
          </button>
        </>
      )}
      <button type="button" className="btn-secondary text-sm py-1.5" onClick={onDone}>Cancel</button>
      {(save.error || remove.error) && <p className="text-sm text-danger w-full">{(save.error || remove.error).message}</p>}
    </form>
  );
}

function AutoScheduleForm({ projectId, project, onDone }) {
  const auto = useAutoSchedule(projectId);
  const [form, setForm] = useState({ start_date: project?.start_date || '', keep_existing: false, link_casting: true });
  return (
    <form
      className="glass-panel p-4 flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await auto.mutateAsync(form);
        onDone(res);
      }}
    >
      <p className="text-sm text-foreground font-medium flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Auto-schedule</p>
      <p className="text-sm text-muted">
        Places every task on working days (Mon–Fri) as early as its dependencies allow, using the durations from your task templates.
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Start from</span>
          <input type="date" className={inputClass} value={form.start_date || ''} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-primary" checked={form.link_casting} onChange={(e) => setForm({ ...form, link_casting: e.target.checked })} />
          Link shots to their cast assets (animation waits for rigs…)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-primary" checked={form.keep_existing} onChange={(e) => setForm({ ...form, keep_existing: e.target.checked })} />
          Keep dates I already set
        </label>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary text-sm" disabled={auto.isPending}>{auto.isPending ? 'Scheduling…' : 'Schedule everything'}</button>
        <button type="button" className="btn-secondary text-sm" onClick={() => onDone(null)}>Cancel</button>
      </div>
      {auto.error && <p className="text-sm text-danger">{auto.error.message}</p>}
    </form>
  );
}

export function Schedule() {
  const { user } = useAuth();
  const location = useLocation();
  const { projectId, isReadOnly } = useProjectContext();
  const { data, isLoading, error } = useSchedule(projectId);
  const { data: users = [] } = useUsers({ is_active: true });
  const setDates = useSetTaskDates(projectId);
  const editable = isManagement(user) && !isReadOnly;

  const [zoom, setZoom] = useState('week');
  const [filter, setFilter] = useState({ kind: 'all', status: 'all', query: '' });
  const [collapsed, setCollapsed] = useState(new Set());
  const [selectedId, setSelectedId] = useState(null);
  const [panel, setPanel] = useState(null); // 'auto' | {milestone} | 'new-milestone'
  const [banner, setBanner] = useState(location.state?.created ? { created: location.state.created } : null);
  const [drag, setDrag] = useState(null);
  const scrollRef = useRef(null);

  const dayW = ZOOMS[zoom];
  const tasks = data?.tasks || [];
  const deps = data?.dependencies || [];
  const milestones = data?.milestones || [];
  const tasksById = useMemo(() => Object.fromEntries(tasks.map((t) => [t.id, t])), [tasks]);
  const userNames = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u.name || u.username])), [users]);
  const groups = useGroups(tasks, filter);
  const unscheduled = tasks.filter((t) => !t.start_date || !t.due_date).length;

  // Visible range: project dates, every bar and milestone, plus padding.
  const range = useMemo(() => {
    const points = [
      toDay(data?.project?.start_date),
      toDay(data?.project?.end_date),
      ...tasks.flatMap((t) => [toDay(t.start_date), toDay(t.due_date)]),
      ...milestones.map((m) => toDay(m.due_date)),
      todayDay(),
    ].filter((d) => d != null);
    const lo = Math.min(...points) - 7;
    const hi = Math.max(...points) + 14;
    return { start: lo - ((weekday(lo) + 6) % 7), days: hi - lo + 1 + ((weekday(lo) + 6) % 7) };
  }, [data, tasks, milestones]);

  // Row layout (group header rows + task rows), used for bars and dependency arrows.
  const rows = useMemo(() => {
    const out = [];
    groups.forEach((g) => {
      out.push({ kind: 'group', group: g });
      if (!collapsed.has(g.key)) g.tasks.forEach((t) => out.push({ kind: 'task', task: t, group: g }));
    });
    return out;
  }, [groups, collapsed]);
  const rowOf = useMemo(() => Object.fromEntries(rows.map((r, i) => [r.kind === 'task' ? r.task.id : r.group.key, i])), [rows]);

  // Scroll to today (or the project start) once data arrives.
  useEffect(() => {
    if (!scrollRef.current || !data) return;
    const anchor = Math.max(range.start, Math.min(todayDay(), toDay(data.project.start_date) ?? todayDay()) - 3);
    scrollRef.current.scrollLeft = (anchor - range.start) * dayW;
  }, [data?.project?.id, zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  const barGeom = (t) => {
    let s = toDay(t.start_date);
    let e = toDay(t.due_date);
    if (drag && drag.id === t.id) {
      if (drag.mode === 'move') {
        s += drag.delta;
        e += drag.delta;
      } else {
        e = Math.max(s, e + drag.delta);
      }
    }
    return { s, e, x: (s - range.start) * dayW, w: Math.max(dayW, (e - s + 1) * dayW) };
  };

  const startDrag = (ev, t, mode) => {
    if (!editable || !t.start_date || !t.due_date) return;
    ev.preventDefault();
    ev.stopPropagation();
    const x0 = ev.clientX;
    let delta = 0;
    setDrag({ id: t.id, mode, delta: 0 });
    const move = (e) => {
      delta = Math.round((e.clientX - x0) / dayW);
      setDrag({ id: t.id, mode, delta });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDrag(null);
      if (delta === 0) {
        setSelectedId(t.id);
        return;
      }
      const s = toDay(t.start_date);
      const e = toDay(t.due_date);
      const next = mode === 'move' ? { start: s + delta, end: e + delta } : { start: s, end: Math.max(s, e + delta) };
      setDates.mutate({ taskId: t.id, start_date: toIso(next.start), due_date: toIso(next.end) });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  if (!projectId) return <div className="glass-panel p-8 text-center text-muted">Select a project to see its schedule.</div>;
  if (isLoading) return <p className="text-muted text-sm">Loading schedule…</p>;
  if (error) return <p className="text-danger text-sm">{error.message}</p>;

  const width = range.days * dayW;
  const height = rows.length * ROW_H;
  const today = todayDay();
  const deadline = toDay(data.project.end_date);
  const finish = Math.max(...tasks.map((t) => toDay(t.due_date) ?? -Infinity));
  const selected = selectedId ? tasksById[selectedId] : null;
  const related = new Set(selected ? deps.filter((d) => d.task_id === selected.id || d.depends_on === selected.id).flatMap((d) => [d.task_id, d.depends_on]) : []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">{data.project.code} · Schedule</p>
          <h1 className="text-3xl font-serif text-foreground flex items-center gap-3">
            <CalendarRange className="w-7 h-7 text-primary" /> Timeline
          </h1>
          <p className="text-sm text-muted mt-1">
            {tasks.length} tasks
            {Number.isFinite(finish) && ` · finishes ${fmt(finish, { day: 'numeric', month: 'short', year: 'numeric' })}`}
            {deadline != null && Number.isFinite(finish) && (finish > deadline
              ? <span className="text-danger"> · {finish - deadline} days after delivery</span>
              : <span className="text-success"> · {deadline - finish} days of slack before delivery</span>)}
            {unscheduled > 0 && <span className="text-warning"> · {unscheduled} not scheduled yet</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-border overflow-hidden text-xs">
            {Object.keys(ZOOMS).map((z) => (
              <button type="button" key={z} onClick={() => setZoom(z)} className={`px-3 py-1.5 capitalize ${zoom === z ? 'bg-primary/15 text-primary' : 'text-muted hover:text-foreground'}`}>
                {z}
              </button>
            ))}
          </div>
          {editable && (
            <>
              <button type="button" className="btn-secondary gap-2 text-sm py-1.5" onClick={() => setPanel('new-milestone')}>
                <Flag className="w-4 h-4" /> Milestone
              </button>
              <button type="button" className="btn-primary gap-2 text-sm py-1.5" onClick={() => setPanel('auto')}>
                <Sparkles className="w-4 h-4" /> Auto-schedule
              </button>
            </>
          )}
        </div>
      </div>

      {banner?.created && (
        <div className="border border-primary/40 bg-primary/5 rounded-md p-3 text-sm flex items-start justify-between gap-3">
          <span>
            Project created: {banner.created.shots} shots, {banner.created.assets} assets, {banner.created.tasks} tasks and {banner.created.milestones} milestones.
            {editable && ' Use Auto-schedule to lay the tasks out on the timeline.'}
          </span>
          <button type="button" onClick={() => setBanner(null)} className="text-muted hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
      )}
      {banner?.auto && (
        <div className={`rounded-md p-3 text-sm flex items-start justify-between gap-3 border ${banner.auto.late_by_days ? 'border-danger/40 bg-danger/5' : 'border-success/40 bg-success/5'}`}>
          <span>
            Scheduled {banner.auto.scheduled} tasks
            {banner.auto.casting_links_created > 0 && `, added ${banner.auto.casting_links_created} links from casting`}. Finishes {banner.auto.finish_date}
            {banner.auto.deadline && (banner.auto.late_by_days
              ? ` — ${banner.auto.late_by_days} days after the ${banner.auto.deadline} delivery. Cut scope, add people, or move the delivery.`
              : ` — on time for the ${banner.auto.deadline} delivery.`)}
          </span>
          <button type="button" onClick={() => setBanner(null)} className="text-muted hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
      )}

      {panel === 'auto' && (
        <AutoScheduleForm projectId={projectId} project={data.project} onDone={(res) => { setPanel(null); if (res) setBanner({ auto: res }); }} />
      )}
      {panel === 'new-milestone' && <MilestoneForm projectId={projectId} onDone={() => setPanel(null)} />}
      {panel?.milestone && <MilestoneForm key={panel.milestone.id} projectId={projectId} milestone={panel.milestone} onDone={() => setPanel(null)} />}

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-44">
          <ThemedSelect value={filter.kind} onChange={(v) => setFilter({ ...filter, kind: v })} options={[{ value: 'all', label: 'Assets + shots' }, { value: 'asset', label: 'Assets' }, { value: 'shot', label: 'Shots' }]} />
        </div>
        <div className="w-40">
          <ThemedSelect value={filter.status} onChange={(v) => setFilter({ ...filter, status: v })} options={[{ value: 'all', label: 'Any status' }, ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))]} />
        </div>
        <input className={inputClass} placeholder="Search tasks" value={filter.query} onChange={(e) => setFilter({ ...filter, query: e.target.value })} />
        <button type="button" className="text-xs text-muted hover:text-foreground" onClick={() => setCollapsed(new Set())}>Expand all</button>
        <button type="button" className="text-xs text-muted hover:text-foreground" onClick={() => setCollapsed(new Set(groups.map((g) => g.key)))}>Collapse all</button>
        <div className="flex items-center gap-3 ml-auto text-xs text-muted">
          {Object.entries(STATUS_LABEL).map(([k, label]) => (
            <span key={k} className="flex items-center gap-1"><span className={`w-3 h-2 rounded-sm border ${STATUS_COLOR[k]}`} />{label}</span>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <div ref={scrollRef} className="glass-panel overflow-auto max-h-[68vh] flex-1 min-w-0 w-full select-none">
          <div className="relative" style={{ width: LEFT_W + width }}>
            {/* header */}
            <div className="sticky top-0 z-30 flex bg-card border-b border-border" style={{ height: HEADER_H }}>
              <div className="sticky left-0 z-40 bg-card border-r border-border px-3 flex items-end pb-2 text-xs uppercase tracking-wider text-muted shrink-0" style={{ width: LEFT_W }}>
                Task
              </div>
              <div className="relative">
                <TimelineHeader start={range.start} days={range.days} dayW={dayW} />
                {milestones.map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    title={`${m.name} · ${m.due_date}${m.done ? ' (done)' : ''}`}
                    onClick={() => editable && setPanel({ milestone: m })}
                    className={`absolute top-5 -translate-x-1/2 ${MILESTONE_COLOR[m.kind]} ${m.done ? 'opacity-50' : ''}`}
                    style={{ left: (toDay(m.due_date) - range.start + 0.5) * dayW }}
                  >
                    <Diamond className="w-3.5 h-3.5 fill-current" />
                  </button>
                ))}
              </div>
            </div>

            {/* body */}
            <div className="flex">
              <div className="sticky left-0 z-20 bg-card border-r border-border shrink-0" style={{ width: LEFT_W }}>
                {rows.map((r) =>
                  r.kind === 'group' ? (
                    <button
                      type="button"
                      key={r.group.key}
                      onClick={() => setCollapsed((c) => { const n = new Set(c); if (n.has(r.group.key)) n.delete(r.group.key); else n.add(r.group.key); return n; })}
                      className="w-full flex items-center gap-1 px-2 text-xs bg-[#171717] border-b border-border text-foreground hover:bg-card-hover"
                      style={{ height: ROW_H }}
                    >
                      {collapsed.has(r.group.key) ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      <span className="font-medium truncate">{r.group.label}</span>
                      {r.group.sub && <span className="text-muted">· {r.group.sub}</span>}
                      <span className="ml-auto text-muted">{r.group.tasks.length}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      key={r.task.id}
                      onClick={() => setSelectedId(r.task.id)}
                      className={`w-full flex items-center gap-2 pl-7 pr-2 text-xs border-b border-border/60 text-left ${selectedId === r.task.id ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-card-hover'}`}
                      style={{ height: ROW_H }}
                    >
                      <span className="truncate">{stepName(r.task)}</span>
                      {(!r.task.start_date || !r.task.due_date) && <span className="ml-auto text-[10px] text-warning">unscheduled</span>}
                    </button>
                  ),
                )}
              </div>

              <div className="relative" style={{ width, height }}>
                {/* weekends + today + milestones */}
                {dayW >= 10 && Array.from({ length: range.days }, (_, i) => (weekday(range.start + i) % 6 === 0 ? (
                  <div key={i} className="absolute top-0 bottom-0 bg-white/[0.025]" style={{ left: i * dayW, width: dayW }} />
                ) : null))}
                {deadline != null && <div className="absolute top-0 bottom-0 bg-primary/5 border-l-2 border-primary/60" style={{ left: (deadline - range.start + 1) * dayW, width: 2 }} title="Delivery" />}
                {milestones.map((m) => (
                  <div key={m.id} className={`absolute top-0 bottom-0 border-l border-dashed ${m.kind === 'delivery' ? 'border-primary/50' : m.kind === 'review' ? 'border-warning/40' : 'border-info/40'}`} style={{ left: (toDay(m.due_date) - range.start + 0.5) * dayW }} />
                ))}
                {today >= range.start && <div className="absolute top-0 bottom-0 w-px bg-danger/70 z-10" style={{ left: (today - range.start + 0.5) * dayW }} title="Today" />}

                {/* group summary bars */}
                {rows.map((r, i) => {
                  if (r.kind !== 'group') return <div key={`grid-${r.task.id}`} className="absolute left-0 right-0 border-b border-border/40" style={{ top: (i + 1) * ROW_H - 1 }} />;
                  const ds = r.group.tasks.filter((t) => t.start_date && t.due_date);
                  if (!ds.length) return null;
                  const s = Math.min(...ds.map((t) => toDay(t.start_date)));
                  const e = Math.max(...ds.map((t) => toDay(t.due_date)));
                  return <div key={r.group.key} className="absolute h-1.5 rounded-full bg-muted/40" style={{ top: i * ROW_H + ROW_H / 2 - 3, left: (s - range.start) * dayW, width: (e - s + 1) * dayW }} />;
                })}

                {/* dependency arrows */}
                <svg className="absolute inset-0 pointer-events-none z-10" width={width} height={height}>
                  <defs>
                    <marker id="arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M0,0 L6,3 L0,6 z" fill="currentColor" />
                    </marker>
                  </defs>
                  {deps.map((d) => {
                    const a = tasksById[d.depends_on];
                    const b = tasksById[d.task_id];
                    if (!a || !b || rowOf[a.id] == null || rowOf[b.id] == null) return null;
                    if (!a.due_date || !b.start_date) return null;
                    const ga = barGeom(a);
                    const gb = barGeom(b);
                    const x1 = ga.x + ga.w;
                    const y1 = rowOf[a.id] * ROW_H + ROW_H / 2;
                    const x2 = gb.x;
                    const y2 = rowOf[b.id] * ROW_H + ROW_H / 2;
                    const violated = gb.s <= ga.e;
                    const hot = selected && related.has(a.id) && related.has(b.id) && (selected.id === a.id || selected.id === b.id);
                    const midX = Math.max(x1 + 6, Math.min(x2 - 6, x1 + 10));
                    const path = `M${x1},${y1} H${midX} V${y2} H${x2 - 1}`;
                    return (
                      <path
                        key={`${d.task_id}-${d.depends_on}`}
                        d={path}
                        fill="none"
                        markerEnd="url(#arrow)"
                        className={violated ? 'text-danger' : hot ? 'text-primary' : 'text-muted/40'}
                        stroke="currentColor"
                        strokeWidth={hot || violated ? 1.5 : 1}
                      />
                    );
                  })}
                </svg>

                {/* task bars */}
                {rows.map((r, i) => {
                  if (r.kind !== 'task' || !r.task.start_date || !r.task.due_date) return null;
                  const t = r.task;
                  const g = barGeom(t);
                  const dim = selected && selected.id !== t.id && !related.has(t.id);
                  return (
                    <div
                      key={t.id}
                      onPointerDown={(e) => startDrag(e, t, 'move')}
                      onClick={() => setSelectedId(t.id)}
                      title={`${t.title}\n${t.start_date} → ${t.due_date}`}
                      className={`absolute z-20 rounded-sm border text-[10px] text-white/90 px-1 overflow-hidden whitespace-nowrap ${STATUS_COLOR[t.status] || STATUS_COLOR.todo} ${selectedId === t.id ? 'ring-1 ring-primary' : ''} ${editable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${dim ? 'opacity-40' : ''}`}
                      style={{ top: i * ROW_H + 6, height: ROW_H - 12, left: g.x, width: g.w, lineHeight: `${ROW_H - 14}px` }}
                    >
                      {g.w > 40 && stepName(t)}
                      {editable && (
                        <span onPointerDown={(e) => startDrag(e, t, 'resize')} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/30" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {selected && (
          <TaskPanel
            key={selected.id}
            task={selected}
            tasksById={tasksById}
            deps={deps}
            projectId={projectId}
            editable={editable}
            userNames={userNames}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
      {setDates.error && <p className="text-sm text-danger">Could not move the task: {setDates.error.message}</p>}
      {tasks.length === 0 && (
        <p className="text-sm text-muted flex items-center gap-2"><Link2 className="w-4 h-4" /> No tasks yet — add assets and shots (task templates create their tasks), then auto-schedule.</p>
      )}
    </div>
  );
}

export default Schedule;
