const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

class DB {
  constructor(dbPath) {
    this.dbPath = path.resolve(dbPath);
    this.db = null;
    this._ready = this._init();
  }

  async _init() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const SQL = await initSqlJs();

    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    this._createTables();
    return this;
  }

  async ready() {
    await this._ready;
    return this;
  }

  _save() {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
    this._dirty = false;
  }

  _createTables() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS scans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        category TEXT,
        proxy_used TEXT,
        articles_found INTEGER DEFAULT 0,
        duration_ms INTEGER DEFAULT 0
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scan_id INTEGER,
        url TEXT,
        title TEXT NOT NULL UNIQUE,
        subtitle TEXT,
        source TEXT,
        category TEXT,
        thumbnail_url TEXT,
        has_thumbnail INTEGER DEFAULT 0,
        publish_date TEXT,
        scraped_at TEXT NOT NULL,
        title_word_count INTEGER,
        title_char_count INTEGER,
        title_has_number INTEGER DEFAULT 0,
        title_has_question INTEGER DEFAULT 0,
        title_has_colon INTEGER DEFAULT 0,
        title_has_dash INTEGER DEFAULT 0,
        title_starts_with_number INTEGER DEFAULT 0,
        title_sentiment TEXT,
        format TEXT,
        power_words TEXT,
        emotional_triggers TEXT,
        title_structure TEXT,
        position_in_feed INTEGER,
        feed_section TEXT,
        FOREIGN KEY (scan_id) REFERENCES scans(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS title_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern TEXT UNIQUE,
        example_title TEXT,
        category TEXT,
        frequency INTEGER DEFAULT 1,
        first_seen TEXT,
        last_seen TEXT
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS trending_topics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic TEXT,
        category TEXT,
        appearances INTEGER DEFAULT 1,
        first_seen TEXT,
        last_seen TEXT,
        sample_titles TEXT
      )
    `);

    // Create indexes
    try {
      this.db.run('CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_articles_format ON articles(format)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_articles_scraped ON articles(scraped_at)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source)');
    } catch(e) { /* indexes may already exist */ }
  }

  _queryOne(sql, params = []) {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return null;
  }

  _queryAll(sql, params = []) {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }

  _run(sql, params = []) {
    this._dirty = true;
    this.db.run(sql, params);
    return { lastId: this.db.exec("SELECT last_insert_rowid()")[0]?.values[0]?.[0] };
  }

  insertScan(data) {
    this._run(
      `INSERT INTO scans (timestamp, category, proxy_used, articles_found, duration_ms) VALUES (?, ?, ?, ?, ?)`,
      [data.timestamp || new Date().toISOString(), data.category, data.proxy_used, data.articles_found || 0, data.duration_ms || 0]
    );
    const result = this._queryOne('SELECT last_insert_rowid() as id');
    this._save();
    return result.id;
  }

  insertArticle(article) {
    try {
      // sql.js can't bind undefined — coerce to null
      const v = (x) => x === undefined ? null : x;

      this._run(
        `INSERT OR IGNORE INTO articles (
          scan_id, url, title, subtitle, source, category,
          thumbnail_url, has_thumbnail, publish_date, scraped_at,
          title_word_count, title_char_count,
          title_has_number, title_has_question, title_has_colon, title_has_dash,
          title_starts_with_number, title_sentiment,
          format, power_words, emotional_triggers, title_structure,
          position_in_feed, feed_section
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          v(article.scan_id), v(article.url), v(article.title), v(article.subtitle),
          v(article.source), v(article.category),
          v(article.thumbnail_url), article.has_thumbnail ? 1 : 0,
          v(article.publish_date), article.scraped_at || new Date().toISOString(),
          v(article.title_word_count), v(article.title_char_count),
          article.title_has_number ? 1 : 0, article.title_has_question ? 1 : 0,
          article.title_has_colon ? 1 : 0, article.title_has_dash ? 1 : 0,
          article.title_starts_with_number ? 1 : 0, v(article.title_sentiment),
          v(article.format), JSON.stringify(article.power_words || []),
          JSON.stringify(article.emotional_triggers || []), v(article.title_structure),
          v(article.position_in_feed), v(article.feed_section)
        ]
      );
      return { changes: this.db.getRowsModified() };
    } catch(e) {
      const msg = e?.message || String(e);
      if (!msg.includes('UNIQUE constraint')) {
        console.error('[db] Insert error:', msg, '| title:', (article.title || '').substring(0, 40));
      }
      return { changes: 0 };
    }
  }

  insertBulkArticles(articles) {
    let inserted = 0;
    for (const a of articles) {
      const result = this.insertArticle(a);
      if (result.changes > 0) inserted++;
    }
    this._save();
    return inserted;
  }

  upsertPattern(pattern, exampleTitle, category) {
    const existing = this._queryOne('SELECT id FROM title_patterns WHERE pattern = ?', [pattern]);
    if (existing) {
      this._run(`UPDATE title_patterns SET frequency = frequency + 1, last_seen = datetime('now') WHERE id = ?`, [existing.id]);
    } else {
      this._run(
        `INSERT INTO title_patterns (pattern, example_title, category, frequency, first_seen, last_seen) VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))`,
        [pattern, exampleTitle, category]
      );
    }
    this._save();
  }

  upsertTopic(topic, category, sampleTitle) {
    const existing = this._queryOne('SELECT id, sample_titles FROM trending_topics WHERE topic = ? AND category = ?', [topic, category]);
    if (existing) {
      const titles = JSON.parse(existing.sample_titles || '[]');
      if (titles.length < 5) titles.push(sampleTitle);
      this._run(`UPDATE trending_topics SET appearances = appearances + 1, last_seen = datetime('now'), sample_titles = ? WHERE id = ?`,
        [JSON.stringify(titles), existing.id]);
    } else {
      this._run(`INSERT INTO trending_topics (topic, category, appearances, first_seen, last_seen, sample_titles) VALUES (?, ?, 1, datetime('now'), datetime('now'), ?)`,
        [topic, category, JSON.stringify([sampleTitle])]);
    }
    this._save();
  }

  // ---- Query methods ----

  getArticleCount() {
    return this._queryOne('SELECT COUNT(*) as count FROM articles')?.count || 0;
  }

  getScanCount() {
    return this._queryOne('SELECT COUNT(*) as count FROM scans')?.count || 0;
  }

  getFormatDistribution(days = 30) {
    const cutoff = `-${days} days`;
    return this._queryAll(`
      SELECT format, COUNT(*) as count,
             ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM articles WHERE scraped_at > datetime('now', ?)), 1) as pct
      FROM articles WHERE scraped_at > datetime('now', ?)
      GROUP BY format ORDER BY count DESC
    `, [cutoff, cutoff]);
  }

  getTitleLengthStats(days = 30) {
    return this._queryAll(`
      SELECT format, ROUND(AVG(title_word_count), 1) as avg_words,
             MIN(title_word_count) as min_words, MAX(title_word_count) as max_words,
             ROUND(AVG(title_char_count), 1) as avg_chars, COUNT(*) as sample_size
      FROM articles WHERE scraped_at > datetime('now', ?)
      GROUP BY format ORDER BY sample_size DESC
    `, [`-${days} days`]);
  }

  getTopSources(days = 30, limit = 20) {
    return this._queryAll(`
      SELECT source, COUNT(*) as count, GROUP_CONCAT(DISTINCT category) as categories
      FROM articles WHERE scraped_at > datetime('now', ?) AND source IS NOT NULL
      GROUP BY source ORDER BY count DESC LIMIT ?
    `, [`-${days} days`, limit]);
  }

  getTopPatterns(limit = 20) {
    return this._queryAll('SELECT * FROM title_patterns ORDER BY frequency DESC LIMIT ?', [limit]);
  }

  getTrendingTopics(days = 7, limit = 20) {
    return this._queryAll(`SELECT * FROM trending_topics WHERE last_seen > datetime('now', ?) ORDER BY appearances DESC LIMIT ?`,
      [`-${days} days`, limit]);
  }

  getPowerWordFrequency(days = 30) {
    const rows = this._queryAll(`SELECT power_words FROM articles WHERE scraped_at > datetime('now', ?) AND power_words IS NOT NULL`,
      [`-${days} days`]);
    const freq = {};
    for (const row of rows) {
      try {
        const words = JSON.parse(row.power_words);
        for (const w of words) freq[w] = (freq[w] || 0) + 1;
      } catch {}
    }
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([word, count]) => ({ word, count }));
  }

  getNumberUsageStats(days = 30) {
    return this._queryOne(`
      SELECT SUM(title_has_number) as with_number, SUM(title_starts_with_number) as starts_with_number,
             SUM(title_has_question) as with_question, SUM(title_has_colon) as with_colon,
             SUM(title_has_dash) as with_dash, COUNT(*) as total
      FROM articles WHERE scraped_at > datetime('now', ?)
    `, [`-${days} days`]) || {};
  }

  getCategoryBreakdown(days = 30) {
    return this._queryAll(`
      SELECT category, COUNT(*) as count, ROUND(AVG(title_word_count), 1) as avg_title_words,
             SUM(title_has_number) as titles_with_numbers, SUM(title_has_question) as titles_with_questions
      FROM articles WHERE scraped_at > datetime('now', ?)
      GROUP BY category ORDER BY count DESC
    `, [`-${days} days`]);
  }

  getRecentArticles(limit = 50) {
    return this._queryAll(`SELECT title, source, category, format, title_word_count, power_words, scraped_at, url
      FROM articles ORDER BY scraped_at DESC LIMIT ?`, [limit]);
  }

  getAlgorithmInsights(days = 30) {
    const d = `-${days} days`;
    return {
      avgTitleLength: this._queryOne(`SELECT ROUND(AVG(title_word_count),1) as v FROM articles WHERE scraped_at > datetime('now', ?)`, [d])?.v,
      pctWithNumbers: this._queryOne(`SELECT ROUND(AVG(title_has_number)*100,1) as v FROM articles WHERE scraped_at > datetime('now', ?)`, [d])?.v,
      pctWithQuestions: this._queryOne(`SELECT ROUND(AVG(title_has_question)*100,1) as v FROM articles WHERE scraped_at > datetime('now', ?)`, [d])?.v,
      pctStartsWithNumber: this._queryOne(`SELECT ROUND(AVG(title_starts_with_number)*100,1) as v FROM articles WHERE scraped_at > datetime('now', ?)`, [d])?.v,
      pctWithColon: this._queryOne(`SELECT ROUND(AVG(title_has_colon)*100,1) as v FROM articles WHERE scraped_at > datetime('now', ?)`, [d])?.v,
      topFormat: this._queryOne(`SELECT format, COUNT(*) as c FROM articles WHERE scraped_at > datetime('now', ?) GROUP BY format ORDER BY c DESC LIMIT 1`, [d]),
      topSource: this._queryOne(`SELECT source, COUNT(*) as c FROM articles WHERE scraped_at > datetime('now', ?) AND source IS NOT NULL GROUP BY source ORDER BY c DESC LIMIT 1`, [d]),
      avgTitleChars: this._queryOne(`SELECT ROUND(AVG(title_char_count),1) as v FROM articles WHERE scraped_at > datetime('now', ?)`, [d])?.v,
    };
  }

  close() {
    if (this.db) {
      // Only persist if this handle actually wrote something. A read-only
      // handle (dashboard, analyze) saving on close would overwrite newer
      // data another process wrote to the file after we loaded it.
      if (this._dirty) this._save();
      this.db.close();
    }
  }
}

module.exports = DB;
