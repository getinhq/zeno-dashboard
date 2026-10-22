import { useState } from 'react';
import { Check, Copy, Link2, Mail, RefreshCw, UserPlus, Users, X } from 'lucide-react';
import {
  useCreateInvite,
  useInvites,
  useOrganization,
  useProjects,
  useRegenerateInvite,
  useRevokeInvite,
  useUpdateOrganization,
  useUpdateUser,
  useUsers,
} from '../api/hooks';
import { ThemedSelect } from '../components/ThemedSelect';
import { useAuth } from '../contexts/AuthContext';
import { canAccessSettings } from '../lib/permissions';

const ROLE_OPTIONS = [
  { value: 'artist', label: 'Artist' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'production', label: 'Production' },
  { value: 'pipeline', label: 'Pipeline (admin)' },
];

const ROLE_HELP = {
  artist: 'Works on assigned tasks, publishes from their DCC.',
  supervisor: 'Reviews work, creates and assigns tasks.',
  production: 'Plans the schedule, tracks progress, manages the team.',
  pipeline: 'Full admin: settings, team, every project.',
};

const inputClass =
  'bg-[#111] border border-border focus:border-primary text-foreground text-sm rounded-md px-3 py-2 outline-none transition-colors w-full';

function CopyButton({ text, label = 'Copy link' }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-secondary gap-2 text-xs py-1.5"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch (_) {
          /* clipboard blocked: the link is still visible to select manually */
        }
      }}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  );
}

/** The freshly created/regenerated link. Tokens are not stored, so this is the only time it shows. */
function NewLinkPanel({ invite, onClose }) {
  return (
    <div className="border border-primary/40 bg-primary/5 rounded-md p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" /> Invite link ready
          </p>
          <p className="text-xs text-muted mt-1">
            {invite.email_sent
              ? `Emailed to ${invite.email}. You can also share the link directly.`
              : 'Share this link in Discord, Slack or a DM. It is shown only once — use “New link” later if you lose it.'}
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-muted hover:text-foreground" aria-label="Dismiss">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex flex-col md:flex-row gap-2 md:items-center">
        <code className="flex-1 text-xs bg-[#111] border border-border rounded px-2 py-2 break-all select-all">
          {invite.link}
        </code>
        <CopyButton text={invite.link} />
      </div>
    </div>
  );
}

function InviteForm({ emailConfigured, onCreated }) {
  const { data: projects = [] } = useProjects({ status: 'active' });
  const createInvite = useCreateInvite();
  const [form, setForm] = useState({ email: '', app_role: 'artist', department: '', project_id: '', message: '' });
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: typeof v === 'object' && v?.target ? v.target.value : v }));

  const submit = async (e) => {
    e.preventDefault();
    const body = { app_role: form.app_role };
    if (form.email.trim()) body.email = form.email.trim();
    if (form.department.trim()) body.department = form.department.trim();
    if (form.project_id) body.project_id = form.project_id;
    if (form.message.trim()) body.message = form.message.trim();
    const invite = await createInvite.mutateAsync(body);
    setForm((f) => ({ ...f, email: '', message: '' }));
    onCreated(invite);
  };

  return (
    <form onSubmit={submit} className="glass-panel p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <UserPlus className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Invite someone</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-muted">Email (optional)</span>
          <input type="email" value={form.email} onChange={set('email')} placeholder="artist@example.com" className={inputClass} />
          <span className="text-xs text-muted">
            {emailConfigured
              ? 'We email the link if you fill this in.'
              : 'Email is not set up on this server — you will get a link to share yourself.'}
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-muted">Role</span>
          <ThemedSelect value={form.app_role} onChange={set('app_role')} options={ROLE_OPTIONS} />
          <span className="text-xs text-muted">{ROLE_HELP[form.app_role]}</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-muted">Department (optional)</span>
          <input value={form.department} onChange={set('department')} placeholder="e.g. Rigging" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-muted">Add to project (optional)</span>
          <ThemedSelect
            value={form.project_id}
            onChange={set('project_id')}
            options={[{ value: '', label: 'No specific project' }, ...projects.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))]}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wider text-muted">Personal note (optional)</span>
        <textarea value={form.message} onChange={set('message')} rows={2} className={inputClass} placeholder="Welcome to the team! We start blocking on Monday." />
      </label>
      {createInvite.error && <p className="text-sm text-danger">{createInvite.error.message}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={createInvite.isPending} className="btn-primary gap-2 disabled:opacity-50">
          {form.email.trim() && emailConfigured ? <Mail className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
          {createInvite.isPending ? 'Creating…' : form.email.trim() && emailConfigured ? 'Send invite' : 'Create invite link'}
        </button>
      </div>
    </form>
  );
}

const STATUS_STYLE = {
  pending: 'text-warning border-warning/40',
  accepted: 'text-success border-success/40',
  expired: 'text-muted border-border',
  revoked: 'text-danger border-danger/40',
};

function InvitesTable({ onNewLink }) {
  const { data: invites = [], isLoading } = useInvites();
  const regenerate = useRegenerateInvite();
  const revoke = useRevokeInvite();
  if (isLoading) return <p className="text-sm text-muted">Loading invites…</p>;
  if (!invites.length) return <p className="text-sm text-muted">No invites yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wider text-muted text-left">
          <tr>
            <th className="py-2 pr-4">Who</th>
            <th className="py-2 pr-4">Role</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Expires</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {invites.map((inv) => (
            <tr key={inv.id} className="border-t border-border">
              <td className="py-2 pr-4">{inv.email || <span className="text-muted">Anyone with the link</span>}</td>
              <td className="py-2 pr-4 capitalize">{inv.app_role}</td>
              <td className="py-2 pr-4">
                <span className={`text-[10px] uppercase tracking-wider border rounded px-1.5 py-0.5 ${STATUS_STYLE[inv.status]}`}>
                  {inv.status}
                </span>
              </td>
              <td className="py-2 pr-4 text-muted">{new Date(inv.expires_at).toLocaleDateString()}</td>
              <td className="py-2 text-right whitespace-nowrap">
                {inv.status !== 'accepted' && (
                  <div className="inline-flex gap-2">
                    <button
                      type="button"
                      className="btn-secondary gap-1 text-xs py-1"
                      onClick={async () => onNewLink(await regenerate.mutateAsync(inv.id))}
                      title="Issue a new link (the old one stops working)"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> New link
                    </button>
                    {inv.status === 'pending' && (
                      <button type="button" className="btn-secondary text-xs py-1 text-danger" onClick={() => revoke.mutate(inv.id)}>
                        Revoke
                      </button>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MembersTable({ canManage, currentUserId }) {
  const { data: members = [], isLoading } = useUsers({ is_active: true });
  const updateUser = useUpdateUser();
  if (isLoading) return <p className="text-sm text-muted">Loading members…</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wider text-muted text-left">
          <tr>
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Email</th>
            <th className="py-2 pr-4">Department</th>
            <th className="py-2 pr-4 min-w-[170px]">Role</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id} className="border-t border-border">
              <td className="py-2 pr-4 text-foreground">{m.name || m.username}</td>
              <td className="py-2 pr-4 text-muted">{m.email}</td>
              <td className="py-2 pr-4 text-muted">{m.department || '—'}</td>
              <td className="py-2 pr-4">
                {canManage && m.id !== currentUserId ? (
                  <ThemedSelect
                    value={m.app_role}
                    onChange={(v) => updateUser.mutate({ userId: m.id, body: { app_role: v } })}
                    options={ROLE_OPTIONS}
                  />
                ) : (
                  <span className="capitalize">{m.app_role}</span>
                )}
              </td>
              <td className="py-2 text-right">
                {canManage && m.id !== currentUserId && (
                  <button
                    type="button"
                    className="btn-secondary text-xs py-1 text-danger"
                    onClick={() => updateUser.mutate({ userId: m.id, body: { is_active: false } })}
                    title="Remove access (their history stays)"
                  >
                    Deactivate
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {updateUser.error && <p className="text-sm text-danger mt-2">{updateUser.error.message}</p>}
    </div>
  );
}

export function Team() {
  const { user } = useAuth();
  const isAdmin = canAccessSettings(user);
  const { data: org } = useOrganization();
  const updateOrg = useUpdateOrganization();
  const [newLink, setNewLink] = useState(null);
  const [editingName, setEditingName] = useState(null);

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">Studio</p>
          {editingName !== null ? (
            <form
              className="flex gap-2 mt-1"
              onSubmit={async (e) => {
                e.preventDefault();
                await updateOrg.mutateAsync({ name: editingName });
                setEditingName(null);
              }}
            >
              <input value={editingName} onChange={(e) => setEditingName(e.target.value)} className={inputClass} autoFocus />
              <button type="submit" className="btn-primary text-sm">Save</button>
              <button type="button" className="btn-secondary text-sm" onClick={() => setEditingName(null)}>Cancel</button>
            </form>
          ) : (
            <h1 className="text-3xl font-serif text-foreground flex items-center gap-3">
              {org?.name || '…'}
              {isAdmin && (
                <button type="button" className="text-xs text-muted hover:text-primary font-sans" onClick={() => setEditingName(org?.name || '')}>
                  Rename
                </button>
              )}
            </h1>
          )}
        </div>
        {org && (
          <p className="text-sm text-muted flex items-center gap-2">
            <Users className="w-4 h-4" /> {org.members} {org.members === 1 ? 'member' : 'members'} · {org.projects}{' '}
            {org.projects === 1 ? 'project' : 'projects'}
          </p>
        )}
      </div>

      {newLink && <NewLinkPanel invite={newLink} onClose={() => setNewLink(null)} />}
      <InviteForm emailConfigured={Boolean(org?.email_configured)} onCreated={setNewLink} />

      <section className="glass-panel p-5 flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Invites</h2>
        <InvitesTable onNewLink={setNewLink} />
      </section>

      <section className="glass-panel p-5 flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Members</h2>
        <MembersTable canManage={isAdmin} currentUserId={user?.id} />
      </section>
    </div>
  );
}

export default Team;
