import type { NextRequest } from 'next/server';

type IdentityToolkitUser = {
  localId: string;
  email?: string;
  providerUserInfo?: Array<{ providerId?: string }>;
};

export class FirebaseRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'FirebaseRequestError';
  }
}

const requestWindows = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string, limit: number) {
  const now = Date.now();
  const current = requestWindows.get(userId);
  if (!current || current.resetAt <= now) {
    requestWindows.set(userId, { count: 1, resetAt: now + 60_000 });
    return;
  }
  if (current.count >= limit) {
    throw new FirebaseRequestError('Too many requests. Wait a minute and try again.', 429);
  }
  current.count += 1;
}

export async function requireFirebaseUser(
  request: NextRequest | Request,
  options: { allowAnonymous?: boolean; requestsPerMinute?: number } = {},
) {
  const authorization = request.headers.get('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) throw new FirebaseRequestError('Sign in before using this feature.', 401);

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new FirebaseRequestError('Firebase authentication is not configured.', 503);

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token }),
    cache: 'no-store',
  });

  if (!response.ok) throw new FirebaseRequestError('Your sign-in expired. Sign in again and retry.', 401);
  const payload = await response.json() as { users?: IdentityToolkitUser[] };
  const user = payload.users?.[0];
  if (!user?.localId) throw new FirebaseRequestError('Your sign-in could not be verified.', 401);

  const anonymous = !user.email && !(user.providerUserInfo || []).some((provider) => provider.providerId && provider.providerId !== 'anonymous');
  if (anonymous && !options.allowAnonymous) {
    throw new FirebaseRequestError('An instructor account is required for this feature.', 403);
  }

  checkRateLimit(user.localId, options.requestsPerMinute || 10);
  return { uid: user.localId, email: user.email || null, anonymous };
}

export function firebaseRequestError(error: unknown) {
  if (error instanceof FirebaseRequestError) {
    return { error: error.message, status: error.status };
  }
  return null;
}
