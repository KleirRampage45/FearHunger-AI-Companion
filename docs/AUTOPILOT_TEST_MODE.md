# Autopilot Test Mode

Autopilot is a disabled-by-default test harness for evaluating whether the mod can control the party without player input.

It is not the normal companion autonomy mode. It temporarily controls the player leader on the map and also chooses basic battle actions for non-companion actors.

## Enable

In the NW.js DevTools console:

```js
AI_Companion.Config.setAutopilotEnabled(true)
AI_Companion.Config.setAutopilotTickSeconds(3)
AI_Companion.Config.setAutopilotMaxRuntimeMinutes(20)
```

Disable:

```js
AI_Companion.Config.setAutopilotEnabled(false)
```

## What It Can Do In This First Slice

- Move the player toward nearby containers, doors, NPCs, and frontier tiles.
- Interact using the real player event trigger path.
- Avoid nearby enemies using safe-tile search.
- Handle coin-flip UI prompts deliberately: pause movement, conserve Lucky Coin for high-risk prompts unless supplies are low or extra coins remain, then choose heads/tails or cara/cruz.
- Auto-pick conservative battle actions for player-controlled actors.
- Stop automatically if it detects a movement loop or exceeds the max runtime.
- Log each goal/action as `_type: "autopilot_tick"` in `ai_companion_logs`.

## What It Does Not Do Yet

- It does not yet use an LLM for long-horizon story planning.
- It does not yet know an objective graph like "reach prisons, talk to Buckman, rescue Le'garde".
- It does not yet solve complex dialogue trees or merchant/shop choices.
- It does not yet optimize combat beyond basic attack targeting.

## Test Protocol

1. Start from a clean save or safe room.
2. Enable autopilot from the console.
3. Do not touch movement keys for 5-10 minutes unless it softlocks or risks an unwanted irreversible choice.
4. After the run, inspect the newest `ai_companion_logs/session_*.jsonl`.
5. Check for:
   - `autopilot_tick` count and action variety.
   - Map transfers reached.
   - Repeated target loops.
   - Combat decisions and deaths.
   - Coin-flip UI logs such as `COIN_FLIP_CHOICE`; movement should pause while the prompt is open.
   - FPS/performance stalls.

## Success Criteria For This Branch

- It can move and interact without player input.
- It does not press through player-owned dialogs.
- It does not loop on the same tile/event indefinitely.
- It can survive simple fights without waiting for user input.
- Logs are detailed enough to explain why it failed.
