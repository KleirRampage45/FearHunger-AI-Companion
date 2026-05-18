#!/usr/bin/env python3
"""
playtest.py — Automated story progression playthrough.

Loads save, explores maps, tests AI companion features at each area,
takes screenshots with vision analysis, triggers and tests combat,
saves at checkpoints.

Usage:
    python3 playtest.py                    # Full playthrough
    python3 playtest.py --screenshot       # Just take a screenshot + vision
    python3 playtest.py --map 75           # Teleport to specific map
    python3 playtest.py --depth 10         # Play for N actions
"""

import json
import os
import sys
import time
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from cdp_bridge import CDPBridge
from game_control import GameControl
from vision_reader import VisionReader
from state_keeper import StateKeeper


class Playtester:
    """Automated story progression playtester."""

    def __init__(self, use_vision=True, depth=0):
        self.use_vision = use_vision
        self.max_actions = depth or 9999
        self.bridge = None
        self.game = None
        self.vision = None
        self.state = None
        self.action_count = 0
        self.screenshot_count = 0
        self.areas_visited = set()
        self._combat_encountered = False

    def setup(self):
        """Launch game, connect, load save."""
        self.bridge = CDPBridge()
        self.bridge.launch_game(headless=False)
        self.bridge.connect()
        self.game = GameControl(self.bridge)
        self.game.inject_frame_counter()
        self.state = StateKeeper()

        print("Waiting for title...")
        self.game.wait_for_scene('Scene_Title', timeout=30)

        slot = self.state.get("last_save_slot") or 1
        print(f"Loading save slot {slot}...")
        if not self.game.load_save_slot(slot):
            print("Trying slot 1...")
            self.game.load_save_slot(1)

        if self.use_vision:
            self.vision = VisionReader(self.bridge)
            if self.vision.check_available():
                print("Vision: READY")
            else:
                print("Vision: UNAVAILABLE (proceeding without)")
                self.vision = None

        print(f"Loaded: Map '{self.game.get_map_name()}' at {self.game.get_position()}")
        self.areas_visited.add(str(self.game.get_map_id()))
        return True

    def teardown(self):
        """Save state and clean up."""
        try:
            self.game.save_game(5)
            self.state.update_game_state(self.game)
            report = self.state.write_report()
            print(f"Report: {report}")
        except Exception:
            pass
        if self.bridge:
            self.bridge.kill()

    def screenshot_with_vision(self, label=""):
        """Take screenshot and optionally analyze with vision."""
        try:
            data, path = self.bridge.screenshot()
            self.screenshot_count += 1
            label_part = f"_{label}" if label else ""
            ts = time.strftime("%H%M%S")
            nice_path = str(Path(path).parent / f"playtest_{ts}{label_part}.png")
            os.rename(path, nice_path)
            print(f"  📸 Screenshot: {Path(nice_path).name}")

            if self.vision:
                vision = self.vision.analyze_screen(
                    f"Describe this game screen in detail. "
                    f"What environment, characters, UI elements, and text are visible?"
                )
                analysis = vision.get("analysis", "")
                if analysis:
                    preview = analysis[:300].replace("\n", " ")
                    print(f"  👁 Vision: {preview}...")
                return vision
            return {"screenshot_path": nice_path}
        except Exception as e:
            print(f"  ⚠ Screenshot failed: {e}")
            return {}

    def log_action(self, msg):
        """Log an action with counter."""
        self.action_count += 1
        print(f"  [{self.action_count}] {msg}")

    def should_continue(self):
        """Check if we've hit the action limit."""
        return self.action_count < self.max_actions

    # ════════════════════════════════════════════════════════════
    # CORE PLAYTEST LOOP
    # ════════════════════════════════════════════════════════════

    def playtest_loop(self):
        """Main playtest loop — explore, test, progress."""
        print("\n" + "=" * 60)
        print("BEGINNING PLAYTEST")
        print("=" * 60)

        # Initial screenshot + checkpoint
        self.screenshot_with_vision("start")
        self.test_ai_chat("hola, quien eres?")
        self.check_world_state()
        self.test_environment()

        while self.should_continue():
            try:
                if self.game.is_in_battle():
                    self.handle_combat()
                else:
                    self.explore_and_test()
            except KeyboardInterrupt:
                print("\nInterrupted.")
                break
            except Exception as e:
                print(f"\n⚠ Error in loop: {e}")
                traceback.print_exc()
                # Try to recover
                time.sleep(1)

        # Final save
        self.screenshot_with_vision("final")
        self.game.save_game(5)
        self.state.update_game_state(self.game)
        self.state.add_story_checkpoint("playtest_end",
                                         f"{self.action_count} actions, {self.screenshot_count} screenshots")
        print(f"\nPlaytest complete: {self.action_count} actions, {self.screenshot_count} screenshots")
        print(f"Areas visited: {len(self.areas_visited)}")

    # ════════════════════════════════════════════════════════════
    # EXPLORATION
    # ════════════════════════════════════════════════════════════

    def explore_and_test(self):
        """Explore current area and test features."""
        map_id = self.game.get_map_id()
        map_str = str(map_id)
        pos = self.game.get_position()

        if map_str not in self.areas_visited:
            self.areas_visited.add(map_str)
            self.log_action(f"NEW AREA: Map {map_id} at {pos}")
            self.screenshot_with_vision(f"map{map_id}")
            self.test_ai_chat("donde estamos?")
            self.test_ai_chat("que hay aqui?")
            self.test_environment()

            # Save at new area
            self.game.save_game(5)
            self.state.update_game_state(self.game)
            self.log_action("Checkpoint saved")

        # Look for doors/exits and try to move through them
        doors_found = self.navigate_to_exit()

        if not doors_found:
            # Move around randomly to explore
            self.wander()

        # Every 5 actions, test features
        if self.action_count % 5 == 0:
            self.test_ai_chat("como te sientes?")
            self.test_rag_query("que sabes de este lugar?")
            self.screenshot_with_vision(f"check{self.action_count}")

        # Every 10 actions, save
        if self.action_count % 10 == 0:
            self.game.save_game(5)
            self.state.update_game_state(self.game)

    def navigate_to_exit(self):
        """Find doors/exits and navigate to them. Returns True if any found."""
        scan = self.game.get_environment_scan()
        if not scan:
            return False

        # Look for doors first, then other passage-like events
        exits_found = [
            e for e in scan
            if e.get("type") in ("door", "exit", "stairs", "passage", "ladder")
            or "door" in str(e.get("name", "")).lower()
            or "exit" in str(e.get("name", "")).lower()
        ]

        if not exits_found:
            return False

        for exit_obj in exits_found[:2]:  # Try up to 2 exits
            dist = exit_obj.get("distance", 0)
            dir_name = str(exit_obj.get("direction", "")).lower()

            if dist <= 1:
                # Already next to it — interact
                dir_map = {
                    "north": 8, "south": 2, "east": 6, "west": 4,
                    "norte": 8, "sur": 2, "este": 6, "oeste": 4,
                }
                d = dir_map.get(dir_name)
                if d:
                    self.game.move(d, 1)
                self.game.interact()
                time.sleep(1.5)

                # Check if map changed
                new_map = self.game.get_map_id()
                if str(new_map) not in self.areas_visited:
                    self.log_action(f"Exited to Map {new_map}!")
                    return True
                # Try the interact again (doors sometimes need 2 presses)
                self.game.interact()
                time.sleep(1.5)
                return True
            else:
                # Walk toward it
                dir_map = {
                    "north": 8, "south": 2, "east": 6, "west": 4,
                    "norte": 8, "sur": 2, "este": 6, "oeste": 4,
                }
                d = dir_map.get(dir_name)
                if d and dist > 0:
                    self.game.move(d, min(dist, 3))
                    return True

        return False

    def wander(self):
        """Move around to explore and trigger encounters."""
        dirs = [2, 4, 6, 8]  # down, left, right, up
        import random
        d = random.choice(dirs)
        self.log_action(f"Wandering {['down','left','right','up'][dirs.index(d)]}")
        self.game.move(d, random.randint(1, 3))

    # ════════════════════════════════════════════════════════════
    # COMBAT
    # ════════════════════════════════════════════════════════════

    def handle_combat(self):
        """Handle combat encounter — test AI companion decisions."""
        if not self._combat_encountered:
            self._combat_encountered = True
            self.log_action("⚔ BATTLE STARTED!")
            self.screenshot_with_vision("combat")

        # Let the AI companion act
        time.sleep(6)

        battle = self.game.is_in_battle_detailed()
        enemies = [e.get("name", "?") for e in battle.get("enemies", [])]
        strat_raw = self.game.bridge.js(
            "AI_Companion.AIState && AI_Companion.AIState.currentStrategy "
            "? JSON.stringify(AI_Companion.AIState.currentStrategy) : null"
        )
        strat = "(none)"
        if strat_raw and isinstance(strat_raw, str):
            try:
                s = json.loads(strat_raw)
                strat = s.get("plan", "(no plan)")[:60]
            except json.JSONDecodeError:
                strat = "(parse error)"

        self.log_action(f"Enemies: {enemies} | Strategy: {strat}")

        # Check if battle is over
        if not self.game.is_in_battle():
            self.log_action("⚔ Battle ended!")
            self.screenshot_with_vision("post_combat")
            self._combat_encountered = False
            # Test chat after combat
            self.test_ai_chat("que fue esa pelea?")

    # ════════════════════════════════════════════════════════════
    # FEATURE TESTS
    # ════════════════════════════════════════════════════════════

    def test_ai_chat(self, message):
        """Test AI companion chat and log response."""
        result = self.game.send_chat_message(message)
        if result.get("success"):
            resp = result.get("response_text", "")[:120]
            self.log_action(f"💬 Chat: \"{message}\" → \"{resp}\"")
        else:
            self.log_action(f"💬 Chat FAILED: {result.get('error', '?')[:60]}")

    def test_environment(self):
        """Test environment scanner."""
        scan = self.game.get_environment_scan()
        summary = self.game.get_environment_summary()
        if scan:
            types = {}
            for obj in scan:
                t = obj.get("type", "unknown")
                types[t] = types.get(t, 0) + 1
            type_str = ", ".join(f"{k}:{v}" for k, v in sorted(types.items()))
            self.log_action(f"🔍 Nearby: {type_str}")
        else:
            self.log_action("🔍 Nearby: (empty)")

    def test_rag_query(self, query):
        """Test RAG retrieval."""
        rag_result = self.game.query_rag(query)
        chunks = rag_result
        if isinstance(chunks, dict):
            chunks = rag_result.get("results", rag_result.get("chunks", []))

        if isinstance(chunks, list):
            self.log_action(f"📚 RAG \"{query}\": {len(chunks)} chunks")
        else:
            self.log_action(f"📚 RAG: responded")

    def check_world_state(self):
        """Log current world state."""
        snap = self.game.get_world_snapshot()
        situation = snap.get("situation", "?")
        party = snap.get("party", {})
        if isinstance(party, dict):
            hp = party.get("avg_hp_pct", "?")
            size = party.get("size", "?")
            self.log_action(f"📊 State: {situation} | Party: {size} @ {hp}% HP")

    def check_npc(self):
        """Check NPC encounters."""
        encounters = self.game.get_npc_encounters()
        if encounters:
            names = list(encounters.keys())[:5]
            self.log_action(f"👥 NPCs met: {', '.join(names)}")


# ════════════════════════════════════════════════════════════════
# COMMAND LINE
# ════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Fear & Hunger Playtester")
    parser.add_argument("--screenshot", action="store_true", help="Just take a screenshot")
    parser.add_argument("--depth", type=int, default=0, help="Max actions to perform")
    parser.add_argument("--no-vision", action="store_true", help="Disable vision analysis")
    args = parser.parse_args()

    pt = Playtester(use_vision=not args.no_vision, depth=args.depth)

    try:
        pt.setup()

        if args.screenshot:
            vision = pt.screenshot_with_vision("manual")
            if vision and vision.get("analysis"):
                print("\nVision analysis:")
                print(vision["analysis"])
        else:
            pt.playtest_loop()

    except Exception as e:
        print(f"\nFATAL: {e}")
        traceback.print_exc()
    finally:
        pt.teardown()
