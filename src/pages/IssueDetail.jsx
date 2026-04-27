import { useEffect, useRef, useState } from 'react';
import { Paperclip } from 'lucide-react';
import {
  useIssue,
  useUpdateIssue,
  useUploadIssueAttachment,
  useUsers,
} from '../api/hooks';
import { useProjectContext } from '../contexts/ProjectContext';
import { StatusPill } from '../components/StatusPill';
import { ThemedSelect } from '../components/ThemedSelect';
import { IssueAttachment } from '../components/IssueAttachment';

const STATUSES = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'testing', label: 'Testing' },
  { value: 'closed', label: 'Closed' },
];

export function IssueDetail({ issueId, onClose }) {
  const { isReadOnly } = useProjectContext();
  const { data: issue, isLoading } = useIssue(issueId);
  const { data: users = [] } = useUsers({ is_active: true });
  const update = useUpdateIssue(issueId);
  const upload = useUploadIssueAttachment(issueId);
  const [draft, setDraft] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (issue) setDraft({ title: issue.title, body: issue.body || '' });
  }, [issue]);

  const handleFilesPicked = async (fileList) => {
    if (!fileList || !fileList.length) return;
    for (const f of Array.from(fileList)) {
      try {
        await upload.mutateAsync({ file: f });
      } catch (err) {
        console.error('Attachment upload failed:', f.name, err);
      }
    }
  };

  if (!issueId) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-2xl bg-card border border-border shadow-xl rounded-lg overflow-hidden max-h-[85vh] flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {issue && <StatusPill status={issue.status} />}
            <h3 className="text-lg font-serif font-semibold text-foreground truncate">
              {issue ? issue.title : 'Loading issue…'}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground p-1">
            ×
          </button>
        </div>

        {isLoading || !issue || !draft ? (
          <div className="p-8 text-center text-muted">Loading…</div>
        ) : (
          <div className="p-4 space-y-4 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs uppercase text-muted">Reporter</span>
                <p className="text-foreground text-xs">
                  {issue.reporter_name || issue.reporter_username || issue.reporter_id || '—'}
                </p>
              </div>
              <div>
                <span className="text-xs uppercase text-muted">DCC</span>
                <p className="text-foreground font-mono text-xs">{issue.dcc || 'N/A'}</p>
              </div>
              <div>
                <span className="text-xs uppercase text-muted">Entity</span>
                <p className="text-foreground text-xs font-mono uppercase">
                  {issue.entity
                    ? `${issue.entity.type === 'asset' ? 'Asset' : 'Shot'}: ${issue.entity.code || issue.entity.name || ''}`
                    : '—'}
                </p>
              </div>
              <div>
                <span className="text-xs uppercase text-muted">Created</span>
                <p className="text-foreground text-xs">
                  {issue.created_at ? new Date(issue.created_at).toLocaleString() : '—'}
                </p>
              </div>
              <div>
                <span className="text-xs uppercase text-muted">Updated</span>
                <p className="text-foreground text-xs">
                  {issue.updated_at ? new Date(issue.updated_at).toLocaleString() : '—'}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase text-muted mb-1">Title</label>
              <input
                value={draft.title}
                disabled={isReadOnly}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs uppercase text-muted mb-1">Details</label>
              <textarea
                rows={6}
                value={draft.body}
                disabled={isReadOnly}
                onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                className="w-full rounded-md border border-border bg-card-hover text-foreground px-3 py-2 text-sm disabled:opacity-60"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs uppercase text-muted mb-1">Status</label>
                <ThemedSelect
                  value={issue.status}
                  onChange={(v) =>
                    !isReadOnly &&
                    update.mutate({ status: v })
                  }
                  options={STATUSES}
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs uppercase text-muted mb-1">Assignee</label>
                <ThemedSelect
                  value={issue.assignee_id || ''}
                  onChange={(v) =>
                    !isReadOnly &&
                    update.mutate({ assignee_id: v || null })
                  }
                  options={[
                    { value: '', label: 'Unassigned' },
                    ...users.map((u) => ({ value: u.id, label: u.name || u.username })),
                  ]}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs uppercase text-muted">
                  Attached media{' '}
                  {issue.attachments?.length ? `(${issue.attachments.length})` : ''}
                </h4>
                {!isReadOnly && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        handleFilesPicked(e.target.files);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={upload.isPending}
                      className="btn-secondary text-xs px-2 py-1 inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      <Paperclip className="w-3 h-3" />
                      {upload.isPending ? 'Uploading…' : 'Add files'}
                    </button>
                  </>
                )}
              </div>
              {issue.attachments?.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {issue.attachments.map((a) => (
                    <IssueAttachment key={a.id} issueId={issue.id} attachment={a} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted italic">No media attached.</p>
              )}
              {upload.error && (
                <p className="text-danger text-xs mt-1">
                  Upload failed: {upload.error.message}
                </p>
              )}
            </div>
          </div>
        )}

        {!isReadOnly && issue && draft && (
          <div className="p-4 border-t border-border flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary px-3 py-1.5 text-sm">
              Close
            </button>
            <button
              type="button"
              disabled={update.isPending}
              onClick={() => update.mutate({ title: draft.title.trim(), body: draft.body })}
              className="btn-primary px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {update.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default IssueDetail;
