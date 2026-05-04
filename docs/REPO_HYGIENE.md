# Repository Hygiene Policy

This repository must stay safe to publish. It should contain only original plugin code, docs, installers, and distributable companion assets.

## Allowed

- Plugin source under `plugins/`.
- Installer scripts.
- Documentation.
- Small generated metadata such as `VERSION` and `CHANGELOG.md`.
- Original/distributable companion face PNGs under `assets/faces/`.

## Not Allowed

- Full Fear & Hunger game folders.
- Base game `www/` data copied from an install.
- Save files.
- User conversation logs.
- `ai_companion_logs/` JSONL sessions.
- `buglogs/`.
- LM Studio logs.
- Private plugin examples.
- Screenshots or videos unless intentionally added to docs.
- Encrypted RPG Maker archives unless they are original, distributable mod assets.

## Before Committing

Run:

```bash
git status --short
git diff --check
git ls-files | rg 'rpgmvp|rpgmvo|rpgmvm|ai_companion_logs|buglogs|www/|Save|rpgsave|jsonl|plugin ideas'
```

Expected:

- `git diff --check` prints nothing.
- The `rg` scan should print nothing except intentionally tracked documentation mentioning these patterns.

## If Sensitive Files Were Added

If files are staged but not committed:

```bash
git restore --staged <path>
```

If files were committed but not pushed:

```bash
git rm --cached <path>
git commit --amend
```

If files were pushed, do not try to hide it with a normal delete commit. Rotate any exposed keys/log-sensitive data and use proper history cleanup.

## Asset Boundary

The plugin can document how to import custom sprites from a user's own game copy, but this repo should not distribute base game sprites or Fear & Hunger 2 assets. Custom companion assets should be optional and clearly separated under `assets/`.
