const signalRows = [
  { label: 'Energized', value: 38, dots: 16, color: 'var(--pulse-energized)' },
  { label: 'Steady', value: 42, dots: 18, color: 'var(--pulse-steady)' },
  { label: 'A little tired', value: 14, dots: 8, color: 'var(--pulse-tired)' },
  { label: 'Overwhelmed', value: 6, dots: 4, color: 'var(--pulse-overwhelmed)' },
];

export default function ClassSignalDemo() {
  return (
    <div className="class-signal-card" aria-label="Example live class pulse with 100 responses">
      <div className="class-signal-header">
        <div>
          <p className="seminar-eyebrow">Class pulse</p>
          <p className="mt-1 text-sm text-[var(--seminar-muted)]">ECON 302 · 100 responses</p>
        </div>
        <span className="class-signal-live"><span /> Live</span>
      </div>

      <div className="class-signal-question">
        <p className="seminar-display">How are you arriving today?</p>
        <span className="class-signal-arrival" aria-hidden="true"><i /></span>
      </div>

      <div className="class-signal-rows">
        {signalRows.map((row, rowIndex) => (
          <div className="class-signal-row" key={row.label}>
            <div className="class-signal-label">
              <span>{row.label}</span>
              <strong className="seminar-display tabular-nums">{row.value}%</strong>
            </div>
            <div className="class-signal-dots" aria-hidden="true">
              {Array.from({ length: row.dots }).map((_, index) => (
                <i
                  key={index}
                  style={{
                    backgroundColor: row.color,
                    animationDelay: `${140 + rowIndex * 90 + index * 24}ms`,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="class-signal-note">
        <span className="class-signal-note-dot" />
        <span>New responses join the pattern. Class totals stay easy to read.</span>
      </div>
    </div>
  );
}
