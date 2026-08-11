'use client';

import { WebHaptics, type HapticInput } from 'web-haptics';

export type StudentHapticTone = 'selection' | 'action' | 'success' | 'error';

const CLASSFULLY_HAPTICS: Record<StudentHapticTone, HapticInput> = {
  selection: 'selection',
  action: [
    { duration: 18, intensity: 0.55 },
    { delay: 34, duration: 9, intensity: 0.3 },
  ],
  success: [
    { duration: 18, intensity: 0.45 },
    { delay: 34, duration: 28, intensity: 0.78 },
    { delay: 46, duration: 15, intensity: 0.42 },
  ],
  error: 'error',
};

let haptics: WebHaptics | null = null;

function getHaptics() {
  if (typeof window === 'undefined') return null;
  haptics ??= new WebHaptics({ debug: false, showSwitch: false });
  return haptics;
}

export function triggerStudentHaptic(tone: StudentHapticTone) {
  if (typeof window === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  void getHaptics()?.trigger(CLASSFULLY_HAPTICS[tone]).catch(() => {
    // Haptics are an enhancement. A response must never fail because vibration is unavailable.
  });
}

export function cancelStudentHaptic() {
  haptics?.cancel();
}
