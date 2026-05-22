#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_GAME_DIR = path.resolve(__dirname, '..', '..', 'Fear & Hunger V1.4.1');
const DEFAULT_LOG_DIR = path.join(DEFAULT_GAME_DIR, 'ai_companion_logs');

function parseArgs(argv) {
  const opts = {
    logDir: process.env.AI_COMPANION_LOG_DIR || DEFAULT_LOG_DIR,
    file: null,
    latest: true,
    last: 25,
    sinceSeconds: null,
    type: null,
    errors: false,
    loops: true,
    combat: false,
    chat: false,
    autonomy: false,
    autopilot: true,
    verbose: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    if (arg === '--log-dir') opts.logDir = next();
    else if (arg === '--file') {
      opts.file = next();
      opts.latest = false;
    } else if (arg === '--latest') opts.latest = true;
    else if (arg === '--last') opts.last = Number(next()) || opts.last;
    else if (arg === '--since') opts.sinceSeconds = Number(next()) || null;
    else if (arg === '--type') opts.type = next();
    else if (arg === '--errors') opts.errors = true;
    else if (arg === '--no-loops') opts.loops = false;
    else if (arg === '--combat') opts.combat = true;
    else if (arg === '--chat') opts.chat = true;
    else if (arg === '--autonomy') opts.autonomy = true;
    else if (arg === '--no-autopilot') opts.autopilot = false;
    else if (arg === '--verbose') opts.verbose = true;
    else if (arg === '--help' || arg === '-h') usage(0);
    else fail(`Unknown argument: ${arg}`);
  }
  return opts;
}

function usage(code) {
  const text = `
Usage:
  node scripts/summarize_logs.js [options]

Options:
  --latest              Use newest session log (default)
  --file PATH           Read a specific JSONL log
  --log-dir PATH        Override ai_companion_logs directory
  --last N              Show last N important records (default: 25)
  --since SECONDS       Only analyze records from the last N session seconds
  --type TYPE           Focus one _type, e.g. autopilot_tick, combat_decision
  --errors              Include error-like records
  --combat              Include compact combat decision summary
  --chat                Include compact chat summary
  --autonomy            Include compact companion autonomy ticks
  --no-autopilot        Hide autopilot summary
  --no-loops            Hide repeated target / blocked loop summary
  --verbose             Do not truncate long reason fields as aggressively
`;
  process.stdout.write(text.trimStart());
  process.exit(code);
}

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

function newestLog(logDir) {
  if (!fs.existsSync(logDir)) fail(`log directory not found: ${logDir}`);
  const files = fs.readdirSync(logDir)
    .filter(name => /^session_.*\.jsonl$/.test(name))
    .map(name => path.join(logDir, name))
    .map(file => ({ file, mtime: fs.statSync(file).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (!files.length) fail(`no session_*.jsonl files in ${logDir}`);
  return files[0].file;
}

function readJsonl(file) {
  if (!fs.existsSync(file)) fail(`log file not found: ${file}`);
  const rows = [];
  const bad = [];
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      rows.push(JSON.parse(line));
    } catch (error) {
      bad.push({ line: i + 1, error: error.message });
    }
  }
  return { rows, bad };
}

function countBy(rows, keyFn) {
  const out = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    out.set(key, (out.get(key) || 0) + 1);
  }
  return [...out.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
}

function compact(value, max) {
  const limit = max || 140;
  if (value == null) return '';
  let text = typeof value === 'string' ? value : JSON.stringify(value);
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length <= limit) return text;
  return text.slice(0, limit - 1) + '…';
}

function fmtTime(row) {
  const ms = Number(row.session_time_ms) || 0;
  return `${Math.floor(ms / 1000)}s`;
}

function importantRows(rows, opts) {
  const importantTypes = new Set([
    'game_event',
    'combat_decision',
    'chat',
    'autopilot_tick',
    'autonomy_tick',
    'performance',
    'ambient_thought',
  ]);
  return rows.filter(row => {
    if (opts.type) return row._type === opts.type;
    if (!importantTypes.has(row._type)) return false;
    if (row._type === 'performance') return /stall|long frame/i.test(String(row.reason || ''));
    if (row._type === 'ambient_thought') return row.speak || row.error;
    if (row._type === 'autonomy_tick') return opts.autonomy || row.error || row.action === 'CONSENT';
    if (row._type === 'autopilot_tick') return opts.autopilot;
    if (row._type === 'chat') return opts.chat || row.error;
    if (row._type === 'combat_decision') return opts.combat || row.error || row.failure_chain?.length;
    return true;
  });
}

function lineFor(row, opts) {
  const prefix = `[${fmtTime(row)} map=${row.map_id ?? '?'}]`;
  if (row._type === 'autopilot_tick') {
    const id = row.event_id != null ? ` #${row.event_id}` : '';
    const pos = row.player ? ` @${row.player.x},${row.player.y}` : '';
    return `${prefix} PILOT ${row.kind || '?'} ${row.action || ''}${id}${pos}: ${compact(row.reason, opts.verbose ? 500 : 160)}`;
  }
  if (row._type === 'autonomy_tick') {
    const id = row.event_id != null ? ` #${row.event_id}` : '';
    return `${prefix} AUTO ${row.action || row.kind || '?'}${id}: ${compact(row.reason || row.error, opts.verbose ? 500 : 140)}`;
  }
  if (row._type === 'combat_decision') {
    return `${prefix} COMBAT ${row.decision_action || row.action || '?'} ${row.decision_target || row.target || ''} ${row.decision_limb || row.limb || ''} ${row.latency_ms ? row.latency_ms + 'ms' : ''}: ${compact(row.decision_reasoning || row.reasoning || row.error, 160)}`;
  }
  if (row._type === 'chat') {
    return `${prefix} CHAT ${row.error ? 'ERR' : 'OK'} ${row.latency_ms ? row.latency_ms + 'ms' : ''}: ${compact(row.error || row.message || row.response || row.text, 160)}`;
  }
  if (row._type === 'performance') {
    return `${prefix} PERF ${row.avg_fps || '?'}fps worst=${row.max_frame_ms || '?'}ms rss=${row.memory_rss_mb || '?'} cpu=${row.cpu_percent_process || '?'}: ${compact(row.reason, 120)}`;
  }
  if (row._type === 'game_event') {
    return `${prefix} EVENT ${row.event || '?'} ${compact(row.enemies || row.map_name || '', 100)}`;
  }
  if (row._type === 'ambient_thought') {
    return `${prefix} THOUGHT ${row.speak ? 'speak' : 'skip'}: ${compact(row.reason || row.text, 140)}`;
  }
  return `${prefix} ${row._type}: ${compact(row.reason || row.error || row.event || '', 160)}`;
}

function summarizeLoops(rows) {
  const pilot = rows.filter(row => row._type === 'autopilot_tick');
  const byEvent = new Map();
  const byPoint = new Map();
  const blocked = [];

  for (const row of pilot) {
    const eventId = row.event_id ?? (row.state && row.state.targetEventId);
    if (eventId != null && (row.kind === 'decision' || row.kind === 'interact' || row.kind === 'interact_failed')) {
      const key = String(eventId);
      byEvent.set(key, (byEvent.get(key) || 0) + 1);
    }
    const point = row.target_point || (row.state && row.state.targetPoint);
    if (point && point.x != null && point.y != null && (row.kind === 'decision' || row.kind === 'move_blocked' || row.kind === 'blocked_target')) {
      const key = `${row.map_id}:${point.x}:${point.y}`;
      byPoint.set(key, (byPoint.get(key) || 0) + 1);
    }
    if (row.kind === 'move_blocked' || row.kind === 'blocked_target') blocked.push(row);
  }

  const repeatedEvents = [...byEvent.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const repeatedPoints = [...byPoint.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 8);
  return { repeatedEvents, repeatedPoints, blocked: blocked.slice(-12) };
}

function main() {
  const opts = parseArgs(process.argv);
  const file = opts.file ? path.resolve(opts.file) : newestLog(opts.logDir);
  const { rows: allRows, bad } = readJsonl(file);
  if (!allRows.length) fail(`empty log: ${file}`);

  const lastSessionMs = Math.max(...allRows.map(row => Number(row.session_time_ms) || 0));
  let rows = allRows;
  if (opts.sinceSeconds) {
    const cutoff = Math.max(0, lastSessionMs - opts.sinceSeconds * 1000);
    rows = rows.filter(row => (Number(row.session_time_ms) || 0) >= cutoff);
  }

  const session = allRows.find(row => row._type === 'session_start') || {};
  console.log(`file: ${file}`);
  console.log(`rows: ${rows.length}/${allRows.length}${bad.length ? ` parse_errors=${bad.length}` : ''}`);
  console.log(`session: provider=${session.api_provider || '?'} lang=${session.language || '?'} companion=${session.companion_name || '?'}`);
  console.log(`span: 0s..${Math.floor(lastSessionMs / 1000)}s maps=${countBy(rows, row => row.map_id ?? '?').map(([k, v]) => `${k}:${v}`).join(', ')}`);
  console.log(`types: ${countBy(rows, row => row._type).map(([k, v]) => `${k}:${v}`).join(', ')}`);

  const events = rows.filter(row => row._type === 'game_event');
  if (events.length) {
    console.log('\nEvents');
    for (const row of events.slice(-12)) console.log(`  ${lineFor(row, opts)}`);
  }

  if (opts.autopilot) {
    const pilot = rows.filter(row => row._type === 'autopilot_tick');
    if (pilot.length) {
      console.log('\nAutopilot');
      console.log(`  kinds: ${countBy(pilot, row => row.kind || '?').map(([k, v]) => `${k}:${v}`).join(', ')}`);
      console.log(`  actions: ${countBy(pilot, row => row.action || row.kind || '?').map(([k, v]) => `${k}:${v}`).join(', ')}`);
      const lastScan = [...pilot].reverse().find(row => row.kind === 'scan');
      if (lastScan) console.log(`  last_scan: ${lineFor(lastScan, opts)}`);
    }
  }

  if (opts.loops) {
    const loops = summarizeLoops(rows);
    if (loops.repeatedEvents.length || loops.repeatedPoints.length || loops.blocked.length) {
      console.log('\nLoops / Blocks');
      if (loops.repeatedEvents.length) console.log(`  repeated_events: ${loops.repeatedEvents.map(([k, v]) => `#${k}x${v}`).join(', ')}`);
      if (loops.repeatedPoints.length) console.log(`  repeated_points: ${loops.repeatedPoints.map(([k, v]) => `${k}x${v}`).join(', ')}`);
      for (const row of loops.blocked) console.log(`  ${lineFor(row, opts)}`);
    }
  }

  const errorRows = rows.filter(row =>
    row.error ||
    /failed|error|timeout|aborted|all models failed/i.test(String(row.reason || row.text || row.message || '')) ||
    (Array.isArray(row.failure_chain) && row.failure_chain.length)
  );
  if (opts.errors && errorRows.length) {
    console.log('\nErrors');
    for (const row of errorRows.slice(-opts.last)) console.log(`  ${lineFor(row, opts)}`);
  }

  const important = importantRows(rows, opts).slice(-opts.last);
  console.log(`\nLast ${important.length} Important Rows`);
  for (const row of important) console.log(`  ${lineFor(row, opts)}`);
}

main();
