'use client';

import { useEffect, useState } from 'react';
import Lottie from 'lottie-react';

// A small, one-time signal for a completed contribution. It is deliberately
// abstract so it celebrates participation without turning responses into a game.
const participationSignal = {
  v: '5.7.4',
  fr: 30,
  ip: 0,
  op: 34,
  w: 64,
  h: 64,
  nm: 'Participation signal',
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'Outer ring',
      sr: 1,
      ks: {
        o: { a: 1, k: [{ t: 0, s: [85] }, { t: 28, s: [0] }] },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [32, 32, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 1, k: [{ t: 0, s: [45, 45, 100] }, { t: 28, s: [165, 165, 100] }] },
      },
      shapes: [
        { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [27, 27] }, nm: 'Ellipse' },
        { ty: 'st', c: { a: 0, k: [0.318, 0.275, 0.898, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 2 }, lc: 2, lj: 2, nm: 'Stroke' },
      ],
      ip: 0,
      op: 34,
      st: 0,
      bm: 0,
    },
    {
      ddd: 0,
      ind: 2,
      ty: 4,
      nm: 'Center point',
      sr: 1,
      ks: {
        o: { a: 1, k: [{ t: 0, s: [0] }, { t: 5, s: [100] }, { t: 25, s: [100] }, { t: 34, s: [0] }] },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [32, 32, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 1, k: [{ t: 0, s: [40, 40, 100] }, { t: 10, s: [108, 108, 100] }, { t: 18, s: [92, 92, 100] }, { t: 28, s: [100, 100, 100] }] },
      },
      shapes: [
        { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [17, 17] }, nm: 'Ellipse' },
        { ty: 'fl', c: { a: 0, k: [0.318, 0.275, 0.898, 1] }, o: { a: 0, k: 100 }, r: 1, nm: 'Fill' },
      ],
      ip: 0,
      op: 34,
      st: 0,
      bm: 0,
    },
    {
      ddd: 0,
      ind: 3,
      ty: 4,
      nm: 'Check',
      sr: 1,
      ks: {
        o: { a: 1, k: [{ t: 8, s: [0] }, { t: 14, s: [100] }, { t: 30, s: [100] }, { t: 34, s: [0] }] },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [32, 32, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      shapes: [
        {
          ty: 'sh',
          ks: { a: 0, k: { i: [[0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0]], v: [[-8, 0], [-2, 6], [10, -7]], c: false } },
          nm: 'Path',
        },
        { ty: 'st', c: { a: 0, k: [1, 1, 1, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 2.8 }, lc: 2, lj: 2, nm: 'Stroke' },
      ],
      ip: 0,
      op: 34,
      st: 0,
      bm: 0,
    },
  ],
} as const;

export default function ParticipationSignal({ active }: { active: boolean }) {
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  if (!active || reducedMotion) return null;

  return (
    <span className="participation-signal" aria-hidden="true">
      <Lottie animationData={participationSignal} loop={false} autoplay />
    </span>
  );
}
