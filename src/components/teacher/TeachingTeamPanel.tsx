'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { inviteTeachingTeamMember, listTeachingTeam, revokeTeachingTeamMember } from '@/lib/firebase/teaching-team';
import { getUserFacingError } from '@/lib/user-facing-error';
import type { InstructorMembership, InstructorMembershipRole, InstructorMembershipScope } from '@/types';
import Button from '@/components/ui/Button';
import InstructorAvatar from '@/components/teacher/InstructorAvatar';
import { Check, Clock3, Eye, GraduationCap, Mail, Plus, ShieldCheck, Trash2, UserRoundCog, UsersRound, X } from 'lucide-react';

export default function TeachingTeamPanel({ courseId, courseName, ownerUid }: { courseId?: string; courseName?: string; ownerUid?: string }) {
  const { user } = useAuth();
  const [members, setMembers] = useState<InstructorMembership[]>([]);
  const [resolvedOwnerUid, setResolvedOwnerUid] = useState(ownerUid || '');
  const [owner, setOwner] = useState({ name: 'Workspace owner', email: '', photoURL: '' });
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InstructorMembershipRole>('co-instructor');
  const [scope, setScope] = useState<InstructorMembershipScope>(courseId ? 'course' : 'workspace');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const isOwner = Boolean(user && resolvedOwnerUid === user.uid);
  const canInvite = isOwner || Boolean(courseId);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const result = await listTeachingTeam(courseId);
      setResolvedOwnerUid(result.ownerUid);
      setOwner(result.owner);
      setMembers(result.members);
      setError('');
    } catch (loadError) {
      setError(getUserFacingError(loadError, 'The teaching team could not be loaded. Refresh and try again.'));
    } finally {
      setLoading(false);
    }
  }, [user, courseId]);

  useEffect(() => { void load(); }, [load]);
  const activeMembers = useMemo(() => members.filter((member) => member.status !== 'revoked'), [members]);

  const invite = async () => {
    if (!email.trim()) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const result = await inviteTeachingTeamMember({ email: email.trim(), role, scope, ...(scope === 'course' && courseId ? { courseId } : {}) });
      setMembers((current) => [...current.filter((item) => item.id !== result.membership.id), result.membership]);
      setNotice(result.invitationSent
        ? `${result.resent ? 'New invitation sent' : 'Invitation sent'} to ${email.trim()}.`
        : `Invitation saved, but the email could not be sent. Use Add instructor with the same address to try again.`);
      setEmail(''); setOpen(false);
    } catch (inviteError) {
      setError(getUserFacingError(inviteError, 'This instructor could not be invited. Check the email and try again.'));
    } finally { setSaving(false); }
  };

  const remove = async (member: InstructorMembership) => {
    if (!window.confirm(`Remove ${member.name || member.email} from ${member.scope === 'workspace' ? 'all courses' : courseName || 'this course'}?`)) return;
    try {
      await revokeTeachingTeamMember(member.id);
      setMembers((current) => current.filter((item) => item.id !== member.id));
      setNotice('Instructor access removed.');
    } catch (removeError) { setError(getUserFacingError(removeError, 'This access could not be removed. Try again.')); }
  };

  return <section className="overflow-hidden rounded-3xl border border-[#e3e5ed] bg-white" aria-labelledby="teaching-team-title">
    <div className="flex flex-col gap-5 border-b border-[#e3e5ed] px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4">
        <span className="relative flex h-12 w-16 shrink-0 items-center" aria-hidden="true"><span className="absolute left-0 grid h-11 w-11 place-items-center rounded-full border-2 border-white bg-[#e9e7ff] text-[#5146e5]"><GraduationCap className="h-5 w-5" /></span><span className="absolute right-0 grid h-11 w-11 place-items-center rounded-full border-2 border-white bg-[#eaf7ef] text-[#2f7b49]"><UsersRound className="h-5 w-5" /></span></span>
        <div><p className="seminar-eyebrow mb-1">Shared teaching</p><h2 id="teaching-team-title" className="seminar-display text-2xl text-[#101a38]">Teaching team</h2><p className="mt-1 max-w-xl text-sm leading-6 text-[#697087]">Invite another instructor without sharing your login. Choose whether they can teach or only review progress.</p></div>
      </div>
      {canInvite && <Button variant="outline" onClick={() => { setOpen(true); setError(''); setNotice(''); setScope(courseId ? 'course' : 'workspace'); }} className="shrink-0 gap-2"><Plus className="h-4 w-4" /> Add instructor</Button>}
    </div>
    {error && <p role="alert" className="mx-6 mt-5 rounded-xl border border-[#efc8bf] bg-[#fff6f2] px-4 py-3 text-sm text-[#a44534]">{error}</p>}
    {notice && <p role="status" className="mx-6 mt-5 flex items-center gap-2 rounded-xl bg-[#edf8ef] px-4 py-3 text-sm text-[#2f6f43]"><Check className="h-4 w-4" />{notice}</p>}
    <div className="divide-y divide-[#ececf1] px-6">
      <div className="flex items-center gap-3 py-5"><InstructorAvatar name={owner.name} photoURL={owner.photoURL || undefined} size={44} /><div className="min-w-0 flex-1"><strong className="block truncate text-sm text-[#101a38]">{owner.name}</strong><span className="mt-1 block text-xs text-[#697087]">Owner · All courses</span></div><span className="rounded-full bg-[#f0efff] px-3 py-1 text-xs font-bold text-[#5146e5]">Owner</span></div>
      {loading ? <div className="py-8 text-center text-sm text-[#697087]">Opening the teaching team…</div> : activeMembers.map((member) => <div key={member.id} className="flex items-center gap-3 py-5"><InstructorAvatar name={member.name || member.email} photoURL={member.photoURL} size={44} /><div className="min-w-0 flex-1"><strong className="block truncate text-sm text-[#101a38]">{member.name || member.email}</strong><span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[#697087]">{member.role === 'co-instructor' ? <><UserRoundCog className="h-3.5 w-3.5" /> Co-instructor</> : <><Eye className="h-3.5 w-3.5" /> Progress viewer</>}<span>·</span>{member.scope === 'workspace' ? 'All courses' : member.courseName || courseName || 'This course'}</span></div><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${member.status === 'pending' ? 'bg-[#fff6df] text-[#8a6113]' : 'bg-[#edf8ef] text-[#2f6f43]'}`}>{member.status === 'pending' ? <Clock3 className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}{member.status === 'pending' ? 'Pending' : 'Active'}</span>{isOwner && <button type="button" onClick={() => remove(member)} aria-label={`Remove ${member.name || member.email}`} className="seminar-focus rounded-lg p-2 text-[#9b6b62] hover:bg-[#fff1ee] hover:text-[#b64936]"><Trash2 className="h-4 w-4" /></button>}</div>)}
      {!loading && activeMembers.length === 0 && <div className="py-7 text-sm leading-6 text-[#697087]">No one else has access yet. Add a trusted instructor when you are ready to share teaching or progress review.</div>}
    </div>
    {open && <div className="fixed inset-0 z-[100] grid place-items-center bg-[#101a38]/55 p-4" role="presentation"><section className="w-full max-w-xl rounded-3xl bg-[#fffefa] shadow-[0_28px_80px_rgba(16,26,56,0.25)]" role="dialog" aria-modal="true" aria-labelledby="invite-instructor-title"><div className="flex items-start justify-between border-b border-[#e3e5ed] p-6"><div><p className="seminar-eyebrow mb-2">Teaching team</p><h2 id="invite-instructor-title" className="seminar-display text-3xl text-[#101a38]">Add an instructor</h2><p className="mt-2 text-sm leading-6 text-[#697087]">They will sign in with their own account. You can remove access at any time.</p></div><button type="button" onClick={() => setOpen(false)} className="seminar-focus rounded-lg p-2 text-[#697087] hover:bg-white" aria-label="Close"><X className="h-5 w-5" /></button></div><div className="space-y-6 p-6"><label className="grid gap-2 text-sm font-bold text-[#313950]">Email address<div className="relative"><Mail className="absolute left-4 top-3.5 h-5 w-5 text-[#8a90a2]" /><input autoFocus type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="instructor@university.edu" className="min-h-12 w-full rounded-xl border border-[#d7dae5] bg-white pl-12 pr-4 font-normal outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" /></div></label><fieldset><legend className="text-sm font-bold text-[#313950]">What can they do?</legend><div className="mt-3 grid gap-3 sm:grid-cols-2">{([{ id: 'co-instructor', title: 'Teach and manage', note: 'Plan sessions, run class, and see progress.', icon: UserRoundCog }, { id: 'progress-viewer', title: 'View progress', note: 'Review attendance and progress without teaching controls.', icon: Eye }] as const).map((item) => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => setRole(item.id)} aria-pressed={role === item.id} className={`seminar-focus rounded-2xl border p-4 text-left ${role === item.id ? 'border-[#5146e5] bg-[#f5f3ff]' : 'border-[#e3e5ed] bg-white'}`}><Icon className="h-5 w-5 text-[#5146e5]" /><strong className="mt-3 block text-sm text-[#101a38]">{item.title}</strong><span className="mt-1 block text-xs leading-5 text-[#697087]">{item.note}</span></button>; })}</div></fieldset>{courseId && <fieldset><legend className="text-sm font-bold text-[#313950]">Where can they work?</legend><div className="mt-3 grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setScope('course')} aria-pressed={scope === 'course'} className={`seminar-focus rounded-2xl border p-4 text-left ${scope === 'course' ? 'border-[#5146e5] bg-[#f5f3ff]' : 'border-[#e3e5ed] bg-white'}`}><strong className="block text-sm text-[#101a38]">This course</strong><span className="mt-1 block text-xs leading-5 text-[#697087]">{courseName || 'Current course'} only</span></button>{isOwner && <button type="button" onClick={() => setScope('workspace')} aria-pressed={scope === 'workspace'} className={`seminar-focus rounded-2xl border p-4 text-left ${scope === 'workspace' ? 'border-[#5146e5] bg-[#f5f3ff]' : 'border-[#e3e5ed] bg-white'}`}><strong className="block text-sm text-[#101a38]">All courses</strong><span className="mt-1 block text-xs leading-5 text-[#697087]">Current and future courses</span></button>}</div></fieldset>}<div className="flex justify-end gap-3 border-t border-[#e3e5ed] pt-5"><Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button><Button onClick={invite} loading={saving} disabled={!email.trim()} className="gap-2"><Mail className="h-4 w-4" /> Send invitation</Button></div></div></section></div>}
  </section>;
}
