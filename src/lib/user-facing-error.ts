type ErrorLike = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
};

const technicalMessagePatterns = [
  /firebase/i,
  /auth\//i,
  /permission[_ -]?denied/i,
  /access denied/i,
  /missing or insufficient permissions/i,
  /^failed to/i,
  /api (request failed|returned)/i,
  /api[_ -]?key|gemini|firestore|realtime database/i,
  /unknown error/i,
  /failed to fetch/i,
  /networkerror/i,
  /unexpected token/i,
  /json/i,
  /status\s?\d{3}/i,
  /internal server error/i,
  /^internal$/i,
];

const extractError = (error: unknown): { code: string; message: string } => {
  if (!error || typeof error !== 'object') {
    return { code: '', message: typeof error === 'string' ? error : '' };
  }

  const candidate = error as ErrorLike;
  const code = typeof candidate.code === 'string' ? candidate.code.toLowerCase() : '';
  const message = typeof candidate.message === 'string' ? candidate.message.trim() : '';
  return { code, message };
};

const messageForCode = (code: string): string | null => {
  if (!code) return null;

  if (['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'].includes(code)) {
    return 'That email and password do not match. Try again or reset your password.';
  }
  if (code === 'auth/invalid-email') return 'Check the email address and try again.';
  if (code === 'auth/email-already-in-use') return 'An account already uses this email. Sign in instead, or reset the password.';
  if (code === 'auth/weak-password') return 'Choose a password with at least 6 characters.';
  if (code === 'auth/too-many-requests' || code === 'resource-exhausted') {
    return 'There have been several attempts. Wait a moment, then try again.';
  }
  if (code === 'auth/network-request-failed' || code === 'unavailable' || code === 'deadline-exceeded') {
    return 'Classfully cannot connect right now. Check your connection and try again.';
  }
  if (code === 'permission-denied') {
    return 'You do not have access to make this change. Sign in again, then try once more.';
  }
  if (code === 'not-found') return 'We could not find that item. It may have been moved or deleted.';
  if (code === 'already-exists') return 'That item already exists. Try a different name or code.';
  if (code === 'functions/resource-exhausted') return 'Your current plan has reached its limit. Review your plan in Settings to continue.';
  if (code === 'functions/failed-precondition') return 'This part of billing is not ready yet. Your existing work is safe.';
  if (code === 'functions/unauthenticated') return 'Your sign-in has expired. Sign in again to continue.';
  if (code === 'functions/internal') return 'This part of Classfully is not available yet. Refresh in a moment and try again.';
  if (code === 'functions/permission-denied') return 'You do not have access to make this change.';
  if (code === 'functions/already-exists') return 'That item already exists. Try a different name or code.';
  if (code === 'unauthenticated') return 'Your sign-in has expired. Sign in again to continue.';
  return null;
};

export const getUserFacingError = (
  error: unknown,
  fallback = 'Something did not work. Try again.',
): string => {
  const { code, message } = extractError(error);
  const mappedMessage = messageForCode(code);
  if (mappedMessage) return mappedMessage;

  if (message && !technicalMessagePatterns.some((pattern) => pattern.test(message))) {
    return message;
  }

  if (/invalid-credential|wrong-password|user-not-found/i.test(message)) {
    return 'That email and password do not match. Try again or reset your password.';
  }
  if (/permission|access denied/i.test(message)) {
    return 'You do not have access to make this change. Sign in again, then try once more.';
  }
  if (/network|offline|unavailable|timeout|timed out/i.test(message)) {
    return 'Classfully cannot connect right now. Check your connection and try again.';
  }

  return fallback;
};
