'use client';

import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { IconContext, Pulse as Activity, ArrowClockwise, ArrowRight, ArrowFatUp as ArrowUp, Medal as Award, Check, CaretDown as ChevronDown, ClipboardText as ClipboardCheck, DiceFive, Gift, Heartbeat as HeartPulse, ListChecks, LockKey as Lock, ChatCircleDots as MessageCircle, PaperPlaneTilt as Send, ShieldCheck, Sparkle as Sparkles, Timer, Trophy, UserCircle, UsersThree as Users, X } from '@phosphor-icons/react';
import HapticButton from '@/components/student/HapticButton';
import ResponseTransferEffect, { RESPONSE_TRANSFER_DEPART_MS, RESPONSE_TRANSFER_LIFETIME_MS, type ResponseTransferSignal } from '@/components/student/ResponseTransferEffect';
import ClassroomStateGate from '@/components/live/ClassroomStateGate';
import MarkdownContent, { markdownToPlainText } from '@/components/live/MarkdownContent';
import {
  claimStudentQuestionPoints,
  getStudentQuestionVotes,
  getStudentClassroomMeta,
  getCurrentStudentQuestionIds,
  getCurrentStudentAttendance,
  getStudentResponse,
  getStudentWelcomeResponse,
  joinStudentPresence,
  setStudentQuestionVote,
  submitStudentQuestion,
  submitStudentInteractionResponse,
  submitStudentWelcomeResponse,
  subscribeToStudentConnection,
  subscribeToStudentPublicState,
  subscribeToStudentQuestionPointClaims,
} from '@/lib/firebase/live-classroom';
import {
  getAvailableRewardsForStudent,
  getStudentRewardRequests,
  requestReward as requestManagedReward,
} from '@/lib/firebase/rewards';
import type { RewardDefinition, RewardRequest, RewardRequestStatus } from '@/types';
import { ensureStudentAnonymousAuth } from '@/lib/firebase/student-config';
import { getUserFacingError } from '@/lib/user-facing-error';
import { triggerStudentHaptic } from '@/lib/student-haptics';
import {
  EMPTY_ONBOARDING_COUNTS,
  DEFAULT_LIVE_QUESTIONS,
  DEMO_SESSION,
  HISTORY,
  LESSON_CHANNEL,
  LESSON_STORAGE_KEY,
  MOODS,
  buildWordCloudItems,
  type LessonDisplayState,
  type InteractionResponse,
  type LiveInteraction,
  type LiveQuestion,
  type MoodKey,
} from '../live-data';
import './student.css';
import {
  applyReward,
  createInitialRewardState,
  getParticipationPoints,
  getQuestionPointRule,
  loadRewardState,
  POINT_RULES,
  saveRewardState,
  type CourseReward,
  type RewardBalance,
  type RewardLedgerEntry,
  type StudentRewardState,
  type QuestionPointRuleKey,
} from './rewards';

const DEFAULT_STATE: LessonDisplayState = {
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
  questions: DEFAULT_LIVE_QUESTIONS,
  teams: [],
  updatedAt: Date.now(),
};

const STUDENT_REWARD_KIND_LABELS = {
  pass: 'Pass',
  choice: 'Choice',
  recognition: 'Recognition',
  'extra-credit': 'Extra credit',
} as const;

const ParticipationSignal = dynamic(() => import('@/components/live/ParticipationSignal'), { ssr: false });

const OPTION_COLORS = ['#5146e5', '#2f73df', '#d99f18', '#df664e', '#2f8b63'];

function StudentTimerBanner({ timer }: { timer: NonNullable<LessonDisplayState['timer']> }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setNow(Date.now());
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [timer.id]);
  const remaining = Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
  const time = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  return <div className={`student-timer-banner ${remaining === 0 ? 'is-complete' : ''}`} role="timer" aria-label={`${timer.label}: ${time} remaining`}><span><Timer size={20} /></span><div><small>{remaining === 0 ? 'Time is up' : timer.label}</small><strong>{time}</strong></div></div>;
}

function confirmResponseHaptic() {
  triggerStudentHaptic('success');
}

function failResponseHaptic() {
  triggerStudentHaptic('error');
}

type PendingQuestionVote = {
  baseline: number;
  delta: number;
};

type StudentGuidanceId = 'questions' | 'upvotes' | 'auto-update' | 'points';

const STUDENT_GUIDANCE_STORAGE_KEY = 'classfully-student-guidance-v1';

function StudentQuietGuide({ id, onAction, onDismiss }: {
  id: StudentGuidanceId;
  onAction?: () => void;
  onDismiss: () => void;
}) {
  const guidance = {
    questions: {
      icon: <MessageCircle size={20} />,
      kicker: 'While you wait',
      title: 'Ask without interrupting.',
      body: 'Send a question at any time. Classmates will not see your name, and your instructor can respond when the moment is right.',
      action: 'Open Questions',
    },
    upvotes: {
      icon: <ArrowUp size={20} />,
      kicker: 'Good to know',
      title: 'Help choose what gets discussed.',
      body: 'Upvote a question you also want answered. Your instructor can see what matters to the room.',
      action: 'See questions',
    },
    'auto-update': {
      icon: <Activity size={20} />,
      kicker: 'Stay with the class',
      title: 'Keep this page open.',
      body: 'The next activity appears here automatically when your instructor is ready.',
      action: '',
    },
    points: {
      icon: <Sparkles size={20} />,
      kicker: 'Your course record',
      title: 'See how participation adds up.',
      body: 'Points recognize how you answer, predict, and contribute across the course.',
      action: 'See my progress',
    },
  }[id];

  return (
    <aside className="student-quiet-guide" aria-labelledby={`student-guide-${id}`}>
      <span className="student-quiet-guide-icon">{guidance.icon}</span>
      <div>
        <small>{guidance.kicker}</small>
        <strong id={`student-guide-${id}`}>{guidance.title}</strong>
        <p>{guidance.body}</p>
        <div className="student-quiet-guide-actions">
          {guidance.action && onAction && <button type="button" onClick={onAction}>{guidance.action}<ArrowRight size={15} /></button>}
          <button type="button" className="is-quiet" onClick={onDismiss}>Got it</button>
        </div>
      </div>
    </aside>
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
  ownQuestionIds,
  pendingQuestionVotes,
  questionVoteErrors,
  onToggleQuestion,
  confidence,
  onConfidence,
  prediction,
  onPrediction,
  revealed,
  responseCount,
  runId,
  optionCounts,
  writtenResponses,
  rewardState,
  latestReward,
  phase,
  guidance,
}: {
  interaction: LiveInteraction;
  answer: string;
  questions: LiveQuestion[];
  selectedQuestionVotes: number[];
  ownQuestionIds: number[];
  pendingQuestionVotes: Record<number, PendingQuestionVote>;
  questionVoteErrors: Record<number, string>;
  onToggleQuestion: (questionId: number) => void;
  confidence: string | null;
  onConfidence: (confidence: string) => void;
  prediction: number | null;
  onPrediction: (optionIndex: number) => void;
  revealed: boolean;
  responseCount: number;
  runId: string;
  optionCounts: number[];
  writtenResponses: Array<{ id: string; text: string }>;
  rewardState: StudentRewardState;
  latestReward: RewardLedgerEntry | null;
  phase?: 'respond' | 'discuss' | 'respond-again' | 'work' | 'complete';
  guidance?: ReactNode;
}) {
  const showQuestionCommons = questions.length > 0
    && (interaction.type === 'quiz' || interaction.type === 'open-response');
  const roomChoice = responseCount > 0 && optionCounts.length
    ? optionCounts.reduce((bestIndex, value, index) => value > (optionCounts[bestIndex] ?? -1) ? index : bestIndex, 0)
    : null;
  const wordCloudItems = buildWordCloudItems(writtenResponses, 3);
  const normalizedAnswer = answer.normalize('NFKC').replace(/\s+/g, ' ').replace(/^[\s.,!?;:'\"“”‘’()[\]{}]+|[\s.,!?;:'\"“”‘’()[\]{}]+$/g, '').trim().toLocaleLowerCase();
  const studentWordCloudDensity = wordCloudItems.length <= 1 ? 'is-solo' : wordCloudItems.length <= 4 ? 'is-sparse' : 'is-growing';

  return (
    <div className="student-after-response">
      <div className="student-response-confirmation" role="status"><Check size={19} /><strong>Response sent</strong></div>

      <div className={`student-reward-arrival ${latestReward ? 'is-arriving' : ''}`} data-reward={latestReward ? `+${latestReward.amount}` : undefined} aria-live="polite">
        <ParticipationSignal active={Boolean(latestReward)} />
        <span><Sparkles size={17} /></span>
        <div>
          <small>{latestReward?.label || 'Points'}</small>
          <strong>{latestReward ? `+${latestReward.amount} ${latestReward.balance === 'score' ? 'class score' : 'points'}` : `${rewardState.seminarPoints} points`}</strong>
        </div>
        <b>{latestReward?.balance === 'score' ? rewardState.classScore : rewardState.seminarPoints}</b>
      </div>

      <details className="student-answer-summary">
        <summary><ClipboardCheck size={19} /><span>Your answer: <strong>{answer}</strong></span><ChevronDown size={19} /></summary>
        <p>Your response is saved. You can look up while the rest of the room answers.</p>
      </details>

      {revealed && (interaction.type === 'quiz' || interaction.type === 'peer-learning') && (
        <div className="student-answer-reveal"><Check size={17} /><span><strong>The answer is out.</strong> {interaction.explanation || 'Look up for the class explanation.'}</span></div>
      )}

      {interaction.type === 'peer-learning' ? (
        <section className="student-waiting-activity student-peer-moment" aria-labelledby="peer-moment-title">
          <div className="student-kicker">Peer learning · Step {revealed ? '3' : phase === 'discuss' ? '2' : phase === 'respond-again' ? '3' : '1'} of 3</div>
          <h2 id="peer-moment-title">{revealed ? 'See what changed in the room.' : phase === 'discuss' ? 'Turn to someone nearby.' : phase === 'respond-again' ? 'Your second answer is in.' : 'Keep your first thought in mind.'}</h2>
          <p>{revealed ? 'Look up for the before and after result.' : phase === 'discuss' ? 'Take turns explaining what led you to your answer. Listen for one reason that could change your mind.' : phase === 'respond-again' ? 'The room is answering again. It is fine to keep an idea or change it.' : 'The room is still answering. A short partner conversation comes next.'}</p>
          <div className="student-peer-cues"><span>Explain your reason</span><i /><span>Listen for evidence</span><i /><span>Answer again</span></div>
        </section>
      ) : interaction.type === 'word-cloud' ? (
        <section className="student-waiting-activity student-word-cloud-moment" aria-labelledby="student-word-cloud-title">
          <div className="student-kicker">Class word cloud</div>
          <h2 id="student-word-cloud-title">Your word is joining the room.</h2>
          <p>Repeated ideas grow as more responses arrive. Look up to see the full cloud.</p>
          <div className={`student-mini-word-cloud ${studentWordCloudDensity}`} aria-label={`${wordCloudItems.length} ideas in the class word cloud`}>
            {responseCount > 0 && <i className="student-mini-cloud-ripple" key={`student-cloud-ripple-${responseCount}`} aria-hidden="true" />}
            {wordCloudItems.map((item, index) => <span
              className={`${item.key === normalizedAnswer ? 'is-own' : ''} ${item.count > 1 ? 'is-repeated' : ''}`.trim()}
              key={`${item.key}-${item.count}`}
              style={{
                '--word-size': `${wordCloudItems.length <= 1 ? 34 : wordCloudItems.length <= 4 ? 19 + item.strength * 14 : 14 + item.strength * 12}px`,
                '--word-delay': `${Math.min(index * 35, 160)}ms`,
              } as CSSProperties}
            >{item.label}{item.count > 1 && index < 3 && <small aria-label={`${item.count} responses`}>×{item.count}</small>}</span>)}
          </div>
        </section>
      ) : showQuestionCommons ? (
        <section className="student-waiting-activity" aria-labelledby="question-commons-title">
          <div className="student-kicker">Questions from the room</div>
          <h2 id="question-commons-title">While the room responds.</h2>
          <p>See what others are wondering. Upvote one you want discussed.</p>
          <div className="student-anonymous-note"><Users size={18} /><span>Questions are anonymous to classmates and visible to your instructor.</span></div>
          <div className="student-question-commons">
            {questions.slice(0, 2).map((question) => {
              const selected = selectedQuestionVotes.includes(question.id);
              const isOwnQuestion = ownQuestionIds.includes(question.id);
              const pendingVote = pendingQuestionVotes[question.id];
              const displayedVotes = Math.max(0, question.votes + (pendingVote?.delta || 0));
              return (
                <article key={question.id}>
                  {isOwnQuestion ? <span className="student-own-question"><Check size={16} /> Yours</span> : (
                    <HapticButton
                      type="button"
                      depth="compact"
                      className={selected ? 'is-voted' : ''}
                      aria-pressed={selected}
                      aria-label={`${selected ? 'Remove upvote from' : 'Upvote'} question. ${displayedVotes} ${displayedVotes === 1 ? 'vote' : 'votes'}.`}
                      disabled={Boolean(pendingVote)}
                      onClick={() => onToggleQuestion(question.id)}
                    >
                      <ArrowUp size={21} />
                      <strong>{displayedVotes}</strong>
                    </HapticButton>
                  )}
                  <div><p>{question.question}</p><small>Anonymous to classmates</small></div>
                  {questionVoteErrors[question.id] && <small className="student-question-vote-error" role="alert">{questionVoteErrors[question.id]}</small>}
                </article>
              );
            })}
          </div>
        </section>
      ) : interaction.type === 'poll' && revealed && prediction === null ? (
        <section className="student-waiting-activity student-calm-wait" aria-labelledby="poll-result-ready-title">
          <div className="student-kicker">Class result</div>
          <h2 id="poll-result-ready-title">The room’s answer is ready.</h2>
          <p>Look up to see how the class answered.</p>
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
          {prediction !== null && revealed && roomChoice !== null && (
            <div className={`student-prediction-result ${prediction === roomChoice ? 'is-match' : ''}`}>
              <div className="student-prediction-comparison">
                <span style={{ '--prediction-color': OPTION_COLORS[prediction % OPTION_COLORS.length] } as CSSProperties}>
                  <i>{String.fromCharCode(65 + prediction)}</i><small>You predicted</small>
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

      {guidance}

      <StudentRoomCurrent responseCount={responseCount} runId={runId} />
      <div className="student-room-status" aria-live="polite">
        <div className="student-live-signal" aria-hidden="true">
          {Array.from({ length: 7 }).map((_, index) => (
            <i className={index < Math.min(7, responseCount) ? 'is-filled' : ''} key={`${responseCount}-${index}`} style={{ '--signal-delay': `${index * 32}ms` } as CSSProperties} />
          ))}
        </div>
        <strong key={responseCount}>The room is responding</strong>
        <span>{responseCount === 1 ? 'You’re the first response.' : `${responseCount} responses are in.`} Stay here for what comes next.</span>
      </div>
    </div>
  );
}

function StudentQuestionSheet({
  questions,
  selectedVotes,
  ownQuestionIds,
  pendingVotes,
  voteErrors,
  draft,
  submitting,
  notice,
  error,
  onDraftChange,
  onSubmit,
  onToggleVote,
  onClose,
}: {
  questions: LiveQuestion[];
  selectedVotes: number[];
  ownQuestionIds: number[];
  pendingVotes: Record<number, PendingQuestionVote>;
  voteErrors: Record<number, string>;
  draft: string;
  submitting: boolean;
  notice: string;
  error: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onToggleVote: (questionId: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="student-question-layer">
      <button type="button" className="student-question-backdrop" aria-label="Close questions" onClick={onClose} />
      <section className="student-question-sheet" role="dialog" aria-modal="true" aria-labelledby="student-question-title">
        <div className="student-question-sheet-handle" aria-hidden="true" />
        <header>
          <div><span>Questions</span><h2 id="student-question-title">Ask without interrupting.</h2></div>
          <button type="button" aria-label="Close questions" onClick={onClose}><X size={19} weight="bold" aria-hidden="true" /></button>
        </header>
        <p className="student-question-privacy"><Lock size={15} /> Anonymous to classmates. Visible to your instructor.</p>
        <label className="student-question-composer">
          <span>Your question</span>
          <textarea autoFocus value={draft} onChange={(event) => onDraftChange(event.target.value.slice(0, 180))} maxLength={180} rows={3} placeholder="What would you like the instructor to explain?" />
          <small>{draft.length}/180</small>
        </label>
        <HapticButton type="button" className="student-question-send" hapticTone="action" disabled={submitting || !draft.trim()} onClick={onSubmit}>
          <span>{submitting ? 'Sending question' : 'Post question'}</span><Send size={17} />
        </HapticButton>
        {notice && <div className="student-question-notice" role="status"><Check size={16} /> {notice}</div>}
        {error && <div className="student-response-error" role="alert">{error}</div>}
        <div className="student-question-feed-heading"><strong>Questions from the room</strong><span>{questions.length}</span></div>
        <div className="student-question-feed">
          {questions.length ? questions.map((question) => {
            const selected = selectedVotes.includes(question.id);
            const isOwnQuestion = ownQuestionIds.includes(question.id);
            const pendingVote = pendingVotes[question.id];
            const displayedVotes = Math.max(0, question.votes + (pendingVote?.delta || 0));
            return (
              <article key={question.id}>
                {isOwnQuestion ? <span className="student-own-question"><Check size={16} /> Your question</span> : (
                  <HapticButton type="button" depth="compact" className={selected ? 'is-voted' : ''} aria-pressed={selected} aria-label={`${selected ? 'Remove upvote from' : 'Upvote'} question. ${displayedVotes} ${displayedVotes === 1 ? 'vote' : 'votes'}.`} disabled={Boolean(pendingVote)} onClick={() => onToggleVote(question.id)}>
                    <ArrowUp size={18} /><strong>{displayedVotes}</strong>
                  </HapticButton>
                )}
                <p>{question.question}</p>
                {voteErrors[question.id] && <small className="student-question-vote-error" role="alert">{voteErrors[question.id]}</small>}
              </article>
            );
          }) : <div className="student-question-empty"><MessageCircle size={21} /><span><strong>No questions yet.</strong> Start the conversation when something is unclear.</span></div>}
        </div>
      </section>
    </div>
  );
}

function StudentCourseHome({
  lessonState,
  rewards,
  courseRewards,
  requestStatuses,
  onRequestReward,
  enableSocialRewards,
  rewardsLoading,
  view,
  onViewChange,
  classEnded = false,
  embedded = false,
}: {
  lessonState: LessonDisplayState;
  rewards: StudentRewardState;
  courseRewards: CourseReward[];
  requestStatuses: Record<string, RewardRequestStatus>;
  onRequestReward: (reward: CourseReward) => void;
  enableSocialRewards: boolean;
  rewardsLoading: boolean;
  view: 'home' | 'standing' | 'rewards';
  onViewChange: (view: 'home' | 'standing' | 'rewards') => void;
  classEnded?: boolean;
  embedded?: boolean;
}) {
  useEffect(() => {
    if (!enableSocialRewards) onViewChange('home');
  }, [enableSocialRewards, onViewChange]);
  const learningMomentCount = new Set(rewards.ledger.map((entry) => (
    entry.eventKey.replace(/:(response|prediction|correct|room-read)$/, '')
  ))).size;
  const availableRewardCount = courseRewards.filter((reward) => reward.pointsRequired <= rewards.seminarPoints).length;
  const nextReward = courseRewards.find((reward) => reward.pointsRequired > rewards.seminarPoints);
  const allRewardsUnlocked = courseRewards.length > 0 && !nextReward;
  const progress = nextReward ? Math.min(100, Math.round((rewards.seminarPoints / nextReward.pointsRequired) * 100)) : 0;
  const hasProgress = rewards.ledger.length > 0;

  return (
    <div className={`student-course-home ${embedded ? 'is-embedded' : ''}`}>
      {!embedded && <div className={`student-live-ready ${classEnded ? 'is-complete' : ''}`}><i />{classEnded ? <span><strong>Class complete.</strong> Your course record is still here.</span> : <span><strong>You’re in the room.</strong> The next activity will appear here.</span>}</div>}
      <div className="student-kicker">{lessonState.session.courseCode} · Course home</div>
      {enableSocialRewards && <nav className="student-home-tabs" aria-label="Course home sections">
        <button type="button" className={view === 'home' ? 'is-active' : ''} onClick={() => onViewChange('home')}>Home</button>
        <button type="button" className={view === 'standing' ? 'is-active' : ''} onClick={() => onViewChange('standing')}>Standing</button>
        <button type="button" className={view === 'rewards' ? 'is-active' : ''} onClick={() => onViewChange('rewards')}>Rewards</button>
      </nav>}

      {view === 'home' && (
        <>
          <h1>{hasProgress ? 'Your semester is taking shape.' : 'Your course record starts here.'}</h1>
          <p className="student-home-intro">Your points and learning activity appear here as you participate.</p>
          <section className="student-constellation-card" aria-labelledby="student-progress-title">
            <div className="student-constellation-heading">
              <div><small>Your points</small><strong id="student-progress-title">{rewards.seminarPoints}</strong></div>
              <span><Sparkles size={16} /><strong>{learningMomentCount}</strong><small>{learningMomentCount === 1 ? 'learning moment' : 'learning moments'}</small></span>
            </div>
            <div className="student-constellation-visual">
              <Image src="/assets/living-seminar/room-forming.png" alt="A soft constellation formed by your classroom participation" width={2079} height={756} priority />
              <div className="student-constellation-copy"><Sparkles size={16} /><span><strong>{learningMomentCount ? `${learningMomentCount} ${learningMomentCount === 1 ? 'learning moment' : 'learning moments'}` : 'No activity recorded yet'}</strong><small>{learningMomentCount ? 'from your participation' : 'Your first response will begin this record'}</small></span></div>
            </div>
            {enableSocialRewards && rewardsLoading ? <div className="student-pilot-points"><Gift size={14} /><span><strong>Loading course rewards…</strong></span></div> : enableSocialRewards && nextReward ? <div className="student-reward-progress">
              <div><span>Next reward</span><strong>{nextReward.name}</strong></div>
              <small>{Math.max(0, nextReward.pointsRequired - rewards.seminarPoints)} points to go</small>
              <i><b style={{ width: `${progress}%` }} /></i>
            </div> : enableSocialRewards && allRewardsUnlocked ? <div className="student-pilot-points"><Gift size={14} /><span><strong>Every course reward is unlocked.</strong> Open Rewards to review your options.</span></div> : enableSocialRewards ? <div className="student-pilot-points"><Gift size={14} /><span><strong>No course rewards yet.</strong> Rewards will appear when they are added to this course.</span></div> : <div className="student-pilot-points"><Lock size={14} /><span><strong>Points stay private.</strong> Join with your student number to connect them to this class.</span></div>}
          </section>
          {rewards.ledger.length > 0 && <section className="student-earned-activity" aria-labelledby="student-earned-title">
            <div className="student-section-title"><div><span>Recorded activity</span><h2 id="student-earned-title">Recent points</h2></div><Sparkles size={19} /></div>
            <div>{rewards.ledger.slice(0, 4).map((entry) => <article key={entry.id}><span>{entry.label}</span><strong>+{entry.amount} {entry.balance === 'score' ? 'class score' : 'points'}</strong></article>)}</div>
          </section>}
          {enableSocialRewards && <div className="student-home-shortcuts">
            <HapticButton type="button" depth="compact" onClick={() => onViewChange('standing')}><Trophy size={17} /><span><small>Class standing</small><strong>No board published</strong></span><ArrowRight size={15} /></HapticButton>
            <HapticButton type="button" depth="compact" onClick={() => onViewChange('rewards')}><Gift size={17} /><span><small>My Rewards</small><strong>{rewardsLoading ? 'Loading…' : `${availableRewardCount} available now`}</strong></span><ArrowRight size={15} /></HapticButton>
          </div>}
        </>
      )}

      {view === 'standing' && (
        <section className="student-home-section is-panel" aria-labelledby="student-standing-title">
          <div className="student-section-title"><div><span>Class standing</span><h2 id="student-standing-title">No board published</h2></div><Trophy size={19} /></div>
          <div className="student-tab-empty"><Trophy size={24} /><strong>There is no class standing to show.</strong><p>Your {rewards.seminarPoints} points remain private. If a verified leaderboard is published for this course, it will appear here.</p></div>
        </section>
      )}

      {view === 'rewards' && (
        <section className="student-home-section is-panel" aria-labelledby="student-rewards-title">
          <div className="student-section-title"><div><span>My Rewards</span><h2 id="student-rewards-title">What you’ve unlocked</h2></div><Gift size={19} /></div>
          <p className="student-section-note">Rewards added by your instructor appear here. Your instructor approves each request.</p>
          <section className="student-point-guide" aria-labelledby="student-point-guide-title">
            <div><Sparkles size={17} /><strong id="student-point-guide-title">How points work</strong></div>
            <ul>
              <li><span>Take part</span><strong>1–5 points</strong><small>Respond, reflect, or contribute to group work.</small></li>
              <li><span>Read the room</span><strong>1–3 points</strong><small>Make a prediction and compare it with the class.</small></li>
              <li><span>Help the room</span><strong>Up to 9</strong><small>Ask one useful question, earn class support, and have it discussed.</small></li>
            </ul>
            <p>Correct answers build your class score. They do not replace participation points.</p>
          </section>
          <div className="student-reward-shelf">
            {!rewardsLoading && courseRewards.map((reward) => {
              const localStatus = rewards.redemptions.find((redemption) => redemption.rewardId === reward.id)?.status;
              const status = requestStatuses[reward.id] || localStatus;
              const pending = status === 'pending';
              const approved = status === 'approved';
              const used = status === 'used';
              const declined = status === 'declined';
              const available = rewards.seminarPoints >= reward.pointsRequired;
              const pointsToGo = Math.max(0, reward.pointsRequired - rewards.seminarPoints);
              return (
                <article key={reward.id}>
                  <span><Award size={18} /></span>
                  <div className="student-reward-copy">
                    <div className="student-reward-meta"><b>{reward.pointsRequired} points</b>{reward.kind && <small>{STUDENT_REWARD_KIND_LABELS[reward.kind]}</small>}</div>
                    <strong>{reward.name}</strong>
                    <p>{reward.description}</p>
                    <small className="student-reward-limit">Up to {reward.limitPerStudent || 1} per student</small>
                  </div>
                  <HapticButton type="button" depth="compact" hapticTone="action" disabled={!available || pending || approved || used} onClick={() => onRequestReward(reward)}>
                    {pending ? 'Request pending' : approved ? 'Ready to use' : used ? 'Used' : declined && available ? 'Request again' : available ? 'Request reward' : `${pointsToGo} points to go`} {!pending && !approved && !used && available && <ArrowRight size={13} />}
                  </HapticButton>
                </article>
              );
            })}
            {rewardsLoading && <div className="student-tab-empty"><Gift size={24} /><strong>Loading course rewards…</strong></div>}
            {!rewardsLoading && courseRewards.length === 0 && <div className="student-tab-empty"><Gift size={24} /><strong>No course rewards yet.</strong><p>When rewards are added to this course, you will see their point requirements and request status here.</p></div>}
          </div>
        </section>
      )}

      <div className="student-private-record"><Lock size={14} /><span>{enableSocialRewards ? 'Your balance, class score, and reward history are private.' : 'Your classroom responses and pilot points stay private.'}</span></div>
    </div>
  );
}

function StudentCourseSheet({
  children,
  points,
  studentName,
  onClose,
}: {
  children: ReactNode;
  points: number;
  studentName: string;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div className="student-course-layer">
      <button type="button" className="student-course-backdrop" aria-label="Back to class" onClick={onClose} />
      <section
        className="student-course-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-course-sheet-title"
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return;
          const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
          if (!focusable.length) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <div
          className="student-course-sheet-handle"
          aria-hidden="true"
          onTouchStart={(event) => { touchStartY.current = event.touches[0]?.clientY ?? null; }}
          onTouchEnd={(event) => {
            const endY = event.changedTouches[0]?.clientY;
            if (touchStartY.current !== null && endY !== undefined && endY - touchStartY.current > 72) onClose();
            touchStartY.current = null;
          }}
        />
        <header>
          <div className="student-course-sheet-person"><span><UserCircle size={25} /></span><div><small id="student-course-sheet-title">My course</small><strong>{studentName}</strong></div></div>
          <div className="student-course-sheet-points"><Sparkles size={14} /><strong>{points}</strong><small>points</small></div>
          <button ref={closeButtonRef} type="button" aria-label="Close my course" onClick={onClose}><X size={18} weight="bold" aria-hidden="true" /></button>
        </header>
        <div className="student-course-sheet-content">{children}</div>
        <div className="student-course-sheet-return"><HapticButton type="button" hapticTone="action" onClick={onClose}>Back to class <ArrowRight size={16} /></HapticButton></div>
      </section>
    </div>
  );
}

export default function StudentWelcomePage() {
  const [lessonState, setLessonState] = useState<LessonDisplayState>(DEFAULT_STATE);
  const [classroomStateReady, setClassroomStateReady] = useState(false);
  const [rewardStateReady, setRewardStateReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connectionRecovery, setConnectionRecovery] = useState<'idle' | 'recovering' | 'failed'>('idle');
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [classroomMoveNotice, setClassroomMoveNotice] = useState('');
  const [selectedMood, setSelectedMood] = useState<MoodKey | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [writtenResponse, setWrittenResponse] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [creatingNewTeam, setCreatingNewTeam] = useState(false);
  const [interactionSubmitted, setInteractionSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedQuestionVotes, setSelectedQuestionVotes] = useState<number[]>([]);
  const [confidence, setConfidence] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<number | null>(null);
  const [submissionError, setSubmissionError] = useState('');
  const [remoteSession, setRemoteSession] = useState<{ sessionId: string; ownerUid: string } | null>(null);
  const [remoteUnavailable, setRemoteUnavailable] = useState(false);
  const [rewardScope, setRewardScope] = useState('');
  const [rewardState, setRewardState] = useState<StudentRewardState>(() => createInitialRewardState());
  const [studentNumber, setStudentNumber] = useState('');
  const [studentDisplayName, setStudentDisplayName] = useState('');
  const [managedRewards, setManagedRewards] = useState<RewardDefinition[]>([]);
  const [managedRewardsLoading, setManagedRewardsLoading] = useState(false);
  const [managedRequests, setManagedRequests] = useState<RewardRequest[]>([]);
  const [rewardRequestError, setRewardRequestError] = useState('');
  const [latestReward, setLatestReward] = useState<RewardLedgerEntry | null>(null);
  const [transportSignal, setTransportSignal] = useState<ResponseTransferSignal | null>(null);
  const transportOriginsRef = useRef(new Map<number, HTMLElement>());
  const [questionSheetOpen, setQuestionSheetOpen] = useState(false);
  const [courseSpaceOpen, setCourseSpaceOpen] = useState(false);
  const [courseView, setCourseView] = useState<'home' | 'standing' | 'rewards'>('home');
  const [remoteEnded, setRemoteEnded] = useState(false);
  const [questionDraft, setQuestionDraft] = useState('');
  const [questionSubmitting, setQuestionSubmitting] = useState(false);
  const [questionNotice, setQuestionNotice] = useState('');
  const [questionError, setQuestionError] = useState('');
  const [ownQuestionIds, setOwnQuestionIds] = useState<number[]>([]);
  const [pendingQuestionVotes, setPendingQuestionVotes] = useState<Record<number, PendingQuestionVote>>({});
  const [questionVoteErrors, setQuestionVoteErrors] = useState<Record<number, string>>({});
  const [questionRewardNotice, setQuestionRewardNotice] = useState<{ amount: number; label: string } | null>(null);
  const [learnedGuidance, setLearnedGuidance] = useState<StudentGuidanceId[]>([]);
  const [guidanceReady, setGuidanceReady] = useState(false);
  const [guidanceHiddenForMoment, setGuidanceHiddenForMoment] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const demoVoterIdRef = useRef('');
  const contentRef = useRef<HTMLElement | null>(null);
  const courseTriggerRef = useRef<HTMLButtonElement | null>(null);
  const pendingQuestionClaimsRef = useRef(new Set<string>());
  const demoQuestionClaimsRef = useRef(new Set<string>());
  const hasReceivedRemoteStateRef = useRef(false);
  const lastRemoteStateAtRef = useRef(0);
  const lastRunIdRef = useRef<string | null>(null);
  const automaticRetryCountRef = useRef(0);
  const classroomMoveNoticeTimerRef = useRef<number | null>(null);

  const reconnectToClassroom = useCallback(() => {
    automaticRetryCountRef.current = 0;
    setConnected(false);
    setConnectionRecovery('recovering');
    setConnectionAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(window.localStorage.getItem(STUDENT_GUIDANCE_STORAGE_KEY) || '[]');
      if (Array.isArray(saved)) {
        setLearnedGuidance(saved.filter((id): id is StudentGuidanceId => (
          typeof id === 'string' && ['questions', 'upvotes', 'auto-update', 'points'].includes(id)
        )));
      }
    } catch {
      // A damaged preference should never keep a student out of class.
    }
    setGuidanceReady(true);
  }, []);

  const markGuidanceLearned = useCallback((id: StudentGuidanceId) => {
    setLearnedGuidance((current) => {
      if (current.includes(id)) return current;
      const next = [...current, id];
      window.localStorage.setItem(STUDENT_GUIDANCE_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setGuidanceHiddenForMoment(true);
  }, []);

  useEffect(() => {
    setGuidanceHiddenForMoment(false);
  }, [lessonState.interactionResults?.runId, lessonState.lobbyOpen]);

  const beginTransport = (color: string, label: string, origin?: HTMLElement) => {
    transportOriginsRef.current.forEach((element) => element.classList.remove('student-response-source-hidden'));
    transportOriginsRef.current.clear();
    const bounds = origin?.getBoundingClientRect();
    const signal: ResponseTransferSignal = {
      id: Date.now(),
      color,
      label: label.trim().slice(0, 32) || 'Your response',
      sourceLabel: origin?.innerText.trim().replace(/\s+/g, ' ').slice(0, 40),
      x: bounds ? bounds.left + bounds.width / 2 : window.innerWidth / 2,
      y: bounds ? bounds.top + bounds.height / 2 : window.innerHeight * 0.72,
      width: bounds?.width,
      height: bounds?.height,
      phase: 'gathering',
    };
    setTransportSignal(signal);
    if (origin) {
      transportOriginsRef.current.set(signal.id, origin);
      window.setTimeout(() => {
        if (origin.isConnected) origin.classList.add('student-response-source-hidden');
      }, 90);
    }
    return signal.id;
  };

  const releaseTransportOrigin = (id: number, delay = 0) => {
    window.setTimeout(() => {
      const origin = transportOriginsRef.current.get(id);
      origin?.classList.remove('student-response-source-hidden');
      transportOriginsRef.current.delete(id);
    }, delay);
  };

  const completeTransport = (id: number) => {
    setTransportSignal((current) => current?.id === id ? { ...current, phase: 'departing' } : current);
    window.setTimeout(() => {
      setTransportSignal((current) => current?.id === id ? { ...current, phase: 'arrived' } : current);
      confirmResponseHaptic();
    }, RESPONSE_TRANSFER_DEPART_MS);
    window.setTimeout(() => setTransportSignal((current) => current?.id === id ? null : current), RESPONSE_TRANSFER_LIFETIME_MS);
    releaseTransportOrigin(id, RESPONSE_TRANSFER_LIFETIME_MS);
  };

  const failTransport = (id: number) => {
    setTransportSignal((current) => current?.id === id ? { ...current, phase: 'failed' } : current);
    failResponseHaptic();
    window.setTimeout(() => setTransportSignal((current) => current?.id === id ? null : current), 700);
    releaseTransportOrigin(id, 180);
  };

  useEffect(() => () => {
    transportOriginsRef.current.forEach((element) => element.classList.remove('student-response-source-hidden'));
    transportOriginsRef.current.clear();
  }, []);

  useEffect(() => {
    const handleOffline = () => {
      setConnected(false);
      setConnectionRecovery('recovering');
    };
    const handleOnline = () => reconnectToClassroom();
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) reconnectToClassroom();
    };
    const handleVisibility = () => {
      if (
        document.visibilityState === 'visible'
        && lastRemoteStateAtRef.current
        && Date.now() - lastRemoteStateAtRef.current > 15_000
      ) reconnectToClassroom();
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [reconnectToClassroom]);

  useEffect(() => {
    if (!questionSheetOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setQuestionSheetOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [questionSheetOpen]);

  useEffect(() => {
    if (!remoteSession) return;
    let cancelled = false;
    getCurrentStudentQuestionIds(remoteSession.ownerUid, remoteSession.sessionId)
      .then((questionIds) => {
        if (!cancelled) setOwnQuestionIds(questionIds);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [remoteSession]);

  useEffect(() => {
    if (!remoteSession || !ownQuestionIds.length || !selectedQuestionVotes.length) return;
    const ownVotes = selectedQuestionVotes.filter((questionId) => ownQuestionIds.includes(questionId));
    if (!ownVotes.length) return;
    setSelectedQuestionVotes((current) => current.filter((questionId) => !ownVotes.includes(questionId)));
    ownVotes.forEach((questionId) => {
      setStudentQuestionVote(remoteSession.ownerUid, remoteSession.sessionId, questionId, false).catch(() => undefined);
    });
  }, [ownQuestionIds, remoteSession, selectedQuestionVotes]);

  useEffect(() => {
    setPendingQuestionVotes((current) => {
      let changed = false;
      const next = { ...current };
      Object.entries(current).forEach(([questionId, pendingVote]) => {
        const question = lessonState.questions.find((item) => item.id === Number(questionId));
        if (!question || question.votes !== pendingVote.baseline) {
          delete next[Number(questionId)];
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [lessonState.questions]);

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get('sessionId');
    if (sessionId) {
      const ownerUid = new URLSearchParams(window.location.search).get('ownerUid');
      let cancelled = false;
      let stopState: (() => void) | undefined;
      let stopPresence: (() => void) | undefined;
      let stopConnection: (() => void) | undefined;
      let retryTimer: number | undefined;

      const scheduleAutomaticRetry = () => {
        if (cancelled) return;
        if (!navigator.onLine) {
          setConnectionRecovery('recovering');
          return;
        }
        if (automaticRetryCountRef.current >= 3) {
          setConnectionRecovery('failed');
          return;
        }
        const delay = [900, 1800, 3600][automaticRetryCountRef.current] || 3600;
        automaticRetryCountRef.current += 1;
        retryTimer = window.setTimeout(() => {
          if (!cancelled) setConnectionAttempt((current) => current + 1);
        }, delay);
      };

      const connectRemoteClassroom = async () => {
        if (!ownerUid) throw new Error('Classroom link is incomplete.');
        await ensureStudentAnonymousAuth();
        if (cancelled) return;
        setRemoteSession({ sessionId, ownerUid });
        stopConnection = await subscribeToStudentConnection((firebaseConnected) => {
          if (cancelled) return;
          if (firebaseConnected) {
            if (hasReceivedRemoteStateRef.current) {
              lastRemoteStateAtRef.current = Date.now();
              setConnected(true);
              setConnectionRecovery('idle');
            }
            return;
          }
          setConnected(false);
          setConnectionRecovery('recovering');
        });
        stopState = await subscribeToStudentPublicState(ownerUid, sessionId, (state) => {
          if (cancelled) return;
          if (!state) {
            void getStudentClassroomMeta(ownerUid, sessionId).then((meta) => {
              if (cancelled) return;
              const ended = meta?.status === 'ended' || Boolean(meta?.expiresAt && meta.expiresAt < Date.now());
              setRemoteEnded(ended);
              if (meta) {
                setRewardScope(`${ownerUid}:${meta.courseCode || sessionId}`);
                setLessonState((current) => ({
                  ...current,
                  session: {
                    sessionId,
                    ownerUid,
                    instructorName: meta.instructorName,
                    sessionCode: meta.sessionCode,
                    courseCode: meta.courseCode,
                    courseName: meta.courseName,
                    sessionTitle: meta.sessionTitle,
                  },
                }));
              }
              setConnected(false);
              setRemoteUnavailable(ended || !meta || !hasReceivedRemoteStateRef.current);
              setConnectionRecovery(ended ? 'idle' : meta ? 'recovering' : 'failed');
              setClassroomStateReady(true);
              if (meta && !ended) scheduleAutomaticRetry();
            }).catch(() => {
              if (!cancelled) {
                setConnected(false);
                setRemoteUnavailable(!hasReceivedRemoteStateRef.current);
                setConnectionRecovery('recovering');
                setClassroomStateReady(true);
                scheduleAutomaticRetry();
              }
            });
            return;
          }
          const nextRunId = state.interactionResults?.runId || null;
          if (lastRunIdRef.current && nextRunId && lastRunIdRef.current !== nextRunId) {
            setClassroomMoveNotice('The class moved to the next activity.');
            if (classroomMoveNoticeTimerRef.current) window.clearTimeout(classroomMoveNoticeTimerRef.current);
            classroomMoveNoticeTimerRef.current = window.setTimeout(() => setClassroomMoveNotice(''), 4200);
          }
          if (nextRunId) lastRunIdRef.current = nextRunId;
          hasReceivedRemoteStateRef.current = true;
          lastRemoteStateAtRef.current = Date.now();
          automaticRetryCountRef.current = 0;
          setRemoteEnded(false);
          setRemoteUnavailable(false);
          setConnectionRecovery('idle');
          setRewardScope(`${ownerUid}:${state.session?.courseCode || sessionId}`);
          setLessonState({
            ...DEFAULT_STATE,
            ...state,
            questions: state.questions || [],
            session: state.session || DEFAULT_STATE.session,
          });
          setConnected(true);
          setClassroomStateReady(true);
        });
        stopPresence = await joinStudentPresence(ownerUid, sessionId);
      };

      connectRemoteClassroom().catch(() => {
        if (!cancelled) {
          setConnected(false);
          setRemoteUnavailable(!hasReceivedRemoteStateRef.current);
          setConnectionRecovery('recovering');
          setClassroomStateReady(true);
          scheduleAutomaticRetry();
        }
      });

      return () => {
        cancelled = true;
        if (retryTimer) window.clearTimeout(retryTimer);
        stopState?.();
        stopPresence?.();
        stopConnection?.();
      };
    }

    const acceptDemoState = (state: LessonDisplayState) => {
      const nextRunId = state.interactionResults?.runId || null;
      if (lastRunIdRef.current && nextRunId && lastRunIdRef.current !== nextRunId) {
        setClassroomMoveNotice('The class moved to the next activity.');
        if (classroomMoveNoticeTimerRef.current) window.clearTimeout(classroomMoveNoticeTimerRef.current);
        classroomMoveNoticeTimerRef.current = window.setTimeout(() => setClassroomMoveNotice(''), 4200);
      }
      if (nextRunId) lastRunIdRef.current = nextRunId;
      lastRemoteStateAtRef.current = Date.now();
      setLessonState(state);
      setConnectionRecovery('idle');
      setConnected(true);
    };

    const storedState = window.localStorage.getItem(LESSON_STORAGE_KEY);
    setRewardScope('demo:ECON302');
    if (storedState) {
      try {
        const parsed = JSON.parse(storedState) as Partial<LessonDisplayState>;
        acceptDemoState({ ...DEFAULT_STATE, ...parsed, session: parsed.session || DEMO_SESSION });
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
        acceptDemoState(event.data.state);
      }
    };
    channel.postMessage({ type: 'student-ready' });
    setClassroomStateReady(true);

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== LESSON_STORAGE_KEY || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as Partial<LessonDisplayState>;
        acceptDemoState({ ...DEFAULT_STATE, ...parsed, session: parsed.session || DEMO_SESSION });
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
  }, [connectionAttempt]);

  useEffect(() => () => {
    if (classroomMoveNoticeTimerRef.current) window.clearTimeout(classroomMoveNoticeTimerRef.current);
  }, []);

  useEffect(() => {
    setCourseSpaceOpen(false);
  }, [lessonState.interactionResults?.runId]);

  const closeCourseSpace = useCallback(() => {
    setCourseSpaceOpen(false);
    window.setTimeout(() => courseTriggerRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!rewardScope) return;
    setRewardStateReady(false);
    setRewardState(loadRewardState(rewardScope));
    setRewardStateReady(true);
  }, [rewardScope]);

  useEffect(() => {
    if (!remoteSession) {
      setStudentNumber('');
      setStudentDisplayName('');
      setManagedRewards([]);
      setManagedRequests([]);
      setManagedRewardsLoading(false);
      return;
    }
    getCurrentStudentAttendance(remoteSession.ownerUid, remoteSession.sessionId)
      .then((claim) => {
        setStudentNumber(claim?.studentNumber || '');
        setStudentDisplayName(claim?.studentDisplayName || '');
      })
      .catch(() => {
        setStudentNumber('');
        setStudentDisplayName('');
      });
  }, [remoteSession]);

  useEffect(() => {
    if (!remoteSession || !studentNumber || !lessonState.session.courseCode) return;
    let cancelled = false;
    setManagedRewardsLoading(true);
    Promise.all([
      getAvailableRewardsForStudent(remoteSession.ownerUid, lessonState.session.courseCode),
      getStudentRewardRequests(remoteSession.ownerUid, lessonState.session.courseCode),
    ]).then(([rewardDefinitions, rewardRequests]) => {
      if (cancelled) return;
      setManagedRewards(rewardDefinitions);
      setManagedRequests(rewardRequests);
    }).catch(() => {
      if (!cancelled) setRewardRequestError('Rewards could not be loaded. Your classroom responses still work normally.');
    }).finally(() => {
      if (!cancelled) setManagedRewardsLoading(false);
    });
    return () => { cancelled = true; };
  }, [lessonState.session.courseCode, remoteSession, studentNumber]);

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

  const claimQuestionReward = useCallback(async (type: QuestionPointRuleKey, questionId: number) => {
    const rule = getQuestionPointRule(type);
    const claimKey = `${type}:${questionId}`;
    if (pendingQuestionClaimsRef.current.has(claimKey)) return;
    pendingQuestionClaimsRef.current.add(claimKey);
    try {
      if (remoteSession) {
        const result = await claimStudentQuestionPoints(remoteSession.ownerUid, remoteSession.sessionId, type, questionId);
        awardReward(`server:${remoteSession.sessionId}:${result.eventId}`, 'seminar', result.claim.amount, result.claim.label);
        if (result.created) setQuestionRewardNotice({ amount: result.claim.amount, label: result.claim.label });
      } else if (!demoQuestionClaimsRef.current.has(rule.id)) {
        demoQuestionClaimsRef.current.add(rule.id);
        awardReward(`demo-question:${rule.id}`, 'seminar', rule.amount, rule.label);
        setQuestionRewardNotice({ amount: rule.amount, label: rule.label });
      }
    } catch {
      // The question remains submitted even if its point claim needs to be settled later.
    } finally {
      pendingQuestionClaimsRef.current.delete(claimKey);
    }
  }, [awardReward, remoteSession]);

  useEffect(() => {
    if (!remoteSession) return;
    let stop: (() => void) | undefined;
    try {
      stop = subscribeToStudentQuestionPointClaims(remoteSession.ownerUid, remoteSession.sessionId, (claims) => {
        Object.entries(claims).forEach(([eventId, claim]) => {
          awardReward(`server:${remoteSession.sessionId}:${eventId}`, 'seminar', claim.amount, claim.label);
        });
      });
    } catch {
      // The classroom connection will retry when the student session is ready.
    }
    return () => stop?.();
  }, [awardReward, remoteSession]);

  useEffect(() => {
    if (!questionRewardNotice) return;
    const timeout = window.setTimeout(() => setQuestionRewardNotice(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [questionRewardNotice]);

  useEffect(() => {
    const ownQuestions = lessonState.questions.filter((question) => ownQuestionIds.includes(question.id));
    ownQuestions.forEach((question) => {
      if (question.votes >= POINT_RULES.questions.supported.threshold) void claimQuestionReward('supported', question.id);
      if (question.votes >= POINT_RULES.questions.helpedRoom.threshold) void claimQuestionReward('helpedRoom', question.id);
      if (lessonState.featuredQuestionId === question.id) void claimQuestionReward('discussed', question.id);
    });
  }, [claimQuestionReward, lessonState.featuredQuestionId, lessonState.questions, ownQuestionIds]);

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
    setTeamName('');
    setTeamDescription('');
    setSelectedTeamId('');
    setCreatingNewTeam(false);
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
          setTeamName(response.teamName || '');
          setTeamDescription(response.teamDescription || '');
          setSelectedTeamId(response.teamId || '');
          setInteractionSubmitted(true);
        })
        .catch(() => undefined);
    } else if (runId) {
      try {
        const storedResponse = window.localStorage.getItem(`classfully-demo-response:${demoVoterIdRef.current}:${runId}`);
        if (!storedResponse) return;
        const response = JSON.parse(storedResponse) as InteractionResponse;
        setSelectedOption(response.optionIndex ?? null);
        setWrittenResponse(response.text || '');
        setTeamName(response.teamName || '');
        setTeamDescription(response.teamDescription || '');
        setSelectedTeamId(response.teamId || '');
        setInteractionSubmitted(true);
      } catch {
        // A malformed local preview response should not interrupt the live room.
      }
    }
  }, [lessonState.interactionResults?.runId, remoteSession]);

  const availableTeamIds = lessonState.teams.map((team) => team.id).join('|');
  useEffect(() => {
    if (lessonState.activeInteraction?.type !== 'group-work') return;
    const savedTeamId = window.localStorage.getItem(`classfully-team:${lessonState.session.courseCode}`) || '';
    if (availableTeamIds.split('|').includes(savedTeamId)) setSelectedTeamId(savedTeamId);
  }, [availableTeamIds, lessonState.activeInteraction?.type, lessonState.interactionResults?.runId, lessonState.session.courseCode]);

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
    const moodOption = MOODS.find((option) => option.key === mood);
    const moodColor = moodOption?.color || '#5146e5';
    const transportId = beginTransport(moodColor, moodOption?.label || 'Check-in', origin);
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
    if (interaction.type === 'team-formation') {
      const existingTeam = lessonState.teams.find((team) => team.id === selectedTeamId);
      if (existingTeam) {
        response.teamId = existingTeam.id;
        response.teamName = existingTeam.name;
        response.teamDescription = existingTeam.description;
        response.teamTag = existingTeam.tag;
        const tagIndex = existingTeam.tag ? interaction.teamTags?.findIndex((tag) => tag === existingTeam.tag) ?? -1 : -1;
        response.optionIndex = tagIndex >= 0 ? tagIndex : undefined;
      } else {
        const normalizedTeamName = teamName.trim().toLocaleLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
        response.teamId = `team-${normalizedTeamName || crypto.randomUUID()}`;
        response.teamName = teamName.trim();
        response.teamDescription = teamDescription.trim() || undefined;
        response.teamTag = selectedOption !== null ? interaction.teamTags?.[selectedOption] : undefined;
      }
    } else if (interaction.type === 'group-work' && selectedTeamId) {
      const team = lessonState.teams.find((item) => item.id === selectedTeamId);
      response.teamId = selectedTeamId;
      response.teamName = team?.name;
      response.teamTag = team?.tag;
    }
    const canShowChoiceColor = interaction.resultVisibility === 'live' || interaction.type === 'pulse';
    const transportColor = canShowChoiceColor && selectedOption !== null
      ? OPTION_COLORS[selectedOption % OPTION_COLORS.length]
      : '#6654e9';
    const transportLabel = interaction.type === 'team-formation'
      ? response.teamName || 'Your team'
      : selectedOption !== null
      ? interaction.options?.[selectedOption] || 'Your choice'
      : writtenResponse.trim() || 'Your response';
    const transportId = beginTransport(transportColor, transportLabel, origin);
    setSubmissionError('');
    setIsSubmitting(true);
    try {
      if (remoteSession) {
        await submitStudentInteractionResponse(remoteSession.ownerUid, remoteSession.sessionId, response);
      } else {
        channelRef.current?.postMessage({ type: 'student-interaction-response', response });
        window.localStorage.setItem(`classfully-demo-response:${demoVoterIdRef.current}:${results.runId}`, JSON.stringify(response));
      }
      setInteractionSubmitted(true);
      if (response.teamId) window.localStorage.setItem(`classfully-team:${lessonState.session.courseCode}`, response.teamId);
      completeTransport(transportId);
      const participationPoints = getParticipationPoints(interaction.type);
      window.setTimeout(() => {
        if (participationPoints > 0) awardReward(`${results.runId}:response`, 'seminar', participationPoints, `${interaction.label} response`);
      }, 720);
    } catch {
      const saved = remoteSession
        ? await getStudentResponse(remoteSession.ownerUid, remoteSession.sessionId, results.runId).catch(() => null)
        : null;
      if (saved) {
        setSelectedOption(saved.optionIndex ?? null);
        setWrittenResponse(saved.text || '');
        setTeamName(saved.teamName || '');
        setTeamDescription(saved.teamDescription || '');
        setSelectedTeamId(saved.teamId || '');
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
    if (runId) awardReward(`${runId}:prediction`, 'seminar', POINT_RULES.privatePrediction, 'Private prediction');
  };

  useEffect(() => {
    const interaction = lessonState.activeInteraction;
    const results = lessonState.interactionResults;
    if (!interactionSubmitted || !interaction || !results?.revealed) return;

    if ((interaction.type === 'quiz' || interaction.type === 'peer-learning') && selectedOption === interaction.correctOptionIndex) {
      awardReward(`${results.runId}:correct`, 'score', interaction.type === 'peer-learning' ? POINT_RULES.strongSecondAnswer : POINT_RULES.correctQuizAnswer, interaction.type === 'peer-learning' ? 'Strong second answer' : 'Correct quiz answer');
    }

    if (interaction.type === 'poll' && prediction !== null && results.optionCounts.length) {
      const leadingCount = Math.max(...results.optionCounts);
      if (results.optionCounts[prediction] === leadingCount) {
        awardReward(`${results.runId}:room-read`, 'seminar', POINT_RULES.roomRead, 'Room read');
      }
    }
  }, [awardReward, interactionSubmitted, lessonState.activeInteraction, lessonState.interactionResults, prediction, selectedOption]);

  const requestReward = async (reward: CourseReward) => {
    setRewardRequestError('');
    if (remoteSession) {
      const managedReward = managedRewards.find((item) => item.id === reward.id);
      if (!managedReward || !studentNumber) return;
      try {
        await requestManagedReward({
          teacherId: remoteSession.ownerUid,
          courseId: managedReward.courseId,
          courseCode: managedReward.courseCode,
          studentNumber,
          studentDisplayName,
          reward: managedReward,
          pointsAtRequest: rewardState.seminarPoints,
        });
        setManagedRequests(await getStudentRewardRequests(remoteSession.ownerUid, managedReward.courseCode));
        confirmResponseHaptic();
      } catch (requestError) {
        setRewardRequestError(getUserFacingError(requestError, 'The reward request did not go through. Your points are unchanged, so you can try again.'));
      }
      return;
    }
    setRewardRequestError('Join a live class before requesting a reward.');
  };

  const toggleWaitingQuestion = async (questionId: number) => {
    if (ownQuestionIds.includes(questionId) || pendingQuestionVotes[questionId]) return;
    const question = lessonState.questions.find((item) => item.id === questionId);
    if (!question) return;
    const wasVoted = selectedQuestionVotes.includes(questionId);
    const nextVoted = !wasVoted;
    const pendingVote = { baseline: question.votes, delta: nextVoted ? 1 : -1 };
    setSelectedQuestionVotes((current) => (
      nextVoted ? [...current, questionId] : current.filter((id) => id !== questionId)
    ));
    setPendingQuestionVotes((current) => ({ ...current, [questionId]: pendingVote }));
    setQuestionVoteErrors((current) => {
      const next = { ...current };
      delete next[questionId];
      return next;
    });
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
      if (nextVoted) markGuidanceLearned('upvotes');
      window.setTimeout(() => {
        setPendingQuestionVotes((current) => {
          if (current[questionId] !== pendingVote) return current;
          const next = { ...current };
          delete next[questionId];
          return next;
        });
      }, 2500);
    } catch {
      setSelectedQuestionVotes((current) => (
        wasVoted ? [...current, questionId] : current.filter((id) => id !== questionId)
      ));
      setPendingQuestionVotes((current) => {
        const next = { ...current };
        delete next[questionId];
        return next;
      });
      setQuestionVoteErrors((current) => ({ ...current, [questionId]: 'Upvote not saved. Check the connection and try again.' }));
    }
  };

  const postStudentQuestion = async () => {
    const cleanQuestion = questionDraft.trim().replace(/\s+/g, ' ').slice(0, 180);
    if (!cleanQuestion || questionSubmitting) return;
    setQuestionSubmitting(true);
    setQuestionError('');
    setQuestionNotice('');
    try {
      let question: LiveQuestion;
      if (remoteSession) {
        question = await submitStudentQuestion(remoteSession.ownerUid, remoteSession.sessionId, cleanQuestion);
      } else {
        question = {
          id: Date.now() * 100 + Math.floor(Math.random() * 100),
          initials: 'Q',
          ago: 'Just now',
          question: cleanQuestion,
          votes: 0,
          source: 'student',
        };
        channelRef.current?.postMessage({ type: 'student-question-submit', question });
      }
      setLessonState((current) => ({
        ...current,
        questions: [question, ...current.questions.filter((item) => item.id !== question.id)],
      }));
      setOwnQuestionIds((current) => current.includes(question.id) ? current : [...current, question.id]);
      setQuestionDraft('');
      await claimQuestionReward('asked', question.id);
      setQuestionNotice('Question sent. If it helps the room, it can earn up to 9 points this session.');
      confirmResponseHaptic();
    } catch (questionSubmitError) {
      setQuestionError(getUserFacingError(questionSubmitError, 'Your question was not sent. Check the connection and try again.'));
    } finally {
      setQuestionSubmitting(false);
    }
  };

  const step = lessonState.onboardingStep;
  const requestStatuses = managedRewards.reduce<Record<string, RewardRequestStatus>>((statuses, reward) => {
    const rewardRequests = managedRequests.filter((request) => request.rewardId === reward.id);
    const activeRequest = rewardRequests.find((request) => request.status === 'pending' || request.status === 'approved');
    if (activeRequest) {
      statuses[reward.id] = activeRequest.status;
      return statuses;
    }
    const usedCount = rewardRequests.filter((request) => request.status === 'used').length;
    if (usedCount >= (reward.limitPerStudent || 1)) statuses[reward.id] = 'used';
    return statuses;
  }, {});

  const courseSpaceEnabled = !remoteSession || Boolean(studentNumber);
  const lobbyGuidance: StudentGuidanceId | null = guidanceReady && lessonState.lobbyOpen && !lessonState.activeInteraction
    ? !learnedGuidance.includes('questions') ? 'questions'
      : !learnedGuidance.includes('auto-update') ? 'auto-update'
        : null
    : null;
  const waitingGuidance: StudentGuidanceId | null = guidanceReady && interactionSubmitted && lessonState.activeInteraction
    ? lessonState.questions.length > 0 && !learnedGuidance.includes('upvotes') ? 'upvotes'
      : latestReward && !learnedGuidance.includes('points') ? 'points'
        : null
    : null;

  const openQuestionsFromGuidance = (id: 'questions' | 'upvotes') => {
    markGuidanceLearned(id);
    if (id === 'upvotes') markGuidanceLearned('questions');
    setCourseSpaceOpen(false);
    setQuestionSheetOpen(true);
    setQuestionNotice('');
    setQuestionError('');
  };

  const openProgressFromGuidance = () => {
    markGuidanceLearned('points');
    setQuestionSheetOpen(false);
    setCourseView('home');
    setCourseSpaceOpen(true);
  };

  const courseHomeProps = {
    lessonState,
    rewards: rewardState,
    courseRewards: remoteSession ? managedRewards : [],
    requestStatuses,
    onRequestReward: requestReward,
    enableSocialRewards: courseSpaceEnabled,
    rewardsLoading: remoteSession ? managedRewardsLoading : false,
    view: courseView,
    onViewChange: setCourseView,
  };
  const activePromptLength = markdownToPlainText(lessonState.activeInteraction?.prompt || '').length;
  const promptDensityClass = activePromptLength > 110 ? 'is-very-long' : activePromptLength > 70 ? 'is-long' : '';
  const responseReady = Boolean(
    lessonState.activeInteraction?.type === 'team-formation'
      ? selectedTeamId || (teamName.trim().length >= 2 && (!lessonState.activeInteraction.requireTeamTag || selectedOption !== null))
      : lessonState.activeInteraction?.type === 'group-work' && lessonState.teams.length
        ? selectedTeamId && writtenResponse.trim()
        : lessonState.activeInteraction?.options?.length ? selectedOption !== null : writtenResponse.trim(),
  );
  const selectedAnswerLetter = selectedOption !== null ? String.fromCharCode(65 + selectedOption) : '';
  const selectedAnswerText = selectedOption !== null ? lessonState.activeInteraction?.options?.[selectedOption] : '';
  const responseActionLabel = isSubmitting
    ? 'Sending response'
    : lessonState.activeInteraction?.options?.length && selectedAnswerLetter
      ? `Send answer ${selectedAnswerLetter}`
      : lessonState.activeInteraction?.type === 'team-formation'
        ? selectedTeamId ? `Join ${lessonState.teams.find((team) => team.id === selectedTeamId)?.name || 'team'}` : 'Create team'
      : lessonState.activeInteraction?.type === 'group-work'
        ? selectedTeamId ? `Send for ${lessonState.teams.find((team) => team.id === selectedTeamId)?.name || 'team'}` : lessonState.teams.length ? 'Send team response' : 'Send group response'
        : lessonState.activeInteraction?.type === 'word-cloud'
          ? 'Add to word cloud'
          : 'Send response';

  useEffect(() => {
    if (!responseReady || interactionSubmitted) return;

    const frame = window.requestAnimationFrame(() => {
      const scrollRegion = document.querySelector<HTMLElement>('.student-welcome-content');
      const actionDock = document.querySelector<HTMLElement>('.student-response-action.is-ready');
      if (!scrollRegion || !actionDock) return;

      // The action tray is fixed so it remains reachable. Settle the scroll
      // region at its reserved bottom space as soon as the tray appears,
      // keeping the remaining choices above the tray instead of behind it.
      scrollRegion.scrollTop = scrollRegion.scrollHeight - scrollRegion.clientHeight;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [interactionSubmitted, responseReady, selectedOption]);

  if (!classroomStateReady || (!remoteUnavailable && !rewardStateReady) || (remoteEnded && !rewardStateReady)) {
    return <ClassroomStateGate message="Loading the current activity and your private class record." />;
  }

  return (
    <IconContext.Provider value={{ weight: 'duotone' }}>
    <main className="student-welcome-shell">
      <header className="student-welcome-header">
        <div className="student-brand">Classfully<span>.</span></div>
        <div className="student-header-actions">
          <span className={`student-connection ${connected ? 'is-connected' : connectionRecovery === 'recovering' ? 'is-recovering' : ''}`}><i /> {remoteUnavailable ? remoteEnded ? 'Class ended' : connectionRecovery === 'recovering' ? 'Reconnecting' : 'Needs attention' : connected ? 'Connected' : 'Reconnecting'}</span>
          {courseSpaceEnabled && !remoteUnavailable && step === 0 && Boolean(lessonState.activeInteraction) && <button
            ref={courseTriggerRef}
            type="button"
            className="student-course-trigger"
            aria-label={`Open my course, ${rewardState.seminarPoints} points`}
            aria-haspopup="dialog"
            aria-expanded={courseSpaceOpen}
            onClick={() => {
              setQuestionSheetOpen(false);
              setCourseSpaceOpen(true);
              markGuidanceLearned('points');
            }}
          ><UserCircle size={18} /><span>My course</span><strong>{rewardState.seminarPoints}</strong></button>}
        </div>
      </header>

      <section className="student-welcome-content" ref={contentRef}>
        {!remoteUnavailable && connectionRecovery !== 'idle' && (
          <div className={`student-recovery-banner ${connectionRecovery === 'failed' ? 'has-failed' : ''}`} role="status" aria-live="polite">
            <span><ArrowClockwise size={18} /></span>
            <div><strong>{connectionRecovery === 'failed' ? 'Connection needs a hand' : 'Reconnecting to class'}</strong><small>{connectionRecovery === 'failed' ? 'Your answer is still here. Try reconnecting when your signal is ready.' : 'Keep this page open. Your unfinished answer is safe.'}</small></div>
            {connectionRecovery === 'failed' && <HapticButton type="button" depth="compact" onClick={reconnectToClassroom}>Reconnect now</HapticButton>}
          </div>
        )}
        {classroomMoveNotice && <div className="student-class-move-notice" role="status"><Activity size={16} /><span>{classroomMoveNotice}</span></div>}
        {!remoteUnavailable && lessonState.timer && lessonState.activeInteraction?.type !== 'timer' && <StudentTimerBanner timer={lessonState.timer} />}
        {remoteUnavailable && !remoteEnded && (
          <div className="student-ready-state student-recovery-state" role="status">
            <span className="student-round-icon"><ArrowClockwise size={28} /></span>
            <div className="student-kicker">{connectionRecovery === 'recovering' ? 'Reconnecting' : 'Connection help'}</div>
            <h1>{connectionRecovery === 'recovering' ? 'Finding your class again.' : 'We could not reconnect yet.'}</h1>
            <p>{connectionRecovery === 'recovering' ? 'Keep this page open. We will bring you back to the current activity automatically.' : 'Check your signal, then try again. If this continues, ask your instructor to confirm the session is open.'}</p>
            {connectionRecovery === 'failed' && <HapticButton type="button" className="student-reconnect-button" hapticTone="action" onClick={reconnectToClassroom}><ArrowClockwise size={17} /> Reconnect now</HapticButton>}
          </div>
        )}

        {remoteUnavailable && remoteEnded && rewardStateReady && <StudentCourseHome {...courseHomeProps} classEnded />}

        {!remoteUnavailable && step === 0 && lessonState.lobbyOpen && !lessonState.activeInteraction && (
          <div className="student-lobby-state">
            <span className="student-round-icon is-success"><Check size={30} /></span>
            <div className="student-kicker">You’re in the room</div>
            <h1>Ready when your instructor is.</h1>
            <p>Keep this page open. The first activity will appear here automatically.</p>
            <div className="student-lobby-class-card">
              <span><Users size={20} /></span>
              <div><strong>{lessonState.session.courseCode}</strong><small>{lessonState.session.sessionTitle} · {lessonState.session.instructorName || 'Your instructor'}</small></div>
              <Check size={18} />
            </div>
            <div className="student-lobby-waiting"><i /><span><strong>{lessonState.connectedStudents || 0} connected</strong><small>You do not need to refresh</small></span></div>
            {lobbyGuidance && !guidanceHiddenForMoment && !questionSheetOpen && (
              <StudentQuietGuide
                id={lobbyGuidance}
                onAction={lobbyGuidance === 'questions' ? () => openQuestionsFromGuidance('questions') : undefined}
                onDismiss={() => markGuidanceLearned(lobbyGuidance)}
              />
            )}
          </div>
        )}

        {!remoteUnavailable && step === 0 && !lessonState.lobbyOpen && !lessonState.activeInteraction && (
          <StudentCourseHome
            {...courseHomeProps}
          />
        )}

        {rewardRequestError && <div className="student-response-error" role="alert">{rewardRequestError}</div>}

        {!remoteUnavailable && step === 0 && lessonState.activeInteraction && lessonState.interactionResults && (
          <div className="student-interaction-state">
            {interactionSubmitted ? (
              <StudentPostSubmit
                interaction={lessonState.activeInteraction}
                answer={lessonState.activeInteraction.type === 'team-formation' ? lessonState.teams.find((team) => team.id === selectedTeamId)?.name || teamName || 'Team saved' : lessonState.activeInteraction.options?.[selectedOption ?? -1] || writtenResponse || 'Response saved'}
                questions={lessonState.questions}
                selectedQuestionVotes={selectedQuestionVotes}
                ownQuestionIds={ownQuestionIds}
                pendingQuestionVotes={pendingQuestionVotes}
                questionVoteErrors={questionVoteErrors}
                onToggleQuestion={toggleWaitingQuestion}
                confidence={confidence}
                onConfidence={setConfidence}
                prediction={prediction}
                onPrediction={selectPrediction}
                revealed={lessonState.interactionResults.revealed}
                responseCount={lessonState.interactionResults.responseCount}
                runId={lessonState.interactionResults.runId}
                optionCounts={lessonState.interactionResults.optionCounts}
                writtenResponses={lessonState.interactionResults.writtenResponses}
                rewardState={rewardState}
                latestReward={latestReward}
                phase={lessonState.interactionResults.phase}
                guidance={waitingGuidance && !guidanceHiddenForMoment && !questionSheetOpen && !courseSpaceOpen ? (
                  <StudentQuietGuide
                    id={waitingGuidance}
                    onAction={waitingGuidance === 'upvotes' ? () => openQuestionsFromGuidance('upvotes') : openProgressFromGuidance}
                    onDismiss={() => markGuidanceLearned(waitingGuidance)}
                  />
                ) : undefined}
              />
            ) : lessonState.activeInteraction.type === 'spin-wheel' ? (
              <div className={`student-wheel-module ${lessonState.interactionResults.wheelSelectedLabel ? 'has-result' : ''}`}>
                <span className="student-round-icon"><DiceFive size={28} /></span>
                <div className="student-kicker">Spin the wheel · Live now</div>
                <MarkdownContent heading className="student-interaction-question" markdown={lessonState.activeInteraction.prompt} />
                <div className="student-wheel-orbit" aria-hidden="true"><i /><i /><i /><span><DiceFive size={24} /></span></div>
                <div className="student-wheel-result" key={`student-wheel-${lessonState.interactionResults.wheelSpinCount || 0}`}><small>{lessonState.interactionResults.wheelSelectedLabel ? 'Selected' : 'Watch the classroom screen'}</small><strong>{lessonState.interactionResults.wheelSelectedLabel || 'The instructor will spin the wheel.'}</strong></div>
                <div className="student-clock-note"><Lock size={16} /><span>No response is needed. Your phone will update with the result.</span></div>
              </div>
            ) : lessonState.activeInteraction.type === 'timer' ? (
              <div className="student-clock-module" role="timer">
                <span className="student-round-icon"><Timer size={27} /></span>
                <div className="student-kicker">Clock · Live now</div>
                <h1>{lessonState.activeInteraction.title}</h1>
                <MarkdownContent className="student-clock-instructions" markdown={lessonState.activeInteraction.prompt} />
                {lessonState.timer && <StudentTimerBanner timer={lessonState.timer} />}
                <div className="student-clock-note"><Lock size={16} /><span>No response is needed. Look up when the clock ends.</span></div>
              </div>
            ) : (
              <>
                <div className="student-interaction-meta">
                  <span className="student-interaction-type-icon"><ListChecks size={16} /></span>
                  <div className="student-kicker">{lessonState.activeInteraction.label} · {lessonState.interactionResults.phase === 'respond-again' ? 'Answer again' : 'Live now'}</div>
                </div>
                <MarkdownContent heading className={`student-interaction-question ${promptDensityClass}`} markdown={lessonState.activeInteraction.prompt} />
                <p>{lessonState.activeInteraction.type === 'team-formation' ? 'Choose your team. If it is not here yet, one person can create it.' : lessonState.activeInteraction.type === 'group-work' ? lessonState.teams.length ? 'Choose your team, then have one person send the response.' : `Work in a group of about ${lessonState.activeInteraction.groupSize || 4}. Choose one note-taker to send your group’s response.` : lessonState.activeInteraction.type === 'word-cloud' ? 'Send one word or a short phrase. Repeated answers will grow together on the projector.' : lessonState.interactionResults.phase === 'respond-again' ? 'Choose again. It is fine to keep your answer or change it.' : lessonState.activeInteraction.options?.length ? 'Choose one response.' : 'Write a short response, then send it to the class.'}</p>

                {lessonState.activeInteraction.type === 'team-formation' ? (
                  <div className="student-team-form">
                    {lessonState.teams.length > 0 && <fieldset className="student-team-picker"><legend>Which team are you on?</legend><div>{lessonState.teams.map((team) => <HapticButton key={team.id} type="button" role="radio" aria-checked={selectedTeamId === team.id} className={selectedTeamId === team.id ? 'is-selected' : ''} onClick={() => { setSelectedTeamId(team.id); setCreatingNewTeam(false); }}><span><strong>{team.name}</strong>{team.tag && <small>{team.tag}</small>}</span><b>{team.memberCount || 0} joined</b>{selectedTeamId === team.id && <Check size={18} />}</HapticButton>)}</div></fieldset>}
                    {lessonState.teams.length > 0 && <button type="button" className="student-create-team-toggle" onClick={() => { setCreatingNewTeam((current) => !current); setSelectedTeamId(''); }}>{creatingNewTeam ? 'Choose a team already here' : 'My team is not listed'}</button>}
                    {(lessonState.teams.length === 0 || creatingNewTeam || teamName.trim().length > 0) && <div className="student-new-team-fields">
                      <label><span>Team name</span><input value={teamName} onChange={(event) => setTeamName(event.target.value.slice(0, 48))} maxLength={48} placeholder="Give your team a name" autoComplete="off" /></label>
                      <label><span>What are you working on? <small>Optional</small></span><textarea value={teamDescription} onChange={(event) => setTeamDescription(event.target.value.slice(0, 160))} maxLength={160} rows={3} placeholder="Add a short note for the class" /></label>
                      {Boolean(lessonState.activeInteraction.teamTags?.length) && <fieldset><legend>Choose your focus</legend><div className="student-team-tags">{lessonState.activeInteraction.teamTags?.map((tag, index) => <HapticButton key={tag} type="button" className={selectedOption === index ? 'is-selected' : ''} aria-pressed={selectedOption === index} onClick={() => setSelectedOption(index)}>{tag}{selectedOption === index && <Check size={16} />}</HapticButton>)}</div></fieldset>}
                    </div>}
                  </div>
                ) : lessonState.activeInteraction.options?.length ? (
                  <div className="student-interaction-options" role="radiogroup" aria-label={markdownToPlainText(lessonState.activeInteraction.prompt)}>
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
                ) : lessonState.activeInteraction.type === 'word-cloud' ? (
                  <label className="student-word-answer">
                    <span>One word or short phrase</span>
                    <input value={writtenResponse} onChange={(event) => setWrittenResponse(event.target.value.slice(0, 48))} disabled={!lessonState.interactionResults?.open} maxLength={48} placeholder="Type your answer" aria-label="Your word or short phrase" autoComplete="off" />
                    <small>{writtenResponse.length}/48</small>
                  </label>
                ) : (
                  <div className="student-group-response">
                    {lessonState.activeInteraction.type === 'group-work' && lessonState.teams.length > 0 && <label><span>Your team</span><select value={selectedTeamId} onChange={(event) => { setSelectedTeamId(event.target.value); if (event.target.value) window.localStorage.setItem(`classfully-team:${lessonState.session.courseCode}`, event.target.value); }}><option value="">Choose your team</option>{lessonState.teams.map((team) => <option key={team.id} value={team.id}>{team.name}{team.tag ? ` · ${team.tag}` : ''}</option>)}</select></label>}
                    <textarea value={writtenResponse} onChange={(event) => setWrittenResponse(event.target.value.slice(0, 280))} disabled={!lessonState.interactionResults?.open} rows={5} maxLength={280} placeholder={lessonState.activeInteraction.type === 'group-work' ? lessonState.teams.length ? 'One response from your team' : 'One response from your group' : 'Type your response here'} aria-label={lessonState.activeInteraction.type === 'group-work' ? lessonState.teams.length ? 'Your team response' : 'Your group response' : 'Your response'} />
                  </div>
                )}

                {!lessonState.interactionResults.open ? (
                  <div className="student-submitted is-locked" role="status"><Lock size={18} /><span><strong>Responses are locked.</strong> Look up for the class discussion.</span></div>
                ) : (
                  <div className="student-response-action is-ready">
                    <HapticButton
                      type="button"
                      className={`student-send-response ${isSubmitting ? 'is-sending' : ''}`}
                      hapticTone="action"
                      aria-label={selectedAnswerText ? `${responseActionLabel}: ${selectedAnswerText}` : responseActionLabel}
                      disabled={isSubmitting || !responseReady}
                      onClick={(event) => submitInteraction(event.currentTarget)}
                    >
                      <span>{responseActionLabel}</span><Send size={17} />
                    </HapticButton>
                  </div>
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
            <div className="student-privacy-note"><Lock size={16} /><span><strong>Your pulse response stays private.</strong> The projector shows class totals only.</span></div>
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

      {!remoteUnavailable && connected && (
        <HapticButton
          type="button"
          depth="compact"
          className="student-question-launch"
          aria-label="Questions"
          aria-expanded={questionSheetOpen}
          aria-haspopup="dialog"
          onClick={() => {
            setQuestionSheetOpen(true);
            markGuidanceLearned('questions');
            setQuestionNotice('');
            setQuestionError('');
          }}
        >
          <MessageCircle size={18} /><span>Questions</span>{lessonState.questions.length > 0 && <strong>{lessonState.questions.length}</strong>}
        </HapticButton>
      )}

      {questionSheetOpen && !remoteUnavailable && (
        <StudentQuestionSheet
          questions={lessonState.questions}
          selectedVotes={selectedQuestionVotes}
          ownQuestionIds={ownQuestionIds}
          pendingVotes={pendingQuestionVotes}
          voteErrors={questionVoteErrors}
          draft={questionDraft}
          submitting={questionSubmitting}
          notice={questionNotice}
          error={questionError}
          onDraftChange={setQuestionDraft}
          onSubmit={postStudentQuestion}
          onToggleVote={toggleWaitingQuestion}
          onClose={() => setQuestionSheetOpen(false)}
        />
      )}

      {courseSpaceOpen && !remoteUnavailable && lessonState.activeInteraction && (
        <StudentCourseSheet
          points={rewardState.seminarPoints}
          studentName={studentDisplayName || (studentNumber ? `Student •${studentNumber.slice(-4)}` : 'Your course record')}
          onClose={closeCourseSpace}
        >
          <StudentCourseHome {...courseHomeProps} embedded />
        </StudentCourseSheet>
      )}

      {transportSignal && <ResponseTransferEffect key={transportSignal.id} signal={transportSignal} />}

      {questionRewardNotice && <div className="student-question-reward-toast" role="status"><Sparkles size={18} /><span><strong>+{questionRewardNotice.amount} points</strong>{questionRewardNotice.label}</span></div>}

      <footer className="student-welcome-footer">
        <Link href="/privacy" target="_blank"><Lock size={13} /> Privacy</Link>
        {studentNumber && <span className="student-footer-identity" title={`Student number ${studentNumber}`}><small>You</small><b>{studentDisplayName || `Student •${studentNumber.slice(-4)}`}</b></span>}
        <span className="student-footer-class"><small>Class</small><strong>{lessonState.session.sessionCode}</strong></span>
      </footer>
    </main>
    </IconContext.Provider>
  );
}
