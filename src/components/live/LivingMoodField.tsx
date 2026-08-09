'use client';

import type { CSSProperties } from 'react';
import './living-mood-field.css';

type LivingMoodFieldProps = {
  color: string;
  currentPercent: number;
  previousPercent?: number;
  showComparison?: boolean;
  incoming?: boolean;
  replaying?: boolean;
  projector?: boolean;
  animationKey: string | number;
};

function dotVariables(index: number, count: number, outlined = false) {
  const progress = (index + 0.65) / Math.max(count, 1);
  const horizontalJitter = Math.sin(index * 12.9898) * 1.8;
  const verticalWave = Math.sin(index * 2.399) * 22 + Math.cos(index * 0.73) * 5;
  const size = (outlined ? 6.5 : 7.5) + ((index * 7) % 4);
  const roundedX = Math.round(Math.max(2, Math.min(98, progress * 100 + horizontalJitter)) * 1000) / 1000;
  const roundedY = Math.round(Math.max(10, Math.min(90, 50 + verticalWave)) * 1000) / 1000;
  return {
    '--living-x': `${roundedX}%`,
    '--living-y': `${roundedY}%`,
    '--living-size': `${size}px`,
    '--living-delay': `${Math.min(index * 14, 520)}ms`,
    '--living-drift-delay': `${-(index % 7) * 0.61}s`,
  } as CSSProperties;
}

export default function LivingMoodField({
  color,
  currentPercent,
  previousPercent = 0,
  showComparison = false,
  incoming = false,
  replaying = false,
  projector = false,
  animationKey,
}: LivingMoodFieldProps) {
  const density = projector ? 1.05 : 0.72;
  const currentDots = currentPercent ? Math.max(8, Math.min(72, Math.round(currentPercent * density))) : 0;
  const previousDots = previousPercent ? Math.max(6, Math.min(34, Math.round(previousPercent * density * 0.42))) : 0;
  const flightTarget = Math.max(4, currentPercent);
  const flightPath = `M 1 35 C ${Math.max(8, flightTarget * 0.28)} 9, ${Math.max(12, flightTarget * 0.68)} 43, ${flightTarget} 22`;

  return (
    <div
      className={`living-mood-field ${projector ? 'is-projector' : ''} ${replaying ? 'is-replaying' : ''}`}
      style={{
        '--living-color': color,
        '--living-current': `${currentPercent}%`,
        '--living-previous': `${previousPercent}%`,
      } as CSSProperties}
      data-animation-key={animationKey}
      aria-hidden="true"
    >
      <span className="living-baseline" />

      {showComparison && previousPercent > 0 && (
        <span className="living-organism living-organism-previous">
          <i className="living-contour" />
          {Array.from({ length: previousDots }).map((_, index) => (
            <i className="living-dot living-dot-previous" key={`previous-${animationKey}-${index}`} style={dotVariables(index, previousDots, true)} />
          ))}
        </span>
      )}

      <span className="living-organism living-organism-current">
        <i className="living-contour" />
        <i className="living-sweep" />
        {Array.from({ length: currentDots }).map((_, index) => (
          <i className="living-dot living-dot-current" key={`current-${animationKey}-${index}`} style={dotVariables(index, currentDots)} />
        ))}
      </span>

      {incoming && (
        <span className="living-flight">
          <svg viewBox="0 0 100 48" preserveAspectRatio="none">
            <path className="living-flight-path" d={flightPath} pathLength="100" />
            <circle className="living-flight-seed" r={projector ? 1.55 : 1.25}>
              <animateMotion dur="720ms" fill="freeze" path={flightPath} keyPoints="0;0.82;1" keyTimes="0;0.72;1" calcMode="spline" keySplines="0.2 0.75 0.25 1;0.2 0.8 0.2 1" />
            </circle>
          </svg>
          <i className="living-landing" style={{ left: `${flightTarget}%` }} />
        </span>
      )}
    </div>
  );
}
