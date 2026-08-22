#!/usr/bin/env node

/**
 * NUCLEAR ENTERTAINMENT LOADER
 * 
 * Pulls 50K+ entertainment articles from GDELT + Google News RSS
 * focused specifically on Discover-dominant entertainment sources.
 * 
 * Strategy:
 * 1. GDELT DOC API — 250 articles per query, hundreds of queries
 * 2. GDELT source-specific queries — pull from known Discover domains
 * 3. Google News RSS entertainment sub-feeds
 * 4. Google News RSS search with entertainment queries
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

const classifier = new Classifier();
const proxyManager = new ProxyManager(config.proxies);
const tuning = config.performance || {};
const limit = (value, fallback, max = 16) => Math.min(Math.max(Math.floor(Number(value) || fallback), 1), max);
const GDELT_CONCURRENCY = limit(tuning.gdeltConcurrency, 6);
const GOOGLE_CONCURRENCY = limit(tuning.googleConcurrency, 3);
const RSS_CONCURRENCY = limit(tuning.rssConcurrency, 6);
const CHECKPOINT_EVERY = limit(tuning.checkpointEvery, 25, 200);
const networkStats = { requests: 0, retries: 0, failures: 0 };

// ─── DISCOVER-DOMINANT ENTERTAINMENT SOURCES ───────────────────
// These are the publishers that appear most frequently in Discover's
// entertainment vertical based on industry data.
// ponytail: grouped by sub-niche so gaps are visible. General-news domains
// (nytimes, cnn, foxnews…) were dropped — their GDELT results are mostly
// politics, which polluted the entertainment-only dataset.
const DISCOVER_SOURCES = [
  // Celebrity / gossip
  'people.com', 'tmz.com', 'eonline.com', 'usmagazine.com', 'pagesix.com',
  'justjared.com', 'popsugar.com', 'okmagazine.com', 'intouchweekly.com',
  'lifeandstylemag.com', 'radaronline.com', 'closerweekly.com', 'thehollywoodgossip.com',
  'perezhilton.com', 'popcrush.com', 'celebitchy.com', 'dlisted.com',

  // Trade / industry
  'variety.com', 'hollywoodreporter.com', 'deadline.com', 'thewrap.com',
  'indiewire.com', 'awardsdaily.com', 'goldderby.com', 'boxofficemojo.com',
  'the-numbers.com', 'filmstories.co.uk', 'productionweekly.com',

  // Film criticism / features
  'ew.com', 'vulture.com', 'avclub.com', 'collider.com', 'cinemablend.com',
  'slashfilm.com', 'screendaily.com', 'empireonline.com', 'totalfilm.com',
  'rogerebert.com', 'filmcomment.com', 'thefilmstage.com', 'littlewhitelies.co.uk',
  'screencrush.com', 'movieweb.com', 'looper.com', 'giantfreakinrobot.com',

  // TV / streaming
  'tvline.com', 'tvinsider.com', 'decider.com', 'primetimer.com',
  'whats-on-netflix.com', 'nextbestpicture.com', 'tvfanatic.com',
  'realityblurred.com', 'soapoperadigest.com', 'soaps.com',

  // Comics / superhero / genre
  'screenrant.com', 'cbr.com', 'comicbook.com', 'bleedingcool.com',
  'denofgeek.com', 'gizmodo.com', 'nerdist.com', 'comicbookmovie.com',
  'newsarama.com', 'multiversitycomics.com', 'thedirect.com', 'murphysmultiverse.com',

  // Anime / manga
  'animenewsnetwork.com', 'crunchyroll.com', 'myanimelist.net', 'animehunch.com',
  'otakuusamagazine.com', 'animecorner.me', 'comicbook.com', 'sportskeeda.com',
  'gamerant.com', 'dualshockers.com', 'animeexplained.com',

  // Gaming
  'ign.com', 'gamespot.com', 'polygon.com', 'kotaku.com', 'gamesradar.com',
  'eurogamer.net', 'pcgamer.com', 'rockpapershotgun.com', 'destructoid.com',
  'vg247.com', 'videogameschronicle.com', 'nintendolife.com', 'pushsquare.com',
  'purexbox.com', 'siliconera.com', 'thegamer.com', 'gameinformer.com',

  // Music
  'rollingstone.com', 'billboard.com', 'pitchfork.com', 'nme.com',
  'stereogum.com', 'consequence.net', 'spin.com', 'brooklynvegan.com',
  'loudwire.com', 'kerrang.com', 'metalsucks.net', 'residentadvisor.net',
  'hotnewhiphop.com', 'complex.com', 'thefader.com', 'okayplayer.com',
  'americansongwriter.com', 'tasteofcountry.com', 'jambase.com',

  // K-pop / Asian entertainment
  'soompi.com', 'allkpop.com', 'koreaboo.com', 'kpopstarz.com',

  // Bollywood / Indian entertainment
  'bollywoodhungama.com', 'pinkvilla.com', 'koimoi.com', 'filmfare.com',

  // Fashion / lifestyle-adjacent celebrity
  'vanityfair.com', 'vogue.com', 'elle.com', 'harpersbazaar.com',
  'wmagazine.com', 'cosmopolitan.com', 'refinery29.com', 'bustle.com',
  'glamour.com', 'instyle.com', 'marieclaire.com',

  // Aggregators / high-volume Discover players
  'buzzfeed.com', 'distractify.com', 'thethings.com', 'nickiswift.com',
  'thelist.com', 'grunge.com', 'ranker.com',
  'boredpanda.com', 'upworthy.com',

  // UK tabloids (heavy Discover entertainment presence)
  'dailymail.co.uk', 'mirror.co.uk', 'thesun.co.uk', 'metro.co.uk',
  'express.co.uk', 'dailystar.co.uk', 'hellomagazine.com', 'ok.co.uk',
  'digitalspy.com', 'radiotimes.com', 'unilad.com', 'ladbible.com',
];

// Sub-niche groups overlap (comicbook.com covers both comics and anime).
const SOURCES = [...new Set(DISCOVER_SOURCES)];

// --sources-only: run Phase 2 alone and APPEND to the existing DB instead of
// wiping it. Use this to widen domain coverage without losing a prior run.
const SOURCES_ONLY = process.argv.includes('--sources-only');

// Wiping the DB is now opt-in (--reset). Default is append: continuous
// collection accumulates, UNIQUE(title) dedupes across runs.
const RESET = process.argv.includes('--reset');

// --rss-only: Phase 4 alone — the cheap freshness lane (~2 min, no proxy).
const RSS_ONLY = process.argv.includes('--rss-only');

// ─── ENTERTAINMENT SEARCH QUERIES ──────────────────────────────
const ENTERTAINMENT_QUERIES = [
  // Celebrity / Gossip
  'celebrity news', 'celebrity couple', 'celebrity breakup', 'celebrity wedding',
  'celebrity pregnant', 'celebrity red carpet', 'celebrity interview',
  'celebrity net worth', 'celebrity feud', 'celebrity scandal',
  'celebrity transformation', 'celebrity throwback', 'celebrity style',
  'celebrity spotted', 'celebrity relationship', 'reality TV star',
  'influencer drama', 'social media celebrity', 'celebrity family',
  'celebrity children kids', 'celebrity home house', 'celebrity diet fitness',
  
  // Movies
  'new movie 2026', 'box office weekend', 'movie trailer', 'movie review',
  'movie sequel', 'movie remake', 'movie casting', 'movie premiere',
  'superhero movie', 'horror movie', 'comedy movie', 'action movie',
  'animated movie', 'documentary film', 'indie film', 'movie award',
  'movie director', 'movie actor actress', 'blockbuster movie',
  'streaming movie release', 'movie box office record', 'movie controversy',
  'movie behind the scenes', 'movie Easter egg', 'movie ending explained',
  
  // TV Shows
  'TV show premiere', 'TV show cancelled', 'TV show renewed', 'TV show finale',
  'Netflix new series', 'HBO show', 'Disney Plus show', 'Amazon Prime show',
  'Hulu original', 'Apple TV show', 'streaming new shows July 2026',
  'TV show cast', 'TV show spoiler', 'TV show review', 'reality TV show',
  'sitcom comedy show', 'drama series', 'limited series', 'TV show twist',
  'TV show rating', 'binge watch', 'TV show reunion', 'TV show reboot',
  
  // Music
  'new album release', 'music video', 'concert tour 2026', 'music festival',
  'Grammy nominations', 'song lyrics meaning', 'Billboard Hot 100',
  'rapper news', 'pop star', 'rock band', 'country music', 'hip hop',
  'K-pop group', 'Taylor Swift', 'Drake music', 'Beyonce',
  'music collaboration', 'album review', 'music industry', 'vinyl record',
  'Spotify playlist', 'music streaming', 'songwriter', 'music producer',
  
  // Pop Culture
  'viral moment', 'meme trending', 'TikTok trend', 'YouTube video',
  'podcast episode', 'book recommendation', 'bestseller novel',
  'comic book', 'anime new season', 'manga chapter', 'cosplay',
  'fan theory', 'Easter egg found', 'nostalgia throwback',
  'cultural moment', 'award show', 'fashion week', 'Met Gala',
  'royal family news', 'true crime documentary', 'murder mystery',
  
  // Awards / Events  
  'Oscar nominations 2026', 'Emmy Awards', 'Golden Globe',
  'SAG Awards', 'Tony Awards', 'BAFTA', 'Cannes Film Festival',
  'Sundance Film Festival', 'Venice Film Festival', 'MTV Awards',
  'BET Awards', 'American Music Awards', 'Critics Choice',
  
  // Specific trending entertainment
  'Spider-Man', 'Marvel MCU', 'DC Universe', 'Star Wars',
  'Game of Thrones', 'Stranger Things', 'The Bear', 'Succession',
  'Barbie movie', 'Wicked movie', 'Avatar sequel',
  'James Bond', 'Mission Impossible', 'Fast Furious',
  'Harry Potter', 'Lord of the Rings', 'Dune movie',
  'Pixar movie', 'Studio Ghibli', 'A24 film',
];

// Time ranges for GDELT (minutes)
const GDELT_TIMESPANS = [1440, 4320, 10080]; // 1 day, 3 days, 7 days

// ─── DIRECT RSS FEEDS (Phase 4) ────────────────────────────────
// Publisher-native feeds. Fills GDELT's gaps — especially anime — and gets
// articles minutes after publish instead of GDELT's indexing lag. No proxy.
const RSS_FEEDS = [
  // Anime-native (GDELT barely sees these). Boosted 2026-08-18: corpus was
  // 1.3% anime while anime = 50-79% of FW's Discover clicks — the tool's
  // biggest blind spot. Category feeds from the Discover-winning generalists
  // catch the competitive anime waves the niche sites don't.
  ['anime', 'https://www.animenewsnetwork.com/all/rss.xml'],
  ['anime', 'https://www.crunchyroll.com/news/rss'],
  ['anime', 'https://otakuusamagazine.com/feed/'],
  ['anime', 'https://animecorner.me/feed/'],
  ['anime', 'https://www.animehunch.com/feed/'],
  ['anime', 'https://screenrant.com/feed/anime/'],
  ['anime', 'https://www.cbr.com/feed/category/anime/'],
  ['anime', 'https://gamerant.com/feed/anime/'],
  ['anime', 'https://comicbook.com/category/anime/feed/'],
  // Fandom / superhero
  ['fandom', 'https://screenrant.com/feed/'],
  ['fandom', 'https://www.cbr.com/feed/'],
  ['fandom', 'https://comicbook.com/feed/'],
  ['fandom', 'https://thedirect.com/rss'],
  ['fandom', 'https://www.superherohype.com/feed'],
  // Movies / TV
  ['movies', 'https://variety.com/feed/'],
  ['movies', 'https://deadline.com/feed/'],
  ['movies', 'https://www.hollywoodreporter.com/feed/'],
  ['movies', 'https://collider.com/feed/'],
  ['movies', 'https://www.slashfilm.com/feed/'],
  ['tv', 'https://tvline.com/feed/'],
  ['tv', 'https://decider.com/feed/'],
  // Gaming
  ['gaming', 'https://www.ign.com/rss/articles/feed'],
  ['gaming', 'https://www.polygon.com/rss/index.xml'],
  ['gaming', 'https://kotaku.com/rss'],
  ['gaming', 'https://www.gamespot.com/feeds/news/'],
  // Celebrity
  ['celebrity', 'https://people.com/feed/'],
  ['celebrity', 'https://www.tmz.com/rss.xml'],
  ['celebrity', 'https://pagesix.com/feed/'],
];

// ─── FETCH HELPERS ─────────────────────────────────────────────

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 16, maxFreeSockets: 8 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 16, maxFreeSockets: 8 });

function collectResponse(res, url, fetchAgain, resolve, reject) {
  if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
    res.resume();
    return fetchAgain(new URL(res.headers.location, url).toString()).then(resolve, reject);
  }
  if (res.statusCode < 200 || res.statusCode >= 300) {
    const error = new Error(`HTTP ${res.statusCode}`);
    const retryAfter = Number(res.headers['retry-after']);
    if (Number.isFinite(retryAfter)) error.retryAfterMs = retryAfter * 1000;
    res.resume();
    return reject(error);
  }
  let data = '';
  res.setEncoding('utf8');
  res.on('data', chunk => data += chunk);
  res.on('error', reject);
  res.on('end', () => resolve(data));
}

function fetchDirect(url) {
  return new Promise((resolve, reject) => {
    const timeout = 20000;
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'Accept-Language': 'en-US' },
      agent: url.startsWith('https') ? httpsAgent : httpAgent,
    }, res => collectResponse(res, url, fetchDirect, resolve, reject));
    req.setTimeout(timeout, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

function fetchProxy(url) {
  return new Promise((resolve, reject) => {
    const proxy = proxyManager.next();
    if (!proxy) return fetchDirect(url).then(resolve).catch(reject);
    
    const parsed = new URL(url);
    const proxyParts = proxyManager.getProxyParts(proxy);
    const proxyUrl = new URL(proxyParts.server);
    const timeout = 15000;

    const connectOpts = {
      host: proxyUrl.hostname, port: proxyUrl.port,
      method: 'CONNECT', path: `${parsed.hostname}:443`, timeout,
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
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'Accept-Language': 'en-US' }
      }, res => collectResponse(res, url, fetchProxy, resolve, reject));
      req.setTimeout(timeout, () => req.destroy(new Error('timeout')));
      req.on('error', reject); req.end();
    });
    proxyReq.on('error', reject); proxyReq.end();
  });
}

async function fetchRetry(url, retries = 3, useProxy = true) {
  const fn = useProxy ? fetchProxy : fetchDirect;
  networkStats.requests++;
  for (let i = 1; i <= retries; i++) {
    try { return await fn(url); }
    catch (error) {
      if (i === retries) {
        networkStats.failures++;
        return null;
      }
      networkStats.retries++;
      const wait = Math.min(error.retryAfterMs || 500 * (2 ** (i - 1)) + Math.random() * 500, 30000);
      await new Promise(resolve => setTimeout(resolve, wait));
    }
  }
}

async function mapLimit(items, concurrency, worker) {
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

// ─── PARSERS ───────────────────────────────────────────────────

// Non-entertainment domains GDELT keeps matching on "entertainment" queries
// (entertainment-law reviews, trade-legal sites). Blocked at ingest.
const GDELT_JUNK_DOMAINS = ['natlawreview.com', 'baltic-review.com', 'jdsupra.com', 'lexology.com', 'mondaq.com', 'law360.com', 'globallegalinsights.com'];

function parseGDELTArticles(json) {
  try {
    const data = JSON.parse(json);
    const articles = data.articles || [];
    return articles
      .filter(a => a.language === 'English' && a.title && a.title.length >= 15)
      .filter(a => !GDELT_JUNK_DOMAINS.some(d => (a.domain || '').includes(d)))
      .filter(a => !classifier.isOffTopic(a.title)) // topic gate: kill politics/sport bleed
      .map((a, idx) => ({
        ...classifier.classify(a.title),
        title: a.title.trim(),
        url: a.url || '',
        source: a.domain || null,
        category: classifier.detectVertical(a.title) || 'entertainment',
        publish_date: a.seendate || null,
        has_thumbnail: !!a.socialimage,
        thumbnail_url: a.socialimage || null,
        position_in_feed: idx + 1,
        feed_section: 'gdelt_entertainment',
      }));
  } catch { return []; }
}

async function parseRSS(xml, feedSection) {
  const parsed = await parseStringPromise(xml, { explicitArray: false });
  const items = parsed?.rss?.channel?.item;
  if (!items) return [];
  const itemArray = Array.isArray(items) ? items : [items];
  return itemArray
    .filter(i => i.title && i.title.length >= 10 && !classifier.isOffTopic(i.title))
    .map((item, idx) => ({
    ...classifier.classify(item.title),
    title: item.title,
    url: item.link || '',
    source: item.source?._ || item.source || null,
    category: classifier.detectVertical(item.title) || 'entertainment',
    publish_date: item.pubDate || null,
    has_thumbnail: false,
    position_in_feed: idx + 1,
    feed_section: feedSection,
  }));
}

// ─── MAIN ──────────────────────────────────────────────────────

(async () => {
  console.log(chalk.bold.magenta('\n  🔥🔥🔥 NUCLEAR ENTERTAINMENT LOADER 🔥🔥🔥'));
  console.log(chalk.magenta('  Pulling EVERYTHING entertainment from GDELT + Google News\n'));

  const dbPath = path.resolve(config.database.path);
  if (RESET && !SOURCES_ONLY && fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  const db = new DB(dbPath);
  await db.ready();
  db.beginBatch();

  const startTime = Date.now();
  let totalScraped = 0;
  let totalSaved = 0;
  let feedCount = 0;

  function saveArticles(articles, label) {
    if (!articles.length) return 0;
    const scanId = db.insertScan({ category: label, proxy_used: 'mixed', articles_found: articles.length });
    const enriched = articles.map(a => ({ ...a, scan_id: scanId, scraped_at: new Date().toISOString() }));
    const saved = db.insertBulkArticles(enriched);
    feedCount++;
    if (feedCount % CHECKPOINT_EVERY === 0) db.checkpoint();
    return saved;
  }

  // ═══════════════════════════════════════════════════════════════
  // PHASE 1: GDELT DOC API — Entertainment queries (no proxy needed!)
  // GDELT is free, no rate limits, returns 250 per query
  // ═══════════════════════════════════════════════════════════════
  console.log(chalk.bold.yellow('  ═══ PHASE 1: GDELT Entertainment Queries ═══'));

  for (const timespan of ((SOURCES_ONLY || RSS_ONLY) ? [] : GDELT_TIMESPANS)) {
    const label = timespan === 1440 ? '24h' : timespan === 4320 ? '3d' : '7d';
    console.log(chalk.dim(`\n  Timespan: ${label}`));
    
    await mapLimit(ENTERTAINMENT_QUERIES, GDELT_CONCURRENCY, async query => {
      const encoded = encodeURIComponent(query);
      const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encoded} sourcelang:eng&mode=artlist&maxrecords=250&format=json&timespan=${timespan}&sort=datedesc`;
      
      const json = await fetchRetry(url, 2, false); // GDELT = direct, no proxy needed
      if (!json) return;
      
      const articles = parseGDELTArticles(json);
      const saved = saveArticles(articles, `gdelt_${query}_${label}`);
      totalScraped += articles.length;
      totalSaved += saved;
      if (saved > 0) process.stdout.write(chalk.green('.'));
      
      // GDELT is generous but let's be polite
      await new Promise(r => setTimeout(r, 100 + Math.random() * 200));
    });
    
    console.log(chalk.cyan(`  → ${label}: ${totalSaved} total saved so far`));
  }

  console.log(chalk.bold.cyan(`\n  Phase 1 complete: ${totalSaved} articles from GDELT\n`));

  // ═══════════════════════════════════════════════════════════════
  // PHASE 2: GDELT by Discover-dominant sources
  // Pull articles specifically from domains that dominate Discover
  // ═══════════════════════════════════════════════════════════════
  const phase2Start = totalSaved;
  console.log(chalk.bold.yellow('  ═══ PHASE 2: Discover-Dominant Sources ═══'));

  console.log(chalk.dim(`  ${SOURCES.length} entertainment domains\n`));

  await mapLimit((RSS_ONLY ? [] : SOURCES), GDELT_CONCURRENCY, async domain => {
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=domain:${domain} sourcelang:eng&mode=artlist&maxrecords=250&format=json&timespan=10080&sort=datedesc`;
    
    const json = await fetchRetry(url, 2, false);
    if (!json) return;
    
    const articles = parseGDELTArticles(json);
    const saved = saveArticles(articles, `gdelt_source_${domain}`);
    totalScraped += articles.length;
    totalSaved += saved;
    if (saved > 0) process.stdout.write(chalk.green(`  ✓ ${domain}:${saved} `));
    if (feedCount % 10 === 0) console.log('');
    
    await new Promise(r => setTimeout(r, 100 + Math.random() * 200));
  });

  console.log(chalk.bold.cyan(`\n  Phase 2 complete: ${totalSaved - phase2Start} new from Discover sources\n`));

  // ═══════════════════════════════════════════════════════════════
  // PHASE 3: Google News RSS — Entertainment searches via proxy
  // ═══════════════════════════════════════════════════════════════
  const phase3Start = totalSaved;
  console.log(chalk.bold.yellow('  ═══ PHASE 3: Google News RSS Entertainment ═══'));
  
  const geos = [
    { gl: 'US', hl: 'en-US', ceid: 'US:en' },
    { gl: 'GB', hl: 'en-GB', ceid: 'GB:en' },
    { gl: 'CA', hl: 'en-CA', ceid: 'CA:en' },
  ];

  for (const geo of ((SOURCES_ONLY || RSS_ONLY) ? [] : geos)) {
    console.log(chalk.dim(`\n  ${geo.gl}:`));
    await mapLimit(ENTERTAINMENT_QUERIES, GOOGLE_CONCURRENCY, async query => {
      const encoded = encodeURIComponent(query);
      const url = `https://news.google.com/rss/search?q=${encoded}&hl=${geo.hl}&gl=${geo.gl}&ceid=${geo.ceid}`;
      
      const xml = await fetchRetry(url, 2, true); // Use proxy for Google
      if (!xml) return;
      
      try {
        const articles = await parseRSS(xml, `gnews_${query}_${geo.gl}`);
        const saved = saveArticles(articles, `gnews_${query}_${geo.gl}`);
        totalScraped += articles.length;
        totalSaved += saved;
        if (saved > 0) process.stdout.write(chalk.green('.'));
      } catch {}
      
      await new Promise(r => setTimeout(r, 150 + Math.random() * 350));
    });
    console.log(chalk.cyan(`  → ${geo.gl} done`));
  }

  console.log(chalk.bold.cyan(`\n  Phase 3 complete: ${totalSaved - phase3Start} new from Google News\n`));

  // ═══════════════════════════════════════════════════════════════
  // PHASE 4: Direct publisher RSS — anime-native + fandom feeds
  // ═══════════════════════════════════════════════════════════════
  const phase4Start = totalSaved;
  console.log(chalk.bold.yellow('  ═══ PHASE 4: Direct Publisher RSS ═══'));

  await mapLimit((RSS_ONLY ? RSS_FEEDS : SOURCES_ONLY ? [] : RSS_FEEDS), RSS_CONCURRENCY, async ([hint, feedUrl]) => {
    const xml = await fetchRetry(feedUrl, 2, false);
    if (!xml) { process.stdout.write(chalk.red('x')); return; }
    try {
      const articles = (await parseRSS(xml, `rss_${hint}`))
        // feed niche is a better fallback than 'entertainment' when the
        // title itself doesn't name a franchise
        .map(a => ({ ...a, category: a.fw_vertical !== 'other' ? a.fw_vertical : hint }));
      const saved = saveArticles(articles, `rss_${hint}`);
      totalScraped += articles.length;
      totalSaved += saved;
      if (saved > 0) process.stdout.write(chalk.green('.'));
    } catch { process.stdout.write(chalk.red('x')); }
    await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
  });

  console.log(chalk.bold.cyan(`\n  Phase 4 complete: ${totalSaved - phase4Start} new from direct RSS\n`));

  // ═══════════════════════════════════════════════════════════════
  // DONE
  // ═══════════════════════════════════════════════════════════════
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  db.endBatch();
  const totalInDB = db.getArticleCount();
  db.close();

  console.log(chalk.bold.magenta(`\n  ═════════════════════════════════════════════`));
  console.log(chalk.bold.magenta(`  🔥 NUCLEAR LOAD COMPLETE`));
  console.log(chalk.bold.magenta(`  Feeds hit:        ${feedCount}`));
  console.log(chalk.bold.magenta(`  Requests failed:  ${networkStats.failures}/${networkStats.requests} (${networkStats.retries} retries)`));
  console.log(chalk.bold.magenta(`  Total scraped:    ${totalScraped}`));
  console.log(chalk.bold.magenta(`  Unique saved:     ${totalSaved}`));
  console.log(chalk.bold.magenta(`  Total in DB:      ${totalInDB}`));
  console.log(chalk.bold.magenta(`  Duration:         ${duration}s`));
  console.log(chalk.bold.magenta(`  ═════════════════════════════════════════════\n`));

  console.log(chalk.cyan('  Run the analysis: node src/cli.js analyze'));
  console.log(chalk.cyan('  Start dashboard:  node src/cli.js dashboard\n'));

  if (networkStats.requests > 0 && networkStats.failures === networkStats.requests) process.exitCode = 1;
})();
