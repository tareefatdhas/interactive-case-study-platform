'use client';

import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { IconContext, Pulse as Activity, ArrowRight, ArrowFatUp as ArrowUp, Medal as Award, Check, CaretDown as ChevronDown, ClipboardText as ClipboardCheck, Fire as Flame, Gift, Heartbeat as HeartPulse, ListChecks, LockKey as Lock, ChatCircleDots as MessageCircle, PaperPlaneTilt as Send, ShieldCheck, Sparkle as Sparkles, Trophy, UsersThree as Users } from '@phosphor-icons/react';
import HapticButton from '@/components/student/HapticButton';
import {
  getStudentQuestionVotes,
  getStudentResponse,
  getStudentWelcomeResponse,
  joinStudentPresence,
  setStudentQuestionVote,
  submitStudentInteractionResponse,
  submitStudentWelcomeResponse,
  subscribeToStudentPublicState,
} from '@/lib/firebase/live-classroom';
import { ensureStudentAnonymousAuth } from '@/lib/firebase/student-config';
import {
  EMPTY_ONBOARDING_COUNTS,
  DEFAULT_LIVE_QUESTIONS,
  DEMO_SESSION,
  HISTORY,
  LESSON_CHANNEL,
  LESSON_STORAGE_KEY,
  MOODS,
  type LessonDisplayState,
  type InteractionResponse,
  type LiveInteraction,
  type LiveQuestion,
  type MoodKey,
} from '../live-data';
import './student.css';
import {
  COURSE_REWARDS,
  applyReward,
  createInitialRewardState,
  loadRewardState,
  requestCourseReward,
  saveRewardState,
  type CourseReward,
  type RewardBalance,
  type RewardLedgerEntry,
  type StudentRewardState,
} from './rewards';

const DEFAULT_STATE: LessonDisplayState = {
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
  questions: DEFAULT_LIVE_QUESTIONS,
  updatedAt: Date.now(),
};

const ParticipationSignal = dynamic(() => import('@/components/live/ParticipationSignal'), { ssr: false });

const OPTION_COLORS = ['#5146e5', '#2f73df', '#d99f18', '#df664e', '#2f8b63'];

function confirmResponseHaptic() {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  navigator.vibrate(12);
}

type TransportSignal = {
  id: number;
  color: string;
  x: number;
  y: number;
  phase: 'gathering' | 'departing' | 'failed';
};

function StudentTransportSignal({ signal }: { signal: TransportSignal }) {
  return (
    <div
      className={`student-transport is-${signal.phase}`}
      style={{
        '--transport-color': signal.color,
        '--transport-x': `${signal.x}px`,
        '--transport-y': `${signal.y}px`,
      } as CSSProperties}
      role="status"
      aria-live="polite"
    >
      <div className="student-transport-portal"><i /><span>{signal.phase === 'gathering' ? 'Sending to the room' : signal.phase === 'departing' ? 'Added to the room' : 'Could not send'}</span></div>
      <i className="student-transport-thread" />
      <i className="student-transport-orb" />
      <i className="student-transport-origin" />
    </div>
  );
}

function studentSignalStyle(index: number): CSSProperties {
  const x = (index * 31 + 7) % 94;
  const y = 50 + Math.sin(index * 1.35) * 28;
  return {
    '--room-x': `${x}%`,
    '--room-y': `${Math.max(12, Math.min(86, y))}%`,
    '--room-size': `${4 + (index % 4)}px`,
  } as CSSProperties;
}

function StudentRoomCurrent({ responseCount, runId }: { responseCount: number; runId: string }) {
  const visiblePoints = Math.min(responseCount, 36);
  return (
    <div className="student-room-current" aria-hidden="true">
      <Image src="/assets/living-seminar/room-forming.png" alt="" width={2079} height={756} priority />
      <svg viewBox="0 0 420 130" preserveAspectRatio="none">
        <path d="M-10 83 C82 20 145 114 222 59 S342 32 430 73" />
        <path d="M-14 45 C68 105 159 9 245 70 S362 105 438 35" />
      </svg>
      <div className="student-room-points">
        {Array.from({ length: visiblePoints }).map((_, index) => (
          <i key={`${runId}-${index}`} style={studentSignalStyle(index)} />
        ))}
      </div>
      {responseCount > 0 && <i className="student-room-arrival" key={`student-arrival-${responseCount}`} />}
    </div>
  );
}

function StudentPostSubmit({
  interaction,
  answer,
  questions,
  selectedQuestionVotes,
  onToggleQuestion,
  confidence,
  onConfidence,
  prediction,
  onPrediction,
  revealed,
  responseCount,
  runId,
  optionCounts,
  rewardState,
  latestReward,
}: {
  interaction: LiveInteraction;
  answer: string;
  questions: LiveQuestion[];
  selectedQuestionVotes: number[];
  onToggleQuestion: (questionId: number) => void;
  confidence: string | null;
  onConfidence: (confidence: string) => void;
  prediction: number | null;
  onPrediction: (optionIndex: number) => void;
  revealed: boolean;
  responseCount: number;
  runId: string;
  optionCounts: number[];
  rewardState: StudentRewardState;
  latestReward: RewardLedgerEntry | null;
}) {
  const showQuestionCommons = questions.length > 0
    && (interaction.type === 'quiz' || interaction.type === 'open-response');
  const roomChoice = optionCounts.length
    ? optionCounts.reduce((bestIndex, value, index) => value > (optionCounts[bestIndex] ?? -1) ? index : bestIndex, 0)
    : null;

  return (
    <div className="student-after-response">
      <div className="student-response-confirmation" role="status"><Check size={19} /><strong>Response sent</strong></div>

      <div className={`student-reward-arrival ${latestReward ? 'is-arriving' : ''}`} aria-live="polite">
        <ParticipationSignal active={Boolean(latestReward)} />
        <span><Sparkles size={17} /></span>
        <div>
          <small>{latestReward?.label || 'Seminar points'}</small>
          <strong>{latestReward ? `+${latestReward.amount} ${latestReward.balance === 'score' ? 'class score' : 'seminar points'}` : `${rewardState.seminarPoints} seminar points`}</strong>
        </div>
        <b>{latestReward?.balance === 'score' ? rewardState.classScore : rewardState.seminarPoints}</b>
      </div>

      <details className="student-answer-summary">
        <summary><ClipboardCheck size={19} /><span>Your answer: <strong>{answer}</strong></span><ChevronDown size={19} /></summary>
        <p>Your response is saved. You can look up while the rest of the room answers.</p>
      </details>

      {revealed && interaction.type === 'quiz' && (
        <div className="student-answer-reveal"><Check size={17} /><span><strong>The answer is out.</strong> {interaction.explanation || 'Look up for the class explanation.'}</span></div>
      )}

      {showQuestionCommons ? (
        <section className="student-waiting-activity" aria-labelledby="question-commons-title">
          <div className="student-kicker">Questions from the room</div>
          <h2 id="question-commons-title">While the room responds.</h2>
          <p>See what others are wondering. Upvote one you want discussed.</p>
          <div className="student-anonymous-note"><Users size={18} /><span>Questions are anonymous to classmates and visible to your instructor.</span></div>
          <div className="student-question-commons">
            {questions.slice(0, 2).map((question) => {
              const selected = selectedQuestionVotes.includes(question.id);
              return (
                <article key={question.id}>
                  <HapticButton
                    type="button"
                    depth="compact"
                    className={selected ? 'is-voted' : ''}
                    aria-pressed={selected}
                    aria-label={`${selected ? 'Remove upvote from' : 'Upvote'} question. ${question.votes} votes.`}
                    onClick={() => onToggleQuestion(question.id)}
                  >
                    <ArrowUp size={21} />
                    <strong>{question.votes}</strong>
                  </HapticButton>
                  <div><p>{question.question}</p><small>Anonymous to classmates</small></div>
                </article>
              );
            })}
          </div>
        </section>
      ) : interaction.type === 'poll' ? (
        <section className="student-waiting-activity student-private-prompt" aria-labelledby="prediction-title">
          <div className="student-kicker">Private prediction</div>
          <h2 id="prediction-title">{revealed ? 'The room has decided.' : 'What do you think the room chose?'}</h2>
          <p>{revealed ? 'Compare your private prediction with the class result.' : 'Make a prediction before the class result appears. This stays on your phone.'}</p>
          {!revealed && (
            <div className="student-reflection-options">
              {interaction.options?.map((option, index) => (
                <HapticButton
                  type="button"
                  depth="compact"
                  className={prediction === index ? 'is-selected' : ''}
                  onClick={() => onPrediction(index)}
                  key={option}
                  style={{ '--prediction-color': OPTION_COLORS[index % OPTION_COLORS.length] } as CSSProperties}
                >
                  <span>{String.fromCharCode(65 + index)}</span><strong>{option}</strong>{prediction === index && <Check size={17} />}
                </HapticButton>
              ))}
            </div>
          )}
          {prediction !== null && !revealed && (
            <div className="student-prediction-commit" style={{ '--prediction-color': OPTION_COLORS[prediction % OPTION_COLORS.length] } as CSSProperties}>
              <div className="student-prediction-orbit"><i /><span>{String.fromCharCode(65 + prediction)}</span></div>
              <div><small>Your private prediction</small><strong>{interaction.options?.[prediction]}</strong></div>
              <Lock size={15} />
            </div>
          )}
          {revealed && roomChoice !== null && (
            <div className={`student-prediction-result ${prediction === roomChoice ? 'is-match' : ''}`}>
              <div className="student-prediction-comparison">
                <span style={{ '--prediction-color': prediction === null ? '#9298a5' : OPTION_COLORS[prediction % OPTION_COLORS.length] } as CSSProperties}>
                  <i>{prediction === null ? '–' : String.fromCharCode(65 + prediction)}</i><small>You predicted</small>
                </span>
                <div><i /><i /><i /></div>
                <span style={{ '--prediction-color': OPTION_COLORS[roomChoice % OPTION_COLORS.length] } as CSSProperties}>
                  <i>{String.fromCharCode(65 + roomChoice)}</i><small>The room chose</small>
                </span>
              </div>
              <strong>{prediction === roomChoice ? 'You read the room.' : 'The room went another way.'}</strong>
              <small>{interaction.options?.[roomChoice]}</small>
            </div>
          )}
        </section>
      ) : interaction.type === 'quiz' ? (
        <section className="student-waiting-activity student-private-prompt" aria-labelledby="confidence-title">
          <div className="student-kicker">Quick reflection</div>
          <h2 id="confidence-title">How sure were you?</h2>
          <p>Choose one for yourself before the answer appears.</p>
          <div className="student-confidence-options">
            {['A guess', 'Somewhat sure', 'I could explain it'].map((option) => (
              <HapticButton type="button" depth="compact" className={confidence === option ? 'is-selected' : ''} onClick={() => onConfidence(option)} key={option}>
                {option}{confidence === option && <Check size={16} />}
              </HapticButton>
            ))}
          </div>
          {confidence && <div className="student-private-saved"><Lock size={15} /> This reflection stays private</div>}
        </section>
      ) : (
        <section className="student-waiting-activity student-calm-wait" aria-labelledby="room-forming-title">
          <div className="student-kicker">Room forming</div>
          <h2 id="room-forming-title">You’ve done your part.</h2>
          <p>{interaction.type === 'pulse' ? 'Take a breath while the class signal comes together.' : 'Your instructor is reviewing the room’s ideas.'}</p>
        </section>
      )}

      <StudentRoomCurrent responseCount={responseCount} runId={runId} />
      <div className="student-room-status" aria-live="polite">
        <div className="student-live-signal" aria-hidden="true">
          {Array.from({ length: 7 }).map((_, index) => (
            <i className={index < Math.min(7, responseCount) ? 'is-filled' : ''} key={`${responseCount}-${index}`} style={{ '--signal-delay': `${index * 32}ms` } as CSSProperties} />
          ))}
        </div>
        <strong key={responseCount}>{responseCount === 1 ? 'Your response is in' : `${responseCount} responses are in`}</strong>
        <span>Look up when your instructor is ready.</span>
      </div>
    </div>
  );
}

function StudentCourseHome({
  lessonState,
  rewards,
  onRequestReward,
  enableSocialRewards,
}: {
  lessonState: LessonDisplayState;
  rewards: StudentRewardState;
  onRequestReward: (reward: CourseReward) => void;
  enableSocialRewards: boolean;
}) {
  const [view, setView] = useState<'home' | 'standing' | 'rewards'>('home');

  useEffect(() => {
    if (!enableSocialRewards) setView('home');
  }, [enableSocialRewards]);
  const leaderboard = [
    { alias: 'North Star', points: 124 },
    { alias: 'Blue Margin', points: 112 },
    { alias: 'Cedar Note', points: 97 },
    { alias: rewards.alias, points: rewards.seminarPoints, current: true },
    { alias: 'Open Atlas', points: 82 },
  ].sort((a, b) => b.points - a.points);
  const nextReward = COURSE_REWARDS.find((reward) => reward.cost > rewards.seminarPoints) || COURSE_REWARDS[COURSE_REWARDS.length - 1];
  const progress = Math.min(100, Math.round((rewards.seminarPoints / nextReward.cost) * 100));

  return (
    <div className="student-course-home">
      <div className="student-live-ready"><i /><span><strong>You’re in the room.</strong> The next activity will appear here.</span></div>
      <div className="student-kicker">{lessonState.session.courseCode} · Course home</div>
      {enableSocialRewards && <nav className="student-home-tabs" aria-label="Course home sections">
        <button type="button" className={view === 'home' ? 'is-active' : ''} onClick={() => setView('home')}>Home</button>
        <button type="button" className={view === 'standing' ? 'is-active' : ''} onClick={() => setView('standing')}>Standing</button>
        <button type="button" className={view === 'rewards' ? 'is-active' : ''} onClick={() => setView('rewards')}>Rewards</button>
      </nav>}

      {view === 'home' && (
        <>
          <h1>Your semester is taking shape.</h1>
          <p className="student-home-intro">A private record of how you show up, answer, predict, and contribute.</p>
          <section className="student-constellation-card" aria-labelledby="student-progress-title">
            <div className="student-constellation-heading">
              <div><small>Your seminar points</small><strong id="student-progress-title">{rewards.seminarPoints}</strong></div>
              <span><Flame size={16} /><strong>{rewards.classRun}</strong><small>class run</small></span>
            </div>
            <div className="student-constellation-visual">
              <Image src="/assets/living-seminar/room-forming.png" alt="A soft constellation formed by your classroom participation" width={2079} height={756} priority />
              <div className="student-constellation-copy"><Sparkles size={16} /><span><strong>6 learning moments</strong><small>across this course</small></span></div>
            </div>
            {enableSocialRewards ? <div className="student-reward-progress">
              <div><span>Next reward</span><strong>{nextReward.name}</strong></div>
              <small>{Math.max(0, nextReward.cost - rewards.seminarPoints)} points to go</small>
              <i><b style={{ width: `${progress}%` }} /></i>
            </div> : <div className="student-pilot-points"><Lock size={14} /><span><strong>Pilot points stay on this device.</strong> They are feedback, not grades or extra credit.</span></div>}
          </section>
          {enableSocialRewards && <div className="student-home-shortcuts">
            <HapticButton type="button" depth="compact" onClick={() => setView('standing')}><Trophy size={17} /><span><small>Weekly standing</small><strong>Position {leaderboard.findIndex((entry) => entry.current) + 1}</strong></span><ArrowRight size={15} /></HapticButton>
            <HapticButton type="button" depth="compact" onClick={() => setView('rewards')}><Gift size={17} /><span><small>Reward shelf</small><strong>{COURSE_REWARDS.filter((reward) => reward.cost <= rewards.seminarPoints).length} available now</strong></span><ArrowRight size={15} /></HapticButton>
          </div>}
        </>
      )}

      {view === 'standing' && (
        <section className="student-home-section is-panel" aria-labelledby="student-standing-title">
          <div className="student-section-title"><div><span>Weekly standing</span><h2 id="student-standing-title">Around your position</h2></div><Trophy size={19} /></div>
          <p className="student-section-note">Aliases keep the board social without exposing anyone’s grade.</p>
          <div className="student-mini-leaderboard">
            {leaderboard.map((entry, index) => (
              <div className={entry.current ? 'is-current' : ''} key={entry.alias}>
                <span>{index + 1}</span><strong>{entry.current ? `${entry.alias} · You` : entry.alias}</strong><b>{entry.points}</b>
              </div>
            ))}
          </div>
          <div className="student-board-note"><Lock size={14} /> Class scores never appear here.</div>
        </section>
      )}

      {view === 'rewards' && (
        <section className="student-home-section is-panel" aria-labelledby="student-rewards-title">
          <div className="student-section-title"><div><span>Reward shelf</span><h2 id="student-rewards-title">Use points your way</h2></div><Gift size={19} /></div>
          <p className="student-section-note">Requests go to your instructor. Points are only used after approval.</p>
          <div className="student-reward-shelf">
            {COURSE_REWARDS.map((reward) => {
              const pending = rewards.redemptions.some((redemption) => redemption.rewardId === reward.id && redemption.status === 'pending');
              const available = rewards.seminarPoints >= reward.cost;
              return (
                <article key={reward.id}>
                  <span><Award size={18} /></span>
                  <div><strong>{reward.name}</strong><small>{reward.description}</small></div>
                  <HapticButton type="button" depth="compact" hapticTone="action" disabled={!available || pending} onClick={() => onRequestReward(reward)}>
                    {pending ? 'Requested' : `${reward.cost} pts`} {!pending && <ArrowRight size={13} />}
                  </HapticButton>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <div className="student-private-record"><Lock size={14} /><span>{enableSocialRewards ? 'Your balance, class score, and reward history are private.' : 'Your classroom responses and pilot points stay private.'}</span></div>
    </div>
  );
}

export default function StudentWelcomePage() {
  const [lessonState, setLessonState] = useState<LessonDisplayState>(DEFAULT_STATE);
  const [connected, setConnected] = useState(false);
  const [selectedMood, setSelectedMood] = useState<MoodKey | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [writtenResponse, setWrittenResponse] = useState('');
  const [interactionSubmitted, setInteractionSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedQuestionVotes, setSelectedQuestionVotes] = useState<number[]>([]);
  const [confidence, setConfidence] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<number | null>(null);
  const [submissionError, setSubmissionError] = useState('');
  const [remoteSession, setRemoteSession] = useState<{ sessionId: string; ownerUid: string } | null>(null);
  const [remoteUnavailable, setRemoteUnavailable] = useState(false);
  const [rewardScope, setRewardScope] = useState('demo:ECON302');
  const [rewardState, setRewardState] = useState<StudentRewardState>(() => createInitialRewardState(true));
  const [latestReward, setLatestReward] = useState<RewardLedgerEntry | null>(null);
  const [transportSignal, setTransportSignal] = useState<TransportSignal | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const demoVoterIdRef = useRef('');
  const contentRef = useRef<HTMLElement | null>(null);

  const beginTransport = (color: string, origin?: HTMLElement) => {
    const bounds = origin?.getBoundingClientRect();
    const signal: TransportSignal = {
      id: Date.now(),
      color,
      x: bounds ? bounds.left + bounds.width / 2 : window.innerWidth / 2,
      y: bounds ? bounds.top + bounds.height / 2 : window.innerHeight * 0.72,
      phase: 'gathering',
    };
    setTransportSignal(signal);
    return signal.id;
  };

  const completeTransport = (id: number) => {
    setTransportSignal((current) => current?.id === id ? { ...current, phase: 'departing' } : current);
    confirmResponseHaptic();
    window.setTimeout(() => setTransportSignal((current) => current?.id === id ? null : current), 980);
  };

  const failTransport = (id: number) => {
    setTransportSignal((current) => current?.id === id ? { ...current, phase: 'failed' } : current);
    window.setTimeout(() => setTransportSignal((current) => current?.id === id ? null : current), 700);
  };

  useEffect(() => {
    const handleOffline = () => setConnected(false);
    window.addEventListener('offline', handleOffline);
    return () => window.removeEventListener('offline', handleOffline);
  }, []);

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get('sessionId');
    if (sessionId) {
      const ownerUid = new URLSearchParams(window.location.search).get('ownerUid');
      let cancelled = false;
      let stopState: (() => void) | undefined;
      let stopPresence: (() => void) | undefined;

      const connectRemoteClassroom = async () => {
        if (!ownerUid) throw new Error('Classroom link is incomplete.');
        await ensureStudentAnonymousAuth();
        if (cancelled) return;
        setRemoteSession({ sessionId, ownerUid });
        setRewardScope(`${ownerUid}:${sessionId}`);
        stopState = await subscribeToStudentPublicState(ownerUid, sessionId, (state) => {
          if (cancelled) return;
          if (!state) {
            setConnected(false);
            setRemoteUnavailable(true);
            return;
          }
          setRemoteUnavailable(false);
          setRewardScope(`${ownerUid}:${state.session?.courseCode || sessionId}`);
          setLessonState({
            ...DEFAULT_STATE,
            ...state,
            questions: state.questions || [],
            session: state.session || DEFAULT_STATE.session,
          });
          setConnected(true);
        });
        stopPresence = await joinStudentPresence(ownerUid, sessionId);
      };

      connectRemoteClassroom().catch(() => {
        if (!cancelled) {
          setConnected(false);
          setRemoteUnavailable(true);
          setSubmissionError('This classroom is not available yet. Ask your instructor to open the session.');
        }
      });

      return () => {
        cancelled = true;
        stopState?.();
        stopPresence?.();
      };
    }

    const storedState = window.localStorage.getItem(LESSON_STORAGE_KEY);
    if (storedState) {
      try {
        const parsed = JSON.parse(storedState) as Partial<LessonDisplayState>;
        setLessonState({ ...DEFAULT_STATE, ...parsed, session: parsed.session || DEMO_SESSION });
        setConnected(true);
      } catch {
        // Wait for the instructor's next valid state.
      }
    }

    const channel = new BroadcastChannel(LESSON_CHANNEL);
    channelRef.current = channel;
    const savedDemoVoterId = window.localStorage.getItem('living-seminar-demo-student-id');
    demoVoterIdRef.current = savedDemoVoterId || crypto.randomUUID();
    if (!savedDemoVoterId) window.localStorage.setItem('living-seminar-demo-student-id', demoVoterIdRef.current);
    channel.onmessage = (event: MessageEvent<{ type?: string; state?: LessonDisplayState }>) => {
      if (event.data?.type === 'lesson-state' && event.data.state) {
        setLessonState(event.data.state);
        setConnected(true);
      }
    };
    channel.postMessage({ type: 'student-ready' });

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== LESSON_STORAGE_KEY || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as Partial<LessonDisplayState>;
        setLessonState({ ...DEFAULT_STATE, ...parsed, session: parsed.session || DEMO_SESSION });
        setConnected(true);
      } catch {
        // Ignore partial writes.
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
      channel.close();
      channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    setRewardState(loadRewardState(rewardScope, rewardScope.startsWith('demo:')));
  }, [rewardScope]);

  const awardReward = useCallback((eventKey: string, balance: RewardBalance, amount: number, label: string) => {
    setRewardState((current) => {
      const applied = applyReward(current, { eventKey, balance, amount, label });
      if (applied.entry) {
        saveRewardState(rewardScope, applied.state);
        setLatestReward(applied.entry);
      }
      return applied.state;
    });
  }, [rewardScope]);

  useEffect(() => {
    if (!latestReward) return;
    const timeout = window.setTimeout(() => setLatestReward(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [latestReward]);

  useEffect(() => {
    setSelectedMood(null);
    setSubmissionError('');
    if (remoteSession && lessonState.onboardingRunId) {
      getStudentWelcomeResponse(remoteSession.ownerUid, remoteSession.sessionId, lessonState.onboardingRunId)
        .then((response) => {
          if (response) setSelectedMood(response.mood);
        })
        .catch(() => undefined);
    }
  }, [lessonState.onboardingRunId, remoteSession]);

  useEffect(() => {
    setSelectedOption(null);
    setWrittenResponse('');
    setInteractionSubmitted(false);
    setIsSubmitting(false);
    setConfidence(null);
    setPrediction(null);
    setSubmissionError('');

    const runId = lessonState.interactionResults?.runId;
    if (remoteSession && runId) {
      getStudentResponse(remoteSession.ownerUid, remoteSession.sessionId, runId)
        .then((response) => {
          if (!response) return;
          setSelectedOption(response.optionIndex ?? null);
          setWrittenResponse(response.text || '');
          setInteractionSubmitted(true);
        })
        .catch(() => undefined);
    }
  }, [lessonState.interactionResults?.runId, remoteSession]);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    contentRef.current?.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [interactionSubmitted, lessonState.activeInteraction?.id]);

  const questionIdsKey = lessonState.questions.map((question) => question.id).join(',');

  useEffect(() => {
    if (!remoteSession || !questionIdsKey) return;
    getStudentQuestionVotes(
      remoteSession.ownerUid,
      remoteSession.sessionId,
      questionIdsKey.split(',').map(Number),
    ).then(setSelectedQuestionVotes).catch(() => undefined);
  }, [questionIdsKey, remoteSession]);

  const submitMood = async (mood: MoodKey, origin?: HTMLElement) => {
    if (selectedMood || lessonState.onboardingStep !== 3) return;
    const moodColor = MOODS.find((option) => option.key === mood)?.color || '#5146e5';
    const transportId = beginTransport(moodColor, origin);
    setSubmissionError('');
    try {
      if (remoteSession) {
        await submitStudentWelcomeResponse(
          remoteSession.ownerUid,
          remoteSession.sessionId,
          lessonState.onboardingRunId,
          mood,
        );
      } else {
        channelRef.current?.postMessage({ type: 'student-onboarding-response', mood });
      }
      setSelectedMood(mood);
      completeTransport(transportId);
    } catch {
      const saved = remoteSession
        ? await getStudentWelcomeResponse(remoteSession.ownerUid, remoteSession.sessionId, lessonState.onboardingRunId).catch(() => null)
        : null;
      if (saved) {
        setSelectedMood(saved.mood);
        completeTransport(transportId);
      } else {
        failTransport(transportId);
        setSubmissionError('Your pulse was not sent. Check the connection and try again.');
      }
    }
  };

  const submitInteraction = async (origin?: HTMLElement) => {
    const interaction = lessonState.activeInteraction;
    const results = lessonState.interactionResults;
    if (!interaction || !results?.open || interactionSubmitted || isSubmitting) return;

    const response: InteractionResponse = {
      id: crypto.randomUUID(),
      runId: results.runId,
      interactionId: interaction.id,
      optionIndex: selectedOption ?? undefined,
      text: writtenResponse.trim() || undefined,
    };
    const canShowChoiceColor = interaction.resultVisibility === 'live' || interaction.type === 'pulse';
    const transportColor = canShowChoiceColor && selectedOption !== null
      ? OPTION_COLORS[selectedOption % OPTION_COLORS.length]
      : '#6654e9';
    const transportId = beginTransport(transportColor, origin);
    setSubmissionError('');
    setIsSubmitting(true);
    try {
      if (remoteSession) {
        await submitStudentInteractionResponse(remoteSession.ownerUid, remoteSession.sessionId, response);
      } else {
        channelRef.current?.postMessage({ type: 'student-interaction-response', response });
      }
      setInteractionSubmitted(true);
      completeTransport(transportId);
      const participationPoints = interaction.type === 'open-response' ? 3 : interaction.type === 'pulse' ? 1 : 2;
      window.setTimeout(() => {
        awardReward(`${results.runId}:response`, 'seminar', participationPoints, `${interaction.label} response`);
      }, 720);
    } catch {
      const saved = remoteSession
        ? await getStudentResponse(remoteSession.ownerUid, remoteSession.sessionId, results.runId).catch(() => null)
        : null;
      if (saved) {
        setSelectedOption(saved.optionIndex ?? null);
        setWrittenResponse(saved.text || '');
        setInteractionSubmitted(true);
        completeTransport(transportId);
      } else {
        failTransport(transportId);
        setSubmissionError('Your response was not sent. Check the connection and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectPrediction = (optionIndex: number) => {
    if (prediction !== null || lessonState.interactionResults?.revealed) return;
    setPrediction(optionIndex);
    const runId = lessonState.interactionResults?.runId;
    if (runId) awardReward(`${runId}:prediction`, 'seminar', 1, 'Private prediction');
  };

  useEffect(() => {
    const interaction = lessonState.activeInteraction;
    const results = lessonState.interactionResults;
    if (!interactionSubmitted || !interaction || !results?.revealed) return;

    if (interaction.type === 'quiz' && selectedOption === interaction.correctOptionIndex) {
      awardReward(`${results.runId}:correct`, 'score', 8, 'Correct quiz answer');
    }

    if (interaction.type === 'poll' && prediction !== null && results.optionCounts.length) {
      const leadingCount = Math.max(...results.optionCounts);
      if (results.optionCounts[prediction] === leadingCount) {
        awardReward(`${results.runId}:room-read`, 'seminar', 3, 'Room read');
      }
    }
  }, [awardReward, interactionSubmitted, lessonState.activeInteraction, lessonState.interactionResults, prediction, selectedOption]);

  const requestReward = (reward: CourseReward) => {
    setRewardState((current) => {
      const next = requestCourseReward(current, reward);
      if (next !== current) saveRewardState(rewardScope, next);
      return next;
    });
  };

  const toggleWaitingQuestion = async (questionId: number) => {
    const wasVoted = selectedQuestionVotes.includes(questionId);
    const nextVoted = !wasVoted;
    setSelectedQuestionVotes((current) => (
      nextVoted ? [...current, questionId] : current.filter((id) => id !== questionId)
    ));
    setSubmissionError('');
    try {
      if (remoteSession) {
        await setStudentQuestionVote(remoteSession.ownerUid, remoteSession.sessionId, questionId, nextVoted);
      } else {
        channelRef.current?.postMessage({
          type: 'student-question-vote',
          questionId,
          voterId: demoVoterIdRef.current,
          voted: nextVoted,
        });
      }
    } catch {
      setSelectedQuestionVotes((current) => (
        wasVoted ? [...current, questionId] : current.filter((id) => id !== questionId)
      ));
      setSubmissionError('Your upvote was not saved. Check the connection and try again.');
    }
  };

  const step = lessonState.onboardingStep;

  return (
    <IconContext.Provider value={{ weight: 'duotone' }}>
    <main className="student-welcome-shell">
      <header className="student-welcome-header">
        <div className="student-brand">Classfully<span>.</span></div>
        <span className={`student-connection ${connected ? 'is-connected' : ''}`}><i /> {remoteUnavailable ? 'Class ended' : connected ? 'Connected' : 'Connecting'}</span>
      </header>

      <section className="student-welcome-content" ref={contentRef}>
        {remoteUnavailable && (
          <div className="student-ready-state" role="status">
            <span className="student-round-icon is-success"><Check size={30} /></span>
            <div className="student-kicker">Class complete</div>
            <h1>This session has ended.</h1>
            <p>Your response was saved. You can close this page and return for the next class.</p>
          </div>
        )}

        {!remoteUnavailable && step === 0 && !lessonState.activeInteraction && (
          <StudentCourseHome lessonState={lessonState} rewards={rewardState} onRequestReward={requestReward} enableSocialRewards={!remoteSession} />
        )}

        {!remoteUnavailable && step === 0 && lessonState.activeInteraction && lessonState.interactionResults && (
          <div className="student-interaction-state">
            {interactionSubmitted ? (
              <StudentPostSubmit
                interaction={lessonState.activeInteraction}
                answer={lessonState.activeInteraction.options?.[selectedOption ?? -1] || writtenResponse || 'Response saved'}
                questions={lessonState.questions}
                selectedQuestionVotes={selectedQuestionVotes}
                onToggleQuestion={toggleWaitingQuestion}
                confidence={confidence}
                onConfidence={setConfidence}
                prediction={prediction}
                onPrediction={selectPrediction}
                revealed={lessonState.interactionResults.revealed}
                responseCount={lessonState.interactionResults.responseCount}
                runId={lessonState.interactionResults.runId}
                optionCounts={lessonState.interactionResults.optionCounts}
                rewardState={rewardState}
                latestReward={latestReward}
              />
            ) : (
              <>
                <span className="student-round-icon"><ListChecks size={27} /></span>
                <div className="student-kicker">{lessonState.activeInteraction.label} · Live now</div>
                <h1>{lessonState.activeInteraction.prompt}</h1>
                <p>{lessonState.activeInteraction.options?.length ? 'Choose one response.' : 'Write a short response, then send it to the class.'}</p>

                {lessonState.activeInteraction.options?.length ? (
                  <div className="student-interaction-options" role="radiogroup" aria-label={lessonState.activeInteraction.prompt}>
                    {lessonState.activeInteraction.options.map((option, index) => (
                      <HapticButton
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={selectedOption === index}
                        disabled={!lessonState.interactionResults?.open}
                        tabIndex={selectedOption === index || (selectedOption === null && index === 0) ? 0 : -1}
                        className={selectedOption === index ? 'is-selected' : ''}
                        style={{ '--option-color': OPTION_COLORS[index % OPTION_COLORS.length] } as CSSProperties}
                        onClick={() => setSelectedOption(index)}
                        onKeyDown={(event) => {
                          if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key)) return;
                          event.preventDefault();
                          const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
                          const optionCount = lessonState.activeInteraction?.options?.length ?? 1;
                          const nextIndex = (index + direction + optionCount) % optionCount;
                          setSelectedOption(nextIndex);
                          const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
                          buttons?.[nextIndex]?.focus();
                        }}
                      >
                        <span>{String.fromCharCode(65 + index)}</span><strong>{option}</strong>{selectedOption === index && <Check size={18} />}
                      </HapticButton>
                    ))}
                  </div>
                ) : (
                  <textarea value={writtenResponse} onChange={(event) => setWrittenResponse(event.target.value.slice(0, 280))} disabled={!lessonState.interactionResults?.open} rows={5} maxLength={280} placeholder="Type your response here" aria-label="Your response" />
                )}

                {!lessonState.interactionResults.open ? (
                  <div className="student-submitted is-locked" role="status"><Lock size={18} /><span><strong>Responses are locked.</strong> Look up for the class discussion.</span></div>
                ) : (
                  <HapticButton
                    type="button"
                    className={`student-send-response ${isSubmitting ? 'is-sending' : ''}`}
                    hapticTone="action"
                    disabled={isSubmitting || (lessonState.activeInteraction.options?.length ? selectedOption === null : !writtenResponse.trim())}
                    onClick={(event) => submitInteraction(event.currentTarget)}
                  >
                    <span>{isSubmitting ? 'Sending response' : 'Send response'}</span><Send size={17} />
                  </HapticButton>
                )}
                <div className="student-private-line"><ShieldCheck size={16} /> The projector shows the class result, not your name.</div>
              </>
            )}
            {submissionError && <div className="student-response-error" role="alert">{submissionError}</div>}
          </div>
        )}

        {!remoteUnavailable && step === 1 && (
          <div className="student-joined-state">
            <span className="student-round-icon is-success"><Check size={30} /></span>
            <div className="student-kicker">Step 1 of 3</div>
            <h1>Connected. That’s it.</h1>
            <p>No app to download. This page will change whenever your instructor opens a poll, pulse, or question.</p>
            <div className="student-detail-card">
              <span><Users size={19} /></span>
              <div><strong>{lessonState.session.courseCode}</strong><small>{lessonState.session.sessionTitle} · {lessonState.session.instructorName || 'Your instructor'}</small></div>
              <Check size={18} />
            </div>
            <div className="student-waiting-pill"><i /> Waiting for the next step</div>
          </div>
        )}

        {!remoteUnavailable && step === 2 && (
          <div className="student-norms-state">
            <div className="student-kicker">Step 2 of 3</div>
            <h1>Three quiet ways to take part.</h1>
            <p>You choose when to participate. Classmates only see the shared signal.</p>
            <div className="student-norm-list">
              <article><span><HeartPulse size={21} /></span><div><strong>Send a pulse</strong><small>Share how you’re feeling or understanding.</small></div></article>
              <article><span><MessageCircle size={21} /></span><div><strong>Ask or upvote</strong><small>Surface a question without interrupting.</small></div></article>
              <article><span><Activity size={21} /></span><div><strong>Signal the pace</strong><small>Let the instructor know you need a pause.</small></div></article>
            </div>
            <div className="student-privacy-note"><Lock size={16} /><span><strong>Your wellbeing response stays private.</strong> The projector shows class totals only.</span></div>
          </div>
        )}

        {!remoteUnavailable && step === 3 && (
          <div className="student-pulse-state">
            <div className="student-kicker">Step 3 of 3 · Try it now</div>
            <h1>How are you arriving today?</h1>
            <p>Choose the answer that feels closest. There’s no right response.</p>
            <div className="student-mood-list" role="radiogroup" aria-label="How are you arriving today?">
              {MOODS.map((mood) => (
                <HapticButton
                  type="button"
                  role="radio"
                  aria-checked={selectedMood === mood.key}
                  className={selectedMood === mood.key ? 'is-selected' : ''}
                  disabled={Boolean(selectedMood)}
                  key={mood.key}
                  onClick={(event) => submitMood(mood.key, event.currentTarget)}
                  style={{ '--mood-color': mood.color } as CSSProperties}
                >
                  <i />
                  <span>{mood.label}</span>
                  {selectedMood === mood.key && <Check size={19} />}
                </HapticButton>
              ))}
            </div>
            {selectedMood ? (
              <div className="student-submitted"><Check size={18} /><span><strong>Pulse sent.</strong> Look up. The class signal just changed.</span></div>
            ) : (
              <div className="student-private-line"><ShieldCheck size={16} /> Only your instructor can access individual records.</div>
            )}
            {submissionError && <div className="student-response-error" role="alert">{submissionError}</div>}
          </div>
        )}

        {!remoteUnavailable && step === 4 && (
          <div className="student-ready-state">
            <span className="student-round-icon is-success"><Check size={30} /></span>
            <div className="student-kicker">Welcome complete</div>
            <h1>You’re ready.</h1>
            <p>Keep this page nearby. New activities will appear here automatically as your instructor teaches.</p>
            <div className="student-ready-card">
              <HeartPulse size={22} />
              <div><strong>Your voice is part of the room.</strong><small>Respond, ask, or signal the pace whenever you need to.</small></div>
            </div>
          </div>
        )}
      </section>

      {transportSignal && <StudentTransportSignal key={transportSignal.id} signal={transportSignal} />}

      <footer className="student-welcome-footer">
        <Link href="/privacy" target="_blank"><Lock size={13} /> Privacy</Link>
        <strong>{lessonState.session.sessionCode}</strong>
      </footer>
    </main>
    </IconContext.Provider>
  );
}
