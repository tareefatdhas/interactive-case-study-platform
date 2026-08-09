'use client';

import { CheckCircle2, MonitorUp, RefreshCw, Wifi, X } from 'lucide-react';
import './projector-preflight.css';

interface ProjectorPreflightProps {
  open: boolean;
  connected: boolean;
  onOpenDisplay: () => void;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ProjectorPreflight({
  open,
  connected,
  onOpenDisplay,
  onConfirm,
  onClose,
}: ProjectorPreflightProps) {
  if (!open) return null;

  return (
    <div className="projector-preflight-backdrop" role="presentation">
      <section className="projector-preflight" role="dialog" aria-modal="true" aria-labelledby="projector-preflight-title">
        <button type="button" className="projector-preflight-close" onClick={onClose} aria-label="Close projector check"><X size={18} /></button>
        <span className="projector-preflight-icon"><MonitorUp size={22} /></span>
        <p className="seminar-eyebrow">Projector check</p>
        <h2 id="projector-preflight-title" className="seminar-display">Can you see Classfully on the classroom screen?</h2>
        <p className="projector-preflight-copy">Move the classroom display to your projector and make it full screen. Keep this instructor window on your own device.</p>

        <div className={`projector-connection-state ${connected ? 'is-connected' : ''}`} role="status" aria-live="polite">
          {connected ? <CheckCircle2 size={19} /> : <Wifi size={19} />}
          <span><strong>{connected ? 'Display connected' : 'Waiting for the display'}</strong><small>{connected ? 'This instructor window is receiving a live signal from the classroom screen.' : 'If no window opened, allow pop-ups and try again.'}</small></span>
        </div>

        <ol className="projector-preflight-steps">
          <li><span>1</span><p><strong>Put it on the projector</strong><small>Drag the display window to the classroom screen.</small></p></li>
          <li><span>2</span><p><strong>Enter full screen</strong><small>Students should only see the classroom display.</small></p></li>
          <li><span>3</span><p><strong>Confirm below</strong><small>This keeps the first live interaction from feeling uncertain.</small></p></li>
        </ol>

        <div className="projector-preflight-actions">
          <button type="button" onClick={onOpenDisplay}><RefreshCw size={15} /> {connected ? 'Reopen display' : 'Try opening again'}</button>
          <button type="button" className="is-primary" onClick={onConfirm} disabled={!connected}><CheckCircle2 size={16} /> I can see it</button>
        </div>
      </section>
    </div>
  );
}
