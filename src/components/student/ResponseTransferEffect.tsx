'use client';

import { Check, WarningCircle } from '@phosphor-icons/react';
import { useEffect, useState, type CSSProperties } from 'react';

export type ResponseTransferSignal = {
  id: number;
  color: string;
  label: string;
  x: number;
  y: number;
  phase: 'gathering' | 'departing' | 'failed';
};

export default function ResponseTransferEffect({ signal }: { signal: ResponseTransferSignal }) {
  const [progress, setProgress] = useState(signal.phase === 'departing' ? 100 : 12);

  useEffect(() => {
    if (signal.phase === 'departing') {
      setProgress(100);
      return;
    }
    if (signal.phase === 'failed') {
      setProgress(0);
      return;
    }

    setProgress(12);
    const interval = window.setInterval(() => {
      setProgress((current) => Math.min(84, current + Math.max(2, Math.round((84 - current) * 0.12))));
    }, 120);
    return () => window.clearInterval(interval);
  }, [signal.phase]);

  const status = signal.phase === 'gathering'
    ? 'Sending to the class'
    : signal.phase === 'departing'
      ? 'Response joined the room'
      : 'Response did not send';

  return (
    <div
      className={`student-transport is-${signal.phase}`}
      style={{
        '--transport-color': signal.color,
        '--transport-x': `${signal.x}px`,
        '--transport-y': `${signal.y}px`,
        '--transport-progress': `${progress}`,
      } as CSSProperties}
      role="status"
      aria-live="polite"
      aria-label={status}
    >
      <div className="student-transfer-edge" aria-hidden="true">
        <i className="student-transfer-edge-glow" />
        <i className="student-transfer-edge-wave" />
        <span /><span /><span /><span /><span />
      </div>

      <div className="student-transport-status">
        <span className="student-transfer-progress" aria-hidden="true">
          <svg viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="16" />
            <circle className="is-progress" cx="20" cy="20" r="16" pathLength="100" />
          </svg>
          <i>{signal.phase === 'departing' ? <Check size={13} weight="bold" /> : signal.phase === 'failed' ? <WarningCircle size={13} weight="bold" /> : null}</i>
        </span>
        <span>{status}</span>
      </div>

      <i className="student-transport-thread" aria-hidden="true" />
      <div className="student-transport-orb" aria-hidden="true">
        <i className="student-transport-orb-shine" />
        <span>{signal.label}</span>
      </div>
      <i className="student-transport-origin" aria-hidden="true" />
      <div className="student-transport-ripple" aria-hidden="true"><i /><i /><i /></div>
    </div>
  );
}
