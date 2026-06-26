# Contributing

## Branch Strategy

| Branch | Purpose | Rule |
| --- | --- | --- |
| `main` | Stable/default branch | Merge only after static checks and manual smoke testing. |
| `develop` | Integration branch | Collect tested feature/fix branches here first. |
| `feat/*` | New features | Branch from `develop`. |
| `fix/*` | Bug fixes | Branch from `develop`. |
| `chore/*` | Docs, cleanup, refactors, release prep | Branch from `develop` or the current integration branch. |
| `backup/*` | Rollback references | Never rewrite unless intentionally replacing a safety branch. |

## Required Checks

Run these from the repository root before committing plugin changes:

```bash
node --check plugins/AI_Companion.js
node --check plugins/FearHungerKB.js
node scripts/check_plugin_static.js
git diff --check
```

`scripts/check_plugin_static.js` is the main static regression test. It checks syntax and important project invariants, including:

- required runtime modules,
- scanner localization,
- story-goal prompt injection,
- non-blocking AI notifications,
- background loot support,
- combat telemetry,
- destroyed-limb combat grounding,
- absence of known hardcoded/fake/dead settings.

## Runtime Testing

If behavior changed, also test in game:

1. Install/sync the plugin into a legal Fear & Hunger v1.4.x copy.
2. Launch the game.
3. Open `AI Companion` config from the title menu.
4. Test chat with `C`.
5. Test one simple combat.
6. If autonomy changed, enable autonomy and watch `AI Log` plus `ai_companion_logs/`.

Use log summaries before reading raw JSONL:

```bash
node scripts/summarize_logs.js --last 25
node scripts/summarize_logs.js --since 120 --last 15 --errors --combat --chat
```

## Code and Design Rules

- Keep the repo plugin-only. Do not commit game files, saves, runtime logs, API keys, personal LAN endpoints, personal local model names, or private plugin examples.
- Do not add hardcoded companion speech for normal behavior. Silent fallback is preferred over fake roleplay.
- Do not add fake config options. If a setting does not affect runtime behavior, remove it or keep it out of the UI.
- Live game state must beat KB, RAG, memory, and persona text.
- Combat is synchronous by design for RPG Maker MV command-flow safety.
- Hybrid RAG is background knowledge, not live perception.

## Pull Request Checklist

- [ ] Static checks pass.
- [ ] `git diff --check` passes.
- [ ] No game assets/logs/secrets are included.
- [ ] README/docs updated if behavior or setup changed.
- [ ] Manual smoke test completed when runtime behavior changed.
