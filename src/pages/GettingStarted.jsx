import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import { useAssets, useOrganization, useTasks } from '../api/hooks';
import { useAuth } from '../contexts/AuthContext';
import { useProjectContext } from '../contexts/ProjectContext';
import { isManagement } from '../lib/permissions';

const MANUAL_KEY = 'zeno_onboarding_manual_done';

function readManual() {
  try {
    return JSON.parse(localStorage.getItem(MANUAL_KEY) || '{}') || {};
  } catch (_) {
    return {};
  }
}

/**
 * Onboarding checklist. Steps are detected from real data where possible; the few that
 * cannot be detected (e.g. installing the Blender add-on) can be ticked by hand.
 */
export function useOnboardingSteps() {
  const { user } = useAuth();
  const { projectId } = useProjectContext();
  const { data: org } = useOrganization();
  const { data: assets = [] } = useAssets(projectId);
  const { data: tasks = [] } = useTasks(projectId ? { project_id: projectId } : {}, { enabled: !!projectId });
  const [manual, setManual] = useState(readManual);

  const toggleManual = (id) => {
    setManual((m) => {
      const next = { ...m, [id]: !m[id] };
      try {
        localStorage.setItem(MANUAL_KEY, JSON.stringify(next));
      } catch (_) {
        /* ignore storage errors */
      }
      return next;
    });
  };

  const manager = isManagement(user);
  const steps = [
    {
      id: 'project',
      title: 'Create your first project',
      body: 'Start from a template (short film, series, commercial…) so episodes, stages and task types are set up for you.',
      done: (org?.projects || 0) > 0,
      to: '/projects/new',
      cta: 'New project',
      managerOnly: true,
    },
    {
      id: 'team',
      title: 'Invite your team',
      body: 'Send invite links to artists, supervisors and producers. Each person gets the right permissions for their role.',
      done: (org?.members || 0) > 1,
      to: '/team',
      cta: 'Invite people',
      managerOnly: true,
    },
    {
      id: 'assets',
      title: 'Add assets and shots',
      body: 'Characters, props and environments, plus the shots they appear in.',
      done: assets.length > 0,
      to: '/entities',
      cta: 'Open entities',
      managerOnly: true,
    },
    {
      id: 'tasks',
      title: 'Create and assign tasks',
      body: 'Task templates create the modelling → rigging → animation tasks for each asset automatically.',
      done: tasks.length > 0,
      to: '/tasks',
      cta: 'Open tasks',
    },
    {
      id: 'dcc',
      title: 'Connect Blender',
      body: 'Install Zeno Bridge so “Open in DCC” launches Blender with the Zeno add-on loaded. Tick this when it works.',
      done: Boolean(manual.dcc),
      manual: true,
      to: '/guide#connect-dcc',
      cta: 'How to connect',
    },
  ].filter((s) => manager || !s.managerOnly);

  const doneCount = steps.filter((s) => s.done).length;
  return { steps, doneCount, total: steps.length, toggleManual };
}

export function GettingStarted() {
  const { user } = useAuth();
  const { steps, doneCount, total, toggleManual } = useOnboardingSteps();
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div className="max-w-3xl flex flex-col gap-6">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted">Getting started</p>
        <h1 className="text-3xl font-serif text-foreground">
          Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-muted text-sm mt-2">
          A few steps to get your production running. You can come back here any time from the Guide.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-border overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-sm text-muted tabular-nums">
          {doneCount}/{total}
        </span>
      </div>

      <ol className="flex flex-col gap-3">
        {steps.map((s, i) => (
          <li key={s.id} className={`glass-panel p-4 flex gap-4 items-start ${s.done ? 'opacity-70' : ''}`}>
            <button
              type="button"
              disabled={!s.manual}
              onClick={() => s.manual && toggleManual(s.id)}
              className={`mt-0.5 ${s.manual ? 'cursor-pointer' : 'cursor-default'}`}
              aria-label={s.done ? 'Done' : 'Not done'}
            >
              {s.done ? <CheckCircle2 className="w-5 h-5 text-success" /> : <Circle className="w-5 h-5 text-muted" />}
            </button>
            <div className="flex-1">
              <p className={`font-medium ${s.done ? 'line-through text-muted' : 'text-foreground'}`}>
                {i + 1}. {s.title}
              </p>
              <p className="text-sm text-muted mt-1">{s.body}</p>
            </div>
            {s.to && !s.done && (
              <Link to={s.to} className="btn-secondary gap-2 text-sm whitespace-nowrap">
                {s.cta} <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

export default GettingStarted;
