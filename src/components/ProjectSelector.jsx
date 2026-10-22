import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../api/hooks';
import { useProjectContext } from '../contexts/ProjectContext';
import { Spinner } from './Loading';
import { ChevronDown } from 'lucide-react';

const INACTIVE_STATUSES = new Set(['completed', 'approved', 'archived']);

export function ProjectSelector() {
  const { projectId, setProjectId } = useProjectContext();
  const [includeInactive, setIncludeInactive] = useState(false);
  const { data: projects = [], isLoading, isFetching, error } = useProjects({
    status: includeInactive ? 'all' : 'active',
  });
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  useEffect(() => {
    // Wait for any refetch: a just-created project is selected before the list includes it.
    if (isLoading || isFetching) return;
    if (!projectId) {
      // Nothing chosen yet (new studio, new browser): open the first active project.
      if (projects.length) setProjectId(projects[0].id);
      return;
    }
    // If the previously-selected project no longer exists, clear it so the UI recovers.
    if (!projects.some((p) => p.id === projectId)) {
      setProjectId(null);
    }
  }, [isLoading, isFetching, projectId, projects, setProjectId]);

  const current = projects.find((p) => p.id === projectId);

  if (error) {
    return <span className="text-danger text-sm">Failed to load projects</span>;
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="appearance-none bg-card-hover border border-border text-foreground px-4 py-1.5 pr-8 rounded-md text-sm font-medium focus:outline-none focus:border-primary transition-colors cursor-pointer min-w-[180px] flex items-center justify-between"
      >
        {isLoading ? (
          <span className="flex items-center gap-2 text-muted">
            <Spinner className="h-4 w-4 border-primary border-t-transparent" /> Loading…
          </span>
        ) : current ? (
          <>
            <span className="truncate">{current.name}</span>
            <span className="text-muted text-xs ml-1">({current.code})</span>
          </>
        ) : (
          <span className="text-muted">Select project</span>
        )}
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border border-border bg-card shadow-xl max-h-64 overflow-y-auto overflow-x-hidden overscroll-contain">
          {projects.length === 0 && !isLoading ? (
            <div className="px-3 py-4 text-muted text-sm">
              {includeInactive ? 'No projects' : 'No active projects'}
            </div>
          ) : (
            projects.map((p) => {
              const inactive = INACTIVE_STATUSES.has(p.status);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setProjectId(p.id);
                    setOpen(false);
                  }}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-card-hover transition-colors ${p.id === projectId ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      {p.name} <span className="text-muted">({p.code})</span>
                    </span>
                    {inactive && (
                      <span className="text-[10px] uppercase tracking-wider text-muted border border-border rounded px-1 py-0.5">
                        {p.status}
                      </span>
                    )}
                  </span>
                </button>
              );
            })
          )}
          <div className="border-t border-border flex flex-col">
            <label className="flex items-center gap-2 px-3 py-2 text-xs text-muted hover:bg-card-hover cursor-pointer">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                className="accent-primary"
              />
              Show completed / approved
            </label>
            <button
              type="button"
              onClick={() => { setOpen(false); navigate('/projects/new'); }}
              className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-card-hover transition-colors border-t border-border"
            >
              + Create project
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
