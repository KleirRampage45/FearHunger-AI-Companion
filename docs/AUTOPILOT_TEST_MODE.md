# Autopilot Test Mode

Autopilot is a disabled-by-default LLM-driven test mode for evaluating whether the mod can control the party without player input.

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

## Thesis-Safe Control Boundary

- The LLM chooses every new map goal: hold, move to event, interact, or move to a frontier.
- The LLM chooses every autopilot battle turn.
- The LLM chooses dialogue, item, number, and coin-flip UI prompt responses.
- Local code may scan visible game state, validate that the chosen target is listed/reachable, execute movement/pathing, press confirmation for already-selected UI options, and stop/hold on invalid or missing model responses.
- Local code must not replace a failed or invalid LLM decision with a deterministic progress goal.

## What It Can Do In This Slice

- Move the player toward LLM-selected containers, doors, NPCs, and frontier tiles.
- Interact using the real player event trigger path after the LLM selected the goal.
- Hold instead of inventing a fallback goal when the local model is unavailable, busy, or returns invalid JSON.
- Ask the LLM how to handle coin-flip UI prompts, including whether Lucky Coin spending is worth it.
- Ask the LLM for battle actions for player-controlled actors.
- Stop automatically if it detects a movement loop or exceeds the max runtime.
- Log each goal/action as `_type: "autopilot_tick"` in `ai_companion_logs`.

## What It Does Not Do Yet

- It does not yet know an objective graph like "reach prisons, talk to Buckman, rescue Le'garde".
- It does not yet reliably solve complex dialogue trees or merchant/shop choices.
- It does not yet optimize long combat plans beyond the prompt/context supplied each turn.

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
   - LLM raw responses for `autopilot_goal`, `autopilot_battle`, and `autopilot_ui`.
   - Coin-flip UI logs such as `COIN_FLIP_CHOICE`; movement should pause while the prompt is open and the final choice should come from `autopilot_ui`.
   - FPS/performance stalls.

## Success Criteria For This Branch

- It can move and interact without player input.
- It does not press through player-owned dialogs without an LLM UI decision.
- It does not loop on the same tile/event indefinitely.
- It should avoid immediately reversing through the door it just used after a map transfer.
- In autopilot mode, companion autonomy is suspended so the player autopilot is the single owner of map progression.
- If it lands in a dead-end entrance with no reachable targets, it should ask the LLM what to do next rather than coded backtracking.
- It should not repeatedly re-read or re-search the same loot/book event in the same run.
- It can survive simple fights without waiting for user input.
- Logs are detailed enough to explain why it failed.
