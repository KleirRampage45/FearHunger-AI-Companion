#!/usr/bin/env python3
"""
cdp_bridge.py — Chrome DevTools Protocol bridge for NW.js (Fear & Hunger)

Connects to NW.js via CDP websocket, injects JS, takes screenshots,
simulates keyboard input, captures console output.

NW.js v0.49.2 = Chromium 86 — CDP commands are limited but Runtime.evaluate works.
"""

import asyncio
import json
import os
import subprocess
import time
import websocket
import base64
from pathlib import Path

from test_config import CDP_PORT, CDP_WS_TIMEOUT, GAME_DIR, NW_BINARY, REPORTS_DIR

CDP_URL = f"http://127.0.0.1:{CDP_PORT}/json"


class CDPBridge:
    """Low-level CDP connection to NW.js game instance."""

    def __init__(self, port=CDP_PORT):
        self.port = port
        self.cdp_url = f"http://127.0.0.1:{self.port}/json"
        self.ws = None
        self.page_id = None
        self._nw_process = None
        self._stdout_file = None
        self._stderr_file = None
        self._msg_id = 0
        self._console_log = []

    # ── Lifecycle ──────────────────────────────────────────────

    def launch_game(self, headless=False, show_devtools=False):
        """Launch NW.js with CDP enabled. Returns True on success."""
        if self._nw_process:
            return True

        if not NW_BINARY.exists():
            raise RuntimeError(f"NW binary not found: {NW_BINARY}")
        if not GAME_DIR.exists():
            raise RuntimeError(f"Game directory not found: {GAME_DIR}")

        args = [str(NW_BINARY), f"--remote-debugging-port={self.port}"]
        if headless:
            args.append("--headless")
        if show_devtools:
            args.append("--auto-open-devtools-for-tabs")
        args.append(".")  # current dir = game dir

        env = os.environ.copy()
        env.setdefault("DISPLAY", ":0")
        env["GDK_BACKEND"] = os.environ.get("FH_GDK_BACKEND", "x11")
        env.pop("WAYLAND_DISPLAY", None)

        REPORTS_DIR.mkdir(exist_ok=True)
        self._stdout_file = open(REPORTS_DIR / "nw_stdout.log", "ab")
        self._stderr_file = open(REPORTS_DIR / "nw_stderr.log", "ab")

        self._nw_process = subprocess.Popen(
            args,
            cwd=str(GAME_DIR),
            stdout=self._stdout_file,
            stderr=self._stderr_file,
            env=env,
        )

        # Wait for CDP to become available
        deadline = time.time() + CDP_WS_TIMEOUT
        while time.time() < deadline:
            try:
                pages = self._get_pages()
                if pages:
                    return True
            except Exception:
                pass
            if self._nw_process.poll() is not None:
                break
            time.sleep(1)

        stderr_tail = self._read_tail(REPORTS_DIR / "nw_stderr.log")
        self.kill()
        raise RuntimeError("NW.js failed to start CDP within timeout. stderr tail: " + stderr_tail)

    def connect(self):
        """Connect to the first available page via websocket."""
        pages = self._get_pages()
        if not pages:
            raise RuntimeError("No pages available in NW.js")

        # Find the game page (index.html) or use the first page
        target = None
        for p in pages:
            url = p.get("url", "")
            if "index.html" in url or "www" in url:
                target = p
                break
        if not target:
            target = pages[0]

        ws_url = target["webSocketDebuggerUrl"]
        self.page_id = target["id"]
        self.ws = websocket.create_connection(ws_url, timeout=10)
        self._msg_id = 0
        self._console_log = []

        # Enable runtime and console
        self._send("Runtime.enable")
        self._send("Console.enable")
        self._send("Page.enable")

        # Drain any initial messages
        self._drain(timeout=0.5)

        return True

    def kill(self):
        """Terminate NW.js process and close websocket."""
        if self.ws:
            try:
                self.ws.close()
            except Exception:
                pass
            self.ws = None
        if self._nw_process:
            try:
                self._nw_process.terminate()
                self._nw_process.wait(timeout=3)
            except Exception:
                self._nw_process.kill()
            self._nw_process = None
        for handle in (self._stdout_file, self._stderr_file):
            if handle:
                try:
                    handle.close()
                except Exception:
                    pass
        self._stdout_file = None
        self._stderr_file = None

    def restart(self):
        """Kill and relaunch everything."""
        self.kill()
        time.sleep(1)
        self.launch_game()
        self.connect()

    # ── JS Injection ───────────────────────────────────────────

    def js(self, code, await_promise=False, timeout=10):
        """
        Execute JavaScript in the game context and return the result.
        
        Args:
            code: JavaScript code string
            await_promise: If True, waits for Promise resolution
            timeout: Max seconds to wait for result
            
        Returns:
            The JS return value (deserialized from JSON)
        """
        cmd = {
            "expression": code,
            "returnByValue": True,
            "awaitPromise": await_promise,
        }
        result = self._send("Runtime.evaluate", cmd, timeout=timeout)
        
        if "result" in result:
            res = result["result"]
            if "exceptionDetails" in res:
                exc = res["exceptionDetails"]
                text = exc.get("text", "") or exc.get("exception", {}).get("description", "Unknown JS error")
                raise RuntimeError(f"JS Error: {text}")
            if "value" in res:
                return res["value"]
            if "subtype" in res and res["subtype"] == "promise":
                return None  # pending promise, caller should retry
        return None

    async def js_async(self, code, timeout=15):
        """Async wrapper for JS injection using asyncio loop."""
        return self.js(code, await_promise=True, timeout=timeout)

    # ── Screenshot ─────────────────────────────────────────────

    def screenshot(self, format="png"):
        """
        Capture game screenshot via CDP.
        Returns (base64_data, path_to_saved_file).
        """
        result = self._send("Page.captureScreenshot", {"format": format})
        data = result.get("data", "")
        if not data:
            raise RuntimeError("Screenshot returned empty data")

        # Save to reports directory
        reports_dir = REPORTS_DIR
        reports_dir.mkdir(exist_ok=True)
        ts = time.strftime("%Y%m%d_%H%M%S")
        fname = reports_dir / f"screenshot_{ts}.{format}"
        with open(fname, "wb") as f:
            f.write(base64.b64decode(data))

        return data, str(fname)

    # ── Keyboard Input ─────────────────────────────────────────

    def press_key(self, key_code, modifiers=0):
        """
        Simulate a key press via CDP Input.dispatchKeyEvent.
        Common key_codes: 67=C, 13=Enter, 27=Escape, 38=Up, 40=Down,
                         37=Left, 39=Right, 32=Space, 9=Tab
        """
        key_map = {
            67: "KeyC", 13: "Enter", 27: "Escape",
            38: "ArrowUp", 40: "ArrowDown",
            37: "ArrowLeft", 39: "ArrowRight",
            32: "Space", 9: "Tab",
        }
        key_str = key_map.get(key_code, f"U+{key_code:04X}")

        # Key down
        self._send("Input.dispatchKeyEvent", {
            "type": "rawKeyDown",
            "windowsVirtualKeyCode": key_code,
            "key": key_str,
            "code": key_str,
            "modifiers": modifiers,
        })
        # Key up
        self._send("Input.dispatchKeyEvent", {
            "type": "keyUp",
            "windowsVirtualKeyCode": key_code,
            "key": key_str,
            "code": key_str,
            "modifiers": modifiers,
        })

    def type_text(self, text):
        """Type a string of text by dispatching character events."""
        for ch in text:
            self._send("Input.dispatchKeyEvent", {
                "type": "char",
                "text": ch,
                "key": ch,
                "code": f"Key{ch.upper()}" if ch.isalpha() else ch,
            })
            time.sleep(0.02)  # small delay between chars

    # ── Console Capture ────────────────────────────────────────

    def get_console_log(self):
        """Return and clear captured console log buffer."""
        msgs = list(self._console_log)
        self._console_log.clear()
        return msgs

    def drain_console(self):
        """Read console messages without clearing."""
        msgs = list(self._console_log)
        return msgs

    # ── Internal ───────────────────────────────────────────────

    def _get_pages(self):
        """GET /json to list available pages."""
        import urllib.request
        url = self.cdp_url
        try:
            with urllib.request.urlopen(url, timeout=5) as resp:
                data = resp.read().decode()
            pages = json.loads(data)
            return [p for p in pages if p.get("type") == "page"]
        except Exception:
            return []

    def _read_tail(self, path, max_chars=1200):
        try:
            with open(path, "rb") as f:
                data = f.read()[-max_chars:]
            return data.decode(errors="replace").replace("\n", " | ")
        except Exception:
            return ""

    def _send(self, method, params=None, timeout=10):
        """Send a CDP command and wait for response."""
        if not self.ws and method != "Runtime.evaluate":
            # Try lazy connect
            pass

        self._msg_id += 1
        msg = {"id": self._msg_id, "method": method}
        if params:
            msg["params"] = params

        self.ws.send(json.dumps(msg))
        self.ws.settimeout(timeout)

        # Read responses until we find our ID
        while True:
            try:
                raw = self.ws.recv()
            except websocket.WebSocketTimeoutException:
                raise TimeoutError(f"CDP command {method} timed out after {timeout}s")
            
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            # Handle console messages
            if data.get("method") == "Console.messageAdded":
                msg_data = data.get("params", {}).get("message", {})
                self._console_log.append({
                    "level": msg_data.get("level", "log"),
                    "text": msg_data.get("text", ""),
                    "timestamp": time.time(),
                })
                continue

            # Handle Runtime.consoleAPICalled
            if data.get("method") == "Runtime.consoleAPICalled":
                params = data.get("params", {})
                args = params.get("args", [])
                text = " ".join(str(a.get("value", str(a))) for a in args if "value" in a)
                self._console_log.append({
                    "level": params.get("type", "log"),
                    "text": text,
                    "timestamp": time.time(),
                })
                continue

            # Match our response
            if data.get("id") == self._msg_id:
                if "error" in data:
                    raise RuntimeError(f"CDP error: {data['error']}")
                return data.get("result", {})

    def _drain(self, timeout=1.0):
        """Drain any pending messages without matching."""
        if not self.ws:
            return
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                self.ws.settimeout(0.1)
                raw = self.ws.recv()
                data = json.loads(raw)
                if data.get("method") == "Console.messageAdded":
                    msg_data = data.get("params", {}).get("message", {})
                    self._console_log.append({
                        "level": msg_data.get("level", "log"),
                        "text": msg_data.get("text", ""),
                    })
            except (websocket.WebSocketTimeoutException, json.JSONDecodeError, ConnectionError):
                break
            except Exception:
                break


# ── Quick test when run directly ──────────────────────────────

if __name__ == "__main__":
    import sys
    
    bridge = CDPBridge()
    try:
        print("Launching NW.js...")
        bridge.launch_game(headless=True)
        print("Connecting via CDP...")
        bridge.connect()
        
        # Test JS injection
        result = bridge.js("2 + 2")
        print(f"JS test: 2+2 = {result}")
        
        # Test game-specific query
        game_loaded = bridge.js("typeof AI_Companion !== 'undefined'")
        print(f"AI_Companion loaded: {game_loaded}")
        
        if game_loaded:
            companion_name = bridge.js("AI_Companion.Config.companionName")
            print(f"Companion name: {companion_name}")
        
        # Test screenshot
        data, path = bridge.screenshot()
        print(f"Screenshot saved: {path} ({len(data)} bytes base64)")
        
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
    finally:
        bridge.kill()
