// this is backend server process

const express = require('express');

const PORT = parseInt(process.env.PORT, 10) || 3001;
const SERVER_ID = process.env.SERVER_ID || 'server-1';
const MIN_DELAY = parseInt(process.env.MIN_DELAY, 10) || 300;
const MAX_DELAY = parseInt(process.env.MAX_DELAY, 10) || 800;

const app = express();

// this is server stats
let totalRequests = 0;
let activeRequests = 0;
let requestCounter = 0;

// this is health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', serverId: SERVER_ID, port: PORT });
});

// this is process endpoint to simulate work
app.get('/process', async (req, res) => {
  activeRequests++;
  totalRequests++;
  requestCounter++;
  const requestId = `${SERVER_ID}-req-${requestCounter}`;
  const delay = Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY;

  try {
    await new Promise((resolve) => setTimeout(resolve, delay));
    res.json({
      serverId: SERVER_ID,
      port: PORT,
      requestId,
      processingTime: delay,
      activeRequests,
      totalRequests,
    });
  } finally {
    activeRequests--;
  }
});

// this is stats endpoint
app.get('/stats', (_req, res) => {
  res.json({
    serverId: SERVER_ID,
    port: PORT,
    totalRequests,
    activeRequests,
  });
});

// this function starts listening on port
const server = app.listen(PORT, () => {
  console.log(`[${SERVER_ID}] Backend server running on port ${PORT}`);
});

// this is for shutdown
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});

module.exports = app;
