# AI Companion — System Documentation

> **Last updated:** 2026-04-23 · **Plugin size:** ~6,250 lines · **All systems merged into `develop`**

---

## Table of Contents

1. [Branch 1: ThesisLogger (Telemetry)](#1-thesislogger-telemetry)
2. [Branch 2: EnvironmentScanner (Spatial Awareness)](#2-environmentscanner-spatial-awareness)
3. [Branch 3: Combat Logic (Multi-turn Strategy)](#3-combat-logic-multi-turn-strategy)
4. [Branch 5: IntentDetector (LLM Fallback)](#5-intentdetector-llm-fallback)
5. [Branch 6: WorldStateEngine](#6-worldstateengine)
6. [Branch 7: NPCIntelligence](#7-npcintelligence)
7. [System Interaction Map](#system-interaction-map)
8. [Debug Console Reference](#debug-console-reference)
9. [Troubleshooting](#troubleshooting)

---

## 1. ThesisLogger (Telemetry)

**Branch:** `feat/telemetry` · **Lines:** ~998–1103 · **Module:** `ThesisLogger`

### Purpose
Persistent, asynchronous JSONL logger for research-grade data collection. Records every AI interaction (chat, combat, ambient dialogue) with full context for thesis analysis.

### How It Works
- Uses Node.js `fs.appendFile` (available in NW.js) for non-blocking writes
- Each log entry is a single JSON line appended to `ai_companion_thesis.jsonl`
- File location: game root directory (next to `Game.exe`)
- Gracefully degrades if `fs` is unavailable (browser context)

### What Gets Logged

| Event Type | Data Captured |
|------------|---------------|
| `chat` | Player message, intent classification, prompt text, response, latency, model used |
| `combat_decision` | Battle state, prompt, decision (action/target/limb), reasoning, latency, model |
| `ambient_dialogue` | Trigger type, companion response, context |
| `game_event` | Battle start/end, map transfers, item pickups |
| `config_change` | Setting changed, old/new value |

### Key Implementation Details
```javascript
ThesisLogger.log(eventType, dataObject)
```
- **Async, fire-and-forget** — never blocks the game loop
- **Dedup guard** — identical events within 50ms are skipped
- **Session ID** — generated on game boot, groups all entries for one play session
- Each entry includes: `timestamp`, `session_id`, `event_type`, `data`

### Hooks
- `ChatSystem.sendMessage()` → logs chat interactions
- `GeminiAPIHandler.getDecisionSync()` → logs combat decisions
- `AmbientDialogue` triggers → logs ambient responses
- `BattleManager.processVictory/Escape` → logs battle outcomes
- `Game_Player.performTransfer` → logs map changes

### If Issues Occur
- **File not created:** Check NW.js has write permissions. Look for `[ThesisLogger]` in F12 console.
- **Performance:** `fs.appendFile` is async — should never cause frame drops. If it does, check disk I/O.
- **Data format:** Each line is independent JSON — a corrupt line won't break the whole file. Parse with `line.split('\n').map(JSON.parse)`.

---

## 2. EnvironmentScanner (Spatial Awareness)

**Branch:** `feat/spatial-awareness` · **Lines:** ~1022–1110 · **Module:** `EnvironmentScanner`

### Purpose
Scans `$gameMap.events()` to classify nearby objects (traps, enemies, chests, doors, save points) and provide the AI with spatial awareness of its surroundings.

### How It Works
1. Every call to `scan()`, iterates `$gameMap.events()` within a **6-tile radius** of `$gamePlayer`
2. Each event is classified by matching its `characterName` (sprite sheet) and `event.name` against known patterns
3. Results are cached with a **60-frame TTL** (~1 second at 60fps) to prevent per-frame overhead

### Classification Patterns

| Category | Danger Level | Matching Patterns |
|----------|-------------|-------------------|
| **Bear Trap** | High | `!Other1` sprite |
| **Floor Spikes** | High | `!Other2` sprite, names with `spike/púa` |
| **Enemy** | High | `Enemy`, `Monster`, `Guard` in event name |
| **Arrow Trap** | Medium | Names with `arrow/flecha` |
| **Floor Trap** | Medium | Names with `trap/trampa` |
| **Chest/Loot** | None | `!Chest` sprite, `loot/cofre` names |
| **Door** | None | `!Door` sprite, `door/puerta` names |
| **Save Point** | None | `ritual/save/circle` names |

### Integration Points
- **`getContext()`** → `nearby_objects` field in chat context
- **Chat prompt** → `NEARBY (you can see): [summary]`
- **`AmbientDialogue.checkNearbyThreats()`** → Proactive warnings when threats are within **2 tiles**
- **`Scene_Map.update()`** → Periodic threat check alongside hunger checks

### Key Methods
```javascript
EnvironmentScanner.scan()        // Returns array of { name, type, danger, distance, x, y }
EnvironmentScanner.getSummary()  // Returns compact text like "Bear Trap (2 tiles), Chest (4 tiles)"
```

### If Issues Occur
- **False positives:** Event name doesn't match expected pattern. Check `Debug.log('[Scanner]')` output.
- **Missing detections:** The scanner uses exact `characterName` matches. Custom/modded sprites won't be recognized. Add new patterns to `_classifyEvent()`.
- **Performance:** The 60-frame cache TTL means scanning happens ~once/second. If you see frame drops, increase `CACHE_TTL`.

---

## 3. Combat Logic (Multi-turn Strategy)

**Branch:** `feat/combat-logic` · **Module:** `AIState.currentStrategy` + `GeminiAPIHandler` modifications

### Purpose
Two improvements: (1) the AI can now plan across multiple turns instead of being stateless, and (2) retry validation gives the AI explicit action lists when it makes an invalid choice.

### Multi-turn Strategy

**New JSON field in combat output:**
```json
{
  "action": "Atacar",
  "target": "Guard",
  "limb": "right arm",
  "reasoning": "Disarm first",
  "dialog": "¡El brazo del arma primero!",
  "strategy": "Destroy right arm then head"  // NEW
}
```

**Lifecycle:**
```
Turn 1: AI returns strategy → stored in AIState.currentStrategy (3-turn TTL)
Turn 2: Prompt includes "CONTINUING STRATEGY (turn 2 of plan): Destroy right arm then head"
Turn 3: Strategy still active, AI follows or updates
Turn 4: turnsRemaining = 0 → strategy auto-expires
```

**State shape:**
```javascript
AIState.currentStrategy = {
  plan: "Destroy right arm then head",
  turnsRemaining: 3,
  startTurn: 1
};
```

**Cleared on:** battle victory, battle escape, or TTL expiry.

### Improved Retry Validation

**Before (generic):**
```
PREVIOUS ATTEMPT FAILED:
Your previous decision was invalid. Please correct your response.
```

**After (explicit):**
```
PREVIOUS ATTEMPT FAILED:
Your previous decision was invalid: {"action":"Slash","target":"Guard"}
Error: Invalid action
AVAILABLE ACTIONS (choose ONLY from this list): [Atacar, Defenderse, Curar, Ataque rápido]
VALID TARGETS: [Guardia, Guardia 2]
Please correct your response. Use EXACT names from the lists above.
```

### Implementation Locations
- **`AIState.currentStrategy`** — line ~651 (new field)
- **`_buildPrompt()`** — strategy injection after JSON schema (line ~1955)
- **`retryContext`** — explicit action/target lists (line ~1909)
- **`getDecisionSync()`** — strategy extraction from response (line ~2112)
- **Victory/Escape hooks** — cleanup (lines ~5213, ~5229)

### If Issues Occur
- **AI ignores strategy:** Check `[Combat] Strategy set:` in debug log. If not appearing, the AI isn't returning the `strategy` field. This is model-dependent.
- **Invalid actions persist after retry:** The available actions list is built from `companion.skills` and `companion.items`. If these are empty, the list will only contain `[Atacar, Defenderse]`.

---

## 5. IntentDetector (LLM Fallback)

**Branch:** `feat/intent-detector` · **Lines:** ~700–920 · **Module:** `IntentDetector`

### Purpose
Three improvements: smarter confidence scoring, LLM fallback for ambiguous messages, and intent caching.

### Improved Confidence Scoring

| Scenario | Old Score | New Score |
|----------|-----------|-----------|
| No regex match (`generic_query`) | 0.9 ❌ | **0.3** |
| Single intent + entity confirmed | 0.9 | **0.95** |
| Single intent, no entity | 0.9 | **0.8** |
| Multi-match + entity | 0.7 | **0.85** |
| Multi-match, no entity | 0.7 | **0.6** |
| Battle context override | 0.9 | **0.9** |

### LLM Fallback Classifier
Triggers when confidence < 0.5 (only `generic_query` hits this threshold).

```
Player: "oye qué onda con este sitio"
  → classify() → confidence: 0.3 (generic_query)
  → classifyWithFallback() → LLM prompt: "Classify this message..."
  → LLM responds: "location"
  → Final: { primary: "location", confidence: 0.75 }
```

**Characteristics:**
- **Max 20 tokens** — just needs one word back
- **3-second timeout** via `AbortController`
- **Temperature 0.1** — deterministic classification
- **Graceful fallback** — on error/timeout, uses regex result as-is
- Only calls LLM when confidence < 0.5 (saves API calls)

### Intent Cache
- `Map`-based, key = first 80 chars of lowercased input
- **5-minute TTL** per entry
- **Max 50 entries** with LRU eviction
- Updated when LLM improves a classification

### Key Methods
```javascript
IntentDetector.classify(message)              // Sync, regex-only (fast)
IntentDetector.classifyWithFallback(message)  // Async, with LLM fallback
IntentDetector._classifyViaLLM(message)       // Internal, sends classification prompt
```

### Integration
- `ChatSystem.sendMessage()` calls `classifyWithFallback()` (async)
- All other internal callers still use sync `classify()`

### If Issues Occur
- **LLM fallback never triggers:** Check that messages are truly hitting `generic_query`. Add `Debug.log` in `classifyWithFallback`.
- **Wrong classifications:** The LLM prompt lists 9 categories. If your model returns something not in the list, it's cleaned via regex `[^a-z_]` and validated against `_patterns` keys.
- **Cache stale data:** Cache TTL is 5 minutes. If you change patterns, call `IntentDetector._cache.clear()` in console.

---

## 6. WorldStateEngine

**Branch:** `feat/world-state` · **Lines:** ~3207–3519 · **Module:** `WorldStateEngine`

### Purpose
Aggregates all game state factors into a single "situation" rating and compact prompt summary. Replaces scattered raw data with a holistic view.

### Data Sources

| Component | Source | Extracted Data |
|-----------|--------|----------------|
| **Party** | `$gameParty.members()` | HP averages, wounded/dead counts, member names |
| **Resources** | `$gameParty.items()` | Healing count, food count, keys, save materials |
| **Environment** | `MapContextHelper` | Map name, time-on-map, visited-before tracking |
| **Threats** | `ShortTermMemory` | Score from recent deaths, criticals, battle outcomes |
| **Morale** | `SanityManager` + hunger states | Sanity %, hunger level, trust → overall morale |

### Situation Ratings

| Level | Score | Meaning |
|-------|-------|---------|
| `critical` | ≥ 10 | Party dying, no resources, high threats |
| `dire` | ≥ 7 | Several bad factors stacking |
| `tense` | ≥ 4 | Some pressure building |
| `cautious` | ≥ 2 | Minor concern |
| `stable` | < 2 | All clear |

### Score Composition
```
Party HP < 25%    → +4    |  Party HP < 50%  → +2
Dead members      → +3    |  No healing      → +2
No food           → +1    |  Threat score     → +(0-6+)
Morale desperate  → +3    |  Morale low       → +1
```

### Prompt Injection Example
```
SITUATION: ⚠ SITUACIÓN CRÍTICA | Grupo: 1 herido(s), HP medio: 32% | Sin curación | Moral: desesperada
```
- Only injected when situation is non-stable (saves tokens)
- AI tone instruction: "match SITUATION level — if critical, be tense and urgent"

### Performance
- **5-second snapshot cache** — `getSnapshot()` returns cached data if < 5s old
- `onMapTransfer()` forces recalculation
- No per-frame cost

### Key Methods
```javascript
WorldStateEngine.getSnapshot()           // Full state object (cached)
WorldStateEngine.getWorldSummary()       // Compact text for prompt
WorldStateEngine.getWorldSnapshotForLog() // Flat object for telemetry
WorldStateEngine.onMapTransfer(mapId)    // Reset cache, track visited maps
```

### If Issues Occur
- **Always shows "stable":** Check `WorldStateEngine.getSnapshot()` in console. Verify `$gameParty.members()` returns data.
- **Wrong threat score:** Threat scoring depends on ShortTermMemory event text matching patterns like `/death|LOST a|CRITICAL/i`. If events use different wording, threats won't register.
- **Stale snapshot:** Force refresh with `WorldStateEngine._lastSnapshot = null`.

---

## 7. NPCIntelligence

**Branch:** `feat/npc-intelligence` · **Lines:** ~3521–3741 · **Module:** `NPCIntelligence`

### Purpose
Intercepts RPG Maker MV's `Game_Interpreter.command101` (Show Text) to identify who is speaking, track NPC encounters, and provide dialogue context to the AI companion.

### Speaker Identification (3-Tier)

| Priority | Method | Example |
|----------|--------|---------|
| **1** | Face sprite map | `Actor1:7` → Ragnvaldr |
| **2** | Event name pattern | Event `"Guard_01"` → Guard |
| **3** | Fallback | Empty face → Narrator (excluded from tracking) |

### Face Sprite Map (from Actors.json)
```
Actor1:0 → Cahara        Actor1:2 → D'arce       Actor1:3 → Niña
Actor1:6 → Enki          Actor1:7 → Ragnvaldr    Actor2:0 → Le'garde
Actor2:1 → Moonless      Actor2:3 → Demon Child  Actor2:4 → Marriage
Actor2:7 → Skeleton      Actor3:0 → Nas'hrah     Marcoh_faces:0 → Marcoh
```

### Event Name Patterns
```
guard → Guard           merchant → Merchant     pocketcat → Pocketcat
enki → Enki             darce → D'arce          ragnvaldr → Ragnvaldr
cahara → Cahara         legarde → Le'garde      nashrah → Nas'hrah
girl → Girl             priest → Dark Priest    trortur → Trortur
```

### command101 Hook
```javascript
// Intercepts Show Text BEFORE the original fires
const _Game_Interpreter_command101 = Game_Interpreter.prototype.command101;
Game_Interpreter.prototype.command101 = function () {
    // 1. Read faceName + faceIndex from params
    // 2. Read ahead through command 401 (text continuation) lines
    // 3. Identify speaker via NPCIntelligence.identifySpeaker()
    // 4. Record dialogue via NPCIntelligence.recordDialogue()
    // 5. Call original command101
    return _Game_Interpreter_command101.call(this);
};
```

**Safety:** Entire hook is wrapped in `try/catch` — NEVER breaks game dialogue.

### Dialogue Tracking
- **Buffer:** Last 5 NPC interactions (speaker, text, map, timestamp)
- **Dedup:** Same speaker within 200ms is treated as multi-line continuation
- **Encounter map:** Per-NPC counter: `{ count, lastSeen, lastMap }`
- **STM integration:** `ShortTermMemory.addEvent("D'arce spoke to the party.")`
- **Cleared on map transfer**

### Prompt Injection
```
DIÁLOGOS RECIENTES DE NPCs:
D'arce: "No confío en este lugar... algo se siente mal."
Enki: "Cuidado con las trampas más adelante."
You may comment on what NPCs said, react to their words, or warn about untrustworthy characters.
```

### Key Methods
```javascript
NPCIntelligence.identifySpeaker(faceName, faceIndex, eventId) // → speaker object
NPCIntelligence.recordDialogue(speakerName, text, mapName)    // Store interaction
NPCIntelligence.getRecentDialogueSummary()                     // Text for prompt
NPCIntelligence.getAllEncounters()                              // All NPC stats
NPCIntelligence.getKBInfo(name)                                 // KB lookup
```

### If Issues Occur
- **Unknown speaker:** The face map only covers main characters. Custom/modded face sheets won't match. Add entries to `_faceMap`.
- **Event name not matching:** Patterns use `.includes()` — case-insensitive. If an event is named `"EV_guardia_01"`, it will match `guard`. But `"Soldier_01"` won't match anything.
- **Too much dialogue noise:** Narrator text is excluded. If system messages use face sprites, they may be misidentified. Check `[NPCIntelligence]` debug output.

---

## System Interaction Map

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ Player Input │────▶│  IntentDetector   │────▶│   ChatSystem     │
│  (message)   │     │ classify/fallback │     │  sendMessage()   │
└─────────────┘     └──────────────────┘     └────────┬─────────┘
                                                       │
                           ┌───────────────────────────┤
                           ▼                           ▼
                  ┌─────────────────┐      ┌──────────────────┐
                  │  WorldStateEngine│      │  NPCIntelligence │
                  │  getWorldSummary │      │ getDialogueSummary│
                  └────────┬────────┘      └────────┬─────────┘
                           │                        │
                           ▼                        ▼
                  ┌──────────────────────────────────────────┐
                  │           _buildChatPrompt()              │
                  │  Context: intent + world + NPC + spatial  │
                  └────────────────────┬─────────────────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │   LLM API Call   │
                              └────────┬────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │  ThesisLogger    │
                              │  .log('chat',…)  │
                              └─────────────────┘

COMBAT PATH:
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│ BattleManager    │────▶│ GeminiAPIHandler      │────▶│  ActionExecutor  │
│ processTurn()    │     │ getDecisionSync()     │     │  execute()       │
└─────────────────┘     │ + currentStrategy     │     └─────────────────┘
                        │ + retry validation    │
                        └──────────┬───────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │ EnvironmentScanner    │ (spatial context for combat prompt)
                        └──────────────────────┘
```

---

## Debug Console Reference

Open F12 in-game and use:

```javascript
// Telemetry
AI_Companion.ThesisLogger                    // Module reference

// Spatial
AI_Companion.EnvironmentScanner.scan()       // Raw scan results
AI_Companion.EnvironmentScanner.getSummary() // Compact text

// Combat
AI_Companion.AIState.currentStrategy         // Active multi-turn plan
AI_Companion.AIState.combatActionHistory     // AI actions this battle

// Intent
AI_Companion.IntentDetector._cache           // Cached classifications
AI_Companion.IntentDetector._llmFallbackEnabled = false // Disable LLM fallback

// World State
AI_Companion.WorldStateEngine.getSnapshot()           // Full state
AI_Companion.WorldStateEngine.getWorldSummary()       // Prompt text
AI_Companion.WorldStateEngine._lastSnapshot = null    // Force refresh

// NPC
AI_Companion.NPCIntelligence.getAllEncounters()        // All NPCs met
AI_Companion.NPCIntelligence.getRecentDialogueSummary() // Recent dialogue
AI_Companion.NPCIntelligence._recentDialogue          // Raw buffer
```

---

## Troubleshooting

### General
- **All debug output** is prefixed with `[ModuleName]` — filter F12 console by `[Combat]`, `[Scanner]`, `[IntentDetector]`, etc.
- **Syntax check:** Run `node --check plugins/AI_Companion.js` to validate before deploying.
- **Safe mode:** Set `Config.useMockAI = true` to bypass all LLM calls.

### Common Issues

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| No thesis log file | NW.js `fs` not available | Check `require('fs')` works in console |
| Scanner misses objects | Sprite name not in patterns | Add to `_classifyEvent()` patterns |
| Strategy never persists | AI model not returning `strategy` field | Check model supports extra JSON fields |
| Intent always `generic_query` | Regex patterns too narrow | Add keywords to `_patterns` |
| World state always "stable" | Party/resource data empty | Verify `$gameParty.members()` returns data |
| NPC not identified | Face sprite not in `_faceMap` | Add `'SpriteName:index'` entry |
| LLM classify timeout | API too slow for 3s limit | Increase timeout in `_classifyViaLLM()` |
