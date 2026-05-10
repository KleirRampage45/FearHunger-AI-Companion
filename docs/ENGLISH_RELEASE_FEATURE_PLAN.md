# English Release Feature Plan

Branch: `feat/reapply-lost-features-safe`

Baseline: `21962ee fix(i18n): localize English chat context`

Known-good fallback branch: `feat/english-version-regression-test`

## Guiding Rules

- Do not change heartbeat timing, local request gating, or autonomy retry behavior in this branch until the English release work is stable.
- Reapply lost features in small commits, with one testable change per commit.
- Prefer compatibility layers over replacing Spanish behavior, so the same plugin can run on Spanish and English installs.
- Avoid hardcoded character names, player names, model names, and item names in prompts or UI defaults.
- Keep the repo shippable as a mod package only: plugins, docs, installer scripts, and optional custom assets. Do not ship base game assets.

## English Install Question

A fresh English original copy helps, but it does not make the English work unnecessary.

What an English copy fixes:

- Runtime database names for items, actors, states, skills, and commands are more likely to be English.
- Some logs and prompt context will naturally contain English names instead of Spanish database strings.
- Fewer translations are needed for live inventory/equipment/status text.

What it does not fix:

- `AI_Companion.js` currently defaults to `es`.
- Several fallbacks, UI labels, docs, tests, and prompt examples are Spanish-first.
- Combat uses RPG Maker command names such as `Atacar`/`Defenderse`; an English database may use different names.
- KB entries are bilingual but not fully normalized around stable IDs.
- Some object classification relies on Spanish and English keyword matching rather than stable map event metadata.
- Marcoh/Mark/asset defaults are still embedded in config and docs.
- Existing custom assets such as Marcoh faces are mod assets and need optional import instructions, not assumptions.

Decision: use a fresh English install as the primary release test target, but keep bilingual compatibility in code.

## Feature 1: English Runtime Compatibility

Goal: the plugin should run correctly on a clean English install without requiring Spanish database names.

Checklist:

- Change first-run default language to English, while preserving existing user `localStorage` choice.
- Add a database command resolver for attack, guard, skills, and item actions instead of hardcoding `Atacar` and `Defenderse`.
- Normalize combat output so the LLM can say `Attack`/`Defend`, then map to the actual RPG Maker command in the installed game.
- Audit all fallback combat lines for English output when `Config.language !== 'es'`.
- Add startup logging that records language, game database language hints, and selected command labels.
- Test in current Spanish install and a clean English install.

Do not change:

- Autonomy heartbeat timing.
- Local LM Studio request logic.
- Goal selection cadence.

## Feature 2: Localization Cleanup

Goal: no Spanish leaks in English mode unless the game database itself provides a Spanish proper noun.

Checklist:

- Move remaining bilingual fallback text behind `Locale` helpers or explicit `Config.language` checks.
- Add `Locale.text()` coverage for common states, items, skills, equipment slots, commands, UI labels, and status prompts.
- Replace Spanish prompt examples in docs/tests with bilingual examples.
- Add an English regression checklist for chat, combat, autonomy, merchant prompts, support prompts, and memory recall.
- Add log assertions or a static script for obvious Spanish leakage in English-only prompt sections.

## Feature 3: Safe Lost Feature Reapply

Goal: reintroduce useful lost features without reintroducing local/autonomy instability.

Candidate features to reapply carefully:

- Chat stage-direction suppression from `f94bfd2`.
- Cleaner local telemetry from `df000ce`, but without shared cooldowns or request-gate rewrites.
- Token throughput logging from `1f0750d`, but only as passive logging.
- User-defined local model config from `7b0461b`, but do not route combat to local sync by default.
- Local chat fallback from `1337a2e`, behind an explicit toggle and disabled by default until tested.

Rules:

- Each reapply gets its own commit.
- No feature may alter heartbeat behavior unless its commit is explicitly about autonomy.
- Any local LLM feature must fail open: no frozen battle, no blocked chat, no endless retry loop.

## Feature 4: English Original Install Package

Goal: a clean user can install the mod into an English game copy without copying the whole game.

Checklist:

- Update `install.sh` and `install.bat` docs for English original paths.
- Document required plugin order.
- Document optional custom face/sprite import.
- Document how to use the default bundled companion assets versus importing a custom character.
- Confirm `.gitignore` excludes game saves, logs, local config, personal buglogs, copied game data, and private docs.
- Add a release checklist that verifies no base game assets are shipped.

## Feature 5: Config/Character Defaults

Goal: users can make their own companion without Marcoh/Mark assumptions leaking into English release behavior.

Checklist:

- Separate companion identity from appearance preset and class preset.
- Make first-run companion name editable.
- Make sprite/face/battler preset selectable.
- Make prompt personality/backstory/goals editable.
- Remove hardcoded personal names from prompts except through config.
- Keep existing Marcoh-like preset as one optional preset, not the only path.

## Feature 6: Grounded English QA

Goal: prove the English version works before adding bigger autonomy changes again.

Required tests:

- Start a new game in a clean English copy.
- Open chat and ask about nearby danger, inventory, status effects, and recent events.
- Enter combat and confirm no Spanish action labels leak into AI response logs.
- Fight an enemy with a known coin-flip limb condition and verify limb-state gating still works.
- Let autonomy interact with one safe object and verify it does not alter heartbeat behavior.
- Save, reload, and verify chat/story memory persists.
- Confirm logs are generated but ignored by git.

## Deferred Until After English Release

- Major autonomy planner changes.
- LM Studio/local-only combat.
- Shared local request scheduling.
- New heartbeat architecture.
- Autonomous movement revamp.

These caused the regression spiral and should return only after the English baseline is stable.

