'use client';

import { Check, WarningCircle } from '@phosphor-icons/react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

export type ResponseTransferSignal = {
  id: number;
  color: string;
  label: string;
  sourceLabel?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  phase: 'gathering' | 'departing' | 'arrived' | 'failed';
};

export const RESPONSE_TRANSFER_DEPART_MS = 760;
export const RESPONSE_TRANSFER_LIFETIME_MS = 2040;

/**
 * Classfully's shared response-transfer effect.
 *
 * Keep the sequence intact when this is reused: the source control yields its
 * visible surface, the response condenses in place, the signal travels, and the
 * destination reacts on impact. The effect confirms a completed student action.
 * It should not be used as decoration for ordinary navigation.
 */
export default function ResponseTransferEffect({ signal, contained = false }: { signal: ResponseTransferSignal; contained?: boolean }) {
  const [progress, setProgress] = useState(signal.phase === 'arrived' ? 100 : 12);
  const effectRef = useRef<HTMLDivElement>(null);
  const turbulenceRef = useRef<SVGFETurbulenceElement>(null);
  const displacementRef = useRef<SVGFEDisplacementMapElement>(null);
  const rippleFilterId = `student-screen-ripple-${signal.id}`;
  const flightGradientId = `student-flight-gradient-${signal.id}`;
  const viewportWidth = contained
    ? Math.max(signal.canvasWidth ?? signal.x * 2, 240)
    : typeof window === 'undefined' ? Math.max(signal.x * 2, 390) : window.innerWidth;
  const viewportHeight = contained
    ? Math.max(signal.canvasHeight ?? signal.y + 80, 300)
    : typeof window === 'undefined' ? Math.max(signal.y + 120, 720) : window.innerHeight;
  const targetX = viewportWidth / 2;
  const targetY = contained ? 1 : 5;
  const direction = signal.x < targetX ? -1 : signal.x > targetX ? 1 : signal.id % 2 ? -1 : 1;
  const travel = Math.max(180, signal.y - targetY);
  const controlOneX = Math.max(30, Math.min(viewportWidth - 30, signal.x + direction * Math.min(64, viewportWidth * 0.12)));
  const controlOneY = signal.y - Math.min(138, travel * 0.3);
  const controlTwoX = targetX + direction * Math.min(84, viewportWidth * 0.17);
  const controlTwoY = targetY + Math.min(210, travel * 0.32);
  const flightPath = `M ${signal.x.toFixed(1)} ${signal.y.toFixed(1)} C ${controlOneX.toFixed(1)} ${controlOneY.toFixed(1)}, ${controlTwoX.toFixed(1)} ${controlTwoY.toFixed(1)}, ${targetX.toFixed(1)} ${targetY.toFixed(1)}`;

  useEffect(() => {
    if (signal.phase === 'arrived') {
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

  useEffect(() => {
    if (signal.phase !== 'arrived') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // A full-surface SVG displacement filter is visually effective on desktop,
    // but it forces mobile WebKit to repaint most of the student interface on
    // every frame. The mobile effect keeps the same color bloom and expanding
    // ripples in CSS, which Safari can composite without rerasterizing the page.
    if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) return;

    const root = contained
      ? effectRef.current?.parentElement
      : effectRef.current?.closest('.student-welcome-shell, .student-effect-preview-phone');
    if (!root || !displacementRef.current || !turbulenceRef.current) return;

    const surfaces = Array.from(root.querySelectorAll<HTMLElement>((contained ? [
      ':scope > .stage-phone-surface',
    ] : [
      ':scope > .student-welcome-header',
      ':scope > .student-welcome-content',
      ':scope > .student-welcome-footer',
      ':scope > header',
      ':scope > .student-effect-preview-body',
    ]).join(',')));
    if (!surfaces.length) return;

    const previous = surfaces.map((surface) => ({
      surface,
      filter: surface.style.filter,
      willChange: surface.style.willChange,
    }));
    surfaces.forEach((surface) => {
      surface.style.filter = `url(#${rippleFilterId})`;
      surface.style.willChange = 'filter';
    });

    let frame = 0;
    let startedAt = 0;
    let lastRenderedAt = 0;
    const duration = contained ? 920 : 1040;
    const renderRipple = (now: number) => {
      if (!startedAt) startedAt = now;
      if (contained && lastRenderedAt && now - lastRenderedAt < 31) {
        frame = window.requestAnimationFrame(renderRipple);
        return;
      }
      lastRenderedAt = now;
      const progress = Math.min(1, (now - startedAt) / duration);
      const envelope = Math.sin(progress * Math.PI) * Math.pow(1 - progress, 0.18);
      const displacement = (contained ? 7.2 : 23) * envelope;
      const horizontalFrequency = 0.006 + progress * 0.004;
      const verticalFrequency = 0.037 - progress * 0.015;

      displacementRef.current?.setAttribute('scale', displacement.toFixed(2));
      if (!contained) turbulenceRef.current?.setAttribute('baseFrequency', `${horizontalFrequency.toFixed(4)} ${verticalFrequency.toFixed(4)}`);

      if (progress < 1) frame = window.requestAnimationFrame(renderRipple);
      else previous.forEach(({ surface, filter, willChange }) => {
        surface.style.filter = filter;
        surface.style.willChange = willChange;
      });
    };
    frame = window.requestAnimationFrame(renderRipple);

    return () => {
      window.cancelAnimationFrame(frame);
      previous.forEach(({ surface, filter, willChange }) => {
        surface.style.filter = filter;
        surface.style.willChange = willChange;
      });
    };
  }, [contained, rippleFilterId, signal.phase]);

  const status = signal.phase === 'gathering'
    ? 'Sending to the class'
    : signal.phase === 'departing'
      ? 'Reaching the room'
      : signal.phase === 'arrived'
        ? 'Response joined the room'
        : 'Response did not send';

  return (
    <div
      ref={effectRef}
      className={`student-transport is-${signal.phase}${contained ? ' is-contained' : ''}`}
      style={{
        '--transport-color': signal.color,
        '--transport-x': `${signal.x}px`,
        '--transport-y': `${signal.y}px`,
        '--transport-start-width': `${Math.min(260, Math.max(112, signal.width ?? 196))}px`,
        '--transport-start-height': `${Math.min(72, Math.max(48, signal.height ?? 56))}px`,
        '--transport-progress': `${progress}`,
      } as CSSProperties}
      role="status"
      aria-live="polite"
      aria-label={status}
    >
      <svg className="student-ripple-filter-defs" aria-hidden="true">
        <defs>
          <filter id={rippleFilterId} x={contained ? '0%' : '-4%'} y={contained ? '0%' : '-4%'} width={contained ? '100%' : '108%'} height={contained ? '100%' : '108%'} colorInterpolationFilters="sRGB">
            <feTurbulence ref={turbulenceRef} type="fractalNoise" baseFrequency="0.007 0.032" numOctaves={contained ? 1 : 2} seed={signal.id % 97} result="surfaceNoise" />
            <feGaussianBlur in="surfaceNoise" stdDeviation={contained ? 0.22 : 0.38} result="softNoise" />
            <feDisplacementMap ref={displacementRef} in="SourceGraphic" in2="softNoise" scale="0" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      <svg
        className="student-flight-path"
        viewBox={`0 0 ${viewportWidth} ${viewportHeight}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={flightGradientId} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor={signal.color} stopOpacity="0" />
            <stop offset="0.32" stopColor={signal.color} stopOpacity="0.72" />
            <stop offset="0.7" stopColor="#4fbfe5" stopOpacity="0.92" />
            <stop offset="1" stopColor="#fff6bd" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path className="student-flight-path-glow" d={flightPath} pathLength="100" stroke={`url(#${flightGradientId})`} />
        <path className="student-flight-path-core" d={flightPath} pathLength="100" stroke={`url(#${flightGradientId})`} />
      </svg>
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
          <i>{signal.phase === 'arrived' ? <Check size={13} weight="bold" /> : signal.phase === 'failed' ? <WarningCircle size={13} weight="bold" /> : null}</i>
        </span>
        <span>{status}</span>
      </div>

      <div className="student-response-imprint" aria-hidden="true"><span>{signal.sourceLabel || signal.label}</span><i /></div>
      <div
        className="student-transport-orb"
        style={{ offsetPath: `path("${flightPath}")` }}
        aria-hidden="true"
      >
        <i className="student-transport-orb-shine" />
        <span>{signal.label}</span>
      </div>
      <i className="student-transport-origin" aria-hidden="true" />
      <div className="student-surface-spectrum" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="student-surface-ripple" aria-hidden="true"><i /><i /><i /></div>
      <div className="student-transport-ripple" aria-hidden="true"><i /><i /><i /></div>
    </div>
  );
}
