#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const ragDir = path.join(root, 'data', 'rag');
const kbSource = fs.readFileSync(path.join(root, 'plugins', 'FearHungerKB.js'), 'utf8');
const knownKeys = new Set(Array.from(kbSource.matchAll(/^\s{4}"([a-z0-9_]+)":\s*\{/gm), match => match[1]));
const allowedTypes = new Set(['enemy', 'character', 'location', 'object']);
const allowedRecognition = new Set(['common', 'encounter', 'introduced', 'hidden']);
const ids = new Set();
const failures = [];
let count = 0;

function fail(file, line, message) {
    failures.push(`${path.basename(file)}:${line} ${message}`);
}

const files = fs.readdirSync(ragDir).filter(name => /^visual_.*\.jsonl$/i.test(name));
for (const name of files) {
    const file = path.join(ragDir, name);
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
        if (!line.trim()) return;
        let profile;
        try { profile = JSON.parse(line); } catch (error) {
            fail(file, index + 1, `invalid JSON: ${error.message}`);
            return;
        }
        count++;
        if (!profile.id) fail(file, index + 1, 'missing id');
        else if (ids.has(profile.id)) fail(file, index + 1, `duplicate id ${profile.id}`);
        else ids.add(profile.id);
        if (profile.type !== 'visual_profile') fail(file, index + 1, 'type must be visual_profile');
        if (!allowedTypes.has(profile.entity_type)) fail(file, index + 1, `invalid entity_type ${profile.entity_type}`);
        if (!profile.entity_key) fail(file, index + 1, 'missing entity_key');
        if (!profile.visual_description || profile.visual_description.length < 20) fail(file, index + 1, 'visual_description is too short');
        if (!profile.display_name_en || !profile.display_name_es) fail(file, index + 1, 'missing bilingual display names');
        if (!allowedRecognition.has(profile.recognition)) fail(file, index + 1, `invalid recognition ${profile.recognition}`);
        if (!Array.isArray(profile.contexts) || profile.contexts.length === 0) fail(file, index + 1, 'missing contexts');
        if (['enemy', 'character', 'location'].includes(profile.entity_type) && !knownKeys.has(profile.entity_key)) {
            fail(file, index + 1, `entity_key ${profile.entity_key} is not present in FearHungerKB`);
        }
    });
}

console.log(`Visual RAG profiles: ${count} across ${files.length} files`);
if (failures.length) {
    failures.forEach(message => console.error(`FAIL: ${message}`));
    process.exit(1);
}
console.log('OK');
