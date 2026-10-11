// this is gateway api server

const express = require('express');
const path = require('path');
const config = require('./config');
const UrlService = require('./services/urlService');
const LoadBalancer = require('./services/loadBalancer');
const FixedWindowCounter = require('./algorithms/fixedWindow');
const TokenBucket = require('./algorithms/tokenBucket');

const app = express();
app.use(express.json());

// this is for reading client ip properly
app.set('trust proxy', 1);

// this serves frontend static files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// this initializes services
const urlService = new UrlService();
const loadBalancer = new LoadBalancer();

const fixedWindow = new FixedWindowCounter({
  maxRequests: config.FIXED_WINDOW.maxRequests,
  windowMs: config.FIXED_WINDOW.windowMs,
});
const tokenBucket = new TokenBucket({
  capacity: config.TOKEN_BUCKET.capacity,
  refillRateMs: config.TOKEN_BUCKET.refillRateMs,
});

// this stores currently active rate limiter
let activeRateLimiter = 'fixed-window';

// this function gets active rate limiter instance
function getRateLimiter() {
  return activeRateLimiter === 'token-bucket' ? tokenBucket : fixedWindow;
}

// this function gets client ip address
function getClientId(req) {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

// this function is rate limiting middleware
function rateLimitMiddleware(req, res, next) {
  const clientId = getClientId(req);
  const limiter = getRateLimiter();
  const result = limiter.consume(clientId);

  res.set('X-RateLimit-Remaining', String(result.remaining));
  res.set('X-RateLimit-Algorithm', activeRateLimiter);

  if (!result.allowed) {
    res.set('Retry-After', String(Math.ceil((result.retryAfterMs || 1000) / 1000)));
    return res.status(429).json({
      error: 'Too Many Requests',
      algorithm: activeRateLimiter,
      retryAfterMs: result.retryAfterMs,
      remaining: 0,
    });
  }

  next();
}

// this endpoint creates short url
app.post('/api/shorten', rateLimitMiddleware, (req, res) => {
  const { url } = req.body;

  if (!url || !urlService.isValidUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL. Must be a valid http or https URL.' });
  }

  const { shortCode, created } = urlService.shorten(url);
  const shortUrl = `${req.protocol}://${req.get('host')}/${shortCode}`;

  res.status(created ? 201 : 200).json({ shortCode, shortUrl, originalUrl: url });
});

// this endpoint forwards load balanced request
app.get('/api/process', rateLimitMiddleware, async (req, res) => {
  const server = loadBalancer.select();
  if (!server) {
    return res.status(503).json({ error: 'No healthy backend servers available' });
  }

  loadBalancer.onRequestStart(server.id);
  try {
    const result = await loadBalancer.forward(server, '/process');
    res.json({
      ...result.data,
      algorithm: loadBalancer.algorithm,
      selectedServer: server.id,
    });
  } catch (err) {
    // this tries fallback server if first one fails
    const fallback = loadBalancer.select();
    if (fallback && fallback.id !== server.id) {
      try {
        loadBalancer.onRequestStart(fallback.id);
        const result = await loadBalancer.forward(fallback, '/process');
        res.json({
          ...result.data,
          algorithm: loadBalancer.algorithm,
          selectedServer: fallback.id,
          fallback: true,
        });
        return;
      } catch {
        // fallback failed
      } finally {
        loadBalancer.onRequestEnd(fallback.id);
      }
    }
    res.status(502).json({ error: `Backend error: ${err.message}`, serverId: server.id });
  } finally {
    loadBalancer.onRequestEnd(server.id);
  }
});

// this endpoint returns server stats
app.get('/api/stats', (_req, res) => {
  res.json({
    servers: loadBalancer.getStats(),
    loadBalancerAlgorithm: loadBalancer.algorithm,
    rateLimiterAlgorithm: activeRateLimiter,
  });
});

// this endpoint returns rate limit status
app.get('/api/rate-limit/status', (req, res) => {
  const clientId = getClientId(req);
  const limiter = getRateLimiter();
  const status = limiter.status(clientId);

  res.json({
    algorithm: activeRateLimiter,
    accepted: limiter.accepted,
    rejected: limiter.rejected,
    remaining: status.remaining,
    lastRejection: limiter.lastRejection,
    config: activeRateLimiter === 'fixed-window'
      ? { maxRequests: fixedWindow.maxRequests, windowMs: fixedWindow.windowMs }
      : { capacity: tokenBucket.capacity, refillRateMs: tokenBucket.refillRateMs },
  });
});

// this endpoint changes load balancer algorithm
app.post('/api/load-balancer/algorithm', (req, res) => {
  const { algorithm } = req.body;
  try {
    loadBalancer.setAlgorithm(algorithm);
    res.json({ algorithm: loadBalancer.algorithm });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// this endpoint changes rate limit algorithm
app.post('/api/rate-limit/algorithm', (req, res) => {
  const { algorithm } = req.body;
  if (algorithm !== 'fixed-window' && algorithm !== 'token-bucket') {
    return res.status(400).json({ error: `Unknown algorithm: ${algorithm}` });
  }
  activeRateLimiter = algorithm;
  res.json({ algorithm: activeRateLimiter });
});

// this endpoint configures rate limiter
app.post('/api/rate-limit/configure', (req, res) => {
  const { maxRequests, windowMs, capacity, refillRateMs } = req.body;
  if (activeRateLimiter === 'fixed-window') {
    fixedWindow.configure({ maxRequests, windowMs });
  } else {
    tokenBucket.configure({ capacity, refillRateMs });
  }
  res.json({ message: 'Configuration updated', algorithm: activeRateLimiter });
});

// this endpoint resets all stats
app.post('/api/reset', (_req, res) => {
  loadBalancer.reset();
  fixedWindow.reset();
  tokenBucket.reset();
  res.json({ message: 'All statistics reset' });
});

// this endpoint redirects short code to original url
app.get('/:shortCode', (req, res) => {
  const originalUrl = urlService.resolve(req.params.shortCode);
  if (!originalUrl) {
    return res.status(404).json({ error: 'Short URL not found' });
  }
  res.redirect(301, originalUrl);
});

// this function starts the server
if (require.main === module) {
  const server = app.listen(config.GATEWAY_PORT, () => {
    console.log(`[gateway] API Gateway running on port ${config.GATEWAY_PORT}`);
    console.log(`[gateway] Frontend: http://localhost:${config.GATEWAY_PORT}`);
    loadBalancer.startHealthChecks();
  });

  process.on('SIGTERM', () => {
    loadBalancer.stopHealthChecks();
    server.close(() => process.exit(0));
  });
  process.on('SIGINT', () => {
    loadBalancer.stopHealthChecks();
    server.close(() => process.exit(0));
  });
}

module.exports = app;
