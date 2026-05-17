# Hybrid RAG Setup

Hybrid RAG adds vector-based semantic retrieval to the AI Companion for broad lore, NPC, location, ending, and save-memory questions. It supplements — never replaces — the structured FearHungerKB and live game-state systems.

## Prerequisites

- Node.js 18+
- An LM Studio instance or OpenAI-compatible embeddings endpoint running locally
- Chunk data installed (`data/rag/`) — copied automatically by `install.sh` / `install.bat`

## Build the Vector Index

Before RAG can work, you must build the index once (and re-run after updating chunks):

```bash
node tools/build-rag-index.js \
  --endpoint http://127.0.0.1:1234/v1/embeddings \
  --model text-embedding-nomic-embed-text-v1.5 \
  --input data/rag \
  --output data/rag/index.json
```

Copy the generated `data/rag/index.json` into your game installation's `data/rag/` directory alongside the chunk files.

After building and copying, restart the game. The plugin loads the index once on first use.

## Configuration (Console Commands)

Open the game's developer console (F8 in RPG Maker MV / NW.js) and use these commands:

### Enable/Disable RAG

```js
// Enable
AI_Companion.Config.setHybridRagEnabled(true);

// Disable
AI_Companion.Config.setHybridRagEnabled(false);
```

### Set Embedding Endpoint

```js
AI_Companion.Config.setHybridRagEndpoint('http://127.0.0.1:1234/v1/embeddings');
```

### Set Embedding Model

```js
AI_Companion.Config.setHybridRagModel('text-embedding-nomic-embed-text-v1.5');
```

### Max Chunks Per Query

```js
// 0 = disabled, up to 6
AI_Companion.Config.setHybridRagMaxChunks(4);
```

### Similarity Threshold

```js
// 0.40 to 0.95 — higher = stricter matching
AI_Companion.Config.setHybridRagSimilarityThreshold(0.70);
```

### Spoiler Level

```js
// 0 = only current state/save memory
// 1 = early-game general knowledge (default)
// 2 = area-level hints
// 3 = explicit progression guidance
// 4 = endings and late-game secrets
AI_Companion.Config.setHybridRagSpoilerLevel(1);
```

### Language

```js
// 'auto' = match game language (default)
// 'en' = English only
// 'es' = Spanish preferred, falls back to English
AI_Companion.Config.setHybridRagLanguage('auto');
```

### Check Current Config

```js
console.log({
  enabled: AI_Companion.Config.hybridRagEnabled,
  endpoint: AI_Companion.Config.hybridRagEndpoint,
  model: AI_Companion.Config.hybridRagModel,
  maxChunks: AI_Companion.Config.hybridRagMaxChunks,
  threshold: AI_Companion.Config.hybridRagSimilarityThreshold,
  spoilerLevel: AI_Companion.Config.hybridRagSpoilerLevel,
  language: AI_Companion.Config.hybridRagLanguage
});
```

Settings persist across game restarts.

## What RAG Retrieves For

Vector RAG is used for:
- Lore questions ("who is Buckman?", "what is the God of Fear & Hunger?")
- Location questions ("where are we?", "what is this place?")
- Status/mechanic questions ("what is bleeding?", "how do coin flips work?")
- NPC questions ("who did we just talk to?")
- Memory recall ("what happened with the merchant?")
- Broad "where next?" questions
- Social/emotional chat

## What RAG Does NOT Run On

Vector RAG is disabled for:
- Active combat decisions
- Autonomy heartbeat ticks
- Ambient comments
- Direct loot/door/NPC interaction prompts
- Item info queries (handled by structured KB)
- Tactical combat questions (handled by structured KB)

## Test Plan

1. Enable RAG and ask "who is Buckman?" — should return a retrieved chunk about Buckman
2. Ask "what is bleeding?" — should return mechanic info
3. Ask "where should we go next?" — may return map info
4. Ask a false question: "where is the scarred woman recruit in the prisons?" — should NOT invent an answer
5. Switch to Spanish UI and ask a lore question — should retrieve English chunks but answer in Spanish
6. Delete/rename `index.json` and confirm chat still works without RAG
7. Start combat and confirm RAG is not triggered for tactical decisions

## Troubleshooting

- **"index.json not found" warning**: Run `tools/build-rag-index.js` and copy the output to the game's `data/rag/` directory
- **Embedding request timed out**: Check that LM Studio or your embeddings endpoint is running; increase timeout if needed
- **No chunks retrieved**: Lower similarity threshold or check that the chunk files cover the topic
- **RAG still not working**: Ensure `setHybridRagEnabled(true)` was called and the index file is valid
