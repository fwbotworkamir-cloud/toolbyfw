# Topic Intelligence v2 — APPROVED-PENDING plan (on hold per Amir, 2026-08-08)

Status: audited, execution-mapped, NOT built. Resume trigger: Amir says go.

Key audit findings baked in:
- 6h ignition MUST use article publish_date (99.6% coverage), never scraped_at —
  lane-scheduled collection makes scrape-time velocity measure our own collector.
- ~35% of current topic rows are junk n-grams; fix = alias canonicalization +
  motif-kill list + capitalized-entity requirement + >=2-source minimum.
- Snapshot history is 1h-median resolution (6h sparklines feasible); one 105h gap
  Aug 1-5 — sparklines must be gap-tolerant.
- FW coverage join: data/fw-published.jsonl (self-audit ledger).

Execution map (6 steps): (1) parsePublishDate in classifier.js; (2) topicIntelligence
v2: aliases+motif-kill+2-source; (3) igniting[] 6h publish-rate velocity, min 5
articles/2 sources; (4) per-topic samples/shapes/top_sources/fw_covered + 2 forge
suggestions for top-10; (5) topics.html: Igniting panel first, drill-down rows,
inline-SVG 6h sparklines; (6) restart master + one manual dash deploy, keep
topicIntelligence_v1 for one-cycle rollback.
