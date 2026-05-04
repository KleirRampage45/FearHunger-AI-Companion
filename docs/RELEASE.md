# Release Packaging Guide

This repository should ship only mod code, documentation, installers, and optional user-provided companion assets. Do not ship the base game, decrypted game data, save files, user chat logs, or private research notes.

## Release Contents

Include:

- `plugins/AI_Companion.js`
- `plugins/FearHungerKB.js`
- `assets/faces/` only for companion face assets that are explicitly allowed to be distributed
- `install.sh`
- `install.bat`
- `README.md`
- `CHANGELOG.md`
- `VERSION`
- `docs/`
- `LICENSE`

Exclude:

- `Fear & Hunger V1.4.1/`
- `www/data/`, `www/audio/`, `www/img/` copied from the game
- `Save*.rvdata2`, `config.rpgsave`, `global.rpgsave`
- `ai_companion_logs/`
- `buglogs/`
- local LLM logs
- private plugin examples or reference mods
- `.rpgmvp`, `.rpgmvo`, `.rpgmvm` game asset archives unless they are explicitly created for this mod and distributable

## Versioning

Use semantic-ish beta versions:

- `0.x.y-beta` for active development branches.
- Increment `y` for fixes.
- Increment `x` for feature batches.
- Update `VERSION` and `CHANGELOG.md` for every release candidate.

Current release line: `0.8.0-beta`.

## Build a Release Archive

From repo root:

```bash
version="$(cat VERSION)"
mkdir -p "dist/FearHunger-AI-Companion-$version"
rsync -a \
  --exclude '.git' \
  --exclude 'dist' \
  --exclude 'ai_companion_logs' \
  --exclude 'buglogs' \
  --exclude 'plugin ideas' \
  --exclude '*.rpgmvp' \
  --exclude '*.rpgmvo' \
  --exclude '*.rpgmvm' \
  ./ "dist/FearHunger-AI-Companion-$version/"
tar -C dist -czf "dist/FearHunger-AI-Companion-$version.tar.gz" "FearHunger-AI-Companion-$version"
```

Windows zip from PowerShell:

```powershell
$version = Get-Content VERSION
New-Item -ItemType Directory -Force -Path "dist\FearHunger-AI-Companion-$version"
robocopy . "dist\FearHunger-AI-Companion-$version" /E /XD .git dist ai_companion_logs buglogs "plugin ideas" /XF *.rpgmvp *.rpgmvo *.rpgmvm
Compress-Archive -Path "dist\FearHunger-AI-Companion-$version" -DestinationPath "dist\FearHunger-AI-Companion-$version.zip" -Force
```

## Release Checklist

- `node --check plugins/AI_Companion.js`
- `node --check plugins/FearHungerKB.js`
- `git diff --check`
- Install into a clean Fear & Hunger copy.
- Verify title menu shows `AI Companion`, `AI Log`, and config scene.
- Verify chat opens with `C`.
- Verify one combat turn resolves.
- Verify autonomy can be enabled/disabled.
- Verify English and Spanish language modes.
- Verify no base game files are in the archive.

## GitHub Release Notes Template

```markdown
## FearHunger-AI-Companion vX.Y.Z-beta

### Highlights
- ...

### Install
- Download archive.
- Extract anywhere outside the game folder.
- Run `install.sh` on Linux/macOS/Git Bash or `install.bat` on Windows.

### Compatibility
- Fear & Hunger v1.4.x.
- RPG Maker MV / NW.js.
- Groq, OpenRouter, or local OpenAI-compatible server.

### Known Risks
- Combat still uses synchronous requests and may briefly pause the game.
- Local autonomy quality depends heavily on the local model.
- Some map event labels are curated for early maps first.
```
