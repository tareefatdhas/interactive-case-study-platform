'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import ClassfullyRemote from '@/components/live/ClassfullyRemote';
import ClassroomStateGate from '@/components/live/ClassroomStateGate';
import { useAuth } from '@/lib/hooks/useAuth';
import { getSession } from '@/lib/firebase/firestore';
import {
  publishInstructorState,
  getInstructorClassroomRecords,
  subscribeToInstructorDisplayPresence,
  subscribeToInstructorPresence,
  subscribeToInstructorPublicState,
  setInstructorQuestionDismissed,
  setInstructorQuestionRecognized,
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
  type LiveQuestion,
  type LiveSessionContext,
} from '../live-data';
import './remote.css';

function protectStudentView(state: LessonDisplayState): LessonDisplayState {
  let publicInteraction = state.activeInteraction;
  if ((publicInteraction?.type === 'quiz' || publicInteraction?.type === 'peer-learning') && !state.interactionResults?.revealed) {
    publicInteraction = { ...publicInteraction };
    delete publicInteraction.correctOptionIndex;
    delete publicInteraction.explanation;
  }
  return { ...state, activeInteraction: publicInteraction, updatedAt: Date.now() };
}

function createDemoState(): LessonDisplayState {
  return {
    session: DEMO_SESSION,
    lobbyOpen: false,
    connectedStudents: 0,
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
    teams: [],
    timer: null,
    updatedAt: Date.now(),
  };
}

export default function InstructorRemotePage() {
  const { user, loading: authLoading } = useAuth();
  const [sessionContext, setSessionContext] = useState<LiveSessionContext>(DEMO_SESSION);
  const [plan, setPlan] = useState<LiveInteraction[]>(DEMO_LIVE_INTERACTIONS);
  const [state, setState] = useState<LessonDisplayState>(() => createDemoState());
  const [classroomStateReady, setClassroomStateReady] = useState(false);
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
        if (event.data?.type === 'lesson-state' && event.data.state) {
          const privateInteraction = event.data.state.activeInteraction
            ? DEMO_LIVE_INTERACTIONS.find((interaction) => interaction.id === event.data.state?.activeInteraction?.id) || event.data.state.activeInteraction
            : null;
          setState({ ...event.data.state, activeInteraction: privateInteraction });
        }
      };
      channel.postMessage({ type: 'instructor-ready' });
      setClassroomStateReady(true);
      return () => channel.close();
    }

    if (authLoading) return;
    if (!user) {
      setError('Sign in as the instructor, then open the remote from your live class.');
      setClassroomStateReady(true);
      return;
    }
    if (user.uid !== ownerUid) {
      setError('This remote belongs to another instructor.');
      setClassroomStateReady(true);
      return;
    }

    let stopped = false;
    const cleanups: Array<() => void> = [];
    getSession(sessionId).then((session) => {
      if (stopped || !session || session.teacherId !== user.uid) {
        if (!stopped) {
          setError('This live session could not be opened.');
          setClassroomStateReady(true);
        }
        return;
      }
      const prepared = prepareLiveInteractions(session.interactions);
      const context: LiveSessionContext = {
        sessionId,
        ...(session.courseId ? { courseId: session.courseId } : {}),
        ownerUid,
        instructorName: user.name || user.email?.split('@')[0] || 'Your instructor',
        sessionCode: session.sessionCode,
        courseCode: session.courseCode || 'Class',
        rewardScopeId: session.rewardScopeId || session.courseCode || 'Class',
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
        setClassroomStateReady(true);
      }));
      cleanups.push(subscribeToInstructorPresence(ownerUid, sessionId, setConnectedStudents));
      cleanups.push(subscribeToInstructorDisplayPresence(ownerUid, sessionId, setDisplayConnected));
    }).catch(() => {
      setError('The remote could not connect to this live session.');
      setClassroomStateReady(true);
    });

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

  const sendDemoCommand = (command: 'launch' | 'toggle-responses' | 'reveal' | 'advance-module' | 'finish', interactionId?: string) => {
    channelRef.current?.postMessage({ type: 'instructor-remote-command', command, interactionId });
  };

  const launch = async (interaction: LiveInteraction) => {
    let wheelItems = interaction.wheelItems || [];
    let wheelItemColors: string[] | undefined;
    if (interaction.type === 'spin-wheel') {
      if (interaction.wheelSource === 'teams') {
        const uniqueTeams = stateRef.current.teams.filter((team, index, all) => team.name.trim() && all.findIndex((candidate) => candidate.name.trim().toLocaleLowerCase() === team.name.trim().toLocaleLowerCase()) === index).slice(0, 40);
        wheelItems = uniqueTeams.map((team) => team.name);
        const colors: Record<string, string> = { violet: '#5b4ce6', blue: '#2f73df', teal: '#238b78', green: '#3d9456', gold: '#d99f18', coral: '#df664e', pink: '#c85f92', navy: '#24366f' };
        wheelItemColors = uniqueTeams.map((team) => colors[team.color || ''] || '#5146e5');
      } else if ((interaction.wheelSource || 'students') === 'students' && classroomIds) {
        const records = await getInstructorClassroomRecords(classroomIds.ownerUid, classroomIds.sessionId).catch(() => null);
        wheelItems = Object.values(records?.attendance || {}).flatMap((claim) => {
          if (claim.studentDisplayName?.trim()) return [claim.studentDisplayName.trim()];
          if (claim.studentNumber) return [`Student •${claim.studentNumber.slice(-4)}`];
          return [];
        });
      }
      wheelItems = [...new Set(wheelItems.map((item) => item.trim()).filter(Boolean))].slice(0, 40);
    }
    updateRemoteState((current) => ({
      ...current,
      activeInteraction: interaction,
      interactionResults: interaction.type === 'spin-wheel'
        ? { ...createInteractionResults(interaction), wheelItems, wheelItemColors }
        : createInteractionResults(interaction),
      timer: interaction.type === 'timer' || interaction.type === 'group-work' ? {
        id: `timer-${Date.now()}`,
        label: interaction.type === 'group-work' ? 'Group work' : interaction.title,
        durationSeconds: (interaction.durationMinutes || 5) * 60,
        endsAt: Date.now() + (interaction.durationMinutes || 5) * 60 * 1000,
      } : null,
    }));
    if (!classroomIds) sendDemoCommand('launch', interaction.id);
  };

  const spinWheel = () => {
    updateRemoteState((current) => {
      if (current.activeInteraction?.type !== 'spin-wheel' || !current.interactionResults) return current;
      const results = current.interactionResults;
      const items = current.activeInteraction.wheelRemoveSelected !== false && results.wheelSelectedLabel
        ? (results.wheelItems || []).filter((item) => item !== results.wheelSelectedLabel)
        : results.wheelItems || [];
      const itemColors = current.activeInteraction.wheelRemoveSelected !== false && results.wheelSelectedLabel
        ? (results.wheelItemColors || []).filter((_, index) => (results.wheelItems || [])[index] !== results.wheelSelectedLabel)
        : results.wheelItemColors;
      if (!items.length) return current;
      const random = new Uint32Array(1);
      window.crypto.getRandomValues(random);
      const selectedIndex = random[0] % items.length;
      const sector = 360 / items.length;
      const currentRotation = results.wheelRotation || 0;
      const target = 360 - (selectedIndex * sector + sector / 2);
      const delta = (target - (currentRotation % 360) + 360) % 360;
      return {
        ...current,
        interactionResults: {
          ...results,
          wheelItems: items,
          wheelItemColors: itemColors,
          wheelSelectedIndex: selectedIndex,
          wheelSelectedLabel: items[selectedIndex],
          wheelSpinCount: (results.wheelSpinCount || 0) + 1,
          wheelRotation: currentRotation + 5 * 360 + delta,
          wheelHistory: [...(results.wheelHistory || []), items[selectedIndex]].slice(-40),
        },
      };
    });
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

  const advanceModule = () => {
    updateRemoteState((current) => {
      if (current.activeInteraction?.type !== 'peer-learning' || !current.interactionResults) return current;
      const results = current.interactionResults;
      if (results.phase === 'respond') {
        const durationSeconds = (current.activeInteraction.discussionMinutes || 2) * 60;
        return {
          ...current,
          interactionResults: { ...results, open: false, phase: 'discuss', firstResponseCount: results.responseCount, firstOptionCounts: results.optionCounts },
          timer: { id: `peer-discussion-${Date.now()}`, label: 'Partner discussion', durationSeconds, endsAt: Date.now() + durationSeconds * 1000 },
        };
      }
      if (results.phase === 'discuss') {
        return {
          ...current,
          interactionResults: { ...results, runId: `${current.activeInteraction.id}-${Date.now()}-again`, open: true, responseCount: 0, optionCounts: current.activeInteraction.options?.map(() => 0) || [], writtenResponses: [], phase: 'respond-again' },
          timer: null,
        };
      }
      return { ...current, interactionResults: { ...results, open: false, revealed: true, phase: 'complete' }, timer: null };
    });
    if (!classroomIds) sendDemoCommand('advance-module');
  };

  const finish = () => {
    updateRemoteState((current) => ({ ...current, activeInteraction: null, interactionResults: null, timer: current.activeInteraction?.type === 'timer' || current.activeInteraction?.type === 'group-work' || current.activeInteraction?.type === 'peer-learning' ? null : current.timer }));
    if (!classroomIds) sendDemoCommand('finish');
  };

  const featureQuestion = (questionId: number) => {
    const isBeingFeatured = state.featuredQuestionId !== questionId;
    const updateQuestionDisplay = () => updateRemoteState((current) => ({
        ...current,
        featuredQuestionId: current.featuredQuestionId === questionId ? null : questionId,
      }));
    if (!isBeingFeatured || !classroomIds) {
      updateQuestionDisplay();
      return;
    }
    void setInstructorQuestionRecognized(classroomIds.ownerUid, classroomIds.sessionId, questionId)
      .then(updateQuestionDisplay)
      .catch(updateQuestionDisplay);
  };

  const moderateQuestion = async (question: LiveQuestion, dismissed: boolean) => {
    if (classroomIds) {
      await setInstructorQuestionDismissed(
        classroomIds.ownerUid,
        classroomIds.sessionId,
        question.id,
        dismissed,
      );
    }
    updateRemoteState((current) => ({
      ...current,
      questions: dismissed
        ? current.questions.filter((item) => item.id !== question.id)
        : current.questions.some((item) => item.id === question.id)
          ? current.questions
          : [question, ...current.questions],
      featuredQuestionId: dismissed && current.featuredQuestionId === question.id
        ? null
        : current.featuredQuestionId,
    }));
    if (!classroomIds) {
      channelRef.current?.postMessage({
        type: 'instructor-question-dismiss',
        questionId: question.id,
        question,
        dismissed,
      });
    }
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

  if (authLoading || !classroomStateReady) {
    return <ClassroomStateGate title="Preparing your teaching controls" message="Loading the current activity and classroom status." />;
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
      onAdvanceModule={advanceModule}
      onSpinWheel={spinWheel}
      onFinish={finish}
      onOpenDisplay={openDisplay}
      onOpenConsole={openConsole}
      onFeatureQuestion={featureQuestion}
      onDismissQuestion={moderateQuestion}
      onLaunchUnplanned={launchUnplanned}
      onStartTimer={startTimer}
      onClearTimer={clearTimer}
    />
  );
}
