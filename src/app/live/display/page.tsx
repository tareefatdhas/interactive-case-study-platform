'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import QRCode from 'react-qr-code';
import { Activity, CheckCircle2, HeartPulse, ListChecks, Lock, Maximize2, MessageCircle, MonitorUp, ShieldCheck, Smartphone, Users, Waves } from 'lucide-react';
import LivingMoodField from '@/components/live/LivingMoodField';
import { joinDisplayPresence, subscribeToStudentPublicState } from '@/lib/firebase/live-classroom';
import { ensureStudentAnonymousAuth } from '@/lib/firebase/student-config';
import {
  EMPTY_ONBOARDING_COUNTS,
  DEFAULT_LIVE_QUESTIONS,
  DEMO_SESSION,
  HISTORY,
  LESSON_CHANNEL,
  LESSON_STORAGE_KEY,
  MOODS,
  dotStyle,
  percent,
  resultPercent,
  total,
  type LessonDisplayState,
} from '../live-data';
import './display.css';

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

const RESULT_COLORS = ['#5146e5', '#2f73df', '#d99f18', '#df664e', '#2f8b63'];

type ProjectorFlight = {
  id: number;
  color: string;
  delay: number;
  width: number;
  height: number;
  path: string;
  targetX: number;
  targetY: number;
};

function ProjectorTransportFlight({ flight }: { flight: ProjectorFlight }) {
  return (
    <span
      className="projector-transport-flight"
      style={{
        '--flight-color': flight.color,
        '--flight-delay': `${flight.delay}ms`,
        '--flight-target-x': `${flight.targetX}px`,
        '--flight-target-y': `${flight.targetY}px`,
      } as CSSProperties}
      aria-hidden="true"
    >
      <svg viewBox={`0 0 ${flight.width} ${flight.height}`} preserveAspectRatio="none">
        <path d={flight.path} pathLength="100" />
        <circle className="projector-flight-echo projector-flight-echo-one" r="7">
          <animateMotion begin={`${flight.delay + 70}ms`} dur="980ms" fill="freeze" path={flight.path} keyPoints="0;0.82;1" keyTimes="0;0.76;1" calcMode="spline" keySplines="0.18 0.74 0.2 1;0.2 0.8 0.2 1" />
        </circle>
        <circle className="projector-flight-echo projector-flight-echo-two" r="5">
          <animateMotion begin={`${flight.delay + 135}ms`} dur="920ms" fill="freeze" path={flight.path} keyPoints="0;0.82;1" keyTimes="0;0.76;1" calcMode="spline" keySplines="0.18 0.74 0.2 1;0.2 0.8 0.2 1" />
        </circle>
        <circle className="projector-flight-orb" r="10">
          <animateMotion begin={`${flight.delay}ms`} dur="1040ms" fill="freeze" path={flight.path} keyPoints="0;0.84;1" keyTimes="0;0.78;1" calcMode="spline" keySplines="0.18 0.74 0.2 1;0.2 0.8 0.2 1" />
        </circle>
      </svg>
      <i />
    </span>
  );
}

function responsePointStyle(index: number): CSSProperties {
  const column = (index * 37 + 11) % 96;
  const wave = 46 + Math.sin(index * 1.47) * 24 + ((index * 13) % 9) - 4;
  const size = 5 + (index % 4) * 1.4;
  return {
    '--signal-x': `${column}%`,
    '--signal-y': `${Math.max(13, Math.min(84, wave))}%`,
    '--signal-size': `${size}px`,
    '--signal-delay': `${Math.min(index * 22, 520)}ms`,
  } as CSSProperties;
}

function ResponseCurrent({ count, runId, open }: { count: number; runId: string; open: boolean }) {
  const visiblePoints = Math.min(count, 64);
  return (
    <div className={`response-current ${open ? 'is-collecting' : 'is-held'}`}>
      <div className="response-current-copy">
        <span>{open ? 'Class signal forming' : 'Class signal held'}</span>
        <strong>{count ? `${count} ${count === 1 ? 'response is' : 'responses are'} in the room` : 'Waiting for the first response'}</strong>
        <small>{open ? 'Each arrival joins the shared field. Choices stay hidden until reveal.' : 'The field is ready to separate into the class result.'}</small>
      </div>
      <div className="response-current-field" aria-hidden="true">
        <svg viewBox="0 0 800 120" preserveAspectRatio="none">
          <path className="response-current-path response-current-path-one" d="M-20 74 C120 4 250 112 390 52 S650 30 820 76" />
          <path className="response-current-path response-current-path-two" d="M-30 43 C155 115 250 4 420 70 S660 105 830 36" />
        </svg>
        <div className="response-current-points">
          {Array.from({ length: visiblePoints }).map((_, index) => (
            <i key={`${runId}-${index}`} style={responsePointStyle(index)} />
          ))}
        </div>
        {count > 0 && <i className="response-current-arrival" key={`arrival-${count}`} />}
        {count > 64 && <em>Latest 64 shown</em>}
      </div>
    </div>
  );
}

function ClassroomInteraction({ lessonState }: { lessonState: LessonDisplayState }) {
  const interaction = lessonState.activeInteraction;
  const results = lessonState.interactionResults;
  if (!interaction || !results) return null;

  const sharedResponse = (results.writtenResponses || []).find((response) => response.id === results.sharedResponseId);
  const showDistribution = Boolean(interaction.options?.length && results.revealed);

  return (
    <section className={`interaction-display-stage ${showDistribution ? 'has-results' : interaction.options?.length ? 'has-response-current' : ''}`}>
      <div className="interaction-display-heading">
        <div>
          <span className="display-eyebrow"><ListChecks size={20} /> {interaction.label}</span>
          <h1>{interaction.prompt}</h1>
          <p>{results.open ? 'Respond on your phone.' : results.revealed ? 'Responses are locked. Discuss the result together.' : 'Responses are locked while the instructor reviews them.'}</p>
        </div>
        <div className="interaction-display-count">
          <Users size={21} />
          <strong key={results.responseCount}>{results.responseCount}</strong>
          <span>responses</span>
          <div className="response-signal-meter" aria-hidden="true">
            {Array.from({ length: 9 }).map((_, index) => (
              <i
                className={index < Math.min(9, results.responseCount) ? 'is-filled' : ''}
                key={`${results.runId}-${results.responseCount}-${index}`}
                style={{ '--signal-delay': `${index * 24}ms` } as CSSProperties}
              />
            ))}
          </div>
        </div>
      </div>
      {!showDistribution && interaction.options?.length && (
        <ResponseCurrent count={results.responseCount} runId={results.runId} open={results.open} />
      )}
      {showDistribution ? (
        <div className="interaction-result-options">
          {interaction.options?.map((option, index) => {
            const count = results.optionCounts[index] ?? 0;
            const percentage = resultPercent(count, results.responseCount);
            const isCorrect = interaction.type === 'quiz' && interaction.correctOptionIndex === index;
            const resultColor = RESULT_COLORS[index % RESULT_COLORS.length];
            return (
              <article
                className={`${isCorrect ? 'is-correct' : ''} ${results.open ? 'is-live' : ''}`.trim()}
                key={option}
                style={{
                  '--result-color': resultColor,
                  '--result-percent': `${percentage}%`,
                  '--result-delay': `${index * 85}ms`,
                } as CSSProperties}
              >
                <span className="result-option-letter">{String.fromCharCode(65 + index)}</span>
                <strong>{option}</strong>
                <div className="result-signal-track" aria-hidden="true">
                  <span className="result-signal-fill" key={`fill-${count}-${results.responseCount}`} />
                  {count > 0 && results.open && <span className="result-lane-arrival" key={`lane-arrival-${count}`} />}
                  <div className="result-dot-field">
                    {Array.from({ length: Math.min(24, count) }).map((_, dotIndex) => (
                      <i key={dotIndex} style={{ '--dot-delay': `${Math.min(dotIndex * 18, 320)}ms` } as CSSProperties} />
                    ))}
                    {!count && <small>Waiting</small>}
                  </div>
                </div>
                <div className="result-option-value"><strong key={`${count}-${percentage}`}>{percentage}%</strong><span>{count} {count === 1 ? 'student' : 'students'}</span></div>
                {isCorrect && <CheckCircle2 size={24} />}
              </article>
            );
          })}
          {interaction.type === 'quiz' && interaction.explanation && (
            <div className="display-quiz-explanation"><CheckCircle2 size={21} /><span><strong>Why this answer</strong>{interaction.explanation}</span></div>
          )}
        </div>
      ) : interaction.options?.length ? (
        <div className="interaction-display-options">
          {interaction.options.map((option, index) => (
            <article key={option}><span>{String.fromCharCode(65 + index)}</span><strong>{option}</strong><i /></article>
          ))}
        </div>
      ) : (
        <div className={`interaction-display-waiting ${sharedResponse ? 'has-shared-response' : ''}`}>
          <MessageCircle size={30} />
          {sharedResponse ? <><strong>“{sharedResponse.text}”</strong><span>Shared anonymously by the instructor</span></> : <><strong>{results.responseCount ? `${results.responseCount} ${results.responseCount === 1 ? 'response' : 'responses'} received` : 'Responses are open'}</strong><span>Written answers stay private until the instructor shares one.</span></>}
        </div>
      )}
    </section>
  );
}

function ClassroomWelcome({ lessonState, joinUrl }: { lessonState: LessonDisplayState; joinUrl: string }) {
  const step = lessonState.onboardingStep;
  const welcomeResponses = total(lessonState.onboardingMoodCounts);

  if (step === 1) {
    return (
      <section className="welcome-display-stage welcome-join-stage">
        <div className="welcome-display-copy">
          <span className="welcome-display-kicker"><Smartphone size={21} /> Step 1 · Join the room</span>
          <h1>Your phone is your quiet way into the conversation.</h1>
          <p>Open the class link, enter the code, and keep this page nearby while we learn.</p>
          <div className="welcome-join-details"><span>Go to</span><strong>{joinUrl.replace(/^https?:\/\//, '')}</strong><small>No app download needed</small></div>
        </div>
        <div className="welcome-qr-card">
          <QRCode value={`${joinUrl}?code=${encodeURIComponent(lessonState.session.sessionCode.replace(/\s/g, ''))}`} size={218} bgColor="#fffefa" fgColor="#101a38" />
          <span>Class code</span>
          <strong>{lessonState.session.sessionCode}</strong>
          <small>{lessonState.session.courseCode} · {lessonState.session.sessionTitle}</small>
        </div>
      </section>
    );
  }

  if (step === 2) {
    const participationWays = [
      { icon: HeartPulse, title: 'Send a pulse', copy: 'Share how the class feels without being singled out.' },
      { icon: MessageCircle, title: 'Ask or upvote', copy: 'Surface the questions other people may be holding too.' },
      { icon: Activity, title: 'Signal the pace', copy: 'Quietly let the instructor know when the room needs a pause.' },
    ];
    return (
      <section className="welcome-display-stage welcome-signals-stage">
        <div className="welcome-signals-heading">
          <span className="welcome-display-kicker"><ShieldCheck size={21} /> Step 2 · How participation works</span>
          <h1>Participate without the spotlight.</h1>
          <p>Your instructor sees the room clearly. Your classmates see the shared signal, not who sent it.</p>
        </div>
        <div className="welcome-signal-cards">
          {participationWays.map(({ icon: Icon, title, copy }, index) => (
            <article key={title}>
              <span><Icon size={28} /></span>
              <small>0{index + 1}</small>
              <h2>{title}</h2>
              <p>{copy}</p>
            </article>
          ))}
        </div>
        <div className="welcome-privacy-strip"><Lock size={17} /> Individual wellbeing responses stay private. The projector only shows the class total.</div>
      </section>
    );
  }

  if (step === 3) {
    return (
      <section className="welcome-display-stage welcome-try-stage">
        <div className="welcome-try-heading">
          <div>
            <span className="welcome-display-kicker"><HeartPulse size={21} /> Step 3 · Try it together</span>
            <h1>How are you arriving today?</h1>
            <p>Choose one response on your phone. Watch the class signal form here.</p>
          </div>
          <div className="welcome-live-count"><i /><strong>{welcomeResponses}</strong><span>first pulses</span></div>
        </div>
        <div className="welcome-live-clusters">
          {MOODS.map((mood) => {
            const value = lessonState.onboardingMoodCounts[mood.key];
            const percentage = welcomeResponses ? Math.round((value / welcomeResponses) * 100) : 0;
            return (
              <div className="welcome-cluster-row" key={mood.key} style={{ '--mood-color': mood.color } as CSSProperties}>
                <div className="welcome-cluster-label"><i /><span>{mood.label}</span></div>
                <div className="welcome-cluster-dots" aria-hidden="true">
                  {Array.from({ length: Math.max(value, value ? 1 : 0) }).map((_, index) => <i key={`${lessonState.onboardingRunId}-${mood.key}-${index}`} style={dotStyle(index, mood.color)} />)}
                  {!value && <span>Waiting for the first response…</span>}
                </div>
                <div className="welcome-cluster-value"><strong>{percentage}%</strong><span>{value} {value === 1 ? 'response' : 'responses'}</span></div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="welcome-display-stage welcome-ready-stage">
      <div className="welcome-ready-mark"><CheckCircle2 size={44} /></div>
      <span className="welcome-display-kicker">Classroom welcome complete</span>
      <h1>You’re in. Let’s make this a conversation.</h1>
      <p>{welcomeResponses} students tried the first pulse. Questions can be anonymous, and the shared room signal stays visible throughout the lesson.</p>
      <div className="welcome-ready-stats">
        <span><strong>{lessonState.session.sessionCode}</strong><small>Class code</small></span>
        <span><strong>{welcomeResponses}</strong><small>First pulses</small></span>
        <span><strong>3</strong><small>Ways to participate</small></span>
      </div>
    </section>
  );
}

function QuestionSpotlight({ question }: { question: LessonDisplayState['questions'][number] }) {
  return (
    <section className="question-spotlight-stage" key={question.id}>
      <div className="question-spotlight-stream" aria-hidden="true">
        {Array.from({ length: 11 }).map((_, index) => <i key={index} style={{ '--question-particle': index, '--question-size': `${5 + (index % 3) * 2}px` } as CSSProperties} />)}
      </div>
      <div className="question-spotlight-card">
        <span className="display-eyebrow"><MessageCircle size={20} /> Question from the room</span>
        <blockquote>“{question.question}”</blockquote>
        <div>
          <span><ShieldCheck size={17} /> Shared anonymously</span>
          <strong>{question.votes}<small>{question.votes === 1 ? 'upvote' : 'upvotes'}</small></strong>
        </div>
      </div>
      <p>Let’s pause here together.</p>
    </section>
  );
}

export default function ClassroomDisplayPage() {
  const [lessonState, setLessonState] = useState<LessonDisplayState>(DEFAULT_STATE);
  const [connected, setConnected] = useState(false);
  const [remoteUnavailable, setRemoteUnavailable] = useState(false);
  const [joinUrl, setJoinUrl] = useState('https://seminar.live/join');
  const [projectorFlights, setProjectorFlights] = useState<ProjectorFlight[]>([]);
  const arrivalSequenceRef = useRef(0);
  const priorArrivalStateRef = useRef<{
    runId: string | null;
    responseCount: number;
    optionCounts: number[];
    welcomeCounts: Record<string, number>;
    incomingMood: string | null;
    sharedResponseId: string | null;
  } | null>(null);

  const launchProjectorFlights = (color: string, targetXRatio: number, targetYRatio: number, amount = 1) => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const targetX = width * targetXRatio;
    const targetY = height * targetYRatio;
    const starts = [
      [-28, height * 0.18],
      [width + 28, height * 0.24],
      [-24, height * 0.76],
      [width + 24, height * 0.68],
      [width * 0.28, -24],
      [width * 0.72, height + 24],
    ];
    const flights = Array.from({ length: Math.min(amount, 5) }).map((_, index) => {
      const sequence = arrivalSequenceRef.current++;
      const [startX, startY] = starts[sequence % starts.length];
      const bendX = width * (0.34 + ((sequence * 17) % 28) / 100);
      const bendY = height * (0.16 + ((sequence * 13) % 48) / 100);
      return {
        id: Date.now() + sequence + index,
        color,
        delay: index * 90,
        width,
        height,
        path: `M ${startX} ${startY} C ${bendX} ${bendY}, ${targetX + (startX < 0 ? -80 : 80)} ${targetY - 70}, ${targetX} ${targetY}`,
        targetX,
        targetY,
      } satisfies ProjectorFlight;
    });
    setProjectorFlights((current) => [...current.slice(-7), ...flights]);
    const ids = new Set(flights.map((flight) => flight.id));
    window.setTimeout(() => setProjectorFlights((current) => current.filter((flight) => !ids.has(flight.id))), 1750 + flights.length * 90);
  };

  useEffect(() => {
    const results = lessonState.interactionResults;
    const current = {
      runId: results?.runId || null,
      responseCount: results?.responseCount || 0,
      optionCounts: [...(results?.optionCounts || [])],
      welcomeCounts: { ...lessonState.onboardingMoodCounts },
      incomingMood: lessonState.incomingMood,
      sharedResponseId: results?.sharedResponseId || null,
    };
    const prior = priorArrivalStateRef.current;
    priorArrivalStateRef.current = current;
    if (!prior) return;

    if (current.incomingMood && current.incomingMood !== prior.incomingMood) {
      const moodIndex = MOODS.findIndex((mood) => mood.key === current.incomingMood);
      const mood = MOODS[Math.max(0, moodIndex)];
      launchProjectorFlights(mood.color, 0.48, 0.39 + Math.max(0, moodIndex) * 0.095);
      return;
    }

    if (current.sharedResponseId && current.sharedResponseId !== prior.sharedResponseId) {
      launchProjectorFlights('#6654e9', 0.52, 0.63, 3);
      return;
    }

    const welcomeTotal = Object.values(current.welcomeCounts).reduce((sum, count) => sum + count, 0);
    const priorWelcomeTotal = Object.values(prior.welcomeCounts).reduce((sum, count) => sum + count, 0);
    if (lessonState.onboardingStep === 3 && welcomeTotal > priorWelcomeTotal) {
      const moodIndex = MOODS.findIndex((mood) => (
        (current.welcomeCounts[mood.key] || 0) > (prior.welcomeCounts[mood.key] || 0)
      ));
      const mood = MOODS[Math.max(0, moodIndex)];
      launchProjectorFlights(mood.color, 0.52, 0.4 + Math.max(0, moodIndex) * 0.095, welcomeTotal - priorWelcomeTotal);
      return;
    }

    if (current.runId && current.runId === prior.runId && current.responseCount > prior.responseCount) {
      const interaction = lessonState.activeInteraction;
      const canShowChoice = interaction?.resultVisibility === 'live' || interaction?.type === 'pulse';
      const changedOption = canShowChoice
        ? current.optionCounts.findIndex((count, index) => count > (prior.optionCounts[index] || 0))
        : -1;
      const color = changedOption >= 0 ? RESULT_COLORS[changedOption % RESULT_COLORS.length] : '#6654e9';
      const targetY = changedOption >= 0 ? 0.4 + changedOption * 0.1 : 0.58;
      launchProjectorFlights(color, changedOption >= 0 ? 0.62 : 0.68, targetY, current.responseCount - prior.responseCount);
    }
  }, [lessonState.activeInteraction, lessonState.incomingMood, lessonState.interactionResults, lessonState.onboardingMoodCounts, lessonState.onboardingStep]);

  useEffect(() => {
    const handleOffline = () => setConnected(false);
    window.addEventListener('offline', handleOffline);
    return () => window.removeEventListener('offline', handleOffline);
  }, []);

  useEffect(() => {
    setJoinUrl(`${window.location.origin}/join`);
    const sessionId = new URLSearchParams(window.location.search).get('sessionId');
    if (sessionId) {
      const ownerUid = new URLSearchParams(window.location.search).get('ownerUid');
      let cancelled = false;
      let stopState: (() => void) | undefined;
      let stopPresence: (() => void) | undefined;

      const connectRemoteDisplay = async () => {
        if (!ownerUid) throw new Error('Classroom link is incomplete.');
        await ensureStudentAnonymousAuth();
        if (cancelled) return;
        stopState = await subscribeToStudentPublicState(ownerUid, sessionId, (state) => {
          if (cancelled) return;
          if (!state) {
            setConnected(false);
            setRemoteUnavailable(true);
            return;
          }
          setRemoteUnavailable(false);
          setLessonState({
            ...DEFAULT_STATE,
            ...state,
            questions: state.questions || [],
            session: state.session || DEFAULT_STATE.session,
          });
          setConnected(true);
        });
        stopPresence = await joinDisplayPresence(ownerUid, sessionId);
      };

      connectRemoteDisplay().catch(() => {
        if (!cancelled) {
          setConnected(false);
          setRemoteUnavailable(true);
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
        // Keep the safe default if an older prototype left incompatible local data.
      }
    }

    const channel = new BroadcastChannel(LESSON_CHANNEL);
    const announceReady = () => channel.postMessage({ type: 'display-ready' });

    channel.onmessage = (event: MessageEvent<{ type?: string; state?: LessonDisplayState }>) => {
      if (event.data?.type === 'lesson-state' && event.data.state) {
        setLessonState(event.data.state);
        setConnected(true);
      }
      if (event.data?.type === 'instructor-ready') announceReady();
    };

    announceReady();
    const heartbeat = window.setInterval(() => {
      channel.postMessage({ type: 'display-heartbeat' });
    }, 1800);

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== LESSON_STORAGE_KEY || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as Partial<LessonDisplayState>;
        setLessonState({ ...DEFAULT_STATE, ...parsed, session: parsed.session || DEMO_SESSION });
        setConnected(true);
      } catch {
        // Ignore partial writes and wait for the next broadcast.
      }
    };

    const announceClosed = () => channel.postMessage({ type: 'display-closed' });
    window.addEventListener('storage', handleStorage);
    window.addEventListener('beforeunload', announceClosed);

    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('beforeunload', announceClosed);
      announceClosed();
      channel.close();
    };
  }, []);

  const responseTotal = total(lessonState.counts);
  const featuredQuestion = lessonState.questions.find((question) => question.id === lessonState.featuredQuestionId) || null;
  const selectedDate = HISTORY[lessonState.selectedWeek]?.date ?? 'Today';
  const roomSignal = useMemo(() => {
    const overwhelmed = lessonState.counts.overwhelmed;
    return overwhelmed >= 12 ? 'The room is settling in' : 'The room feels steady';
  }, [lessonState.counts.overwhelmed]);

  const enterFullscreen = async () => {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  };

  return (
    <main className={`classroom-display ${lessonState.playingHistory ? 'is-flowing' : ''}`}>
      <header className="display-topbar">
        <div className="display-brand">Classfully<span>.</span></div>
        <div className="display-course">
          <span className="display-live"><i /> {remoteUnavailable ? 'Ended' : 'Live'}</span>
          <strong>{lessonState.session.courseCode}</strong>
          <em>{lessonState.session.courseName}</em>
        </div>
        <div className="display-top-actions">
          <span className={`sync-status ${connected ? 'is-connected' : ''}`}><i /> {remoteUnavailable ? 'Class ended' : connected ? 'Synced with instructor' : 'Waiting for instructor'}</span>
          <button type="button" onClick={enterFullscreen}><Maximize2 size={18} /> Fullscreen</button>
        </div>
      </header>

      {projectorFlights.map((flight) => <ProjectorTransportFlight key={flight.id} flight={flight} />)}

      {remoteUnavailable ? (
        <>
          <section className="welcome-display-stage welcome-join-stage">
            <div className="welcome-display-copy">
              <span className="welcome-display-kicker"><CheckCircle2 size={21} /> Class complete</span>
              <h1>This session has ended.</h1>
              <p>Thank you for taking part. The next classroom code will appear when your instructor begins another session.</p>
            </div>
          </section>
          <footer className="display-footer">
            <div className="room-rhythm"><i /><span><strong>Responses are closed</strong><small>It is safe to close this display</small></span></div>
          </footer>
        </>
      ) : lessonState.onboardingStep > 0 ? (
        <>
          <ClassroomWelcome lessonState={lessonState} joinUrl={joinUrl} />
          <footer className="display-footer welcome-display-footer">
            <div className="room-rhythm"><i /><span><strong>Class welcome is live</strong><small>Follow along on your phone</small></span></div>
            <div className="welcome-stage-progress">
              {[1, 2, 3].map((step) => <i className={step <= lessonState.onboardingStep ? 'is-filled' : ''} key={step} />)}
              <span>{lessonState.onboardingStep === 4 ? 'Ready to begin' : `Step ${lessonState.onboardingStep} of 3`}</span>
            </div>
            <div className="join-code"><span>Class code</span><strong>{lessonState.session.sessionCode}</strong></div>
          </footer>
        </>
      ) : featuredQuestion ? (
        <>
          <QuestionSpotlight question={featuredQuestion} />
          <footer className="display-footer question-spotlight-footer">
            <div className="room-rhythm"><i /><span><strong>Question selected for discussion</strong><small>The instructor can return to the activity when ready</small></span></div>
            <div className="display-footer-insight"><MessageCircle size={16} /><span>{featuredQuestion.votes} class upvotes</span></div>
            <div className="join-code"><span>Class code</span><strong>{lessonState.session.sessionCode}</strong></div>
          </footer>
        </>
      ) : lessonState.activeInteraction ? (
        <>
          <ClassroomInteraction lessonState={lessonState} />
          <footer className="display-footer">
            <div className="room-rhythm"><i /><span><strong>{lessonState.activeInteraction.title}</strong><small>{lessonState.interactionResults?.open ? 'Responses are open' : lessonState.interactionResults?.revealed ? 'Result revealed' : 'Responses are locked'}</small></span></div>
            <div className="display-footer-insight"><MonitorUp size={16} /><span>Controlled from the instructor console</span></div>
            <div className="join-code"><span>Class code</span><strong>{lessonState.session.sessionCode}</strong></div>
          </footer>
        </>
      ) : (
        <>
          <section className="display-content">
        <div className="display-prompt">
          <div>
            <span className="display-eyebrow"><Waves size={20} /> Student wellbeing check-in</span>
            <h1>How are you feeling today?</h1>
            <p><Lock size={16} /> Your response is private. Only the class total is shown.</p>
          </div>
          <div className="display-response-count"><Users size={22} /><strong>{responseTotal}</strong><span>{responseTotal === 1 ? 'response' : 'responses'}</span></div>
        </div>

        <div className="projector-chart" aria-live="polite">
          <div className="projector-key">
            <span><i className="solid" /> {selectedDate}</span>
            {lessonState.showComparison && <span><i className="outline" /> Prior class</span>}
          </div>

          {MOODS.map((mood) => {
            const value = lessonState.counts[mood.key];
            const currentPercent = percent(value, lessonState.counts);
            const previousPercent = percent(lessonState.comparisonCounts[mood.key], lessonState.comparisonCounts);
            return (
              <div
                className="projector-row"
                key={mood.key}
                style={{ '--mood-color': mood.color } as CSSProperties}
              >
                <div className="projector-label"><i /><span>{mood.label}</span></div>
                <div className="projector-cluster">
                  <LivingMoodField
                    color={mood.color}
                    currentPercent={currentPercent}
                    previousPercent={previousPercent}
                    showComparison={lessonState.showComparison}
                    incoming={lessonState.incomingMood === mood.key}
                    replaying={lessonState.playingHistory}
                    projector
                    animationKey={lessonState.selectedWeek}
                  />
                </div>
                <div className="projector-value"><strong>{currentPercent}%</strong><span>{value} students</span></div>
              </div>
            );
          })}
        </div>
          </section>

          <footer className="display-footer">
            <div className="room-rhythm"><i /><span><strong>{roomSignal}</strong><small>{lessonState.paused ? 'Responses are paused' : 'New responses appear as they arrive'}</small></span></div>
            <div className="display-history"><MonitorUp size={18} /><span>{lessonState.playingHistory ? `Replaying ${selectedDate}` : 'Live class pulse'}</span></div>
            <div className="join-code"><span>Join the class</span><strong>{lessonState.session.sessionCode}</strong></div>
          </footer>
        </>
      )}
    </main>
  );
}
