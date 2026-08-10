'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSessionByCodeStudent } from '@/lib/firebase/student-firestore';
import { ensureStudentAnonymousAuth } from '@/lib/firebase/student-config';
import {
  claimStudentAttendance,
  getLiveClassroomByCode,
  normalizeStudentDisplayName,
  normalizeStudentNumber,
} from '@/lib/firebase/live-classroom';
import { STUDENT_PRIVACY_NOTICE_VERSION } from '@/lib/privacy';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ClassfullyBrand from '@/components/marketing/ClassfullyBrand';
import { getUserFacingError } from '@/lib/user-facing-error';
import { ArrowRight, CheckCircle2, EyeOff, Smartphone, UserRound, Users } from 'lucide-react';

const REMEMBERED_STUDENT_KEY = 'classfully-remembered-student';

type RememberedStudent = {
  studentNumber: string;
  studentDisplayName?: string;
  privacyNoticeVersion: string;
  rememberedAt: number;
};

function maskStudentNumber(studentNumber: string) {
  if (studentNumber.length <= 4) return studentNumber;
  return `${'•'.repeat(Math.min(4, studentNumber.length - 4))}${studentNumber.slice(-4)}`;
}

function formatJoinCode(sessionCode: string) {
  return sessionCode.length > 3 ? `${sessionCode.slice(0, 3)} ${sessionCode.slice(3)}` : sessionCode;
}

export default function JoinPage() {
  const router = useRouter();
  const [sessionCode, setSessionCode] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [studentDisplayName, setStudentDisplayName] = useState('');
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [rememberOnDevice, setRememberOnDevice] = useState(true);
  const [rememberedStudentNumber, setRememberedStudentNumber] = useState('');
  const [codeFromLink, setCodeFromLink] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const codeInputRef = useRef<HTMLInputElement>(null);
  const studentNumberInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    const normalizedCode = code?.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6) || '';
    if (normalizedCode) {
      setSessionCode(normalizedCode);
      setCodeFromLink(normalizedCode.length === 6);
    }

    try {
      const stored = window.localStorage.getItem(REMEMBERED_STUDENT_KEY);
      if (stored) {
        const remembered = JSON.parse(stored) as Partial<RememberedStudent>;
        const normalizedStudentNumber = normalizeStudentNumber(remembered.studentNumber || '');
        if (normalizedStudentNumber.length >= 3) {
          setStudentNumber(normalizedStudentNumber);
          setStudentDisplayName(normalizeStudentDisplayName(remembered.studentDisplayName || ''));
          setRememberedStudentNumber(normalizedStudentNumber);
          setPrivacyAcknowledged(remembered.privacyNoticeVersion === STUDENT_PRIVACY_NOTICE_VERSION);
        }
      }
    } catch {
      window.localStorage.removeItem(REMEMBERED_STUDENT_KEY);
    }

    window.requestAnimationFrame(() => {
      if (normalizedCode) studentNumberInputRef.current?.focus();
      else codeInputRef.current?.focus();
    });
  }, []);

  const saveRememberedStudent = (normalizedStudentNumber: string, normalizedDisplayName: string) => {
    if (!rememberOnDevice) {
      window.localStorage.removeItem(REMEMBERED_STUDENT_KEY);
      return;
    }
    const remembered: RememberedStudent = {
      studentNumber: normalizedStudentNumber,
      ...(normalizedDisplayName ? { studentDisplayName: normalizedDisplayName } : {}),
      privacyNoticeVersion: STUDENT_PRIVACY_NOTICE_VERSION,
      rememberedAt: Date.now(),
    };
    window.localStorage.setItem(REMEMBERED_STUDENT_KEY, JSON.stringify(remembered));
    setRememberedStudentNumber(normalizedStudentNumber);
  };

  const forgetRememberedStudent = () => {
    window.localStorage.removeItem(REMEMBERED_STUDENT_KEY);
    setRememberedStudentNumber('');
    setStudentNumber('');
    setStudentDisplayName('');
    setPrivacyAcknowledged(false);
    setRememberOnDevice(false);
    window.requestAnimationFrame(() => studentNumberInputRef.current?.focus());
  };

  const handleJoinSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionCode.trim() || normalizeStudentNumber(studentNumber).length < 3 || !privacyAcknowledged) {
      setError('Enter your class code and student number, then review the privacy notice.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await ensureStudentAnonymousAuth();
      const normalizedCode = sessionCode.replace(/[^a-z0-9]/gi, '').toUpperCase();
      const normalizedStudentNumber = normalizeStudentNumber(studentNumber);
      const normalizedDisplayName = normalizeStudentDisplayName(studentDisplayName);
      const liveClassroom = await getLiveClassroomByCode(normalizedCode);
      if (liveClassroom) {
        await claimStudentAttendance(liveClassroom.ownerUid, liveClassroom.sessionId, normalizedStudentNumber, normalizedDisplayName);
        saveRememberedStudent(normalizedStudentNumber, normalizedDisplayName);
        router.push(`/live/student?sessionId=${encodeURIComponent(liveClassroom.sessionId)}&ownerUid=${encodeURIComponent(liveClassroom.ownerUid)}`);
        return;
      }
      const session = await getSessionByCodeStudent(normalizedCode);
      
      if (!session) {
        throw new Error('We could not find that class. Check the code on the projector and try again.');
      }

      if (!session.active) {
        throw new Error('This class session has ended. Ask your instructor for the current code.');
      }

      saveRememberedStudent(normalizedStudentNumber, normalizedDisplayName);
      window.sessionStorage.setItem('living-seminar-pending-student-number', normalizedStudentNumber);
      window.sessionStorage.setItem('classfully-pending-student-display-name', normalizedDisplayName);
      router.push(`/session/${session.sessionCode}`);
    } catch (joinError: unknown) {
      setError(getUserFacingError(joinError, 'We could not join the class. Check the code and try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fffefa]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <ClassfullyBrand className="text-xl sm:text-2xl" />
        <Link href="/login" className="seminar-focus inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-semibold text-[#697087] hover:text-[#101a38]">Instructor sign in</Link>
      </header>

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(380px,0.7fr)] lg:pt-20">
        <section className="order-2 lg:order-1">
          <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-xl bg-[#f0efff] text-[#5146e5]">
            <Users className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="seminar-eyebrow mb-4">Student access</p>
          <h1 className="seminar-display max-w-xl text-5xl leading-[1.02] text-[#101a38] sm:text-6xl">Join the class.</h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-[#697087]">Enter the six-character code on the projector. You can take part from this device throughout the lesson.</p>

          <div className="mt-10 grid max-w-xl gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#e3e5ed] bg-white p-5">
              <Smartphone className="h-5 w-5 text-[#2f73df]" aria-hidden="true" />
              <p className="mt-4 text-sm font-semibold text-[#101a38]">Keep this page open</p>
              <p className="mt-1 text-sm leading-6 text-[#697087]">The next question will appear here when your instructor starts it.</p>
            </div>
            <div className="rounded-2xl border border-[#e3e5ed] bg-white p-5">
              <EyeOff className="h-5 w-5 text-[#7057e8]" aria-hidden="true" />
              <p className="mt-4 text-sm font-semibold text-[#101a38]">Your screen stays yours</p>
              <p className="mt-1 text-sm leading-6 text-[#697087]">The projector shows the class pattern, not your individual response.</p>
            </div>
          </div>
        </section>

        <section className="order-1 rounded-[24px] border border-[#e3e5ed] bg-white p-6 shadow-[0_24px_70px_rgba(16,26,56,0.08)] sm:p-8 lg:order-2" aria-labelledby="join-form-title">
            <h2 id="join-form-title" className="seminar-display text-3xl text-[#101a38]">{codeFromLink ? 'You found the class' : 'Join this class'}</h2>
            <p className="mt-2 text-sm leading-6 text-[#697087]">{codeFromLink ? 'Confirm your student number to join and record attendance.' : 'Use the code on the projector, then identify yourself for attendance.'}</p>
            <form onSubmit={handleJoinSession} className="space-y-6">
              <div className="mt-6 space-y-4">
                {codeFromLink ? (
                  <div className="flex min-h-14 items-center gap-3 rounded-xl border border-[#cde7d4] bg-[#f2fbf4] px-4 py-3 text-[#287044]">
                    <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-[0.08em]">Class code added</p><strong className="font-mono text-base tracking-[0.16em] text-[#174d2c]">{formatJoinCode(sessionCode)}</strong></div>
                    <button type="button" onClick={() => {
                      setCodeFromLink(false);
                      window.requestAnimationFrame(() => codeInputRef.current?.focus());
                    }} className="min-h-11 rounded-lg px-2 text-sm font-semibold underline-offset-4 hover:underline">Edit</button>
                  </div>
                ) : (
                  <Input
                    label="Class code"
                    ref={codeInputRef}
                    value={sessionCode}
                    onChange={(e) => setSessionCode(e.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase())}
                    placeholder="ABC123"
                    maxLength={6}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    className="h-14 text-center font-mono text-xl font-semibold tracking-[0.3em]"
                    required
                  />
                )}

                <div>
                  <Input
                    label="Student number"
                    ref={studentNumberInputRef}
                    value={studentNumber}
                    onChange={(e) => setStudentNumber(normalizeStudentNumber(e.target.value))}
                    placeholder="66123456"
                    maxLength={32}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="username"
                    className="h-14 text-lg font-semibold tracking-[0.04em]"
                    required
                  />
                  <p className="mt-2 text-xs leading-5 text-[#697087]">Used for attendance and course progress. It is never shown to classmates.</p>
                </div>

                <div>
                  <Input
                    label="Preferred name (optional)"
                    value={studentDisplayName}
                    onChange={(e) => setStudentDisplayName(e.target.value.slice(0, 60))}
                    placeholder="What your instructor should call you"
                    maxLength={60}
                    autoComplete="name"
                    className="h-14 text-base font-semibold"
                  />
                  <p className="mt-2 text-xs leading-5 text-[#697087]">Shown only to you and your instructor. Class standings still use a private alias.</p>
                </div>

                {rememberedStudentNumber && (
                  <div className="flex items-center gap-3 rounded-xl border border-[#dcd8ff] bg-[#f7f5ff] p-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#5146e5]"><UserRound className="h-5 w-5" aria-hidden="true" /></span>
                    <div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#7057e8]">Welcome back</p><p className="mt-0.5 text-sm font-semibold text-[#101a38]">{studentDisplayName || 'Student'} · {maskStudentNumber(rememberedStudentNumber)}</p></div>
                    <button type="button" onClick={forgetRememberedStudent} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-[#5146e5] underline-offset-4 hover:underline">Not you?</button>
                  </div>
                )}

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#e3e5ed] p-3.5 text-sm leading-6 text-[#555d73]">
                  <input
                    type="checkbox"
                    checked={rememberOnDevice}
                    onChange={(event) => setRememberOnDevice(event.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#5146e5]"
                  />
                  <span><strong className="font-semibold text-[#313950]">Remember me on this device.</strong> Use this only on your own phone or computer.</span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#e3e5ed] bg-[#fbfbfd] p-4 text-sm leading-6 text-[#555d73]">
                  <input
                    type="checkbox"
                    checked={privacyAcknowledged}
                    onChange={(event) => setPrivacyAcknowledged(event.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#5146e5]"
                    required
                  />
                  <span>I have read how my student number, optional preferred name, and class responses are used. <Link className="font-semibold text-[#5146e5] underline underline-offset-2" href={`/privacy?version=${STUDENT_PRIVACY_NOTICE_VERSION}`} target="_blank">Read the student privacy notice</Link>.</span>
                </label>

                {error && (
                  <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
                    {error}
                  </div>
                )}

                <div>
                  <Button type="submit" loading={loading} className="flex w-full items-center justify-center">
                    Join class
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </form>

            <div className="mt-6 border-t border-[#e3e5ed] pt-5">
              <p className="text-sm leading-6 text-[#697087]">If you scanned the classroom QR code, the code should already be filled in. If it is not, ask your instructor for the current code.</p>
            </div>
        </section>
      </div>
    </main>
  );
}
