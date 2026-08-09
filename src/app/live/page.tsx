'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ClassfullyRemote from '@/components/live/ClassfullyRemote';
import LivingMoodField from '@/components/live/LivingMoodField';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  initializeInstructorClassroom,
  publishInstructorState,
  subscribeToInstructorDisplayPresence,
  subscribeToInstructorAttendance,
  subscribeToInstructorPresence,
  subscribeToInstructorPublicState,
  subscribeToInstructorQuestionVotes,
  subscribeToInstructorResponses,
  subscribeToInstructorWelcomeResponses,
  type StoredLiveResponse,
  type StoredAttendanceClaim,
} from '@/lib/firebase/live-classroom';
import { Timestamp } from 'firebase/firestore';
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  GraduationCap,
  HeartPulse,
  Laptop,
  ListChecks,
  Lock,
  MessageCircle,
  MonitorUp,
  PictureInPicture2,
  Pause,
  Play,
  Presentation,
  Send,
  Smartphone,
  ThumbsUp,
  TimerReset,
  Users,
  X,
} from 'lucide-react';
import {
  EMPTY_ONBOARDING_COUNTS,
  DEFAULT_LIVE_QUESTIONS,
  DEMO_LIVE_INTERACTIONS,
  DEMO_SESSION,
  HISTORY,
  LESSON_CHANNEL,
  LESSON_STORAGE_KEY,
  MOODS,
  createInteractionResults,
  percent,
  prepareLiveInteractions,
  resultPercent,
  total,
  type Counts,
  type InteractionResponse,
  type InteractionResults,
  type LessonDisplayState,
  type LiveSessionContext,
  type LiveInteraction,
  type MoodKey,
  type OnboardingStep,
} from './live-data';
import './live.css';

const QUESTIONS = DEFAULT_LIVE_QUESTIONS;

const NAV_ITEMS = [
  { label: 'Session plan', icon: ListChecks },
  { label: 'Questions', icon: MessageCircle },
];

const SESSION_PLAN = DEMO_LIVE_INTERACTIONS;

function InstructorInteractionStage({
  interaction,
  results,
  onReveal,
  onShareResponse,
}: {
  interaction: LiveInteraction;
  results: InteractionResults;
  onReveal: () => void;
  onShareResponse: (responseId: string) => void;
}) {
  const hasChoices = Boolean(interaction.options?.length);

  return (
    <section className="live-interaction-stage" aria-live="polite">
      <header className="live-interaction-heading">
        <div>
          <span className="eyebrow"><ListChecks size={18} /> {interaction.label} is live</span>
          <h1>{interaction.prompt}</h1>
          <p>{interaction.resultVisibility === 'after-reveal' && !results.revealed
            ? `Students answer privately. Reveal the ${interaction.type === 'quiz' ? 'answer' : 'class result'} when you are ready to discuss it.`
            : interaction.type === 'open-response'
              ? 'Written responses stay on your screen until you choose one to share.'
              : 'The class distribution updates as responses arrive.'}</p>
        </div>
        <div className="live-response-count"><Users size={20} /><strong>{results.responseCount}</strong><span>responses</span></div>
      </header>

      {hasChoices ? (
        <div className="live-choice-results">
          {interaction.options?.map((option, index) => {
            const count = results.optionCounts[index] ?? 0;
            const percentage = resultPercent(count, results.responseCount);
            const isCorrect = interaction.correctOptionIndex === index;
            return (
              <article className={results.revealed && isCorrect ? 'is-correct' : ''} key={option}>
                <span className="choice-letter">{String.fromCharCode(65 + index)}</span>
                <div className="choice-result-copy"><strong>{option}</strong><span><i style={{ width: `${percentage}%` }} /></span></div>
                <div className="choice-result-count"><strong>{percentage}%</strong><span>{count} {count === 1 ? 'student' : 'students'}</span></div>
                {results.revealed && isCorrect && <CheckCircle2 size={21} aria-label="Correct answer" />}
              </article>
            );
          })}
          {interaction.resultVisibility === 'after-reveal' && !results.revealed && (
            <button className="reveal-result-button" type="button" onClick={onReveal} disabled={!results.responseCount}>
              <CheckCircle2 size={18} /> {interaction.type === 'quiz' ? 'Reveal answer and explanation' : 'Reveal class result'}
            </button>
          )}
          {interaction.type === 'quiz' && results.revealed && interaction.explanation && (
            <div className="quiz-explanation"><CheckCircle2 size={18} /><span><strong>Why this answer</strong>{interaction.explanation}</span></div>
          )}
        </div>
      ) : (
        <div className="written-response-review">
          <div className="written-response-summary"><MessageCircle size={21} /><span><strong>{results.responseCount ? `${results.responseCount} ${results.responseCount === 1 ? 'idea' : 'ideas'} to review` : 'Waiting for the first response'}</strong><small>Nothing appears on the projector until you share it.</small></span></div>
          <div className="written-response-list">
            {results.writtenResponses.map((response) => (
              <article className={results.sharedResponseId === response.id ? 'is-shared' : ''} key={response.id}>
                <p>{response.text}</p>
                <button type="button" onClick={() => onShareResponse(response.id)}>{results.sharedResponseId === response.id ? 'Showing on projector' : 'Share anonymously'}</button>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default function LiveLessonPrototype() {
  const { user, loading: authLoading } = useAuth();
  const [sessionContext, setSessionContext] = useState<LiveSessionContext>(DEMO_SESSION);
  const [sessionPlan, setSessionPlan] = useState(SESSION_PLAN);
  const [liveCounts, setLiveCounts] = useState<Counts>(HISTORY[0].counts);
  const [paused, setPaused] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [showComparison, setShowComparison] = useState(true);
  const [playingHistory, setPlayingHistory] = useState(false);
  const [activeNav, setActiveNav] = useState('Pulse');
  const [liveQuestions, setLiveQuestions] = useState(QUESTIONS);
  const [activeQuestion, setActiveQuestion] = useState<number | null>(null);
  const [discussedQuestions, setDiscussedQuestions] = useState<number[]>([]);
  const [questionVoteCounts, setQuestionVoteCounts] = useState<Record<number, number>>({});
  const [questionFilter, setQuestionFilter] = useState<'All' | 'Top' | 'Unanswered'>('All');
  const [questionDraft, setQuestionDraft] = useState('');
  const [nextMenuOpen, setNextMenuOpen] = useState(false);
  const [sessionPlanOpen, setSessionPlanOpen] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [unplannedQuestionOpen, setUnplannedQuestionOpen] = useState(false);
  const [unplannedQuestion, setUnplannedQuestion] = useState('');
  const [activeInteraction, setActiveInteraction] = useState<LiveInteraction | null>(null);
  const [interactionResults, setInteractionResults] = useState<InteractionResults | null>(null);
  const [toast, setToast] = useState('');
  const [incomingMood, setIncomingMood] = useState<MoodKey | null>(null);
  const [displayConnected, setDisplayConnected] = useState(false);
  const [connectedStudents, setConnectedStudents] = useState(148);
  const [attendanceClaims, setAttendanceClaims] = useState<StoredAttendanceClaim[]>([]);
  const [remoteClassroomReady, setRemoteClassroomReady] = useState(false);
  const [floatingRemoteWindow, setFloatingRemoteWindow] = useState<Window | null>(null);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>(0);
  const [onboardingRunId, setOnboardingRunId] = useState(0);
  const [onboardingMoodCounts, setOnboardingMoodCounts] = useState<Counts>(EMPTY_ONBOARDING_COUNTS);
  const displayChannelRef = useRef<BroadcastChannel | null>(null);
  const lastDisplayPingRef = useRef(0);
  const pausedBeforeWelcomeRef = useRef(false);
  const receivedResponseIdsRef = useRef(new Set<string>());
  const demoQuestionVotersRef = useRef(new Map<number, Set<string>>());
  const activeInteractionRef = useRef<LiveInteraction | null>(null);
  const interactionResultsRef = useRef<InteractionResults | null>(null);
  const sessionPlanRef = useRef(sessionPlan);
  const localPublishedTimestampsRef = useRef(new Set<number>());

  useEffect(() => {
    if (!welcomeOpen && !sessionPlanOpen && !attendanceOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (welcomeOpen) setWelcomeOpen(false);
      else if (attendanceOpen) setAttendanceOpen(false);
      else if (sessionPlanOpen) setSessionPlanOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [attendanceOpen, sessionPlanOpen, welcomeOpen]);

  const selectedCounts = selectedWeek === 0 ? liveCounts : HISTORY[selectedWeek].counts;
  const comparisonCounts = HISTORY[Math.min(selectedWeek + 1, HISTORY.length - 1)].counts;
  const classQuestions = useMemo(() => liveQuestions.map((question) => ({
    ...question,
    votes: question.votes
      + (questionVoteCounts[question.id] || 0),
  })), [liveQuestions, questionVoteCounts]);
  const filteredClassQuestions = useMemo(() => {
    const filtered = questionFilter === 'Unanswered'
      ? classQuestions.filter((question) => !discussedQuestions.includes(question.id))
      : [...classQuestions];
    return questionFilter === 'Top'
      ? filtered.sort((a, b) => b.votes - a.votes)
      : filtered;
  }, [classQuestions, discussedQuestions, questionFilter]);
  const sortedAttendanceClaims = useMemo(() => [...attendanceClaims].sort((a, b) => (
    (a.status === 'participated' ? 0 : 1) - (b.status === 'participated' ? 0 : 1)
    || a.studentNumber.localeCompare(b.studentNumber)
  )), [attendanceClaims]);
  const participatedStudents = attendanceClaims.filter((claim) => claim.status === 'participated' || claim.status === 'confirmed').length;
  useEffect(() => {
    activeInteractionRef.current = activeInteraction;
    interactionResultsRef.current = interactionResults;
  }, [activeInteraction, interactionResults]);

  useEffect(() => {
    sessionPlanRef.current = sessionPlan;
  }, [sessionPlan]);

  const displayState = useMemo<LessonDisplayState>(() => {
    let publicInteraction = activeInteraction;
    if (activeInteraction?.type === 'quiz' && !interactionResults?.revealed) {
      const safeInteraction: LiveInteraction = { ...activeInteraction };
      delete safeInteraction.correctOptionIndex;
      delete safeInteraction.explanation;
      publicInteraction = safeInteraction;
    }

    const sharedResponse = interactionResults?.writtenResponses.find((response) => response.id === interactionResults.sharedResponseId);
    const sharedResponseIndex = sharedResponse && interactionResults
      ? interactionResults.writtenResponses.findIndex((response) => response.id === sharedResponse.id)
      : -1;
    const publicSharedResponseId = sharedResponse && interactionResults
      ? `shared-${interactionResults.runId}-${Math.max(0, sharedResponseIndex)}`
      : null;
    const publicResults = interactionResults ? {
      ...interactionResults,
      writtenResponses: sharedResponse && publicSharedResponseId ? [{ id: publicSharedResponseId, text: sharedResponse.text }] : [],
      sharedResponseId: publicSharedResponseId,
    } : null;

    return {
      session: sessionContext,
      counts: selectedCounts,
      comparisonCounts,
      incomingMood,
      paused,
      playingHistory,
      selectedWeek,
      showComparison,
      onboardingStep,
      onboardingRunId,
      onboardingMoodCounts,
      activeInteraction: publicInteraction,
      interactionResults: publicResults,
      featuredQuestionId: activeQuestion,
      questions: classQuestions,
      updatedAt: Date.now(),
    };
  }, [activeInteraction, activeQuestion, classQuestions, comparisonCounts, incomingMood, interactionResults, onboardingMoodCounts, onboardingRunId, onboardingStep, paused, playingHistory, selectedCounts, selectedWeek, sessionContext, showComparison]);
  const displayStateRef = useRef(displayState);

  useEffect(() => {
    displayStateRef.current = displayState;
  }, [displayState]);

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get('sessionId');
    if (!sessionId) return;
    if (authLoading) return;
    if (!user) {
      setToast('Sign in as the instructor to open this saved session.');
      return;
    }

    let cancelled = false;
    const loadPreparedSession = async () => {
      const { getSession, updateSession } = await import('@/lib/firebase/firestore');
      const session = await getSession(sessionId);
      if (!session || cancelled) return;

      if (session.teacherId !== user.uid) {
        setToast('This session belongs to another instructor.');
        return;
      }

      const context: LiveSessionContext = {
        sessionId,
        ownerUid: session.teacherId,
        instructorName: user.name || user.email?.split('@')[0] || 'Your instructor',
        sessionCode: session.sessionCode,
        courseCode: session.courseCode || 'Class',
        courseName: session.courseName || '',
        sessionTitle: session.title || 'Live session',
      };
      setSessionContext(context);
      setLiveCounts({ ...EMPTY_ONBOARDING_COUNTS });
      setSelectedWeek(0);
      setShowComparison(false);
      setPlayingHistory(false);
      setLiveQuestions([]);
      setQuestionVoteCounts({});
      setDiscussedQuestions([]);
      setActiveQuestion(null);

      const prepared = prepareLiveInteractions(session.interactions);
      if (prepared.length) setSessionPlan(prepared);

      const remoteState = await initializeInstructorClassroom(sessionId, context, {
        ...displayStateRef.current,
        session: context,
        counts: { ...EMPTY_ONBOARDING_COUNTS },
        selectedWeek: 0,
        showComparison: false,
        playingHistory: false,
        onboardingStep: 0,
        onboardingRunId: 0,
        onboardingMoodCounts: { ...EMPTY_ONBOARDING_COUNTS },
        activeInteraction: null,
        interactionResults: null,
        featuredQuestionId: null,
        questions: [],
        updatedAt: Date.now(),
      });
      const privateActiveInteraction = remoteState.activeInteraction
        ? prepared.find((interaction) => interaction.id === remoteState.activeInteraction?.id) || remoteState.activeInteraction
        : null;
      setLiveCounts(remoteState.counts || { ...EMPTY_ONBOARDING_COUNTS });
      setSelectedWeek(remoteState.selectedWeek || 0);
      setShowComparison(Boolean(remoteState.showComparison));
      setPlayingHistory(Boolean(remoteState.playingHistory));
      setPaused(Boolean(remoteState.paused));
      setOnboardingStep(remoteState.onboardingStep || 0);
      setOnboardingRunId(remoteState.onboardingRunId || 0);
      setOnboardingMoodCounts(remoteState.onboardingMoodCounts || { ...EMPTY_ONBOARDING_COUNTS });
      setActiveInteraction(privateActiveInteraction);
      setInteractionResults(remoteState.interactionResults || null);
      setLiveQuestions((remoteState.questions || []).map((question) => ({ ...question, votes: 0 })));
      setActiveQuestion(remoteState.featuredQuestionId || null);
      if (!session.active) {
        await updateSession(sessionId, { active: true, startedAt: Timestamp.now() });
      }
      if (!cancelled) {
        setConnectedStudents(0);
        setRemoteClassroomReady(true);
        setToast('This session is ready for student devices.');
      }
    };

    loadPreparedSession().catch(() => setToast('The saved session plan could not be loaded. The demo plan is still available.'));
    return () => { cancelled = true; };
  }, [authLoading, user]);

  useEffect(() => {
    const channel = new BroadcastChannel(LESSON_CHANNEL);
    displayChannelRef.current = channel;

    channel.onmessage = (event: MessageEvent<{
      type?: string;
      mood?: MoodKey;
      response?: InteractionResponse;
      questionId?: number;
      voterId?: string;
      voted?: boolean;
      command?: 'launch' | 'toggle-responses' | 'reveal' | 'finish';
      interactionId?: string;
    }>) => {
      if (event.data?.type === 'display-ready' || event.data?.type === 'display-heartbeat') {
        lastDisplayPingRef.current = Date.now();
        setDisplayConnected(true);
      }
      if (event.data?.type === 'display-closed') setDisplayConnected(false);
      if (event.data?.type === 'student-onboarding-response' && event.data.mood) {
        const mood = event.data.mood;
        if (MOODS.some((option) => option.key === mood)) {
          setOnboardingMoodCounts((current) => ({ ...current, [mood]: current[mood] + 1 }));
        }
      }
      if (event.data?.type === 'student-interaction-response' && event.data.response) {
        const response = event.data.response;
        const currentInteraction = activeInteractionRef.current;
        const currentResults = interactionResultsRef.current;
        if (
          !currentInteraction ||
          !currentResults ||
          !currentResults.open ||
          response.interactionId !== currentInteraction.id ||
          response.runId !== currentResults.runId ||
          receivedResponseIdsRef.current.has(response.id)
        ) return;

        receivedResponseIdsRef.current.add(response.id);
        setInteractionResults((current) => {
          if (!current || current.runId !== response.runId) return current;
          const nextOptionCounts = [...current.optionCounts];
          if (typeof response.optionIndex === 'number' && nextOptionCounts[response.optionIndex] !== undefined) {
            nextOptionCounts[response.optionIndex] += 1;
          }
          const cleanText = response.text?.trim().slice(0, 280);
          return {
            ...current,
            responseCount: current.responseCount + 1,
            optionCounts: nextOptionCounts,
            writtenResponses: cleanText
              ? [{ id: response.id, text: cleanText }, ...current.writtenResponses].slice(0, 60)
              : current.writtenResponses,
          };
        });
      }
      if (
        event.data?.type === 'student-question-vote'
        && typeof event.data.questionId === 'number'
        && event.data.voterId
      ) {
        const voters = demoQuestionVotersRef.current.get(event.data.questionId) || new Set<string>();
        if (event.data.voted) voters.add(event.data.voterId);
        else voters.delete(event.data.voterId);
        demoQuestionVotersRef.current.set(event.data.questionId, voters);
        setQuestionVoteCounts(Object.fromEntries(
          Array.from(demoQuestionVotersRef.current.entries()).map(([questionId, students]) => [questionId, students.size]),
        ));
      }
      if (event.data?.type === 'instructor-remote-command' && event.data.command) {
        if (event.data.command === 'launch' && event.data.interactionId) {
          const interaction = sessionPlanRef.current.find((item) => item.id === event.data.interactionId);
          if (interaction) {
            setActiveInteraction(interaction);
            receivedResponseIdsRef.current.clear();
            setInteractionResults(createInteractionResults(interaction));
            setActiveNav(interaction.label);
          }
        }
        if (event.data.command === 'toggle-responses') {
          setInteractionResults((current) => current ? { ...current, open: !current.open } : current);
        }
        if (event.data.command === 'reveal') {
          setInteractionResults((current) => current ? { ...current, open: false, revealed: true } : current);
        }
        if (event.data.command === 'finish') {
          setActiveInteraction(null);
          setInteractionResults(null);
        }
      }
    };

    channel.postMessage({ type: 'instructor-ready' });

    const connectionTimer = window.setInterval(() => {
      if (lastDisplayPingRef.current && Date.now() - lastDisplayPingRef.current > 5200) {
        setDisplayConnected(false);
      }
    }, 1800);

    return () => {
      window.clearInterval(connectionTimer);
      channel.close();
      displayChannelRef.current = null;
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LESSON_STORAGE_KEY, JSON.stringify(displayState));
    displayChannelRef.current?.postMessage({ type: 'lesson-state', state: displayState });
    if (remoteClassroomReady && sessionContext.sessionId && sessionContext.ownerUid) {
      localPublishedTimestampsRef.current.add(displayState.updatedAt);
      if (localPublishedTimestampsRef.current.size > 24) {
        const oldest = localPublishedTimestampsRef.current.values().next().value;
        if (typeof oldest === 'number') localPublishedTimestampsRef.current.delete(oldest);
      }
      publishInstructorState(sessionContext.ownerUid, sessionContext.sessionId, displayState)
        .catch(() => setToast('The live classroom lost its connection. Check the network before continuing.'));
    }
  }, [displayState, remoteClassroomReady, sessionContext.ownerUid, sessionContext.sessionId]);

  useEffect(() => {
    if (!remoteClassroomReady || !sessionContext.sessionId || !sessionContext.ownerUid) return;
    return subscribeToInstructorPublicState(
      sessionContext.ownerUid,
      sessionContext.sessionId,
      (remoteState) => {
        if (!remoteState || localPublishedTimestampsRef.current.has(remoteState.updatedAt)) return;
        const privateInteraction = remoteState.activeInteraction
          ? sessionPlanRef.current.find((interaction) => interaction.id === remoteState.activeInteraction?.id)
            || remoteState.activeInteraction
          : null;
        setActiveInteraction(privateInteraction);
        setInteractionResults(remoteState.interactionResults);
        setPaused(Boolean(remoteState.paused));
        setActiveQuestion(remoteState.featuredQuestionId || null);
      },
    );
  }, [remoteClassroomReady, sessionContext.ownerUid, sessionContext.sessionId]);

  useEffect(() => {
    if (!remoteClassroomReady || !sessionContext.sessionId || !sessionContext.ownerUid || !interactionResults?.runId || !activeInteraction) return;
    return subscribeToInstructorResponses(
      sessionContext.ownerUid,
      sessionContext.sessionId,
      interactionResults.runId,
      (responseMap) => {
        const responses = Object.values(responseMap).filter((response) => (
          response.runId === interactionResults.runId && response.interactionId === activeInteraction.id
        ));
        const optionCounts = activeInteraction.options?.map(() => 0) ?? [];
        const writtenResponses: Array<{ id: string; text: string }> = [];
        responses.forEach((response: StoredLiveResponse) => {
          if (typeof response.optionIndex === 'number' && optionCounts[response.optionIndex] !== undefined) {
            optionCounts[response.optionIndex] += 1;
          }
          if (response.text) writtenResponses.push({ id: response.id, text: response.text });
        });
        setInteractionResults((current) => current && current.runId === interactionResults.runId ? {
          ...current,
          responseCount: responses.length,
          optionCounts,
          writtenResponses: writtenResponses.slice(0, 60),
        } : current);
      },
    );
  }, [activeInteraction, interactionResults?.runId, remoteClassroomReady, sessionContext.ownerUid, sessionContext.sessionId]);

  useEffect(() => {
    if (!remoteClassroomReady || !sessionContext.sessionId || !sessionContext.ownerUid) return;
    return subscribeToInstructorPresence(sessionContext.ownerUid, sessionContext.sessionId, setConnectedStudents);
  }, [remoteClassroomReady, sessionContext.ownerUid, sessionContext.sessionId]);

  useEffect(() => {
    if (!remoteClassroomReady || !sessionContext.sessionId || !sessionContext.ownerUid) {
      setAttendanceClaims([]);
      return;
    }
    return subscribeToInstructorAttendance(sessionContext.ownerUid, sessionContext.sessionId, (claims) => {
      const uniqueClaims = new Map<string, StoredAttendanceClaim>();
      Object.values(claims).forEach((claim) => {
        const existing = uniqueClaims.get(claim.studentNumber);
        if (!existing) {
          uniqueClaims.set(claim.studentNumber, claim);
          return;
        }
        const existingParticipated = existing.status === 'participated' || existing.status === 'confirmed';
        const claimParticipated = claim.status === 'participated' || claim.status === 'confirmed';
        uniqueClaims.set(claim.studentNumber, {
          ...(claimParticipated && !existingParticipated ? claim : existing),
          joinedAt: Math.min(existing.joinedAt, claim.joinedAt),
          updatedAt: Math.max(existing.updatedAt, claim.updatedAt),
        });
      });
      setAttendanceClaims([...uniqueClaims.values()]);
    });
  }, [remoteClassroomReady, sessionContext.ownerUid, sessionContext.sessionId]);

  useEffect(() => {
    if (!remoteClassroomReady || !sessionContext.sessionId || !sessionContext.ownerUid) return;
    return subscribeToInstructorQuestionVotes(
      sessionContext.ownerUid,
      sessionContext.sessionId,
      setQuestionVoteCounts,
    );
  }, [remoteClassroomReady, sessionContext.ownerUid, sessionContext.sessionId]);

  useEffect(() => {
    if (!remoteClassroomReady || !sessionContext.sessionId || !sessionContext.ownerUid) return;
    return subscribeToInstructorDisplayPresence(sessionContext.ownerUid, sessionContext.sessionId, setDisplayConnected);
  }, [remoteClassroomReady, sessionContext.ownerUid, sessionContext.sessionId]);

  useEffect(() => {
    if (
      !remoteClassroomReady ||
      !sessionContext.sessionId ||
      !sessionContext.ownerUid ||
      onboardingStep !== 3 ||
      !onboardingRunId
    ) return;

    return subscribeToInstructorWelcomeResponses(
      sessionContext.ownerUid,
      sessionContext.sessionId,
      onboardingRunId,
      (responseMap) => {
        const nextCounts: Counts = { ...EMPTY_ONBOARDING_COUNTS };
        Object.values(responseMap).forEach((response) => {
          if (MOODS.some((mood) => mood.key === response.mood)) nextCounts[response.mood] += 1;
        });
        setOnboardingMoodCounts(nextCounts);
      },
    );
  }, [onboardingRunId, onboardingStep, remoteClassroomReady, sessionContext.ownerUid, sessionContext.sessionId]);

  useEffect(() => {
    if (sessionContext.sessionId || paused || selectedWeek !== 0 || total(liveCounts) >= 176) return;

    const order: MoodKey[] = ['steady', 'tired', 'steady', 'energized', 'steady', 'overwhelmed'];
    const timer = window.setInterval(() => {
      const key = order[total(liveCounts) % order.length];
      setIncomingMood(key);
      window.setTimeout(() => {
        setLiveCounts((current) => ({ ...current, [key]: current[key] + 1 }));
        setIncomingMood(null);
      }, 760);
    }, 4200);

    return () => window.clearInterval(timer);
  }, [liveCounts, paused, selectedWeek, sessionContext.sessionId]);

  useEffect(() => {
    if (!playingHistory) return;
    const timer = window.setInterval(() => {
      setSelectedWeek((current) => (current + 1) % HISTORY.length);
    }, 1800);
    return () => window.clearInterval(timer);
  }, [playingHistory]);

  useEffect(() => {
    if (sessionContext.sessionId || onboardingStep !== 3 || total(onboardingMoodCounts) >= 36) return;
    const arrivals: MoodKey[] = ['steady', 'energized', 'steady', 'tired', 'steady', 'energized', 'overwhelmed', 'private'];
    const timer = window.setInterval(() => {
      const mood = arrivals[total(onboardingMoodCounts) % arrivals.length];
      setOnboardingMoodCounts((current) => ({ ...current, [mood]: current[mood] + 1 }));
    }, 820);
    return () => window.clearInterval(timer);
  }, [onboardingMoodCounts, onboardingStep, sessionContext.sessionId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const insight = useMemo(() => {
    if (!total(selectedCounts)) return 'Waiting for the first class response.';
    const currentOverwhelmed = percent(selectedCounts.overwhelmed, selectedCounts);
    const priorOverwhelmed = percent(comparisonCounts.overwhelmed, comparisonCounts);
    const delta = currentOverwhelmed - priorOverwhelmed;
    return delta > 0
      ? `${selectedCounts.overwhelmed} students need breathing room · ${delta} pts higher than the prior class`
      : 'The room is steadier than the prior class';
  }, [selectedCounts, comparisonCounts]);

  const publishQuestion = () => {
    const question = questionDraft.trim().replace(/\s+/g, ' ').slice(0, 180);
    if (!question) return;
    setLiveQuestions((current) => [{
      id: Date.now(),
      initials: 'Q',
      ago: 'Just now',
      question,
      votes: 0,
    }, ...current]);
    setQuestionDraft('');
    setQuestionFilter('All');
    setToast('Question is available for students to upvote');
  };

  const discussQuestion = (id: number) => {
    setActiveQuestion((current) => current === id ? null : id);
    setDiscussedQuestions((current) => current.includes(id) ? current : [...current, id]);
  };

  const launchInteraction = (interaction: LiveInteraction) => {
    setNextMenuOpen(false);
    setSessionPlanOpen(false);
    setActiveInteraction(interaction);
    receivedResponseIdsRef.current.clear();
    setInteractionResults(createInteractionResults(interaction));
    setActiveNav(interaction.label);
    if (!displayConnected) openClassroomDisplay();
    setToast(`${interaction.title} is ready on the classroom display`);
    window.setTimeout(() => document.querySelector('.live-interaction-stage')?.scrollTo({ top: 0 }), 0);
  };

  const returnToSlides = () => {
    setActiveInteraction(null);
    setInteractionResults(null);
    setToast('Interaction closed. Return to your presentation when ready.');
  };

  const revealInteractionResults = () => {
    setInteractionResults((current) => current ? { ...current, open: false, revealed: true } : current);
    setToast('The class result is now visible on the projector');
  };

  const toggleInteractionResponses = () => {
    setInteractionResults((current) => current ? { ...current, open: !current.open } : current);
    setToast(interactionResults?.open ? 'Responses locked' : 'Responses reopened');
  };

  const shareWrittenResponse = (responseId: string) => {
    setInteractionResults((current) => current ? { ...current, sharedResponseId: responseId } : current);
    setToast('Anonymous response shared with the class');
  };

  const launchUnplannedQuestion = () => {
    const prompt = unplannedQuestion.trim();
    if (!prompt) return;
    launchInteraction({
      id: `unplanned-${Date.now()}`,
      type: 'open-response',
      label: 'Short response',
      title: 'Unplanned question',
      prompt,
      resultVisibility: 'instructor-only',
    });
    setUnplannedQuestion('');
    setUnplannedQuestionOpen(false);
  };

  const openClassroomDisplay = () => {
    const displayUrl = sessionContext.sessionId && sessionContext.ownerUid
      ? `/live/display?sessionId=${encodeURIComponent(sessionContext.sessionId)}&ownerUid=${encodeURIComponent(sessionContext.ownerUid)}`
      : '/live/display';
    const display = window.open(
      displayUrl,
      'living-seminar-classroom-display',
      'popup=yes,width=1600,height=900',
    );

    if (!display) {
      setToast('Your browser blocked the display window. Allow pop-ups and try again.');
      return;
    }

    setToast('Classroom display opened in a second window');
    window.setTimeout(() => {
      displayChannelRef.current?.postMessage({ type: 'lesson-state', state: displayState });
    }, 500);
  };

  const openStudentView = () => {
    const studentUrl = sessionContext.sessionId && sessionContext.ownerUid
      ? `/live/student?sessionId=${encodeURIComponent(sessionContext.sessionId)}&ownerUid=${encodeURIComponent(sessionContext.ownerUid)}`
      : '/live/student';
    window.open(studentUrl, 'living-seminar-student-view', 'popup=yes,width=430,height=860');
  };

  const openFloatingControls = async () => {
    if (floatingRemoteWindow && !floatingRemoteWindow.closed) {
      floatingRemoteWindow.focus();
      return;
    }

    const remoteUrl = sessionContext.sessionId && sessionContext.ownerUid
      ? `/live/remote?sessionId=${encodeURIComponent(sessionContext.sessionId)}&ownerUid=${encodeURIComponent(sessionContext.ownerUid)}`
      : '/live/remote';
    const pictureInPicture = (window as Window & {
      documentPictureInPicture?: {
        requestWindow: (options?: { width?: number; height?: number; preferInitialWindowPlacement?: boolean }) => Promise<Window>;
      };
    }).documentPictureInPicture;

    if (pictureInPicture) {
      try {
        const pipWindow = await pictureInPicture.requestWindow({
          width: 390,
          height: 640,
          preferInitialWindowPlacement: true,
        });
        document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]').forEach((stylesheet) => {
          const link = pipWindow.document.createElement('link');
          link.rel = 'stylesheet';
          link.href = stylesheet.href;
          pipWindow.document.head.append(link);
        });
        pipWindow.document.documentElement.style.background = '#faf9f6';
        pipWindow.document.body.style.margin = '0';
        pipWindow.document.title = 'Classfully Remote';
        pipWindow.addEventListener('pagehide', () => setFloatingRemoteWindow(null), { once: true });
        setFloatingRemoteWindow(pipWindow);
        setToast('Floating controls are ready over your slides');
        return;
      } catch {
        // Use the popup fallback below when document PiP is unavailable or declined.
      }
    }

    const popup = window.open(remoteUrl, 'classfully-instructor-remote', 'popup=yes,width=410,height=690');
    if (!popup) {
      setToast('Allow pop-ups to open the floating controls.');
      return;
    }
    setToast('Remote controls opened in a compact window');
  };

  const startWelcome = () => {
    pausedBeforeWelcomeRef.current = paused;
    setPaused(true);
    setPlayingHistory(false);
    setSelectedWeek(0);
    setOnboardingMoodCounts(EMPTY_ONBOARDING_COUNTS);
    setOnboardingRunId(Date.now());
    setOnboardingStep(1);
    setWelcomeOpen(false);
    if (!displayConnected) openClassroomDisplay();
  };

  const endWelcome = () => {
    setOnboardingStep(0);
    setPaused(pausedBeforeWelcomeRef.current);
    setToast('Welcome finished · the live lesson is back on screen');
  };

  const advanceWelcome = () => {
    setOnboardingStep((current) => (Math.min(4, current + 1) as OnboardingStep));
  };

  const welcomeLabels = ['Join the room', 'How participation works', 'Try the first pulse'];

  return (
    <div className="seminar-shell">
        <aside className="seminar-sidebar" aria-label="Lesson navigation">
          <div className="seminar-brand">Classfully<span>.</span></div>

          <nav className="sidebar-nav">
            <button className="nav-primary is-active" type="button">
              <Activity size={20} strokeWidth={1.8} />
              <span>Live lesson</span>
              <i aria-label="Live" />
            </button>
            <p className="nav-section-label">During class</p>
            {NAV_ITEMS.map(({ label, icon: Icon }) => (
              <button
                className={`nav-item ${activeNav === label ? 'is-active' : ''}`}
                type="button"
                key={label}
                onClick={() => {
                  setActiveNav(label);
                  if (label === 'Session plan') setSessionPlanOpen(true);
                  if (label === 'Questions') document.querySelector('.conversation-rail')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <Icon size={19} strokeWidth={1.7} />
                <span>{label}</span>
              </button>
            ))}

          </nav>

          <div className="professor-card">
            <Image
              src="/assets/living-seminar/prof-maya-chen.png"
              alt="Prof. Maya Chen"
              width={44}
              height={44}
              priority
              unoptimized
            />
            <span>
              <strong>{sessionContext.instructorName || 'Prof. Maya Chen'}</strong>
              <small>{sessionContext.courseCode}</small>
            </span>
          </div>
        </aside>

      <main className="seminar-main">
        <header className="lesson-topbar">
          <div className="live-lockup">
            <span className="live-pill"><i /> Live</span>
            <span className="signal-bars" aria-hidden="true"><i /><i /><i /></span>
            <span className="course-name">{sessionContext.courseCode} <em>{sessionContext.courseName ? `· ${sessionContext.courseName}` : ''}</em></span>
          </div>
          <div className="topbar-actions">
            <span className="connected-count"><Users size={17} /> {activeInteraction && interactionResults ? `${interactionResults.responseCount} responded` : `${connectedStudents} connected`}</span>
            <button className="attendance-trigger" type="button" onClick={() => setAttendanceOpen(true)}><ClipboardCheck size={17} /> Attendance {attendanceClaims.length}</button>
            <button type="button" onClick={() => setSessionPlanOpen(true)}><ListChecks size={17} /> Session plan</button>
            <button
              className={`welcome-trigger ${onboardingStep > 0 ? 'is-active' : ''}`}
              type="button"
              onClick={() => onboardingStep > 0 ? setToast('Use the welcome controls above the lesson dock') : setWelcomeOpen(true)}
            ><GraduationCap size={17} /> {onboardingStep > 0 ? 'Welcome running' : 'Welcome class'}</button>
            <button className="floating-controls-trigger" type="button" onClick={openFloatingControls}><PictureInPicture2 size={17} /> Float controls</button>
            <button type="button" onClick={openClassroomDisplay}><MonitorUp size={17} /> {displayConnected ? 'Display connected' : 'Open display'}</button>
          </div>
        </header>

        {activeInteraction && interactionResults ? (
          <InstructorInteractionStage
            interaction={activeInteraction}
            results={interactionResults}
            onReveal={revealInteractionResults}
            onShareResponse={shareWrittenResponse}
          />
        ) : (
        <section className="lesson-content">
          <div className="content-heading">
            <div>
              <div className="eyebrow"><HeartPulse size={18} /> Student wellbeing check-in</div>
              <h1>How are you feeling today?</h1>
              <p>{selectedWeek === 0 ? 'Responses update live as students check in.' : HISTORY[selectedWeek].lesson}</p>
            </div>
            <div className="privacy-note"><Lock size={15} /> Individual responses stay private</div>
          </div>

          {!sessionContext.sessionId && <div className="history-toolbar" aria-label="Wellbeing history controls">
            <div className="history-periods">
              {HISTORY.map((week, index) => (
                <button
                  type="button"
                  className={selectedWeek === index ? 'is-active' : ''}
                  key={week.date}
                  onClick={() => {
                    setSelectedWeek(index);
                    setPlayingHistory(false);
                  }}
                >
                  <span>{week.date}</span>
                  <small>{total(index === 0 ? liveCounts : week.counts)} responses</small>
                </button>
              ))}
            </div>
            <div className="history-actions">
              <button
                className={showComparison ? 'is-active' : ''}
                type="button"
                onClick={() => setShowComparison((current) => !current)}
                aria-pressed={showComparison}
              >
                <TimerReset size={16} /> Compare
              </button>
              <button
                className={playingHistory ? 'is-active' : ''}
                type="button"
                onClick={() => setPlayingHistory((current) => !current)}
                aria-pressed={playingHistory}
              >
                {playingHistory ? <Pause size={15} /> : <Play size={15} />}
                {playingHistory ? 'Pause story' : 'Play trend'}
              </button>
            </div>
          </div>}

          <div className="room-signal-row">
            <span className="pause-signal"><Activity size={15} /> {selectedCounts.overwhelmed ? `${selectedCounts.overwhelmed} need a pause` : 'No pace signals yet'}</span>
            <span className="arrival-signal"><i /> {paused ? 'Responses are paused.' : 'The class is still arriving.'}</span>
          </div>

          <div className={`pulse-chart ${playingHistory ? 'is-flowing' : ''}`} aria-live="polite">
            <div className="chart-key">
              <span><i className="key-dot current" /> {HISTORY[selectedWeek].date}</span>
              {showComparison && <span><i className="key-dot previous" /> Prior class</span>}
            </div>

            {MOODS.map((mood) => {
              const value = selectedCounts[mood.key];
              const percentage = percent(value, selectedCounts);
              const previousPercentage = percent(comparisonCounts[mood.key], comparisonCounts);
              const delta = percentage - previousPercentage;

              return (
                <div className="mood-row" key={mood.key}>
                  <div className="mood-label">
                    <i style={{ backgroundColor: mood.color }} />
                    <span>{mood.label}</span>
                  </div>
                  <div className="mood-visual">
                    <LivingMoodField
                      color={mood.color}
                      currentPercent={percentage}
                      previousPercent={previousPercentage}
                      showComparison={showComparison}
                      incoming={incomingMood === mood.key}
                      replaying={playingHistory}
                      animationKey={selectedWeek}
                    />
                  </div>
                  <div className="mood-number">
                    <strong>{percentage}%</strong>
                    <span>{value} students</span>
                  </div>
                  <div className={`mood-delta ${delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : ''}`}>
                    {showComparison ? `${delta > 0 ? '+' : ''}${delta} pts` : 'Not compared'}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="instructor-insight">
            <div className="annotation-arrow" aria-hidden="true">↗</div>
            <p>{insight}</p>
            <span>Start with a gentle recap before the first quiz.</span>
          </div>
        </section>
        )}

        <footer className="lesson-controls">
          <button
            className="control-secondary"
            type="button"
            aria-pressed={activeInteraction && interactionResults ? !interactionResults.open : paused}
            onClick={() => {
              if (activeInteraction && interactionResults) {
                toggleInteractionResponses();
                return;
              }
              setPaused((current) => !current);
              setToast(paused ? 'Responses are live again' : 'Responses paused');
            }}
          >
            {(activeInteraction && interactionResults ? !interactionResults.open : paused) ? <Play size={19} /> : <Pause size={19} />}
            <span>
              <strong>{activeInteraction && interactionResults ? (interactionResults.open ? 'Lock responses' : 'Reopen responses') : (paused ? 'Resume responses' : 'Pause responses')}</strong>
              <small>{activeInteraction && interactionResults ? (interactionResults.open ? 'Students can still answer' : 'No new answers are accepted') : (paused ? 'The chart is frozen' : 'Responses are live')}</small>
            </span>
          </button>
          <button className="control-secondary" type="button" onClick={openClassroomDisplay}>
            <Presentation size={19} />
            <span><strong>Open classroom display</strong><small>Students see aggregate results only</small></span>
          </button>
          <div className="next-activity-wrap">
            {nextMenuOpen && (
              <div className="activity-menu">
                <p>Prepared for this session</p>
                {sessionPlan.map((interaction) => (
                  <button type="button" key={interaction.id} onClick={() => launchInteraction(interaction)}><span><small>{interaction.plannedTime}</small>{interaction.title}</span><ArrowRight size={15} /></button>
                ))}
              </div>
            )}
            <button className={`control-primary ${activeInteraction ? 'is-return' : ''}`} type="button" onClick={() => activeInteraction ? returnToSlides() : setNextMenuOpen((current) => !current)}>
              <span><strong>{activeInteraction ? 'Finish interaction' : 'Show an interaction'}</strong><small>{activeInteraction ? 'Then switch back to your slides' : `${sessionPlan.length} ${sessionPlan.length === 1 ? 'interaction' : 'interactions'} prepared for this session`}</small></span>
              {activeInteraction ? <Laptop size={20} /> : <ArrowRight size={20} />}
            </button>
          </div>
        </footer>
      </main>

        <aside className="conversation-rail" aria-label="Live questions">
          <section className="display-preview-section">
            <div className="display-preview-heading">
              <span>Classroom display</span>
              <small><i /> {displayConnected ? 'Connected' : 'Preview'}</small>
            </div>
            <button className="display-preview" type="button" onClick={openClassroomDisplay}>
              {onboardingStep > 0 ? (
                <div className="preview-welcome-state">
                  <span><GraduationCap size={14} /> Classroom welcome</span>
                  <strong>{onboardingStep === 4 ? 'The class is ready' : welcomeLabels[onboardingStep - 1]}</strong>
                  <div>{[1, 2, 3].map((step) => <i className={step <= onboardingStep ? 'is-filled' : ''} key={step} />)}</div>
                  <small>{onboardingStep === 3 ? `${total(onboardingMoodCounts)} first pulses received` : onboardingStep === 4 ? 'Return to the lesson when ready' : `Step ${onboardingStep} of 3 on screen`}</small>
                </div>
              ) : activeInteraction ? (
                <div className="preview-welcome-state preview-interaction-state">
                  <span><ListChecks size={14} /> {activeInteraction.label}</span>
                  <strong>{activeInteraction.prompt}</strong>
                  <small>Ready on the classroom display</small>
                </div>
              ) : (
                <>
                  <span className="preview-title">How are you feeling today?</span>
                  <div className="preview-clusters" aria-hidden="true">
                    {MOODS.map((mood) => (
                      <div className="preview-cluster-row" key={mood.key}>
                        <span>
                          {Array.from({ length: Math.max(3, Math.round(percent(selectedCounts[mood.key], selectedCounts) * 0.24)) }).map((_, index) => (
                            <i key={index} style={{ backgroundColor: mood.color }} />
                          ))}
                        </span>
                        <strong>{percent(selectedCounts[mood.key], selectedCounts)}%</strong>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <span className="preview-action"><MonitorUp size={13} /> Open on projector</span>
            </button>
            <div className="presentation-companion-note"><Laptop size={14} /><span><strong>Your slides stay separate.</strong> Open this display once, then use your normal app switch between the presentation and classroom view.</span></div>
          </section>

          <header className="rail-header">
            <div><h2>Live questions</h2><span><Users size={15} /> {connectedStudents}</span></div>
            <div className="rail-tabs">
              {(['All', 'Top', 'Unanswered'] as const).map((filter) => (
                <button
                  type="button"
                  key={filter}
                  className={questionFilter === filter ? 'is-active' : ''}
                  onClick={() => setQuestionFilter(filter)}
                >{filter}</button>
              ))}
            </div>
          </header>

          <div className="question-list">
            {filteredClassQuestions.map((question) => (
              <article className={`question-card ${activeQuestion === question.id ? 'is-active' : ''}`} key={question.id}>
                <div className="question-meta">
                  <span className={`question-avatar avatar-${question.id}`}>{question.initials}</span>
                  <div><strong>Anonymous</strong><small>· {question.ago}</small></div>
                </div>
                <p>{question.question}</p>
                <div className="question-actions">
                  <span className="question-vote-total" aria-label={`${question.votes} student upvotes`}>
                    <ThumbsUp size={16} /> <strong key={question.votes}>{question.votes}</strong>
                  </span>
                  <button type="button" onClick={() => discussQuestion(question.id)}>
                    <MessageCircle size={16} /> {activeQuestion === question.id ? 'Remove from display' : discussedQuestions.includes(question.id) ? 'Show again' : 'Discuss on display'}
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="ask-box">
            <label htmlFor="teacher-question">Ask the class</label>
            <div><input id="teacher-question" value={questionDraft} onChange={(event) => setQuestionDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') publishQuestion(); }} maxLength={180} placeholder="Type your question…" /><button type="button" aria-label="Publish question for students" disabled={!questionDraft.trim()} onClick={publishQuestion}><Send size={17} /></button></div>
            <small>Published questions appear on student phones</small>
          </div>
        </aside>

      {welcomeOpen && (
        <div className="welcome-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setWelcomeOpen(false);
        }}>
          <section className="welcome-modal" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
            <button className="welcome-modal-close" type="button" aria-label="Close welcome setup" autoFocus onClick={() => setWelcomeOpen(false)}><X size={18} /></button>
            <div className="welcome-modal-kicker"><GraduationCap size={17} /> Classroom welcome</div>
            <h2 id="welcome-title">Show everyone how the room works in about a minute.</h2>
            <p className="welcome-modal-copy">The projector leads the class through joining, privacy, and one real pulse. You control each step from this screen.</p>

            <div className="welcome-steps-preview">
              {welcomeLabels.map((label, index) => (
                <article key={label}>
                  <span>{index + 1}</span>
                  <div><strong>{label}</strong><small>{index === 0 ? 'Students connect by phone' : index === 1 ? 'Set the participation norms' : 'Everyone sends one signal'}</small></div>
                  <CheckCircle2 size={17} />
                </article>
              ))}
            </div>

            <div className="welcome-modal-note"><Lock size={15} /><span><strong>Safe by default</strong> The projector only shows class-level activity.</span></div>
            <div className="welcome-modal-actions">
              <button type="button" onClick={openStudentView}><Smartphone size={17} /> Preview student phone</button>
              <button className="welcome-start" type="button" onClick={startWelcome}><Play size={17} /> Start class welcome</button>
            </div>
          </section>
        </div>
      )}

      {sessionPlanOpen && (
        <div className="session-plan-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSessionPlanOpen(false);
        }}>
          <section className="session-plan-drawer" role="dialog" aria-modal="true" aria-labelledby="session-plan-title">
            <header>
              <div>
                <span className="seminar-eyebrow">{sessionContext.courseCode} · {sessionContext.sessionTitle}</span>
                <h2 id="session-plan-title">Session plan</h2>
                <p>Prepared interactions stay private until you show one.</p>
              </div>
              <button type="button" aria-label="Close session plan" onClick={() => setSessionPlanOpen(false)}><X size={19} /></button>
            </header>

            <div className="session-plan-companion">
              <Laptop size={19} />
              <div><strong>Presentation companion mode</strong><span>Your slides remain in their original app.</span></div>
              <span>Separate</span>
            </div>

            <div className="session-plan-list">
              {sessionPlan.map((interaction, index) => (
                <article key={interaction.id} className={activeInteraction?.id === interaction.id ? 'is-live' : ''}>
                  <div className="session-plan-index">{String(index + 1).padStart(2, '0')}</div>
                  <div className="session-plan-copy">
                    <span><CalendarDays size={13} /> {interaction.plannedTime} · {interaction.label}</span>
                    <strong>{interaction.title}</strong>
                    <p>{interaction.prompt}</p>
                  </div>
                  <button type="button" onClick={() => launchInteraction(interaction)}>{activeInteraction?.id === interaction.id ? 'Showing' : 'Show'} <ArrowRight size={14} /></button>
                </article>
              ))}
            </div>

            <footer className={unplannedQuestionOpen ? 'is-writing-question' : ''}>
              {unplannedQuestionOpen ? (
                <div className="unplanned-question-form">
                  <label htmlFor="unplanned-question">Ask the room now</label>
                  <div><input id="unplanned-question" autoFocus value={unplannedQuestion} onChange={(event) => setUnplannedQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') launchUnplannedQuestion(); }} placeholder="What do you want to ask?" /><button type="button" onClick={launchUnplannedQuestion} disabled={!unplannedQuestion.trim()}>Show now <ArrowRight size={14} /></button></div>
                </div>
              ) : <button type="button" onClick={() => setUnplannedQuestionOpen(true)}><MessageCircle size={16} /> Ask something unplanned</button>}
            </footer>
          </section>
        </div>
      )}

      {attendanceOpen && (
        <div className="attendance-panel-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setAttendanceOpen(false);
        }}>
          <section className="attendance-panel" role="dialog" aria-modal="true" aria-labelledby="attendance-title">
            <header>
              <div>
                <span className="seminar-eyebrow">Live register</span>
                <h2 id="attendance-title">Attendance</h2>
                <p>{attendanceClaims.length} joined · {participatedStudents} participated</p>
              </div>
              <button type="button" aria-label="Close attendance" onClick={() => setAttendanceOpen(false)}><X size={19} /></button>
            </header>

            <div className="attendance-explainer">
              <ClipboardCheck size={18} />
              <p><strong>Joined</strong> means the student entered a number. <strong>Participated</strong> means they also answered in this session.</p>
            </div>

            <div className="attendance-list">
              {sortedAttendanceClaims.length === 0 ? (
                <div className="attendance-empty">
                  <Users size={24} />
                  <strong>No attendance claims yet</strong>
                  <p>Students appear here after they enter the class code and their student number.</p>
                </div>
              ) : sortedAttendanceClaims.map((claim) => (
                <article key={claim.studentUid}>
                  <span className={`attendance-status-dot is-${claim.status}`} aria-hidden="true" />
                  <div>
                    <strong>{claim.studentNumber}</strong>
                    <small>Joined {new Date(claim.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                  </div>
                  <span className={`attendance-status is-${claim.status}`}>{claim.status === 'participated' ? 'Participated' : claim.status === 'confirmed' ? 'Confirmed' : claim.status === 'excused' ? 'Excused' : 'Joined'}</span>
                </article>
              ))}
            </div>

            <footer>Student numbers are visible only to the instructor.</footer>
          </section>
        </div>
      )}

      {onboardingStep > 0 && (
        <section className={`welcome-controller ${onboardingStep === 4 ? 'is-complete' : ''}`} aria-label="Class welcome controls">
          <div className="welcome-controller-status">
            <span className="welcome-controller-icon">{onboardingStep === 4 ? <CheckCircle2 size={19} /> : <GraduationCap size={19} />}</span>
            <div>
              <small>{onboardingStep === 4 ? 'Welcome complete' : `Welcome · Step ${onboardingStep} of 3`}</small>
              <strong>{onboardingStep === 4 ? 'The class is ready to begin' : welcomeLabels[onboardingStep - 1]}</strong>
            </div>
          </div>
          <div className="welcome-controller-progress" aria-label={`Step ${Math.min(onboardingStep, 3)} of 3`}>
            {[1, 2, 3].map((step) => <i className={step <= onboardingStep ? 'is-filled' : ''} key={step} />)}
          </div>
          <div className="welcome-controller-actions">
            {onboardingStep < 4 && <button type="button" className="welcome-phone" onClick={openStudentView}><Smartphone size={16} /> Student view</button>}
            {onboardingStep > 1 && onboardingStep < 4 && <button type="button" onClick={() => setOnboardingStep((current) => (Math.max(1, current - 1) as OnboardingStep))}><ChevronLeft size={16} /> Back</button>}
            {onboardingStep < 4 ? (
              <button type="button" className="welcome-next" onClick={advanceWelcome}>{onboardingStep === 3 ? 'Finish welcome' : 'Next'} <ArrowRight size={16} /></button>
            ) : (
              <button type="button" className="welcome-next" onClick={endWelcome}>Return to lesson <ArrowRight size={16} /></button>
            )}
            <button className="welcome-end" type="button" aria-label="End class welcome" onClick={endWelcome}><X size={16} /></button>
          </div>
        </section>
      )}

      {toast && <div className="seminar-toast" role="status">{toast}</div>}
      {floatingRemoteWindow && !floatingRemoteWindow.closed && createPortal(
        <ClassfullyRemote
          session={sessionContext}
          plan={sessionPlan}
          activeInteraction={activeInteraction}
          results={interactionResults}
          connectedStudents={connectedStudents}
          questionCount={classQuestions.length}
          displayConnected={displayConnected}
          onLaunch={launchInteraction}
          onToggleResponses={toggleInteractionResponses}
          onReveal={revealInteractionResults}
          onFinish={returnToSlides}
          onOpenDisplay={openClassroomDisplay}
          onOpenConsole={() => window.focus()}
        />,
        floatingRemoteWindow.document.body,
      )}
    </div>
  );
}
