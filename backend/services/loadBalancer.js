// this is load balancer service

const http = require('http');
const RoundRobin = require('../algorithms/roundRobin');
const LeastActiveRequests = require('../algorithms/leastActiveRequests');
const config = require('../config');

class LoadBalancer {
  constructor() {
    this.roundRobin = new RoundRobin();
    this.leastActive = new LeastActiveRequests();

    // this is current algorithm
    this.algorithm = 'round-robin';

    // this set stores healthy server IDs
    this.healthyServers = new Set();

    // this map stores total completed requests for each server
    this.totalRequests = new Map();

    this._healthCheckTimer = null;
  }

  // this function selects a server using the current algorithm
  select() {
    if (this.algorithm === 'least-active') {
      return this.leastActive.select(config.SERVERS, this.healthyServers);
    }
    return this.roundRobin.select(config.SERVERS, this.healthyServers);
  }

  // this function records when a request starts
  onRequestStart(serverId) {
    this.leastActive.increment(serverId);
  }

  // this function records when a request ends
  onRequestEnd(serverId) {
    this.leastActive.decrement(serverId);
    this.totalRequests.set(
      serverId,
      (this.totalRequests.get(serverId) || 0) + 1
    );
  }

  // this function switches the algorithm
  setAlgorithm(algo) {
    if (algo !== 'round-robin' && algo !== 'least-active') {
      throw new Error(`Unknown algorithm: ${algo}`);
    }
    this.algorithm = algo;
  }

  // this function forwards request to backend server
  forward(server, path) {
    return new Promise((resolve, reject) => {
      const url = `${server.host}:${server.port}${path}`;
      const req = http.get(url, { timeout: config.REQUEST_TIMEOUT }, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode, data: body });
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Timeout connecting to ${server.id}`));
      });
    });
  }

  // this function checks health of all servers
  async checkHealth() {
    const results = await Promise.allSettled(
      config.SERVERS.map(async (server) => {
        try {
          const { status } = await this.forward(server, '/health');
          if (status === 200) {
            this.healthyServers.add(server.id);
          } else {
            this.healthyServers.delete(server.id);
          }
        } catch {
          this.healthyServers.delete(server.id);
        }
      })
    );
    return results;
  }

  // this function starts periodic health checks
  startHealthChecks() {
    this.checkHealth();
    this._healthCheckTimer = setInterval(
      () => this.checkHealth(),
      config.HEALTH_CHECK_INTERVAL
    );
  }

  // this function stops periodic health checks
  stopHealthChecks() {
    if (this._healthCheckTimer) {
      clearInterval(this._healthCheckTimer);
      this._healthCheckTimer = null;
    }
  }

  // this function gets server stats
  getStats() {
    return config.SERVERS.map((s) => ({
      id: s.id,
      port: s.port,
      healthy: this.healthyServers.has(s.id),
      totalRequests: this.totalRequests.get(s.id) || 0,
      activeRequests: this.leastActive.getActiveCount(s.id),
    }));
  }

  // this function resets all stats
  reset() {
    this.roundRobin.reset();
    this.leastActive.reset();
    this.totalRequests.clear();
  }
}

module.exports = LoadBalancer;
