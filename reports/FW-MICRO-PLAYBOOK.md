# FANDOMWIRE MICRO-DETAIL HEADLINE PLAYBOOK
Compiled from 6 verified data-mining reports over 45,456 on-topic headlines (GDELT snapshot, 2026-07). Competitor set (COMP) = ScreenRant, Collider, ComicBook.com, MovieWeb, SlashFilm, GameRant, ComicBookMovie, The Direct, Den of Geek, Looper (+trace rows from CBR/Murphy's/GFR; TheGamer absent). COMP n varies 1,441–2,202 across reports depending on matcher — all headline claims below were re-verified on independent matchers and held. REST = the other ~43,300 rows (raw news firehose, NOT an entertainment peer set — every COMP-vs-REST multiplier partly measures "fandom sites vs all news"). Every figure below survived independent recomputation; corrected values are used throughout.

---

## 1. NUMBERS — the full micro-story

**Run a listicle 1 title in 6–7.** COMP listicle rate 15.1% (318/2,111) vs REST 3.4% (1,477/43,345) — 4.4x. Verified exactly.

**Count values (share of COMP listicles, n=318):** 10 = 36.5%, 5 = 22.6%, 8 = 11.0%, 7 = 7.9%, 6 = 6.0%, 3 = 4.7%, 4 = 3.1%, 15 = 2.2%. Top-3 counts {10, 5, 8} = 70.1%. Counts >15: 4/318 = 1.3% — effectively never. Rule: **it's 10 (flagship), 5 (quick hit), or 8/7/6 (mid). Hard cap 15.** (REST runs 16+ counts 27% of the time — but the verifier showed ~29% of those are BuzzFeed/BoredPanda; cite the COMP cap, not the REST contrast.)

**Odd/even:** overall COMP odd = 40.6%, but that's the pull of 10. Excluding 10: odd = 63.9% (n=202). Rule: 10, or else lean odd (5/7).

**Count size buys length:** COMP counts 1–5 average 13.1 words/71 chars (n=100) — small counts need a longer, more specific tail. Count 10 runs 10.6w/58c (n=116) — short and clean. (Do NOT cite the "REST shows no trend" leg — REST lengths are contaminated by embedded " - domain.com" suffixes on 15.3% of rows.)

**Year placement:** competitors put years in freshness suffixes ("of 2026 So Far"), never as parenthetical clarifiers — COMP has 0 "(2026)"-style year parens vs REST 119. REST's #1 "digit opener" is the year 2026 (228 datelines); COMP's digit openers are curated list sizes (only 9/372 year-led).

**Installment/era digits:** the "X Years Later/Ago," time-anchor is a real COMP formula — "years" is the 2nd most common word after an opening digit (40 of 365), e.g. "15 Years After Coming To Theaters...". Any-digit presence: COMP 55.6% vs REST 34.7% of all titles — put a number somewhere.

**"Every X, Ranked":** COMP 0.99% of all titles (n=21, anecdote), but 14/21 carry "Ranked" — "Every [creator/franchise] X, Ranked" is a real micro-template used sparingly.

## 2. STRUCTURE — colon/dash/quote/paren/comma micro-rules

- **Colon: use LESS, and front a franchise, not a label.** COMP 15.5% (223/1,441) vs REST 24.9%. First colon lands at ~20% of title length (median; REST 26%). Pre-colon segment ≤4 words in 70.0% of COMP colon titles; 48.4% of pre-colon slots are a detectable franchise (Spider-Man 25, Avengers 17, Star Trek 7...). REST's pre-colon is labels: "Review", "Video", "Box Office". Two-part template (n=264–276): **short label ~3.6–3.7 words : long claim ~9.0 words; part 1 shorter in 81.4% of cases.** Colon titles are the char-budget format: 12.7w/78.9c, 12.1% over 100c. House style varies 11x — ComicBookMovie 63.2% colon (n=76), Collider 4.6% (n=288–589).
- **Dashes: never.** COMP em-dash 0/1,441; en-dash 2/1,441. (Do NOT cite REST's 1.6–3.1% dash rate as an editorial contrast — verifier showed it collapses to 0.04% once Google-News title furniture is excluded. The safe rule is one-sided: competitors don't use them.)
- **Parens: rare (3.1%, n=44 anecdote) but do payoff-aside work** — "(So Far)", "(And It Deserves a New Look)", "(So Why Didn't the Show End?)". Never year-clarifier parens. Square brackets = "[Exclusive]" 26/32, nearly all Collider — a house signature, not a general rule.
- **Commas: one comma + conjunction, never lists.** ≥2 commas: COMP 1.9% vs REST 5.7% (3x less). **", But …" reversal is the strongest comma signal: COMP 2.0% (29/1,441) vs REST 0.6% — 2.6–3.5x** (COMP n=29, direction solid, magnitude noisy). ", And …" continuation 2.5% vs 1.8%.
- **Questions/exclamations: declarative only.** "?" COMP ~1.5% vs REST 5.3% (3.6x fewer; cite ~1.5%, not the format-bucketed 0.6%). "!" COMP 1/1,441.
- **Quotes around work titles: NO RULE SHIPPABLE.** The apparent quote-style split (MovieWeb 21.7% vs GameRant 0%) was shown to be a scrape-path artifact (apostrophes/quotes stripped per-pipeline, COMP mangle rate 34.1% vs REST 14.5%). Do not derive any quote-mark rule from this dataset.

## 3. OPENERS

- **Digit-first: the single biggest opener differentiator.** COMP 17.7% (372/2,107) vs REST 4.9% — 3.6x. Add "The <digit>" (COMP 3.6% vs 0.8%): combined listicle-open **21.3% of COMP titles vs 5.7% REST**. Word after the digit: best 48, years 40, most 22, greatest 17, perfect 14 (n=365).
- **Franchise as literal word 1.** First token names a vertical: COMP 12.6% (265) vs REST 4.5% — 2.8x. Franchise-first bucket ~19.4% vs 8.7% (directional only — heuristic). REST leads with people (celeb press); competitors lead with franchises.
- **Avoid wh-question openers.** Why/How/What/Who...: COMP 2.0% (43) vs REST 4.4% — less than half.
- **Formula opener:** "Netflix's New [genre] [superlative outcome]" — combined 0.90% of COMP (n=19) vs ~0.01% REST. (Write it WITH the possessive — "Netflix New" in the data is scraper-stripped apostrophes.)
- **Niche opener (anecdote, n=19):** "This + [Forgotten/N-part/year] + genre + superlative-vs-benchmark" ("This Forgotten 5-Season Western Series Still Makes Yellowstone Look Tame"). Mid-title "This" is 2.1x over-indexed (3.1% vs 1.5%, n=66).
- Top COMP bigrams: "the 10" 2.14% (45), "10 best/most/greatest/perfect" + "5 best" ≈ 5.4% combined vs ~0.2% REST.

## 4. POWER WORDS — position and combination

- **"Officially" is the flagship: COMP 14.5% (217/1,501) vs REST 0.46% — 31x, zero syndication inflation.** Slot: adverb directly before the verb — "[Subject] Officially Confirms/Returns/Sets/Debuts...". CAVEAT (verified): it's a 4-domain house style, not universal — Collider 32.2% (102/317), GameRant 19.0%, MovieWeb 16.8%, ScreenRant 12.3%, then a cliff (ComicBook 2.6%, SlashFilm 0%). "1 in 7 competitor headlines" is really "1 in 3 Collider headlines."
- **Verb hierarchy (COMP vs REST):** reveals 4.5% vs 1.5% (3.0x), confirms 2.66% (40) vs 0.50% (5.3x), teases 1.0% vs 0.3% (3.1x). UNDER-indexed: announces 0.40% (n=6, anecdote-grade) vs 1.02%, shares 0.27% vs 0.74%. Write "Officially Confirms/Reveals," never "Announces/Shares." "Breaks Silence" is flat both sides and gossip-coded — skip.
- **Position grammar:** payoff participles END-load — "confirmed" 53% last third (2.13% vs 0.32%, 6.7x, n=32), "revealed" 61% last third (3x, n=31), "first" late 42% last third ("...Officially Debuts First Trailer"). "Official"/"New" sit early. "[Exclusive]" is a terminal tag (95% last third, n=38, Collider).
- **"Best" position diverges:** REST fronts it (63.4% first third — "Best X" listicles); COMP embeds it mid/late (first 50.9%, last 19.8% — last-third cell n=23, anecdote). COMP rate 7.7% (116) vs 4.1%.
- **"Finally"** mid-title pre-verb: 2.27% vs 0.51% — 4.5x (n=34, anecdote).
- **Combo template (verified examples):** "[Franchise] Gets First Official [Look/Details]". Top pairs: first+new (19), best+new (13), new+official (12), confirmed+new (11) — all n<50.
- **Negation: no rules.** F4 was ruled unreliable (partial apostrophe stripping undercounts ~2/3 of "won't/isn't"; a 33-row BTS syndication cluster inflates REST). Only safe directional note: "Never + superlative history" exists at ~0.9% (n=14).
- **Suffixes:** ", Ranked" COMP 14.5% of listicles (46/318) vs REST ~2.9% (5x). "of All Time" 7.9% (25) vs 2.4%. "So Far" stacks with Ranked (n=5, anecdote). **DEAD in COMP: second-person guilt suffixes** — "You Forgot" 0, "You (Probably) Missed" 0, "(& Why)" 0, "Ever Made" 0, "In History" 0, "Right Now" 1, "You Need to See/Watch" 1.

## 5. LENGTH — target ranges and distribution shape

(Computed on de-tokenized, suffix-stripped titles; COMP n=2,028–2,111, verified.)

- **Words: target 10–14.** Mode 11 (13.0%), mean 11.9, sd 3.10. COMP puts 57.9–58.0% in the 10–14 band (REST 51.6–52.0%) and slaughters both tails: ≤7 words 6.1–6.3% (REST 10.7–10.8%), ≥18 words 3.6–3.8% (REST 7.1%).
- **Chars: target 60–90, peak bucket 70–79 (22.8%). Hard ceiling ~100.** COMP >90 = 16.3–16.5%, >100 = 5.6–5.7%, >110 = 1.1–1.3% (REST 10.3–10.4% / 5.3–5.5%). Past 110 chars competitors publish **~3.5–4x less often** than the field (corrected from the miner's "5x" — REST's >110 tail is partly residual feed dirt). The cliff is real: 90–99 bucket holds 11.6%, then collapses.
- **By format:** listicles shortest (10.7w/60.2c, 2.5% over 100c, n=402); plain news 12.1w/74.0c (n=1,340); colon titles longest (12.7w/78.9c, 12.1% over 100c, n=264).
- **The competitor edge is consistency, not a different center:** same mean as REST (~11.9w/~72c) but sd 23–25% tighter (words 3.10 vs 4.02–4.03; chars 18.2 vs 24.2). Survives dedup. Cut the stubs and the run-ons.

## 6. PER-COMPETITOR CHEAT SHEET (n ≥ 50 solid; suffix-stripped stats)

- **Collider (n=589):** the listicle machine — 29.0% leading-digit, 14.9% "Ranked", lowest major colon rate (4.6%), highest digit rate (63.7%), 6.1% "exclusive", 32.2% "officially", literally 0 questions.
- **ScreenRant (n=353):** superlative-news hybrid — heaviest "new" reliance (27.5%), era-math framing ("15 Years After...", "4 Years Later,"), 14.4% listicle, 12.3% "officially".
- **MovieWeb (n=350):** "finally" specialist (5.7%, ~3x avg), high digit 61.1%, 16.8% "officially". (Its "quote-mark leader" stat = scrape artifact, ignore.)
- **ComicBook.com (n=330):** longest titles of the majors (15.9w/86.7c, +3.1w) — two-clause listicles with an editorial turn (", But the Worst One Totally Makes Sense") and direct-speech pull quotes.
- **SlashFilm (n=203):** only major where "best" beats "new" (14.8% vs 7.4%) — evergreen/opinion skew; highest major question rate (4.4%); "According to" attribution (4.4%).
- **GameRant (n=174):** shortest titles (10.8w/61.4c); franchise-prefix colons ("Dragon Ball: 5 Strongest Ultra Forms, Ranked"); official/confirmed-heavy; near-zero listicle in sample (2.3%).
- **ComicBookMovie (n=76):** pure-news pole — 63.2% colon, 0% listicle, explicit RUMOR:/UPDATE: labels, "revealed" 9.2%, fewest digits (23.7%).
- **The Direct (n=50):** 0% listicle; confirmation-status vocabulary (confirmed/official/just = 22% combined); "(Confirmed)" status tags.
- **Den of Geek (n=68 across matchers, borderline):** short, colon-leaning; anecdote-tier.
- **Looper (n=18, anecdote):** looks like an extreme listicle shop (44.4%) — too few rows to trust.

## 7. CORRECTIONS — where verification corrected or refuted a miner claim

1. **"REST runs mega-lists (16+ counts 26.5%)"** — number confirmed (27.3%) but it's source composition: ~29% of those rows are BuzzFeed/BoredPanda. Keep "COMP caps at 15"; drop the REST contrast.
2. **"Greatest 28x / Worst 11x over-indexed"** — cell counts exact, but multipliers stand on REST n=3 and n=4. Direction robust; multipliers demoted to anecdote.
3. **", Ranked" label** — the miner's regex matched any "Ranked" (REST 2.9% any-form vs 2.64% comma-form). COMP unaffected (all 46 comma-form). Conclusion stands; label was slightly loose.
4. **"REST shows no count-vs-length trend"** — refuted as unsafe: 15.3% of REST rows carry embedded " - domain.com" suffixes adding ~2 words/~15 chars.
5. **Em/en-dash contrast** — COMP side confirmed (0 and 2 hits); REST side refuted as a Google News artifact (REST em-dash ex-gnews = 0.04%). Rule is one-sided only.
6. **Quote-style findings (all of them)** — refuted for cross-subset AND per-domain use: quote/apostrophe stripping is per-scrape-path (GameRant 0.0% apostrophes across 174 titles = impossible for real headlines). No quote rule shippable.
7. **", But" reversal** — confirmed, but COMP n=29 is under the miner's own n=50 anecdote bar and wasn't flagged; multiplier range 2.6–3.5x.
8. **771 competitor rows leak into REST** in the punctuation report (URL-only matching misses gnews-proxied competitor rows). All checked claims survived re-run with corrected COMP; future mining must match on the `source` column too.
9. **"Officially = the competitor identity word"** — 31x confirmed exactly, but concentration corrected: it's a Collider/GameRant/MovieWeb/ScreenRant house style with a cliff below (ComicBook 2.6%, SlashFilm 0%). "1 in 7 competitor headlines" → "1 in 3 Collider headlines."
10. **"Announces under-indexed"** — direction credible (REST n=450 anchors it) but COMP n=6 is anecdote-grade, unflagged by the miner.
11. **"Netflix New" bigram** — the verbatim string is scraper-mangled; real formula is "Netflix's New". All example titles in the reports carry stripped possessives and spaced hyphens — never template from them verbatim.
12. **Negation findings (F4)** — refuted wholesale: partial apostrophe stripping undercounts ~2/3 of contracted forms, and a 33-row BTS syndication cluster inflates REST.
13. **">110 chars = 5x rarer"** → corrected to ~3.5–4x (REST's long tail is partly feed dirt, including mid-word truncated titles).
14. **Question rate "0.6%"** → cite ~1.5% (the 0.6% was bucket-order dependent; question titles with colons/digits got classified elsewhere first).
15. **"Not present in DB: cbr, giantfreakinrobot"** — wrong: they exist under display names (Comic Book Resources 4, Giant Freakin Robot 2, plus The Direct 43, Den of Geek 30 missed by regex matchers). Only thegamer.com is truly absent. CBR = 14 rows, not 10.
16. **~7% duplicate inflation** inside the COMP subset (same article under domain + display-name source, e.g. Collider/collider.com 45 pairs). No conclusion moved >0.3pp after dedup, but future per-title work must dedup.
17. **F3 franchise/person/detail buckets** — directional only; the "noise is symmetric" assumption is unproven (REST skews real two-token celeb names).
18. **Minor typos:** REST digit-opener count "2,107" → ~2,122; F5 REST 1,969 → 1,957; miner's dead-code year regex inside a 3-digit match. No numeric impact.
19. **Standing caveat on everything:** isOffTopic removed only 20/45,476 rows — REST is the raw news firehose, so all COMP-vs-REST multipliers overstate "editorial choice vs entertainment peers." And the COMP aggregate is effectively 4–6 domains (ScreenRant+Collider+ComicBook = 61% of rows).

## 8. TOOL UPGRADES — scorer rules for discover-analyzer (verified findings only)

**Preprocessing (required before any scoring — all verified as artifacts):**
- P1. Match competitor membership on `source` column (exact lowercase, domain + display-name variants) OR URL hostname — URL-only leaks ~35% of competitor rows to REST.
- P2. Strip trailing ` - SourceName` / ` – Publisher` when the tail fuzzy-matches the row's source, BEFORE length/dash stats.
- P3. De-tokenize: `(\w) - (\w)` → `$1-$2`; collapse space-before-punctuation. Never score apostrophe presence.
- P4. Dedup on normalized title across source variants (~7% COMP inflation otherwise).

**Scorer rules (threshold → points; scale: strong signal ±3, medium ±2, weak ±1):**
| # | Rule | Points | Basis |
|---|---|---|---|
| S1 | Leading count ∈ {10,5,8,7,6} (not a year, not followed by time unit) | +3 | 70%+ of COMP listicles; 4.4x rate |
| S2 | Leading count >15 | −3 | 1.3% of COMP listicles |
| S3 | Ends `, Ranked` | +2 | 14.5% vs 2.9% (5x) |
| S4 | Contains "of All Time" | +1 | 7.9% vs 2.4% |
| S5 | Second-person guilt suffix (`You Forgot`, `You .* Missed`, `You Need to (See\|Watch)`, `Right Now`, `Ever Made`, `In History`) | −3 | 0–1 occurrences in 318 COMP listicles |
| S6 | Word count in 10–14 | +2; ≤7 or ≥18 → −2 | band 58% vs 52%, tails halved |
| S7 | Char length 60–90 | +1; >100 → −2; >110 → −3 | 5.7% / 1.3% past ceilings |
| S8 | Contains "Officially" pre-verb | +3 | 14.5% vs 0.46%, 31x, n=217 |
| S9 | Verb ∈ {Confirms, Reveals, Teases} (or participle Confirmed/Revealed in last third) | +2 | 3–5.3x lifts |
| S10 | Verb ∈ {Announces, Shares} | −1 | under-indexed 0.4%/0.27% vs 1.02%/0.74% |
| S11 | "Breaks Silence" | −1 | flat rate, gossip-coded |
| S12 | Em/en dash present | −3 | 0/1,441 and 2/1,441 |
| S13 | "?" present | −2; "!" present → −3 | 1.5% vs 5.3%; 1/1,441 |
| S14 | ≥2 commas | −2 | 1.9% vs 5.7% |
| S15 | `, But ` reversal | +2 | 2.0% vs 0.6% |
| S16 | Colon present AND pre-colon ≤4 words AND pre-colon hits detectVertical | +2 | 70% ≤4w, 48% franchise in COMP colon titles |
| S17 | Colon present AND pre-colon is a label (Review/Video/Interview/Box Office) | −2 | REST label style |
| S18 | Digit-first or "The <digit>" opener | +2 | 21.3% vs 5.7% |
| S19 | Wh-word opener | −1 | 2.0% vs 4.4% |
| S20 | First token hits detectVertical | +2 | 12.6% vs 4.5% (2.8x) |
| S21 | Any digit anywhere | +1 | 55.6% vs 34.7% |
| S22 | Pure-year paren `(20\d\d)` | −2 | COMP 0 vs REST 119 |
| S23 | `\d+ Years (Later\|Ago\|After)` time anchor | +1 | 40/365 post-digit words; ScreenRant signature |
| S24 | "Finally" mid-title | +1 | 4.5x, n=34 anecdote — cap at +1 |

**Suggested classification threshold:** with this scheme a typical verified COMP headline ("Hulu's Ted Lasso Replacement Officially Sets 2026 Release Date": S6+S7+S8+S20+S21 = +9) scores ≥6; typical REST news scores ≤0. Flag ≥6 as "competitor-grade," 1–5 "neutral," ≤0 "off-pattern." Calibrate the cut on the labeled DB before shipping.

**Do NOT add rules for:** quote marks around titles, apostrophe/contraction forms, negation words, dash-as-separator prevalence in REST, "(& Why)"-style tails, or anything keyed to "Greatest/Worst" multipliers beyond +1 — all refuted or anecdote-fragile per Section 7.