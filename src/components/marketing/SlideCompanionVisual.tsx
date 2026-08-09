import { ArrowRight, ChartBar as BarChart3, Play, Presentation, Broadcast as Radio } from '@phosphor-icons/react/ssr';

export default function SlideCompanionVisual() {
  return (
    <div className="slide-companion" aria-label="Classfully sits beside the instructor's existing presentation">
      <div className="slide-deck">
        <div className="slide-deck-bar"><Presentation /><span>Week 6 · Platform strategy</span><small>Slide 18 of 32</small></div>
        <div className="slide-deck-content">
          <span className="seminar-eyebrow">Your presentation</span>
          <h3 className="seminar-display">When do network effects become fragile?</h3>
          <div className="slide-network" aria-hidden="true"><i /><i /><i /><i /><i /><i /><span /><span /><span /><span /></div>
          <p>Your slides remain in PowerPoint, Keynote, or Google Slides.</p>
        </div>
      </div>

      <div className="slide-switch" aria-hidden="true">
        <span>Switch when the room should respond</span>
        <ArrowRight />
      </div>

      <div className="slide-classfully">
        <div className="slide-classfully-bar"><span>Classfully</span><small><i /> Display ready</small></div>
        <div className="slide-classfully-body">
          <span className="seminar-eyebrow">Next prepared activity</span>
          <h3 className="seminar-display">Where do network effects become most fragile?</h3>
          <div className="slide-activity-meta"><Radio /><span>Opinion poll</span><b>4 choices</b></div>
          <button tabIndex={-1}><Play /> Ask the class</button>
          <div className="slide-activity-next"><BarChart3 /><span><small>After this</small>Reveal the distribution and discuss</span></div>
        </div>
      </div>
    </div>
  );
}
