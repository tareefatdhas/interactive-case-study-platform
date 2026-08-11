'use client';

import {
  Broadcast as Radio,
  CaretRight as ChevronRight,
  ChatCircleDots as MessageCircleQuestion,
  CheckCircle,
  PaperPlaneTilt,
  UsersThree as Users,
} from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import ResponseTransferEffect, {
  RESPONSE_TRANSFER_DEPART_MS,
  RESPONSE_TRANSFER_LIFETIME_MS,
  type ResponseTransferSignal,
} from '@/components/student/ResponseTransferEffect';

const results = [
  { label: 'One more example', value: 46, color: 'var(--pulse-steady)', dots: 18 },
  { label: 'Ready to continue', value: 39, color: 'var(--pulse-energized)', dots: 15 },
  { label: 'Please slow down', value: 15, color: 'var(--pulse-overwhelmed)', dots: 7 },
];

const atmosphere = [
  [7, 15, 6, 7.2], [14, 68, 8, 8.4], [22, 35, 5, 9.1], [29, 82, 7, 7.8], [38, 10, 5, 8.8],
  [43, 58, 9, 10.2], [51, 91, 6, 7.5], [59, 26, 7, 9.6], [66, 72, 5, 8.1], [73, 44, 8, 10.5],
  [79, 7, 6, 7.9], [84, 86, 5, 9.3], [90, 53, 7, 8.6], [95, 18, 5, 10.1], [11, 94, 6, 8.9],
];

type StagePhase = 'idle' | 'condensing' | 'traveling' | 'arrived' | 'settled';

export default function ClassroomStage() {
  const [phase, setPhase] = useState<StagePhase>('idle');
  const [responseCount, setResponseCount] = useState(100);
  const [transferSignal, setTransferSignal] = useState<ResponseTransferSignal | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const sendRef = useRef<HTMLButtonElement>(null);
  const transferGeometryRef = useRef<Pick<ResponseTransferSignal, 'x' | 'y' | 'width' | 'height' | 'canvasWidth' | 'canvasHeight'> | null>(null);
  const timersRef = useRef<number[]>([]);
  const hasPlayedRef = useRef(false);
  const isPlayingRef = useRef(false);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const playResponse = useCallback(() => {
    if (isPlayingRef.current) return;

    clearTimers();
    hasPlayedRef.current = true;
    isPlayingRef.current = true;
    setResponseCount(100);
    setPhase('condensing');

    const phone = phoneRef.current;
    const phoneBounds = phone?.getBoundingClientRect();
    const sourceBounds = sendRef.current?.getBoundingClientRect();
    const signalId = Date.now();
    const geometry = phone && phoneBounds && sourceBounds ? {
      x: sourceBounds.left + sourceBounds.width / 2 - phoneBounds.left - phone.clientLeft,
      y: sourceBounds.top + sourceBounds.height / 2 - phoneBounds.top - phone.clientTop,
      width: sourceBounds.width,
      height: sourceBounds.height,
      canvasWidth: phone.clientWidth,
      canvasHeight: phone.clientHeight,
    } : transferGeometryRef.current;
    if (geometry) {
      transferGeometryRef.current = geometry;
      setTransferSignal({
        id: signalId,
        color: '#5146e5',
        label: 'One more example',
        sourceLabel: 'Send response',
        ...geometry,
        phase: 'gathering',
      });
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setTransferSignal(null);
      setResponseCount(101);
      setPhase('settled');
      isPlayingRef.current = false;
      return;
    }

    timersRef.current.push(
      window.setTimeout(() => {
        setPhase('traveling');
        setTransferSignal((current) => current?.id === signalId ? { ...current, phase: 'departing' } : current);
      }, 620),
      window.setTimeout(() => {
        setPhase('arrived');
        setTransferSignal((current) => current?.id === signalId ? { ...current, phase: 'arrived' } : current);
      }, 620 + RESPONSE_TRANSFER_DEPART_MS),
      window.setTimeout(() => setResponseCount(101), 620 + RESPONSE_TRANSFER_DEPART_MS + 320),
      window.setTimeout(() => {
        setTransferSignal((current) => current?.id === signalId ? null : current);
        setPhase('settled');
        isPlayingRef.current = false;
      }, 620 + RESPONSE_TRANSFER_LIFETIME_MS),
    );
  }, [clearTimers]);

  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    const stage = stageRef.current;
    const desktop = window.matchMedia('(min-width: 821px)').matches;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!stage || !desktop || reduceMotion) return;

    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting || hasPlayedRef.current) return;

      hasPlayedRef.current = true;
      timersRef.current.push(window.setTimeout(playResponse, 650));
      observer.disconnect();
    }, { threshold: 0.55 });

    observer.observe(stage);
    return () => observer.disconnect();
  }, [playResponse]);

  const presenterHasReceived = responseCount > 100;
  const showReceivedState = phase === 'settled';
  const responseIsMoving = phase === 'condensing' || phase === 'traveling' || phase === 'arrived';

  return (
    <div
      ref={stageRef}
      className="classroom-stage"
      data-phase={phase}
      data-presenter-received={presenterHasReceived}
      aria-label="A student response moves from their phone to the classroom view and instructor console"
    >
      <p className="sr-only" aria-live="polite">
        {presenterHasReceived ? 'Response received. The class total is now 101.' : 'Ready to send a response.'}
      </p>

      <div className="stage-atmosphere" aria-hidden="true">
        {atmosphere.map(([x, y, size, duration], index) => (
          <i key={index} style={{ '--stage-x': `${x}%`, '--stage-y': `${y}%`, '--stage-size': `${size}px`, '--stage-duration': `${duration}s` } as CSSProperties} />
        ))}
      </div>

      <svg className="stage-presenter-connection" viewBox="0 0 1000 760" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="stage-presenter-thread-gradient" x1="1" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#5146e5" stopOpacity="0" />
            <stop offset="0.45" stopColor="#4fbfe5" stopOpacity="0.78" />
            <stop offset="1" stopColor="#387ce8" stopOpacity="0.12" />
          </linearGradient>
        </defs>
        <path pathLength="100" d="M 868 500 C 820 438, 665 392, 326 390" />
        <circle cx="326" cy="390" r="7" />
      </svg>

      <div className="stage-projector">
        <div className="stage-projector-header">
          <div><strong>ECON 302</strong><span>Platform strategy</span></div>
          <span className="stage-live"><i /> Live · 142 connected</span>
        </div>
        <div className="stage-projector-question">
          <span className="seminar-eyebrow">Pace check · <b className="stage-response-count">{responseCount}</b> responses</span>
          <h2 className="seminar-display">How is the pace right now?</h2>
        </div>
        <div className="stage-results">
          {results.map((result, row) => (
            <div key={result.label} className={`stage-result-row${row === 0 ? ' is-response-target' : ''}`}>
              <div><span>{result.label}</span><strong className="seminar-display">{result.value}%</strong></div>
              <div className="stage-dot-field" aria-hidden="true">
                {Array.from({ length: result.dots }).map((_, index) => (
                  <i key={index} style={{ backgroundColor: result.color, animationDelay: `${180 + row * 110 + index * 28}ms` }} />
                ))}
                {row === 0 && presenterHasReceived ? <i className="stage-new-response-dot" style={{ backgroundColor: result.color }} /> : null}
              </div>
            </div>
          ))}
        </div>
        <p className="stage-projector-foot">Class totals only · Responses stay open</p>
      </div>

      <div className="stage-console">
        <div className="stage-window-bar"><span /><span /><span /><small>Instructor console</small></div>
        <div className="stage-console-body">
          <div className="stage-console-now">
            <span className="seminar-eyebrow">Now</span>
            <strong>Pace check</strong>
            <small><b className="stage-response-count">{responseCount}</b> of 142 responded</small>
          </div>
          <div className="stage-console-signal"><Radio /><span><strong>15 students</strong> need more time</span></div>
          <div className="stage-console-signal"><MessageCircleQuestion /><span><strong>7 questions</strong> are waiting</span></div>
          <button tabIndex={-1}>Finish interaction <ChevronRight /></button>
        </div>
      </div>

      <div ref={phoneRef} className="stage-phone">
        <div className="stage-phone-surface">
          <div className="stage-phone-top"><span>Classfully</span><i /></div>
          <div className="stage-phone-content">
            <div className={`stage-phone-compose${showReceivedState ? '' : ' is-visible'}`} aria-hidden={showReceivedState}>
              <span className="seminar-eyebrow">Pace check</span>
              <strong className="seminar-display">How is the pace?</strong>
              <div className="stage-phone-choice"><span>A</span><b>One more example</b><CheckCircle /></div>
              <button ref={sendRef} className="stage-phone-send" type="button" onClick={playResponse} disabled={responseIsMoving || showReceivedState} tabIndex={showReceivedState ? -1 : 0}>
                <span>Send response</span><PaperPlaneTilt />
              </button>
            </div>
            <div className={`stage-phone-received${showReceivedState ? ' is-visible' : ''}`} aria-hidden={!showReceivedState}>
              <span className="seminar-eyebrow">Response sent</span>
              <strong className="seminar-display">See what the class is thinking.</strong>
              <div className="stage-phone-answer"><Radio /><span>Your answer</span><b>One more example</b></div>
              <div className="stage-phone-wait"><Users /><span><b>While the room responds</b><small>Upvote a question you want discussed.</small></span></div>
              <button type="button" className="stage-replay" onClick={playResponse} disabled={!showReceivedState} tabIndex={showReceivedState ? 0 : -1}>Replay response</button>
            </div>
          </div>
        </div>
        {transferSignal ? <ResponseTransferEffect signal={transferSignal} contained /> : null}
      </div>
    </div>
  );
}
