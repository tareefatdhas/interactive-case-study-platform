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
let safariHapticSwitch: HTMLInputElement | null = null;

function isAppleTouchBrowser() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function getSafariHapticSwitch() {
  if (!isAppleTouchBrowser() || typeof document === 'undefined') return null;
  if (safariHapticSwitch?.isConnected) return safariHapticSwitch;

  const control = document.createElement('input');
  control.type = 'checkbox';
  control.setAttribute('switch', '');
  control.setAttribute('aria-hidden', 'true');
  control.tabIndex = -1;

  // Safari 18 provides a native tap when its switch control changes. Keep the
  // control rendered, but outside the visible and accessible interface. Using
  // display:none prevents WebKit from producing the native tactile response.
  Object.assign(control.style, {
    position: 'fixed',
    left: '-100px',
    bottom: '0',
    width: '1px',
    height: '1px',
    margin: '0',
    opacity: '0.001',
    pointerEvents: 'none',
  });
  document.body.appendChild(control);
  safariHapticSwitch = control;
  return control;
}

function getHaptics() {
  if (typeof window === 'undefined') return null;
  haptics ??= new WebHaptics({ debug: false, showSwitch: false });
  return haptics;
}

export function triggerStudentHaptic(tone: StudentHapticTone) {
  if (typeof window === 'undefined') return;

  // Reduced motion changes what moves on screen. It should not remove tactile
  // confirmation, which is especially useful when motion has been minimized.
  if (typeof navigator.vibrate !== 'function') {
    const control = getSafariHapticSwitch();
    if (control) {
      control.click();
      return;
    }
  }

  void getHaptics()?.trigger(CLASSFULLY_HAPTICS[tone]).catch(() => {
    // Haptics are an enhancement. A response must never fail because vibration is unavailable.
  });
}

export function cancelStudentHaptic() {
  haptics?.cancel();
}
