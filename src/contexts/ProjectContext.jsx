import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useProject } from '../api/hooks';

const ProjectContext = createContext(null);

const INACTIVE_STATUSES = new Set(['completed', 'approved', 'archived']);

const PROJECT_STORAGE_KEY = 'zeno_project_id';

function _readStoredProjectId() {
  try {
    const fromLocal = localStorage.getItem(PROJECT_STORAGE_KEY);
    if (fromLocal) return fromLocal;
    // Backwards-compat: older clients stored this in sessionStorage, which was
    // cleared on tab close / logout. Migrate it forward once so Recent Activity
    // and other project-scoped widgets keep their context across sessions.
    const legacy = sessionStorage.getItem(PROJECT_STORAGE_KEY);
    if (legacy) {
      localStorage.setItem(PROJECT_STORAGE_KEY, legacy);
      sessionStorage.removeItem(PROJECT_STORAGE_KEY);
      return legacy;
    }
  } catch (_) {
    /* ignore storage errors (private mode, quota) */
  }
  return null;
}

export function ProjectProvider({ children }) {
  const qc = useQueryClient();
  const [projectId, setProjectIdState] = useState(() => _readStoredProjectId());

  const setProjectId = useCallback(
    (id) => {
      setProjectIdState(id);
      try {
        if (id) localStorage.setItem(PROJECT_STORAGE_KEY, id);
        else localStorage.removeItem(PROJECT_STORAGE_KEY);
      } catch (_) {
        /* ignore storage errors */
      }
      // Force any consumers reading old project data to refetch for the new one.
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
    [qc],
  );

  const { data: project } = useProject(projectId);

  const value = useMemo(() => {
    const status = project?.status || null;
    const isInactive = status ? INACTIVE_STATUSES.has(status) : false;
    return {
      projectId,
      setProjectId,
      project: project || null,
      projectStatus: status,
      isInactive,
      isReadOnly: isInactive,
    };
  }, [projectId, setProjectId, project]);

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProjectContext() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProjectContext must be used within ProjectProvider');
  return ctx;
}
