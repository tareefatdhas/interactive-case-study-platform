'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { getCoursesByTeacher, getSessionsByTeacher } from '@/lib/firebase/firestore';
import {
  getInstructorClassroomRecords,
  type InstructorClassroomRecords,
  type StoredLiveResponse,
  type StoredStudentQuestion,
} from '@/lib/firebase/live-classroom';
import { selectDefaultProgressCourseId } from '@/lib/student-progress-metrics';
import ProtectedRoute from '@/components/teacher/ProtectedRoute';
import DashboardLayout from '@/components/teacher/DashboardLayout';
import Button from '@/components/ui/Button';
import InlineMessage from '@/components/ui/InlineMessage';
import { AmbientLoading } from '@/components/motion';
import type { Course, Session, SessionInteraction } from '@/types';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  HeartPulse,
  MessageCircleQuestion,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';

type SessionReview = {
  session: Session;
  attendance: number;
  respondents: number;
  participation: number | null;
  playedActivities: ActivityReview[];
  plannedButUnused: number;
  questions: QuestionReview[];
  openQuestions: number;
  pulseConcernCount: number;
  pulseResponseCount: number;
  quizAnswered: number;
  quizCorrect: number;
  quizAccuracy: number | null;
  caseModules: SessionInteraction[];
};

type ActivityReview = {
  id: string;
  interaction: SessionInteraction;
  responses: StoredLiveResponse[];
  reach: number | null;
  result: string;
};

type QuestionReview = StoredStudentQuestion & {
  votes: number;
  status: 'discussed' | 'dismissed' | 'open';
};

const EMPTY_RECORDS: InstructorClassroomRecords = {
  attendance: {},
  responses: {},
  studentQuestions: {},
  questionVotes: {},
  dismissedQuestions: {},
  recognizedQuestions: {},
};

const RESPONSE_ACTIVITY_TYPES = new Set<SessionInteraction['type']>([
  'pulse',
  'poll',
  'quiz',
  'open-response',
  'word-cloud',
  'peer-learning',
  'team-formation',
  'reflection',
  'case-study',
]);

const CONCERN_PULSE_PATTERN = /overwhelm|tired|confus|lost|struggl|not ready|need\s+(a\s+)?(pause|help|time)|too fast|anxious|stress|unprepared|low confidence/i;

const activityLabel: Record<SessionInteraction['type'], string> = {
  pulse: 'Pulse check',
  poll: 'Poll',
  quiz: 'Knowledge check',
  'open-response': 'Open response',
  'word-cloud': 'Word cloud',
  'peer-learning': 'Peer learning',
  'team-formation': 'Team formation',
  'group-work': 'Group work',
  timer: 'Timer',
  'spin-wheel': 'Spin the wheel',
  reflection: 'Reflection',
  'case-study': 'Case study',
};

function sessionTime(session: Session) {
  return session.startedAt?.toMillis?.()
    || session.endedAt?.toMillis?.()
    || session.createdAt?.toMillis?.()
    || 0;
}

function isHeldSession(session: Session) {
  return Boolean(session.active || session.startedAt || session.endedAt || (session.studentsJoined?.length || 0) > 0);
}

function sessionTitle(session: Session) {
  return session.title || session.caseStudyTitle || 'Class session';
}

function formatSessionDate(session: Session) {
  const date = session.startedAt?.toDate?.() || session.endedAt?.toDate?.() || session.createdAt?.toDate?.();
  if (!date) return 'Date not recorded';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function flattenResponses(record: InstructorClassroomRecords) {
  return Object.values(record.responses).flatMap((responses) => Object.values(responses || {}));
}

function buildActivityResult(interaction: SessionInteraction, responses: StoredLiveResponse[]) {
  if (!responses.length) return 'No responses recorded';
  if (interaction.type === 'quiz' && typeof interaction.correctOptionIndex === 'number') {
    const correct = responses.filter((response) => response.optionIndex === interaction.correctOptionIndex).length;
    return `${Math.round((correct / responses.length) * 100)}% correct`;
  }
  if (interaction.type === 'pulse') {
    const concerns = responses.filter((response) => {
      if (typeof response.optionIndex !== 'number') return false;
      return CONCERN_PULSE_PATTERN.test(interaction.options?.[response.optionIndex] || '');
    }).length;
    return concerns ? `${concerns} may need a check-in` : 'No follow-up signal';
  }
  if ((interaction.type === 'poll' || interaction.type === 'peer-learning') && interaction.options?.length) {
    const counts = interaction.options.map((_, optionIndex) => responses.filter((response) => response.optionIndex === optionIndex).length);
    const leadingIndex = counts.indexOf(Math.max(...counts));
    return `${interaction.options[leadingIndex]} led with ${counts[leadingIndex]}`;
  }
  if (interaction.type === 'word-cloud' || interaction.type === 'open-response' || interaction.type === 'reflection') {
    return `${responses.filter((response) => response.text?.trim()).length} written responses`;
  }
  return `${responses.length} responses`;
}

function buildSessionReview(session: Session, record: InstructorClassroomRecords): SessionReview {
  const interactions = session.interactions || [];
  const interactionsById = new Map(interactions.map((interaction) => [interaction.id, interaction]));
  const runsById = new Map((session.interactionRuns || []).map((run) => [run.id, run]));
  const playedRunIds = new Set<string>();

  Object.entries(record.responses).forEach(([runId, responses]) => {
    if (Object.keys(responses || {}).length) playedRunIds.add(runId);
  });
  (session.interactionRuns || []).forEach((run) => {
    const interaction = interactionsById.get(run.interactionId);
    if (interaction && RESPONSE_ACTIVITY_TYPES.has(interaction.type) && run.responseCount > 0) playedRunIds.add(run.id);
  });

  const playedActivities = Array.from(playedRunIds).flatMap((runId): ActivityReview[] => {
    const responses = Object.values(record.responses[runId] || {});
    const run = runsById.get(runId);
    const interactionId = run?.interactionId || responses[0]?.interactionId;
    const interaction = interactionId ? interactionsById.get(interactionId) : undefined;
    if (!interaction || !RESPONSE_ACTIVITY_TYPES.has(interaction.type)) return [];
    const attendance = Math.max(Object.keys(record.attendance).length, session.studentsJoined?.length || 0);
    return [{
      id: runId,
      interaction,
      responses,
      reach: attendance ? Math.min(100, Math.round((responses.length / attendance) * 100)) : null,
      result: buildActivityResult(interaction, responses),
    }];
  }).sort((a, b) => {
    const aRun = runsById.get(a.id);
    const bRun = runsById.get(b.id);
    return (aRun?.startedAt || 0) - (bRun?.startedAt || 0);
  });

  const allResponses = flattenResponses(record);
  const attendance = Math.max(Object.keys(record.attendance).length, session.studentsJoined?.length || 0);
  const respondentIds = new Set(allResponses.map((response) => response.studentUid));
  const pulseResponses = allResponses.filter((response) => interactionsById.get(response.interactionId)?.type === 'pulse');
  const pulseConcernCount = pulseResponses.filter((response) => {
    const interaction = interactionsById.get(response.interactionId);
    return typeof response.optionIndex === 'number' && CONCERN_PULSE_PATTERN.test(interaction?.options?.[response.optionIndex] || '');
  }).length;
  const quizResponses = allResponses.filter((response) => interactionsById.get(response.interactionId)?.type === 'quiz');
  const quizCorrect = quizResponses.filter((response) => {
    const interaction = interactionsById.get(response.interactionId);
    return typeof interaction?.correctOptionIndex === 'number' && response.optionIndex === interaction.correctOptionIndex;
  }).length;
  const questions = Object.values(record.studentQuestions).flatMap((studentQuestions) => Object.values(studentQuestions || {})).map((question) => ({
    ...question,
    votes: Object.values(record.questionVotes[String(question.id)] || {}).filter(Boolean).length,
    status: record.recognizedQuestions[String(question.id)]
      ? 'discussed' as const
      : record.dismissedQuestions[String(question.id)]
        ? 'dismissed' as const
        : 'open' as const,
  })).sort((a, b) => b.votes - a.votes || b.submittedAt - a.submittedAt);
  const playedInteractionIds = new Set(playedActivities.map((activity) => activity.interaction.id));
  (session.interactionRuns || []).forEach((run) => {
    if (run.startedAt > 0) playedInteractionIds.add(run.interactionId);
  });
  const plannedResponseActivities = interactions.filter((interaction) => RESPONSE_ACTIVITY_TYPES.has(interaction.type));
  const caseModules = interactions.filter((interaction) => interaction.type === 'case-study' && (session.interactionRuns || []).some((run) => run.interactionId === interaction.id && run.startedAt > 0));

  return {
    session,
    attendance,
    respondents: respondentIds.size,
    participation: attendance ? Math.min(100, Math.round((respondentIds.size / attendance) * 100)) : null,
    playedActivities,
    plannedButUnused: plannedResponseActivities.filter((interaction) => !playedInteractionIds.has(interaction.id)).length,
    questions,
    openQuestions: questions.filter((question) => question.status === 'open').length,
    pulseConcernCount,
    pulseResponseCount: pulseResponses.length,
    quizAnswered: quizResponses.length,
    quizCorrect,
    quizAccuracy: quizResponses.length ? Math.round((quizCorrect / quizResponses.length) * 100) : null,
    caseModules,
  };
}

function ReviewContent() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [records, setRecords] = useState<Record<string, InstructorClassroomRecords>>({});
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const loadReview = async () => {
      try {
        const [courseData, sessionData] = await Promise.all([
          getCoursesByTeacher(user.uid),
          getSessionsByTeacher(user.uid),
        ]);
        const held = sessionData.filter(isHeldSession);
        const recordPairs = await Promise.all(held.map(async (session) => {
          try {
            return [session.id, await getInstructorClassroomRecords(user.uid, session.id, { includeDiscussion: true })] as const;
          } catch (recordError) {
            console.warn(`Review data could not be loaded for session ${session.id}:`, recordError);
            return [session.id, EMPTY_RECORDS] as const;
          }
        }));
        const activeCourses = courseData.filter((course) => !course.archived);
        setCourses(activeCourses);
        setSessions(sessionData);
        setRecords(Object.fromEntries(recordPairs));
        setSelectedCourseId(selectDefaultProgressCourseId(activeCourses, sessionData));
      } catch (loadError) {
        console.error('Review could not be loaded:', loadError);
        setError('Review could not be loaded. Refresh the page and try again.');
      } finally {
        setLoading(false);
      }
    };
    loadReview();
  }, [user]);

  const selectedCourse = courses.find((course) => course.id === selectedCourseId);
  const relevantSessions = useMemo(() => sessions.filter((session) => (
    selectedCourseId === 'all'
      ? true
      : session.courseId === selectedCourseId || (!session.courseId && session.courseCode === selectedCourse?.code)
  )).filter(isHeldSession).sort((a, b) => sessionTime(b) - sessionTime(a)), [selectedCourse?.code, selectedCourseId, sessions]);

  useEffect(() => {
    if (!relevantSessions.some((session) => session.id === selectedSessionId)) {
      setSelectedSessionId(relevantSessions[0]?.id || '');
    }
  }, [relevantSessions, selectedSessionId]);

  const sessionReviews = useMemo(() => relevantSessions.map((session) => buildSessionReview(session, records[session.id] || EMPTY_RECORDS)), [records, relevantSessions]);
  const selectedReview = sessionReviews.find((review) => review.session.id === selectedSessionId) || sessionReviews[0];
  const averageAttendance = sessionReviews.length ? Math.round(sessionReviews.reduce((sum, review) => sum + review.attendance, 0) / sessionReviews.length) : 0;
  const participationValues = sessionReviews.map((review) => review.participation).filter((value): value is number => value !== null);
  const averageParticipation = participationValues.length ? Math.round(participationValues.reduce((sum, value) => sum + value, 0) / participationValues.length) : null;
  const totalOpenQuestions = sessionReviews.reduce((sum, review) => sum + review.openQuestions, 0);

  const nextSteps = useMemo(() => {
    if (!selectedReview) return [];
    const steps: Array<{ title: string; detail: string; icon: typeof Target; tone: string }> = [];
    if (selectedReview.pulseConcernCount > 0) steps.push({ title: 'Check in on the pulse', detail: `${selectedReview.pulseConcernCount} ${selectedReview.pulseConcernCount === 1 ? 'response may' : 'responses may'} need follow-up.`, icon: HeartPulse, tone: '#df664e' });
    if (selectedReview.quizAccuracy !== null && selectedReview.quizAccuracy < 70) {
      const quiz = selectedReview.playedActivities.find((activity) => activity.interaction.type === 'quiz');
      steps.push({ title: `Revisit ${quiz?.interaction.title || 'the knowledge check'}`, detail: `${selectedReview.quizAccuracy}% of answers were correct.`, icon: Target, tone: '#b67a00' });
    }
    if (selectedReview.openQuestions > 0) steps.push({ title: 'Return to an open question', detail: `${selectedReview.openQuestions} ${selectedReview.openQuestions === 1 ? 'question is' : 'questions are'} still open.`, icon: MessageCircleQuestion, tone: '#5146e5' });
    if (selectedReview.participation !== null && selectedReview.participation < 60) steps.push({ title: 'Start with a low-friction check-in', detail: `${selectedReview.participation}% of attending students responded.`, icon: Users, tone: '#2f73df' });
    if (!steps.length) steps.push({ title: 'Carry this rhythm forward', detail: 'No immediate follow-up signal stands out in this session.', icon: CheckCircle2, tone: '#32864a' });
    return steps.slice(0, 3);
  }, [selectedReview]);

  const selectCourse = (courseId: string) => {
    setSelectedCourseId(courseId);
    setSelectedSessionId('');
  };

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <main className="mx-auto max-w-[1600px] p-5 sm:p-8 lg:p-10">
          <header className="max-w-3xl">
            <p className="seminar-eyebrow mb-3">Review</p>
            <h1 className="seminar-display text-4xl text-[#101a38] sm:text-5xl">See what happened. Decide what comes next.</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[#697087]">Review attendance, played activities, questions, and class signals from each session. Planned activities that stayed unused are left out.</p>
          </header>

          {error && <InlineMessage className="mt-6" title="Review is taking a moment." message={error} />}
          {loading ? <div className="grid min-h-96 place-items-center" role="status" aria-label="Loading class review"><AmbientLoading className="w-44 rounded-full" announce="off" /></div> : courses.length === 0 ? (
            <section className="mt-8 rounded-3xl border border-[#e1e3ec] bg-white p-10 text-center">
              <BookOpen className="mx-auto h-9 w-9 text-[#9298a8]" />
              <h2 className="seminar-display mt-4 text-3xl text-[#101a38]">Your first review starts after class.</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#697087]">Create a class and run one live activity. Attendance, responses, and questions will appear here.</p>
              <Link href="/dashboard/classes"><Button className="mt-5">Open classes</Button></Link>
            </section>
          ) : (
            <>
              <section className="mt-8 rounded-3xl border border-[#e1e3ec] bg-white p-3 shadow-[0_18px_50px_rgba(16,26,56,0.05)]" aria-labelledby="review-class-heading">
                <div className="flex items-center justify-between gap-3 px-3 pb-3 pt-2">
                  <div><p className="seminar-eyebrow" id="review-class-heading">Choose a class</p><p className="mt-1 text-sm text-[#697087]">Review opens on your most recently taught class.</p></div>
                  {selectedCourse && <Link href={`/dashboard/classes/${selectedCourse.id}`} className="seminar-focus hidden items-center gap-1 rounded-lg text-sm font-bold text-[#5146e5] sm:inline-flex">Open class <ChevronRight className="h-4 w-4" /></Link>}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1" role="list" aria-label="Classes">
                  <button type="button" onClick={() => selectCourse('all')} aria-pressed={selectedCourseId === 'all'} className={`min-w-[178px] rounded-2xl border px-4 py-3 text-left transition ${selectedCourseId === 'all' ? 'border-[#5146e5] bg-[#f0efff] shadow-[inset_0_0_0_1px_#5146e5]' : 'border-[#e3e5ed] bg-[#fffefa] hover:border-[#b9b5ec]'}`}><span className="block text-xs font-bold uppercase tracking-[0.08em] text-[#5146e5]">All classes</span><strong className="mt-1 block text-sm text-[#101a38]">Teaching overview</strong><span className="mt-1 block text-xs text-[#697087]">{courses.length} active {courses.length === 1 ? 'class' : 'classes'}</span></button>
                  {courses.map((course) => {
                    const courseSessions = sessions.filter((session) => (session.courseId === course.id || (!session.courseId && session.courseCode === course.code)) && isHeldSession(session));
                    const selected = selectedCourseId === course.id;
                    return <button key={course.id} type="button" onClick={() => selectCourse(course.id)} aria-pressed={selected} className={`min-w-[250px] rounded-2xl border px-4 py-3 text-left transition ${selected ? 'border-[#5146e5] bg-[#f0efff] shadow-[inset_0_0_0_1px_#5146e5]' : 'border-[#e3e5ed] bg-[#fffefa] hover:border-[#b9b5ec]'}`}><span className="block text-xs font-bold uppercase tracking-[0.08em] text-[#5146e5]">{course.code}</span><strong className="mt-1 block truncate text-sm text-[#101a38]">{course.name}</strong><span className="mt-1 block text-xs text-[#697087]">{course.term || 'Current term'} · {courseSessions.length} {courseSessions.length === 1 ? 'session' : 'sessions'}</span></button>;
                  })}
                </div>
              </section>

              <section className="mt-6 grid gap-px overflow-hidden rounded-3xl border border-[#e1e3ec] bg-[#e1e3ec] sm:grid-cols-2 xl:grid-cols-4" aria-label="Class review summary">
                {[
                  [CalendarCheck, sessionReviews.length, 'Sessions held', 'Only started sessions', '#f0efff', '#5146e5'],
                  [Users, averageAttendance, 'Students per session', 'Average attendance', '#edf8f0', '#32864a'],
                  [BarChart3, averageParticipation === null ? '—' : `${averageParticipation}%`, 'Participation', 'Attendees who responded', '#eef6ff', '#2f73df'],
                  [MessageCircleQuestion, totalOpenQuestions, 'Open questions', 'Still waiting for discussion', '#fff6d9', '#aa7200'],
                ].map(([Icon, value, label, detail, background, color]) => {
                  const StatIcon = Icon as typeof Users;
                  return <article key={String(label)} className="flex items-center gap-4 bg-white p-5"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: String(background), color: String(color) }}><StatIcon className="h-5 w-5" /></span><div><strong className="block text-2xl text-[#101a38]">{String(value)}</strong><span className="block text-sm font-bold text-[#313950]">{String(label)}</span><p className="mt-0.5 text-xs text-[#697087]">{String(detail)}</p></div></article>;
                })}
              </section>

              {sessionReviews.length === 0 ? (
                <section className="mt-6 rounded-3xl border border-[#e1e3ec] bg-white px-6 py-14 text-center">
                  <Clock3 className="mx-auto h-9 w-9 text-[#9298a8]" />
                  <h2 className="seminar-display mt-4 text-3xl text-[#101a38]">No class sessions to review yet.</h2>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#697087]">Prepared sessions appear here after they have started. Nothing planned is treated as completed.</p>
                </section>
              ) : (
                <>
                  <section className="mt-6" aria-labelledby="session-history-heading">
                    <div className="flex items-end justify-between gap-4"><div><p className="seminar-eyebrow">Session history</p><h2 id="session-history-heading" className="seminar-display mt-2 text-3xl text-[#101a38]">Choose a session to review.</h2></div><span className="hidden text-sm text-[#697087] sm:block">Newest first</span></div>
                    <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                      {sessionReviews.map((review) => {
                        const selected = review.session.id === selectedReview?.session.id;
                        return <button key={review.session.id} type="button" onClick={() => setSelectedSessionId(review.session.id)} aria-pressed={selected} className={`min-w-[275px] rounded-2xl border p-4 text-left transition ${selected ? 'border-[#5146e5] bg-[#101a38] text-white shadow-[0_12px_30px_rgba(16,26,56,.18)]' : 'border-[#e1e3ec] bg-white text-[#101a38] hover:border-[#aaa5e5]'}`}><span className={`text-[10px] font-bold uppercase tracking-[0.1em] ${selected ? 'text-[#b8b3ff]' : 'text-[#5146e5]'}`}>{formatSessionDate(review.session)}</span><strong className="seminar-display mt-2 block truncate text-xl">{sessionTitle(review.session)}</strong><span className={`mt-3 flex gap-3 text-xs ${selected ? 'text-[#d5d8e4]' : 'text-[#697087]'}`}><span>{review.attendance} attended</span><span>{review.playedActivities.length} played</span><span>{review.openQuestions} open</span></span></button>;
                      })}
                    </div>
                  </section>

                  {selectedReview && <SessionReviewPanel review={selectedReview} nextSteps={nextSteps} />}
                </>
              )}
            </>
          )}
        </main>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function SessionReviewPanel({ review, nextSteps }: { review: SessionReview; nextSteps: Array<{ title: string; detail: string; icon: typeof Target; tone: string }> }) {
  return (
    <section className="mt-5 overflow-hidden rounded-3xl border border-[#e1e3ec] bg-white shadow-[0_20px_60px_rgba(16,26,56,0.06)]" aria-labelledby="selected-session-heading">
      <div className="border-b border-[#e3e5ed] p-5 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${review.session.active ? 'bg-[#edf8f0] text-[#26743c]' : 'bg-[#f0efff] text-[#5146e5]'}`}>{review.session.active ? 'Live now' : 'Session review'}</span><span className="text-xs text-[#697087]">{formatSessionDate(review.session)}</span></div><h2 id="selected-session-heading" className="seminar-display mt-3 text-3xl text-[#101a38] sm:text-4xl">{sessionTitle(review.session)}</h2><p className="mt-2 text-sm text-[#697087]">{review.session.courseCode || 'Class'} · {review.session.sessionCode}</p></div>
          <Link href={`/dashboard/sessions/${review.session.id}`}><Button variant="outline" className="gap-2">Open session <ArrowRight className="h-4 w-4" /></Button></Link>
        </div>
        {review.plannedButUnused > 0 && <p className="mt-5 rounded-xl bg-[#f8f7fb] px-4 py-3 text-sm text-[#697087]">{review.plannedButUnused} planned {review.plannedButUnused === 1 ? 'activity was' : 'activities were'} not played and are not included in this review.</p>}
      </div>

      <div className="grid gap-px bg-[#e3e5ed] sm:grid-cols-2 xl:grid-cols-4">
        {[
          [Users, review.attendance, 'Attended', 'Students recorded'],
          [BarChart3, review.participation === null ? '—' : `${review.participation}%`, 'Participated', `${review.respondents} students responded`],
          [Sparkles, review.playedActivities.length, 'Activities played', 'Response-based moments'],
          [MessageCircleQuestion, review.questions.length, 'Questions asked', `${review.openQuestions} still open`],
        ].map(([Icon, value, label, detail]) => {
          const StatIcon = Icon as typeof Users;
          return <article key={String(label)} className="bg-[#fbfaff] p-5"><StatIcon className="h-5 w-5 text-[#5146e5]" /><strong className="mt-3 block text-2xl text-[#101a38]">{String(value)}</strong><span className="block text-sm font-bold text-[#313950]">{String(label)}</span><p className="mt-1 text-xs text-[#697087]">{String(detail)}</p></article>;
        })}
      </div>

      <div className="grid gap-6 p-5 sm:p-7 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,.75fr)]">
        <div className="min-w-0">
          <div><p className="seminar-eyebrow">Played in class</p><h3 className="seminar-display mt-2 text-3xl text-[#101a38]">The session story.</h3></div>
          {review.playedActivities.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-[#d9dce6] p-6"><CircleHelp className="h-6 w-6 text-[#9298a8]" /><strong className="mt-3 block text-sm text-[#101a38]">No response-based activity was recorded.</strong><p className="mt-1 text-sm leading-6 text-[#697087]">Attendance can still be reviewed. Planned activities are not treated as student opportunities.</p></div>
          ) : (
            <ol className="relative mt-5 space-y-3 before:absolute before:bottom-5 before:left-[17px] before:top-5 before:w-px before:bg-[#dcd8ff]">
              {review.playedActivities.map((activity, index) => <li key={activity.id} className="relative grid grid-cols-[36px_minmax(0,1fr)] gap-3"><span className="z-10 grid h-9 w-9 place-items-center rounded-full border-4 border-white bg-[#5146e5] text-xs font-bold text-white">{index + 1}</span><div className="rounded-2xl border border-[#e3e5ed] bg-white p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#5146e5]">{activityLabel[activity.interaction.type]}</span><h4 className="mt-1 font-bold text-[#101a38]">{activity.interaction.title || activity.interaction.prompt}</h4><p className="mt-1 line-clamp-2 text-sm leading-6 text-[#697087]">{activity.interaction.prompt}</p></div><div className="shrink-0 sm:text-right"><strong className="block text-sm text-[#101a38]">{activity.responses.length} responses</strong><span className="text-xs text-[#697087]">{activity.reach === null ? 'Reach not recorded' : `${activity.reach}% of attendance`}</span></div></div><div className="mt-3 flex items-center gap-2 rounded-xl bg-[#f8f7fb] px-3 py-2 text-xs font-bold text-[#313950]"><Sparkles className="h-3.5 w-3.5 text-[#5146e5]" />{activity.result}</div></div></li>)}
            </ol>
          )}

          {review.caseModules.length > 0 && <div className="mt-5 rounded-2xl border border-[#f1dba4] bg-[#fff9e8] p-5"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#a66c00]"><BookOpen className="h-5 w-5" /></span><div><span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8d6200]">Optional module used</span><h4 className="mt-1 font-bold text-[#101a38]">{review.caseModules[0].title}</h4><p className="mt-1 text-sm leading-6 text-[#697087]">This case study is part of the session record. It does not define the rest of the review.</p></div></div></div>}

          <div className="mt-7 border-t border-[#e3e5ed] pt-6"><div className="flex items-end justify-between gap-3"><div><p className="seminar-eyebrow">Questions from the room</p><h3 className="seminar-display mt-2 text-2xl text-[#101a38]">What students wanted to discuss.</h3></div><span className="text-xs text-[#697087]">Sorted by support</span></div>{review.questions.length === 0 ? <p className="mt-4 rounded-2xl bg-[#f8f7fb] p-5 text-sm text-[#697087]">No student questions were recorded in this session.</p> : <div className="mt-4 space-y-2">{review.questions.slice(0, 5).map((question) => <article key={question.id} className="flex items-start gap-3 rounded-2xl border border-[#e3e5ed] p-4"><span className="grid h-9 min-w-9 place-items-center rounded-full bg-[#f0efff] text-xs font-bold text-[#5146e5]">↑{question.votes}</span><div className="min-w-0 flex-1"><p className="text-sm font-bold leading-6 text-[#101a38]">{question.question}</p><span className={`mt-1 inline-block text-xs font-bold ${question.status === 'open' ? 'text-[#b6533f]' : 'text-[#697087]'}`}>{question.status === 'discussed' ? 'Discussed' : question.status === 'dismissed' ? 'Dismissed' : 'Still open'}</span></div></article>)}</div>}</div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-3xl bg-[#101a38] p-5 text-white sm:p-6"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#b8b3ff]">What to do next</p><h3 className="seminar-display mt-2 text-2xl">Start with the clearest signal.</h3><div className="mt-5 space-y-3">{nextSteps.map(({ title, detail, icon: Icon, tone }) => <article key={title} className="rounded-2xl border border-white/10 bg-white/[0.07] p-4"><Icon className="h-5 w-5" style={{ color: tone }} /><strong className="mt-3 block text-sm">{title}</strong><p className="mt-1 text-xs leading-5 text-[#cbd0df]">{detail}</p></article>)}</div></div>
          <div className="rounded-2xl border border-[#e3e5ed] bg-[#fbfaff] p-5"><p className="seminar-eyebrow">Knowledge and pulse</p><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-white p-3"><HeartPulse className="h-4 w-4 text-[#df664e]" /><strong className="mt-2 block text-xl text-[#101a38]">{review.pulseResponseCount || '—'}</strong><span className="text-xs text-[#697087]">Pulse responses</span>{review.pulseConcernCount > 0 && <p className="mt-1 text-[10px] font-bold text-[#b6533f]">{review.pulseConcernCount} to revisit</p>}</div><div className="rounded-xl bg-white p-3"><Target className="h-4 w-4 text-[#5146e5]" /><strong className="mt-2 block text-xl text-[#101a38]">{review.quizAccuracy === null ? '—' : `${review.quizAccuracy}%`}</strong><span className="text-xs text-[#697087]">Knowledge check accuracy</span>{review.quizAnswered > 0 && <p className="mt-1 text-[10px] text-[#697087]">{review.quizCorrect} of {review.quizAnswered} correct</p>}</div></div></div>
          <div className="rounded-2xl border border-[#dcd8ff] bg-[#f7f6ff] p-5"><strong className="text-sm text-[#101a38]">Read signals in context.</strong><p className="mt-1 text-sm leading-6 text-[#697087]">A quiet room can mean uncertainty, limited time, or a question that did not fit the format. Use this review to choose where to look next.</p></div>
        </aside>
      </div>
    </section>
  );
}

export default function AnalyticsPage() {
  return <ReviewContent />;
}
