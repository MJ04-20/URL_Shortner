// this is least active requests algorithm

class LeastActiveRequests {
  constructor() {
    // this map stores active request count for each server
    this.activeRequests = new Map();
  }

  // this function selects the server with least active requests
  select(servers, healthyIds) {
    let best = null;
    let bestCount = Infinity;

    for (const server of servers) {
      if (!healthyIds.has(server.id)) continue;
      const count = this.activeRequests.get(server.id) || 0;
      if (count < bestCount) {
        best = server;
        bestCount = count;
      }
    }

    return best;
  }

  // this function increases active requests count
  increment(serverId) {
    this.activeRequests.set(
      serverId,
      (this.activeRequests.get(serverId) || 0) + 1
    );
  }

  // this function decreases active requests count
  decrement(serverId) {
    const current = this.activeRequests.get(serverId) || 0;
    this.activeRequests.set(serverId, Math.max(0, current - 1));
  }

  // this function gets current active requests count
  getActiveCount(serverId) {
    return this.activeRequests.get(serverId) || 0;
  }

  // this function resets all counters
  reset() {
    this.activeRequests.clear();
  }
}

module.exports = LeastActiveRequests;
