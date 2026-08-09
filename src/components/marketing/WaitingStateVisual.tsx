import { ArrowFatUp as ArrowUp, Check, ChatCircleDots as MessageCircleQuestion, Broadcast as Radio } from '@phosphor-icons/react/ssr';

const questions = [
  ['Can indirect effects make a network more fragile?', 18],
  ['Does interoperability always reduce winner-take-all dynamics?', 11],
  ['What real cases show network effects increasing systemic risk?', 6],
];

const orbitDots = Array.from({ length: 42 }, (_, index) => ({
  angle: index * 29,
  radius: 38 + (index % 6) * 12,
  size: 3 + (index % 3),
  duration: 4 + (index % 4) * 0.7,
}));

export default function WaitingStateVisual() {
  return (
    <div className="waiting-state-visual" aria-label="After responding, students can upvote questions while the class finishes">
      <div className="waiting-phone">
        <div className="waiting-phone-top"><span>Classfully</span><i /></div>
        <div className="waiting-sent"><Check /><span><b>Response sent</b><small>Your answer: one critical provider</small></span></div>
        <p className="seminar-eyebrow">Question commons</p>
        <h3 className="seminar-display">While the room responds</h3>
        <p className="waiting-intro">See what others are wondering. Upvote one you want discussed.</p>
        <div className="waiting-questions">
          {questions.map(([question, votes], index) => (
            <div key={question as string} className={index === 0 ? 'active' : ''}>
              <button tabIndex={-1}><ArrowUp /><b>{votes}</b></button>
              <span><strong className="seminar-display">{question}</strong><small>Anonymous to classmates</small></span>
            </div>
          ))}
        </div>
        <button className="waiting-ask" tabIndex={-1}><MessageCircleQuestion /> Ask a question</button>
      </div>

      <div className="waiting-room-signal" aria-hidden="true">
        <div className="waiting-orbit">
          {orbitDots.map((dot, index) => (
            <i key={index} style={{ '--wait-angle': `${dot.angle}deg`, '--wait-radius': `${dot.radius}px`, '--wait-size': `${dot.size}px`, '--wait-duration': `${dot.duration}s` } as React.CSSProperties} />
          ))}
        </div>
        <Radio />
        <strong className="seminar-display">The room is still responding</strong>
        <span>Look up when your instructor is ready.</span>
      </div>
    </div>
  );
}
