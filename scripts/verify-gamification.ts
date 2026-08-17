import assert from 'node:assert/strict';
import {
  collectiveProgress,
  contributionMomentum,
  motivationConfig,
  normalizeAlias,
  privateNeighborhood,
  safeSignalAvatar,
  teamMomentum,
} from '../src/lib/gamification';

assert.equal(motivationConfig({ collectiveGoal: 2 }).collectiveGoal, 20);
assert.equal(motivationConfig({ collectiveGoal: 900 }).collectiveGoal, 500);
assert.equal(normalizeAlias('<script>'), 'script');
assert.equal(normalizeAlias('x'), 'Quiet Comet');
assert.equal(safeSignalAvatar({ palette: 'unknown' as never }).palette, 'violet');
assert.equal(collectiveProgress(25, 100), 25);
assert.equal(collectiveProgress(140, 100), 100);

const steady = { id: 'steady', points: 40, sessionsParticipated: 4, eligibleSessions: 4, optedIn: true };
const occasional = { id: 'occasional', points: 40, sessionsParticipated: 1, eligibleSessions: 4, optedIn: true };
assert.equal(contributionMomentum(steady), contributionMomentum(occasional), 'attendance must not secretly change point standing');

const largerTeam = teamMomentum({ id: 'large', name: 'Large', members: [steady, steady, steady, occasional] });
const smallerTeam = teamMomentum({ id: 'small', name: 'Small', members: [steady, steady] });
assert.equal(smallerTeam.score, largerTeam.score, 'team score should use average contribution, not raw headcount');
assert.equal(teamMomentum({ id: 'solo', name: 'Solo', members: [steady] }).eligible, false);

const neighborhood = privateNeighborhood([
  { id: 'a', points: 100, sessionsParticipated: 4, eligibleSessions: 4, optedIn: true },
  { id: 'b', points: 80, sessionsParticipated: 4, eligibleSessions: 4, optedIn: true },
  { id: 'me', points: 50, sessionsParticipated: 4, eligibleSessions: 4, optedIn: false },
  { id: 'd', points: 20, sessionsParticipated: 4, eligibleSessions: 4, optedIn: true },
  { id: 'hidden', points: 60, sessionsParticipated: 4, eligibleSessions: 4, optedIn: false },
], 'me', 1);
assert.deepEqual(neighborhood.map((student) => student.id), ['hidden', 'me', 'd']);

console.log('Gamification behavior contract verified.');
