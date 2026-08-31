export type NumericScale = 'linear' | 'log' | 'symlog';

export type NumericDistribution = {
  values: number[];
  points: Array<{ value: number; position: number }>;
  ticks: Array<{ value: number; position: number }>;
  minimum: number;
  maximum: number;
  median: number;
  average: number;
  scale: NumericScale;
};

const MAX_ABSOLUTE_RESPONSE = 1_000_000_000_000_000;
const COMPACT_FORMATTER = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const EXACT_FORMATTER = new Intl.NumberFormat('en', {
  maximumFractionDigits: 6,
});

function normalizeSeparators(raw: string) {
  const value = raw.replace(/[\s_'’]/g, '');
  const comma = value.lastIndexOf(',');
  const dot = value.lastIndexOf('.');

  if (comma >= 0 && dot >= 0) {
    return comma > dot
      ? value.replace(/\./g, '').replace(',', '.')
      : value.replace(/,/g, '');
  }
  if (comma >= 0) {
    const parts = value.split(',');
    const groupedThousands = parts.length > 1 && parts.slice(1).every((part) => part.length === 3);
    return groupedThousands ? parts.join('') : `${parts.slice(0, -1).join('')}.${parts.at(-1)}`;
  }
  if ((value.match(/\./g) || []).length > 1) {
    const parts = value.split('.');
    const groupedThousands = parts.slice(1).every((part) => part.length === 3);
    return groupedThousands ? parts.join('') : `${parts.slice(0, -1).join('')}.${parts.at(-1)}`;
  }
  return value;
}

export function parseNumericResponse(raw: string): number | null {
  const cleaned = raw
    .trim()
    .normalize('NFKC')
    .replace(/[−–—]/g, '-')
    .replace(/^[€£¥$฿₹]\s*/, '')
    .replace(/\s*(?:%|€|£|¥|\$|฿|₹)$/, '');
  const suffixMatch = cleaned.match(/([kmbt])$/i);
  const suffix = suffixMatch?.[1].toLocaleLowerCase() || '';
  const numericText = normalizeSeparators(suffix ? cleaned.slice(0, -1) : cleaned);
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(numericText)) return null;

  const multiplier = suffix === 'k' ? 1_000
    : suffix === 'm' ? 1_000_000
      : suffix === 'b' ? 1_000_000_000
        : suffix === 't' ? 1_000_000_000_000
          : 1;
  const value = Number(numericText) * multiplier;
  return Number.isFinite(value) && Math.abs(value) <= MAX_ABSOLUTE_RESPONSE ? value : null;
}

export function formatNumericValue(value: number, unit = '', compact = false) {
  const formatted = compact && Math.abs(value) >= 1_000
    ? COMPACT_FORMATTER.format(value)
    : EXACT_FORMATTER.format(value);
  const normalizedUnit = unit.trim();
  if (!normalizedUnit) return formatted;
  if (/^[€£¥$฿₹]$/.test(normalizedUnit)) return `${normalizedUnit}${formatted}`;
  if (normalizedUnit === '%') return `${formatted}%`;
  return `${formatted} ${normalizedUnit}`;
}

export function buildNumericDistribution(rawValues: number[]): NumericDistribution | null {
  const values = rawValues.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!values.length) return null;
  const minimum = values[0];
  const maximum = values.at(-1)!;
  const middle = Math.floor(values.length / 2);
  const median = values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const nonZeroMagnitudes = values.filter((value) => value !== 0).map(Math.abs);
  const smallestMagnitude = nonZeroMagnitudes.length ? Math.min(...nonZeroMagnitudes) : 1;
  const largestMagnitude = nonZeroMagnitudes.length ? Math.max(...nonZeroMagnitudes) : 1;
  const veryWide = largestMagnitude / Math.max(smallestMagnitude, Number.EPSILON) >= 1_000;
  const allPositive = minimum > 0;
  const allNegative = maximum < 0;
  const scale: NumericScale = veryWide && allPositive
    ? 'log'
    : veryWide && (allNegative || (minimum < 0 && maximum > 0))
      ? 'symlog'
      : 'linear';
  const symlogConstant = Math.max(smallestMagnitude, 1e-9);
  const transform = (value: number) => scale === 'log'
    ? Math.log10(value)
    : scale === 'symlog'
      ? Math.sign(value) * Math.log10(1 + Math.abs(value) / symlogConstant)
      : value;
  const inverse = (value: number) => scale === 'log'
    ? 10 ** value
    : scale === 'symlog'
      ? Math.sign(value) * symlogConstant * (10 ** Math.abs(value) - 1)
      : value;
  const transformedMinimum = transform(minimum);
  const transformedMaximum = transform(maximum);
  const transformedRange = transformedMaximum - transformedMinimum;
  const position = (value: number) => transformedRange === 0
    ? 50
    : 4 + ((transform(value) - transformedMinimum) / transformedRange) * 92;
  const tickCount = transformedRange === 0 ? 1 : 5;
  const ticks = Array.from({ length: tickCount }, (_, index) => {
    const ratio = tickCount === 1 ? 0.5 : index / (tickCount - 1);
    const transformed = transformedMinimum + transformedRange * ratio;
    return { value: inverse(transformed), position: 4 + ratio * 92 };
  });

  return {
    values,
    points: values.map((value) => ({ value, position: position(value) })),
    ticks,
    minimum,
    maximum,
    median,
    average,
    scale,
  };
}
