# Branch Testing Plans

This document lists practical tests for the separated feature branches built during the current beta cycle.

## `feat/story-goal-memory`

Purpose: persistent story/goal state tied to save data.

Test:

1. Start or load a save.
2. Transfer across maps, talk to Buckman, inspect prison/entrance areas, gain an item.
3. Save, close the game, relaunch, load the same save.
4. Ask chat:
   - `¿Qué recuerdas de lo que hemos hecho?`
   - `¿Cuál crees que es nuestro objetivo ahora?`
   - `¿Qué sabes de Buckman?`
5. Verify it recalls grounded milestones without claiming omniscience.
6. Check `ai_companion_logs/session_*.jsonl` for chat prompt entries containing `STORY GOALS AND PROGRESS`.

Pass:

- Memory survives save/load.
- Goals are cautious and inferred from observed events.
- It does not invent endgame route knowledge.

## `feat/character-creator-config`

Purpose: editable persona, provider/model/sampling config.

Test:

1. Open title menu `AI Companion`.
2. Toggle custom persona on.
3. Paste backstory, voice/style, goals, and behavior rules.
4. Change temperature/top_p/top_k.
5. Change local endpoint/model.
6. Start game and ask:
   - `¿Quién eres?`
   - `¿Qué quieres conseguir aquí?`
   - `¿Cómo sueles hablar?`
7. Enter one combat and verify combat dialogue uses the persona without breaking tactics.

Pass:

- Centered edit overlay is visible.
- Pasted text persists after closing/reopening config.
- The AI uses custom identity in chat and combat.
- No hardcoded player name appears.

## `feat/localization-audit`

Purpose: English mode should not receive Spanish-only scanner labels/fallback replies.

Test:

1. Set language to English.
2. Stand near a door, crate, barrel, chest, bed, or merchant.
3. Ask:
   - `What do you see nearby?`
   - `Any enemies nearby?`
   - `What was the last fight?`
4. Switch language to Spanish and repeat equivalent questions.

Pass:

- English mode says `Door`, `Crate`, `Barrel`, `Merchant`, etc.
- Spanish mode keeps `Puerta`, `Caja`, `Barril`, `Mercader`, etc.
- Fallback replies match selected language.

## `feat/autonomy-debug-cleanup`

Purpose: title-screen `AI Log` viewer and reduced console noise.

Test:

1. Launch game.
2. Transfer maps once.
3. Open title menu `AI Log`.
4. Verify a `map_transfer` or `EVENT` line appears.
5. Press Enter on the line.
6. Verify detail view opens.
7. Press Escape and verify it returns to the list.
8. Enable autonomy, let it make one decision, then reopen `AI Log`.

Pass:

- Enter opens details.
- Escape returns to the list, then exits.
- Autonomy entries include action, event id, source, and reason.
- Console no longer spams autonomy raw output unless debug mode is enabled.

## `fix/autonomy-comment-target-guard`

Purpose: prevent object/action mismatch in ambient comments.

Test:

1. Stand near a door/cell door.
2. Let autonomy choose `INTERACT`.
3. Watch ambient line and log.

Pass:

- Door comments do not mention lighting, candles, torches, or yesqueros.
- Light-source comments still mention lighting only for real light-source targets.

## `feat/release-packaging-docs`

Purpose: release-ready docs and packaging policy.

Test:

1. Run:

   ```bash
   node --check plugins/AI_Companion.js
   node --check plugins/FearHungerKB.js
   git diff --check
   ```

2. Read `docs/INSTALL.md`.
3. Read `docs/RELEASE.md`.
4. Build a release archive using the documented command.
5. Inspect archive contents.

Pass:

- Archive includes plugin/docs/install files.
- Archive excludes game files, saves, logs, and private notes.
- Version and changelog are present.

## `feat/english-version-regression-test`

Purpose: static and manual bilingual regression coverage.

Test:

1. Run:

   ```bash
   node scripts/check_plugin_static.js
   ```

2. Follow `docs/ENGLISH_REGRESSION.md`.

Pass:

- Static checker prints `OK`.
- English mode uses English labels and replies.
- Spanish mode keeps Spanish labels and replies.
- Combat, autonomy, story memory, and hardcoded-line cleanup still work in both modes.
