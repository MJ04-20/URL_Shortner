// this is fixed window rate limiter algorithm

class FixedWindowCounter {
  constructor({ maxRequests = 5, windowMs = 10_000, now } = {}) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this._now = now || (() => Date.now());

    // this map stores client request count and window start time
    this.clients = new Map();

    // this is stats counters
    this.accepted = 0;
    this.rejected = 0;
    this.lastRejection = null;
  }

  // this function checks if client request is allowed or rate limited
  consume(clientId) {
    const now = this._now();
    let entry = this.clients.get(clientId);

    // this resets the window when time expires
    if (!entry || now - entry.windowStart >= this.windowMs) {
      entry = { count: 0, windowStart: now };
      this.clients.set(clientId, entry);
    }

    if (entry.count < this.maxRequests) {
      entry.count++;
      this.accepted++;
      const remaining = this.maxRequests - entry.count;
      return { allowed: true, remaining, retryAfterMs: null };
    }

    // this is when limit is reached
    this.rejected++;
    const retryAfterMs = this.windowMs - (now - entry.windowStart);
    this.lastRejection = new Date(now).toISOString();
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, retryAfterMs),
    };
  }

  // this function returns status for a client
  status(clientId) {
    const now = this._now();
    const entry = this.clients.get(clientId);
    if (!entry || now - entry.windowStart >= this.windowMs) {
      return { remaining: this.maxRequests };
    }
    return { remaining: Math.max(0, this.maxRequests - entry.count) };
  }

  // this function resets all data
  reset() {
    this.clients.clear();
    this.accepted = 0;
    this.rejected = 0;
    this.lastRejection = null;
  }

  // this function updates configuration
  configure({ maxRequests, windowMs }) {
    if (maxRequests !== undefined) this.maxRequests = maxRequests;
    if (windowMs !== undefined) this.windowMs = windowMs;
    this.reset();
  }
}

module.exports = FixedWindowCounter;
