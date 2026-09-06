import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FixedWindowRateLimiter, getClientIp } from './rate-limit';

describe('FixedWindowRateLimiter', () => {
  it('allows 10 requests in a window and blocks the 11th', () => {
    let now = 0;
    const limiter = new FixedWindowRateLimiter(10, 60_000, () => now);

    for (let index = 0; index < 10; index += 1) {
      const decision = limiter.check('127.0.0.1');
      assert.equal(decision.allowed, true);
      assert.equal(decision.remaining, 9 - index);
    }

    const blocked = limiter.check('127.0.0.1');
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.remaining, 0);
    assert.equal(blocked.retryAfterSeconds, 60);

    now += 60_000;
    assert.deepEqual(limiter.check('127.0.0.1'), {
      allowed: true,
      remaining: 9,
      retryAfterSeconds: 0,
    });
  });

  it('isolates windows by key', () => {
    const limiter = new FixedWindowRateLimiter(1, 60_000, () => 0);

    assert.equal(limiter.check('a').allowed, true);
    assert.equal(limiter.check('a').allowed, false);
    assert.equal(limiter.check('b').allowed, true);
  });

  it('reports retry-after based on remaining window time', () => {
    let now = 0;
    const limiter = new FixedWindowRateLimiter(1, 60_000, () => now);

    assert.equal(limiter.check('ip').allowed, true);
    now = 40_100;

    const blocked = limiter.check('ip');
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.retryAfterSeconds, 20);
  });
});

describe('getClientIp', () => {
  it('uses x-forwarded-for first value, then x-real-ip, then unknown', () => {
    assert.equal(
      getClientIp(new Headers({ 'x-forwarded-for': ' 203.0.113.1, 198.51.100.2 ' })),
      '203.0.113.1',
    );
    assert.equal(getClientIp(new Headers({ 'x-real-ip': '198.51.100.10' })), '198.51.100.10');
    assert.equal(getClientIp(new Headers()), 'unknown');
  });
});
