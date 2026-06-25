# AI Config Menu Audit

This file records whether each exposed config option changes runtime behavior.

## Hard Runtime Controls

- `Provider`, `API key`, `Chat model`, `Local endpoint`, `Local model`: route chat/combat requests.
- `Temperature`, `top_p`: used by chat/combat sampling through `Config.getSamplingOptions()`.
- `top_k`: used only when local-compatible requests opt into top-k. Autonomy/autopilot currently use fixed local defaults.
- `Name`, `appearance`, `personality`, `custom persona`, `backstory`, `voice/style`, `goals`, `rules`: injected into persona prompts when applicable.
- `Language`: controls UI text, prompt language, and localization behavior.
- `Starting class`: controls companion starting loadout on new game setup.
- `Autonomy enabled`, `heartbeat`, `scout distance`, `detour distance`, `loot radius`, `NPCs`, `doors`, `auto return`: used by companion autonomy scanning, prompts, and movement constraints.
- `Autopilot enabled`, `tick`, `max runtime`: used by the LLM-only playtest autopilot.
- `Hybrid RAG enabled`, endpoint, model, chunks, threshold, spoiler level, language, save-memory inclusion: used by chat retrieval.
- `Performance logging`, interval: controls FPS/RAM/CPU telemetry in `ai_companion_logs`.
- `Debug console`: gates verbose console logging.
- `Async combat`: switches companion combat path to async decision flow.
- `Mock mode`: disables real cloud calls for cloud providers; for local provider it only forces mock when explicitly enabled.

## Prompt Biases, Not Hard Controls

- `Autonomy profile`: sent to the LLM snapshot as profile/bias. Local movement does not enforce different tactical policies per profile.

## Experimental / Weak Controls

- `Solo engage`: currently disabled in the menu because the autonomy prompt forbids starting fights and there is no safe LLM action for deliberate enemy engagement yet.
- `Debug overlay`: exposed as experimental. It persists a flag, but most debug information is still available through console/log viewer rather than a full on-screen renderer.

## Removed / Intentionally Not Exposed

- `Ambient fallback mode`: removed. Non-critical ambient speech stays silent when the LLM does not produce a line; there is no legacy hardcoded chatter mode.

## Menu Structure

- `Compañero IA / AI Companion` is the single title-screen entry.
- `Registro IA / AI Log` lives inside the config hub and can also be opened from Autopilot and Debug sections.
- Each submenu shows only related options to avoid scroll crowding.
