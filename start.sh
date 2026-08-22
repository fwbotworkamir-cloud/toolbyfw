#!/bin/bash

# ═══════════════════════════════════════════════
# Discover Analyzer — All-in-One Launcher
# Runs automated collection + dashboard
# ═══════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

mkdir -p data logs reports

INTERVAL=${1:-6}  # Default: every 6 hours

echo ""
echo "  ⚡ Discover Analyzer"
echo "  ═══════════════════════════════"
echo "  Dashboard:  http://localhost:3000"
echo "  Collection: every ${INTERVAL} hours"
echo "  Logs:       logs/"
echo "  ═══════════════════════════════"
echo ""

# Start dashboard in background
node src/cli.js dashboard &
DASH_PID=$!
echo "  ✓ Dashboard started (PID: $DASH_PID)"

# Trap cleanup
cleanup() {
  echo ""
  echo "  Shutting down..."
  kill $DASH_PID 2>/dev/null
  kill $COLLECT_PID 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

# Start auto-collection
node src/cli.js collect --interval=$INTERVAL &
COLLECT_PID=$!
echo "  ✓ Auto-collection started (PID: $COLLECT_PID)"
echo ""
echo "  Press Ctrl+C to stop everything"
echo ""

# Wait
wait
