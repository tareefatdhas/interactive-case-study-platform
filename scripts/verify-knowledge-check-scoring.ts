import assert from 'node:assert/strict';
import { calculateSpeedBonus } from '../src/lib/knowledge-check-scoring';

const startedAt = 1_000_000;

assert.equal(calculateSpeedBonus(startedAt, startedAt, 40, 4), 4);
assert.equal(calculateSpeedBonus(startedAt, startedAt + 10_000, 40, 4), 4);
assert.equal(calculateSpeedBonus(startedAt, startedAt + 10_001, 40, 4), 3);
assert.equal(calculateSpeedBonus(startedAt, startedAt + 25_000, 40, 4), 2);
assert.equal(calculateSpeedBonus(startedAt, startedAt + 40_000, 40, 4), 1);
assert.equal(calculateSpeedBonus(startedAt, startedAt + 40_001, 40, 4), 0);
assert.equal(calculateSpeedBonus(startedAt, startedAt - 1, 40, 4), 0);

console.log('Knowledge check speed scoring verified.');
