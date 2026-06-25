# English/Spanish Regression Plan

This plan verifies that Spanish-specific work did not break English mode, while preserving Spanish behavior.

## Static Check

Run:

```bash
node scripts/check_plugin_static.js
node --check plugins/AI_Companion.js
node --check plugins/FearHungerKB.js
git diff --check
```

Pass:

- Static checker prints `OK`.
- Both plugin files pass syntax checks.
- No whitespace errors.

## English Mode Smoke Test

1. Open `AI Companion` from title.
2. Set `Language: English`.
3. Confirm title/menu labels are English:
   - `AI Companion`
   - `AI Log`
   - `Custom persona`
   - `Chat model`
   - `Autonomy`
4. Start/load a save.
5. Stand near a door/container.
6. Open chat with `C`.
7. Ask:

   ```text
   What do you see nearby?
   ```

Pass:

- Response uses English.
- Nearby labels are English (`Door`, `Crate`, `Barrel`, `Chest`, `Merchant`) when applicable.
- It does not say `Puerta`, `Caja`, `Barril`, `Mercader` in English mode unless quoting Spanish game text.

## Spanish Mode Smoke Test

1. Set `Language: Español`.
2. Start/load the same area.
3. Ask:

   ```text
   ¿Qué ves cerca?
   ```

Pass:

- Response uses Spanish.
- Nearby labels are Spanish (`Puerta`, `Caja`, `Barril`, `Cofre`, `Mercader`) when applicable.

## Combat Regression

English:

1. Set language English.
2. Enter a guard fight.
3. Let the companion act.

Pass:

- No `TypeError`.
- No `limb not found torso` warning unless the enemy truly lacks the requested limb and fallback resolves it.
- Action is not stuck on repeated defend unless tactical reasons say so.

Spanish:

1. Set language Spanish.
2. Repeat a guard fight.

Pass:

- Combat still parses Spanish action/limb names.
- It targets the limb it claims to target.

## Autonomy Regression

1. Enable autonomy.
2. Use local model.
3. Stand in an early map room with a door/container/light source.
4. Open `AI Log`.
5. Let one or two autonomy ticks happen.

Pass:

- `AI Log` shows `AUTO` entries.
- Enter opens detail view.
- Detail view shows action, event id, source, reason, and nearby labels.
- English mode details use English labels; Spanish mode details use Spanish labels.

## Hardcoded Line Regression

1. Disable/unload model or enable mock mode.
2. Pick up an item, enter a room, or win a battle.

Pass:

- No canned roleplay flavor line is spoken for non-critical ambient events.
- Consent/support/equipment UI prompts still appear when needed.

## Story Memory Regression

1. Talk to an NPC.
2. Gain an item.
3. Transfer maps.
4. Save and reload.
5. Ask:

English:

```text
What do you remember about what we have done?
```

Spanish:

```text
¿Qué recuerdas de lo que hemos hecho?
```

Pass:

- It recalls observed events from the save.
- It does not invent unrelated progression.
- It respects selected language.
