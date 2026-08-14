import type { Session } from '@/types';

const createdAtMillis = (session: Session) => session.createdAt?.toMillis?.() || 0;

/**
 * Keep an instructor's explicit sequence first, then append any newer sessions
 * that have not been placed yet in their creation order.
 */
export const orderCourseSessions = (sessions: Session[], sessionOrder: string[] = []) => {
  const positions = new Map(sessionOrder.map((sessionId, index) => [sessionId, index]));
  return [...sessions].sort((a, b) => {
    const aPosition = positions.get(a.id);
    const bPosition = positions.get(b.id);
    if (aPosition !== undefined && bPosition !== undefined) return aPosition - bPosition;
    if (aPosition !== undefined) return -1;
    if (bPosition !== undefined) return 1;
    return createdAtMillis(a) - createdAtMillis(b);
  });
};

export const moveCourseSession = (orderedSessionIds: string[], sessionId: string, direction: -1 | 1) => {
  const currentIndex = orderedSessionIds.indexOf(sessionId);
  const nextIndex = currentIndex + direction;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedSessionIds.length) return orderedSessionIds;
  const next = [...orderedSessionIds];
  [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
  return next;
};

export const placeCourseSession = (orderedSessionIds: string[], sessionId: string, beforeSessionId: string) => {
  const currentIndex = orderedSessionIds.indexOf(sessionId);
  const nextIndex = orderedSessionIds.indexOf(beforeSessionId);
  if (currentIndex < 0 || nextIndex < 0 || currentIndex === nextIndex) return orderedSessionIds;
  const next = [...orderedSessionIds];
  const [movedSessionId] = next.splice(currentIndex, 1);
  next.splice(nextIndex, 0, movedSessionId);
  return next;
};
