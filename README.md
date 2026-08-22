# Discover Analyzer ⚡

Reverse-engineer Google Discover's entertainment algorithm. Pulls 10K+ articles per run from GDELT + Google News, analyzes title patterns, and tells your content team exactly what to write.

## Setup (2 minutes)

```bash
# 1. Clone or unzip
cd discover-analyzer

# 2. Run setup
bash setup.sh

# 3. Add your rotating proxy to proxies.txt (one per line):
#    http://user:pass@host:port
#    (GDELT works without proxies, Google News needs one)

# 4. First collection (~30 min, pulls 10K+ articles)
npm run collect

# 5. Launch everything
npm start
# → Dashboard: http://localhost:3000
# → Auto-collects every 6 hours
```

## Commands

| Command | What It Does |
|---------|-------------|
| `npm start` | **Start everything** — dashboard + auto-collection every 6h |
| `npm run collect` | Pull 10K+ entertainment articles (one-time) |
| `npm run dashboard` | Start dashboard at http://localhost:3000 |
| `npm run report` | Generate HTML report → `reports/discover-report.html` |
| `npm run analyze` | Print algorithm report to terminal |
| `node src/cli.js score "headline"` | Score a headline (A-F grade) |
| `npm run test-proxies` | Test your proxy connections |

## For the Content Team

### The Dashboard (http://localhost:3000)
- **Headline Scorer** — paste any headline, get an instant A-F grade with specific feedback
- **Do/Don't Playbook** — what works vs what doesn't on Discover
- **Format breakdown** — which article types get surfaced
- **Power word list** — words that trigger Discover selection
- **Source rankings** — who dominates the entertainment feed

### Generate a Shareable Report
```bash
npm run report
# → reports/discover-report.html (open in any browser)
```

### Score Headlines Before Publishing
```bash
node src/cli.js score "Taylor Swift reveals new album — first details emerge"
# → Grade: A (85/100)
# ✓ Power words: new, first
# ✓ Uses dash separator (60% of winners)
# ✓ "New" is the #1 Discover trigger
```

## Automation

### Option 1: Built-in (recommended)
```bash
npm start
# Starts dashboard + collects every 6 hours automatically
```

### Option 2: Custom interval
```bash
bash start.sh 2   # Collect every 2 hours
```

### Option 3: Cron job
```bash
crontab -e
# Add:
0 */6 * * * cd /path/to/discover-analyzer && npm run collect >> logs/cron.log 2>&1
```

## How It Works

**Phase 1: GDELT API** (~5K articles) — 135 entertainment queries × 3 time windows. Free, no proxy needed.

**Phase 2: Discover Sources** (~1K articles) — 60 entertainment-dominant domains (People, TMZ, Variety, etc.) queried individually.

**Phase 3: Google News RSS** (~2-5K articles) — 135 queries × 3 geos through your rotating proxy.

All articles get classified: format, word count, power words, emotional triggers, sentiment, structural patterns.

## The Algorithm (TL;DR)

| Signal | What Works | Data Point |
|--------|-----------|------------|
| **Length** | ~12 words / ~73 chars | Tight clustering |
| **Separator** | Emdash (—) | 60.3% use it |
| **#1 word** | "new" | 11.9% of all titles |
| **Numbers** | Embedded, not leading | 37% contain, 6% start |
| **Questions** | Avoid them | Only 5.3% |
| **Format** | Declarative statements | 73.8% of winners |

## Proxy Setup

Add rotating proxies to `proxies.txt`, one per line:
```
# Format: http://user:pass@host:port
http://myuser:mypass@proxy.example.com:8080
```

GDELT (Phase 1+2) doesn't need proxies. Google News RSS (Phase 3) does.

## Files

```
discover-analyzer/
├── setup.sh           # Run this first
├── start.sh           # Launches everything
├── config.json        # Settings
├── proxies.txt        # Your proxies (one per line)
├── src/
│   ├── cli.js         # All commands
│   ├── nuclear-load.js    # Bulk article loader
│   ├── scheduler.js       # Auto-collection timer
│   ├── report-generator.js # HTML reports + scorer
│   ├── analyzer.js        # Analysis engine
│   ├── classifier.js      # Title classifier
│   ├── database.js        # SQLite storage
│   ├── scraper.js         # RSS scraper
│   ├── proxy-manager.js   # Proxy rotation
│   └── dashboard-server.js # Express API
├── dashboard/
│   └── index.html     # Dashboard UI
├── data/              # Database (auto-created)
├── logs/              # Collection logs (auto-created)
└── reports/           # HTML reports (auto-created)
```
