# Testing Guide

This guide covers the current beta release line. Use it before tagging a release candidate or after changing `plugins/AI_Companion.js`.

## Static Checks

Run from the repository root:

```bash
node --check plugins/AI_Companion.js
node --check plugins/FearHungerKB.js
node scripts/check_plugin_static.js
git diff --check
```

Expected:

- JavaScript syntax checks print no errors.
- Static plugin checker prints `OK`.
- `git diff --check` prints no whitespace errors.

## Manual Smoke Test

1. Install into a clean game copy with `install.sh` or `install.bat`.
2. Launch the game.
3. Open the title menu and verify:
   - `AI Companion`
   - `AI Log`
   - provider/model/config options
4. Load a save.
5. Press `C` to open chat.
6. Ask:

```text
quien es buckman?
```

Expected:

- If Hybrid RAG is enabled and indexed, the answer should mention Buckman as a noble/prince from Rondon or his connection to Trortur.
- It should not say it does not know Buckman when `npc_buckman_001` is retrieved.

## Combat Regression

1. Enter a simple fight such as Maneba or Guard.
2. Let the companion act.
3. Check `ai_companion_logs/session_*.jsonl`.

Expected:

- A `combat_decision` entry appears.
- No `TypeError` is thrown.
- Cloud fallback does not send local model names such as `gemma-...` to a cloud provider.
- Coin-flip defense only happens when a live coin-flip threat is actually present.
- During map coin-flip prompts, autonomy/autopilot stops moving and logs `COIN_FLIP_CHOICE`; autopilot choices should include `source: "local_llm"` because the local model must choose the face and Lucky Coin use.

## Autonomy Regression

1. Enable autonomy beta.
2. Stand near containers/doors on a safe map.
3. Let the companion idle for 30-60 seconds.
4. Check the latest JSONL log.

Expected:

- `autonomy_tick` entries appear at the configured heartbeat interval.
- Successful local heartbeats show `source: "local"`.
- Occasional `local_busy` is acceptable while chat/RAG is active, but it should not spam forever.
- Repeated `llm_timeout` means LM Studio or local queue timing needs investigation.

## English/Spanish Regression

Run the same chat and nearby-object tests with both languages:

Spanish:

```text
¿Qué ves cerca?
¿A dónde deberíamos ir?
```

English:

```text
What do you see nearby?
Where should we go?
```

Expected:

- Spanish replies should use Spanish labels.
- English replies should use English labels.
- Broad navigation questions should use live map/story context, not unrelated RAG chunks.

## Automated Harness

The CDP harness lives in `test-automation/`.

Quick checks:

```bash
cd test-automation
./run-tests.sh --list
./run-tests.sh --quick
./run-tests.sh --branch rag
./run-tests.sh --scenario rag_buckman_grounding
./run-tests.sh --scenario chat_visible_ui_path
```

Generated screenshots, reports, pycache, and virtualenvs are ignored by git.
# Compact Log Summaries

Use the local summarizer before opening raw `ai_companion_logs/*.jsonl` files. Raw logs can be huge because scan records include nearby event data.

```bash
node scripts/summarize_logs.js --last 25
node scripts/summarize_logs.js --since 120 --last 15 --errors --combat --chat
node scripts/summarize_logs.js --type autopilot_tick --last 40
```

Only inspect raw JSONL slices after the summary identifies a specific timestamp, event id, or repeated point.
