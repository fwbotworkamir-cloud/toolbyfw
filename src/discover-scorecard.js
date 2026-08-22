#!/usr/bin/env node
// Weekly Discover scorecard — detects feed-level shifts (e.g. social cards
// crowding article cards) from FW's own GSC data. The personalized Discover
// feed has no API, so the observable fingerprints are:
//   1. CTR erosion at stable impressions  -> richer cards (social/AI) competing
//   2. impressions-per-page decline       -> fewer article slots in the feed
//   3. bucket-share drift                 -> what Google rewards is changing
// Usage: node src/discover-scorecard.js <gsc-pages.tsv>   (slug\tclicks\timps per line)
// Appends one JSON line to data/discover-scorecard.jsonl and prints the delta
// vs the previous snapshot.
const fs = require('fs');
const path = require('path');

const HIST = path.join(__dirname, '..', 'data', 'discover-scorecard.jsonl');

function bucket(s) {
  if (/-ranked(-|$)|^ranked-/.test(s)) return 'formula';
  if (/^(best|strongest|greatest|most|perfect|top|every)-/.test(s) || /of-all-time/.test(s)) return 'superlative';
  if (/^how-to|^all-|guide|tier-list|-explained(-|$)|everything-we-know|release-date|patch|codes|linkedin-games|in-order|tips/.test(s)) return 'service';
  if (/review(-|$)|recap/.test(s)) return 'review';
  return 'news';
}

const file = process.argv[2];
if (!file) { console.log('Usage: node src/discover-scorecard.js <gsc-pages.tsv>'); process.exit(1); }
const rows = fs.readFileSync(file, 'utf8').trim().split('\n').map(l => {
  const [slug, c, i] = l.split('\t');
  return { slug: slug.replace(/^https?:\/\/[^/]+\//, '').replace(/\/$/, ''), clicks: +c, imps: +i };
});

const snap = { ts: new Date().toISOString(), pages: rows.length,
  clicks: rows.reduce((s, r) => s + r.clicks, 0),
  imps: rows.reduce((s, r) => s + r.imps, 0), buckets: {} };
snap.ctr = +(snap.clicks / snap.imps * 100).toFixed(2);
for (const r of rows) {
  const b = (snap.buckets[bucket(r.slug)] = snap.buckets[bucket(r.slug)] || { pages: 0, clicks: 0, imps: 0 });
  b.pages++; b.clicks += r.clicks; b.imps += r.imps;
}

let prev = null;
if (fs.existsSync(HIST)) {
  const lines = fs.readFileSync(HIST, 'utf8').trim().split('\n').filter(Boolean);
  if (lines.length) prev = JSON.parse(lines[lines.length - 1]);
}
fs.appendFileSync(HIST, JSON.stringify(snap) + '\n');

const pct = (a, b) => b ? ((a - b) / b * 100).toFixed(1) + '%' : 'n/a';
console.log(`DISCOVER SCORECARD — ${snap.ts.slice(0, 10)}  (${snap.pages} pages)`);
console.log(`  clicks ${snap.clicks.toLocaleString()}${prev ? ` (${pct(snap.clicks, prev.clicks)})` : ''}  imps ${snap.imps.toLocaleString()}${prev ? ` (${pct(snap.imps, prev.imps)})` : ''}  CTR ${snap.ctr}%${prev ? ` (was ${prev.ctr}%)` : ''}`);
for (const [k, b] of Object.entries(snap.buckets).sort((x, y) => y[1].clicks - x[1].clicks)) {
  const share = (b.clicks / snap.clicks * 100).toFixed(1);
  const prevShare = prev?.buckets?.[k] ? (prev.buckets[k].clicks / prev.clicks * 100).toFixed(1) : null;
  console.log(`  ${k.padEnd(12)} ${String(b.pages).padEnd(4)} pages  ${share}% of clicks${prevShare ? ` (was ${prevShare}%)` : ''}  CTR ${(b.clicks / b.imps * 100).toFixed(1)}%`);
}
if (prev) {
  const ctrDrop = prev.ctr - snap.ctr;
  const impsUp = snap.imps >= prev.imps * 0.9;
  if (ctrDrop > 0.8 && impsUp) console.log('\n  ⚠ FEED-PRESSURE SIGNAL: CTR fell while impressions held — richer cards (social/AI) may be crowding article cards. Cross-check with a phone feed count.');
}
