export const KNOWLEDGE_CHECK_CORRECT_POINTS = 8;
export const DEFAULT_SPEED_BONUS_POINTS = 4;
export const DEFAULT_SPEED_BONUS_SECONDS = 40;

export function calculateSpeedBonus(
  startedAt: number,
  submittedAt: number,
  windowSeconds = DEFAULT_SPEED_BONUS_SECONDS,
  maximumPoints = DEFAULT_SPEED_BONUS_POINTS,
) {
  if (!Number.isFinite(startedAt) || !Number.isFinite(submittedAt) || submittedAt < startedAt) return 0;
  const safeWindowSeconds = Math.max(1, windowSeconds);
  const safeMaximumPoints = Math.max(0, Math.round(maximumPoints));
  if (!safeMaximumPoints) return 0;
  const elapsedSeconds = (submittedAt - startedAt) / 1000;
  if (elapsedSeconds > safeWindowSeconds) return 0;
  const bandSeconds = safeWindowSeconds / safeMaximumPoints;
  const elapsedBand = Math.min(safeMaximumPoints - 1, Math.max(0, Math.ceil(elapsedSeconds / bandSeconds) - 1));
  return safeMaximumPoints - elapsedBand;
}
