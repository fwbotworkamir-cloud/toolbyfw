#!/usr/bin/env node
// ponytail: single entrypoint — dashboard server lives here instead of its own
// module, since cli.js was its only consumer. Split it out if it grows.

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const chalk = require('chalk');

const ROOT = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf-8'));

const DB = require('./database');
const Analyzer = require('./analyzer');
const Classifier = require('./classifier');
const ReportGenerator = require('./report-generator');
const ProxyManager = require('./proxy-manager');

async function openDb() {
  const db = new DB(path.resolve(ROOT, config.database.path));
  await db.ready();
  return db;
}

// ─── FandomWire intelligence ────────────────────────────────────
// FW's direct Discover competitors — the pattern benchmark that matters.
const FW_COMPETITORS = [
  'screenrant.com', 'cbr.com', 'collider.com', 'comicbook.com', 'thedirect.com',
  'movieweb.com', 'slashfilm.com', 'denofgeek.com', 'gamerant.com', 'thegamer.com',
  'murphysmultiverse.com', 'comicbookmovie.com', 'looper.com', 'giantfreakinrobot.com',
];

function titleStats(rows) {
  const n = rows.length || 1;
  const avg = (f) => rows.reduce((s, r) => s + (f(r) || 0), 0) / n;
  const pct = (f) => Math.round(rows.filter(f).length / n * 1000) / 10;
  return {
    count: rows.length,
    avg_words: Math.round(avg(r => r.title_word_count) * 10) / 10,
    avg_chars: Math.round(avg(r => r.title_char_count) * 10) / 10,
    pct_number: pct(r => r.title_has_number),
    pct_colon: pct(r => r.title_has_colon),
    pct_dash: pct(r => r.title_has_dash),
    pct_question: pct(r => r.title_has_question),
  };
}

// Vertical breakdown + FW-competitor benchmark, computed from titles at query
// time so pre-gate rows in the DB still get classified.
function fwIntelligence(db, days = 30) {
  const classifier = new Classifier();
  const rows = db._queryAll(
    `SELECT title, source, title_word_count, title_char_count, title_has_number,
            title_has_colon, title_has_dash, title_has_question, power_words
     FROM articles WHERE scraped_at > datetime('now', ?)`, [`-${days} days`]);

  const byVertical = {};
  const compRows = [];
  const powerByVertical = {};
  const numTypes = { competitors: {}, rest: {} };
  const numTypesByVertical = {};
  for (const r of rows) {
    if (classifier.isOffTopic(r.title)) continue; // retro-gate old noise
    const v = classifier.detectVertical(r.title) || 'other';
    (byVertical[v] = byVertical[v] || []).push(r);
    const isComp = FW_COMPETITORS.some(d => (r.source || '').includes(d));
    if (isComp) compRows.push(r);
    for (const ty of classifier.detectNumberTypes(r.title)) {
      const side = numTypes[isComp ? 'competitors' : 'rest'];
      side[ty] = (side[ty] || 0) + 1;
      const vb = (numTypesByVertical[v] = numTypesByVertical[v] || {});
      vb[ty] = (vb[ty] || 0) + 1;
    }
    try {
      for (const w of JSON.parse(r.power_words || '[]')) {
        const bucket = (powerByVertical[v] = powerByVertical[v] || {});
        bucket[w] = (bucket[w] || 0) + 1;
      }
    } catch {}
  }

  const verticals = Object.entries(byVertical)
    .map(([vertical, vRows]) => ({
      vertical,
      ...titleStats(vRows),
      top_power_words: Object.entries(powerByVertical[vertical] || {})
        .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w, c]) => `${w}(${c})`),
    }))
    .sort((a, b) => b.count - a.count);

  // Number-type shares as % of each side's article count
  const pctOf = (counts, n) => Object.fromEntries(
    Object.entries(counts).sort((a, b) => b[1] - a[1])
      .map(([k, v]) => [k, Math.round(v / (n || 1) * 1000) / 10]));

  const onTopic = Object.values(byVertical).flat();
  return {
    days,
    total_on_topic: rows.length - (rows.length - onTopic.length),
    verticals,
    competitors: { sources: FW_COMPETITORS, ...titleStats(compRows) },
    everyone_else: titleStats(onTopic
      .filter(r => !FW_COMPETITORS.some(d => (r.source || '').includes(d)))),
    number_types: {
      competitors: pctOf(numTypes.competitors, compRows.length),
      rest: pctOf(numTypes.rest, onTopic.length - compRows.length),
      by_vertical: Object.fromEntries(Object.entries(numTypesByVertical)
        .map(([v, c]) => [v, pctOf(c, (byVertical[v] || []).length)])),
    },
  };
}

// Micro-rules S1-S24 from the verified 45k-corpus mining run (2026-07-31).
// Every threshold survived adversarial recomputation; refuted findings
// (quote marks, negation, REST-side dash stats) are deliberately absent.
// See reports/FW-MICRO-PLAYBOOK.md for the evidence behind each rule.
function microScore(headline, classifier) {
  const t = headline.trim();
  const hits = [];
  let pts = 0;
  const add = (p, why) => { pts += p; hits.push(`${p > 0 ? '+' : ''}${p} ${why}`); };

  const words = t.split(/\s+/).filter(w => /[a-z0-9]/i.test(w)); // punctuation tokens aren't words
  const lead = t.match(/^(?:The\s+)?(\d{1,3})\b/i);
  const leadN = lead ? +lead[1] : null;
  const isYear = n => n >= 1950 && n <= 2039;
  const leadTimeUnit = /^\d+\s+(years?|months?|days?|hours?|minutes?|decades?)\b/i.test(t);

  // Numbers (S1, S2, S18, S21, S22, S23)
  if (leadN != null && !isYear(leadN) && !leadTimeUnit) {
    if ([10, 5, 8, 7, 6].includes(leadN)) add(3, `leading count ${leadN} — 70% of competitor listicles use 10/5/8/7/6`);
    else if (leadN > 15) add(-3, `count ${leadN} — competitors hard-cap at 15 (1.3% exceed)`);
    add(2, 'digit-first opener — 21% of competitor titles vs 6% elsewhere');
  }
  if (/\d/.test(t)) add(1, 'carries a digit — 56% of competitor titles do vs 35%');
  if (/\(\s*(19|20)\d\d\s*\)/.test(t)) add(-2, 'parenthetical year — 0 competitor occurrences (year belongs in "of 2026 So Far" suffixes)');
  if (/\b\d+\s+years?\s+(later|ago|after)\b/i.test(t)) add(2, '"X Years Later/After" time anchor — Era-2: rose 6.1%→8.4% post spam-update');

  // Suffixes (S3, S4, S5)
  if (/,\s*ranked\b/i.test(t)) add(2, '", Ranked" suffix — 5x competitor signature');
  if (/\bof all time\b/i.test(t)) add(1, '"of All Time" — 3x over-indexed');
  if (/\b(you forgot|you (probably )?missed|you need to (see|watch)|right now|ever made|in history)\b/i.test(t))
    add(-3, 'second-person guilt suffix — dead in competitor titles (0-1 of 318 listicles)');

  // Length (S6, S7)
  if (words.length >= 10 && words.length <= 14) add(2, `${words.length} words — inside the 10-14 band (58% of competitor titles)`);
  else if (words.length <= 7 || words.length >= 18) add(-2, `${words.length} words — competitors halve both tails`);
  if (t.length > 110) add(-3, `${t.length} chars — ~4x rarer past 110`);
  else if (t.length > 100) add(-2, `${t.length} chars — past the ~100 ceiling`);
  else if (t.length >= 60 && t.length <= 90) add(1, `${t.length} chars — in the 60-90 target`);

  // Verbs & power words (S8-S11, S24)
  if (/\bofficially\b/i.test(t)) add(3, '"Officially" — the 31x competitor word (1 in 3 Collider titles)');
  const lastThird = words.slice(Math.floor(words.length * 2 / 3)).join(' ');
  if (/\b(confirms|reveals|teases)\b/i.test(t) || /\b(confirmed|revealed)\b/i.test(lastThird))
    add(2, 'confirms/reveals/teases — 3-5x competitor verb (payoff participles end-load)');
  if (/\b(announces|shares)\b/i.test(t)) add(-1, '"announces/shares" — under-indexed; competitors write confirms/reveals');
  if (/\bbreaks silence\b/i.test(t)) add(-1, '"breaks silence" — gossip-coded, no competitor lift');
  if (/\bfinally\b/i.test(t)) add(1, '"finally" — 4.5x fandom-payoff word');

  // Punctuation (S12-S15)
  if (/[—–]/.test(t)) add(-3, 'em/en dash — 0 of 1,441 competitor titles use one');
  if (t.includes('?')) add(-2, 'question mark — 3.6x rarer in competitor titles (1.5%)');
  if (t.includes('!')) add(-3, 'exclamation — 1 of 1,441');
  if ((t.match(/,/g) || []).length >= 2) add(-2, '2+ commas — 3x rarer; one comma + conjunction max');
  else if (/,\s*but\b/i.test(t)) add(2, '", But" reversal — ~3x competitor pattern');

  // Colon shape (S16, S17)
  const ci = t.indexOf(':');
  if (ci > 0) {
    const pre = t.slice(0, ci);
    if (pre.trim().split(/\s+/).length <= 4 && classifier.detectVertical(pre))
      add(2, 'franchise-fronted colon, ≤4 words before — the competitor colon shape (70%/48%)');
    else if (/\b(review|video|interview|box office|trailer|recap|update|watch)\b/i.test(pre))
      add(-2, 'label-fronted colon (Review:/Video:) — wire-service style, not competitor style');
  }

  // Openers (S19, S20)
  if (/^(why|how|what|who|when|where)\b/i.test(t)) add(-2, 'wh-word opener — Era-2: collapsed 2.1%→0.2% post spam-update (p<0.001)');
  if (classifier.detectVertical(words.slice(0, 2).join(' '))) add(2, 'franchise up front — 2.8x competitor pattern');

  // Era-2 additions (S25, S26 — mined 2026-08-24 post spam-update, adversarially verified)
  if (/\b(Netflix|Disney\+|HBO Max|Prime Video|Paramount\+|Apple TV\+?|Hulu|Crunchyroll|Peacock)\b/i.test(t))
    add(1, 'streaming platform name-drop — Era-2: 13.3%→17.4% (Netflix 5.3%→8.2%)');
  // quote-FIRST only — Era-1 standing rule: never score mid-title quotes from this corpus (scraper artifacts)
  if (/^["“]/.test(t)) add(-1, 'quote-opener — Era-2: quote-first titles 9→0 post-update');

  const verdict = pts >= 6 ? 'competitor-grade' : pts >= 1 ? 'neutral' : 'off-pattern';
  return { points: pts, verdict, hits };
}

// Title builder — assembles candidates from the VERIFIED templates only
// (see reports/FW-MICRO-PLAYBOOK.md), scores each, returns them ranked.
// mode 'news': subject + detail ("Sadie Sink is playing Jean Grey")
// mode 'list': subject + noun ("villains"), optional superlative
function generateTitles(subject, detail, mode = 'news', opts = {}) {
  const SMALL = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'of', 'on', 'in', 'to', 'at', 'by', 'as', 'with', 'from']);
  // headline title case: cap every word except small words (first word always capped)
  const cap = s => s.trim().split(/\s+/)
    .map((w, i) => (i > 0 && SMALL.has(w.toLowerCase())) ? w.toLowerCase() : w.replace(/^\w/, ch => ch.toUpperCase()))
    .join(' ');
  // ponytail: naive singular for "Every X" — strip one trailing s; irregulars stay wrong, edit by hand
  const singular = s => s.replace(/s$/i, '');
  const candidates = [];

  if (mode === 'list') {
    const noun = cap(detail);
    const sups = opts.superlative ? [cap(opts.superlative)] : ['Best', 'Strongest', 'Greatest'];
    for (const sup of sups) {
      candidates.push(
        `10 ${sup} ${subject} ${noun}, Ranked`,
        `5 ${sup} ${subject} ${noun}, Ranked`,
        `The 10 ${sup} ${subject} ${noun} of All Time, Ranked`,
      );
      // franchise-colon + mid-title count — the GameRant shape
      // ("Dragon Ball: 5 Strongest Ultra Forms, Ranked")
      if (!subject.includes(':')) {
        candidates.push(`${subject}: 10 ${sup} ${noun}, Ranked`, `${subject}: 5 ${sup} ${noun}, Ranked`);
      }
    }
    candidates.push(`Every ${subject} ${singular(cap(detail))}, Ranked Weakest to Strongest`);
  } else {
    const d = cap(detail.trim().replace(/\.$/, ''));
    for (const verb of ['Confirms', 'Reveals', 'Teases']) {
      candidates.push(`${subject} Officially ${verb} ${d}`);
    }
    // franchise-fronted colon shape (only if subject itself is colon-free)
    if (!subject.includes(':')) candidates.push(`${subject}: ${d}, Officially Confirmed`);
    // ", But" reversal when a twist is supplied
    if (opts.but) candidates.push(`${subject} Officially Confirms ${d}, But ${cap(opts.but)}`);
    // "finally" payoff variant
    candidates.push(`${subject} Finally Confirms ${d}`);
  }

  const classifier = new Classifier();
  const seen = new Set();
  return candidates
    .filter(t => { const k = t.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .map(title => ({ title, ...microScore(title, classifier), vertical: classifier.detectVertical(title) || 'other' }))
    .sort((a, b) => b.points - a.points);
}

async function cmdTitle(args) {
  const mode = args.includes('--list') ? 'list' : 'news';
  const butIdx = args.findIndex(a => a === '--but');
  const but = butIdx >= 0 ? args[butIdx + 1] : null;
  const pos = args.filter((a, i) => !a.startsWith('--') && (butIdx < 0 || i !== butIdx + 1));
  const [subject, detail] = pos;
  if (!subject || !detail) {
    console.log(chalk.red('  Usage: node src/cli.js title "<subject>" "<detail>" [--list] [--but "<twist>"]'));
    console.log(chalk.gray('    news: title "Spider-Man: Brand New Day" "Sadie Sink is playing Jean Grey"'));
    console.log(chalk.gray('    list: title "Jujutsu Kaisen" "villains" --list'));
    return;
  }
  const results = generateTitles(subject, detail, mode, { but });
  console.log(chalk.bold.magenta(`\n  TITLE BUILDER — ${mode} · vertical: ${results[0]?.vertical}\n`));
  for (const r of results) {
    const col = r.verdict === 'competitor-grade' ? chalk.green : r.verdict === 'neutral' ? chalk.yellow : chalk.red;
    console.log(`  ${col.bold(`[${r.points >= 0 ? '+' : ''}${r.points}]`)} ${r.title}`);
  }
  console.log(chalk.gray('\n  Verify the claim is actually official before using a Confirms/Reveals title.\n'));
}

// FW-specific scorer additions: which vertical the headline lands in, and how
// it compares to what FW's competitors are doing in that vertical right now.
function fwScoreExtras(db, classifier, headline) {
  const vertical = classifier.detectVertical(headline) || 'other';
  const notes = [];
  if (classifier.isOffTopic(headline)) {
    notes.push('OFF-TOPIC for FandomWire — this reads as news/politics/sport, not fandom');
    return { vertical, notes };
  }
  if (vertical === 'other') {
    notes.push('No FW vertical detected — name the franchise/celebrity (Marvel, anime, GTA…) for Discover topical authority');
  }
  // Number-role guidance — year vs installment digit vs count are different levers
  const numTypes = classifier.detectNumberTypes(headline);
  const isListicle = /^\d/.test(headline.trim())
    || /\b\d+\s+(best|worst|greatest|biggest|things|ways|reasons)\b/i.test(headline)
    || /^(the\s+)?(best|worst|greatest|top|every)\b/i.test(headline.trim())
    || /\branked\b/i.test(headline);
  if (numTypes.includes('year') && !isListicle) {
    notes.push('Calendar year outside a ranked list reads as a dated roundup — keep the year for "Best of 2026"-style guides (SEO freshness), drop it from news headlines');
  }
  if (numTypes.includes('leading-count')) {
    notes.push('Leading count = listicle format. FW competitors do this in 30% of their number-titles — fine for ranked lists, weak for news');
  }
  if (!numTypes.length && /\b(sequel|season|episode|part|chapter|phase)\b/i.test(headline)) {
    notes.push('You name an installment without its digit — competitors write "Season 2"/"Phase 4"/"Spider-Man 4" (53% of their titles carry a franchise digit)');
  }

  const fw = fwIntelligence(db, 30);
  const v = fw.verticals.find(x => x.vertical === vertical);
  if (v && v.count >= 20) {
    const words = headline.trim().split(/\s+/).length;
    if (Math.abs(words - v.avg_words) > 4) {
      notes.push(`${vertical} titles cluster at ~${v.avg_words} words (yours: ${words})`);
    }
    if (v.pct_colon >= 30 && !headline.includes(':')) {
      notes.push(`${v.pct_colon}% of ${vertical} titles use a colon (franchise: detail) — consider one`);
    }
    if (v.top_power_words.length) {
      notes.push(`Hot ${vertical} power words right now: ${v.top_power_words.slice(0, 3).join(' ')}`);
    }
  }
  return { vertical, notes };
}

// Topic intelligence: which topics/keywords the Discover winners are betting
// on. Entities = capitalized uni/bigrams from de-tokenized titles, feed
// suffixes stripped. Two lenses: competitor coverage share (their revealed
// bets) and 48h velocity (what is rising NOW).
function topicIntelligence(db, days = 14) {
  const classifier = new Classifier();
  const detok = t => t
    .replace(/\s+[-–—|]\s+[A-Z][\w\s.']{2,30}$/, '') // strip " - Publisher" BEFORE de-tokenizing
    .replace(/(\w) - (\w)/g, '$1-$2').replace(/\s+([,:;.!?])/g, '$1');
  const STOP = new Set(['The', 'This', 'That', 'These', 'What', 'Why', 'How', 'Who', 'When', 'Where', 'After', 'Before', 'Here', 'Every', 'All', 'New', 'Best', 'First', 'His', 'Her', 'Their', 'One', 'Two', 'And', 'But', 'For', 'With', 'From', 'Officially', 'Finally', 'Just', 'Not', 'Its', 'You', 'Your', 'Season', 'Episode', 'Movie', 'Film', 'Series', 'Show', 'Netflix', 'Review', 'Trailer', 'Day', 'Year', 'Years', 'Fans', 'Star', 'Stars', 'News',
    'Ranked', 'Exclusive', 'More', 'Cast', 'Explained', 'Streaming', 'Everything', 'Update', 'Watch', 'Release', 'Date', 'Time', 'Video', 'Games', 'Album',
    'Game', 'Movies', 'House', 'Sequel', 'Reboot', 'Remake', 'Later', 'Ago', 'Fall', 'Winter', 'Summer', 'Spring', 'Seasons', 'Episodes', 'Anime', 'Manga', 'Song', 'Songs', 'Book', 'Books',
    'Free', 'Forget', 'Days', 'Meets', 'Return', 'Returns', 'So', 'Far', 'EXCLUSIVE', 'Dragon', 'Finale', 'Ending', 'Premiere', 'Deal', 'Report', 'Rumor', 'Confirmed', 'Revealed',
    'Back', 'Again', 'Still', 'Ever', 'Never', 'Now', 'Today', 'Tonight', 'Week', 'Month', 'Coming', 'Gets', 'Sets', 'Makes', 'Takes', 'Looks', 'Real', 'True', 'Big', 'Major', 'Huge',
    'Very', 'Soon', 'Reason', 'Stay', 'Made', 'Scene', 'Scenes', 'Moments', 'Things', 'Ways', 'Times', 'Vs', 'Post-Credits', 'Ending', 'Twist', 'Moment',
    'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']);

  const ents = t => {
    const out = [];
    // internal of/and/the joins so "Game of Thrones" stays whole instead of
    // shedding junk fragments ("Game", "Thrones")
    for (const m of (detok(t).match(/[A-Z][\w'-]+(?: (?:of|and|the) [A-Z][\w'-]+| [A-Z][\w'-]+){0,3}/g) || [])) {
      const words = m.split(' ');
      if (words.length === 1 && STOP.has(words[0])) continue;
      if (/^(How|What|Why|When|Where|Who|Which|Is|Are|Was|Does|Will|Can)$/.test(words[0])) continue; // question fragments
      // Title-Case feeds capitalize verbs, so capitalized runs like "Box Office
      // Bomb Is" or "Officially Fighting Back" parse as entities. A real
      // entity never contains an aux/verb word.
      if (words.some(w => /^(Is|Are|Was|Were|Has|Have|Had|Will|Would|Could|Should|Can|May|Must|Does|Did|Gets|Got|Goes|Officially|Finally|Reportedly)$/.test(w))) continue;

      if (words.every(w => STOP.has(w))) continue;
      if (m.length < 4) continue;
      if (/-[a-z]/.test(m)) continue; // glued feed-suffix artifact ("Ranked-collider")
      out.push(m);
    }
    return out;
  };

  const now = Date.now();
  // Velocity runs on the article's PUBLISH time (99.7% coverage), not scrape
  // time — lane-bursty scrape schedules faked velocity (the Topics-v2 audit
  // finding). Two formats in the corpus: GDELT compact + RFC-2822.
  const parsePub = (p, fallback) => {
    if (!p) return Date.parse(fallback);
    const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/.exec(p);
    const t = m ? Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`) : Date.parse(p);
    return Number.isFinite(t) ? t : Date.parse(fallback);
  };
  const rows = db._queryAll(
    `SELECT title, source, scraped_at, publish_date, feed_section FROM articles WHERE scraped_at > datetime('now', ?)`,
    [`-${Math.round(days * 24)} hours`]).filter(r => !classifier.isOffTopic(r.title));

  const comp = {}, all = {}, recent = {}, prior = {}, hot = {}, brk = {}, sample = {}, heads = {};
  let compN = 0, recentN = 0, priorN = 0, hotN = 0, brkN = 0;
  // Syndication dedupe: the same story lands on 2+ feeds with an identical
  // title, double-counting every phrase — in thin hot/breaking windows those
  // dupes alone cleared min-2 and filled the lanes with static junk fragments.
  const seenTitles = new Set();
  for (const r of rows) {
    const tNorm = (r.title || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);
    if (seenTitles.has(tNorm)) continue;
    seenTitles.add(tNorm);
    const isComp = FW_COMPETITORS.some(d => (r.source || '').toLowerCase().includes(d));
    // Velocity uses only composition-stable sources (domain scans + publisher
    // RSS). GDELT query-seeded rows ("gdelt_Met Gala_...") would make every
    // query term look like it's trending whenever a Phase 1 sweep lands.
    const stable = /^(gdelt_source_|rss_|gdelt_entertainment)/.test(r.feed_section || '');
    const ageH = (now - parsePub(r.publish_date, r.scraped_at)) / 36e5;
    if (ageH < 0 || ageH > days * 24) continue; // bad publisher clock
    if (isComp) compN++;
    if (stable) { if (ageH <= 48) recentN++; else priorN++; if (ageH <= 6) hotN++; if (ageH <= 2) brkN++; }
    for (const e of new Set(ents(r.title))) {
      const k = e.toLowerCase();
      all[k] = (all[k] || 0) + 1;
      sample[k] = e;
      if (isComp) comp[k] = (comp[k] || 0) + 1;
      if (stable) {
        if (ageH <= 48) recent[k] = (recent[k] || 0) + 1; else prior[k] = (prior[k] || 0) + 1;
        if (ageH <= 6) hot[k] = (hot[k] || 0) + 1;
        if (ageH <= 2) brk[k] = (brk[k] || 0) + 1;
      }
      // Keep the freshest headlines per topic so writers see the actual story,
      // not just the entity name. Competitor headlines first, then recency.
      const h = heads[k] = heads[k] || [];
      h.push({ t: detok(r.title), src: r.source, comp: isComp, age: ageH });
      if (h.length > 24) { h.sort((a, b) => (b.comp - a.comp) || (a.age - b.age)); h.length = 12; }
    }
  }

  const vertOf = k => classifier.detectVertical(sample[k]) || classifier.detectVertical(k) || '—';
  const exOf = k => (heads[k] || []).sort((a, b) => (b.comp - a.comp) || (a.age - b.age)).slice(0, 3)
    .map(h => ({ title: h.t, source: h.src || '', hours_ago: Math.round(h.age) }));
  // Competitor bets: what winners cover, ranked by their coverage count
  const bets = Object.entries(comp).filter(([, v]) => v >= (days < 1 ? 2 : 4))
    .map(([k, v]) => ({ topic: sample[k], comp_articles: v, field_articles: all[k] - v,
      comp_share: +(v / compN * 100).toFixed(2), vertical: vertOf(k), examples: exOf(k) }))
    .sort((a, b) => b.comp_articles - a.comp_articles).slice(0, 25);
  // Rising: 48h rate vs prior rate
  const rising = Object.entries(recent).filter(([, v]) => v >= (days < 1 ? 3 : 6))
    .map(([k, v]) => ({ topic: sample[k], last48h: v,
      velocity: +(((v / (recentN || 1)) / ((prior[k] || 0.5) / (priorN || 1)))).toFixed(1),
      comp_covering: comp[k] || 0, vertical: vertOf(k), examples: exOf(k) }))
    // fandom-relevance filter: a competitor covers it, or it maps to a vertical.
    // Kills the msn/yahoo firehose noise (Weather, Classifieds, Earnings Calls).
    .filter(x => x.velocity >= 3 && (x.comp_covering >= 1 || x.vertical !== '—'))
    .sort((a, b) => b.velocity - a.velocity).slice(0, 20);

  // Hot now: published in the last 6h — the "6 hour deep" lane. Rate vs the
  // 48h baseline so a lane burst can't fake it (publish-time basis).
  // min 2, not 3: publishers reach our scans with lag, so the 6h window is
  // structurally thin (~50 articles overnight) and 3+ rarely clears
  const hot_now = Object.entries(hot).filter(([, v]) => v >= 2)
    .map(([k, v]) => ({ topic: sample[k], last6h: v,
      velocity: +(((v / (hotN || 1)) / ((recent[k] || 0.5) / (recentN || 1)))).toFixed(1),
      comp_covering: comp[k] || 0, vertical: vertOf(k), examples: exOf(k) }))
    .filter(x => x.comp_covering >= 1 || x.vertical !== '—')
    .sort((a, b) => b.velocity - a.velocity).slice(0, 15);

  // Breaking: published in the last 2h — the freshest signal, "get there first".
  // Thinnest window, so min 2 and no velocity gate; comp_covering shows if
  // rivals already jumped (low = open lane, first-mover advantage).
  const breaking = Object.entries(brk).filter(([, v]) => v >= 2)
    .map(([k, v]) => ({ topic: sample[k], last2h: v,
      comp_covering: comp[k] || 0, vertical: vertOf(k), examples: exOf(k) }))
    .filter(x => x.comp_covering >= 1 || x.vertical !== '—')
    .sort((a, b) => b.last2h - a.last2h || a.comp_covering - b.comp_covering).slice(0, 15);

  return { days, total: rows.length, comp_articles: compN, bets, rising, hot_now, breaking };
}

async function cmdTopics(days) {
  const db = await openDb();
  const t = topicIntelligence(db, days);
  db.close();
  console.log(chalk.bold.magenta(`\n  DISCOVER TOPIC INTELLIGENCE — last ${t.days}d · ${t.total} articles (${t.comp_articles} competitor)\n`));
  console.log(chalk.bold.yellow('  🎯 COMPETITOR BETS (what the Discover winners cover most)'));
  console.log(chalk.gray('  topic                          comp  field  vertical'));
  for (const b of t.bets)
    console.log(`  ${b.topic.padEnd(30)} ${String(b.comp_articles).padEnd(5)} ${String(b.field_articles).padEnd(6)} ${b.vertical}`);
  console.log(chalk.bold.yellow('\n  🚀 RISING NOW (48h velocity vs prior period)'));
  console.log(chalk.gray('  topic                          48h   veloc  comp-cover  vertical'));
  for (const r of t.rising)
    console.log(`  ${r.topic.padEnd(30)} ${String(r.last48h).padEnd(5)} ${String(r.velocity + 'x').padEnd(6)} ${String(r.comp_covering).padEnd(11)} ${r.vertical}`);
  console.log(chalk.bold.yellow('\n  🔥 HOT NOW (published in the last 6 hours)'));
  console.log(chalk.gray('  topic                          6h    veloc  comp-cover  vertical'));
  for (const h of (t.hot_now || []))
    console.log(`  ${h.topic.padEnd(30)} ${String(h.last6h).padEnd(5)} ${String(h.velocity + 'x').padEnd(6)} ${String(h.comp_covering).padEnd(11)} ${h.vertical}`);
  console.log(chalk.gray('\n  comp-cover = competitor articles on it. Rising + low comp-cover = open lane for FW.\n'));
}

async function cmdFw(days) {
  const db = await openDb();
  const fw = fwIntelligence(db, days);
  db.close();

  console.log(chalk.bold.magenta('\n  ═══ FANDOMWIRE INTELLIGENCE ═══'));
  console.log(chalk.gray(`  Last ${days} days · ${fw.total_on_topic} on-topic articles\n`));

  console.log(chalk.bold.yellow('  📊 BY VERTICAL'));
  console.log(chalk.gray('  vertical      n     words  chars  #num   :colon  —dash  power words'));
  for (const v of fw.verticals) {
    console.log(`  ${v.vertical.padEnd(12)} ${String(v.count).padEnd(5)} ${String(v.avg_words).padEnd(6)} ${String(v.avg_chars).padEnd(6)} ${String(v.pct_number + '%').padEnd(6)} ${String(v.pct_colon + '%').padEnd(7)} ${String(v.pct_dash + '%').padEnd(6)} ${v.top_power_words.join(' ')}`);
  }

  const c = fw.competitors, e = fw.everyone_else;
  console.log(chalk.bold.yellow('\n  🥊 FW COMPETITORS vs EVERYONE ELSE'));
  console.log(`  ${'metric'.padEnd(16)} ${'competitors'.padEnd(13)} rest`);
  for (const [label, key] of [['articles', 'count'], ['avg words', 'avg_words'], ['avg chars', 'avg_chars'], ['% w/ number', 'pct_number'], ['% w/ colon', 'pct_colon'], ['% w/ dash', 'pct_dash'], ['% questions', 'pct_question']]) {
    console.log(`  ${label.padEnd(16)} ${String(c[key]).padEnd(13)} ${e[key]}`);
  }
  console.log(chalk.bold.yellow('\n  🔢 WHAT THE NUMBERS ARE (share of titles)'));
  const nt = fw.number_types;
  const allTypes = [...new Set([...Object.keys(nt.competitors), ...Object.keys(nt.rest)])];
  console.log(chalk.gray(`  ${'type'.padEnd(16)} ${'competitors'.padEnd(13)} rest`));
  for (const ty of allTypes) {
    console.log(`  ${ty.padEnd(16)} ${String((nt.competitors[ty] || 0) + '%').padEnd(13)} ${(nt.rest[ty] || 0)}%`);
  }
  console.log(chalk.gray('\n  year = freshness qualifier (SEO) · sequel-digit/franchise-unit = topic name · leading-count = listicle'));
  console.log(chalk.gray(`\n  Competitor set: ${FW_COMPETITORS.slice(0, 5).join(', ')}, …\n`));
}

// Collection is a standalone script; run it as a child so a crash mid-pull
// can't take down a long-running scheduler.
function collectOnce() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, 'nuclear-load.js')], {
      cwd: ROOT, stdio: 'inherit',
    });
    child.on('exit', (code) => resolve(code));
  });
}

// After each collection cycle, persist a topic snapshot so topic trends are
// tracked over time instead of recomputed and lost. One JSONL line per cycle.
async function snapshotTopics() {
  try {
    const db = await openDb();
    const t = topicIntelligence(db, 14);
    db.close();
    const line = JSON.stringify({ ts: new Date().toISOString(), total: t.total, comp_articles: t.comp_articles, bets: t.bets, rising: t.rising });
    fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
    fs.appendFileSync(path.join(ROOT, 'data', 'topic-history.jsonl'), line + '\n');
    console.log(chalk.gray(`  [topics] snapshot appended (${t.bets.length} bets, ${t.rising.length} rising)`));
  } catch (e) {
    console.error(chalk.yellow(`  [topics] snapshot failed: ${e.message}`));
  }
}

// Partitioned master loop (Akash's design): timed lanes, one process = one
// writer. A lane tick that lands while another lane runs is queued, not run
// concurrently — sql.js cannot survive two writers.
// ponytail: fixed lane table; make it config when someone actually needs to tune it.
const LANES = [
  { name: 'rss',     args: ['--rss-only'],     everyMin: 60 },        // ~2 min, freshness
  { name: 'domains', args: ['--sources-only'], everyMin: 6 * 60 },    // ~25 min, breadth
  { name: 'full',    args: [],                 everyMin: 24 * 60 },   // ~3 h, deep sweep
];

function collectOnceArgs(extraArgs) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, 'nuclear-load.js'), ...extraArgs], {
      cwd: ROOT, stdio: 'inherit',
    });
    child.on('exit', (code) => resolve(code));
  });
}

// Drift check: zero-token detection of competitor-pattern shifts. Recomputes
// the key playbook metrics over the last 7 days of corpus data and compares
// against the verified 2026-07 baselines. Big deltas = the winners changed
// behavior = time to re-mine. Pure JS on existing data — no LLM, no API.
const DRIFT_BASELINE = { // from FW-MICRO-PLAYBOOK.md (verified), all-titles basis
  officially: 14.5, ranked_suffix: 3.2, question: 1.5, digit_first: 17.7,
  mean_words: 11.9, emdash: 0.0, confirms_reveals: 7.2,
};
const DRIFT_THRESHOLD = { // pp of absolute drift that triggers an alert
  officially: 5, ranked_suffix: 5, question: 2, digit_first: 6,
  mean_words: 1.5, emdash: 1, confirms_reveals: 3,
};

async function driftCheck() {
  try {
    const db = await openDb();
    const classifier = new Classifier();
    const compNames = ['screenrant', 'collider', 'comicbook', 'movieweb', 'slashfilm',
      'gamerant', 'thedirect', 'the direct', 'denofgeek', 'den of geek', 'looper',
      'comicbookmovie', 'giantfreakinrobot', 'cbr'];
    const rows = db._queryAll(
      `SELECT title, source FROM articles WHERE scraped_at > datetime('now', '-7 days')`)
      .filter(r => compNames.some(n => (r.source || '').toLowerCase().includes(n)))
      .filter(r => !classifier.isOffTopic(r.title));
    db.close();
    if (rows.length < 200) return; // not enough fresh competitor data to judge

    const detok = t => t.replace(/(\w) - (\w)/g, '$1-$2').replace(/\s+([,:;.!?])/g, '$1');
    const titles = rows.map(r => detok(r.title));
    const pct = f => +(titles.filter(f).length / titles.length * 100).toFixed(1);
    const now = {
      officially: pct(t => /\bofficially\b/i.test(t)),
      ranked_suffix: pct(t => /,\s*ranked\b/i.test(t)),
      question: pct(t => t.includes('?')),
      digit_first: pct(t => /^(the\s+)?\d/i.test(t) && !/^(19|20)\d\d/.test(t)),
      mean_words: +(titles.reduce((s, t) => s + t.split(/\s+/).filter(w => /[a-z0-9]/i.test(w)).length, 0) / titles.length).toFixed(1),
      emdash: pct(t => /[—–]/.test(t)),
      confirms_reveals: pct(t => /\b(confirms|reveals|teases|confirmed|revealed)\b/i.test(t)),
    };

    const alerts = [];
    for (const [k, base] of Object.entries(DRIFT_BASELINE)) {
      if (Math.abs(now[k] - base) > DRIFT_THRESHOLD[k]) {
        alerts.push(`${k}: ${base} → ${now[k]}`);
      }
    }
    fs.appendFileSync(path.join(ROOT, 'data', 'drift-log.jsonl'),
      JSON.stringify({ ts: new Date().toISOString(), n: titles.length, metrics: now, alerts }) + '\n');
    if (alerts.length) {
      console.log(chalk.red.bold(`  [drift] PATTERN SHIFT DETECTED (n=${titles.length}): ${alerts.join(' | ')}`));
      console.log(chalk.red('  [drift] the winners changed behavior — consider re-mining the playbook'));
    } else {
      console.log(chalk.gray(`  [drift] competitor fingerprint stable (n=${titles.length})`));
    }
  } catch (e) {
    console.error(chalk.yellow(`  [drift] check failed: ${e.message}`));
  }
}

// Self-audit: score FW's own publishing feed each cycle. New titles get
// micro-scored and appended to data/fw-published.jsonl; off-pattern ones are
// flagged loudly in the log — drift caught the hour it ships.
async function selfAudit() {
  try {
    const https = require('https');
    const { parseStringPromise } = require('xml2js');
    const xml = await new Promise((resolve, reject) => {
      https.get('https://fandomwire.com/fw-feed/', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0' },
        timeout: 30000,
      }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); })
        .on('error', reject);
    });
    const parsed = await parseStringPromise(xml, { explicitArray: false });
    let items = parsed?.rss?.channel?.item || [];
    if (!Array.isArray(items)) items = [items];

    const outFile = path.join(ROOT, 'data', 'fw-published.jsonl');
    const seen = new Set(fs.existsSync(outFile)
      ? fs.readFileSync(outFile, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l).link)
      : []);
    const classifier = new Classifier();
    let flagged = 0, added = 0;
    for (const it of items) {
      const link = it.link || '';
      if (!it.title || seen.has(link)) continue;
      const m = microScore(it.title, classifier);
      fs.appendFileSync(outFile, JSON.stringify({ ts: new Date().toISOString(), title: it.title, link, points: m.points, verdict: m.verdict }) + '\n');
      added++;
      if (m.points <= 0) {
        flagged++;
        console.log(chalk.red(`  [self-audit] OFF-PATTERN (${m.points}): ${it.title}`));
      }
    }
    if (added) console.log(chalk.gray(`  [self-audit] ${added} new FW titles scored, ${flagged} flagged`));
  } catch (e) {
    console.error(chalk.yellow(`  [self-audit] failed: ${e.message}`));
  }
}

// Auto-publish the static dashboard after the domains lane. Deploy failures are
// logged, never fatal — a stale live dashboard beats a dead collector.
async function publishDash() {
  try {
    await cmdExportStatic(); // refresh the frozen JSON before shipping it
  } catch (e) {
    console.log(chalk.yellow(`  [dash] export failed, skipping publish: ${e.message}`));
    return;
  }
  return new Promise((resolve) => {
    // wrangler runs via npx (not a local dep); shell:true so Windows resolves the shim
    const child = spawn('npx',
      ['wrangler', 'pages', 'deploy', 'web-dash',
        '--project-name=fw-discover-dash', '--commit-dirty=true'],
      { cwd: ROOT, stdio: 'pipe', shell: true });
    let out = '';
    child.stdout.on('data', d => out += d);
    child.stderr.on('data', d => out += d);
    child.on('exit', (code) => {
      console.log(code === 0
        ? chalk.green('  [dash] published → https://fw-discover-dash.pages.dev')
        : chalk.yellow(`  [dash] publish failed (exit ${code}) — live dashboard is stale: ${out.trim().split('\n').pop()}`));
      resolve();
    });
    child.on('error', (e) => { console.log(chalk.yellow(`  [dash] publish skipped: ${e.message}`)); resolve(); });
  });
}

async function cmdMaster() {
  // Singleton: bind a port so a second master (session + Startup task) exits
  // instead of becoming a second sql.js writer.
  const net = require('net');
  const lockSrv = net.createServer();
  await new Promise((resolve) => {
    lockSrv.once('error', () => {
      console.log('  [master] another master instance is running — exiting');
      process.exit(0);
    });
    lockSrv.listen(3210, '127.0.0.1', resolve);
  });

  // Scheduler: one 60s tick checks lane due-times. Unlike long setIntervals,
  // this survives machine sleep — overdue lanes run on the next tick after wake.
  let running = false;
  // Stagger at boot: rss now, domains +15m, full +2h — so a reboot doesn't
  // immediately commit the process to a 3h sweep.
  const BOOT_DELAY = { rss: 0, domains: 15, full: 120 };
  const due = new Map(LANES.map(l => [l.name, Date.now() + (BOOT_DELAY[l.name] || 0) * 60 * 1000]));
  const tick = async () => {
    if (running) return;
    const now = Date.now();
    const lane = LANES.find(l => now >= due.get(l.name));
    if (!lane) return;
    running = true;
    due.set(lane.name, now + lane.everyMin * 60 * 1000);
    console.log(chalk.cyan(`\n  [master] lane "${lane.name}" starting ${new Date().toISOString()}`));
    try {
      await collectOnceArgs(lane.args);
      await snapshotTopics();
      await selfAudit();
      if (lane.name !== 'rss') await driftCheck(); // 6h/24h lanes only — needs volume, not freshness
    } catch (e) {
      console.error(chalk.yellow(`  [master] lane ${lane.name} failed: ${e.message}`));
    }
    running = false;
  };

  // Publish on its OWN 20-min timer, independent of the lane single-flight lock.
  // A long full/24h or domains lane used to block the after-lane publish, so the
  // live number sat still for an hour+. export only READS the DB, safe to run
  // while a lane collects. Own guard so two publishes never overlap.
  let publishing = false;
  const publishTick = async () => {
    if (publishing) return;
    publishing = true;
    try { await publishDash(); } catch (e) { console.error(chalk.yellow(`  [master] publish failed: ${e.message}`)); }
    publishing = false;
  };

  console.log(chalk.bold.cyan(`  MASTER LOOP — lanes: rss/1h · domains/6h · full/24h · started ${new Date().toISOString()}\n`));
  setInterval(tick, 60 * 1000);
  setInterval(publishTick, 20 * 60 * 1000); // live refresh every 20 min regardless of lane state
  setInterval(() => console.log(chalk.gray(`  [master] heartbeat ${new Date().toISOString()} — next: ${LANES.map(l => `${l.name} in ${Math.max(0, Math.round((due.get(l.name) - Date.now()) / 60000))}m`).join(', ')}`)), 15 * 60 * 1000);
  tick();
}

async function cmdCollect(args) {
  const intervalArg = args.find(a => a.startsWith('--interval'));
  const cycle = async () => { await collectOnce(); await snapshotTopics(); };
  await cycle();
  if (!intervalArg) return;
  const hours = Number(intervalArg.split('=')[1]) || config.scheduler.intervalHours || 6;
  console.log(chalk.cyan(`\n  Auto-collect every ${hours}h. Ctrl+C to stop.\n`));
  setInterval(cycle, hours * 3600 * 1000);
}

async function cmdAnalyze(days) {
  const db = await openDb();
  new Analyzer(db).printReport(days);
  db.close();
}

async function cmdReport(days) {
  const db = await openDb();
  const out = path.join(ROOT, 'reports', 'discover-report.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  new ReportGenerator(db, new Classifier()).saveReport(out, days);
  db.close();
  console.log(chalk.green(`  ✓ Report written: ${out}`));
}

async function cmdScore(headline) {
  if (!headline) { console.log(chalk.red('  Usage: node src/cli.js score "your headline"')); process.exit(1); }
  const db = await openDb();
  const classifier = new Classifier();
  const r = new ReportGenerator(db, classifier).scoreHeadline(headline);
  const fw = fwScoreExtras(db, classifier, headline);
  db.close();
  const micro = microScore(headline, classifier);
  console.log(`\n  ${chalk.bold(r.title)}`);
  console.log(`  Grade: ${chalk.bold(r.grade)} (${r.score}/100) · ${r.classified.format} · vertical: ${chalk.magenta(fw.vertical)} · ${r.classified.title_word_count} words / ${r.classified.title_char_count} chars`);
  const mColor = micro.verdict === 'competitor-grade' ? chalk.green : micro.verdict === 'neutral' ? chalk.yellow : chalk.red;
  console.log(`  FW micro-score: ${mColor.bold((micro.points >= 0 ? '+' : '') + micro.points + ' — ' + micro.verdict.toUpperCase())}`);
  for (const h of micro.hits) console.log((h.startsWith('+') ? chalk.green : chalk.red)(`    ${h}`));
  for (const n of fw.notes) console.log(chalk.magenta(`  ★ ${n}`));
  for (const b of r.boosts) console.log(chalk.green(`  ✓ ${b}`));
  for (const t of r.tips) console.log(chalk.yellow(`  ⚠ ${t}`));
  console.log('');
}

async function cmdProxies(args) {
  const pm = new ProxyManager(config.proxies);
  if (!args.includes('--test')) { console.log(pm.proxies); return; }
  for (const r of await pm.testAll()) {
    console.log(r.status === 'ok'
      ? chalk.green(`  ✓ ${r.proxy} — ${r.latency}ms — exit IP ${r.ip}`)
      : chalk.red(`  ✗ ${r.proxy} — ${r.error}`));
  }
}

// Static export: freeze the read-only dashboard views as JSON + HTML so they
// can be hosted with no server. Interactive endpoints (score/generate) are
// POST-only, so the static build links to fw-title-forge for those.
async function cmdExportStatic() {
  const db = await openDb();
  const analyzer = new Analyzer(db);
  const out = path.join(ROOT, 'web-dash');
  const dataDir = path.join(out, 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  for (const d of [7, 14, 30, 90]) {
    fs.writeFileSync(path.join(dataDir, `report-${d}.json`), JSON.stringify(analyzer.getDashboardData(d)));
  }
  for (const d of [0.5, 7, 14, 30]) {
    fs.writeFileSync(path.join(dataDir, `topics-${d}.json`), JSON.stringify(topicIntelligence(db, d)));
  }
  fs.writeFileSync(path.join(dataDir, 'articles.json'), JSON.stringify(db.getRecentArticles(50)));
  fs.writeFileSync(path.join(dataDir, 'fw.json'), JSON.stringify(fwIntelligence(db, 30)));
  const histFile = path.join(ROOT, 'data', 'topic-history.jsonl');
  fs.writeFileSync(path.join(dataDir, 'topics-history.json'), fs.existsSync(histFile)
    ? JSON.stringify(fs.readFileSync(histFile, 'utf8').trim().split('\n').filter(Boolean).slice(-50).map(l => JSON.parse(l)))
    : '[]');
  fs.writeFileSync(path.join(dataDir, 'meta.json'), JSON.stringify({
    generated: new Date().toISOString(), articles: db.getArticleCount(), scans: db.getScanCount(),
  }));
  db.close();

  // Forge lives inside the auth-gated site now that fw-title-forge.pages.dev is deleted.
  fs.copyFileSync(path.join(ROOT, 'web', 'index.html'), path.join(out, 'forge.html'));

  // Auth removed 2026-08-14 per Amir — the native login dialog was blocking the
  // team. Worker retained only for the no-store data headers.
  fs.writeFileSync(path.join(out, '_worker.js'), `export default {
  async fetch(req, env) {
    const res = await env.ASSETS.fetch(req);
    // Data files must never cache — stale dashboards otherwise.
    if (new URL(req.url).pathname.startsWith('/data/')) {
      const r = new Response(res.body, res);
      r.headers.set('Cache-Control', 'no-store');
      return r;
    }
    return res;
  },
};
`);

  // Rewrite the API calls to static file reads; drop the POST-only cards.
  const staticize = (html, isTopics) => html
    .replace(/fetch\(`\/api\/report\?days=\$\{days\}`\)/g, 'fetch(`data/report-${days}.json`)')
    .replace(/fetch\('\/api\/articles\?limit=50'\)/g, "fetch('data/articles.json')")
    .replace(/fetch\('\/api\/topics\?days=' \+ days\)/g, "fetch('data/topics-' + days + '.json')")
    .replace(/fetch\('\/api\/topics\/history'\)/g, "fetch('data/topics-history.json')")
    .replace(/window\.open\(`\/api\/export\?days=\$\{days\}`\)/g, 'window.open(`data/report-${days}.json`)')
    .replace(/href="\/topics"/g, 'href="topics.html"')
    .replace(/href="\/"/g, 'href="index.html"')
    // strip the two interactive cards (builder + scorer) from the main page
    .replace(/<!-- Title Builder -->[\s\S]*?<!-- Headline Scorer -->/, '<!-- builder+scorer live on the forge -->')
    // drop the now-orphaned POST handlers so nothing calls a missing API
    .replace(/\s*async function generateTitles\(\)[\s\S]*?\n  }\n(?=\s*function exportData)/, '\n')
    .replace(/\s*async function scoreHeadline\(\)[\s\S]*?\n  }\n(?=\s*\/\/ Initial load)/, '\n')
    .replace(/<div style="padding:0 32px 16px;">\s*<div class="card" style="border:1px solid var\(--accent\)[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/, isTopics ? '$&' : `<div style="padding:0 32px 16px;"><div class="card" style="border:1px solid var(--accent);text-align:center;">
      <h2 style="justify-content:center">🏗️ Title Builder & Scorer</h2>
      <a href="forge.html" target="_blank" style="display:inline-block;padding:12px 28px;border-radius:8px;background:var(--accent);color:#fff;font-weight:700;text-decoration:none;">Open FW Title Forge →</a>
      <div style="font-size:12px;color:var(--muted);margin-top:10px;">Build and score headlines against the verified formula</div></div></div>`);

  for (const [src, dst, isTopics] of [['index.html', 'index.html', false], ['topics.html', 'topics.html', true]]) {
    const html = fs.readFileSync(path.join(ROOT, 'dashboard', src), 'utf8');
    fs.writeFileSync(path.join(out, dst), staticize(html, isTopics));
  }
  console.log(chalk.green(`  ✓ static dashboard exported → ${out}`));
  return out;
}

async function cmdDashboard() {
  const express = require('express');
  const dbFile = path.resolve(ROOT, config.database.path);

  // sql.js parses the whole file into memory at open time and never re-reads it,
  // so a long-lived server goes stale the moment a collector writes. Reopen when
  // mtime changes — the collector rewrites the file wholesale on every _save().
  // ponytail: mtime poll, not a watcher. Swap to better-sqlite3 if the reparse
  // cost matters at DB sizes where it would.
  let db = await openDb();
  let seenMtime = fs.statSync(dbFile).mtimeMs;

  async function freshDb() {
    const mtime = fs.existsSync(dbFile) ? fs.statSync(dbFile).mtimeMs : 0;
    if (mtime !== seenMtime) {
      try {
        const next = await openDb();
        db.close();
        db = next;
        seenMtime = mtime;
      } catch (err) {
        // Mid-write snapshot: keep serving the last good copy, retry next request.
        console.error(chalk.yellow(`  ⚠ DB reload skipped: ${err.message}`));
      }
    }
    return db;
  }

  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(ROOT, 'dashboard')));

  const days = (req) => Math.min(Math.max(parseFloat(req.query.days) || 30, 0.5), 365); // 0.5 = 12h view

  app.get('/api/report', async (req, res) =>
    res.json(new Analyzer(await freshDb()).getDashboardData(days(req))));

  app.get('/api/articles', async (req, res) =>
    res.json((await freshDb()).getRecentArticles(Math.min(parseInt(req.query.limit, 10) || 50, 500))));

  app.get('/api/export', async (req, res) => {
    res.setHeader('Content-Disposition', 'attachment; filename="discover-report.json"');
    res.json(new Analyzer(await freshDb()).generateReport(days(req)));
  });

  app.post('/api/score', async (req, res) => {
    const h = typeof req.body?.headline === 'string' ? req.body.headline.trim() : '';
    if (!h || h.length > 500) return res.status(400).json({ error: 'headline must be 1-500 chars' });
    const liveDb = await freshDb();
    const classifier = new Classifier();
    const result = new ReportGenerator(liveDb, classifier).scoreHeadline(h);
    const fw = fwScoreExtras(liveDb, classifier, h);
    const micro = microScore(h, classifier);
    result.classified.format += ` · ${fw.vertical}`;         // surfaces in existing UI meta line
    result.micro = micro;
    // ride the existing UI lists: positive micro hits as boosts, negatives as tips
    result.boosts.unshift(`FW micro-score ${micro.points >= 0 ? '+' : ''}${micro.points} — ${micro.verdict}`);
    result.boosts.push(...micro.hits.filter(x => x.startsWith('+')));
    result.tips.push(...micro.hits.filter(x => x.startsWith('-')), ...fw.notes);
    res.json(result);
  });

  app.get('/api/fw', async (req, res) => res.json(fwIntelligence(await freshDb(), days(req))));
  app.get('/api/topics', async (req, res) => res.json(topicIntelligence(await freshDb(), Math.min(days(req), 30))));
  app.get('/topics', (req, res) => res.sendFile(path.join(ROOT, 'dashboard', 'topics.html')));
  app.get('/api/topics/history', (req, res) => {
    const f = path.join(ROOT, 'data', 'topic-history.jsonl');
    if (!fs.existsSync(f)) return res.json([]);
    res.json(fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)));
  });

  app.post('/api/generate', (req, res) => {
    const { subject, detail, mode, but } = req.body || {};
    const ok = s => typeof s === 'string' && s.trim() && s.length <= 200;
    if (!ok(subject) || !ok(detail)) return res.status(400).json({ error: 'subject and detail required (1-200 chars)' });
    res.json({ candidates: generateTitles(subject.trim(), detail.trim(), mode === 'list' ? 'list' : 'news', { but: ok(but) ? but.trim() : null }) });
  });

  const port = config.dashboard.port || 3000;
  app.listen(port, () => console.log(chalk.cyan(`  Dashboard → http://localhost:${port}`)));
}

module.exports = { microScore, fwIntelligence, FW_COMPETITORS };

if (require.main !== module) return;

const [cmd, ...args] = process.argv.slice(2);
const dayArg = Number((args.find(a => a.startsWith('--days=')) || '').split('=')[1]) || 30;

(async () => {
  switch (cmd) {
    case 'collect': return cmdCollect(args);
    case 'master': return cmdMaster();
    case 'export-static': return cmdExportStatic();
    case 'scan': return cmdCollect(['--once']);
    case 'analyze': return cmdAnalyze(dayArg);
    case 'fw': return cmdFw(dayArg);
    case 'title': return cmdTitle(args);
    case 'topics': return cmdTopics(dayArg);
    case 'report': return cmdReport(dayArg);
    case 'dashboard': return cmdDashboard();
    case 'score': return cmdScore(args.filter(a => !a.startsWith('--')).join(' '));
    case 'proxies': return cmdProxies(args);
    default:
      console.log(`
  discover  <command>

    collect [--interval=6]   Pull articles (GDELT + Google News)
    analyze [--days=30]      Print algorithm report
    fw      [--days=30]      FandomWire lens: verticals + competitor benchmark
    title "<subj>" "<detail>" [--list] [--but "twist"]   Build formula titles, ranked
    report  [--days=30]      Write reports/discover-report.html
    dashboard                Serve dashboard on :${config.dashboard.port || 3000}
    score "headline"         Grade a headline A-F
    proxies --test           Test proxy connectivity
`);
  }
})();
