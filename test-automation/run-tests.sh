#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
# Fear & Hunger — AI Companion Automated Test Runner
# ════════════════════════════════════════════════════════════════
# Run with:  ./run-tests.sh
# Options:   ./run-tests.sh --quick       # Smoke test
#            ./run-tests.sh --branch rag   # Single branch
#            ./run-tests.sh --resume       # Resume from checkpoint
#            ./run-tests.sh -i             # Interactive menu
# ════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}${BOLD}"
echo "╔═══════════════════════════════════════════════════════╗"
echo "║   Fear & Hunger — AI Companion Automated Tests      ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Activate or create a local venv. Do not install into system Python.
if [ -f "$SCRIPT_DIR/.venv/bin/activate" ]; then
    source "$SCRIPT_DIR/.venv/bin/activate"
elif [ -f "$SCRIPT_DIR/../.venv/bin/activate" ]; then
    source "$SCRIPT_DIR/../.venv/bin/activate"
elif [ -f "$SCRIPT_DIR/../../.venv/bin/activate" ]; then
    source "$SCRIPT_DIR/../../.venv/bin/activate"
elif [ -f "../../venv/bin/activate" ]; then
    source "../../venv/bin/activate"
else
    echo -e "${YELLOW}Creating local Python venv...${NC}"
    python3 -m venv "$SCRIPT_DIR/.venv"
    source "$SCRIPT_DIR/.venv/bin/activate"
fi

# Check Python dependencies
python3 -c "import websocket" 2>/dev/null || {
    echo -e "${YELLOW}Installing websocket-client...${NC}"
    python3 -m pip install websocket-client
}

# Run the pipeline
exec python3 pipeline.py "$@"
