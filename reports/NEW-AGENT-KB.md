# FandomWire Discover — New Agent Knowledge Base
*Read this first. Everything an agent needs to work on FW's Google Discover operation. Updated 2026-10-11.*

## 1. What this operation is
FandomWire (fandomwire.com) = fandom/entertainment publisher. Google Discover is the primary traffic engine.
Amir Syed (founder) runs a continuous loop with Claude: monitor → mine competitor patterns → translate into
title/format rules → team executes → measure → repeat. The loop's home session is "discover tool nox v1".

**History in one paragraph:** peak era ~220M monthly (2021-22, broad celebrity content) → -78% YoY collapse
(gossip/NSFW footprint) → cleanup (129 NSFW pages removed Aug 7) → August 2026 spam update nearly killed the
site (75K/wk → 28 clicks/DAY) → rebuilt on format discipline + authority → **September 2026 spam update made
FW a WINNER (+56% through the rollout)**. Current baseline: 74-78K Discover clicks/week, record day 14.2K.
Weekly impressions ~1.7M. CTR healthy band 4.3-5.5%.

## 2. The formats (what works, in priority order)
1. **Streaming-platform news** — `[Star/Franchise] + [platform verb] + [Platform] + [measurable fact]`
   (e.g. "Denzel Washington's The Equalizer 3 Takes Over Netflix"). **~1,006 clicks/page**, best lane.
2. **Era-2 flagship (retro-payoff)** — `[N] Years Later, [Franchise]'s [Superlative Thing] Still/Officially [Payoff]`.
3. **Wave-Ranked** — `[Franchise]: [10/5/8] [Superlative] [Noun], Ranked` — ONLY on hot/trending franchises
   (lane-check first). Cold-topic Ranked is dead. Fresh lenses beat tired ones: Best-Designed/Hardest/Fastest > Strongest.
4. **"Officially" news** — `[Franchise] Officially [Confirms/Reveals] [concrete detail]`. ~47% of slate now.
5. **Quote/crossover-twist pieces** — low volume, highest CTR (5.7%); authority builders.
- **Dead/banned:** question-mark titles, wh-openers, quote-openers, "Everything We Know" guides (Search content,
  not Discover), net-worth listicles, vague payoffs ("New Update", "Big Change" — S27 scorer kills these).
- **House keywords** (mined from 26K competitor titles, lift vs field): officially 38x, strongest 23x, ranked 21x,
  years-later 17x, deserves 13x, perfect 11x, underrated 11x, Rotten Tomatoes 9x, of-all-time 8x, forgotten 8x,
  streaming 7x. Anti-keyword: "review" (0.3x). Stack 2-3 per title.
- **Core law:** *Topic = engine, format = multiplier. Lane-check first, format second.* Proof: same Ranked format,
  in-lane = 543 clicks, cold = 5.

## 3. Rules (non-negotiable)
- Every title → **forge**: https://tools.fandomwiremarketing.com/forge.html — score **≥ +6** AND the 3-question
  sense check (claim specific? article delivers? reader understands?). Score measures shape; humans measure meaning.
- **NO-list (domain poison, confirmed by two post-mortems):** dating/divorce, body content, net-worth, court tabloid.
  Celebs = career masala only (set/paycheck/feuds/casting/comeback/awards). PageSix lane ≠ our lane.
- Celeb pieces: separate bylines, capped, anime/gaming core quota untouched.
- Reviews/guides: fine for brand/Search, NEVER counted in Discover quota (they earn ~0 there).
- Facts sourced always — scorer can't check truth; fabricated quotes = fireable.
- Discover pickup lag is normally 24-72h (same-day pickup = authority marker, we currently have it).
  Serving drops: impressions-led = algo/serving issue; clicks-led with flat imps = supply/aging issue. Diagnose before reacting.

## 4. Tools & URLs (live stack)
| Thing | Where | Notes |
|---|---|---|
| Topic lanes (hot/breaking/rising/bets) | tools.fandomwiremarketing.com/topics | 12h-30d windows |
| Title forge (score + sense check) | tools.fandomwiremarketing.com/forge.html | S27 rules live |
| **Platform Moves** (streaming/gaming → ready angles) | tools.fandomwiremarketing.com/moves/ | Netflix Top-10 + Epic freebies, daily 06:00 UTC refresh, ★ = authority entity |
| Image finder (editors) | images.fandomwiremarketing.com | TMDB live |
| Road to Doomsday (celeb campaign playbook) | Artifact: claude.ai/artifact/Xfm8bxbyLX9vEf9jk6hEQN | RDJ/Cavill/ensemble hubs, title bank |
| discover-analyzer repo | C:\ccode\discover-analyzer + github.com/fwbotworkamir-cloud/toolbyfw (branch **vps-optimized**, never main) | collector+dashboard+scorer |
| platform-moves repo | C:\ccode\platform-moves | standalone; NEVER modify discover-analyzer for it |

**Infra:** VPS 149.28.252.200 is the SOLE runtime (local PC retired Aug 27). Services: `discover-dashboard`,
`discover-master` (ports 3100/3210), `platform-moves` (3200), image-finder (3033). Restart:
`systemctl restart <name>`. nginx: the file in sites-enabled/ for tools.* is a REAL FILE (not symlink) — edit it,
never leave .bak files inside sites-enabled. Credentials: ask Amir (never store in repos). sql.js single-writer
rule: ONE collector at a time. FW site requests need browser UA + request spacing (Cloudflare).
Infra ownership: Saurabh (CF/DNS/WP/server config) — report, don't unilaterally change his domain.

## 5. Monitoring cadence (what the agent does)
- **Daily:** GSC Discover 24h (sc-domain:fandomwire.com, last_24_hours=true via Amir's Chrome) + drift-checker log
  on VPS (`journalctl -u discover-master | grep drift`) + self-audit of published titles
  (`/root/discover-analyzer/data/fw-published.jsonl` — scores every FW title hourly, flags off-pattern).
- **Weekly (Sunday):** scorecard — clicks/imps/CTR, format efficiency (clicks/page by type), green-rate trend,
  celeb cohort vs anime baseline, per-writer when asked.
- **Drift alerts:** competitor fingerprint shifts (e.g. `officially 14.5→28%` preceded the Sept algo re-weight).
  A drift spike + FW serve compression = field pivot; mirror the pivot in the slate within 48h.
- **Spam updates:** capture baseline immediately (ERA-LOG.md has the protocol), judge AFTER rollout completes,
  never react mid-rollout. GSC reporting sometimes freezes for days (Google-side; verify via GA4 realtime, don't panic).

## 6. Team context
- Bibhu = editorial lead (gets the daily lane guidance). Akash = sharp writer, pushes back usefully. Saurabh = infra.
- Green-rate (share of titles scoring ≥+6) is THE production KPI: 37% → 68% over 3 weeks. Floor now ~55%.
- Top Discover writers (Oct data): Ribhu Ghosh (701 clicks/pc), Shivam Gulati, Banhisha Kundu, Moumita Chakraborty,
  Visarg Acharya. Critics desk (Boelman/Miller/Groth/Ryan/French/Rawat) = Tier-A credentialed reviewers —
  NEVER judge them on Discover metrics; they are the E-E-A-T backbone.
- Writer evaluation = per-writer green-rate + clicks/Discover-piece over ≥2 weeks, reviews/guides excluded,
  lane-assignment checked before blaming the writer.

## 7. Current campaigns & open threads (Oct 2026)
- **Road to Doomsday:** Avengers: Doomsday (Dec 18, RDJ as Doctor Doom) → Secret Wars (Dec 2027). Phases:
  Foundation (now) → Trailer-2 wave → Release window → Bridge. Biggest unfilled gap: dedicated RDJ-as-Doom pieces.
- **Gaming = second anime:** same audience, ~6% share today, target 30% (GTA 6 / Switch 2 cycle). Hiring planned.
- **Platform Moves v2 wishlist:** Prime/Disney+/HBO/Crunchyroll charts (FlixPatrol blocks bots; find sources).
- **Watch items:** LinkedIn-games daily-answer pages = thin-utility spam exposure (Search dipped -16% in Sept update
  there); "Follow on Google" CTA live on articles (mobile deep-link upgrade suggested to Saurabh).
- **Sensitive (never violate):** never mention "Reilly" or "FandomWire LLC" (lawsuit); Valnet/Adverge DDoS suspicion
  = speculation, never name publicly; WarpPerformance UA / IP 144.91.118.209 = Saurabh's own infra, never flag.

## 8. Key reference docs (this folder)
- `ERA2-PLAYBOOK.md` — the crowned formats + evidence. `ERA-LOG.md` — era history + spam-update baselines/verdicts.
- `FW-MICRO-PLAYBOOK.md` — original verified title spec. Memory (Claude): `fw-discover-analyzer.md`,
  `fw-platform-moves.md`, `fw-road-to-doomsday.md` in C:\Users\ASUS\.claude\projects\C--ccode\memory\.

*Golden rule for any new agent: measure before you move, lane before format, quality bar over volume — and when
a number looks wrong, check whether it's the scoreboard (GSC lag) or the game (real serving change) before reporting.*
