#!/usr/bin/env python3
"""
vision_reader.py — Game screen analysis via LM Studio vision.

Takes screenshots from the CDP bridge, sends them to LM Studio's
vision model (gemma-4-e4b-uncensored), and parses the response
to understand what's on screen.
"""

import base64
import json
import time
import urllib.request
import urllib.error
from pathlib import Path

from test_config import LM_STUDIO_CHAT_URL, VISION_MODEL

LM_STUDIO_ENDPOINT = LM_STUDIO_CHAT_URL
VISION_TIMEOUT = 30


class VisionReader:
    """Analyzes game screenshots using LM Studio vision."""

    def __init__(self, bridge, endpoint=LM_STUDIO_ENDPOINT, model=VISION_MODEL):
        self.bridge = bridge
        self.endpoint = endpoint
        self.model = model
        self._last_analysis = None

    def check_available(self):
        """Check if LM Studio vision model is responsive."""
        try:
            payload = json.dumps({
                "model": self.model,
                "messages": [{"role": "user", "content": "ping"}],
                "max_tokens": 5,
            }).encode()
            req = urllib.request.Request(
                self.endpoint,
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                return resp.status == 200
        except Exception:
            return False

    def analyze_screen(self, question="Describe everything visible on this game screen. What text, UI elements, characters, and status indicators do you see?"):
        """
        Take a screenshot and analyze it with vision.
        Returns dict with analysis_text and saved screenshot path.
        """
        # Capture screenshot
        b64_data, screenshot_path = self.bridge.screenshot()

        # Build vision request
        content = [
            {"type": "text", "text": question},
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/png;base64,{b64_data}",
                },
            },
        ]

        payload = json.dumps({
            "model": self.model,
            "messages": [{"role": "user", "content": content}],
            "max_tokens": 1024,
            "temperature": 0.3,
        }).encode()

        try:
            req = urllib.request.Request(
                self.endpoint,
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=VISION_TIMEOUT) as resp:
                response = json.loads(resp.read().decode())
                analysis_text = response.get("choices", [{}])[0].get("message", {}).get("content", "")
        except Exception as e:
            analysis_text = f"[Vision Error: {e}]"

        result = {
            "timestamp": time.time(),
            "question": question,
            "analysis": analysis_text,
            "screenshot_path": screenshot_path,
            "screenshot_b64": b64_data,
        }
        self._last_analysis = result
        return result

    def detect_dialogue_text(self):
        """Specifically look for dialogue/chat text on screen."""
        return self.analyze_screen(
            "Read any dialogue or text boxes visible on this game screen. "
            "What is being said? Who is speaking? Report the exact text you see."
        )

    def detect_health_status(self):
        """Analyze party health from the screen."""
        return self.analyze_screen(
            "Look at the health/status bars and indicators. "
            "For each party member, what is their HP percentage? "
            "Are there any status effects visible (poison, bleeding, etc.)? "
            "Format as a structured list."
        )

    def detect_menu_screen(self):
        """Identify what menu is currently open."""
        return self.analyze_screen(
            "What menu or screen is currently open? "
            "Read all menu option text. What is the title? "
            "What options are available? Report exactly."
        )

    def detect_battle_screen(self):
        """Analyze the battle scene."""
        return self.analyze_screen(
            "Analyze this battle screen. What enemies are visible? "
            "What are their names? What combat options are shown? "
            "Are there any status indicators, turn numbers, or dialogue? "
            "Report every detail you can see."
        )

    def verify_position(self, expected_desc):
        """Ask if the screen matches an expected location/state."""
        return self.analyze_screen(
            f"Is this location '{expected_desc}'? "
            f"Describe the environment, what map/area you think this is, "
            f"and any landmarks or identifying features."
        )

    def read_ai_chat_response(self):
        """Read the AI companion's chat response from the screen."""
        return self.analyze_screen(
            "Read the AI companion's chat response text visible on screen. "
            "What did the companion say? Report the exact response text. "
            "Also check if there's a chat input field visible."
        )


# ── Standalone test ──────────────────────────────────────────

if __name__ == "__main__":
    from cdp_bridge import CDPBridge

    bridge = CDPBridge()
    try:
        bridge.launch_game(headless=True)
        bridge.connect()

        vr = VisionReader(bridge)
        available = vr.check_available()
        print(f"Vision model available: {available}")

        if available:
            result = vr.analyze_screen()
            print(f"\nScreenshot: {result['screenshot_path']}")
            print(f"Analysis:\n{result['analysis'][:500]}")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        bridge.kill()
