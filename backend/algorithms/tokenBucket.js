// this is token bucket rate limiter algorithm

class TokenBucket {
  constructor({ capacity = 5, refillRateMs = 3000, now } = {}) {
    this.capacity = capacity;
    this.refillRateMs = refillRateMs;
    this._now = now || (() => Date.now());

    // this map stores tokens and last refill time for each client
    this.clients = new Map();

    // this is stats counters
    this.accepted = 0;
    this.rejected = 0;
    this.lastRejection = null;
  }

  // this function refills tokens based on elapsed time
  _refill(entry, now) {
    const elapsed = now - entry.lastRefill;
    const newTokens = Math.floor(elapsed / this.refillRateMs);
    if (newTokens > 0) {
      entry.tokens = Math.min(this.capacity, entry.tokens + newTokens);
      entry.lastRefill += newTokens * this.refillRateMs;
    }
  }

  // this function checks if a token is available for the client
  consume(clientId) {
    const now = this._now();
    let entry = this.clients.get(clientId);

    if (!entry) {
      entry = { tokens: this.capacity, lastRefill: now };
      this.clients.set(clientId, entry);
    }

    this._refill(entry, now);

    if (entry.tokens >= 1) {
      entry.tokens--;
      this.accepted++;
      return { allowed: true, remaining: entry.tokens, retryAfterMs: null };
    }

    // this is when no tokens are available
    this.rejected++;
    const retryAfterMs = this.refillRateMs - (now - entry.lastRefill);
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
    if (!entry) return { remaining: this.capacity };
    this._refill(entry, now);
    return { remaining: entry.tokens };
  }

  // this function resets all data
  reset() {
    this.clients.clear();
    this.accepted = 0;
    this.rejected = 0;
    this.lastRejection = null;
  }

  // this function updates configuration
  configure({ capacity, refillRateMs }) {
    if (capacity !== undefined) this.capacity = capacity;
    if (refillRateMs !== undefined) this.refillRateMs = refillRateMs;
    this.reset();
  }
}

module.exports = TokenBucket;
