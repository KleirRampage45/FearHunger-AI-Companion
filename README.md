# Fear & Hunger: AI Companion Mod

An AI companion plugin for **Fear & Hunger** v1.4.x. It adds a configurable party member that can chat, fight, react to the world, remember save-tied events, and optionally act autonomously through a local model.

Current version: `0.8.0-beta`

## What This Repo Contains

This repository is intended to be plugin-only.

Included:

- `plugins/AI_Companion.js`
- `plugins/FearHungerKB.js`
- installer scripts
- documentation
- optional companion face assets

Not included:

- base game files
- decrypted game data
- saves
- personal logs
- private plugin examples
- full game assets

## Main Features

- AI-controlled combat with target/limb selection, validation, fallbacks, and combat logging.
- In-game chat opened with `C`.
- Persistent save-tied story and goal memory.
- Context-grounded world perception from map events, nearby objects, NPC dialogue, combat state, party state, items, and knowledge base data.
- Autonomous beta mode that can ask a local model for goals and continue tasks locally.
- Consent guards for risky interactions, merchant purchases, support item use, and equipment suggestions.
- Configurable companion name, appearance, starting class, persona, backstory, voice/style, goals, and behavior rules.
- Groq, OpenRouter, and local OpenAI-compatible provider support.
- Runtime language support for Spanish and English.
- In-game `AI Log` viewer for recent autonomy/combat/chat/fear events.
- Persistent JSONL logs in the game folder under `ai_companion_logs/`.

## Supported AI Providers

| Provider | Use case | Notes |
| --- | --- | --- |
| Groq | cloud chat/combat | fast, free tier available |
| OpenRouter | model variety | supports free and paid models |
| Local | autonomy and private testing | LM Studio/Ollama/OpenAI-compatible servers |

Recommended local autonomy defaults:

```text
temperature = 1.0
top_p = 0.95
top_k = 64
```

## Installation

Full instructions are in [docs/INSTALL.md](docs/INSTALL.md).

Quick Linux/macOS/Git Bash install:

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

1. Copy `plugins/AI_Companion.js` to `<game>/www/js/plugins/`.
2. Copy `plugins/FearHungerKB.js` to `<game>/www/js/plugins/`.
3. Copy `assets/faces/*.png` to `<game>/www/img/faces/`.
4. Add `FearHungerKB` and `AI_Companion` to `<game>/www/js/plugins.js`, with `FearHungerKB` first.

## Configuration

Open `AI Companion` from the title menu.

Important settings:

- `Language`: Spanish or English.
- `Provider`: Groq, OpenRouter, or Local.
- `Chat model`: cloud chat/combat model.
- `Autonomy model`: preferably a fast local model.
- `Custom persona`: enables custom backstory/voice/goals/rules.
- `Autonomy`: turns beta autonomous behavior on/off.
- `AI Log`: title-menu viewer for recent plugin decisions and errors.

## Controls

| Key | Action |
| --- | --- |
| `C` | Open/close AI chat |
| `Enter` | Send chat message / confirm UI |
| `Esc` | Close/cancel |
| `F5` | Reload RPG Maker MV game page |

## Testing

Branch-specific tests are in [docs/BRANCH_TEST_PLANS.md](docs/BRANCH_TEST_PLANS.md).

General smoke test:

```bash
node --check plugins/AI_Companion.js
node --check plugins/FearHungerKB.js
git diff --check
```

In game:

1. Open `AI Companion` config from title screen.
2. Set provider/model/API key or local endpoint.
3. Start/load a save.
4. Press `C`, ask a simple question.
5. Enter one battle and verify companion acts.
6. Enable autonomy and watch `AI Log` for decisions.

## Logs

Runtime logs are written by the installed game copy, not this repo:

```text
<game>/ai_companion_logs/session_*.jsonl
```

Use these for debugging actual gameplay sessions.

The title-menu `AI Log` viewer only shows recent entries from the current run. It does not read historical JSONL files.

## Release Packaging

See [docs/RELEASE.md](docs/RELEASE.md).

Do not package the base game or private logs. Release archives should contain only plugin files, installers, docs, license, version, changelog, and distributable companion assets.

## Known Limitations

- Actor slot 15 is used for the companion by default.
- Combat calls are synchronous for RPG Maker MV input-flow compatibility and can briefly pause the game.
- Autonomous behavior is beta and depends heavily on local model quality.
- Early maps have the strongest curated event naming; later maps need more manual naming coverage.
- Some risky game events intentionally ask for consent before proceeding.

## License

MIT License. See [LICENSE](LICENSE).

## Credits

- **Fear & Hunger** by Miro Haverinen.
- Mod implementation by Asukat and AI-assisted development.
- Knowledge base references derived from player-facing Fear & Hunger knowledge and wiki-style summaries.
