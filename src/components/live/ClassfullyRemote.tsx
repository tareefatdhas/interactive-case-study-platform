'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Lock,
  Maximize2,
  MonitorUp,
  Pause,
  Play,
  Radio,
  Sparkles,
  Users,
} from 'lucide-react';
import type { InteractionResults, LiveInteraction, LiveSessionContext } from '@/app/live/live-data';
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
  displayConnected: boolean;
  syncConnected?: boolean;
  onLaunch: (interaction: LiveInteraction) => void;
  onToggleResponses: () => void;
  onReveal: () => void;
  onFinish: () => void;
  onOpenDisplay: () => void;
  onOpenConsole: () => void;
};

export default function ClassfullyRemote({
  session,
  plan,
  activeInteraction,
  results,
  connectedStudents,
  questionCount,
  displayConnected,
  syncConnected = true,
  onLaunch,
  onToggleResponses,
  onReveal,
  onFinish,
  onOpenDisplay,
  onOpenConsole,
}: ClassfullyRemoteProps) {
  const [stage, setStage] = useState<'shell' | 'content' | 'actions'>('shell');
  const [showPlan, setShowPlan] = useState(!activeInteraction);

  useEffect(() => {
    setStage('shell');
    setShowPlan(!activeInteraction);
    const contentTimer = window.setTimeout(() => setStage('content'), REMOTE_TIMING.content);
    const actionTimer = window.setTimeout(() => setStage('actions'), REMOTE_TIMING.actions);
    return () => {
      window.clearTimeout(contentTimer);
      window.clearTimeout(actionTimer);
    };
  }, [activeInteraction?.id, results?.revealed]);

  const responseTarget = Math.max(connectedStudents, results?.responseCount || 0);
  const responseProgress = responseTarget
    ? Math.min(100, Math.round(((results?.responseCount || 0) / responseTarget) * 100))
    : 0;
  const nextInteractions = useMemo(
    () => plan.filter((interaction) => interaction.id !== activeInteraction?.id),
    [activeInteraction?.id, plan],
  );

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
            <span className={questionCount ? 'has-questions' : ''}><Radio size={14} /> {questionCount} questions</span>
          </div>
        </section>

        {activeInteraction && results ? (
          <section className="remote-active-card" aria-live="polite">
            <div className="remote-active-kicker">
              <span><Sparkles size={14} /> {activeInteraction.label} is live</span>
              <button type="button" onClick={() => setShowPlan((current) => !current)}>
                {showPlan ? 'Hide plan' : 'Next'}
              </button>
            </div>
            <h2>{activeInteraction.prompt}</h2>

            <div className="remote-response-metric">
              <div>
                <strong key={results.responseCount}>{results.responseCount}</strong>
                <span>of {responseTarget || 'the class'} responded</span>
              </div>
              <span className="remote-response-status">{results.open ? 'Collecting' : results.revealed ? 'Revealed' : 'Locked'}</span>
            </div>
            <div className="remote-progress" aria-label={`${responseProgress}% of connected students responded`}>
              <i style={{ width: `${responseProgress}%` }} />
            </div>

            <div className="remote-primary-actions">
              <button type="button" className="remote-lock" onClick={onToggleResponses}>
                {results.open ? <Pause size={18} /> : <Play size={18} />}
                <span>{results.open ? 'Lock responses' : 'Reopen responses'}</span>
              </button>
              {activeInteraction.resultVisibility === 'after-reveal' && !results.revealed && (
                <button type="button" className="remote-reveal" onClick={onReveal} disabled={!results.responseCount}>
                  <Sparkles size={18} />
                  <span>{activeInteraction.type === 'quiz' ? 'Reveal answer' : 'Reveal result'}</span>
                </button>
              )}
              <button type="button" className="remote-finish" onClick={onFinish}>
                <Check size={18} />
                <span>Finish</span>
              </button>
            </div>
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
              <span>{activeInteraction ? 'Choose what comes next' : 'Prepared interactions'}</span>
              <small>{nextInteractions.length}</small>
            </div>
            <div className="remote-plan-list">
              {nextInteractions.length ? nextInteractions.map((interaction, index) => (
                <button type="button" key={interaction.id} onClick={() => onLaunch(interaction)}>
                  <span className="remote-plan-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="remote-plan-copy">
                    <small>{interaction.plannedTime || interaction.label}</small>
                    <strong>{interaction.title}</strong>
                  </span>
                  <ArrowRight size={17} />
                </button>
              )) : (
                <div className="remote-plan-empty"><Check size={17} /> All prepared interactions have been shown.</div>
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="remote-footer">
        <button type="button" className={displayConnected ? 'is-connected' : ''} onClick={onOpenDisplay}>
          <MonitorUp size={17} />
          <span>{displayConnected ? 'Display connected' : 'Open display'}</span>
        </button>
        <button type="button" onClick={onOpenConsole}>
          <Maximize2 size={16} />
          <span>Full console</span>
        </button>
      </footer>
    </div>
  );
}
