import type { SessionParticipationSummary } from '@/lib/session-response-summary';

interface ParticipationTrendProps {
  summary: SessionParticipationSummary;
}

const shorten = (value: string) => value.length > 20 ? `${value.slice(0, 18)}…` : value;

const colorForParticipation = (percent: number) => {
  if (percent < 75) return '#d25645';
  if (percent < 90) return '#c47a10';
  return '#5146e5';
};

export default function ParticipationTrend({ summary }: ParticipationTrendProps) {
  const items = summary.interactions;
  const width = Math.max(680, 96 + Math.max(0, items.length - 1) * 150);
  const height = 238;
  const plotLeft = 54;
  const plotRight = width - 42;
  const plotTop = 38;
  const plotBottom = 158;
  const xFor = (index: number) => items.length === 1
    ? (plotLeft + plotRight) / 2
    : plotLeft + (index / (items.length - 1)) * (plotRight - plotLeft);
  const yFor = (percent: number) => plotBottom - (percent / 100) * (plotBottom - plotTop);
  const points = items.map((item, index) => ({
    ...item,
    x: xFor(index),
    y: yFor(item.participationPercent),
  }));
  const runCounts = items.reduce((counts, item) => {
    counts.set(item.interactionId, (counts.get(item.interactionId) || 0) + 1);
    return counts;
  }, new Map<string, number>());
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${plotBottom} L ${points[0].x} ${plotBottom} Z`
    : '';

  return (
    <figure>
      <div className="overflow-x-auto pb-2">
        <svg
          className="block"
          style={{ minWidth: width }}
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-labelledby="participation-trend-title participation-trend-description"
        >
          <title id="participation-trend-title">Participation across the session</title>
          <desc id="participation-trend-description">
            Each interaction is compared with the session&apos;s busiest response activity.
          </desc>

          {[0, 50, 100].map((value) => {
            const y = yFor(value);
            return (
              <g key={value}>
                <line x1={plotLeft} x2={plotRight} y1={y} y2={y} stroke="#e5e6ed" strokeDasharray={value === 0 ? undefined : '4 7'} />
                <text x={plotLeft - 12} y={y + 4} textAnchor="end" fill="#8a90a2" fontSize="11">{value}%</text>
              </g>
            );
          })}

          {areaPath && <path d={areaPath} fill="#f0efff" opacity="0.72" />}
          {linePath && <path d={linePath} fill="none" stroke="#5146e5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}

          {points.map((point) => (
            <g key={point.runId}>
              <circle cx={point.x} cy={point.y} r="7" fill="#fff" stroke={colorForParticipation(point.participationPercent)} strokeWidth="4" />
              <text x={point.x} y={point.y - 15} textAnchor="middle" fill={colorForParticipation(point.participationPercent)} fontSize="14" fontWeight="700">
                {point.participationPercent}%
              </text>
              <text x={point.x} y={190} textAnchor="middle" fill="#101a38" fontSize="12" fontWeight="650">
                {shorten(point.title)}
              </text>
              <text x={point.x} y={210} textAnchor="middle" fill="#73798d" fontSize="11">
                {(runCounts.get(point.interactionId) || 0) > 1 ? `Round ${point.round} · ` : ''}{point.responseCount} responses
              </text>
              {point.isBenchmark && (
                <text x={point.x} y={228} textAnchor="middle" fill="#5146e5" fontSize="9" fontWeight="750" letterSpacing="1">
                  PEAK
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      <figcaption className="mt-3 border-t border-[#eceef3] pt-4 text-xs leading-5 text-[#73798d]">
        The busiest response activity is set to 100%. Amber marks 75% to 89% of peak participation, and coral marks below 75%. Activities with no responses are treated as not run. Timers, wheels, and team submissions are excluded because they use different participation units.
      </figcaption>
    </figure>
  );
}
