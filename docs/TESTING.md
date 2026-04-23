# AI Companion — Testing Plan

> **Version:** Post-merge `develop` (all Phase 1 branches)
> **Date:** 2026-04-23
> **Plugin:** `AI_Companion.js` (~6,250 lines)

This document provides step-by-step test cases for every feature added in the 6 merged branches. Each test has a **Pass/Fail** checkbox, expected behavior, and console verification commands.

---

## Pre-Test Setup

Before running any tests:

1. **Enable Debug Mode** — Open the AI Config menu in-game and toggle debug mode ON, or run in F12 console:
   ```javascript
   AI_Companion.Config.debugMode = true;
   ```

2. **Open F12 Console** — All systems log to the browser console with `[ModuleName]` prefixes.

3. **Verify Plugin Loaded** — Run in console:
   ```javascript
   typeof AI_Companion !== 'undefined' && 
   typeof AI_Companion.WorldStateEngine !== 'undefined' &&
   typeof AI_Companion.NPCIntelligence !== 'undefined' &&
   typeof AI_Companion.EnvironmentScanner !== 'undefined'
   ```
   **Expected:** `true`

4. **Verify API connectivity** — Ensure your provider (Groq/OpenRouter/Local) is configured and reachable. Test with a quick chat message.

---

## Branch 1: ThesisLogger (Telemetry)

### T1.1 — Log File Creation
- [ ] **Steps:** Launch game, wait 10 seconds, close game.
- [ ] **Verify:** File `ai_companion_thesis.jsonl` exists in game root directory (next to `Game.exe` or `nw`).
- [ ] **Console check:** No `[ThesisLogger] Error` messages in F12.

### T1.2 — Chat Logging
- [ ] **Steps:** Open chat (C key), send a message like "¿qué es esto?", wait for response.
- [ ] **Verify:** Open the `.jsonl` file and find an entry with:
  ```json
  { "event_type": "chat", "data": { "player_message": "¿qué es esto?", "response_text": "...", "latency_ms": ... } }
  ```
- [ ] **Check fields present:** `player_message`, `intent`, `prompt_length`, `response_text`, `response_source`, `latency_ms`, `model_used`

### T1.3 — Combat Decision Logging
- [ ] **Steps:** Enter a battle, let the companion take a turn.
- [ ] **Verify:** `.jsonl` has an entry with `"event_type": "combat_decision"` containing `action`, `target`, `reasoning`, `latency_ms`.

### T1.4 — Game Event Logging (Map Transfer)
- [ ] **Steps:** Walk through a door to change maps.
- [ ] **Verify:** `.jsonl` has `"event_type": "game_event"` with `"event": "map_transfer"`, `map_name`, `map_id`.

### T1.5 — Game Event Logging (Battle Start/End)
- [ ] **Steps:** Start a battle, win or flee.
- [ ] **Verify:** `.jsonl` has entries for battle start and battle end events.

### T1.6 — Session ID Consistency
- [ ] **Steps:** Send 3 chat messages, then check the log file.
- [ ] **Verify:** All entries from the same game session share the same `session_id` value.

### T1.7 — Deduplication
- [ ] **Steps:** In console, run:
  ```javascript
  AI_Companion.ThesisLogger.log('test', { msg: 'dupe' });
  AI_Companion.ThesisLogger.log('test', { msg: 'dupe' });
  ```
- [ ] **Verify:** Only ONE entry appears in the log file (within 50ms, second is skipped).

---

## Branch 2: EnvironmentScanner (Spatial Awareness)

### T2.1 — Basic Scan
- [ ] **Steps:** Stand near visible map events (chests, doors, etc.). In console:
  ```javascript
  AI_Companion.EnvironmentScanner.scan()
  ```
- [ ] **Verify:** Returns an array of objects with `name`, `type`, `danger`, `distance`, `x`, `y`.

### T2.2 — Summary Text
- [ ] **Steps:** In console:
  ```javascript
  AI_Companion.EnvironmentScanner.getSummary()
  ```
- [ ] **Verify:** Returns a compact string like `"Chest (3 tiles), Door (5 tiles)"` or empty string if nothing nearby.

### T2.3 — Trap Detection
- [ ] **Steps:** Navigate to an area with bear traps (e.g., early dungeon floors with `!Other1` sprites).
- [ ] **Verify:** `scan()` returns an entry with `type: "trap"` and `danger: "high"`.

### T2.4 — Prompt Injection
- [ ] **Steps:** Stand near objects, open chat, send any message.
- [ ] **Verify:** In F12 console, look for the chat prompt log. It should contain:
  ```
  NEARBY (you can see): [objects listed]
  ```

### T2.5 — Proactive Warning
- [ ] **Steps:** Walk within **2 tiles** of a trap or enemy event. Wait ~10 seconds.
- [ ] **Verify:** The companion may proactively warn you (ambient dialogue trigger). Check console for `[AmbientDialogue] Nearby threat`.
- [ ] **Note:** This depends on the `DialogueGovernor` cooldown. If cooldown is active, the warning won't fire. You can reset it:
  ```javascript
  AI_Companion.DialogueGovernor._lastDialogueTime = 0;
  ```

### T2.6 — Cache Performance
- [ ] **Steps:** In console:
  ```javascript
  console.time('scan'); AI_Companion.EnvironmentScanner.scan(); console.timeEnd('scan');
  console.time('scan2'); AI_Companion.EnvironmentScanner.scan(); console.timeEnd('scan2');
  ```
- [ ] **Verify:** Second call should be significantly faster (cached, < 1ms).

### T2.7 — 6-Tile Radius Boundary
- [ ] **Steps:** Place yourself far from all events (open area). Run `scan()`.
- [ ] **Verify:** Returns empty array `[]`. Walk toward an event until within 6 tiles and re-scan.

---

## Branch 3: Combat Logic (Multi-turn Strategy)

### T3.1 — Strategy Generation
- [ ] **Steps:** Enter battle against a multi-limb enemy (Guard, Skeleton, etc.). Let the companion act.
- [ ] **Verify:** In console, after the turn:
  ```javascript
  AI_Companion.AIState.currentStrategy
  ```
  **Expected:** Either `null` (model didn't generate one) or an object `{ plan: "...", turnsRemaining: 3, startTurn: N }`.

### T3.2 — Strategy Persistence Across Turns
- [ ] **Steps:** If T3.1 produced a strategy, let the battle continue for 2-3 more turns.
- [ ] **Verify:** Check `AIState.currentStrategy` each turn. `turnsRemaining` should decrement. The debug log should show:
  ```
  [Combat] Injecting strategy into prompt: ...
  ```

### T3.3 — Strategy Cleared on Victory
- [ ] **Steps:** Win a battle where a strategy was active.
- [ ] **Verify:**
  ```javascript
  AI_Companion.AIState.currentStrategy // Should be null
  ```

### T3.4 — Strategy Cleared on Escape
- [ ] **Steps:** Flee from a battle where a strategy was active.
- [ ] **Verify:** `AIState.currentStrategy` is `null`.

### T3.5 — Strategy TTL Expiry
- [ ] **Steps:** If a strategy is generated, wait 3+ turns without the AI updating it.
- [ ] **Verify:** After 3 turns, `turnsRemaining` hits 0 and strategy is cleared.

### T3.6 — Retry Validation (AVAILABLE_ACTIONS)
- [ ] **Steps:** This is hard to trigger naturally. To force it, in console before a battle:
  ```javascript
  AI_Companion.Config.debugMode = true;
  ```
  Then watch for `[Combat] Retry` messages during battle. If the AI makes an invalid choice, the retry prompt should include `AVAILABLE_ACTIONS` and `VALID_TARGETS` lists.
- [ ] **Verify:** Console shows explicit action and target lists in retry context.

### T3.7 — Regression: Normal Combat Still Works
- [ ] **Steps:** Fight 3 different enemies. Companion should act normally each turn.
- [ ] **Verify:** No `undefined` errors, no frozen turns, no empty actions. Combat flow is identical to pre-merge behavior.

---

## Branch 5: IntentDetector (LLM Fallback + Confidence)

### T5.1 — High Confidence (Exact Match)
- [ ] **Steps:** Open chat, type: `"qué es el frasco azul"` (asking about Blue Vial)
- [ ] **Verify:** In console, intent log shows:
  ```
  [Chat] Intent: { primary: "item_info", confidence: 0.95, ... }
  ```
  Confidence should be ≥ 0.8 with entities resolved.

### T5.2 — Low Confidence (Generic Query → LLM Fallback)
- [ ] **Steps:** Open chat, type something vague/unusual: `"oye qué onda"` or `"esto es raro"`
- [ ] **Verify:** Console shows:
  ```
  [IntentDetector] Regex confidence too low (0.3), trying LLM fallback...
  [IntentDetector] LLM classified as: [some_intent]
  ```
  Final confidence should be ~0.75 (boosted by LLM).

### T5.3 — LLM Fallback Timeout
- [ ] **Steps:** Disconnect internet / use invalid API key, then send a vague message.
- [ ] **Verify:** Console shows:
  ```
  [IntentDetector] LLM fallback failed: ...
  ```
  The system falls back to the regex result. Chat still responds (no hang). Response should arrive within 3-4 seconds max.

### T5.4 — Intent Cache Hit
- [ ] **Steps:** Send the same vague message twice within 5 minutes.
- [ ] **Verify:** Second time, console shows:
  ```
  [IntentDetector] Cache hit for: [message]
  ```
  No LLM call is made.

### T5.5 — Cache Expiry
- [ ] **Steps:** Send a message, wait 5+ minutes, send the same message.
- [ ] **Verify:** The cache entry expires and the LLM fallback is called again (if confidence is low).
- [ ] **Shortcut:** Force expiry:
  ```javascript
  AI_Companion.IntentDetector._cache.clear();
  ```

### T5.6 — Battle Context Override
- [ ] **Steps:** Open chat DURING a battle, type anything.
- [ ] **Verify:** Intent should include `tactical` type with confidence ≥ 0.9 regardless of message content.

### T5.7 — Regression: Known Intents Still Work
Test each intent type still resolves correctly:

| Message | Expected Primary Intent |
|---------|------------------------|
| `"qué es la hierba verde"` | `item_info` |
| `"cómo mato al guardia"` | `tactical` |
| `"dónde estamos"` | `location` |
| `"cuéntame sobre este lugar"` | `lore` |
| `"cómo te sientes"` | `emotional` |
| `"tengo veneno"` | `status_help` |
| `"qué fue la última pelea"` | `recent_battle` |

- [ ] All 7 intents resolve correctly with confidence ≥ 0.8.

---

## Branch 6: WorldStateEngine

### T6.1 — Basic Snapshot
- [ ] **Steps:** In console:
  ```javascript
  JSON.stringify(AI_Companion.WorldStateEngine.getSnapshot(), null, 2)
  ```
- [ ] **Verify:** Returns object with: `party`, `resources`, `environment`, `threats`, `morale`, `situation`.

### T6.2 — Party State Accuracy
- [ ] **Steps:** Check party HP in-game menu. Compare with:
  ```javascript
  AI_Companion.WorldStateEngine.getSnapshot().party
  ```
- [ ] **Verify:** `avg_hp_pct` roughly matches actual party HP average. `size` matches party count. `dead` count is correct.

### T6.3 — Resource Counting
- [ ] **Steps:** Check inventory. Count healing items and food manually. Compare with:
  ```javascript
  AI_Companion.WorldStateEngine.getSnapshot().resources
  ```
- [ ] **Verify:** `healing` and `food` counts match your manual count.

### T6.4 — Situation Rating Changes
- [ ] **Steps:**
  1. Full HP, items stocked → check situation (should be `stable` or `cautious`)
  2. Get into fights, take damage, use items → check situation (should escalate)
  3. Get a party member killed → check situation (should be `dire` or `critical`)
- [ ] **Verify:** Situation rating responds to game state changes.

### T6.5 — Prompt Injection
- [ ] **Steps:** When situation is NOT stable, open chat and send a message.
- [ ] **Verify:** Console prompt log contains `SITUATION: ⚠ ...` line.

### T6.6 — Tone Adaptation
- [ ] **Steps:** Get the party into a critical situation (low HP, no items, recent death). Chat with companion.
- [ ] **Verify:** AI response tone is more urgent/tense compared to stable situations. The prompt ends with `Your tone and urgency should match the SITUATION level`.

### T6.7 — Stable = No Injection (Token Savings)
- [ ] **Steps:** At full HP with resources, send a chat message.
- [ ] **Verify:** The prompt does NOT contain a `SITUATION:` line (empty string returned by `getWorldSummary()`).

### T6.8 — Map Transfer Tracking
- [ ] **Steps:** Enter 3 different maps. Then:
  ```javascript
  AI_Companion.WorldStateEngine._visitedMaps
  ```
- [ ] **Verify:** Set contains 3 map IDs. `getSnapshot().environment.has_been_here_before` is `true` for revisited maps.

### T6.9 — Cache Behavior
- [ ] **Steps:**
  ```javascript
  // First call computes fresh
  console.time('fresh'); AI_Companion.WorldStateEngine.getSnapshot(); console.timeEnd('fresh');
  // Second call within 5s returns cache
  console.time('cached'); AI_Companion.WorldStateEngine.getSnapshot(); console.timeEnd('cached');
  ```
- [ ] **Verify:** Cached call is near-instant (< 1ms).

### T6.10 — Telemetry Snapshot
- [ ] **Steps:**
  ```javascript
  AI_Companion.WorldStateEngine.getWorldSnapshotForLog()
  ```
- [ ] **Verify:** Returns flat object with: `situation`, `party_size`, `party_avg_hp`, `healing_items`, `food_items`, `threat_level`, `morale`, `sanity_pct`, `hunger`, `map`, `in_battle`, `maps_visited`.

---

## Branch 7: NPCIntelligence

### T7.1 — Face Sprite Identification
- [ ] **Steps:** Talk to a known NPC that has a face sprite (D'arce, Cahara, Enki, etc.).
- [ ] **Verify:** Console shows:
  ```
  [NPCIntelligence] D'arce spoke: "..."
  ```

### T7.2 — Event Name Identification
- [ ] **Steps:** Talk to an NPC event named "Guard" or similar in the event editor.
- [ ] **Verify:** Console shows the NPC identified by event name pattern.

### T7.3 — Narrator Exclusion
- [ ] **Steps:** Trigger narration text (no face sprite, system text).
- [ ] **Verify:** Console does NOT log `[NPCIntelligence]` for narrator text. `getAllEncounters()` does not include "Narrator".

### T7.4 — Dialogue Buffer
- [ ] **Steps:** Talk to 6+ different NPCs in sequence.
- [ ] **Verify:**
  ```javascript
  AI_Companion.NPCIntelligence._recentDialogue.length // Should be ≤ 5
  ```
  Oldest dialogue was evicted.

### T7.5 — Encounter Tracking
- [ ] **Steps:** Talk to the same NPC 3 times.
- [ ] **Verify:**
  ```javascript
  AI_Companion.NPCIntelligence.getEncounterInfo("NPC_NAME")
  // { count: 3, lastSeen: ..., lastMap: "..." }
  ```

### T7.6 — STM Integration
- [ ] **Steps:** Talk to an NPC, then check:
  ```javascript
  AI_Companion.ShortTermMemory.getRecentEvents()
  ```
- [ ] **Verify:** Contains an event like `"D'arce spoke to the party."`.

### T7.7 — Prompt Injection
- [ ] **Steps:** Talk to an NPC, then immediately open chat and send any message.
- [ ] **Verify:** Console prompt log contains:
  ```
  DIÁLOGOS RECIENTES DE NPCs:
  NPC_NAME: "dialogue text..."
  ```

### T7.8 — Dialogue Cleared on Map Transfer
- [ ] **Steps:** Talk to NPC, change maps, then:
  ```javascript
  AI_Companion.NPCIntelligence._recentDialogue // Should be empty []
  ```

### T7.9 — Deduplication (Multi-line Text)
- [ ] **Steps:** Talk to an NPC that has a long dialogue (multiple text boxes in sequence).
- [ ] **Verify:** Only ONE `[NPCIntelligence]` log per NPC per conversation, not one per text box.

### T7.10 — Hook Safety (Game Dialogue Unbroken)
- [ ] **Steps:** Talk to every NPC you can find. Trigger choices, scrolling text, input number events.
- [ ] **Verify:** ALL game dialogue works exactly as before. No visual glitches, no missing text, no frozen events. The hook must be invisible to the player.

---

## Cross-System Integration Tests

### X1 — Full Chat Pipeline
- [ ] **Steps:** Get into a tense situation (low HP, recently fought, NPC just spoke). Open chat and ask something.
- [ ] **Verify:** The prompt contains ALL of:
  - `NEARBY (you can see): ...` (Branch 2)
  - `SITUATION: ⚠ ...` (Branch 6)
  - `DIÁLOGOS RECIENTES DE NPCs: ...` (Branch 7)
  - Correct intent classification (Branch 5)
- [ ] **Verify:** ThesisLogger recorded the full interaction (Branch 1).

### X2 — Combat with All Systems Active
- [ ] **Steps:** Enter a battle near traps. Companion should:
  1. Make a combat decision with strategy planning (Branch 3)
  2. Have spatial awareness in the combat prompt (Branch 2)
  3. Log the decision to thesis file (Branch 1)
- [ ] **Verify:** No errors, turn executes normally.

### X3 — Rapid Map Transitions
- [ ] **Steps:** Quickly walk through 5+ doors in succession.
- [ ] **Verify:**
  - WorldStateEngine resets cache on each transfer (Branch 6)
  - NPCIntelligence clears dialogue (Branch 7)
  - ThesisLogger records all map transfers (Branch 1)
  - No console errors, no performance drops

### X4 — Long Session Stability
- [ ] **Steps:** Play for 15-20 minutes normally. Chat, fight, explore.
- [ ] **Verify:**
  - No memory leaks (check browser memory in F12 → Performance tab)
  - Intent cache doesn't grow beyond 50 entries (Branch 5)
  - NPC encounter Map doesn't cause issues
  - Thesis log file continues writing
  - WorldStateEngine snapshots stay current

### X5 — API Failure Resilience
- [ ] **Steps:** Set an invalid API key, then:
  1. Try chatting → should get KB fallback response
  2. Enter battle → combat should still function (sync XHR fallback)
  3. Send vague message → intent LLM fallback should timeout and fall back to regex
- [ ] **Verify:** Game never freezes, never crashes, always has some response.

---

## Regression Tests

These verify pre-existing functionality hasn't broken.

### R1 — Basic Chat
- [ ] C key opens chat window
- [ ] Can type and send messages
- [ ] Companion responds in the correct language
- [ ] Chat history persists within session
- [ ] ESC closes chat
- [ ] Chat works both on map and in battle

### R2 — Combat AI
- [ ] Companion makes valid combat decisions
- [ ] Actions execute correctly (attack, guard, skill, item)
- [ ] Limb targeting works on multi-limb enemies
- [ ] Coin flip warnings appear for relevant enemies
- [ ] Combat doesn't freeze or hang

### R3 — Ambient Dialogue
- [ ] Companion comments on room entry
- [ ] Companion reacts to item pickups
- [ ] Companion reacts to party joins
- [ ] Hunger warnings appear at appropriate levels
- [ ] DialogueGovernor cooldowns are respected

### R4 — Configuration Menu
- [ ] AI Config menu opens from main menu
- [ ] Name change works
- [ ] Appearance cycling works
- [ ] Personality cycling works
- [ ] Class cycling works
- [ ] Language toggle works
- [ ] Provider cycling works

### R5 — KB Fallback
- [ ] When API is unavailable, chat gives KB-sourced answers
- [ ] Item info queries return correct data from FearHungerKB
- [ ] Enemy info queries return correct data from FearHungerKB

### R6 — Sanity System
- [ ] SanityManager returns correct level based on companion MP
- [ ] Sanity modifier changes dialogue tone
- [ ] Hard anchors prevent breaking behavior at any sanity level

### R7 — Relationship Tracker
- [ ] Trust changes on conversations
- [ ] Relationship level summary appears in prompt

---

## Performance Benchmarks

Run these in F12 console and note the times:

```javascript
// EnvironmentScanner (first call vs cached)
console.time('scan_fresh'); AI_Companion.EnvironmentScanner._cacheTime = 0; AI_Companion.EnvironmentScanner.scan(); console.timeEnd('scan_fresh');
console.time('scan_cached'); AI_Companion.EnvironmentScanner.scan(); console.timeEnd('scan_cached');

// WorldStateEngine (first call vs cached)
console.time('world_fresh'); AI_Companion.WorldStateEngine._lastSnapshotTime = 0; AI_Companion.WorldStateEngine.getSnapshot(); console.timeEnd('world_fresh');
console.time('world_cached'); AI_Companion.WorldStateEngine.getSnapshot(); console.timeEnd('world_cached');

// IntentDetector (regex only)
console.time('intent'); AI_Companion.IntentDetector.classify('qué es el frasco azul'); console.timeEnd('intent');
```

**Acceptable thresholds:**
| Operation | Fresh | Cached |
|-----------|-------|--------|
| EnvironmentScanner.scan() | < 5ms | < 1ms |
| WorldStateEngine.getSnapshot() | < 10ms | < 1ms |
| IntentDetector.classify() | < 2ms | N/A |

---

## Test Result Template

Copy this for your notes:

```
Date: ____
Build: develop @ commit ____
Provider: Groq / OpenRouter / Local
Model: ____

Branch 1 (Telemetry):     T1.1[ ] T1.2[ ] T1.3[ ] T1.4[ ] T1.5[ ] T1.6[ ] T1.7[ ]
Branch 2 (Spatial):        T2.1[ ] T2.2[ ] T2.3[ ] T2.4[ ] T2.5[ ] T2.6[ ] T2.7[ ]
Branch 3 (Combat):         T3.1[ ] T3.2[ ] T3.3[ ] T3.4[ ] T3.5[ ] T3.6[ ] T3.7[ ]
Branch 5 (Intent):         T5.1[ ] T5.2[ ] T5.3[ ] T5.4[ ] T5.5[ ] T5.6[ ] T5.7[ ]
Branch 6 (WorldState):     T6.1[ ] T6.2[ ] T6.3[ ] T6.4[ ] T6.5[ ] T6.6[ ] T6.7[ ] T6.8[ ] T6.9[ ] T6.10[ ]
Branch 7 (NPC):            T7.1[ ] T7.2[ ] T7.3[ ] T7.4[ ] T7.5[ ] T7.6[ ] T7.7[ ] T7.8[ ] T7.9[ ] T7.10[ ]
Integration:               X1[ ] X2[ ] X3[ ] X4[ ] X5[ ]
Regression:                R1[ ] R2[ ] R3[ ] R4[ ] R5[ ] R6[ ] R7[ ]

Notes / Bugs Found:
-
-
-
```
