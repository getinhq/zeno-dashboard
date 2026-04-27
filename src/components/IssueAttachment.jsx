import { useEffect, useState } from 'react';
import { Download, FileText, Image as ImageIcon, Loader2, Video } from 'lucide-react';
import { api } from '../api/client';

function _isImage(mime) {
  return typeof mime === 'string' && mime.startsWith('image/');
}

function _isVideo(mime) {
  return typeof mime === 'string' && mime.startsWith('video/');
}

function _humanSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Renders a single issue attachment. Thumbnails/videos are fetched through
 * ``api.getBlobUrl`` so the auth header is attached and the resulting object
 * URL is revoked on unmount (no memory leaks).
 */
export function IssueAttachment({ issueId, attachment }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [err, setErr] = useState(null);
  const path = `/api/v1/issues/${issueId}/attachments/${attachment.id}`;

  const previewable = _isImage(attachment.mime_type) || _isVideo(attachment.mime_type);

  useEffect(() => {
    if (!previewable) return undefined;
    let cancelled = false;
    let created = null;
    setErr(null);
    api
      .getBlobUrl(path)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        created = url;
        setBlobUrl(url);
      })
      .catch((e) => {
        if (!cancelled) setErr(e.message || 'Failed to load preview');
      });
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [path, previewable]);

  const downloadClick = async (e) => {
    e.preventDefault();
    try {
      const url = await api.getBlobUrl(path);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.filename || 'attachment';
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Give the browser a beat to start the download before revoking.
      setTimeout(() => URL.revokeObjectURL(url), 5_000);
    } catch (_) {
      /* handled elsewhere via toast if needed */
    }
  };

  const Icon = _isImage(attachment.mime_type)
    ? ImageIcon
    : _isVideo(attachment.mime_type)
    ? Video
    : FileText;

  return (
    <div className="glass-panel p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm">
        <Icon className="w-4 h-4 text-muted" />
        <span className="truncate text-foreground" title={attachment.filename}>
          {attachment.filename}
        </span>
        <span className="ml-auto text-[11px] text-muted font-mono">
          {_humanSize(attachment.size_bytes)}
        </span>
      </div>

      {previewable && !blobUrl && !err && (
        <div className="flex items-center justify-center h-32 bg-background/50 rounded text-muted">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      )}
      {previewable && err && <p className="text-danger text-xs">{err}</p>}
      {previewable && blobUrl && _isImage(attachment.mime_type) && (
        <a href={blobUrl} target="_blank" rel="noreferrer">
          <img
            src={blobUrl}
            alt={attachment.filename}
            className="rounded max-h-64 object-contain w-full bg-background/60"
          />
        </a>
      )}
      {previewable && blobUrl && _isVideo(attachment.mime_type) && (
        <video src={blobUrl} controls className="rounded max-h-64 w-full bg-background/60" />
      )}

      <button
        type="button"
        onClick={downloadClick}
        className="self-start text-xs text-primary hover:underline inline-flex items-center gap-1"
      >
        <Download className="w-3 h-3" /> Download
      </button>
    </div>
  );
}

export default IssueAttachment;
