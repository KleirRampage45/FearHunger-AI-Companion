# Map Event Naming Notes

The autonomy/perception scanner should not expose raw RPG Maker event names such as `EV034`, `chest1_2`, or `door22` to the AI. The plugin uses a curated registry for early maps plus generic heuristics for the rest of the game.

## Current Curated Coverage

High-confidence curated maps:

- `1` / `51`: Level 1 entrance variants.
- `3`: Level 1 interior hallway/prison approach.
- `4` / `128`: Courtyard variants.
- `5`: Blood pit.
- `6`: Level 3 prisons.
- `8`: Caves.
- `11`: Mines.
- `74`: entrance/dead horse/merchant variant.

## Label Rules

- Labels must be player-facing nouns, not event IDs.
- Labels must support Spanish and English through `_localizeLabel`.
- If uncertain, prefer generic type labels such as `Container`, `Door`, `Hazard`, or `Corpse`.
- Do not mark an event as an enemy unless it is visible or reliably starts combat.
- Do not mark story-critical/risky events as safe containers.
- Doors/transfers should be labeled as `Door`, `Exit`, `Cell door`, or a known special door.
- Repeated decorative corpses can be `Corpse`, `Hanging corpse`, or `Corpse pile`.

## Testing A New Map

1. Enter the map in game.
2. Enable autonomy and debug logs.
3. Stand near objects.
4. Open `AI Log`.
5. Confirm `nearby` detail lines show readable labels.
6. Ask chat:

   ```text
   ¿Qué ves cerca?
   ```

   or in English:

   ```text
   What do you see nearby?
   ```

7. Verify it does not say raw event names like `EV001`, `chest1_2`, `cavegnome1`, or `door22`.

## Adding More Entries

Entries live in `EnvironmentScanner._buildCuratedEventRegistry()`.

Use:

```javascript
add(mapId, [eventIds], type, subtype, 'Spanish label', { danger: 'medium' });
```

The Spanish label is translated by `_localizeLabel` when `Config.language === 'en'`.

Safe types:

- `door`
- `container`
- `npc`
- `enemy`
- `trap`
- `hazard`
- `obstruction`
- `corpse`
- `shop`

Common subtypes:

- `transfer`
- `door`
- `cell_door`
- `chest`
- `crate`
- `barrel`
- `bookshelf`
- `furniture_loot`
- `light_source`
- `corpse_pile`
- `hanging_body`
- `mechanism`
- `well`

## Do Not Commit Source Map Data

It is acceptable to inspect a local legal game install while developing labels. It is not acceptable to copy `www/data/Map*.json` into this repository.
