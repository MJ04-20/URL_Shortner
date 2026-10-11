// this file starts gateway and all backend servers

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

// this is list of backend servers
const SERVERS = [
  { id: 'server-1', port: 3001 },
  { id: 'server-2', port: 3002 },
  { id: 'server-3', port: 3003 },
];
const GATEWAY_PORT = 3000;
const SERVER_SCRIPT = path.join(__dirname, 'backend', 'servers', 'server.js');
const GATEWAY_SCRIPT = path.join(__dirname, 'backend', 'gateway.js');

const children = [];

// this function launches a backend server process
function launchServer({ id, port }) {
  const child = spawn('node', [SERVER_SCRIPT], {
    env: { ...process.env, PORT: String(port), SERVER_ID: id },
    stdio: 'inherit',
  });
  child.on('error', (err) => console.error(`[${id}] Failed to start: ${err.message}`));
  children.push(child);
  return child;
}

// this function launches the gateway process
function launchGateway() {
  const child = spawn('node', [GATEWAY_SCRIPT], {
    env: { ...process.env },
    stdio: 'inherit',
  });
  child.on('error', (err) => console.error(`[gateway] Failed to start: ${err.message}`));
  children.push(child);
  return child;
}

// this function waits for a server to be healthy
function waitForHealth(port, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const req = http.get(`http://localhost:${port}/health`, (res) => {
        if (res.statusCode === 200) return resolve();
        retry();
      });
      req.on('error', retry);
      req.setTimeout(1000, () => { req.destroy(); retry(); });
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Timeout waiting for port ${port}`));
      }
      setTimeout(check, 300);
    };
    check();
  });
}

// this is main function to start everything
async function main() {
  console.log('Starting backend servers...');
  for (const s of SERVERS) {
    launchServer(s);
  }

  try {
    await Promise.all(SERVERS.map((s) => waitForHealth(s.port)));
    console.log('All backend servers are healthy.');
  } catch (err) {
    console.error(`Error: ${err.message}`);
    cleanup();
    process.exit(1);
  }

  console.log('Starting gateway...');
  launchGateway();

  console.log(`\n  URL Shortener Mini Project`);
  console.log(`  ─────────────────────────`);
  console.log(`  Gateway:    http://localhost:${GATEWAY_PORT}`);
  console.log(`  Backend 1:  http://localhost:${SERVERS[0].port}`);
  console.log(`  Backend 2:  http://localhost:${SERVERS[1].port}`);
  console.log(`  Backend 3:  http://localhost:${SERVERS[2].port}`);
  console.log(`\n  Open http://localhost:${GATEWAY_PORT} in your browser.\n`);
}

// this function stops all processes
function cleanup() {
  for (const child of children) {
    child.kill('SIGTERM');
  }
}

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
process.on('exit', cleanup);

main();
