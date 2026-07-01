# AGENTS.md

## Mission

Maintain the Fear & Hunger AI Companion plugin as a plugin-only repo. Preserve the thesis framing: the LLM should make companion-facing choices where feasible; code should provide grounded context, validation, execution, safety, logging, and UI.

Read `CONTEXT.md` before changing plugin behavior.

## Repository Rules

- Do not commit base game files, decrypted game data, saves, runtime logs, API keys, personal model names, private buglogs, or private plugin examples.
- Keep release artifacts plugin-only.
- Prefer small, verifiable changes. `plugins/AI_Companion.js` is large and fragile; avoid broad formatting churn.
- Use `apply_patch` for manual edits.
- Do not reintroduce removed fake settings such as debug overlay or async combat.
- Do not add hardcoded companion roleplay lines. For non-critical fallback, silence is preferred.
- Live game state beats KB/RAG/persona text.

## Important Paths

Repo source:

```text
plugins/AI_Companion.js
plugins/FearHungerKB.js
scripts/check_plugin_static.js
scripts/summarize_logs.js
docs/
test-automation/
```

Live local test copies used during development:

```text
../Fear & Hunger V1.4.1/www/js/plugins/AI_Companion.js
../Fear & Hunger English/www/js/plugins/AI_Companion.js
```

After changing `plugins/AI_Companion.js`, sync when the user wants live testing:

```bash
cp plugins/AI_Companion.js '../Fear & Hunger V1.4.1/www/js/plugins/AI_Companion.js'
cp plugins/AI_Companion.js '../Fear & Hunger English/www/js/plugins/AI_Companion.js'
```

Runtime logs are in the game folder, not the repo:

```text
../Fear & Hunger V1.4.1/ai_companion_logs/session_*.jsonl
../Fear & Hunger English/ai_companion_logs/session_*.jsonl
```

When the user says "check the logs", they usually mean the latest file in the installed game's `ai_companion_logs/`, not old `buglogs/`.

Use summaries before raw logs:

```bash
node scripts/summarize_logs.js --last 25
node scripts/summarize_logs.js --since 120 --last 15 --errors --combat --chat
```

## Required Static Checks

Run from repo root:

```bash
node --check plugins/AI_Companion.js
node --check plugins/FearHungerKB.js
node scripts/check_plugin_static.js
node scripts/check_visual_rag.js
git diff --check
```

`scripts/check_plugin_static.js` is the regression guard for:

- core runtime modules,
- scanner localization,
- non-blocking notification overlay,
- background safe loot,
- combat telemetry,
- live destroyed-limb grounding,
- removed hardcoded/fake settings,
- removed unsafe async combat.

## Git Workflow

- Default branch on GitHub is `main`.
- Use `develop` for integration work and `feat/*`, `fix/*`, `chore/*` branches for changes.
- Keep `backup/*` branches for rollback points before large risky merges.
- Do not merge to `main` until static checks pass.
- If runtime behavior changed, ask for or perform a manual game smoke test before release tagging.

## CodeGraph

This repo may have a CodeGraph index. Use it for structural questions:

- where a symbol is defined,
- what calls what,
- impact of changing a function,
- broad module context.

Use literal search (`rg`) for strings, log labels, prompt text, comments, or regression markers.

## Behavior Notes

- Combat is synchronous by design. Async combat was removed because it could expose manual companion turns while an LLM request was still pending.
- Autonomy beta may continue an existing task locally, but new goals should come from the model when thesis-safe behavior matters.
- Autopilot is a QA/research harness, not a normal gameplay feature.
- Hybrid RAG provides background knowledge only. It must not override live state.
- Background loot is only safe for known safe common-event patterns. Unsupported events should not be forced in background.
- Consent guardrails exist for risky interaction text, merchant purchases, story-sensitive choices, support items, and equipment suggestions.

## Common Launch Command

```bash
cd "/home/asukate/Development/Fear And Hunger modding/Fear & Hunger V1.4.1"
env -u WAYLAND_DISPLAY GDK_BACKEND=x11 DISPLAY=:0 ./nw --auto-open-devtools-for-tabs .
```

Chromium/NW.js console warnings about password stores, history sqlite versions, Skia shader compilation, or cert AIA chasing are usually NW.js profile noise unless accompanied by plugin stack traces.
