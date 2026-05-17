#!/usr/bin/env bash
# ============================================================================
# Fear & Hunger — AI Companion Mod Installer
# Supports: Linux, macOS, Windows (Git Bash / WSL)
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${CYAN}${BOLD}"
echo "═══════════════════════════════════════════════════════════"
echo "   Fear & Hunger — AI Companion Mod Installer"
echo "═══════════════════════════════════════════════════════════"
echo -e "${NC}"

# ── Detect OS ──────────────────────────────────────────────────
detect_os() {
    case "$(uname -s)" in
        Linux*)
            if grep -qi microsoft /proc/version 2>/dev/null; then
                OS="wsl"
                echo -e "${GREEN}✓ Detected: Windows (WSL)${NC}"
            else
                OS="linux"
                echo -e "${GREEN}✓ Detected: Linux${NC}"
            fi
            ;;
        Darwin*)
            OS="macos"
            echo -e "${GREEN}✓ Detected: macOS${NC}"
            ;;
        MINGW*|MSYS*|CYGWIN*)
            OS="windows"
            echo -e "${GREEN}✓ Detected: Windows (Git Bash)${NC}"
            ;;
        *)
            OS="unknown"
            echo -e "${YELLOW}⚠ Unknown OS: $(uname -s)${NC}"
            ;;
    esac
}

# ── Find game installation ─────────────────────────────────────
find_game_path() {
    local candidates=()

    case "$OS" in
        linux)
            candidates=(
                "$HOME/.local/share/Steam/steamapps/common/Fear & Hunger"
                "$HOME/.local/share/Steam/steamapps/common/Fear and Hunger"
                "$HOME/.steam/steam/steamapps/common/Fear & Hunger"
                "$HOME/.steam/steam/steamapps/common/Fear and Hunger"
                "$HOME/Games/Fear & Hunger"
                "$HOME/Games/Fear and Hunger"
            )
            ;;
        macos)
            candidates=(
                "$HOME/Library/Application Support/Steam/steamapps/common/Fear & Hunger"
                "$HOME/Library/Application Support/Steam/steamapps/common/Fear and Hunger"
                "/Applications/Fear & Hunger"
            )
            ;;
        wsl)
            # Check common Windows paths from WSL
            local win_user
            win_user=$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d '\r' || echo "")
            if [ -n "$win_user" ]; then
                candidates=(
                    "/mnt/c/Program Files (x86)/Steam/steamapps/common/Fear & Hunger"
                    "/mnt/c/Program Files (x86)/Steam/steamapps/common/Fear and Hunger"
                    "/mnt/c/Users/$win_user/AppData/Local/Fear & Hunger"
                    "/mnt/d/SteamLibrary/steamapps/common/Fear & Hunger"
                    "/mnt/d/SteamLibrary/steamapps/common/Fear and Hunger"
                )
            fi
            ;;
        windows)
            candidates=(
                "/c/Program Files (x86)/Steam/steamapps/common/Fear & Hunger"
                "/c/Program Files (x86)/Steam/steamapps/common/Fear and Hunger"
                "/d/SteamLibrary/steamapps/common/Fear & Hunger"
                "/d/SteamLibrary/steamapps/common/Fear and Hunger"
                "$USERPROFILE/AppData/Local/Fear & Hunger"
            )
            ;;
    esac

    # Also search common modding paths
    candidates+=(
        "$HOME/Development/Fear And Hunger modding/Fear & Hunger V1.4.1"
        "$HOME/Development/Fear And Hunger modding/Fear & Hunger"
    )

    for path in "${candidates[@]}"; do
        if [ -d "$path/www/js/plugins" ]; then
            GAME_PATH="$path"
            return 0
        fi
    done

    return 1
}

# ── Validate game path ─────────────────────────────────────────
validate_game_path() {
    local path="$1"
    if [ ! -d "$path/www/js/plugins" ]; then
        echo -e "${RED}✗ Invalid path: $path${NC}"
        echo "  Expected to find: www/js/plugins/ directory"
        return 1
    fi
    if [ ! -f "$path/www/js/plugins.js" ]; then
        echo -e "${RED}✗ Missing plugins.js at: $path/www/js/plugins.js${NC}"
        return 1
    fi
    return 0
}

# ── Install mod ────────────────────────────────────────────────
install_mod() {
    local dest="$1"
    local plugins_dir="$dest/www/js/plugins"
    local faces_dir="$dest/www/img/faces"
    local plugins_js="$dest/www/js/plugins.js"

    echo ""
    echo -e "${CYAN}Installing to: ${BOLD}$dest${NC}"
    echo ""

    # Backup plugins.js
    if [ ! -f "${plugins_js}.bak" ]; then
        cp "$plugins_js" "${plugins_js}.bak"
        echo -e "${GREEN}  ✓ Backed up plugins.js → plugins.js.bak${NC}"
    else
        echo -e "${YELLOW}  ⚠ Backup already exists, skipping${NC}"
    fi

    # Copy plugin files
    cp "$SCRIPT_DIR/plugins/AI_Companion.js" "$plugins_dir/"
    echo -e "${GREEN}  ✓ Copied AI_Companion.js${NC}"

    cp "$SCRIPT_DIR/plugins/FearHungerKB.js" "$plugins_dir/"
    echo -e "${GREEN}  ✓ Copied FearHungerKB.js${NC}"

    # Copy face assets
    if [ -d "$SCRIPT_DIR/assets/faces" ]; then
        cp "$SCRIPT_DIR/assets/faces/"*.png "$faces_dir/" 2>/dev/null || true
        echo -e "${GREEN}  ✓ Copied face assets${NC}"
    fi

    # Copy RAG data directory (vector index is built separately with tools/build-rag-index.js)
    if [ -d "$SCRIPT_DIR/data/rag" ]; then
        mkdir -p "$dest/data/rag"
        cp "$SCRIPT_DIR/data/rag/"*.jsonl "$dest/data/rag/" 2>/dev/null || true
        [ -f "$SCRIPT_DIR/data/rag/index.json" ] && cp "$SCRIPT_DIR/data/rag/index.json" "$dest/data/rag/"
        echo -e "${GREEN}  ✓ Copied RAG chunk data${NC}"
    fi

    # Patch plugins.js to register our plugins (if not already registered)
    if ! grep -q "FearHungerKB" "$plugins_js"; then
        # Insert before the closing bracket of the plugin array
        # Find the last ] in the file and insert before it
        local tmp_file="${plugins_js}.tmp"
        # Use Python for reliable JSON-like patching
        python3 - "$plugins_js" "$tmp_file" <<'PYEOF'
import sys, re

with open(sys.argv[1], 'r', encoding='utf-8') as f:
    content = f.read()

kb_entry = '{"name":"FearHungerKB","status":true,"description":"AI Companion Knowledge Base","parameters":{}}'
ai_entry = '{"name":"AI_Companion","status":true,"description":"AI Companion Mod","parameters":{"companionActorId":"15","debugMode":"true"}}'

# Check if already present
if 'FearHungerKB' in content:
    print("Already patched")
    with open(sys.argv[2], 'w', encoding='utf-8') as f:
        f.write(content)
    sys.exit(0)

# Find the plugin array and append before the closing ]
# plugins.js structure: var $plugins = [...];
match = re.search(r'(var\s+\$plugins\s*=\s*\[)(.*?)(\];)', content, re.DOTALL)
if match:
    existing = match.group(2).rstrip().rstrip(',')
    new_content = f'{match.group(1)}{existing},\n{kb_entry},\n{ai_entry}\n{match.group(3)}'
    content = content[:match.start()] + new_content + content[match.end():]
    print("Patched successfully")
else:
    print("WARNING: Could not find plugin array in plugins.js")
    print("You may need to register the plugins manually")

with open(sys.argv[2], 'w', encoding='utf-8') as f:
    f.write(content)
PYEOF
        if [ -f "$tmp_file" ]; then
            mv "$tmp_file" "$plugins_js"
            echo -e "${GREEN}  ✓ Registered plugins in plugins.js${NC}"
        fi
    else
        echo -e "${YELLOW}  ⚠ Plugins already registered in plugins.js${NC}"
    fi

    echo ""
    echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}${BOLD}   ✓ Installation complete!${NC}"
    echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${CYAN}Next steps:${NC}"
    echo "  1. Launch Fear & Hunger"
    echo "  2. Press F5 to open AI Companion settings"
    echo "  3. Enter your API key (get one free at https://console.groq.com)"
    echo "  4. Press C in-game to chat with your companion"
    echo ""
}

# ── Uninstall mod ──────────────────────────────────────────────
uninstall_mod() {
    local dest="$1"
    local plugins_dir="$dest/www/js/plugins"
    local faces_dir="$dest/www/img/faces"
    local plugins_js="$dest/www/js/plugins.js"

    echo -e "${YELLOW}Uninstalling AI Companion Mod...${NC}"

    [ -f "$plugins_dir/AI_Companion.js" ] && rm "$plugins_dir/AI_Companion.js" && echo -e "${GREEN}  ✓ Removed AI_Companion.js${NC}"
    [ -f "$plugins_dir/FearHungerKB.js" ] && rm "$plugins_dir/FearHungerKB.js" && echo -e "${GREEN}  ✓ Removed FearHungerKB.js${NC}"

    if [ -f "${plugins_js}.bak" ]; then
        cp "${plugins_js}.bak" "$plugins_js"
        echo -e "${GREEN}  ✓ Restored plugins.js from backup${NC}"
    fi

    echo -e "${GREEN}  ✓ Uninstall complete${NC}"
}

# ── Main ───────────────────────────────────────────────────────
detect_os

# Check for required files
if [ ! -f "$SCRIPT_DIR/plugins/AI_Companion.js" ]; then
    echo -e "${RED}✗ Error: plugins/AI_Companion.js not found${NC}"
    echo "  Make sure you're running this from the mod directory"
    exit 1
fi

# Menu
echo ""
echo -e "  ${BOLD}1)${NC} Install mod"
echo -e "  ${BOLD}2)${NC} Uninstall mod"
echo -e "  ${BOLD}3)${NC} Exit"
echo ""
read -rp "$(echo -e "${CYAN}Choose an option [1-3]: ${NC}")" choice

case "$choice" in
    2) ACTION="uninstall" ;;
    3) echo "Bye!"; exit 0 ;;
    *) ACTION="install" ;;
esac

# Find or ask for game path
echo ""
echo -e "${CYAN}Searching for Fear & Hunger installation...${NC}"

if find_game_path; then
    echo -e "${GREEN}✓ Found game at: ${BOLD}$GAME_PATH${NC}"
    read -rp "$(echo -e "${CYAN}Use this path? [Y/n]: ${NC}")" confirm
    if [[ "$confirm" =~ ^[Nn] ]]; then
        GAME_PATH=""
    fi
fi

if [ -z "$GAME_PATH" ]; then
    echo ""
    echo -e "${YELLOW}Could not auto-detect game path.${NC}"
    echo "  Enter the path to your Fear & Hunger installation directory."
    echo "  Example: /home/user/.local/share/Steam/steamapps/common/Fear & Hunger"
    echo ""
    read -rp "$(echo -e "${CYAN}Game path: ${NC}")" GAME_PATH
fi

# Validate
if ! validate_game_path "$GAME_PATH"; then
    echo -e "${RED}✗ Aborting.${NC}"
    exit 1
fi

# Execute
if [ "$ACTION" = "install" ]; then
    install_mod "$GAME_PATH"
else
    uninstall_mod "$GAME_PATH"
fi
