#!/usr/bin/env python3
"""
state_keeper.py — Persistent state tracking for the test automation.

Saves test progress, game state snapshots, and resume data to JSON.
Allows the test suite to be interrupted and resumed from the last
checkpoint.
"""

import json
import os
import time
from pathlib import Path

from test_config import REPORTS_DIR

STATE_DIR = REPORTS_DIR
STATE_FILE = STATE_DIR / "test_state.json"


class StateKeeper:
    """Persistent test state for save/resume."""

    def __init__(self, state_path=STATE_FILE):
        self.state_path = Path(state_path)
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        self._state = self._load()

    def _load(self):
        """Load state from disk."""
        if self.state_path.exists():
            try:
                with open(self.state_path, "r") as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                pass
        return self._default_state()

    def _save(self):
        """Write state to disk atomically."""
        tmp = str(self.state_path) + ".tmp"
        with open(tmp, "w") as f:
            json.dump(self._state, f, indent=2, ensure_ascii=False)
        os.replace(tmp, str(self.state_path))

    def _default_state(self):
        return {
            "version": 2,
            "created_at": time.time(),
            "updated_at": time.time(),
            "last_save_slot": 5,
            "current_map_id": None,
            "current_map_name": None,
            "player_position": [0, 0],
            "party_state": {},
            "completed_scenarios": [],
            "failed_scenarios": [],
            "blocked_scenarios": [],
            "current_scenario": None,
            "current_step": 0,
            "branch_progress": {
                "telemetry": {"passed": 0, "failed": 0, "tested": False},
                "spatial": {"passed": 0, "failed": 0, "tested": False},
                "combat": {"passed": 0, "failed": 0, "tested": False},
                "intent": {"passed": 0, "failed": 0, "tested": False},
                "world_state": {"passed": 0, "failed": 0, "tested": False},
                "npc": {"passed": 0, "failed": 0, "tested": False},
                "rag": {"passed": 0, "failed": 0, "tested": False},
                "integration": {"passed": 0, "failed": 0, "tested": False},
                "story_progress": {"passed": 0, "failed": 0, "tested": False},
                "regression": {"passed": 0, "failed": 0, "tested": False},
            },
            "story_checkpoints": [],
            "total_scenarios": 0,
            "total_passed": 0,
            "total_failed": 0,
            "total_blocked": 0,
            "test_run_count": 0,
            "last_error": None,
            "last_error_trace": None,
        }

    # ── Getters ──────────────────────────────────────────────

    def get(self, key, default=None):
        return self._state.get(key, default)

    @property
    def state(self):
        return self._state

    # ── Lifecycle ─────────────────────────────────────────────

    def start_run(self):
        """Start a new test run."""
        self._state["test_run_count"] += 1
        self._state["started_at"] = time.time()
        self._save()

    def finish_run(self):
        """Mark current run as finished."""
        self._state["finished_at"] = time.time()
        self._state["updated_at"] = time.time()
        self._save()

    def reset(self):
        """Reset all test progress (keep metadata)."""
        defaults = self._default_state()
        defaults["test_run_count"] = self._state["test_run_count"]
        defaults["created_at"] = self._state["created_at"]
        self._state = defaults
        self._save()

    # ── Progress Tracking ─────────────────────────────────────

    def record_scenario_result(self, branch, scenario_name, passed, details=None):
        """
        Record the result of a test scenario.
        
        Args:
            branch: Branch name (telemetry, spatial, combat, etc.)
            scenario_name: Human-readable scenario name
            passed: True if passed, False if failed
            details: Optional dict with extra info
        """
        if branch in self._state["branch_progress"]:
            bp = self._state["branch_progress"][branch]
            if passed:
                bp["passed"] += 1
            else:
                bp["failed"] += 1

        entry = {
            "scenario": scenario_name,
            "branch": branch,
            "passed": passed,
            "timestamp": time.time(),
            "details": details or {},
        }

        if passed:
            self._state["completed_scenarios"].append(entry)
            self._state["total_passed"] += 1
        else:
            self._state["failed_scenarios"].append(entry)
            self._state["total_failed"] += 1

        self._state["total_scenarios"] += 1
        self._state["updated_at"] = time.time()
        self._save()

    def mark_blocked(self, scenario_name, reason):
        """Mark a scenario as blocked (cannot proceed)."""
        self._state["blocked_scenarios"].append({
            "scenario": scenario_name,
            "reason": reason,
            "timestamp": time.time(),
        })
        self._state["total_blocked"] += 1
        self._state["updated_at"] = time.time()
        self._save()

    def set_current(self, scenario_name, step=0):
        """Set the currently executing scenario."""
        self._state["current_scenario"] = scenario_name
        self._state["current_step"] = step
        self._state["updated_at"] = time.time()
        self._save()

    def mark_branch_tested(self, branch_name):
        """Mark a full branch as tested."""
        if branch_name in self._state["branch_progress"]:
            self._state["branch_progress"][branch_name]["tested"] = True
            self._save()

    # ── Game State ────────────────────────────────────────────

    def update_game_state(self, game_control):
        """Update state snapshot from the game."""
        try:
            pos = game_control.get_position()
            map_id = game_control.get_map_id()
            map_name = game_control.get_map_name()
            party = game_control.get_party_state()

            self._state["player_position"] = list(pos)
            self._state["current_map_id"] = map_id
            self._state["current_map_name"] = map_name
            self._state["party_state"] = party
            self._state["updated_at"] = time.time()
            self._save()
            return True
        except Exception as e:
            self._state["last_error"] = f"update_game_state: {e}"
            return False

    def add_story_checkpoint(self, name, description=""):
        """Record a story progress checkpoint."""
        self._state["story_checkpoints"].append({
            "name": name,
            "description": description,
            "map_id": self._state["current_map_id"],
            "position": self._state["player_position"],
            "timestamp": time.time(),
        })
        self._save()

    def set_last_error(self, error_text, traceback_text=""):
        """Log an error for debugging."""
        self._state["last_error"] = str(error_text)[:500]
        self._state["last_error_trace"] = str(traceback_text)[:2000]
        self._state["updated_at"] = time.time()
        self._save()

    # ── Resume Logic ─────────────────────────────────────────

    def get_resume_info(self):
        """
        Get information needed to resume testing.
        Returns dict with last position, which scenarios remain, etc.
        """
        return {
            "can_resume": bool(self._state["completed_scenarios"]),
            "last_position": self._state["player_position"],
            "last_map": f"{self._state['current_map_name']} (id={self._state['current_map_id']})",
            "last_save_slot": self._state["last_save_slot"],
            "completed": len(self._state["completed_scenarios"]),
            "failed": len(self._state["failed_scenarios"]),
            "blocked": len(self._state["blocked_scenarios"]),
            "branches_tested": [
                b for b, v in self._state["branch_progress"].items()
                if v["tested"]
            ],
            "branches_remaining": [
                b for b, v in self._state["branch_progress"].items()
                if not v["tested"]
            ],
            "last_scenario": self._state["current_scenario"],
        }

    def is_branch_tested(self, branch_name):
        """Check if a branch has been fully tested."""
        bp = self._state["branch_progress"].get(branch_name, {})
        return bp.get("tested", False)

    def get_scenarios_to_run(self, branch_name):
        """
        Get the number of scenarios that need to still pass for a branch.
        Returns 0 if branch is tested.
        """
        if self.is_branch_tested(branch_name):
            return 0
        return 1  # at minimum, run it

    # ── Summary ──────────────────────────────────────────────

    def get_summary(self):
        """Get a human-readable test summary."""
        bp = self._state["branch_progress"]
        lines = [
            "=" * 60,
            f"TEST AUTOMATION SUMMARY",
            f"=" * 60,
            f"Run #{self._state['test_run_count']}",
            f"Total: {self._state['total_passed']} passed, "
            f"{self._state['total_failed']} failed, "
            f"{self._state['total_blocked']} blocked",
            f"Scenarios completed: {len(self._state['completed_scenarios'])}",
            f"",
            f"Branch Progress:",
        ]
        for branch, data in bp.items():
            status = "✓ DONE" if data["tested"] else "⋯"
            lines.append(f"  {status} {branch}: {data['passed']}P / {data['failed']}F")
        
        if self._state["story_checkpoints"]:
            lines.append(f"")
            lines.append(f"Story Checkpoints ({len(self._state['story_checkpoints'])}):")
            for cp in self._state["story_checkpoints"]:
                lines.append(f"  - {cp['name']} ({cp.get('map_name', '?')})")
        
        if self._state["last_error"]:
            lines.append(f"")
            lines.append(f"Last Error: {self._state['last_error']}")
        
        lines.append(f"=" * 60)
        return "\n".join(lines)

    def write_report(self, extra_sections=None):
        """Write a detailed HTML/text report to the reports directory."""
        ts = time.strftime("%Y%m%d_%H%M%S")
        report_path = STATE_DIR / f"test_report_{ts}.txt"
        
        lines = [self.get_summary()]
        
        if extra_sections:
            lines.extend(["", "", extra_sections])
        
        if self._state["failed_scenarios"]:
            lines.extend(["", f"FAILED SCENARIOS:", "-" * 40])
            for f in self._state["failed_scenarios"]:
                lines.append(f"  ✗ [{f['branch']}] {f['scenario']}")
                details = f.get("details", {})
                for k, v in details.items():
                    if k != "result":
                        lines.append(f"      {k}: {v}")
        
        if self._state["blocked_scenarios"]:
            lines.extend(["", f"BLOCKED SCENARIOS:", "-" * 40])
            for b in self._state["blocked_scenarios"]:
                lines.append(f"  ⊘ {b['scenario']}: {b.get('reason', '')}")
        
        report_text = "\n".join(lines)
        
        with open(report_path, "w") as f:
            f.write(report_text)
        
        return str(report_path)
