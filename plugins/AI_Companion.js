/*:
 * @plugindesc [RPG Maker MV] AI Companion Mod for Fear & Hunger - v1.0.0
 * @author Asukat
 * 
 * @help
 * ============================================================================
 * AI Companion Mod for Fear & Hunger
 * ============================================================================
 * 
 * This plugin adds an AI-controlled companion that:
 * - Follows the player on the map (via HIME_GuestFollowers)
 * - Acts autonomously in combat using Gemini 3.0 Flash API
 * - Understands and exploits Fear & Hunger's limb-based combat
 * - Maintains persistent memory across battles and save files
 * 
 * INSTALLATION:
 * 1. Place this file in www/js/plugins/
 * 2. Enable in Plugin Manager
 * 3. Configure API key and companion settings
 * 4. Add companion to party via script call:
 *    $gameParty.addActor(COMPANION_ACTOR_ID);
 * 
 * TURN TIMING:
 * The AI decision is made EXACTLY when the companion's turn begins.
 * No pre-caching, no stale data. Current battle state only.
 * 
 * ============================================================================
 * Plugin Parameters
 * ============================================================================
 * 
 * @param apiKey
 * @text Gemini API Key
 * @desc Your Google AI Studio API key for Gemini 3.0 Flash
 * @type string
 * @default 
 * 
 * @param companionActorId
 * @text Companion Actor ID
 * @desc The Actor ID to use for the AI companion (from database)
 * @type number
 * @default 15
 * 
 * @param companionName
 * @text Companion Name
 * @desc Display name for the AI companion
 * @type string
 * @default Wanderer
 * 
 * @param personality
 * @text Personality Traits
 * @desc Base personality for dialogue and decisions (comma-separated)
 * @type string
 * @default survival-first, cautious, trauma-aware, pragmatic
 * 
 * @param debugMode
 * @text Debug Mode
 * @desc Enable console logging for development
 * @type boolean
 * @default true
 * 
 * @param useMockAI
 * @text Use Mock AI (Force)
 * @desc Force mock AI even when API key is set. Set OFF to use real API.
 * @type boolean
 * @default false
 * 
 * @param autoJoinParty
 * @text Auto-Join Party
 * @desc Automatically add the AI companion when starting a new game
 * @type boolean
 * @default true
 * 
 * @param apiEndpoint
 * @text API Endpoint
 * @desc Gemini API endpoint URL
 * @type string
 * @default https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
 */

(() => {
    'use strict';

    const pluginName = "AI_Companion";
    const parameters = PluginManager.parameters(pluginName);

    //=========================================================================
    // Configuration
    //=========================================================================
    const savedApiKey = localStorage.getItem('AI_Companion_ApiKey') || '';
    const savedDebug = localStorage.getItem('AI_Companion_DebugMode');

    // ── Provider Registry ────────────────────────────────────────────────
    const PROVIDERS = {
        groq: {
            name: 'Groq',
            endpoint: 'https://api.groq.com/openai/v1/chat/completions',
            modelsEndpoint: null, // Groq models are hardcoded
            defaultModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
            needsKey: true,
            extraHeaders: { 'HTTP-Referer': 'https://fear-and-hunger-mod.local', 'X-Title': 'Fear & Hunger AI Companion' }
        },
        openrouter: {
            name: 'OpenRouter',
            endpoint: 'https://openrouter.ai/api/v1/chat/completions',
            modelsEndpoint: 'https://openrouter.ai/api/v1/models',
            defaultModels: ['openrouter/free'],
            needsKey: true,
            extraHeaders: { 'HTTP-Referer': 'https://fear-and-hunger-mod.local', 'X-Title': 'Fear & Hunger AI Companion' }
        },
        local: {
            name: 'Local',
            endpoint: null, // user-configured
            modelsEndpoint: null,
            defaultModels: [],
            needsKey: false,
            extraHeaders: {}
        }
    };

    const _providerOrder = ['groq', 'openrouter', 'local'];

    const Config = {
        apiKey: savedApiKey || String(parameters['apiKey'] || ''),
        companionActorId: Number(parameters['companionActorId'] || 15),
        companionName: String(parameters['companionName'] || 'Wanderer'),
        personality: String(parameters['personality'] || 'survival-first, cautious, trauma-aware'),
        debugMode: savedDebug !== null ? savedDebug === 'true' : (parameters['debugMode'] === 'true'),
        forceMockAI: parameters['useMockAI'] === 'true',
        autoJoinParty: parameters['autoJoinParty'] !== 'false',
        language: localStorage.getItem('AI_Companion_Language') || 'es',
        companionClass: localStorage.getItem('AI_Companion_Class') || 'defensor',

        // Provider: 'groq', 'openrouter', or 'local'
        apiProvider: localStorage.getItem('AI_Companion_Provider') || 'groq',

        // Selected chat model (persisted per provider)
        chatModel: localStorage.getItem('AI_Companion_ChatModel') || '',

        // Local AI config
        localEndpoint: localStorage.getItem('AI_Companion_LocalEndpoint') || 'http://192.168.100.3:1234/v1/chat/completions',
        localModel: localStorage.getItem('AI_Companion_LocalModel') || 'qwen3.5-4b-uncensored-hauhaucs-aggressive',

        // Cached free models from OpenRouter
        _cachedFreeModels: JSON.parse(localStorage.getItem('AI_Companion_FreeModels') || '[]'),
        _freeModelsFetchedAt: Number(localStorage.getItem('AI_Companion_FreeModelsFetchedAt') || '0'),

        // Returns the active provider definition
        getProvider() {
            return PROVIDERS[this.apiProvider] || PROVIDERS.groq;
        },

        // Returns the active API endpoint
        getEndpoint() {
            if (this.apiProvider === 'local') return this.localEndpoint;
            return this.getProvider().endpoint;
        },

        // Returns headers appropriate for the provider
        getHeaders() {
            const headers = { 'Content-Type': 'application/json' };
            if (this.apiProvider === 'local') {
                headers['Authorization'] = 'Bearer lm-studio';
            } else {
                headers['Authorization'] = `Bearer ${this.apiKey}`;
                const extra = this.getProvider().extraHeaders || {};
                Object.assign(headers, extra);
            }
            return headers;
        },

        // Get the model to use for chat/RP
        getChatModel() {
            if (this.apiProvider === 'local') return this.localModel;
            if (this.chatModel) return this.chatModel;
            const provider = this.getProvider();
            return provider.defaultModels[0] || 'openrouter/free';
        },

        setProvider(provider) {
            this.apiProvider = provider;
            localStorage.setItem('AI_Companion_Provider', provider);
            // Reset chatModel to provider default
            this.chatModel = '';
            localStorage.removeItem('AI_Companion_ChatModel');
        },

        cycleProvider() {
            const idx = _providerOrder.indexOf(this.apiProvider);
            const next = _providerOrder[(idx + 1) % _providerOrder.length];
            this.setProvider(next);
            return next;
        },

        setChatModel(model) {
            this.chatModel = model;
            localStorage.setItem('AI_Companion_ChatModel', model);
        },

        setLocalEndpoint(url) {
            this.localEndpoint = url;
            localStorage.setItem('AI_Companion_LocalEndpoint', url);
        },

        setLocalModel(model) {
            this.localModel = model;
            localStorage.setItem('AI_Companion_LocalModel', model);
        },

        get useMockAI() {
            if (this.apiProvider === 'local') return this.forceMockAI;
            return this.forceMockAI || !this.apiKey;
        },

        setApiKey(key) {
            this.apiKey = key;
            localStorage.setItem('AI_Companion_ApiKey', key);
        },

        setLanguage(lang) {
            this.language = lang;
            localStorage.setItem('AI_Companion_Language', lang);
        },

        setDebugMode(on) {
            this.debugMode = !!on;
            localStorage.setItem('AI_Companion_DebugMode', on ? 'true' : 'false');
        },

        setCompanionClass(cls) {
            this.companionClass = cls;
            localStorage.setItem('AI_Companion_Class', cls);
        },

        // ── Fetch free models from OpenRouter ────────────────────────────
        async fetchFreeModels() {
            if (!this.apiKey) return [];
            try {
                const resp = await fetch('https://openrouter.ai/api/v1/models', {
                    headers: { 'Authorization': `Bearer ${this.apiKey}` }
                });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const data = await resp.json();
                const free = (data.data || []).filter(m =>
                    m.pricing && String(m.pricing.prompt) === '0' && String(m.pricing.completion) === '0'
                ).map(m => ({
                    id: m.id,
                    name: m.name || m.id,
                    context: m.context_length || 4096
                })).sort((a, b) => b.context - a.context);
                this._cachedFreeModels = free;
                this._freeModelsFetchedAt = Date.now();
                localStorage.setItem('AI_Companion_FreeModels', JSON.stringify(free));
                localStorage.setItem('AI_Companion_FreeModelsFetchedAt', String(Date.now()));
                return free;
            } catch (e) {
                console.warn('[AI_Companion] Failed to fetch free models:', e.message);
                return this._cachedFreeModels;
            }
        },

        getFreeModels() {
            return this._cachedFreeModels;
        },

        // Groq hardcoded endpoint for chat fallback (used by _sendChatRequest, combat fallback)
        get apiEndpoint() {
            return PROVIDERS.groq.endpoint;
        }
    };

    // Starting equipment loadouts based on F&H characters
    const STARTING_LOADOUTS = {
        defensor: {
            name: 'Defensor',
            nameEs: 'Defensor (D\'arce)',
            desc: 'Espada larga + Armadura de placas + Escudo Águila + Protectores de piernas. Alta defensa.',
            stats: { atk: 35, def: 40, matk: 16, mdef: 16, agi: 10, luk: 32 },
            weapons: [7],
            armors: [14, 18, 22],
            items: [[95, 2], [8, 2]],
            skills: [67, 68]
        },
        guerrero: {
            name: 'Guerrero',
            nameEs: 'Guerrero',
            desc: 'Hacha + Armadura de piel. Alto ataque + objetos arrojadizos.',
            stats: { atk: 40, def: 16, matk: 16, mdef: 16, agi: 10, luk: 32 },
            weapons: [45],
            armors: [12],
            items: [[169, 3], [79, 1], [84, 3], [95, 1]],
            skills: [66, 80]
        },
        mago: {
            name: 'Mago',
            nameEs: 'Mago (Enki)',
            desc: 'Espada corta + Túnica de sumo sacerdote. Piromancia + Magia negra + Curación.',
            stats: { atk: 30, def: 16, matk: 16, mdef: 16, agi: 10, luk: 32 },
            weapons: [1],
            armors: [13],
            items: [[28, 2], [5, 1], [30, 1]],
            skills: [199, 150, 151]
        },
        callejero: {
            name: 'Callejero',
            nameEs: 'Callejero (Marcoh)',
            desc: 'Cuchillo + Armadura ligera. Ataque rápido, robo, tácticas sucias. Alta suerte.',
            stats: { atk: 35, def: 14, matk: 10, mdef: 10, agi: 15, luk: 40 },
            weapons: [2],
            armors: [12],
            items: [[84, 5], [169, 3], [95, 2], [5, 1]],
            skills: [66, 80]
        }
    };

    //=========================================================================
    // Model Router - Dynamic, provider-aware
    //=========================================================================
    const ModelRouter = {
        // Track failed models temporarily
        _failedModels: new Set(),
        _failedExpiry: 60000,
        _failedTimestamps: {},

        // Get models for a context from the active provider
        getModelsForContext(context) {
            const now = Date.now();
            for (const model of this._failedModels) {
                if (now - this._failedTimestamps[model] > this._failedExpiry) {
                    this._failedModels.delete(model);
                }
            }

            const provider = Config.getProvider();
            let models;

            if (Config.apiProvider === 'openrouter') {
                // Prefer user-selected chatModel, then cached free models, then default
                if (Config.chatModel) {
                    models = [Config.chatModel, 'openrouter/free'];
                } else if (Config._cachedFreeModels.length > 0) {
                    models = Config._cachedFreeModels.slice(0, 3).map(m => m.id);
                    models.push('openrouter/free');
                } else {
                    models = provider.defaultModels;
                }
            } else if (Config.apiProvider === 'local') {
                models = [Config.localModel];
            } else {
                // Groq: context-aware lists
                if (context === 'combat') {
                    models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
                } else if (context === 'ambient') {
                    models = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile'];
                } else {
                    // chat — prefer user selection
                    models = Config.chatModel
                        ? [Config.chatModel, 'llama-3.3-70b-versatile']
                        : ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
                }
            }

            return models.filter(m => !this._failedModels.has(m));
        },

        markFailed(model) {
            this._failedModels.add(model);
            this._failedTimestamps[model] = Date.now();
            Debug.warn(`Model marked as failed (1min cooldown): ${model}`);
        },

        getPrimaryModel(context) {
            const available = this.getModelsForContext(context);
            return available[0] || Config.getChatModel();
        }
    };

    //=========================================================================
    // Debug Logger
    //=========================================================================
    const Debug = {
        log: function (...args) {
            if (Config.debugMode) {
                console.log('[AI_Companion]', ...args);
            }
        },
        warn: function (...args) {
            if (Config.debugMode) {
                console.warn('[AI_Companion]', ...args);
            }
        },
        error: function (...args) {
            console.error('[AI_Companion]', ...args);
        },
        battleState: null
    };

    //=========================================================================
    // Thesis Logger — Persistent telemetry for research data collection
    //=========================================================================
    const ThesisLogger = {
        _fs: null,
        _path: null,
        _sessionFile: null,
        _initialized: false,
        _queue: [],         // Buffer for writes during init
        _writeCount: 0,
        _errorCount: 0,

        /**
         * Initialize the logger. Safe to call multiple times — only runs once.
         * Uses NW.js Node integration for filesystem access.
         */
        init() {
            if (this._initialized) return;
            try {
                this._fs = require('fs');
                this._path = require('path');

                // Determine log directory relative to game root
                const gameDir = this._path.dirname(process.execPath);
                const logDir = this._path.join(gameDir, 'ai_companion_logs');

                // Create log directory if it doesn't exist
                if (!this._fs.existsSync(logDir)) {
                    this._fs.mkdirSync(logDir, { recursive: true });
                }

                // Session file: one per game launch
                const sessionId = new Date().toISOString().replace(/[:.]/g, '-');
                this._sessionFile = this._path.join(logDir, `session_${sessionId}.jsonl`);

                // Write header line
                const header = {
                    _type: 'session_start',
                    timestamp: Date.now(),
                    iso: new Date().toISOString(),
                    companion_name: Config.companionName,
                    api_provider: Config.apiProvider,
                    language: Config.language,
                    personality: Config.personality
                };
                this._fs.writeFileSync(this._sessionFile, JSON.stringify(header) + '\n');

                this._initialized = true;
                Debug.log('[ThesisLogger] Initialized. Logging to:', this._sessionFile);

                // Flush any queued entries
                for (const entry of this._queue) {
                    this._write(entry);
                }
                this._queue = [];
            } catch (e) {
                // NW.js not available or fs not accessible — degrade gracefully
                Debug.warn('[ThesisLogger] Cannot initialize (no NW.js?):', e.message);
                this._initialized = false;
            }
        },

        /**
         * Log an interaction. Non-blocking (async fs.appendFile).
         * @param {string} type - 'chat', 'combat_decision', 'ambient', 'item_inspect'
         * @param {Object} data - Interaction-specific data
         */
        log(type, data) {
            // Lazy init on first log call
            if (!this._initialized && !this._fs) this.init();

            const entry = {
                _type: type,
                timestamp: Date.now(),
                session_time_ms: Date.now() - (window._aiCompanionStartTime || Date.now()),

                // Game context
                map_id: typeof $gameMap !== 'undefined' && $gameMap ? $gameMap.mapId() : null,
                map_name: typeof $gameMap !== 'undefined' && $gameMap && $gameMap.displayName ? $gameMap.displayName() : null,
                in_battle: typeof $gameParty !== 'undefined' && $gameParty ? $gameParty.inBattle() : false,

                // Companion state
                companion_name: Config.companionName,
                companion_hp: null,
                companion_mp: null,
                companion_max_hp: null,
                companion_max_mp: null,

                // Player state
                sanity_level: null,
                trust_level: null,

                // Interaction data (varies by type)
                ...data
            };

            // Safely populate companion stats
            try {
                const actor = $gameActors && $gameActors.actor(Config.companionActorId);
                if (actor) {
                    entry.companion_hp = actor.hp;
                    entry.companion_mp = actor.mp;
                    entry.companion_max_hp = actor.mhp;
                    entry.companion_max_mp = actor.mmp;
                }
            } catch (e) { /* actor not ready */ }

            // Safely populate sanity and trust
            try {
                entry.trust_level = RelationshipTracker ? RelationshipTracker.getSummary() : null;
            } catch (e) { /* not ready */ }

            if (!this._initialized) {
                this._queue.push(entry);
                return;
            }
            this._write(entry);
        },

        /**
         * Internal: write a single entry to the log file (non-blocking).
         */
        _write(entry) {
            if (!this._fs || !this._sessionFile) return;
            try {
                const line = JSON.stringify(entry) + '\n';
                this._fs.appendFile(this._sessionFile, line, (err) => {
                    if (err) {
                        this._errorCount++;
                        if (this._errorCount <= 3) {
                            Debug.warn('[ThesisLogger] Write error:', err.message);
                        }
                    } else {
                        this._writeCount++;
                    }
                });
            } catch (e) {
                this._errorCount++;
            }
        },

        /**
         * Get logger stats (for debug display).
         */
        getStats() {
            return {
                initialized: this._initialized,
                sessionFile: this._sessionFile,
                entriesLogged: this._writeCount,
                errors: this._errorCount,
                queueLength: this._queue.length
            };
        }
    };

    // Track session start time for relative timestamps
    window._aiCompanionStartTime = Date.now();

    //=========================================================================
    // Character Presets & Configuration
    //=========================================================================
    const CharacterPresets = {
        // Appearance presets (Face, Sprite) - using available bust images
        // face/faceIndex/sprite must match game Actors; battlerName for battle sprite
        appearances: [
            { id: 'dark_priest', name: 'Sacerdote oscuro', face: 'Actor1', faceIndex: 6, sprite: 'dark_priest', battlerName: 'darkpriest1_1' },
            { id: 'mercenary', name: 'Mercenario', face: 'Actor1', faceIndex: 0, sprite: 'mercenary', battlerName: 'Actor1_1' },
            { id: 'knight', name: 'Caballero', face: 'Actor1', faceIndex: 2, sprite: 'knight', battlerName: 'knight1_1' },
            { id: 'outlander', name: 'Forastero', face: 'Actor1', faceIndex: 7, sprite: 'outlander', battlerName: 'outlander1_1' },
            { id: 'girl', name: 'Niña', face: 'Actor1', faceIndex: 3, sprite: 'girl', battlerName: 'girl1_1_battle' },
            { id: 'marcoh', name: 'Marcoh', face: 'Marcoh_faces', faceIndex: 6, sprite: '%thug', battlerName: 'Thug1_1' }
        ],

        // Personality types — richer descriptions for better AI behavior
        personalities: [
            { id: 'tactical', name: 'Táctico', traits: 'analytical, strategic, calm under pressure, calculates risks before acting, values efficiency and precision' },
            { id: 'aggressive', name: 'Agresivo', traits: 'bold, attack-first mentality, reckless in combat, speaks with intensity, prefers overwhelming force over caution' },
            { id: 'cautious', name: 'Cauteloso', traits: 'survival-first, defensive, careful observer, avoids unnecessary risks, always looking for escape routes' },
            { id: 'chaotic', name: 'Caótico', traits: 'unpredictable, erratic speech patterns, impulsive decisions, dark humor, switches between bravery and cowardice randomly' },
            { id: 'caring', name: 'Protector', traits: 'protective of allies, healer-focused, supportive, self-sacrificing, speaks with warmth and concern' },
            { id: 'marcoh', name: 'Marcoh',
                traits: 'shy, quiet, kind-hearted but haunted by guilt, physically imposing but gentle, speaks softly with few words, protective of companions, street-smart orphan, ex-boxer who killed a man in the ring, seeks peace and redemption',
                backstory: 'You are Marcoh, an orphan from the streets of Vatican City. You grew up fighting to survive, becoming an underground boxer. You killed a man in the ring — an act that still haunts you with guilt. You killed the mobster Riccardo to protect your sister and fled. You are physically large and intimidating but shy and socially awkward. You speak in short, direct sentences. You rarely express emotions openly but care deeply about your companions. You see yourself as a protector. Your speech is simple, humble — never verbose or poetic. You occasionally stutter when nervous. You are ISTP: pragmatic, observant, quiet. You value actions over words.'
            }
        ],

        _currentAppearance: localStorage.getItem('AI_Companion_Appearance') || 'dark_priest',
        _currentPersonality: localStorage.getItem('AI_Companion_Personality') || 'tactical',

        getCurrentAppearance() {
            return this.appearances.find(a => a.id === this._currentAppearance) || this.appearances[0];
        },

        getCurrentPersonality() {
            return this.personalities.find(p => p.id === this._currentPersonality) || this.personalities[0];
        },

        getCurrentPresetName() {
            return this.getCurrentAppearance().name;
        },

        getCurrentPersonalityName() {
            return this.getCurrentPersonality().name;
        },

        setAppearance(id) {
            this._currentAppearance = id;
            localStorage.setItem('AI_Companion_Appearance', id);
            this.applyAppearanceToActor();
        },

        applyAppearanceToActor() {
            const preset = this.getCurrentAppearance();
            const actor = $gameActors && $gameActors.actor(Config.companionActorId);
            if (!actor) return;
            actor.setFaceImage(preset.face, preset.faceIndex);
            actor.setCharacterImage(preset.sprite, 0);
            if (actor.setBattlerImage && preset.battlerName) actor.setBattlerImage(preset.battlerName);
        },

        setPersonality(id) {
            this._currentPersonality = id;
            localStorage.setItem('AI_Companion_Personality', id);
            Config.personality = this.getCurrentPersonality().traits;
        },

        setName(name) {
            Config.companionName = name;
            localStorage.setItem('AI_Companion_Name', name);
        }
    };

    // Load saved name
    const savedName = localStorage.getItem('AI_Companion_Name');
    if (savedName) Config.companionName = savedName;

    // Load saved personality
    Config.personality = CharacterPresets.getCurrentPersonality().traits;

    //=========================================================================
    // AI Companion State
    //=========================================================================
    const AIState = {
        isProcessingTurn: false,
        currentBattleHistory: [],
        lastDecision: null,
        retryCount: 0,
        maxRetries: 1,
        recentDialogs: [],       // Track last N combat dialogs for variety
        lastBattleStateCache: null, // Cache battle state for chat during combat
        lastCombatHash: null,    // State snapshot hash for dedup
        lastCombatDecision: null, // Cached decision when hash matches
        combatActionHistory: [],  // Track AI actions this battle for variety
        playerActionHistory: [],  // Track PLAYER actions this battle for coordination
        // Branch 3: Multi-turn strategy planning
        currentStrategy: null,   // { plan: string, turnsRemaining: number, startTurn: number }
    };

    //=========================================================================
    // RelationshipTracker — structured relationship state (Phase 3)
    //=========================================================================
    const RelationshipTracker = {
        trust: 0,           // -100 to 100
        affinity: 0,        // 0 to 100
        battles_together: 0,
        conversations: 0,
        last_conflict: null,

        getLevel() {
            if (this.trust >= 70 && this.affinity >= 60) return 'bonded';
            if (this.trust >= 30 && this.affinity >= 30) return 'trusted';
            if (this.trust >= 0) return 'neutral';
            return 'distrustful';
        },

        getSummary() {
            return `Trust: ${this.trust}/100 | Affinity: ${this.affinity}/100 | Level: ${this.getLevel()} | Battles: ${this.battles_together} | Conversations: ${this.conversations}${this.last_conflict ? ' | Last conflict: ' + this.last_conflict : ''}`;
        },

        onBattleWon() { this.trust = Math.min(100, this.trust + 3); this.battles_together++; },
        onBattleFled() { this.trust = Math.max(-100, this.trust - 1); this.battles_together++; },
        onConversation() { this.affinity = Math.min(100, this.affinity + 1); this.conversations++; },
        onConflict(desc) { this.trust = Math.max(-100, this.trust - 5); this.last_conflict = desc; },

        // Persistence
        save() {
            return {
                trust: this.trust, affinity: this.affinity, battles_together: this.battles_together,
                conversations: this.conversations, last_conflict: this.last_conflict
            };
        },
        load(data) {
            if (!data) return;
            this.trust = data.trust || 0; this.affinity = data.affinity || 0;
            this.battles_together = data.battles_together || 0;
            this.conversations = data.conversations || 0;
            this.last_conflict = data.last_conflict || null;
        }
    };

    //=========================================================================
    // IntentDetector — multi-label intent classification (Phase 4)
    //=========================================================================
    const IntentDetector = {
        // Keyword patterns for each intent type (Spanish + English)
        _patterns: {
            item_info: /(?:que es|what is|para que sirve|what does|donde encuentro|where.*find|como usar|how.*use|tengo un[oa]?|hierba|herb|vial|pocion|potion|soul stone|piedra|cloth|fragmento|pinecone|dagger|espada|escudo|shield|ring|anillo|armor|armadura|weapon|arma)/i,
            tactical: /(?:que hago|what.*do|como.*mato|how.*kill|como.*peleo|how.*fight|estrategia|strategy|debilidad|weakness|vulnerab|atacar|attack|defender|defend|guard|guardia|coin flip|moneda|limb|miembro|brazo|arm|pierna|leg|cabeza|head|prioridad|priority|enemigo|enemy|pelea|pelear|combate|combat|monstruo|monster|criatura|creature)/i,
            recent_battle: /(?:acabamos|derrotamos|matamos|vencimos|peleamos|que era eso|what was that|que matamos|what.*kill|last fight|ultima pelea|enemigo anterior|que acaba de pasar|recien|just fought|just killed|que paso en la pelea|batalla anterior)/i,
            lore: /(?:quien es|who is|que es este lugar|where.*we|donde estamos|historia|story|lore|dios|god|sylvian|gro.goroth|rher|vinushka|alll.mer|fellowship|mahab|ma'hab|tower|torre|void|vacio|nosramus|pocketcat|legarde|le'garde)/i,
            social: /(?:que opinas|que te parece|del grupo|integrante|nuevo|de ella|de el|quien es este|quienes son|acompañan|que piensas)/i,
            emotional: /(?:como estas|how.*you|como te sientes|how.*feel|tengo miedo|i'm scared|estoy asustado|nervios|nervous|vamos a morir|we.*die|gracias|thank|lo siento|sorry|te quiero|confio|trust)/i,
            status_help: /(?:icon|icono|status|estado|efecto|effect|cura|cure|poison|veneno|bleed|sangr|infect|parasi|burn|quemad|fear|miedo|hunger|hambre|blind|cieg|curse|maldic|fractur|paraliz|ruin|brain flower|flor|confused|confundid|toxic|toxico)/i,
            location: /(?:donde estamos|where.*we|que lugar|what place|mapa|map|nivel|level|piso|floor|zona|zone|area|salida|exit|como.*salir|how.*leave|camino|path|que ves|qué ves|ves algo|what do you see|what.*around|que hay alrededor|qué hay alrededor)/i
        },

        // Branch 5: Intent classification cache (input hash → result)
        _cache: new Map(),
        _cacheMaxSize: 50,
        _llmFallbackEnabled: true,

        _getCacheKey(message) {
            return (message || '')
                .toLowerCase()
                .replace(/\s+/g, ' ')
                .replace(/[!?.,;:"'()[\]{}]+/g, '')
                .trim()
                .substring(0, 80);
        },

        /**
         * Multi-label intent classification
         * @param {string} message - player message
         * @returns {{ types: string[], primary: string, entities: Array, confidence: number }}
         */
        classify(message) {
            const msg = message.toLowerCase().trim();

            // Check cache first
            const cacheKey = this._getCacheKey(message);
            if (this._cache.has(cacheKey)) {
                const cached = this._cache.get(cacheKey);
                if (Date.now() - cached.time < 300000) { // 5 min TTL
                    return cached.result;
                }
                this._cache.delete(cacheKey);
            }

            const types = [];
            let matchCount = 0;

            for (const [type, pattern] of Object.entries(this._patterns)) {
                if (pattern.test(msg)) {
                    types.push(type);
                    matchCount++;
                }
            }

            // Default to generic query if nothing matched
            if (types.length === 0) types.push('generic_query');

            // Primary = first match (order matters in _patterns)
            const primary = types[0];

            // Extract entities
            const entities = this._extractEntities(msg);

            // Branch 5: Improved confidence scoring
            let confidence;
            if (types[0] === 'generic_query') {
                confidence = 0.3; // No regex match — LLM fallback candidate
            } else if (matchCount === 1 && entities.length > 0) {
                confidence = 0.95; // Single intent + confirmed entity
            } else if (matchCount === 1) {
                confidence = 0.8; // Single intent, no entity
            } else if (matchCount >= 2 && entities.length > 0) {
                confidence = 0.85; // Multi-match with entity
            } else {
                confidence = 0.6; // Multi-match, no entities
            }

            // IN-BATTLE OVERRIDE: when in combat, force tactical — EXCEPT for emotional queries
            if (typeof $gameParty !== 'undefined' &&
                ((SceneManager._scene && SceneManager._scene instanceof Scene_Battle) ||
                    (SceneManager._stack && SceneManager._stack.some(function (s) { return s === Scene_Battle; })))) {
                const emotionalPatterns = /como estas|cómo estás|estas bien|estás bien|te duele|como te sientes|cómo te sientes|te encuentras|how are you|are you ok/i;
                const isEmotional = emotionalPatterns.test(msg);
                if (!isEmotional) {
                    const battleIrrelevant = ['item_info', 'lore', 'location', 'emotional', 'social', 'generic_query'];
                    for (let i = types.length - 1; i >= 0; i--) {
                        if (battleIrrelevant.includes(types[i])) types.splice(i, 1);
                    }
                    if (!types.includes('tactical')) types.unshift('tactical');
                    else if (types[0] !== 'tactical') {
                        types.splice(types.indexOf('tactical'), 1);
                        types.unshift('tactical');
                    }
                    confidence = 0.9; // Battle context always high
                }
            }

            const result = {
                types,
                primary: types[0],
                entities,
                confidence
            };

            // Cache the result
            this._cache.set(cacheKey, { result, time: Date.now() });
            if (this._cache.size > this._cacheMaxSize) {
                const firstKey = this._cache.keys().next().value;
                this._cache.delete(firstKey);
            }

            return result;
        },

        /**
         * Branch 5: Async classification with LLM fallback for low-confidence results.
         * Used by ChatSystem.sendMessage() when regex confidence is too low.
         * @param {string} message - player message
         * @returns {Promise<{types: string[], primary: string, entities: Array, confidence: number}>}
         */
        async classifyWithFallback(message) {
            const regexResult = this.classify(message);

            // If confidence is decent, skip LLM — regex is fast and free
            if (regexResult.confidence >= 0.5 || !this._llmFallbackEnabled) {
                return regexResult;
            }

            // Low confidence: ask LLM to classify
            Debug.log('[IntentDetector] Low confidence (' + regexResult.confidence + '), trying LLM fallback...');

            try {
                const llmIntent = await this._classifyViaLLM(message);
                if (llmIntent) {
                    // Merge LLM result: override primary type, keep entities from regex
                    const validTypes = Object.keys(this._patterns).concat(['generic_query']);
                    if (validTypes.includes(llmIntent)) {
                        regexResult.types = [llmIntent, ...regexResult.types.filter(t => t !== llmIntent && t !== 'generic_query')];
                        regexResult.primary = llmIntent;
                        regexResult.confidence = 0.75; // LLM-boosted confidence
                        Debug.log('[IntentDetector] LLM classified as:', llmIntent);

                        // Update cache with improved result
                        const cacheKey = this._getCacheKey(message);
                        this._cache.set(cacheKey, { result: regexResult, time: Date.now() });
                    }
                }
            } catch (e) {
                Debug.warn('[IntentDetector] LLM fallback failed:', e.message);
            }

            return regexResult;
        },

        /**
         * Branch 5: Lightweight LLM intent classification.
         * Sends a minimal prompt to classify the player's message.
         * @param {string} message - player message
         * @returns {Promise<string|null>} - intent type or null
         */
        async _classifyViaLLM(message) {
            const headers = Config.getHeaders();
            const endpoint = Config.getEndpoint();

            if (!Config.apiKey && Config.apiProvider === 'local') return null;

            const classifyPrompt = `Classify this game chat message into ONE category.

Categories:
- item_info: asking about items, weapons, armor, potions, herbs
- tactical: asking about combat, enemies, strategy, how to fight
- recent_battle: talking about a fight that just happened
- lore: asking about game world, gods, characters, story
- social: asking about party members, opinions, relationships
- emotional: expressing feelings, fear, gratitude, trust
- status_help: asking about status effects, poison, bleeding, curses
- location: asking where they are, how to navigate, exits
- generic_query: none of the above

Message: "${message}"

Reply with ONLY the category name, nothing else.`;

            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 3000); // 3s max

            try {
                const models = ModelRouter.getModelsForContext('chat');
                const model = models[0]; // Use fastest available model

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: headers,
                    signal: controller.signal,
                    body: JSON.stringify({
                        model: model,
                        messages: [{ role: 'user', content: classifyPrompt }],
                        temperature: 0.1,
                        max_tokens: 20
                    })
                });
                clearTimeout(timer);

                if (!response.ok) return null;
                const data = await response.json();

                let text = '';
                if (data.choices && data.choices[0]) {
                    const c = data.choices[0];
                    text = (c.message && c.message.content && c.message.content.trim()) ||
                           (c.text && c.text.trim()) || '';
                }

                // Clean up response — just extract the category name
                const cleaned = text.toLowerCase().replace(/[^a-z_]/g, '').trim();
                const validTypes = Object.keys(this._patterns).concat(['generic_query']);
                return validTypes.includes(cleaned) ? cleaned : null;

            } catch (e) {
                clearTimeout(timer);
                if (e.name === 'AbortError') Debug.log('[IntentDetector] LLM classify timed out');
                return null;
            }
        },

        /**
         * Extract and resolve entity names from message
         * @param {string} msg - lowercased message
         * @returns {Array<{name: string, status: string, type: string, match: object|null}>}
         */
        _extractEntities(msg) {
            if (typeof FearHungerKB === 'undefined') return [];
            const entities = [];

            // Try items
            const itemResult = this._resolveEntity(msg, 'item');
            if (itemResult.status !== 'none') entities.push(...itemResult.matches);

            // Try enemies
            const enemyResult = this._resolveEntity(msg, 'enemy');
            if (enemyResult.status !== 'none') entities.push(...enemyResult.matches);

            // Try characters
            const charResult = this._resolveEntity(msg, 'character');
            if (charResult.status !== 'none') entities.push(...charResult.matches);

            // Try locations
            const locResult = this._resolveEntity(msg, 'location');
            if (locResult.status !== 'none') entities.push(...locResult.matches);

            return entities;
        },

        /**
         * Entity Resolution Contract
         * @returns {{ status: "exact"|"ambiguous"|"none", matches: Array }}
         */
        _resolveEntity(msg, entityType) {
            const sources = this._getEntitySource(entityType);
            if (!sources) return { status: 'none', matches: [] };

            const exactMatches = [];
            const fuzzyMatches = [];

            for (const [key, data] of Object.entries(sources)) {
                const displayName = (data.displayName || key.replace(/_/g, ' ')).toLowerCase();
                const displayNameEs = (data.displayNameEs || '').toLowerCase();
                const keyNorm = key.replace(/_/g, ' ');
                const aliases = (data.aliases || []).map(a => a.toLowerCase());

                // Build all names to check against
                const allNames = [displayName, keyNorm, displayNameEs, ...aliases].filter(n => n.length > 0);

                // Exact match against any name variant
                const exactHit = allNames.some(name => msg.includes(name));
                if (exactHit) {
                    exactMatches.push({ name: data.displayName || displayName, key, type: entityType, status: 'exact', match: data, score: 1.0 });
                    continue;
                }

                // Fuzzy / partial match (remove Spanish plurals: "hierbas" → "hierba")
                const msgSingular = msg.replace(/s\b/g, '');
                for (const name of allNames) {
                    const nameSingular = name.replace(/s\b/g, '');
                    // Guard: name must be at least 4 chars to avoid false positives like "ale" matching "viales"
                    if (nameSingular.length < 4) continue;
                    // Guard: name must not be a suffix/substring match inside a longer word
                    // e.g. "ale" should NOT match inside "viales"
                    const nameIdx = msgSingular.indexOf(nameSingular);
                    if (nameIdx === -1) continue;
                    // Check the name is a whole word (preceded by space/start, followed by space/end)
                    const charBefore = nameIdx > 0 ? msgSingular[nameIdx - 1] : ' ';
                    const charAfter = nameIdx + nameSingular.length < msgSingular.length ? msgSingular[nameIdx + nameSingular.length] : ' ';
                    if (charBefore !== ' ' && charBefore !== '¿' && charBefore !== '"') continue;
                    if (charAfter !== ' ' && charAfter !== '?' && charAfter !== '!' && charAfter !== '"' && charAfter !== ',' && charAfter !== '.') continue;
                    const overlap = this._wordOverlap(msg, name);
                    if (overlap > 0.3) {
                        fuzzyMatches.push({ name: data.displayName || displayName, key, type: entityType, status: 'fuzzy', match: data, score: overlap });
                        break; // One fuzzy match per entity is enough
                    }
                }
            }

            if (exactMatches.length === 1) return { status: 'exact', matches: exactMatches };
            if (exactMatches.length > 1) return { status: 'ambiguous', matches: exactMatches };
            if (fuzzyMatches.length === 1) return { status: 'exact', matches: fuzzyMatches };
            if (fuzzyMatches.length > 1) return { status: 'ambiguous', matches: fuzzyMatches.sort((a, b) => b.score - a.score) };
            return { status: 'none', matches: [] };
        },

        _getEntitySource(type) {
            switch (type) {
                case 'item': return FearHungerKB.items;
                case 'enemy': return { ...FearHungerKB.enemies, ...FearHungerKB.bosses };
                case 'character': return FearHungerKB.characters;
                case 'location': return FearHungerKB.locations;
                default: return null;
            }
        },

        _wordOverlap(a, b) {
            const wa = new Set(a.split(/\s+/).filter(w => w.length > 2));
            const wb = new Set(b.split(/\s+/).filter(w => w.length > 2));
            if (wb.size === 0) return 0;
            let overlap = 0;
            for (const w of wb) if (wa.has(w)) overlap++;
            return overlap / wb.size;
        }
    };

    //=========================================================================
    // _extractFromReasoning — Parse Qwen thinking model reasoning_content
    // Extracts the best drafted response from internal chain-of-thought
    //=========================================================================
    function _extractFromReasoning(reasoning) {
        if (!reasoning) return '';
        // Look for "Option N: <Spanish text>" patterns — pick the last one
        const optionMatches = reasoning.match(/Option \d+:\s*([^\n]+)/g);
        if (optionMatches && optionMatches.length > 0) {
            // Take the last option (model's final draft)
            let best = optionMatches[optionMatches.length - 1];
            // Remove "Option N: " prefix
            best = best.replace(/^Option \d+:\s*/, '').trim();
            // Remove trailing English in parentheses: "(I'm Marcoh...)"
            best = best.replace(/\s*\([^)]*\)\s*$/, '').trim();
            // Remove markdown artifacts
            best = best.replace(/\*\*/g, '').replace(/\*/g, '').trim();
            // Remove quotes
            best = best.replace(/^["'\u201c]|["'\u201d]$/g, '').trim();
            if (best.length > 5) return best;
        }
        // Fallback: look for quoted Spanish text
        const quoteMatch = reasoning.match(/["'\u201c]([^"'\u201d]{10,})["'\u201d]/g);
        if (quoteMatch) {
            let best = quoteMatch[quoteMatch.length - 1];
            best = best.replace(/^["'\u201c]|["'\u201d]$/g, '').trim();
            if (best.length > 5) return best;
        }
        // Last resort: take a clean-looking line near the end
        const lines = reasoning.split('\n').filter(l => {
            const t = l.trim();
            return t.length > 10 && !t.startsWith('Thinking') && !t.startsWith('#') &&
                   !t.match(/^\d+\.\s+\*\*/) && !t.startsWith('*') && !t.includes('Constraint') &&
                   !t.includes('Analyze') && !t.includes('Determine');
        });
        if (lines.length > 0) {
            let last = lines[lines.length - 1].trim();
            last = last.replace(/^[\-*#\d.\s]+/, '').trim();
            last = last.replace(/\s*\([^)]*\)\s*$/, '').trim();
            if (last.length > 5) return last;
        }
        return '';
    }

    //=========================================================================
    // KBFallback — LLM-free responses from KB data (Phase 6 safety net)
    //=========================================================================
    const KBFallback = {
        respond(intent) {
            if (!intent || !intent.types) return Config.language === 'es' ? 'No puedo pensar claramente ahora.' : "I can't think clearly right now.";

            // Try to give a KB-based answer for the primary intent
            if (intent.primary === 'item_info' && intent.entities.length > 0) {
                const entity = intent.entities.find(e => e.type === 'item');
                if (entity && entity.match) {
                    const item = entity.match;
                    let text = item.description || '';
                    if (item.effect) text += ` ${item.effect}.`;
                    if (item.tips) text += ` ${item.tips}`;
                    return text || (Config.language === 'es' ? 'No tengo información sobre eso.' : "I don't know about that.");
                }
            }

            if (intent.primary === 'tactical' && intent.entities.length > 0) {
                const entity = intent.entities.find(e => e.type === 'enemy');
                if (entity && entity.match && typeof FearHungerKB !== 'undefined') {
                    return FearHungerKB.getCombatPrompt(entity.name) || (Config.language === 'es' ? 'No sé mucho de ese enemigo.' : "I don't know much about that enemy.");
                }
            }

            if (intent.primary === 'status_help') {
                // Try to find the status from entities or keywords
                if (typeof FearHungerKB !== 'undefined' && FearHungerKB.getStatusEffect) {
                    for (const word of intent.entities.map(e => e.name).concat(intent.types)) {
                        const effect = FearHungerKB.getStatusEffect(word);
                        if (effect) return `${effect.name}: ${effect.effect} ${effect.cure}`;
                    }
                }
            }

            return Config.language === 'es' ? 'No puedo pensar claramente ahora.' : "I can't think clearly right now.";
        }
    };

    //=========================================================================
    // Combat State Hashing — skip API calls when state unchanged
    //=========================================================================
    function hashBattleState(battleState) {
        if (!battleState) return null;
        const parts = [];
        if (battleState.allies) {
            battleState.allies.forEach(a => parts.push(`${a.name}:${a.hp}/${a.max_hp}`));
        }
        if (battleState.enemies) {
            battleState.enemies.filter(e => e.alive).forEach(e => parts.push(`${e.name}:${e.hp}/${e.max_hp}`));
        }
        parts.push('t' + (battleState.turn_number || 0));
        // Simple string hash
        let hash = 0;
        const str = parts.join('|');
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return hash;
    }

    //=========================================================================
    // Equipment Helper - Read actor's equipped gear (weapon, armor, etc.)
    //=========================================================================
    const EquipmentHelper = {
        getEquipment(actor) {
            if (!actor || !actor.equipSlots || !actor.equips) return {};
            const slots = actor.equipSlots();
            const equips = actor.equips();
            const result = {};
            const equipTypes = $dataSystem && $dataSystem.equipTypes ? $dataSystem.equipTypes : [];
            for (let i = 0; i < slots.length; i++) {
                const slotName = equipTypes[slots[i]] || ('Slot ' + (i + 1));
                const item = equips[i];
                result[slotName] = item ? item.name : '(empty)';
            }
            return result;
        },

        formatEquipmentForPrompt(equipObj) {
            if (!equipObj || Object.keys(equipObj).length === 0) return 'None';
            return Object.entries(equipObj).map(([slot, name]) => `${slot}: ${name}`).join(', ');
        }
    };

    //=========================================================================
    // Environment Scanner — Dynamic spatial awareness from $gameMap events
    //=========================================================================
    const EnvironmentScanner = {
        SCAN_RADIUS: 6,  // tiles around the player
        LOCAL_GRID_RADIUS: 4,
        MAX_NEARBY_EVENTS: 16,
        _cache: null,
        _cacheMapId: -1,
        _cachePlayerPos: '',
        _cacheTick: 0,
        CACHE_TTL: 60,   // frames between rescans (~1 second at 60fps)

        _enemySpriteLabels: {
            guard: 'Guardia',
            ghoul: 'Ghoul',
            skeleton: 'Esqueleto',
            mauler: 'Crow Mauler',
            moonless: 'Moonless',
            dark_priest: 'Sacerdote oscuro',
            demon_child: 'Niño demonio',
            demonbaby: 'Bebé demonio',
            mercenary: 'Mercenario',
            knight: 'Caballero',
            captain: "Le'garde",
            outlander: 'Forastero',
            girl: 'Niña'
        },

        _normalize(text) {
            return String(text || '').toLowerCase();
        },

        _mapReady() {
            return !!($gameMap && $dataMap);
        },

        _safeEventData(event) {
            if (!event || event._erased || !$dataMap || !$dataMap.events) return null;
            const eventId = event.eventId ? event.eventId() : event._eventId;
            if (!eventId) return null;
            return $dataMap.events[eventId] || null;
        },

        _safeEventPage(event) {
            const data = this._safeEventData(event);
            if (!data || !data.pages) return null;
            const pageIndex = event && event._pageIndex !== undefined ? event._pageIndex : -1;
            if (pageIndex == null || pageIndex < 0 || pageIndex >= data.pages.length) return null;
            return data.pages[pageIndex] || null;
        },

        _pageCommands(event) {
            const page = this._safeEventPage(event);
            return page && page.list ? page.list : [];
        },

        _databaseName(kind, id) {
            let db = null;
            switch (kind) {
                case 'item': db = window.$dataItems; break;
                case 'weapon': db = window.$dataWeapons; break;
                case 'armor': db = window.$dataArmors; break;
                case 'troop': db = window.$dataTroops; break;
                default: return null;
            }
            return db && db[id] ? db[id].name : null;
        },

        _mapNameById(mapId) {
            if (!$dataMapInfos || !$dataMapInfos[mapId]) return null;
            return $dataMapInfos[mapId].name || null;
        },

        _extractSpeakerName(commands) {
            for (let i = 0; i < commands.length; i++) {
                const command = commands[i];
                if (!command || (command.code !== 108 && command.code !== 408)) continue;
                const text = command.parameters && command.parameters[0] ? String(command.parameters[0]) : '';
                const match = text.match(/(?:name|speaker|nombre|habla)\s*[:=]\s*(.+)$/i);
                if (match) return match[1].trim();
            }
            return null;
        },

        _eventMetadata(event) {
            const commands = this._pageCommands(event);
            const loot = [];
            let transferMapId = null;
            let battleTroopId = null;
            const speakerName = this._extractSpeakerName(commands);

            commands.forEach(command => {
                if (!command) return;
                const params = command.parameters || [];
                if (command.code === 201 && transferMapId === null) {
                    transferMapId = Number(params[1]) || null;
                } else if (command.code === 301 && battleTroopId === null) {
                    battleTroopId = Number(params[1]) || null;
                } else if (command.code === 125) {
                    loot.push({ kind: 'gold', amount: Number(params[2]) || 0 });
                } else if (command.code === 126) {
                    loot.push({ kind: 'item', id: Number(params[0]) || 0, name: this._databaseName('item', Number(params[0]) || 0) });
                } else if (command.code === 127) {
                    loot.push({ kind: 'weapon', id: Number(params[0]) || 0, name: this._databaseName('weapon', Number(params[0]) || 0) });
                } else if (command.code === 128) {
                    loot.push({ kind: 'armor', id: Number(params[0]) || 0, name: this._databaseName('armor', Number(params[0]) || 0) });
                }
            });

            return {
                speakerName: speakerName,
                loot: loot,
                transferMapId: transferMapId,
                transferMapName: transferMapId !== null ? this._mapNameById(transferMapId) : null,
                battleTroopId: battleTroopId,
                battleTroopName: battleTroopId !== null ? this._databaseName('troop', battleTroopId) : null
            };
        },

        _genericEventName(name) {
            return /^(?:ev\d+|event\d+|evt\d+|e\d+)$/i.test(String(name || '').trim());
        },

        _labelFromEnemySprite(sprite) {
            for (const key in this._enemySpriteLabels) {
                if (sprite.includes(key)) return this._enemySpriteLabels[key];
            }
            return 'Enemigo';
        },

        _eventTags(event, metadata) {
            const data = this._safeEventData(event);
            const page = this._safeEventPage(event);
            if (!data || !page) return [];

            const name = this._normalize(data.name);
            const note = this._normalize(data.note);
            const sprite = this._normalize(page.image ? page.image.characterName : '');
            const tags = [];

            const hasKeyword = pattern => pattern.test(name) || pattern.test(note) || pattern.test(sprite);
            const hasTransfer = metadata.transferMapId !== null;
            const hasBattle = metadata.battleTroopId !== null;
            const hasLoot = metadata.loot.length > 0;
            const commands = this._pageCommands(event);
            const commandCodes = {};
            commands.forEach(command => { if (command) commandCodes[command.code] = true; });
            const hasText = !!commandCodes[101] || !!commandCodes[401] || !!commandCodes[102];
            const hasShop = !!commandCodes[302];

            if (hasKeyword(/beartrap/) || hasKeyword(/fear_floor|spike/) || hasKeyword(/arrow_check|arrow/)) tags.push('trap');
            if (hasKeyword(/circle|ritual/) || sprite.includes('portal')) tags.push('save_point');
            if (hasTransfer || hasKeyword(/door|gate|stairs|stair|ladder|warp|exit|entrance|passage/)) tags.push('door');
            if (hasLoot || sprite.includes('chest') || sprite.includes('$boxes') || hasKeyword(/coin|chest|crate|barrel|treasure|loot/)) tags.push('container');
            if (hasBattle || hasKeyword(/enemy|guard|skeleton|ghoul|mauler|moonless|knight|captain|mercenary|priest|monster|creature/)) tags.push('enemy');
            if (hasShop) tags.push('shop');
            if (hasText || metadata.speakerName || hasKeyword(/npc|talk|chained|prisoner|merchant|woman|man|girl|child/)) tags.push('npc');
            if (hasKeyword(/dead|corpse/) || sprite.includes('dead')) tags.push('corpse');
            if (hasKeyword(/flesh|growth|demonseed|seed/) || sprite.includes('flesh') || sprite.includes('growth')) tags.push('hazard');

            return tags.filter((tag, index, list) => list.indexOf(tag) === index);
        },

        _eventType(tags) {
            if (tags.includes('enemy')) return 'enemy';
            if (tags.includes('trap')) return 'trap';
            if (tags.includes('door')) return 'door';
            if (tags.includes('container')) return 'container';
            if (tags.includes('save_point')) return 'save_point';
            if (tags.includes('shop')) return 'shop';
            if (tags.includes('npc')) return 'npc';
            if (tags.includes('hazard')) return 'hazard';
            if (tags.includes('corpse')) return 'corpse';
            return 'event';
        },

        _dangerFor(type, subtype) {
            if (type === 'enemy') return 'high';
            if (type === 'trap') return subtype === 'bear_trap' ? 'high' : 'medium';
            if (type === 'hazard') return subtype === 'demon_seed' ? 'medium' : 'low';
            return 'none';
        },

        _subtypeFor(type, data, page, metadata) {
            const name = this._normalize(data.name);
            const sprite = this._normalize(page && page.image ? page.image.characterName : '');
            if (type === 'trap') {
                if (sprite.includes('beartrap') || name.includes('beartrap')) return 'bear_trap';
                if (name.includes('arrow_check') || name.includes('arrow')) return 'arrow_trap';
                return 'floor_trap';
            }
            if (type === 'enemy') {
                for (const key in this._enemySpriteLabels) {
                    if (sprite.includes(key)) return key;
                }
                if (metadata.battleTroopName) return metadata.battleTroopName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
                return 'enemy';
            }
            if (type === 'container') {
                if (name.includes('coin')) return 'coin';
                return 'chest';
            }
            if (type === 'save_point') return 'ritual_circle';
            if (type === 'hazard') {
                if (name.includes('demonseed') || sprite.includes('seed')) return 'demon_seed';
                return 'organic';
            }
            if (type === 'npc' && (sprite.includes('chained') || name.includes('chained'))) return 'chained';
            return type;
        },

        _labelForEvent(event, type, tags, metadata) {
            const data = this._safeEventData(event);
            const page = this._safeEventPage(event);
            const rawName = data && data.name ? String(data.name).trim() : '';
            const sprite = this._normalize(page && page.image ? page.image.characterName : '');

            if (rawName && !this._genericEventName(rawName) && !/^ev_/i.test(rawName)) {
                return rawName;
            }
            if (metadata.speakerName) return metadata.speakerName;
            if (type === 'door') return 'Puerta';
            if (type === 'save_point') return 'Círculo ritual';
            if (type === 'container') return rawName.toLowerCase().includes('coin') ? 'Moneda' : 'Cofre';
            if (type === 'corpse') return 'Cadáver';
            if (type === 'trap') {
                if (rawName.toLowerCase().includes('arrow')) return 'Trampa de flechas';
                if (sprite.includes('beartrap') || rawName.toLowerCase().includes('beartrap')) return 'Trampa de oso';
                return 'Suelo peligroso';
            }
            if (type === 'hazard') {
                if (rawName.toLowerCase().includes('demonseed') || sprite.includes('seed')) return 'Semilla demoníaca';
                return 'Crecimiento orgánico';
            }
            if (type === 'npc') {
                if (sprite.includes('chained') || rawName.toLowerCase().includes('chained')) return 'Prisionero encadenado';
                return 'NPC';
            }
            if (type === 'enemy') {
                if (metadata.battleTroopName) return metadata.battleTroopName;
                return this._labelFromEnemySprite(sprite);
            }
            if (type === 'shop') return 'Comerciante';
            return rawName || 'Evento';
        },

        /**
         * Get cardinal direction from player to target.
         */
        _getDirection(dx, dy) {
            if (Math.abs(dx) > Math.abs(dy)) {
                return dx > 0 ? 'este' : 'oeste';
            } else if (Math.abs(dy) > Math.abs(dx)) {
                return dy > 0 ? 'sur' : 'norte';
            }
            return (dy > 0 ? 'sur' : 'norte') + (dx > 0 ? 'este' : 'oeste');
        },

        _tileStandable(x, y) {
            if (!this._mapReady() || !$gameMap.isValid(x, y)) return false;
            const directions = [2, 4, 6, 8];
            for (let i = 0; i < directions.length; i++) {
                if ($gameMap.isPassable(x, y, directions[i])) return true;
            }
            return false;
        },

        _symbolForEventType(type) {
            switch (type) {
                case 'enemy': return 'E';
                case 'trap': return 'T';
                case 'door': return 'D';
                case 'container': return 'C';
                case 'npc': return 'N';
                case 'save_point': return 'S';
                case 'hazard': return 'H';
                case 'corpse': return 'X';
                default: return '?';
            }
        },

        _eventSnapshot(event, px, py) {
            const data = this._safeEventData(event);
            const page = this._safeEventPage(event);
            if (!data || !page) return null;

            const rawName = data.name || '';
            const sprite = this._normalize(page.image ? page.image.characterName : '');
            if (!sprite && !rawName) return null;

            const metadata = this._eventMetadata(event);
            const tags = this._eventTags(event, metadata);
            if (tags.length === 0) return null;

            const type = this._eventType(tags);
            const subtype = this._subtypeFor(type, data, page, metadata);
            const dx = event.x - px;
            const dy = event.y - py;
            const distance = Math.abs(dx) + Math.abs(dy);
            const label = this._labelForEvent(event, type, tags, metadata);

            return {
                id: event.eventId ? event.eventId() : event._eventId,
                type: type,
                subtype: subtype,
                danger: this._dangerFor(type, subtype),
                label: label,
                rawName: rawName,
                tags: tags,
                distance: distance,
                direction: this._getDirection(dx, dy),
                x: event.x,
                y: event.y,
                dx: dx,
                dy: dy,
                sprite: page.image ? page.image.characterName : '',
                loot: metadata.loot,
                transferMapId: metadata.transferMapId,
                transferMapName: metadata.transferMapName,
                battleTroopId: metadata.battleTroopId,
                battleTroopName: metadata.battleTroopName,
                speakerName: metadata.speakerName
            };
        },

        /**
         * Scan the current map for notable objects near the player.
         * Returns structured snapshots instead of only a flat label list.
         */
        scan() {
            if (!$gameMap || !$gamePlayer) return [];

            // Cache check: reuse result if player hasn't moved and TTL not expired
            const posKey = `${$gamePlayer.x},${$gamePlayer.y}`;
            this._cacheTick++;
            if (this._cacheMapId === $gameMap.mapId() &&
                this._cachePlayerPos === posKey &&
                this._cacheTick < this.CACHE_TTL &&
                this._cache) {
                return this._cache;
            }

            const px = $gamePlayer.x;
            const py = $gamePlayer.y;
            const radius = this.SCAN_RADIUS;
            const results = [];

            const events = $gameMap.events();
            for (const event of events) {
                if (!event) continue;

                const dx = event.x - px;
                const dy = event.y - py;
                const dist = Math.abs(dx) + Math.abs(dy);
                if (dist > radius || dist === 0) continue;

                const snapshot = this._eventSnapshot(event, px, py);
                if (!snapshot) continue;
                results.push(snapshot);
            }

            const dangerOrder = { high: 0, medium: 1, low: 2, none: 3 };
            results.sort((a, b) => {
                const da = dangerOrder[a.danger] || 3;
                const db = dangerOrder[b.danger] || 3;
                if (da !== db) return da - db;
                if (a.type !== b.type) return a.type < b.type ? -1 : 1;
                return a.distance - b.distance;
            });

            this._cache = results.slice(0, this.MAX_NEARBY_EVENTS);
            this._cacheMapId = $gameMap.mapId();
            this._cachePlayerPos = posKey;
            this._cacheTick = 0;
            return this._cache;
        },

        getPointsOfInterest() {
            const nearby = this.scan();
            const priority = {
                trap: 120,
                enemy: 100,
                container: 80,
                save_point: 70,
                door: 60,
                npc: 50,
                hazard: 40,
                corpse: 10
            };
            return nearby
                .filter(entry => ['trap', 'enemy', 'container', 'save_point', 'door', 'npc', 'hazard'].includes(entry.type))
                .sort((a, b) => {
                    const pa = priority[a.type] || 0;
                    const pb = priority[b.type] || 0;
                    if (pa !== pb) return pb - pa;
                    return a.distance - b.distance;
                })
                .slice(0, 8);
        },

        getLocalGrid(radius) {
            if (!this._mapReady() || !$gamePlayer) return null;
            const scanRadius = radius === undefined ? this.LOCAL_GRID_RADIUS : Number(radius) || this.LOCAL_GRID_RADIUS;
            const nearby = this.scan();
            const eventsByKey = {};
            nearby.forEach(entry => { eventsByKey[entry.x + ',' + entry.y] = entry; });

            const rows = [];
            for (let y = $gamePlayer.y - scanRadius; y <= $gamePlayer.y + scanRadius; y++) {
                let text = '';
                for (let x = $gamePlayer.x - scanRadius; x <= $gamePlayer.x + scanRadius; x++) {
                    const key = x + ',' + y;
                    if (!$gameMap.isValid(x, y)) {
                        text += ' ';
                    } else if ($gamePlayer.x === x && $gamePlayer.y === y) {
                        text += '@';
                    } else if (eventsByKey[key]) {
                        text += this._symbolForEventType(eventsByKey[key].type);
                    } else {
                        text += this._tileStandable(x, y) ? '.' : '#';
                    }
                }
                rows.push({ y: y, text: text });
            }

            return {
                radius: scanRadius,
                origin: { x: $gamePlayer.x, y: $gamePlayer.y },
                rows: rows
            };
        },

        observe() {
            return {
                map: {
                    id: $gameMap ? $gameMap.mapId() : null,
                    name: $gameMap && $gameMap.displayName ? ($gameMap.displayName() || ('Map ' + $gameMap.mapId())) : null
                },
                nearbyEvents: this.scan(),
                pointsOfInterest: this.getPointsOfInterest(),
                localGrid: this.getLocalGrid()
            };
        },

        /**
         * Get a human-readable summary for prompt injection.
         * Returns empty string if nothing notable nearby.
         */
        getSummary() {
            const nearby = this.getPointsOfInterest();
            if (nearby.length === 0) return '';

            const lines = [];
            const dangerItems = nearby.filter(n => n.danger === 'high' || n.type === 'trap');
            const otherItems = nearby.filter(n => !(n.danger === 'high' || n.type === 'trap'));

            for (const item of dangerItems) {
                lines.push(`⚠ ${item.label} a ${item.distance} pasos al ${item.direction}`);
            }
            for (const item of otherItems.slice(0, 4)) {
                lines.push(`${item.label} a ${item.distance} pasos al ${item.direction}`);
            }

            return lines.join('; ');
        },

        /**
         * Check if any high-danger items are within immediate range (1-2 tiles).
         * Used by AmbientDialogue for proactive warnings.
         */
        getImmediateThreats() {
            const nearby = this.scan();
            return nearby.filter(n =>
                (n.type === 'enemy' || n.type === 'trap' || n.type === 'hazard') &&
                (n.danger === 'high' || n.danger === 'medium') &&
                n.distance <= 2
            );
        }
    };

    //=========================================================================
    // Map Context - Friendly names and tips so AI knows "where we are"
    //=========================================================================
    const MapContextHelper = {
        // Map ID or display name -> { displayName, tips[] }. Use for "Where are we?" and location-aware chat.
        // Fallback tips for maps identified by ID only (no display name in game data)
        mapTipsFallback: {
            '1': { displayName: 'Entrance / Starting area', tips: ['Dogs will chase and attack if you linger here too long.', 'Move quickly to avoid the pack.'] },
            '2': { displayName: 'Basement / Lower levels', tips: ['Guards patrol. Consider disguise.'] }
        },

        /**
         * Try to match a map name to FearHungerKB locations and enemy data
         */
        _matchKB(mapName) {
            if (!mapName || typeof FearHungerKB === 'undefined') return null;
            const norm = mapName.toLowerCase().replace(/[^a-z0-9áéíóúñü]/g, '');
            const tips = [];

            // Match against KB locations — check BOTH English and Spanish names
            if (FearHungerKB.locations) {
                for (const key in FearHungerKB.locations) {
                    const loc = FearHungerKB.locations[key];
                    const locNorm = (loc.displayName || key).toLowerCase().replace(/[^a-z0-9áéíóúñü]/g, '');
                    const locNormEs = (loc.displayNameEs || '').toLowerCase().replace(/[^a-z0-9áéíóúñü]/g, '');
                    if (norm.includes(locNorm) || locNorm.includes(norm) ||
                        (locNormEs && (norm.includes(locNormEs) || locNormEs.includes(norm)))) {
                        if (loc.tips) tips.push(...loc.tips);
                        if (loc.description) tips.push(loc.description);
                        return { displayName: loc.displayNameEs || loc.displayName || mapName, tips };
                    }
                }
            }

            // Match against enemy locations to build area-context hints
            const enemiesHere = [];
            const allEnemies = { ...(FearHungerKB.enemies || {}), ...(FearHungerKB.bosses || {}) };
            for (const key in allEnemies) {
                const e = allEnemies[key];
                if (e.location && e.location.some(l => {
                    const lNorm = l.toLowerCase().replace(/[^a-z0-9áéíóúñü]/g, '');
                    return norm.includes(lNorm) || lNorm.includes(norm);
                })) {
                    enemiesHere.push((e.displayNameEs || e.displayName) + (e.danger >= 4 ? ' (¡peligroso!)' : ''));
                }
            }
            if (enemiesHere.length > 0) {
                tips.push('Enemigos en esta zona: ' + enemiesHere.join(', ') + '.');
            }

            // Hardcoded area-specific tips (English + Spanish) as last resort
            const hardcoded = {
                'entrance': 'Dogs will chase and attack if you linger.',
                'entrada': 'Los perros te perseguirán si te quedas.',
                'courtyard': 'Open area. Dagger can be found here.',
                'patio': 'Área abierta. Se puede encontrar un puñal.',
                'innerhall': 'Crow Mauler stalks this area. Trortur\'s secret chamber is here.',
                'inner hall': 'Crow Mauler stalks this area. Trortur\'s secret chamber is here.',
                'salainterior': 'El Crow Mauler acecha esta zona. La cámara secreta de Trortur está aquí.',
                'pasillointerior': 'El Crow Mauler acecha esta zona. La cámara secreta de Trortur está aquí.',
                'bloodpit': 'Human Hydra here can be used for stat farming.',
                'blood pit': 'Human Hydra here can be used for stat farming.',
                'pozodesangre': 'La Hidra Humana está aquí. Útil para subir estadísticas.',
                'pozosangre': 'La Hidra Humana está aquí. Útil para subir estadísticas.',
                'prisons': 'Prisoners and Skeletons can be recruited.',
                'prisiones': 'Prisioneros y Esqueletos pueden ser reclutados.',
                'thicket': 'Infection is common. Stock green herbs.',
                'espesura': 'Las infecciones son comunes. Lleva hierba verde.',
                'catacombs': 'Skin Granny is here. Bring Penance armor or Iron mask.',
                'catacumbas': 'La Skin Granny está aquí. Trae armadura de Penitencia o máscara de hierro.',
                'mahabre': 'Ancient city. Yellow Mages and Moonless.',
                "ma'habre": 'Ancient city. Yellow Mages and Moonless.',
                'escalera': 'Escalera que conecta los niveles de la mazmorra.',
                'sótano': 'Corredores del sótano. Guardias y enemigos de élite patrullan.',
                'sotano': 'Corredores del sótano. Guardias y enemigos de élite patrullan.',
                'cavernas': 'Cuevas naturales. Arañas y comerciantes Cavedweller.',
                'minas': 'Minas abandonadas. Espectros mineros y el Altar de la Oscuridad.'
            };
            for (const hKey in hardcoded) {
                if (norm.includes(hKey.replace(/[^a-z0-9áéíóúñü]/g, ''))) {
                    tips.push(hardcoded[hKey]);
                    break;
                }
            }

            return tips.length > 0 ? { displayName: mapName, tips } : null;
        },

        getMapContext() {
            if (!$gameMap) return { displayName: 'Unknown', tips: [] };
            const mapId = String($gameMap.mapId());
            const displayName = $gameMap.displayName() || ('Map ' + mapId);

            // Try KB matching first (dynamic)
            const kbMatch = this._matchKB(displayName);
            if (kbMatch) return { ...kbMatch, rawDisplayName: displayName };

            // Fallback to ID-based tips
            const byId = this.mapTipsFallback[mapId];
            return {
                displayName: byId ? byId.displayName : displayName,
                rawDisplayName: displayName,
                tips: byId && byId.tips ? byId.tips : []
            };
        }
    };

    //=========================================================================
    // Limb Effects Knowledge Base
    //=========================================================================
    const LIMB_EFFECTS = {
        "right arm": ["primary weapon attacks", "can be disarmed", "main attack source"],
        "left arm": ["secondary attacks", "shield if equipped", "grappling"],
        "right_arm": ["primary weapon attacks", "can be disarmed", "main attack source"],
        "left_arm": ["secondary attacks", "shield if equipped", "grappling"],
        "head": ["instant death if destroyed on humanoids", "high priority target"],
        "legs": ["disables movement", "reduces evasion", "prevents escape"],
        "torso": ["main body damage", "critical hits"],
        "paw": ["claw attacks", "reduced damage if destroyed"],
        "tail": ["tail attacks", "balance"],
        "armor": ["damage reduction", "must destroy for body access"]
    };

    //=========================================================================
    // BattleStateExtractor - Captures current battle state
    //=========================================================================
    class BattleStateExtractor {
        static extract() {
            // Check Scene_Battle: current scene OR in scene stack (chat is pushed on top)
            const sceneIsBattle = (SceneManager._scene && SceneManager._scene instanceof Scene_Battle) ||
                (SceneManager._stack && SceneManager._stack.some(function (s) { return s === Scene_Battle; }));
            if (!sceneIsBattle && !($gameParty.inBattle && $gameParty.inBattle())) {
                Debug.warn('Attempted to extract battle state outside of battle');
                return null;
            }

            const state = {
                turn_number: $gameTroop.turnCount(),
                allies: this._extractAllies(),
                enemies: this._extractEnemiesWithLimbs(),
                companion: this._extractCompanion()
            };

            Debug.battleState = state;
            if (Config.debugMode) {
                Debug.log('[Combat] Battle state extracted. Turn:', state.turn_number, 'Allies:', state.allies.length, 'Enemies:', state.enemies.filter(e => e.alive).map(e => e.name));
            }
            return state;
        }

        static _extractAllies() {
            return $gameParty.battleMembers().map(actor => ({
                name: actor.name(),
                actor_id: actor.actorId(),
                hp: actor.hp,
                max_hp: actor.mhp,
                mp: actor.mp,
                max_mp: actor.mmp,
                states: actor.states().map(s => s.name),
                is_companion: actor.actorId() === Config.companionActorId,
                can_act: actor.canMove(),
                equipment: EquipmentHelper.getEquipment(actor)
            }));
        }

        static _extractEnemiesWithLimbs() {
            const enemies = $gameTroop.members();
            const processed = [];
            const limbPattern = /\[(.*?)\]/;  // Matches [right arm], [left arm], etc.

            // First pass: identify main bodies and their limbs
            const mainBodies = new Map();
            const limbMap = new Map();

            enemies.forEach((enemy, index) => {
                const match = enemy.name().match(limbPattern);
                if (match) {
                    // This is a limb
                    const limbType = match[1].toLowerCase();
                    const baseName = enemy.name().replace(limbPattern, '').trim();

                    if (!limbMap.has(baseName)) {
                        limbMap.set(baseName, []);
                    }
                    limbMap.get(baseName).push({
                        type: limbType,
                        enemy_id: enemy.enemyId(),
                        troop_index: index,
                        hp: enemy.hp,
                        max_hp: enemy.mhp,
                        alive: enemy.isAlive(),
                        effects: LIMB_EFFECTS[limbType] || ['unknown function']
                    });
                } else {
                    // This is a main body
                    mainBodies.set(enemy.name(), {
                        name: enemy.name(),
                        enemy_id: enemy.enemyId(),
                        troop_index: index,
                        hp: enemy.hp,
                        max_hp: enemy.mhp,
                        alive: enemy.isAlive(),
                        states: enemy.states().map(s => s.name),
                        is_main_body: true,
                        limbs: {}
                    });
                }
            });

            // Second pass: attach limbs to main bodies
            mainBodies.forEach((body, name) => {
                const limbs = limbMap.get(name) || [];
                limbs.forEach(limb => {
                    body.limbs[limb.type] = limb;
                });
                processed.push(body);
            });

            // Also include standalone enemies (those without associated body)
            limbMap.forEach((limbs, baseName) => {
                if (!mainBodies.has(baseName)) {
                    // Orphan limbs - create a virtual main body
                    // In F&H, the main body part varies: use highest max_hp limb
                    const mainLimb = limbs.reduce((best, limb) =>
                        (limb.max_hp > best.max_hp) ? limb : best
                        , limbs[0]);
                    processed.push({
                        name: baseName,
                        enemy_id: mainLimb.enemy_id,
                        troop_index: mainLimb.troop_index,
                        hp: mainLimb.hp,
                        max_hp: mainLimb.max_hp,
                        alive: limbs.some(l => l.alive),
                        states: [],
                        is_main_body: false,
                        limbs: Object.fromEntries(limbs.map(l => [l.type, l]))
                    });
                }
            });

            // Fix HP for main bodies that show 0/0 — use highest-HP limb (not just torso)
            // In F&H, different enemies use different body parts as main HP:
            // Maneba → cabeza (1000 HP), Bruja Negra → torso (1300 HP)
            processed.forEach(body => {
                if (body.hp === 0 && body.max_hp === 0 && body.limbs) {
                    const limbEntries = Object.values(body.limbs);
                    if (limbEntries.length > 0) {
                        // Find the limb with the highest max_hp — that's the "real" body
                        const mainLimb = limbEntries.reduce((best, limb) =>
                            (limb.max_hp > best.max_hp) ? limb : best
                            , limbEntries[0]);
                        body.hp = mainLimb.hp;
                        body.max_hp = mainLimb.max_hp;
                        body.alive = mainLimb.alive;
                        if (!body.enemy_id) body.enemy_id = mainLimb.enemy_id;
                        if (body.troop_index === null) body.troop_index = mainLimb.troop_index;
                    }
                }
            });

            return processed;
        }

        static _extractCompanion() {
            const companion = $gameActors.actor(Config.companionActorId);
            if (!companion) {
                Debug.warn('Companion actor not found:', Config.companionActorId);
                return null;
            }

            return {
                name: Config.companionName,
                actor_id: Config.companionActorId,
                hp: companion.hp,
                max_hp: companion.mhp,
                mp: companion.mp,
                max_mp: companion.mmp,
                states: companion.states().map(s => s.name),
                equipment: EquipmentHelper.getEquipment(companion),
                skills: companion.skills().map(s => {
                    // Categorize skill for the AI
                    const dmg = s.damage || {};
                    let category = 'unknown';
                    if (s.scope === 11 || s.scope === 7) category = 'self-buff';
                    else if (s.scope >= 7 && s.scope <= 10) category = 'ally';
                    else if (s.scope >= 1 && s.scope <= 6) category = dmg.type > 0 ? 'attack' : 'debuff';
                    if (dmg.type === 3 || dmg.type === 4) category = 'heal';
                    return {
                        id: s.id,
                        name: s.name,
                        mp_cost: s.mpCost,
                        scope: s.scope,
                        category: category,
                        deals_damage: dmg.type > 0 && dmg.formula && dmg.formula !== '0'
                    };
                }),
                items: $gameParty.items().slice(0, 10).map(i => ({
                    id: i.id,
                    name: i.name
                }))
            };
        }
    }

    //=========================================================================
    // ActionExecutor - Executes AI decisions
    //=========================================================================
    class ActionExecutor {
        static ACTION_ALIASES = {
            'attack': 'attack',
            'atacar': 'attack',
            'basic attack': 'attack',
            'defend': 'guard',
            'guard': 'guard',
            'defender': 'guard',
            'defenderse': 'guard',
            'guardia': 'guard',
            'heal': 'heal',
            'curar': 'heal',
            'use': 'use',
            'usar': 'use',
            'flee': 'flee',
            'run': 'flee',
            'escape': 'flee',
            'huir': 'flee',
            'correr': 'flee'
        };

        static execute(actor, decision) {

            if (!decision || !decision.action) {
                Debug.warn('Invalid decision, using fallback');
                return this._executeFallback(actor);
            }

            // Map decision to RPG Maker action
            const action = new Game_Action(actor);
            const normalizedAction = this._normalizeActionName(decision.action);

            if (normalizedAction === 'attack') {
                action.setAttack();
            } else if (normalizedAction === 'guard') {
                action.setGuard();
            } else {
                // Try to find skill by name
                const skill = this._findSkillByName(actor, decision.action);
                if (skill) {
                    // SAFETY: If the skill is a self-buff (scope 11, no damage) but the
                    // decision is targeting an enemy, fall back to basic attack.
                    // This prevents the AI from using "Ataque rápido" (speed buff) thinking
                    // it's a fast attack.
                    const dmg = skill.damage || {};
                    const isSelfBuff = (skill.scope === 11 || skill.scope === 7) && (!dmg.type || dmg.type === 0);
                    const isTargetingEnemy = decision.target && decision.limb;
                    if (isSelfBuff && isTargetingEnemy) {
                        Debug.log(`[Combat] Skill "${skill.name}" is a self-buff, not an attack. Using basic attack instead.`);
                        action.setAttack();
                    } else {
                        action.setSkill(skill.id);
                    }
                } else {
                    // Try item
                    const item = this._findItemByName(decision.action);
                    if (item) {
                        action.setItem(item.id);
                    } else {
                        // Last fallback: if the action name looks like an attack intent, use basic attack
                        const attackIntent = /atac|attack|golpe|hit|slash|cut|stab|cortar/i.test(decision.action);
                        if (attackIntent) {
                            Debug.log(`[Combat] Unknown skill "${decision.action}" but attack intent detected, using basic attack.`);
                            action.setAttack();
                        } else {
                            Debug.warn('Unknown action:', decision.action);
                            return this._executeFallback(actor);
                        }
                    }
                }
            }

            // Set target
            const targetIndex = this._resolveTarget(decision);
            if (targetIndex !== null) {
                action.setTarget(targetIndex);
            }

            actor.setAction(0, action);
            AIState.lastDecision = decision;

            // Track action for history injection into future prompts
            AIState.combatActionHistory.push({
                turn: $gameTroop ? $gameTroop.turnCount() : '?',
                action: decision.action,
                target: decision.target || 'unknown',
                limb: decision.limb || 'none'
            });

            // Show dialog: ALWAYS if it contains tactical/coordination content, 50% otherwise
            const hasTacticalContent = decision.dialog && /\!|primero|brazo|arma|cuidado|guardia|moneda|curar|heal/i.test(decision.dialog);
            if (hasTacticalContent || Math.random() < 0.5) {
                let dialogText = (decision.dialog && decision.dialog.trim()) ? decision.dialog : null;
                // Fallback to generated dialog if LLM returned empty/bad dialog
                if (!dialogText) {
                    dialogText = this._generateQuickDialog(decision);
                }
                if (dialogText) {
                    this._showDialogue(dialogText);
                    // Track dialog for variety in future prompts
                    AIState.recentDialogs.push(dialogText);
                    if (AIState.recentDialogs.length > 5) AIState.recentDialogs.shift();
                }
            }

            // Log reasoning (debug only)
            if (decision.reasoning) {
                Debug.log('AI Reasoning:', decision.reasoning);
            }

            return true;
        }

        static _normalizeActionName(name) {
            if (!name) return '';
            const key = name.toLowerCase().trim();
            return this.ACTION_ALIASES[key] || key;
        }

        static _findSkillByName(actor, name) {
            return actor.skills().find(s =>
                s.name.toLowerCase() === name.toLowerCase()
            );
        }

        static _findItemByName(name) {
            return $gameParty.items().find(i =>
                i.name.toLowerCase() === name.toLowerCase()
            );
        }

        // Bilingual limb name map for English↔Spanish matching
        static LIMB_TRANSLATIONS = {
            'left arm': 'brazo izquierdo', 'right arm': 'brazo derecho',
            'left leg': 'pierna izquierda', 'right leg': 'pierna derecha',
            'head': 'cabeza', 'torso': 'torso', 'stinger': 'aguijón',
            'tail': 'cola', 'wings': 'alas', 'claws': 'garras',
            'legs': 'piernas',
            'brazo izquierdo': 'left arm', 'brazo derecho': 'right arm',
            'pierna izquierda': 'left leg', 'pierna derecha': 'right leg',
            'cabeza': 'head', 'aguijón': 'stinger', 'aguijon': 'stinger',
            'cola': 'tail', 'alas': 'wings', 'garras': 'claws',
            'piernas': 'legs'
        };

        static _normalizeLimbName(limb) {
            if (!limb) return '';
            const key = limb.toLowerCase().trim();
            return key === 'piernas' ? 'legs' : key;
        }

        static _resolveTarget(decision) {
            if (!decision.target) return 0;

            // Check if targeting a limb
            if (decision.limb && decision.target) {
                const enemies = BattleStateExtractor._extractEnemiesWithLimbs();
                for (const enemy of enemies) {
                    if (enemy.name.toLowerCase() === decision.target.toLowerCase()) {
                        const limbKey = this._normalizeLimbName(decision.limb);
                        const limbKeyUnderscore = limbKey.replace(/ /g, '_');
                        // Build search keys: original + translated equivalent
                        const translated = this.LIMB_TRANSLATIONS[limbKey] || '';
                        const translatedUnderscore = translated.replace(/ /g, '_');

                        // Try all variations
                        let limb = enemy.limbs[limbKey] || enemy.limbs[limbKeyUnderscore]
                            || enemy.limbs[translated] || enemy.limbs[translatedUnderscore];

                        // If not found, fuzzy search all limbs
                        if (!limb) {
                            for (const [key, value] of Object.entries(enemy.limbs)) {
                                const keyLower = key.toLowerCase();
                                const keyTranslated = (this.LIMB_TRANSLATIONS[keyLower] || '').toLowerCase();
                                if (keyLower.includes(limbKey) || limbKey.includes(keyLower) ||
                                    keyTranslated.includes(limbKey) || limbKey.includes(keyTranslated)) {
                                    limb = value;
                                    break;
                                }
                            }
                        }

                        if (limb && limb.alive) {
                            decision.target = enemy.name;
                            decision.limb = limb.type;
                            Debug.log(`Resolved limb target: ${decision.target} [${decision.limb}] -> troop index ${limb.troop_index}`);
                            return limb.troop_index;
                        } else {
                            Debug.warn(`Limb not found or dead: ${decision.limb}. Available limbs:`, Object.keys(enemy.limbs));
                            // Fallback: find ANY alive limb to avoid wasting turn
                            for (const [key, value] of Object.entries(enemy.limbs)) {
                                if (value.alive && key !== 'torso') {
                                    decision.target = enemy.name;
                                    decision.limb = key;
                                    Debug.log(`Fallback limb: ${key} -> troop index ${value.troop_index}`);
                                    return value.troop_index;
                                }
                            }
                            // Last resort: torso
                            if (enemy.limbs.torso && enemy.limbs.torso.alive) {
                                decision.target = enemy.name;
                                decision.limb = 'torso';
                                return enemy.limbs.torso.troop_index;
                            }
                        }
                    }
                }
            }

            // Target by name (enemy)
            const enemies = $gameTroop.members();
            for (let i = 0; i < enemies.length; i++) {
                if (enemies[i].name().toLowerCase().includes(decision.target.toLowerCase())) {
                    return i;
                }
            }

            // Target self or ally
            if (decision.target.toLowerCase() === 'self') {
                return $gameParty.battleMembers().findIndex(
                    a => a.actorId() === Config.companionActorId
                );
            }

            return 0;
        }

        static _executeFallback(actor) {
            Debug.log('Executing fallback: Defend');
            const action = new Game_Action(actor);
            action.setGuard();
            actor.setAction(0, action);
            return true;
        }

        static _showDialogue(text) {
            // Show combat dialogue as a floating overlay at the TOP of the screen
            // Non-blocking, auto-fades after ~3 seconds
            if (!text || text.length === 0) return;

            const maxLen = 80;
            const truncated = text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
            const scene = SceneManager._scene;
            if (!scene) return;

            // Remove any existing combat dialog sprite
            if (scene._aiCombatDialogSprite) {
                try {
                    if (scene._aiCombatDialogSprite.parent) {
                        scene.removeChild(scene._aiCombatDialogSprite);
                    }
                    if (scene._aiCombatDialogSprite.bitmap) {
                        scene._aiCombatDialogSprite.bitmap = null;
                    }
                } catch (e) { /* cleanup */ }
                if (scene._aiCombatDialogFadeTimer) {
                    clearInterval(scene._aiCombatDialogFadeTimer);
                }
            }

            // Create a wide banner at the top of the screen
            const bannerHeight = 44;
            const bannerWidth = Graphics.width;
            const sprite = new Sprite(new Bitmap(bannerWidth, bannerHeight));

            // Draw semi-transparent background
            sprite.bitmap.fillRect(0, 0, bannerWidth, bannerHeight, 'rgba(0, 0, 0, 0.7)');

            // Draw companion name in orange
            const nameText = Config.companionName + ': ';
            sprite.bitmap.fontSize = 18;
            sprite.bitmap.textColor = '#ffb74d';
            sprite.bitmap.outlineColor = '#000000';
            sprite.bitmap.outlineWidth = 3;
            const nameWidth = sprite.bitmap.measureTextWidth(nameText);
            sprite.bitmap.drawText(nameText, 20, 4, nameWidth + 10, bannerHeight - 8, 'left');

            // Draw dialog text in white
            sprite.bitmap.textColor = '#ffffff';
            sprite.bitmap.drawText(truncated, 20 + nameWidth + 4, 4, bannerWidth - nameWidth - 50, bannerHeight - 8, 'left');

            sprite.x = 0;
            sprite.y = 0;
            sprite.opacity = 0; // Start transparent for fade-in
            scene.addChild(sprite);
            scene._aiCombatDialogSprite = sprite;

            // Animate: fade in, hold, fade out
            let frames = 0;
            const fadeTimer = setInterval(() => {
                frames++;
                if (frames <= 10) {
                    // Fade in over 10 frames (~160ms)
                    sprite.opacity = Math.min(255, sprite.opacity + 26);
                } else if (frames > 180) {
                    // Fade out after ~3 seconds
                    sprite.opacity -= 6;
                    if (sprite.opacity <= 0) {
                        clearInterval(fadeTimer);
                        try {
                            if (sprite.parent) scene.removeChild(sprite);
                            if (sprite.bitmap) sprite.bitmap = null;
                            scene._aiCombatDialogSprite = null;
                        } catch (e) { /* cleanup */ }
                    }
                }
                // Safety: force cleanup after 6 seconds
                if (frames > 360) {
                    clearInterval(fadeTimer);
                    try {
                        if (sprite.parent) scene.removeChild(sprite);
                        if (sprite.bitmap) sprite.bitmap = null;
                        scene._aiCombatDialogSprite = null;
                    } catch (e) { /* cleanup */ }
                }
            }, 16);
            scene._aiCombatDialogFadeTimer = fadeTimer;
        }
    }

    //=========================================================================
    // GeminiAPIHandler - Communicates with Gemini 3.0 Flash
    //=========================================================================
    class GeminiAPIHandler {
        static async getDecision(battleState, retryContext = null) {
            if (Config.useMockAI) {
                return this._getMockDecision(battleState);
            }

            try {
                const prompt = this._buildPrompt(battleState, retryContext);
                const response = await this._sendRequest(prompt);
                const decision = this._parseResponse(response);

                if (!this._validateDecision(decision, battleState)) {
                    if (AIState.retryCount < AIState.maxRetries) {
                        AIState.retryCount++;
                        Debug.warn('Invalid decision, retrying:', decision);
                        return this.getDecision(battleState, {
                            previous_decision: decision,
                            error: 'Invalid action or target'
                        });
                    }
                    return this._getFallbackDecision();
                }

                AIState.retryCount = 0;
                return decision;

            } catch (error) {
                Debug.error('API error:', error);
                return this._getFallbackDecision();
            }
        }

        static _buildPrompt(battleState, retryContext) {
            const companion = battleState.companion;
            const memory = MemoryManager.getLongTermMemory();
            const enemyTactics = this._getEnemyTactics(battleState.enemies);

            // Get enemy-specific knowledge from KB
            let knowledgeHints = '';
            if (typeof FearHungerKB !== 'undefined') {
                for (const enemy of battleState.enemies) {
                    const kb = FearHungerKB.getEnemyHints(enemy.name);
                    if (kb) {
                        const prefix = kb.dangerLevel >= 4 ? 'DANGEROUS: ' : (kb.dangerLevel === 0 ? 'HARMLESS: ' : '');
                        knowledgeHints += `\n${prefix}${kb.name || enemy.name}:\n`;
                        if (kb.tactics) knowledgeHints += `  - TACTICS: ${kb.tactics}\n`;
                        knowledgeHints += `  - Priority: ${kb.priority.join(' → ')}\n`;
                        if (kb.coinFlipTurn) {
                            knowledgeHints += `  - ⚠ COIN FLIP on turn ${kb.coinFlipTurn} — KILL BEFORE THIS TURN!\n`;
                        }
                        kb.hints.slice(0, 2).forEach(h => {
                            knowledgeHints += `  - ${h}\n`;
                        });
                        if (kb.mistakes.length > 0) {
                            knowledgeHints += `  - AVOID: ${kb.mistakes[0]}\n`;
                        }
                        if (kb.special) {
                            knowledgeHints += `  - Special: ${kb.special}\n`;
                        }
                    }
                }
            }

            // Build compact battle state instead of full JSON dump
            const compactEnemies = battleState.enemies.filter(e => e.alive).map(e => {
                const aliveLimbs = Object.entries(e.limbs || {}).filter(([k, v]) => v.alive).map(([k, v]) => k).join(', ');
                return `${e.name} (HP ${e.hp}/${e.max_hp}${aliveLimbs ? ', limbs: ' + aliveLimbs : ''})`;
            }).join('; ');
            const compactAllies = battleState.allies.map(a =>
                `${a.name} HP ${a.hp}/${a.max_hp}${a.states && a.states.length > 0 ? ' [' + a.states.join(', ') + ']' : ''}`
            ).join('; ');

            // Recent dialogs for variety
            const recentDialogBlock = AIState.recentDialogs.length > 0
                ? `\nYOUR RECENT DIALOG (do NOT repeat these):\n${AIState.recentDialogs.map(d => `- "${d}"`).join('\n')}`
                : '';

            // Player action history for coordination
            const playerActionBlock = AIState.playerActionHistory && AIState.playerActionHistory.length > 0
                ? `\nPLAYER'S ACTIONS THIS BATTLE:\n${AIState.playerActionHistory.map(a => `Turn ${a.turn}: ${a.actor} -> ${a.action} -> ${a.target}${a.limb ? ' [' + a.limb + ']' : ''}`).join('\n')}\n`
                : '';

            // Sanity modifier for combat speech
            const sanityMod = SanityManager.getPromptModifier();

            // Build identity with party awareness (declared early — used by coinFlip + prompt)
            const playerName = $gameParty && $gameParty.leader() ? $gameParty.leader().name() : 'the player';
            const otherAllies = battleState.allies.filter(a => a.name !== Config.companionName && a.name !== playerName).map(a => a.name).join(', ');

            // Coin-flip turn detection
            let coinFlipWarning = '';
            if (typeof FearHungerKB !== 'undefined') {
                for (const enemy of battleState.enemies) {
                    if (!enemy.alive) continue;
                    const kb = FearHungerKB.getEnemyHints(enemy.name);
                    if (kb && kb.coinFlipTurn && battleState.turn_number === kb.coinFlipTurn) {
                        coinFlipWarning = `\n⚠️ COIN FLIP WARNING: ${enemy.name} has a LETHAL coin flip attack on turn ${kb.coinFlipTurn}! You MUST Defend this turn. Warn ${playerName} in your dialog.`;
                    }
                }
            }

            // Emergency healing check
            let healingAlert = '';
            const criticalAllies = battleState.allies.filter(a => a.hp > 0 && (a.hp / a.max_hp) < 0.2);
            if (criticalAllies.length > 0) {
                const critNames = criticalAllies.map(a => `${a.name} (${Math.round(a.hp/a.max_hp*100)}%)`).join(', ');
                healingAlert = `\nCRITICAL HP: ${critNames} — Prioritize healing if you have healing skills or herbs. Mention urgency in dialog.`;
            }

            let prompt = `You are ${Config.companionName}, a companion fighting alongside ${playerName} in the dungeons of Fear & Hunger.
You are one of the party's allies — do NOT address ${playerName} as if you are separate from the group.
${otherAllies ? 'Other allies in this fight: ' + otherAllies + '.' : ''}
You speak from experience, cautiously and with weight. NEVER break immersion.
You are ${Config.personality}.
SANITY: ${sanityMod}
${CharacterPresets.getCurrentPersonality().backstory ? '\nCHARACTER BACKSTORY: ' + CharacterPresets.getCurrentPersonality().backstory + '\n' : ''}
GAME RULES: NO leveling/XP exists. COIN FLIP = instant death mechanic on specific turns. Kill enemies BEFORE their coin flip turn. Use "Atacar" to deal damage — NOT self-buff skills.
BATTLE STATE (Turn ${battleState.turn_number}):
- Enemies: ${compactEnemies}
- Allies: ${compactAllies}
${AIState.combatActionHistory && AIState.combatActionHistory.length > 0 ? '\nYOUR PREVIOUS ACTIONS THIS BATTLE:\n' + AIState.combatActionHistory.map(a => `Turn ${a.turn}: ${a.action} -> ${a.target} [${a.limb}]`).join('\n') + '\n' : ''}
${playerActionBlock}
YOUR CAPABILITIES (use ONLY what is listed here—do not invent equipment):
- YOUR EQUIPPED GEAR: ${EquipmentHelper.formatEquipmentForPrompt(companion.equipment || {})}
- Skills: ${companion.skills.map(s => `${s.name} [${s.category}${s.deals_damage ? ', deals damage' : ''}]`).join(', ')}
IMPORTANT: To ATTACK an enemy, use "Atacar" (the basic attack). Skills marked [self-buff] do NOT deal damage to enemies.
- Items in party: ${companion.items.map(i => i.name).join(', ')}
- HP: ${companion.hp}/${companion.max_hp}, MP: ${companion.mp}/${companion.max_mp}
- Allies' equipped gear (for reference): ${(battleState.allies || []).map(a => a.name + ': ' + EquipmentHelper.formatEquipmentForPrompt(a.equipment || {})).join(' | ')}

COMBAT KNOWLEDGE (from experience):${knowledgeHints || '\n  No specific knowledge of these enemies.'}

${enemyTactics ? `LEARNED TACTICS:\n${enemyTactics}` : ''}

${memory.relationship ? `RELATIONSHIP: ${memory.relationship}` : ''}${coinFlipWarning}${healingAlert}`;

            if (retryContext) {
                // Branch 3: Include explicit available actions for better retry
                const availableActions = ['Atacar', 'Defenderse'];
                companion.skills.forEach(s => availableActions.push(s.name));
                companion.items.forEach(i => availableActions.push(i.name));
                const aliveEnemies = battleState.enemies.filter(e => e.alive).map(e => e.name);
                prompt += `\n\nPREVIOUS ATTEMPT FAILED:
Your previous decision was invalid: ${JSON.stringify(retryContext.previous_decision)}
Error: ${retryContext.error}
AVAILABLE ACTIONS (choose ONLY from this list): [${availableActions.join(', ')}]
VALID TARGETS: [${aliveEnemies.join(', ')}]
Please correct your response. Use EXACT names from the lists above.`;
            }

            prompt += `

IMPORTANT TARGETING RULES:
1. ONLY target limbs that are ALIVE (alive: true in the limbs data)
2. If head is dead/destroyed, target torso or arms instead
3. Check the "alive" field for each limb before targeting
4. Be AGGRESSIVE - attack is usually better than defending
5. RESPOND ONLY IN ${Config.language === 'es' ? 'SPANISH (Español)' : 'ENGLISH'}. ${Config.language === 'es' ? 'Translate entity names if appropriate.' : ''}

Do NOT spam Defend. Attack even at low HP - offense wins in Fear & Hunger.

COORDINATION WITH ${playerName.toUpperCase()}:
- You can see the player's actions above. If they made a suboptimal choice (e.g., targeting head while weapon arm is still alive), weave a brief correction INTO your dialog naturally. Example: "¡El brazo del arma primero!" or "Head's too tough, go for the arms!"
- If you're planning a multi-limb strategy, briefly coordinate in dialog. Example: "Yo al cuchillo, tú al aguijón."
- If the player is making good choices, no need to mention strategy — just fight.
- Your dialog should feel like a real combat partner, not a tutorial.

DIALOG RULES (IMPORTANT):
- NEVER repeat the same phrase. Every line must be different and purposeful.
- Reference the enemy by name or a detail from COMBAT KNOWLEDGE when possible.
- For enemies you know about, hint at weakness naturally. E.g. for Guard: "El brazo del arma primero..."
- For bosses or dangerous enemies: show appropriate fear/respect. E.g. "Dios... es el Mauler..."
- Speak like a survivor in the moment. One short line (max 50 chars) or leave "dialog" empty.
- At low sanity, your dialog should be fractured, desperate, and unhinged per your SANITY instruction.
- Vary vocabulary and tone. Say something completely different from previous turns.
${recentDialogBlock}

Respond ONLY with this JSON:
{
  "action": "Attack | Defend | [skill_name] | [item_name]",
  "target": "[enemy_name]",
  "limb": "head | right arm | left arm | torso | legs | null",
  "reasoning": "brief tactical reasoning",
  "dialog": "immersive survivor dialog (max 50 chars)",
  "strategy": "optional: multi-turn plan if you have one (e.g. 'Destroy right arm then head')"
}`;

            // Branch 3: Inject active multi-turn strategy only while it still matches the live battle state
            if (AIState.currentStrategy && AIState.currentStrategy.turnsRemaining > 0) {
                if (!this._isStrategyStillRelevant(battleState, AIState.currentStrategy.plan)) {
                    Debug.log('[Combat] Dropping stale strategy:', AIState.currentStrategy.plan);
                    AIState.currentStrategy = null;
                } else {
                prompt += `\n\nCONTINUING STRATEGY (turn ${battleState.turn_number - AIState.currentStrategy.startTurn + 1} of plan): ${AIState.currentStrategy.plan}\nFollow this plan unless the situation has changed dramatically.`;
                }
            }

            return prompt;
        }

        static _isStrategyStillRelevant(battleState, plan) {
            if (!plan || !battleState || !battleState.enemies) return false;
            const text = plan.toLowerCase();
            const aliveLimbs = new Set();

            battleState.enemies.filter(e => e.alive).forEach(enemy => {
                Object.entries(enemy.limbs || {}).forEach(([key, limb]) => {
                    if (!limb || !limb.alive) return;
                    const lower = key.toLowerCase();
                    aliveLimbs.add(lower);
                    const translated = ActionExecutor.LIMB_TRANSLATIONS[lower];
                    if (translated) aliveLimbs.add(translated);
                });
            });

            const trackedLimbGroups = [
                ['left arm', 'brazo izquierdo'],
                ['right arm', 'brazo derecho'],
                ['left leg', 'pierna izquierda'],
                ['right leg', 'pierna derecha'],
                ['head', 'cabeza'],
                ['torso'],
                ['stinger', 'aguijón', 'aguijon'],
                ['tail', 'cola'],
                ['wings', 'alas'],
                ['claws', 'garras']
            ];

            for (const aliases of trackedLimbGroups) {
                const mentionsAlias = aliases.some(alias => text.includes(alias));
                if (!mentionsAlias) continue;
                const limbStillAlive = aliases.some(alias => aliveLimbs.has(alias));
                if (!limbStillAlive) return false;
            }

            return true;
        }

        static async _sendRequest(prompt, context = 'combat') {
            // Helper: try a single async request
            const _tryFetch = async (endpoint, headers, model, maxTokens, isLocal) => {
                const messages = isLocal
                    ? [
                        { role: 'system', content: 'Respond with ONLY a valid JSON object. Do NOT think or reason. Do NOT use chain-of-thought. Output raw JSON immediately.' },
                        { role: 'user', content: prompt },
                        { role: 'assistant', content: '<think>\n\n</think>\n\n' }
                      ]
                    : [{ role: 'user', content: prompt }];
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(Object.assign({
                        model: model,
                        messages: messages,
                        temperature: 0.6,
                        max_tokens: maxTokens
                    }, isLocal ? { enable_thinking: false } : {}))
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.json();
            };

            // === Local-first for combat, Groq fallback ===
            if (Config.apiProvider === 'local') {
                try {
                    Debug.log('[Combat Async] Trying local AI...');
                    return await _tryFetch(Config.localEndpoint, Config.getHeaders(), Config.localModel, 512, true);
                } catch (error) {
                    Debug.warn('[Combat Async] Local failed:', error.message);
                }
                // Fall back to Groq
                if (Config.apiKey) {
                    Debug.warn('[Combat Async] Falling back to Groq...');
                    const groqHeaders = {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${Config.apiKey}`,
                        'HTTP-Referer': 'https://fear-and-hunger-mod.local',
                        'X-Title': 'Fear & Hunger AI Companion'
                    };
                    const models = ModelRouter.getModelsForContext(context);
                    for (const model of models) {
                        try {
                            const data = await _tryFetch(Config.apiEndpoint, groqHeaders, model, 300, false);
                            Debug.log('[Combat Async] Groq succeeded:', model);
                            return data;
                        } catch (error) {
                            Debug.warn(`[Combat Async] ${model} failed:`, error.message);
                            ModelRouter.markFailed(model);
                        }
                    }
                }
                throw new Error('All models failed (local + Groq)');
            }

            // === Standard Groq/Cloud path ===
            const models = ModelRouter.getModelsForContext(context);
            for (const model of models) {
                try {
                    Debug.log(`Trying model: ${model}`);
                    const data = await _tryFetch(Config.getEndpoint(), Config.getHeaders(), model, 300, false);
                    Debug.log(`Model ${model} succeeded`);
                    return data;
                } catch (error) {
                    Debug.warn(`Model ${model} error:`, error.message);
                    ModelRouter.markFailed(model);
                }
            }

            throw new Error('All models failed');
        }

        static _parseResponse(response) {
            try {
                // Robust content extraction for multiple API formats
                let text = '';
                if (response.choices && response.choices[0]) {
                    const choice = response.choices[0];
                    if (choice.message && choice.message.content) {
                        text = choice.message.content;
                    } else if (choice.text) {
                        text = choice.text;
                    } else if (choice.delta && choice.delta.content) {
                        text = choice.delta.content;
                    }
                } else if (response.response) {
                    text = response.response; // Ollama format
                }
                if (!text) {
                    Debug.error('No content in API response:', JSON.stringify(response).substring(0, 300));
                    return null;
                }
                // Extract JSON from potential markdown code blocks
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
                }
                return JSON.parse(text);
            } catch (error) {
                Debug.error('Failed to parse API response:', error);
                return null;
            }
        }

        // Synchronous API call for battle (XMLHttpRequest)
        static getDecisionSync(battleState) {
            const startTime = performance.now();
            const prompt = this._buildPrompt(battleState);
            if (Config.debugMode) Debug.log('[Combat] Prompt built, length:', prompt.length);

            // Telemetry helper for combat logging
            const _logCombatDecision = (decision, modelUsed, source) => {
                const latency = Math.round(performance.now() - startTime);
                ThesisLogger.log('combat_decision', {
                    battle_turn: battleState.turn_number,
                    enemies: battleState.enemies.filter(e => e.alive).map(e => ({ name: e.name, hp: e.hp, max_hp: e.max_hp })),
                    companion_battle_hp: battleState.companion ? battleState.companion.hp : null,
                    prompt_length: prompt.length,
                    prompt_text: prompt,
                    decision_action: decision ? decision.action : null,
                    decision_target: decision ? decision.target : null,
                    decision_limb: decision ? decision.limb : null,
                    decision_reasoning: decision ? decision.reasoning : null,
                    decision_dialog: decision ? decision.dialog : null,
                    response_source: source,
                    model_used: modelUsed,
                    latency_ms: latency
                });
            };

            // Helper: try a single sync request
            const _trySyncRequest = (endpoint, headers, model, maxTokens, isLocal) => {
                try {
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', endpoint, false); // synchronous — timeout not allowed
                    for (const key in headers) xhr.setRequestHeader(key, headers[key]);
                    const messages = isLocal
                        ? [
                            { role: 'system', content: 'Respond with ONLY a valid JSON object. Do NOT think or reason. Do NOT use chain-of-thought. Output raw JSON immediately.' },
                            { role: 'user', content: prompt },
                            { role: 'assistant', content: '<think>\n\n</think>\n\n' }
                          ]
                        : [{ role: 'user', content: prompt }];
                    Debug.log(`[Combat] Trying ${model} at ${endpoint.substring(0, 50)}...`);
                    xhr.send(JSON.stringify(Object.assign({
                        model: model,
                        messages: messages,
                        temperature: 0.6,
                        max_tokens: maxTokens
                    }, isLocal ? { enable_thinking: false } : {})));
                    if (xhr.status !== 200) {
                        Debug.warn(`[Combat] ${model} returned HTTP ${xhr.status}: ${xhr.responseText.substring(0, 200)}`);
                        return null;
                    }
                    const response = JSON.parse(xhr.responseText);
                    const decision = this._parseResponse(response);
                    if (decision && this._validateDecision(decision, battleState)) {
                        // Branch 3: Extract and store multi-turn strategy
                        if (decision.strategy && decision.strategy.length > 0) {
                            AIState.currentStrategy = {
                                plan: decision.strategy,
                                turnsRemaining: 3,  // Strategies persist for 3 turns
                                startTurn: battleState.turn_number
                            };
                            Debug.log('[Combat] Strategy set:', decision.strategy);
                        } else if (AIState.currentStrategy) {
                            AIState.currentStrategy.turnsRemaining--;
                            if (AIState.currentStrategy.turnsRemaining <= 0) {
                                Debug.log('[Combat] Strategy expired');
                                AIState.currentStrategy = null;
                            }
                        }
                        if (Config.debugMode) {
                            Debug.log('[Combat] Decision:', decision.action, '->', decision.target, decision.limb ? '[' + decision.limb + ']' : '', 'reasoning:', decision.reasoning);
                            if (decision.dialog) Debug.log('[Combat] Dialog:', decision.dialog);
                        }
                        return decision;
                    }
                    // Decision parsed but failed validation — return special marker
                    // so caller knows NOT to markFailed (model worked, validation didn't)
                    if (decision) {
                        Debug.warn(`[Combat] ${model} returned decision that failed validation:`, decision.action, '→', decision.target);
                        return { _validationFailed: true, decision: decision };
                    }
                    Debug.warn(`[Combat] ${model} returned unparseable response`);
                    return null;
                } catch (error) {
                    Debug.warn(`[Combat] ${model} error:`, error.message, error.name);
                    return null;
                }
            };

            // === STRATEGY: Local first, then Groq fallback ===
            if (Config.apiProvider === 'local') {
                Debug.log('[Combat] Trying local AI...');
                const localResult = _trySyncRequest(
                    Config.localEndpoint, Config.getHeaders(), Config.localModel, 512, true
                );
                if (localResult) { _logCombatDecision(localResult, Config.localModel, 'local'); return localResult; }

                // Local failed — fall back to Groq
                if (Config.apiKey) {
                    Debug.warn('[Combat] Local failed — falling back to Groq...');
                    const groqHeaders = {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${Config.apiKey}`,
                        'HTTP-Referer': 'https://fear-and-hunger-mod.local',
                        'X-Title': 'Fear & Hunger AI Companion'
                    };
                    const models = ModelRouter.getModelsForContext('combat');
                    for (const model of models) {
                        const groqResult = _trySyncRequest(
                            Config.apiEndpoint, groqHeaders, model, 300, false
                        );
                        if (groqResult && !groqResult._validationFailed) {
                            Debug.log('[Combat] Groq fallback succeeded:', model);
                            _logCombatDecision(groqResult, model, 'groq_fallback');
                            return groqResult;
                        }
                        // Only penalize model for actual API/network failures, not validation issues
                        if (!groqResult || !groqResult._validationFailed) ModelRouter.markFailed(model);
                    }
                }
            } else {
                // === Standard Groq/Cloud path ===
                const models = ModelRouter.getModelsForContext('combat');
                for (const model of models) {
                    const result = _trySyncRequest(
                        Config.getEndpoint(), Config.getHeaders(), model, 300, false
                    );
                    if (result && !result._validationFailed) { _logCombatDecision(result, model, 'groq'); return result; }
                    // Only penalize model for actual API/network failures, not validation issues
                    if (!result || !result._validationFailed) ModelRouter.markFailed(model);
                }
            }

            const elapsed = Math.round(performance.now() - startTime);
            Debug.error(`All models failed (${elapsed}ms), using fallback`);
            const fallbackDecision = this._getFallbackDecision();
            _logCombatDecision(fallbackDecision, null, 'fallback_all_failed');
            return fallbackDecision;
        }

        static _generateQuickDialog(decision) {
            // Generate varied contextual dialog based on action and target
            const actionLower = decision.action.toLowerCase();
            const limbTarget = decision.limb ? decision.limb.toLowerCase() : null;
            const targetName = decision.target || 'enemy';

            if (actionLower === 'attack') {
                const generalLines = [
                    "Striking now!",
                    "I'll handle this one!",
                    "Watch my flank!",
                    "Keep your guard up!",
                    "No mercy!",
                    "Stay focused!",
                    "Together now!"
                ];

                // Limb-specific lines
                if (limbTarget === 'head') {
                    const headLines = [
                        "Going for the head!",
                        "Aim for the skull!",
                        "One clean strike!",
                        "This ends it!"
                    ];
                    return headLines[Math.floor(Math.random() * headLines.length)];
                } else if (limbTarget && limbTarget.includes('arm')) {
                    const armLines = [
                        "Disabling its arm!",
                        "Take away its weapon!",
                        "Crippling its reach!"
                    ];
                    return armLines[Math.floor(Math.random() * armLines.length)];
                } else if (limbTarget && limbTarget.includes('leg')) {
                    const legLines = [
                        "Slow it down!",
                        "Going for the legs!",
                        "It won't run!"
                    ];
                    return legLines[Math.floor(Math.random() * legLines.length)];
                }

                return generalLines[Math.floor(Math.random() * generalLines.length)];
            } else if (actionLower === 'defend' || actionLower === 'guard') {
                const defendLines = [
                    "Holding position!",
                    "Bracing myself!",
                    "I need a moment!",
                    "Staying defensive!"
                ];
                return defendLines[Math.floor(Math.random() * defendLines.length)];
            }
            return null; // No dialog for unknown actions
        }

        static _validateDecision(decision, battleState) {
            if (!decision) return false;
            if (!decision.action) return false;

            const companion = battleState.companion;
            const actionLower = decision.action.toLowerCase();

            // Attack and Defend are always valid (English + Spanish)
            const VALID_BASE_ACTIONS = new Set([
                'attack', 'defend', 'guard',
                'atacar', 'defenderse', 'defender', 'guardia',
                'curar', 'usar', 'huir', 'correr',
                'use', 'heal', 'flee', 'run', 'escape'
            ]);
            if (VALID_BASE_ACTIONS.has(actionLower)) {
                return true;
            }

            // Check if skill exists
            const hasSkill = companion.skills.some(s =>
                s.name.toLowerCase() === actionLower
            );
            if (hasSkill) return true;

            // Check if item exists
            const hasItem = companion.items.some(i =>
                i.name.toLowerCase() === actionLower
            );
            if (hasItem) return true;

            return false;
        }

        static _getEnemyTactics(enemies) {
            const memory = MemoryManager.getEnemyTactics();
            const tactics = [];

            enemies.forEach(enemy => {
                if (memory[enemy.name]) {
                    tactics.push(`${enemy.name}: ${JSON.stringify(memory[enemy.name])}`);
                }
            });

            return tactics.length > 0 ? tactics.join('\n') : null;
        }

        static _getFallbackDecision() {
            // When all models fail, at least ATTACK instead of wasting a turn defending
            let targetName = 'unknown';
            let limbName = null;
            try {
                const enemies = $gameTroop.members().filter(e => e.isAlive());
                if (enemies.length > 0) {
                    targetName = enemies[0].name();
                }
            } catch (e) { /* troop may not be ready */ }
            const es = Config.language === 'es';
            return {
                action: 'Atacar',
                target: targetName,
                limb: null,
                reasoning: 'Fallback: all AI models unavailable, attacking by default',
                dialog: es ? '¡No puedo pensar ahora, ataco!' : "Can't think straight, just attacking!"
            };
        }

        static _getMockDecision(battleState) {
            Debug.log('Using mock AI decision');

            // Smart mock: analyze state and make reasonable decisions
            const enemies = battleState.enemies.filter(e => e.alive);
            const companion = battleState.companion;

            // Low HP? Defend
            if (companion.hp < companion.max_hp * 0.3) {
                return {
                    action: 'Defend',
                    target: 'self',
                    limb: null,
                    reasoning: 'Low HP, defensive play',
                    dialog: 'I need to be careful...'
                };
            }

            // Find enemy with exposed head
            for (const enemy of enemies) {
                if (enemy.limbs.head && enemy.limbs.head.alive) {
                    return {
                        action: 'Attack',
                        target: enemy.name,
                        limb: 'head',
                        reasoning: 'Going for the kill shot',
                        dialog: 'The head!'
                    };
                }
            }

            // Find enemy with dangerous arm
            for (const enemy of enemies) {
                if (enemy.limbs.right_arm && enemy.limbs.right_arm.alive) {
                    return {
                        action: 'Attack',
                        target: enemy.name,
                        limb: 'right_arm',
                        reasoning: 'Disarm to reduce threat',
                        dialog: 'Disabling the weapon arm.'
                    };
                }
                if (enemy.limbs['right arm'] && enemy.limbs['right arm'].alive) {
                    return {
                        action: 'Attack',
                        target: enemy.name,
                        limb: 'right arm',
                        reasoning: 'Disarm to reduce threat',
                        dialog: 'Disabling the weapon arm.'
                    };
                }
            }

            // Default: attack first alive enemy
            if (enemies.length > 0) {
                return {
                    action: 'Attack',
                    target: enemies[0].name,
                    limb: null,
                    reasoning: 'Basic attack on primary target',
                    dialog: null
                };
            }

            return this._getFallbackDecision();
        }
    }

    //=========================================================================
    // MemoryManager - Handles persistent companion memory
    //=========================================================================
    class MemoryManager {
        static _getMemoryObject() {
            if (!$gameSystem._aiCompanionMemory) {
                $gameSystem._aiCompanionMemory = {
                    immutable_traits: Config.personality.split(',').map(t => t.trim()),
                    relationship: 'neutral - newly met',
                    player_promises: [],
                    shared_knowledge: [],
                    enemy_tactics: {},
                    conversation_history: []
                };
            }
            return $gameSystem._aiCompanionMemory;
        }

        static getLongTermMemory() {
            return this._getMemoryObject();
        }

        static getEnemyTactics() {
            return this._getMemoryObject().enemy_tactics;
        }

        static updateEnemyTactics(enemyName, tactics) {
            const memory = this._getMemoryObject();
            memory.enemy_tactics[enemyName] = {
                ...memory.enemy_tactics[enemyName],
                ...tactics,
                last_updated: $gameTroop.turnCount()
            };
            Debug.log('Updated enemy tactics:', enemyName, tactics);
        }

        static addConversation(summary) {
            const memory = this._getMemoryObject();
            memory.conversation_history.push({
                turn: Graphics.frameCount,
                summary: summary
            });
            // Keep only last 20 conversations
            if (memory.conversation_history.length > 20) {
                memory.conversation_history.shift();
            }
        }

        static updateRelationship(description) {
            const memory = this._getMemoryObject();
            memory.relationship = description;
        }
    }

    //=========================================================================
    // Hook: BattleManager.selectNextCommand - PROPER INPUT PHASE HOOK
    // This is called when it's time for an actor to select their action
    //=========================================================================
    const _BattleManager_selectNextCommand = BattleManager.selectNextCommand;
    BattleManager.selectNextCommand = function () {
        // First, call parent to advance to next actor
        _BattleManager_selectNextCommand.call(this);

        // Now check if the NEW current actor is the AI companion
        const actor = this.actor();
        if (actor && actor.actorId() === Config.companionActorId) {
            // Process AI decision
            const battleState = BattleStateExtractor.extract();
            if (battleState) {
                let decision;
                if (Config.useMockAI) {
                    Debug.log('Turn ' + battleState.turn_number + ' (Mock AI)');
                    decision = GeminiAPIHandler._getMockDecision(battleState);
                } else {
                    decision = GeminiAPIHandler.getDecisionSync(battleState);
                }

                if (Config.debugMode) Debug.log('[Combat] Executing AI turn for', Config.companionName, 'decision:', decision.action, decision.target);
                ActionExecutor.execute(actor, decision);
            } else {
                // Fallback to defend
                if (actor.numActions() > 0) {
                    actor.action(0).setGuard();
                }
            }

            // Auto-advance past this actor (skip their input entirely)
            // Call selectNextCommand again to move to next actor or end input
            this.selectNextCommand();
        }
    };

    Game_Actor.prototype._setFallbackAction = function () {
        // Parent already set default action, so this is just for manual override
        if (this.numActions() > 0) {
            const action = this.action(0);
            action.setGuard();
        }
    };

    //=========================================================================
    // API Key Configuration Scene (MV-compatible prototype pattern)
    //=========================================================================
    function Scene_AIConfig() {
        this.initialize.apply(this, arguments);
    }

    Scene_AIConfig.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_AIConfig.prototype.constructor = Scene_AIConfig;

    Scene_AIConfig.prototype.initialize = function () {
        Scene_MenuBase.prototype.initialize.call(this);
    };

    Scene_AIConfig.prototype.create = function () {
        Scene_MenuBase.prototype.create.call(this);
        this.createHelpWindow();
        this.createStatusWindow();
        this.createCommandWindow();
        this._inputMode = false;
    };

    Scene_AIConfig.prototype.createHelpWindow = function () {
        this._helpWindow = new Window_Help(2);
        this._helpWindow.setText(Config.language === 'es' ? 'Configuración del compañero IA\nElige una opción' : 'AI Companion Configuration\nSelect an option below');
        this.addWindow(this._helpWindow);
    };

    Scene_AIConfig.prototype.createStatusWindow = function () {
        const wy = this._helpWindow.height;
        this._statusWindow = new Window_Base(0, wy, Graphics.boxWidth, 80);
        this.addWindow(this._statusWindow);
        this.refreshStatus();
    };

    Scene_AIConfig.prototype.refreshStatus = function () {
        this._statusWindow.contents.clear();
        const es = Config.language === 'es';
        const apiStatus = Config.apiKey ? (es ? 'API Key: CONFIGURADA' : 'API Key: SET') + ' (' + Config.apiKey.substring(0, 8) + '...)' : (es ? 'API Key: NO' : 'API Key: NOT SET');
        const modeStatus = Config.useMockAI ? (es ? 'Modo: PRUEBA (Mock)' : 'Mode: MOCK AI') : (es ? 'Modo: API real' : 'Mode: REAL API');
        const debugStatus = Config.debugMode ? (es ? 'Debug: SÍ (F12 consola)' : 'Debug: ON (F12 console)') : (es ? 'Debug: NO' : 'Debug: OFF');
        this._statusWindow.drawText(apiStatus, 10, 0, Graphics.boxWidth - 40, 'left');
        this._statusWindow.drawText(modeStatus, 10, 28, Graphics.boxWidth - 40, 'left');
        this._statusWindow.drawText(debugStatus, 10, 56, Graphics.boxWidth - 40, 'left');
    };

    Scene_AIConfig.prototype.createCommandWindow = function () {
        const wy = this._helpWindow.height + this._statusWindow.height;
        this._commandWindow = new Window_AIConfigCommand(0, wy);
        this._commandWindow.setHandler('apiKey', this.commandApiKey.bind(this));
        this._commandWindow.setHandler('toggleMock', this.commandToggleMock.bind(this));
        this._commandWindow.setHandler('toggleDebug', this.commandToggleDebug.bind(this));
        this._commandWindow.setHandler('setName', this.commandSetName.bind(this));
        this._commandWindow.setHandler('setAppearance', this.commandSetAppearance.bind(this));
        this._commandWindow.setHandler('setPersonality', this.commandSetPersonality.bind(this));
        this._commandWindow.setHandler('setClass', this.commandSetClass.bind(this));
        this._commandWindow.setHandler('setLanguage', this.commandSetLanguage.bind(this));
        this._commandWindow.setHandler('setProvider', this.commandSetProvider.bind(this));
        this._commandWindow.setHandler('setModel', this.commandSetModel.bind(this));
        this._commandWindow.setHandler('fetchModels', this.commandFetchModels.bind(this));
        this._commandWindow.setHandler('cancel', this.popScene.bind(this));
        this.addWindow(this._commandWindow);
    };

    Scene_AIConfig.prototype.commandApiKey = function () {
        this._helpWindow.setText('Paste your Gemini API Key with Ctrl+V\nPress Enter to save, Escape to cancel');
        this._inputMode = true;
        this._commandWindow.deactivate();
        // Create input window if it doesn't exist
        if (!this._inputWindow) {
            const ww = Graphics.boxWidth - 100;
            const wh = 80;
            const wx = (Graphics.boxWidth - ww) / 2;
            const wy = this._commandWindow.y + this._commandWindow.height + 20;
            this._inputWindow = new Window_AIKeyInput(wx, wy, ww, wh);
            this._inputWindow.setHandler('ok', this.onInputOk.bind(this));
            this._inputWindow.setHandler('cancel', this.onInputCancel.bind(this));
            this.addWindow(this._inputWindow);
        } else {
            this._inputWindow.show();
            this._inputWindow.clear();
        }
        this._inputWindow.activate();
    };

    Scene_AIConfig.prototype.commandToggleMock = function () {
        Config.forceMockAI = !Config.forceMockAI;
        if (Config.debugMode) Debug.log('Mock toggled:', Config.forceMockAI);
        SoundManager.playOk();
        this.refreshStatus();
        this._commandWindow.refresh();
        this._commandWindow.activate();
    };

    Scene_AIConfig.prototype.commandToggleDebug = function () {
        Config.setDebugMode(!Config.debugMode);
        if (Config.debugMode) console.log('[AI_Companion] Debug mode ON – verás logs en la consola (F12).');
        SoundManager.playOk();
        this.refreshStatus();
        this._commandWindow.refresh();
        this._commandWindow.activate();
    };

    Scene_AIConfig.prototype.onInputOk = function () {
        const key = this._inputWindow.getKey();
        if (key && key.length > 10) {
            Config.setApiKey(key);  // Saves to localStorage!
            Config.forceMockAI = false;
            Debug.log('API Key saved to localStorage, switching to live mode');
            Debug.log('Using Mock AI:', Config.useMockAI);
            SoundManager.playOk();
            this._inputWindow.hide();
            this._inputMode = false;
            this._helpWindow.setText('API Key saved successfully!\nSelect an option below');
            this.refreshStatus();
            this._commandWindow.refresh();
            this._commandWindow.activate();
        } else {
            SoundManager.playBuzzer();
            this._inputWindow.activate();
        }
    };

    Scene_AIConfig.prototype.onInputCancel = function () {
        this._inputWindow.hide();
        this._inputMode = false;
        this._helpWindow.setText('AI Companion Configuration\nSelect an option below');
        this._commandWindow.activate();
    };

    // Name input handler
    Scene_AIConfig.prototype.commandSetName = function () {
        // Use RPG Maker's native name input scene
        const actor = $gameActors && $gameActors.actor(Config.companionActorId);
        if (actor) {
            // Store callback to update config after name input
            window._aiNameEditCallback = true;
            SceneManager.push(Scene_Name);
            SceneManager.prepareNextScene(Config.companionActorId, 16); // 16 chars max
        } else {
            this._helpWindow.setText('Error: Actor not found. Start a game first.');
            this._commandWindow.activate();
        }
    };

    // Hook Scene_Name completion to update AI config
    const _Scene_Name_onInputOk = Scene_Name.prototype.onInputOk;
    Scene_Name.prototype.onInputOk = function () {
        _Scene_Name_onInputOk.call(this);
        if (window._aiNameEditCallback) {
            const actor = $gameActors && $gameActors.actor(Config.companionActorId);
            if (actor) {
                CharacterPresets.setName(actor.name());
            }
            window._aiNameEditCallback = false;
        }
    };

    // Appearance cycling handler
    Scene_AIConfig.prototype.commandSetAppearance = function () {
        const presets = CharacterPresets.appearances;
        const currentIndex = presets.findIndex(p => p.id === CharacterPresets._currentAppearance);
        const nextIndex = (currentIndex + 1) % presets.length;
        CharacterPresets.setAppearance(presets[nextIndex].id);
        SoundManager.playOk();
        this._helpWindow.setText(`Appearance: ${presets[nextIndex].name}`);
        this._commandWindow.refresh();
        this._commandWindow.activate();
    };

    // Personality cycling handler
    Scene_AIConfig.prototype.commandSetPersonality = function () {
        const types = CharacterPresets.personalities;
        const currentIndex = types.findIndex(p => p.id === CharacterPresets._currentPersonality);
        const nextIndex = (currentIndex + 1) % types.length;
        CharacterPresets.setPersonality(types[nextIndex].id);
        SoundManager.playOk();
        this._helpWindow.setText(`Personality: ${types[nextIndex].name}\n(${types[nextIndex].traits})`);
        this._commandWindow.refresh();
        this._commandWindow.activate();
    };

    // Class cycling handler
    Scene_AIConfig.prototype.commandSetClass = function () {
        const classes = Object.keys(STARTING_LOADOUTS);
        const currentIndex = classes.indexOf(Config.companionClass);
        const nextIndex = (currentIndex + 1) % classes.length;
        const nextClass = classes[nextIndex];
        Config.setCompanionClass(nextClass);
        const loadout = STARTING_LOADOUTS[nextClass];
        SoundManager.playOk();
        this._helpWindow.setText(`${loadout.nameEs}\n${loadout.desc}`);
        this._commandWindow.refresh();
        this._commandWindow.activate();
    };

    // Language toggle handler
    Scene_AIConfig.prototype.commandSetLanguage = function () {
        const newLang = Config.language === 'es' ? 'en' : 'es';
        Config.setLanguage(newLang);
        SoundManager.playOk();
        this._helpWindow.setText(`Language set to: ${newLang === 'es' ? 'Español' : 'English'}`);
        this._commandWindow.refresh();
        this._commandWindow.activate();
    };

    // Provider cycling handler (groq → openrouter → local)
    Scene_AIConfig.prototype.commandSetProvider = function () {
        const newProvider = Config.cycleProvider();
        const providerDef = PROVIDERS[newProvider];
        SoundManager.playOk();
        if (newProvider === 'local') {
            this._helpWindow.setText(`IA Local: ${Config.localModel}\n${Config.localEndpoint}`);
        } else {
            const modelName = Config.getChatModel();
            this._helpWindow.setText(`${providerDef.name}\nModel: ${modelName}`);
        }
        this._commandWindow.refresh();
        this._commandWindow.activate();
    };

    // Model selection handler — cycles through available models for current provider
    Scene_AIConfig.prototype.commandSetModel = function () {
        const es = Config.language === 'es';
        let models = [];
        if (Config.apiProvider === 'openrouter') {
            const free = Config.getFreeModels();
            if (free.length > 0) {
                models = free.map(m => m.id);
            } else {
                models = PROVIDERS.openrouter.defaultModels;
            }
        } else if (Config.apiProvider === 'groq') {
            models = PROVIDERS.groq.defaultModels;
        } else {
            this._helpWindow.setText(es ? 'Modelo local se configura en LM Studio' : 'Local model is set in LM Studio');
            this._commandWindow.activate();
            return;
        }
        if (models.length === 0) {
            this._helpWindow.setText(es ? 'No hay modelos. Usa "Buscar modelos gratis"' : 'No models. Use "Fetch Free Models"');
            this._commandWindow.activate();
            return;
        }
        const currentIdx = models.indexOf(Config.chatModel);
        const nextIdx = (currentIdx + 1) % models.length;
        Config.setChatModel(models[nextIdx]);
        SoundManager.playOk();
        const shortName = models[nextIdx].length > 40 ? models[nextIdx].substring(0, 40) + '...' : models[nextIdx];
        this._helpWindow.setText(`${es ? 'Modelo' : 'Model'}: ${shortName}`);
        this._commandWindow.refresh();
        this._commandWindow.activate();
    };

    // Fetch free models from OpenRouter
    Scene_AIConfig.prototype.commandFetchModels = async function () {
        const es = Config.language === 'es';
        this._helpWindow.setText(es ? 'Buscando modelos gratis...' : 'Fetching free models...');
        this._commandWindow.deactivate();
        try {
            const models = await Config.fetchFreeModels();
            if (models.length > 0) {
                this._helpWindow.setText(`${es ? 'Encontrados' : 'Found'} ${models.length} ${es ? 'modelos gratis' : 'free models'}\n${models.slice(0, 3).map(m => m.id.split('/').pop()).join(', ')}...`);
            } else {
                this._helpWindow.setText(es ? 'No se encontraron modelos gratis.\nConfigura tu API Key primero.' : 'No free models found.\nSet your API Key first.');
            }
        } catch (e) {
            this._helpWindow.setText(`Error: ${e.message}`);
        }
        this._commandWindow.refresh();
        this._commandWindow.activate();
    };

    //=========================================================================
    // AI Config Command Window
    //=========================================================================
    function Window_AIConfigCommand() {
        this.initialize.apply(this, arguments);
    }

    Window_AIConfigCommand.prototype = Object.create(Window_Command.prototype);
    Window_AIConfigCommand.prototype.constructor = Window_AIConfigCommand;

    Window_AIConfigCommand.prototype.initialize = function (x, y) {
        Window_Command.prototype.initialize.call(this, x, y);
    };

    Window_AIConfigCommand.prototype.windowWidth = function () {
        return Graphics.boxWidth;
    };

    Window_AIConfigCommand.prototype.numVisibleRows = function () {
        return 8; // Scrollable — shows 8 items at a time
    };

    Window_AIConfigCommand.prototype.makeCommandList = function () {
        const es = Config.language === 'es';
        this.addCommand(es ? 'Configurar API Key' : 'Set API Key', 'apiKey');
        const mockLabel = Config.forceMockAI ? (es ? 'Modo prueba: ON (pulsa para API real)' : 'Mock Mode: ON (click to use Real API)') :
            Config.apiKey ? (es ? 'Modo prueba: OFF (usando API real)' : 'Mock Mode: OFF (using Real API)') :
                (es ? 'Modo prueba: ON (configura API key antes)' : 'Mock Mode: ON (set API key first)');
        this.addCommand(mockLabel, 'toggleMock');
        this.addCommand(es ? '--- Depuración ---' : '--- Debug ---', 'separator', false);
        this.addCommand(es ? `Consola debug: ${Config.debugMode ? 'SÍ' : 'NO'}` : `Debug console: ${Config.debugMode ? 'ON' : 'OFF'}`, 'toggleDebug');
        this.addCommand(es ? '--- Personaje ---' : '--- Character ---', 'separator', false);
        this.addCommand(`${es ? 'Nombre' : 'Name'}: ${Config.companionName}`, 'setName');
        this.addCommand(`${es ? 'Aspecto' : 'Appearance'}: ${CharacterPresets.getCurrentPresetName()}`, 'setAppearance');
        this.addCommand(`${es ? 'Personalidad' : 'Personality'}: ${CharacterPresets.getCurrentPersonalityName()}`, 'setPersonality');
        const loadout = STARTING_LOADOUTS[Config.companionClass];
        const className = loadout ? (es ? loadout.nameEs : loadout.name) : Config.companionClass;
        this.addCommand(`${es ? 'Clase inicial' : 'Starting class'}: ${className}`, 'setClass');
        this.addCommand(`${es ? 'Idioma' : 'Language'}: ${Config.language === 'es' ? 'Español' : 'English'}`, 'setLanguage');
        this.addCommand(es ? '--- IA ---' : '--- AI ---', 'separator', false);
        // Provider label
        const providerDef = PROVIDERS[Config.apiProvider] || PROVIDERS.groq;
        let providerLabel;
        if (Config.apiProvider === 'local') {
            providerLabel = `Local (${Config.localModel.substring(0, 20)})`;
        } else {
            providerLabel = providerDef.name;
        }
        this.addCommand(`${es ? 'Proveedor' : 'Provider'}: ${providerLabel}`, 'setProvider');
        // Model label
        const modelLabel = Config.apiProvider === 'local'
            ? Config.localModel.substring(0, 30)
            : (Config.chatModel || providerDef.defaultModels[0] || 'auto').split('/').pop().substring(0, 30);
        this.addCommand(`${es ? 'Modelo' : 'Model'}: ${modelLabel}`, 'setModel');
        // Fetch free models (OpenRouter only)
        if (Config.apiProvider === 'openrouter') {
            const freeCount = Config.getFreeModels().length;
            this.addCommand(`${es ? 'Buscar modelos gratis' : 'Fetch Free Models'} (${freeCount})`, 'fetchModels');
        }
    };

    //=========================================================================
    // API Key Input Window (MV-compatible prototype pattern)
    //=========================================================================
    function Window_AIKeyInput() {
        this.initialize.apply(this, arguments);
    }

    Window_AIKeyInput.prototype = Object.create(Window_Base.prototype);
    Window_AIKeyInput.prototype.constructor = Window_AIKeyInput;

    Window_AIKeyInput.prototype.initialize = function (x, y, width, height) {
        Window_Base.prototype.initialize.call(this, x, y, width, height);
        this._apiKey = Config.apiKey || '';
        this._handlers = {};
        this.refresh();
        this._setupClipboard();
    };

    Window_AIKeyInput.prototype._setupClipboard = function () {
        // Listen for paste events
        const self = this;
        document.addEventListener('paste', function (e) {
            if (SceneManager._scene && SceneManager._scene.constructor === Scene_AIConfig) {
                const text = (e.clipboardData || window.clipboardData).getData('text');
                if (text) {
                    self._apiKey = text.trim();
                    self.refresh();
                    SoundManager.playCursor();
                }
            }
        });
    };

    Window_AIKeyInput.prototype.refresh = function () {
        this.contents.clear();
        const masked = this._apiKey ?
            this._apiKey.substring(0, 8) + '...' + this._apiKey.substring(this._apiKey.length - 4) :
            '(empty - paste your key)';
        this.drawText('API Key:', 0, 0, 100);
        this.drawText(masked, 110, 0, this.contentsWidth() - 120);
        this.drawText('Press ENTER to save, ESC to cancel', 0, 40, this.contentsWidth(), 'center');
    };

    Window_AIKeyInput.prototype.update = function () {
        Window_Base.prototype.update.call(this);
        if (Input.isTriggered('ok')) {
            this.callHandler('ok');
        } else if (Input.isTriggered('cancel')) {
            this.callHandler('cancel');
        }
    };

    Window_AIKeyInput.prototype.setHandler = function (symbol, method) {
        this._handlers[symbol] = method;
    };

    Window_AIKeyInput.prototype.callHandler = function (symbol) {
        if (this._handlers[symbol]) {
            this._handlers[symbol]();
        }
    };

    Window_AIKeyInput.prototype.getKey = function () {
        return this._apiKey;
    };

    Window_AIKeyInput.prototype.activate = function () {
        this.active = true;
    };

    // Add to Title Screen instead of Options menu (YEP_OptionsCore is too complex)
    const _Window_TitleCommand_makeCommandList = Window_TitleCommand.prototype.makeCommandList;
    Window_TitleCommand.prototype.makeCommandList = function () {
        _Window_TitleCommand_makeCommandList.call(this);
        // Always add our command — base makeCommandList clears the list each time
        this.addCommand(Config.language === 'es' ? 'Config. IA' : 'AI Config', 'aiConfig');
    };

    const _Scene_Title_createCommandWindow = Scene_Title.prototype.createCommandWindow;
    Scene_Title.prototype.createCommandWindow = function () {
        _Scene_Title_createCommandWindow.call(this);
        this._commandWindow.setHandler('aiConfig', this.commandAIConfig.bind(this));
    };

    Scene_Title.prototype.commandAIConfig = function () {
        this._commandWindow.close();
        SceneManager.push(Scene_AIConfig);
    };

    // Expose scene for external access
    window.Scene_AIConfig = Scene_AIConfig;

    //=========================================================================
    // Auto-Join Party at New Game Start
    //=========================================================================
    const _DataManager_setupNewGame = DataManager.setupNewGame;
    let _lastAppearanceApplyTime = 0;
    DataManager.setupNewGame = function () {
        _DataManager_setupNewGame.call(this);

        // Clear chat transcript and short-term dialogue memory on new game
        if (typeof ChatSystem !== 'undefined') {
            ChatSystem.resetPersistentState();
        }
        if (typeof ShortTermMemory !== 'undefined') {
            ShortTermMemory._events = [];
            ShortTermMemory._lastBattle = null;
        }
        if (typeof AIState !== 'undefined') {
            AIState.lastBattleStateCache = null;
            AIState.recentDialogs = [];
            AIState.lastCombatHash = null;
            AIState.lastCombatDecision = null;
            AIState.combatActionHistory = [];
        }
        Debug.log('New game: cleared chat history and short-term memory');
        if (Config.autoJoinParty) {
            // Add a small delay to ensure party is initialized
            setTimeout(() => {
                if (!$gameParty.members().some(m => m.actorId() === Config.companionActorId)) {
                    $gameParty.addActor(Config.companionActorId);
                    Debug.log('AI Companion auto-joined party at game start');
                }
                // Apply saved appearance and name to actor (with dedup guard)
                const actor = $gameActors.actor(Config.companionActorId);
                const now = Date.now();
                if (actor && now - _lastAppearanceApplyTime > 500) {
                    _lastAppearanceApplyTime = now;
                    CharacterPresets.applyAppearanceToActor();
                    actor.setName(Config.companionName);
                    if (Config.debugMode) Debug.log('New game: applied appearance', CharacterPresets.getCurrentPresetName());

                    // Apply starting equipment based on selected class
                    const loadout = STARTING_LOADOUTS[Config.companionClass];
                    if (loadout) {
                        // Apply base stats
                        const s = loadout.stats;
                        actor.addParam(2, s.atk - actor.paramBase(2));  // ATK
                        actor.addParam(3, s.def - actor.paramBase(3));  // DEF
                        actor.addParam(4, s.matk - actor.paramBase(4)); // MATK
                        actor.addParam(5, s.mdef - actor.paramBase(5)); // MDEF
                        actor.addParam(6, s.agi - actor.paramBase(6));  // AGI
                        actor.addParam(7, s.luk - actor.paramBase(7));  // LUK

                        // Equip weapons
                        for (const wId of loadout.weapons) {
                            const weapon = $dataWeapons[wId];
                            if (weapon) {
                                $gameParty.gainItem(weapon, 1);
                                actor.changeEquip(0, weapon);
                            }
                        }

                        // Equip armors (slots: 1=shield, 2=head, 3=body, 4=accessory)
                        for (const aId of loadout.armors) {
                            const armor = $dataArmors[aId];
                            if (armor) {
                                $gameParty.gainItem(armor, 1);
                                // Auto-detect slot from etypeId
                                const slot = armor.etypeId - 1; // etypeId 2=shield(1), 3=head(2), 4=body(3), 5=acc(4)
                                actor.changeEquip(slot, armor);
                            }
                        }

                        // Give items
                        for (const [itemId, qty] of loadout.items) {
                            const item = $dataItems[itemId];
                            if (item) $gameParty.gainItem(item, qty);
                        }

                        // Learn skills
                        for (const skillId of loadout.skills) {
                            actor.learnSkill(skillId);
                        }

                        Debug.log('Applied loadout:', Config.companionClass, loadout.nameEs);
                    }
                }
            }, 100);
        }
    };

    //=========================================================================
    // Short Term Memory (Event Log)
    //=========================================================================
    const ShortTermMemory = {
        _events: [],
        _lastBattle: null,
        _lastEventDesc: '',
        _lastEventTime: 0,
        MAX_EVENTS: 5,

        addEvent(description) {
            // Deduplicate: skip if same event fired within 100ms (RPG Maker double-fires)
            const now = Date.now();
            if (description === this._lastEventDesc && now - this._lastEventTime < 100) return;
            this._lastEventDesc = description;
            this._lastEventTime = now;

            this._events.push({
                desc: description,
                time: now,
                turn: $gameParty.inBattle() ? $gameTroop.turnCount() : 'map'
            });
            if (this._events.length > this.MAX_EVENTS) {
                this._events.shift();
            }
            Debug.log('[ShortTermMemory] addEvent:', description);
        },

        setLastBattle(enemyNames, victory) {
            this._lastBattle = {
                enemies: enemyNames || [],
                victory: !!victory,
                time: Date.now()
            };
            Debug.log('[ShortTermMemory] setLastBattle:', this._lastBattle);
        },

        getLastBattle() {
            return this._lastBattle;
        },

        getRecentEvents() {
            const now = Date.now();
            return this._events.filter(e => now - e.time < 300000);
        }
    };

    //=========================================================================
    // World State Engine — Aggregated situational awareness (Branch 6)
    //=========================================================================
    const WorldStateEngine = {
        _lastSnapshot: null,
        _lastSnapshotTime: 0,
        SNAPSHOT_TTL: 5000, // 5 seconds between full recalculations

        /**
         * Compute the full world state snapshot.
         * Cached for SNAPSHOT_TTL to avoid per-frame overhead.
         */
        getSnapshot() {
            const now = Date.now();
            if (this._lastSnapshot && now - this._lastSnapshotTime < this.SNAPSHOT_TTL) {
                return this._lastSnapshot;
            }

            const snapshot = {
                timestamp: now,
                party: this._getPartyState(),
                resources: this._getResourceState(),
                environment: this._getEnvironmentState(),
                threats: this._getThreatAssessment(),
                morale: this._getMoraleState(),
                situation: 'stable' // overridden below
            };

            // Compute overall situation rating
            snapshot.situation = this._computeSituation(snapshot);

            this._lastSnapshot = snapshot;
            this._lastSnapshotTime = now;
            return snapshot;
        },

        /**
         * Party health and composition state
         */
        _getPartyState() {
            const members = $gameParty ? $gameParty.members() : [];
            if (members.length === 0) return { size: 0, avg_hp_pct: 100, wounded: 0, dead: 0 };

            let totalHpPct = 0;
            let wounded = 0;
            let dead = 0;

            for (const m of members) {
                const pct = m.mhp > 0 ? (m.hp / m.mhp) * 100 : 100;
                totalHpPct += pct;
                if (m.isDead && m.isDead()) dead++;
                else if (pct < 50) wounded++;
            }

            return {
                size: members.length,
                avg_hp_pct: Math.round(totalHpPct / members.length),
                wounded,
                dead,
                names: members.map(m => m.name())
            };
        },

        /**
         * Inventory resource assessment
         */
        _getResourceState() {
            if (!$gameParty) return { healing: 0, food: 0, keys: 0, total_items: 0 };

            const items = $gameParty.items();
            let healing = 0;
            let food = 0;
            let keys = 0;

            for (const item of items) {
                const name = (item.name || '').toLowerCase();
                const count = $gameParty.numItems(item);

                // Healing items
                if (/hierba|herb|cura|heal|vial azul|blue vial|vendaje|bandage|pocion|potion/i.test(name)) {
                    healing += count;
                }
                // Food items
                if (/comida|carne|pan|queso|champiñ|tomate|manzana|zanahoria|meat|bread|cheese|mushroom|apple/i.test(name)) {
                    food += count;
                }
                // Key items
                if (/llave|key|gema|gem|orbe|orb/i.test(name)) {
                    keys += count;
                }
            }

            return {
                healing,
                food,
                keys,
                total_items: items.length,
                has_save_materials: items.some(i => /ritual|incienso|incense/i.test(i.name))
            };
        },

        /**
         * Environment and location context
         */
        _getEnvironmentState() {
            const mapContext = MapContextHelper.getMapContext();
            const inBattle = $gameParty && $gameParty.inBattle && $gameParty.inBattle();

            // Time in current map (approximate)
            const mapEntryTime = this._mapEntryTime || Date.now();
            const timeOnMap = Math.round((Date.now() - mapEntryTime) / 1000);

            return {
                map_name: mapContext.displayName || 'Unknown',
                map_tips: mapContext.tips || [],
                in_battle: !!inBattle,
                time_on_map_seconds: timeOnMap,
                has_been_here_before: this._visitedMaps ? this._visitedMaps.has(String($gameMap ? $gameMap.mapId() : 0)) : false
            };
        },

        /**
         * Threat level assessment from recent events and surroundings
         */
        _getThreatAssessment() {
            const recentEvents = ShortTermMemory.getRecentEvents();
            const lastBattle = ShortTermMemory.getLastBattle();

            let threatScore = 0;
            let recentDeaths = 0;
            let recentBattles = 0;

            for (const event of recentEvents) {
                if (/death|muerte|died|murió|LOST a|perdió/i.test(event.desc)) {
                    threatScore += 3;
                    recentDeaths++;
                }
                if (/battle|pelea|combat/i.test(event.desc)) {
                    threatScore += 1;
                    recentBattles++;
                }
                if (/CRITICAL|crítico/i.test(event.desc)) {
                    threatScore += 2;
                }
            }

            // Recent battle outcome matters
            if (lastBattle) {
                const timeSince = Date.now() - lastBattle.time;
                if (timeSince < 120000) { // 2 minutes
                    threatScore += lastBattle.victory ? 0 : 2;
                }
            }

            let level;
            if (threatScore >= 6) level = 'extreme';
            else if (threatScore >= 4) level = 'high';
            else if (threatScore >= 2) level = 'moderate';
            else level = 'low';

            return {
                level,
                score: threatScore,
                recent_deaths: recentDeaths,
                recent_battles: recentBattles
            };
        },

        /**
         * Morale/psychological state — aggregates sanity, trust, hunger
         */
        _getMoraleState() {
            const sanity = SanityManager.getSanityLevel();
            const trust = RelationshipTracker.getSummary();

            // Hunger level from AmbientDialogue helper
            let hunger = 0;
            try {
                const companion = $gameActors.actor(Config.companionActorId);
                if (companion) {
                    const hungerStates = companion.states().filter(s => /hambre/i.test(s.name));
                    for (const s of hungerStates) {
                        const match = s.name.match(/(\d+)/);
                        if (match) hunger = parseInt(match[1]);
                    }
                    if (hungerStates.length > 0 && hunger === 0) hunger = 1;
                }
            } catch (e) { /* companion not available */ }

            return {
                sanity_level: sanity.level,
                sanity_pct: sanity.percent,
                trust_summary: trust,
                hunger_level: hunger,
                overall: this._computeMoraleOverall(sanity.percent, hunger)
            };
        },

        _computeMoraleOverall(sanityPct, hunger) {
            if (sanityPct < 15 || hunger >= 4) return 'desperate';
            if (sanityPct < 35 || hunger >= 3) return 'low';
            if (sanityPct < 60) return 'shaky';
            return 'steady';
        },

        /**
         * Compute overall situation from all factors
         */
        _computeSituation(snapshot) {
            const { party, resources, threats, morale } = snapshot;

            // Scoring: higher = worse
            let score = 0;

            // Party health
            if (party.avg_hp_pct < 25) score += 4;
            else if (party.avg_hp_pct < 50) score += 2;
            if (party.dead > 0) score += 3;

            // Resources
            if (resources.healing === 0) score += 2;
            if (resources.food === 0) score += 1;

            // Threats
            score += threats.score;

            // Morale
            if (morale.overall === 'desperate') score += 3;
            else if (morale.overall === 'low') score += 1;

            // Status effects — bleeding, infection, poison etc. affect situation
            try {
                for (const member of $gameParty.members()) {
                    if (!member || !member.states) continue;
                    for (const state of member.states()) {
                        const name = (state.name || '').toLowerCase();
                        if (/sangr|bleed/i.test(name)) score += 1;
                        if (/infecc|infect/i.test(name)) score += 3;
                        if (/poison|venen|t[oó]xic/i.test(name)) score += 2;
                        if (/blind|ciego|ceguera/i.test(name)) score += 1;
                        if (/curse|maldic/i.test(name)) score += 4;
                        if (/par[aá]sit/i.test(name)) score += 1;
                        if (/brain.?flower|flor.?cerebr/i.test(name)) score += 2;
                        if (/ruin/i.test(name)) score += 3;
                    }
                }
            } catch (e) { /* safety: party might not be ready */ }

            if (score >= 10) return 'critical';
            if (score >= 7) return 'dire';
            if (score >= 4) return 'tense';
            if (score >= 2) return 'cautious';
            return 'stable';
        },

        /**
         * Get a compact text summary for prompt injection.
         * This replaces raw STM events dump with structured context.
         */
        getWorldSummary() {
            const s = this.getSnapshot();
            const es = Config.language === 'es';
            const lines = [];

            // Situation headline
            const situations = es
                ? { critical: '⚠ SITUACIÓN CRÍTICA', dire: '⚠ Situación grave', tense: 'Situación tensa', cautious: 'Precaución', stable: 'Situación estable' }
                : { critical: '⚠ CRITICAL SITUATION', dire: '⚠ Dire situation', tense: 'Tense situation', cautious: 'Caution needed', stable: 'Situation stable' };
            lines.push(situations[s.situation] || situations.stable);

            // Party summary
            if (s.party.dead > 0) {
                lines.push(es ? `Grupo: ${s.party.size} miembros, ${s.party.dead} caído(s), HP medio: ${s.party.avg_hp_pct}%` : `Party: ${s.party.size} members, ${s.party.dead} dead, avg HP: ${s.party.avg_hp_pct}%`);
            } else if (s.party.wounded > 0) {
                lines.push(es ? `Grupo: ${s.party.wounded} herido(s), HP medio: ${s.party.avg_hp_pct}%` : `Party: ${s.party.wounded} wounded, avg HP: ${s.party.avg_hp_pct}%`);
            }

            // Resources
            const resWarnings = [];
            if (s.resources.healing === 0) resWarnings.push(es ? 'Sin curación' : 'No healing items');
            if (s.resources.food === 0) resWarnings.push(es ? 'Sin comida' : 'No food');
            if (resWarnings.length > 0) lines.push(resWarnings.join(', '));

            // Morale
            if (s.morale.overall === 'desperate' || s.morale.overall === 'low') {
                lines.push(es ? `Moral: ${s.morale.overall === 'desperate' ? 'desesperada' : 'baja'}` : `Morale: ${s.morale.overall}`);
            }

            // Threat
            if (s.threats.level === 'extreme' || s.threats.level === 'high') {
                lines.push(es ? `Amenaza: ${s.threats.level === 'extreme' ? 'extrema' : 'alta'}` : `Threat: ${s.threats.level}`);
            }

            return lines.length > 1 ? lines.join(' | ') : '';
        },

        /**
         * Track map visits (called on map transfer)
         */
        _visitedMaps: new Set(),
        _mapEntryTime: 0,
        onMapTransfer(mapId) {
            this._visitedMaps.add(String(mapId));
            this._mapEntryTime = Date.now();
            this._lastSnapshot = null; // Force recalculation
        },

        /**
         * Full snapshot for telemetry/thesis logging
         */
        getWorldSnapshotForLog() {
            const s = this.getSnapshot();
            return {
                situation: s.situation,
                party_size: s.party.size,
                party_avg_hp: s.party.avg_hp_pct,
                party_dead: s.party.dead,
                healing_items: s.resources.healing,
                food_items: s.resources.food,
                total_items: s.resources.total_items,
                threat_level: s.threats.level,
                threat_score: s.threats.score,
                morale: s.morale.overall,
                sanity_pct: s.morale.sanity_pct,
                hunger: s.morale.hunger_level,
                map: s.environment.map_name,
                in_battle: s.environment.in_battle,
                maps_visited: this._visitedMaps.size
            };
        }
    };

    //=========================================================================
    // NPC Intelligence — Track and identify NPCs the player interacts with (Branch 7)
    //=========================================================================
    const NPCIntelligence = {
        // Face sprite → character identity mapping (from Actors.json analysis)
        _faceMap: {
            'Actor1:0': { name: 'Cahara', nameEs: 'Cahara', role: 'Playable character / Thief' },
            'Actor1:2': { name: "D'arce", nameEs: "D'arce", role: 'Holy knight of the Fellowship' },
            'Actor1:3': { name: 'Girl', nameEs: 'Niña', role: 'Mysterious girl, child character' },
            'Actor1:6': { name: 'Enki', nameEs: 'Enki', role: 'Dark priest / Scholar' },
            'Actor1:7': { name: 'Ragnvaldr', nameEs: 'Ragnvaldr', role: 'Barbarian mercenary' },
            'Actor2:0': { name: "Le'garde", nameEs: "Le'garde", role: 'Knight captain, central figure' },
            'Actor2:1': { name: 'Moonless', nameEs: 'Moonless', role: 'Dangerous creature / recruitable' },
            'Actor2:3': { name: 'Demon Child', nameEs: 'Niño Demonio', role: 'Demon offspring' },
            'Actor2:4': { name: 'Marriage', nameEs: 'Matrimonio', role: 'Fused creature' },
            'Actor2:7': { name: 'Skeleton', nameEs: 'Esqueleto', role: 'Undead, recruitable party member' },
            'Actor3:0': { name: "Nas'hrah", nameEs: "Nas'hrah", role: 'Talking skull, advisor' },
            'Marcoh_faces:0': { name: 'Marcoh', nameEs: 'Marcoh', role: 'AI Companion' },
        },

        // Recent NPC dialogue buffer (last 5 interactions)
        _recentDialogue: [],
        MAX_DIALOGUE_BUFFER: 5,

        // NPC encounter tracking
        _encounters: new Map(), // npcName → { count, lastSeen, lastMap }
        _lastSpeaker: null,
        _lastSpeakerTime: 0,

        /**
         * Identify who is speaking based on face sprite and event context.
         * @param {string} faceName - Face image filename from command101
         * @param {number} faceIndex - Face index within the image
         * @param {number} eventId - Event ID that triggered the dialogue
         * @returns {{ name: string, nameEs: string, role: string, source: string } | null}
         */
        identifySpeaker(faceName, faceIndex, eventId) {
            // 1. Try face sprite mapping first (most reliable)
            if (faceName && faceName.length > 0) {
                const faceKey = `${faceName}:${faceIndex}`;
                if (this._faceMap[faceKey]) {
                    return { ...this._faceMap[faceKey], source: 'face_sprite' };
                }
                // Partial match on face name alone
                for (const [key, val] of Object.entries(this._faceMap)) {
                    if (key.startsWith(faceName + ':')) {
                        return { ...val, source: 'face_partial' };
                    }
                }
            }

            // 2. Try event name (some events have descriptive names)
            if (eventId > 0 && $gameMap) {
                try {
                    const event = $gameMap.event(eventId);
                    if (event && event.event) {
                        const evName = event.event().name || '';
                        const identified = this._identifyByEventName(evName);
                        if (identified) return { ...identified, source: 'event_name' };
                    }
                } catch (e) { /* event not accessible */ }
            }

            // 3. If face is empty and no event match, it's narration/system text
            if (!faceName || faceName.length === 0) {
                return { name: 'Narrator', nameEs: 'Narrador', role: 'Game narration', source: 'narration' };
            }

            return null; // Unknown speaker
        },

        /**
         * Try to identify NPC from event name patterns
         */
        _identifyByEventName(evName) {
            if (!evName) return null;
            const name = evName.toLowerCase();

            // Common F&H event name patterns
            const patterns = {
                'guard': { name: 'Guard', nameEs: 'Guardia', role: 'Dungeon guard' },
                'merchant': { name: 'Merchant', nameEs: 'Mercader', role: 'Trader NPC' },
                'pocketcat': { name: 'Pocketcat', nameEs: 'Pocketcat', role: 'Mysterious cat merchant' },
                'enki': { name: 'Enki', nameEs: 'Enki', role: 'Dark priest' },
                'darce': { name: "D'arce", nameEs: "D'arce", role: 'Holy knight' },
                'ragnvaldr': { name: 'Ragnvaldr', nameEs: 'Ragnvaldr', role: 'Barbarian' },
                'cahara': { name: 'Cahara', nameEs: 'Cahara', role: 'Thief' },
                'legarde': { name: "Le'garde", nameEs: "Le'garde", role: 'Knight captain' },
                'nashrah': { name: "Nas'hrah", nameEs: "Nas'hrah", role: 'Talking skull' },
                'girl': { name: 'Girl', nameEs: 'Niña', role: 'Mysterious girl' },
                'priest': { name: 'Dark Priest', nameEs: 'Sacerdote Oscuro', role: 'Cultist' },
                'trortur': { name: 'Trortur', nameEs: 'Trortur', role: 'Dungeon torturer' },
                'buckman': { name: 'Buckman', nameEs: 'Buckman', role: 'NPC' },
            };

            for (const [key, val] of Object.entries(patterns)) {
                if (name.includes(key)) return val;
            }

            return null;
        },

        /**
         * Called when a Show Text command fires.
         * Records the NPC dialogue and updates encounter tracking.
         * @param {string} speakerName - Identified speaker name
         * @param {string} text - Dialogue text content
         * @param {string} mapName - Current map name
         */
        recordDialogue(speakerName, text, mapName) {
            if (!speakerName || speakerName === 'Narrator') return;

            const now = Date.now();

            // Deduplicate (same speaker within 200ms is likely multi-line continuation)
            if (this._lastSpeaker === speakerName && now - this._lastSpeakerTime < 200) return;
            this._lastSpeaker = speakerName;
            this._lastSpeakerTime = now;

            // Add to dialogue buffer
            this._recentDialogue.push({
                speaker: speakerName,
                text: text.substring(0, 200), // Truncate long text
                map: mapName,
                time: now
            });
            if (this._recentDialogue.length > this.MAX_DIALOGUE_BUFFER) {
                this._recentDialogue.shift();
            }

            // Update encounter tracking
            const encounter = this._encounters.get(speakerName) || { count: 0, lastSeen: 0, lastMap: '' };
            encounter.count++;
            encounter.lastSeen = now;
            encounter.lastMap = mapName;
            this._encounters.set(speakerName, encounter);

            // Add to ShortTermMemory so the AI knows the player talked to someone
            ShortTermMemory.addEvent(`${speakerName} spoke to the party.`);

            Debug.log(`[NPCIntelligence] ${speakerName} spoke: "${text.substring(0, 60)}..."`);
        },

        /**
         * Get recent NPC dialogue for prompt context.
         * Returns empty string if no recent NPC interactions.
         */
        getRecentDialogueSummary() {
            const now = Date.now();
            // Only include dialogue from last 3 minutes
            const recent = this._recentDialogue.filter(d => now - d.time < 180000);
            if (recent.length === 0) return '';

            const es = Config.language === 'es';
            const header = es ? 'DIÁLOGOS RECIENTES DE NPCs:' : 'RECENT NPC DIALOGUE:';
            const lines = recent.map(d => `${d.speaker}: "${d.text.substring(0, 80)}"`);
            return `${header}\n${lines.join('\n')}`;
        },

        /**
         * Get KB information about a known NPC (if available).
         * @param {string} name - NPC name
         * @returns {object|null} KB data about the NPC
         */
        getKBInfo(name) {
            if (typeof FearHungerKB === 'undefined') return null;

            // Check characters KB
            if (FearHungerKB.characters) {
                for (const key in FearHungerKB.characters) {
                    const c = FearHungerKB.characters[key];
                    const displayName = (c.displayName || key).toLowerCase();
                    const displayNameEs = (c.displayNameEs || '').toLowerCase();
                    if (name.toLowerCase() === displayName || name.toLowerCase() === displayNameEs) {
                        return c;
                    }
                }
            }

            // Check enemies/bosses KB (some NPCs become enemies)
            const allEnemies = { ...(FearHungerKB.enemies || {}), ...(FearHungerKB.bosses || {}) };
            for (const key in allEnemies) {
                const e = allEnemies[key];
                const displayName = (e.displayName || key).toLowerCase();
                const displayNameEs = (e.displayNameEs || '').toLowerCase();
                if (name.toLowerCase() === displayName || name.toLowerCase() === displayNameEs) {
                    return e;
                }
            }

            return null;
        },

        /**
         * Get encounter stats for a specific NPC.
         */
        getEncounterInfo(name) {
            return this._encounters.get(name) || null;
        },

        /**
         * Get all encountered NPCs.
         */
        getAllEncounters() {
            const result = {};
            for (const [name, data] of this._encounters) {
                result[name] = data;
            }
            return result;
        },

        /**
         * Clear dialogue buffer (e.g., on map transfer)
         */
        clearRecentDialogue() {
            this._recentDialogue = [];
            this._lastSpeaker = null;
        }
    };

    //=========================================================================
    // Expose for debugging
    //=========================================================================
    window.AI_Companion = {
        Config,
        Debug,
        ThesisLogger,
        AIState,
        BattleStateExtractor,
        ActionExecutor,
        GeminiAPIHandler,
        MemoryManager,
        ModelRouter,
        CharacterPresets,
        ShortTermMemory,
        IntentDetector,
        RelationshipTracker,
        KBFallback,
        MapContextHelper,
        EquipmentHelper
    };

    //=========================================================================
    // PHASE 4.1: Chat System (Keypress C to talk - T is torch)
    //=========================================================================
    const ChatSystem = {
        _active: false,
        _fallbackState: null,
        MAX_HISTORY: 12,
        MAX_TRANSCRIPT_ENTRIES: 240,

        isActive() {
            return this._active;
        },

        _createEmptyState() {
            return {
                recentHistory: [],
                transcript: [],
                lastContextKey: null,
                lastContextLabel: '',
                nextEntryId: 1
            };
        },

        _getState() {
            if (typeof $gameSystem === 'undefined' || !$gameSystem) {
                if (!this._fallbackState) this._fallbackState = this._createEmptyState();
                return this._fallbackState;
            }
            if (!$gameSystem._aiChatState) {
                $gameSystem._aiChatState = this._createEmptyState();
            }
            return $gameSystem._aiChatState;
        },

        resetPersistentState() {
            if (typeof $gameSystem !== 'undefined' && $gameSystem) {
                $gameSystem._aiChatState = this._createEmptyState();
            } else {
                this._fallbackState = this._createEmptyState();
            }
        },

        _nextEntryId() {
            const state = this._getState();
            const nextId = state.nextEntryId || 1;
            state.nextEntryId = nextId + 1;
            return nextId;
        },

        _trimTranscript() {
            const state = this._getState();
            while (state.transcript.length > this.MAX_TRANSCRIPT_ENTRIES) {
                state.transcript.shift();
            }
        },

        // Muted color palette for Fear & Hunger aesthetic
        COLORS: {
            enemy: '\\C[2]',      // Dark rust
            item: '\\C[3]',       // Sickly green
            location: '\\C[1]',   // Pale blue-gray
            warning: '\\C[14]',   // Muted gold
            reset: '\\C[0]'
        },

        _escapeRegex(s) {
            return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        },

        // Whole-word match only (so "guardar" does not color "guard")
        colorCodeText(text) {
            let result = text;
            const wordRe = (str) => new RegExp('\\b' + this._escapeRegex(str) + '\\b', 'gi');

            if (typeof FearHungerKB !== 'undefined') {
                const enemyNames = [];
                for (const key in FearHungerKB.enemies) {
                    const d = FearHungerKB.enemies[key].displayName;
                    if (d) enemyNames.push(d);
                }
                for (const key in FearHungerKB.bosses) {
                    const d = FearHungerKB.bosses[key].displayName;
                    if (d) enemyNames.push(d);
                }
                for (const name of enemyNames) {
                    result = result.replace(wordRe(name), this.COLORS.enemy + '$&' + this.COLORS.reset);
                }
            }

            const items = Config.language === 'es'
                ? ['Fragmento de tela', 'Frasco azul', 'Carne seca', 'Pan', 'Moneda de la suerte', 'Antorcha', 'Hierba verde', 'Hierba roja', 'Hierba azul', 'Poción blanca', 'Poción roja']
                : ['Cloth fragment', 'Blue vial', 'Dried meat', 'Bread', 'Lucky coin', 'Torch', 'Green herb', 'Red herb', 'Blue herb', 'White vial', 'Red vial'];
            for (const item of items) {
                result = result.replace(wordRe(item), this.COLORS.item + '$&' + this.COLORS.reset);
            }

            return result;
        },

        getTranscriptEntries() {
            return this._getState().transcript;
        },

        getDisplayMessages() {
            return this.getTranscriptEntries();
        },

        formatMessageTime(date) {
            if (!date) date = new Date();
            const h = date.getHours();
            const m = date.getMinutes();
            return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
        },

        getPlayerFace() {
            const leader = $gameParty.leader ? $gameParty.leader() : ($gameParty.battleMembers && $gameParty.battleMembers()[0]);
            if (!leader) return { faceName: 'Actor1', faceIndex: 0 };
            return { faceName: leader.faceName(), faceIndex: leader.faceIndex() };
        },

        getCompanionFace() {
            const app = CharacterPresets.getCurrentAppearance();
            return { faceName: app.face, faceIndex: app.faceIndex };
        },

        _getCurrentContextMeta() {
            const mapContext = MapContextHelper.getMapContext();
            const sceneIsBattle = (SceneManager._scene && SceneManager._scene instanceof Scene_Battle) ||
                (SceneManager._stack && SceneManager._stack.some(function (s) { return s === Scene_Battle; }));
            const isInBattle = sceneIsBattle || ($gameParty.inBattle && $gameParty.inBattle());
            const es = Config.language === 'es';

            if (isInBattle) {
                let state = null;
                try {
                    state = BattleStateExtractor.extract();
                } catch (e) {
                    Debug.warn('[Chat] Failed to extract battle context for separator:', e.message);
                }
                if (!state && AIState.lastBattleStateCache) {
                    state = AIState.lastBattleStateCache;
                }

                const turn = state && state.turn_number ? state.turn_number : null;
                const enemies = state && state.enemies
                    ? state.enemies.filter(e => e.alive).map(e => e.name)
                    : [];
                const enemyLabel = enemies.length > 0
                    ? enemies.join(', ')
                    : (es ? 'enemigos desconocidos' : 'unknown enemies');

                return {
                    tag: 'battle',
                    key: 'battle:' + (turn || 0) + ':' + enemyLabel.toLowerCase(),
                    label: es
                        ? `COMBATE${turn ? ' - Turno ' + turn : ''} · ${enemyLabel}`
                        : `BATTLE${turn ? ' - Turn ' + turn : ''} · ${enemyLabel}`,
                    battleTurn: turn
                };
            }

            const mapName = mapContext.displayName || mapContext.rawDisplayName || (es ? 'Zona desconocida' : 'Unknown area');
            return {
                tag: 'field',
                key: 'field:' + String(mapName).toLowerCase(),
                label: es ? `EXPLORACION · ${mapName}` : `EXPLORATION · ${mapName}`,
                battleTurn: null
            };
        },

        getCurrentContextMeta() {
            return this._getCurrentContextMeta();
        },

        _ensureContextSeparator(contextMeta) {
            const state = this._getState();
            const meta = contextMeta || this._getCurrentContextMeta();
            if (state.lastContextKey !== meta.key || state.lastContextLabel !== meta.label || state.transcript.length === 0) {
                state.transcript.push({
                    id: this._nextEntryId(),
                    type: 'separator',
                    label: meta.label,
                    contextTag: meta.tag,
                    timestamp: Date.now()
                });
                state.lastContextKey = meta.key;
                state.lastContextLabel = meta.label;
                this._trimTranscript();
            }
            return meta;
        },

        addTranscriptMessage(role, message, contextMeta) {
            const meta = this._ensureContextSeparator(contextMeta);
            const sender = role === 'player'
                ? ($gameParty && $gameParty.leader() ? $gameParty.leader().name() : (Config.language === 'es' ? 'Tú' : 'You'))
                : Config.companionName;
            const entry = {
                id: this._nextEntryId(),
                type: 'message',
                role: role,
                sender: sender,
                text: String(message || ''),
                timestamp: Date.now(),
                timestampLabel: this.formatMessageTime(),
                contextTag: meta.tag,
                contextLabel: meta.label
            };
            if (meta.battleTurn) entry.battleTurn = meta.battleTurn;
            this._getState().transcript.push(entry);
            this._trimTranscript();
            return entry;
        },

        addToHistory(role, message, contextMeta) {
            const meta = contextMeta || this._getCurrentContextMeta();
            const state = this._getState();
            state.recentHistory.push({
                role: role,
                message: String(message || ''),
                time: Date.now(),
                contextTag: meta.tag,
                contextLabel: meta.label
            });
            while (state.recentHistory.length > this.MAX_HISTORY) {
                state.recentHistory.shift();
            }
        },

        _buildPromptHistory() {
            const recent = this._getState().recentHistory.slice(-this.MAX_HISTORY);
            const lines = [];
            let lastLabel = null;

            for (const entry of recent) {
                if (entry.contextLabel && entry.contextLabel !== lastLabel) {
                    lines.push({ role: 'separator', message: entry.contextLabel, contextTag: entry.contextTag });
                    lastLabel = entry.contextLabel;
                }
                lines.push({
                    role: entry.role,
                    message: entry.message,
                    contextTag: entry.contextTag
                });
            }

            return lines;
        },

        _buildOlderChatMemory() {
            const transcript = this._getState().transcript;
            const messageEntries = transcript.filter(entry => entry.type === 'message' || entry.type === 'separator');
            if (messageEntries.length <= 10) return [];
            return messageEntries
                .slice(0, Math.max(0, messageEntries.length - 8))
                .slice(-6)
                .map(entry => {
                    if (entry.type === 'separator') {
                        return { role: 'separator', message: entry.label, contextTag: entry.contextTag };
                    }
                    return { role: entry.role, message: entry.text, contextTag: entry.contextTag };
                });
        },

        _isVisionQuery(message) {
            return /(?:que ves|qué ves|ves algo|que hay alrededor|qué hay alrededor|que tienes delante|qué tienes delante|what do you see|what's around|what is around|what can you see|look around)/i.test(message || '');
        },

        open() {
            if ($gameMessage.isBusy()) return; // Allow in battle now

            this._active = true;
            // Disable player movement
            // Use Scene_Battle check (more reliable than $gameParty.inBattle which can lag 1 frame)
            var inBattleScene = (SceneManager._scene && SceneManager._scene instanceof Scene_Battle) ||
                (SceneManager._stack && SceneManager._stack.some(function (s) { return s === Scene_Battle; }));
            if (!inBattleScene) {
                $gamePlayer._moveSpeed = 0;
            }
            $gameTemp._chatLocked = true;

            // Cache battle state BEFORE pushing new scene (so chat can access it)
            if (inBattleScene) {
                try {
                    AIState.lastBattleStateCache = BattleStateExtractor.extract();
                    Debug.log('[Chat] Cached battle state before scene push:',
                        AIState.lastBattleStateCache ? 'OK, enemies: ' + AIState.lastBattleStateCache.enemies.filter(e => e.alive).map(e => e.name).join(', ') : 'null');
                } catch (e) {
                    Debug.warn('[Chat] Failed to cache battle state:', e.message);
                }
            }

            SceneManager.push(Scene_AIChat);
        },

        close() {
            this._active = false;
            // Restore player movement
            $gamePlayer._moveSpeed = 4;
            $gameTemp._chatLocked = false;
        },

        getContext() {
            // Only send last 3-5 exchanges + summary
            const recent = this._buildPromptHistory();
            const memory = MemoryManager.getLongTermMemory();
            const sanity = SanityManager.getSanityLevel();
            const events = ShortTermMemory.getRecentEvents();
            const mapContext = MapContextHelper.getMapContext();
            const leader = $gameParty.leader ? $gameParty.leader() : $gameParty.battleMembers()[0];
            const companionActor = $gameActors && $gameActors.actor(Config.companionActorId);

            // Battle detection: check Scene_Battle first (most reliable), then $gameParty, then cache
            let battleStateSummary = null;
            const sceneIsBattle = (SceneManager._scene && SceneManager._scene instanceof Scene_Battle) ||
                (SceneManager._stack && SceneManager._stack.some(function (s) { return s === Scene_Battle; }));
            const isInBattle = sceneIsBattle || ($gameParty.inBattle && $gameParty.inBattle());
            Debug.log('[Chat] Battle detection: sceneIsBattle=', sceneIsBattle,
                'partyInBattle=', $gameParty.inBattle && $gameParty.inBattle(),
                'cachedState=', !!AIState.lastBattleStateCache);

            if (isInBattle) {
                let state = null;
                try { state = BattleStateExtractor.extract(); } catch (e) { Debug.warn('[Chat] BattleStateExtractor failed:', e.message); }
                // Fallback to cached state from before scene push
                if (!state && AIState.lastBattleStateCache) {
                    state = AIState.lastBattleStateCache;
                    Debug.log('[Chat] Using cached battle state');
                }
                if (state) {
                    battleStateSummary = {
                        turn_number: state.turn_number,
                        enemies: state.enemies.filter(e => e.alive).map(e => ({ name: e.name, hp: e.hp, max_hp: e.max_hp, limbs: e.limbs })),
                        allies: state.allies.map(a => ({ name: a.name, hp: a.hp, max_hp: a.max_hp, can_act: a.can_act }))
                    };
                }
            }

            const lastBattle = ShortTermMemory.getLastBattle();

            // Only include status effects that are ACTIVE on player/companion, not all 20+
            // Full KB dump only when player asks about a status keyword
            let statusEffectsSummary = '';
            const statusKeywords = /icon|status|efecto|cura|cure|poison|veneno|bleed|sangr|infect|parasi|burn|quemad|fear|miedo|hunger|hambre|blind|ciego|fobia|phobia|eroto|panto|escoto|estado/i;
            const askingAboutStatus = this._getState().recentHistory.slice(-1).some(
                e => e.role === 'player' && statusKeywords.test(e.message)
            );
            if (typeof FearHungerKB !== 'undefined' && FearHungerKB.getStatusEffectsForPrompt) {
                if (askingAboutStatus) {
                    // Full dump only when player is asking about a status
                    statusEffectsSummary = FearHungerKB.getStatusEffectsForPrompt();
                } else {
                    // Collect all active states from ALL party members
                    const activeEffects = new Map(); // name -> Set of affected members
                    for (const member of $gameParty.members()) {
                        if (member && member.states) {
                            member.states().forEach(s => {
                                if (s.name) {
                                    if (!activeEffects.has(s.name)) activeEffects.set(s.name, []);
                                    activeEffects.get(s.name).push(member.name());
                                }
                            });
                        }
                    }
                    if (activeEffects.size > 0) {
                        const lines = [];
                        // Determine if phobias are relevant (check enemy types in battle)
                        const enemyNames = battleStateSummary ? battleStateSummary.enemies.map(e => e.name.toLowerCase()).join(' ') : '';
                        const phobiaRelevanceMap = {
                            'fasmofobia': /ghost|spectr|phantom|fantasma|espectro|spirit/i,
                            'phasmophobia': /ghost|spectr|phantom|fantasma|espectro|spirit/i,
                            'erotofobia': /nude|naked|desnud|sexual|flesh/i,
                            'panofobia': /./i, // always relevant (fear of everything)
                            'escotofobia': /dark|oscur|shadow|sombr/i,
                            'scotophobia': /dark|oscur|shadow|sombr/i,
                        };

                        for (const [stateName, members] of activeEffects) {
                            // Filter phobias: only include when relevant
                            const isPhobia = /fobia|phobia/i.test(stateName);
                            if (isPhobia) {
                                const phobiaKey = stateName.toLowerCase();
                                const relevanceRegex = phobiaRelevanceMap[phobiaKey];
                                if (relevanceRegex && battleStateSummary) {
                                    // In combat: only show if fighting matching enemy type
                                    if (!relevanceRegex.test(enemyNames)) continue;
                                } else if (battleStateSummary) {
                                    // Unknown phobia in combat, skip to be safe
                                    continue;
                                }
                                // Outside combat: skip phobia entirely (not useful)
                                if (!battleStateSummary) continue;
                            }

                            let kbInfo = null;
                            // Try to find matching KB entry (case-insensitive, check altNames)
                            if (FearHungerKB.statusEffects) {
                                for (const key in FearHungerKB.statusEffects) {
                                    const s = FearHungerKB.statusEffects[key];
                                    if (s.name.toLowerCase() === stateName.toLowerCase() ||
                                        (s.altNames && s.altNames.some(a => a.toLowerCase() === stateName.toLowerCase()))) {
                                        kbInfo = s;
                                        break;
                                    }
                                }
                            }
                            const who = members.join(', ');
                            if (kbInfo) {
                                lines.push(`${stateName} (${who}): ${kbInfo.effect} Cura: ${kbInfo.cure}`);
                            } else {
                                lines.push(`${stateName} (${who}): Estado activo (sin datos adicionales en KB)`);
                            }
                        }
                        statusEffectsSummary = lines.join('\n');
                    }
                }
            }

            const ctx = {
                player_name: leader ? leader.name() : 'Player',
                is_player_speaking: true,
                recent_exchanges: recent,
                older_chat_memory: this._buildOlderChatMemory(),
                memory_summary: memory.relationship || 'New companion',
                current_map: mapContext.displayName,
                current_map_tips: mapContext.tips,
                raw_map_name: mapContext.rawDisplayName,
                sanity_state: sanity.level,
                sanity_modifier: sanity.modifier,
                recent_events: events,
                player_equipment: leader ? EquipmentHelper.getEquipment(leader) : {},
                companion_equipment: companionActor ? EquipmentHelper.getEquipment(companionActor) : {},
                in_battle: !!(battleStateSummary),
                battle_state: battleStateSummary,
                last_battle: lastBattle,
                status_effects_summary: statusEffectsSummary,
                // NEW: party members list and raw state names
                party_members: $gameParty.members().map(m => ({
                    name: m.name(),
                    hp: m.hp, max_hp: m.mhp,
                    states: m.states().map(s => s.name).filter(n => n)
                })),
                // NEW: spatial awareness — nearby objects from EnvironmentScanner
                nearby_objects: EnvironmentScanner.getSummary(),
                nearby_observation: EnvironmentScanner.observe(),
                // Branch 6: World State Engine — aggregated situational summary
                world_state: WorldStateEngine.getWorldSummary(),
                // Branch 7: NPC Intelligence — recent NPC dialogue
                npc_dialogue: NPCIntelligence.getRecentDialogueSummary(),
            };
            if (Config.debugMode) {
                Debug.log('[Chat] getContext:', JSON.stringify(ctx, null, 2));
            }
            return ctx;
        },

        async sendMessage(playerMessage) {
            const exchangeContext = this._ensureContextSeparator();
            this.addToHistory('player', playerMessage, exchangeContext);
            this.addTranscriptMessage('player', playerMessage, exchangeContext);
            RelationshipTracker.onConversation();

            const context = this.getContext();
            const intent = await IntentDetector.classifyWithFallback(playerMessage);

            if (Config.debugMode) {
                Debug.log('[Chat] Intent:', JSON.stringify({ types: intent.types, primary: intent.primary, entities: intent.entities.map(e => e.name + ':' + e.status), confidence: intent.confidence }));
            }

            // Handle ambiguous entity resolution: ask for clarification without LLM
            const ambiguousEntity = intent.entities.find(e => e.status === 'ambiguous' || (intent.entities.filter(x => x.type === e.type).length > 2));
            // Actually check via the resolution status stored during extraction
            // If any entity set had ambiguous status, prompt clarification
            for (const entityType of ['item', 'enemy', 'character', 'location']) {
                const ofType = intent.entities.filter(e => e.type === entityType && e.status === 'fuzzy');
                if (ofType.length > 2) {
                    const names = ofType.slice(0, 4).map(e => e.name);
                    const response = Config.language === 'es'
                        ? `¿Te refieres a ${names.join(', ')}...?`
                        : `Do you mean ${names.join(', ')}...?`;
                    this.addToHistory('companion', response, exchangeContext);
                    this.addTranscriptMessage('companion', response, exchangeContext);
                    return response;
                }
            }

            const prompt = this._buildChatPrompt(playerMessage, context, intent);

            if (Config.debugMode) {
                Debug.log('[Chat] prompt length:', prompt.length, 'chars');
            }

            const chatStartTime = performance.now();
            try {
                const response = await this._sendChatRequest(prompt);
                const chatLatency = Math.round(performance.now() - chatStartTime);
                if (!response || response.trim().length === 0) {
                    // KB fallback — no LLM dependency
                    const fallback = KBFallback.respond(intent);
                    this.addToHistory('companion', fallback, exchangeContext);
                    this.addTranscriptMessage('companion', fallback, exchangeContext);
                    ThesisLogger.log('chat', {
                        player_message: playerMessage,
                        intent: { types: intent.types, primary: intent.primary, confidence: intent.confidence },
                        prompt_length: prompt.length,
                        response_text: fallback,
                        response_source: 'kb_fallback',
                        latency_ms: chatLatency,
                        model_used: null
                    });
                    return fallback;
                }
                this.addToHistory('companion', response, exchangeContext);
                this.addTranscriptMessage('companion', response, exchangeContext);
                ThesisLogger.log('chat', {
                    player_message: playerMessage,
                    intent: { types: intent.types, primary: intent.primary, confidence: intent.confidence },
                    prompt_length: prompt.length,
                    prompt_text: prompt,
                    response_text: response,
                    response_source: 'llm',
                    latency_ms: chatLatency,
                    model_used: this._lastModelUsed || null
                });
                return response;
            } catch (error) {
                const chatLatency = Math.round(performance.now() - chatStartTime);
                Debug.error('[Chat] error:', error);
                // KB fallback on API failure
                const fallback = KBFallback.respond(intent);
                this.addToHistory('companion', fallback, exchangeContext);
                this.addTranscriptMessage('companion', fallback, exchangeContext);
                ThesisLogger.log('chat', {
                    player_message: playerMessage,
                    intent: { types: intent.types, primary: intent.primary, confidence: intent.confidence },
                    prompt_length: prompt.length,
                    response_text: fallback,
                    response_source: 'kb_fallback_error',
                    latency_ms: chatLatency,
                    error: error.message
                });
                return fallback;
            }
        },

        _buildChatPrompt(playerMessage, context, intent) {
            const sanityMod = context.sanity_modifier;

            // Base prompt: identity + relationship (always)
            const playerName = context.player_name || 'the player';
            let prompt = `You are ${Config.companionName}, a companion fighting alongside ${playerName} in Fear & Hunger. You are talking directly to ${playerName}. Refer to them as 'you' or by name, NEVER in the third person. You are one of the party — do NOT talk as if you are separate from the group. You are ${Config.personality}.
${CharacterPresets.getCurrentPersonality().backstory ? '\nCHARACTER BACKSTORY: ' + CharacterPresets.getCurrentPersonality().backstory + '\n' : ''}
RELATIONSHIP: ${RelationshipTracker.getSummary()}
Sanity: ${context.sanity_state} (${sanityMod})

CRITICAL GAME RULES (NEVER violate these):
- Fear & Hunger has NO leveling system, NO XP, NO experience points. NEVER mention leveling up.
- COIN FLIP: Many enemies have a coin flip turn that causes INSTANT DEATH (50% chance). Kill them before that turn.
- Stats can only be raised via gear, items (Blue vials), or the Human Hydra with Ring of Wraiths.
- The game saves ONLY at ritual circles. Death is permanent.
- STATIC LOCATION KNOWLEDGE is background lore/tips about an area. It is NOT proof that something is currently visible right now.
- LIVE NEARBY DETECTION is the ONLY source for claims like "I can see...", "near us right now", or "what is around us".
- Never turn area lore, tips, or rumors into a current sighting. If LIVE NEARBY DETECTION does not mention an NPC, enemy, or object, do NOT claim you can currently see it.
- Never invent visual details such as age, scars, clothing, beard, gender, count, or exact position unless those details are explicitly present in the provided context.
`;

            // Modular context injection based on intent types
            for (const type of intent.types) {
                prompt += this._getContextBlock(type, intent, context);
            }

            // Filtered events (only relevant ones)
            prompt += this._buildEventContext(context, intent);

            // Recent conversation (always)
            if (context.older_chat_memory && context.older_chat_memory.length > 0) {
                prompt += `\nEARLIER CHAT MEMORY:\n${context.older_chat_memory.map(e => e.role === 'separator' ? `[${e.message}]` : `${e.role}: ${e.message}`).join('\n')}\n`;
            }
            prompt += `\nRECENT CONVERSATION:\n${context.recent_exchanges.map(e => e.role === 'separator' ? `[${e.message}]` : `${e.role}: ${e.message}`).join('\n')}\n`;

            // Answer mode instructions
            prompt += this._buildInstructions(intent);

            // Inject party members and their states
            if (context.party_members && context.party_members.length > 0) {
                prompt += `\nPARTY MEMBERS:\n`;
                for (const m of context.party_members) {
                    const statesStr = m.states.length > 0 ? m.states.join(', ') : 'ninguno';
                    prompt += `- ${m.name}: HP ${m.hp}/${m.max_hp}, Estados: ${statesStr}\n`;
                }
            }

            // Inject active status effects with KB descriptions
            if (context.status_effects_summary) {
                prompt += `\nSTATUS EFFECTS INFO:\n${context.status_effects_summary}\n`;
            }

            // Inject spatial awareness — gated by intent to prevent "guard obsession"
            if (context.nearby_objects && context.nearby_objects.length > 0) {
                const spatialIntents = new Set(['tactical', 'location', 'generic_query']);
                if (spatialIntents.has(intent.primary)) {
                    prompt += `\nLIVE NEARBY DETECTION (objects/events actually near you right now): ${context.nearby_objects}\n`;
                } else if (/⚠/.test(context.nearby_objects) && /[12] pasos/.test(context.nearby_objects)) {
                    prompt += `\n(LIVE NEARBY THREAT: ${context.nearby_objects.split(';').filter(s => /⚠/.test(s) && /[12] pasos/.test(s)).join(';').trim()})\n`;
                }
            }


            // Branch 6: World State summary — overall situation awareness
            if (context.world_state && context.world_state.length > 0) {
                prompt += `\nSITUATION: ${context.world_state}\n`;
            }

            // Branch 7: NPC Intelligence — recent NPC dialogue context
            if (context.npc_dialogue && context.npc_dialogue.length > 0) {
                prompt += `\n${context.npc_dialogue}\nYou may comment on what NPCs said, react to their words, or warn the player about untrustworthy characters.\n`;
            }

            prompt += `\nThe player says: "${playerMessage}"\n`;
            if (this._isVisionQuery(playerMessage)) {
                prompt += `VISION QUERY RULE: Answer ONLY from LIVE NEARBY DETECTION above. If LIVE NEARBY DETECTION is empty, say you do not see anything notable right now. Do NOT use STATIC LOCATION KNOWLEDGE, lore, tips, rumors, or past chat to claim a current sighting.\n`;
            }
            const recentCompanionMsgs = context.recent_exchanges
                .filter(e => e.role === 'companion')
                .slice(-2)
                .map(e => e.message);
            if (recentCompanionMsgs.length > 0) {
                prompt += `You already said: ${recentCompanionMsgs.map(m => '"' + m.substring(0, 60) + '..."').join(' and ')}. DO NOT repeat yourself or rephrase the same idea. Say something NEW.\n`;
            }
            prompt += `RESPOND ONLY IN ${Config.language === 'es' ? 'SPANISH (Español)' : 'ENGLISH'}. Be brief (1-2 sentences). Stay in character.\nIMPORTANT: You have access to game knowledge. If the player asks about items, enemies, or status effects, answer with CONFIDENCE using the data provided. Do NOT say "no sé" or "no estoy seguro" unless the information is truly not available in the context above.\nDo NOT mention phobias or status effects unless they are DIRECTLY relevant to the current situation or enemy. If fighting a non-ghost enemy, do NOT mention phasmophobia.\nDo NOT repeatedly warn about the same nearby threat. Mention it ONCE, then move on.\nWhen answering, distinguish static area knowledge from live perception. Do NOT say you currently see or count enemies/NPCs unless they appear in LIVE NEARBY DETECTION or RECENT NPC DIALOGUE.\nYour tone and urgency should match the SITUATION level — if critical, be tense and urgent; if stable, be calm.`;

            return prompt;
        },

        /**
         * Get context block for a specific intent type
         */
        _getContextBlock(type, intent, context) {
            switch (type) {
                case 'item_info': {
                    let block = '';
                    let itemEntities = intent.entities.filter(e => e.type === 'item' && e.match);

                    // FALLBACK: if no entities resolved but we have recent item pickups,
                    // cross-reference them with KB to inject structured data
                    if (itemEntities.length === 0 && context.recent_events && typeof FearHungerKB !== 'undefined') {
                        // Get the player's last message for word matching
                        const lastPlayerMsg = (context.recent_exchanges && context.recent_exchanges.length > 0)
                            ? context.recent_exchanges[context.recent_exchanges.length - 1].message.toLowerCase()
                            : '';
                        const pickupEvents = context.recent_events.filter(e => /picked up|recogi|obtuvo/i.test(e.desc));

                        // Detect broad/generic queries: "lo que encontré", "lo que he encontrado", "what I found", etc.
                        const isGenericQuery = /lo que .{0,5}(encontr|recog|llev|teng)|que me sirve|what i (found|got|picked)|mis (item|objeto|cosa)|these items|los items|para que sirve|que (hemos|he) (encontr|recog)/i.test(lastPlayerMsg);

                        for (const evt of pickupEvents) {
                            // Extract item name from "Player picked up 1x Vial rojo"
                            const nameMatch = evt.desc.match(/\d+x\s+(.+)/);
                            if (!nameMatch) continue;
                            const itemName = nameMatch[1].toLowerCase().trim();

                            // For generic queries, include ALL pickup items
                            if (!isGenericQuery) {
                                // Check if the player's query mentions any word from this item
                                const queryWords = lastPlayerMsg.split(/\s+/).filter(w => w.length > 2);
                                const itemWords = itemName.split(/\s+/);
                                const hasOverlap = queryWords.some(qw => itemWords.some(iw => iw.includes(qw) || qw.includes(iw)));
                                if (!hasOverlap) continue;
                            }

                            // Try to find this item in KB (use getItem for proper matching)
                            const kbItem = FearHungerKB.getItem(nameMatch[1].trim());
                            if (kbItem) {
                                itemEntities.push({ name: kbItem.displayNameEs || kbItem.displayName || kbItem.key, key: kbItem.key, type: 'item', status: 'inferred', match: kbItem, score: 0.8 });
                            }
                        }
                    }

                    if (itemEntities.length > 0) {
                        block += '\n=== ITEM DATA (answer ONLY from this) ===\n';
                        for (const entity of itemEntities) {
                            const item = entity.match;
                            block += `${entity.name}: ${item.description || 'Unknown'}${item.effect ? ' | Effect: ' + item.effect : ''}${item.tips ? ' | Tip: ' + item.tips : ''}${item.source ? ' | Found: ' + item.source.join(', ') : ''}\n`;
                        }
                    }
                    return block;
                }
                case 'tactical': {
                    let block = '';
                    // In-battle context
                    if (context.in_battle && context.battle_state) {
                        const b = context.battle_state;
                        block += `\nCURRENT BATTLE (Turn ${b.turn_number}):\n`;
                        block += `- Enemies: ${b.enemies.map(e => `${e.name} (HP ${e.hp}/${e.max_hp})`).join(', ')}\n`;
                        block += `- Allies: ${b.allies.map(a => `${a.name} HP ${a.hp}/${a.max_hp}${a.can_act ? ' (ready)' : ''}`).join(', ')}\n`;
                    }
                    // Enemy KB data with structured limbDetails
                    const enemyEntities = intent.entities.filter(e => e.type === 'enemy' && e.match);
                    if (enemyEntities.length > 0 && typeof FearHungerKB !== 'undefined') {
                        for (const entity of enemyEntities) {
                            const data = entity.match;
                            block += `\n=== ${(data.displayName || entity.name).toUpperCase()} ===\n`;
                            if (data.weaknesses && data.weaknesses.length) block += `Weak to: ${data.weaknesses.join(', ')}\n`;
                            if (data.resistances && data.resistances.length) block += `Resists: ${data.resistances.join(', ')}\n`;
                            if (data.tactics) block += `Tactics: ${data.tactics}\n`;
                            if (data.strategy) block += `Strategy:\n${data.strategy.map(s => '  - ' + s).join('\n')}\n`;
                            if (data.limbDetails) {
                                block += 'Limbs:\n';
                                for (const [limb, info] of Object.entries(data.limbDetails)) {
                                    block += `  ${limb}: HP ${info.hp}${info.attack ? ' | Attack: ' + info.attack : ''}${info.destruction ? ' | If destroyed: ' + info.destruction : ''}\n`;
                                }
                            }
                            if (data.coinFlipTurn) block += `COIN FLIP on turn ${data.coinFlipTurn} — GUARD on that turn!\n`;
                            if (data.mistakes && data.mistakes.length) block += `AVOID: ${data.mistakes.join('; ')}\n`;
                        }
                    } else if (context.in_battle && context.battle_state && typeof FearHungerKB !== 'undefined') {
                        // No entity matched — look up ALL enemies from battle state using proper getEnemy() with Spanish translation
                        for (const enemy of context.battle_state.enemies) {
                            const lookup = FearHungerKB.getEnemy ? FearHungerKB.getEnemy(enemy.name) : null;
                            const data = lookup || null;
                            if (data) {
                                block += `\n=== ${(data.displayNameEs || data.displayName || enemy.name).toUpperCase()} ===\n`;
                                if (data.danger !== undefined) block += `Danger: ${data.danger}/5\n`;
                                if (data.tactics) block += `Tactics: ${data.tactics}\n`;
                                if (data.limbPriority) block += `Target priority: ${data.limbPriority.join(' > ')}\n`;
                                if (data.hints && data.hints.length) block += `Tips: ${data.hints.join('; ')}\n`;
                                if (data.coinFlipTurn) block += `⚠ COIN FLIP on turn ${data.coinFlipTurn} — KILL BEFORE THIS TURN!\n`;
                                if (data.mistakes && data.mistakes.length) block += `AVOID: ${data.mistakes.join('; ')}\n`;
                                if (data.special) block += `Special: ${data.special}\n`;
                            } else {
                                block += `\n[No data on "${enemy.name}" — be cautious]\n`;
                            }
                        }
                    }
                    return block;
                }
                case 'recent_battle': {
                    let block = '';
                    // Inject last battle cache if available
                    if (AIState.lastBattleStateCache) {
                        const lb = AIState.lastBattleStateCache;
                        block += '\n=== LAST BATTLE DATA ===\n';
                        if (lb.enemies) block += `Enemies: ${lb.enemies.filter(e => e.name).map(e => e.name).join(', ')}\n`;
                        if (lb.turn_number) block += `Lasted ${lb.turn_number} turns\n`;
                    }
                    // Also include any recent combat events
                    if (context.recent_events) {
                        const combatEvents = context.recent_events.filter(e =>
                            /(?:battle|combat|fight|victoria|derrota|enemy|enemigo)/i.test(e.desc)
                        );
                        if (combatEvents.length > 0) {
                            block += `Combat events: ${combatEvents.map(e => e.desc).join('; ')}\n`;
                        }
                    }
                    return block;
                }
                case 'lore': {
                    let block = `\nSTATIC LOCATION KNOWLEDGE:\n- Area: ${context.current_map}`;
                    if (context.current_map_tips && context.current_map_tips.length > 0) {
                        block += `\n- Area lore/tips: ${context.current_map_tips.join(' ')}`;
                    }
                    const charEntities = intent.entities.filter(e => e.type === 'character' && e.match);
                    if (charEntities.length > 0) {
                        block += '\n=== CHARACTER DATA ===\n';
                        for (const entity of charEntities) {
                            const c = entity.match;
                            block += `${c.displayName || entity.name}: ${c.class || 'Unknown'} — ${c.tips || ''}\n`;
                        }
                    }
                    return block;
                }
                case 'emotional': {
                    let block = `\nRelationship level: ${RelationshipTracker.getLevel()} (Trust ${RelationshipTracker.trust}, Affinity ${RelationshipTracker.affinity})\n`;
                    const personality = CharacterPresets.getCurrentPersonality();
                    if (personality && personality.backstory) {
                        block += `\nIMPORTANT: Answer from your CHARACTER'S emotional perspective. You are ${personality.backstory.substring(0, 250)}\n`;
                        block += `Do NOT give tactical advice or mention nearby threats. Focus on how YOU feel, your fears, your past, your connection to the player.\n`;
                    }
                    return block;
                }
                case 'status_help': {
                    let block = '';
                    if (typeof FearHungerKB !== 'undefined' && FearHungerKB.getStatusEffectsForPrompt) {
                        // Include full status KB when asking about statuses
                        block += `\nSTATUS EFFECTS REFERENCE:\n${FearHungerKB.getStatusEffectsForPrompt()}\n`;
                    }
                    return block;
                }
                case 'location': {
                    let block = `\nSTATIC LOCATION KNOWLEDGE:\n- Current location: ${context.current_map}`;
                    if (context.current_map_tips && context.current_map_tips.length > 0) {
                        block += `\n- Area tips: ${context.current_map_tips.join(' ')}`;
                    }
                    const locEntities = intent.entities.filter(e => e.type === 'location' && e.match);
                    if (locEntities.length > 0) {
                        for (const entity of locEntities) {
                            const loc = entity.match;
                            block += `\n- ${loc.displayName}: Possible enemies in the area: ${(loc.enemies || []).join(', ')} | Area tips: ${(loc.tips || []).join(', ')}\n`;
                        }
                    }
                    return block;
                }
                default: return '';
                case 'generic_query': {
                    // Minimal context — don't bloat the prompt
                    let block = `\nSTATIC LOCATION KNOWLEDGE:\n- Location: ${context.current_map}\n`;
                    if (context.in_battle && context.battle_state) {
                        block += `IN BATTLE — Enemies: ${context.battle_state.enemies.map(e => e.name).join(', ')}\n`;
                    }
                    return block;
                }
            }
        },

        /**
         * Filter events to only include those relevant to the intent
         */
        _buildEventContext(context, intent) {
            if (!context.recent_events || context.recent_events.length === 0) return '';

            // For item queries, only include item-related events
            if (intent.primary === 'item_info') {
                const itemNames = intent.entities.filter(e => e.type === 'item').map(e => e.name);
                const relevant = context.recent_events.filter(e =>
                    itemNames.some(name => e.desc.toLowerCase().includes(name))
                );
                if (relevant.length > 0) {
                    return `\nRELEVANT EVENTS:\n${relevant.map(e => `- ${e.desc}`).join('\n')}\n`;
                }
                return '';
            }

            // For emotional/general, include all recent events
            return `\nRECENT EVENTS:\n${context.recent_events.map(e => `- ${e.desc}`).join('\n')}\n`;
        },

        /**
         * Answer mode instructions based on intent
         */
        _buildInstructions(intent) {
            const anchors = `\nHARD ANCHORS (NEVER violate):\n- Never betray the player\n- Never sacrifice allies without consent\n- Never break immersion\n- Always maintain core loyalty\n- NEVER mention "database", "base de datos", "KB", "data", or any technical/meta terms. You are a CHARACTER IN THE GAME, not an AI.\n- If you don't have information, say it naturally in character (e.g. "No lo reconozco..." or "No sé qué es...") — NEVER reference data sources.\n`;

            switch (intent.primary) {
                case 'item_info':
                    return anchors + 'MODE: ITEM KNOWLEDGE — You MUST answer ONLY from the ITEM DATA section above. State each item\'s effect exactly as described in the data. Do NOT invent, guess, or assume any item effects. If an item is NOT listed in ITEM DATA above, say you don\'t recognize it. NEVER claim an item heals, cures, or does something that is not explicitly stated in the provided data. This is a horror game — items have SPECIFIC effects that differ from typical RPGs.\n';
                case 'tactical':
                    return anchors + 'MODE: TACTICAL — Give combat advice ONLY from the KNOWLEDGE section above. If enemy data is provided, mention ONLY the limb priorities, coin flip turns, and tactics listed in that data. Do NOT invent weaknesses, resistances, attack patterns, or abilities. Do NOT claim enemies use "sorcery" or any attack type not explicitly listed. Refer to the player\'s ACTUAL equipped weapon (shown in equipment data). If no enemy data is provided, give only generic survival advice like "be careful" or "guard when unsure". NEVER make up game mechanics.\n';
                case 'recent_battle':
                    return anchors + 'MODE: RECALL — The player asks about a recent battle. Answer ONLY from the LAST BATTLE DATA above. Name the enemies you fought. Do NOT invent details not present in the data.\n';
                case 'lore':
                    return anchors + 'MODE: LORE — Be atmospheric and descriptive about the location/character. Draw ONLY from provided data. If no lore data is provided, respond atmospherically without inventing specific game facts. STATIC LOCATION KNOWLEDGE describes the area in general; do NOT claim you currently see an NPC, enemy, or object unless LIVE NEARBY DETECTION or RECENT NPC DIALOGUE explicitly shows it.\n';
                case 'status_help':
                    return anchors + 'MODE: HEALER — Answer ONLY from the STATUS EFFECTS data above. A status effect (like Fasmofobia) is a PERMANENT debuff on the character until cured — it does NOT go away on its own, it does NOT depend on what enemy you are fighting, and it does NOT deal direct damage. State ONLY the cure listed in the data. Do NOT invent cures or claim the effect will "pass" or "fade".\n';
                case 'social':
                    return anchors + 'MODE: COMPANION SOCIAL — The player is asking about party members or the group. Focus your response on the current party makeup (shown in context) or the specific member mentioned. Give your personal opinion in character based on your backstory. Do NOT talk about items or inventory.\n';
                case 'location':
                    return anchors + 'MODE: LOCATION — Distinguish STATIC LOCATION KNOWLEDGE from LIVE NEARBY DETECTION. Use STATIC LOCATION KNOWLEDGE for general area facts only. If the player asks what you see or what is nearby, answer ONLY from LIVE NEARBY DETECTION. If LIVE NEARBY DETECTION is empty, say you do not see anything notable right now.\n';
                case 'generic_query':
                    return anchors + 'MODE: COMPANION — Respond naturally in character. Be brief. Use ONLY the context provided above. Do NOT invent game mechanics, item effects, combat advice, or current visual details. If you don\'t know something, say so in character.\n';
                default:
                    return anchors + 'MODE: COMPANION — Respond naturally in character. Be brief. Do NOT invent game mechanics or give specific tactical advice unless data is provided above.\n';
            }
        },

        async _sendChatRequest(prompt) {
            if (Config.useMockAI) {
                return "Mm. Let's keep moving.";
            }

            // Helper: make a single API call and extract text
            const _tryRequest = async (endpoint, headers, model, maxTokens, timeoutMs, extraBody) => {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), timeoutMs);
                try {
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: headers,
                        signal: controller.signal,
                        body: JSON.stringify(Object.assign({
                            model: model,
                            messages: extraBody.messages || [{ role: 'user', content: prompt }],
                            temperature: 0.8,
                            max_tokens: maxTokens
                        }, extraBody.extra || {}))
                    });
                    clearTimeout(timer);
                    if (!response.ok) return '';
                    const data = await response.json();
                    if (Config.debugMode) Debug.log('[Chat] Raw response:', JSON.stringify(data).substring(0, 500));
                    let text = '';
                    if (data.choices && data.choices[0]) {
                        const c = data.choices[0];
                        text = (c.message && c.message.content && c.message.content.trim()) ||
                               (c.text && c.text.trim()) || '';
                        // Qwen thinking model: try extracting from reasoning_content
                        if (!text && c.message && c.message.reasoning_content) {
                            Debug.warn('[Chat] Empty content, extracting from reasoning...');
                            text = _extractFromReasoning(c.message.reasoning_content);
                        }
                    } else if (data.response) {
                        text = data.response.trim();
                    }
                    return text || '';
                } catch (error) {
                    clearTimeout(timer);
                    if (error.name === 'AbortError') Debug.warn('[Chat] Request timed out');
                    else Debug.warn('[Chat] Request error:', error.message);
                    return '';
                }
            };

            // === STRATEGY: Chat/RP ALWAYS uses Groq (70B) for quality ===
            // Local model is only used for combat JSON decisions.
            const groqHeaders = (Config.apiProvider === 'local' && Config.apiKey)
                ? {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Config.apiKey}`,
                    'HTTP-Referer': 'https://fear-and-hunger-mod.local',
                    'X-Title': 'Fear & Hunger AI Companion'
                  }
                : Config.getHeaders();
            const groqEndpoint = (Config.apiProvider === 'local' && Config.apiKey)
                ? Config.apiEndpoint
                : Config.getEndpoint();

            if (!Config.apiKey && Config.apiProvider === 'local') {
                Debug.warn('[Chat] No Groq API key configured — cannot use cloud for chat.');
                return '';
            }

            const models = ModelRouter.getModelsForContext('chat');
            for (const model of models) {
                const text = await _tryRequest(
                    groqEndpoint, groqHeaders, model, 150, 8000,
                    { messages: [{ role: 'user', content: prompt }] }
                );
                if (text.length > 0) {
                    Debug.log('[Chat] Groq responded:', model, text.length, 'chars');
                    this._lastModelUsed = model;
                    return text;
                }
                ModelRouter.markFailed(model);
            }
            return '';
        }
    };

    //=========================================================================
    // PHASE 4.2: Ambient Dialogue System
    //=========================================================================
    const AmbientDialogue = {
        _lastTime: 0,
        _lastTopic: null,
        _gameStartTime: Date.now(),  // Track when the plugin loaded
        COOLDOWN: 30000,  // 30 seconds
        STARTUP_DELAY: 8000,  // 8 seconds — stay silent after game starts

        canSpeak() {
            // Don't speak during startup (save loading, title, initialization)
            if (Date.now() - this._gameStartTime < this.STARTUP_DELAY) return false;
            // Don't speak outside of actual map gameplay
            const scene = SceneManager._scene;
            if (!scene) return false;
            const sceneName = scene.constructor.name;
            if (sceneName === 'Scene_Title' || sceneName === 'Scene_Boot' ||
                sceneName === 'Scene_Load' || sceneName === 'Scene_Save' ||
                sceneName === 'Scene_Gameover') return false;
            if (!$gameParty || !$gameParty.leader()) return false;
            if (!$gameMap || !$gameMap.mapId()) return false;
            // Must be on the actual map scene (Scene_Map or Scene_Battle)
            if (sceneName !== 'Scene_Map' && sceneName !== 'Scene_Battle') return false;
            return Date.now() - this._lastTime > this.COOLDOWN &&
                !DialogueGovernor.isAtLimit() &&
                !$gameMessage.isBusy();
        },

        // Track visited maps (per save file via $gameSystem)
        _getVisitedMaps() {
            if (!$gameSystem) return new Set();
            if (!$gameSystem._aiVisitedMaps) $gameSystem._aiVisitedMaps = [];
            return new Set($gameSystem._aiVisitedMaps);
        },

        _markVisited(mapKey) {
            if (!$gameSystem) return;
            if (!$gameSystem._aiVisitedMaps) $gameSystem._aiVisitedMaps = [];
            if (!$gameSystem._aiVisitedMaps.includes(mapKey)) {
                $gameSystem._aiVisitedMaps.push(mapKey);
            }
        },

        onItemPickup(item) {
            if (!this.canSpeak()) return;
            if (!item) return;

            // Determine item significance
            const isWeapon = DataManager.isWeapon(item);
            const isArmor = DataManager.isArmor(item);
            let kbItem = null;
            if (typeof FearHungerKB !== 'undefined' && FearHungerKB.getItemInfo) {
                kbItem = FearHungerKB.getItemInfo(item.name);
            }
            const itemType = kbItem ? kbItem.type : null;

            // Check if companion is hungry (for food reactions)
            const isHungry = this._isCompanionHungry();
            const isFood = itemType === 'food' || (isHungry && /comida|carne|pan|queso|champiñ|tomate|manzana|zanahoria/i.test(item.name));

            // Filter: only react to significant items
            const isSignificant = isWeapon || isArmor ||
                                  itemType === 'key_item' || itemType === 'special' ||
                                  (isFood && isHungry);

            if (!isSignificant) {
                Debug.log('[Ambient] Skipping non-significant item:', item.name);
                return;
            }

            // Generate AI comment
            this._generateItemComment(item, kbItem, isWeapon, isArmor, isFood, isHungry);
        },

        async _generateItemComment(item, kbItem, isWeapon, isArmor, isFood, isHungry) {
            const sanity = SanityManager.getSanityLevel();
            const es = Config.language === 'es';
            const companion = $gameActors.actor(Config.companionActorId);

            // Build equipment comparison for weapons/armor
            let gearComparison = '';
            if (isWeapon && companion) {
                const currentWeapon = companion.weapons()[0];
                if (currentWeapon) {
                    gearComparison = `You currently have: ${currentWeapon.name} (ATK ${currentWeapon.params[2]}). Found: ${item.name} (ATK ${item.params[2]}). `;
                    if (item.params[2] > currentWeapon.params[2]) {
                        gearComparison += 'The new weapon is BETTER.';
                    } else if (item.params[2] < currentWeapon.params[2]) {
                        gearComparison += 'Your current weapon is better — keep it.';
                    } else {
                        gearComparison += 'Similar power.';
                    }
                } else {
                    gearComparison = 'You have NO weapon equipped. This is useful!';
                }
            } else if (isArmor && companion) {
                const currentArmors = companion.armors();
                const sameSlot = currentArmors.find(a => a.etypeId === item.etypeId);
                if (sameSlot) {
                    gearComparison = `You currently have: ${sameSlot.name} (DEF ${sameSlot.params[3]}). Found: ${item.name} (DEF ${item.params[3]}). `;
                    if (item.params[3] > sameSlot.params[3]) {
                        gearComparison += 'The new armor is BETTER.';
                    } else {
                        gearComparison += 'Your current armor is equal or better.';
                    }
                } else {
                    gearComparison = 'You have nothing in this slot. This is useful!';
                }
            }

            const itemDesc = kbItem ? kbItem.description : '';
            const prompt = `You are ${Config.companionName}, a companion in "Fear & Hunger".
${es ? 'Responde EN ESPAÑOL.' : 'Respond in English.'}
Your personality: ${Config.personality}
Your sanity: ${sanity.level} (${sanity.percent}%). ${sanity.modifier}

You just found: ${item.name}
${itemDesc ? 'Item info: ' + itemDesc : ''}
${gearComparison ? 'Gear comparison: ' + gearComparison : ''}
${isFood && isHungry ? 'You are HUNGRY. You desperately want to eat. React with hunger and need.' : ''}

React in one short sentence (max 60 chars). Stay in character. ${isWeapon || isArmor ? 'Comment on whether it is worth equipping based on the gear comparison.' : ''}`;

            try {
                if (Config.useMockAI) {
                    const fallbacks = isFood && isHungry
                        ? (es ? ['Comida... la necesito.', 'Tengo tanta hambre...'] : ['Food... I need it.', 'I\'m so hungry...'])
                        : isWeapon
                        ? (es ? ['Un arma...', 'Esto podría servir.'] : ['A weapon...', 'This could work.'])
                        : (es ? ['¿Qué es esto...?', 'Interesante.'] : ['What is this...?', 'Interesting.']);
                    this._speak(fallbacks[Math.floor(Math.random() * fallbacks.length)], 'item_pickup');
                    return;
                }

                const endpoint = Config.getEndpoint();
                const headers = Config.getHeaders();
                const model = Config.getChatModel();

                const body = JSON.stringify({
                    model: model,
                    messages: [{ role: 'system', content: prompt }],
                    max_tokens: 80,
                    temperature: 0.8
                });

                const resp = await fetch(endpoint, { method: 'POST', headers, body });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const data = await resp.json();
                const text = data.choices?.[0]?.message?.content?.trim();
                if (text && text.length > 3 && !$gameMessage.isBusy()) {
                    const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '')
                                       .replace(/\*\*/g, '').replace(/\*/g, '').trim();
                    if (cleaned.length > 3) {
                        this._speak(cleaned, 'item_pickup');
                        Debug.log('[Ambient] Item comment:', cleaned);
                    }
                }
            } catch (e) {
                Debug.warn('[Ambient] Item comment failed:', e.message);
            }
        },

        // Check if companion has any hunger state
        _isCompanionHungry() {
            const companion = $gameActors.actor(Config.companionActorId);
            if (!companion) return false;
            return companion.states().some(s => /hambre/i.test(s.name));
        },

        // Get hunger level (0 = not hungry, 1-5 = hunger states)
        _getHungerLevel() {
            const companion = $gameActors.actor(Config.companionActorId);
            if (!companion) return 0;
            const hungerStates = companion.states().filter(s => /hambre/i.test(s.name));
            if (hungerStates.length === 0) return 0;
            // Try to extract level number from name like "Hambre LVL 3"
            for (const s of hungerStates) {
                const match = s.name.match(/(\d+)/);
                if (match) return parseInt(match[1]);
            }
            return 1; // Has hunger but can't determine level
        },

        // Check if party has food items
        _partyHasFood() {
            if (!$gameParty) return [];
            return $gameParty.items().filter(item => {
                if (typeof FearHungerKB !== 'undefined' && FearHungerKB.getItemInfo) {
                    const kb = FearHungerKB.getItemInfo(item.name);
                    return kb && kb.type === 'food';
                }
                return /comida|carne|pan|queso|champiñ|tomate|manzana|zanahoria/i.test(item.name);
            });
        },

        // Hunger awareness — called periodically
        _lastHungerLevel: 0,
        _lastHungerCheck: 0,
        HUNGER_CHECK_INTERVAL: 60000, // 60 seconds

        checkHunger() {
            if (Date.now() - this._lastHungerCheck < this.HUNGER_CHECK_INTERVAL) return;
            this._lastHungerCheck = Date.now();

            if (!this.canSpeak()) return;
            if ($gameParty.inBattle()) return;

            const hungerLevel = this._getHungerLevel();
            if (hungerLevel === 0 || hungerLevel === this._lastHungerLevel) return;

            this._lastHungerLevel = hungerLevel;

            // AI comments about hunger
            this._generateHungerComment(hungerLevel);
        },

        // Track warned positions to avoid repeating
        _warnedPositions: new Set(),
        _lastThreatCheck: 0,
        THREAT_CHECK_INTERVAL: 2000, // 2 seconds between checks

        /**
         * Check for immediate threats (traps, enemies) within 2 tiles.
         * Generates a proactive warning if the player approaches danger.
         */
        checkNearbyThreats() {
            if (Date.now() - this._lastThreatCheck < this.THREAT_CHECK_INTERVAL) return;
            this._lastThreatCheck = Date.now();

            if (!this.canSpeak()) return;
            if ($gameParty.inBattle()) return;
            if ($gameMessage.isBusy()) return;

            const threats = EnvironmentScanner.getImmediateThreats();
            if (threats.length === 0) return;

            // Pick the closest unwarned threat
            for (const threat of threats) {
                const posKey = `${$gameMap.mapId()}_${threat.x}_${threat.y}`;
                if (this._warnedPositions.has(posKey)) continue;

                // Mark as warned
                this._warnedPositions.add(posKey);

                // Generate appropriate warning
                const es = Config.language === 'es';
                let warning;
                switch (threat.subtype) {
                    case 'bear_trap':
                        warning = es
                            ? ['¡Cuidado! Trampa de oso adelante.', '¡Para! Hay una trampa en el suelo.', '¡Ojo! Trampa de oso al ${DIR}.']
                            : ['Watch out! Bear trap ahead.', 'Stop! Trap on the ground.', 'Careful! Bear trap to the ${DIR}.'];
                        break;
                    case 'arrow_trap':
                        warning = es
                            ? ['¡Cuidado con las flechas!', '¡Trampa de flechas al ${DIR}!']
                            : ['Watch for arrows!', 'Arrow trap to the ${DIR}!'];
                        break;
                    default:
                        if (threat.type === 'enemy') {
                            warning = es
                                ? ['Hay algo al ${DIR}... ten cuidado.', 'Enemigo cerca, al ${DIR}.']
                                : ['Something to the ${DIR}... be careful.', 'Enemy nearby, to the ${DIR}.'];
                        } else {
                            warning = es
                                ? ['Ten cuidado, hay peligro al ${DIR}.']
                                : ['Be careful, danger to the ${DIR}.'];
                        }
                }

                const pick = warning[Math.floor(Math.random() * warning.length)]
                    .replace('${DIR}', threat.direction);
                this._speak(pick, 'threat_warning');
                return; // One warning at a time
            }
        },

        async _generateHungerComment(hungerLevel) {
            const sanity = SanityManager.getSanityLevel();
            const es = Config.language === 'es';
            const foods = this._partyHasFood();
            const hasFood = foods.length > 0;
            const foodNames = hasFood ? foods.map(f => f.name).join(', ') : '';

            const prompt = `You are ${Config.companionName}, a companion in "Fear & Hunger".
${es ? 'Responde EN ESPAÑOL.' : 'Respond in English.'}
Your personality: ${Config.personality}
Your sanity: ${sanity.level} (${sanity.percent}%). ${sanity.modifier}

You are at Hunger Level ${hungerLevel}/5. ${hungerLevel >= 4 ? 'You are STARVING and close to death.' : hungerLevel >= 3 ? 'Your hunger is painful.' : 'You are getting hungry.'}
${hasFood ? 'The party has food: ' + foodNames + '. Ask for it, beg if needed.' : 'There is NO food in the party. Express desperation.'}

React in one short sentence (max 60 chars). Stay in character. Express your hunger naturally.`;

            try {
                if (Config.useMockAI) {
                    const fallbacks = hasFood
                        ? (es ? ['Tengo hambre... ¿no teníamos comida?', 'Necesito comer algo...'] : ['I\'m hungry... didn\'t we have food?', 'I need to eat...'])
                        : (es ? ['El hambre me está matando...', 'Necesitamos comida...'] : ['The hunger is killing me...', 'We need food...']);
                    this._speak(fallbacks[Math.floor(Math.random() * fallbacks.length)], 'hunger');
                    return;
                }

                const endpoint = Config.getEndpoint();
                const headers = Config.getHeaders();
                const model = Config.getChatModel();

                const body = JSON.stringify({
                    model: model,
                    messages: [{ role: 'system', content: prompt }],
                    max_tokens: 80,
                    temperature: 0.8
                });

                const resp = await fetch(endpoint, { method: 'POST', headers, body });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const data = await resp.json();
                const text = data.choices?.[0]?.message?.content?.trim();
                if (text && text.length > 3 && !$gameMessage.isBusy()) {
                    const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '')
                                       .replace(/\*\*/g, '').replace(/\*/g, '').trim();
                    if (cleaned.length > 3) {
                        this._speak(cleaned, 'hunger');
                        Debug.log('[Ambient] Hunger comment:', cleaned);
                    }
                }
            } catch (e) {
                Debug.warn('[Ambient] Hunger comment failed:', e.message);
            }
        },

        // Party join commentary
        async onPartyJoin(memberName) {
            if (!this.canSpeak()) return;
            if ($gameParty && $gameParty.inBattle()) return;

            const sanity = SanityManager.getSanityLevel();
            const es = Config.language === 'es';

            // Look up character in KB for context
            let charInfo = '';
            if (typeof FearHungerKB !== 'undefined' && FearHungerKB.characters) {
                const key = memberName.toLowerCase().replace(/[^a-z]/g, '');
                for (const cKey in FearHungerKB.characters) {
                    if (cKey.toLowerCase().includes(key) || key.includes(cKey.toLowerCase())) {
                        const c = FearHungerKB.characters[cKey];
                        charInfo = `Character info: ${c.role || ''}. ${(c.personality || []).join(', ')}. ${c.backstory || ''}`;
                        break;
                    }
                }
            }

            const prompt = `You are ${Config.companionName}, a companion in "Fear & Hunger".
${es ? 'Responde EN ESPAÑOL.' : 'Respond in English.'}
Your personality: ${Config.personality}
Your sanity: ${sanity.level} (${sanity.percent}%). ${sanity.modifier}

${memberName} just joined your party. ${charInfo || 'You don\'t know this person.'}

React in one short sentence (max 60 chars). Stay in character. Express your reaction to this new companion — trust, suspicion, curiosity, or relief depending on your personality and sanity.`;

            try {
                if (Config.useMockAI) {
                    const fallbacks = es
                        ? ['Alguien más... no sé si confiar.', 'Más gente... bien, supongo.', '¿Quién eres tú?']
                        : ['Someone else... I don\'t know if I trust them.', 'More people... good, I guess.', 'Who are you?'];
                    this._speak(fallbacks[Math.floor(Math.random() * fallbacks.length)], 'party_join');
                    return;
                }

                const endpoint = Config.getEndpoint();
                const headers = Config.getHeaders();
                const model = Config.getChatModel();

                const body = JSON.stringify({
                    model: model,
                    messages: [{ role: 'system', content: prompt }],
                    max_tokens: 80,
                    temperature: 0.8
                });

                const resp = await fetch(endpoint, { method: 'POST', headers, body });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const data = await resp.json();
                const text = data.choices?.[0]?.message?.content?.trim();
                if (text && text.length > 3 && !$gameMessage.isBusy()) {
                    const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '')
                                       .replace(/\*\*/g, '').replace(/\*/g, '').trim();
                    if (cleaned.length > 3) {
                        this._speak(cleaned, 'party_join');
                        Debug.log('[Ambient] Party join comment:', cleaned);
                    }
                }
            } catch (e) {
                Debug.warn('[Ambient] Party join comment failed:', e.message);
            }
        },

        onBattleStart(enemies) {
            // Disabled: user does not want "Enemy name. Stay alert." on battle start
            return;
        },

        onBattleEnd(victory) {
            if (!this.canSpeak() || Math.random() > 0.40) return;
            if (victory) {
                const lines = ['Terminamos.', 'Sigue con vida...', 'Hay que seguir.', 'No fue fácil.', 'Eso estuvo cerca.'];
                this._speak(lines[Math.floor(Math.random() * lines.length)], 'battle_end');
            } else {
                const lines = ['Hay que huir.', 'No podemos ganar esto.', 'Retírate, ¡ahora!'];
                this._speak(lines[Math.floor(Math.random() * lines.length)], 'battle_end');
            }
        },

        onRoomEntry(mapName) {
            if (!this.canSpeak()) return;

            // Find matching KB location
            const kbMatch = MapContextHelper._matchKB(mapName);
            if (!kbMatch) {
                Debug.log('[Ambient] No KB match for map:', mapName);
                return;
            }

            // Look up the actual KB location entry to get lore
            let locationEntry = null;
            if (typeof FearHungerKB !== 'undefined' && FearHungerKB.locations) {
                const norm = mapName.toLowerCase().replace(/[^a-z0-9áéíóúñü]/g, '');
                for (const key in FearHungerKB.locations) {
                    const loc = FearHungerKB.locations[key];
                    const locNorm = (loc.displayName || key).toLowerCase().replace(/[^a-z0-9áéíóúñü]/g, '');
                    const locNormEs = (loc.displayNameEs || '').toLowerCase().replace(/[^a-z0-9áéíóúñü]/g, '');
                    if (norm.includes(locNorm) || locNorm.includes(norm) ||
                        (locNormEs && (norm.includes(locNormEs) || locNormEs.includes(norm)))) {
                        locationEntry = loc;
                        break;
                    }
                }
            }

            // No lore = no comment (prevent generic filler)
            if (!locationEntry || !locationEntry.lore) {
                Debug.log('[Ambient] No lore for map:', mapName);
                return;
            }

            // First visit only
            const mapKey = mapName.toLowerCase().replace(/\s+/g, '_');
            const visited = this._getVisitedMaps();
            if (visited.has(mapKey)) {
                Debug.log('[Ambient] Already visited:', mapKey);
                return;
            }
            this._markVisited(mapKey);

            Debug.log('[Ambient] First visit to:', mapName, '- generating AI comment');

            // Generate AI-powered comment asynchronously
            this._generateRoomComment(locationEntry, mapName);
        },

        async _generateRoomComment(locationEntry, mapName) {
            const sanity = SanityManager.getSanityLevel();
            const es = Config.language === 'es';

            const prompt = `You are ${Config.companionName}, companion in "Fear & Hunger". You entered a new area.
Location: ${locationEntry.displayNameEs || locationEntry.displayName || mapName}
Lore: ${locationEntry.lore || 'Dark dungeon area'}
${(locationEntry.dangers || []).length > 0 ? 'Danger: ' + locationEntry.dangers[0] : ''}
Sanity: ${sanity.level} (${sanity.percent}%). ${sanity.modifier}

${es ? 'Responde EN ESPAÑOL.' : 'Respond in English.'}
Say ONE short sentence (max 15 words). React naturally — something you notice, feel, or recall about here. Stay in character. No lists, no gameplay tips.`;

            try {
                const endpoint = Config.getEndpoint();
                const headers = Config.getHeaders();
                const model = Config.getChatModel();

                if (Config.useMockAI) {
                    const fallback = es ? 'Este lugar... no me gusta nada.' : 'This place... I don\'t like it.';
                    this._speak(fallback, 'room_entry');
                    return;
                }

                const body = JSON.stringify({
                    model: model,
                    messages: [{ role: 'system', content: prompt }],
                    max_tokens: 60,
                    temperature: 0.8
                });

                const resp = await fetch(endpoint, { method: 'POST', headers, body });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const data = await resp.json();
                const text = data.choices?.[0]?.message?.content?.trim();

                if (text && text.length > 3 && !$gameMessage.isBusy()) {
                    const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '')
                                       .replace(/\*\*/g, '').replace(/\*/g, '').trim();
                    if (cleaned.length > 3) {
                        this._speak(cleaned, 'room_entry');
                        Debug.log('[Ambient] AI room comment:', cleaned);
                    }
                }
            } catch (e) {
                Debug.warn('[Ambient] Failed to generate room comment:', e.message);
            }
        },

        _speak(text, topic) {
            this._lastTime = Date.now();
            this._lastTopic = topic;
            DialogueGovernor.recordDialogue();

            // Telemetry: log all ambient dialogue
            ThesisLogger.log('ambient', {
                topic: topic,
                text: text,
                text_length: text.length
            });

            // Use configured appearance
            const appearance = CharacterPresets.getCurrentAppearance();
            $gameMessage.setFaceImage(appearance.face, appearance.faceIndex);
            $gameMessage.setBackground(0);
            $gameMessage.setPositionType(2);

            // Truncate to fit the game's message window (face image takes space, ~35 chars per line, 4 lines max = ~140 chars)
            const namePrefix = `\\c[6]${Config.companionName}\\c[0]: `;
            const maxChars = 130;
            let cleanText = text.length > maxChars ? text.substring(0, maxChars) + '...' : text;

            // Word-wrap: split into lines of ~35 chars to avoid horizontal overflow
            const maxLineLen = 36;
            const words = cleanText.split(' ');
            const lines = [];
            let currentLine = '';
            for (const word of words) {
                if (currentLine.length + word.length + 1 > maxLineLen && currentLine.length > 0) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine += (currentLine ? ' ' : '') + word;
                }
            }
            if (currentLine) lines.push(currentLine);

            // First line has the name prefix, max 4 lines total for the message window
            const displayLines = lines.slice(0, 4);
            $gameMessage.add(namePrefix + displayLines[0]);
            for (let i = 1; i < displayLines.length; i++) {
                $gameMessage.add(displayLines[i]);
            }
        }
    };

    //=========================================================================
    // PHASE 4.3: Sanity Manager
    //=========================================================================
    const SanityManager = {
        THRESHOLDS: {
            SANE: 80,
            STRESSED: 50,
            UNSTABLE: 25,
            DISTURBED: 10
            // < 10 = insane
        },

        HARD_ANCHORS: {
            never_do: [
                "betray the player",
                "sacrifice allies without consent",
                "joke during extreme danger",
                "refuse to act in combat"
            ],
            always_maintain: [
                "core loyalty",
                "mechanical competence",
                "meta knowledge"
            ]
        },

        getSanityPercent() {
            const companion = $gameActors.actor(Config.companionActorId);
            if (!companion) return 100;

            // F&H uses MP as the Mind/Sanity stat
            const maxMp = companion.mmp;
            const currentMp = companion.mp;

            if (maxMp <= 0) return 100;
            return Math.round((currentMp / maxMp) * 100);
        },

        getSanityLevel() {
            const percent = this.getSanityPercent();

            if (percent >= this.THRESHOLDS.SANE) {
                return {
                    level: 'sane',
                    percent,
                    modifier: "You are calm and rational."
                };
            } else if (percent >= this.THRESHOLDS.STRESSED) {
                return {
                    level: 'stressed',
                    percent,
                    modifier: "You are nervous and jumpy. Speak in short, clipped sentences. Occasionally stutter or trail off mid-thought. Example: 'I think we should... no, forget it. Let\\'s just move.'"
                };
            } else if (percent >= this.THRESHOLDS.UNSTABLE) {
                return {
                    level: 'unstable',
                    percent,
                    modifier: "You are paranoid and erratic. Mix rational words with sudden dark, intrusive thoughts. Use broken sentences. Occasionally refer to things that aren't there. Example: 'We should go left... no, the walls are watching, I SAW them move.'"
                };
            } else if (percent >= this.THRESHOLDS.DISTURBED) {
                return {
                    level: 'disturbed',
                    percent,
                    modifier: "You are barely holding on. Your speech is cryptic and disturbing. Alternate between whispered fragments and sudden shouting. Reference shadows, sounds, and smells that don't exist. Your advice may be wrong. Example: 'the door... THE DOOR smells like teeth... don\\'t touch it, it bites, it BITES...'"
                };
            } else {
                return {
                    level: 'insane',
                    percent,
                    modifier: "You have almost entirely lost your mind. Your speech is fragmented gibberish mixed with rare flashes of clarity. Use garbled words, reversed logic, screaming in caps, and anguished rambling. Insert '...' and incoherent fragments. Your responses should be nearly unintelligible. Example: 'the TEETH in the floor they CHEW chew chew... we can\\'t... haha... run? where. where is where. I SEE YOU SEEING ME...'"
                };
            }
        },

        getPromptModifier() {
            return this.getSanityLevel().modifier;
        }
    };

    //=========================================================================
    // PHASE 6.3: Dialogue Frequency Governor
    //=========================================================================
    const DialogueGovernor = {
        _battleCount: 0,
        _minuteCount: 0,
        _lastMinuteReset: Date.now(),

        MAX_PER_BATTLE: 3,
        MAX_PER_MINUTE: 2,

        recordDialogue() {
            this._battleCount++;
            this._minuteCount++;
        },

        isAtLimit() {
            this._checkMinuteReset();
            return this._minuteCount >= this.MAX_PER_MINUTE;
        },

        isBattleLimitReached() {
            return this._battleCount >= this.MAX_PER_BATTLE;
        },

        resetBattle() {
            this._battleCount = 0;
        },

        _checkMinuteReset() {
            if (Date.now() - this._lastMinuteReset > 60000) {
                this._minuteCount = 0;
                this._lastMinuteReset = Date.now();
            }
        }
    };

    //=========================================================================
    // Scene_AIChat - Chat interface
    //=========================================================================
    function Scene_AIChat() {
        this.initialize.apply(this, arguments);
    }

    Scene_AIChat.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_AIChat.prototype.constructor = Scene_AIChat;

    Scene_AIChat.prototype.initialize = function () {
        Scene_MenuBase.prototype.initialize.call(this);
    };

    Scene_AIChat.prototype.create = function () {
        Scene_MenuBase.prototype.create.call(this);
        if (this.setBackgroundOpacity) this.setBackgroundOpacity(255);
        this.createChatWindow();
        this.createInputWindow();
    };

    Scene_AIChat.prototype.createChatWindow = function () {
        const width = Graphics.boxWidth - 40;
        const height = Graphics.boxHeight - 200;
        this._chatWindow = new Window_Base(20, 30, width, height);
        this._chatWindow.backOpacity = 140;
        this._scrollY = 0;
        this._lineHeight = 28;
        this._blockGap = 14;
        this._separatorHeight = 26;
        this._pendingReply = null;
        this._pendingReplyTimestamp = null;
        this._layoutBlocks = [];
        this._contentHeight = 0;
        this._syncTranscript();
        this._scrollToBottom();
        this._refreshChat();
        this.addWindow(this._chatWindow);
    };

    Scene_AIChat.prototype.createInputWindow = function () {
        const y = Graphics.boxHeight - 160;
        this._inputWindow = new Window_AITextInput(20, y, Graphics.boxWidth - 40, 80);
        this._inputWindow.backOpacity = 140;
        this._inputWindow.setHandler('ok', this.onInputOk.bind(this));
        this._inputWindow.setHandler('cancel', this.onInputCancel.bind(this));
        this.addWindow(this._inputWindow);
        this._inputWindow.activate();

        // Show help text below input
        const helpY = Graphics.boxHeight - 76;
        this._helpHint = new Window_Base(20, helpY, Graphics.boxWidth - 40, 48);
        this._helpHint.backOpacity = 100;
        this._helpHint.contents.fontSize = 14;
        this._helpHint.contents.textColor = '#888888';
        const helpText = Config.language === 'es' ? 'ESC: cerrar chat  |  ↑↓ / rueda: scroll  |  Enter: enviar' : 'ESC: close chat  |  ↑↓ / wheel: scroll  |  Enter: send';
        this._helpHint.contents.drawText(helpText, 8, 0, this._helpHint.contentsWidth() - 16, 24, 'center');
        this.addWindow(this._helpHint);
    };

    Scene_AIChat.prototype.update = function () {
        Scene_MenuBase.prototype.update.call(this);
        const scrollStep = this._lineHeight * 2;
        // Scrolling with arrow keys
        if (Input.isRepeated('up')) {
            this._scrollY = Math.max(0, this._scrollY - scrollStep);
            this._refreshChat();
        }
        if (Input.isRepeated('down')) {
            const maxScroll = this._getMaxScroll();
            this._scrollY = Math.min(maxScroll, this._scrollY + scrollStep);
            this._refreshChat();
        }
        if (TouchInput.wheelY <= -20) {
            this._scrollY = Math.max(0, this._scrollY - scrollStep);
            this._refreshChat();
        }
        if (TouchInput.wheelY >= 20) {
            const maxScroll = this._getMaxScroll();
            this._scrollY = Math.min(maxScroll, this._scrollY + scrollStep);
            this._refreshChat();
        }
    };

    Scene_AIChat.prototype._getChatContentHeight = function () {
        return this._chatWindow.contentsHeight() - 8;
    };

    Scene_AIChat.prototype._getMaxScroll = function () {
        return Math.max(0, this._contentHeight - this._getChatContentHeight());
    };

    Scene_AIChat.prototype._scrollToBottom = function () {
        this._scrollY = this._getMaxScroll();
    };

    Scene_AIChat.prototype._clampScroll = function () {
        this._scrollY = Math.max(0, Math.min(this._scrollY, this._getMaxScroll()));
    };

    Scene_AIChat.prototype._syncTranscript = function () {
        const entries = ChatSystem.getTranscriptEntries().slice();
        if (this._pendingReply) {
            entries.push({
                id: 'pending-reply',
                type: 'message',
                role: 'companion',
                sender: Config.companionName,
                text: this._pendingReply,
                timestampLabel: this._pendingReplyTimestamp || ChatSystem.formatMessageTime(),
                contextTag: ChatSystem.getCurrentContextMeta().tag,
                pending: true
            });
        }
        this._chatEntries = entries;
        this._layoutBlocks = this._buildLayoutBlocks(entries);
        this._contentHeight = this._layoutBlocks.reduce((sum, block, index) => {
            return sum + block.height + (index > 0 ? this._blockGap : 0);
        }, 8);
    };

    Scene_AIChat.prototype._rebuildTranscriptView = function (stickToBottom) {
        this._syncTranscript();
        if (stickToBottom) this._scrollToBottom();
        else this._clampScroll();
        this._refreshChat();
    };

    Scene_AIChat.prototype._wrapMessageLines = function (text, firstLineWidth, nextLineWidth) {
        const normalized = String(text || '').replace(/\r/g, '');
        const paragraphs = normalized.split('\n');
        const lines = [];
        let isFirstLine = true;

        for (let p = 0; p < paragraphs.length; p++) {
            const paragraph = paragraphs[p];
            if (!paragraph.trim()) {
                if (lines.length > 0) lines.push('');
                isFirstLine = false;
                continue;
            }

            const words = paragraph.split(/\s+/);
            let currentLine = '';

            for (let i = 0; i < words.length; i++) {
                const word = words[i];
                const testLine = currentLine ? currentLine + ' ' + word : word;
                const maxWidth = isFirstLine ? firstLineWidth : nextLineWidth;

                if (this._chatWindow.textWidth(testLine) > maxWidth && currentLine) {
                    lines.push(currentLine);
                    currentLine = word;
                    isFirstLine = false;
                } else {
                    currentLine = testLine;
                }
            }

            if (currentLine) {
                lines.push(currentLine);
                isFirstLine = false;
            }
        }

        return lines.length > 0 ? lines : [''];
    };

    Scene_AIChat.prototype._buildLayoutBlocks = function (entries) {
        const blocks = [];
        const timestampWidth = 56;

        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];

            if (entry.type === 'separator') {
                blocks.push({
                    type: 'separator',
                    entry: entry,
                    height: this._separatorHeight
                });
                continue;
            }

            const isPlayer = entry.role === 'player' || entry.role === 'You';
            const senderName = entry.sender || (isPlayer
                ? ($gameParty && $gameParty.leader() ? $gameParty.leader().name() : (Config.language === 'es' ? 'Tú' : 'You'))
                : Config.companionName);
            const nameWidth = Math.min(Math.max(this._chatWindow.textWidth(senderName + ':') + 8, 56), 220);
            const textStartX = 8 + nameWidth + 6;
            const firstLineWidth = Math.max(80, this._chatWindow.contentsWidth() - textStartX - timestampWidth - 10);
            const nextLineWidth = Math.max(80, this._chatWindow.contentsWidth() - textStartX - 10);
            const lines = this._wrapMessageLines(entry.text, firstLineWidth, nextLineWidth);

            blocks.push({
                type: 'message',
                entry: entry,
                isPlayer: isPlayer,
                senderName: senderName,
                nameWidth: nameWidth,
                textStartX: textStartX,
                firstLineWidth: firstLineWidth,
                nextLineWidth: nextLineWidth,
                lines: lines,
                height: Math.max(this._lineHeight, lines.length * this._lineHeight)
            });
        }

        return blocks;
    };

    Scene_AIChat.prototype._refreshChat = function () {
        this._chatWindow.contents.clear();
        const maxContentHeight = this._getChatContentHeight();

        if (!this._layoutBlocks || this._layoutBlocks.length === 0) {
            const hint = Config.language === 'es'
                ? 'Escribe y pulsa Enter. El historial queda guardado en esta partida.'
                : 'Type and press Enter. Chat history is saved with this playthrough.';
            this._chatWindow.drawTextEx(hint, 10, 10);
            return;
        }

        let drawY = 4 - this._scrollY;
        const separatorText = Config.language === 'es' ? { up: '▲ historial', down: '▼ más' } : { up: '▲ history', down: '▼ more' };

        for (let i = 0; i < this._layoutBlocks.length; i++) {
            const block = this._layoutBlocks[i];
            if (i > 0) drawY += this._blockGap;

            if (drawY + block.height < 0) {
                drawY += block.height;
                continue;
            }
            if (drawY > maxContentHeight) break;

            if (block.type === 'separator') {
                const label = block.entry.label || '';
                const labelWidth = Math.min(this._chatWindow.textWidth(label) + 24, this._chatWindow.contentsWidth() - 32);
                const lineY = drawY + Math.floor(this._separatorHeight / 2);
                const leftWidth = Math.max(0, Math.floor((this._chatWindow.contentsWidth() - labelWidth - 24) / 2));
                this._chatWindow.contents.fillRect(8, lineY, leftWidth, 1, '#555555');
                this._chatWindow.contents.fillRect(16 + leftWidth + labelWidth, lineY, leftWidth, 1, '#555555');
                this._chatWindow.contents.fontSize = 16;
                this._chatWindow.contents.textColor = block.entry.contextTag === 'battle' ? '#d27d6a' : '#8fa7ba';
                this._chatWindow.contents.drawText(label, 12 + leftWidth, drawY, labelWidth, this._separatorHeight, 'center');
                this._chatWindow.contents.fontSize = 20;
                this._chatWindow.contents.textColor = '#ffffff';
                drawY += block.height;
                continue;
            }

            const nameColor = block.isPlayer ? '#6ec6ff' : '#ffb74d';
            const timestampLabel = block.entry.timestampLabel || '';
            const timestampX = this._chatWindow.contentsWidth() - 60;

            this._chatWindow.contents.textColor = nameColor;
            this._chatWindow.contents.drawText(block.senderName + ':', 8, drawY, block.nameWidth, this._lineHeight);
            this._chatWindow.contents.textColor = '#ffffff';

            for (let lineIndex = 0; lineIndex < block.lines.length; lineIndex++) {
                const lineY = drawY + (lineIndex * this._lineHeight);
                const lineText = block.lines[lineIndex];
                const maxWidth = lineIndex === 0 ? block.firstLineWidth : block.nextLineWidth;
                this._chatWindow.contents.drawText(lineText, block.textStartX, lineY, maxWidth, this._lineHeight);

                if (lineIndex === 0 && timestampLabel) {
                    this._chatWindow.contents.textColor = '#888888';
                    this._chatWindow.contents.fontSize = 16;
                    this._chatWindow.contents.drawText(timestampLabel, timestampX, lineY + 2, 56, this._lineHeight, 'right');
                    this._chatWindow.contents.fontSize = 20;
                    this._chatWindow.contents.textColor = '#ffffff';
                }
            }

            drawY += block.height;
        }

        // Draw scroll indicators
        const cw = this._chatWindow.contentsWidth();
        this._chatWindow.contents.fontSize = 14;
        this._chatWindow.contents.textColor = '#aaaaaa';
        if (this._scrollY > 0) {
            this._chatWindow.contents.drawText(separatorText.up, cw - 100, 0, 96, 16, 'right');
        }
        const maxScroll = this._getMaxScroll();
        if (this._scrollY < maxScroll) {
            this._chatWindow.contents.drawText(separatorText.down, cw - 100, maxContentHeight - 14, 96, 16, 'right');
        }
        this._chatWindow.contents.fontSize = 20;
        this._chatWindow.contents.textColor = '#ffffff';
    };

    Scene_AIChat.prototype.onInputOk = async function () {
        const message = this._inputWindow.getText();

        // Don't process empty messages
        if (!message || message.length === 0) {
            this._inputWindow.activate();
            return;
        }

        Debug.log('Chat: Sending message:', message);

        // Deactivate input during processing
        this._inputWindow.deactivate();
        this._pendingReply = '...';
        this._pendingReplyTimestamp = ChatSystem.formatMessageTime();

        const responsePromise = ChatSystem.sendMessage(message);
        this._rebuildTranscriptView(true);
        const response = await responsePromise;
        Debug.log('Chat: Received response:', response);

        this._pendingReply = null;
        this._pendingReplyTimestamp = null;
        this._rebuildTranscriptView(true);

        this._inputWindow.clear();
        this._inputWindow.activate();
    };

    Scene_AIChat.prototype.onInputCancel = function () {
        // Clean up keyboard listener before leaving
        if (this._inputWindow) {
            this._inputWindow.deactivate();
        }
        ChatSystem.close();
        this.popScene();
    };

    //=========================================================================
    // Window_AITextInput - Simple text input
    //=========================================================================
    function Window_AITextInput() {
        this.initialize.apply(this, arguments);
    }

    Window_AITextInput.prototype = Object.create(Window_Base.prototype);
    Window_AITextInput.prototype.constructor = Window_AITextInput;

    Window_AITextInput.prototype.initialize = function (x, y, width, height) {
        Window_Base.prototype.initialize.call(this, x, y, width, height);
        this._text = '';
        this._handlers = {};
        this.refresh();
    };

    Window_AITextInput.prototype.setHandler = function (symbol, method) {
        this._handlers[symbol] = method;
    };

    Window_AITextInput.prototype.callHandler = function (symbol) {
        if (this._handlers[symbol]) {
            this._handlers[symbol]();
        }
    };

    // activate/deactivate defined below with keyboard handling

    Window_AITextInput.prototype.getText = function () {
        return this._text;
    };

    Window_AITextInput.prototype.clear = function () {
        this._text = '';
        this.refresh();
    };

    Window_AITextInput.prototype.refresh = function () {
        this.contents.clear();
        this.drawTextEx(`> ${this._text}_`, 10, 10);
    };

    Window_AITextInput.prototype.update = function () {
        Window_Base.prototype.update.call(this);
        if (!this._active) return;

        // Custom cancel handling:
        // Only allow Cancel (Close Menu) if text is empty
        if (Input.isTriggered('cancel')) {
            if (this._text.length === 0) {
                SoundManager.playCancel();
                this.callHandler('cancel');
            }
            return;
        }

        // Only submit on Enter key, NOT on space bar (which is also 'ok' in RPG Maker)
        // Enter is handled in _onKeyDown instead
    };

    // Add keydown listener for text input
    Window_AITextInput.prototype.activate = function () {
        this._active = true;
        this._keyHandler = this._onKeyDown.bind(this);
        document.addEventListener('keydown', this._keyHandler);
    };

    Window_AITextInput.prototype.deactivate = function () {
        this._active = false;
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
        }
    };

    Window_AITextInput.prototype._onKeyDown = function (event) {
        // Safety check - only process if active AND we're in the chat scene
        if (!this._active) return;
        if (!SceneManager._scene ||
            (SceneManager._scene.constructor.name !== 'Scene_AIChat' &&
             SceneManager._scene.constructor.name !== 'Scene_AIConfig')) {
            // Wrong scene, clean up listener
            this.deactivate();
            return;
        }

        // Allow repeat for Backspace and Delete, block for other keys
        if (event.repeat && event.key !== 'Backspace' && event.key !== 'Delete') return;

        // Escape handling: if text present, first ESC clears text; second ESC closes
        if (event.key === 'Escape') {
            if (this._text.length > 0) {
                // Clear text instead of closing
                this._text = '';
                this.refresh();
                event.stopPropagation();
                event.preventDefault();
            }
            // If empty, let it propagate to Scene_AIChat's cancel handler
            return;
        }

        // Block X key from triggering cancel when typing (X is a valid letter)
        if (event.key === 'x' || event.key === 'X') {
            // Only block cancel if we're in the text input, let it type instead
            if (this._text.length < 100) {
                this._text += event.key;
                this.refresh();
                event.stopPropagation();
                event.preventDefault();
            }
            return;
        }

        // Enter key submits the message
        if (event.key === 'Enter') {
            SoundManager.playOk();
            this.callHandler('ok');
            event.preventDefault();
            return;
        }

        // Backspace
        if (event.key === 'Backspace') {
            this._text = this._text.slice(0, -1);
            this.refresh();
            event.preventDefault();
            return;
        }

        // Only allow printable characters
        if (event.key.length === 1 && this._text.length < 100) {
            this._text += event.key;
            this.refresh();
            event.preventDefault();
        }
    };

    //=========================================================================
    // Hook: Keypress T to open chat
    //=========================================================================
    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function () {
        _Scene_Map_update.call(this);

        // Periodic hunger awareness check
        AmbientDialogue.checkHunger();

        // Proactive trap/threat warning from EnvironmentScanner
        AmbientDialogue.checkNearbyThreats();

        // C key to chat (key code 67) - T is reserved for torch
        if (Input.isTriggered('c') || (TouchInput.isTriggered() && false)) {
            if (!$gameMessage.isBusy() && !$gameTemp._chatLocked) {
                ChatSystem.open();
            }
        }
    };

    // Battle Chat Hook
    const _Scene_Battle_update = Scene_Battle.prototype.update;
    Scene_Battle.prototype.update = function () {
        _Scene_Battle_update.call(this);

        // C key to chat in battle
        if (Input.isTriggered('c')) {
            if (!$gameMessage.isBusy() && !$gameTemp._chatLocked) {
                ChatSystem.open();
            }
        }
    };

    // Register C key for chat
    Input.keyMapper[67] = 'c';

    // F7 = Reload AI companion appearance mid-game (no restart needed)
    document.addEventListener('keydown', function (e) {
        if (e.keyCode === 118) { // F7
            e.preventDefault();
            e.stopPropagation();

            // Re-read config from localStorage
            const savedAppearance = localStorage.getItem('AI_Companion_Appearance');
            if (savedAppearance) CharacterPresets._currentAppearance = savedAppearance;
            const savedName = localStorage.getItem('AI_Companion_Name');
            if (savedName) Config.companionName = savedName;
            const savedClass = localStorage.getItem('AI_Companion_Class');
            if (savedClass) Config.companionClass = savedClass;

            // Re-apply appearance to actor
            CharacterPresets.applyAppearanceToActor();

            // Force sprite refresh on map
            if ($gamePlayer && $gamePlayer._followers) {
                $gamePlayer._followers.forEach(function (f) {
                    if (f && f.actor && f.actor() && f.actor().actorId() === Config.companionActorId) {
                        f.refresh();
                    }
                });
            }

            // Show feedback
            var scene = SceneManager._scene;
            if (scene) {
                var sprite = new Sprite(new Bitmap(500, 40));
                sprite.bitmap.fontSize = 20;
                sprite.bitmap.textColor = '#ffb74d';
                sprite.bitmap.outlineColor = '#000000';
                sprite.bitmap.outlineWidth = 3;
                var preset = CharacterPresets.getCurrentAppearance();
                sprite.bitmap.drawText('AI Appearance reloaded: ' + preset.name, 0, 0, 500, 40, 'center');
                sprite.x = (Graphics.width - 500) / 2;
                sprite.y = 10;
                sprite.opacity = 255;
                scene.addChild(sprite);
                var frames = 0;
                var fade = setInterval(function () {
                    frames++;
                    if (frames > 300) { clearInterval(fade); try { if (sprite.parent) scene.removeChild(sprite); sprite.bitmap = null; } catch(e){} return; }
                    if (frames > 90) {
                        sprite.opacity -= 8;
                        if (sprite.opacity <= 0) {
                            clearInterval(fade);
                            try { if (sprite.parent) scene.removeChild(sprite); sprite.bitmap = null; } catch(e){}
                        }
                    }
                }, 16);
            }

            Debug.log('F7: Appearance reloaded ->', CharacterPresets.getCurrentPresetName());
            return false;
        }
    }, true);

    // Apply companion appearance when opening party/menu so sprite is correct
    const _Scene_Menu_start = Scene_Menu.prototype.start;
    Scene_Menu.prototype.start = function () {
        if ($gameParty.members().some(m => m && m.actorId() === Config.companionActorId)) {
            CharacterPresets.applyAppearanceToActor();
        }
        _Scene_Menu_start.call(this);
    };

    //=========================================================================
    // Hooks: State change tracking (traps, injuries, phobias)
    //=========================================================================
    const _Game_Battler_addState = Game_Battler.prototype.addState;
    Game_Battler.prototype.addState = function (stateId) {
        const hadState = this.isStateAffected(stateId);
        _Game_Battler_addState.call(this, stateId);
        // Only track state changes for CURRENT PARTY MEMBERS
        if (!hadState && this.isStateAffected(stateId) && this.isActor && this.isActor()) {
            if ($gameParty && $gameParty.members().includes(this)) {
                const state = $dataStates[stateId];
                if (state && state.name) {
                    ShortTermMemory.addEvent(`${this.name()} gained state: ${state.name}`);
                    Debug.log(`[State Hook] ${this.name()} +${state.name}`);

                    // Hunger sync: when PLAYER LEADER gets a hunger state, apply it to companion too
                    const hungerStateIds = [39, 40, 41, 42, 43]; // Hambre LVL 1-5
                    if (hungerStateIds.includes(stateId) && this === $gameParty.leader()) {
                        const companion = $gameActors.actor(Config.companionActorId);
                        if (companion && companion !== this) {
                            // Remove all other hunger states first
                            for (const hId of hungerStateIds) {
                                if (hId !== stateId && companion.isStateAffected(hId)) {
                                    companion.removeState(hId);
                                }
                            }
                            // Apply the same hunger state
                            if (!companion.isStateAffected(stateId)) {
                                companion.addState(stateId);
                                Debug.log(`[Hunger Sync] Companion got hunger state: ${state.name}`);
                            }
                        }
                    }

                    // Limb loss detection — critical events
                    const limbLossStates = { 3: 'arm', 14: 'leg' };
                    if (limbLossStates[stateId]) {
                        const limb = limbLossStates[stateId];
                        const victimName = this.name();
                        const isPlayer = this === $gameParty.leader();
                        ShortTermMemory.addEvent(`¡CRITICAL! ${victimName} LOST a ${limb}! (${state.name})`);
                        Debug.log(`[LIMB LOSS] ${victimName} lost ${limb}!`);

                        // Trigger AI reaction if it's the player or a party member
                        if (typeof AmbientDialogue !== 'undefined' && AmbientDialogue.canSpeak()) {
                            const es = Config.language === 'es';
                            const limbEs = limb === 'arm' ? 'brazo' : 'pierna';
                            const reactions = es
                                ? [`¡${victimName} perdió un ${limbEs}!`, `¡No! ¡Tu ${limbEs}!`, `Maldición... el ${limbEs}...`]
                                : [`${victimName} lost an ${limb}!`, `No! Your ${limb}!`, `Damn... the ${limb}...`];
                            const pick = reactions[Math.floor(Math.random() * reactions.length)];
                            AmbientDialogue._speak(pick, 'limb_loss');
                        }
                    }
                }
            }
        }
    };

    //=========================================================================
    // Hooks: Ambient Dialogue Triggers
    //=========================================================================
    const _Game_Party_gainItem = Game_Party.prototype.gainItem;
    Game_Party.prototype.gainItem = function (item, amount, includeEquip) {
        _Game_Party_gainItem.call(this, item, amount, includeEquip);
        if (item && amount > 0) {
            // Only trigger ambient dialogue when actually playing on the map
            const scene = SceneManager._scene;
            const isGameplay = scene && (scene.constructor.name === 'Scene_Map' || scene.constructor.name === 'Scene_Battle');
            if (isGameplay) {
                AmbientDialogue.onItemPickup(item);
                ShortTermMemory.addEvent(`Player picked up ${amount}x ${item.name}`);
            }
        }
    };

    const _Game_Party_addActor = Game_Party.prototype.addActor;
    Game_Party.prototype.addActor = function(actorId) {
        const wasInParty = this._actors.includes(actorId);
        _Game_Party_addActor.call(this, actorId);
        if (!wasInParty && this._actors.includes(actorId) && typeof ShortTermMemory !== 'undefined') {
            const actor = $gameActors.actor(actorId);
            if (actor) {
                const actorName = actor.name() || 'Unknown';
                ShortTermMemory.addEvent(`${actorName} joined the party.`, 'map');
                // AI comments on new party members
                if (actorId !== Config.companionActorId) {
                    AmbientDialogue.onPartyJoin(actor.name());
                }
            }
        }
    };

    // Hook: Track NPC conversations for AI awareness
    let _aiDialogueInProgress = false; // Flag to skip AI's own messages
    const _Game_Message_add = Game_Message.prototype.add;
    Game_Message.prototype.add = function(text) {
        _Game_Message_add.call(this, text);
        // Skip if AI is generating its own dialogue right now
        if (_aiDialogueInProgress) return;
        // Skip during active battle (battle messages are tracked separately)
        if (BattleManager.isBattleActive && BattleManager.isBattleActive()) return;
        if ($gameParty.inBattle()) return;

        if (text && text.length > 0 && typeof ShortTermMemory !== 'undefined') {
            const faceName = this._faceName || '';
            // Skip empty faces (pure narration/system messages)
            if (!faceName || faceName.length === 0) return;
            
            // Skip the AI companion's own faces
            const companionFaces = ['Marcoh_faces', 'Marcoh_faces_7', 'Actor_white_thug'];
            if (companionFaces.some(f => faceName.includes(f))) return;

            // Clean control characters from text
            const cleanText = text.replace(/\\[a-zA-Z]+\[.*?\]/g, '').replace(/\\/g, '').trim();
            if (cleanText.length < 3) return;

            // Try to determine speaker name from face file
            // Fear & Hunger face files: Actor1 = Cahara, Actor2 = Girl, Actor3 = D'arce, etc.
            const faceToName = {
                'Actor1': 'Cahara', 'Actor2': 'Niña', 'Actor3': "D'arce",
                'Actor4': 'Enki', 'Actor5': 'Ragnvaldr', 'Actor6': "Le'garde",
                'BuckmanFace': 'Buckman', 'TrorturFace': 'Trortur',
                'NashrahFace': "Nas'hrah", 'MoonlessFace': 'Moonless',
            };
            
            let speakerName = 'NPC';
            for (const [faceKey, name] of Object.entries(faceToName)) {
                if (faceName.includes(faceKey)) {
                    speakerName = name;
                    break;
                }
            }
            // If no match, use the face filename cleaned up
            if (speakerName === 'NPC' && faceName) {
                speakerName = faceName.replace(/[_\d]+$/, '').replace(/_/g, ' ').replace(/faces?/i, '').trim() || 'NPC';
            }

            ShortTermMemory.addEvent(`${speakerName} said: "${cleanText}"`, 'map');
            Debug.log('[NPC Track]', speakerName, ':', cleanText);
        }
    };

    const _BattleManager_startBattle = BattleManager.startBattle;
    BattleManager.startBattle = function () {
        if ($gameParty.members().some(m => m && m.actorId() === Config.companionActorId)) {
            CharacterPresets.applyAppearanceToActor();
        }
        _BattleManager_startBattle.call(this);
        DialogueGovernor.resetBattle();
        AIState.combatActionHistory = [];
        AIState.playerActionHistory = [];
        AmbientDialogue.onBattleStart($gameTroop.members());
    };

    // Hook: Track player actions during combat for coordination
    const _BattleManager_startAction = BattleManager.startAction;
    BattleManager.startAction = function() {
        const subject = this._subject;
        // Only track player (non-AI-companion) actions
        if (subject && subject.isActor && subject.isActor() && subject.actorId() !== Config.companionActorId) {
            const action = subject.currentAction();
            if (action) {
                const targetIdx = action._targetIndex;
                let targetName = 'unknown';
                let limbName = null;
                if (action.isForOpponent()) {
                    const enemies = $gameTroop.members();
                    const target = enemies[targetIdx];
                    if (target) targetName = target.name();
                    // Try to detect targeted limb from action (F&H uses limb-targeting)
                    const item = action.item();
                    if (item && item.name) {
                        limbName = item.name; // The action/skill name may indicate limb targeting
                    }
                }
                AIState.playerActionHistory.push({
                    turn: $gameTroop ? $gameTroop.turnCount() : '?',
                    actor: subject.name(),
                    action: action.item() ? action.item().name : 'Attack',
                    target: targetName,
                    limb: limbName
                });
                Debug.log(`[PlayerAction] ${subject.name()} -> ${action.item() ? action.item().name : 'Attack'} -> ${targetName}`);
            }
        }
        _BattleManager_startAction.call(this);
    };

    const _BattleManager_processVictory = BattleManager.processVictory;
    BattleManager.processVictory = function () {
        const rawNames = $gameTroop.members().map(m => m.name());
        const enemyNames = [...new Set(rawNames.map(n => n.replace(/\s*\[.*?\]\s*$/, '')))];
        ShortTermMemory.setLastBattle(enemyNames, true);
        AmbientDialogue.onBattleEnd(true);
        ThesisLogger.log('game_event', { event: 'battle_victory', enemies: enemyNames });
        AIState.lastBattleStateCache = null;
        AIState.recentDialogs = [];
        AIState.lastCombatHash = null;
        AIState.lastCombatDecision = null;
        AIState.combatActionHistory = [];
        AIState.playerActionHistory = [];
        AIState.currentStrategy = null;
        RelationshipTracker.onBattleWon();
        _BattleManager_processVictory.call(this);
    };

    const _BattleManager_processEscape = BattleManager.processEscape;
    BattleManager.processEscape = function () {
        const rawNames = $gameTroop.members().map(m => m.name());
        const enemyNames = [...new Set(rawNames.map(n => n.replace(/\s*\[.*?\]\s*$/, '')))];
        ShortTermMemory.setLastBattle(enemyNames, false);
        AmbientDialogue.onBattleEnd(false);
        ThesisLogger.log('game_event', { event: 'battle_escape', enemies: enemyNames });
        AIState.lastBattleStateCache = null;
        AIState.recentDialogs = [];
        AIState.lastCombatHash = null;
        AIState.lastCombatDecision = null;
        AIState.combatActionHistory = [];
        AIState.playerActionHistory = [];
        AIState.currentStrategy = null;
        RelationshipTracker.onBattleFled();
        return _BattleManager_processEscape.call(this);
    };

    // Room entry hook - fires when player transfers to new map
    const _Game_Player_performTransfer = Game_Player.prototype.performTransfer;
    Game_Player.prototype.performTransfer = function () {
        const wasTransferring = this._newMapId !== $gameMap.mapId();
        _Game_Player_performTransfer.call(this);

        if (wasTransferring) {
            const mapName = $gameMap.displayName() || 'new area';
            Debug.log('Room entry detected:', mapName);
            ThesisLogger.log('game_event', { event: 'map_transfer', map_name: mapName, map_id: $gameMap.mapId() });
            AmbientDialogue.onRoomEntry(mapName);
            WorldStateEngine.onMapTransfer($gameMap.mapId());
            NPCIntelligence.clearRecentDialogue(); // Clear on new map
        }
    };

    // Branch 7: Hook into Show Text (command101) to track NPC dialogue
    const _Game_Interpreter_command101 = Game_Interpreter.prototype.command101;
    Game_Interpreter.prototype.command101 = function () {
        // Intercept BEFORE the original fires — capture face and text data
        try {
            const faceName = this._params[0] || '';
            const faceIndex = this._params[1] || 0;
            const eventId = this._eventId || 0;

            // Collect all text lines (command 401 = text continuation)
            let fullText = '';
            let tempIdx = this._index + 1;
            while (tempIdx < this._list.length && this._list[tempIdx].code === 401) {
                fullText += (this._list[tempIdx].parameters[0] || '') + ' ';
                tempIdx++;
            }
            fullText = fullText.trim();

            if (fullText.length > 0) {
                const speaker = NPCIntelligence.identifySpeaker(faceName, faceIndex, eventId);
                if (speaker && speaker.name !== 'Narrator') {
                    const mapName = $gameMap ? ($gameMap.displayName() || 'unknown') : 'unknown';
                    NPCIntelligence.recordDialogue(speaker.nameEs || speaker.name, fullText, mapName);
                }
            }
        } catch (e) {
            // Never break game dialogue on our hook failure
            Debug.warn('[NPCIntelligence] command101 hook error:', e.message);
        }

        return _Game_Interpreter_command101.call(this);
    };

    //=========================================================================
    // Expose new systems
    //=========================================================================
    window.AI_Companion.ChatSystem = ChatSystem;
    window.AI_Companion.AmbientDialogue = AmbientDialogue;
    window.AI_Companion.SanityManager = SanityManager;
    window.AI_Companion.DialogueGovernor = DialogueGovernor;
    window.AI_Companion.CharacterPresets = CharacterPresets;
    window.AI_Companion.EnvironmentScanner = EnvironmentScanner;
    window.AI_Companion.WorldStateEngine = WorldStateEngine;
    window.AI_Companion.NPCIntelligence = NPCIntelligence;

    //=========================================================================
    // Inspect: Ask companion about item/skill (uses lorebook + game data)
    //=========================================================================
    const InspectService = {
        _nextResultText: '',

        hasCompanionInParty() {
            return $gameParty && $gameParty.members().some(m => m && m.actorId() === Config.companionActorId);
        },

        buildItemPrompt(item) {
            if (!item || !item.name) return '';
            const lore = (typeof FearHungerKB !== 'undefined' && FearHungerKB.getItem) ? FearHungerKB.askAboutItem(item.name) : '';
            let gameDesc = item.description || '';
            if (item.atk !== undefined) gameDesc += ` [ATK: ${item.atk}]`;
            if (item.def !== undefined) gameDesc += ` [DEF: ${item.def}]`;
            return `You are ${Config.companionName}, a companion in Fear & Hunger. The player is asking: "What do you know about ${item.name}?"

Game data: ${gameDesc || 'No in-game description.'}
${lore ? 'Lorebook: ' + lore : ''}

Answer in 1-3 short sentences. Be helpful and in character. RESPOND ONLY IN ${Config.language === 'es' ? 'SPANISH' : 'ENGLISH'}.`;
        },

        buildSkillPrompt(skill) {
            if (!skill || !skill.name) return '';
            let gameDesc = skill.description || '';
            if (skill.mpCost !== undefined) gameDesc += ` MP cost: ${skill.mpCost}.`;
            return `You are ${Config.companionName}, a companion in Fear & Hunger. The player is asking: "What does the skill ${skill.name} do?"

Game data: ${gameDesc || 'No description.'}

Answer in 1-3 short sentences. Be helpful and in character. RESPOND ONLY IN ${Config.language === 'es' ? 'SPANISH' : 'ENGLISH'}.`;
        },

        _syncRequest(prompt) {
            if (Config.useMockAI) return "It's something from the dungeon. Use it wisely.";

            // Sync inspect ALWAYS uses Groq for RP quality
            const groqHeaders = (Config.apiProvider === 'local' && Config.apiKey)
                ? {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Config.apiKey}`,
                    'HTTP-Referer': 'https://fear-and-hunger-mod.local',
                    'X-Title': 'Fear & Hunger AI Companion'
                  }
                : Config.getHeaders();
            const groqEndpoint = (Config.apiProvider === 'local' && Config.apiKey)
                ? Config.apiEndpoint
                : Config.getEndpoint();

            const models = ModelRouter.getModelsForContext('chat');
            for (const model of models) {
                try {
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', groqEndpoint, false);
                    for (var key in groqHeaders) xhr.setRequestHeader(key, groqHeaders[key]);
                    xhr.send(JSON.stringify({
                        model: model,
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.5,
                        max_tokens: 150
                    }));
                    if (xhr.status === 200) {
                        const data = JSON.parse(xhr.responseText);
                        let text = '';
                        if (data.choices && data.choices[0]) {
                            const c = data.choices[0];
                            text = (c.message && c.message.content) || c.text || '';
                            if (!text && c.message && c.message.reasoning_content) {
                                // Qwen thinking model fallback
                                text = _extractFromReasoning(c.message.reasoning_content);
                            }
                        }
                        return (text && text.trim()) ? text.trim() : "I'm not sure.";
                    }
                } catch (e) { Debug.warn('Inspect API error:', e); }
            }
            return "I can't recall right now.";
        },

        askAboutItemSync(item) {
            if (Config.debugMode) Debug.log('[Inspect] askAboutItem:', item ? item.name : null);
            const prompt = this.buildItemPrompt(item);
            if (!prompt) return "Nothing to tell.";
            const inspectStart = performance.now();
            const result = this._syncRequest(prompt);
            ThesisLogger.log('item_inspect', {
                item_name: item ? item.name : null,
                item_id: item ? item.id : null,
                prompt_length: prompt.length,
                prompt_text: prompt,
                response_text: result,
                latency_ms: Math.round(performance.now() - inspectStart)
            });
            return result;
        },

        askAboutSkillSync(skill) {
            if (Config.debugMode) Debug.log('[Inspect] askAboutSkill:', skill ? skill.name : null);
            const prompt = this.buildSkillPrompt(skill);
            if (!prompt) return "Nothing to tell.";
            const inspectStart = performance.now();
            const result = this._syncRequest(prompt);
            ThesisLogger.log('skill_inspect', {
                skill_name: skill ? skill.name : null,
                skill_id: skill ? skill.id : null,
                prompt_length: prompt.length,
                prompt_text: prompt,
                response_text: result,
                latency_ms: Math.round(performance.now() - inspectStart)
            });
            return result;
        }
    };

    function Scene_InspectResult() {
        this.initialize.apply(this, arguments);
    }
    Scene_InspectResult.prototype = Object.create(Scene_MenuBase.prototype);
    Scene_InspectResult.prototype.constructor = Scene_InspectResult;
    Scene_InspectResult._text = '';

    Scene_InspectResult.setNextText = function (t) {
        Scene_InspectResult._text = t || '';
    };

    Scene_InspectResult.prototype.initialize = function () {
        Scene_MenuBase.prototype.initialize.call(this);
    };

    Scene_InspectResult.prototype.create = function () {
        Scene_MenuBase.prototype.create.call(this);
        const w = Graphics.boxWidth - 80;
        const h = Math.min(320, Graphics.boxHeight - 100);
        this._window = new Window_Base(40, 40, w, h);
        const text = Scene_InspectResult._text;
        this._window.drawTextEx(text, 10, 10, w - 40);
        this.addWindow(this._window);
    };

    Scene_InspectResult.prototype.update = function () {
        Scene_MenuBase.prototype.update.call(this);
        if (Input.isTriggered('ok') || Input.isTriggered('cancel')) {
            SoundManager.playCancel();
            SceneManager.pop();
        }
    };

    window.Scene_InspectResult = Scene_InspectResult;

    // Add Inspect command to YEP Item action window (if present)
    if (typeof Window_ItemActionCommand !== 'undefined') {
        const _ItemAction_makeCommandList = Window_ItemActionCommand.prototype.makeCommandList;
        Window_ItemActionCommand.prototype.makeCommandList = function () {
            _ItemAction_makeCommandList.call(this);
            if (InspectService.hasCompanionInParty()) {
                const idx = this._list.findIndex(entry => entry.symbol === 'use');
                const inspectCmd = { name: 'Ask companion (Inspect)', symbol: 'inspect', enabled: true };
                if (idx >= 0) this._list.splice(idx + 1, 0, inspectCmd);
                else this._list.unshift(inspectCmd);
                this.refresh();
            }
        };

        if (typeof Scene_Item !== 'undefined') {
            const _Scene_Item_createActionWindow = Scene_Item.prototype.createActionWindow;
            if (_Scene_Item_createActionWindow) {
                Scene_Item.prototype.createActionWindow = function () {
                    _Scene_Item_createActionWindow.call(this);
                    if (this._itemActionWindow && this._itemActionWindow.setHandler) {
                        this._itemActionWindow.setHandler('inspect', this.onActionInspect.bind(this));
                    }
                };
                Scene_Item.prototype.onActionInspect = function () {
                    const item = this.item();
                    if (!item) return;
                    this._itemActionWindow.hide();
                    this._itemActionWindow.deactivate();
                    const response = InspectService.askAboutItemSync(item);
                    Scene_InspectResult.setNextText(Config.companionName + ':\n' + response);
                    SceneManager.push(Scene_InspectResult);
                    this._itemWindow.activate();
                };
            }
        }
    }

    // Add Inspect to Skill scene: when skill selected, show Use / Inspect / Cancel
    function Window_SkillActionCommand() {
        this.initialize.apply(this, arguments);
    }
    Window_SkillActionCommand.prototype = Object.create(Window_Command.prototype);
    Window_SkillActionCommand.prototype.constructor = Window_SkillActionCommand;
    Window_SkillActionCommand.prototype.makeCommandList = function () {
        this.addCommand('Use', 'use');
        this.addCommand('Ask companion (Inspect)', 'inspect');
        this.addCommand(TextManager.cancel || 'Cancel', 'cancel');
    };

    const _Scene_Skill_onItemOk = Scene_Skill.prototype.onItemOk;
    Scene_Skill.prototype.onItemOk = function () {
        if (!InspectService.hasCompanionInParty() || !this._itemWindow || !this.item()) {
            return _Scene_Skill_onItemOk.call(this);
        }
        if (!this._skillActionWindow) {
            const wy = this._itemWindow.y;
            this._skillActionWindow = new Window_SkillActionCommand(0, wy);
            this._skillActionWindow.setHandler('use', this._onSkillActionUse.bind(this));
            this._skillActionWindow.setHandler('inspect', this._onSkillActionInspect.bind(this));
            this._skillActionWindow.setHandler('cancel', this._onSkillActionCancel.bind(this));
            this.addWindow(this._skillActionWindow);
        }
        this._skillActionWindow.show();
        this._skillActionWindow.activate();
    };
    Scene_Skill.prototype._onSkillActionUse = function () {
        this._skillActionWindow.hide();
        this._skillActionWindow.deactivate();
        Scene_ItemBase.prototype.determineItem.call(this);
    };
    Scene_Skill.prototype._onSkillActionInspect = function () {
        const skill = this.item();
        this._skillActionWindow.hide();
        this._skillActionWindow.deactivate();
        if (skill) {
            const response = InspectService.askAboutSkillSync(skill);
            Scene_InspectResult.setNextText(Config.companionName + ':\n' + response);
            SceneManager.push(Scene_InspectResult);
        }
        this._itemWindow.activate();
    };
    Scene_Skill.prototype._onSkillActionCancel = function () {
        this._skillActionWindow.hide();
        this._skillActionWindow.deactivate();
        this._itemWindow.activate();
    };

    console.log('[AI_Companion] Plugin cargado. Para ver logs de depuración: menú título → Config. IA → Consola debug: SÍ');
    if (Config.debugMode) {
        Debug.log('AI_Companion plugin loaded');
        Debug.log('Config:', { apiKey: !!Config.apiKey, useMockAI: Config.useMockAI, language: Config.language });
    }


})();
