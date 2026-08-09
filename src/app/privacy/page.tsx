import Link from 'next/link';
import { ArrowLeft, Database, Eye, FileText, Lock, Scale, ShieldCheck, Trash2 } from 'lucide-react';
import { STUDENT_PRIVACY_NOTICE_VERSION } from '@/lib/privacy';

const sections = [
  {
    icon: Database,
    title: 'Information used in class',
    content: 'The class may record your student number, attendance status, response choices, short written responses, question votes, points, and the time you participated. A temporary device identifier keeps one response per activity.',
  },
  {
    icon: Eye,
    title: 'Who can see it',
    content: 'Classmates and the projector see class totals and responses the instructor deliberately shares. Your instructor can access attendance and individual records. Student numbers are never shown to classmates.',
  },
  {
    icon: ShieldCheck,
    title: 'Optional wellbeing check-ins',
    content: 'Wellbeing questions are optional. You can choose “Prefer not to say” or wait without answering. They should be used to adjust teaching, never for grades, rewards, discipline, or public rankings.',
  },
  {
    icon: FileText,
    title: 'AI question drafting',
    content: 'Only lesson material supplied by an instructor is sent to the configured AI service to draft class questions. Student attendance, responses, wellbeing answers, and reward records are not included in that request.',
  },
  {
    icon: Trash2,
    title: 'Retention and deletion',
    content: 'Your university or instructor sets the course retention period. Instructors can delete a session and its live attendance, response, vote, and presence data. The pilot target is deletion within 90 days after the course ends unless a shorter period or legal obligation applies.',
  },
  {
    icon: Scale,
    title: 'Your choices and rights',
    content: 'Contact your instructor or university privacy contact to request access, correction, deletion, restriction, objection, or a portable copy. You can also withdraw from optional wellbeing processing without losing access to ordinary class activities.',
  },
];

export default function PrivacyPage() {
  const controllerName = process.env.NEXT_PUBLIC_PDPA_CONTROLLER_NAME?.trim();
  const privacyContact = process.env.NEXT_PUBLIC_PDPA_CONTACT?.trim();

  return (
    <main className="min-h-screen bg-[#fffefa] px-5 pb-20 text-[#101a38] sm:px-8">
      <header className="mx-auto flex max-w-5xl items-center justify-between py-5">
        <Link href="/" className="classfully-wordmark seminar-focus text-xl sm:text-2xl">Classfully</Link>
        <Link href="/join" className="seminar-focus inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#555d73] hover:text-[#101a38]"><ArrowLeft className="h-4 w-4" /> Join a class</Link>
      </header>

      <article className="mx-auto max-w-5xl pt-10 sm:pt-16">
        <div className="max-w-3xl">
          <p className="seminar-eyebrow mb-4">Student privacy notice · Version {STUDENT_PRIVACY_NOTICE_VERSION}</p>
          <h1 className="seminar-display text-5xl leading-[1.02] sm:text-6xl">What the classroom records.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#697087]">{controllerName || 'Your university or instructor'} decides why class information is used and acts as the data controller. Classfully processes it to run the class, record attendance, and preserve course progress.</p>
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
          <p><strong className="text-[#101a38]">Questions or requests:</strong> Contact {privacyContact || 'your instructor or university privacy contact'}. They can verify your identity and connect your request to the correct class record.</p>
          {(!controllerName || !privacyContact) && <p className="mt-3">This notice supports the pilot product. The deploying institution must add its legal name, contact details, lawful bases, final retention schedule, and cross-border transfer arrangements before production use.</p>}
        </section>
      </article>
    </main>
  );
}
