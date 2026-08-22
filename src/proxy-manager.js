const fs = require('fs');
const path = require('path');

class ProxyManager {
  constructor(config) {
    this.config = config;
    this.proxies = [];
    this.currentIndex = 0;
    this.requestCount = 0;
    this.deadProxies = new Set();
    this.proxyStats = new Map();
    this.load();
  }

  load() {
    const filePath = path.resolve(this.config.file || 'proxies.txt');
    if (!fs.existsSync(filePath)) {
      console.log('[proxy] No proxy file found — running direct (no proxy)');
      this.proxies = [null];
      return;
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    this.proxies = raw
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'))
      .map(l => this.parseProxy(l));

    if (this.proxies.length === 0) {
      console.log('[proxy] Proxy file empty — running direct');
      this.proxies = [null];
    } else {
      console.log(`[proxy] Loaded ${this.proxies.length} proxies`);
    }
  }

  parseProxy(line) {
    // Supports: host:port, user:pass@host:port, protocol://user:pass@host:port
    if (!line.includes('://')) line = `http://${line}`;
    return line;
  }

  // Puppeteer needs server and auth split
  // Returns { server: 'http://host:port', auth: { username, password } | null }
  getProxyParts(proxyUrl) {
    if (!proxyUrl) return { server: null, auth: null };
    try {
      const url = new URL(proxyUrl);
      const server = `${url.protocol}//${url.hostname}:${url.port}`;
      const auth = url.username ? { username: decodeURIComponent(url.username), password: decodeURIComponent(url.password) } : null;
      return { server, auth };
    } catch {
      return { server: proxyUrl, auth: null };
    }
  }

  next() {
    const rotateEvery = this.config.rotateEvery || 3;
    this.requestCount++;

    if (this.requestCount >= rotateEvery) {
      this.requestCount = 0;
      this.currentIndex = (this.currentIndex + 1) % this.proxies.length;

      // Skip dead proxies
      let attempts = 0;
      while (this.deadProxies.has(this.proxies[this.currentIndex]) && attempts < this.proxies.length) {
        this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
        attempts++;
      }
    }

    const proxy = this.proxies[this.currentIndex];
    this.trackUse(proxy);
    return proxy;
  }

  trackUse(proxy) {
    const key = proxy || 'direct';
    if (!this.proxyStats.has(key)) {
      this.proxyStats.set(key, { uses: 0, failures: 0, lastUsed: null });
    }
    const stats = this.proxyStats.get(key);
    stats.uses++;
    stats.lastUsed = new Date().toISOString();
  }

  markDead(proxy) {
    if (proxy) {
      this.deadProxies.add(proxy);
      const key = proxy || 'direct';
      if (this.proxyStats.has(key)) {
        this.proxyStats.get(key).failures++;
      }
      console.log(`[proxy] Marked dead: ${proxy.substring(0, 30)}...`);
    }
  }

  markAlive(proxy) {
    this.deadProxies.delete(proxy);
  }

  getAliveCount() {
    return this.proxies.filter(p => !this.deadProxies.has(p)).length;
  }

  getStats() {
    return Object.fromEntries(this.proxyStats);
  }

  async testAll() {
    const http = require('http');
    const https = require('https');
    const results = [];

    for (const proxy of this.proxies) {
      if (!proxy) {
        results.push({ proxy: 'direct', status: 'ok', latency: 0, ip: 'direct' });
        continue;
      }

      const start = Date.now();
      try {
        const { server, auth } = this.getProxyParts(proxy);
        const proxyUrl = new URL(server);
        const ip = await new Promise((resolve, reject) => {
          const timeout = this.config.timeout || 10000;
          const connectOpts = {
            host: proxyUrl.hostname, port: proxyUrl.port,
            method: 'CONNECT', path: 'httpbin.org:443', timeout,
          };
          if (auth) {
            connectOpts.headers = {
              'Proxy-Authorization': 'Basic ' + Buffer.from(`${auth.username}:${auth.password}`).toString('base64'),
            };
          }
          const req = http.request(connectOpts);
          req.setTimeout(timeout, () => { req.destroy(); reject(new Error('timeout')); });
          req.on('connect', (res, socket) => {
            if (res.statusCode !== 200) { socket.destroy(); return reject(new Error(`CONNECT ${res.statusCode}`)); }
            const tlsReq = https.request({
              host: 'httpbin.org', path: '/ip',
              socket, agent: false, timeout,
              headers: { 'User-Agent': 'Mozilla/5.0' },
            }, (tlsRes) => {
              let data = '';
              tlsRes.on('data', c => data += c);
              tlsRes.on('end', () => {
                try { resolve(JSON.parse(data).origin); } catch { resolve('unknown'); }
              });
            });
            tlsReq.on('error', reject); tlsReq.end();
          });
          req.on('error', reject); req.end();
        });
        const latency = Date.now() - start;
        results.push({ proxy: server, status: 'ok', latency, ip });
        this.markAlive(proxy);
      } catch (err) {
        results.push({ proxy, status: 'dead', error: err.message });
        this.markDead(proxy);
      }
    }

    return results;
  }
}

module.exports = ProxyManager;
