'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Award, Check, EyeOff, Gauge, Save, ShieldCheck, Sparkles, Trophy, UsersRound } from 'lucide-react';
import Button from '@/components/ui/Button';
import SignalAvatarBadge from './SignalAvatarBadge';
import { getInstructorMomentumBoard, type InstructorMomentumBoard } from '@/lib/firebase/motivation';
import {
  DEFAULT_SIGNAL_AVATAR,
  SIGNAL_FACES,
  SIGNAL_FORMS,
  SIGNAL_ORBITS,
  SIGNAL_PALETTES,
  motivationConfig,
  type CourseMotivationConfig,
  type SignalAvatar,
} from '@/lib/gamification';

const SignalAvatar3D = dynamic(() => import('./SignalAvatar3D'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 animate-pulse bg-[#efedff]" aria-label="Loading Signal preview" />,
});

const LABELS = {
  form: { orb: 'Orb', pebble: 'Pebble', prism: 'Prism', bloom: 'Bloom' },
  face: { calm: 'Calm', bright: 'Bright', curious: 'Curious', focused: 'Focused' },
  orbit: { ring: 'Ring', satellites: 'Satellites', trail: 'Trail', none: 'None' },
} as const;

function Toggle({ checked, onChange, label, note }: { checked: boolean; onChange: (value: boolean) => void; label: string; note: string }) {
  return <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#e3e5ed] bg-white p-4"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 accent-[#5146e5]" /><span><strong className="block text-sm text-[#101a38]">{label}</strong><small className="mt-1 block leading-5 text-[#697087]">{note}</small></span></label>;
}

export default function MotivationStudio({ courseId, value, disabled = false, onSave }: { courseId: string; value?: Partial<CourseMotivationConfig>; disabled?: boolean; onSave: (value: CourseMotivationConfig) => Promise<void> }) {
  const [config, setConfig] = useState(() => motivationConfig(value));
  const [avatar, setAvatar] = useState<SignalAvatar>(DEFAULT_SIGNAL_AVATAR);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [board, setBoard] = useState<InstructorMomentumBoard | null>(null);
  const [boardLoading, setBoardLoading] = useState(true);
  const paletteNames = useMemo(() => Object.keys(SIGNAL_PALETTES) as SignalAvatar['palette'][], []);
  const update = <K extends keyof CourseMotivationConfig>(key: K, next: CourseMotivationConfig[K]) => { setConfig((current) => ({ ...current, [key]: next })); setSaved(false); setSaveError(false); };
  const save = async () => { setSaving(true); setSaveError(false); try { await onSave(config); setSaved(true); } catch { setSaveError(true); } finally { setSaving(false); } };

  useEffect(() => {
    let cancelled = false;
    setBoardLoading(true);
    getInstructorMomentumBoard(courseId)
      .then((next) => { if (!cancelled) setBoard(next); })
      .catch(() => { if (!cancelled) setBoard(null); })
      .finally(() => { if (!cancelled) setBoardLoading(false); });
    return () => { cancelled = true; };
  }, [courseId]);

  return (
    <fieldset disabled={disabled} className="m-0 grid min-w-0 items-start gap-7 border-0 p-0 xl:grid-cols-[minmax(0,1fr)_390px]">
      <div className="space-y-6">
        <section className="overflow-hidden rounded-3xl border border-[#e3e5ed] bg-white">
          <header className="border-b border-[#e3e5ed] bg-[#faf9ff] p-6 sm:p-8"><p className="seminar-eyebrow mb-2">Course momentum</p><h2 className="seminar-display text-3xl text-[#101a38] sm:text-4xl">Motivation that serves learning</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[#697087]">Choose what students can build over time and what may appear in front of the room. Personal progress stays private by default.</p></header>
          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7">
            <Toggle checked={config.pointsEnabled} onChange={(next) => update('pointsEnabled', next)} label="Meaningful participation points" note="Rewards answering, reflecting, asking, and contributing. Wellbeing answers and speed never earn points." />
            <Toggle checked={config.classRunsEnabled} onChange={(next) => update('classRunsEnabled', next)} label="Class runs" note="Recognizes returning for the next class. It is based on class meetings, not calendar days." />
            <Toggle checked={config.avatarsEnabled} onChange={(next) => update('avatarsEnabled', next)} label="Student Signals" note="Students design a course avatar and choose an alias. No parts are locked behind points." />
            <Toggle checked={config.enabled} onChange={(next) => update('enabled', next)} label="Course Momentum is on" note="Turn the whole layer off while keeping the underlying attendance and responses intact." />
          </div>
        </section>

        <section className="rounded-3xl border border-[#e3e5ed] bg-white p-5 sm:p-7">
          <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#f0efff] text-[#5146e5]"><Trophy className="h-5 w-5" /></span><div><p className="seminar-eyebrow mb-1">Standing and belonging</p><h2 className="seminar-display text-3xl text-[#101a38]">Choose the social layer</h2><p className="mt-2 text-sm leading-6 text-[#697087]">A private neighborhood gives students orientation without turning rank into the purpose of class.</p></div></div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-[#313950]">Individual standing<select value={config.individualBoard} onChange={(event) => update('individualBoard', event.target.value as CourseMotivationConfig['individualBoard'])} className="min-h-12 rounded-xl border border-[#d7dae5] bg-white px-3 font-normal"><option value="off">Off</option><option value="private-neighborhood">Private neighborhood</option><option value="public-aliases">Opted-in aliases may be public</option></select><small className="font-normal leading-5 text-[#697087]">Student numbers and bottom rankings are never shown.</small></label>
            <label className="grid gap-2 text-sm font-bold text-[#313950]">Team standing<select value={config.teamBoard} onChange={(event) => update('teamBoard', event.target.value as CourseMotivationConfig['teamBoard'])} className="min-h-12 rounded-xl border border-[#d7dae5] bg-white px-3 font-normal"><option value="off">Off</option><option value="private">Private to each team</option><option value="public">May appear on the projector</option></select><small className="font-normal leading-5 text-[#697087]">Team scores use average contribution so larger teams do not have an automatic advantage.</small></label>
          </div>
        </section>

        <section className="rounded-3xl border border-[#e3e5ed] bg-white p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4"><div><p className="seminar-eyebrow mb-1">Current course</p><h2 className="seminar-display text-3xl text-[#101a38]">Momentum board</h2><p className="mt-2 text-sm leading-6 text-[#697087]">Preview what is eligible to appear. Publishing to the projector remains a deliberate live-class action.</p></div><span className="rounded-full bg-[#f0efff] px-3 py-1.5 text-xs font-bold text-[#5146e5]">{board?.students.length || 0} records</span></div>
          {boardLoading ? <div className="mt-6 h-28 animate-pulse rounded-2xl bg-[#f3f2f7]" /> : board && (board.students.length || board.teams.length) ? <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <div><div className="mb-3 flex items-center justify-between"><strong className="text-sm text-[#101a38]">Opted-in aliases</strong><small className="text-xs text-[#697087]">{board.students.filter((student) => student.leaderboardOptIn).length} visible</small></div><div className="overflow-hidden rounded-2xl border border-[#e3e5ed]">{board.students.filter((student) => student.leaderboardOptIn).slice(0, 5).map((student, index) => <div key={student.id} className="flex min-h-16 items-center gap-3 border-b border-[#ececf1] px-4 last:border-0"><span className="w-5 text-center text-xs font-bold text-[#8a90a2]">{index + 1}</span><SignalAvatarBadge avatar={student.avatar} size={38} label={`${student.alias} Signal`} /><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-[#101a38]">{student.alias}</strong><small className="text-xs text-[#697087]">{student.sessionsParticipated} classes</small></span><strong className="text-sm text-[#5146e5]">{student.seminarPoints}</strong></div>)}{!board.students.some((student) => student.leaderboardOptIn) && <div className="p-5 text-sm leading-6 text-[#697087]">No student has opted into an alias board yet.</div>}</div></div>
            <div><div className="mb-3 flex items-center justify-between"><strong className="text-sm text-[#101a38]">Fair team momentum</strong><small className="text-xs text-[#697087]">Average per active member</small></div><div className="overflow-hidden rounded-2xl border border-[#e3e5ed]">{board.teams.slice(0, 5).map((team, index) => <div key={team.id} className="flex min-h-16 items-center gap-3 border-b border-[#ececf1] px-4 last:border-0"><span className="grid h-9 w-9 place-items-center rounded-xl text-xs font-black text-white" style={{ background: ({ violet: '#5146e5', blue: '#3276df', teal: '#2e9b72', green: '#3a8b50', gold: '#c88712', coral: '#df664e', pink: '#c94f83', navy: '#101a38' } as Record<string, string>)[team.color] || '#5146e5' }}>{index + 1}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-[#101a38]">{team.name}</strong><small className="text-xs text-[#697087]">{team.activeMembers} active {team.eligible ? '' : '· needs 2'}</small></span><strong className={team.eligible ? 'text-sm text-[#5146e5]' : 'text-sm text-[#a4a8b5]'}>{team.eligible ? team.score : 'Not ranked'}</strong></div>)}{!board.teams.length && <div className="p-5 text-sm leading-6 text-[#697087]">Create teams to compare normalized team momentum.</div>}</div></div>
          </div> : <div className="mt-6 rounded-2xl border border-dashed border-[#d7d8e2] bg-[#faf9ff] p-6 text-center"><UsersRound className="mx-auto h-6 w-6 text-[#5146e5]" /><strong className="mt-3 block text-sm text-[#101a38]">Momentum begins with the first response.</strong><p className="mt-2 text-xs leading-5 text-[#697087]">Student Signals and fair team standing will appear here as the course participates.</p></div>}
        </section>

        <section className="rounded-3xl border border-[#e3e5ed] bg-white p-5 sm:p-7">
          <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#eef8f2] text-[#2e8d63]"><Gauge className="h-5 w-5" /></span><div><p className="seminar-eyebrow mb-1">Classroom display</p><h2 className="seminar-display text-3xl text-[#101a38]">What the room celebrates</h2></div></div>
          <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_180px]">
            <label className="grid gap-2 text-sm font-bold text-[#313950]">Default projector moment<select value={config.projectorMode} onChange={(event) => update('projectorMode', event.target.value as CourseMotivationConfig['projectorMode'])} className="min-h-12 rounded-xl border border-[#d7dae5] bg-white px-3 font-normal"><option value="collective">Collective momentum</option><option value="teams" disabled={config.teamBoard !== 'public'}>Team lift</option><option value="individuals" disabled={config.individualBoard !== 'public-aliases'}>Opted-in aliases</option></select></label>
            <label className="grid gap-2 text-sm font-bold text-[#313950]">Shared response goal<input type="number" min={20} max={500} step={10} value={config.collectiveGoal} onChange={(event) => update('collectiveGoal', Math.min(500, Math.max(20, Number(event.target.value) || 100)))} className="min-h-12 rounded-xl border border-[#d7dae5] bg-white px-3 font-normal" /></label>
          </div>
          <div className="mt-5 flex items-start gap-3 rounded-2xl bg-[#f7f6ff] p-4 text-sm leading-6 text-[#555d73]"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#5146e5]" /><span><strong className="block text-[#101a38]">Safe by design</strong>The projector shows a shared goal unless you deliberately publish a team or alias moment. Students who do not opt in remain invisible.</span></div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3"><span role="status" className={`flex items-center gap-1.5 text-sm font-bold ${saveError ? 'text-[#b64936]' : 'text-[#2e8d63]'} transition-opacity ${saved || saveError ? 'opacity-100' : 'opacity-0'}`}>{saveError ? 'Could not save. Try again.' : <><Check className="h-4 w-4" /> Saved for this class</>}</span><Button onClick={save} loading={saving} className="gap-2"><Save className="h-4 w-4" /> Save Course Momentum</Button></div>
      </div>

      <aside className="space-y-5 xl:sticky xl:top-6">
        <section className="overflow-hidden rounded-3xl border border-[#dcd8ff] bg-[#fffefa] shadow-[0_18px_50px_rgba(16,26,56,0.08)]">
          <div className="relative min-h-[310px] overflow-hidden bg-[#f4f3ff]"><div className="absolute inset-x-0 top-5 text-center"><p className="seminar-eyebrow">Student Signal</p><strong className="mt-1 block text-sm text-[#101a38]">Quiet Comet</strong></div><SignalAvatar3D avatar={avatar} className="absolute inset-0 top-10" /><div className="absolute inset-x-0 bottom-4 text-center text-xs text-[#697087]">Move your pointer to meet your Signal</div></div>
          <div className="space-y-5 p-5">
            <div><span className="text-[11px] font-bold uppercase tracking-[.08em] text-[#697087]">Form</span><div className="mt-2 grid grid-cols-4 gap-2">{SIGNAL_FORMS.map((form) => <button key={form} type="button" onClick={() => setAvatar((current) => ({ ...current, form }))} aria-pressed={avatar.form === form} className={`seminar-focus min-h-10 rounded-xl border text-xs font-bold ${avatar.form === form ? 'border-[#5146e5] bg-[#f0efff] text-[#5146e5]' : 'border-[#e3e5ed] text-[#697087]'}`}>{LABELS.form[form]}</button>)}</div></div>
            <div><span className="text-[11px] font-bold uppercase tracking-[.08em] text-[#697087]">Color</span><div className="mt-2 flex flex-wrap gap-2">{paletteNames.map((palette) => <button key={palette} type="button" onClick={() => setAvatar((current) => ({ ...current, palette }))} aria-label={palette} aria-pressed={avatar.palette === palette} className={`seminar-focus grid h-10 w-10 place-items-center rounded-full border-2 ${avatar.palette === palette ? 'border-[#101a38]' : 'border-transparent'}`}><i className="h-7 w-7 rounded-full" style={{ background: SIGNAL_PALETTES[palette].primary }} /></button>)}</div></div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1"><label className="grid gap-2 text-xs font-bold text-[#697087]">Expression<select value={avatar.face} onChange={(event) => setAvatar((current) => ({ ...current, face: event.target.value as SignalAvatar['face'] }))} className="min-h-11 rounded-xl border border-[#d7dae5] bg-white px-3 text-sm font-normal text-[#101a38]">{SIGNAL_FACES.map((face) => <option key={face} value={face}>{LABELS.face[face]}</option>)}</select></label><label className="grid gap-2 text-xs font-bold text-[#697087]">Orbit<select value={avatar.orbit} onChange={(event) => setAvatar((current) => ({ ...current, orbit: event.target.value as SignalAvatar['orbit'] }))} className="min-h-11 rounded-xl border border-[#d7dae5] bg-white px-3 text-sm font-normal text-[#101a38]">{SIGNAL_ORBITS.map((orbit) => <option key={orbit} value={orbit}>{LABELS.orbit[orbit]}</option>)}</select></label></div>
          </div>
        </section>

        <section className="rounded-3xl border border-[#e3e5ed] bg-white p-5"><p className="seminar-eyebrow mb-2">Projector preview</p><div className="mt-4 rounded-2xl bg-[#101a38] p-5 text-white"><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[.08em] text-white/60">Room momentum</span><strong>72%</strong></div><div className="mt-4 flex items-end gap-2">{(['mint', 'ocean', 'violet', 'coral'] as const).map((palette, index) => <span key={palette} style={{ transform: `translateY(${Math.abs(1.5 - index) * 5}px)` }}><SignalAvatarBadge avatar={{ ...avatar, palette }} size={46} label="Sample student Signal" /></span>)}</div><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15"><i className="block h-full w-[72%] rounded-full bg-[#8f87ff]" /></div></div><div className="mt-4 flex gap-2 text-xs leading-5 text-[#697087]"><EyeOff className="mt-0.5 h-4 w-4 shrink-0" /> No names or low performers appear in collective mode.</div></section>

        <section className="rounded-3xl border border-[#e3e5ed] bg-white p-5"><div className="flex gap-3"><Award className="h-5 w-5 text-[#df664e]" /><div><strong className="block text-sm text-[#101a38]">Points are not prizes</strong><p className="mt-1 text-xs leading-5 text-[#697087]">They make useful course behaviors visible. Academic rewards still require instructor approval.</p></div></div><div className="mt-4 flex gap-3"><UsersRound className="h-5 w-5 text-[#5146e5]" /><div><strong className="block text-sm text-[#101a38]">Teams stay fair</strong><p className="mt-1 text-xs leading-5 text-[#697087]">Average contribution keeps team size from deciding the board.</p></div></div><div className="mt-4 flex gap-3"><Sparkles className="h-5 w-5 text-[#c88712]" /><div><strong className="block text-sm text-[#101a38]">Identity comes first</strong><p className="mt-1 text-xs leading-5 text-[#697087]">Every student can design a Signal from day one.</p></div></div></section>
      </aside>
    </fieldset>
  );
}
