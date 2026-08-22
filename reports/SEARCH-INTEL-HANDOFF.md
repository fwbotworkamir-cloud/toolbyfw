# HANDOFF: Build "FW Search Intelligence" (sister tool to the Discover analyzer)

Paste this whole file as the first message of a new session.

---

## Mission

Build a **Google Search intelligence tool** for fandomwire.com, sister to the existing Discover analyzer at `C:\ccode\discover-analyzer`. Same philosophy — mine what actually wins, verify adversarially, ship rules the team can use — but for the **Search surface**, which we have PROVEN behaves differently from Discover.

## Critical prior finding — DO NOT rediscover this, build on it

We already tested the Discover micro-formula against FW search traffic (Ahrefs): **correlation was NEGATIVE (rho −0.28)**. The Discover formula ("Officially Confirms…", "10 Best X, Ranked") is a *Discover-selection* style. What wins **Search** at FW is the opposite lane:
- **Dated query-matcher titles** — "One Piece Episode 1174: Release Date, Time, What to Expect & How to Watch"
- **Evergreen query-shaped pages** — puzzle/answer pages, "how to watch", codes pages (anime-expeditions codes had 113K impressions), explainers matching a literal query
- Search is **query-intent matching**, Discover is **feed-selection style**. Never blend the two scorers.

So this tool's job is the mirror image: mine which **query shapes, title shapes, and page formats** win Search positions/CTR in the entertainment niche, and build a scorer + generator for the search lane.

## Reuse, don't rebuild (mandatory reading before writing code)

Read these first:
1. `C:\ccode\discover-analyzer\src\cli.js` — the whole architecture (single-file CLI, microScore, master loop, static export, dashboard). Copy patterns, not the scoring rules.
2. `C:\ccode\discover-analyzer\src\classifier.js` — FW_VERTICALS, number-type detection. **Import/require it directly**, don't fork it.
3. `C:\ccode\discover-analyzer\src\database.js` — sql.js wrapper with the dirty-flag fix. Reuse the module as-is.
4. `C:\ccode\discover-analyzer\reports\FW-MICRO-PLAYBOOK.md` — methodology reference (mine → adversarially verify → refute artifacts). §7 lists refuted findings caused by scraper artifacts — same skepticism applies here.

Constraints carried over:
- **sql.js = whole-file DB, ONE writer at a time.** New tool gets its OWN db file (`data/search.db`), never opens `discover.db` for writing while the Discover master loop runs (it runs 24/7 via Startup script, singleton on port 3210).
- Node only, no new heavy deps. Windows machine, cmd-quoting gotchas apply.
- FW server rate-limits: ≥800ms spacing + browser UA for any fandomwire.com fetches.
- Keep files under 500 lines where practical; this project deliberately uses one main cli.js.

## Data sources for Search (different from Discover's RSS scraping)

Discover intel came from scraping competitor feeds. Search intel comes from **our own GSC data + SERP observation**:

1. **GSC Search performance (primary, ground truth).** The user will give you a Chrome tab with a logged-in session (`authuser=fwbotworkamir@gmail.com`, property `sc-domain:fandomwire.com`). Pull: queries, pages, position, CTR, impressions — 28d and 3mo. UI scraping via `javascript_tool` works (chips = `.nnLLaf`); table data needs the export or reading the rendered table rows. Ask the user to open the tab; NEVER ask for credentials.
2. **Existing corpus as SERP-adjacent signal**: `discover.db` (123K+ entertainment headlines, read-only) — usable for "what queries/topics exist in the niche" and title n-grams. Open READ-ONLY and never call save on it.
3. **Google Suggest / People-Also-Ask** (free, no key): `https://suggestqueries.google.com/complete/search?client=firefox&q=...` for query-shape mining per franchise.
4. **IP pool for anything Google-facing (Suggest, SERP checks).** The Discover tool already has a rotating 4-proxy pool: pool config in `C:\ccode\discover-analyzer\config.json` (`proxies` key), rotation/auth logic in `src\proxy-manager.js`, and `src\scraper.js` shows how requests go through it (per-request rotation + 2–5s randomized delay). **Require proxy-manager.js from there and read the same config.json — do NOT copy the credentials into the new repo or into any report/log.** All Suggest/SERP requests MUST go through the pool; only fandomwire.com and GSC (user's Chrome) go direct.
5. Ahrefs MCP is connected in the main session — striking-distance keywords (positions 4–20), volume, SERP overview. If not available in your session, output what you'd want and the user can pull it.

## What to build (phases — ship each before starting the next)

### Phase 1 — GSC miner + striking-distance report
CLI `node src/cli.js gsc-import` that ingests GSC query/page data (from a CSV export the user downloads, or Chrome-tab scrape) into `search.db`. Then `report`: 
- **Striking distance**: queries at position 4–20 with high impressions (these are the money — e.g. known ones: zendaya-siblings 358K imps, anime-expeditions codes 113K)
- **CTR vs expected-CTR-at-position** — pages underperforming their position = title/meta problem, our lane
- **Query-shape taxonomy**: bucket queries into {episode/release-date, how-to-watch, codes/answers, who-is/explainer, vs/comparison, cast, ending-explained, ranked/best}. Count clicks per shape. This taxonomy is the search-side equivalent of the Discover verticals.

### Phase 2 — searchScore() + title/meta generator
Mirror of microScore but for query-matching:
- Does the title literally contain the query head? Front-loaded?
- Freshness tokens where intent demands (episode number, month/year — NOTE: calendar year in Search is a REAL ranking signal for query-matching, unlike Discover where we separated embedded numbers from years)
- Length ≤60 chars for the SERP cut-off (different from Discover's 60–90 sweet spot!)
- Generator: given a query + franchise, emit title + meta description in the proven FW search shapes (the One Piece episode-guide shape is the house template).

### Phase 3 — weekly loop + dashboard card
- A `search` lane that refreshes suggest-mining weekly and re-flags striking-distance movers. Do NOT add it to the Discover master loop process — separate process or manual weekly run (user preference: ask once).
- Export a static card into the existing dashboard export (`web-dash/`) OR a separate page — ask the user which.

## Verification bar (non-negotiable)

Same as Discover: every mined "rule" gets an adversarial pass — could this be an artifact of our own publishing mix rather than a ranking preference? Out-of-sample check where possible (e.g., does the rule hold on queries we DIDN'T optimize?). Findings that survive go in `reports/FW-SEARCH-PLAYBOOK.md` with receipts; refuted ones get logged too.

## Known FW search context (save time)

- FW search lane already has proven winners: daily puzzle/answer pages (`/play` suite, GA4 tracked — read memory `fw-puzzles-ga4-tracking` before touching /play), episode release-date guides, codes pages.
- Site-wide Discover recovery is running hot (5.8K clicks/day); Search is the flat/declining surface — that's WHY this tool exists.
- 129 NSFW pages were removed 2026-08-07 (topical cleanup); expect Search re-crawl turbulence in the data for ~2-4 weeks. Annotate, don't panic.
- Striking-distance items already known: zendaya-siblings (358K imps, retitle candidate), anime-expeditions codes (113K), minute-cryptic hub.

## Rules of engagement

- Never mention "Reilly" or "FandomWire LLC" (ongoing lawsuit).
- Any live change to fandomwire.com titles/metas = propose first, wait for Amir's go.
- GSC/GA4 access only via the user's logged-in Chrome (authuser=fwbotworkamir@gmail.com); never request credentials.
- Project home: `C:\ccode\fw-search-intel` (new dir) — reuse discover-analyzer modules via relative require, don't copy-paste them.

Start with Phase 1. First action: ask the user to open GSC Search performance (not Discover) in a Chrome tab, or export the query CSV.
