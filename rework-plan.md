
---

I need to implement a series of targeted improvements to the project. Please organize the work into separate branches, one for each major module described below. This will allow me to test each set of changes independently before merging them into the main development branch. Work on one module at a time, and we will merge them back once each is stable.

**Branch 1: Telemetry and Data Collection**

This module is critical for research and my thesis. The current memory systems keep data only in RAM. I need persistent local logging of all interactions.

- Utilize NW.js Node integration to access `require('fs')` and append interaction data to local JSON or CSV files.
- Log the following data points for every AI interaction:
    - Timestamp and current map ID/name.
    - The exact prompt sent to the AI model.
    - The raw response received (JSON or text).
    - API latency measured between request and response.
    - The result of `IntentDetector.classify` (player intent classification).
    - The current Sanity and Trust levels of the companion at the time of interaction.
- Ensure the logging is robust and does not block the main game thread.

**Branch 2: Spatial and Environmental Awareness**

Replace the hardcoded KB map tips with a dynamic scanning system that makes the AI aware of its immediate surroundings.

- Implement a scanner that hooks into `$gameMap.events()` to detect entities within a specified radius of `$gamePlayer`.
- If an event's note tag or name contains keywords such as "Trap", "Spikes", or "Loot", inject this information into the `MapContextHelper`.
- Modify the prompt generation to include statements like "You see a Bear Trap 3 steps ahead." This allows the AI to provide proactive warnings during ambient dialogue.

**Branch 3: Combat Logic Enhancements**

Expand the decision-making capabilities of the `BattleStateExtractor` for more consistent agentic behavior.

- Implement multi-turn planning by adding a `current_strategy` field to the AI's JSON output. When the AI selects a strategy (e.g., "Focus the weapon arm"), store this intent in `AIState`. Append this stored intent to the prompt for the next turn to maintain tactical consistency until the objective is met.
- Enhance the action validation loop. When the AI hallucinates an invalid skill, the `retryContext` must explicitly feed the list of currently available skills back into the error message (e.g., "Skill 'Fireball' not found in your available actions: [Attack, Guard, Leg Sweep]. Choose again.").

**Branch 4: Advanced Memory and Social Dynamics**

Improve long-term recall and party interaction beyond basic integer scales.

- Implement dynamic summarization. When `MemoryManager.conversation_history` exceeds a threshold (e.g., 20 items), trigger a background asynchronous call to a model to summarize those exchanges into a single, dense memory sentence (e.g., "The player refused to heal me in the Thicket"). Inject this summarized string into the prompt instead of the raw array to save context tokens.
- Add inter-party banter functionality. Pass the names and KB profiles of other active party members into the ambient dialogue prompt. Instruct the AI to occasionally address or reference them directly based on their profiles (e.g., questioning D'arce's loyalty or reacting to Moonless barking).

**Branch 5: Intent Detector Optimization**

Address the limitations of regex-based intent detection.

- Implement a lightweight fallback mechanism. If the regex pattern matching fails to classify the player's input with high confidence, route the text through a local classification prompt (e.g., "Categorize this text into: item_info, tactical, lore, social").
- Use the result of this classification as the fallback intent.

**Branch 6: World State Engine**

Introduce a persistent interpreted layer between ShortTermMemory and decision-making to enable reasoning rather than just reaction.

- Create a `WorldState` data structure to track:
    - `currentGoal` (string)
    - `currentThreatLevel` (string, e.g., "high", "low")
    - `resources`: object tracking `food`, `healing`, `mind` (e.g., "low", "critical")
    - `environment`: object tracking `danger` level and `knownHazards` array.
    - `partyState`: object tracking `morale` and `cohesion`.
- Implement logic to update this state based on game events and inject relevant summaries into prompts instead of raw STM spam.

**Branch 7: NPC and Social Intelligence**

Enhance the AI's awareness of specific non-player characters.

- Define structured `NPC` profiles containing:
    - `name`
    - `traits` (array of strings)
    - `trustLevel` (integer)
    - `knownDeals` or `history` (array)
    - `danger` assessment (string)
- Ensure these profiles are injected into the prompt when the player interacts with that NPC, with an instruction such as "You KNOW this character. React accordingly."
- Implement simple AI-to-AI interactions where the companion can occasionally address other party members by name with context-appropriate lines (e.g., "Marcoh, stay behind me").

**Branch 8: Inference and Risk Evaluation Layer**

Enable the AI to derive conclusions from static KB data.

- Create a `RiskEvaluator` that analyzes the current combat state and known KB information (e.g., "Enemy poisons" and "No antidote").
- Generate a `Risk` object containing `survivalChance` and `recommendedAction` (e.g., "flee").
- This can be rule-based for speed, with an optional fallback to an LLM-assisted evaluation for rare or complex scenarios.

**Branch 9: Dynamic Environment Hazard Scanner**

Improve upon static map tips with a real-time hazard detection system.

- Hook into region IDs, event note tags, and tile flags.
- Generate a `Hazards` array identifying objects like `{ type: "trap", position: [x,y], detected: true }` or `{ type: "enemy_ambush", probability: 0.6 }`.
- Use this data to generate AI dialogue warnings (e.g., "Stop. Something is wrong with the floor here.").

**Branch 10: Memory Weighting and Belief System**

Add depth to the memory architecture.

- Implement memory weighting by adding `importance` and `decayRate` fields to stored memories. Traumatic events should persist with high importance, while minor events decay faster.
- Implement a `Beliefs` system that tracks conclusions formed by the AI (e.g., "Player makes reckless decisions", "Fire is effective in this area"). This allows the AI to form opinions that can change over time.

**Branch 11: Dialogue Internal Monologue Layer**

Prevent over-talking and repetitive comments.

- Add a step before the AI speaks where it generates an internal `Thought` (e.g., "We're running out of food. I should warn them.").
- Implement logic to decide whether to vocalize the thought or remain silent based on context, personality, and recent dialogue frequency.

**Branch 12: Performance and Architecture Tweaks**

Apply optimizations to improve response times and reduce costs.

- Expand caching beyond combat state hashing to include intent classification results, KB lookups, and dialogue templates.
- Split large prompts into separate roles (e.g., Tactical, Emotional, Lore) to reduce hallucination and token usage.
- Expand the deterministic `KBFallback` system to include multi-step tactical instructions, item combination logic, and status diagnosis trees.

**Branch 13: Personality Drift and Fear System (Advanced)**

Add long-term evolution and situational reactivity.

- Implement a `Personality Drift` mechanic where the AI's personality traits shift slightly based on player behavior (e.g., cruelty increases ruthlessness).
- Implement a `FearLevel` system appropriate for the game's setting. Track factors such as low HP, dark areas, or boss presence, and have this level affect dialogue tone, decision-making, and risk tolerance.
