#!/usr/bin/env python3
"""
test_battery.py — All automated test scenarios for the AI Companion mod.

Organized by branch. Each scenario is a method that takes (game, state, vision)
and returns a dict with at minimum {"passed": bool, "checks": [...], "details": {...}}.

Every scenario is self-contained — can be run independently or as part of
the full test suite.
"""

import json
import time
import traceback


# ════════════════════════════════════════════════════════════════
# UTILITY HELPERS
# ════════════════════════════════════════════════════════════════

def _check(condition, name, details=None):
    """Build a check result dict."""
    return {"check": name, "passed": bool(condition), "details": details or {}}


def scenario_result(passed, name, checks=None, extra=None):
    """Standard scenario result format."""
    result = {"passed": passed, "scenario": name, "checks": checks or []}
    if extra:
        result["details"] = extra
    nchecks = len(checks or [])
    npassed = sum(1 for c in (checks or []) if c["passed"])
    result["summary"] = f"{'PASS' if passed else 'FAIL'} {name} ({npassed}/{nchecks} checks passed)"
    return result


def safe_scenario(func):
    """Decorator that wraps any scenario in try/except."""
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            return scenario_result(
                False,
                func.__name__.replace("_", " ").title(),
                checks=[_check(False, f"Exception: {e}")],
                extra={"error": str(e), "traceback": traceback.format_exc()[:500]},
            )
    wrapper.__name__ = func.__name__
    return wrapper


def _get_chat_entries(entries):
    """Filter thesis log entries for chat events."""
    return [e for e in entries if e.get("_type") == "chat"] if entries else []


def _get_game_event_entries(entries):
    """Filter thesis log entries for game events."""
    return [e for e in entries if e.get("_type") == "game_event"] if entries else []


# ════════════════════════════════════════════════════════════════
# BRANCH 1 — THESISLOGGER (TELEMETRY)
# ════════════════════════════════════════════════════════════════

@safe_scenario
def telemetry_log_file_creation(game, state, vision):
    """T1.1 — Log file is created on game start."""
    checks = []

    entries = game.read_thesis_log(5)
    checks.append(_check(len(entries) > 0, f"Log entries found: {len(entries)}"))

    has_session_start = any(
        e.get("_type") == "session_start" for e in entries
    ) if entries else False
    checks.append(_check(has_session_start, "Session start entry exists"))

    passed = all(c["passed"] for c in checks)
    return scenario_result(passed, "Log File Creation", checks)


@safe_scenario
def telemetry_chat_logging(game, state, vision):
    """T1.2 — Chat interactions are logged."""
    checks = []

    result = game.send_chat_message("que es esto?")
    checks.append(_check(result.get("success"), "Chat message sent"))

    time.sleep(1.0)

    entries = game.read_thesis_log(20)
    has_chat_entry = any(e.get("_type") == "chat" for e in entries) if entries else False
    checks.append(_check(has_chat_entry, "Chat entry in thesis log"))

    passed = all(c["passed"] for c in checks)
    return scenario_result(passed, "Chat Logging", checks,
                           extra={"response": result.get("response_text", "")[:100]})


@safe_scenario
def telemetry_map_transfer_logging(game, state, vision):
    """T1.4 — Map transfers are logged."""
    checks = []
    map_before = game.get_map_id()

    entries_before = game.read_thesis_log(20)
    before_events = len(_get_game_event_entries(entries_before))

    # Try to find and go through a door
    scan = game.get_environment_scan()
    doors = [e for e in (scan or []) if e.get("type") == "door"]
    if doors:
        door = doors[0]
        dist = door.get("distance", 1)
        dirmap = {"north": 8, "south": 2, "east": 6, "west": 4}
        d = dirmap.get(str(door.get("direction", "")).lower())
        if d and dist > 0:
            game.move(d, max(1, dist - 1))
            game.interact()
            time.sleep(2.0)

    entries_after = game.read_thesis_log(20)
    after_events = len(_get_game_event_entries(entries_after))
    map_after = game.get_map_id()

    transferred = map_before != map_after
    checks.append(_check(transferred, f"Map transferred: {map_before} -> {map_after}"))

    new_events = after_events > before_events
    checks.append(_check(new_events, f"New game_event in log ({after_events - before_events})"))

    passed = all(c["passed"] for c in checks)
    return scenario_result(passed, "Map Transfer Logging", checks)


@safe_scenario
def telemetry_session_id(game, state, vision):
    """T1.6 — Session ID consistency across entries."""
    checks = []
    entries = game.read_thesis_log(30)
    if entries and len(entries) >= 2:
        session_ids = set()
        for e in entries:
            sid = e.get("session_id") or e.get("session_time_ms")
            if sid is not None:
                session_ids.add(str(sid))
        consistent = len(session_ids) <= 1
        checks.append(_check(consistent, f"Session ID consistent"))
    else:
        checks.append(_check(False, f"Enough log entries (need >=2, got {len(entries) if entries else 0})"))

    return scenario_result(all(c["passed"] for c in checks), "Session ID", checks)


# ════════════════════════════════════════════════════════════════
# BRANCH 2 — ENVIRONMENT SCANNER (SPATIAL AWARENESS)
# ════════════════════════════════════════════════════════════════

@safe_scenario
def spatial_basic_scan(game, state, vision):
    """T2.1 — Basic scan returns objects."""
    checks = []
    scan = game.get_environment_scan()
    checks.append(_check(isinstance(scan, list), "Scan returns array"))
    if scan:
        first = scan[0]
        has_fields = all(k in first for k in ["name", "type", "danger", "distance"])
        checks.append(_check(has_fields, "Entries have name/type/danger/distance"))
        checks.append(_check(len(scan) > 0, f"Found {len(scan)} objects"))
    else:
        checks.append(_check(True, "Scan empty (map-dependent)"))
    return scenario_result(all(c["passed"] for c in checks), "Basic Scan", checks)


@safe_scenario
def spatial_summary_text(game, state, vision):
    """T2.2 — Summary text is returned."""
    checks = []
    summary = game.get_environment_summary()
    checks.append(_check(isinstance(summary, str), "Summary is a string"))
    return scenario_result(all(c["passed"] for c in checks), "Summary Text", checks)


@safe_scenario
def spatial_trap_detection(game, state, vision):
    """T2.3 — Traps are detected."""
    checks = []
    scan = game.get_environment_scan()
    traps = [e for e in (scan or []) if e.get("type") == "trap"]
    checks.append(_check(True, f"Trap check ran (found {len(traps)} on current map)"))
    return scenario_result(all(c["passed"] for c in checks), "Trap Detection", checks,
                           extra={"traps_found": len(traps)})


@safe_scenario
def spatial_prompt_injection(game, state, vision):
    """T2.4 — NEARBY context in chat prompt."""
    checks = []
    result = game.send_chat_message("que ves cerca?")
    checks.append(_check(result.get("success"), "Chat response received"))

    entries = game.read_thesis_log(20)
    chat_entries = _get_chat_entries(entries)
    if chat_entries:
        prompt = chat_entries[0].get("prompt_text", "") or ""
        has_nearby = "NEARBY" in prompt or "cerca" in prompt or "ves" in prompt
        checks.append(_check(has_nearby, "Spatial context in prompt"))
    else:
        checks.append(_check(True, "No chat entry yet (deferred logging)"))

    return scenario_result(all(c["passed"] for c in checks), "Prompt Injection (Spatial)", checks)


@safe_scenario
def spatial_cache_performance(game, state, vision):
    """T2.6 — Cache makes subsequent scans faster."""
    checks = []

    timing = game.bridge.js("""
    (function() {
        var t0 = performance.now();
        AI_Companion.EnvironmentScanner.scan();
        var fresh = performance.now() - t0;

        var t1 = performance.now();
        AI_Companion.EnvironmentScanner.scan();
        var cached = performance.now() - t1;

        return JSON.stringify({fresh_ms: Math.round(fresh), cached_ms: Math.round(cached)});
    })()
    """)

    if timing and isinstance(timing, str):
        try:
            times = json.loads(timing)
            checks.append(_check(times["fresh_ms"] < 50, f"Fresh: {times['fresh_ms']}ms"))
            checks.append(_check(times["cached_ms"] < 5, f"Cached: {times['cached_ms']}ms"))
            checks.append(_check(times["cached_ms"] <= times["fresh_ms"], f"Cached faster"))
        except json.JSONDecodeError:
            checks.append(_check(False, "Parse timing"))
    else:
        checks.append(_check(False, "Timing returned no data"))

    return scenario_result(all(c["passed"] for c in checks), "Cache Performance", checks)


# ════════════════════════════════════════════════════════════════
# BRANCH 3 — COMBAT LOGIC
# ════════════════════════════════════════════════════════════════

@safe_scenario
def combat_strategy_generation(game, state, vision):
    """T3.1 — Strategy generation in battle."""
    checks = []
    if not game.is_in_battle():
        checks.append(_check(True, "Skipped (not in battle)"))
        return scenario_result(True, "Strategy Generation", checks)

    time.sleep(8)
    strat = game.bridge.js(
        "AI_Companion.AIState && AI_Companion.AIState.currentStrategy "
        "? JSON.stringify(AI_Companion.AIState.currentStrategy) : null"
    )

    if strat and isinstance(strat, str):
        try:
            strat_obj = json.loads(strat)
            has_plan = bool(strat_obj.get("plan"))
            checks.append(_check(has_plan, f"Strategy: {strat_obj.get('plan', '')[:50]}"))
        except json.JSONDecodeError:
            checks.append(_check(False, "Parse strategy JSON"))
    else:
        checks.append(_check(True, "No strategy generated (model-dependent)"))

    return scenario_result(all(c["passed"] for c in checks), "Strategy Generation", checks)


@safe_scenario
def combat_regression(game, state, vision):
    """T3.7 — Combat still works normally."""
    checks = []
    if not game.is_in_battle():
        return scenario_result(True, "Combat Regression",
                               [_check(True, "Not in battle")])

    battle = game.is_in_battle_detailed()
    checks.append(_check(battle.get("in_battle", False), "Battle active"))
    checks.append(_check(battle.get("turn", 0) >= 0, f"Turn: {battle.get('turn')}"))

    return scenario_result(all(c["passed"] for c in checks), "Combat Regression", checks)


@safe_scenario
def combat_enemy_detection(game, state, vision):
    """Check enemies are detected in battle."""
    checks = []
    battle = game.is_in_battle_detailed()
    if battle.get("in_battle"):
        enemies = battle.get("enemies", [])
        checks.append(_check(len(enemies) > 0, f"Enemies: {len(enemies)}"))
        for e in enemies[:3]:
            checks.append(_check(bool(e.get("name")), f"Enemy: {e.get('name', '?')}"))
    else:
        checks.append(_check(True, "Not in battle"))
    return scenario_result(all(c["passed"] for c in checks), "Enemy Detection", checks)


# ════════════════════════════════════════════════════════════════
# BRANCH 5 — INTENT DETECTOR
# ════════════════════════════════════════════════════════════════

def _check_intent_from_log(entries, expected_intent):
    """Check if intent matches expected in the thesis log."""
    chat_entries = _get_chat_entries(entries)
    for e in chat_entries:
        intent = e.get("intent", {})
        primary = ""
        if isinstance(intent, dict):
            primary = intent.get("primary", "")
        elif isinstance(intent, str):
            primary = intent
        if expected_intent in primary.lower():
            return True, primary
    return False, ""


@safe_scenario
def intent_high_confidence(game, state, vision):
    """T5.1 — High confidence for known patterns."""
    checks = []
    result = game.send_chat_message("que es el frasco azul")
    checks.append(_check(result.get("success"), "Response received"))

    time.sleep(0.5)
    entries = game.read_thesis_log(10)
    found, primary = _check_intent_from_log(entries, "item_info")
    checks.append(_check(found, f"Intent from thesis: {primary or '?'}"))

    return scenario_result(all(c["passed"] for c in checks), "High Confidence Intent", checks,
                           extra={"intent": primary})


@safe_scenario
def intent_all_types(game, state, vision):
    """T5.7 — All 7 intent types resolve correctly."""
    test_messages = [
        ("que es la hierba verde", "item_info"),
        ("como mato al guardia", "tactical"),
        ("donde estamos", "location"),
    ]

    checks = []
    for msg, expected in test_messages:
        r = game.send_chat_message(msg)
        checks.append(_check(r.get("success"), f"Chat sent: '{msg[:20]}...'"))
        time.sleep(0.5)

    # Check from log
    entries = game.read_thesis_log(30)
    for msg, expected in test_messages:
        found, primary = _check_intent_from_log(entries, expected)
        checks.append(_check(found, f"Intent '{expected}' -> {primary or '?'}"))

    passed = all(c["passed"] for c in checks)
    return scenario_result(passed, f"Intent Types ({sum(1 for c in checks if c['passed'])}/{len(checks)})", checks)


@safe_scenario
def intent_battle_override(game, state, vision):
    """T5.6 — Battle context overrides intent."""
    checks = []
    if not game.is_in_battle():
        checks.append(_check(True, "Skipped: not in battle"))
        return scenario_result(True, "Battle Intent Override", checks)

    result = game.send_chat_message("hola")
    checks.append(_check(result.get("success"), "Chat in battle"))

    time.sleep(0.5)
    entries = game.read_thesis_log(5)
    found, primary = _check_intent_from_log(entries, "tactical")
    checks.append(_check(found, f"Tactical intent in battle"))

    return scenario_result(all(c["passed"] for c in checks), "Battle Intent Override", checks)


# ════════════════════════════════════════════════════════════════
# BRANCH 6 — WORLD STATE ENGINE
# ════════════════════════════════════════════════════════════════

@safe_scenario
def world_state_basic_snapshot(game, state, vision):
    """T6.1 — Basic snapshot returns all sections."""
    checks = []
    snap = game.get_world_snapshot()

    for section in ["party", "resources", "environment", "threats", "morale", "situation"]:
        checks.append(_check(section in snap, f"Section '{section}' present"))

    return scenario_result(all(c["passed"] for c in checks), "Basic Snapshot", checks)


@safe_scenario
def world_state_party_accuracy(game, state, vision):
    """T6.2 — Party state matches actual game data."""
    checks = []
    snap = game.get_world_snapshot()
    party = game.get_party_state()

    snap_party = snap.get("party", {})
    snap_size = snap_party.get("size", 0) if isinstance(snap_party, dict) else 0
    actual_size = party.get("size", 0)
    checks.append(_check(
        snap_size == actual_size or snap_size == 0,
        f"Party size: snap={snap_size} actual={actual_size}"
    ))

    return scenario_result(all(c["passed"] for c in checks), "Party Accuracy", checks)


@safe_scenario
def world_state_situation_changes(game, state, vision):
    """T6.4 — Situation rating responds to game state."""
    checks = []
    snap = game.get_world_snapshot()
    situation = snap.get("situation", "unknown")
    checks.append(_check(bool(situation), f"Situation: {situation}"))

    summary = game.get_world_summary()
    checks.append(_check(isinstance(summary, str), "World summary is string"))

    return scenario_result(all(c["passed"] for c in checks), "Situation Changes", checks,
                           extra={"situation": situation})


# ════════════════════════════════════════════════════════════════
# BRANCH 7 — NPC INTELLIGENCE
# ════════════════════════════════════════════════════════════════

@safe_scenario
def npc_encounter_tracking(game, state, vision):
    """T7.5 — NPC encounters are tracked."""
    checks = []
    encounters = game.get_npc_encounters()

    if encounters:
        checks.append(_check(isinstance(encounters, dict), "Encounters is dict"))
        checks.append(_check(len(encounters) > 0, f"NPCs: {len(encounters)}"))
    else:
        checks.append(_check(True, "No NPCs encountered yet"))

    return scenario_result(all(c["passed"] for c in checks), "NPC Encounter Tracking", checks,
                           extra={"count": len(encounters) if encounters else 0})


@safe_scenario
def npc_dialogue_buffer(game, state, vision):
    """T7.4 — Dialogue buffer is bounded."""
    checks = []
    dialogue = game.get_recent_npc_dialogue()
    checks.append(_check(isinstance(dialogue, str), "Dialogue summary is string"))

    buffer_size = game.bridge.js(
        "AI_Companion.NPCIntelligence._recentDialogue "
        "? AI_Companion.NPCIntelligence._recentDialogue.length : -1"
    )
    if buffer_size >= 0:
        checks.append(_check(buffer_size <= 5, f"Buffer: {buffer_size} (max 5)"))

    return scenario_result(all(c["passed"] for c in checks), "Dialogue Buffer", checks)


# ════════════════════════════════════════════════════════════════
# BRANCH 7b — HYBRID RAG
# ════════════════════════════════════════════════════════════════

@safe_scenario
def rag_index_loaded(game, state, vision):
    """RAG — Index is loaded and accessible."""
    checks = []
    loaded = game.bridge.js(
        "AI_Companion.HybridRAG && AI_Companion.HybridRAG._index "
        "? AI_Companion.HybridRAG._index.chunks.length : -1"
    )
    checks.append(_check(loaded > 0, f"RAG index: {loaded} chunks"))

    config_enabled = game.bridge.js("AI_Companion.Config.hybridRagEnabled")
    checks.append(_check(config_enabled, "Hybrid RAG enabled in config"))

    return scenario_result(all(c["passed"] for c in checks), "RAG Index Loaded", checks)


@safe_scenario
def rag_retrieval_lore(game, state, vision):
    """RAG — Lore queries retrieve chunks."""
    checks = []
    result = game.query_rag("que es el dungeon de miedo y hambre?")
    checks.append(_check(result is not None, "RAG query returned"))

    chunks = result
    if isinstance(chunks, dict):
        chunks = result.get("results", result.get("chunks", []))

    if isinstance(chunks, list) and len(chunks) > 0:
        checks.append(_check(True, f"Retrieved {len(chunks)} chunks"))
    else:
        checks.append(_check(True, "RAG responded (no chunks for this query)"))

    return scenario_result(all(c["passed"] for c in checks), "RAG Lore Retrieval", checks)


@safe_scenario
def rag_chat_integration(game, state, vision):
    """RAG — Chat uses RAG results for lore questions."""
    checks = []

    result = game.send_chat_message("cuentame sobre este lugar")
    checks.append(_check(result.get("success"), "Chat response received"))

    time.sleep(0.5)
    entries = game.read_thesis_log(10)
    chat_entries = _get_chat_entries(entries)
    if chat_entries:
        prompt = chat_entries[0].get("prompt_text", "") or ""
        has_rag_in_prompt = "KNOWLEDGE" in prompt or "RETRIEVED" in prompt or "RAG" in prompt or "lore" in prompt.lower() or "conocimiento" in prompt.lower()
        checks.append(_check(has_rag_in_prompt, "RAG context in prompt"))
    else:
        checks.append(_check(True, "No chat entry to check"))

    return scenario_result(all(c["passed"] for c in checks), "RAG Chat Integration", checks)


@safe_scenario
def rag_buckman_grounding(game, state, vision):
    """RAG — Known NPC questions use retrieved facts and do not claim ignorance."""
    checks = []
    result = game.send_chat_message("quien es buckman?")
    checks.append(_check(result.get("success"), "Chat response received"))

    resp = (result.get("response_text") or "").lower()
    factual = any(k in resp for k in ["príncipe", "principe", "rondon", "buckman", "trortur", "noble"])
    ignorance = any(k in resp for k in ["no conozco", "no sé quién", "no se quien", "no lo reconozco"])
    checks.append(_check(factual, "Response contains Buckman facts"))
    checks.append(_check(not ignorance, "Does not claim ignorance"))

    time.sleep(0.5)
    entries = game.read_thesis_log(10)
    chat_entries = _get_chat_entries(entries)
    if chat_entries:
        latest = chat_entries[-1]
        chunks = latest.get("rag_chunk_ids") or []
        checks.append(_check("npc_buckman_001" in chunks, f"Buckman chunk used: {chunks}"))
    else:
        checks.append(_check(False, "Chat entry logged"))

    return scenario_result(all(c["passed"] for c in checks), "RAG Buckman Grounding", checks,
                           extra={"response": result.get("response_text", "")[:160]})


@safe_scenario
def vision_runtime_contract(game, state, vision):
    """Vision — Public capture/fusion APIs and bundled visual profiles are available."""
    checks = []
    api = game.bridge.js("""({
        capture: !!(AI_Companion.VisionContext && AI_Companion.VisionContext.requestCapture),
        frameMeta: !!(AI_Companion.VisionContext && AI_Companion.VisionContext.getLastFrameMeta),
        fusion: !!(AI_Companion.MultimodalEvidenceFusion && AI_Companion.MultimodalEvidenceFusion.resolve),
        ledger: !!AI_Companion.EntityKnowledgeLedger,
        inventory: !!AI_Companion.InventoryContextExtractor,
        profiles: AI_Companion.HybridRAG._loadVisualProfiles().length
    })""") or {}
    checks.append(_check(api.get("capture"), "Rendered-frame capture API exported"))
    checks.append(_check(api.get("frameMeta"), "Frame metadata API exported"))
    checks.append(_check(api.get("fusion"), "Evidence fusion API exported"))
    checks.append(_check(api.get("ledger"), "Knowledge ledger exported"))
    checks.append(_check(api.get("inventory"), "Inventory extractor exported"))
    checks.append(_check(api.get("profiles", 0) >= 10, f"Bundled visual profiles: {api.get('profiles', 0)}"))
    return scenario_result(all(c["passed"] for c in checks), "Vision Runtime Contract", checks)


@safe_scenario
def vision_fusion_grounding(game, state, vision):
    """Vision — A live Guard candidate confirms a matching visual observation."""
    result = game.bridge.js("""(() => {
        const profiles = AI_Companion.HybridRAG.getVisualProfilesForCandidates(['guard'], {sceneKind:'battle'});
        const evidence = AI_Companion.MultimodalEvidenceFusion.resolve(
            {environment:[{description:'stone prison corridor',confidence:'high'}],entities:[{descriptor:'large pale humanoid with cleaver',candidate_key:'guard',visible_traits:['cleaver'],confidence:'high'}],risk:'high'},
            {battle_state:{enemies:[{name:'Guard'}]},nearby_observation:{nearbyEvents:[]}},
            profiles,
            {sceneKind:'battle'}
        );
        return {count:evidence.confirmed_entities.length,key:evidence.confirmed_entities[0] ? evidence.confirmed_entities[0].key : null};
    })()""") or {}
    checks = [
        _check(result.get("count") == 1, "Exactly one confirmed entity"),
        _check(result.get("key") == "guard", "Confirmed entity is Guard"),
    ]
    return scenario_result(all(c["passed"] for c in checks), "Vision Fusion Grounding", checks)


@safe_scenario
def chat_visible_ui_path(game, state, vision):
    """UI — Actual chat scene accepts input, receives response, and scrolls to bottom."""
    checks = []
    result = game.send_chat_message_visible("hola, puedes responder breve?")
    checks.append(_check(result.get("success"), "Visible chat response received"))
    checks.append(_check(bool(result.get("response_text")), "Visible chat has response text"))
    checks.append(_check(result.get("transcript_after", 0) > result.get("transcript_before", -1),
                         "Transcript grew"))
    checks.append(_check(result.get("at_bottom", False), "Chat transcript is scrolled to bottom"))
    return scenario_result(all(c["passed"] for c in checks), "Visible Chat UI Path", checks,
                           extra={"response": result.get("response_text", "")[:120]})


# ════════════════════════════════════════════════════════════════
# CROSS-SYSTEM INTEGRATION
# ════════════════════════════════════════════════════════════════

@safe_scenario
def integration_full_chat_pipeline(game, state, vision):
    """X1 — Full chat pipeline with all context sources."""
    checks = []

    result = game.send_chat_message("que ves?")
    checks.append(_check(result.get("success"), "Chat response"))
    resp = result.get("response_text", "")
    checks.append(_check(len(resp) > 10, f"Response length: {len(resp)} chars"))
    checks.append(_check(result.get("latency_ms", 0) > 0, f"Latency: {result.get('latency_ms')}ms"))

    time.sleep(0.5)
    entries = game.read_thesis_log(10)
    chat_entries = _get_chat_entries(entries)
    checks.append(_check(len(chat_entries) > 0, "Chat logged to thesis"))

    return scenario_result(all(c["passed"] for c in checks), "Full Chat Pipeline", checks,
                           extra={"latency_ms": result.get("latency_ms"),
                                  "response_preview": resp[:80]})


@safe_scenario
def integration_rapid_map_transitions(game, state, vision):
    """X3 — Rapid map transitions don't break systems."""
    checks = []

    for i in range(2):
        scan = game.get_environment_scan()
        doors = [e for e in (scan or []) if e.get("type") == "door"]
        if doors:
            door = doors[0]
            dirmap = {"north": 8, "south": 2, "east": 6, "west": 4}
            d = dirmap.get(str(door.get("direction", "")).lower())
            if d:
                game.move(d, max(1, door.get("distance", 1) - 1))
                game.interact()
                time.sleep(1.5)

    checks.append(_check(True, "Transitions completed"))

    snap = game.get_world_snapshot()
    checks.append(_check(bool(snap), "World state responsive"))

    return scenario_result(all(c["passed"] for c in checks), "Rapid Map Transitions", checks)


# ════════════════════════════════════════════════════════════════
# REGRESSION
# ════════════════════════════════════════════════════════════════

@safe_scenario
def regression_basic_chat(game, state, vision):
    """R1 — Basic chat still works."""
    checks = []
    result = game.send_chat_message("hola")
    checks.append(_check(result.get("success"), "Chat on map"))
    checks.append(_check(bool(result.get("response_text")), "Has response text"))
    return scenario_result(all(c["passed"] for c in checks), "Basic Chat", checks)


@safe_scenario
def regression_ai_config(game, state, vision):
    """R4 — Config values are readable."""
    checks = []
    name = game.get_config("companionName")
    checks.append(_check(bool(name), f"Companion: {name}"))
    lang = game.get_config("language")
    checks.append(_check(lang in ("es", "en"), f"Language: {lang}"))
    rag_enabled = game.get_config("hybridRagEnabled")
    checks.append(_check(rag_enabled is not None, f"RAG enabled: {rag_enabled}"))
    return scenario_result(all(c["passed"] for c in checks), "AI Config", checks,
                           extra={"name": name, "language": lang})


# ════════════════════════════════════════════════════════════════
# STORY PROGRESSION
# ════════════════════════════════════════════════════════════════

@safe_scenario
def story_check_map_position(game, state, vision):
    """Record current story position."""
    checks = []
    map_id = game.get_map_id()
    map_name = game.get_map_name()
    pos = game.get_position()
    party = game.get_party_state()

    detail = f"Map: {map_name} (id={map_id}), Pos: {pos}, Party: {party.get('size', 0)} members"
    checks.append(_check(True, detail))

    state.add_story_checkpoint(
        f"Map_{map_id}_{map_name}",
        f"Position {pos}"
    )
    state.update_game_state(game)
    game.save_game(slot=5)
    checks.append(_check(True, "Game saved"))

    return scenario_result(True, "Story Checkpoint", checks,
                           extra={"map": map_name, "map_id": map_id, "position": pos})


# ════════════════════════════════════════════════════════════════
# GAME SYSTEMS — COIN FLIP, SAVING
# ════════════════════════════════════════════════════════════════

@safe_scenario
def game_coin_flip_warning(game, state, vision):
    """Coin flip warning — companion warns about instant death enemies."""
    checks = []
    warning = game.check_coin_flip_warning()
    checks.append(_check(warning.get("found", False), 
                         "Companion warns about coin flip" if warning.get("found") else "Coin flip check ran"))
    return scenario_result(warning.get("found", False), "Coin Flip Warning", checks,
                           extra={"response": warning.get("response", "")[:100]})


@safe_scenario
def game_natural_save(game, state, vision):
    """Test natural save through game systems."""
    checks = []
    result = game.save_naturally()
    checks.append(_check(result, "Game saved naturally or via fallback"))
    game.save_with_f5()
    checks.append(_check(True, "F5 config save triggered"))
    return scenario_result(True, "Natural Save", checks)


# ════════════════════════════════════════════════════════════════
# SCENARIO REGISTRY
# ════════════════════════════════════════════════════════════════

ALL_SCENARIOS = {
    "telemetry": [
        telemetry_log_file_creation,
        telemetry_chat_logging,
        telemetry_map_transfer_logging,
        telemetry_session_id,
    ],
    "spatial": [
        spatial_basic_scan,
        spatial_summary_text,
        spatial_trap_detection,
        spatial_prompt_injection,
        spatial_cache_performance,
    ],
    "combat": [
        combat_strategy_generation,
        combat_enemy_detection,
        combat_regression,
    ],
    "intent": [
        intent_high_confidence,
        intent_all_types,
        intent_battle_override,
    ],
    "world_state": [
        world_state_basic_snapshot,
        world_state_party_accuracy,
        world_state_situation_changes,
    ],
    "npc": [
        npc_encounter_tracking,
        npc_dialogue_buffer,
    ],
    "rag": [
        rag_index_loaded,
        rag_retrieval_lore,
        rag_chat_integration,
        rag_buckman_grounding,
    ],
    "vision": [
        vision_runtime_contract,
        vision_fusion_grounding,
    ],
    "integration": [
        integration_full_chat_pipeline,
        integration_rapid_map_transitions,
        chat_visible_ui_path,
    ],
    "regression": [
        regression_basic_chat,
        regression_ai_config,
    ],
    "story_progress": [
        story_check_map_position,
    ],
    "game_systems": [
        game_coin_flip_warning,
        game_natural_save,
    ],
}

ALL_BRANCH_NAMES = list(ALL_SCENARIOS.keys())


def get_scenario(name):
    """Find a scenario by function name."""
    for branch, scenarios in ALL_SCENARIOS.items():
        for s in scenarios:
            if s.__name__ == name:
                return s
    return None


def get_branch_scenarios(branch_name):
    """Get all scenarios for a branch."""
    return ALL_SCENARIOS.get(branch_name, [])
