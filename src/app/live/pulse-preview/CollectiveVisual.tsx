'use client';

import { CirclesThreePlus, Lightning } from '@phosphor-icons/react';
import { useEffect, useRef } from 'react';
import styles from './pulse-preview.module.css';

export type CollectiveTheme = 'launch' | 'constellation';
export type SessionMode = 'first' | 'returning';

type CollectiveVisualProps = {
  benchmark: number;
  mode: SessionMode;
  responses: number;
  theme: CollectiveTheme;
};

const palette = ['#5146e5', '#2f73df', '#46c6b1', '#f0c95d', '#f09a52', '#df664e'];

function getThemeCopy(theme: CollectiveTheme, mode: SessionMode, responses: number, benchmark: number) {
  if (theme === 'constellation') {
    return mode === 'first'
      ? ['The class is taking shape', 'Each check-in adds to the picture.']
      : ['The class is coming together', 'More students are joining.'];
  }

  if (mode === 'first') {
    return responses < 8
      ? ['Getting settled', 'Check in when you’re ready.']
      : ['Let’s get ready to start', 'Each check-in brings the room together.'];
  }

  const progress = responses / Math.max(benchmark, 1);
  if (progress < 0.4) return ['Checking in', 'Join when you’re ready.'];
  if (progress < 0.8) return ['Charging up', 'The room is coming together.'];
  if (progress < 0.96) return ['Almost ready', 'A few more check-ins are arriving.'];
  return ['Let’s get started', 'The room is ready.'];
}

function seeded(index: number, salt = 0) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function hexToRgb(color: string) {
  const channels = color.match(/\w\w/g)?.map((value) => Number.parseInt(value, 16));
  return channels ?? [81, 70, 229];
}

function colorAt(progress: number, alpha = 1) {
  const bounded = Math.max(0, Math.min(0.999, progress));
  const position = bounded * (palette.length - 1);
  const index = Math.floor(position);
  const mix = position - index;
  const from = hexToRgb(palette[index]);
  const to = hexToRgb(palette[Math.min(index + 1, palette.length - 1)]);
  const channel = (offset: number) => Math.round(from[offset] + (to[offset] - from[offset]) * mix);
  return `rgba(${channel(0)}, ${channel(1)}, ${channel(2)}, ${alpha})`;
}

function drawImpact(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  progress: number,
  color: string,
  scale = 1,
) {
  if (progress >= 1) return;
  const radius = (12 + progress * 72) * scale;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.lineWidth = Math.max(1, 2.2 * (1 - progress));
  context.strokeStyle = color;
  context.globalAlpha = Math.max(0, 0.7 * (1 - progress));
  context.stroke();
  context.globalAlpha = 1;
}

function drawLaunch(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  responses: number,
  benchmark: number,
  mode: SessionMode,
  impact: number,
  now: number,
) {
  const centerX = width * 0.51;
  const centerY = height * 0.55;
  const radius = Math.min(width, height) * 0.37;
  const returning = mode === 'returning';
  const guideCount = returning ? benchmark : Math.max(24, responses);
  const active = returning ? Math.min(responses, benchmark) : responses;
  const rendered = Math.min(guideCount, 128);
  const turns = returning ? 1 : 1 + Math.min(responses, 120) / 150;
  const latestIndex = Math.max(0, Math.min(rendered - 1, returning ? Math.round((active / benchmark) * rendered) - 1 : rendered - 1));

  for (let index = 0; index < rendered; index += 1) {
    const proportion = rendered <= 1 ? 0 : index / (rendered - 1);
    const completed = returning ? proportion <= active / benchmark : true;
    const angle = -Math.PI / 2 + proportion * Math.PI * 2 * turns;
    const spiralOffset = returning ? 0 : (proportion - 0.5) * radius * 0.18;
    const segmentRadius = radius + spiralOffset;
    const x = centerX + Math.cos(angle) * segmentRadius;
    const y = centerY + Math.sin(angle) * segmentRadius;
    const segmentWidth = Math.max(4.5, radius * 0.022);
    const segmentHeight = Math.max(11, radius * 0.065);

    context.save();
    context.translate(x, y);
    context.rotate(angle + Math.PI / 2);
    context.fillStyle = completed ? colorAt(proportion) : 'rgba(16, 26, 56, 0.065)';
    if (index === latestIndex && impact < 1) {
      context.shadowBlur = 24;
      context.shadowColor = colorAt(proportion);
    }
    context.beginPath();
    context.roundRect(-segmentWidth / 2, -segmentHeight / 2, segmentWidth, segmentHeight, segmentWidth / 2);
    context.fill();
    context.restore();
  }

  const latestProgress = rendered <= 1 ? 0 : latestIndex / (rendered - 1);
  const latestAngle = -Math.PI / 2 + latestProgress * Math.PI * 2 * turns;
  const latestRadius = radius + (returning ? 0 : (latestProgress - 0.5) * radius * 0.18);
  drawImpact(
    context,
    centerX + Math.cos(latestAngle) * latestRadius,
    centerY + Math.sin(latestAngle) * latestRadius,
    impact,
    colorAt(latestProgress),
  );

  const breathe = (Math.sin(now / 900) + 1) / 2;
  const core = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 0.22);
  core.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
  core.addColorStop(0.28, `rgba(117, 100, 242, ${0.34 + breathe * 0.12})`);
  core.addColorStop(1, 'rgba(81, 70, 229, 0)');
  context.fillStyle = core;
  context.beginPath();
  context.arc(centerX, centerY, radius * 0.22, 0, Math.PI * 2);
  context.fill();
}

function constellationPoint(index: number, count: number, width: number, height: number) {
  const angle = index * 2.399963 + seeded(index, 4) * 0.18;
  const radial = Math.sqrt((index + 0.7) / Math.max(count, 1));
  return {
    x: width * 0.51 + Math.cos(angle) * radial * width * 0.39,
    y: height * 0.54 + Math.sin(angle) * radial * height * 0.39,
  };
}

function drawConstellation(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  responses: number,
  benchmark: number,
  mode: SessionMode,
  impact: number,
) {
  const returning = mode === 'returning';
  const nodeCount = Math.min(returning ? benchmark : responses, 120);
  const activeCount = Math.min(responses, nodeCount);
  const points = Array.from({ length: nodeCount }, (_, index) => constellationPoint(index, nodeCount, width, height));

  context.lineWidth = 0.8;
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    let nearest = 0;
    let distance = Number.POSITIVE_INFINITY;
    for (let candidate = Math.max(0, index - 9); candidate < index; candidate += 1) {
      const dx = point.x - points[candidate].x;
      const dy = point.y - points[candidate].y;
      const nextDistance = dx * dx + dy * dy;
      if (nextDistance < distance) {
        distance = nextDistance;
        nearest = candidate;
      }
    }
    const activeLine = index < activeCount && nearest < activeCount;
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.lineTo(points[nearest].x, points[nearest].y);
    context.strokeStyle = activeLine ? colorAt(index / Math.max(nodeCount, 1), 0.16) : 'rgba(16, 26, 56, 0.035)';
    context.stroke();
  }

  points.forEach((point, index) => {
    const active = index < activeCount;
    const radius = active ? 3.3 + seeded(index, 7) * 3.1 : 3.1;
    context.beginPath();
    context.arc(point.x, point.y, radius, 0, Math.PI * 2);
    context.fillStyle = active ? colorAt(index / Math.max(nodeCount, 1), 0.9) : 'rgba(16, 26, 56, 0.1)';
    if (active) {
      context.shadowBlur = 12;
      context.shadowColor = colorAt(index / Math.max(nodeCount, 1), 0.6);
    }
    context.fill();
    context.shadowBlur = 0;
  });

  if (activeCount > 0) {
    const latest = points[activeCount - 1];
    drawImpact(context, latest.x, latest.y, impact, colorAt(activeCount / Math.max(nodeCount, 1), 0.8));
  }
}

export default function CollectiveVisual({ benchmark, mode, responses, theme }: CollectiveVisualProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastResponseRef = useRef(responses);
  const impactStartedAtRef = useRef(0);

  useEffect(() => {
    if (responses !== lastResponseRef.current) {
      impactStartedAtRef.current = performance.now();
      lastResponseRef.current = responses;
    }
  }, [responses]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let frame = 0;
    let width = 0;
    let height = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = bounds.width;
      height = bounds.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = (now: number) => {
      context.clearRect(0, 0, width, height);
      const impact = Math.max(0, Math.min(1, (now - impactStartedAtRef.current) / 1050));
      const motionTime = reducedMotion ? 0 : now;

      if (theme === 'launch') drawLaunch(context, width, height, responses, benchmark, mode, impact, motionTime);
      if (theme === 'constellation') drawConstellation(context, width, height, responses, benchmark, mode, impact);

      if (!reducedMotion) frame = window.requestAnimationFrame(draw);
    };

    const observer = new ResizeObserver(() => {
      resize();
      if (reducedMotion) draw(performance.now());
    });
    observer.observe(canvas);
    resize();
    draw(performance.now());

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [benchmark, mode, responses, theme]);

  const copy = getThemeCopy(theme, mode, responses, benchmark);
  const Icon = theme === 'launch' ? Lightning : CirclesThreePlus;

  return (
    <div className={`${styles.collectiveVisual} ${styles[`collectiveVisual_${theme}`]}`}>
      <canvas ref={canvasRef} aria-hidden="true" />
      <div className={styles.collectiveCopy}>
        <span className={styles.collectiveBeacon}><Icon weight="fill" /></span>
        <h2>{copy[0]}</h2>
        <p>{copy[1]}</p>
      </div>
    </div>
  );
}
