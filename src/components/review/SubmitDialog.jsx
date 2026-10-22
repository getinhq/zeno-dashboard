import { useMemo, useState } from 'react';
import { UploadCloud, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSubmitReview, useTasks } from '../../api/hooks';
import { useAuth } from '../../contexts/AuthContext';
import { SearchableSelect } from '../SearchableSelect';

const inputClass =
  'bg-[#111] border border-border focus:border-primary text-foreground text-sm rounded-md px-3 py-2 outline-none transition-colors';

const ACCEPT = '.mp4,.mov,.m4v,.mkv,.webm,.avi,.mxf,.png,.jpg,.jpeg,.tif,.tiff,.exr,.dpx,.tga,.webp';

/** Upload a playblast/render/still as the next revision of a task. */
export function SubmitDialog({ projectId, defaultTaskId = '', onClose }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: tasks = [] } = useTasks({ project_id: projectId }, { enabled: !!projectId });
  const submit = useSubmitReview();
  const [taskId, setTaskId] = useState(defaultTaskId);
  const [file, setFile] = useState(null);
  const [frameStart, setFrameStart] = useState('1001');
  const [fps, setFps] = useState('');
  const [description, setDescription] = useState('');
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const sections = useMemo(() => {
    const mine = (t) => t.assignee_id === user?.id || (t.assignees || []).includes(user?.id);
    const opt = (t) => ({ value: t.id, label: `${t.title || t.type} · ${String(t.status || '').replace('_', ' ')}` });
    // Pinned picks show before typing: your own tasks, else whatever is being worked on.
    const my = tasks.filter(mine);
    const active = tasks.filter((t) => ['in_progress', 'review'].includes(t.status_raw)).slice(0, 12);
    const pinned = my.length ? my : active;
    const rest = tasks.filter((t) => !pinned.includes(t));
    return [
      ...(pinned.length
        ? [{ id: 'pinned', label: my.length ? 'My tasks' : 'In progress', options: pinned.map(opt), filterable: false }]
        : []),
      { id: 'all', label: 'Type to search all tasks', options: rest.map(opt), filterable: true },
    ];
  }, [tasks, user?.id]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!taskId || !file) return;
    setProgress(0);
    const item = await submit.mutateAsync({ taskId, file, frameStart, fps, description, onProgress: setProgress });
    onClose();
    navigate(`/review/${item.id}`);
  };

  const isVideo = file && !/\.(png|jpe?g|tiff?|exr|dpx|tga|webp)$/i.test(file.name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-label="Submit for review">
      <div className="bg-background/90 fixed inset-0 backdrop-blur-sm" onClick={submit.isPending ? undefined : onClose} aria-hidden />
      <form onSubmit={onSubmit} className="relative glass-panel max-w-lg w-full p-5 flex flex-col gap-4" onKeyDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-serif">Submit for review</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground" aria-label="Close" disabled={submit.isPending}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Task</span>
          <SearchableSelect value={taskId} onChange={setTaskId} sections={sections} placeholder="Pick the task this is for" searchPlaceholder="Search tasks…" />
        </label>

        <label
          className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-md p-6 cursor-pointer transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-muted'}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
          }}
        >
          <UploadCloud className="w-7 h-7 text-muted" />
          <span className="text-sm text-foreground">{file ? file.name : 'Drop a playblast, render or still here'}</span>
          <span className="text-xs text-muted">
            {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : 'MP4, MOV, MKV, WebM · PNG, JPEG, TIFF, EXR'}
          </span>
          <input type="file" accept={ACCEPT} className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>

        {isVideo && (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">First frame number</span>
              <input className={inputClass} value={frameStart} onChange={(e) => setFrameStart(e.target.value.replace(/[^0-9-]/g, ''))} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted">Frame rate</span>
              <select className={inputClass} value={fps} onChange={(e) => setFps(e.target.value)}>
                <option value="">From the file</option>
                <option value="24000/1001">23.976</option>
                <option value="24">24</option>
                <option value="25">25</option>
                <option value="30000/1001">29.97</option>
                <option value="30">30</option>
                <option value="48">48</option>
                <option value="50">50</option>
                <option value="60">60</option>
              </select>
            </label>
            <p className="col-span-2 text-[11px] text-muted -mt-1">
              Use the scene&apos;s frame numbers (e.g. 1001) so notes stay on the same moment in later versions.
            </p>
          </div>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">What changed? (optional)</span>
          <textarea rows={2} className={`${inputClass} resize-none`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Fixed the foot slide, new arm arc" />
        </label>

        {submit.isPending && (
          <div className="flex flex-col gap-1">
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <p className="text-xs text-muted">{progress < 1 ? `Uploading… ${Math.round(progress * 100)}%` : 'Saving…'}</p>
          </div>
        )}
        {submit.error && <p className="text-sm text-danger">{submit.error.message}</p>}

        <button type="submit" className="btn-primary text-sm" disabled={!taskId || !file || submit.isPending}>
          Submit for review
        </button>
      </form>
    </div>
  );
}
