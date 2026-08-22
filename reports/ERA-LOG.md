# FW Discover Era Log

Rolling record of WHAT worked, WHEN, and WHY — so when an algo re-weighting kills
a method, we know its exact shape and can re-test it after future updates
(Akash's rolling-method hypothesis, logged 2026-08-04). One entry per era; append,
never rewrite history.

---

## Era 1: "Ranked formula" — ACTIVE

**Started:** 2026-07-31 (first formula batch shipped ~21:00 local)
**Status:** ACTIVE and compounding
**Ended:** — (fill when clicks/day decays >50% from peak for 7+ consecutive days)

### The method
- Formula listicles: `[10/5/8] [Superlative] [Franchise] [Noun], Ranked` and
  `[Franchise]: [N] [Superlative] [Noun], Ranked` (mid-number variant)
- News: `[Franchise] Officially [Confirms/Reveals/Teases] [Detail]`
- 10–14 words, 60–90 chars, no em-dash, no questions, ≤1 comma, franchise-first
- Full spec: reports/FW-MICRO-PLAYBOOK.md (adversarially verified, 45k corpus)
- Tooling: fw-title-forge.pages.dev gate (publish at ≥ +6)

### Why it worked (mechanism, not superstition)
- Discover matches entity-dense cards to follower cohorts; "Ranked" evergreen
  cards get re-served in waves for months
- FW had latent per-entity authority in anime (79% of Discover clicks) that the
  old title shapes under-exploited
- Selection-stage effect: CTR flat ~5% across shapes — the formula wins IMPRESSIONS
  (being served), engagement (81.9% ER) sustains the serving

### The receipts (baseline → effect)
- Pre-era baseline: ~1.5K Discover clicks/day (July plateau), CTR 5.1% (3mo)
- 2026-08-01 (day 1 after batch): 4,487 clicks / 91,616 imps — best day since June collapse
- 2026-08-03: sustained ~4.3K/day, CTR 5.2%; top 7 Discover pages all formula
- Same-day pickup achieved by 2026-08-03 (published 12:36 → 737 clicks same day;
  pickup lag was 24–48h on 2026-08-01) — authority compounding marker
- Reference peak (ceiling proof): June spike 15K/day (2026-06-13..22)

### Companion data snapshots
- Weekly scorecard history: data/discover-scorecard.jsonl (baseline 2026-08-02)
- GSC 3-month bucket analysis: formula = 26% of pages, 72.5% of clicks, 1,695 clicks/page
- Corpus DB frozen at 75,245 articles (2026-08-01); OOS validation AUC 0.747

### Re-test protocol (when this era dies)
1. Log the death date + decay shape above
2. Diagnose: formula fatigue vs vertical saturation vs sitewide-quality event
   vs Discover product change (social/AI cards) — scorecard history separates these
3. Archive the era's method; rotate to next-best verified shapes from playbook
4. Calendar re-test: ~2 core-update cycles later (≈6–9 months), ship a 5-article
   probe batch of this era's exact method; if next-day pickup returns, re-adopt

---
## SPAM UPDATE WATCH — baseline captured 2026-08-18 (Amir flagged rollout)
Pre-impact baseline (spam updates take 1-2 weeks to fully land; measure AFTER):
- **Discover 7d**: 75,700 clicks · 1.51M imp · 5.0% CTR  (all-time high)
- **Search 7d**: 77,400 clicks · 5.53M imp · 1.4% CTR · avg pos 15.4
- Combined ~153K clicks/week. NSFW/gossip footprint already removed 2026-08-07.
Re-pull both on ~2026-08-25 and ~2026-09-01. A spam update hitting FW would show as a
step-down in SEARCH first (organic), Discover second. Watch which page-types drop:
thin-utility TEXT pages (colordle-HINTS, minute-cryptic-ANSWER, linkedin-SOLUTIONS = daily-answer reposts) = highest spam exposure (scaled/thin), being deleted 2026-08-18 (duplicates 404 confirmed). NOTE: /play/ = REAL interactive games (Sigils suite), genuine engagement, NOT thin — KEEP, do not flag;
editorial formula listicles = lower risk (real brand, human editorial, fandom value).

### DRIFT DETECTED 2026-08-18 — Era-2 candidate signal (coincides with spam update)
Sustained across 4 checks (01:24→20:02 Aug 18): competitor **confirms_reveals 7.2% → 12.5%** (+73%),
while **ranked_suffix 4.5% → 3.9%** (down). Confound ruled out: NOT the new anime feeds (they add
1 competitor row; excluding them, clean competitor CR% = 12.5%). Interpretation: field pivoting FROM
evergreen "X, Ranked" listicles TOWARD fresh "Officially Confirms/Reveals" news framing — the classic
shape of a quality update discounting scaled evergreen content, rewarding fresh sourced news.
ACTION: rebalance FW mix toward more "Officially Confirms/Reveals" anime/franchise news, slightly less
pure ranked-listicle (FW already scores these +10; just shift ratio, keep the format). Re-test the
microScore weights if this holds >1 week AND FW GSC dips — that would confirm an era change, not noise.
