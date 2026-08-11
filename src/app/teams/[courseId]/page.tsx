'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronRight, LoaderCircle, Lock, Palette, Pencil, Search, UsersRound, X } from 'lucide-react';
import ClassfullyBrand from '@/components/marketing/ClassfullyBrand';
import ClassroomStateGate from '@/components/live/ClassroomStateGate';
import { ConfirmationRipple } from '@/components/motion';
import { ensureStudentAnonymousAuth } from '@/lib/firebase/student-config';
import {
  TEAM_COLORS,
  createCourseTeam,
  getStudentMembership,
  getStudentTeamModule,
  joinCourseTeam,
  normalizeTeamName,
  subscribeStudentTeams,
  updateCourseTeam,
  type CourseTeamRecord,
  type CourseTeamMembership,
  type TeamColorId,
  type TeamModule,
} from '@/lib/firebase/course-teams';
import { normalizeStudentDisplayName, normalizeStudentNumber } from '@/lib/firebase/live-classroom';
import { STUDENT_PRIVACY_NOTICE_VERSION } from '@/lib/privacy';
import { getUserFacingError } from '@/lib/user-facing-error';

const REMEMBERED_STUDENT_KEY = 'classfully-remembered-student';

type PageProps = { params: Promise<{ courseId: string }> };

export default function TeamRegistrationPage({ params }: PageProps) {
  const { courseId } = use(params);
  const [module, setModule] = useState<TeamModule | null>(null);
  const [teams, setTeams] = useState<CourseTeamRecord[]>([]);
  const [membership, setMembership] = useState<CourseTeamMembership | null>(null);
  const [studentUid, setStudentUid] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [identityReady, setIdentityReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [description, setDescription] = useState('');
  const [tag, setTag] = useState('');
  const [color, setColor] = useState<TeamColorId>('violet');

  useEffect(() => {
    let stopTeams: () => void = () => {};
    Promise.all([ensureStudentAnonymousAuth(), getStudentTeamModule(courseId), getStudentMembership(courseId)])
      .then(([user, moduleData, membershipData]) => {
        setStudentUid(user.uid);
        setModule(moduleData);
        setMembership(membershipData);
        stopTeams = subscribeStudentTeams(courseId, setTeams);
        try {
          const remembered = JSON.parse(window.localStorage.getItem(REMEMBERED_STUDENT_KEY) || '{}') as { studentNumber?: string; studentDisplayName?: string; privacyNoticeVersion?: string };
          const number = normalizeStudentNumber(remembered.studentNumber || membershipData?.studentNumber || '');
          const name = normalizeStudentDisplayName(remembered.studentDisplayName || membershipData?.displayName || '');
          setStudentNumber(number);
          setDisplayName(name);
          setPrivacyAcknowledged(remembered.privacyNoticeVersion === STUDENT_PRIVACY_NOTICE_VERSION);
          setIdentityReady(number.length >= 3 && remembered.privacyNoticeVersion === STUDENT_PRIVACY_NOTICE_VERSION);
        } catch {
          window.localStorage.removeItem(REMEMBERED_STUDENT_KEY);
        }
      })
      .catch((loadError) => setError(getUserFacingError(loadError, 'Team registration could not be opened. Try the link again.')))
      .finally(() => setLoading(false));
    return () => stopTeams();
  }, [courseId]);

  const currentTeam = teams.find((team) => team.id === membership?.teamId) || null;
  const normalizedSearch = normalizeTeamName(search);
  const filteredTeams = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return teams;
    return teams.filter((team) => team.name.toLocaleLowerCase().includes(term) || team.tag?.toLocaleLowerCase().includes(term));
  }, [search, teams]);
  const exactTeam = teams.find((team) => team.normalizedName === normalizedSearch);

  const saveIdentity = () => {
    const normalizedNumber = normalizeStudentNumber(studentNumber);
    const normalizedName = normalizeStudentDisplayName(displayName);
    if (normalizedNumber.length < 3 || !privacyAcknowledged) {
      setError('Enter your student number and review the privacy notice.');
      return;
    }
    window.localStorage.setItem(REMEMBERED_STUDENT_KEY, JSON.stringify({
      studentNumber: normalizedNumber,
      ...(normalizedName ? { studentDisplayName: normalizedName } : {}),
      privacyNoticeVersion: STUDENT_PRIVACY_NOTICE_VERSION,
      rememberedAt: Date.now(),
    }));
    setStudentNumber(normalizedNumber);
    setDisplayName(normalizedName);
    setIdentityReady(true);
    setError('');
  };

  const joinTeam = async (team: CourseTeamRecord) => {
    if (!module) return;
    setSaving(true);
    setError('');
    try {
      await joinCourseTeam({ courseId, teacherId: module.teacherId, teamId: team.id, studentNumber, displayName });
      setMembership({ id: `${courseId}__${studentUid}`, courseId, teacherId: module.teacherId, teamId: team.id, studentUid, studentNumber, displayName });
      window.localStorage.setItem(`classfully-team:${module.courseCode}`, team.id);
      setSearch('');
      setCreating(false);
      setEditing(false);
      setNotice(`You joined ${team.name}.`);
    } catch (joinError) {
      setError(getUserFacingError(joinError, 'Your team was not changed. Check the connection and try again.'));
    } finally {
      setSaving(false);
    }
  };

  const createTeam = async () => {
    if (!module || saving) return;
    if (exactTeam) {
      setError(`“${exactTeam.name}” already exists. Choose it from the list.`);
      return;
    }
    if (normalizeTeamName(teamName).length < 2 || (module.tags.length > 0 && !tag)) {
      setError(`Add a team name${module.tags.length ? ' and choose a tag' : ''}.`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const teamId = await createCourseTeam({ module, name: teamName, description, tag, color, studentNumber, displayName });
      setMembership({ id: `${courseId}__${studentUid}`, courseId, teacherId: module.teacherId, teamId, studentUid, studentNumber, displayName });
      window.localStorage.setItem(`classfully-team:${module.courseCode}`, teamId);
      setCreating(false);
      setSearch('');
      setNotice(`${teamName.trim()} is ready. Your teammates can now join it.`);
    } catch (createError) {
      setError(getUserFacingError(createError, 'The team was not created. Check the name and try again.'));
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = () => {
    if (!currentTeam) return;
    setTeamName(currentTeam.name);
    setDescription(currentTeam.description || '');
    setTag(currentTeam.tag || '');
    setColor(currentTeam.color || 'violet');
    setEditing(true);
    setCreating(false);
    setError('');
  };

  const saveTeamChanges = async () => {
    if (!currentTeam) return;
    setSaving(true);
    setError('');
    try {
      await updateCourseTeam({ team: currentTeam, name: teamName, description, tag, color });
      setEditing(false);
      setNotice('Your team details are up to date.');
    } catch (editError) {
      setError(getUserFacingError(editError, 'The team details were not changed. Check the name and try again.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ClassroomStateGate title="Opening team registration" message="Finding your class and its teams." />;

  if (!module?.enabled) return <main className="min-h-screen bg-[#fffefa] px-5 py-8"><div className="mx-auto max-w-xl"><ClassfullyBrand /><section className="mt-16 rounded-3xl border border-[#e3e5ed] bg-white p-7"><h1 className="seminar-display text-4xl text-[#101a38]">Team sign-up is closed.</h1><p className="mt-3 leading-7 text-[#697087]">Ask your instructor where to register for this class.</p></section></div></main>;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_90%_0%,#eeebff_0,transparent_30%),#fffefa] pb-16">
      <header className="border-b border-[#e3e5ed] bg-[#fffefa]/90 px-5 py-4 backdrop-blur"><div className="mx-auto flex max-w-3xl items-center justify-between"><ClassfullyBrand className="text-xl" /><span className="rounded-full bg-[#edf8ef] px-3 py-1.5 text-xs font-bold text-[#287044]">{module.courseCode}</span></div></header>
      <div className="mx-auto max-w-3xl px-5 pt-8 sm:pt-12">
        <p className="seminar-eyebrow">Choose your team</p>
        <h1 className="seminar-display mt-3 text-4xl leading-tight text-[#101a38] sm:text-5xl">Join the group you’re working with.</h1>
        <p className="mt-3 text-base leading-7 text-[#697087]">{module.courseName}{module.term ? ` · ${module.term}` : ''}</p>

        {error && <div className="mt-5 rounded-2xl border border-[#f0b4a8] bg-[#fff4f1] px-4 py-3 text-sm leading-6 text-[#a43e2c]" role="alert">{error}</div>}
        {notice && !error && <ConfirmationRipple eventKey={notice} label={notice} className="mt-5 rounded-2xl"><div className="flex items-center gap-2 rounded-2xl border border-[#bfe2c8] bg-[#f1faf3] px-4 py-3 text-sm font-semibold text-[#287044]"><Check className="h-4 w-4" /> {notice}</div></ConfirmationRipple>}

        {!identityReady ? (
          <section className="mt-7 rounded-3xl border border-[#e3e5ed] bg-white p-5 shadow-[0_18px_60px_rgba(16,26,56,.07)] sm:p-7">
            <h2 className="seminar-display text-3xl text-[#101a38]">First, tell us who you are.</h2>
            <p className="mt-2 text-sm leading-6 text-[#697087]">Your student number connects this team to your class record.</p>
            <label className="mt-6 grid gap-2 text-sm font-bold text-[#313950]">Student number<input value={studentNumber} onChange={(event) => setStudentNumber(normalizeStudentNumber(event.target.value))} className="min-h-13 rounded-xl border border-[#d7dae5] px-4 text-base outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" /></label>
            <label className="mt-4 grid gap-2 text-sm font-bold text-[#313950]">Preferred name <small className="font-normal text-[#697087]">Optional</small><input value={displayName} onChange={(event) => setDisplayName(event.target.value.slice(0, 60))} className="min-h-13 rounded-xl border border-[#d7dae5] px-4 text-base outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" /></label>
            <label className="mt-5 flex items-start gap-3 rounded-xl bg-[#f7f6ff] p-4 text-sm leading-6 text-[#555d73]"><input type="checkbox" checked={privacyAcknowledged} onChange={(event) => setPrivacyAcknowledged(event.target.checked)} className="mt-1 accent-[#5146e5]" /><span>I understand that my student number is visible to my instructor, not my classmates. <Link href="/privacy" className="font-semibold text-[#5146e5] underline">Privacy details</Link></span></label>
            <button type="button" onClick={saveIdentity} className="mt-6 flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#5146e5] px-5 font-bold text-white shadow-[0_5px_0_#342ba5] active:translate-y-1 active:shadow-none">Continue <ChevronRight className="h-4 w-4" /></button>
          </section>
        ) : editing && currentTeam ? (
          <TeamEditor title="Update your team" module={module} name={teamName} setName={setTeamName} description={description} setDescription={setDescription} tag={tag} setTag={setTag} color={color} setColor={setColor} saving={saving} onCancel={() => setEditing(false)} onSave={saveTeamChanges} />
        ) : creating ? (
          <TeamEditor title="Create your team" module={module} name={teamName} setName={(value) => { setTeamName(value); setSearch(value); }} description={description} setDescription={setDescription} tag={tag} setTag={setTag} color={color} setColor={setColor} saving={saving} onCancel={() => { setCreating(false); setTeamName(''); }} onSave={createTeam} duplicate={exactTeam} onChooseDuplicate={() => exactTeam && joinTeam(exactTeam)} />
        ) : (
          <>
            {currentTeam && <section className="mt-7 rounded-3xl border border-[#dcd8ff] bg-white p-5 shadow-[0_18px_60px_rgba(16,26,56,.07)] sm:p-6" style={{ borderTop: `6px solid ${TEAM_COLORS.find((item) => item.id === currentTeam.color)?.value || '#5146e5'}` }}><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[.1em] text-[#5146e5]">Your team</p><h2 className="seminar-display mt-2 text-3xl text-[#101a38]">{currentTeam.name}</h2>{currentTeam.tag && <span className="mt-3 inline-flex rounded-full bg-[#f0efff] px-3 py-1 text-xs font-bold text-[#5146e5]">{currentTeam.tag}</span>}{currentTeam.description && <p className="mt-3 text-sm leading-6 text-[#697087]">{currentTeam.description}</p>}</div>{currentTeam.creatorUid === studentUid && <button type="button" onClick={beginEdit} className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-[#d7dae5] px-3 text-sm font-bold text-[#313950]"><Pencil className="h-4 w-4" /> Edit</button>}</div></section>}

            <section className="mt-7 rounded-3xl border border-[#e3e5ed] bg-white p-5 sm:p-7">
              <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f0efff] text-[#5146e5]"><UsersRound className="h-5 w-5" /></span><div><h2 className="seminar-display text-3xl text-[#101a38]">{currentTeam ? 'Change teams' : 'Choose your team'}</h2><p className="mt-1 text-sm leading-6 text-[#697087]">Type your team name. Join it if it is already here, or create it if it is not.</p></div></div>
              <label className="relative mt-6 block"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b91a3]" /><span className="sr-only">Search team names</span><input value={search} onChange={(event) => setSearch(event.target.value.slice(0, 48))} placeholder="Start typing a team name" autoComplete="off" className="min-h-13 w-full rounded-xl border border-[#d7dae5] pl-11 pr-4 text-base outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" /></label>
              <div className="mt-4 grid gap-2">
                {filteredTeams.map((team) => <button key={team.id} type="button" disabled={saving || team.id === currentTeam?.id} onClick={() => joinTeam(team)} className="flex min-h-16 items-center gap-3 rounded-2xl border border-[#e3e5ed] px-4 text-left transition hover:border-[#bdb6ff] hover:bg-[#faf9ff] disabled:cursor-default disabled:bg-[#f6f7f9]"><i className="h-8 w-2 shrink-0 rounded-full" style={{ background: TEAM_COLORS.find((item) => item.id === team.color)?.value || '#5146e5' }} /><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-[#101a38]">{team.name}</strong>{team.tag && <small className="text-xs text-[#697087]">{team.tag}</small>}</span>{team.id === currentTeam?.id ? <span className="flex items-center gap-1 text-xs font-bold text-[#287044]"><Check className="h-4 w-4" /> Joined</span> : <ChevronRight className="h-4 w-4 text-[#8b91a3]" />}</button>)}
                {search && filteredTeams.length === 0 && <p className="rounded-xl bg-[#f7f6ff] p-4 text-sm leading-6 text-[#697087]">No team matches “{search}”. You can create it below.</p>}
              </div>
              <button type="button" onClick={() => { setTeamName(search); setDescription(''); setTag(''); setColor('violet'); setCreating(true); setError(''); }} disabled={Boolean(exactTeam)} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#5146e5] px-4 text-sm font-bold text-[#5146e5] disabled:cursor-not-allowed disabled:border-[#cfd2df] disabled:text-[#8b91a3]"><UsersRound className="h-4 w-4" /> {search.trim() ? `Create “${search.trim()}”` : 'Create a new team'}</button>
            </section>
            <button type="button" onClick={() => setIdentityReady(false)} className="mx-auto mt-6 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#697087]"><Lock className="h-4 w-4" /> Not {displayName || studentNumber}?</button>
          </>
        )}
      </div>
    </main>
  );
}

function TeamEditor({ title, module, name, setName, description, setDescription, tag, setTag, color, setColor, saving, onCancel, onSave, duplicate, onChooseDuplicate }: {
  title: string;
  module: TeamModule;
  name: string;
  setName: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  tag: string;
  setTag: (value: string) => void;
  color: TeamColorId;
  setColor: (value: TeamColorId) => void;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
  duplicate?: CourseTeamRecord;
  onChooseDuplicate?: () => void;
}) {
  return <section className="mt-7 rounded-3xl border border-[#e3e5ed] bg-white p-5 shadow-[0_18px_60px_rgba(16,26,56,.07)] sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="seminar-eyebrow">Team details</p><h2 className="seminar-display mt-2 text-3xl text-[#101a38]">{title}</h2></div><button type="button" onClick={onCancel} className="rounded-lg p-2 text-[#697087]" aria-label="Close"><X className="h-5 w-5" /></button></div>
    <label className="mt-6 grid gap-2 text-sm font-bold text-[#313950]">Team name<input value={name} onChange={(event) => setName(event.target.value.slice(0, 48))} maxLength={48} autoComplete="off" className="min-h-13 rounded-xl border border-[#d7dae5] px-4 text-base outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" /></label>
    {duplicate && <button type="button" onClick={onChooseDuplicate} className="mt-3 flex w-full items-center justify-between rounded-xl border border-[#f0cf80] bg-[#fff9e9] p-4 text-left"><span><strong className="block text-sm text-[#101a38]">{duplicate.name} already exists</strong><small className="text-[#697087]">Join it instead of making a duplicate.</small></span><ChevronRight className="h-4 w-4" /></button>}
    <label className="mt-4 grid gap-2 text-sm font-bold text-[#313950]">What are you working on? <small className="font-normal text-[#697087]">Optional</small><textarea value={description} onChange={(event) => setDescription(event.target.value.slice(0, 160))} maxLength={160} rows={3} className="rounded-xl border border-[#d7dae5] px-4 py-3 text-base font-normal outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" /></label>
    {module.tags.length > 0 && <fieldset className="mt-5"><legend className="text-sm font-bold text-[#313950]">Choose your focus</legend><div className="mt-3 flex flex-wrap gap-2">{module.tags.map((item) => <button key={item} type="button" onClick={() => setTag(item)} aria-pressed={tag === item} className={`min-h-11 rounded-full border px-4 text-sm font-bold ${tag === item ? 'border-[#5146e5] bg-[#f0efff] text-[#5146e5]' : 'border-[#d7dae5] text-[#555d73]'}`}>{item}{tag === item && <Check className="ml-2 inline h-4 w-4" />}</button>)}</div></fieldset>}
    <fieldset className="mt-6"><legend className="flex items-center gap-2 text-sm font-bold text-[#313950]"><Palette className="h-4 w-4" /> Pick a team color</legend><div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-8">{TEAM_COLORS.map((item) => <button key={item.id} type="button" onClick={() => setColor(item.id)} aria-label={item.label} aria-pressed={color === item.id} className={`grid aspect-square place-items-center rounded-2xl border-2 transition ${color === item.id ? 'scale-105 border-[#101a38]' : 'border-transparent'}`}><span className="grid h-9 w-9 place-items-center rounded-full" style={{ background: item.value }}>{color === item.id && <Check className="h-5 w-5 text-white" />}</span></button>)}</div></fieldset>
    <button type="button" onClick={onSave} disabled={saving || Boolean(duplicate)} className="mt-7 flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#5146e5] px-5 font-bold text-white shadow-[0_5px_0_#342ba5] active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-45">{saving ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} Save team</button>
  </section>;
}
