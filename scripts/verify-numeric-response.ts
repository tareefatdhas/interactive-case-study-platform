import assert from 'node:assert/strict';
import { buildNumericDistribution, formatNumericValue, parseNumericResponse } from '../src/lib/numeric-response';

assert.equal(parseNumericResponse('2'), 2);
assert.equal(parseNumericResponse('30,000,000'), 30_000_000);
assert.equal(parseNumericResponse('30m'), 30_000_000);
assert.equal(parseNumericResponse('$ 2.5k'), 2_500);
assert.equal(parseNumericResponse('12.5%'), 12.5);
assert.equal(parseNumericResponse('-1,5'), -1.5);
assert.equal(parseNumericResponse('not a number'), null);

const ordinary = buildNumericDistribution([2, 3, 4, 5]);
assert.equal(ordinary?.scale, 'linear');
assert.equal(ordinary?.median, 3.5);
assert.equal(ordinary?.points[0].position, 4);
assert.equal(ordinary?.points.at(-1)?.position, 96);

const ordinaryLargeValues = buildNumericDistribution([2_000, 3_500, 5_000]);
assert.equal(ordinaryLargeValues?.scale, 'linear');

const wide = buildNumericDistribution([2, 5, 30_000_000]);
assert.equal(wide?.scale, 'log');
assert.ok((wide?.points[1].position || 0) > 4);
assert.equal(wide?.points.at(-1)?.position, 96);

const mixed = buildNumericDistribution([-1_000_000, 0, 2, 5_000_000]);
assert.equal(mixed?.scale, 'symlog');
assert.ok((mixed?.points[1].position || 0) > 4);

assert.equal(formatNumericValue(30_000_000, 'USD', true), '30M USD');
assert.equal(formatNumericValue(12.5, '%'), '12.5%');
assert.equal(formatNumericValue(2500, '$', true), '$2.5K');

console.log('PASS Numeric input accepts readable formatting and shorthand.');
console.log('PASS Numeric distributions choose linear, logarithmic, and signed logarithmic scales.');
