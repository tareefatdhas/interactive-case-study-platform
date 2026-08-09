import {
  CheckCircle,
  ChatCircleDots,
  Star,
  UsersThree,
} from '@phosphor-icons/react';

const sessions = [
  { short: 'S1', date: 'Jul 8', attendance: 84, participation: 58, confidence: 42 },
  { short: 'S2', date: 'Jul 15', attendance: 86, participation: 62, confidence: 38 },
  { short: 'S3', date: 'Jul 22', attendance: 87, participation: 66, confidence: 52 },
  { short: 'S4', date: 'Jul 29', attendance: 87, participation: 70, confidence: 61 },
  { short: 'S5', date: 'Aug 5', attendance: 89, participation: 73, confidence: 70 },
  { short: 'Today', date: 'Aug 9', attendance: 91, participation: 76, confidence: 78 },
];

const rows = [
  {
    key: 'attendance' as const,
    label: 'Attendance rate',
    detail: 'Students who attended',
    className: 'attendance',
    icon: CheckCircle,
  },
  {
    key: 'participation' as const,
    label: 'Participation breadth',
    detail: 'Contributed at least once',
    className: 'participation',
    icon: ChatCircleDots,
  },
  {
    key: 'confidence' as const,
    label: 'Topic confidence',
    detail: 'Confident or very confident',
    className: 'confidence',
    icon: Star,
  },
];

function pathFor(key: 'attendance' | 'participation' | 'confidence') {
  const min = 30;
  const max = 100;
  return sessions
    .map((session, index) => {
      const x = 38 + index * 92;
      const y = 72 - ((session[key] - min) / (max - min)) * 50;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

export default function ClassTrendVisual() {
  return (
    <div className="course-pulse-shell" aria-label="Example course pulse showing attendance, participation, and confidence across six sessions">
      <div className="course-pulse-topbar">
        <div><strong>ECON 302</strong><em>Platform strategy</em></div>
        <span><i /> Live · 142 connected</span>
      </div>

      <div className="course-pulse-heading">
        <span>Course pulse</span>
        <div className="course-pulse-sessions" aria-hidden="true">
          {sessions.map((session) => <div key={session.short}><b>{session.date}</b><small>{session.short}</small></div>)}
        </div>
      </div>

      <div className="course-pulse-rows">
        {rows.map(({ key, label, detail, className, icon: Icon }) => (
          <div className={`course-pulse-row ${className}`} key={key}>
            <div className="course-pulse-label"><Icon weight="fill" /><span><b>{label}</b><small>{detail}</small></span></div>
            <div className="course-pulse-line">
              <svg viewBox="0 0 536 88" preserveAspectRatio="none" role="img" aria-label={`${label} changes from ${sessions[0][key]} to ${sessions.at(-1)?.[key]} percent`}>
                <g className="course-pulse-gridlines" aria-hidden="true">
                  {sessions.map((session, index) => <line key={session.short} x1={38 + index * 92} x2={38 + index * 92} y1="12" y2="82" />)}
                </g>
                <path d={pathFor(key)} />
                {sessions.map((session, index) => {
                  const x = 38 + index * 92;
                  const y = 72 - ((session[key] - 30) / 70) * 50;
                  return <g key={session.short}><circle cx={x} cy={y} r="5" /><text x={x} y={Math.max(12, y - 12)} textAnchor="middle">{session[key]}%</text></g>;
                })}
              </svg>
            </div>
          </div>
        ))}
        <div className="course-pulse-today-column" aria-label="Today: 91 percent attendance, 76 percent participation, and 78 percent topic confidence">
          <strong className="attendance">91%</strong>
          <strong className="participation">76%</strong>
          <strong className="confidence">78%</strong>
        </div>
      </div>

      <div className="course-pulse-consistency">
        <div className="course-pulse-consistency-label"><span><UsersThree weight="fill" /></span><div><b>Consistency</b><small>Attended 5 of 6 sessions</small></div></div>
        <div className="course-pulse-people" aria-hidden="true">
          {Array.from({ length: 14 }).map((_, index) => <UsersThree key={index} className={index < 10 ? 'active' : ''} weight="fill" />)}
        </div>
        <div className="course-pulse-consistency-score"><strong>72%</strong><small>102 of 142 students</small></div>
      </div>

      <p className="course-pulse-note">Changes are compared with the course baseline from the first two sessions.</p>
    </div>
  );
}
