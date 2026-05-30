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
expectContains(plugin, 'window.Scene_AIDebugLog = Scene_AIDebugLog;', 'AI Log scene export');
expectContains(plugin, "Config.language === 'es'", 'language branching');
expectContains(plugin, '_localizeLabel(label)', 'scanner label localization');
expectContains(plugin, 'getPersonaPromptBlock()', 'custom persona prompt block');
expectContains(plugin, 'STORY GOALS AND PROGRESS', 'story goal prompt section');

expectNotContains(plugin, 'David,', 'hardcoded player name David');
expectNotContains(plugin, 'David.', 'hardcoded player name David');
expectNotContains(plugin, 'chest_7', 'raw chest event leak');
expectNotContains(plugin, 'chest_6', 'raw chest event leak');
expectNotContains(plugin, 'cavegnome1 instead', 'debug note accidentally shipped');
expectNotContains(plugin, 'ambientFallbackMode', 'legacy hardcoded ambient fallback setting');
expectNotContains(plugin, 'KBFallback', 'LLM-free companion chat impersonation');
expectNotContains(plugin, 'No puedo pensar claro. Me cubro.', 'hardcoded combat fallback dialogue');
expectNotContains(plugin, '_generateQuickDialog', 'hardcoded combat quick-dialog generator');
expectNotContains(plugin, 'narratorAmbientLine', 'hardcoded nonverbal ambient narration');
expectNotContains(plugin, 'currentNarratorResponse', 'hardcoded nonverbal chat response');

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
