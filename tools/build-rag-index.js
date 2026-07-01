#!/usr/bin/env node
/**
 * build-rag-index.js — Embedding Builder for Hybrid RAG
 *
 * Reads data/rag/*_chunks.jsonl, calls an OpenAI-compatible embeddings
 * endpoint, and writes data/rag/index.json with vectors + metadata.
 *
 * Reuses existing embeddings when chunk id and text are unchanged.
 *
 * Usage:
 *   node tools/build-rag-index.js \
 *     --endpoint http://127.0.0.1:1234/v1/embeddings \
 *     --model text-embedding-nomic-embed-text-v1.5 \
 *     --input data/rag \
 *     --output data/rag/index.json
 */

const fs = require('fs');
const path = require('path');

// ── Argument parsing ──────────────────────────────────────────────────────
function parseArgs() {
    const args = {};
    const raw = process.argv.slice(2);
    for (let i = 0; i < raw.length; i++) {
        if (raw[i].startsWith('--')) {
            const key = raw[i].replace(/^--/, '');
            const val = raw[i + 1] && !raw[i + 1].startsWith('--') ? raw[++i] : 'true';
            args[key] = val;
        }
    }
    return args;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function readJsonl(filePath) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const lines = raw.split('\n').filter(line => line.trim().length > 0);
    return lines.map(line => JSON.parse(line));
}

function writeJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function hash(text) {
    // Simple fast hash for comparing chunk identity
    let h = 0;
    for (let i = 0; i < text.length; i++) {
        h = ((h << 5) - h + text.charCodeAt(i)) | 0;
    }
    return String(h);
}

function chunkMetadata(chunk) {
    const metadata = {
        type: chunk.type,
        language: chunk.language || 'en',
        title: chunk.title,
        text: chunk.text,
        tags: chunk.tags || [],
        source: chunk.source || 'curated_wiki',
        source_url: chunk.source_url || '',
        spoiler_level: chunk.spoiler_level || 0,
        save_id: chunk.save_id || null,
        timestamp: chunk.timestamp || null
    };
    [
        'entity_type', 'entity_key', 'variant_of', 'display_name_en',
        'display_name_es', 'visual_description', 'distinguishing_features',
        'negative_matches', 'contexts', 'recognition'
    ].forEach(key => {
        if (chunk[key] !== undefined) metadata[key] = chunk[key];
    });
    return metadata;
}

// ── Embedding ──────────────────────────────────────────────────────────────
async function getEmbedding(endpoint, model, text) {
    const url = endpoint.replace(/\/+$/, '');
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer lm-studio'
        },
        body: JSON.stringify({
            model: model,
            input: text
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText.substring(0, 200)}`);
    }

    const data = await response.json();
    if (!data.data || !data.data[0] || !data.data[0].embedding) {
        throw new Error('Unexpected response format: ' + JSON.stringify(data).substring(0, 200));
    }

    return data.data[0].embedding;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
    const args = parseArgs();

    const endpoint = args.endpoint || 'http://127.0.0.1:1234/v1/embeddings';
    const model = args.model || 'text-embedding-nomic-embed-text-v1.5';
    const inputDir = args.input || 'data/rag';
    const outputFile = args.output || 'data/rag/index.json';

    console.log(`[build-rag-index] Endpoint: ${endpoint}`);
    console.log(`[build-rag-index] Model: ${model}`);
    console.log(`[build-rag-index] Input: ${inputDir}`);
    console.log(`[build-rag-index] Output: ${outputFile}`);

    // Load existing index to reuse unchanged embeddings
    let existingIndex = null;
    if (fs.existsSync(outputFile)) {
        try {
            existingIndex = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
            console.log(`[build-rag-index] Existing index found with ${existingIndex.chunks ? existingIndex.chunks.length : 0} chunks`);
        } catch (e) {
            console.warn('[build-rag-index] Could not parse existing index, rebuilding from scratch');
        }
    }

    const existingMap = new Map();
    if (existingIndex && existingIndex.chunks) {
        for (const c of existingIndex.chunks) {
            const fingerprint = hash(c.metadata ? c.metadata.text : '') + '|' + c.id;
            existingMap.set(c.id, { vector: c.vector, fingerprint });
        }
    }

    // Read all chunk files
    const inputFiles = fs.readdirSync(inputDir)
        .filter(f => f.endsWith('.jsonl') && f !== 'index.json')
        .map(f => path.join(inputDir, f));

    console.log(`[build-rag-index] Found ${inputFiles.length} chunk files`);

    const allChunks = [];
    for (const file of inputFiles) {
        const chunks = readJsonl(file);
        console.log(`  ${path.basename(file)}: ${chunks.length} chunks`);
        allChunks.push(...chunks);
    }

    console.log(`[build-rag-index] Total chunks: ${allChunks.length}`);

    const index = {
        version: 2,
        embedding_model: model,
        generated_at: new Date().toISOString(),
        chunks: []
    };

    let reused = 0;
    let embedded = 0;
    let errors = 0;

    for (const chunk of allChunks) {
        const fingerprint = hash(chunk.text) + '|' + chunk.id;
        const existing = existingMap.get(chunk.id);

        if (existing && existing.fingerprint === fingerprint) {
            // Reuse existing embedding
            index.chunks.push({
                id: chunk.id,
                vector: existing.vector,
                metadata: chunkMetadata(chunk)
            });
            reused++;
            continue;
        }

        // Need to embed
        try {
            const vector = await getEmbedding(endpoint, model, chunk.text);
            index.chunks.push({
                id: chunk.id,
                vector: vector,
                metadata: chunkMetadata(chunk)
            });
            embedded++;
            process.stdout.write('.');
        } catch (e) {
            console.error(`\n[build-rag-index] Error embedding chunk ${chunk.id}: ${e.message}`);
            // Include chunk without vector for graceful fallback
            index.chunks.push({
                id: chunk.id,
                vector: null,
                metadata: chunkMetadata(chunk)
            });
            errors++;
        }
    }

    console.log(`\n[build-rag-index] Reused: ${reused}, Embedded: ${embedded}, Errors: ${errors}`);

    writeJson(outputFile, index);
    console.log(`[build-rag-index] Written to ${outputFile}`);
    console.log(`[build-rag-index] Done.`);
}

main().catch(e => {
    console.error('[build-rag-index] Fatal:', e.message);
    process.exit(1);
});
