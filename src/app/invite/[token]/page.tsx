'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { acceptTeachingTeamInvitation } from '@/lib/firebase/teaching-team';
import { signOutUser } from '@/lib/firebase/auth';
import { getUserFacingError } from '@/lib/user-facing-error';
import ClassfullyMark from '@/components/brand/ClassfullyMark';
import Button from '@/components/ui/Button';
import { CheckCircle2, GraduationCap, LogIn, UsersRound } from 'lucide-react';

export default function TeachingInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [courseId, setCourseId] = useState<string | undefined>();
  const [error, setError] = useState('');
  const invitationPath = `/invite/${token}`;

  const switchAccount = async () => {
    await signOutUser();
    router.replace(`/login?next=${encodeURIComponent(invitationPath)}`);
  };

  const accept = useCallback(async () => {
    setAccepting(true); setError('');
    try {
      const result = await acceptTeachingTeamInvitation(token);
      setCourseId(result.courseId);
      setAccepted(true);
    } catch (acceptError) { setError(getUserFacingError(acceptError, 'This invitation could not be accepted. Ask the course owner to send another.')); }
    finally { setAccepting(false); }
  }, [token]);

  useEffect(() => { if (!loading && user && !accepted && !accepting && !error) void accept(); }, [accept, accepted, accepting, error, loading, user]);

  return <main className="grid min-h-screen place-items-center bg-[#f4f3f8] p-5"><section className="w-full max-w-xl overflow-hidden rounded-[28px] border border-[#e3e5ed] bg-[#fffefa] shadow-[0_28px_80px_rgba(16,26,56,0.14)]"><header className="flex items-center border-b border-[#e3e5ed] px-7 py-5"><Link href="/" className="classfully-lockup text-xl"><ClassfullyMark className="classfully-mark" /><span className="classfully-wordmark">Classfully</span></Link></header><div className="p-7 sm:p-10"><span className="relative flex h-14 w-20 items-center" aria-hidden="true"><span className="absolute left-0 grid h-13 w-13 place-items-center rounded-full border-2 border-[#fffefa] bg-[#e9e7ff] text-[#5146e5]"><GraduationCap className="h-6 w-6" /></span><span className="absolute right-0 grid h-13 w-13 place-items-center rounded-full border-2 border-[#fffefa] bg-[#eaf7ef] text-[#2f7b49]"><UsersRound className="h-6 w-6" /></span></span>{accepted ? <><p className="seminar-eyebrow mb-2 mt-7">Invitation accepted</p><h1 className="seminar-display text-4xl text-[#101a38]">You are on the teaching team.</h1><p className="mt-4 text-base leading-7 text-[#697087]">The shared course and student progress are now available through your own instructor account.</p><Button onClick={() => router.push(courseId ? `/dashboard/classes/${courseId}` : '/dashboard/classes')} className="mt-7 gap-2"><CheckCircle2 className="h-4 w-4" /> Open Classfully</Button></> : !user && !loading ? <><p className="seminar-eyebrow mb-2 mt-7">Shared teaching</p><h1 className="seminar-display text-4xl text-[#101a38]">Join the teaching team.</h1><p className="mt-4 text-base leading-7 text-[#697087]">Sign in with the email address that received this invitation. If you are new to Classfully, create your instructor account with that same email.</p><div className="mt-7 flex flex-wrap gap-3"><Link href={`/login?next=${encodeURIComponent(invitationPath)}`}><Button className="gap-2"><LogIn className="h-4 w-4" /> Sign in</Button></Link><Link href={`/signup?next=${encodeURIComponent(invitationPath)}`}><Button variant="outline">Create account</Button></Link></div></> : <><p className="seminar-eyebrow mb-2 mt-7">Teaching team</p><h1 className="seminar-display text-4xl text-[#101a38]">Opening your invitation…</h1>{error ? <><p role="alert" className="mt-5 rounded-xl border border-[#efc8bf] bg-[#fff6f2] p-4 text-sm leading-6 text-[#a44534]">{error}</p><div className="mt-5 flex flex-wrap gap-3"><Button variant="outline" onClick={accept} loading={accepting}>Try again</Button><Button variant="ghost" onClick={switchAccount}>Use another account</Button></div></> : <p className="mt-4 text-base leading-7 text-[#697087]">We are connecting this course to your instructor account.</p>}</>}</div></section></main>;
}
