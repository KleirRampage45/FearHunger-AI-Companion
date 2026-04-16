# Fear & Hunger: AI Companion Mod

An AI-powered companion mod for **Fear & Hunger** (RPG Maker MV) that adds a fully interactive, context-aware AI party member to the game.

## Features

- 🤖 **AI-Controlled Combat** — The companion fights alongside you with tactical decisions based on enemy weaknesses, limb targeting, and coin flip awareness.
- 💬 **Chat System** — Talk to your companion in real-time via an in-game chat window (press `C`). Ask questions, discuss strategy, or just roleplay.
- 🧠 **Knowledge Base** — Comprehensive database of enemies, locations, items, and game mechanics. The AI knows about coin flips, limb priorities, and enemy tactics.
- 🗣️ **Ambient Dialogue** — The companion reacts naturally to events: entering new rooms, picking up items, party changes, limb loss, hunger, and combat.
- 🎭 **Character Presets** — Multiple companion personalities with unique backstories, speech patterns, and visual appearances.
- 🌐 **Bilingual** — Full Spanish and English support. Automatically handles localized enemy/map names.
- 🔧 **Configurable** — In-game settings menu to change API provider, model, companion name, personality, and more.

## Supported AI Providers

| Provider | Models | Cost |
|----------|--------|------|
| **Groq** (default) | Llama 3.3 70B, Llama 3.1 8B | Free tier available |
| **OpenRouter** | Many models (including free ones) | Free/paid options |
| **Local** | Any OpenAI-compatible server (Ollama, LMStudio, etc.) | Free |

## Installation

### Automatic (Recommended)

```bash
# Clone the repo
git clone https://github.com/KleirRampage45/FearHunger-AI-Companion.git
cd FearHunger-AI-Companion

# Run the installer
./install.sh
```

The installer will:
1. Detect your OS (Linux/macOS/Windows via WSL or Git Bash)
2. Auto-detect Fear & Hunger installation path (Steam, GOG, manual)
3. Copy plugin files and assets to the correct locations
4. Patch `plugins.js` to register the mod

### Manual Installation

1. Copy `plugins/AI_Companion.js` → `<game_dir>/www/js/plugins/`
2. Copy `plugins/FearHungerKB.js` → `<game_dir>/www/js/plugins/`
3. Copy `assets/faces/*` → `<game_dir>/www/img/faces/`
4. Edit `<game_dir>/www/js/plugins.js` and add to the plugin list:
```json
{"name":"FearHungerKB","status":true,"description":"Knowledge Base","parameters":{}},
{"name":"AI_Companion","status":true,"description":"AI Companion","parameters":{}}
```

## Configuration

1. Launch the game
2. Press `F5` or access the AI Companion menu
3. Set your API key (get one free from [Groq Console](https://console.groq.com))
4. Choose your companion's personality and appearance

## Controls

| Key | Action |
|-----|--------|
| `C` | Open/close chat |
| `Enter` | Send message |
| `↑` / `↓` | Scroll chat history |
| `ESC` | Clear text / close chat |
| `F5` | AI Configuration menu |

## Requirements

- Fear & Hunger v1.4.x (RPG Maker MV)
- Internet connection for cloud AI (or local AI server)
- API key from Groq, OpenRouter, or a local model

## Known Limitations

- The AI companion uses Actor slot 15 — avoid conflicts with other mods using this slot
- Synchronous combat requests may cause brief freezes (~1-2 seconds per turn)
- Free API tiers have rate limits — the companion falls back to basic attacks when rate-limited

## License

MIT License — see [LICENSE](LICENSE)

## Credits

- **Fear & Hunger** by Miro Haverinen
- AI integration by Asukat
- Knowledge base sourced from the [Fear & Hunger Wiki](https://fear-and-hunger.fandom.com)
