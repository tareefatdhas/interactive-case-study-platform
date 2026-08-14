import assert from 'node:assert/strict';
import { moveCourseSession, orderCourseSessions, placeCourseSession } from '../src/lib/course-session-order';
import type { Session } from '../src/types';

const session = (id: string, createdAt: number) => ({
  id,
  createdAt: { toMillis: () => createdAt },
} as unknown as Session);

const unordered = [session('third', 300), session('first', 100), session('second', 200)];

assert.deepEqual(
  orderCourseSessions(unordered).map(({ id }) => id),
  ['first', 'second', 'third'],
  'Sessions without a saved order should follow their creation sequence.',
);

assert.deepEqual(
  orderCourseSessions(unordered, ['second', 'first']).map(({ id }) => id),
  ['second', 'first', 'third'],
  'A newly created session should be appended after the saved sequence.',
);

assert.deepEqual(
  moveCourseSession(['first', 'second', 'third'], 'third', -1),
  ['first', 'third', 'second'],
  'Move earlier should swap with the preceding session.',
);

assert.deepEqual(
  moveCourseSession(['first', 'second', 'third'], 'first', -1),
  ['first', 'second', 'third'],
  'Moving beyond the start should leave the order unchanged.',
);

assert.deepEqual(
  placeCourseSession(['first', 'second', 'third'], 'third', 'first'),
  ['third', 'first', 'second'],
  'Dragging a session should place it at the selected position.',
);

console.log('Course session ordering checks passed.');
