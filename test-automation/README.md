# Fear & Hunger AI Companion Test Automation

CDP-based automation harness for the RPG Maker MV/NW.js mod. It launches the game, connects through Chrome DevTools Protocol, injects JavaScript into the game runtime, drives keyboard input, reads plugin state, captures screenshots, and records resumable test reports.

## Quick Start

```bash
cd test-automation
./run-tests.sh --quick
```

Run one branch:

```bash
./run-tests.sh --branch rag
./run-tests.sh --branch integration
```

Run one scenario:

```bash
./run-tests.sh --scenario rag_buckman_grounding
./run-tests.sh --scenario chat_visible_ui_path
```

## Configuration

All paths and model endpoints are configurable through environment variables.

```bash
export FH_GAME_DIR="/home/asukate/Development/Fear And Hunger modding/Fear & Hunger V1.4.1"
export FH_NW_BINARY="$FH_GAME_DIR/nw"
export FH_AI_LOG_DIR="$FH_GAME_DIR/ai_companion_logs"
export FH_LMSTUDIO_BASE_URL="http://127.0.0.1:1234/v1"
export FH_VISION_MODEL="gemma-4-e4b-uncensored-hauhaucs-aggressive"
./run-tests.sh --branch rag
```

For the English copy, point `FH_GAME_DIR`, `FH_NW_BINARY`, and `FH_AI_LOG_DIR` at the English install.

## What It Can Test

- Plugin boot and config access.
- Thesis logger JSONL output.
- Direct chat pipeline through `AI_Companion.ChatSystem.sendMessage`.
- Visible chat UI path through the actual `Scene_AIChat`.
- RAG retrieval and grounded response checks.
- Environment scanner output.
- World state snapshots.
- NPC dialogue buffers.
- Basic combat state and AI decision logging.
- Save/load smoke paths and resumable reports.

## Limits

This can replace repetitive regression sweeps, but not all human playtesting. It does not yet have robust map pathfinding, story objective planning, visual quality judgment, or reliable long-form progression logic. Treat it as an automated QA agent plus telemetry collector, not as a full designer-level player.

Generated files under `test-automation/reports/` are intentionally ignored by git.
