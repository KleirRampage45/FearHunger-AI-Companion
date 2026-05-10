# Installation Guide

## Requirements

- A legal copy of Fear & Hunger v1.4.x.
- This mod repository or release archive.
- One AI provider:
  - Groq API key.
  - OpenRouter API key.
  - Local OpenAI-compatible server such as LM Studio.

## Linux

```bash
git clone https://github.com/KleirRampage45/FearHunger-AI-Companion.git
cd FearHunger-AI-Companion
chmod +x install.sh
./install.sh
```

Install directly into a specific test copy:

```bash
./install.sh --install --path "/home/user/Games/Fear & Hunger English Clean"
```

Skip auto-detection if you have multiple local copies:

```bash
./install.sh --install --no-detect
```

If auto-detection fails, paste the full game folder path when prompted. The folder must contain:

```text
www/js/plugins.js
www/js/plugins/
www/img/faces/
```

## macOS

```bash
git clone https://github.com/KleirRampage45/FearHunger-AI-Companion.git
cd FearHunger-AI-Companion
chmod +x install.sh
./install.sh
```

If Gatekeeper blocks NW.js or the game app, handle that at the game level. The installer only copies files.

## Windows

Use one of:

- `install.bat` from Command Prompt.
- `install.sh` from Git Bash.
- `install.sh` from WSL if the game is accessible under `/mnt/c/...`.

Command Prompt:

```bat
install.bat
```

Git Bash:

```bash
./install.sh
```

## Manual Install

Copy:

```text
plugins/AI_Companion.js  -> <game>/www/js/plugins/AI_Companion.js
plugins/FearHungerKB.js  -> <game>/www/js/plugins/FearHungerKB.js
assets/faces/*.png       -> <game>/www/img/faces/
```

Then add entries to `<game>/www/js/plugins.js`:

```json
{"name":"FearHungerKB","status":true,"description":"AI Companion Knowledge Base","parameters":{}},
{"name":"AI_Companion","status":true,"description":"AI Companion Mod","parameters":{"companionActorId":"15","debugMode":"true"}}
```

`FearHungerKB` should be listed before `AI_Companion`.

## First Launch

1. Start the game.
2. Open `AI Companion` from the title menu.
3. Choose language.
4. Configure provider and model.
5. Set API key if using cloud.
6. Configure companion name, appearance, class, and persona.
7. In game, press `C` to chat.

## Local Model Setup

For LM Studio:

1. Start local server.
2. Load a fast non-thinking model for autonomy.
3. Use an OpenAI-compatible endpoint such as:

```text
http://127.0.0.1:1234/v1/chat/completions
```

or your LAN address:

```text
http://192.168.100.3:1234/v1/chat/completions
```

Recommended local autonomy sampling defaults:

```text
temperature = 1.0
top_p = 0.95
top_k = 64
```

## Launching NW.js Cleanly

If terminal logs show Chromium profile/database noise, launch with an isolated profile:

```bash
cd "/path/to/Fear & Hunger"
mkdir -p /tmp/fh-nw-profile
env -u WAYLAND_DISPLAY GDK_BACKEND=x11 DISPLAY=:0 ./nw --user-data-dir=/tmp/fh-nw-profile .
```

## Uninstall

Run the installer and choose uninstall, or manually remove:

```text
<game>/www/js/plugins/AI_Companion.js
<game>/www/js/plugins/FearHungerKB.js
```

Restore `plugins.js.bak` if the installer created one.

## Fresh English Install Test

Do not copy the English game into this repository. Keep it next to the repo or in a games folder:

```text
Fear And Hunger modding/
  FearHunger-AI-Companion/        # git repo, mod only
  Fear & Hunger V1.4.1/           # Spanish patched test copy
  Fear & Hunger English Clean/    # clean English test copy, not committed
```

Install into the English copy explicitly:

```bash
cd "/home/asukate/Development/Fear And Hunger modding/FearHunger-AI-Companion"
./install.sh --install --path "/home/asukate/Development/Fear And Hunger modding/Fear & Hunger English Clean"
```

Then launch that English copy and check:

1. The title menu shows `AI Companion`.
2. `FearHungerKB` is listed before `AI_Companion` in `www/js/plugins.js`.
3. Chat opens with `C`.
4. One battle completes without command-name errors.
5. Logs appear under that English copy's `ai_companion_logs/` folder.

Uninstall from that copy:

```bash
./install.sh --uninstall --path "/home/asukate/Development/Fear And Hunger modding/Fear & Hunger English Clean"
```
