'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/teacher/ProtectedRoute';
import DashboardLayout from '@/components/teacher/DashboardLayout';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import InlineMessage from '@/components/ui/InlineMessage';
import { AmbientLoading } from '@/components/motion';
import { useAuth } from '@/lib/hooks/useAuth';
import { getCoursesByTeacher } from '@/lib/firebase/firestore';
import {
  createRewardDefinition,
  deleteRewardDefinition,
  getRewardDefinitionsByTeacher,
  getRewardRequestsForInstructor,
  reviewRewardRequest,
  updateRewardDefinition,
} from '@/lib/firebase/rewards';
import type { Course, RewardDefinition, RewardKind, RewardRequest } from '@/types';
import { Archive, ArrowLeft, BookOpenCheck, CalendarClock, Check, CircleSlash2, Clock3, FilePenLine, Gift, MessageCircleMore, Pencil, Plus, ShieldCheck, Sparkles, Star, TicketCheck, Trash2, X, type LucideIcon } from 'lucide-react';

const rewardKinds: Array<{ value: RewardKind; label: string; example: string }> = [
  { value: 'pass', label: 'Pass', example: 'A deadline or participation pass' },
  { value: 'choice', label: 'Choice', example: 'Choose an example or discussion topic' },
  { value: 'recognition', label: 'Recognition', example: 'A course acknowledgement or privilege' },
  { value: 'extra-credit', label: 'Extra credit', example: 'A small, course-capped grade benefit' },
];

const emptyForm = {
  name: '',
  description: '',
  pointsRequired: 100,
  kind: 'pass' as RewardKind,
  limitPerStudent: 1,
};

type RewardForm = typeof emptyForm;

type RewardTemplate = {
  id: string;
  name: string;
  summary: string;
  icon: LucideIcon;
  form: RewardForm;
};

const rewardTemplates: RewardTemplate[] = [
  {
    id: 'deadline-pass',
    name: 'One-day deadline pass',
    summary: 'A practical, limited extension',
    icon: CalendarClock,
    form: {
      name: 'One-day deadline pass',
      description: 'Extend one eligible low-stakes assignment by 24 hours. Request it before the original deadline.',
      pointsRequired: 120,
      kind: 'pass',
      limitPerStudent: 1,
    },
  },
  {
    id: 'class-example',
    name: 'Choose a class example',
    summary: 'Give students a voice in the lesson',
    icon: BookOpenCheck,
    form: {
      name: 'Choose a class example',
      description: 'Choose one real-world example or case for the instructor to include in an upcoming class.',
      pointsRequired: 60,
      kind: 'choice',
      limitPerStudent: 1,
    },
  },
  {
    id: 'discussion-opener',
    name: 'Lead the discussion opener',
    summary: 'Turn participation into ownership',
    icon: MessageCircleMore,
    form: {
      name: 'Lead the discussion opener',
      description: 'Choose or introduce one instructor-approved question at the start of an upcoming discussion.',
      pointsRequired: 80,
      kind: 'recognition',
      limitPerStudent: 1,
    },
  },
  {
    id: 'revision-pass',
    name: 'Revision opportunity',
    summary: 'Reward learning from feedback',
    icon: FilePenLine,
    form: {
      name: 'Revision opportunity',
      description: 'Revise and resubmit one eligible low-stakes assignment within the instructor’s stated window.',
      pointsRequired: 160,
      kind: 'pass',
      limitPerStudent: 1,
    },
  },
  {
    id: 'extra-credit',
    name: 'Small extra-credit boost',
    summary: 'Use within your grading policy',
    icon: Star,
    form: {
      name: 'Small extra-credit boost',
      description: 'Add one percentage point to one eligible low-stakes assessment, subject to the course extra-credit cap.',
      pointsRequired: 250,
      kind: 'extra-credit',
      limitPerStudent: 1,
    },
  },
];

export default function RewardsPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [rewards, setRewards] = useState<RewardDefinition[]>([]);
  const [requests, setRequests] = useState<RewardRequest[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [view, setView] = useState<'menu' | 'requests'>('menu');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<RewardDefinition | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RewardDefinition | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const loadRewards = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [courseData, rewardData, requestData] = await Promise.all([
        getCoursesByTeacher(user.uid),
        getRewardDefinitionsByTeacher(user.uid),
        getRewardRequestsForInstructor(user.uid),
      ]);
      setCourses(courseData);
      setRewards(rewardData);
      setRequests(requestData);
      const requestedCourseId = new URLSearchParams(window.location.search).get('courseId');
      const requestedCourseExists = courseData.some((course) => course.id === requestedCourseId);
      setSelectedCourseId((current) => current || (requestedCourseExists ? requestedCourseId! : courseData[0]?.id || ''));
    } catch (loadError) {
      console.error('Could not load rewards:', loadError);
      setError('Rewards could not be loaded. Try refreshing the page.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadRewards(); }, [loadRewards]);

  const selectedCourse = courses.find((course) => course.id === selectedCourseId);
  const courseRewards = useMemo(() => rewards.filter((reward) => reward.courseId === selectedCourseId), [rewards, selectedCourseId]);
  const courseRequests = useMemo(() => requests.filter((request) => request.courseId === selectedCourseId), [requests, selectedCourseId]);
  const pendingCount = courseRequests.filter((request) => request.status === 'pending').length;

  const openCreate = () => {
    setEditingReward(null);
    setForm(emptyForm);
    setSelectedTemplateId(null);
    setFormOpen(true);
  };

  const startFromTemplate = (template: RewardTemplate) => {
    setSelectedTemplateId(template.id);
    setForm({ ...template.form });
  };

  const startCustomReward = () => {
    setSelectedTemplateId('custom');
    setForm({ ...emptyForm });
  };

  const openEdit = (reward: RewardDefinition) => {
    setEditingReward(reward);
    setSelectedTemplateId(null);
    setForm({
      name: reward.name,
      description: reward.description,
      pointsRequired: reward.pointsRequired,
      kind: reward.kind,
      limitPerStudent: reward.limitPerStudent || 1,
    });
    setFormOpen(true);
  };

  const saveReward = async () => {
    if (!selectedCourse || !form.name.trim() || !form.description.trim() || form.pointsRequired < 1) return;
    setSaving(true);
    setError('');
    try {
      if (editingReward) {
        await updateRewardDefinition(editingReward.id, {
          name: form.name.trim(),
          description: form.description.trim(),
          pointsRequired: form.pointsRequired,
          kind: form.kind,
          limitPerStudent: form.limitPerStudent,
        });
        setToast('Reward updated');
      } else {
        await createRewardDefinition({
          courseId: selectedCourse.id,
          courseCode: selectedCourse.code,
          name: form.name.trim(),
          description: form.description.trim(),
          pointsRequired: form.pointsRequired,
          kind: form.kind,
          limitPerStudent: form.limitPerStudent,
        });
        setToast('Reward added');
      }
      setFormOpen(false);
      await loadRewards();
    } catch (saveError) {
      console.error('Could not save reward:', saveError);
      setError('The reward could not be saved. Check the details and try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleReward = async (reward: RewardDefinition) => {
    await updateRewardDefinition(reward.id, { enabled: !reward.enabled });
    setRewards((current) => current.map((item) => item.id === reward.id ? { ...item, enabled: !item.enabled } : item));
    setToast(reward.enabled ? 'Reward hidden from students' : 'Reward available to students');
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteRewardDefinition(deleteTarget.id);
    setRewards((current) => current.filter((reward) => reward.id !== deleteTarget.id));
    setDeleteTarget(null);
    setToast('Reward removed');
  };

  const reviewRequest = async (request: RewardRequest, status: 'approved' | 'declined' | 'used') => {
    await reviewRewardRequest(request.id, status);
    setRequests((current) => current.map((item) => item.id === request.id ? { ...item, status } : item));
    setToast(status === 'approved' ? 'Reward approved' : status === 'used' ? 'Reward marked as used' : 'Request declined');
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <main className="mx-auto max-w-7xl p-5 sm:p-8 lg:p-10">
          {selectedCourse && <Link href={`/dashboard/classes/${selectedCourse.id}?view=kit`} className="seminar-focus mb-6 inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-[#697087] hover:text-[#101a38]"><ArrowLeft className="h-4 w-4" /> Back to {selectedCourse.code}</Link>}
          <header className="flex flex-col gap-5 border-b border-[#e3e5ed] pb-7 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl"><p className="seminar-eyebrow mb-3">Points and recognition</p><h1 className="seminar-display text-4xl text-[#101a38] sm:text-5xl">Rewards</h1><p className="mt-3 text-base leading-7 text-[#697087]">Set meaningful point milestones, then review student requests before anything is granted.</p></div>
            <Button onClick={openCreate} disabled={!selectedCourse} className="gap-2 self-start"><Plus className="h-4 w-4" /> Add reward</Button>
          </header>

          {error && <InlineMessage className="mt-5" title="Rewards are not ready yet." message={error} />}

          <div className="mt-7 flex flex-col gap-4 rounded-2xl border border-[#e3e5ed] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="grid gap-1.5 text-xs font-bold text-[#697087]">Class<select value={selectedCourseId} onChange={(event) => setSelectedCourseId(event.target.value)} className="min-h-11 min-w-64 rounded-xl border border-[#d7dae5] bg-white px-3 text-sm font-semibold text-[#101a38] outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]">{courses.map((course) => <option value={course.id} key={course.id}>{course.code} · {course.name}{course.term ? ` · ${course.term}` : ''}</option>)}</select></label>
            <div className="flex rounded-xl bg-[#f4f3f0] p-1" role="tablist" aria-label="Reward management views"><button type="button" role="tab" aria-selected={view === 'menu'} onClick={() => setView('menu')} className={`rounded-lg px-4 py-2 text-sm font-bold ${view === 'menu' ? 'bg-white text-[#101a38] shadow-sm' : 'text-[#697087]'}`}>Reward menu</button><button type="button" role="tab" aria-selected={view === 'requests'} onClick={() => setView('requests')} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold ${view === 'requests' ? 'bg-white text-[#101a38] shadow-sm' : 'text-[#697087]'}`}>Requests {pendingCount > 0 && <span className="rounded-full bg-[#5146e5] px-2 py-0.5 text-[11px] text-white">{pendingCount}</span>}</button></div>
          </div>

          {loading ? <div className="grid min-h-72 place-items-center" role="status" aria-label="Loading rewards"><AmbientLoading className="w-44 rounded-full" announce="off" /></div> : courses.length === 0 ? (
            <section className="mt-7 rounded-3xl border border-dashed border-[#cfd2df] bg-white px-6 py-14 text-center"><Archive className="mx-auto h-7 w-7 text-[#697087]" /><h2 className="seminar-display mt-4 text-3xl text-[#101a38]">Add a class first.</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#697087]">Rewards belong to a specific class so milestones and approvals stay in the right teaching context.</p></section>
          ) : view === 'menu' ? (
            <section className="mt-7" aria-labelledby="reward-menu-title">
              <div className="mb-5 flex items-end justify-between"><div><p className="seminar-eyebrow mb-2">Student-facing menu</p><h2 id="reward-menu-title" className="seminar-display text-3xl text-[#101a38]">{selectedCourse?.name}</h2></div><span className="text-sm font-semibold text-[#697087]">{courseRewards.filter((reward) => reward.enabled).length} available</span></div>
              {courseRewards.length === 0 ? <div className="rounded-3xl border border-dashed border-[#cfd2df] bg-white px-6 py-14 text-center"><Gift className="mx-auto h-8 w-8 text-[#5146e5]" /><h3 className="seminar-display mt-4 text-3xl text-[#101a38]">Create one reward students will value.</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#697087]">Start with a small privilege or choice that supports the class rather than changing a major grade outcome.</p><Button onClick={openCreate} className="mt-6 gap-2"><Plus className="h-4 w-4" /> Add first reward</Button></div> : <div className="grid gap-4 lg:grid-cols-2">{courseRewards.map((reward) => <article key={reward.id} className={`rounded-3xl border bg-white p-5 ${reward.enabled ? 'border-[#e3e5ed]' : 'border-[#dedbd2] opacity-65'}`}><div className="flex items-start gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#f0efff] text-[#5146e5]"><Gift className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#fff2ed] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[#a44534]">{reward.pointsRequired} points</span><span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#697087]">{rewardKinds.find((kind) => kind.value === reward.kind)?.label}</span></div><h3 className="mt-3 text-lg font-bold text-[#101a38]">{reward.name}</h3><p className="mt-1 text-sm leading-6 text-[#697087]">{reward.description}</p><p className="mt-3 text-xs text-[#697087]">Up to {reward.limitPerStudent || 1} per student</p></div></div><div className="mt-5 flex flex-col items-stretch gap-3 border-t border-[#e3e5ed] pt-4 sm:flex-row sm:items-center sm:justify-between"><button type="button" role="switch" aria-checked={reward.enabled} onClick={() => toggleReward(reward)} className="seminar-focus inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-bold text-[#555d73]"><span className={`relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors ${reward.enabled ? 'bg-[#5146e5]' : 'bg-[#cfd2dc]'}`}><i className={`absolute left-0 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${reward.enabled ? 'translate-x-6' : 'translate-x-1'}`} /></span><span>{reward.enabled ? 'Available to students' : 'Hidden from students'}</span></button><div className="flex justify-end gap-1"><button type="button" onClick={() => openEdit(reward)} className="seminar-focus grid min-h-11 min-w-11 place-items-center rounded-lg text-[#697087] hover:bg-[#f7f6ff] hover:text-[#5146e5]" aria-label={`Edit ${reward.name}`}><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => setDeleteTarget(reward)} className="seminar-focus grid min-h-11 min-w-11 place-items-center rounded-lg text-[#697087] hover:bg-[#fff1ee] hover:text-[#b64936]" aria-label={`Delete ${reward.name}`}><Trash2 className="h-4 w-4" /></button></div></div></article>)}</div>}
            </section>
          ) : (
            <section className="mt-7" aria-labelledby="reward-requests-title">
              <div className="mb-5"><p className="seminar-eyebrow mb-2">Approval queue</p><h2 id="reward-requests-title" className="seminar-display text-3xl text-[#101a38]">Student requests</h2><p className="mt-2 text-sm leading-6 text-[#697087]">Points are never removed. Approval confirms that the student may use the unlocked reward.</p></div>
              {courseRequests.length === 0 ? <div className="rounded-3xl border border-dashed border-[#cfd2df] bg-white px-6 py-14 text-center"><TicketCheck className="mx-auto h-8 w-8 text-[#5146e5]" /><h3 className="seminar-display mt-4 text-3xl text-[#101a38]">No requests yet.</h3><p className="mt-2 text-sm text-[#697087]">Student requests will appear here with their point total at the time of request.</p></div> : <div className="space-y-3">{courseRequests.map((request) => { const eligible = request.pointsAtRequest >= request.pointsRequired; return <article key={request.id} className="flex flex-col gap-4 rounded-2xl border border-[#e3e5ed] bg-white p-5 lg:flex-row lg:items-center"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${request.status === 'approved' || request.status === 'used' ? 'bg-[#edf8ef] text-[#2f7b47]' : request.status === 'declined' ? 'bg-[#f2f2f4] text-[#697087]' : 'bg-[#fff7e7] text-[#a56d12]'}`}>{request.status === 'approved' || request.status === 'used' ? <Check className="h-5 w-5" /> : request.status === 'declined' ? <CircleSlash2 className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-[#101a38]">{request.rewardName}</strong><span className="rounded-full bg-[#f1f2f6] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.05em] text-[#5e667a]">{request.status}</span></div><p className="mt-1 text-sm text-[#697087]">{request.studentDisplayName || `Student ${request.studentNumber.slice(-4)}`} · ID {request.studentNumber} · {request.pointsAtRequest} points at request · {request.pointsRequired} required</p>{!eligible && <p className="mt-1 text-xs font-semibold text-[#b64936]">Point threshold needs instructor review.</p>}</div><div className="flex shrink-0 flex-wrap gap-2">{request.status === 'pending' && <><Button size="sm" variant="outline" onClick={() => reviewRequest(request, 'declined')}>Decline</Button><Button size="sm" onClick={() => reviewRequest(request, 'approved')} disabled={!eligible}>Approve</Button></>}{request.status === 'approved' && <Button size="sm" variant="outline" onClick={() => reviewRequest(request, 'used')}><TicketCheck className="mr-2 h-4 w-4" /> Mark used</Button>}</div></article>; })}</div>}
            </section>
          )}

          {formOpen && (
            <div className="fixed inset-0 z-[80] grid place-items-center bg-[#101a38]/55 p-4" role="presentation">
              <section className="max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-[0_28px_80px_rgba(16,26,56,0.25)] sm:p-8" role="dialog" aria-modal="true" aria-labelledby="reward-form-title">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="seminar-eyebrow mb-2">{editingReward ? 'Edit reward' : 'New reward'}</p>
                    <h2 id="reward-form-title" className="seminar-display text-3xl text-[#101a38]">{editingReward ? 'Update this reward.' : 'Start with an idea, then make it yours.'}</h2>
                  </div>
                  <button type="button" onClick={() => setFormOpen(false)} disabled={saving} className="seminar-focus rounded-lg p-2 text-[#697087] hover:bg-[#f8f7fb]" aria-label="Close"><X className="h-5 w-5" /></button>
                </div>

                {!editingReward && (
                  <div className="mt-6">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                      <div><strong className="text-sm text-[#101a38]">Choose a starting point</strong><p className="mt-1 text-xs leading-5 text-[#697087]">Every detail can be changed before students see it.</p></div>
                      <span className="mt-2 text-xs font-semibold text-[#697087] sm:mt-0">Suggested points fit several sessions of participation.</span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="group" aria-label="Reward templates">
                      {rewardTemplates.map((template) => {
                        const TemplateIcon = template.icon;
                        const selected = selectedTemplateId === template.id;
                        return (
                          <button
                            key={template.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => startFromTemplate(template)}
                            className={`seminar-focus group flex min-h-24 items-start gap-3 rounded-2xl border p-3 text-left transition-[border-color,background-color,transform,box-shadow] duration-200 active:scale-[0.98] ${selected ? 'border-[#5146e5] bg-[#f4f2ff] shadow-[0_8px_22px_rgba(81,70,229,0.12)]' : 'border-[#e1e3eb] bg-white hover:border-[#bcb7f3] hover:bg-[#faf9ff]'}`}
                          >
                            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${selected ? 'bg-[#5146e5] text-white' : 'bg-[#f0efff] text-[#5146e5]'}`}><TemplateIcon className="h-4 w-4" /></span>
                            <span className="min-w-0"><strong className="block text-sm leading-5 text-[#101a38]">{template.name}</strong><small className="mt-1 block text-[11px] leading-4 text-[#697087]">{template.summary}</small><b className="mt-2 block text-[10px] uppercase tracking-[0.06em] text-[#5146e5]">{template.form.pointsRequired} points</b></span>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        aria-pressed={selectedTemplateId === 'custom'}
                        onClick={startCustomReward}
                        className={`seminar-focus flex min-h-24 items-start gap-3 rounded-2xl border p-3 text-left transition-[border-color,background-color,transform,box-shadow] duration-200 active:scale-[0.98] ${selectedTemplateId === 'custom' ? 'border-[#5146e5] bg-[#f4f2ff] shadow-[0_8px_22px_rgba(81,70,229,0.12)]' : 'border-dashed border-[#cfd2df] bg-[#fbfbfc] hover:border-[#8d85ed] hover:bg-[#faf9ff]'}`}
                      >
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${selectedTemplateId === 'custom' ? 'bg-[#5146e5] text-white' : 'bg-white text-[#5146e5]'}`}><Plus className="h-4 w-4" /></span>
                        <span><strong className="block text-sm leading-5 text-[#101a38]">Create your own</strong><small className="mt-1 block text-[11px] leading-4 text-[#697087]">Begin with a blank reward.</small></span>
                      </button>
                    </div>
                  </div>
                )}

                <div className={`${editingReward ? 'mt-6' : 'mt-7 border-t border-[#e3e5ed] pt-6'} grid gap-4 sm:grid-cols-2`}>
                  <label className="sm:col-span-2 grid gap-1.5 text-xs font-bold text-[#697087]">Reward name<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="One-day deadline pass" className="min-h-11 rounded-xl border border-[#d7dae5] px-3 text-sm text-[#101a38] outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" /></label>
                  <label className="sm:col-span-2 grid gap-1.5 text-xs font-bold text-[#697087]">What it gives the student<textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={3} placeholder="Valid on one eligible low-stakes assignment." className="resize-none rounded-xl border border-[#d7dae5] px-3 py-3 text-sm leading-6 text-[#101a38] outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" /></label>
                  <label className="grid gap-1.5 text-xs font-bold text-[#697087]">Points needed<input type="number" min={1} step={5} value={form.pointsRequired} onChange={(event) => setForm((current) => ({ ...current, pointsRequired: Number(event.target.value) }))} className="min-h-11 rounded-xl border border-[#d7dae5] px-3 text-sm text-[#101a38] outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" /></label>
                  <label className="grid gap-1.5 text-xs font-bold text-[#697087]">Limit per student<input type="number" min={1} max={20} value={form.limitPerStudent} onChange={(event) => setForm((current) => ({ ...current, limitPerStudent: Number(event.target.value) }))} className="min-h-11 rounded-xl border border-[#d7dae5] px-3 text-sm text-[#101a38] outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]" /></label>
                  <label className="sm:col-span-2 grid gap-1.5 text-xs font-bold text-[#697087]">Reward type<select value={form.kind} onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value as RewardKind }))} className="min-h-11 rounded-xl border border-[#d7dae5] bg-white px-3 text-sm text-[#101a38] outline-none focus:border-[#5146e5] focus:ring-2 focus:ring-[#dcd8ff]">{rewardKinds.map((kind) => <option value={kind.value} key={kind.value}>{kind.label} · {kind.example}</option>)}</select></label>
                </div>
                <div className="mt-5 flex gap-3 rounded-xl bg-[#f7f6ff] p-4 text-sm leading-6 text-[#555d73]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#5146e5]" /><span>Points stay in the student’s record. Reaching this threshold lets them request the reward for your approval.</span></div>
                <div className="mt-7 flex justify-end gap-3"><Button variant="ghost" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button><Button onClick={saveReward} loading={saving} disabled={!form.name.trim() || !form.description.trim() || form.pointsRequired < 1} className="gap-2"><Sparkles className="h-4 w-4" /> {editingReward ? 'Save reward' : 'Add reward'}</Button></div>
              </section>
            </div>
          )}

          <Dialog isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} title="Remove this reward?" message="Students will no longer see it. Existing approved requests remain in the class record." confirmText="Remove reward" variant="destructive" />
          {toast && <div className="fixed bottom-5 right-5 z-[90] rounded-xl bg-[#101a38] px-4 py-3 text-sm font-semibold text-white shadow-xl" role="status">{toast}</div>}
        </main>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
