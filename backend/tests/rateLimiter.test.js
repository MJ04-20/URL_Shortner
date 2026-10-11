/**
 * Rate Limiter Tests — node:test
 *
 * Tests for Fixed Window Counter and Token Bucket algorithms.
 * Uses injectable clocks for deterministic testing.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const FixedWindowCounter = require('../algorithms/fixedWindow');
const TokenBucket = require('../algorithms/tokenBucket');

describe('Fixed Window Counter', () => {
  it('allows 5 requests and rejects the 6th within the same window', () => {
    let time = 0;
    const fw = new FixedWindowCounter({ maxRequests: 5, windowMs: 10000, now: () => time });

    for (let i = 0; i < 5; i++) {
      const result = fw.consume('client-1');
      assert.strictEqual(result.allowed, true, `Request ${i + 1} should be allowed`);
    }

    const rejected = fw.consume('client-1');
    assert.strictEqual(rejected.allowed, false, '6th request should be rejected');
    assert.strictEqual(rejected.remaining, 0);
    assert.ok(rejected.retryAfterMs >= 0);
  });

  it('resets after window expiration', () => {
    let time = 0;
    const fw = new FixedWindowCounter({ maxRequests: 5, windowMs: 10000, now: () => time });

    // Exhaust limit
    for (let i = 0; i < 5; i++) fw.consume('client-1');
    assert.strictEqual(fw.consume('client-1').allowed, false);

    // Advance time past window
    time = 10001;
    const result = fw.consume('client-1');
    assert.strictEqual(result.allowed, true, 'Should be allowed after window reset');
    assert.strictEqual(result.remaining, 4);
  });

  it('tracks separate clients independently', () => {
    let time = 0;
    const fw = new FixedWindowCounter({ maxRequests: 2, windowMs: 5000, now: () => time });

    fw.consume('client-A');
    fw.consume('client-A');
    assert.strictEqual(fw.consume('client-A').allowed, false);

    // client-B should still have its full quota
    assert.strictEqual(fw.consume('client-B').allowed, true);
  });

  it('reports correct remaining count', () => {
    let time = 0;
    const fw = new FixedWindowCounter({ maxRequests: 3, windowMs: 5000, now: () => time });

    assert.strictEqual(fw.consume('client-1').remaining, 2);
    assert.strictEqual(fw.consume('client-1').remaining, 1);
    assert.strictEqual(fw.consume('client-1').remaining, 0);
  });

  it('tracks accepted and rejected counters', () => {
    let time = 0;
    const fw = new FixedWindowCounter({ maxRequests: 2, windowMs: 5000, now: () => time });

    fw.consume('c1');
    fw.consume('c1');
    fw.consume('c1'); // rejected

    assert.strictEqual(fw.accepted, 2);
    assert.strictEqual(fw.rejected, 1);
  });
});

describe('Token Bucket', () => {
  it('allows requests when tokens are available', () => {
    let time = 0;
    const tb = new TokenBucket({ capacity: 3, refillRateMs: 1000, now: () => time });

    for (let i = 0; i < 3; i++) {
      assert.strictEqual(tb.consume('client-1').allowed, true);
    }
  });

  it('rejects a request when no tokens remain', () => {
    let time = 0;
    const tb = new TokenBucket({ capacity: 2, refillRateMs: 1000, now: () => time });

    tb.consume('client-1');
    tb.consume('client-1');
    const result = tb.consume('client-1');
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.remaining, 0);
    assert.ok(result.retryAfterMs >= 0);
  });

  it('replenishes tokens according to elapsed time', () => {
    let time = 0;
    const tb = new TokenBucket({ capacity: 3, refillRateMs: 1000, now: () => time });

    // Drain all tokens
    tb.consume('client-1');
    tb.consume('client-1');
    tb.consume('client-1');
    assert.strictEqual(tb.consume('client-1').allowed, false);

    // Advance time by 2 seconds → 2 tokens refilled
    time = 2000;
    assert.strictEqual(tb.consume('client-1').allowed, true);
    assert.strictEqual(tb.consume('client-1').allowed, true);
    assert.strictEqual(tb.consume('client-1').allowed, false); // only 2 refilled
  });

  it('does not exceed bucket capacity when refilling', () => {
    let time = 0;
    const tb = new TokenBucket({ capacity: 3, refillRateMs: 1000, now: () => time });

    // Use one token
    tb.consume('client-1');

    // Advance a long time — should cap at capacity
    time = 100000;
    const status = tb.status('client-1');
    assert.strictEqual(status.remaining, 3); // capped at capacity
  });

  it('tracks accepted and rejected counters', () => {
    let time = 0;
    const tb = new TokenBucket({ capacity: 2, refillRateMs: 5000, now: () => time });

    tb.consume('c1');
    tb.consume('c1');
    tb.consume('c1'); // rejected

    assert.strictEqual(tb.accepted, 2);
    assert.strictEqual(tb.rejected, 1);
  });

  it('returns correct retry-after duration', () => {
    let time = 0;
    const tb = new TokenBucket({ capacity: 1, refillRateMs: 3000, now: () => time });

    tb.consume('client-1'); // drains the one token

    time = 1000; // only 1s elapsed of 3s refill
    const result = tb.consume('client-1');
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.retryAfterMs, 2000); // 3000 - 1000 = 2000ms until next token
  });
});
