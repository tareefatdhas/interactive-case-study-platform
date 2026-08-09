'use client';

import React from 'react';

type HapticTone = 'selection' | 'action' | 'success';

/* ─────────────────────────────────────────────────────────
 * PRESS STORYBOARD
 *
 *    0ms   finger lands, surface travels toward its base
 *    0ms   one light haptic confirms contact when supported
 *   90ms   release begins, surface returns to rest
 *  180ms   spring settles with no lingering movement
 * ───────────────────────────────────────────────────────── */

interface HapticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  hapticTone?: HapticTone;
  depth?: 'standard' | 'compact';
}

const VIBRATION: Record<HapticTone, number | number[]> = {
  selection: 8,
  action: 12,
  success: [10, 35, 16],
};

function vibrate(tone: HapticTone) {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  navigator.vibrate(VIBRATION[tone]);
}

const HapticButton = React.forwardRef<HTMLButtonElement, HapticButtonProps>(
  ({ className = '', depth = 'standard', hapticTone = 'selection', onPointerDown, children, ...props }, forwardedRef) => {
    return (
      <button
        {...props}
        ref={forwardedRef}
        className={`student-tactile is-${depth} ${className}`.trim()}
        onPointerDown={(event) => {
          if (!props.disabled) vibrate(hapticTone);
          onPointerDown?.(event);
        }}
      >
        {children}
      </button>
    );
  },
);

HapticButton.displayName = 'HapticButton';

export default HapticButton;
