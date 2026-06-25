#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const pluginPath = path.join(root, 'plugins', 'AI_Companion.js');
const kbPath = path.join(root, 'plugins', 'FearHungerKB.js');

const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function checkSyntax(file) {
  const source = read(file);
  try {
    new vm.Script(source, { filename: file });
  } catch (error) {
    fail(`Syntax error in ${path.relative(root, file)}: ${error.message}`);
  }
}

function expectContains(source, needle, label) {
  if (!source.includes(needle)) fail(`Missing expected marker: ${label}`);
}

function expectNotContains(source, needle, label) {
  if (source.includes(needle)) fail(`Forbidden marker found: ${label}`);
}

function countMatches(source, regex) {
  const matches = source.match(regex);
  return matches ? matches.length : 0;
}

checkSyntax(pluginPath);
checkSyntax(kbPath);

const plugin = read(pluginPath);
const kb = read(kbPath);

expectContains(plugin, 'const Config = {', 'Config module');
expectContains(plugin, 'const EnvironmentScanner = {', 'EnvironmentScanner module');
expectContains(plugin, 'const StoryGoalMemory = {', 'StoryGoalMemory module');
expectContains(plugin, 'const AutonomySystem = {', 'AutonomySystem module');
expectContains(plugin, 'const ThesisLogger = {', 'ThesisLogger module');
expectContains(plugin, 'class LLMAPIHandler', 'provider-neutral LLM handler');
expectContains(plugin, 'getCloudFallbackEndpoint()', 'centralized cloud fallback endpoint');
expectContains(plugin, 'window.Scene_AIDebugLog = Scene_AIDebugLog;', 'AI Log scene export');
expectContains(plugin, "Config.language === 'es'", 'language branching');
expectContains(plugin, '_localizeLabel(label)', 'scanner label localization');
expectContains(plugin, 'getPersonaPromptBlock()', 'custom persona prompt block');
expectContains(plugin, 'STORY GOALS AND PROGRESS', 'story goal prompt section');
expectContains(plugin, 'asyncCombatEnabled: false', 'unsafe async combat disabled by default');
expectContains(plugin, 'Async combat is disabled because it can expose manual companion turns', 'async combat safety warning');
expectContains(plugin, '_autonomyRiskForPrompt(snapshot)', 'autonomy risk prompt filter');
expectContains(plugin, 'Do not HOLD only because of recent fear', 'autonomy hold-loop guardrail');
expectContains(plugin, 'const AINotificationOverlay = {', 'non-blocking AI notification overlay');
expectContains(plugin, 'AINotificationOverlay.pushLoot', 'background loot notification toast');
expectContains(plugin, 'AINotificationOverlay.update();', 'notification overlay scene tick');
expectContains(plugin, 'window.AI_Companion.AINotificationOverlay = AINotificationOverlay;', 'notification overlay debug export');
expectContains(plugin, '_expandBackgroundLootCommands', 'background loot common-event expansion');
expectContains(plugin, '23: true,  // RANDOM MINOR ITEM', 'minor loot common event background support');
expectContains(plugin, '52: true,  // RANDOM FOOD ITEM', 'food loot common event background support');
expectContains(plugin, '58: true,  // RANDOM RARE ITEM', 'rare loot common event background support');
expectContains(plugin, '149: true, // RANDOM SCROLL ITEM', 'scroll loot common event background support');
expectContains(plugin, "event: 'ai_toast_spawned'", 'toast spawn thesis log');
expectContains(plugin, '_combatExecutionSummary(decision)', 'authoritative combat execution telemetry');
expectContains(plugin, 'decision_reasoning_raw:', 'raw combat reasoning retained separately');
expectContains(plugin, 'LIVE UPDATE: already destroyed', 'live destroyed-limb combat prompt update');
expectContains(plugin, 'Your reasoning MUST describe the exact limb selected', 'combat reasoning limb consistency rule');

expectNotContains(plugin, 'David,', 'hardcoded player name David');
expectNotContains(plugin, 'David.', 'hardcoded player name David');
expectNotContains(plugin, 'GeminiAPIHandler', 'legacy Gemini handler name');
expectNotContains(plugin, 'Gemini 3.0 Flash', 'legacy Gemini product reference');
expectNotContains(plugin, '192.168.100.3', 'personal LAN endpoint default');
expectNotContains(plugin, 'gemma-4-e4b-uncensored-hauhaucs-aggressive', 'personal local model default');
expectNotContains(plugin, 'chest_7', 'raw chest event leak');
expectNotContains(plugin, 'chest_6', 'raw chest event leak');
expectNotContains(plugin, 'cavegnome1 instead', 'debug note accidentally shipped');
expectNotContains(plugin, 'ambientFallbackMode', 'legacy hardcoded ambient fallback setting');
expectNotContains(plugin, 'KBFallback', 'LLM-free companion chat impersonation');
expectNotContains(plugin, 'No puedo pensar claro. Me cubro.', 'hardcoded combat fallback dialogue');
expectNotContains(plugin, '_generateQuickDialog', 'hardcoded combat quick-dialog generator');
expectNotContains(plugin, 'narratorAmbientLine', 'hardcoded nonverbal ambient narration');
expectNotContains(plugin, 'currentNarratorResponse', 'hardcoded nonverbal chat response');
expectNotContains(plugin, 'Hardcoded area-specific tips', 'area tips must come from KB/RAG, not plugin fallback tables');
expectNotContains(plugin, 'debugOverlay', 'dead debug overlay placeholder setting');
expectNotContains(plugin, 'AI_Companion_DebugOverlay', 'dead debug overlay localStorage key');
expectNotContains(plugin, 'AmbientDialogue.onAutonomyIntent(action, target);', 'routine autonomy action chatter invocation');
expectNotContains(plugin, 'AmbientDialogue.checkProactiveChat();', 'routine proactive object chatter invocation');
expectNotContains(plugin, 'this._showBackgroundLootSummary(rewards);', 'routine background-loot chatter invocation');
expectNotContains(plugin, "localStorage.getItem('AI_Companion_AsyncCombatEnabled') === 'true'", 'persisted async combat re-enable');
expectNotContains(plugin, "{ role: 'assistant', content: '<think>", 'fake local combat thinking prefill');

const itemPickupStart = plugin.indexOf('onItemPickup(item, source) {');
const itemPickupEnd = plugin.indexOf('async _generateItemComment', itemPickupStart);
const itemPickup = itemPickupStart >= 0 && itemPickupEnd > itemPickupStart
  ? plugin.slice(itemPickupStart, itemPickupEnd)
  : '';
if (!itemPickup || itemPickup.indexOf('EquipmentApproval.consider(item, source)') > itemPickup.indexOf('if (!this.canSpeak()) return;')) {
  fail('Equipment opportunities must be detected before ambient speech cooldown exits.');
}

if (countMatches(plugin, /this\.addCommand\(es \? 'Registro IA' : 'AI Log', 'sectionLog'/g) !== 1) {
  fail('Config hub AI Log command should exist exactly once.');
}

if (countMatches(plugin, /this\.addCommand\(Config\.language === 'es' \? 'Registro IA' : 'AI Log'/g) !== 0) {
  fail('Title menu AI Log command should not exist; it belongs inside the config hub.');
}

if (countMatches(plugin, /this\.addCommand\(Config\.language === 'es' \? 'Compañero IA' : 'AI Companion'/g) !== 1) {
  fail('Title menu AI Companion command should exist exactly once.');
}

if (!/['"]Puerta['"]:\s*['"]Door['"]/.test(plugin)) fail('Missing Puerta -> Door localization.');
if (!/['"]Caja['"]:\s*['"]Crate['"]/.test(plugin)) fail('Missing Caja -> Crate localization.');
if (!/['"]Barril['"]:\s*['"]Barrel['"]/.test(plugin)) fail('Missing Barril -> Barrel localization.');
if (!/['"]Mercader['"]:\s*['"]Merchant['"]/.test(plugin)) fail('Missing Mercader -> Merchant localization.');

if (!/displayNameEs|displayName/.test(kb)) {
  warn('KB does not appear to expose bilingual display names.');
}

if (!/"guard":\s*\{[\s\S]*displayNameEs:\s*"Guardia"[\s\S]*gender:\s*"male"/.test(kb)) {
  fail('Guard KB entry must preserve Spanish display name and male gender metadata.');
}

const suspiciousConsole = (plugin.match(/console\.log\(/g) || []).length;
if (suspiciousConsole > 20) {
  warn(`Plugin has ${suspiciousConsole} console.log calls. Confirm noisy logs are debug-gated where needed.`);
}

console.log('Static plugin check');
console.log(`- AI_Companion.js bytes: ${Buffer.byteLength(plugin)}`);
console.log(`- FearHungerKB.js bytes: ${Buffer.byteLength(kb)}`);
console.log(`- warnings: ${warnings.length}`);
warnings.forEach(message => console.log(`  WARN: ${message}`));

if (failures.length > 0) {
  console.error(`- failures: ${failures.length}`);
  failures.forEach(message => console.error(`  FAIL: ${message}`));
  process.exit(1);
}

console.log('- failures: 0');
console.log('OK');
