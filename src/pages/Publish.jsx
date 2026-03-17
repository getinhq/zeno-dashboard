import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectContext } from '../contexts/ProjectContext';
import { useProjects, useAssets } from '../api/hooks';
import { api } from '../api/client';
import { X } from 'lucide-react';

export function Publish() {
  const navigate = useNavigate();
  const { projectId } = useProjectContext();
  const { data: projects = [] } = useProjects();
  const [project, setProject] = useState(projectId || '');
  const { data: assets = [] } = useAssets(project || projectId || '', {});
  const [asset, setAsset] = useState('');
  const [representation, setRepresentation] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);
  const [hash, setHash] = useState('');
  const [status, setStatus] = useState('idle'); // idle | uploading | success | error
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('uploading');
    setErrorMessage('');
    try {
      const contentHash = hash.trim() || null;
      if (!contentHash || contentHash.length !== 64) {
        setErrorMessage('Enter a 64-char hex content hash (or implement client-side hash from file).');
        setStatus('error');
        return;
      }
      const projectIdToUse = project || projectId;
      if (!projectIdToUse || !asset) {
        setErrorMessage('Select project and asset.');
        setStatus('error');
        return;
      }
      const existsRes = await fetch(`/api/v1/cas/blobs/${contentHash}/exists`);
      if (existsRes.status === 404) {
        setErrorMessage('Blob does not exist in CAS. Upload the file first or use an existing content_id.');
        setStatus('error');
        return;
      }
      await api.post('/api/v1/versions', {
        project: projectIdToUse,
        asset,
        representation: representation || 'main',
        version: 'next',
        content_id: contentHash,
        filename: file?.name || 'upload',
      });
      setStatus('success');
      setTimeout(() => navigate('/tasks'), 1500);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to register version.');
      setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="bg-background/90 fixed inset-0 backdrop-blur-sm" onClick={() => navigate(-1)} aria-hidden />
      <div className="relative glass-panel max-w-lg w-full max-h-[90vh] overflow-auto">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-xl font-serif font-semibold text-foreground">Quick Publish</h2>
          <button type="button" onClick={() => navigate(-1)} className="text-muted hover:text-foreground p-1 rounded hover:bg-card-hover transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Project</label>
            <select
              value={project}
              onChange={(e) => setProject(e.target.value)}
              className="w-full rounded-md border border-border bg-card-hover text-foreground px-4 py-2 text-sm focus:outline-none focus:border-primary"
            >
              <option value="">Select project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Asset</label>
            <select
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
              className="w-full rounded-md border border-border bg-card-hover text-foreground px-4 py-2 text-sm focus:outline-none focus:border-primary"
            >
              <option value="">Select asset</option>
              {(project ? assets : []).map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Representation</label>
            <input
              type="text"
              value={representation}
              onChange={(e) => setRepresentation(e.target.value)}
              placeholder="e.g. model, fbx"
              className="w-full rounded-md border border-border bg-card-hover text-foreground px-4 py-2 text-sm focus:outline-none focus:border-primary placeholder:text-muted"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Content hash (64-char hex)</label>
            <input
              type="text"
              value={hash}
              onChange={(e) => setHash(e.target.value)}
              placeholder="SHA-256 hash of file (or paste existing)"
              className="w-full rounded-md border border-border bg-card-hover text-foreground px-4 py-2 text-sm font-mono focus:outline-none focus:border-primary placeholder:text-muted"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">File (optional; hash used above)</label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full rounded-md border border-border bg-card-hover text-foreground px-4 py-2 text-sm focus:outline-none focus:border-primary file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-primary file:text-primary-foreground file:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-border bg-card-hover text-foreground px-4 py-2 text-sm focus:outline-none focus:border-primary placeholder:text-muted"
            />
          </div>
          {errorMessage && <p className="text-danger text-sm">{errorMessage}</p>}
          {status === 'success' && <p className="text-success text-sm">Version registered. Redirecting…</p>}
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={() => navigate(-1)} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={status === 'uploading'}
              className="btn-primary disabled:opacity-50"
            >
              {status === 'uploading' ? 'Publishing…' : 'Publish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
