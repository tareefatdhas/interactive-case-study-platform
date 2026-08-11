'use client';

import { ArrowClockwise, Check, PaperPlaneTilt as Send } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import HapticButton from '@/components/student/HapticButton';
import ResponseTransferEffect, { type ResponseTransferSignal } from '@/components/student/ResponseTransferEffect';
import '../student.css';

export default function StudentEffectsPreview() {
  const [signal, setSignal] = useState<ResponseTransferSignal | null>(null);
  const timers = useRef<number[]>([]);

  const clearPreview = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    setSignal(null);
  };

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  const play = (origin: HTMLButtonElement, outcome: 'sent' | 'failed', delay = 900) => {
    clearPreview();
    const bounds = origin.getBoundingClientRect();
    const id = Date.now();
    const next: ResponseTransferSignal = {
      id,
      color: '#5146e5',
      label: 'Steady',
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
      phase: 'gathering',
    };
    setSignal(next);
    timers.current.push(window.setTimeout(() => {
      setSignal((current) => current?.id === id ? { ...current, phase: outcome === 'sent' ? 'departing' : 'failed' } : current);
      if (navigator.vibrate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        navigator.vibrate(outcome === 'sent' ? [9, 30, 18] : [24, 44, 24]);
      }
    }, delay));
    timers.current.push(window.setTimeout(() => setSignal((current) => current?.id === id ? null : current), delay + (outcome === 'sent' ? 1400 : 720)));
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
        {signal && <ResponseTransferEffect signal={signal} />}
      </section>
      <aside>
        <small>Motion preview</small>
        <h2>Response transfer</h2>
        <p>Press the main button to replay the successful send. The slow option makes the progress state easier to inspect.</p>
      </aside>
    </main>
  );
}
