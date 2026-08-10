'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ClassfullyRemote from '@/components/live/ClassfullyRemote';
import ClassroomStateGate from '@/components/live/ClassroomStateGate';
import LivingMoodField from '@/components/live/LivingMoodField';
import MarkdownContent, { markdownToPlainText } from '@/components/live/MarkdownContent';
import ProjectorPreflight from '@/components/live/ProjectorPreflight';
import InstructorAvatar from '@/components/teacher/InstructorAvatar';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  initializeInstructorClassroom,
  publishInstructorState,
  subscribeToInstructorDisplayPresence,
  subscribeToInstructorAttendance,
  subscribeToInstructorPresence,
  subscribeToInstructorPublicState,
  subscribeToInstructorQuestionVotes,
  subscribeToInstructorStudentQuestions,
  subscribeToInstructorResponses,
  subscribeToInstructorWelcomeResponses,
  endInstructorClassroom,
  resetInstructorClassroom,
  setInstructorQuestionDismissed,
  setInstructorQuestionRecognized,
  type StoredLiveResponse,
  type StoredAttendanceClaim,
} from '@/lib/firebase/live-classroom';
import { Timestamp } from 'firebase/firestore';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bold,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  CircleHelp,
  ClipboardCheck,
  Cloud,
  Copy,
  GraduationCap,
  GripVertical,
  HeartPulse,
  Italic,
  Laptop,
  ListChecks,
  ListOrdered,
  List as ListIcon,
  Lock,
  LogOut,
  MessageCircle,
  MonitorUp,
  MoreHorizontal,
  PictureInPicture2,
  Pause,
  Play,
  Plus,
  QrCode,
  Repeat2,
  Send,
  Smartphone,
  Square,
  RotateCcw,
  ThumbsUp,
  Timer,
  TimerReset,
  Trash2,
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
  buildWordCloudItems,
  createInteractionResults,
  formatSessionCode,
  percent,
  prepareLiveInteractions,
  resultPercent,
  total,
  type Counts,
  type InteractionResponse,
  type InteractionResults,
  type LessonDisplayState,
  type LiveQuestion,
  type LiveSessionContext,
  type LiveInteraction,
  type LiveTimer,
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

const ACTIVITY_TYPES: Array<{
  type: LiveInteraction['type'];
  label: string;
  description: string;
  icon: typeof Activity;
}> = [
  { type: 'timer', label: 'Timer', description: 'Full-screen working time', icon: Timer },
  { type: 'pulse', label: 'Class pulse', description: 'Check pace, confidence, or mood', icon: HeartPulse },
  { type: 'poll', label: 'Poll', description: 'See where the room stands', icon: BarChart3 },
  { type: 'quiz', label: 'Quiz', description: 'Check understanding', icon: CircleHelp },
  { type: 'open-response', label: 'Short response', description: 'Gather written thinking', icon: MessageCircle },
  { type: 'word-cloud', label: 'Word cloud', description: 'Surface shared themes', icon: Cloud },
  { type: 'peer-learning', label: 'Peer learning', description: 'Answer, discuss, answer again', icon: Repeat2 },
  { type: 'group-work', label: 'Group work', description: 'Give teams a shared task', icon: Users },
];

const createInteractionDraft = (type: LiveInteraction['type'], initial?: LiveInteraction): LiveInteraction => {
  if (initial) return initial;
  const choiceOptions = type === 'pulse'
    ? ['Very low', 'Low', 'Steady', 'High', 'Very high']
    : ['Option 1', 'Option 2', 'Option 3', 'Option 4'];
  const choiceType = type === 'pulse' || type === 'poll' || type === 'quiz' || type === 'peer-learning';
  const choice = ACTIVITY_TYPES.find((item) => item.type === type);
  return {
    id: `${type}-${Date.now()}`,
    type,
    label: choice?.label || 'Interaction',
    title: type === 'timer' ? 'Group work' : choice?.label || 'Class interaction',
    prompt: type === 'timer'
      ? 'Use this time to complete the task on screen.'
      : type === 'word-cloud'
        ? 'What one word best captures this idea?'
        : type === 'open-response'
          ? 'What is still unclear?'
          : type === 'group-work'
            ? 'Work together on the task on screen.'
            : 'What do you think?',
    options: choiceType ? choiceOptions : undefined,
    correctOptionIndex: type === 'quiz' || type === 'peer-learning' ? 0 : undefined,
    explanation: type === 'quiz' || type === 'peer-learning' ? 'Explain why this answer is correct.' : undefined,
    durationMinutes: type === 'timer' ? 5 : type === 'group-work' ? 8 : undefined,
    discussionMinutes: type === 'peer-learning' ? 2 : undefined,
    groupSize: type === 'group-work' ? 4 : undefined,
    resultVisibility: type === 'quiz' || type === 'peer-learning' ? 'after-reveal' : type === 'open-response' || type === 'group-work' ? 'instructor-only' : 'live',
    plannedTime: 'Added during class',
  };
};

function ActivityTypePicker({ onSelect }: { onSelect: (type: LiveInteraction['type']) => void }) {
  return (
    <div className="activity-type-picker" role="group" aria-label="Interaction types">
      {ACTIVITY_TYPES.map(({ type, label, description, icon: Icon }) => (
        <button type="button" key={type} onClick={() => onSelect(type)}>
          <Icon size={18} />
          <span><strong>{label}</strong><small>{description}</small></span>
          <ArrowRight size={14} />
        </button>
      ))}
    </div>
  );
}

function InteractionComposer({
  type,
  initial,
  submitLabel,
  busy = false,
  onCancel,
  onSubmit,
}: {
  type: LiveInteraction['type'];
  initial?: LiveInteraction;
  submitLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onSubmit: (interaction: LiveInteraction) => void;
}) {
  const [initialDraft] = useState(() => createInteractionDraft(type, initial));
  const [title, setTitle] = useState(initialDraft.title);
  const [prompt, setPrompt] = useState(initialDraft.prompt);
  const [options, setOptions] = useState(initialDraft.options || []);
  const [correctOptionIndex, setCorrectOptionIndex] = useState(initialDraft.correctOptionIndex || 0);
  const [explanation, setExplanation] = useState(initialDraft.explanation || '');
  const [discussionMinutes, setDiscussionMinutes] = useState(String(initialDraft.discussionMinutes || 2));
  const [groupSize, setGroupSize] = useState(String(initialDraft.groupSize || 4));
  const [resultVisibility, setResultVisibility] = useState(initialDraft.resultVisibility || 'live');
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const initialDurationSeconds = Math.max(1, Math.round((initialDraft.durationMinutes || 5) * 60));
  const [minutes, setMinutes] = useState(String(Math.floor(initialDurationSeconds / 60)));
  const [seconds, setSeconds] = useState(String(initialDurationSeconds % 60));
  const usesChoices = type === 'pulse' || type === 'poll' || type === 'quiz' || type === 'peer-learning';
  const usesTimer = type === 'timer' || type === 'group-work';

  const applyMarkdown = (prefix: string, suffix = prefix, linePrefix = false) => {
    const field = promptRef.current;
    if (!field) return;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const selection = prompt.slice(start, end);
    let replacement: string;
    if (linePrefix) {
      const selected = selection || 'List item';
      replacement = selected.split('\n').map((line, index) => `${prefix.replace('{n}', String(index + 1))}${line}`).join('\n');
    } else {
      replacement = `${prefix}${selection || 'text'}${suffix}`;
    }
    setPrompt(`${prompt.slice(0, start)}${replacement}${prompt.slice(end)}`);
    window.requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start, start + replacement.length);
    });
  };

  const submit = () => {
    const durationSeconds = Math.max(1, (Number.parseInt(minutes || '0', 10) || 0) * 60 + (Number.parseInt(seconds || '0', 10) || 0));
    onSubmit({
      ...initialDraft,
      title: title.trim() || initialDraft.label,
      prompt: prompt.trim() || title.trim(),
      options: usesChoices ? options.map((option) => option.trim()).filter(Boolean) : undefined,
      correctOptionIndex: type === 'quiz' || type === 'peer-learning' ? correctOptionIndex : undefined,
      explanation: type === 'quiz' || type === 'peer-learning' ? explanation.trim() || undefined : undefined,
      durationMinutes: usesTimer ? durationSeconds / 60 : initialDraft.durationMinutes,
      discussionMinutes: type === 'peer-learning' ? Math.max(1, Number.parseInt(discussionMinutes || '2', 10) || 2) : undefined,
      groupSize: type === 'group-work' ? Math.max(2, Number.parseInt(groupSize || '4', 10) || 4) : undefined,
      resultVisibility: type === 'timer' ? 'instructor-only' : resultVisibility,
    });
  };

  return (
    <div className="interaction-composer">
      <div className="interaction-composer-heading">
        <button type="button" onClick={onCancel}><ChevronLeft size={15} /> Types</button>
        <strong>{initial ? `Edit ${initialDraft.label.toLowerCase()}` : `New ${initialDraft.label.toLowerCase()}`}</strong>
      </div>
      <label><span>Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} placeholder="Give this moment a clear name" /></label>
      <label className="interaction-composer-markdown">
        <span>{type === 'timer' || type === 'group-work' ? 'Instructions' : 'Question or instruction'}</span>
        <div className="interaction-format-toolbar" role="toolbar" aria-label="Text formatting">
          <button type="button" aria-label="Bold" title="Bold" onClick={() => applyMarkdown('**')}><Bold size={14} /></button>
          <button type="button" aria-label="Italic" title="Italic" onClick={() => applyMarkdown('*')}><Italic size={14} /></button>
          <button type="button" aria-label="Bulleted list" title="Bulleted list" onClick={() => applyMarkdown('- ', '', true)}><ListIcon size={15} /></button>
          <button type="button" aria-label="Numbered list" title="Numbered list" onClick={() => applyMarkdown('{n}. ', '', true)}><ListOrdered size={15} /></button>
          <span>Markdown</span>
        </div>
        <textarea aria-label={type === 'timer' || type === 'group-work' ? 'Instructions' : 'Question or instruction'} ref={promptRef} value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={1200} rows={type === 'timer' || type === 'group-work' ? 7 : 4} />
      </label>
      {prompt.trim() && <div className="interaction-markdown-preview"><span>Preview</span><MarkdownContent markdown={prompt} /></div>}
      {usesChoices && (
        <div className="interaction-composer-options">
          <span>Answer choices</span>
          {options.map((option, index) => (
            <label key={`${initialDraft.id}-option-${index}`}>
              {(type === 'quiz' || type === 'peer-learning') && <input type="radio" name={`correct-${initialDraft.id}`} checked={correctOptionIndex === index} onChange={() => setCorrectOptionIndex(index)} aria-label={`Mark choice ${index + 1} correct`} />}
              <input value={option} onChange={(event) => setOptions((current) => current.map((item, optionIndex) => optionIndex === index ? event.target.value : item))} aria-label={`Choice ${index + 1}`} />
              {options.length > 2 && <button type="button" aria-label={`Remove choice ${index + 1}`} onClick={() => {
                setOptions((current) => current.filter((_, optionIndex) => optionIndex !== index));
                setCorrectOptionIndex((current) => current === index ? 0 : current > index ? current - 1 : current);
              }}><X size={13} /></button>}
            </label>
          ))}
          <button className="interaction-option-add" type="button" onClick={() => setOptions((current) => [...current, `Option ${current.length + 1}`])}><Plus size={13} /> Add choice</button>
        </div>
      )}
      {(type === 'quiz' || type === 'peer-learning') && <label><span>Answer explanation</span><textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} maxLength={500} rows={3} placeholder="Explain why the marked answer is correct" /></label>}
      {usesTimer && (
        <div className="interaction-composer-duration">
          <span>Duration</span>
          <label><input inputMode="numeric" value={minutes} onChange={(event) => setMinutes(event.target.value.replace(/\D/g, '').slice(0, 3))} aria-label="Minutes" /> min</label>
          <label><input inputMode="numeric" value={seconds} onChange={(event) => setSeconds(String(Math.min(59, Number.parseInt(event.target.value.replace(/\D/g, '') || '0', 10))))} aria-label="Seconds" /> sec</label>
        </div>
      )}
      {type === 'peer-learning' && <label><span>Discussion time in minutes</span><input inputMode="numeric" value={discussionMinutes} onChange={(event) => setDiscussionMinutes(event.target.value.replace(/\D/g, '').slice(0, 2))} /></label>}
      {type === 'group-work' && <label><span>Students per group</span><input inputMode="numeric" value={groupSize} onChange={(event) => setGroupSize(event.target.value.replace(/\D/g, '').slice(0, 2))} /></label>}
      {type !== 'timer' && <label><span>When students see results</span><select value={resultVisibility} onChange={(event) => setResultVisibility(event.target.value as NonNullable<LiveInteraction['resultVisibility']>)}><option value="live">As responses arrive</option><option value="after-reveal">When I reveal them</option><option value="instructor-only">Instructor only</option></select></label>}
      <button className="interaction-composer-submit" type="button" onClick={submit} disabled={busy || !title.trim() || (type !== 'timer' && !prompt.trim())}>{busy ? 'Saving…' : submitLabel} <ArrowRight size={15} /></button>
    </div>
  );
}

function SortableSessionPlanItem({
  interaction,
  index,
  isActive,
  disabled,
  onEdit,
  onMove,
  onRemove,
  onShow,
}: {
  interaction: LiveInteraction;
  index: number;
  isActive: boolean;
  disabled: boolean;
  onEdit: () => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onShow: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: interaction.id, disabled });
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition };

  return (
    <article ref={setNodeRef} style={style} className={`${isActive ? 'is-live' : ''} ${isDragging ? 'is-dragging' : ''}`}>
      <button
        className="session-plan-drag-handle"
        type="button"
        aria-label={`Reorder ${interaction.title}`}
        title="Drag to reorder. Arrow keys also work."
        disabled={disabled}
        {...attributes}
        {...listeners}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
          event.preventDefault();
          onMove(event.key === 'ArrowUp' ? -1 : 1);
        }}
      ><GripVertical size={17} /></button>
      <div className="session-plan-index">{String(index + 1).padStart(2, '0')}</div>
      <div className="session-plan-copy">
        <span><CalendarDays size={13} /> {interaction.plannedTime} · {interaction.label}</span>
        <strong>{interaction.title}</strong>
        <MarkdownContent markdown={interaction.prompt} compact />
      </div>
      <div className="session-plan-item-actions">
        <button className="session-plan-show" type="button" onClick={onShow}>{isActive ? 'Showing' : 'Show'} <ArrowRight size={14} /></button>
        <div>
          <button type="button" aria-label={`Edit ${interaction.title}`} onClick={onEdit} disabled={disabled}>Edit</button>
          <button type="button" aria-label={`Remove ${interaction.title}`} onClick={onRemove} disabled={disabled || isActive}><Trash2 size={13} /></button>
        </div>
      </div>
    </article>
  );
}

function InstructorInteractionStage({
  interaction,
  results,
  timer,
  onReveal,
  onAdvanceModule,
  onShareResponse,
}: {
  interaction: LiveInteraction;
  results: InteractionResults;
  timer: LiveTimer | null;
  onReveal: () => void;
  onAdvanceModule: () => void;
  onShareResponse: (responseId: string) => void;
}) {
  const hasChoices = Boolean(interaction.options?.length);
  const isPeerLearning = interaction.type === 'peer-learning';
  const isClock = interaction.type === 'timer';
  const isWordCloud = interaction.type === 'word-cloud';
  const wordCloudItems = buildWordCloudItems(results.writtenResponses);
  const wordCloudDensity = wordCloudItems.length <= 1 ? 'is-solo' : wordCloudItems.length <= 5 ? 'is-sparse' : 'is-growing';
  const [timerNow, setTimerNow] = useState(Date.now());

  useEffect(() => {
    if (!isClock || !timer) return;
    setTimerNow(Date.now());
    const tick = window.setInterval(() => setTimerNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [isClock, timer]);

  const timerRemaining = timer ? Math.max(0, Math.ceil((timer.endsAt - timerNow) / 1000)) : 0;
  const timerText = `${Math.floor(timerRemaining / 60)}:${String(timerRemaining % 60).padStart(2, '0')}`;

  return (
    <section className="live-interaction-stage" aria-live="polite">
      <header className="live-interaction-heading">
        <div>
          <span className="eyebrow"><ListChecks size={18} /> {interaction.label} is live</span>
          <h1>{isClock ? interaction.title : markdownToPlainText(interaction.prompt)}</h1>
          {isClock && <MarkdownContent className="live-clock-instructions" markdown={interaction.prompt} />}
          <p>{isClock
            ? 'The full-screen countdown is running on the projector and student phones.'
            : interaction.resultVisibility === 'after-reveal' && !results.revealed
            ? `Students answer privately. Reveal the ${interaction.type === 'quiz' ? 'answer' : 'class result'} when you are ready to discuss it.`
            : interaction.type === 'open-response'
              ? 'Written responses stay on your screen until you choose one to share.'
              : isWordCloud
                ? 'Repeated answers grow as the class cloud forms on the projector.'
              : 'The class distribution updates as responses arrive.'}</p>
        </div>
        {!isClock && <div className="live-response-count"><Users size={20} /><strong>{results.responseCount}</strong><span>{interaction.type === 'group-work' ? 'groups' : 'responses'}</span></div>}
      </header>

      {isClock ? (
        <div className={`instructor-timer-stage ${timerRemaining === 0 ? 'is-complete' : ''}`} role="timer" aria-label={`${timer?.label || interaction.title}: ${timerText} remaining`}>
          <Timer size={24} />
          <div><small>{timerRemaining === 0 ? 'Time is up' : 'Time remaining'}</small><strong>{timerText}</strong></div>
        </div>
      ) : isWordCloud ? (
        <div className={`live-word-cloud ${wordCloudDensity}`} aria-label={`${results.responseCount} word cloud responses`}>
          {wordCloudItems.length ? wordCloudItems.map((item, index) => (
            <span
              className={item.count > 1 ? 'is-repeated' : ''}
              key={`${item.key}-${item.count}`}
              style={{
                '--word-size': `${wordCloudItems.length <= 1 ? 48 : wordCloudItems.length <= 5 ? 24 + item.strength * 34 : 18 + item.strength * 32}px`,
                '--word-index': index,
              } as CSSProperties}
              title={`${item.count} ${item.count === 1 ? 'response' : 'responses'}`}
            >
              {item.label}{item.count > 1 && index < 3 && <small aria-label={`${item.count} responses`}>×{item.count}</small>}
            </span>
          )) : <div className="live-word-cloud-empty"><Cloud size={26} /><strong>Waiting for the first word</strong><small>The cloud will build here as students answer.</small></div>}
        </div>
      ) : hasChoices ? (
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
          {isPeerLearning && !results.revealed ? (
            <button className="reveal-result-button" type="button" onClick={onAdvanceModule} disabled={results.phase !== 'discuss' && !results.responseCount}>
              <ArrowRight size={18} /> {results.phase === 'respond' ? 'Start partner discussion' : results.phase === 'discuss' ? 'Ask the question again' : 'Show the shift'}
            </button>
          ) : interaction.resultVisibility === 'after-reveal' && !results.revealed && (
            <button className="reveal-result-button" type="button" onClick={onReveal} disabled={!results.responseCount}>
              <CheckCircle2 size={18} /> {interaction.type === 'quiz' ? 'Reveal answer and explanation' : 'Reveal class result'}
            </button>
          )}
          {(interaction.type === 'quiz' || interaction.type === 'peer-learning') && results.revealed && interaction.explanation && (
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
  const [classroomStateReady, setClassroomStateReady] = useState(false);
  const [classroomStateError, setClassroomStateError] = useState('');
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
  const [dismissingQuestionIds, setDismissingQuestionIds] = useState<number[]>([]);
  const [dismissedQuestionUndo, setDismissedQuestionUndo] = useState<LiveQuestion | null>(null);
  const [nextMenuOpen, setNextMenuOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState<LiveInteraction['type'] | null>(null);
  const [topbarMenuOpen, setTopbarMenuOpen] = useState(false);
  const [sessionPlanOpen, setSessionPlanOpen] = useState(false);
  const [planTypePickerOpen, setPlanTypePickerOpen] = useState(false);
  const [planComposerType, setPlanComposerType] = useState<LiveInteraction['type'] | null>(null);
  const [planEditingInteraction, setPlanEditingInteraction] = useState<LiveInteraction | null>(null);
  const [planSaving, setPlanSaving] = useState(false);
  const [planSaveIssue, setPlanSaveIssue] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [leaveConsoleOpen, setLeaveConsoleOpen] = useState(false);
  const [endClassOpen, setEndClassOpen] = useState(false);
  const [endingClass, setEndingClass] = useState(false);
  const [resetSessionOpen, setResetSessionOpen] = useState(false);
  const [resettingSession, setResettingSession] = useState(false);
  const [lobbyOpen, setLobbyOpen] = useState(false);
  const [activeInteraction, setActiveInteraction] = useState<LiveInteraction | null>(null);
  const [interactionResults, setInteractionResults] = useState<InteractionResults | null>(null);
  const [liveTimer, setLiveTimer] = useState<LiveTimer | null>(null);
  const [toast, setToast] = useState('');
  const [incomingMood, setIncomingMood] = useState<MoodKey | null>(null);
  const [displayConnected, setDisplayConnected] = useState(false);
  const [projectorPreflightOpen, setProjectorPreflightOpen] = useState(false);
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
  const lastSyncedRosterRef = useRef('');
  const planDragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  useEffect(() => {
    if (!welcomeOpen && !sessionPlanOpen && !attendanceOpen && !topbarMenuOpen && !quickAddOpen && !resetSessionOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (welcomeOpen) setWelcomeOpen(false);
      else if (attendanceOpen) setAttendanceOpen(false);
      else if (sessionPlanOpen) setSessionPlanOpen(false);
      else if (topbarMenuOpen) setTopbarMenuOpen(false);
      else if (quickAddOpen) setQuickAddOpen(false);
      else if (resetSessionOpen && !resettingSession) setResetSessionOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [attendanceOpen, quickAddOpen, resetSessionOpen, resettingSession, sessionPlanOpen, topbarMenuOpen, welcomeOpen]);

  useEffect(() => {
    if (!topbarMenuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest('.topbar-more-wrap')) setTopbarMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [topbarMenuOpen]);

  useEffect(() => {
    if (!quickAddOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest('.quick-add-wrap')) setQuickAddOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [quickAddOpen]);

  const selectedCounts = selectedWeek === 0 ? liveCounts : HISTORY[selectedWeek].counts;
  const comparisonCounts = HISTORY[Math.min(selectedWeek + 1, HISTORY.length - 1)].counts;
  const activePlanIndex = activeInteraction ? sessionPlan.findIndex((interaction) => interaction.id === activeInteraction.id) : -1;
  const nextPreparedInteraction = activePlanIndex >= 0 ? sessionPlan[activePlanIndex + 1] || null : sessionPlan[0] || null;
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
    if ((activeInteraction?.type === 'quiz' || activeInteraction?.type === 'peer-learning') && !interactionResults?.revealed) {
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
    const publicWordCloudResponses = activeInteraction?.type === 'word-cloud' && interactionResults
      ? interactionResults.writtenResponses.map((response, index) => ({
        id: `word-${interactionResults.runId}-${index}`,
        text: response.text,
      }))
      : null;
    const publicResults = interactionResults ? {
      ...interactionResults,
      writtenResponses: publicWordCloudResponses
        || (sharedResponse && publicSharedResponseId ? [{ id: publicSharedResponseId, text: sharedResponse.text }] : []),
      sharedResponseId: publicSharedResponseId,
    } : null;

    return {
      session: sessionContext,
      lobbyOpen,
      connectedStudents,
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
      timer: liveTimer,
      updatedAt: Date.now(),
    };
  }, [activeInteraction, activeQuestion, classQuestions, comparisonCounts, connectedStudents, incomingMood, interactionResults, liveTimer, lobbyOpen, onboardingMoodCounts, onboardingRunId, onboardingStep, paused, playingHistory, selectedCounts, selectedWeek, sessionContext, showComparison]);
  const displayStateRef = useRef(displayState);

  useEffect(() => {
    displayStateRef.current = displayState;
  }, [displayState]);

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get('sessionId');
    if (!sessionId) {
      setClassroomStateReady(true);
      return;
    }
    if (authLoading) return;
    if (!user) {
      setClassroomStateError('Sign in as the instructor to open this saved session.');
      setClassroomStateReady(true);
      return;
    }

    let cancelled = false;
    const loadPreparedSession = async () => {
      const { getSession, updateSession } = await import('@/lib/firebase/firestore');
      const session = await getSession(sessionId);
      if (cancelled) return;
      if (!session) {
        setClassroomStateError('This saved session could not be found.');
        setClassroomStateReady(true);
        return;
      }

      if (session.teacherId !== user.uid) {
        setClassroomStateError('This session belongs to another instructor.');
        setClassroomStateReady(true);
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
      setDismissingQuestionIds([]);
      setDismissedQuestionUndo(null);

      const prepared = prepareLiveInteractions(session.interactions);
      if (prepared.length) setSessionPlan(prepared);

      const remoteState = await initializeInstructorClassroom(sessionId, context, {
        ...displayStateRef.current,
        session: context,
        lobbyOpen: true,
        connectedStudents: 0,
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
        timer: null,
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
      setLobbyOpen(remoteState.lobbyOpen ?? false);
      setOnboardingStep(remoteState.onboardingStep || 0);
      setOnboardingRunId(remoteState.onboardingRunId || 0);
      setOnboardingMoodCounts(remoteState.onboardingMoodCounts || { ...EMPTY_ONBOARDING_COUNTS });
      setActiveInteraction(privateActiveInteraction);
      setInteractionResults(remoteState.interactionResults || null);
      setLiveQuestions((remoteState.questions || []).map((question) => ({ ...question, votes: 0 })));
      setActiveQuestion(remoteState.featuredQuestionId || null);
      setLiveTimer(remoteState.timer || null);
      if (!session.active) {
        await updateSession(sessionId, { active: true, startedAt: Timestamp.now() });
      }
      if (!cancelled) {
        setConnectedStudents(0);
        setRemoteClassroomReady(true);
        setClassroomStateReady(true);
        setToast('This session is ready for student devices.');
      }
    };

    loadPreparedSession().catch(() => {
      if (cancelled) return;
      setClassroomStateError('The saved session plan could not be loaded. Try opening it again from your class.');
      setClassroomStateReady(true);
    });
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
      question?: LiveQuestion;
      voterId?: string;
      voted?: boolean;
      dismissed?: boolean;
      command?: 'launch' | 'toggle-responses' | 'reveal' | 'advance-module' | 'finish';
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
        event.data?.type === 'student-question-submit'
        && event.data.question
        && typeof event.data.question.id === 'number'
      ) {
        const question = { ...event.data.question, source: 'student' as const };
        setLiveQuestions((current) => [question, ...current.filter((item) => item.id !== question.id)]);
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
      if (
        event.data?.type === 'instructor-question-dismiss'
        && typeof event.data.questionId === 'number'
        && event.data.question
        && typeof event.data.dismissed === 'boolean'
      ) {
        const question = event.data.question;
        setLiveQuestions((current) => event.data.dismissed
          ? current.filter((item) => item.id !== event.data.questionId)
          : current.some((item) => item.id === question.id)
            ? current
            : [question, ...current]);
        if (event.data.dismissed) {
          setActiveQuestion((current) => current === event.data.questionId ? null : current);
        }
      }
      if (event.data?.type === 'instructor-remote-command' && event.data.command) {
        if (event.data.command === 'launch' && event.data.interactionId) {
          const interaction = sessionPlanRef.current.find((item) => item.id === event.data.interactionId);
          if (interaction) {
            setLobbyOpen(false);
            setActiveInteraction(interaction);
            receivedResponseIdsRef.current.clear();
            setInteractionResults(createInteractionResults(interaction));
            setActiveNav(interaction.label);
            if (interaction.type === 'timer' || interaction.type === 'group-work') {
              const durationSeconds = (interaction.durationMinutes || 5) * 60;
              setLiveTimer({ id: `timer-${Date.now()}`, label: interaction.type === 'group-work' ? 'Group work' : interaction.title, durationSeconds, endsAt: Date.now() + durationSeconds * 1000 });
            }
          }
        }
        if (event.data.command === 'toggle-responses') {
          setInteractionResults((current) => current ? { ...current, open: !current.open } : current);
        }
        if (event.data.command === 'reveal') {
          setInteractionResults((current) => current ? { ...current, open: false, revealed: true } : current);
        }
        if (event.data.command === 'advance-module') {
          const interaction = activeInteractionRef.current;
          if (interaction?.type === 'peer-learning') {
            setInteractionResults((current) => {
              if (!current) return current;
              if (current.phase === 'respond') {
                const durationSeconds = (interaction.discussionMinutes || 2) * 60;
                setLiveTimer({ id: `peer-discussion-${Date.now()}`, label: 'Partner discussion', durationSeconds, endsAt: Date.now() + durationSeconds * 1000 });
                return { ...current, open: false, phase: 'discuss', firstResponseCount: current.responseCount, firstOptionCounts: current.optionCounts };
              }
              if (current.phase === 'discuss') {
                receivedResponseIdsRef.current.clear();
                setLiveTimer(null);
                return { ...current, runId: `${interaction.id}-${Date.now()}-again`, open: true, responseCount: 0, optionCounts: interaction.options?.map(() => 0) || [], writtenResponses: [], phase: 'respond-again' };
              }
              setLiveTimer(null);
              return { ...current, open: false, revealed: true, phase: 'complete' };
            });
          }
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
        setLobbyOpen(Boolean(remoteState.lobbyOpen));
        setPaused(Boolean(remoteState.paused));
        setActiveQuestion(remoteState.featuredQuestionId || null);
        setLiveTimer(remoteState.timer || null);
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
      lastSyncedRosterRef.current = '';
      return;
    }
    const sessionId = sessionContext.sessionId;
    const ownerUid = sessionContext.ownerUid;
    return subscribeToInstructorAttendance(ownerUid, sessionId, (claims) => {
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
      const uniqueAttendance = [...uniqueClaims.values()];
      setAttendanceClaims(uniqueAttendance);
      const studentNumbers = [...uniqueClaims.keys()].sort();
      const rosterSignature = `${sessionId}:${studentNumbers.join('|')}`;
      if (studentNumbers.length && lastSyncedRosterRef.current !== rosterSignature) {
        lastSyncedRosterRef.current = rosterSignature;
        import('@/lib/firebase/firestore')
          .then(({ syncStandaloneSessionStudents }) => syncStandaloneSessionStudents(
            sessionId,
            ownerUid,
            studentNumbers,
          ))
          .catch((syncError) => {
            if (lastSyncedRosterRef.current === rosterSignature) lastSyncedRosterRef.current = '';
            console.error('The live attendance roster could not be saved to the session:', syncError);
          });
      }
    });
  }, [remoteClassroomReady, sessionContext.ownerUid, sessionContext.sessionId]);

  useEffect(() => {
    if (!remoteClassroomReady || !sessionContext.sessionId || !sessionContext.ownerUid) return;
    return subscribeToInstructorStudentQuestions(
      sessionContext.ownerUid,
      sessionContext.sessionId,
      (studentQuestions) => setLiveQuestions((current) => [
        ...studentQuestions,
        ...current.filter((question) => question.source !== 'student'),
      ]),
    );
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

  useEffect(() => {
    if (!dismissedQuestionUndo) return;
    const timer = window.setTimeout(() => setDismissedQuestionUndo(null), 6000);
    return () => window.clearTimeout(timer);
  }, [dismissedQuestionUndo]);

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
      source: 'instructor',
    }, ...current]);
    setQuestionDraft('');
    setQuestionFilter('All');
    setToast('Question is available for students to upvote');
  };

  const discussQuestion = (id: number) => {
    const isBeingDiscussed = activeQuestion !== id;
    const updateQuestionDisplay = () => {
      setActiveQuestion((current) => current === id ? null : id);
      setDiscussedQuestions((current) => current.includes(id) ? current : [...current, id]);
    };
    if (!isBeingDiscussed || !sessionContext.sessionId || !sessionContext.ownerUid) {
      updateQuestionDisplay();
      return;
    }
    void setInstructorQuestionRecognized(sessionContext.ownerUid, sessionContext.sessionId, id)
      .then(updateQuestionDisplay)
      .catch(() => {
        updateQuestionDisplay();
        setToast('The question is on display. Its contribution point will be settled later.');
      });
  };

  const moderateQuestion = async (question: LiveQuestion, dismissed: boolean) => {
    if (dismissingQuestionIds.includes(question.id)) return;
    setDismissingQuestionIds((current) => [...current, question.id]);
    setToast('');

    if (dismissed) {
      setLiveQuestions((current) => current.filter((item) => item.id !== question.id));
      setActiveQuestion((current) => current === question.id ? null : current);
    } else {
      setLiveQuestions((current) => current.some((item) => item.id === question.id) ? current : [question, ...current]);
    }

    try {
      if (sessionContext.sessionId && sessionContext.ownerUid) {
        await setInstructorQuestionDismissed(
          sessionContext.ownerUid,
          sessionContext.sessionId,
          question.id,
          dismissed,
        );
      }
      if (dismissed) setDismissedQuestionUndo(question);
      else {
        setDismissedQuestionUndo(null);
        setToast('Question returned to the live queue.');
      }
    } catch (moderationError) {
      console.error('Could not update question moderation:', moderationError);
      if (dismissed) {
        setLiveQuestions((current) => current.some((item) => item.id === question.id) ? current : [question, ...current]);
      } else {
        setLiveQuestions((current) => current.filter((item) => item.id !== question.id));
      }
      setToast('The question could not be updated. Check the connection and try again.');
    } finally {
      setDismissingQuestionIds((current) => current.filter((id) => id !== question.id));
    }
  };

  const launchInteraction = (interaction: LiveInteraction) => {
    setNextMenuOpen(false);
    setSessionPlanOpen(false);
    setLobbyOpen(false);
    setActiveInteraction(interaction);
    receivedResponseIdsRef.current.clear();
    setInteractionResults(createInteractionResults(interaction));
    if (interaction.type === 'timer' || interaction.type === 'group-work') {
      const durationSeconds = (interaction.durationMinutes || 5) * 60;
      setLiveTimer({
        id: `timer-${Date.now()}`,
        label: interaction.type === 'group-work' ? 'Group work' : interaction.title,
        durationSeconds,
        endsAt: Date.now() + durationSeconds * 1000,
      });
    } else setLiveTimer(null);
    setActiveNav(interaction.label);
    if (!displayConnected) openClassroomDisplay();
    setToast(`${interaction.title} is ready on the classroom display`);
    window.setTimeout(() => document.querySelector('.live-interaction-stage')?.scrollTo({ top: 0 }), 0);
  };

  const showClassLobby = () => {
    setTopbarMenuOpen(false);
    setOnboardingStep(0);
    setLobbyOpen(true);
    if (!displayConnected) openClassroomDisplay();
    setToast(activeInteraction ? 'Join screen shown on the projector. The current student activity is still open.' : 'Class lobby shown on the projector.');
  };

  const copyJoinDetails = async () => {
    const joinUrl = `${window.location.origin}/join`;
    const message = `Join ${sessionContext.courseCode} at ${joinUrl}\nClass code: ${formatSessionCode(sessionContext.sessionCode)}`;
    try {
      await navigator.clipboard.writeText(message);
      setToast('Join link and class code copied.');
    } catch {
      setToast(`Join at ${joinUrl} with code ${formatSessionCode(sessionContext.sessionCode)}.`);
    }
  };

  const saveSessionPlan = async (nextPlan: LiveInteraction[], successMessage: string) => {
    setSessionPlan(nextPlan);
    sessionPlanRef.current = nextPlan;
    setPlanSaveIssue(false);
    if (!sessionContext.sessionId || !user) {
      setToast(`${successMessage} This preview change will not be saved.`);
      return;
    }

    setPlanSaving(true);
    try {
      const { updateSession } = await import('@/lib/firebase/firestore');
      await updateSession(sessionContext.sessionId, { interactions: nextPlan });
      setToast(`${successMessage} The live class and its responses are unchanged.`);
    } catch {
      setPlanSaveIssue(true);
      setToast('The interaction is in this live plan, but it could not be saved for later.');
    } finally {
      setPlanSaving(false);
    }
  };

  const addInteractionToPlan = (interaction: LiveInteraction) => {
    void saveSessionPlan([...sessionPlanRef.current, interaction], `${interaction.title} was added to the plan.`);
    setPlanComposerType(null);
  };

  const updatePlannedInteraction = (interaction: LiveInteraction) => {
    const nextPlan = sessionPlanRef.current.map((item) => item.id === interaction.id ? interaction : item);
    if (activeInteractionRef.current?.id === interaction.id) {
      setActiveInteraction(interaction);
      activeInteractionRef.current = interaction;
      if ((interaction.type === 'timer' || interaction.type === 'group-work') && liveTimer) {
        const now = Date.now();
        const remainingSeconds = Math.max(0, Math.ceil((liveTimer.endsAt - now) / 1000));
        const elapsedSeconds = Math.max(0, liveTimer.durationSeconds - remainingSeconds);
        const nextDurationSeconds = Math.max(1, Math.round((interaction.durationMinutes || 5) * 60));
        setLiveTimer({
          ...liveTimer,
          label: interaction.type === 'group-work' ? 'Group work' : interaction.title,
          durationSeconds: nextDurationSeconds,
          endsAt: now + Math.max(0, nextDurationSeconds - elapsedSeconds) * 1000,
        });
      }
    }
    void saveSessionPlan(nextPlan, `${interaction.title} was updated.`);
    setPlanEditingInteraction(null);
  };

  const reorderSessionPlan = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || planSaving) return;
    const oldIndex = sessionPlanRef.current.findIndex((interaction) => interaction.id === active.id);
    const newIndex = sessionPlanRef.current.findIndex((interaction) => interaction.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    void saveSessionPlan(arrayMove(sessionPlanRef.current, oldIndex, newIndex), 'The teaching order was updated.');
  };

  const movePlannedInteraction = (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= sessionPlanRef.current.length || planSaving) return;
    void saveSessionPlan(arrayMove(sessionPlanRef.current, index, destination), 'The teaching order was updated.');
  };

  const removePlannedInteraction = (interaction: LiveInteraction) => {
    if (activeInteraction?.id === interaction.id) {
      setToast('End this interaction before removing it from the plan.');
      return;
    }
    void saveSessionPlan(sessionPlanRef.current.filter((item) => item.id !== interaction.id), `${interaction.title} was removed from the plan.`);
  };

  const returnToSlides = () => {
    if (activeInteraction?.type === 'timer' || activeInteraction?.type === 'group-work' || activeInteraction?.type === 'peer-learning') setLiveTimer(null);
    setActiveInteraction(null);
    setInteractionResults(null);
    setLobbyOpen(false);
    setToast('Interaction closed. Return to your presentation when ready.');
  };

  const revealInteractionResults = () => {
    setInteractionResults((current) => current ? { ...current, open: false, revealed: true } : current);
    setToast('The class result is now visible on the projector');
  };

  const advanceModule = () => {
    if (activeInteraction?.type !== 'peer-learning') return;
    setInteractionResults((current) => {
      if (!current) return current;
      if (current.phase === 'respond') {
        const durationSeconds = (activeInteraction.discussionMinutes || 2) * 60;
        setLiveTimer({ id: `peer-discussion-${Date.now()}`, label: 'Partner discussion', durationSeconds, endsAt: Date.now() + durationSeconds * 1000 });
        return { ...current, open: false, phase: 'discuss', firstResponseCount: current.responseCount, firstOptionCounts: current.optionCounts };
      }
      if (current.phase === 'discuss') {
        receivedResponseIdsRef.current.clear();
        setLiveTimer(null);
        return { ...current, runId: `${activeInteraction.id}-${Date.now()}-again`, open: true, responseCount: 0, optionCounts: activeInteraction.options?.map(() => 0) || [], writtenResponses: [], phase: 'respond-again' };
      }
      setLiveTimer(null);
      return { ...current, open: false, revealed: true, phase: 'complete' };
    });
  };

  const toggleInteractionResponses = () => {
    setInteractionResults((current) => current ? { ...current, open: !current.open } : current);
    setToast(interactionResults?.open ? 'Responses locked' : 'Responses reopened');
  };

  const startLiveTimer = (durationSeconds: number) => {
    setLiveTimer({
      id: `timer-${Date.now()}`,
      label: 'Class timer',
      durationSeconds,
      endsAt: Date.now() + durationSeconds * 1000,
    });
    if (!displayConnected) openClassroomDisplay();
    setQuickAddOpen(false);
    setToast(`${durationSeconds / 60} minute timer is visible to the class`);
  };

  const clearLiveTimer = () => {
    setLiveTimer(null);
    setToast('Timer cleared');
  };

  const shareWrittenResponse = (responseId: string) => {
    setInteractionResults((current) => current ? { ...current, sharedResponseId: responseId } : current);
    setToast('Anonymous response shared with the class');
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

  const startProjectorCheck = () => {
    setProjectorPreflightOpen(true);
    if (!displayConnected) openClassroomDisplay();
  };

  const confirmProjector = () => {
    setProjectorPreflightOpen(false);
    setToast('Projector checked. You are ready to teach.');
  };

  const endLiveClass = async () => {
    if (!sessionContext.sessionId || !sessionContext.ownerUid) return;
    setEndingClass(true);
    try {
      await endInstructorClassroom(sessionContext.ownerUid, sessionContext.sessionId);
      const { updateSession } = await import('@/lib/firebase/firestore');
      await updateSession(sessionContext.sessionId, { active: false, endedAt: Timestamp.now() });
      window.location.assign(`/dashboard/sessions/${sessionContext.sessionId}`);
    } catch (endError) {
      console.error('Could not end class:', endError);
      setToast('The class could not be ended. Check your connection and try again.');
      setEndingClass(false);
      setEndClassOpen(false);
    }
  };

  const leaveLiveConsole = () => {
    if (!sessionContext.sessionId) return;
    window.location.assign(`/dashboard/sessions/${sessionContext.sessionId}`);
  };

  const resetLiveSession = async () => {
    setResettingSession(true);
    const resetState: LessonDisplayState = {
      ...displayStateRef.current,
      session: sessionContext,
      lobbyOpen: true,
      connectedStudents,
      counts: { ...EMPTY_ONBOARDING_COUNTS },
      comparisonCounts: { ...EMPTY_ONBOARDING_COUNTS },
      incomingMood: null,
      paused: false,
      playingHistory: false,
      selectedWeek: 0,
      showComparison: false,
      onboardingStep: 0,
      onboardingRunId: 0,
      onboardingMoodCounts: { ...EMPTY_ONBOARDING_COUNTS },
      activeInteraction: null,
      interactionResults: null,
      featuredQuestionId: null,
      questions: [],
      timer: null,
      updatedAt: Date.now(),
    };

    try {
      if (sessionContext.sessionId && sessionContext.ownerUid) {
        await resetInstructorClassroom(sessionContext.ownerUid, sessionContext.sessionId, resetState);
      }
      displayStateRef.current = resetState;
      receivedResponseIdsRef.current.clear();
      demoQuestionVotersRef.current.clear();
      setLiveCounts({ ...EMPTY_ONBOARDING_COUNTS });
      setSelectedWeek(0);
      setShowComparison(false);
      setPlayingHistory(false);
      setPaused(false);
      setIncomingMood(null);
      setOnboardingStep(0);
      setOnboardingRunId(0);
      setOnboardingMoodCounts({ ...EMPTY_ONBOARDING_COUNTS });
      setLobbyOpen(true);
      setActiveInteraction(null);
      setInteractionResults(null);
      setLiveTimer(null);
      setLiveQuestions([]);
      setQuestionVoteCounts({});
      setDiscussedQuestions([]);
      setActiveQuestion(null);
      setResetSessionOpen(false);
      setToast('Session reset. Attendance is still in place and the first interaction is ready to launch.');
    } catch (resetError) {
      console.error('Could not reset session:', resetError);
      setToast('The session could not be reset. Your current data is unchanged.');
    } finally {
      setResettingSession(false);
    }
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
    setLobbyOpen(false);
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

  if (!classroomStateReady) {
    return <ClassroomStateGate title="Preparing your live lesson" message="Loading the current session, responses, and classroom controls." />;
  }

  if (classroomStateError) {
    return <ClassroomStateGate loading={false} title="This class could not be opened" message={classroomStateError} />;
  }

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
            <InstructorAvatar
              name={user?.name || sessionContext.instructorName || 'Instructor'}
              photoURL={user?.photoURL}
              size={40}
              className="professor-avatar"
            />
            <span>
              <strong>{sessionContext.instructorName || user?.name || 'Instructor'}</strong>
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
            <button className="floating-controls-trigger" type="button" onClick={openFloatingControls}><PictureInPicture2 size={17} /> Float controls</button>
            {sessionContext.sessionId && <button className="leave-console-trigger" type="button" onClick={() => setLeaveConsoleOpen(true)}><LogOut size={16} /> Leave console</button>}
            {sessionContext.sessionId && <button className="end-class-trigger" type="button" onClick={() => setEndClassOpen(true)}><Square size={15} /> End class</button>}
            <div className="topbar-more-wrap">
              <button className="topbar-more-trigger" type="button" aria-haspopup="menu" aria-expanded={topbarMenuOpen} onClick={() => setTopbarMenuOpen((open) => !open)}><MoreHorizontal size={18} /> More</button>
              {topbarMenuOpen && (
                <div className="topbar-more-menu" role="menu" aria-label="More class controls">
                  <p>Class tools</p>
                  <button role="menuitem" type="button" onClick={() => { setTopbarMenuOpen(false); setAttendanceOpen(true); }}><ClipboardCheck size={17} /><span><strong>Attendance</strong><small>{attendanceClaims.length} checked in</small></span></button>
                  <button role="menuitem" type="button" onClick={showClassLobby}><QrCode size={17} /><span><strong>Show join screen</strong><small>QR code, link, and class code</small></span></button>
                  <button role="menuitem" type="button" onClick={() => { setTopbarMenuOpen(false); if (onboardingStep > 0) setToast('Use the welcome controls above the lesson dock'); else setWelcomeOpen(true); }}><GraduationCap size={17} /><span><strong>{onboardingStep > 0 ? 'Welcome running' : 'Welcome class'}</strong><small>Introduce the class to participation</small></span></button>
                  <button role="menuitem" type="button" onClick={() => { setTopbarMenuOpen(false); startProjectorCheck(); }}><MonitorUp size={17} /><span><strong>{displayConnected ? 'Check display' : 'Set up display'}</strong><small>Open or reconnect the projector</small></span></button>
                  <i /><button role="menuitem" type="button" onClick={() => { setTopbarMenuOpen(false); setResetSessionOpen(true); }}><RotateCcw size={16} /><span><strong>Reset session</strong><small>Clear responses and start again</small></span></button>
                </div>
              )}
            </div>
          </div>
        </header>

        {lobbyOpen ? (
          <section className="instructor-lobby" aria-labelledby="class-lobby-title">
            <div className="instructor-lobby-copy">
              <span className="eyebrow"><QrCode size={18} /> Class lobby</span>
              <h1 id="class-lobby-title">Let everyone get into the room.</h1>
              <p>{activeInteraction ? 'The projector is showing the join screen. Students already in the room can keep working.' : 'The projector is showing the QR code and class code. Start when the room looks ready.'}</p>
              <div className="instructor-lobby-join">
                <span><small>Join at</small><strong>classfully.com/join</strong></span>
                <span><small>Class code</small><strong>{formatSessionCode(sessionContext.sessionCode)}</strong></span>
              </div>
              <div className="instructor-lobby-actions">
                <button type="button" onClick={copyJoinDetails}><Copy size={17} /> Copy join details</button>
                <button type="button" onClick={openClassroomDisplay}><MonitorUp size={17} /> Open presentation view</button>
              </div>
            </div>
            <div className="instructor-lobby-presence" aria-live="polite">
              <span className="instructor-lobby-presence-icon"><Users size={28} /></span>
              <strong key={connectedStudents}>{connectedStudents}</strong>
              <span>{connectedStudents === 1 ? 'student is here' : 'students are here'}</span>
              <small><i /> Updates as students join</small>
            </div>
          </section>
        ) : activeInteraction && interactionResults ? (
          <InstructorInteractionStage
            interaction={activeInteraction}
            results={interactionResults}
            timer={liveTimer}
            onReveal={revealInteractionResults}
            onAdvanceModule={advanceModule}
            onShareResponse={shareWrittenResponse}
          />
        ) : (
        <section className="lesson-content">
          <div className="content-heading">
            <div>
              <div className="eyebrow"><HeartPulse size={18} /> Class Pulse</div>
              <h1>How are you arriving today?</h1>
              <p>{selectedWeek === 0 ? 'See how the room is arriving as responses come in.' : HISTORY[selectedWeek].lesson}</p>
            </div>
            <div className="privacy-note"><Lock size={15} /> Individual responses stay private</div>
          </div>

          {!sessionContext.sessionId && <div className="history-toolbar" aria-label="Class Pulse history controls">
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
          {lobbyOpen ? (
            <>
              <button className="control-secondary lobby-copy-control" type="button" onClick={copyJoinDetails}>
                <Copy size={18} />
                <span><strong>Copy join details</strong><small>Share the link and class code</small></span>
              </button>
              <div className="next-activity-wrap lobby-start-wrap">
                <button
                  className="control-primary"
                  type="button"
                  disabled={!activeInteraction && !nextPreparedInteraction}
                  onClick={() => activeInteraction ? setLobbyOpen(false) : nextPreparedInteraction && launchInteraction(nextPreparedInteraction)}
                >
                  <span><strong>{activeInteraction ? 'Return to current activity' : 'Start first activity'}</strong><small>{activeInteraction?.title || nextPreparedInteraction?.title || 'Add an interaction to begin'}</small></span>
                  <ArrowRight size={20} />
                </button>
              </div>
              <button className="control-quick-add lobby-display-control" type="button" onClick={openClassroomDisplay}>
                <MonitorUp size={19} />
                <span><strong>Open display</strong><small>{displayConnected ? 'Projector connected' : 'Show the lobby'}</small></span>
              </button>
            </>
          ) : (
          <>
          <button
            className="control-secondary"
            type="button"
            aria-pressed={activeInteraction?.type === 'timer' ? false : activeInteraction && interactionResults ? !interactionResults.open : paused}
            onClick={() => {
              if (activeInteraction?.type === 'timer') {
                returnToSlides();
                return;
              }
              if (activeInteraction && interactionResults) {
                toggleInteractionResponses();
                return;
              }
              setPaused((current) => !current);
              setToast(paused ? 'Responses are live again' : 'Responses paused');
            }}
          >
            {activeInteraction?.type === 'timer' ? <Square size={18} /> : (activeInteraction && interactionResults ? !interactionResults.open : paused) ? <Play size={19} /> : <Pause size={19} />}
            <span>
              <strong>{activeInteraction?.type === 'timer' ? 'End timer' : activeInteraction && interactionResults ? (interactionResults.open ? 'Lock responses' : 'Reopen responses') : (paused ? 'Resume responses' : 'Pause responses')}</strong>
              <small>{activeInteraction?.type === 'timer' ? 'Return the projector to the class view' : activeInteraction && interactionResults ? (interactionResults.open ? 'Students can still answer' : 'No new answers are accepted') : (paused ? 'The chart is frozen' : 'Responses are live')}</small>
            </span>
          </button>
          <div className="next-activity-wrap">
            {nextMenuOpen && (
              <div className="activity-menu">
                <p>{activeInteraction ? 'Switch interaction' : 'Prepared for this session'}</p>
                {sessionPlan.filter((interaction) => interaction.id !== activeInteraction?.id).map((interaction) => (
                  <button type="button" key={interaction.id} onClick={() => launchInteraction(interaction)}><span><small>{interaction.id === nextPreparedInteraction?.id ? 'Up next' : interaction.plannedTime}</small>{interaction.title}</span><ArrowRight size={15} /></button>
                ))}
              </div>
            )}
            {activeInteraction ? (
              <div className="next-activity-actions">
                <button className="control-primary" type="button" onClick={() => nextPreparedInteraction ? launchInteraction(nextPreparedInteraction) : setNextMenuOpen((current) => !current)}>
                  <span><strong>{nextPreparedInteraction ? 'Start next interaction' : 'Choose an interaction'}</strong><small>{nextPreparedInteraction?.title || 'The prepared sequence is complete'}</small></span>
                  <ArrowRight size={20} />
                </button>
                <button className="control-more" type="button" aria-label="Choose another interaction" title="Choose another interaction" onClick={() => setNextMenuOpen((current) => !current)}><ListChecks size={19} /></button>
                <button className="control-return-to-slides" type="button" aria-label="Return to slides" title="Return to slides" onClick={returnToSlides}><Laptop size={19} /></button>
              </div>
            ) : (
              <button className="control-primary" type="button" onClick={() => setNextMenuOpen((current) => !current)}>
                <span><strong>Show an interaction</strong><small>{sessionPlan.length} {sessionPlan.length === 1 ? 'interaction' : 'interactions'} prepared for this session</small></span>
                <ArrowRight size={20} />
              </button>
            )}
          </div>
          <div className="quick-add-wrap">
            {quickAddOpen && (
              <section className="quick-add-menu" role="dialog" aria-label="Add something during class">
                <header>
                  <div><small>In the moment</small><strong>Add something now</strong></div>
                  <button type="button" aria-label="Close quick add" onClick={() => { setQuickAddOpen(false); setQuickAddType(null); }}><X size={16} /></button>
                </header>
                {quickAddType ? (
                  <InteractionComposer
                    key={`quick-${quickAddType}`}
                    type={quickAddType}
                    submitLabel="Show now"
                    onCancel={() => setQuickAddType(null)}
                    onSubmit={(interaction) => {
                      const plannedInteraction = { ...interaction, id: `live-${interaction.type}-${Date.now()}` };
                      void saveSessionPlan([...sessionPlanRef.current, plannedInteraction], `${plannedInteraction.title} was added to the plan.`);
                      launchInteraction(plannedInteraction);
                      setQuickAddType(null);
                      setQuickAddOpen(false);
                    }}
                  />
                ) : (
                  <>
                    <p className="activity-picker-intro">What do you want to bring into the room?</p>
                    <ActivityTypePicker onSelect={setQuickAddType} />
                    <p className="quick-add-note">It opens now and stays in the Session plan so you can return to it.</p>
                  </>
                )}
              </section>
            )}
            <button className="control-quick-add" type="button" aria-haspopup="dialog" aria-expanded={quickAddOpen} onClick={() => { setNextMenuOpen(false); setQuickAddType(null); setQuickAddOpen((open) => !open); }}>
              <Plus size={19} />
              <span><strong>Add now</strong><small>Choose and add to plan</small></span>
            </button>
          </div>
          </>
          )}
        </footer>
      </main>

        <aside className="conversation-rail" aria-label="Live questions">
          <section className="display-preview-section">
            <div className="display-preview-heading">
              <span>Classroom display</span>
              <small><i /> {displayConnected ? 'Connected' : 'Preview'}</small>
            </div>
            <button className="display-preview" type="button" onClick={startProjectorCheck}>
              {lobbyOpen ? (
                <div className="preview-welcome-state preview-lobby-state">
                  <span><QrCode size={14} /> Class lobby</span>
                  <strong>{formatSessionCode(sessionContext.sessionCode)}</strong>
                  <small>{connectedStudents} {connectedStudents === 1 ? 'student' : 'students'} connected</small>
                </div>
              ) : onboardingStep > 0 ? (
                <div className="preview-welcome-state">
                  <span><GraduationCap size={14} /> Classroom welcome</span>
                  <strong>{onboardingStep === 4 ? 'The class is ready' : welcomeLabels[onboardingStep - 1]}</strong>
                  <div>{[1, 2, 3].map((step) => <i className={step <= onboardingStep ? 'is-filled' : ''} key={step} />)}</div>
                  <small>{onboardingStep === 3 ? `${total(onboardingMoodCounts)} first pulses received` : onboardingStep === 4 ? 'Return to the lesson when ready' : `Step ${onboardingStep} of 3 on screen`}</small>
                </div>
              ) : activeInteraction ? (
                <div className="preview-welcome-state preview-interaction-state">
                  <span><ListChecks size={14} /> {activeInteraction.label}</span>
                  <strong>{activeInteraction.title}</strong>
                  <small>Ready on the classroom display</small>
                </div>
              ) : (
                <>
                  <span className="preview-title">How are you arriving today?</span>
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
                  <div className="question-action-buttons">
                    <button type="button" className="question-dismiss-action" disabled={dismissingQuestionIds.includes(question.id)} onClick={() => moderateQuestion(question, true)} aria-label={`Dismiss question: ${question.question}`}>
                      <X size={15} /> Dismiss
                    </button>
                    <button type="button" onClick={() => discussQuestion(question.id)}>
                      <MessageCircle size={16} /> {activeQuestion === question.id ? 'Remove from display' : discussedQuestions.includes(question.id) ? 'Show again' : 'Discuss on display'}
                    </button>
                  </div>
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

            <div className="session-plan-editor">
              {planEditingInteraction ? (
                <>
                  {activeInteraction?.id === planEditingInteraction.id && <div className="session-plan-live-edit-note"><Lock size={15} /><span><strong>Students keep the current version.</strong> These changes apply the next time you show this interaction.</span></div>}
                  <InteractionComposer
                    key={`edit-${planEditingInteraction.id}`}
                    type={planEditingInteraction.type}
                    initial={planEditingInteraction}
                    submitLabel="Save changes"
                    busy={planSaving}
                    onCancel={() => setPlanEditingInteraction(null)}
                    onSubmit={updatePlannedInteraction}
                  />
                </>
              ) : planComposerType ? (
                <InteractionComposer
                  key={`plan-${planComposerType}`}
                  type={planComposerType}
                  submitLabel="Add to plan"
                  busy={planSaving}
                  onCancel={() => setPlanComposerType(null)}
                  onSubmit={addInteractionToPlan}
                />
              ) : (
                <>
                  <button className="session-plan-add" type="button" onClick={() => setPlanTypePickerOpen((open) => !open)} aria-expanded={planTypePickerOpen}>
                    <Plus size={17} /> Add interaction <ChevronLeft className={planTypePickerOpen ? 'is-open' : ''} size={15} />
                  </button>
                  {planTypePickerOpen && <ActivityTypePicker onSelect={(type) => { setPlanComposerType(type); setPlanTypePickerOpen(false); }} />}
                </>
              )}
            </div>

            {!planEditingInteraction && !planComposerType && (
              <DndContext sensors={planDragSensors} collisionDetection={closestCenter} onDragEnd={reorderSessionPlan}>
                <SortableContext items={sessionPlan.map((interaction) => interaction.id)} strategy={verticalListSortingStrategy}>
                  <div className="session-plan-list">
                    {sessionPlan.map((interaction, index) => (
                      <SortableSessionPlanItem
                        key={interaction.id}
                        interaction={interaction}
                        index={index}
                        isActive={activeInteraction?.id === interaction.id}
                        disabled={planSaving}
                        onEdit={() => setPlanEditingInteraction(interaction)}
                        onMove={(direction) => movePlannedInteraction(index, direction)}
                        onRemove={() => removePlannedInteraction(interaction)}
                        onShow={() => launchInteraction(interaction)}
                      />
                    ))}
                    {!sessionPlan.length && <div className="session-plan-empty"><ListChecks size={22} /><strong>No interactions planned yet</strong><span>Add one above when you are ready.</span></div>}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            <footer className={`session-plan-save-note ${planSaveIssue ? 'has-issue' : ''}`}>
              {planSaveIssue ? <Cloud size={15} /> : <CheckCircle2 size={15} />}
              <span>{planSaving ? 'Saving the plan…' : planSaveIssue ? 'Available in this live class, but not yet saved for later.' : sessionContext.sessionId ? 'Plan changes save here without interrupting the class.' : 'Preview changes last until you reload this page.'}</span>
              {planSaveIssue && <button type="button" onClick={() => void saveSessionPlan(sessionPlanRef.current, 'Session plan saved.')} disabled={planSaving}>Try saving again</button>}
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

      <ProjectorPreflight open={projectorPreflightOpen} connected={displayConnected} onOpenDisplay={openClassroomDisplay} onConfirm={confirmProjector} onClose={() => setProjectorPreflightOpen(false)} />
      {dismissedQuestionUndo ? <div className="seminar-toast seminar-toast-with-action" role="status"><span>Question dismissed from the class.</span><button type="button" onClick={() => moderateQuestion(dismissedQuestionUndo, false)}>Undo</button></div> : toast && <div className="seminar-toast" role="status">{toast}</div>}
      {leaveConsoleOpen && (
        <div className="end-class-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setLeaveConsoleOpen(false);
        }}>
          <section className="end-class-dialog leave-console-dialog" role="dialog" aria-modal="true" aria-labelledby="leave-console-title">
            <span className="end-class-icon leave-console-icon"><LogOut size={19} /></span>
            <p className="seminar-eyebrow">Step away without ending class</p>
            <h2 id="leave-console-title" className="seminar-display">Leave the console?</h2>
            <p>The class will stay live. Students and the classroom display can continue to see the current activity.</p>
            <div>
              <button type="button" onClick={() => setLeaveConsoleOpen(false)}>Keep teaching</button>
              <button type="button" className="is-leave" onClick={leaveLiveConsole}>Leave console</button>
              <button type="button" className="is-end-alternative" onClick={() => { setLeaveConsoleOpen(false); setEndClassOpen(true); }}>End class instead</button>
            </div>
          </section>
        </div>
      )}
      {endClassOpen && (
        <div className="end-class-backdrop" role="presentation">
          <section className="end-class-dialog" role="dialog" aria-modal="true" aria-labelledby="end-class-title">
            <span className="end-class-icon"><Square size={18} /></span>
            <p className="seminar-eyebrow">Finish this session</p>
            <h2 id="end-class-title" className="seminar-display">End class and review?</h2>
            <p>Student responses will close. You will return to the session record to review attendance and participation.</p>
            <div><button type="button" onClick={() => setEndClassOpen(false)} disabled={endingClass}>Keep teaching</button><button type="button" className="is-primary" onClick={endLiveClass} disabled={endingClass}>{endingClass ? 'Ending class…' : 'End and review'}</button></div>
          </section>
        </div>
      )}
      {resetSessionOpen && (
        <div className="end-class-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !resettingSession) setResetSessionOpen(false);
        }}>
          <section className="end-class-dialog reset-session-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-session-title">
            <span className="end-class-icon"><RotateCcw size={19} /></span>
            <p className="seminar-eyebrow">Start this session again</p>
            <h2 id="reset-session-title" className="seminar-display">Reset this session?</h2>
            <p>This clears live answers, pulse results, student questions, votes, and interaction progress. Attendance and connected students stay in place. This cannot be undone.</p>
            <div><button type="button" onClick={() => setResetSessionOpen(false)} disabled={resettingSession}>Keep current data</button><button type="button" className="is-primary" onClick={resetLiveSession} disabled={resettingSession}>{resettingSession ? 'Resetting…' : 'Reset and start over'}</button></div>
          </section>
        </div>
      )}
      {floatingRemoteWindow && !floatingRemoteWindow.closed && createPortal(
        <ClassfullyRemote
          session={sessionContext}
          plan={sessionPlan}
          activeInteraction={activeInteraction}
          results={interactionResults}
          connectedStudents={connectedStudents}
          questionCount={classQuestions.length}
          questions={classQuestions}
          featuredQuestionId={activeQuestion}
          displayConnected={displayConnected}
          timer={liveTimer}
          onLaunch={launchInteraction}
          onToggleResponses={toggleInteractionResponses}
          onReveal={revealInteractionResults}
          onAdvanceModule={advanceModule}
          onFinish={returnToSlides}
          onOpenDisplay={openClassroomDisplay}
          onOpenConsole={() => window.focus()}
          onFeatureQuestion={discussQuestion}
          onDismissQuestion={moderateQuestion}
          onLaunchUnplanned={(prompt) => launchInteraction({
            id: `unplanned-${Date.now()}`,
            type: 'open-response',
            label: 'Short response',
            title: 'Unplanned question',
            prompt,
            resultVisibility: 'instructor-only',
            plannedTime: 'Asked live',
          })}
          onStartTimer={startLiveTimer}
          onClearTimer={clearLiveTimer}
        />,
        floatingRemoteWindow.document.body,
      )}
    </div>
  );
}
