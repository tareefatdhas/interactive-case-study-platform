'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { IconContext, ArrowRight, Medal as Award, ChartBar as BarChart3, BookOpenText as BookOpen, Brain, Check, Question as CircleHelp, Eye, Fire as Flame, FileText, Gift, Heartbeat as HeartPulse, LockKey as Lock, ChatCircleDots as MessageCircleQuestion, Broadcast as Radio, ShieldCheck, DeviceMobile as Smartphone, Sparkle as Sparkles, Target, UsersThree as Users } from '@phosphor-icons/react';
import { useAuth } from '@/lib/hooks/useAuth';
import MarketingPage from '@/components/marketing/MarketingPage';
import PricingPlans from '@/components/marketing/PricingPlans';
import ClassroomStage from '@/components/marketing/ClassroomStage';
import SlideCompanionVisual from '@/components/marketing/SlideCompanionVisual';
import WaitingStateVisual from '@/components/marketing/WaitingStateVisual';
import ClassTrendVisual from '@/components/marketing/ClassTrendVisual';
import CourseContinuityVisual from '@/components/marketing/CourseContinuityVisual';
import HomeJsonLd from '@/components/seo/HomeJsonLd';
import TrackedCta from '@/components/analytics/TrackedCta';
import { track } from '@/lib/analytics/events';

const classroomMoves = [
  { icon: Radio, label: 'Class Pulse', question: 'Do we need to slow down?', answer: 'Check pace, confidence, agreement, or how the room feels in under a minute.' },
  { icon: Users, label: 'Opinion poll', question: 'Where does the room differ?', answer: 'Show the spread, then ask why.' },
  { icon: Check, label: 'Knowledge check', question: 'Did the concept land?', answer: 'Close voting before revealing the answer.' },
  { icon: MessageCircleQuestion, label: 'Short response', question: 'What is still unclear?', answer: 'Collect questions and share what helps the room.' },
];

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.push('/dashboard');
  }, [user, loading, router]);

  return (
    <IconContext.Provider value={{ weight: 'duotone' }}>
    <HomeJsonLd />
    <MarketingPage>
      <section className="world-hero">
        <div className="world-hero-copy mx-auto max-w-7xl px-5 pt-16 sm:px-8 sm:pt-24 lg:pt-28">
          <div className="hero-room-note" aria-hidden="true">
            <span className="hero-room-note-dots"><i /><i /><i /><i /><i /></span>
            <strong>Confidence is up 25 points</strong>
            <small>Four sessions, one course story</small>
          </div>
          <div className="max-w-5xl">
            <p className="seminar-eyebrow mb-5">The interactive layer for university courses</p>
            <h1 className="seminar-display text-5xl leading-[0.98] text-[var(--seminar-ink)] sm:text-7xl lg:text-[4.35rem]">
              Make the classroom interactive. <em>Build every student’s journey</em>
            </h1>
          </div>
          <div className="mt-8 grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
            <p className="max-w-2xl text-lg leading-8 text-[#4f576d] sm:text-xl">
              Run live questions, check-ins, quizzes, and discussions beside your slides. Every response adds to a course-long record of participation, understanding, and progress.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <TrackedCta href="/signup" ctaLocation="home_hero" ctaLabel="create_first_class" className="marketing-button marketing-button-primary marketing-button-large seminar-focus">Create your first interactive class <ArrowRight className="h-4 w-4" /></TrackedCta>
              <a
                href="#how-it-fits"
                className="marketing-button marketing-button-secondary marketing-button-large seminar-focus"
                onClick={() => track('cta_clicked', { cta_location: 'home_hero', cta_label: 'see_classroom_flow', cta_destination: '#how-it-fits' })}
              >See the classroom flow</a>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1500px] px-3 pb-14 pt-12 sm:px-6 sm:pb-20 sm:pt-16">
          <ClassroomStage />
          <div className="world-stage-caption">
            <span><i className="violet" /> A student responds today</span>
            <span><i className="blue" /> The class pattern becomes clearer</span>
            <span><i className="coral" /> The next session starts better informed</span>
          </div>
        </div>
      </section>

      <section className="course-memory-section" aria-labelledby="course-memory-title">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:gap-20">
          <div>
            <h2 id="course-memory-title" className="seminar-display text-4xl leading-[1.02] text-[var(--seminar-ink)] sm:text-6xl">Keep it flowing</h2>
            <p className="mt-6 text-lg leading-8 text-[var(--seminar-muted)]">Attendance, confidence, questions, quizzes, and reflections stay tied to the session. See what changed, not only what won the last poll.</p>
          </div>
          <CourseContinuityVisual />
        </div>
      </section>

      <section className="class-rhythm" aria-labelledby="class-rhythm-title">
        <div className="relative z-10 mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="class-rhythm-heading">
            <p className="seminar-eyebrow">Before, during, and after class</p>
            <h2 id="class-rhythm-title" className="seminar-display">A simple rhythm that builds over time</h2>
          </div>
          <div className="class-rhythm-steps">
            <article><span>1</span><HeartPulse /><strong>Arrive and check in</strong><p>Confirm attendance, readiness, and how the room feels.</p></article>
            <article><span>2</span><Smartphone /><strong>Participate throughout</strong><p>Answer, predict, ask, discuss, and reflect from one screen.</p></article>
            <article><span>3</span><BarChart3 /><strong>Read the room together</strong><p>Shared patterns show where the class needs more time.</p></article>
            <article><span>4</span><Target /><strong>Leave with progress</strong><p>Every session informs progress and your next teaching decision.</p></article>
          </div>
        </div>
      </section>

      <section className="room-problem">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end lg:gap-20">
            <div>
              <p className="seminar-eyebrow mb-4">Classfully compared with Mentimeter</p>
              <h2 className="seminar-display text-4xl leading-[1.02] text-[var(--seminar-ink)] sm:text-6xl">Built for the course, not only the presentation</h2>
            </div>
            <p className="max-w-2xl text-lg leading-8 text-[var(--seminar-muted)]">Mentimeter is excellent at making a presentation interactive. Classfully connects those live moments across the whole course.</p>
          </div>

          <div className="course-comparison">
            <table>
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">What is being compared</span></th>
                  <th scope="col"><strong>Mentimeter</strong><span>Presentation-first</span></th>
                  <th scope="col"><strong>Classfully</strong><span>Course-first</span></th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['The core unit', 'A class, its sessions, and each student’s progress.', 'A presentation, its slides, and the results they collect.'],
                  ['Student journey', 'Student ID, attendance, participation, and progress stay connected.', 'Anonymous by default. Participant names are available on Pro and Enterprise plans.'],
                  ['Progress over time', 'Track attendance, confidence, participation, and understanding across the course.', 'Compare results when the same presentation is used again.'],
                  ['Motivation', 'Carry points, streaks, and instructor-approved rewards across the course.', 'Use timed quizzes, points, and live leaderboards.'],
                  ['Your slides', 'Keep PowerPoint, Keynote, or Google Slides. Open Classfully for live moments.', 'Build or import slides and present from Mentimeter.'],
                ].map(([label, classfully, mentimeter]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    <td><span>Mentimeter</span>{mentimeter}</td>
                    <td className="is-classfully"><span>Classfully</span>{classfully}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="course-comparison-choice">
              <p><strong>Choose Mentimeter</strong> when the presentation is the center of the experience.</p>
              <p><strong>Choose Classfully</strong> when every session should build on the last.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-fits" className="slide-companion-section">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.72fr] lg:items-end">
            <div>
              <p className="seminar-eyebrow mb-4">Fits beside your presentation</p>
              <h2 className="seminar-display max-w-4xl text-4xl leading-[1.02] text-[var(--seminar-ink)] sm:text-6xl">A companion to your course materials</h2>
            </div>
            <p className="text-lg leading-8 text-[var(--seminar-muted)]">Prepare a few interactions. Open Classfully when the room should respond, then return to your lecture.</p>
          </div>
          <div className="mt-14"><SlideCompanionVisual /></div>
          <div className="slide-companion-notes">
            <span><Check /> Open the projector once</span>
            <span><Check /> Keep upcoming questions private</span>
            <span><Check /> Ask an unplanned question when needed</span>
          </div>
        </div>
      </section>

      <section className="projector-theatre">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
            <div>
              <p className="seminar-eyebrow mb-4">One question, three useful views</p>
              <h2 className="seminar-display text-4xl leading-[1.02] sm:text-6xl">Managing attention and focus</h2>
            </div>
            <p className="max-w-2xl text-lg leading-8">The projector shows the room. The instructor keeps private controls. Students see one clear next action.</p>
          </div>
          <div className="surface-proof-grid">
            <article><Eye /><h3 className="seminar-display">The room sees the shared pattern</h3><p>Large type, exact totals, one moment at a time.</p></article>
            <article><Lock /><h3 className="seminar-display">The instructor sees what needs attention</h3><p>Questions, private signals, upcoming activities, and controls.</p></article>
            <article><ShieldCheck /><h3 className="seminar-display">The student sees one clear next step</h3><p>Respond, confirm, then use the waiting time without feeling watched.</p></article>
          </div>
        </div>
      </section>

      <section className="classroom-moves-section">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="grid gap-7 lg:grid-cols-[1fr_0.55fr] lg:items-end">
            <div>
              <h2 className="seminar-display max-w-4xl text-4xl leading-tight text-[var(--seminar-ink)] sm:text-6xl">Pick an interaction from a template or create your own</h2>
            </div>
            <p className="text-lg leading-8 text-[var(--seminar-muted)]">A pulse should not feel like a quiz. Each format helps the room answer differently.</p>
          </div>
          <div className="classroom-moves mt-14">
            {classroomMoves.map(({ icon: Icon, label, question, answer }, index) => (
              <article key={label} className={`classroom-move classroom-move-${index + 1}`}>
                <div className="classroom-move-index"><Icon /></div>
                <div><p className="seminar-eyebrow">{label}</p><h3 className="seminar-display">{question}</h3></div>
                <p>{answer}</p>
                <div className="classroom-move-signal" aria-hidden="true">{Array.from({ length: 12 + index * 3 }).map((_, dot) => <i key={dot} />)}</div>
              </article>
            ))}
          </div>
          <p className="classroom-moves-foot"><BookOpen /> Case studies use the same formats, so they stay inside the lesson.</p>
        </div>
      </section>

      <section className="waiting-story">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:gap-24">
          <div>
            <p className="seminar-eyebrow mb-4">After a student responds</p>
            <h2 className="seminar-display text-4xl leading-[1.02] text-[var(--seminar-ink)] sm:text-6xl">Helping you make the most of every moment</h2>
            <p className="mt-6 text-lg leading-8 text-[var(--seminar-muted)]">Fast responders can upvote questions, add their own, or simply look up while the room finishes.</p>
            <div className="waiting-story-points">
              <span><Check /> No reward for speed</span>
              <span><Check /> Questions are anonymous to classmates</span>
              <span><Check /> Instructors choose what gets discussed</span>
            </div>
          </div>
          <WaitingStateVisual />
        </div>
      </section>

      <section className="trend-story">
        <div className="mx-auto grid max-w-[1420px] gap-14 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[0.76fr_1.24fr] lg:items-start lg:gap-16">
          <div className="course-pulse-story-copy">
            <p className="seminar-eyebrow mb-4">Course Pulse</p>
            <h2 className="seminar-display text-4xl leading-[1.02] text-[var(--seminar-ink)] sm:text-6xl">See what matters. Decide what&apos;s next</h2>
            <p>Attendance, participation, and confidence stay connected across every session. See what&apos;s changing, understand why, and take action that moves learning forward.</p>
            <div className="course-pulse-next">
              <div className="course-pulse-next-title"><Sparkles /><strong>What should I do next?</strong></div>
              <article><div className="course-action-icon lesson"><BookOpen weight="fill" /></div><p><b>Revisit indirect network effects</b><small>Confidence dipped after Session 2. Reinforce the concept.</small></p><ArrowRight /></article>
              <article><div className="course-action-icon streak"><Users weight="fill" /></div><p><b>Keep the attendance streak going</b><small>102 students have attended 5 of 6 sessions. Recognize the consistency before next class.</small></p><ArrowRight /></article>
            </div>
            <TrackedCta href="/instructors" ctaLocation="home_body" ctaLabel="explore_instructor_workflow" className="marketing-text-link seminar-focus mt-7">Explore the instructor workflow <ArrowRight /></TrackedCta>
          </div>
          <ClassTrendVisual />
        </div>
      </section>

      <section className="progress-story" aria-labelledby="progress-story-title">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-24">
          <div>
            <h2 id="progress-story-title" className="seminar-display text-4xl leading-[1.02] text-[var(--seminar-ink)] sm:text-6xl">Give students something they look forward to building on</h2>
            <p className="mt-6 text-lg leading-8 text-[var(--seminar-muted)]">Students build streaks, earn points for meaningful participation, and track their understanding. Instructors decide what counts and which rewards fit.</p>
            <ul className="progress-principles">
              <li><Check /> Reward showing up, thinking, and improving</li>
              <li><Check /> Keep personal pulse answers out of grades and rankings</li>
              <li><Check /> Approve every course reward</li>
            </ul>
          </div>
          <div className="progress-preview" aria-label="Student progress and course rewards preview">
            <div className="progress-preview-top"><span className="seminar-eyebrow">My course progress</span><span>ECON 302</span></div>
            <div className="progress-profile"><div>AK</div><span><small>Four-week momentum</small><strong>Keep showing up</strong></span><b><Flame /> 4</b></div>
            <div className="progress-stat-grid">
              <article><Award /><strong>320</strong><span>points earned</span></article>
              <article><Target /><strong>12</strong><span>activities completed</span></article>
              <article><Brain /><strong>+25</strong><span>confidence change</span></article>
            </div>
            <div className="progress-reward"><Gift /><div><small>Instructor-approved reward</small><strong>Extra case study revision</strong><span>450 points · 130 to go</span></div><i><span style={{ width: '71%' }} /></i></div>
            <p><ShieldCheck /> Your progress is personal. The class sees shared patterns, not this record.</p>
          </div>
        </div>
      </section>

      <section className="teaching-note" aria-label="Classfully product principle">
        <div className="relative z-10 mx-auto max-w-5xl px-5 py-20 text-center sm:px-8 sm:py-24">
          <h2 className="seminar-display">Student participation should outlast the moment</h2>
          <p>Classfully turns classroom voice into visible progress.</p>
        </div>
      </section>

      <section className="case-module-story">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[0.7fr_1.3fr] lg:items-center">
          <div>
            <BookOpen className="h-6 w-6 text-[var(--seminar-violet)]" />
            <p className="seminar-eyebrow mt-5">Classroom-native modules</p>
            <h2 className="seminar-display mt-4 text-4xl leading-tight text-[var(--seminar-ink)] sm:text-5xl">Add-ons you can easily drop in</h2>
            <p className="mt-5 leading-7 text-[var(--seminar-muted)]">Use structured activities when a poll is not enough.</p>
          </div>
          <div className="module-grid">
            <article className="module-case"><BookOpen /><span className="seminar-eyebrow">Case study</span><h3 className="seminar-display">Read. Decide. Discuss. Reflect</h3><p>Turn shared material into a classroom decision.</p></article>
            <article className="module-assessment"><Brain /><span className="seminar-eyebrow">Self-assessment</span><h3 className="seminar-display">Learn something about yourself</h3><p>Notice strengths, habits, and growth over time.</p></article>
            <article className="module-discussion"><MessageCircleQuestion /><span className="seminar-eyebrow">Discussion</span><h3 className="seminar-display">Make room for more voices</h3><p>Collect perspectives before opening the microphone.</p></article>
            <article className="module-reflection"><Target /><span className="seminar-eyebrow">Reflection</span><h3 className="seminar-display">Turn a class into a next step</h3><p>Capture what changed and what comes next.</p></article>
          </div>
        </div>
      </section>

      <section className="homepage-pricing">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="pricing-section-heading">
            <p className="seminar-eyebrow">Pricing that follows the course</p>
            <h2 className="seminar-display">Start free. Pay by teaching term when it becomes part of the class</h2>
            <p>No student licenses and no charge for every answer. The full classroom can participate without making the price harder to predict.</p>
          </div>
          <PricingPlans />
          <div className="mt-8 text-center"><TrackedCta href="/pricing" ctaLocation="home_body" ctaLabel="read_pricing_details" className="marketing-text-link seminar-focus">Read the pricing details <ArrowRight /></TrackedCta></div>
        </div>
      </section>

      <section className="legal-trust-section">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
            <div>
              <ShieldCheck className="h-6 w-6 text-[var(--seminar-success)]" />
              <h2 className="seminar-display mt-5 text-4xl leading-[1.02] text-[var(--seminar-ink)] sm:text-5xl">Know what happens to classroom information</h2>
            </div>
            <p className="max-w-2xl text-lg leading-8 text-[var(--seminar-muted)]">Our policies explain what Classfully collects, what instructors control, what students can choose, and how to ask for help or exercise data rights.</p>
          </div>
          <div className="legal-trust-grid">
            <Link href="/data-policy" className="legal-trust-card seminar-focus"><ShieldCheck /><h3 className="seminar-display">Data Policy</h3><p>Collection, use, providers, retention, security, and your rights.</p><b>Read the policy <ArrowRight /></b></Link>
            <Link href="/terms" className="legal-trust-card seminar-focus"><FileText /><h3 className="seminar-display">Terms & Conditions</h3><p>Clear responsibilities for instructors, institutions, and students.</p><b>Read the terms <ArrowRight /></b></Link>
            <Link href="/privacy" className="legal-trust-card seminar-focus"><Lock /><h3 className="seminar-display">Student privacy</h3><p>A short classroom notice students can read before they join.</p><b>Read the notice <ArrowRight /></b></Link>
          </div>
          <p className="legal-trust-operator">Classfully is operated by Tareef Jafferi. Policy questions and data requests: <a href="mailto:tareef@happily.ai">tareef@happily.ai</a>.</p>
        </div>
      </section>

      <section className="homepage-faq">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
          <div>
            <CircleHelp className="h-6 w-6 text-[var(--seminar-violet)]" />
            <h2 className="seminar-display mt-5 text-4xl text-[var(--seminar-ink)] sm:text-5xl">Before you bring it into class</h2>
            <p className="mt-4 leading-7 text-[var(--seminar-muted)]">The practical questions instructors ask first.</p>
          </div>
          <div className="faq-list">
            {[
              ['Do I need to move my slides into Classfully?', 'No. Keep your presentation where it is. Open Classfully when students should respond.'],
              ['What does a student need?', 'A phone, tablet, or laptop, plus the class code and their student number. There is no app to install.'],
              ['What appears on the projector?', 'Only class totals and responses you choose. Student IDs, private questions, and personal pulse answers stay hidden.'],
              ['Can I ask something I did not prepare?', 'Yes. Launch a pulse, poll, quiz, or short response from the instructor console.'],
              ['What continues after class?', 'Attendance, participation, quiz results, questions, and reflections stay with the course. Students see personal progress. Instructors see class patterns.'],
              ['Can points become course rewards?', 'Yes, if they fit the course and university policy. Instructors approve every academic reward.'],
            ].map(([question, answer]) => (
              <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>
            ))}
          </div>
        </div>
      </section>

      <section className="world-final-cta">
        <div className="relative z-10 mx-auto max-w-5xl px-5 py-24 text-center sm:px-8 sm:py-32">
          <Sparkles className="mx-auto h-6 w-6 text-[var(--seminar-violet)]" />
          <h2 className="seminar-display mt-6 text-5xl leading-[0.98] text-[var(--seminar-ink)] sm:text-7xl">Your classroom just got an upgrade</h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[var(--seminar-muted)]">Prepare a session, open the display, and invite every student in. The value grows each time the class returns.</p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <TrackedCta href="/signup" ctaLocation="home_final" ctaLabel="create_first_class" className="marketing-button marketing-button-primary marketing-button-large seminar-focus">Create your first interactive class <ArrowRight className="h-4 w-4" /></TrackedCta>
            <TrackedCta href="/resources" ctaLocation="home_final" ctaLabel="open_classroom_checklist" className="marketing-button marketing-button-secondary marketing-button-large seminar-focus">Open the classroom checklist</TrackedCta>
          </div>
          <p className="world-final-reassurance">Keep your slides. Students join in a browser. Every session stays connected.</p>
        </div>
      </section>
    </MarketingPage>
    </IconContext.Provider>
  );
}
