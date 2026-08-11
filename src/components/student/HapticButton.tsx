'use client';

import React from 'react';
import { triggerStudentHaptic, type StudentHapticTone } from '@/lib/student-haptics';

type HapticTone = Exclude<StudentHapticTone, 'error'>;

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

const HapticButton = React.forwardRef<HTMLButtonElement, HapticButtonProps>(
  ({ className = '', depth = 'standard', hapticTone = 'selection', onPointerDown, children, ...props }, forwardedRef) => {
    return (
      <button
        {...props}
        ref={forwardedRef}
        className={`student-tactile is-${depth} ${className}`.trim()}
        onPointerDown={(event) => {
          if (!props.disabled) triggerStudentHaptic(hapticTone);
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
