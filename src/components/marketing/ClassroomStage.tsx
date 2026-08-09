import { CaretRight as ChevronRight, ChatCircleDots as MessageCircleQuestion, Broadcast as Radio, UsersThree as Users } from '@phosphor-icons/react/ssr';

const results = [
  { label: 'One more example', value: 46, color: 'var(--pulse-steady)', dots: 18 },
  { label: 'Ready to continue', value: 39, color: 'var(--pulse-energized)', dots: 15 },
  { label: 'Please slow down', value: 15, color: 'var(--pulse-overwhelmed)', dots: 7 },
];

const atmosphere = [
  [7, 15, 6, 7.2], [14, 68, 8, 8.4], [22, 35, 5, 9.1], [29, 82, 7, 7.8], [38, 10, 5, 8.8],
  [43, 58, 9, 10.2], [51, 91, 6, 7.5], [59, 26, 7, 9.6], [66, 72, 5, 8.1], [73, 44, 8, 10.5],
  [79, 7, 6, 7.9], [84, 86, 5, 9.3], [90, 53, 7, 8.6], [95, 18, 5, 10.1], [11, 94, 6, 8.9],
];

export default function ClassroomStage() {
  return (
    <div className="classroom-stage" aria-label="Classfully connects the instructor console, classroom projector, and student phone">
      <div className="stage-atmosphere" aria-hidden="true">
        {atmosphere.map(([x, y, size, duration], index) => (
          <i key={index} style={{ '--stage-x': `${x}%`, '--stage-y': `${y}%`, '--stage-size': `${size}px`, '--stage-duration': `${duration}s` } as React.CSSProperties} />
        ))}
      </div>

      <div className="stage-projector">
        <div className="stage-projector-header">
          <div><strong>ECON 302</strong><span>Platform strategy</span></div>
          <span className="stage-live"><i /> Live · 142 connected</span>
        </div>
        <div className="stage-projector-question">
          <span className="seminar-eyebrow">Pace check · 100 responses</span>
          <h2 className="seminar-display">How is the pace right now?</h2>
        </div>
        <div className="stage-results">
          {results.map((result, row) => (
            <div key={result.label} className="stage-result-row">
              <div><span>{result.label}</span><strong className="seminar-display">{result.value}%</strong></div>
              <div className="stage-dot-field" aria-hidden="true">
                {Array.from({ length: result.dots }).map((_, index) => (
                  <i key={index} style={{ backgroundColor: result.color, animationDelay: `${180 + row * 110 + index * 28}ms` }} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="stage-projector-foot">Class totals only · Responses stay open</p>
      </div>

      <div className="stage-console">
        <div className="stage-window-bar"><span /><span /><span /><small>Instructor console</small></div>
        <div className="stage-console-body">
          <div className="stage-console-now">
            <span className="seminar-eyebrow">Now</span>
            <strong>Pace check</strong>
            <small>100 of 142 responded</small>
          </div>
          <div className="stage-console-signal"><Radio /><span><strong>15 students</strong> need more time</span></div>
          <div className="stage-console-signal"><MessageCircleQuestion /><span><strong>7 questions</strong> are waiting</span></div>
          <button tabIndex={-1}>Finish interaction <ChevronRight /></button>
        </div>
      </div>

      <div className="stage-phone">
        <div className="stage-phone-top"><span>Classfully</span><i /></div>
        <span className="seminar-eyebrow">Response sent</span>
        <strong className="seminar-display">See what the class is thinking.</strong>
        <div className="stage-phone-answer"><Radio /><span>Your answer</span><b>One more example</b></div>
        <div className="stage-phone-wait"><Users /><span><b>While the room responds</b><small>Upvote a question you want discussed.</small></span></div>
      </div>
    </div>
  );
}
