# URL Shortener with Load Balancing & Rate Limiting

An Algorithms II mini-project demonstrating practical application of four core algorithms:
- **Round Robin** (Load Balancing)
- **Least Active Requests** (Load Balancing)
- **Fixed Window Counter** (Rate Limiting)
- **Token Bucket** (Rate Limiting)

---

## How to Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Project
```bash
npm run dev
```
This runs `start.js`, which starts all 4 servers:
- **Gateway + Dashboard:** `http://localhost:3000`
- **Backend 1:** `http://localhost:3001`
- **Backend 2:** `http://localhost:3002`
- **Backend 3:** `http://localhost:3003`

Open **http://localhost:3000** in your browser.

### 3. Run Automated Tests
```bash
npm test
```
Runs 28 built-in Node.js unit tests verifying all 4 algorithms and the URL shortener.

---

## Architecture & Ports

| Port | Component | Role |
|:---:|:---|:---|
| **3000** | **Gateway** | Handles frontend, URL shortening, rate limiting & load balancing |
| **3001** | **Backend 1** | Simulates request processing with variable delay (300–800ms) |
| **3002** | **Backend 2** | Simulates request processing with variable delay (300–800ms) |
| **3003** | **Backend 3** | Simulates request processing with variable delay (300–800ms) |

---

## Algorithms Summary

### 1. Load Balancing Algorithms
- **Round Robin (`roundRobin.js`)**
  - Rotates requests sequentially across healthy servers: `server-1` → `server-2` → `server-3` → `server-1`.
  - **Time:** $O(1)$ | **Space:** $O(1)$
- **Least Active Requests (`leastActiveRequests.js`)**
  - Routes each request to the server with the fewest active in-flight requests.
  - **Time:** $O(n)$ scan | **Space:** $O(n)$ counters

### 2. Rate Limiting Algorithms
- **Fixed Window Counter (`fixedWindow.js`)**
  - Allows up to `5 requests` per `10-second` window per client. Resets when the window expires.
  - **Time:** $O(1)$ | **Space:** $O(c)$ clients
- **Token Bucket (`tokenBucket.js`)**
  - Bucket holds up to `5 tokens`, refills at `1 token every 3 seconds`. Allows controlled bursts.
  - **Time:** $O(1)$ | **Space:** $O(c)$ clients

---

## Key API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/shorten` | Shorten a URL (`{"url": "https://..."}`) |
| `GET` | `/:shortCode` | Redirect to original long URL |
| `GET` | `/api/process` | Send a simulated request through rate limiter & load balancer |
| `GET` | `/api/stats` | Get live server status and active request counts |
| `POST` | `/api/load-balancer/algorithm` | Switch LB algorithm (`round-robin` or `least-active`) |
| `POST` | `/api/rate-limit/algorithm` | Switch rate limiter (`fixed-window` or `token-bucket`) |
| `POST` | `/api/reset` | Reset all stats and counters |
