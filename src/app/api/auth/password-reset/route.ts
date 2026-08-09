import { NextRequest, NextResponse } from 'next/server';

const RESET_WINDOW_MS = 15 * 60 * 1000;
const RESET_LIMIT = 5;
const resetWindows = new Map<string, { count: number; resetAt: number }>();

function isValidEmail(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function clientKey(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'local';
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const current = resetWindows.get(key);

  if (!current || current.resetAt <= now) {
    resetWindows.set(key, { count: 1, resetAt: now + RESET_WINDOW_MS });
    return false;
  }

  current.count += 1;
  return current.count > RESET_LIMIT;
}

function firebaseErrorCode(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || !('error' in payload)) return '';
  const error = payload.error;
  if (!error || typeof error !== 'object' || !('message' in error)) return '';
  return typeof error.message === 'string' ? error.message.split(' : ')[0] : '';
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const email = body && typeof body === 'object' && 'email' in body
    ? String(body.email).trim().toLowerCase()
    : '';

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  if (isRateLimited(`${clientKey(request)}:${email}`)) {
    return NextResponse.json(
      { error: 'Too many reset requests. Wait a few minutes, then try again.' },
      { status: 429 },
    );
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Password recovery is temporarily unavailable. Please try again shortly.' },
      { status: 503 },
    );
  }

  try {
    const origin = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || 'https://classfully.com';
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Firebase-Locale': 'en',
          Referer: `${origin.replace(/\/$/, '')}/`,
        },
        body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }),
        cache: 'no-store',
      },
    );

    const payload: unknown = await response.json().catch(() => null);
    if (response.ok) {
      return NextResponse.json({ ok: true });
    }

    const code = firebaseErrorCode(payload);

    // Do not reveal whether an instructor account exists for this address.
    if (code === 'EMAIL_NOT_FOUND') {
      return NextResponse.json({ ok: true });
    }

    if (code === 'INVALID_EMAIL') {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }

    if (code === 'RESET_PASSWORD_EXCEED_LIMIT') {
      return NextResponse.json(
        { error: 'Too many reset requests. Wait a few minutes, then try again.' },
        { status: 429 },
      );
    }

    console.error('Firebase password reset request failed:', code || response.status);
    return NextResponse.json(
      { error: 'We could not send the reset email right now. Please try again shortly.' },
      { status: 503 },
    );
  } catch (error) {
    console.error('Password reset request failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'We could not reach the email service. Check your connection and try again.' },
      { status: 503 },
    );
  }
}
