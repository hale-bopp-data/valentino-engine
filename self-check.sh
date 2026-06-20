#!/usr/bin/env bash
# valentino self-check — comando atomico PASS/FAIL (G16 presa elettrica)
# Applica le stesse regole che Valentino impone agli altri... a sé stesso.
# Uso: bash self-check.sh
# Exit: 0 = PASS, 1 = FAIL

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

PASS=0
FAIL=0
TOTAL=5

SEP="============================================================"
echo ""
echo "$SEP"
echo "  VALENTINO SELF-CHECK"
echo "  Il sarto che cuce per gli altri... cuce anche per sé."
echo "$SEP"
echo ""

# 1. Unit tests
echo "[1/5] Unit tests (vitest)..."
if npx vitest run --reporter=verbose 2>&1; then
  echo "  -> PASS"
  PASS=$((PASS + 1))
else
  echo "  -> FAIL"
  FAIL=$((FAIL + 1))
fi
echo ""

# 2. CSS audit on own templates
echo "[2/5] CSS audit (guardrail: no hardcoded px/hex)..."
AUDIT_OUTPUT=$(npx tsx src/bin/index.ts audit css/ 2>&1) || true
if echo "$AUDIT_OUTPUT" | grep -q "violation\|error\|FAIL\|hardcoded"; then
  echo "  -> FAIL — violazioni trovate:"
  echo "$AUDIT_OUTPUT" | grep -E "violation|error|FAIL|hardcoded" | head -5
  FAIL=$((FAIL + 1))
else
  echo "  -> PASS"
  PASS=$((PASS + 1))
fi
echo ""

# 3. WCAG contrast check
echo "[3/5] WCAG contrast (AA 4.5:1)..."
CONTRAST_OUTPUT=$(npx tsx src/bin/index.ts contrast css/tokens.css 2>&1) || true
if echo "$CONTRAST_OUTPUT" | grep -q "fail\|FAIL\|below"; then
  echo "  -> FAIL"
  FAIL=$((FAIL + 1))
else
  echo "  -> PASS"
  PASS=$((PASS + 1))
fi
echo ""

# 4. Sovereign guardrails manifest
echo "[4/5] Guardrails manifest (machine-readable)..."
if [ -f "guardrails.json" ]; then
  if jq empty guardrails.json 2>/dev/null; then
    COUNT=$(jq '.guardrails | length' guardrails.json 2>/dev/null || echo 0)
    if [ "$COUNT" -ge 10 ]; then
      echo "  -> PASS ($COUNT/10 guardrails)"
      PASS=$((PASS + 1))
    else
      echo "  -> FAIL (solo $COUNT/10 guardrails in guardrails.json)"
      FAIL=$((FAIL + 1))
    fi
  else
    echo "  -> FAIL (guardrails.json non è JSON valido)"
    FAIL=$((FAIL + 1))
  fi
else
  echo "  -> FAIL (guardrails.json mancante)"
  FAIL=$((FAIL + 1))
fi
echo ""

# 5. TypeScript build
echo "[5/5] TypeScript build..."
if npx tsc --noEmit 2>&1; then
  echo "  -> PASS"
  PASS=$((PASS + 1))
else
  echo "  -> FAIL"
  FAIL=$((FAIL + 1))
fi
echo ""

echo "$SEP"
echo "  RISULTATO: $PASS/$TOTAL PASS, $FAIL/$TOTAL FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo "  ESITO: FAIL"
  echo "$SEP"
  exit 1
else
  echo "  ESITO: PASS"
  echo "$SEP"
  exit 0
fi
