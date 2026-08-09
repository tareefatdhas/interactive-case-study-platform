import Link from 'next/link';
import { Database, Eye, FileText, Lock, Scale, ShieldCheck, Trash2 } from 'lucide-react';
import MarketingPage from '@/components/marketing/MarketingPage';
import { STUDENT_PRIVACY_NOTICE_VERSION } from '@/lib/privacy';
import { CLASSFULLY_CONTACT, CLASSFULLY_OPERATOR } from '@/lib/legal';
import { createPageMetadata } from '@/lib/metadata';

export const metadata = createPageMetadata({
  title: 'Student privacy notice',
  description: 'A clear guide to what Classfully records during class, who can see it, how it is used, and the choices students have.',
  path: '/privacy',
});

const sections = [
  {
    icon: Database,
    title: 'Information used in class',
    content: 'The class may record your student number, optional preferred name, attendance status, response choices, short written responses, question votes, points, and the time you participated. A temporary device identifier keeps one response per activity.',
  },
  {
    icon: Eye,
    title: 'Who can see it',
    content: 'Classmates and the projector see class totals and responses the instructor deliberately shares. Your instructor can access attendance, your optional preferred name, and individual records. Student numbers and preferred names are never shown to classmates.',
  },
  {
    icon: ShieldCheck,
    title: 'Optional Class Pulse prompts',
    content: 'Personal pulse questions are optional. You can choose “Prefer not to say” or wait without answering. They should be used to adjust teaching, never for grades, rewards, discipline, or public rankings.',
  },
  {
    icon: FileText,
    title: 'AI question drafting',
    content: 'Only lesson material supplied by an instructor is sent to the configured AI service to draft class questions. Student attendance, responses, personal pulse answers, and reward records are not included in that request.',
  },
  {
    icon: Trash2,
    title: 'Retention and deletion',
    content: 'Classfully runs a daily cleanup that removes live classroom data 90 days after its last recorded update. Instructors can delete a session and its live attendance, response, vote, and presence data sooner. Reward requests follow the course retention period set by your university or instructor.',
  },
  {
    icon: Scale,
    title: 'Your choices and rights',
    content: 'Contact your instructor or university privacy contact to request access, correction, deletion, restriction, objection, or a portable copy. You can also stop answering optional personal pulse questions without losing access to ordinary class activities.',
  },
];

export default function PrivacyPage() {
  return (
    <MarketingPage>
      <article className="mx-auto max-w-5xl px-5 py-14 text-[#101a38] sm:px-8 sm:py-20">
        <div className="max-w-3xl">
          <p className="seminar-eyebrow mb-4">Student privacy notice · Version {STUDENT_PRIVACY_NOTICE_VERSION}</p>
          <h1 className="seminar-display text-5xl leading-[1.02] sm:text-6xl">What the classroom records.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#697087]">Your instructor or institution normally decides why classroom information is used. Classfully, operated by {CLASSFULLY_OPERATOR}, processes it to run the class, record attendance, and preserve course progress.</p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {sections.map(({ icon: Icon, title, content }) => (
            <section key={title} className="rounded-2xl border border-[#e3e5ed] bg-white p-6 shadow-[0_12px_38px_rgba(16,26,56,0.035)]">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f0efff] text-[#5146e5]"><Icon className="h-5 w-5" /></span>
              <h2 className="mt-5 text-base font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#697087]">{content}</p>
            </section>
          ))}
        </div>

        <section className="mt-6 rounded-2xl border border-[#dcd8ff] bg-[#f6f4ff] p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <Lock className="mt-1 h-5 w-5 shrink-0 text-[#5146e5]" />
            <div>
              <h2 className="text-base font-semibold">Service providers and international processing</h2>
              <p className="mt-2 text-sm leading-6 text-[#555d73]">The platform uses Firebase for authentication and classroom storage. Instructor lesson material may be sent to Google Gemini when question drafting is requested. The institution running the class must configure appropriate processing agreements, security settings, and safeguards for any transfer outside Thailand.</p>
            </div>
          </div>
        </section>

        <section className="mt-6 border-t border-[#e3e5ed] pt-7 text-sm leading-6 text-[#697087]">
          <p><strong className="text-[#101a38]">Questions or requests:</strong> Contact your instructor or institution first so they can verify your identity and find the correct class record. You can also contact Classfully at <a className="font-semibold text-[#5146e5]" href={`mailto:${CLASSFULLY_CONTACT}`}>{CLASSFULLY_CONTACT}</a>.</p>
          <p className="mt-3">For the wider platform policy, read the <Link href="/data-policy" className="font-semibold text-[#5146e5] underline underline-offset-4">Data Policy</Link>. Use of Classfully is also subject to the <Link href="/terms" className="font-semibold text-[#5146e5] underline underline-offset-4">Terms & Conditions</Link>.</p>
        </section>
      </article>
    </MarketingPage>
  );
}
