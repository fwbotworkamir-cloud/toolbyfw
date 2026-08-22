const https = require('https');
const http = require('http');
const { parseStringPromise } = require('xml2js');
const Classifier = require('./classifier');

// Geo codes for different Discover markets
const GEO_CODES = {
  'US': { geo: 'US', hl: 'en-US' },
  'UK': { geo: 'GB', hl: 'en-GB' },
  'CA': { geo: 'CA', hl: 'en-CA' },
  'AU': { geo: 'AU', hl: 'en-AU' },
  'IN': { geo: 'IN', hl: 'en-IN' },
};

// Category-specific Google News RSS feeds (Discover content pool)
const CATEGORY_FEEDS = {
  'entertainment': 'CAAqJggKIiBDQkFTRWdvSUwyMHZNREpxYW5RU0FtVnVHZ0pWVXlnQVAB',
  'technology':    'CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnVHZ0pWVXlnQVAB',
  'business':      'CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnVHZ0pWVXlnQVAB',
  'health':        'CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3QwTlRFU0FtVnVLQUFQAQ',
  'science':       'CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp0Y1RjU0FtVnVHZ0pWVXlnQVAB',
  'sports':        'CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp1ZEdvU0FtVnVHZ0pWVXlnQVAB',
  'world':         'CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXlnQVAB',
};

class Scraper {
  constructor(proxyManager, config) {
    this.proxyManager = proxyManager;
    this.config = config;
    this.classifier = new Classifier();
  }

  _randomDelay() {
    const [min, max] = this.config.delayBetweenRequests || [2000, 5000];
    return Math.floor(Math.random() * (max - min)) + min;
  }

  // Fetch URL through proxy or direct
  _fetch(url, proxy) {
    return new Promise((resolve, reject) => {
      const timeout = this.config.timeout || 30000;
      const parsed = new URL(url);

      if (proxy) {
        const proxyParts = this.proxyManager.getProxyParts(proxy);
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
        proxyReq.setTimeout(timeout, () => { proxyReq.destroy(); reject(new Error('Proxy CONNECT timeout')); });

        proxyReq.on('connect', (res, socket) => {
          if (res.statusCode !== 200) {
            socket.destroy();
            return reject(new Error(`Proxy CONNECT failed: ${res.statusCode}`));
          }

          const req = https.request({
            host: parsed.hostname,
            path: parsed.pathname + parsed.search,
            socket, agent: false, timeout,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
            }
          }, (res2) => {
            // Handle redirects
            if (res2.statusCode >= 300 && res2.statusCode < 400 && res2.headers.location) {
              socket.destroy();
              return this._fetch(res2.headers.location, proxy).then(resolve).catch(reject);
            }
            let data = '';
            res2.on('data', c => data += c);
            res2.on('end', () => resolve(data));
          });
          req.setTimeout(timeout, () => { req.destroy(); reject(new Error('Request timeout')); });
          req.on('error', reject);
          req.end();
        });

        proxyReq.on('error', reject);
        proxyReq.end();
      } else {
        // Direct fetch
        https.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          timeout,
        }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return this._fetch(res.headers.location, null).then(resolve).catch(reject);
          }
          let data = '';
          res.on('data', c => data += c);
          res.on('end', () => resolve(data));
        }).on('error', reject);
      }
    });
  }

  // Scrape Google Trends RSS — trending topics with articles
  async scrapeTrends(geo = 'US') {
    const geoConfig = GEO_CODES[geo] || GEO_CODES['US'];
    const url = `https://trends.google.com/trending/rss?geo=${geoConfig.geo}`;
    const proxy = this.proxyManager.next();
    const proxyLabel = proxy ? 'proxy' : 'direct';

    console.log(`[scraper] Fetching trends for ${geo} via ${proxyLabel}...`);

    // Retry logic for rotating proxy
    const maxRetries = 5;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const xml = await this._fetch(url, proxy);
        const parsed = await parseStringPromise(xml, { explicitArray: false });
        const items = parsed?.rss?.channel?.item;
        if (!items) throw new Error('No items in RSS');

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
            const source = news['ht:news_item_source'];
            const articleUrl = news['ht:news_item_url'];
            const picture = news['ht:news_item_picture'];

            if (!title || title.length < 10) continue;

            const classified = this.classifier.classify(title);
            articles.push({
              ...classified,
              title,
              url: articleUrl || '',
              source: source || null,
              category: trendQuery,
              thumbnail_url: picture || null,
              has_thumbnail: !!picture,
              publish_date: item.pubDate || null,
              position_in_feed: articles.length + 1,
              feed_section: `trending_${geo}`,
              trend_query: trendQuery,
              trend_traffic: traffic,
            });
          }
        }

        console.log(`[scraper] Trends ${geo}: ${articles.length} articles from ${itemArray.length} trends`);
        return articles;

      } catch (err) {
        if (attempt < maxRetries) {
          const wait = 2000 + Math.random() * 3000;
          console.log(`[scraper] Attempt ${attempt}/${maxRetries} failed (${err.message}), rotating IP... (${Math.round(wait)}ms)`);
          await new Promise(r => setTimeout(r, wait));
        } else {
          console.error(`[scraper] All ${maxRetries} attempts failed for trends ${geo}: ${err.message}`);
          return [];
        }
      }
    }
    return [];
  }

  // Scrape Google News RSS by category — Discover's content pool
  async scrapeCategory(category) {
    const topicId = CATEGORY_FEEDS[category];
    if (!topicId) {
      console.log(`[scraper] Unknown category: ${category}`);
      return [];
    }

    const url = `https://news.google.com/rss/topics/${topicId}?hl=en-US&gl=US&ceid=US:en`;
    const proxy = this.proxyManager.next();
    const proxyLabel = proxy ? 'proxy' : 'direct';

    console.log(`[scraper] Fetching ${category} RSS via ${proxyLabel}...`);

    const maxRetries = 5;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const xml = await this._fetch(url, proxy);
        const parsed = await parseStringPromise(xml, { explicitArray: false });
        const items = parsed?.rss?.channel?.item;
        if (!items) throw new Error('No items in RSS');

        const itemArray = Array.isArray(items) ? items : [items];
        const articles = [];

        for (const item of itemArray) {
          const title = item.title;
          const source = item.source?._ || item.source || null;
          const articleUrl = item.link;
          const pubDate = item.pubDate;

          if (!title || title.length < 10) continue;

          const classified = this.classifier.classify(title);
          articles.push({
            ...classified,
            title,
            url: articleUrl || '',
            source,
            category,
            publish_date: pubDate || null,
            has_thumbnail: false,
            position_in_feed: articles.length + 1,
            feed_section: `news_${category}`,
          });
        }

        console.log(`[scraper] ${category}: ${articles.length} articles`);
        return articles;

      } catch (err) {
        if (attempt < maxRetries) {
          const wait = 2000 + Math.random() * 3000;
          console.log(`[scraper] Attempt ${attempt}/${maxRetries} failed (${err.message}), rotating IP...`);
          await new Promise(r => setTimeout(r, wait));
        } else {
          console.error(`[scraper] All ${maxRetries} attempts failed for ${category}: ${err.message}`);
          return [];
        }
      }
    }
    return [];
  }

  // Full scan: trends + categories
  async scanAll(categories, geos = ['US']) {
    const allArticles = [];

    // Scrape trending topics (the Discover signal)
    for (const geo of geos) {
      const trendArticles = await this.scrapeTrends(geo);
      allArticles.push(...trendArticles);
      await new Promise(r => setTimeout(r, this._randomDelay()));
    }

    // Scrape category feeds (the Discover content pool)
    for (const cat of categories) {
      const articles = await this.scrapeCategory(cat);
      allArticles.push(...articles);
      console.log(`[scraper] Waiting...`);
      await new Promise(r => setTimeout(r, this._randomDelay()));
    }

    return allArticles;
  }
}

module.exports = Scraper;
