#!/bin/bash
set -e

echo ""
echo "  ⚡ Discover Analyzer — Setup"
echo "  ═══════════════════════════════"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "  ✗ Node.js not found. Install it: https://nodejs.org"
  exit 1
fi
NODE_V=$(node -v)
echo "  ✓ Node.js $NODE_V"

# Create directories
mkdir -p data logs reports
echo "  ✓ Created data/, logs/, reports/"

# Install dependencies
echo "  → Installing dependencies..."
npm install --production --no-audit --no-fund 2>&1 | tail -1
echo "  ✓ Dependencies installed"

# Check proxy
if [ ! -f proxies.txt ] || [ ! -s proxies.txt ]; then
  echo ""
  echo "  ⚠ No proxy configured!"
  echo "    GDELT works without a proxy (Phase 1+2)."
  echo "    Google News RSS (Phase 3) needs a rotating proxy."
  echo "    Add your proxy to proxies.txt:"
  echo "      http://user:pass@host:port"
  echo ""
else
  PROXY_COUNT=$(grep -v '^#' proxies.txt | grep -v '^$' | wc -l | tr -d ' ')
  echo "  ✓ Found $PROXY_COUNT proxy(ies) in proxies.txt"
fi

echo ""
echo "  ═══════════════════════════════"
echo "  ✓ Setup complete!"
echo ""
echo "  Quick start:"
echo "    npm run collect          # Pull 10K+ articles (one-time, ~30 min)"
echo "    npm run dashboard        # Start dashboard at http://localhost:3000"
echo "    npm run report           # Generate HTML report → reports/"
echo "    npm run auto             # Auto-collect every 6 hours + dashboard"
echo ""
echo "    node src/cli.js score \"Your headline here\"   # Score a headline"
echo ""
