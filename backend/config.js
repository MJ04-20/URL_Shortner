/**
 * Configuration for the URL Shortener Mini Project.
 * All tuneable constants in one place.
 */

const config = {
  // Gateway
  GATEWAY_PORT: 3000,

  // Backend servers
  SERVERS: [
    { id: 'server-1', host: 'http://localhost', port: 3001 },
    { id: 'server-2', host: 'http://localhost', port: 3002 },
    { id: 'server-3', host: 'http://localhost', port: 3003 },
  ],

  // Processing delay range (ms) — makes load distribution observable
  MIN_DELAY: 300,
  MAX_DELAY: 800,

  // Health-check interval (ms)
  HEALTH_CHECK_INTERVAL: 5000,

  // Request timeout (ms)
  REQUEST_TIMEOUT: 5000,

  // Fixed Window rate limiter defaults
  FIXED_WINDOW: {
    maxRequests: 5,
    windowMs: 10_000, // 10 seconds
  },

  // Token Bucket rate limiter defaults
  TOKEN_BUCKET: {
    capacity: 5,
    refillRateMs: 3000, // 1 token every 3 seconds
  },

  // Short-code settings
  SHORT_CODE_LENGTH: 6,
};

module.exports = config;
