'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Maximize2,
  MessageCircle,
  MonitorUp,
  Pause,
  Play,
  Radio,
  Sparkles,
  Timer,
  Users,
  WandSparkles,
  X,
} from 'lucide-react';
import MarkdownContent from '@/components/live/MarkdownContent';
import type { InteractionResults, LiveInteraction, LiveQuestion, LiveSessionContext, LiveTimer } from '@/app/live/live-data';
import ProjectorPreflight from './ProjectorPreflight';
import './classfully-remote.css';

// Storyboard: shell settles, content arrives, then controls become available.
// Motion stays brief so it supports recognition without competing with the lesson.
const REMOTE_TIMING = {
  content: 90,
  actions: 190,
} as const;

type ClassfullyRemoteProps = {
  session: LiveSessionContext;
  plan: LiveInteraction[];
  activeInteraction: LiveInteraction | null;
  results: InteractionResults | null;
  connectedStudents: number;
  questionCount: number;
  questions: LiveQuestion[];
  featuredQuestionId: number | null;
  displayConnected: boolean;
  timer?: LiveTimer | null;
  syncConnected?: boolean;
  onLaunch: (interaction: LiveInteraction) => void;
  onToggleResponses: () => void;
  onReveal: () => void;
  onAdvanceModule: () => void;
  onFinish: () => void;
  onOpenDisplay: () => void;
  onOpenConsole: () => void;
  onFeatureQuestion: (questionId: number) => void;
  onDismissQuestion: (question: LiveQuestion, dismissed: boolean) => void | Promise<void>;
  onLaunchUnplanned: (prompt: string) => void;
  onStartTimer: (durationSeconds: number) => void;
  onClearTimer: () => void;
};

export default function ClassfullyRemote({
  session,
  plan,
  activeInteraction,
  results,
  connectedStudents,
  questionCount,
  questions,
  featuredQuestionId,
  displayConnected,
  timer,
  syncConnected = true,
  onLaunch,
  onToggleResponses,
  onReveal,
  onAdvanceModule,
  onFinish,
  onOpenDisplay,
  onOpenConsole,
  onFeatureQuestion,
  onDismissQuestion,
  onLaunchUnplanned,
  onStartTimer,
  onClearTimer,
}: ClassfullyRemoteProps) {
  const [stage, setStage] = useState<'shell' | 'content' | 'actions'>('shell');
  const [showPlan, setShowPlan] = useState(!activeInteraction);
  const [showQuestions, setShowQuestions] = useState(false);
  const [quickAskOpen, setQuickAskOpen] = useState(false);
  const [quickToolsOpen, setQuickToolsOpen] = useState(false);
  const [quickAsk, setQuickAsk] = useState('');
  const [projectorCheckOpen, setProjectorCheckOpen] = useState(false);
  const [clockNow, setClockNow] = useState(Date.now());
  const [dismissedQuestionUndo, setDismissedQuestionUndo] = useState<LiveQuestion | null>(null);
  const [moderatingQuestionId, setModeratingQuestionId] = useState<number | null>(null);
  const hasActiveInteraction = Boolean(activeInteraction);

  useEffect(() => {
    if (!timer) return;
    setClockNow(Date.now());
    const tick = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [timer]);

  useEffect(() => {
    setStage('shell');
    setShowPlan(!hasActiveInteraction);
    const contentTimer = window.setTimeout(() => setStage('content'), REMOTE_TIMING.content);
    const actionTimer = window.setTimeout(() => setStage('actions'), REMOTE_TIMING.actions);
    return () => {
      window.clearTimeout(contentTimer);
      window.clearTimeout(actionTimer);
    };
  }, [activeInteraction?.id, hasActiveInteraction, results?.revealed]);

  useEffect(() => {
    if (!dismissedQuestionUndo) return;
    const timer = window.setTimeout(() => setDismissedQuestionUndo(null), 6000);
    return () => window.clearTimeout(timer);
  }, [dismissedQuestionUndo]);

  const responseTarget = Math.max(connectedStudents, results?.responseCount || 0);
  const responseProgress = responseTarget
    ? Math.min(100, Math.round(((results?.responseCount || 0) / responseTarget) * 100))
    : 0;
  const nextInteractions = useMemo(
    () => plan.filter((interaction) => interaction.id !== activeInteraction?.id),
    [activeInteraction?.id, plan],
  );
  const activePlanIndex = activeInteraction ? plan.findIndex((interaction) => interaction.id === activeInteraction.id) : -1;
  const nextInteraction = activePlanIndex >= 0 ? plan[activePlanIndex + 1] || null : plan[0] || null;
  const topQuestions = useMemo(() => [...questions].sort((a, b) => b.votes - a.votes).slice(0, 4), [questions]);
  const timerSeconds = timer ? Math.max(0, Math.ceil((timer.endsAt - clockNow) / 1000)) : 0;
  const timerText = `${Math.floor(timerSeconds / 60)}:${String(timerSeconds % 60).padStart(2, '0')}`;
  const isPeerLearning = activeInteraction?.type === 'peer-learning';
  const isClock = activeInteraction?.type === 'timer';
  const isGroupWork = activeInteraction?.type === 'group-work';
  const peerPhase = results?.phase || 'respond';

  const submitQuickAsk = () => {
    const prompt = quickAsk.trim();
    if (!prompt) return;
    onLaunchUnplanned(prompt);
    setQuickAsk('');
    setQuickAskOpen(false);
    setQuickToolsOpen(false);
  };

  const startProjectorCheck = () => {
    setProjectorCheckOpen(true);
    if (!displayConnected) onOpenDisplay();
  };

  const changeQuestionDismissal = async (question: LiveQuestion, dismissed: boolean) => {
    if (moderatingQuestionId === question.id) return;
    setModeratingQuestionId(question.id);
    try {
      await onDismissQuestion(question, dismissed);
      setDismissedQuestionUndo(dismissed ? question : null);
    } finally {
      setModeratingQuestionId(null);
    }
  };

  return (
    <div className="classfully-remote" data-stage={stage}>
      <header className="remote-header">
        <div className="remote-brand">Classfully<span>.</span></div>
        <div className={`remote-live-state ${syncConnected ? 'is-connected' : ''}`}>
          <i aria-hidden="true" />
          <span>{syncConnected ? 'Live' : 'Reconnecting'}</span>
        </div>
      </header>

      <main className="remote-main">
        <section className="remote-session-heading">
          <span>{session.courseCode}</span>
          <h1>{session.sessionTitle}</h1>
          <div className="remote-room-stats">
            <span><Users size={15} /> {connectedStudents} connected</span>
            <button type="button" className={questionCount ? 'has-questions' : ''} onClick={() => setShowQuestions((open) => !open)} aria-expanded={showQuestions}><Radio size={14} /> {questionCount} questions</button>
          </div>
        </section>

        {showQuestions && (
          <section className="remote-question-panel" aria-label="Top student questions">
            <div className="remote-question-heading"><div><small>Student questions</small><strong>What the room wants discussed</strong></div><button type="button" onClick={() => setShowQuestions(false)} aria-label="Close student questions"><X size={17} /></button></div>
            <div className="remote-question-list">
              {topQuestions.length ? topQuestions.map((question) => <article key={question.id}><p>{question.question}</p><div><span>{question.votes} upvotes</span><div className="remote-question-actions"><button type="button" className="is-dismiss" disabled={moderatingQuestionId === question.id} onClick={() => changeQuestionDismissal(question, true)} aria-label={`Dismiss question: ${question.question}`}><X size={13} /> Dismiss</button><button type="button" className={featuredQuestionId === question.id ? 'is-featured' : ''} onClick={() => onFeatureQuestion(question.id)}>{featuredQuestionId === question.id ? 'Remove' : 'Show on display'}</button></div></div></article>) : <p className="remote-no-questions">No student questions yet.</p>}
            </div>
            {dismissedQuestionUndo && <div className="remote-question-undo" role="status"><span>Question dismissed</span><button type="button" onClick={() => changeQuestionDismissal(dismissedQuestionUndo, false)}>Undo</button></div>}
          </section>
        )}

        {activeInteraction && results ? (
          <section className="remote-active-card" aria-live="polite">
            <div className="remote-active-kicker">
              <span><Sparkles size={14} /> {activeInteraction.label} is live</span>
              <button type="button" onClick={() => setShowPlan((current) => !current)}>
                {showPlan ? 'Back to live' : 'Choose interaction'}
              </button>
            </div>
            <h2>{activeInteraction.type === 'timer' ? activeInteraction.title : activeInteraction.prompt}</h2>
            {activeInteraction.type === 'timer' && <MarkdownContent className="remote-clock-instructions" markdown={activeInteraction.prompt} />}

            {!isClock && <div className="remote-response-metric">
              <div>
                <strong key={results.responseCount}>{results.responseCount}</strong>
                <span>{isGroupWork ? 'group submissions' : `of ${responseTarget || 'the class'} responded`}</span>
              </div>
              <span className="remote-response-status">{isPeerLearning && peerPhase === 'discuss' ? 'Partner discussion' : isPeerLearning && peerPhase === 'respond-again' ? 'Second answer' : results.open ? 'Collecting' : results.revealed ? 'Revealed' : 'Locked'}</span>
            </div>}
            {!isClock && <div className="remote-progress" aria-label={`${responseProgress}% of connected students responded`}>
              <i style={{ width: `${responseProgress}%` }} />
            </div>}

            {isPeerLearning && <div className="remote-module-steps" aria-label="Peer learning stages"><span className="is-complete">1 Answer</span><span className={peerPhase === 'discuss' || peerPhase === 'respond-again' || peerPhase === 'complete' ? 'is-complete' : ''}>2 Discuss</span><span className={peerPhase === 'respond-again' || peerPhase === 'complete' ? 'is-complete' : ''}>3 Answer again</span></div>}
            {isGroupWork && <p className="remote-module-note">Groups of about {activeInteraction.groupSize || 4}. Ask each group to choose one note-taker.</p>}
            {isClock && <div className="remote-clock-focus"><Timer size={22} /><span><small>{timerSeconds === 0 ? 'Time is up' : 'Shared clock'}</small><strong>{timerText}</strong></span></div>}

            <div className="remote-primary-actions">
              {!isClock && !isPeerLearning && <button type="button" className="remote-lock" onClick={onToggleResponses}>
                {results.open ? <Pause size={18} /> : <Play size={18} />}
                <span>{results.open ? 'Lock responses' : 'Reopen responses'}</span>
              </button>}
              {isPeerLearning && peerPhase !== 'complete' && <button type="button" className="remote-reveal" onClick={onAdvanceModule} disabled={peerPhase !== 'discuss' && !results.responseCount}><ArrowRight size={18} /><span>{peerPhase === 'respond' ? 'Start partner discussion' : peerPhase === 'discuss' ? 'Ask again' : 'Show the shift'}</span></button>}
              {!isPeerLearning && activeInteraction.resultVisibility === 'after-reveal' && !results.revealed && (
                <button type="button" className="remote-reveal" onClick={onReveal} disabled={!results.responseCount}>
                  <Sparkles size={18} />
                  <span>{activeInteraction.type === 'quiz' ? 'Reveal answer' : 'Reveal result'}</span>
                </button>
              )}
              <button type="button" className="remote-finish" onClick={onFinish}>
                <Check size={18} />
                <span>Return to slides</span>
              </button>
            </div>

            {nextInteraction ? (
              <div className="remote-up-next">
                <div><small>Up next · {activePlanIndex + 2} of {plan.length}</small><strong>{nextInteraction.title}</strong></div>
                <button type="button" onClick={() => onLaunch(nextInteraction)}><span>Start next</span><ArrowRight size={17} /></button>
              </div>
            ) : (
              <div className="remote-up-next is-complete">
                <div><small>Prepared plan complete</small><strong>Choose another interaction or return to your slides.</strong></div>
                <button type="button" onClick={() => setShowPlan(true)}><span>Choose</span><ArrowRight size={17} /></button>
              </div>
            )}
          </section>
        ) : (
          <section className="remote-ready-card">
            <span className="remote-ready-icon"><Sparkles size={20} /></span>
            <div>
              <small>Ready when you are</small>
              <h2>Your slides stay in front.</h2>
              <p>Start an interaction here when you want to bring the class in.</p>
            </div>
          </section>
        )}

        {showPlan && (
          <section className="remote-plan" aria-label="Prepared interactions">
            <div className="remote-section-title">
              {activeInteraction && <button type="button" aria-label="Return to active interaction" onClick={() => setShowPlan(false)}><ChevronLeft size={17} /></button>}
              <span>{activeInteraction ? 'Switch interaction' : 'Prepared interactions'}</span>
              <small>{nextInteractions.length}</small>
            </div>
            <div className="remote-plan-list">
              {nextInteractions.length ? nextInteractions.map((interaction) => {
                const planIndex = plan.findIndex((item) => item.id === interaction.id);
                return (
                  <button type="button" key={interaction.id} onClick={() => onLaunch(interaction)}>
                    <span className="remote-plan-index">{String(planIndex + 1).padStart(2, '0')}</span>
                    <span className="remote-plan-copy">
                      <small>{planIndex === activePlanIndex + 1 ? 'Up next' : interaction.plannedTime || interaction.label}</small>
                      <strong>{interaction.title}</strong>
                    </span>
                    <ArrowRight size={17} />
                  </button>
                );
              }) : (
                <div className="remote-plan-empty"><Check size={17} /> All prepared interactions have been shown.</div>
              )}
            </div>
          </section>
        )}

        {timer && !isClock && (
          <section className={`remote-timer-card ${timerSeconds === 0 ? 'is-complete' : ''}`} aria-live="polite">
            <span><Timer size={17} /></span><div><small>{timerSeconds === 0 ? 'Time is up' : timer.label}</small><strong>{timerText}</strong></div><button type="button" onClick={onClearTimer}>{timerSeconds === 0 ? 'Dismiss' : 'Clear'}</button>
          </section>
        )}

        {quickAskOpen ? (
          <section className="remote-quick-ask-form" aria-label="Ask an unplanned question">
            <div className="remote-question-heading"><div><small>Unplanned moment</small><strong>Ask the room now</strong></div><button type="button" onClick={() => setQuickAskOpen(false)} aria-label="Cancel unplanned question"><X size={17} /></button></div>
            <textarea autoFocus value={quickAsk} onChange={(event) => setQuickAsk(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitQuickAsk(); } }} maxLength={180} placeholder="What do you want to ask?" aria-label="Unplanned question" />
            <button type="button" onClick={submitQuickAsk} disabled={!quickAsk.trim()}><MessageCircle size={16} /> Show now</button>
          </section>
        ) : quickToolsOpen ? (
          <section className="remote-quick-tools" aria-label="Quick teaching tools">
            <div className="remote-question-heading"><div><small>Quick tools</small><strong>Add something in the moment</strong></div><button type="button" onClick={() => setQuickToolsOpen(false)} aria-label="Close quick tools"><X size={17} /></button></div>
            <button type="button" onClick={() => setQuickAskOpen(true)}><span><MessageCircle size={16} /></span><div><strong>Ask a question</strong><small>Launch an unplanned short response</small></div><ArrowRight size={16} /></button>
            <div className="remote-timer-options"><span><Timer size={16} /> Show a timer</span>{[120, 300, 600].map((seconds) => <button type="button" key={seconds} onClick={() => { onStartTimer(seconds); setQuickToolsOpen(false); }}>{seconds / 60} min</button>)}</div>
          </section>
        ) : (
          <button type="button" className="remote-quick-ask-trigger" onClick={() => setQuickToolsOpen(true)}><WandSparkles size={16} /> Quick tools <span>Timer · Unplanned question</span></button>
        )}

      </main>

      <footer className="remote-footer">
        <button type="button" className={displayConnected ? 'is-connected' : ''} onClick={startProjectorCheck}>
          <MonitorUp size={17} />
          <span>{displayConnected ? 'Check display' : 'Set up display'}</span>
        </button>
        <button type="button" onClick={onOpenConsole}>
          <Maximize2 size={16} />
          <span>Full console</span>
        </button>
      </footer>
      <ProjectorPreflight open={projectorCheckOpen} connected={displayConnected} onOpenDisplay={onOpenDisplay} onConfirm={() => setProjectorCheckOpen(false)} onClose={() => setProjectorCheckOpen(false)} />
    </div>
  );
}
