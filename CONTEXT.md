# Project Context

## Purpose

FearHunger-AI-Companion is a plugin-only mod for Fear & Hunger v1.4.x. The project explores whether an LLM-driven companion can behave like an in-world party member instead of a traditional scripted follower.

The thesis framing matters: when possible, companion speech, goals, risky choices, support actions, and combat reasoning should come from the LLM using grounded game context. Runtime code may validate, constrain, execute, and protect the player, but it should not impersonate the companion with canned roleplay lines.

## Domain Terms

- **Companion**: the AI-controlled party member, usually actor slot `15`.
- **Player**: the human-controlled party leader.
- **Autonomy**: beta companion overworld behavior driven by a local-model heartbeat plus local task continuation.
- **Autopilot**: test/research mode where an LLM controls player progression. It is not normal gameplay.
- **Heartbeat**: periodic autonomy model request for a new goal when no existing task is being continued.
- **Task continuation**: local execution of an already selected goal, such as walking to a crate or finishing a safe interaction.
- **Perception**: structured live map/event scan from `EnvironmentScanner`.
- **World state**: aggregate party/map/resource/threat summary from `WorldStateEngine`.
- **Risk**: live survival and combat danger summary from `RiskEvaluator`.
- **Knowledge base**: deterministic curated game data in `FearHungerKB.js`.
- **Hybrid RAG**: optional vector retrieval over curated chunks under `data/rag/`.
- **Vision context**: optional local-only canvas vision observation for visual chat questions.
- **Save-tied memory**: persistent facts, goals, transcript history, and story progress tied to the active save context.
- **AI Log**: in-game recent-run log viewer.
- **JSONL logs**: persisted runtime logs in `<game>/ai_companion_logs/session_*.jsonl`.

## Truth Priority

When systems disagree, use this order:

1. Live combat state.
2. Live map/perception state.
3. Optional local vision observation from the game canvas.
4. Current party, inventory, equipment, statuses, and gold.
5. Recent NPC dialogue and recent player conversation.
6. Save-tied story memory.
7. Curated KB.
8. Hybrid RAG chunks.
9. Persona/style instructions.

Vision can help identify what the canvas appears to show, but it is secondary to live scanner/combat state. RAG and KB are background knowledge. They must not claim that something is visible, alive, nearby, equipped, or owned unless live state or the explicitly marked vision observation confirms it.

## Runtime Modules

- `Config`: provider, language, model, persona, autonomy, RAG, debug, telemetry, and local endpoint settings.
- `LLMAPIHandler`: combat/chat model request and response parsing. Combat currently uses the synchronous path for RPG Maker MV command-flow safety.
- `ActionExecutor`: combat decision normalization and execution.
- `EnvironmentScanner`: map-event perception and localized object labels.
- `WorldStateEngine`: party/resource/threat/situation summary.
- `RiskEvaluator`: danger and survival assessment.
- `StoryGoalMemory`: save-tied progression and goal memory.
- `NPCIntelligence`: recent NPC contact/dialogue tracking.
- `ChatSystem` / `Scene_AIChat`: chat UI, prompt assembly, transcript, and grounded response validation.
- `VisionContext`: optional cached canvas capture and local vision observation for visual chat questions.
- `AutonomySystem`: optional local companion autonomy.
- `PlayerAutopilot`: LLM-only test harness for full-player-control experiments.
- `AINotificationOverlay`: non-blocking gab/toast/icon feedback for AI actions.
- `ThesisLogger`: structured JSONL runtime logging.
- `DebugState`: in-game recent runtime state for `AI Log`.

## Design Constraints

- Do not ship base game assets or private logs.
- Do not add personal model names, LAN IPs, API keys, saves, or buglogs to the repo.
- Do not add new fake config options. If a setting does not change runtime behavior, remove it or document it as intentionally unavailable.
- Avoid hardcoded companion speech. Silent fallback is better than fake roleplay.
- Prefer validation and guardrails over deterministic scripted decisions when the behavior is meant to support the thesis.
- Keep live state above lore. The AI must not hallucinate visible enemies, NPCs, inventory, or equipment from KB/RAG.
- Synchronous combat is intentional. The old async combat path was removed because it could expose manual companion turns while the LLM was still pending.

## Branch Strategy

- `main`: stable/default GitHub branch.
- `develop`: integration branch for tested feature work.
- `feat/*`: feature branches from `develop`.
- `fix/*`: bugfix branches from `develop`.
- `chore/*`: repo cleanup, docs, refactors, release prep.
- `backup/*`: safety references for rollback.

Before merging to `main`, run static checks and at least one manual smoke test when plugin runtime behavior changed.
