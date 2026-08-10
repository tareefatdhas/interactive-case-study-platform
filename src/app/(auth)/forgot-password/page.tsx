'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MailCheck } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import SeminarAuthShell from '@/components/ui/SeminarAuthShell';
import InlineMessage from '@/components/ui/InlineMessage';
import { getUserFacingError } from '@/lib/user-facing-error';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'We could not send the reset email.');
      setSent(true);
    } catch (resetError: unknown) {
      setError(getUserFacingError(resetError, 'We could not send the reset email. Try again in a moment.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SeminarAuthShell
      eyebrow="Account recovery"
      title="Reset your password."
      description="We will email you a secure link so you can get back to preparing your class."
    >
      <div className="rounded-2xl border border-[#e3e5ed] bg-white p-6 shadow-[0_18px_50px_rgba(16,26,56,0.06)] sm:p-7">
        {sent ? (
          <div role="status" className="text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#eef8f0] text-[#2f7f47]">
              <MailCheck className="h-6 w-6" />
            </span>
            <h2 className="seminar-display mt-5 text-2xl text-[#101a38]">Check your inbox.</h2>
            <p className="mt-3 text-sm leading-6 text-[#697087]">
              If an instructor account uses <strong className="font-semibold text-[#313950]">{email}</strong>, a reset link is on its way.
            </p>
            <p className="mt-2 text-xs leading-5 text-[#697087]">It may take a minute. Check your spam folder if it does not arrive.</p>
            <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#5146e5] hover:text-[#4137c7]">
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Instructor email"
                type="email"
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                inputMode="email"
                placeholder="you@university.edu"
              />

              {error && <InlineMessage title="The email is still waiting." message={error} />}

              <Button type="submit" loading={loading} className="w-full">Send reset link</Button>
            </form>

            <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#697087] hover:text-[#313950]">
              <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
          </>
        )}
      </div>
    </SeminarAuthShell>
  );
}
