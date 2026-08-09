'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Radio } from 'lucide-react';
import ClassfullyRemote from '@/components/live/ClassfullyRemote';
import { useAuth } from '@/lib/hooks/useAuth';
import { getSession } from '@/lib/firebase/firestore';
import {
  publishInstructorState,
  subscribeToInstructorDisplayPresence,
  subscribeToInstructorPresence,
  subscribeToInstructorPublicState,
} from '@/lib/firebase/live-classroom';
import {
  DEMO_LIVE_INTERACTIONS,
  DEMO_SESSION,
  EMPTY_ONBOARDING_COUNTS,
  HISTORY,
  LESSON_CHANNEL,
  LESSON_STORAGE_KEY,
  createInteractionResults,
  prepareLiveInteractions,
  type LessonDisplayState,
  type LiveInteraction,
  type LiveSessionContext,
} from '../live-data';
import './remote.css';

function protectStudentView(state: LessonDisplayState): LessonDisplayState {
  let publicInteraction = state.activeInteraction;
  if (publicInteraction?.type === 'quiz' && !state.interactionResults?.revealed) {
    publicInteraction = { ...publicInteraction };
    delete publicInteraction.correctOptionIndex;
    delete publicInteraction.explanation;
  }
  return { ...state, activeInteraction: publicInteraction, updatedAt: Date.now() };
}

function createDemoState(): LessonDisplayState {
  return {
    session: DEMO_SESSION,
    counts: HISTORY[0].counts,
    comparisonCounts: HISTORY[1].counts,
    incomingMood: null,
    paused: false,
    playingHistory: false,
    selectedWeek: 0,
    showComparison: true,
    onboardingStep: 0,
    onboardingRunId: 0,
    onboardingMoodCounts: EMPTY_ONBOARDING_COUNTS,
    activeInteraction: null,
    interactionResults: null,
    featuredQuestionId: null,
    questions: [],
    timer: null,
    updatedAt: Date.now(),
  };
}

export default function InstructorRemotePage() {
  const { user, loading: authLoading } = useAuth();
  const [sessionContext, setSessionContext] = useState<LiveSessionContext>(DEMO_SESSION);
  const [plan, setPlan] = useState<LiveInteraction[]>(DEMO_LIVE_INTERACTIONS);
  const [state, setState] = useState<LessonDisplayState>(() => createDemoState());
  const [connectedStudents, setConnectedStudents] = useState(148);
  const [displayConnected, setDisplayConnected] = useState(false);
  const [syncConnected, setSyncConnected] = useState(true);
  const [error, setError] = useState('');
  const channelRef = useRef<BroadcastChannel | null>(null);
  const stateRef = useRef(state);
  const [classroomIds, setClassroomIds] = useState<{ sessionId: string; ownerUid: string } | null>(null);

  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('sessionId');
    const ownerUid = params.get('ownerUid');

    if (!sessionId || !ownerUid) {
      const stored = window.localStorage.getItem(LESSON_STORAGE_KEY);
      if (stored) {
        try { setState(JSON.parse(stored) as LessonDisplayState); } catch { /* Keep the demo state. */ }
      }
      const channel = new BroadcastChannel(LESSON_CHANNEL);
      channelRef.current = channel;
      channel.onmessage = (event: MessageEvent<{ type?: string; state?: LessonDisplayState }>) => {
        if (event.data?.type === 'lesson-state' && event.data.state) setState(event.data.state);
      };
      channel.postMessage({ type: 'instructor-ready' });
      return () => channel.close();
    }

    if (authLoading) return;
    if (!user) {
      setError('Sign in as the instructor, then open the remote from your live class.');
      return;
    }
    if (user.uid !== ownerUid) {
      setError('This remote belongs to another instructor.');
      return;
    }

    let stopped = false;
    const cleanups: Array<() => void> = [];
    getSession(sessionId).then((session) => {
      if (stopped || !session || session.teacherId !== user.uid) {
        if (!stopped) setError('This live session could not be opened.');
        return;
      }
      const prepared = prepareLiveInteractions(session.interactions);
      const context: LiveSessionContext = {
        sessionId,
        ownerUid,
        instructorName: user.name || user.email?.split('@')[0] || 'Your instructor',
        sessionCode: session.sessionCode,
        courseCode: session.courseCode || 'Class',
        courseName: session.courseName || '',
        sessionTitle: session.title || 'Live session',
      };
      setPlan(prepared);
      setSessionContext(context);
      setClassroomIds({ sessionId, ownerUid });
      setConnectedStudents(0);
      cleanups.push(subscribeToInstructorPublicState(ownerUid, sessionId, (remoteState) => {
        setSyncConnected(Boolean(remoteState));
        if (!remoteState) return;
        const privateInteraction = remoteState.activeInteraction
          ? prepared.find((interaction) => interaction.id === remoteState.activeInteraction?.id)
            || remoteState.activeInteraction
          : null;
        setState({ ...remoteState, activeInteraction: privateInteraction });
      }));
      cleanups.push(subscribeToInstructorPresence(ownerUid, sessionId, setConnectedStudents));
      cleanups.push(subscribeToInstructorDisplayPresence(ownerUid, sessionId, setDisplayConnected));
    }).catch(() => setError('The remote could not connect to this live session.'));

    return () => {
      stopped = true;
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [authLoading, user]);

  const updateRemoteState = useCallback((updater: (current: LessonDisplayState) => LessonDisplayState) => {
    const next = { ...updater(stateRef.current), updatedAt: Date.now() };
    stateRef.current = next;
    setState(next);
    if (classroomIds) {
      publishInstructorState(classroomIds.ownerUid, classroomIds.sessionId, protectStudentView(next))
        .then(() => setSyncConnected(true))
        .catch(() => setSyncConnected(false));
    } else {
      const publicState = protectStudentView(next);
      window.localStorage.setItem(LESSON_STORAGE_KEY, JSON.stringify(publicState));
      channelRef.current?.postMessage({ type: 'lesson-state', state: publicState });
    }
  }, [classroomIds]);

  const sendDemoCommand = (command: 'launch' | 'toggle-responses' | 'reveal' | 'finish', interactionId?: string) => {
    channelRef.current?.postMessage({ type: 'instructor-remote-command', command, interactionId });
  };

  const launch = (interaction: LiveInteraction) => {
    updateRemoteState((current) => ({
      ...current,
      activeInteraction: interaction,
      interactionResults: createInteractionResults(interaction),
    }));
    if (!classroomIds) sendDemoCommand('launch', interaction.id);
  };

  const toggleResponses = () => {
    updateRemoteState((current) => ({
      ...current,
      interactionResults: current.interactionResults
        ? { ...current.interactionResults, open: !current.interactionResults.open }
        : null,
    }));
    if (!classroomIds) sendDemoCommand('toggle-responses');
  };

  const reveal = () => {
    updateRemoteState((current) => ({
      ...current,
      interactionResults: current.interactionResults
        ? { ...current.interactionResults, open: false, revealed: true }
        : null,
    }));
    if (!classroomIds) sendDemoCommand('reveal');
  };

  const finish = () => {
    updateRemoteState((current) => ({ ...current, activeInteraction: null, interactionResults: null }));
    if (!classroomIds) sendDemoCommand('finish');
  };

  const featureQuestion = (questionId: number) => {
    updateRemoteState((current) => ({
      ...current,
      featuredQuestionId: current.featuredQuestionId === questionId ? null : questionId,
    }));
  };

  const launchUnplanned = (prompt: string) => {
    launch({
      id: `unplanned-${Date.now()}`,
      type: 'open-response',
      label: 'Short response',
      title: 'Unplanned question',
      prompt,
      resultVisibility: 'instructor-only',
      plannedTime: 'Asked live',
    });
  };

  const startTimer = (durationSeconds: number) => {
    updateRemoteState((current) => ({
      ...current,
      timer: {
        id: `timer-${Date.now()}`,
        label: 'Class timer',
        durationSeconds,
        endsAt: Date.now() + durationSeconds * 1000,
      },
    }));
  };

  const clearTimer = () => {
    updateRemoteState((current) => ({ ...current, timer: null }));
  };

  const openDisplay = () => {
    const url = classroomIds
      ? `/live/display?sessionId=${encodeURIComponent(classroomIds.sessionId)}&ownerUid=${encodeURIComponent(classroomIds.ownerUid)}`
      : '/live/display';
    window.open(url, 'living-seminar-classroom-display', 'popup=yes,width=1600,height=900');
  };

  const openConsole = () => {
    if (window.opener && !window.opener.closed) {
      window.opener.focus();
      return;
    }
    const url = classroomIds ? `/live?sessionId=${encodeURIComponent(classroomIds.sessionId)}` : '/live';
    window.location.assign(url);
  };

  if (authLoading && new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search).has('sessionId')) {
    return <div className="remote-route-message"><Radio size={22} /><strong>Connecting to your class</strong><span>Preparing the teaching controls.</span></div>;
  }

  if (error) {
    return (
      <div className="remote-route-message is-error">
        <div className="remote-route-brand">Classfully<span>.</span></div>
        <strong>Remote unavailable</strong>
        <span>{error}</span>
        <button type="button" onClick={() => window.location.assign('/login')}>Go to sign in <ArrowRight size={16} /></button>
      </div>
    );
  }

  return (
    <ClassfullyRemote
      session={sessionContext}
      plan={plan}
      activeInteraction={state.activeInteraction}
      results={state.interactionResults}
      connectedStudents={connectedStudents}
      questionCount={state.questions.length}
      questions={state.questions}
      featuredQuestionId={state.featuredQuestionId}
      displayConnected={displayConnected}
      timer={state.timer}
      syncConnected={syncConnected}
      onLaunch={launch}
      onToggleResponses={toggleResponses}
      onReveal={reveal}
      onFinish={finish}
      onOpenDisplay={openDisplay}
      onOpenConsole={openConsole}
      onFeatureQuestion={featureQuestion}
      onLaunchUnplanned={launchUnplanned}
      onStartTimer={startTimer}
      onClearTimer={clearTimer}
    />
  );
}
