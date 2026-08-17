import { SIGNAL_PALETTES, safeSignalAvatar, type SignalAvatar } from '@/lib/gamification';

export default function SignalAvatarBadge({ avatar, size = 48, label = 'Student Signal', decorative = false }: { avatar?: Partial<SignalAvatar>; size?: number; label?: string; decorative?: boolean }) {
  const safe = safeSignalAvatar(avatar);
  const colors = SIGNAL_PALETTES[safe.palette];
  const rounded = safe.form === 'orb' ? '50%' : safe.form === 'pebble' ? '46% 54% 48% 52% / 56% 44% 56% 44%' : safe.form === 'prism' ? '28%' : '42% 58% 38% 62% / 52% 40% 60% 48%';
  const eyeY = safe.face === 'bright' ? 44 : safe.face === 'focused' ? 46 : 42;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role={decorative ? undefined : 'img'} aria-hidden={decorative || undefined} aria-label={decorative ? undefined : label}>
      <defs>
        <linearGradient id={`signal-${safe.palette}-${safe.form}`} x1="18" y1="10" x2="82" y2="92" gradientUnits="userSpaceOnUse">
          <stop stopColor={colors.secondary} />
          <stop offset="1" stopColor={colors.primary} />
        </linearGradient>
      </defs>
      {safe.orbit !== 'none' && <ellipse cx="50" cy="51" rx="43" ry="25" fill="none" stroke={colors.primary} strokeWidth="3" opacity=".32" transform="rotate(-18 50 51)" strokeDasharray={safe.orbit === 'trail' ? '8 7' : undefined} />}
      {safe.orbit === 'satellites' && <><circle cx="16" cy="36" r="5" fill={colors.secondary} /><circle cx="82" cy="69" r="4" fill={colors.primary} /></>}
      <rect x="22" y="18" width="56" height="64" rx="21" fill={`url(#signal-${safe.palette}-${safe.form})`} style={{ borderRadius: rounded }} transform={safe.form === 'prism' ? 'rotate(4 50 50)' : undefined} />
      <ellipse cx="41" cy={eyeY} rx={safe.face === 'focused' ? 5 : 4} ry="5" fill={colors.ink} opacity=".9" transform={safe.face === 'focused' ? 'rotate(-12 41 46)' : undefined} />
      <ellipse cx="59" cy={eyeY} rx={safe.face === 'focused' ? 5 : 4} ry="5" fill={colors.ink} opacity=".9" transform={safe.face === 'focused' ? 'rotate(12 59 46)' : undefined} />
      {safe.face === 'bright' ? <path d="M38 58c7 9 18 9 25 0" fill="none" stroke={colors.ink} strokeWidth="4" strokeLinecap="round" /> : safe.face === 'curious' ? <circle cx="50" cy="61" r="4" fill="none" stroke={colors.ink} strokeWidth="3" /> : <path d="M43 62h14" stroke={colors.ink} strokeWidth="3.5" strokeLinecap="round" />}
      <ellipse cx="40" cy="29" rx="13" ry="8" fill="white" opacity=".24" transform="rotate(-28 40 29)" />
    </svg>
  );
}
