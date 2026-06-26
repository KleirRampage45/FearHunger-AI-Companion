# Fear & Hunger AI Companion

AI Companion is an RPG Maker MV plugin pair for **Fear & Hunger v1.4.x**. It adds a configurable party member that can chat with the player, act in battle, read live game context, remember save-tied events, and optionally take beta autonomous overworld actions through a local LLM.

Current version: `0.8.0-beta`

Spanish documentation: [README.es.md](README.es.md)

## Repository Scope

This is a plugin-only repository.

Included:

- `plugins/AI_Companion.js` - main runtime plugin.
- `plugins/FearHungerKB.js` - curated game knowledge base.
- `assets/faces/` - distributable companion face assets.
- installer scripts for Linux/macOS/Git Bash and Windows.
- docs, static checks, and test automation support.

Not included:

- base game files or decrypted game data.
- game saves.
- personal play logs.
- private plugin examples.
- full Fear & Hunger assets.

## Feature Overview

- **Configurable companion**: name, appearance, starting class, custom persona, backstory, voice/style, goals, and behavior rules.
- **In-game chat**: press `C` to open a companion chat scene that uses live context instead of only generic LLM memory.
- **Grounded context**: prompts can include combat state, party status, equipment, inventory, nearby events, NPC dialogue, story memory, KB data, and optional RAG chunks.
- **Synchronous combat AI**: the companion selects actions, targets, and limbs through the verified RPG Maker command flow. Async combat was removed because it could expose manual companion turns while the LLM was still pending.
- **Combat validation**: decisions are normalized against live enemy limbs and current party state before execution.
- **Save-tied memory**: conversation history, story goals, important facts, NPC contact, trade events, and recent pickups are stored per save context.
- **Perception engine**: scans map events for enemies, NPCs, doors, containers, hazards, traps, loot, and interactables while hiding raw RPG Maker event ids from roleplay.
- **World/risk layers**: summarizes party resources, morale, danger, map state, battle risk, and survival pressure.
- **Autonomy beta**: optional local-model heartbeat for companion looting, doors, NPCs, task continuation, and safe detours.
- **Background safe loot**: supported safe loot events can run without blocking player control, with gab/toast feedback and item-icon balloons.
- **Consent guardrails**: risky choices, merchant purchases, equipment changes, healing/support item use, and story-sensitive events can require player approval.
- **Hybrid RAG**: optional vector retrieval over curated `data/rag/` chunks for lore, characters, endings, locations, and broad game knowledge.
- **Optional local vision context**: for visual chat questions, the plugin can send the cached game canvas to a local vision model and inject a `VISION OBSERVATION` section below live scanner data. Vision is secondary evidence; live game state wins on conflicts.
- **Localization**: runtime Spanish/English mode for UI labels, scanner labels, prompt language, and chat context.
- **AI Log viewer**: in-game recent log viewer with obvious `[CHAT]`, `[COMBAT]`, `[AUTONOMY]`, `[RAG]`, `[VISION]`, and `[ERROR]` labels.
- **Persistent JSONL logs**: structured runtime logs under `<game>/ai_companion_logs/` for thesis/debug analysis.
- **Telemetry**: optional FPS, game memory, CPU, local request latency, token usage, and token-per-second logging.
- **Autopilot test mode**: LLM-only player-control harness for experiments. It is useful for research/testing, not a polished normal-play feature.

## AI Providers

| Provider | Main use | Notes |
| --- | --- | --- |
| Local OpenAI-compatible server | autonomy, private chat, experiments | LM Studio/Ollama-compatible endpoints. Recommended for autonomy. |
| Groq | cloud chat/combat | Fast cloud fallback when available. |
| OpenRouter | model variety | Supports many cloud models. |

Local endpoint example:

```text
http://127.0.0.1:1234/v1/chat/completions
```

Recommended local sampling defaults:

```text
temperature = 1.0
top_p = 0.95
top_k = 64
```

If using Hybrid RAG, also run an embeddings model and configure `/v1/embeddings`; see [docs/HYBRID_RAG_SETUP.md](docs/HYBRID_RAG_SETUP.md).

If using vision context, run a local OpenAI-compatible vision model. Vision calls are local-only and never fall back to Groq/OpenRouter.

## Installation

Full guide: [docs/INSTALL.md](docs/INSTALL.md)

Linux/macOS/Git Bash:

```bash
git clone https://github.com/KleirRampage45/FearHunger-AI-Companion.git
cd FearHunger-AI-Companion
chmod +x install.sh
./install.sh
```

Windows:

```bat
install.bat
```

Manual install:

1. Copy `plugins/FearHungerKB.js` to `<game>/www/js/plugins/`.
2. Copy `plugins/AI_Companion.js` to `<game>/www/js/plugins/`.
3. Copy `assets/faces/*.png` to `<game>/www/img/faces/`.
4. Add `FearHungerKB` and `AI_Companion` to `<game>/www/js/plugins.js`, with `FearHungerKB` listed first.

## Configuration

Open `AI Companion` from the title menu.

Important sections:

- `Character`: companion name, appearance, class, persona, custom backstory, voice/style, goals, and behavior rules.
- `Chat / Provider`: Groq/OpenRouter/local provider, model, endpoint, sampling settings, optional vision context, and optional local vision model id.
- `Autonomy`: beta companion heartbeat, looting radius, door/NPC permissions, return-on-danger behavior, and local model selection.
- `RAG`: semantic retrieval endpoint, embeddings model, chunk limit, threshold, spoiler level, and language behavior.
- `Debug`: debug console and FPS/RAM/CPU telemetry.
- `AI Log`: recent in-game runtime log viewer.

## Controls

| Key | Action |
| --- | --- |
| `C` | Open AI chat |
| `Enter` | Confirm UI / send chat |
| `Esc` | Cancel / close |
| `F5` | Reload RPG Maker MV page |

## Testing

Static tests are available and should run before every commit that touches plugin code:

```bash
node --check plugins/AI_Companion.js
node --check plugins/FearHungerKB.js
node scripts/check_plugin_static.js
git diff --check
```

The static checker verifies syntax and important regression markers, including:

- provider-neutral LLM handler.
- scanner localization.
- story-goal prompt injection.
- non-blocking notification overlay.
- background loot support.
- combat telemetry.
- destroyed-limb combat grounding.
- absence of known hardcoded/fake/dead settings.

Manual and automated test instructions:

- [docs/TESTING.md](docs/TESTING.md)
- [test-automation/README.md](test-automation/README.md)

## Runtime Logs

Installed game copies write runtime logs here:

```text
<game>/ai_companion_logs/session_*.jsonl
```

Use the summarizer before opening large raw logs:

```bash
node scripts/summarize_logs.js --last 25
node scripts/summarize_logs.js --since 120 --last 15 --errors --combat --chat
```

The in-game `AI Log` viewer is a recent-run viewer. It does not read historical JSONL files.

## Documentation Map

- [docs/SYSTEMS.md](docs/SYSTEMS.md) - runtime module overview.
- [docs/INSTALL.md](docs/INSTALL.md) - installation.
- [docs/TESTING.md](docs/TESTING.md) - manual/static/automation testing.
- [docs/HYBRID_RAG_SETUP.md](docs/HYBRID_RAG_SETUP.md) - RAG setup.
- [docs/MAP_EVENT_NAMING.md](docs/MAP_EVENT_NAMING.md) - curated event naming.
- [docs/HARDCODED_LINES.md](docs/HARDCODED_LINES.md) - policy for avoiding scripted AI speech.
- [docs/CONFIG_MENU_AUDIT.md](docs/CONFIG_MENU_AUDIT.md) - whether config options affect runtime.
- [docs/REPO_HYGIENE.md](docs/REPO_HYGIENE.md) - repository cleanup policy.
- [docs/RELEASE.md](docs/RELEASE.md) - packaging/release notes.

## Known Limitations

- The companion uses actor slot `15` by default.
- Combat requests are synchronous for RPG Maker MV command-flow compatibility, so the game can pause briefly during companion decisions.
- Autonomy is beta and depends heavily on local model quality and event support.
- Safe background loot only supports known safe event patterns; unsupported events use the normal RPG Maker flow or are skipped.
- Early-game maps have stronger curated event naming than late-game maps.
- Hybrid RAG is background knowledge, not live perception. Live game state should always win over retrieved lore.
- Autopilot test mode is for research and QA experiments, not a finished full-game autoplayer.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

Short version:

1. Branch from `develop` for features/fixes.
2. Run static checks before commit.
3. Do not commit game assets, saves, logs, personal local model names, or private bug logs.
4. Merge to `main` only after manual playtesting and static checks pass.

## License

MIT License. See [LICENSE](LICENSE).

## Credits

- **Fear & Hunger** by Miro Haverinen.
- Mod implementation by Asukat with AI-assisted development.
- Knowledge base and RAG data are curated from player-facing Fear & Hunger knowledge and wiki-style summaries.
