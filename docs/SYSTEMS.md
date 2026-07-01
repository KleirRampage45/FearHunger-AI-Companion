# System Overview

This document is a current high-level map of the mod internals. It is not a branch plan.

## Runtime Modules

- `Config`: provider, language, model, persona, autonomy, RAG, vision, and debug settings.
- `ThesisLogger`: writes structured JSONL sessions to `<game>/ai_companion_logs/session_*.jsonl`.
- `FearHungerKB`: curated deterministic knowledge for enemies, items, statuses, areas, and mechanics.
- `HybridRAG`: optional vector retrieval over `data/rag/` chunks for broad lore/NPC/location questions.
- `VisionContext`: reads an already-rendered PIXI framebuffer for explicit visual questions without re-rendering battle scenes.
- `MultimodalEvidenceFusion`: confirms visual candidates against live battle/map state and bundled visual profiles.
- `EntityKnowledgeLedger`: save-tied naming permissions for common, encountered, introduced, and hidden entities.
- `InventoryContextExtractor`: authoritative party inventory/equipment/status context for supported menu questions.
- `IntentDetector`: regex-first intent classifier with optional local LLM fallback.
- `EnvironmentScanner`: scans current map events and produces player-facing nearby objects, hazards, NPCs, enemies, doors, and containers.
- `WorldStateEngine`: summarizes party, resources, threats, situation, and current map context.
- `StoryGoalMemory`: save-tied story progress and inferred goals.
- `NPCIntelligence`: tracks recent NPC dialogue/contact and injects it into chat context.
- `RiskEvaluator`: estimates combat/world risk and recommends caution, attack, regrouping, or avoidance.
- `LLMAPIHandler`: model request/response handling across cloud providers and local OpenAI-compatible servers.
- `ActionExecutor`: validates and applies combat decisions.
- `ChatSystem` and `Scene_AIChat`: in-game chat UI and transcript.
- `AutonomySystem`: optional local-model heartbeat controller for overworld companion actions.
- `DebugState`: recent runtime state backing the in-game `AI Log` viewer.

## Truth Priority

When multiple systems disagree, prompts and validators should treat sources in this order:

1. Live combat state.
2. Live map/perception state.
3. Optional local vision observation from the captured game canvas.
4. Current party, inventory, equipment, and statuses.
5. Recent NPC dialogue and recent player conversation.
6. Save-tied story memory.
7. Curated structured KB.
8. Hybrid RAG chunks.
9. Style/personality instructions.

Vision is useful for backgrounds, appearance, and presented menus, but it can hallucinate UI/art and remains secondary to live state. Raw image output is converted into roleplay-safe semantic evidence. Hybrid RAG supplies descriptions and identity candidates but never proves presence.

## Provider Flow

- `Groq`: fast cloud chat/combat.
- `OpenRouter`: configurable cloud model provider.
- `Local`: LM Studio/Ollama/OpenAI-compatible endpoint, mainly for autonomy/private testing and optionally chat.

When provider is `local`, cloud fallback must use cloud-safe model names. Local model names such as `gemma-...`, `qwen...`, or custom LM Studio IDs must not be sent to a cloud provider.

## Persistent Files

Runtime-generated files are written into the installed game folder, not this repo:

```text
<game>/ai_companion_logs/session_*.jsonl
<game>/data/rag/
```

The repository should only contain source chunks/index under `data/rag/`, not personal play logs.

## Test Automation

`test-automation/` can launch NW.js through CDP and validate:

- plugin boot/config,
- chat pipeline,
- visible chat UI,
- RAG grounding,
- environment scans,
- world state,
- basic combat telemetry,
- save/load smoke behavior.

It is useful for regression sweeps. It does not fully replace human playtesting for story progression, game-feel, visual quality, or long-form emergent autonomy.
