import { useState, useRef, useEffect } from 'react';
import { useCreateProject, useProjects } from '../api/hooks';
import { useProjectContext } from '../contexts/ProjectContext';
import { Spinner } from './Loading';
import { ChevronDown } from 'lucide-react';

export function ProjectSelector() {
  const { projectId, setProjectId } = useProjectContext();
  const { data: projects = [], isLoading, error } = useProjects({ status: 'active' });
  const createProject = useCreateProject();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!projectId) return;
    // If the previously-selected project no longer exists, clear it so the UI recovers.
    if (!projects.some((p) => p.id === projectId)) {
      setProjectId(null);
    }
  }, [isLoading, projectId, projects, setProjectId]);

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
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border border-border bg-card shadow-xl max-h-64 overflow-auto">
          {projects.length === 0 && !isLoading ? (
            <div className="px-3 py-4 text-muted text-sm">No active projects</div>
          ) : (
            projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setProjectId(p.id);
                  setOpen(false);
                }}
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-card-hover transition-colors ${p.id === projectId ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
              >
                {p.name} <span className="text-muted">({p.code})</span>
              </button>
            ))
          )}
          <div className="border-t border-border">
            <button
              type="button"
              onClick={() => { setCreateOpen(true); setOpen(false); }}
              className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-card-hover transition-colors"
            >
              + Create project
            </button>
          </div>
        </div>
      )}

      {createOpen && (
        <CreateProjectModal
          onClose={() => setCreateOpen(false)}
          onCreate={async ({ name, code }) => {
            const p = await createProject.mutateAsync({ name, code, status: 'active' });
            setProjectId(p.id);
            setCreateOpen(false);
          }}
          busy={createProject.isPending}
          errorMessage={createProject.error?.message || ''}
        />
      )}
    </div>
  );
}

function CreateProjectModal({ onClose, onCreate, busy, errorMessage }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="bg-background/80 fixed inset-0 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md bg-card border border-border shadow-xl rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-serif font-semibold text-foreground">Create project</h3>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground p-1 rounded hover:bg-card-hover transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm focus:outline-none focus:border-primary"
              placeholder="My Project"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
              placeholder="BLT2"
            />
          </div>
          {errorMessage ? <p className="text-danger text-sm break-words">{errorMessage}</p> : null}
        </div>
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button type="button" className="btn-secondary px-3 py-1.5 text-sm" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50"
            onClick={() => onCreate({ name: name.trim(), code: code.trim() })}
            disabled={busy || !name.trim() || !code.trim()}
          >
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
