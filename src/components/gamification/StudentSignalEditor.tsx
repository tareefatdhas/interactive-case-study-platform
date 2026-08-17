'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Check, EyeSlash, FloppyDisk, ShieldCheck } from '@phosphor-icons/react';
import HapticButton from '@/components/student/HapticButton';
import {
  SIGNAL_FACES,
  SIGNAL_FORMS,
  SIGNAL_ORBITS,
  SIGNAL_PALETTES,
  normalizeAlias,
  type SignalAvatar,
} from '@/lib/gamification';

const SignalAvatar3D = dynamic(() => import('./SignalAvatar3D'), {
  ssr: false,
  loading: () => <div className="student-signal-canvas" aria-label="Loading Signal preview" />,
});

const FACE_LABELS: Record<SignalAvatar['face'], string> = { calm: 'Calm', bright: 'Bright', curious: 'Curious', focused: 'Focused' };
const ORBIT_LABELS: Record<SignalAvatar['orbit'], string> = { ring: 'Ring', satellites: 'Satellites', trail: 'Trail', none: 'None' };

export default function StudentSignalEditor({ avatar, alias, optedIn, publicAliasesEnabled, onSave }: { avatar: SignalAvatar; alias: string; optedIn: boolean; publicAliasesEnabled: boolean; onSave: (profile: { avatar: SignalAvatar; alias: string; leaderboardOptIn: boolean }) => void }) {
  const [draftAvatar, setDraftAvatar] = useState(avatar);
  const [draftAlias, setDraftAlias] = useState(alias);
  const [draftOptIn, setDraftOptIn] = useState(optedIn);
  const [saved, setSaved] = useState(false);
  const save = () => {
    onSave({ avatar: draftAvatar, alias: normalizeAlias(draftAlias), leaderboardOptIn: publicAliasesEnabled && draftOptIn });
    setDraftAlias(normalizeAlias(draftAlias));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  return <section className="student-signal-editor" aria-labelledby="student-signal-title">
    <div className="student-signal-stage"><div><span>Your course identity</span><h2 id="student-signal-title">Design your Signal</h2></div><SignalAvatar3D avatar={draftAvatar} className="student-signal-canvas" /><small>Move your finger across the Signal</small></div>
    <div className="student-signal-controls">
      <label><span>Public alias</span><input value={draftAlias} onChange={(event) => setDraftAlias(event.target.value.slice(0, 28))} inputMode="text" autoComplete="off" /><small>Your student number is never used on a board.</small></label>
      <fieldset><legend>Form</legend><div className="student-signal-form-grid">{SIGNAL_FORMS.map((form) => <button type="button" key={form} onClick={() => setDraftAvatar((current) => ({ ...current, form }))} aria-pressed={draftAvatar.form === form}>{form}</button>)}</div></fieldset>
      <fieldset><legend>Color</legend><div className="student-signal-palette-grid">{(Object.keys(SIGNAL_PALETTES) as SignalAvatar['palette'][]).map((palette) => <button type="button" key={palette} onClick={() => setDraftAvatar((current) => ({ ...current, palette }))} aria-label={palette} aria-pressed={draftAvatar.palette === palette}><i style={{ backgroundColor: SIGNAL_PALETTES[palette].primary }} />{draftAvatar.palette === palette && <Check size={13} weight="bold" />}</button>)}</div></fieldset>
      <div className="student-signal-selects"><label><span>Expression</span><select value={draftAvatar.face} onChange={(event) => setDraftAvatar((current) => ({ ...current, face: event.target.value as SignalAvatar['face'] }))}>{SIGNAL_FACES.map((face) => <option key={face} value={face}>{FACE_LABELS[face]}</option>)}</select></label><label><span>Orbit</span><select value={draftAvatar.orbit} onChange={(event) => setDraftAvatar((current) => ({ ...current, orbit: event.target.value as SignalAvatar['orbit'] }))}>{SIGNAL_ORBITS.map((orbit) => <option key={orbit} value={orbit}>{ORBIT_LABELS[orbit]}</option>)}</select></label></div>
      {publicAliasesEnabled ? <label className="student-signal-opt-in"><input type="checkbox" checked={draftOptIn} onChange={(event) => setDraftOptIn(event.target.checked)} /><span><strong>Let my alias appear in class standing</strong><small>You can change this at any time. Your real identity remains private to classmates.</small></span></label> : <div className="student-signal-private"><EyeSlash size={18} /><span><strong>Your Signal is private.</strong><small>This class has not enabled a public alias board.</small></span></div>}
      <div className="student-signal-save"><span className={saved ? 'is-visible' : ''} role="status"><ShieldCheck size={16} /> Signal saved</span><HapticButton type="button" hapticTone="action" onClick={save}><FloppyDisk size={17} /> Save my Signal</HapticButton></div>
    </div>
  </section>;
}
