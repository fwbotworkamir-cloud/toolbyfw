#!/usr/bin/env node

/**
 * Bulk data loader — pulls 30 days of trending data across geos + all category feeds
 * to build a large enough dataset for algorithm analysis.
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { parseStringPromise } = require('xml2js');
const chalk = require('chalk');

const ProxyManager = require('./proxy-manager');
const DB = require('./database');
const Classifier = require('./classifier');

const configPath = path.resolve(__dirname, '..', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const GEOS = ['US', 'GB', 'CA', 'AU', 'IN', 'DE', 'FR', 'BR', 'JP', 'MX'];
const CATEGORIES = {
  'entertainment': 'CAAqJggKIiBDQkFTRWdvSUwyMHZNREpxYW5RU0FtVnVHZ0pWVXlnQVAB',
  'technology':    'CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnVHZ0pWVXlnQVAB',
  'business':      'CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnVHZ0pWVXlnQVAB',
  'health':        'CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3QwTlRFU0FtVnVLQUFQAQ',
  'science':       'CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp0Y1RjU0FtVnVHZ0pWVXlnQVAB',
  'sports':        'CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp1ZEdvU0FtVnVHZ0pWVXlnQVAB',
  'world':         'CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXlnQVAB',
};

// Language/country combos for RSS
const GEO_PARAMS = {
  'US': { hl: 'en-US', gl: 'US', ceid: 'US:en' },
  'GB': { hl: 'en-GB', gl: 'GB', ceid: 'GB:en' },
  'CA': { hl: 'en-CA', gl: 'CA', ceid: 'CA:en' },
  'AU': { hl: 'en-AU', gl: 'AU', ceid: 'AU:en' },
  'IN': { hl: 'en-IN', gl: 'IN', ceid: 'IN:en' },
  'DE': { hl: 'de',    gl: 'DE', ceid: 'DE:de' },
  'FR': { hl: 'fr',    gl: 'FR', ceid: 'FR:fr' },
  'BR': { hl: 'pt-BR', gl: 'BR', ceid: 'BR:pt-419' },
  'JP': { hl: 'ja',    gl: 'JP', ceid: 'JP:ja' },
  'MX': { hl: 'es-419',gl: 'MX', ceid: 'MX:es-419' },
};

const classifier = new Classifier();
const proxyManager = new ProxyManager(config.proxies);

function fetch(url) {
  return new Promise((resolve, reject) => {
    const proxy = proxyManager.next();
    const parsed = new URL(url);
    const timeout = 20000;

    if (proxy) {
      const proxyParts = proxyManager.getProxyParts(proxy);
      const proxyUrl = new URL(proxyParts.server);

      const connectOpts = {
        host: proxyUrl.hostname,
        port: proxyUrl.port,
        method: 'CONNECT',
        path: `${parsed.hostname}:443`,
        timeout,
      };

      if (proxyParts.auth) {
        connectOpts.headers = {
          'Proxy-Authorization': 'Basic ' + Buffer.from(`${proxyParts.auth.username}:${proxyParts.auth.password}`).toString('base64')
        };
      }

      const proxyReq = http.request(connectOpts);
      proxyReq.setTimeout(timeout, () => { proxyReq.destroy(); reject(new Error('timeout')); });

      proxyReq.on('connect', (res, socket) => {
        if (res.statusCode !== 200) { socket.destroy(); return reject(new Error(`connect ${res.statusCode}`)); }
        const req = https.request({
          host: parsed.hostname, path: parsed.pathname + parsed.search,
          socket, agent: false, timeout,
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'Accept-Language': 'en-US,en;q=0.9' }
        }, (res2) => {
          if (res2.statusCode >= 300 && res2.statusCode < 400 && res2.headers.location) {
            socket.destroy();
            return fetch(res2.headers.location).then(resolve).catch(reject);
          }
          let data = '';
          res2.on('data', c => data += c);
          res2.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.end();
      });
      proxyReq.on('error', reject);
      proxyReq.end();
    } else {
      https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US,en;q=0.9' }, timeout }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetch(res.headers.location).then(resolve).catch(reject);
        }
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve(data));
      }).on('error', reject);
    }
  });
}

async function fetchWithRetry(url, label, retries = 5) {
  for (let i = 1; i <= retries; i++) {
    try {
      return await fetch(url);
    } catch (e) {
      if (i < retries) {
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
      } else {
        console.log(chalk.red(`  ✗ ${label}: failed after ${retries} attempts`));
        return null;
      }
    }
  }
}

async function parseTrendsRSS(xml, geo) {
  const parsed = await parseStringPromise(xml, { explicitArray: false });
  const items = parsed?.rss?.channel?.item;
  if (!items) return [];
  const itemArray = Array.isArray(items) ? items : [items];
  const articles = [];

  for (const item of itemArray) {
    const trendQuery = item.title;
    const traffic = item['ht:approx_traffic'] || '';
    const newsItems = item['ht:news_item'];
    if (!newsItems) continue;
    const newsArray = Array.isArray(newsItems) ? newsItems : [newsItems];

    for (const news of newsArray) {
      const title = news['ht:news_item_title'];
      if (!title || title.length < 10) continue;
      articles.push({
        ...classifier.classify(title),
        title,
        url: news['ht:news_item_url'] || '',
        source: news['ht:news_item_source'] || null,
        category: `trending_${geo}`,
        thumbnail_url: news['ht:news_item_picture'] || null,
        has_thumbnail: !!news['ht:news_item_picture'],
        publish_date: item.pubDate || null,
        feed_section: `trends_${geo}`,
      });
    }
  }
  return articles;
}

async function parseCategoryRSS(xml, category, geo) {
  const parsed = await parseStringPromise(xml, { explicitArray: false });
  const items = parsed?.rss?.channel?.item;
  if (!items) return [];
  const itemArray = Array.isArray(items) ? items : [items];

  return itemArray.filter(i => i.title && i.title.length >= 10).map((item, idx) => ({
    ...classifier.classify(item.title),
    title: item.title,
    url: item.link || '',
    source: item.source?._ || item.source || null,
    category,
    publish_date: item.pubDate || null,
    has_thumbnail: false,
    position_in_feed: idx + 1,
    feed_section: `news_${category}_${geo}`,
  }));
}

(async () => {
  console.log(chalk.bold.cyan('\n  ⚡ BULK DATA LOADER'));
  console.log(chalk.cyan('  Loading Discover content pool across geos and categories\n'));

  const db = new DB(path.resolve(config.database.path));
  await db.ready();

  const startTime = Date.now();
  let totalArticles = 0;
  let totalSaved = 0;

  // Phase 1: Google Trends RSS across all geos
  console.log(chalk.bold.yellow('  Phase 1: Trending Topics'));
  for (const geo of GEOS) {
    const url = `https://trends.google.com/trending/rss?geo=${geo}`;
    const xml = await fetchWithRetry(url, `trends/${geo}`);
    if (!xml) continue;

    try {
      const articles = await parseTrendsRSS(xml, geo);
      const scanId = db.insertScan({ category: `trends_${geo}`, proxy_used: 'proxy', articles_found: articles.length });
      const enriched = articles.map(a => ({ ...a, scan_id: scanId, scraped_at: new Date().toISOString() }));
      const saved = db.insertBulkArticles(enriched);
      totalArticles += articles.length;
      totalSaved += saved;
      console.log(chalk.green(`  ✓ ${geo} trends: ${articles.length} articles, ${saved} new`));
    } catch (e) {
      console.log(chalk.red(`  ✗ ${geo} trends parse error: ${e.message}`));
    }

    await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
  }

  // Phase 2: Category RSS feeds across top English geos
  console.log(chalk.bold.yellow('\n  Phase 2: Category Feeds'));
  const englishGeos = ['US', 'GB', 'CA', 'AU', 'IN'];

  for (const geo of englishGeos) {
    const geoParams = GEO_PARAMS[geo];
    for (const [category, topicId] of Object.entries(CATEGORIES)) {
      const url = `https://news.google.com/rss/topics/${topicId}?hl=${geoParams.hl}&gl=${geoParams.gl}&ceid=${geoParams.ceid}`;
      const xml = await fetchWithRetry(url, `${category}/${geo}`);
      if (!xml) continue;

      try {
        const articles = await parseCategoryRSS(xml, category, geo);
        const scanId = db.insertScan({ category: `${category}_${geo}`, proxy_used: 'proxy', articles_found: articles.length });
        const enriched = articles.map(a => ({ ...a, scan_id: scanId, scraped_at: new Date().toISOString() }));
        const saved = db.insertBulkArticles(enriched);
        totalArticles += articles.length;
        totalSaved += saved;

        // Track patterns
        for (const a of articles) {
          if (a.title) {
            const pattern = classifier.toPattern(a.title);
            db.upsertPattern(pattern, a.title, category);
          }
        }

        console.log(chalk.green(`  ✓ ${category}/${geo}: ${articles.length} articles, ${saved} new`));
      } catch (e) {
        console.log(chalk.red(`  ✗ ${category}/${geo}: ${e.message}`));
      }

      await new Promise(r => setTimeout(r, 300 + Math.random() * 700));
    }
  }

  // Phase 3: Top stories (general news feed)
  console.log(chalk.bold.yellow('\n  Phase 3: Top Stories'));
  for (const geo of englishGeos) {
    const geoParams = GEO_PARAMS[geo];
    const url = `https://news.google.com/rss?hl=${geoParams.hl}&gl=${geoParams.gl}&ceid=${geoParams.ceid}`;
    const xml = await fetchWithRetry(url, `top/${geo}`);
    if (!xml) continue;

    try {
      const articles = await parseCategoryRSS(xml, 'top_stories', geo);
      const scanId = db.insertScan({ category: `top_${geo}`, proxy_used: 'proxy', articles_found: articles.length });
      const enriched = articles.map(a => ({ ...a, scan_id: scanId, scraped_at: new Date().toISOString() }));
      const saved = db.insertBulkArticles(enriched);
      totalArticles += articles.length;
      totalSaved += saved;
      console.log(chalk.green(`  ✓ top/${geo}: ${articles.length} articles, ${saved} new`));
    } catch (e) {
      console.log(chalk.red(`  ✗ top/${geo}: ${e.message}`));
    }

    await new Promise(r => setTimeout(r, 500));
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  db.close();

  console.log(chalk.bold.cyan(`\n  ════════════════════════════════`));
  console.log(chalk.bold.cyan(`  Total scraped: ${totalArticles}`));
  console.log(chalk.bold.cyan(`  New saved:     ${totalSaved}`));
  console.log(chalk.bold.cyan(`  Duration:      ${duration}s`));
  console.log(chalk.bold.cyan(`  ════════════════════════════════\n`));
})();
