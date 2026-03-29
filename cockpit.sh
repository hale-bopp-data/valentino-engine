#!/usr/bin/env bash
# =============================================================================
# Valentino Cockpit — Launcher
# Il Sarto Parla + Il Sarto Copia
#
# Usage:
#   ./cockpit.sh                           # Launch with default example page
#   ./cockpit.sh my-page.json              # Launch with custom page spec
#   ./cockpit.sh my-page.json 4000         # Custom port
#   OPENROUTER_API_KEY=sk-or-... ./cockpit.sh  # With LLM enabled
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SPEC="${1:-$SCRIPT_DIR/examples/minimal-site/pages/home.json}"
PORT="${2:-3781}"

# Check Node
if ! command -v node &>/dev/null; then
    echo "  Error: Node.js not found. Install Node 20+ from https://nodejs.org"
    exit 1
fi

# Check spec file
if [ ! -f "$SPEC" ]; then
    echo "  Error: Page spec not found: $SPEC"
    echo ""
    echo "  Usage: ./cockpit.sh [spec.json] [port]"
    echo "  Example: ./cockpit.sh examples/minimal-site/pages/home.json"
    exit 1
fi

# Check tsx
if ! command -v npx &>/dev/null; then
    echo "  Error: npx not found. Install Node 20+ from https://nodejs.org"
    exit 1
fi

# LLM status
if [ -n "$OPENROUTER_API_KEY" ]; then
    echo "  LLM: OpenRouter key detected"
else
    echo "  LLM: not configured (set OPENROUTER_API_KEY for smart parsing)"
fi

echo ""

# Launch
cd "$SCRIPT_DIR"
exec npx tsx src/cockpit-server.ts "$SPEC" --port "$PORT"
