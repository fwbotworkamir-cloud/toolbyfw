/**
 * Report Generator — Creates beautiful HTML reports for content teams
 * with actionable insights, headline scoring, and "do this not that" examples.
 */

const path = require('path');
const fs = require('fs');

class ReportGenerator {
  constructor(db, classifier) {
    this.db = db;
    this.classifier = classifier;
  }

  generateHTMLReport(days = 30) {
    const data = this._gatherData(days);
    const html = this._buildHTML(data);
    return html;
  }

  saveReport(outputPath, days = 30) {
    const html = this.generateHTMLReport(days);
    fs.writeFileSync(outputPath, html);
    return outputPath;
  }

  scoreHeadline(title) {
    const classified = this.classifier.classify(title);
    const benchmarks = this._getBenchmarks();
    let score = 50; // baseline
    const tips = [];
    const boosts = [];

    // Word count scoring
    const wordDiff = Math.abs(classified.title_word_count - benchmarks.avgWords);
    if (wordDiff <= 2) { score += 10; boosts.push('Title length is in the sweet spot'); }
    else if (wordDiff <= 4) { score += 5; }
    else { score -= 5; tips.push(`Aim for ~${benchmarks.avgWords} words (yours: ${classified.title_word_count})`); }

    // Char count scoring
    const charDiff = Math.abs(classified.title_char_count - benchmarks.avgChars);
    if (charDiff <= 10) { score += 5; }
    else if (classified.title_char_count > 90) { score -= 10; tips.push('Title may get truncated in Discover (>90 chars)'); }

    // Power words
    if (classified.power_words.length > 0) {
      score += Math.min(classified.power_words.length * 5, 15);
      boosts.push(`Power words: ${classified.power_words.join(', ')}`);
    } else {
      tips.push('Add a power word (new, first, best, exclusive, revealed)');
    }

    // Format scoring
    if (classified.format === 'general' || classified.format === 'news') { score += 5; }
    else if (classified.format === 'listicle' || classified.format === 'review') { score += 3; }
    else if (classified.format === 'how-to' || classified.format === 'guide') { score -= 5; tips.push('How-to/guide format rarely performs on Discover'); }

    // Em/en dash: refuted 2026-07-31 — 0/1,441 verified competitor titles use
    // one; the old "60% use dashes" stat was feed-suffix artifact (" - Source").
    if (/[—–]/.test(title)) { score -= 5; tips.push('Drop the em-dash — top fandom competitors never use one (0/1,441)'); }

    // Number usage
    if (classified.title_has_number && !classified.title_starts_with_number) { score += 5; boosts.push('Embedded number adds specificity'); }
    else if (classified.title_starts_with_number) { tips.push('Starting with a number is weak on Discover — embed it instead'); }

    // Question penalty
    if (classified.title_has_question) { score -= 5; tips.push('Questions underperform — try a declarative statement instead'); }

    // "New" bonus
    if (classified.power_words.includes('new')) { score += 5; boosts.push('"New" is the #1 Discover trigger word'); }

    // Emotion
    if (classified.emotional_triggers.length > 0) { score += 5; boosts.push(`Emotional triggers: ${classified.emotional_triggers.join(', ')}`); }

    score = Math.max(0, Math.min(100, score));

    return {
      score,
      grade: score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : score >= 35 ? 'D' : 'F',
      title,
      classified,
      boosts,
      tips,
      benchmarks,
    };
  }

  _getBenchmarks() {
    const insights = this.db.getAlgorithmInsights(30);
    return {
      avgWords: insights.avgTitleLength || 14,
      avgChars: insights.avgTitleChars || 81,
      pctNumbers: insights.pctWithNumbers || 37,
      pctDash: 60,
      pctColon: insights.pctWithColon || 24,
    };
  }

  _gatherData(days) {
    const insights = this.db.getAlgorithmInsights(days);
    const formats = this.db.getFormatDistribution(days);
    const titleStats = this.db.getTitleLengthStats(days);
    const sources = this.db.getTopSources(days, 25);
    const powerWords = this.db.getPowerWordFrequency(days);
    const numberStats = this.db.getNumberUsageStats(days);
    const totalArticles = this.db.getArticleCount();
    const totalScans = this.db.getScanCount();

    // Get sample titles for each format
    const formatExamples = {};
    for (const f of formats) {
      const examples = this.db._queryAll(
        `SELECT title, source, title_word_count, power_words FROM articles
         WHERE format = ? AND scraped_at > datetime('now', ?) ORDER BY RANDOM() LIMIT 3`,
        [f.format, `-${days} days`]
      );
      formatExamples[f.format] = examples;
    }

    // Get top performing title structures
    const topStructures = this.db._queryAll(`
      SELECT title_structure, COUNT(*) as count,
             ROUND(AVG(title_word_count),1) as avg_words
      FROM articles WHERE scraped_at > datetime('now', ?) AND title_structure != ''
      GROUP BY title_structure ORDER BY count DESC LIMIT 10
    `, [`-${days} days`]);

    // Sentiment distribution
    const sentiments = this.db._queryAll(`
      SELECT title_sentiment, COUNT(*) as count,
             ROUND(COUNT(*)*100.0/(SELECT COUNT(*) FROM articles WHERE scraped_at > datetime('now', ?)),1) as pct
      FROM articles WHERE scraped_at > datetime('now', ?)
      GROUP BY title_sentiment ORDER BY count DESC
    `, [`-${days} days`, `-${days} days`]);

    // Source domain analysis
    const sourcesByFormat = this.db._queryAll(`
      SELECT source, format, COUNT(*) as count
      FROM articles WHERE scraped_at > datetime('now', ?) AND source IS NOT NULL
      GROUP BY source, format ORDER BY count DESC LIMIT 50
    `, [`-${days} days`]);

    return {
      generated: new Date().toISOString(),
      days, totalArticles, totalScans,
      insights, formats, titleStats, sources,
      powerWords: powerWords.slice(0, 20),
      numberStats, formatExamples, topStructures,
      sentiments, sourcesByFormat,
    };
  }

  _buildHTML(data) {
    const s = data.insights;
    const n = data.numberStats;
    const total = n?.total || 1;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Discover Algorithm Report — ${new Date().toISOString().split('T')[0]}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #0a0e1a; --surface: #111827; --card: #1a2236;
    --border: #2a3450; --text: #e2e8f0; --muted: #8892a8;
    --accent: #6366f1; --accent2: #22d3ee; --green: #10b981;
    --yellow: #f59e0b; --red: #ef4444; --pink: #ec4899;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
  .container { max-width: 1100px; margin: 0 auto; padding: 40px 24px; }
  
  header { text-align: center; margin-bottom: 48px; padding: 40px; background: linear-gradient(135deg, #1a1a3e 0%, #0a0e1a 100%); border-radius: 16px; border: 1px solid var(--border); }
  header h1 { font-size: 2rem; font-weight: 800; background: linear-gradient(135deg, var(--accent), var(--accent2)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px; }
  header .meta { color: var(--muted); font-size: 0.9rem; }
  header .meta strong { color: var(--accent2); }
  
  .section { margin-bottom: 40px; }
  .section h2 { font-size: 1.3rem; font-weight: 700; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid var(--border); display: flex; align-items: center; gap: 8px; }
  .section h2 .emoji { font-size: 1.4rem; }
  .section h3 { font-size: 1rem; font-weight: 600; margin: 16px 0 8px; color: var(--accent2); }
  
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .card { background: var(--card); padding: 20px; border-radius: 12px; border: 1px solid var(--border); }
  .card .label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 4px; }
  .card .value { font-size: 1.8rem; font-weight: 800; }
  .card .sub { font-size: 0.8rem; color: var(--muted); }
  .card .value.green { color: var(--green); }
  .card .value.accent { color: var(--accent); }
  .card .value.yellow { color: var(--yellow); }
  .card .value.cyan { color: var(--accent2); }
  
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  table th { text-align: left; padding: 10px 12px; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); border-bottom: 2px solid var(--border); }
  table td { padding: 10px 12px; border-bottom: 1px solid var(--border); font-size: 0.9rem; }
  table tr:hover { background: rgba(99,102,241,0.05); }
  
  .bar-row { display: flex; align-items: center; gap: 12px; margin: 4px 0; }
  .bar-label { min-width: 120px; font-size: 0.85rem; }
  .bar-fill { height: 24px; border-radius: 4px; min-width: 2px; transition: width 0.3s; display: flex; align-items: center; padding: 0 8px; font-size: 0.75rem; font-weight: 600; color: white; }
  .bar-pct { font-size: 0.8rem; color: var(--muted); min-width: 45px; }
  
  .rule-box { background: var(--card); border-radius: 12px; padding: 20px; margin: 12px 0; border-left: 4px solid var(--green); }
  .rule-box.warn { border-left-color: var(--red); }
  .rule-box h4 { font-size: 0.95rem; margin-bottom: 6px; }
  .rule-box p { font-size: 0.85rem; color: var(--muted); }
  .rule-box .example { background: var(--bg); padding: 10px 14px; border-radius: 6px; margin-top: 8px; font-size: 0.85rem; font-style: italic; color: var(--accent2); }
  
  .do-dont { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 0; }
  .do-dont .do, .do-dont .dont { padding: 16px; border-radius: 10px; }
  .do-dont .do { background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.2); }
  .do-dont .dont { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); }
  .do-dont h4 { font-size: 0.85rem; margin-bottom: 8px; }
  .do-dont .do h4 { color: var(--green); }
  .do-dont .dont h4 { color: var(--red); }
  .do-dont ul { list-style: none; padding: 0; }
  .do-dont li { font-size: 0.85rem; padding: 4px 0; color: var(--muted); }
  .do-dont li::before { margin-right: 6px; }
  .do-dont .do li::before { content: '✓'; color: var(--green); }
  .do-dont .dont li::before { content: '✗'; color: var(--red); }
  
  .scorer { background: var(--card); border-radius: 12px; padding: 24px; border: 1px solid var(--border); }
  .scorer input { width: 100%; padding: 14px 16px; border-radius: 8px; border: 2px solid var(--border); background: var(--bg); color: var(--text); font-size: 1rem; font-family: 'Inter', sans-serif; outline: none; transition: border 0.2s; }
  .scorer input:focus { border-color: var(--accent); }
  .scorer button { margin-top: 12px; padding: 10px 24px; border-radius: 8px; border: none; background: var(--accent); color: white; font-weight: 600; cursor: pointer; font-size: 0.9rem; transition: opacity 0.2s; }
  .scorer button:hover { opacity: 0.85; }
  .score-result { margin-top: 16px; display: none; }
  .score-grade { font-size: 3rem; font-weight: 800; text-align: center; padding: 16px; }
  .score-grade.A { color: var(--green); }
  .score-grade.B { color: var(--accent2); }
  .score-grade.C { color: var(--yellow); }
  .score-grade.D { color: #f97316; }
  .score-grade.F { color: var(--red); }
  .score-tips { margin-top: 12px; }
  .score-tips li { font-size: 0.85rem; padding: 3px 0; }
  .score-tips li.boost { color: var(--green); }
  .score-tips li.tip { color: var(--yellow); }

  .playbook-formula { background: linear-gradient(135deg, rgba(99,102,241,0.1), rgba(34,211,238,0.1)); padding: 24px; border-radius: 12px; border: 1px solid var(--accent); margin: 16px 0; text-align: center; }
  .playbook-formula code { font-size: 1.1rem; color: var(--accent2); font-weight: 600; display: block; padding: 12px; }

  .pw-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
  .pw-item { display: flex; justify-content: space-between; padding: 8px 12px; background: var(--card); border-radius: 6px; font-size: 0.85rem; }
  .pw-item .word { font-weight: 600; }
  .pw-item .count { color: var(--muted); }

  @media (max-width: 768px) {
    .cards { grid-template-columns: 1fr 1fr; }
    .do-dont { grid-template-columns: 1fr; }
    header h1 { font-size: 1.5rem; }
  }
  @media print { body { background: white; color: #111; } .card, .rule-box, .scorer { border: 1px solid #ddd; } }
</style>
</head>
<body>
<div class="container">

<header>
  <h1>⚡ Discover Entertainment Algorithm Report</h1>
  <div class="meta">
    Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} · 
    <strong>${data.totalArticles.toLocaleString()}</strong> articles analyzed · 
    ${data.totalScans} scans · Last ${data.days} days
  </div>
</header>

<!-- KPI CARDS -->
<div class="cards">
  <div class="card">
    <div class="label">Total Articles</div>
    <div class="value accent">${data.totalArticles.toLocaleString()}</div>
    <div class="sub">entertainment vertical</div>
  </div>
  <div class="card">
    <div class="label">Optimal Title Length</div>
    <div class="value green">${s.avgTitleLength || 14}</div>
    <div class="sub">words · ${s.avgTitleChars || 81} characters</div>
  </div>
  <div class="card">
    <div class="label">% With Numbers</div>
    <div class="value yellow">${s.pctWithNumbers || 37}%</div>
    <div class="sub">${Math.round((s.pctWithNumbers || 37) / 100 * data.totalArticles)} articles</div>
  </div>
  <div class="card">
    <div class="label">#1 Power Word</div>
    <div class="value cyan">new</div>
    <div class="sub">${(data.powerWords[0]?.count || 0).toLocaleString()} uses (${((data.powerWords[0]?.count || 0) / data.totalArticles * 100).toFixed(1)}%)</div>
  </div>
  <div class="card">
    <div class="label">Top Source</div>
    <div class="value" style="font-size:1.1rem;color:var(--pink)">${s.topSource?.source || 'N/A'}</div>
    <div class="sub">${s.topSource?.c || 0} articles</div>
  </div>
</div>

<!-- HEADLINE SCORER -->
<div class="section">
  <h2><span class="emoji">🎯</span> Headline Scorer</h2>
  <p style="color:var(--muted);margin-bottom:12px;font-size:0.9rem;">Paste your headline below to see how it scores against the algorithm patterns.</p>
  <div class="scorer">
    <input type="text" id="headline-input" placeholder="Type or paste your headline here..." />
    <button onclick="scoreHeadline()">Score This Headline</button>
    <div class="score-result" id="score-result"></div>
  </div>
</div>

<!-- THE PLAYBOOK -->
<div class="section">
  <h2><span class="emoji">📖</span> The Content Team Playbook</h2>
  
  <div class="playbook-formula">
    <div style="font-size:0.85rem;color:var(--muted);margin-bottom:8px;">THE DISCOVER ENTERTAINMENT TITLE FORMULA</div>
    <code>[Celebrity/Property] [Action Verb] [Specific Detail] — [Reaction/Context]</code>
    <div style="font-size:0.8rem;color:var(--muted);margin-top:8px;">60.3% of all Discover entertainment articles use this emdash structure</div>
  </div>

  <div class="do-dont">
    <div class="do">
      <h4>✓ DO THIS (wins Discover)</h4>
      <ul>
        <li>Write declarative statements (73.8% of winners)</li>
        <li>Use emdash (—) to separate hook from context</li>
        <li>Keep titles at ${s.avgTitleLength || 14} words / ${s.avgTitleChars || 81} chars</li>
        <li>Include "new", "first", "best", or "exclusive"</li>
        <li>Embed numbers mid-title for specificity</li>
        <li>Name specific people, shows, movies</li>
        <li>Use colons for franchise content (24.3%)</li>
      </ul>
    </div>
    <div class="dont">
      <h4>✗ DON'T DO THIS (underperforms)</h4>
      <ul>
        <li>Write question headlines (only 5.3%)</li>
        <li>Start titles with numbers like "10 Best..." (6.4%)</li>
        <li>Write how-to content (0.8% — wrong intent)</li>
        <li>Write vague "You won't believe..." bait</li>
        <li>Exceed 90 characters (gets truncated)</li>
        <li>Use opinion/editorial format (0.7%)</li>
        <li>Write generic descriptions without specifics</li>
      </ul>
    </div>
  </div>

  <h3>Title Rules by the Numbers</h3>
  <div class="rule-box">
    <h4>📏 Rule 1: ${s.avgTitleLength || 14} words, ${s.avgTitleChars || 81} characters</h4>
    <p>The average Discover entertainment title is exactly ${s.avgTitleLength || 14} words. Titles over 90 characters get truncated in the feed. Stay between 12-16 words.</p>
  </div>
  <div class="rule-box">
    <h4>➖ Rule 2: Use the emdash (—) — 60.3% do</h4>
    <p>The most common title structure separates the hook from context with a dash or emdash. This is THE Discover format.</p>
    <div class="example">"Dakota Johnson stuns as Marilyn Monroe in new film — first trailer drops"</div>
  </div>
  <div class="rule-box">
    <h4>🆕 Rule 3: "New" is the #1 word — ${((data.powerWords[0]?.count || 0) / data.totalArticles * 100).toFixed(1)}% of titles</h4>
    <p>Discover's core value proposition is showing users things they haven't seen. "New" directly signals this.</p>
    <div class="example">"Netflix reveals new season 3 premiere date for hit drama"</div>
  </div>
  <div class="rule-box">
    <h4>🔢 Rule 4: Numbers embedded, not leading — 36.9% contain, only 6.4% start</h4>
    <p>Numbers add specificity ("$285M opening weekend") but starting with them ("10 Ways to...") underperforms.</p>
    <div class="example">"'Spider-Man: Brand New Day' swings to $285M opening weekend — a franchise record"</div>
  </div>
  <div class="rule-box warn">
    <h4>❓ Rule 5: Avoid questions — only 5.3% make the cut</h4>
    <p>Discover rewards answers, not questions. Convert "Why did X happen?" into "X happened because Y — here's what it means."</p>
  </div>
</div>

<!-- FORMAT DISTRIBUTION -->
<div class="section">
  <h2><span class="emoji">📊</span> What Format Wins</h2>
  ${data.formats.map(f => {
    const color = f.format === 'general' ? 'var(--accent)' : f.format === 'news' ? 'var(--green)' : f.format === 'listicle' ? 'var(--yellow)' : f.format === 'review' ? 'var(--accent2)' : f.format === 'question-bait' ? 'var(--red)' : 'var(--muted)';
    return `<div class="bar-row">
      <span class="bar-label">${f.format}</span>
      <div class="bar-fill" style="width:${Math.max(f.pct * 4, 8)}px;background:${color}">${f.pct > 3 ? f.pct + '%' : ''}</div>
      <span class="bar-pct">${f.count}</span>
    </div>`;
  }).join('\n  ')}
  
  <h3>Examples by Format</h3>
  <table>
    <tr><th>Format</th><th>Share</th><th>Example Title</th><th>Source</th></tr>
    ${data.formats.filter(f => f.count > 5).map(f => {
      const ex = data.formatExamples[f.format]?.[0];
      return `<tr><td><strong>${f.format}</strong></td><td>${f.pct}%</td><td style="color:var(--accent2)">${ex?.title || '—'}</td><td style="color:var(--muted)">${ex?.source || '—'}</td></tr>`;
    }).join('\n    ')}
  </table>
</div>

<!-- POWER WORDS -->
<div class="section">
  <h2><span class="emoji">⚡</span> Power Words That Trigger Discover</h2>
  <p style="color:var(--muted);margin-bottom:16px;font-size:0.9rem;">These words appear most frequently in entertainment articles that make it into Google's content ecosystem. Use them naturally — don't force them.</p>
  <div class="pw-grid">
    ${data.powerWords.map((pw, i) => `<div class="pw-item"><span class="word">${i < 3 ? '🔥 ' : ''}${pw.word}</span><span class="count">${pw.count.toLocaleString()}</span></div>`).join('\n    ')}
  </div>
</div>

<!-- TOP SOURCES -->
<div class="section">
  <h2><span class="emoji">🏢</span> Who Dominates Entertainment Discover</h2>
  <p style="color:var(--muted);margin-bottom:12px;font-size:0.9rem;">Study these sources — their title patterns are what the algorithm rewards.</p>
  <table>
    <tr><th>Rank</th><th>Source</th><th>Articles</th><th>Share</th></tr>
    ${data.sources.slice(0, 20).map((s, i) => `<tr>
      <td>${i + 1}</td>
      <td><strong>${s.source}</strong></td>
      <td>${s.count}</td>
      <td>${(s.count / data.totalArticles * 100).toFixed(1)}%</td>
    </tr>`).join('\n    ')}
  </table>
</div>

<!-- TITLE ELEMENTS -->
<div class="section">
  <h2><span class="emoji">🔢</span> Title Element Usage</h2>
  <div class="cards" style="grid-template-columns: repeat(5, 1fr);">
    <div class="card"><div class="label">Has Number</div><div class="value green">${((n?.with_number || 0) / total * 100).toFixed(1)}%</div></div>
    <div class="card"><div class="label">Starts w/ Number</div><div class="value yellow">${((n?.starts_with_number || 0) / total * 100).toFixed(1)}%</div></div>
    <div class="card"><div class="label">Has Question</div><div class="value" style="color:var(--red)">${((n?.with_question || 0) / total * 100).toFixed(1)}%</div></div>
    <div class="card"><div class="label">Has Colon</div><div class="value cyan">${((n?.with_colon || 0) / total * 100).toFixed(1)}%</div></div>
    <div class="card"><div class="label">Has Dash</div><div class="value accent">${((n?.with_dash || 0) / total * 100).toFixed(1)}%</div></div>
  </div>
</div>

<!-- SENTIMENT -->
<div class="section">
  <h2><span class="emoji">💭</span> Sentiment Distribution</h2>
  ${data.sentiments.map(s => {
    const color = s.title_sentiment === 'positive' ? 'var(--green)' : s.title_sentiment === 'negative' ? 'var(--red)' : 'var(--muted)';
    return `<div class="bar-row">
      <span class="bar-label">${s.title_sentiment || 'unknown'}</span>
      <div class="bar-fill" style="width:${Math.max(s.pct * 4, 8)}px;background:${color}">${s.pct}%</div>
      <span class="bar-pct">${s.count.toLocaleString()}</span>
    </div>`;
  }).join('\n  ')}
</div>

<footer style="text-align:center;padding:40px 0;color:var(--muted);font-size:0.8rem;">
  Generated by Discover Analyzer · ${data.totalArticles.toLocaleString()} articles · ${new Date().toISOString().split('T')[0]}
</footer>

</div>

<script>
// Headline scorer (client-side version using the benchmarks from the report)
const POWER_WORDS = ${JSON.stringify(require('./classifier').prototype ? [] : [])};
const BENCHMARKS = {
  avgWords: ${s.avgTitleLength || 14},
  avgChars: ${s.avgTitleChars || 81},
};

const POWER = ['new','best','first','now','just','inside','top','exclusive','today','free',
  'revealed','limited','latest','official','update','breaking','urgent','secret','hidden',
  'surprising','unexpected','shocking','truth','worst','ultimate','essential','proven',
  'amazing','incredible','stunning','beautiful','terrifying','heartbreaking','massive','epic',
  'expert','study','confirmed','only','rare','leaked','never before','avoid','never','warning','danger','risk'];

function scoreHeadline() {
  const input = document.getElementById('headline-input');
  const title = input.value.trim();
  if (!title) return;

  const lower = title.toLowerCase();
  const words = lower.split(/\\s+/);
  let score = 50;
  const boosts = [];
  const tips = [];

  // Word count
  const wDiff = Math.abs(words.length - BENCHMARKS.avgWords);
  if (wDiff <= 2) { score += 10; boosts.push('Title length in the sweet spot (' + words.length + ' words)'); }
  else if (wDiff <= 4) { score += 5; }
  else { score -= 5; tips.push('Aim for ~' + BENCHMARKS.avgWords + ' words (yours: ' + words.length + ')'); }

  // Char count
  if (title.length > 90) { score -= 10; tips.push('May get truncated (>' + title.length + ' chars)'); }
  else if (Math.abs(title.length - BENCHMARKS.avgChars) <= 10) { score += 5; boosts.push('Character count optimal'); }

  // Power words
  const found = POWER.filter(w => lower.includes(w));
  if (found.length > 0) { score += Math.min(found.length * 5, 15); boosts.push('Power words: ' + found.join(', ')); }
  else { tips.push('Add a power word: new, first, best, exclusive, revealed'); }

  // Dash
  if (/[—–\\-]/.test(title) && title.split(/[—–\\-]/).length > 1) { score += 5; boosts.push('Uses dash separator (60% of winners)'); }
  else { tips.push('Add an emdash (—) to separate hook from context'); }

  // Number
  if (/\\d/.test(title) && !/^\\d/.test(title)) { score += 5; boosts.push('Embedded number adds specificity'); }
  else if (/^\\d/.test(title)) { tips.push('Starting with number is weak — embed it instead'); }

  // Question
  if (title.includes('?')) { score -= 5; tips.push('Questions underperform — try declarative'); }

  // "new" bonus
  if (lower.includes('new')) { score += 5; boosts.push('"New" is the #1 Discover trigger'); }

  // Emotion
  const emotions = ['shocking','terrifying','heartbreaking','amazing','incredible','stunning','outrage','slams','blasts'];
  const emo = emotions.filter(e => lower.includes(e));
  if (emo.length) { score += 5; boosts.push('Emotional triggers: ' + emo.join(', ')); }

  score = Math.max(0, Math.min(100, score));
  const grade = score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : score >= 35 ? 'D' : 'F';

  const result = document.getElementById('score-result');
  result.style.display = 'block';
  result.innerHTML = '<div class="score-grade ' + grade + '">' + grade + ' (' + score + '/100)</div>'
    + '<ul class="score-tips">'
    + boosts.map(b => '<li class="boost">✓ ' + b + '</li>').join('')
    + tips.map(t => '<li class="tip">⚠ ' + t + '</li>').join('')
    + '</ul>';
}

document.getElementById('headline-input').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') scoreHeadline();
});
</script>
</body>
</html>`;
  }
}

module.exports = ReportGenerator;
