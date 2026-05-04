# Changelog

All notable changes to the Fear & Hunger AI Companion plugin are tracked here.

## 0.8.0-beta - 2026-05-03

### Added

- Persistent story-goal memory tied to save data.
- Fear recovery tracking for relief/worry state changes after severe states are cured.
- Custom persona configuration for backstory, voice/style, goals, and behavior rules.
- Local endpoint/model editing and sampling controls for `temperature`, `top_p`, and `top_k`.
- Localization audit pass for scanner labels and fallback replies in English mode.
- In-game AI log viewer from the title menu for recent autonomy, combat, chat, fear, and game events.
- Autonomy debug ring buffer separate from JSONL log files.

### Changed

- Chat, combat, item, and hunger prompts now use the configured persona prompt block.
- Scanner labels now localize at runtime instead of always exposing Spanish nouns.
- Config UI command list now sizes to available screen height.
- Edit/paste inputs now open as a centered overlay.
- Autonomy LLM console output is gated by debug mode instead of always printing.

### Fixed

- Rejected mismatched autonomy comments such as lighting dialogue when the target is a door.
- Removed hardcoded player-name fallbacks.
- Added detail view to the in-game AI log so Enter no longer appears to do nothing.

## 0.7.x - April 2026

### Added

- Autonomous heartbeat branch set with local LLM goal selection.
- Local task continuation for movement/interactions.
- Merchant approval guards.
- Equipment suggestions and support-item approval flow.
- Reactive/proactive ambient comments.
- Memory/belief grounding for chat responses.
- Perception, world-state, risk, NPC, and response-validator layers.

### Fixed

- Combat target resolution regressions.
- Battle LLM normalization errors.
- Door interaction reliability.
- Repeated looting/searching loops.
- Object-label hallucinations such as `chest_7` leaking into dialogue.

## 0.6.x and earlier

### Added

- Core AI companion actor integration.
- Chat scene opened with `C`.
- Cloud provider support for Groq/OpenRouter.
- Local OpenAI-compatible provider support.
- Basic combat decisions and fallback actions.
- Fear & Hunger knowledge base plugin.
