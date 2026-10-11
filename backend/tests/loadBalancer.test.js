/**
 * Load Balancer Tests — node:test
 *
 * Tests for Round Robin and Least Active Requests algorithms.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const RoundRobin = require('../algorithms/roundRobin');
const LeastActiveRequests = require('../algorithms/leastActiveRequests');

const SERVERS = [
  { id: 'server-1', port: 3001 },
  { id: 'server-2', port: 3002 },
  { id: 'server-3', port: 3003 },
];

describe('Round Robin', () => {
  it('distributes 6 sequential requests evenly across 3 servers', () => {
    const rr = new RoundRobin();
    const allHealthy = new Set(['server-1', 'server-2', 'server-3']);
    const results = [];

    for (let i = 0; i < 6; i++) {
      results.push(rr.select(SERVERS, allHealthy).id);
    }

    assert.deepStrictEqual(results, [
      'server-1', 'server-2', 'server-3',
      'server-1', 'server-2', 'server-3',
    ]);
  });

  it('skips unhealthy servers', () => {
    const rr = new RoundRobin();
    const healthy = new Set(['server-1', 'server-3']); // server-2 down
    const results = [];

    for (let i = 0; i < 4; i++) {
      results.push(rr.select(SERVERS, healthy).id);
    }

    assert.deepStrictEqual(results, [
      'server-1', 'server-3', 'server-1', 'server-3',
    ]);
  });

  it('returns null when no servers are healthy', () => {
    const rr = new RoundRobin();
    const result = rr.select(SERVERS, new Set());
    assert.strictEqual(result, null);
  });

  it('reset restores index to 0', () => {
    const rr = new RoundRobin();
    const allHealthy = new Set(['server-1', 'server-2', 'server-3']);
    rr.select(SERVERS, allHealthy); // server-1
    rr.select(SERVERS, allHealthy); // server-2
    rr.reset();
    const result = rr.select(SERVERS, allHealthy);
    assert.strictEqual(result.id, 'server-1');
  });
});

describe('Least Active Requests', () => {
  it('selects the server with the smallest active request count', () => {
    const la = new LeastActiveRequests();
    const allHealthy = new Set(['server-1', 'server-2', 'server-3']);

    // Simulate: server-1 has 3 active, server-2 has 1, server-3 has 2
    la.activeRequests.set('server-1', 3);
    la.activeRequests.set('server-2', 1);
    la.activeRequests.set('server-3', 2);

    const selected = la.select(SERVERS, allHealthy);
    assert.strictEqual(selected.id, 'server-2');
  });

  it('uses deterministic tie-breaking (first in list order)', () => {
    const la = new LeastActiveRequests();
    const allHealthy = new Set(['server-1', 'server-2', 'server-3']);

    // All have 0 active requests — should pick server-1 (first)
    const selected = la.select(SERVERS, allHealthy);
    assert.strictEqual(selected.id, 'server-1');
  });

  it('skips unhealthy servers', () => {
    const la = new LeastActiveRequests();
    const healthy = new Set(['server-2', 'server-3']); // server-1 down

    la.activeRequests.set('server-2', 5);
    la.activeRequests.set('server-3', 2);

    const selected = la.select(SERVERS, healthy);
    assert.strictEqual(selected.id, 'server-3');
  });

  it('decrements active counter after success and failure', () => {
    const la = new LeastActiveRequests();

    la.increment('server-1');
    la.increment('server-1');
    assert.strictEqual(la.getActiveCount('server-1'), 2);

    la.decrement('server-1'); // success
    assert.strictEqual(la.getActiveCount('server-1'), 1);

    la.decrement('server-1'); // failure in finally block
    assert.strictEqual(la.getActiveCount('server-1'), 0);

    // Should not go below 0
    la.decrement('server-1');
    assert.strictEqual(la.getActiveCount('server-1'), 0);
  });

  it('returns null when no servers are healthy', () => {
    const la = new LeastActiveRequests();
    const result = la.select(SERVERS, new Set());
    assert.strictEqual(result, null);
  });
});
