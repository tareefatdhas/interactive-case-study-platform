import { BookOpenText as BookOpen, Check, Fire as Flame, Heartbeat as HeartPulse, ChatCircleDots as MessageCircleQuestion, TrendUp as TrendingUp } from '@phosphor-icons/react/ssr';

const sessions = [
  { week: 'Week 1', title: 'Foundations', attendance: '84%', confidence: 42, tone: 'coral' },
  { week: 'Week 2', title: 'Market forces', attendance: '88%', confidence: 49, tone: 'sun' },
  { week: 'Week 3', title: 'Network effects', attendance: '91%', confidence: 58, tone: 'sky' },
  { week: 'Week 4', title: 'Platform strategy', attendance: '93%', confidence: 67, tone: 'violet' },
];

export default function CourseContinuityVisual() {
  return (
    <div className="course-thread" aria-label="A course record grows as attendance, understanding, questions, and reflections are captured across sessions">
      <div className="course-thread-head">
        <div>
          <span className="seminar-eyebrow">ECON 302 · Course record</span>
          <h3 className="seminar-display">Four classes. One developing picture.</h3>
        </div>
        <span className="course-thread-live"><i /> Updated today</span>
      </div>
      <div className="course-thread-track">
        {sessions.map((session, index) => (
          <article key={session.week} className={`course-thread-session is-${session.tone}`}>
            <div className="course-thread-marker"><span>{index + 1}</span></div>
            <p>{session.week}</p>
            <strong>{session.title}</strong>
            <dl>
              <div><dt>Attendance</dt><dd>{session.attendance}</dd></div>
              <div><dt>Confidence</dt><dd>{session.confidence}%</dd></div>
            </dl>
          </article>
        ))}
      </div>
      <div className="course-thread-insights">
        <article><TrendingUp weight="duotone" /><span><small>Understanding</small><strong>Up 25 points</strong></span></article>
        <article><MessageCircleQuestion weight="duotone" /><span><small>Still open</small><strong>3 shared questions</strong></span></article>
        <article><HeartPulse weight="duotone" /><span><small>Class pulse</small><strong>More settled today</strong></span></article>
      </div>
      <div className="course-thread-student">
        <div className="course-thread-avatar">AK</div>
        <div><small>Arun’s course progress</small><strong>Showing up, contributing, improving</strong></div>
        <span><Flame weight="duotone" /> 4-class streak</span>
        <span><Check weight="bold" /> 320 points</span>
        <BookOpen weight="duotone" />
      </div>
    </div>
  );
}
