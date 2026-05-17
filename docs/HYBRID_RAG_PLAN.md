# Hybrid RAG Implementation Plan

This document defines the planned hybrid retrieval system for `AI_Companion.js`.
It is written for an implementation agent that does not have the prior chat
context.

## Goal

Add vector-based retrieval for broad lore, NPC, location, ending, and long-term
save-memory questions while preserving the existing deterministic game-state
systems for tactical accuracy.

The result should be a hybrid RAG architecture:

- Structured RAG remains the source of truth for live gameplay.
- Vector RAG supplements broad semantic questions and long-form memory.
- Structured state always wins when it conflicts with retrieved text.

## Current System

The plugin already has structured/manual RAG behavior:

- `plugins/FearHungerKB.js` contains curated facts for items, enemies, NPCs,
  lore, areas, and mechanics.
- `EnvironmentScanner` reads nearby events, doors, traps, containers, NPCs, and
  enemies from the current map.
- Combat extraction reads live enemies, limbs, HP-like state, turn state, and
  tactical risks.
- Dialogue/story/purchase memories are injected into chat prompts.
- `ThesisLogger` writes JSONL logs into `ai_companion_logs/session_*.jsonl`.

Do not replace these systems. The vector retriever is an additional context
source.

## Target Branch

Recommended branch:

```bash
git checkout -b feat/hybrid-rag-memory
```

## Architecture

### 1. Structured Context Has Priority

Keep these as highest-priority truth sources:

- Current battle state.
- Current map and nearby object/enemy scanner.
- Current party status, inventory, and equipment.
- Save-tied story memory.
- Recent NPC dialogue memory.
- Curated `FearHungerKB.js` exact matches.

If vector retrieval says an enemy, item, NPC, or event exists but the structured
state does not confirm it, the LLM must treat the claim as uncertain.

### 2. Vector Knowledge Store

Add curated chunk files under:

```text
data/rag/
  lore_chunks.jsonl
  gameplay_chunks.jsonl
  npc_chunks.jsonl
  endings_chunks.jsonl
  map_chunks.jsonl
  save_memory_chunks.jsonl
  index.json
```

Each chunk should use this shape:

```json
{
  "id": "npc_buckman_001",
  "type": "npc_lore",
  "language": "en",
  "title": "Buckman",
  "text": "Buckman is a prisoner NPC encountered in the dungeons...",
  "tags": ["buckman", "prison", "npc"],
  "source": "curated_wiki",
  "source_url": "https://...",
  "spoiler_level": 1
}
```

Use JSONL, one object per line.

Recommended chunk types:

- `npc_lore`
- `enemy_lore`
- `item_lore`
- `map_lore`
- `mechanic`
- `ending`
- `quest_hint`
- `save_memory`

### 3. Wiki Scraping And Curation

The implementation agent may scrape public wiki pages, but the output must be
curated and summarized. Do not copy large wiki passages verbatim into the repo.

Rules:

- Store concise facts, not full articles.
- Keep `source_url` for traceability.
- Prefer factual game information over speculative interpretation.
- Split spoilers by `spoiler_level`.
- Create both English and Spanish chunks only if Spanish translation quality is
  good. Otherwise keep English chunks and let the LLM translate at runtime.

Suggested source categories:

- Main plot and endings.
- Core NPCs: Le'garde, Buckman, Trortur, Enki, D'arce, Cahara, Ragnvaldr,
  Moonless, Girl, Pocketcat, Nosramus.
- Early maps: Entrance, basement, prisons, library, courtyard, mines.
- Early enemies: Guard, Maneba, Cave Gnome, dogs, priests.
- Items and mechanics: torches, yesqueros/lighters, coin flip attacks,
  infection, bleeding, hunger, mind, limb loss.

### 4. Embedding Builder

Add a Node script:

```text
tools/build-rag-index.js
```

Responsibilities:

- Read `data/rag/*_chunks.jsonl`.
- Call an OpenAI-compatible embeddings endpoint.
- Write `data/rag/index.json`.
- Preserve all chunk metadata.
- Reuse existing embeddings when chunk `id` and `text` are unchanged.

Suggested CLI:

```bash
node tools/build-rag-index.js \
  --endpoint http://127.0.0.1:1234/v1/embeddings \
  --model text-embedding-nomic-embed-text-v1.5 \
  --input data/rag \
  --output data/rag/index.json
```

`index.json` shape:

```json
{
  "version": 1,
  "embedding_model": "text-embedding-nomic-embed-text-v1.5",
  "generated_at": "2026-05-17T00:00:00.000Z",
  "chunks": [
    {
      "id": "npc_buckman_001",
      "vector": [0.01, -0.03],
      "metadata": {
        "type": "npc_lore",
        "language": "en",
        "title": "Buckman",
        "text": "Buckman is...",
        "tags": ["buckman", "prison", "npc"],
        "source": "curated_wiki",
        "source_url": "https://...",
        "spoiler_level": 1
      }
    }
  ]
}
```

### 5. Runtime Retriever

Add a module inside `AI_Companion.js`, or a separate plugin file if cleaner:

```js
const HybridRAG = {
  loadIndex() {},
  shouldRetrieve(context, playerMessage, intent) {},
  retrieve(query, options) {},
  formatForPrompt(results) {}
};
```

Runtime responsibilities:

- Load `data/rag/index.json` once.
- Embed the user query through the configured embedding endpoint.
- Compute cosine similarity locally.
- Filter by:
  - `language`
  - `spoiler_level`
  - current map/known progress when available
  - save id for `save_memory`
- Return top 3-5 chunks.

Do not retrieve on every AI call.

### 6. Query Routing

Use vector RAG for:

- Chat questions about lore, NPCs, endings, places, backstory, and mechanics.
- Questions like "what do we know about X?"
- Story goal reasoning.
- Long-term memory recall when structured memory is insufficient.
- Broad "where should we go next?" questions, filtered by spoiler level.

Do not use vector RAG for:

- Per-heartbeat autonomy decisions.
- Immediate combat decisions.
- Nearby loot/door/NPC interaction decisions.
- Status healing/item consent prompts.
- Short ambient comments.

Reason: those paths need low latency and exact live game state.

### 7. Prompt Injection Format

Inject retrieved knowledge after structured context, never before it:

```text
RETRIEVED KNOWLEDGE:
- [npc_lore | Buckman | source: curated_wiki | confidence: 0.83]
  Buckman is a prisoner NPC encountered...
- [mechanic | Bleeding | source: curated_wiki | confidence: 0.79]
  Bleeding is a dangerous status effect...

GROUNDING RULES:
- Live game state and structured memory override retrieved knowledge.
- Do not invent NPCs, enemies, recruitable characters, item locations, or story events.
- If retrieved knowledge does not support an answer, say you are not sure.
- If a fact may be a spoiler above the configured level, do not reveal it.
```

### 8. Save-Tied Vector Memory

Add summarized memory chunks per save file:

- Important NPC conversations.
- Key story events.
- Purchases and merchant interactions.
- Places visited.
- Player choices.
- Companion conclusions.

Store summaries, not raw full conversations.

Example:

```json
{
  "id": "save3_memory_buckman_contact_001",
  "type": "save_memory",
  "save_id": "file3",
  "language": "en",
  "title": "Buckman contact",
  "text": "The party met Buckman near the prisons. He warned them about danger nearby.",
  "tags": ["buckman", "prisons", "npc_dialogue"],
  "source": "game_session",
  "spoiler_level": 0,
  "timestamp": 1770000000
}
```

### 9. Config UI

Add config options:

- `Hybrid RAG`: ON/OFF.
- `Embedding endpoint`.
- `Embedding model`.
- `Max retrieved chunks`: 0-6.
- `Similarity threshold`.
- `Spoiler level`: 0-4.
- `Include save memory`: ON/OFF.
- `RAG language`: auto/en/es.

Defaults:

- Hybrid RAG OFF until index exists.
- Max chunks: 4.
- Similarity threshold: 0.70.
- Spoiler level: 1.
- Include save memory: ON.

### 10. Logging

Add `ThesisLogger` event:

```js
ThesisLogger.log('rag_retrieval', {
  query,
  intent,
  latency_ms,
  embedding_model,
  retrieved_count,
  chunks: results.map(r => ({
    id: r.id,
    type: r.type,
    title: r.title,
    score: r.score,
    source: r.source,
    spoiler_level: r.spoiler_level
  }))
});
```

Also include retrieved chunk IDs in chat logs:

```json
{
  "event_type": "chat",
  "data": {
    "rag_chunk_ids": ["npc_buckman_001", "map_prisons_002"]
  }
}
```

### 11. Anti-Hallucination Confidence

Internally classify answers as:

- `structured_confirmed`
- `rag_supported`
- `uncertain`
- `unsupported`

The LLM does not need to show these labels to the player, but logs should
include the grounding mode when possible.

Expected behavior:

- If structured state confirms it, answer confidently.
- If only vector RAG supports it, answer with moderate confidence.
- If neither supports it, say the companion is unsure.
- Never invent NPCs, recruits, enemy locations, or item contents.

### 12. Spoiler Levels

Use these levels:

- `0`: only current/live state and save memory.
- `1`: early-game general knowledge.
- `2`: area-level hints.
- `3`: explicit progression guidance.
- `4`: endings, secrets, and late-game revelations.

Default: `1`.

### 13. Testing Plan

Required tests:

1. Ask about Buckman before meeting him.
2. Ask about Buckman after meeting him.
3. Ask "what happened with the merchant?"
4. Ask "do you know what Maneba is?"
5. Ask "where should we go next?"
6. Ask a false question: "where is the scarred woman recruit in the prisons?"
7. Start combat and confirm vector RAG is not used for tactical decisions.
8. Enable Spanish UI and confirm the final answer is Spanish.
9. Disable RAG and confirm chat still works from structured KB.
10. Remove/rename `index.json` and confirm graceful fallback.

Expected results:

- No crash if the embedding endpoint is unavailable.
- No noticeable combat or autonomy latency regression.
- Retrieved chunks appear in logs.
- Unsupported claims are rejected or answered with uncertainty.
- Save-specific memory can be recalled after closing/reloading the game.

### 14. Thesis Relevance

This feature strengthens the thesis by making hallucination mitigation explicit.

Research value:

- Compare structured-only grounding vs hybrid structured/vector grounding.
- Log retrieval latency and retrieved evidence.
- Measure hallucination frequency before/after hybrid RAG.
- Measure player perception of NPC credibility and memory.
- Support the thesis concepts of RAG, telemetría, latencia, memoria, and
  credibilidad socio-cognitiva.

### 15. Non-Goals

Do not:

- Replace live combat extraction with vector search.
- Use vector retrieval during every heartbeat.
- Ship copyrighted full wiki dumps.
- Ship user private logs or raw full conversations.
- Hardcode one embedding provider only.
- Reveal high-spoiler knowledge by default.

## Implementation Checklist

- [ ] Create `data/rag/` chunk files.
- [ ] Add curated early-game wiki/game chunks.
- [ ] Add `tools/build-rag-index.js`.
- [ ] Add embedding config fields.
- [ ] Add `HybridRAG` runtime module.
- [ ] Add query routing.
- [ ] Add prompt injection.
- [ ] Add save-memory chunk summaries.
- [ ] Add `rag_retrieval` logging.
- [ ] Add chat log `rag_chunk_ids`.
- [ ] Add spoiler filtering.
- [ ] Add graceful fallback when index/endpoint/model is missing.
- [ ] Update `README.md`.
- [ ] Update `docs/TESTING.md`.
- [ ] Run `node --check plugins/AI_Companion.js`.
- [ ] Test Spanish and English installs.
