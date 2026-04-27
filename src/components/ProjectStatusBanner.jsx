import { AlertTriangle } from 'lucide-react';
import { useProjectContext } from '../contexts/ProjectContext';

const LABEL = {
  completed: 'Completed',
  approved: 'Approved',
  archived: 'Archived',
};

export function ProjectStatusBanner() {
  const { project, isInactive } = useProjectContext();
  if (!isInactive || !project) return null;
  const label = LABEL[project.status] || project.status;
  return (
    <div className="border-b border-yellow-500/30 bg-yellow-500/10 text-yellow-200 px-4 py-2 flex items-center gap-2 text-sm">
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span>
        This project is <span className="font-semibold">{label}</span> and is read-only. Mutations
        are disabled.
      </span>
    </div>
  );
}

export default ProjectStatusBanner;
