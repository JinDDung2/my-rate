import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatRateBpPercentPoint } from './format';

describe('formatRateBpPercentPoint', () => {
  it('formats basis points as percent-point values without unnecessary trailing zeroes', () => {
    assert.equal(formatRateBpPercentPoint(100), '1%p');
    assert.equal(formatRateBpPercentPoint(50), '0.5%p');
    assert.equal(formatRateBpPercentPoint(25), '0.25%p');
    assert.equal(formatRateBpPercentPoint(10), '0.1%p');
  });
});
