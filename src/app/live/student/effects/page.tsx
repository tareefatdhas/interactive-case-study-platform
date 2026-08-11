'use client';

import { ArrowClockwise, Check, PaperPlaneTilt as Send } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import HapticButton from '@/components/student/HapticButton';
import { SharedMomentEffect, RESPONSE_TRANSFER_DEPART_MS, RESPONSE_TRANSFER_LIFETIME_MS, type ResponseTransferSignal } from '@/components/motion';
import { triggerStudentHaptic } from '@/lib/student-haptics';
import '../student.css';

export default function StudentEffectsPreview() {
  const [signal, setSignal] = useState<ResponseTransferSignal | null>(null);
  const timers = useRef<number[]>([]);
  const sourceRef = useRef<HTMLButtonElement | null>(null);

  const clearPreview = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    sourceRef.current?.classList.remove('student-response-source-hidden');
    sourceRef.current = null;
    setSignal(null);
  };

  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    sourceRef.current?.classList.remove('student-response-source-hidden');
  }, []);

  const play = (origin: HTMLButtonElement, outcome: 'sent' | 'failed', delay = 900) => {
    clearPreview();
    const bounds = origin.getBoundingClientRect();
    const id = Date.now();
    const next: ResponseTransferSignal = {
      id,
      color: '#5146e5',
      label: 'Steady',
      sourceLabel: origin.innerText.trim().replace(/\s+/g, ' '),
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
      width: bounds.width,
      height: bounds.height,
      phase: 'gathering',
    };
    setSignal(next);
    sourceRef.current = origin;
    window.requestAnimationFrame(() => origin.classList.add('student-response-source-hidden'));
    timers.current.push(window.setTimeout(() => {
      setSignal((current) => current?.id === id ? { ...current, phase: outcome === 'sent' ? 'departing' : 'failed' } : current);
      if (outcome === 'failed') triggerStudentHaptic('error');
      if (outcome === 'failed') timers.current.push(window.setTimeout(() => origin.classList.remove('student-response-source-hidden'), 180));
    }, delay));
    if (outcome === 'sent') {
      timers.current.push(window.setTimeout(() => {
        setSignal((current) => current?.id === id ? { ...current, phase: 'arrived' } : current);
        triggerStudentHaptic('success');
      }, delay + RESPONSE_TRANSFER_DEPART_MS));
    }
    timers.current.push(window.setTimeout(() => {
      setSignal((current) => current?.id === id ? null : current);
      origin.classList.remove('student-response-source-hidden');
      if (sourceRef.current === origin) sourceRef.current = null;
    }, delay + (outcome === 'sent' ? RESPONSE_TRANSFER_LIFETIME_MS : 720)));
  };

  return (
    <main className="student-effect-preview">
      <section className="student-effect-preview-phone">
        <header><span>Classfully.</span><small><i /> Connected</small></header>
        <div className="student-effect-preview-body">
          <div className="student-kicker">Pulse · Live now</div>
          <h1>How are you arriving today?</h1>
          <p>Choose one response.</p>
          <div className="student-effect-preview-choice"><span>B</span><strong>Steady</strong><Check size={18} /></div>
          <HapticButton type="button" className="student-send-response" hapticTone="action" onClick={(event) => play(event.currentTarget, 'sent')}>
            <span>Send answer B</span><Send size={18} />
          </HapticButton>
          <div className="student-effect-preview-tools">
            <button type="button" onClick={(event) => play(event.currentTarget, 'sent', 2300)}><ArrowClockwise size={15} /> Slow connection</button>
            <button type="button" onClick={(event) => play(event.currentTarget, 'failed', 900)}>Preview error</button>
          </div>
        </div>
        {signal && <SharedMomentEffect signal={signal} />}
      </section>
      <aside>
        <small>Motion preview</small>
        <h2>Response transfer</h2>
        <p>Press the main button to replay the successful send. The slow option makes the progress state easier to inspect.</p>
      </aside>
    </main>
  );
}
