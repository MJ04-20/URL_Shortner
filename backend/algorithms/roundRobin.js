// this is round robin algorithm

class RoundRobin {
  constructor() {
    // this is current index
    this.currentIndex = 0;
  }

  // this function selects the next healthy server
  select(servers, healthyIds) {
    const healthy = servers.filter(s => healthyIds.has(s.id));
    if (healthy.length === 0) return null;

    // this is round robin rotation
    this.currentIndex = this.currentIndex % healthy.length;
    const selected = healthy[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % healthy.length;
    return selected;
  }

  // this function resets the index
  reset() {
    this.currentIndex = 0;
  }
}

module.exports = RoundRobin;
