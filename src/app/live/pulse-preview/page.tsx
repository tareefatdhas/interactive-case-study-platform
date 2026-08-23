'use client';

import {
  ArrowClockwise,
  ArrowRight,
  Check,
  CheckCircle,
  EyeSlash,
  Heartbeat,
  LockKey,
  Monitor,
  Pause,
  Play,
  ShieldCheck,
  Sparkle,
  Student,
  UserCircle,
} from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import QRCode from 'react-qr-code';
import CollectiveVisual, { type CollectiveTheme, type SessionMode } from './CollectiveVisual';
import styles from './pulse-preview.module.css';

const TOTAL_STUDENTS = 112;
const RECENT_SESSION_BENCHMARK = 96;

const pulseOptions = [
  { label: 'Ready to go', color: '#5146e5', shareLabel: 'Ready' },
  { label: 'Finding my pace', color: '#2f73df', shareLabel: 'Settling in' },
  { label: 'Low energy', color: '#d99f18', shareLabel: 'Could use a gentler start' },
  { label: 'Feeling stretched', color: '#df664e', shareLabel: 'May need more support' },
] as const;

type ViewId = 'student' | 'projector' | 'instructor';

const views: Array<{ id: ViewId; label: string; icon: typeof Student }> = [
  { id: 'student', label: 'Student', icon: Student },
  { id: 'projector', label: 'Projector', icon: Monitor },
  { id: 'instructor', label: 'Instructor', icon: UserCircle },
];

function StudentPreview({ submitted, onSubmit }: { submitted: boolean; onSubmit: () => void }) {
  const [answer, setAnswer] = useState(1);

  return (
    <section className={`${styles.surface} ${styles.studentSurface}`} aria-label="Student pulse experience">
      <header className={styles.studentHeader}>
        <strong>Classfully<span>.</span></strong>
        <small><i /> Connected</small>
      </header>

      {!submitted ? (
        <div className={styles.studentQuestion}>
          <div className={styles.questionMeta}><Heartbeat /> A quick check-in <span>Optional</span></div>
          <h2>How are you feeling as we get started?</h2>
          <p>Choose what feels closest right now.</p>

          <div className={styles.studentChoices}>
            {pulseOptions.map((option, index) => (
              <button
                className={answer === index ? styles.selectedChoice : ''}
                key={option.label}
                onClick={() => setAnswer(index)}
                type="button"
              >
                <span style={{ background: option.color }}>{String.fromCharCode(65 + index)}</span>
                <strong>{option.label}</strong>
                {answer === index && <CheckCircle weight="fill" />}
              </button>
            ))}
          </div>

          <button className={styles.submitButton} onClick={onSubmit} type="button">
            Send my check-in <ArrowRight />
          </button>
          <button className={styles.preferNot} onClick={onSubmit} type="button">I&apos;d rather not say</button>
          <p className={styles.privacyLine}><LockKey /> This answer stays between you and your instructor.</p>
        </div>
      ) : (
        <div className={styles.studentSubmitted}>
          <span className={styles.successMark}><Check /></span>
          <small>Thanks for checking in</small>
          <h2>You said<br /><em>{pulseOptions[answer].label}</em></h2>
          <p>You’re checked in. Take a moment to notice what you need before class starts.</p>
          <div className={styles.selfReflection}>
            <Sparkle />
            <div><small>A moment for you</small><strong>What would help right now?</strong></div>
          </div>
          <button className={styles.changeAnswer} onClick={onSubmit} type="button">Change my answer</button>
        </div>
      )}
    </section>
  );
}

function ProjectorPreview({ mode, responses, theme }: { mode: SessionMode; responses: number; theme: CollectiveTheme }) {
  const isFirstSession = mode === 'first';
  return (
    <section className={`${styles.surface} ${styles.projectorSurface}`} aria-label="Projector pulse experience">
      <header className={styles.projectorHeader}>
        <div><strong>ECON 302</strong><span>Platform strategy</span></div>
        <small><i /> Live</small>
      </header>
      <div className={styles.projectorContent}>
        <div className={styles.arrivalLayout}>
          <aside className={styles.joinPanel}>
            <div>
              <small>Join the class</small>
              <h2>Scan to check in</h2>
              <p>Your answer stays between you and your instructor.</p>
            </div>
            <div className={styles.qrFrame}>
              <QRCode aria-label="Join class QR code" bgColor="#fffefa" fgColor="#101a38" size={196} value="https://classfully.com/join?code=6QPCSG" />
            </div>
            <div className={styles.joinDetails}>
              <span>classfully.com/join</span>
              <small>Class code</small>
              <strong>6QPCSG</strong>
            </div>
            <div className={styles.joinCount}><strong key={`join-count-${responses}`}>{responses}</strong><span>checked in</span></div>
          </aside>

          <section
            className={styles.collectiveCharge}
            aria-label={isFirstSession ? `${responses} students checked in` : `${responses} students checked in against a recent-session benchmark of ${RECENT_SESSION_BENCHMARK}`}
          >
            <div className={styles.chargeStatus}>
              <span>Checking in now</span>
              <strong key={`charge-count-${responses}`}>
                {responses}
                <small>
                  {' checked in'}
                  {!isFirstSession && <> · around {RECENT_SESSION_BENCHMARK} usually join</>}
                </small>
              </strong>
            </div>
            <CollectiveVisual benchmark={RECENT_SESSION_BENCHMARK} mode={mode} responses={responses} theme={theme} />
          </section>
        </div>
      </div>
    </section>
  );
}

function InstructorPreview({ responses }: { responses: number }) {
  const percentage = Math.round((responses / TOTAL_STUDENTS) * 100);
  const counts = useMemo(() => {
    const ratios = [0.31, 0.34, 0.22, 0.13];
    const next = ratios.map((ratio) => Math.round(responses * ratio));
    const drift = responses - next.reduce((sum, value) => sum + value, 0);
    next[1] += drift;
    return next;
  }, [responses]);

  return (
    <section className={`${styles.surface} ${styles.instructorSurface}`} aria-label="Instructor pulse experience">
      <header className={styles.consoleHeader}>
        <div><small>Live now</small><h2>Class check-in</h2></div>
        <span><i /> {TOTAL_STUDENTS} connected</span>
      </header>

      <div className={styles.consoleSummary}>
        <div className={styles.responseStat}>
          <strong>{responses}<span> / {TOTAL_STUDENTS}</span></strong>
          <small>{percentage}% of the class has checked in</small>
          <div><span style={{ width: `${percentage}%` }} /></div>
        </div>
        <div className={styles.privateBadge}><EyeSlash /><div><strong>Only you can see these answers</strong><small>The projector shows participation, not mood</small></div></div>
      </div>

      <div className={styles.distribution}>
        <div className={styles.sectionHeading}>
          <div><small>Your view</small><h3>How the class is arriving</h3></div>
          <span>Private to you</span>
        </div>
        {pulseOptions.map((option, index) => {
          const share = responses ? Math.round((counts[index] / responses) * 100) : 0;
          return (
            <div className={styles.distributionRow} key={option.label}>
              <div><i style={{ background: option.color }} /><strong>{option.label}</strong></div>
              <span>{counts[index]}</span>
              <div className={styles.distributionTrack}><span style={{ background: option.color, width: `${share}%` }} /></div>
              <small>{share}%</small>
            </div>
          );
        })}
      </div>

      <div className={styles.instructorInsight}>
        <span><ShieldCheck /></span>
        <div>
          <small>Consider a gentler start</small>
          <strong>{counts[2] + counts[3]} students may appreciate a slower start</strong>
          <p>You could begin with a quiet minute or an easy warm-up.</p>
        </div>
      </div>

      <div className={styles.consoleActions}>
        <button type="button"><CheckCircle /> Close check-in</button>
        <button type="button">Share a note with the class <ArrowRight /></button>
      </div>
    </section>
  );
}

export default function PulsePreviewPage() {
  const [activeView, setActiveView] = useState<ViewId>('projector');
  const [responses, setResponses] = useState(8);
  const [studentSubmitted, setStudentSubmitted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [sessionMode, setSessionMode] = useState<SessionMode>('first');
  const [theme, setTheme] = useState<CollectiveTheme>('launch');

  useEffect(() => {
    if (!isPlaying) return;
    if (responses >= TOTAL_STUDENTS) {
      setIsPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setResponses((current) => Math.min(TOTAL_STUDENTS, current + 1));
    }, responses < 70 ? 150 : 230);
    return () => window.clearTimeout(timer);
  }, [isPlaying, responses]);

  const replayCheckIns = () => {
    setResponses(8);
    setActiveView('projector');
    setIsPlaying(true);
  };

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <small>Check-in preview</small>
          <h1>A better way to start class</h1>
          <p>Students check in privately. The instructor sees what may help. The room sees participation grow.</p>
        </div>
        <div className={styles.responseControl}>
          <label htmlFor="pulse-response-count">
            <span>Preview check-ins</span>
            <strong>
              {responses} checked in
              {sessionMode === 'returning' && <small>Around {RECENT_SESSION_BENCHMARK} usually join</small>}
            </strong>
          </label>
          <input
            id="pulse-response-count"
            max={TOTAL_STUDENTS}
            min={0}
            onChange={(event) => setResponses(Number(event.target.value))}
            type="range"
            value={responses}
          />
          <div className={styles.previewControls}>
            <button onClick={replayCheckIns} type="button"><ArrowClockwise /> Replay arrivals</button>
            <button onClick={() => setIsPlaying((value) => !value)} type="button">
              {isPlaying ? <Pause weight="fill" /> : <Play weight="fill" />}
              {isPlaying ? 'Pause' : 'Continue'}
            </button>
          </div>
        </div>
      </header>

      <section className={styles.experienceControls} aria-label="Choose a check-in experience">
        <div className={styles.controlGroup}>
          <span>Session history</span>
          <div>
            <button className={sessionMode === 'first' ? styles.controlActive : ''} onClick={() => setSessionMode('first')} type="button">First session</button>
            <button className={sessionMode === 'returning' ? styles.controlActive : ''} onClick={() => setSessionMode('returning')} type="button">Later sessions</button>
          </div>
          <small>{sessionMode === 'first' ? 'Starts with today’s check-ins' : 'Uses recent sessions as a guide'}</small>
        </div>
        <div className={styles.controlGroup}>
          <span>Room visual</span>
          <div>
            {([
              ['launch', 'Launch'],
              ['constellation', 'Constellation'],
            ] as const).map(([id, label]) => (
              <button className={theme === id ? styles.controlActive : ''} key={id} onClick={() => setTheme(id)} type="button">{label}</button>
            ))}
          </div>
          <small>Launch feels energetic. Constellation feels calm.</small>
        </div>
      </section>

      <nav className={styles.viewTabs} aria-label="Preview a classroom view">
        {views.map((view) => {
          const Icon = view.icon;
          return <button className={activeView === view.id ? styles.activeTab : ''} key={view.id} onClick={() => setActiveView(view.id)} type="button"><Icon />{view.label}</button>;
        })}
      </nav>

      <div className={styles.previewStage}>
        <div className={styles.viewLabel}>
          <span>{activeView === 'student' ? 'Just for the student' : activeView === 'projector' ? 'For the whole room' : 'Just for the instructor'}</span>
          <small>{activeView === 'student' ? 'Phone view' : activeView === 'projector' ? 'Presentation view' : 'Instructor console'}</small>
        </div>
        {activeView === 'student' && <StudentPreview submitted={studentSubmitted} onSubmit={() => setStudentSubmitted((value) => !value)} />}
        {activeView === 'projector' && <ProjectorPreview mode={sessionMode} responses={responses} theme={theme} />}
        {activeView === 'instructor' && <InstructorPreview responses={responses} />}
      </div>

      <footer className={styles.boundaryNote}>
        <LockKey />
        <p><strong>The room sees arrivals, not answers.</strong> Individual responses stay between each student and the instructor.</p>
      </footer>
    </main>
  );
}
