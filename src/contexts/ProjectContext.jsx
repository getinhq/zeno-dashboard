import { createContext, useContext, useState, useCallback } from 'react';

const ProjectContext = createContext(null);

export function ProjectProvider({ children }) {
  const [projectId, setProjectIdState] = useState(() =>
    sessionStorage.getItem('zeno_project_id') || null
  );

  const setProjectId = useCallback((id) => {
    setProjectIdState(id);
    if (id) sessionStorage.setItem('zeno_project_id', id);
    else sessionStorage.removeItem('zeno_project_id');
  }, []);

  return (
    <ProjectContext.Provider value={{ projectId, setProjectId }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectContext() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProjectContext must be used within ProjectProvider');
  return ctx;
}
