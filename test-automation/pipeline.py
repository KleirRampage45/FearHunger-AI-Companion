#!/usr/bin/env python3
"""
pipeline.py — Master test orchestrator.

Full pipeline: ensure LM Studio → launch NW.js → connect CDP → 
inject frame counter → load save → run test battery → 
save state → write report → deliver results.

Usage:
    python3 pipeline.py                    # Run full test suite
    python3 pipeline.py --branch spatial   # Run single branch
    python3 pipeline.py --scenario spatial_basic_scan  # Single scenario
    python3 pipeline.py --resume           # Resume from last checkpoint
    python3 pipeline.py --list             # List all scenarios
    python3 pipeline.py --quick            # Quick smoke test only
"""

import json
import os
import sys
import time
import traceback
from pathlib import Path

# Add current dir to path
sys.path.insert(0, str(Path(__file__).parent))

from cdp_bridge import CDPBridge
from game_control import GameControl
from vision_reader import VisionReader
from state_keeper import StateKeeper
from test_battery import (
    ALL_SCENARIOS, ALL_BRANCH_NAMES, get_scenario,
    get_branch_scenarios, story_check_map_position,
    regression_basic_chat, regression_ai_config,
)
from test_config import EMBEDDING_MODEL, LM_STUDIO_MODELS_URL


# ════════════════════════════════════════════════════════════════
# LM STUDIO MANAGEMENT
# ════════════════════════════════════════════════════════════════

def check_lm_studio():
    """Check if LM Studio is running and responsive."""
    import urllib.request
    try:
        with urllib.request.urlopen(LM_STUDIO_MODELS_URL, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            models = data if isinstance(data, list) else data.get("data", [])
            model_names = []
            for m in models:
                if isinstance(m, dict):
                    model_names.append(m.get("id", m.get("model", "")))
                elif isinstance(m, str):
                    model_names.append(m)
            return True, model_names
    except Exception as e:
        return False, []


def ensure_lm_studio():
    """Ensure LM Studio is running. Returns True if available."""
    ok, models = check_lm_studio()
    if ok:
        return True, models
    
    print("⚠ LM Studio not responding. Attempting to start...")
    # LM Studio can be started as a background service
    # On this system, it's managed by systemd or autostart
    import subprocess
    try:
        # Check if lm-studio binary exists
        subprocess.run(["lm-studio", "daemon", "start"], 
                       timeout=10, capture_output=True)
        time.sleep(5)
        ok, models = check_lm_studio()
        return ok, models
    except FileNotFoundError:
        print("✗ LM Studio not installed as CLI. Try starting it manually.")
        return False, []
    except Exception as e:
        print(f"✗ Could not start LM Studio: {e}")
        return False, []


# ════════════════════════════════════════════════════════════════
# SCREENSHOT HELPER
# ════════════════════════════════════════════════════════════════

def take_debug_screenshot(bridge, label=""):
    """Take a debug screenshot and return the path."""
    try:
        _, path = bridge.screenshot()
        return path
    except Exception:
        return None


# ════════════════════════════════════════════════════════════════
# TEST RUNNER
# ════════════════════════════════════════════════════════════════

class TestRunner:
    """Orchestrates the full test pipeline."""

    def __init__(self, headless=False, use_vision=False):
        self.headless = headless
        self.use_vision = use_vision
        self.bridge = None
        self.game = None
        self.vision = None
        self.state = None
        self._running = False
        self._results = []

    def setup(self):
        """Initialize everything needed for testing."""
        print("=" * 60)
        print("  FEAR & HUNGER — AI COMPANION TEST AUTOMATION")
        print("=" * 60)

        # 1. Check LM Studio
        print("\n[1/5] Checking LM Studio...")
        ok, models = ensure_lm_studio()
        if ok:
            print(f"  ✓ LM Studio running. Models: {models[:3]}...")
        else:
            print("  ⚠ Continuing without LM Studio. RAG/vision tests may fail.")

        # 2. Launch NW.js with CDP
        print("\n[2/5] Launching NW.js with CDP...")
        self.bridge = CDPBridge()
        self.bridge.launch_game(headless=self.headless)
        print("  ✓ NW.js process started")
        self.bridge.connect()
        print("  ✓ CDP websocket connected")

        # 3. Inject frame counter
        self.game = GameControl(self.bridge)
        self.game.inject_frame_counter()
        print("  ✓ Frame counter injected")

        # 4. Set up vision if available
        if self.use_vision and ok:
            self.vision = VisionReader(self.bridge)
            if self.vision.check_available():
                print("  ✓ Vision model ready")
            else:
                print("  ⚠ Vision model not available, disabling vision")
                self.vision = None

        # 5. Load state
        self.state = StateKeeper()
        self.state.start_run()
        print(f"  ✓ State loaded: {len(self.state.get('completed_scenarios', []))} completed scenarios")

        current_scene = self.game.get_current_scene()
        print(f"\n  Game scene: {current_scene}")
        
        # Auto-navigate from title to game
        if self.game.is_on_title_screen():
            print("  Title screen — loading save...")
            target_slot = self.state.get("last_save_slot") or 1
            if self.game.load_save_slot(target_slot):
                print(f"  ✓ Save loaded. Map: {self.game.get_map_name()}")
            else:
                print("  ⚠ Could not load save. Trying slot 1...")
                if self.game.load_save_slot(1):
                    print(f"  ✓ Save loaded. Map: {self.game.get_map_name()}")
        
        if self.game.is_on_map():
            pos = self.game.get_position()
            map_name = self.game.get_map_name()
            print(f"  Position: Map '{map_name}' at {pos}")
            self.state.update_game_state(self.game)
        
        return True

    def teardown(self):
        """Clean up all resources."""
        print("\n" + "=" * 60)
        print("  CLEANING UP")
        print("=" * 60)
        
        if self.state:
            self.state.finish_run()
            report_path = self.state.write_report()
            print(f"  Report saved: {report_path}")

        if self.bridge:
            self.bridge.kill()
            print("  ✓ NW.js terminated")

    def run_scenario(self, scenario_func, branch_name):
        """
        Run a single scenario and record the result.
        Returns the result dict.
        """
        scenario_name = scenario_func.__name__.replace("_", " ").title()
        print(f"  Testing: {scenario_name} [{branch_name}]", end="", flush=True)
        
        result = scenario_func(self.game, self.state, self.vision)
        
        status = "✓" if result["passed"] else "✗"
        checks = result.get("checks", [])
        check_summary = f"({sum(1 for c in checks if c['passed']) if checks else '?'}/{len(checks) if checks else '?'} checks)"
        print(f"\r  {status} {scenario_name} {check_summary}")
        
        if not result["passed"]:
            for c in checks:
                if not c["passed"]:
                    detail = c.get("details", {})
                    detail_str = f" — {detail}" if detail else ""
                    print(f"      Failed: {c['check']}{detail_str}")
        
        # Record to state
        self.state.record_scenario_result(
            branch_name, scenario_name, result["passed"],
            details=result.get("details", {})
        )
        
        self._results.append(result)
        return result

    def run_branch(self, branch_name):
        """
        Run all scenarios for a single branch.
        Returns (passed, total) count.
        """
        if self.state.is_branch_tested(branch_name):
            bp = self.state.get("branch_progress", {}).get(branch_name, {})
            print(f"\n  [{branch_name}] Already tested ({bp.get('passed', 0)}P/{bp.get('failed', 0)}F)")
            return (bp.get("passed", 0), bp.get("failed", 0))

        scenarios = get_branch_scenarios(branch_name)
        if not scenarios:
            print(f"\n  [{branch_name}] No scenarios defined")
            return (0, 0)

        print(f"\n  ── Branch: {branch_name} ({len(scenarios)} scenarios) ──")
        passed = 0
        failed = 0
        
        for i, scenario_func in enumerate(scenarios):
            # Check if we should skip (resume mode)
            current = self.state.get("current_scenario")
            if current:
                if scenario_func.__name__ == current:
                    self.state.set_current(None)  # Clear so we run this and subsequent
                elif scenario_func.__name__ != current:
                    # We're still catching up, skip until we hit our resume point
                    continue
            
            self.state.set_current(scenario_func.__name__)
            result = self.run_scenario(scenario_func, branch_name)
            
            if result["passed"]:
                passed += 1
            else:
                failed += 1
            
            # Save state every few scenarios
            if (i + 1) % 3 == 0:
                try:
                    self.state.update_game_state(self.game)
                    self.game.save_game(slot=self.state.get("last_save_slot", 5))
                except Exception:
                    pass
        
        self.state.mark_branch_tested(branch_name)
        return (passed, failed)

    def run_all_branches(self):
        """Run every branch in order."""
        total_passed = 0
        total_failed = 0
        
        print("\n" + "=" * 60)
        print("  BEGINNING FULL TEST SUITE")
        print("=" * 60)
        
        for branch_name in ALL_BRANCH_NAMES:
            try:
                p, f = self.run_branch(branch_name)
                total_passed += p
                total_failed += f
            except KeyboardInterrupt:
                print("\n\n  ⚠ Interrupted by user. Saving state...")
                self.state.set_last_error("User interrupted")
                break
            except Exception as e:
                print(f"\n  ✗ Branch {branch_name} failed with error: {e}")
                self.state.set_last_error(f"Branch {branch_name}: {e}", traceback.format_exc())
                total_failed += 1
        
        return total_passed, total_failed

    def run_smoke_test(self):
        """Quick smoke test — just the most critical scenarios."""
        smoke = [
            ("regression", regression_basic_chat),
            ("regression", regression_ai_config),
        ]

        print("\n  ── SMOKE TEST (2 critical checks) ──")
        for branch, scenario_func in smoke:
            self.run_scenario(scenario_func, branch)

    def run_single_scenario(self, scenario_name):
        """Run a single scenario by name."""
        scenario_func = get_scenario(scenario_name)
        if not scenario_func:
            print(f"✗ Scenario '{scenario_name}' not found")
            return

        # Find the branch
        for branch, scenarios in ALL_SCENARIOS.items():
            for s in scenarios:
                if s.__name__ == scenario_name:
                    self.run_scenario(s, branch)
                    return

    def interactive_menu(self):
        """Simple interactive menu for running tests."""
        while True:
            print("\n" + "=" * 60)
            print("  TEST AUTOMATION MENU")
            print("=" * 60)
            print("  1) Run ALL branches (full suite)")
            print("  2) Smoke test (quick)")
            print("  3) Run single branch")
            print("  4) Take screenshot + analyze")
            print("  5) Resume from last checkpoint")
            print("  6) Show test state")
            print("  7) Reset test state")
            print("  8) Exit")
            print("=" * 60)
            
            choice = input("  Choose [1-8]: ").strip()
            
            if choice == "1":
                self.run_all_branches()
            elif choice == "2":
                self.run_smoke_test()
            elif choice == "3":
                print("\n  Branches:")
                for i, name in enumerate(ALL_BRANCH_NAMES):
                    bp = self.state.get("branch_progress", {}).get(name, {})
                    status = "✓" if bp.get("tested") else " "
                    print(f"  {i+1}) [{status}] {name} ({bp.get('passed', 0)}P/{bp.get('failed', 0)}F)")
                idx = input("  Select branch number: ").strip()
                try:
                    branch = ALL_BRANCH_NAMES[int(idx) - 1]
                    self.run_branch(branch)
                except (ValueError, IndexError):
                    print("  Invalid choice")
            elif choice == "4":
                print("  Taking screenshot...")
                try:
                    data, path = self.bridge.screenshot()
                    print(f"  Screenshot: {path}")
                    if self.vision:
                        result = self.vision.analyze_screen()
                        print(f"  Analysis:\n{result['analysis'][:500]}")
                except Exception as e:
                    print(f"  Error: {e}")
            elif choice == "5":
                self.resume()
            elif choice == "6":
                print(f"\n{self.state.get_summary()}")
            elif choice == "7":
                confirm = input("  Really reset all test state? (y/N): ").strip()
                if confirm.lower() == "y":
                    self.state.reset()
                    print("  State reset.")
            elif choice == "8":
                break

    def resume(self):
        """Resume testing from last checkpoint."""
        info = self.state.get_resume_info()
        print(f"\n  Resume Info:")
        print(f"    Last position: Map {info['last_map']}")
        print(f"    Completed: {info['completed']} scenarios")
        print(f"    Failed: {info['failed']} scenarios")
        print(f"    Remaining branches: {info['branches_remaining']}")
        
        # Try to load the game save
        if self.game.is_on_title_screen():
            self.game.load_save_slot(self.state.get("last_save_slot", 5))
            print("  ✓ Save loaded")
        elif self.game.is_on_map():
            # Already loaded
            pass
        
        # Run remaining branches
        for branch in info["branches_remaining"]:
            self.run_branch(branch)


def list_scenarios():
    """Print all available scenarios."""
    print("Available scenarios:")
    for branch, scenarios in ALL_SCENARIOS.items():
        print(f"\n  [{branch}]")
        for s in scenarios:
            print(f"    - {s.__name__}")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Fear & Hunger AI Companion Test Automation")
    parser.add_argument("--list", action="store_true", help="List all scenarios")
    parser.add_argument("--branch", type=str, help="Run a specific branch")
    parser.add_argument("--scenario", type=str, help="Run a single scenario")
    parser.add_argument("--resume", action="store_true", help="Resume from last checkpoint")
    parser.add_argument("--quick", action="store_true", help="Quick smoke test only")
    parser.add_argument("--headless", action="store_true", help="Headless mode (no window)")
    parser.add_argument("--vision", action="store_true", help="Enable vision analysis")
    parser.add_argument("--interactive", "-i", action="store_true", help="Interactive menu")
    
    args = parser.parse_args()
    
    if args.list:
        list_scenarios()
        return
    
    runner = TestRunner(headless=args.headless, use_vision=args.vision)
    
    try:
        runner.setup()
        
        if args.interactive:
            runner.interactive_menu()
        elif args.resume:
            runner.resume()
        elif args.scenario:
            runner.run_single_scenario(args.scenario)
        elif args.branch:
            runner.run_branch(args.branch)
        elif args.quick:
            runner.run_smoke_test()
        else:
            runner.run_all_branches()
        
        # Show final summary
        print(f"\n{runner.state.get_summary()}")
        
    except KeyboardInterrupt:
        print("\n\n  Interrupted.")
    except Exception as e:
        print(f"\n\n  FATAL ERROR: {e}")
        traceback.print_exc()
        if runner.state:
            runner.state.set_last_error(str(e), traceback.format_exc())
    finally:
        runner.teardown()


if __name__ == "__main__":
    main()
