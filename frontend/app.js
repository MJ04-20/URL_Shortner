// this is frontend script

(() => {
  'use strict';

  // this is backend api url
  const API = '';

  // this is for selecting html elements
  const $ = (sel) => document.querySelector(sel);
  const urlInput = $('#url-input');
  const btnShorten = $('#btn-shorten');
  const shortenResult = $('#shorten-result');
  // this is text
  const shortUrlText = $('#short-url-text');
  // this is copy fxn
  const btnCopy = $('#btn-copy');
  const shortenMessage = $('#shorten-message');
  const lbAlgorithm = $('#lb-algorithm');
  const rlAlgorithm = $('#rl-algorithm');
  const serverCards = $('#server-cards');
  const rateLimitInfo = $('#rate-limit-info');
  const logEntries = $('#log-entries');
  const btnSend1 = $('#btn-send-1');
  const btnSend10 = $('#btn-send-10');
  const btnSend50 = $('#btn-send-50');
  const btnStartLoad = $('#btn-start-load');
  const btnStopLoad = $('#btn-stop-load');
  const btnReset = $('#btn-reset');

  // this is state variables
  let loadInterval = null;
  let pollInterval = null;
  const MAX_LOG_ENTRIES = 100;
  const CONCURRENCY = 5;

  // this function is for shortening url
  btnShorten.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    showMessage('', '');

    if (!url) {
      showMessage('Please enter a URL.', 'error');
      return;
    }

    try {
      const res = await fetch(`${API}/api/shorten`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();

      if (res.ok) {
        shortUrlText.textContent = data.shortUrl;
        shortenResult.classList.remove('hidden');
        showMessage(data.created ? 'Short URL created!' : 'URL was already shortened.', 'success');
      } else {
        shortenResult.classList.add('hidden');
        showMessage(data.error || 'Failed to shorten URL.', 'error');
      }
    } catch (err) {
      showMessage(`Network error: ${err.message}`, 'error');
    }
  });

  // this is for enter key press
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnShorten.click();
  });

  // this is copy fxn
  btnCopy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shortUrlText.textContent);
      btnCopy.textContent = '✓ Copied';
      setTimeout(() => { btnCopy.textContent = '📋 Copy'; }, 1500);
    } catch {
      // this is fallback copy
      const ta = document.createElement('textarea');
      ta.value = shortUrlText.textContent;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      btnCopy.textContent = '✓ Copied';
      setTimeout(() => { btnCopy.textContent = '📋 Copy'; }, 1500);
    }
  });

  // this function is for showing alert message
  function showMessage(text, type) {
    if (!text) {
      shortenMessage.classList.add('hidden');
      return;
    }
    shortenMessage.textContent = text;
    shortenMessage.className = `message ${type}`;
    shortenMessage.classList.remove('hidden');
  }

  // this function is for changing load balancer algorithm
  lbAlgorithm.addEventListener('change', async () => {
    try {
      await fetch(`${API}/api/load-balancer/algorithm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ algorithm: lbAlgorithm.value }),
      });
    } catch (err) {
      console.error('Failed to switch LB algorithm:', err);
    }
  });

  // this function is for changing rate limit algorithm
  rlAlgorithm.addEventListener('change', async () => {
    try {
      await fetch(`${API}/api/rate-limit/algorithm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ algorithm: rlAlgorithm.value }),
      });
      refreshRateLimitStatus();
    } catch (err) {
      console.error('Failed to switch RL algorithm:', err);
    }
  });

  // this function is for sending one request
  async function sendRequest() {
    const start = Date.now();
    try {
      const res = await fetch(`${API}/api/process`);
      const data = await res.json();
      const elapsed = Date.now() - start;

      addLogEntry({
        status: res.status,
        server: data.selectedServer || data.serverId || '—',
        time: `${elapsed}ms`,
        detail: res.status === 429 ? 'Rate limited' : (data.processingTime ? `${data.processingTime}ms proc` : ''),
      });
    } catch (err) {
      addLogEntry({ status: 'ERR', server: '—', time: `${Date.now() - start}ms`, detail: err.message });
    }
  }

  // this function is for sending multiple requests
  async function sendBatch(count) {
    const queue = Array.from({ length: count }, (_, i) => i);
    const workers = [];
    for (let i = 0; i < Math.min(CONCURRENCY, count); i++) {
      workers.push((async () => {
        while (queue.length > 0) {
          queue.shift();
          await sendRequest();
        }
      })());
    }
    await Promise.all(workers);
  }

  // this is for button clicks
  btnSend1.addEventListener('click', () => sendRequest());
  btnSend10.addEventListener('click', () => sendBatch(10));
  btnSend50.addEventListener('click', () => sendBatch(50));

  // this function is for starting continuous load
  btnStartLoad.addEventListener('click', () => {
    btnStartLoad.disabled = true;
    btnStopLoad.disabled = false;
    loadInterval = setInterval(() => {
      for (let i = 0; i < CONCURRENCY; i++) sendRequest();
    }, 500);
  });

  // this is for stopping continuous load
  btnStopLoad.addEventListener('click', stopLoad);

  // this function is for stopping load
  function stopLoad() {
    if (loadInterval) {
      clearInterval(loadInterval);
      loadInterval = null;
    }
    btnStartLoad.disabled = false;
    btnStopLoad.disabled = true;
  }

  // this function is for resetting stats
  btnReset.addEventListener('click', async () => {
    try {
      await fetch(`${API}/api/reset`, { method: 'POST' });
      logEntries.innerHTML = '';
      refreshStats();
      refreshRateLimitStatus();
    } catch (err) {
      console.error('Reset failed:', err);
    }
  });

  // this function is for adding log entry to table
  function addLogEntry({ status, server, time, detail }) {
    const el = document.createElement('div');
    el.className = 'log-entry';
    const statusClass = status === 429 ? 's429' : (status >= 200 && status < 300 ? 's2xx' : 'sErr');

    el.innerHTML = `
      <span class="log-status ${statusClass}">${status}</span>
      <span class="log-server">${server}</span>
      <span class="log-time">${time}</span>
      <span>${detail || ''}</span>
    `;

    logEntries.prepend(el);

    while (logEntries.children.length > MAX_LOG_ENTRIES) {
      logEntries.lastChild.remove();
    }
  }

  // this function is for refreshing server stats
  async function refreshStats() {
    try {
      const res = await fetch(`${API}/api/stats`);
      const data = await res.json();

      lbAlgorithm.value = data.loadBalancerAlgorithm;

      serverCards.innerHTML = data.servers.map((s) => `
        <div class="server-card">
          <div class="server-name">
            ${s.id} <span class="health-badge ${s.healthy ? 'healthy' : 'unhealthy'}">${s.healthy ? '● Healthy' : '● Down'}</span>
          </div>
          <div class="stat-row"><span>Port</span><span class="value">${s.port}</span></div>
          <div class="stat-row"><span>Total Requests</span><span class="value">${s.totalRequests}</span></div>
          <div class="stat-row"><span>Active Requests</span><span class="value">${s.activeRequests}</span></div>
        </div>
      `).join('');
    } catch {
      // ignore error
    }
  }

  // this function is for refreshing rate limit stats
  async function refreshRateLimitStatus() {
    try {
      const res = await fetch(`${API}/api/rate-limit/status`);
      const data = await res.json();

      rlAlgorithm.value = data.algorithm;

      const configText = data.algorithm === 'fixed-window'
        ? `Max: ${data.config.maxRequests} / ${data.config.windowMs / 1000}s`
        : `Capacity: ${data.config.capacity}, Refill: 1 / ${data.config.refillRateMs / 1000}s`;

      rateLimitInfo.innerHTML = `
        <div class="rl-stat">
          <div class="rl-label">Configuration</div>
          <div class="rl-value" style="font-size:0.85rem;color:var(--text)">${configText}</div>
        </div>
        <div class="rl-stat">
          <div class="rl-label">Accepted</div>
          <div class="rl-value accepted">${data.accepted}</div>
        </div>
        <div class="rl-stat">
          <div class="rl-label">Rejected</div>
          <div class="rl-value rejected">${data.rejected}</div>
        </div>
        <div class="rl-stat">
          <div class="rl-label">Remaining</div>
          <div class="rl-value remaining">${data.remaining}</div>
        </div>
        ${data.lastRejection ? `
        <div class="rl-stat">
          <div class="rl-label">Last Rejection</div>
          <div class="rl-value" style="font-size:0.75rem;color:var(--danger)">${new Date(data.lastRejection).toLocaleTimeString()}</div>
        </div>` : ''}
      `;
    } catch {
      // ignore error
    }
  }

  // this function is for starting periodic polling
  function startPolling() {
    refreshStats();
    refreshRateLimitStatus();
    pollInterval = setInterval(() => {
      refreshStats();
      refreshRateLimitStatus();
    }, 2000);
  }

  // this is for clean up on close
  window.addEventListener('beforeunload', () => {
    stopLoad();
    if (pollInterval) clearInterval(pollInterval);
  });

  // this starts the polling
  startPolling();
})();
