import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useProject } from '../api/hooks';
import { useAuth } from './AuthContext';

const ProjectContext = createContext(null);

const INACTIVE_STATUSES = new Set(['completed', 'approved', 'archived']);

const LEGACY_PROJECT_STORAGE_KEY = 'zeno_project_id';

// The selected project is remembered per organization so switching accounts never
// points the dashboard at a project the new account cannot see.
function _storageKey(orgId) {
  return orgId ? `${LEGACY_PROJECT_STORAGE_KEY}:${orgId}` : LEGACY_PROJECT_STORAGE_KEY;
}

function _readStoredProjectId(orgId) {
  const PROJECT_STORAGE_KEY = _storageKey(orgId);
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
  const { user } = useAuth();
  const orgId = user?.organization?.id || null;
  // Remount per organization so the stored selection is re-read for the new org.
  return (
    <OrgProjectProvider key={orgId || 'none'} orgId={orgId}>
      {children}
    </OrgProjectProvider>
  );
}

function OrgProjectProvider({ orgId, children }) {
  const qc = useQueryClient();
  const PROJECT_STORAGE_KEY = _storageKey(orgId);
  const [projectId, setProjectIdState] = useState(() => _readStoredProjectId(orgId));

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
    [qc, PROJECT_STORAGE_KEY],
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
