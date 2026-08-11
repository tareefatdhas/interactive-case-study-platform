'use client';

import type { CSSProperties, ReactNode } from 'react';
import ResponseTransferEffect, {
  RESPONSE_TRANSFER_DEPART_MS,
  RESPONSE_TRANSFER_LIFETIME_MS,
  type ResponseTransferSignal,
} from '@/components/student/ResponseTransferEffect';
import styles from './ClassfullyMotion.module.css';

export type MotionTone = 'violet' | 'blue' | 'green' | 'amber';

type MotionStatusProps = {
  /** Short status announced to assistive technology. */
  label?: string;
  /** Polite by default. Use `off` when a nearby control already announces the same update. */
  announce?: 'polite' | 'off';
  className?: string;
};

type AmbientLoadingProps = MotionStatusProps & {
  tone?: MotionTone;
  size?: 'compact' | 'regular';
};

/**
 * Level 1: quiet, continuous feedback for loading and background syncing.
 * This is intentionally an edge shimmer, not the full shared-moment ripple.
 */
export function AmbientLoading({
  label = 'Loading',
  announce = 'polite',
  className,
  tone = 'violet',
  size = 'regular',
}: AmbientLoadingProps) {
  return (
    <div
      className={[styles.ambient, styles[`tone-${tone}`], styles[`size-${size}`], className].filter(Boolean).join(' ')}
      role={announce === 'polite' ? 'status' : undefined}
      aria-live={announce}
      aria-label={announce === 'polite' ? label : undefined}
    >
      <span className={styles.ambientTrack} aria-hidden="true">
        <i className={styles.ambientGlow} />
        <i className={styles.ambientCore} />
      </span>
    </div>
  );
}

type ConfirmationRippleProps = MotionStatusProps & {
  tone?: MotionTone;
  /** A changing value restarts the animation when the component remains mounted. */
  eventKey?: string | number;
  /** Ripple origin as percentages of the component bounds. */
  origin?: { x: number; y: number };
  children?: ReactNode;
};

/**
 * Level 2: one restrained ripple for a completed save, join, or update.
 * Mount it, or change `eventKey`, only after the action succeeds.
 */
export function ConfirmationRipple({
  label = 'Saved',
  announce = 'polite',
  className,
  tone = 'green',
  eventKey = 'confirmation',
  origin = { x: 50, y: 50 },
  children,
}: ConfirmationRippleProps) {
  const safeX = Math.min(100, Math.max(0, origin.x));
  const safeY = Math.min(100, Math.max(0, origin.y));

  return (
    <div
      className={[styles.confirmation, styles[`tone-${tone}`], className].filter(Boolean).join(' ')}
      style={{ '--motion-origin-x': `${safeX}%`, '--motion-origin-y': `${safeY}%` } as CSSProperties}
    >
      {children}
      <span className={styles.confirmationVisual} key={eventKey} aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {announce === 'polite' ? (
        <span className={styles.visuallyHidden} role="status" aria-live="polite" key={`status-${eventKey}`}>
          {label}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Level 3: Classfully's signature shared-moment effect.
 * Reserve it for contributions crossing from a person or team into the room.
 */
export function SharedMomentEffect({
  signal,
  contained = false,
}: {
  signal: ResponseTransferSignal;
  contained?: boolean;
}) {
  return <ResponseTransferEffect signal={signal} contained={contained} />;
}

export {
  RESPONSE_TRANSFER_DEPART_MS,
  RESPONSE_TRANSFER_LIFETIME_MS,
  type ResponseTransferSignal,
};
