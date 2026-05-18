#!/usr/bin/env python3
"""
game_control.py — High-level game control for Fear & Hunger via CDP bridge.

Controls movement, chat, combat, state reading, menu navigation,
save/load, and AI companion interaction through JS injection.
"""

import json
import time
import re
from pathlib import Path

from test_config import LOG_DIR

# Direction constants for RPG Maker
DOWN = 2
LEFT = 4
RIGHT = 6
UP = 8
DIR_NAMES = {2: "down", 4: "left", 6: "right", 8: "up"}
DIR_REVERSE = {2: 8, 4: 6, 6: 4, 8: 2}

# Wait defaults
MOVE_WAIT = 0.4       # seconds per tile at normal speed
CHAT_WAIT = 45.0       # max wait for AI chat response (first call loads model)
COMBAT_WAIT = 15.0    # max wait for combat decision
FRAME_MS = 16         # ~16ms per frame at 60fps


class GameControl:
    """High-level game manipulation via CDP JS injection."""

    def __init__(self, bridge):
        self.bridge = bridge
        self._last_chat_response = None
        self._last_intent = None

    # ════════════════════════════════════════════════════════════
    # CORE — Check game is ready
    # ════════════════════════════════════════════════════════════

    def is_on_title_screen(self):
        """Check if the game is on the title screen."""
        scene = self.bridge.js("SceneManager._scene ? SceneManager._scene.constructor.name : 'none'")
        return scene == "Scene_Title"

    def is_on_map(self):
        """Check if the player is on the map (exploring)."""
        scene = self.bridge.js("SceneManager._scene ? SceneManager._scene.constructor.name : 'none'")
        return scene == "Scene_Map"

    def is_in_battle(self):
        """Check if currently in battle."""
        return self.bridge.js("BattleManager._phase && BattleManager._phase !== 'init'")

    def is_in_menu(self):
        """Check if in any menu screen."""
        scene = self.bridge.js("SceneManager._scene ? SceneManager._scene.constructor.name : 'none'")
        return scene not in ("Scene_Map", "Scene_Title", "Scene_Battle")

    def get_current_scene(self):
        """Get the current scene name."""
        return self.bridge.js("SceneManager._scene ? SceneManager._scene.constructor.name : 'none'")

    def wait_for_scene(self, scene_name, timeout=15):
        """Wait until we reach a specific scene. Returns True if reached."""
        deadline = time.time() + timeout
        while time.time() < deadline:
            current = self.get_current_scene()
            if current == scene_name:
                return True
            time.sleep(0.1)
        return False

    def wait_for_frames(self, frames):
        """Wait for N game frames by injecting frame counter."""
        start = self.bridge.js("window._testFrameCounter || 0")
        target = start + frames
        self.bridge.js(f"window._testFrameCounter = window._testFrameCounter || 0;")
        deadline = time.time() + (frames * 0.02) + 1
        while time.time() < deadline:
            current = self.bridge.js("window._testFrameCounter || 0")
            if current >= target:
                return True
            time.sleep(0.05)
        return False

    def inject_frame_counter(self):
        """Install frame counter hook into Scene_Map.update."""
        self.bridge.js("""
        if (!window._testFrameCounter) {
            window._testFrameCounter = 0;
            const _orig_update = Scene_Map.prototype.update;
            Scene_Map.prototype.update = function() {
                _orig_update.call(this);
                window._testFrameCounter = (window._testFrameCounter || 0) + 1;
            };
        }
        """)
        self.bridge.js("""
        if (!window._testBattleCounter && typeof BattleManager !== 'undefined') {
            window._testBattleCounter = 0;
            const _orig_battleUpdate = Scene_Battle.prototype.update;
            Scene_Battle.prototype.update = function() {
                _orig_battleUpdate.call(this);
                window._testBattleCounter = (window._testBattleCounter || 0) + 1;
            };
        }
        """)

    def wait_after_action(self, seconds=0.5):
        """Simple time wait."""
        time.sleep(seconds)

    # ════════════════════════════════════════════════════════════
    # MOVEMENT
    # ════════════════════════════════════════════════════════════

    def move(self, direction, tiles=1):
        """
        Move the player in a direction for N tiles.
        Waits for movement to complete.
        Returns the final position as (x, y).
        """
        dir_name = DIR_NAMES.get(direction, str(direction))
        for _ in range(tiles):
            can_move = self.bridge.js("$gamePlayer.canMove()")
            if not can_move:
                break
            # Move one tile
            self.bridge.js("$gamePlayer.moveStraight(%d)" % direction)
            time.sleep(MOVE_WAIT)
        return self.get_position()

    def move_to(self, target_x, target_y, max_steps=50):
        """
        Pathfind toward target coordinates using simple greedy approach.
        Only works on the same map (no stairs/elevation).
        """
        steps = 0
        pos = self.get_position()
        while pos != (target_x, target_y) and steps < max_steps:
            x, y = pos
            dx = target_x - x
            dy = target_y - y
            
            # Prefer moving in the larger delta direction
            if abs(dx) >= abs(dy):
                if dx > 0:
                    self.move(RIGHT)
                elif dx < 0:
                    self.move(LEFT)
            else:
                if dy > 0:
                    self.move(DOWN)
                elif dy < 0:
                    self.move(UP)
            
            pos = self.get_position()
            steps += 1
        
        return pos == (target_x, target_y)

    def get_position(self):
        """Get player (x, y) position."""
        try:
            x = self.bridge.js("$gamePlayer.x")
            y = self.bridge.js("$gamePlayer.y")
            return (x, y)
        except Exception:
            return (0, 0)

    def get_map_id(self):
        """Get current map ID."""
        return self.bridge.js("$gameMap.mapId()")

    def get_map_name(self):
        """Get current map display name."""
        return self.bridge.js("$gameMap.displayName()") or f"Map_{self.get_map_id()}"

    def interact(self):
        """Press the confirm/action button (Enter/Space equivalent)."""
        self.bridge.press_key(13)  # Enter
        time.sleep(0.3)

    def cancel(self):
        """Press the cancel button (Escape/X equivalent)."""
        self.bridge.press_key(27)  # Escape
        time.sleep(0.3)

    def teleport_to(self, map_id, x, y):
        """Directly teleport the player to a map position (bypasses normal movement)."""
        self.bridge.js(f"""
        $gamePlayer.reserveTransfer({map_id}, {x}, {y});
        $gamePlayer.requestMapReload();
        """)
        time.sleep(1.5)

    # ════════════════════════════════════════════════════════════
    # TITLE SCREEN NAVIGATION
    # ════════════════════════════════════════════════════════════

    def navigate_title_to_continue(self):
        """Navigate the title screen to Continue and load last save."""
        if not self.is_on_title_screen():
            return False
        
        # Press Enter on "Continue" (usually the 2nd option or we can use the cursor)
        # RPG Maker title: New Game is selected by default, Continue is 2nd
        for _ in range(2):
            self.bridge.press_key(40)  # Arrow Down
            time.sleep(0.15)
        
        # Select Continue
        self.bridge.press_key(13)  # Enter
        time.sleep(1.0)
        
        # Now in save file list — select first/loaded save slot
        self.bridge.press_key(13)  # Enter
        time.sleep(2.0)
        
        return self.is_on_map()

    def load_save_slot(self, slot=1):
        """Load a specific save file from the title screen using direct API calls."""
        if not self.is_on_title_screen():
            return False
        
        # Navigate to "Continue" directly
        self.bridge.js("SceneManager._scene.commandContinue()")
        time.sleep(1.0)
        
        if self.get_current_scene() != "Scene_Load":
            return False
        
        # Select the save file and trigger loading
        slot_idx = max(0, slot - 1)
        self.bridge.js(f"""
        (function() {{
            var loadScene = SceneManager._scene;
            if (loadScene && loadScene._listWindow) {{
                loadScene._listWindow.select({slot_idx});
                loadScene.onSavefileOk();
            }}
        }})()
        """)
        time.sleep(2.0)
        
        # Wait for fade and map load
        for _ in range(20):
            if self.is_on_map():
                return True
            time.sleep(1)
        
        return self.is_on_map()

    def start_new_game(self):
        """Start a new game from the title screen."""
        if not self.is_on_title_screen():
            return False
        self.bridge.press_key(13)  # Enter on "New Game"
        time.sleep(3.0)
        return self.wait_for_scene("Scene_Map", timeout=10)

    # ════════════════════════════════════════════════════════════
    # SAVE / LOAD (in-game)
    # ════════════════════════════════════════════════════════════

    def save_game(self, slot=5, label="test-auto"):
        """Save game via DataManager."""
        try:
            result = self.bridge.js(f"""
            (function() {{
                try {{
                    DataManager.saveGameWithoutBattle({slot});
                    return "saved";
                }} catch(e) {{
                    return "error:" + e.message;
                }}
            }})()
            """)
            return result == "saved"
        except Exception as e:
            return False

    def load_game_in_game(self, slot=5):
        """Load a save file while already in the game."""
        self.bridge.js(f"DataManager.loadGame({slot})")
        time.sleep(0.5)
        self.bridge.js("SceneManager.goto(Scene_Map)")
        time.sleep(2.0)
        return self.is_on_map()

    # ════════════════════════════════════════════════════════════
    # CHAT — AI Companion Communication
    # ════════════════════════════════════════════════════════════

    def open_chat(self):
        """Press C to open chat window. Returns True if successful."""
        self.bridge.press_key(67)  # KeyC
        time.sleep(0.5)
        return True

    def close_chat(self):
        """Close chat window with Escape."""
        self.bridge.press_key(27)  # Escape
        time.sleep(0.3)

    def send_chat_message_visible(self, message):
        """
        Open the actual chat scene, set the visible input text, submit it, and
        verify the UI transcript updates. This is slower than direct API chat,
        but it tests the UI path: C key, input window, auto-scroll, and scene
        recovery.
        """
        escaped = message.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")

        if self.get_current_scene() != "Scene_AIChat":
            self.open_chat()
            deadline = time.time() + 5
            while time.time() < deadline:
                if self.get_current_scene() == "Scene_AIChat":
                    break
                time.sleep(0.1)

        js_code = f"""
        (async function() {{
            try {{
                const scene = SceneManager._scene;
                if (!scene || scene.constructor.name !== 'Scene_AIChat' || !scene._inputWindow) {{
                    return JSON.stringify({{success:false, error:'Scene_AIChat not active'}});
                }}
                const before = AI_Companion.ChatSystem.getTranscript
                    ? AI_Companion.ChatSystem.getTranscript().length
                    : 0;
                scene._inputWindow._text = '{escaped}';
                scene._inputWindow.refresh();
                const t0 = performance.now();
                await scene.onInputOk();
                const latency = Math.round(performance.now() - t0);
                const transcript = AI_Companion.ChatSystem.getTranscript
                    ? AI_Companion.ChatSystem.getTranscript()
                    : [];
                const last = transcript.length ? transcript[transcript.length - 1] : null;
                const maxScroll = scene._getMaxScroll ? scene._getMaxScroll() : 0;
                const scrollY = scene._scrollY || 0;
                return JSON.stringify({{
                    success: true,
                    response_text: last && (last.message || last.text || last.content) || '',
                    latency_ms: latency,
                    transcript_before: before,
                    transcript_after: transcript.length,
                    scene_active: SceneManager._scene && SceneManager._scene.constructor.name,
                    scroll_y: scrollY,
                    max_scroll: maxScroll,
                    at_bottom: maxScroll <= 1 || Math.abs(scrollY - maxScroll) <= 2
                }});
            }} catch(e) {{
                return JSON.stringify({{success:false, error:e.message, error_type:e.name || 'Error'}});
            }}
        }})()
        """

        result = self.bridge.js(js_code, await_promise=True, timeout=CHAT_WAIT)
        if result and isinstance(result, str):
            try:
                parsed = json.loads(result)
                self._last_chat_response = parsed
                return parsed
            except json.JSONDecodeError:
                return {"success": False, "error": "Failed to parse visible chat response", "raw": result[:200]}
        return {"success": False, "error": "No response from visible chat system"}

    def send_chat_message(self, message):
        """
        Send a message to the AI companion via direct JS injection.
        Much faster than typing — bypasses the UI entirely.
        Includes error resilience for map data issues.
        
        Returns dict with: response_text, intent, rag_used, latency_ms
        """
        # Escape the message for JS string
        escaped = message.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")
        
        js_code = f"""
        (async function() {{
            try {{
                // Ensure safe context
                if (typeof AI_Companion === 'undefined' || !AI_Companion.ChatSystem) {{
                    return JSON.stringify({{success: false, error: 'ChatSystem not loaded'}});
                }}
                const t0 = performance.now();
                const response = await AI_Companion.ChatSystem.sendMessage('{escaped}');
                const latency = performance.now() - t0;
                // The response is a string (the AI's reply text)
                const responseText = (typeof response === 'string') ? response :
                    (response.text || response.response_text || JSON.stringify(response));
                return JSON.stringify({{
                    success: true,
                    response_text: responseText,
                    latency_ms: Math.round(latency),
                    response_source: 'api',
                    model_used: 'local'
                }});
            }} catch(e) {{
                return JSON.stringify({{
                    success: false,
                    error: e.message,
                    error_type: e.name || 'Error'
                }});
            }}
        }})()
        """
        
        result = self.bridge.js(js_code, await_promise=True, timeout=CHAT_WAIT)
        if result and isinstance(result, str):
            try:
                parsed = json.loads(result)
                if parsed.get("success"):
                    self._last_chat_response = parsed
                    return parsed
                else:
                    return {"success": False, "error": parsed.get("error", "unknown")}
            except json.JSONDecodeError:
                return {"success": False, "error": "Failed to parse response", "raw": result[:200]}
        
        return {"success": False, "error": "No response from chat system"}

    def chat_and_verify(self, message, expected_keywords=None, min_latency_ms=None, check_intent=None):
        """
        Send a chat message and verify characteristics of the response.
        Returns a test result dict.
        """
        result = self.send_chat_message(message)
        checks = {"message": message, "result": result, "passed": True, "checks": []}
        
        if not result.get("success"):
            checks["passed"] = False
            checks["checks"].append(("response_received", False, f"Error: {result.get('error')}"))
            return checks
        
        # Check response received
        has_response = bool(result.get("response_text"))
        checks["checks"].append(("response_received", has_response, 
                                 f"Response: {result.get('response_text', '')[:80]}..." if has_response else "No response"))
        if not has_response:
            checks["passed"] = False
        
        # Check expected keywords
        if expected_keywords and has_response:
            resp_lower = result["response_text"].lower()
            for kw in expected_keywords:
                found = kw.lower() in resp_lower
                checks["checks"].append((f"keyword:'{kw}'", found, ""))
                if not found:
                    checks["passed"] = False
        
        # Check latency
        if min_latency_ms and result.get("latency_ms", 0) < min_latency_ms:
            checks["checks"].append((f"latency >= {min_latency_ms}ms", False, 
                                     f"Got {result['latency_ms']}ms"))
            checks["passed"] = False
        
        # Check intent
        if check_intent and result.get("intent"):
            match = result["intent"] == check_intent
            checks["checks"].append((f"intent == '{check_intent}'", match, 
                                     f"Got '{result['intent']}'"))
            if not match:
                checks["passed"] = False
        
        return checks

    # ════════════════════════════════════════════════════════════
    # GAME STATE READING
    # ════════════════════════════════════════════════════════════

    def get_party_state(self):
        """Get detailed party state."""
        js = """
        (function() {
            const members = $gameParty.members();
            const leader = $gameParty.leader();
            const items = $gameParty.allItems();
            
            const hp_data = members.map(function(a) {
                return { name: a.name(), hp: a.hp, mhp: a.mhp, mp: a.mp, mmp: a.mmp };
            });
            const avg_hp_pct = members.length > 0 
                ? Math.round(hp_data.reduce(function(s, a) { return s + (a.hp / a.mhp) * 100; }, 0) / members.length)
                : 100;
            const dead = members.filter(function(a) { return a.hp <= 0; }).length;
            
            // Count healing and food items by pattern matching
            let healing = 0, food = 0;
            for (var i = 0; i < items.length; i++) {
                var name = (items[i].name || '').toLowerCase();
                if (name.match(/hierba|vial|hierb|bandage|venda|tela|fragment|alcohol|bálsamo|piedra|amulet|herb|potion|vial|blue|green|red|yellow|purple|pill|capsule/)) healing++;
                if (name.match(/comida|food|bread|pan|carne|meat|fish|pescado|ration|ración/)) food++;
            }
            
            return JSON.stringify({
                size: members.length,
                leader: leader ? leader.name() : 'none',
                members: hp_data,
                avg_hp_pct: avg_hp_pct,
                dead: dead,
                healing_items: healing,
                food_items: food,
                gold: $gameParty.gold()
            });
        })()
        """
        result = self.bridge.js(js)
        if result and isinstance(result, str):
            try:
                return json.loads(result)
            except json.JSONDecodeError:
                pass
        return {"size": 0, "error": "Could not read party state"}

    def get_inventory(self):
        """Get all inventory items."""
        js = """
        (function() {
            var items = $gameParty.allItems();
            return JSON.stringify(items.map(function(i) {
                return { id: i.id, name: i.name, description: (i.description || '').substring(0, 100) };
            }));
        })()
        """
        result = self.bridge.js(js)
        if result and isinstance(result, str):
            try:
                return json.loads(result)
            except json.JSONDecodeError:
                pass
        return []

    def get_game_variable(self, var_id):
        """Get a specific game variable's value."""
        return self.bridge.js(f"$gameVariables.value({var_id})")

    def get_game_switch(self, switch_id):
        """Get a specific game switch's value."""
        return self.bridge.js(f"$gameSwitches.value({switch_id})")

    def get_full_state_snapshot(self):
        """Get a comprehensive snapshot of the game state."""
        party = self.get_party_state()
        map_id = self.get_map_id()
        map_name = self.get_map_name()
        pos = self.get_position()
        scene = self.get_current_scene()
        in_battle = self.is_in_battle()
        
        # Check AI Companion state
        ai_state = {}
        try:
            ai_state = {
                "config": {
                    "companionName": self.bridge.js("AI_Companion.Config.companionName"),
                    "language": self.bridge.js("AI_Companion.Config.language"),
                    "debugMode": self.bridge.js("AI_Companion.Config.debugMode"),
                    "hybridRagEnabled": self.bridge.js("AI_Companion.Config.hybridRagEnabled"),
                    "autonomyEnabled": self.bridge.js("AI_Companion.Config.autonomyEnabled"),
                },
                "worldState": self.bridge.js("JSON.stringify(AI_Companion.WorldStateEngine.getSnapshot())"),
                "strategy": self.bridge.js("AI_Companion.AIState ? AI_Companion.AIState.currentStrategy : null"),
            }
            if ai_state["worldState"] and isinstance(ai_state["worldState"], str):
                ai_state["worldState"] = json.loads(ai_state["worldState"])
        except Exception:
            ai_state = {"error": "AI Companion not fully loaded"}
        
        return {
            "timestamp": time.time(),
            "scene": scene,
            "map": {"id": map_id, "name": map_name},
            "position": pos,
            "party": party,
            "in_battle": in_battle,
            "ai_companion": ai_state,
        }

    # ════════════════════════════════════════════════════════════
    # COMBAT
    # ════════════════════════════════════════════════════════════

    def is_in_battle_detailed(self):
        """Get detailed battle state."""
        js = """
        (function() {
            if (!BattleManager._phase || BattleManager._phase === 'init') return JSON.stringify({in_battle: false});
            
            var troop = $gameTroop;
            var enemies = troop ? troop.members() : [];
            return JSON.stringify({
                in_battle: true,
                phase: BattleManager._phase,
                turn: BattleManager._turn || 0,
                enemy_count: enemies.length,
                enemies: enemies.map(function(e) {
                    return { name: e.name(), hp: e.hp, mhp: e.mhp, alive: e.isAlive() };
                }),
                actor_count: $gameParty.members().length,
                actors: $gameParty.members().map(function(a) {
                    return { name: a.name(), hp: a.hp, mhp: a.mhp };
                }),
                strategy: typeof AI_Companion !== 'undefined' && AI_Companion.AIState 
                    ? AI_Companion.AIState.currentStrategy : null
            });
        })()
        """
        result = self.bridge.js(js)
        if result and isinstance(result, str):
            try:
                return json.loads(result)
            except json.JSONDecodeError:
                pass
        return {"in_battle": False}

    def trigger_random_encounter(self):
        """Try to trigger a random encounter by moving through a danger tile."""
        enc_was = self.bridge.js("$gameParty.stepsForEncounter()")
        # Move around to trigger encounter
        for _ in range(30):
            self.move(RIGHT)
            if self.is_in_battle():
                return True
            self.move(LEFT)
            if self.is_in_battle():
                return True
            self.move(DOWN)
            if self.is_in_battle():
                return True
            self.move(UP)
            if self.is_in_battle():
                return True
        return False

    def flee_battle(self):
        """Attempt to flee from battle."""
        self.bridge.js("""
        if (BattleManager._phase === 'start' || BattleManager._phase === 'turn') {
            BattleManager.processEscape();
        }
        """)
        time.sleep(1.0)
        return not self.is_in_battle()

    def execute_combat_turn(self):
        """
        Let the AI companion execute one combat turn.
        Returns the action taken.
        """
        # Wait for the AI to make its decision
        time.sleep(COMBAT_WAIT)
        
        # Check what happened
        strat = self.bridge.js(
            "AI_Companion.AIState && AI_Companion.AIState.currentStrategy "
            "? JSON.stringify(AI_Companion.AIState.currentStrategy) : null"
        )
        
        battle = self.is_in_battle_detailed()
        return {
            "strategy": json.loads(strat) if strat and isinstance(strat, str) else None,
            "battle_state": battle,
        }

    def process_whole_battle(self, max_turns=20, flee_if_possible=False):
        """
        Process an entire battle (wait for AI turns).
        Returns summary of the battle.
        """
        if not self.is_in_battle():
            return {"status": "no_battle", "turns": 0}
        
        turns = 0
        actions = []
        
        while self.is_in_battle() and turns < max_turns:
            turn_result = self.execute_combat_turn()
            actions.append(turn_result)
            turns += 1
            
            if flee_if_possible and turns > 3:
                self.flee_battle()
                break
        
        outcome = "escaped" if not self.is_in_battle() and flee_if_possible and turns <= max_turns else \
                  "victory" if not self.is_in_battle() else \
                  "still_fighting" if turns >= max_turns else \
                  "defeat"
        
        return {
            "status": outcome,
            "turns": turns,
            "actions": actions,
            "last_strategy": actions[-1].get("strategy") if actions else None,
        }

    # ════════════════════════════════════════════════════════════
    # AI COMPANION SPECIFIC
    # ════════════════════════════════════════════════════════════

    def get_environment_scan(self):
        """Get EnvironmentScanner results."""
        result = self.bridge.js("JSON.stringify(AI_Companion.EnvironmentScanner.scan())")
        if result and isinstance(result, str):
            return json.loads(result)
        return []

    def get_environment_summary(self):
        """Get EnvironmentScanner summary text."""
        return self.bridge.js("AI_Companion.EnvironmentScanner.getSummary()")

    def get_world_summary(self):
        """Get WorldStateEngine summary."""
        return self.bridge.js("AI_Companion.WorldStateEngine.getWorldSummary()")

    def get_world_snapshot(self):
        """Get full WorldStateEngine snapshot."""
        js = "JSON.stringify(AI_Companion.WorldStateEngine.getSnapshot())"
        result = self.bridge.js(js)
        if result and isinstance(result, str):
            return json.loads(result)
        return {}

    def get_npc_encounters(self):
        """Get NPC encounter data."""
        js = "JSON.stringify(AI_Companion.NPCIntelligence.getAllEncounters())"
        result = self.bridge.js(js)
        if result and isinstance(result, str):
            return json.loads(result)
        return {}

    def get_recent_npc_dialogue(self):
        """Get recent NPC dialogue summary."""
        return self.bridge.js("AI_Companion.NPCIntelligence.getRecentDialogueSummary()")

    def get_story_goals(self):
        """Get StoryGoalMemory."""
        js = "AI_Companion.StoryGoalMemory ? JSON.stringify(AI_Companion.StoryGoalMemory.getAllGoals()) : '[]'"
        result = self.bridge.js(js)
        if result and isinstance(result, str):
            return json.loads(result)
        return []

    def query_rag(self, query):
        """
        Directly query the Hybrid RAG system.
        Returns retrieved chunks.
        """
        escaped = query.replace("\\", "\\\\").replace("'", "\\'")
        js = f"""
        (async function() {{
            try {{
                var results = await AI_Companion.HybridRAG.retrieve('{escaped}', {{max: 4}});
                return JSON.stringify(results);
            }} catch(e) {{
                return JSON.stringify({{error: e.message}});
            }}
        }})()
        """
        result = self.bridge.js(js, await_promise=True, timeout=10)
        if result and isinstance(result, str):
            return json.loads(result)
        return {"error": "No RAG response"}

    def set_config(self, key, value):
        """Set an AI Companion config value."""
        return self.bridge.js(f"AI_Companion.Config.set{key[0].upper() + key[1:]}({json.dumps(value)})")

    def get_config(self, key):
        """Get an AI Companion config value."""
        # Access config via bracket notation for safety
        return self.bridge.js(f"AI_Companion.Config.{key}")

    # ════════════════════════════════════════════════════════════
    # LOG READING
    # ════════════════════════════════════════════════════════════

    def read_thesis_log(self, max_lines=50):
        """
        Read the most recent thesis log entries from the JSONL file on disk.
        """
        # Find the log directory
        log_dir = str(LOG_DIR)
        try:
            files = sorted(Path(log_dir).glob("session_*.jsonl"), key=lambda f: f.stat().st_mtime, reverse=True)
            if not files:
                return []
            
            entries = []
            with open(files[0], "r") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            entries.append(json.loads(line))
                        except json.JSONDecodeError:
                            pass
            
            return entries[-max_lines:]
        except (FileNotFoundError, IndexError, OSError):
            return []

    def get_thesis_log_count(self):
        """Get total number of thesis log entries this session."""
        return self.bridge.js(
            "(AI_Companion.ThesisLogger && AI_Companion.ThesisLogger._entries "
            "? AI_Companion.ThesisLogger._entries.length : -1)"
        )

    # ════════════════════════════════════════════════════════════
    # MENU NAVIGATION
    # ════════════════════════════════════════════════════════════

    def open_main_menu(self):
        """Open the main menu (Escape / X)."""
        self.bridge.press_key(27)  # Escape
        time.sleep(0.5)

    def close_menu(self):
        """Close the current menu."""
        self.bridge.press_key(27)  # Escape
        time.sleep(0.5)

    def navigate_menu_to(self, option_name):
        """
        Navigate the RPG Maker main menu to a specific option.
        Options typically: Items, Skills, Equipment, Status, Save, AI Companion, etc.
        """
        # This is tricky because RPG Maker menus have dynamic layouts.
        # We try by reading the window contents if possible
        pass

    def save_naturally(self):
        """Save the game using the game's natural save systems.
        Tries: ritual circle interaction, then DataManager fallback."""
        # First try: find and use a ritual circle / bed
        scan = self.get_environment_scan()
        if scan:
            for obj in scan:
                name = str(obj.get("name", "")).lower()
                obj_type = str(obj.get("type", "")).lower()
                if any(kw in name or kw in obj_type for kw in ["circle", "ritual", "save", "bed", "cama", "sleep", "círculo"]):
                    # Navigate to it and interact
                    dirmap = {"north": 8, "south": 2, "east": 6, "west": 4,
                              "norte": 8, "sur": 2, "este": 6, "oeste": 4}
                    d = dirmap.get(str(obj.get("direction", "")).lower())
                    if d:
                        dist = max(0, obj.get("distance", 1) - 1)
                        if dist > 0:
                            self.move(d, dist)
                            self.wait_after_action(0.5)
                        self.interact()
                        self.wait_after_action(2.0)
                        return True
        
        # Fallback: DataManager save
        return self.save_game(5)

    def save_with_f5(self):
        """Press F5 to open/close AI Config (saves to localStorage)."""
        self.bridge.press_key(116)  # F5
        self.wait_after_action(0.5)
        self.bridge.press_key(116)  # F5 again to close
        self.wait_after_action(0.3)

    def check_coin_flip_warning(self):
        """
        Check if the AI companion warns about coin flip enemies.
        Coin flip enemies in Fear & Hunger: Guard, Skeleton, Cave Maw,
        and many others — they have a 50% instant death move.
        
        Returns dict with warning info.
        """
        # Ask about coin flip mechanic
        msg = "que enemigos tienen moneda?";
        result = self.send_chat_message(msg)
        if not result.get("success"):
            return {"found": False, "response": result.get("error", "")}
        
        resp_lower = (result.get("response_text") or "").lower()
        has_coin_warning = any(kw in resp_lower for kw in [
            "moneda", "coin", "cara o cruz", "50%", "muerte instantánea",
            "instante", "turno de moneda", "cuidado", "cuidado con"
        ])
        
        return {
            "found": has_coin_warning,
            "response": result.get("response_text", "")[:200],
        }

    # ════════════════════════════════════════════════════════════
    # NAVIGATION HELPERS
    # ════════════════════════════════════════════════════════════

    def find_nearest_event_of_type(self, event_type):
        """
        Scan for a nearby event of a specific type (trap, enemy, chest, door, save).
        Returns the closest event or None.
        """
        scan = self.get_environment_scan()
        candidates = [e for e in scan if e.get("type") == event_type]
        if candidates:
            # Sort by distance
            candidates.sort(key=lambda e: e.get("distance", 99))
            return candidates[0]
        return None

    def read_dialogue_box(self):
        """Take a screenshot and try to read visible dialogue text via vision."""
        # This requires vision_reader integration
        pass
