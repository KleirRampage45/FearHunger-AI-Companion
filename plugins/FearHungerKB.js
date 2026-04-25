/*:
 * @plugindesc Fear & Hunger Knowledge Base - Comprehensive game data for AI companion
 * @author Asukat
 *
 * @help
 * Provides curated game knowledge for the AI companion including:
 * - All enemies with combat tactics
 * - All bosses with strategies
 * - All items with descriptions and usage
 * - All locations with tips
 * - All NPCs and characters
 * 
 * Data sourced from Fear & Hunger Wiki (fearandhunger.wiki.gg)
 */

var FearHungerKB = FearHungerKB || {};

// ============================================================================
// ENEMIES - Regular encounters
// ============================================================================
FearHungerKB.enemies = {
    // === LEVEL 1-2: EARLY DUNGEON ===
    "guard": {
        displayName: "Guard",
        danger: 3,
        confidence: 0.9,
        location: ["Entrance", "Inner Hall", "Blood Pit"],
        weaknesses: ["slashing"],
        resistances: [],
        limbPriority: ["left arm", "stinger", "torso"],
        limbDetails: {
            right_arm: { hp: 200, attack: "Coin flip → Mad Rush (19-25 x5)", destruction: "Uses Tackle (16-25 blunt) instead. DON'T cut this arm." },
            left_arm: { hp: 200, attack: "Hack (28-42 slash, severs YOUR arm)", destruction: "Removes cleaver attacks" },
            stinger: { hp: 150, attack: "Stinger Thrust (36-54 pierce)", destruction: "Use Leg Sweep to also cut legs" },
            torso: { hp: 500 }
        },
        coinFlipTurn: 2,
        tactics: "Turn 1: destroy cleaver arm (left). Turn 2: GUARD (always coin flip!). Turn 3: Leg Sweep stinger. Then attack torso, guarding on turns 5, 8, 11, 14.",
        strategy: [
            "Turn 1: Attack left arm (cleaver). 250 dmg on hard mode.",
            "Turn 2: GUARD! Always coin flip. Failure = Mad Rush (5 hits, likely death).",
            "Turn 3: Leg Sweep the stinger (also destroys legs).",
            "After: Attack torso. Guard on turns 5, 8, 11, 14 (coin flip every 3 turns).",
            "TIP: Arm Guards accessory protects if you miss Turn 1."
        ],
        hints: ["Cleaver does massive damage", "Guard outfit drops from them", "Disguise lets you pass others", "Guard outfit = 2 Guard skins + Assassin's Handbook"],
        mistakes: ["Don't attack during coin flip turn", "Don't cut right arm - causes Tackle instead", "Never ignore the cleaver arm"],
        drops: ["Loincloth", "Guard skin", "Meat cleaver", "Skeletal arm"]
    },
    "mandibula_dentada": {
        displayName: "Mandíbula Dentada",
        altNames: ["Jagged Jaw", "Mandibula Dentada"],
        danger: 5,
        confidence: 0.8,
        location: ["Entrance", "Inner Hall", "Blood Pit"],
        weaknesses: ["slashing", "fire"],
        resistances: ["blunt"],
        limbPriority: ["head", "torso"],
        limbDetails: {
            head: { hp: 300, attack: "Bite (50-80 pierce, can sever limb)", destruction: "Instant kill on humanoid-type. ALWAYS target first." },
            torso: { hp: 600, attack: "Body slam (30-50 blunt)", destruction: "Kills the creature" },
            left_leg: { hp: 200, attack: "Kick (10-20 blunt)", destruction: "AVOID — destroying legs does NOT significantly weaken it. Waste of damage." },
            right_leg: { hp: 200, attack: "Stomp (10-20 blunt)", destruction: "AVOID — same as left leg, negligible benefit." }
        },
        coinFlipTurn: 3,
        tactics: "Turn 1: Attack HEAD immediately — destroying head = instant kill. Turn 2: Continue head if not dead. Turn 3: GUARD (coin flip). If head survives, switch to torso. NEVER attack legs.",
        strategy: [
            "Priority: HEAD > torso. Legs are a trap — they waste turns.",
            "Turn 1-2: Focus all damage on head. Most efficient path to kill.",
            "Turn 3: GUARD! Coin flip turn — failure = massive bite damage.",
            "If head too tanky, switch to torso after turn 3.",
            "TIP: Fire attacks (Pyromancy) deal bonus damage.",
            "WARNING: Do NOT attack legs. They have low payoff and distract from head/torso."
        ],
        hints: ["Bite can sever your arms", "Fire is very effective", "Head destruction = instant kill", "Legs are a waste of time"],
        mistakes: ["Attacking legs — they don't meaningfully weaken it", "Ignoring the head", "Not guarding on coin flip turns"],
        drops: ["Jawbone", "Teeth"]
    },
    "guard_ballista": {
        displayName: "Guard (Ballista)",
        danger: 4,
        confidence: 0.85,
        location: ["Entrance", "Courtyard"],
        limbPriority: ["torso"],
        coinFlipTurn: null,
        tactics: "High damage ranged enemy. Rush down quickly or flee.",
        hints: ["Can't be encountered normally without triggering alert"],
        mistakes: ["Don't let combat drag on"],
        drops: []
    },
    "elite_guard": {
        displayName: "Elite Guard",
        danger: 4,
        confidence: 0.85,
        location: ["Inner Hall", "Blood Pit"],
        weaknesses: ["slashing"],
        resistances: [],
        limbPriority: ["right arm", "stinger", "left leg", "torso"],
        limbDetails: {
            right_arm: { hp: 250, attack: "Sword slash + Coin flip", destruction: "Removes main damage source" },
            stinger: { hp: 200, attack: "Poison sting (inflicts Poison)", destruction: "Removes poison threat" },
            left_leg: { hp: 150, attack: "Kick", destruction: "Reduces mobility" },
            torso: { hp: 600 }
        },
        coinFlipTurn: 2,
        tactics: "Turn 1: destroy sword arm. Turn 2: GUARD. Then remove stinger to stop poison.",
        hints: ["Has a tail stinger that poisons", "More HP than regular guard", "Guard outfit works on them too", "Morning Star can be stolen from them"],
        mistakes: ["Don't ignore the stinger", "Coin flip is deadly"],
        drops: ["Guard skin", "Morning star (steal)"]
    },
    "priest": {
        displayName: "Priest",
        danger: 2,
        confidence: 0.9,
        location: ["Inner Hall", "Blood Pit", "Thicket"],
        limbPriority: ["right arm", "torso"],
        coinFlipTurn: 3,
        tactics: "Counter-magic stops their coin flip. Otherwise destroy arm first.",
        hints: ["Drops Priest's robe - good disguise", "Uses dark magic", "Cloth fragments from them"],
        mistakes: ["Don't let them cast if you lack counter-magic"],
        drops: ["Priest's robe", "Cloth fragment"]
    },
    "skeleton": {
        displayName: "Skeleton",
        danger: 1,
        confidence: 0.95,
        location: ["Prisons", "Catacombs", "Ma'habre"],
        limbPriority: ["arm", "torso"],
        coinFlipTurn: null,
        tactics: "Counter-magic = instant kill. Otherwise just attack.",
        hints: ["Can be recruited!", "Weak to magic", "Can use most weapons except claymores/spears"],
        mistakes: ["Don't waste resources on them"],
        drops: ["Bone", "Skeletal arm"],
        recruitable: true
    },
    "maneba": {
        displayName: "Maneba",
        danger: 2,
        confidence: 0.9,
        location: ["Caverns", "Mines"],
        limbPriority: ["head"],
        coinFlipTurn: null,
        tactics: "Go straight for the head. Easy fight.",
        hints: ["Low threat", "Head is surprisingly easy to hit"],
        mistakes: ["Don't overthink this one"],
        drops: []
    },
    "jaggedjaw": {
        displayName: "Jaggedjaw",
        danger: 2,
        confidence: 0.85,
        location: ["Caverns", "Mines", "Catacombs"],
        limbPriority: ["head", "torso"],
        coinFlipTurn: null,
        tactics: "Basic creature. Target head for quick kill.",
        hints: ["Often found in groups", "Can inflict bleeding"],
        mistakes: ["Don't get surrounded by multiple"],
        drops: []
    },
    "cavegnome": {
        displayName: "Cavegnome",
        displayNameEs: "Gnomo de las cavernas",
        danger: 1,
        confidence: 0.95,
        location: ["Caverns"],
        limbPriority: ["torso"],
        coinFlipTurn: null,
        tactics: "Very weak. Just attack the torso directly — dies in 1-2 hits. No special strategy needed.",
        hints: ["Very low threat", "Just attack it normally", "Sometimes found near loot"],
        mistakes: ["Don't waste time with guard or buffs — just attack"],
        drops: []
    },
    "iron_bars": {
        displayName: "Iron Bars",
        displayNameEs: "Barras de Hierro",
        altNames: ["Barras de Hierro", "Iron Gate", "Puerta de hierro"],
        danger: 0,
        confidence: 0.95,
        location: ["Various"],
        limbPriority: ["torso"],
        coinFlipTurn: null,
        tactics: "NOT a real enemy — it's a locked gate/obstacle. Just attack it repeatedly to break through. Cannot hurt you.",
        hints: ["Just attack it to break it", "Cannot fight back", "Some require specific items to open instead"],
        mistakes: ["Don't waste healing or buffs on this"],
        drops: []
    },
    "cave_spider": {
        displayName: "Cave Spider",
        danger: 2,
        confidence: 0.85,
        location: ["Caverns", "Mines"],
        weaknesses: ["slashing", "fire"],
        resistances: [],
        limbPriority: ["head", "legs"],
        coinFlipTurn: null,
        tactics: "Can poison via bite. Kill head quickly. White vial or Mix of red+green cures poison.",
        hints: ["Poison is dangerous without antidote", "Fast but fragile", "White vial cures poison"],
        mistakes: ["Don't let poison stack", "Keep antidotes for deeper areas"],
        drops: []
    },
    "lizardman": {
        displayName: "Lizardman",
        danger: 3,
        confidence: 0.85,
        location: ["Thicket", "Deeper Thicket"],
        limbPriority: ["arms", "torso"],
        coinFlipTurn: null,
        tactics: "Tough fighter. Disable arms to reduce damage.",
        hints: ["Drops Spider shield", "Also drops Hard leather armor"],
        mistakes: ["Don't underestimate their damage"],
        drops: ["Spider shield", "Hard leather armor"]
    },
    "lizardmage": {
        displayName: "Lizardmage",
        danger: 3,
        confidence: 0.8,
        location: ["Deeper Thicket"],
        limbPriority: ["head", "arms"],
        coinFlipTurn: null,
        tactics: "Caster enemy. Interrupt with arm destruction or rush.",
        hints: ["Uses magic attacks", "More dangerous than regular lizardman"],
        mistakes: ["Don't let it cast freely"],
        drops: []
    },
    "night_lurch": {
        displayName: "Night Lurch",
        danger: 3,
        confidence: 0.85,
        location: ["Thicket", "Deeper Thicket", "Ma'habre"],
        limbPriority: ["horn", "head"],
        coinFlipTurn: null,
        tactics: "Offer rotten meat via Talk to avoid fight. Otherwise target horn first.",
        hints: ["Can be pacified with rotten meat!", "Horn destruction weakens them"],
        mistakes: ["Don't waste resources fighting if you have meat"],
        drops: ["Rotten meat"]
    },
    "cavedweller": {
        displayName: "Cavedweller",
        danger: 2,
        confidence: 0.9,
        location: ["Caverns", "Mines"],
        limbPriority: ["arms", "torso"],
        coinFlipTurn: null,
        tactics: "Neutral unless provoked. Can be traded with.",
        hints: ["Not hostile by default", "Some are merchants"],
        mistakes: ["Don't attack the merchant ones"],
        drops: []
    },
    "cavedweller_spear": {
        displayName: "Cavedweller (Spear)",
        danger: 3,
        confidence: 0.85,
        location: ["Caverns", "Mines"],
        limbPriority: ["arms", "torso"],
        coinFlipTurn: null,
        tactics: "Spear has reach. Close distance quickly.",
        hints: ["More aggressive than regular cavedweller"],
        mistakes: [],
        drops: []
    },
    "yellow_mage": {
        displayName: "Yellow Mage",
        danger: 4,
        confidence: 0.75,
        location: ["Ma'habre", "Tower of Endless"],
        limbPriority: ["head", "arms"],
        coinFlipTurn: null,
        tactics: "Dangerous caster. Rush or use counter-magic.",
        hints: ["Part of the Yellow Mages faction", "Strong magic attacks"],
        mistakes: ["Don't let them cast"],
        drops: []
    },
    "miner_spectre": {
        displayName: "Miner Spectre",
        danger: 3,
        confidence: 0.8,
        location: ["Mines"],
        limbPriority: ["torso"],
        coinFlipTurn: null,
        tactics: "Ghostly enemy. May need special weapons.",
        hints: ["Haunts the mines", "Spectral damage type"],
        mistakes: [],
        drops: []
    },
    "mumbler": {
        displayName: "Mumbler",
        danger: 2,
        confidence: 0.9,
        location: ["Prisons", "Caverns"],
        limbPriority: ["head", "torso"],
        coinFlipTurn: null,
        tactics: "Weak undead. Easy to dispatch.",
        hints: ["Common in prison areas", "Soul binding can work on them"],
        mistakes: [],
        drops: []
    },
    "mumbler_infected": {
        displayName: "Mumbler (Infected)",
        danger: 3,
        confidence: 0.8,
        location: ["Thicket"],
        limbPriority: ["head", "torso"],
        coinFlipTurn: null,
        tactics: "Infected version is more dangerous. Can spread infection.",
        hints: ["Infection is very bad", "Need green herb to cure"],
        mistakes: ["Don't let infection spread to party"],
        drops: []
    },
    "greater_mumbler": {
        displayName: "Greater Mumbler",
        danger: 4,
        confidence: 0.75,
        location: ["Deeper areas"],
        limbPriority: ["head", "arms", "torso"],
        coinFlipTurn: null,
        tactics: "Stronger mumbler variant. Take seriously.",
        hints: ["Much more HP than regular", "Hits harder too"],
        mistakes: ["Don't treat like regular mumbler"],
        drops: []
    },
    "scarab": {
        displayName: "Scarab",
        danger: 2,
        confidence: 0.85,
        location: ["Catacombs", "Tombs"],
        limbPriority: ["torso"],
        coinFlipTurn: null,
        tactics: "Insect enemy. Quick kills recommended.",
        hints: ["Found near tombs", "Not very threatening alone"],
        mistakes: [],
        drops: []
    },
    "moonless_guard": {
        displayName: "Moonless Guard",
        danger: 4,
        confidence: 0.75,
        location: ["Ma'habre"],
        limbPriority: ["right arm", "torso"],
        coinFlipTurn: 2,
        tactics: "Like a guard but corrupted. Same basic strategy.",
        hints: ["Found in Ma'habre", "Affected by the God of the Depths"],
        mistakes: ["Don't ignore coin flip"],
        drops: ["Guard skin"]
    },
    "bloody_man": {
        displayName: "Bloody Man",
        danger: 3,
        confidence: 0.8,
        location: ["Blood Pit"],
        limbPriority: ["torso"],
        coinFlipTurn: null,
        tactics: "Recovered from torture. Not very strong.",
        hints: ["Tragic enemy", "Found in blood pit area"],
        mistakes: [],
        drops: []
    },
    "body_snatcher": {
        displayName: "Body Snatcher",
        danger: 4,
        confidence: 0.7,
        location: ["Various"],
        limbPriority: ["head", "arms", "torso"],
        coinFlipTurn: null,
        tactics: "Dangerous enemy that wears a trench coat. Very deceptive.",
        hints: ["Drops Trench coat", "Hides its true form"],
        mistakes: ["Don't underestimate based on appearance"],
        drops: ["Trench coat"]
    },
    "lord_of_flies": {
        displayName: "Lord of Flies",
        danger: 4,
        confidence: 0.8,
        location: ["Deeper Thicket", "Void"],
        limbPriority: ["head", "torso"],
        coinFlipTurn: null,
        tactics: "Beast enemy. Drops valuable items.",
        hints: ["Drops Monocle accessory", "Drops Blue herb", "Fur can be used for crafting"],
        mistakes: [],
        drops: ["Monocle", "Blue herb", "Lord of flies fur"]
    },
    "uterus": {
        displayName: "Uterus",
        danger: 3,
        confidence: 0.7,
        location: ["Deeper areas"],
        limbPriority: ["torso"],
        coinFlipTurn: null,
        tactics: "Grotesque enemy. Can spawn embryos.",
        hints: ["Spawns Embryo enemies", "Kill quickly before spawns overwhelm"],
        mistakes: ["Don't let it spawn too many times"],
        drops: []
    },
    "embryo": {
        displayName: "Embryo",
        danger: 1,
        confidence: 0.95,
        location: ["Spawned by Uterus"],
        limbPriority: ["torso"],
        coinFlipTurn: null,
        tactics: "Weak spawn. Kill quickly.",
        hints: ["Spawned by Uterus", "Very weak individually"],
        mistakes: [],
        drops: []
    },
    "red_man": {
        displayName: "Red Man",
        danger: 4,
        confidence: 0.7,
        location: ["Void", "Deep areas"],
        limbPriority: ["head", "torso"],
        coinFlipTurn: null,
        tactics: "Mysterious and dangerous. Approach with caution.",
        hints: ["Connected to the Void", "Very unsettling enemy"],
        mistakes: [],
        drops: []
    },
    "harvestman": {
        displayName: "Harvestman",
        danger: 4,
        confidence: 0.75,
        location: ["Ma'habre"],
        limbPriority: ["arms", "torso"],
        coinFlipTurn: null,
        tactics: "Creature that harvests. Disable arms.",
        hints: ["Found in Ma'habre", "Related to Night Lurch"],
        mistakes: [],
        drops: []
    },
    "male_molded": {
        displayName: "Male Molded",
        danger: 3,
        confidence: 0.8,
        location: ["Deep areas"],
        limbPriority: ["torso"],
        coinFlipTurn: null,
        tactics: "Corrupted humanoid. Basic tactics.",
        hints: ["Result of failed flesh transformation"],
        mistakes: [],
        drops: []
    },
    "female_molded": {
        displayName: "Female Molded",
        danger: 3,
        confidence: 0.8,
        location: ["Deep areas"],
        limbPriority: ["torso"],
        coinFlipTurn: null,
        tactics: "Corrupted humanoid. Basic tactics.",
        hints: ["Result of failed flesh transformation"],
        mistakes: [],
        drops: []
    },
    "blight": {
        displayName: "Blight",
        danger: 3,
        confidence: 0.75,
        location: ["Void", "Deep areas"],
        limbPriority: ["torso"],
        coinFlipTurn: null,
        tactics: "Void creature. Hit hard and fast.",
        hints: ["Related to the Void", "Can regenerate"],
        mistakes: ["Don't let it regenerate"],
        drops: []
    },
    "prisoner": {
        displayName: "Prisoner",
        danger: 1,
        confidence: 0.95,
        location: ["Prisons"],
        limbPriority: ["torso"],
        coinFlipTurn: null,
        tactics: "Weak enemy. Can be recruited!",
        hints: ["CAN BE RECRUITED as party member", "Very weak in combat"],
        mistakes: ["Don't kill if you want to recruit"],
        drops: [],
        recruitable: true
    },
    "moonless": {
        displayName: "Moonless",
        displayNameEs: "Lobo Solitario",
        altNames: ["Lobo Solitario", "Moonless Wolf"],
        danger: 1,
        confidence: 0.9,
        location: ["Ma'habre", "Various"],
        limbPriority: ["torso"],
        coinFlipTurn: null,
        tactics: "A lonely wolf corrupted by the God of the Depths. NOT dangerous! FEED IT any meat/food item and it becomes your ally and JOINS YOUR PARTY. Do NOT attack it.",
        hints: ["FEED IT to recruit!", "Give any food item during battle", "Becomes a powerful party member", "Cannot use weapons but has unique abilities"],
        mistakes: ["Do NOT kill it!", "Do NOT attack it — feed it instead!"],
        drops: [],
        recruitable: true,
        special: "Feed any food item to recruit as party member"
    },
    // === MISSING VARIANTS (from wiki) ===
    "guard_infected": {
        displayName: "Guard (Infected)",
        danger: 4,
        confidence: 0.75,
        location: ["Catacombs", "Various"],
        weaknesses: ["slashing"],
        resistances: [],
        limbPriority: ["left arm", "torso"],
        coinFlipTurn: 2,
        tactics: "Pollinated Guard. Same as normal but can spread Brain Flower infection. Kill fast.",
        hints: ["50% chance to replace normal Guard in Catacombs", "Guard outfit does NOT fool infected variants", "Can inflict Brain Flower"],
        mistakes: ["Don't let infection spread", "Disguise won't work"],
        drops: ["Guard skin"]
    },
    "night_lurch_infected": {
        displayName: "Night Lurch (Infected)",
        danger: 4,
        confidence: 0.7,
        location: ["Thicket"],
        weaknesses: [],
        resistances: [],
        limbPriority: ["horn", "head"],
        coinFlipTurn: null,
        tactics: "Infected Night Lurch. Can't be pacified with rotten meat. Fight or flee.",
        hints: ["Rotten meat doesn't work on infected", "Can spread Brain Flower"],
        mistakes: ["Don't try to pacify with meat"],
        drops: []
    },
    "lord_of_flies_infected": {
        displayName: "Lord of Flies (Infected)",
        danger: 5,
        confidence: 0.65,
        location: ["Deeper Thicket"],
        weaknesses: [],
        resistances: [],
        limbPriority: ["head", "torso"],
        coinFlipTurn: null,
        tactics: "Infected variant. More dangerous. Can spread Brain Flower.",
        hints: ["Infected version is stronger", "Brain Flower pollen attack"],
        mistakes: ["Treat as a serious threat"],
        drops: []
    },
    "cavedweller_merchant": {
        displayName: "Cavedweller (Merchant)",
        danger: 1,
        confidence: 0.95,
        location: ["Caverns"],
        limbPriority: [],
        coinFlipTurn: null,
        tactics: "Peaceful merchant! Sells items. Do NOT attack.",
        hints: ["Sells healing items and equipment", "Will fight back if attacked"],
        mistakes: ["NEVER attack the merchant"],
        drops: [],
        npc: true
    }
};

// ============================================================================
// BOSSES - Unique encounters
// ============================================================================
FearHungerKB.bosses = {
    "crow_mauler": {
        displayName: "Crow Mauler",
        danger: 5,
        confidence: 0.8,
        location: ["Inner Hall", "Backyard"],
        limbPriority: ["left arm", "head", "torso"],
        coinFlipTurn: null,
        tactics: "Blind head with Red Vial first! Then destroy left arm (main weapon). Very aggressive.",
        hints: ["Red Vial blinds it", "Penance armor location related", "Soul can be captured with soul stone"],
        mistakes: ["Never fight it head-on without blinding", "Don't ignore the claw arm"],
        drops: ["Crow Mauler soul (with soul stone)"],
        boss: true
    },
    "crow_mauler_double": {
        displayName: "Crow Mauler (Double-headed)",
        danger: 6,
        confidence: 0.65,
        location: ["Deep dungeon"],
        limbPriority: ["left arm", "heads", "torso"],
        coinFlipTurn: null,
        tactics: "Even more dangerous. Blind both heads! Same strategy but harder.",
        hints: ["Two heads means more trouble", "May need multiple Red Vials"],
        mistakes: ["Absolutely do not fight without preparation"],
        drops: [],
        boss: true
    },
    "human_hydra": {
        displayName: "Human Hydra",
        displayNameEs: "Hidra Humana",
        altNames: ["Hidra", "Hidra Humana"],
        danger: 0,
        confidence: 0.95,
        location: ["Blood Pit"],
        limbPriority: ["any head"],
        coinFlipTurn: null,
        tactics: "COMPLETELY HARMLESS. Has NO attacks at all, can only insult you during combat. It is a mass of fused human bodies. With Ring of Wraiths or Sorcerer's Stone equipped, you can farm raw stats (ATK/DEF/Body/Mind) by repeatedly attacking its heads — NOT experience or levels, since Fear & Hunger has NO leveling system.",
        hints: ["Cannot hurt you at all!", "Only insults during combat", "Useful with Ring of Wraiths to raise stats directly", "Running away regenerates its heads for infinite farming"],
        mistakes: ["Don't be afraid of it — it literally cannot damage you", "There is NO leveling system — stat gains are from items and this creature only"],
        drops: [],
        boss: true,
        special: "Stat farming target, completely harmless"
    },
    "butterfly": {
        displayName: "Butterfly",
        danger: 4,
        confidence: 0.75,
        location: ["Thicket", "Hidden Courtyard"],
        limbPriority: ["wings", "torso"],
        coinFlipTurn: null,
        tactics: "Beautiful but deadly. Can be spared for soul later.",
        hints: ["Spare it and destroy Golden temple organ for Butterfly soul", "Connected to Sylvian"],
        mistakes: ["Don't kill if you want the soul"],
        drops: ["Butterfly soul (special condition)"],
        boss: true
    },
    "black_witch": {
        displayName: "Black Witch",
        danger: 5,
        confidence: 0.7,
        location: ["Tower of Endless"],
        limbPriority: ["head", "arms"],
        coinFlipTurn: null,
        tactics: "Powerful magic user. Counter-magic essential or rush.",
        hints: ["Soul stone works on corpse", "Soul causes poison effect"],
        mistakes: ["Don't let her cast freely"],
        drops: ["Black witch soul"],
        boss: true
    },
    "iron_shakespeare": {
        displayName: "Iron Shakespeare",
        danger: 5,
        confidence: 0.7,
        location: ["Prisons"],
        limbPriority: ["arms", "torso"],
        coinFlipTurn: null,
        tactics: "Armored enemy in iron maiden. Heavy attacks, armored.",
        hints: ["Soul can be captured", "Very tough physically"],
        mistakes: ["Magic may be more effective than physical"],
        drops: ["Iron shakespeare soul"],
        boss: true
    },
    "trortur": {
        displayName: "Trortur",
        danger: 5,
        confidence: 0.75,
        location: ["Inner Hall - Secret Chamber"],
        limbPriority: ["arms", "torso"],
        coinFlipTurn: null,
        tactics: "The torturer. Can be pickpocketed for vault key. Dangerous in direct combat.",
        hints: ["Pickpocket for vault key!", "Vault contains Penance armor", "Can give Light blue vial as gift"],
        mistakes: ["Don't fight if you can steal instead"],
        drops: ["Vault key (steal)"],
        boss: true
    },
    "old_knight": {
        displayName: "Old Knight",
        danger: 4,
        confidence: 0.8,
        location: ["Entrance", "Courtyard"],
        limbPriority: ["sword arm", "torso"],
        coinFlipTurn: null,
        tactics: "Experienced knight. Respect his skill but beatable.",
        hints: ["Old but skilled", "Knight spectre may be related"],
        mistakes: [],
        drops: [],
        boss: true
    },
    "assassin_spectre": {
        displayName: "Assassin Spectre",
        danger: 5,
        confidence: 0.65,
        location: ["Various"],
        limbPriority: ["arms", "torso"],
        coinFlipTurn: null,
        tactics: "Ghostly assassin. Fast and deadly. May need spectral damage.",
        hints: ["Very fast", "Spectral entity", "Assassination attacks"],
        mistakes: ["Don't let it get multiple attacks"],
        drops: [],
        boss: true
    },
    "cavemother": {
        displayName: "Cavemother",
        danger: 5,
        confidence: 0.7,
        location: ["Caverns deep"],
        limbPriority: ["head", "torso"],
        coinFlipTurn: null,
        tactics: "Mother of cavedwellers. Large enemy, lots of HP.",
        hints: ["Soul can be captured", "Queen of the caves"],
        mistakes: ["Long fight, conserve resources"],
        drops: ["Cavemother soul"],
        boss: true
    },
    "ser_seymor": {
        displayName: "Ser Seymor",
        danger: 4,
        confidence: 0.8,
        location: ["Various"],
        limbPriority: ["sword arm", "torso"],
        coinFlipTurn: null,
        tactics: "Fallen knight. Standard knight tactics.",
        hints: ["Part of the Fellowship", "Tragic backstory"],
        mistakes: [],
        drops: [],
        boss: true
    },
    "gaunt_knight": {
        displayName: "Gaunt Knight",
        danger: 5,
        confidence: 0.75,
        location: ["Catacombs", "Tombs"],
        limbPriority: ["sword arm", "torso"],
        coinFlipTurn: null,
        tactics: "Skeletal knight. Very dangerous. Drops excellent armor.",
        hints: ["Drops Short sword", "Drops Long sword", "Drops Gaunt bascinet", "Drops Gaunt plate armor"],
        mistakes: ["Full set of gaunt armor is excellent"],
        drops: ["Short sword", "Long sword", "Gaunt bascinet", "Gaunt plate armor"],
        boss: true
    },
    "isayah": {
        displayName: "Isayah",
        danger: 5,
        confidence: 0.7,
        location: ["Temple of Torment"],
        limbPriority: ["head", "arms", "torso"],
        coinFlipTurn: null,
        tactics: "Dark priest boss. Magic focused. Counter-magic helps.",
        hints: ["Drops Iron mask", "Leader of dark priests"],
        mistakes: ["Bring counter-magic"],
        drops: ["Iron mask"],
        boss: true
    },
    "salmonsnake": {
        displayName: "Salmonsnake",
        danger: 5,
        confidence: 0.7,
        location: ["Level 7 - Catacombs", "Water areas"],
        limbPriority: ["head", "body"],
        coinFlipTurn: null,
        tactics: "Large serpent. Water-based. Drops Stone crown.",
        hints: ["Drops Stone crown accessory", "Soul has healing properties"],
        mistakes: ["Limited space for combat"],
        drops: ["Stone crown", "Salmonsnake soul"],
        boss: true
    },
    "skin_granny": {
        displayName: "Skin Granny",
        danger: 6,
        confidence: 0.6,
        location: ["Catacombs"],
        limbPriority: ["arms", "torso"],
        coinFlipTurn: null,
        tactics: "VERY DANGEROUS. Can rip your face off. Penance armor protects against face rip.",
        hints: ["Face rip attack instantly kills", "Penance armor prevents face rip", "Iron mask also protects"],
        mistakes: ["NEVER fight without face protection"],
        drops: [],
        boss: true
    },
    "nameless": {
        displayName: "Nameless",
        danger: 5,
        confidence: 0.65,
        location: ["Void"],
        limbPriority: ["head", "torso"],
        coinFlipTurn: null,
        tactics: "Void entity. Connected to the Nameless Traveler book.",
        hints: ["Related to game lore", "Void connection"],
        mistakes: [],
        drops: [],
        boss: true
    },
    "old_guardian": {
        displayName: "Old Guardian",
        danger: 6,
        confidence: 0.6,
        location: ["Hall of the Gods"],
        limbPriority: ["arms", "torso"],
        coinFlipTurn: null,
        tactics: "Ancient protector. Very tough. Soul capturable.",
        hints: ["Drops Red Scarf accessory", "Guards sacred area", "Soul can be captured"],
        mistakes: ["Prepare well before engaging"],
        drops: ["Red Scarf", "Old Guardian soul"],
        boss: true
    },
    "white_angel": {
        displayName: "White Angel",
        danger: 6,
        confidence: 0.55,
        location: ["Tower of Endless"],
        limbPriority: ["wings", "torso"],
        coinFlipTurn: null,
        tactics: "Divine entity. Extremely dangerous. Soul capturable.",
        hints: ["Soul can be captured", "Connected to divine powers"],
        mistakes: ["One of the hardest fights"],
        drops: ["White angel soul"],
        boss: true
    },
    "lady_of_moon": {
        displayName: "Lady of Moon",
        danger: 6,
        confidence: 0.5,
        location: ["Tower of Endless (top)"],
        limbPriority: ["torso"],
        coinFlipTurn: null,
        tactics: "Lunar deity. Extremely powerful magic. One of the final bosses.",
        hints: ["Connected to Rher", "Moon-based powers"],
        mistakes: ["Endgame boss preparation required"],
        drops: [],
        boss: true
    },
    "valteil": {
        displayName: "Valteil",
        danger: 7,
        confidence: 0.4,
        location: ["Temple of Torment"],
        limbPriority: ["head", "torso"],
        coinFlipTurn: null,
        tactics: "Ascended being. One of the new gods. Extremely dangerous.",
        hints: ["New god candidate", "Connected to main story"],
        mistakes: ["Prepare for a very hard fight"],
        drops: [],
        boss: true
    },
    "tormented_one": {
        displayName: "Tormented One",
        danger: 6,
        confidence: 0.5,
        location: ["Temple of Torment depths"],
        limbPriority: ["torso"],
        coinFlipTurn: null,
        tactics: "Ronn Chambara. Extremely tragic and powerful.",
        hints: ["Was once Ronn Chambara", "Story boss"],
        mistakes: [],
        drops: [],
        boss: true
    },
    "francois": {
        displayName: "Francóis",
        danger: 7,
        confidence: 0.4,
        location: ["Ma'habre", "Ancient areas"],
        limbPriority: ["torso"],
        coinFlipTurn: null,
        tactics: "Ancient dark lord. New god. Penance armor interaction.",
        hints: ["Francóis the Dominating One", "Interaction with Penance armor"],
        mistakes: ["One of the hardest encounters"],
        drops: [],
        boss: true
    },
    "greater_blight": {
        displayName: "Greater Blight",
        danger: 6,
        confidence: 0.5,
        location: ["Void"],
        limbPriority: ["torso"],
        coinFlipTurn: null,
        tactics: "Massive void creature. Very tough.",
        hints: ["Larger version of Blight", "Void corruption"],
        mistakes: [],
        drops: [],
        boss: true
    },
    "traces_of_sylvian": {
        displayName: "Traces of Sylvian",
        danger: 7,
        confidence: 0.35,
        location: ["Tombs of the Gods"],
        limbPriority: ["torso"],
        coinFlipTurn: null,
        tactics: "Echo of the goddess of love and fertility. Divine power.",
        hints: ["One of the old gods", "Connected to marriage/fertility"],
        mistakes: ["Endgame encounter"],
        drops: [],
        boss: true
    },
    "traces_of_gro_goroth": {
        displayName: "Traces of Gro-goroth",
        danger: 7,
        confidence: 0.35,
        location: ["Tombs of the Gods"],
        limbPriority: ["torso"],
        coinFlipTurn: null,
        tactics: "Echo of the god of destruction. Pure violence.",
        hints: ["One of the old gods", "God of destruction"],
        mistakes: ["Endgame encounter"],
        drops: [],
        boss: true
    },
    "god_of_fear_and_hunger": {
        displayName: "God of Fear and Hunger",
        danger: 10,
        confidence: 0.2,
        location: ["The Bottom", "Ending A"],
        limbPriority: ["torso"],
        coinFlipTurn: "final phase",
        tactics: "FINAL BOSS. 4 phases. Phase 4: Stampede of Arms. Final phase has LETHAL coin flip stare. GUARD immediately when she enters final phase. Dagger or Peculiar doll on Girl skips 2 turns during phase 2.",
        hints: [
            "The Girl ascends to become this",
            "4 phases - each more dangerous",
            "Equip Girl with Dagger or Peculiar Doll before fight!",
            "Use Blood golem skill during transition",
            "Nas'hrah trick for 4th party member",
            "Guard on final phase transition",
            "Status effects clear on phase transition",
            "4000 combined damage in phase 1-2 ends fight early"
        ],
        mistakes: [
            "NEVER ignore the final phase coin flip",
            "Don't let Stampede of Arms hit full party",
            "Don't waste buffs - they clear on phase change"
        ],
        drops: [],
        boss: true,
        final: true
    },
    "yellow_king": {
        displayName: "Yellow King",
        danger: 8,
        confidence: 0.25,
        location: ["Ma'habre", "Tower of Endless"],
        limbPriority: ["head", "torso"],
        coinFlipTurn: null,
        tactics: "One of the new gods. Connected to Yellow mages. Extremely powerful.",
        hints: ["Leader of Yellow mages", "New god", "Connected to endings"],
        mistakes: ["Absolute endgame content"],
        drops: [],
        boss: true
    }
};

// ============================================================================
// ITEMS - Consumables, healing, and key items
// ============================================================================
FearHungerKB.items = {
    // === HEALING ===
    "cloth_fragment": {
        type: "healing",
        displayNameEs: "Fragmento de tela",
        aliases: ["cloth", "fragmento", "tela", "vendaje"],
        effects: [{ type: "cure_status", status: "bleeding" }],
        effect: "Stops Bleeding",
        description: "Use to stop bleeding status. Crafted from Cloth hood.",
        source: ["Priest drops", "Various locations", "Craft from Cloth hood"],
        tips: "Always keep 2-3 for emergencies",
    },
    "green_herb": {
        type: "healing",
        displayNameEs: "Hierba verde",
        aliases: ["hierba verde", "green"],
        effects: [{ type: "cure_status", status: "infection" }],
        effect: "Cures Infection",
        description: "Cures infected arm/leg. Essential for Thicket areas.",
        source: ["Grows on map"],
        tips: "Stock up before Thicket - infection is common there"
    },
    "blue_herb": {
        type: "healing",
        displayNameEs: "Hierba azul",
        aliases: ["hierba azul", "blue"],
        effects: [{ type: "heal_mind", value: 30 }],
        effect: "Restores 30 Mind",
        description: "Restores sanity. Combine with red herb for better effect.",
        source: ["Grows on map", "Lord of flies drops"],
        tips: "Combine with red herb (Alchemillia Vol. 1)"
    },
    "red_herb": {
        type: "healing",
        displayNameEs: "Hierba roja",
        aliases: ["hierba roja", "red"],
        effects: [{ type: "heal_body", value: 30 }],
        effect: "Restores 30 Body",
        description: "Restores HP. Base ingredient for many recipes.",
        source: ["Grows on map"],
        tips: "Most common herb - use as crafting base"
    },
    "blue_vial": {
        type: "healing",
        displayNameEs: "Vial azul",
        aliases: ["vial azul"],
        effects: [{ type: "heal_mind", value: 60 }],
        effect: "Restores 60 Mind",
        description: "Better sanity restoration.",
        source: ["Craft: 2 Blue herbs (Alchemillia Vol. 1)", "Found"],
        tips: "Craft from 2 blue herbs"
    },
    "light_blue_vial": {
        type: "healing",
        displayNameEs: "Vial celeste",
        aliases: ["vial celeste", "vial azul claro", "light blue"],
        effects: [{ type: "heal_mind", value: 100 }],
        effect: "Restores 100 Mind",
        description: "Best mind restoration potion.",
        source: ["Rare find", "Trortur gift", "Craft: 2 Blue vials (Alchemillia Vol. 3)"],
        tips: "Trortur may give you one as gift"
    },
    "white_vial": {
        type: "healing",
        displayNameEs: "Vial blanco",
        aliases: ["vial blanco", "antidoto", "antidote"],
        effects: [{ type: "cure_status", status: "poison" }, { type: "cure_status", status: "toxic" }],
        effect: "Cures Poison and Toxic",
        description: "Antidote for poison effects.",
        source: ["Found", "Craft: Blue vial + Purple vial (Alchemillia Vol. 2)"],
        tips: "Essential for deep dungeon exploration"
    },
    "red_vial": {
        type: "combat",
        displayNameEs: "Vial rojo",
        aliases: ["vial rojo", "red"],
        effect: "Blinds enemy",
        description: "Throw at enemy to blind them. ESSENTIAL for Crow Mauler!",
        source: ["Found", "Craft"],
        tips: "SAVE FOR CROW MAULER - blinds it completely"
    },
    "purple_vial": {
        type: "combat",
        displayNameEs: "Vial morado",
        aliases: ["vial morado", "vial purpura", "vial violeta"],
        effect: "Poisons enemy",
        description: "Throw at enemy to poison them.",
        source: ["Found", "Craft"],
        tips: "Good for long fights"
    },
    "explosive_vial": {
        type: "combat",
        displayNameEs: "Vial explosivo",
        aliases: ["vial explosivo", "explosive"],
        effect: "Fire damage to enemy",
        description: "Throw at enemy for fire damage.",
        source: ["Found", "Craft"],
        tips: "Useful against regenerating enemies"
    },
    "mix_of_red_and_blue": {
        type: "healing",
        displayNameEs: "Mezcla de rojo y azul",
        aliases: ["mezcla rojo azul", "mix rojo azul"],
        effects: [{ type: "heal_body", value: 30 }, { type: "heal_mind", value: 30 }],
        effect: "Restores 30 Body + 30 Mind",
        description: "Combined healing effect.",
        source: ["Craft: Blue herb + Red herb (Alchemillia Vol. 1)"],
        tips: "Efficient use of herbs"
    },
    "mix_of_red_and_green": {
        type: "healing",
        displayNameEs: "Mezcla de rojo y verde",
        aliases: ["mezcla rojo verde", "mix rojo verde"],
        effects: [{ type: "cure_status", status: "poison" }, { type: "cure_status", status: "toxic" }, { type: "cure_status", status: "infection" }, { type: "heal_body", value: 30 }],
        effect: "Cures Poison, Toxic, Infection + 30 Body",
        description: "Full status cure plus healing.",
        source: ["Craft: Green herb + Red herb (Alchemillia Vol. 1)"],
        tips: "All-purpose cure"
    },
    "tobacco": {
        type: "consumable",
        effect: "Restores Mind (with Pipe)",
        description: "Use with pipe to restore sanity.",
        source: ["Found"],
        tips: "Need a pipe to use"
    },
    "opium_powder": {
        type: "consumable",
        effect: "Strong Mind restore (with Pipe)",
        description: "Stronger than tobacco but may have side effects.",
        source: ["Found"],
        tips: "Use sparingly"
    },
    "rotten_meat": {
        type: "special",
        displayNameEs: "Carne podrida",
        aliases: ["carne podrida", "rotten"],
        effect: "Pacifies Night Lurch",
        description: "Offer to Night Lurch via Talk to avoid combat!",
        source: ["Night Lurch drops", "Found"],
        tips: "SAVE FOR NIGHT LURCH - avoids entire fight"
    },

    // === WEAPONS ===
    "short_sword": {
        type: "weapon",
        damage: "Slashing",
        description: "Enki's starting weapon. Solid all-around.",
        source: ["Enki start", "Gaunt Knight drops", "Basement weapons table"],
        tips: "Can be cursed for Cursed short sword"
    },
    "long_sword": {
        type: "weapon",
        damage: "Slashing",
        description: "D'arce starting choice. Strong slashing damage.",
        source: ["D'arce start", "Gaunt Knight drops", "Steal from D'arce"],
        tips: "Good for most encounters"
    },
    "scimitar": {
        type: "weapon",
        damage: "Slashing",
        description: "Cahara's starting weapon. Fast slashing.",
        source: ["Cahara start", "Basement weapons table"],
        tips: "Quick attacks"
    },
    "iron_spear": {
        type: "weapon",
        damage: "Piercing",
        description: "D'arce starting choice. Two-handed, good reach.",
        source: ["D'arce start", "Basement weapons table"],
        tips: "Two-handed - can't use shield"
    },
    "short_bow": {
        type: "weapon",
        damage: "Piercing",
        description: "Ragnvaldr starting choice. Ranged attacks.",
        source: ["Ragnvaldr start", "Steal from Ragnvaldr"],
        tips: "Good for ranged softening"
    },
    "iron_mace": {
        type: "weapon",
        damage: "Blunt",
        description: "Blunt damage weapon. Good vs armored enemies.",
        source: ["Basement weapons table", "Chests"],
        tips: "Some enemies resist slashing but not blunt"
    },
    "dagger": {
        type: "weapon",
        damage: "Piercing",
        description: "Only usable by Demon Kid and Girl. Give to Girl before God of Fear and Hunger fight!",
        source: ["Hidden courtyard (with Demon Kid or Girl)"],
        tips: "EQUIP ON GIRL FOR FINAL BOSS - skips 2 turns"
    },
    "skeletal_arm": {
        type: "weapon",
        damage: "Blunt",
        description: "Usable by Demon Kid, Girl, and Skeleton.",
        source: ["Skeleton drops"],
        tips: "Good for characters with limited weapon options"
    },
    "claymore": {
        type: "weapon",
        damage: "Slashing",
        description: "Two-handed large sword. High damage.",
        source: ["Found"],
        tips: "Marriage (Fusion) can use this"
    },
    "sergal_spear": {
        type: "weapon",
        damage: "Piercing",
        description: "Powerful two-handed spear.",
        source: ["Found"],
        tips: "Marriage (Fusion) weapon"
    },

    // === ARMOR ===
    "leather_vest": {
        type: "armor",
        description: "Cahara's starting armor. Light protection.",
        source: ["Cahara start"],
        tips: "Light armor - allows mobility"
    },
    "fur_armor": {
        type: "armor",
        description: "Ragnvaldr's starting armor.",
        source: ["Ragnvaldr start"],
        tips: "Good cold resistance"
    },
    "high_priest_robe": {
        type: "armor",
        description: "Enki's starting armor. Magic focused.",
        source: ["Enki start"],
        tips: "Good for casters"
    },
    "plate_mail": {
        type: "armor",
        description: "D'arce starting choice. Heavy protection.",
        source: ["D'arce start", "Le'garde start", "Rare armor stand"],
        tips: "Best physical protection"
    },
    "priest_robe": {
        type: "armor",
        description: "Disguise! Priests won't attack you.",
        source: ["Priest drops"],
        tips: "DISGUISE - lets you pass priests"
    },
    "guard_outfit": {
        type: "armor",
        description: "Disguise! Guards and Elite Guards won't attack.",
        source: ["Craft: 2 Guard skins (Assassin's Handbook I)"],
        tips: "DISGUISE - craft with Assassin's Handbook"
    },
    "ghoul_outfit": {
        type: "armor",
        description: "Disguise! Ghouls won't attack.",
        source: ["Craft: 2 Pale skins (Assassin's Handbook I)"],
        tips: "DISGUISE - useful in ghoul areas"
    },
    "fur_outfit": {
        type: "armor",
        description: "Disguise for beast areas.",
        source: ["Craft: Lord of flies fur (Assassin's Handbook I)"],
        tips: "DISGUISE"
    },
    "gaunt_plate_armor": {
        type: "armor",
        description: "Excellent armor from Gaunt Knight. 65% Piercing resist.",
        source: ["Gaunt Knight drops"],
        tips: "One of the best armors in game"
    },
    "gaunt_bascinet": {
        type: "armor",
        description: "Excellent helmet from Gaunt Knight. 85% Piercing resist. Causes Confused.",
        source: ["Gaunt Knight drops"],
        tips: "Combined with Gaunt armor = 55% total piercing resist"
    },
    "penance_armor": {
        type: "armor",
        description: "Legendary armor. Protects from Skin Granny face rip, Crow Mauler peck, Harvestman.",
        source: ["Trortur's secret vault (need vault key)"],
        tips: "ESSENTIAL for Skin Granny fight - prevents instant death"
    },
    "iron_mask": {
        type: "armor",
        description: "Causes Blindness but protects from face rip attacks.",
        source: ["Isayah drops"],
        tips: "Protects from Skin Granny if no Penance armor"
    },
    "stone_crown": {
        type: "accessory",
        description: "Accessory from Salmonsnake.",
        source: ["Salmonsnake drops"],
        tips: "Rare accessory"
    },
    "wooden_buckler": {
        type: "shield",
        description: "Basic shield. Ragnvaldr starting choice.",
        source: ["Ragnvaldr start", "Various boxes"],
        tips: "Better than nothing"
    },
    "spider_shield": {
        type: "shield",
        description: "Better shield from Lizardman.",
        source: ["Lizardman drops", "Rare chests"],
        tips: "Good upgrade"
    },
    "eagle_crest_shield": {
        type: "shield",
        description: "D'arce's starting shield. Excellent protection.",
        source: ["D'arce start", "Rare armor stands"],
        tips: "One of the best shields"
    },

    // === KEY ITEMS & ACCESSORIES ===
    "soul_stone": {
        type: "key_item",
        description: "Use on boss corpse to capture their soul as accessory.",
        source: ["Found", "Bought"],
        tips: "Save for powerful bosses - souls give unique powers"
    },
    "ring_of_wraiths": {
        type: "accessory",
        description: "Farm Body stat from enemies like Human Hydra.",
        source: ["Found"],
        tips: "Use with Human Hydra to farm Body infinitely"
    },
    "sorcerer_stone": {
        type: "accessory",
        description: "Farm Mind stat from enemies like Human Hydra.",
        source: ["Found"],
        tips: "Use with Human Hydra to farm Mind infinitely"
    },
    "spirit_anchor": {
        type: "accessory",
        description: "Enki gets this for Ending S. Prevents soul binding death.",
        source: ["Nosramus gift"],
        tips: "Essential for Enki's best ending"
    },
    "peculiar_doll": {
        type: "key_item",
        description: "Give to Girl before God of Fear and Hunger fight. Same effect as Dagger.",
        source: ["Found"],
        tips: "EQUIP ON GIRL FOR FINAL BOSS - skips 2 turns"
    },
    "monocle": {
        type: "accessory",
        displayNameEs: "Monóculo",
        aliases: ["monoculo", "monóculo", "monocle"],
        description: "Accessory that improves vision.",
        source: ["Lord of flies drops", "Rare chests"],
        tips: "Good utility accessory"
    },
    "empty_scroll": {
        type: "crafting",
        description: "Used to copy spells at hexen tables.",
        source: ["Found", "Bought"],
        tips: "Learn spells permanently"
    },
    "lesser_soul": {
        type: "crafting",
        description: "Used at hexen tables to curse weapons.",
        source: ["Enemy drops", "Found"],
        tips: "Cursed weapons are stronger"
    },

    // === FOOD (from wiki) ===
    "bread": {
        type: "food",
        effects: [{ type: "reduce_hunger", value: 20 }],
        description: "Basic food. Reduces hunger by 20.",
        source: ["Found", "Bought from merchants"],
        tips: "Common food - eat before hunger debuffs kick in"
    },
    "dried_meat": {
        type: "food",
        effects: [{ type: "reduce_hunger", value: 25 }],
        description: "Preserved meat. Good hunger reduction.",
        source: ["Found", "Chests"],
        tips: "Safe to eat - no side effects"
    },
    "raw_meat": {
        type: "food",
        effects: [{ type: "reduce_hunger", value: 30 }, { type: "risk", status: "infection" }],
        description: "Raw meat. Restores hunger but risk of infection.",
        source: ["Carved from enemies", "Found"],
        tips: "Cook at campfire first! Raw meat risks infection"
    },
    "cooked_meat": {
        type: "food",
        effects: [{ type: "reduce_hunger", value: 30 }],
        description: "Cooked meat. Safe to eat.",
        source: ["Cook raw meat at campfire"],
        tips: "Always cook raw meat before eating"
    },
    "meatpie": {
        type: "food",
        effects: [{ type: "reduce_hunger", value: 40 }],
        description: "Meatpie. Large hunger reduction.",
        source: ["Craft", "Found"],
        tips: "Best common food"
    },
    "rotten_meatpie": {
        type: "food",
        effects: [{ type: "reduce_hunger", value: 30 }, { type: "risk", status: "infection" }],
        description: "Rotten meatpie. Restores hunger but risks infection.",
        source: ["Found"],
        tips: "Only eat if desperate"
    },
    "rotten_food": {
        type: "food",
        effects: [{ type: "reduce_hunger", value: 15 }, { type: "risk", status: "poison" }],
        description: "Very old food. Risks poison.",
        source: ["Found in old areas"],
        tips: "Extremely risky - poison can kill"
    },

    // === MISSING HEALING (from wiki) ===
    "water_vial": {
        type: "healing",
        effects: [{ type: "cure_status", status: "burn" }],
        effect: "Cures Burn status",
        description: "Use to extinguish burning status.",
        source: ["Found", "Craft"],
        tips: "Keep one for fire enemies (Priest, Iron Shakespeare)"
    },
    "bonesaw": {
        type: "tool",
        effects: [{ type: "amputate" }],
        effect: "Amputates infected limbs",
        description: "Use to amputate an infected or bleeding arm/leg on the overworld. Causes bleeding.",
        source: ["Found"],
        tips: "Last resort cure for infection - amputating stops it spreading"
    },
    "purifying_talisman": {
        type: "healing",
        effects: [{ type: "cure_status", status: "blindness" }],
        effect: "Cures Blindness",
        description: "Purifies blindness effect.",
        source: ["Found", "Rare"],
        tips: "Important if wearing Iron Mask or hit by Blindness"
    },
    "potion_of_full_healing": {
        type: "healing",
        effects: [{ type: "heal_body", value: 9999 }, { type: "risk", status: "poison" }],
        effect: "Full HP restore but risks Poison",
        description: "Restores all Body HP. Has risk of poisoning.",
        source: ["Rare find"],
        tips: "Risky! Keep antidote ready"
    },
    "potion_of_full_sanity": {
        type: "healing",
        effects: [{ type: "heal_mind", value: 9999 }, { type: "risk", status: "poison" }],
        effect: "Full Mind restore but risks Poison",
        description: "Restores all Mind HP. Has risk of poisoning.",
        source: ["Rare find"],
        tips: "Risky! Keep antidote ready"
    },
    "potion_of_life": {
        type: "healing",
        effects: [{ type: "heal_body", value: 9999 }, { type: "heal_mind", value: 9999 }, { type: "risk", status: "poison" }],
        effect: "Full Body+Mind restore but risks Poison",
        description: "Restores everything. Has risk of poisoning.",
        source: ["Very rare"],
        tips: "Best potion but very risky"
    },
    "elixir_of_mind": {
        type: "healing",
        effects: [{ type: "heal_mind", value: 100 }],
        effect: "Restores 100 Mind",
        description: "Strong mind restoration.",
        source: ["Rare find", "Craft"],
        tips: "Better than Blue vial - no side effects"
    },

    // === MISSING CONSUMABLES (from wiki) ===
    "ale": {
        type: "consumable",
        effects: [{ type: "heal_mind", value: 20 }],
        effect: "Restores 20 Mind",
        description: "Alcoholic drink. Restores some sanity.",
        source: ["Found"],
        tips: "Quick sanity recovery"
    },
    "bottle_of_whiskey": {
        type: "consumable",
        effects: [{ type: "heal_mind", value: 30 }],
        effect: "Restores 30 Mind",
        description: "Whiskey. Good sanity restoration.",
        source: ["Found"],
        tips: "Decent mind restoration"
    },
    "wine_vial": {
        type: "consumable",
        effects: [{ type: "heal_mind", value: 25 }],
        effect: "Restores 25 Mind",
        description: "Wine. Moderate sanity restoration.",
        source: ["Found"],
        tips: "Good for mind recovery in a pinch"
    },
    "worm_juice": {
        type: "consumable",
        effects: [{ type: "risk", status: "infection" }, { type: "risk", status: "brain_flower" }],
        effect: "Risks Infection and Brain Flower",
        description: "Disgusting liquid. Extremely dangerous to consume.",
        source: ["Found"],
        tips: "DON'T DRINK unless you want Brain Flower"
    },
    "blue_demon_powder": {
        type: "consumable",
        effects: [{ type: "heal_mind", value: 40 }],
        effect: "Restores 40 Mind",
        description: "Powerful mind-altering substance.",
        source: ["Rare find"],
        tips: "Strong sanity recovery but scarce"
    },
    "brown_vial": {
        type: "consumable",
        effect: "Reduces hunger slightly",
        description: "Mysterious brown liquid.",
        source: ["Found"],
        tips: "Minor hunger reduction"
    },
    "glass_vial": {
        type: "crafting",
        effect: "Empty vial for crafting",
        description: "Used as crafting ingredient for potions.",
        source: ["Found"],
        tips: "Needed for alchemy recipes"
    },
    "murky_vial": {
        type: "consumable",
        effect: "Unknown dangerous effects",
        description: "A vial of murky liquid. Effects unclear.",
        source: ["Found"],
        tips: "Use at your own risk"
    },
    "lucky_coin": {
        type: "consumable",
        effects: [{ type: "improve_coin_flip", value: 1 }],
        effect: "Improves next coin flip odds",
        description: "A lucky coin. Improves your odds on the next coin flip.",
        source: ["Found", "Rare"],
        tips: "Save for critical coin flip moments"
    },
    "pipe": {
        type: "tool",
        effect: "Required to smoke Tobacco and Opium",
        description: "Pipe for smoking. Needed to use Tobacco or Opium Powder.",
        source: ["Found"],
        tips: "Essential if you want to use tobacco for mind recovery"
    },

    // === MISSING WEAPONS (from wiki) ===
    "axe": {
        type: "weapon",
        damage: "Slashing",
        description: "Ragnvaldr starting choice. Strong slashing weapon.",
        source: ["Ragnvaldr start", "Basement weapons table"],
        tips: "Good all-around weapon"
    },
    "meat_cleaver": {
        type: "weapon",
        damage: "Slashing",
        description: "Guard's weapon. Drops from all Guard variants.",
        source: ["Guard drops", "Steal from Guard/Francóis", "Basement weapons table"],
        tips: "Easy to obtain early"
    },
    "morning_star": {
        type: "weapon",
        damage: "Blunt",
        description: "Heavy blunt weapon. Good vs armored enemies.",
        source: ["Steal from Elite guard", "Basement weapons table", "Rare chests"],
        tips: "Strong upgrade over Iron mace"
    },
    "bone_shears": {
        type: "weapon",
        damage: "Slashing+Piercing",
        description: "Dual-type damage weapon.",
        source: ["Behind locked gate Level 3 Basement", "Chests"],
        tips: "Versatile - hits two damage types"
    },
    "war_scythe": {
        type: "weapon",
        damage: "Slashing",
        description: "Found on Dragon corpse in Ma'habre present time.",
        source: ["Dragon corpse in Ancient City", "Chests"],
        tips: "Powerful two-handed weapon"
    },
    "eastern_sword": {
        type: "weapon",
        damage: "Slashing",
        description: "Haunted sword. Kill Assassin Spectre to purify it.",
        source: ["Level 5 Thicket"],
        tips: "Purified version is very strong"
    },
    "blue_sin": {
        type: "weapon",
        damage: "Slashing+Fire",
        description: "Legendary sword. Draw from stone in cave. Use Passages of Ma'habre immediately after!",
        source: ["Stone in cave (one-time)"],
        tips: "One of the best weapons. Use Passages of Ma'havre after drawing or die"
    },
    "crude_sword": {
        type: "weapon",
        damage: "Slashing",
        description: "Lizardman weapon. Basic but functional.",
        source: ["Lizardman drops", "Steal from Lizardman"],
        tips: "Marriage (Fusion) can use this"
    },
    "ritual_spear": {
        type: "weapon",
        damage: "Piercing",
        description: "Cavedweller spear. Two-handed.",
        source: ["Cavedweller drops"],
        tips: "Two-handed - no shield"
    },
    "shark_teeth": {
        type: "weapon",
        damage: "Slashing+Piercing",
        description: "Serrated teeth weapon. Dual damage type.",
        source: ["Level 6 Mines locked room", "Basement weapons table", "Chests"],
        tips: "Unique dual damage weapon"
    },
    "miasma": {
        type: "weapon",
        damage: "Otherworldly",
        description: "Otherworldly weapon behind far left basement door.",
        source: ["Far left door in basement (break or use Crow emblem key from Crow Mauler)"],
        tips: "Otherworldly damage bypasses most defenses"
    },

    // === MISSING ARMOR (from wiki) ===
    "plate_helmet": {
        type: "armor",
        description: "Heavy helmet. Causes Confused but protects head.",
        source: ["Found", "Armor stands"],
        tips: "Protection vs face attacks but limits vision"
    },
    "arm_guards": {
        type: "accessory",
        description: "Protects arms from severing attacks.",
        source: ["Found", "Chests"],
        tips: "GREAT vs Guards - prevents arm loss if you miss first turn"
    },
    "hard_leather_armor": {
        type: "armor",
        description: "Decent armor. Drops from Lizardman.",
        source: ["Lizardman drops"],
        tips: "Good mid-game armor"
    },
    "fur_armor": {
        type: "armor",
        displayNameEs: "Armadura de Piel",
        aliases: ["armadura de piel", "fur armor"],
        effect: "Provides decent early game defense.",
        description: "Armor made from stitched animal fur. Provides moderate protection.",
        source: ["Found", "Crafted"],
        tips: "Good early defense"
    },
    "trench_coat": {
        type: "armor",
        description: "Body Snatcher's disguise coat.",
        source: ["Body Snatcher drops"],
        tips: "Light armor with unique look"
    },

    // === MISSING ACCESSORIES (from wiki) ===
    "everwatching_talisman": {
        type: "accessory",
        description: "Triggers Phobia debuff. Not recommended.",
        source: ["Found"],
        tips: "AVOID - causes Phobia which is a debuff"
    },
    "thorned_ring": {
        type: "accessory",
        description: "Causes Bleeding on wearer.",
        source: ["Found"],
        tips: "AVOID unless you have a strategy for bleeding"
    },
    "ring_of_still_blood": {
        type: "accessory",
        effects: [{ type: "cure_status", status: "bleeding" }, { type: "cure_status", status: "poison" }],
        description: "Prevents Bleeding and Poison. Very valuable.",
        source: ["Found"],
        tips: "EXCELLENT - passive protection from 2 common statuses"
    },
    "red_scarf": {
        type: "accessory",
        description: "Accessory from Old Guardian.",
        source: ["Old Guardian drops"],
        tips: "Valuable accessory"
    },

    // === BOOKS (from wiki) ===
    "alchemillia_vol_1": {
        type: "book",
        description: "Teaches herb combining: Red+Blue=Mix, Red+Green=Mix, 2 Blue herbs=Blue Vial.",
        source: ["Found in early areas"],
        tips: "ESSENTIAL - learn this first for crafting potions"
    },
    "alchemillia_vol_2": {
        type: "book",
        description: "Teaches advanced alchemy: Blue vial + Purple vial = White vial (antidote).",
        source: ["Found"],
        tips: "Needed for antidote crafting"
    },
    "alchemillia_vol_3": {
        type: "book",
        description: "Teaches master alchemy: 2 Blue vials = Light blue vial.",
        source: ["Found in deeper areas"],
        tips: "Late game crafting"
    },
    "assassins_handbook_1": {
        type: "book",
        description: "Teaches disguise crafting: 2 Guard skins=Guard outfit, 2 Pale skins=Ghoul outfit, Lord of flies fur=Fur outfit.",
        source: ["Found"],
        tips: "ESSENTIAL - disguises prevent enemy aggression"
    },
    "book_of_enlightenment": {
        type: "book",
        description: "Teaches stat-boosting skills and enlightenment paths.",
        source: ["Found"],
        tips: "Important for character progression"
    },

    // === FOOD ===
    "raw_meat": {
        type: "food",
        displayNameEs: "Carne cruda",
        aliases: ["carne cruda", "raw meat", "carne"],
        effect: "Restores 90 Hunger. 80% chance of parasitic infection.",
        description: "Raw meat that restores significant hunger but risks parasitic infection. Cook at a stove or campfire to remove infection risk. Moonless is immune.",
        source: ["Enemy drops", "Corpses"],
        tips: "ALWAYS cook before eating unless you're Moonless"
    },
    "cooked_meat": {
        type: "food",
        displayNameEs: "Carne asada",
        aliases: ["carne asada", "carne cocida", "cooked"],
        effect: "Restores 90 Hunger safely",
        description: "Cooked meat that restores hunger without infection risk.",
        source: ["Cook raw meat at stove/campfire"],
        tips: "Best food item - cook raw meat whenever possible"
    },
    "meatpie": {
        type: "food",
        displayNameEs: "Pastel de carne",
        aliases: ["pastel", "pie", "meatpie"],
        effect: "Restores 90 Hunger",
        description: "Traditional pie that fully satisfies hunger.",
        source: ["Craft: Eggs + Dried meat + Flour (15th century recipe book)"],
        tips: "Great hunger restoration - requires recipe book"
    },
    "rotten_meatpie": {
        type: "food",
        displayNameEs: "Pastel de carne podrido",
        aliases: ["pastel podrido", "rotten pie"],
        effect: "Restores some Hunger, risk of negative effects",
        description: "A rotting meat pie. Satisfies hunger but may cause sickness.",
        source: ["Found"],
        tips: "Only eat as last resort"
    },
    "bread": {
        type: "food",
        displayNameEs: "Pan",
        aliases: ["pan", "moldy bread", "pan mohoso"],
        effect: "Restores 30 Hunger",
        description: "Moldy bread that temporarily satisfies hunger. No negative side effects.",
        source: ["Found in various locations"],
        tips: "Common food - no side effects"
    },
    "dried_meat": {
        type: "food",
        displayNameEs: "Carne seca",
        aliases: ["carne seca", "dried"],
        effect: "Restores 30 Hunger",
        description: "Dried meat preserved to prevent spoilage. Also a crafting component for meatpie.",
        source: ["Found", "Enemy drops"],
        tips: "Can be used for crafting meatpie"
    },
    "blueberry": {
        type: "food",
        displayNameEs: "Arándanos",
        aliases: ["arándanos", "blueberries", "arandanos", "berries"],
        effect: "Restores 7 Hunger and 4-6 Stamina",
        description: "Small berries that restore a tiny amount of hunger and stamina. Can be used to make blueberry pie.",
        source: ["Found growing on map"],
        tips: "Very minor restoration - better used for crafting pie"
    },

    // === WEAPONS (MISSING) ===
    "meat_cleaver": {
        type: "weapon",
        displayNameEs: "Cuchillo de carnicero",
        aliases: ["cuchillo de carnicero", "meat cleaver", "cleaver"],
        effect: "Slashing weapon. High limb severing chance.",
        description: "A heavy cleaver meant for butchering meat. Deals good damage and has a high chance to sever limbs.",
        source: ["Guards", "Found"],
        tips: "Reliable weapon for aiming at enemy limbs"
    },
    "throwing_knife": {
        type: "weapon",
        displayNameEs: "Cuchillo arrojadizo",
        aliases: ["cuchillo arrojadizo", "throwing dart", "dart"],
        effect: "Ranged throwing weapon. Usable in battle.",
        description: "Small knives designed for throwing. Can be used as a quick ranged attack in combat.",
        source: ["Chests", "Drops"],
        tips: "Save for finishing off weak enemies or attacking elusive targets"
    },
    "stone": {
        type: "tool",
        displayNameEs: "Piedra",
        aliases: ["piedra", "stone", "rock"],
        effect: "Can be thrown at enemies.",
        description: "A simple stone. Can be thrown in battle for minor damage.",
        source: ["Found on ground"],
        tips: "Better than nothing for a weak ranged attack"
    },
    "bone_shears": {
        type: "weapon",
        displayNameEs: "Tijeras de Hueso",
        aliases: ["tijeras", "bone scissors", "tijeras de hueso", "shears"],
        effect: "Two-handed piercing weapon. -50% hit rate penalty.",
        description: "Rusty scissors weapon that deals massive piercing damage but has a severe -50% accuracy penalty. Monocle reduces penalty to -30%, Eyeglasses remove it entirely.",
        source: ["Found in dungeon"],
        tips: "Equip Eyeglasses to negate the accuracy penalty — then it becomes devastating"
    },
    "axe": {
        type: "weapon",
        displayNameEs: "Hacha",
        aliases: ["hacha", "hand axe"],
        effect: "+36 Attack. One-handed blunt weapon.",
        description: "A typical hand axe. Good damage and can be used for dismemberment. One-handed blunt type.",
        source: ["Found", "Ragnvaldr starting weapon"],
        tips: "Solid early-game weapon"
    },
    "morning_star": {
        type: "weapon",
        displayNameEs: "Lucero del alba",
        aliases: ["lucero", "mace", "morning star"],
        effect: "Heavy mace. Supposed to stun and cause bleeding (bugged in-game).",
        description: "A heavy mace weapon. Description says it stuns and bleeds, but these effects don't consistently trigger due to a known game bug.",
        source: ["Found"],
        tips: "Decent weapon despite bugged effects"
    },
    "meat_cleaver": {
        type: "weapon",
        displayNameEs: "Cuchillo de carnicero",
        aliases: ["cuchillo de carnicero", "cleaver", "carnicero"],
        effect: "One-handed slashing weapon.",
        description: "A cleaver used by guards. One-handed weapon with decent damage.",
        source: ["Guard drops"],
        tips: "Common drop from guards"
    },
    "eastern_sword": {
        type: "weapon",
        displayNameEs: "Espada oriental",
        aliases: ["espada oriental", "katana", "curved sword"],
        effect: "One-handed sword. Prone to critical attacks. Can be purified for 70% crit rate.",
        description: "Delicate curved blade that crits often. Found in Level 5 Thicket. Triggers Assassin Spectre. Defeat the spectre to purify it for 70% critical hit rate.",
        source: ["Level 5 Thicket (planted in floor)", "Empty Scroll: O LORD. GIVE. EASTERN SWORD."],
        tips: "PURIFY IT by defeating the Assassin Spectre — 70% crit rate is insane"
    },
    "crude_sword": {
        type: "weapon",
        displayNameEs: "Espada tosca",
        aliases: ["espada tosca", "crude"],
        effect: "Strong two-handed weapon.",
        description: "A crude but powerful two-handed bladed weapon. DO NOT attempt to curse it — it will break and be destroyed.",
        source: ["Lizardman drop/steal", "Empty Scroll: O LORD. GIVE. CRUDE SWORD."],
        tips: "WARNING: Cursing this sword DESTROYS it!"
    },
    "war_scythe": {
        type: "weapon",
        displayNameEs: "Guadaña de guerra",
        aliases: ["guadaña", "scythe", "war scythe"],
        effect: "Two-handed spear. Low success rate (30%).",
        description: "Large two-handed spear with curved blade. Low attack and only 30% hit rate makes it unreliable. Can be cursed for 3 Lesser Souls.",
        source: ["Dragon corpse (Ancient City)", "3% chest chance", "Empty Scroll: O LORD. GIVE. WAR SCYTHE."],
        tips: "NOT recommended — very low hit rate. Curse it or skip it"
    },
    "blue_sin": {
        type: "weapon",
        displayNameEs: "Pecado azul",
        aliases: ["pecado azul", "blue sin"],
        effect: "One-handed sword. Cursed version: 70% burn chance.",
        description: "Fine light sword with blue carvings inscribed 'For the sinners'. Found in Level 6 Mines. Pulling it causes mine collapse — use 'The Passages of Ma'habre' book IMMEDIATELY after grabbing it to teleport away.",
        source: ["Level 6 Mines"],
        tips: "CRITICAL: Have 'Passages of Ma'habre' book ready BEFORE pulling it or you die!"
    },

    // === ACCESSORIES (MISSING) ===
    "arm_guards": {
        type: "accessory",
        displayNameEs: "Protectores de brazo",
        aliases: ["protectores", "arm guard", "bracers"],
        effect: "+10 Defense. Prevents arm loss. Resists slash/pierce/blunt.",
        description: "Accessory that provides defense and prevents arms from being severed.",
        source: ["Found"],
        tips: "Invaluable against enemies that sever limbs"
    },
    "everwatching_talisman": {
        type: "accessory",
        displayNameEs: "Talismán vigilante",
        aliases: ["talismán vigilante", "everwatching", "talisman"],
        effect: "Negates ALL phobias when equipped.",
        description: "Talisman that completely prevents any phobia from triggering. Essential for characters with dangerous phobias.",
        source: ["Found"],
        tips: "EQUIP THIS if your character has a phobia — prevents the huge debuff"
    },
    "thorned_ring": {
        type: "accessory",
        displayNameEs: "Anillo de espinas",
        aliases: ["anillo de espinas", "thorned", "poison ring"],
        effect: "Cures and prevents Poison status. Cannot be unequipped.",
        description: "Ring that creates a steady flow of minor poison, making the wearer immune to larger poison. WARNING: Cannot be removed once equipped, unless via Marriage ritual.",
        source: ["Found"],
        tips: "Cannot be unequipped! Only put on if you really need poison immunity"
    },
    "ring_of_still_blood": {
        type: "accessory",
        displayNameEs: "Anillo de sangre quieta",
        aliases: ["anillo de sangre", "still blood", "blood ring"],
        effect: "Prevents Bleeding status. Cannot be unequipped.",
        description: "Ring that prevents bleeding. WARNING: Cannot be removed once equipped. The Salmonsnake Soul is a direct upgrade.",
        source: ["Found"],
        tips: "Cannot be unequipped! Salmonsnake Soul is better"
    },
    "plate_helmet": {
        type: "armor",
        displayNameEs: "Yelmo de placas",
        aliases: ["yelmo", "plate helm", "helmet"],
        effect: "+20 Defense. Prevents Confused status.",
        description: "Heavy head armor that provides solid defense and prevents confusion.",
        source: ["Found"],
        tips: "Protects against confusion-causing attacks"
    },

    // === TOOLS ===
    "bonesaw": {
        type: "tool",
        displayNameEs: "Sierra de hueso",
        aliases: ["sierra", "saw", "bonesaw"],
        effect: "Removes a chosen limb. Cures infection on that limb. Causes Bleeding.",
        description: "Crude makeshift saw for amputating infected limbs. Removes the limb entirely (causes Bleeding), but cures any infection on that limb type. Provides a severed arm/leg item.",
        source: ["Found"],
        tips: "Last resort for infection — causes bleeding, so have cloth fragments ready"
    },
    "skinning_knife": {
        type: "tool",
        displayNameEs: "Cuchillo de desollar",
        aliases: ["cuchillo de desollar", "skinning", "desollar"],
        effect: "Skins defeated enemies for skins/meat.",
        description: "Allows skinning certain enemies after defeating them, yielding skins or Salmonsnake meat. With Assassin's Handbook I, craft disguises from skins.",
        source: ["Trortur's torture chambers (on table)"],
        tips: "Combine with Assassin's Handbook I to craft disguises"
    },
    "bear_trap": {
        type: "tool",
        displayNameEs: "Trampa de oso",
        aliases: ["trampa", "bear trap"],
        effect: "Deploy on map to immobilize one enemy.",
        description: "Deployable trap that catches and immobilizes one enemy on the overworld map. Harmless to the player. If a second trap is placed, the first disappears.",
        source: ["Found"],
        tips: "Only one can be active at a time"
    },

    // === CONSUMABLES (MISSING) ===
    "lucky_coin": {
        type: "consumable",
        displayNameEs: "Moneda de la suerte",
        aliases: ["moneda", "lucky coin", "moneda de la suerte", "coin"],
        effect: "Boosts coin flip success to 75% (hold SHIFT while choosing).",
        description: "Use during coin flip events while holding SHIFT to boost success chance from 50% to 75%. Works on chests, bookcases, beds, necromancy, and certain enemy attacks.",
        source: ["Found", "Various locations"],
        tips: "Hold SHIFT when choosing a side to activate the bonus!"
    },
    "brown_vial": {
        type: "consumable",
        displayNameEs: "Vial marrón",
        aliases: ["vial marrón", "vial marron", "brown"],
        effect: "Increases evasion rate.",
        description: "A vial of brown liquid that heightens senses and increases evasion temporarily.",
        source: ["Found"],
        tips: "Good for dodgy combat encounters"
    },
    "murky_vial": {
        type: "consumable",
        displayNameEs: "Vial turbia",
        aliases: ["vial turbia", "murky"],
        effect: "Deals 80-120 Fire damage to target.",
        description: "A vial of murky liquid that deals significant fire damage when thrown at enemies.",
        source: ["Found", "Crafted"],
        tips: "Powerful throwable damage — save for tough fights"
    },
    "water_vial": {
        type: "healing",
        displayNameEs: "Vial de agua",
        aliases: ["vial de agua", "water", "agua"],
        effect: "Cures Burning status.",
        description: "Vial of drinkable water that cures the Burning status effect. Can be transmuted into a wine vial.",
        source: ["Found"],
        tips: "Keep one for burn emergencies. Can transmute into wine"
    },
    "ale": {
        type: "consumable",
        displayNameEs: "Cerveza",
        aliases: ["cerveza", "ale"],
        effect: "Restores 29-31 Mind.",
        description: "Alcoholic drink that restores a moderate amount of sanity.",
        source: ["Found"],
        tips: "Decent mind restoration"
    },
    "wine_vial": {
        type: "consumable",
        displayNameEs: "Vial de vino",
        aliases: ["vial de vino", "wine", "vino"],
        effect: "Restores 38-42 Mind.",
        description: "Wine that restores a good amount of sanity.",
        source: ["Found", "Transmute water vial"],
        tips: "Better than ale for mind restoration"
    },
    "worm_juice": {
        type: "consumable",
        displayNameEs: "Jugo de gusano",
        aliases: ["jugo de gusano", "worm juice", "gusano"],
        effect: "Treats parasitic worms. Causes Poisoned status.",
        description: "Treats intestinal parasitic worms but poisons the user. A risky trade-off.",
        source: ["Random drops"],
        tips: "Cures parasites but poisons you — have antidote ready"
    },

    // === TRICK POTIONS (The Merchant) ===
    "potion_of_full_healing": {
        type: "consumable",
        displayNameEs: "Poción de curación total",
        aliases: ["poción de curación", "full healing"],
        effect: "TRAP: Poisons the user instead of healing!",
        description: "Sold by The Merchant at the Entrance. Despite its name, consuming this potion POISONS you. The Merchant is a trickster who disappears after selling.",
        source: ["The Merchant (Entrance)"],
        tips: "DO NOT DRINK — it's a trap! All Merchant potions poison you"
    },
    "potion_of_full_sanity": {
        type: "consumable",
        displayNameEs: "Poción de cordura total",
        aliases: ["poción de cordura", "full sanity"],
        effect: "TRAP: Poisons the user instead of restoring sanity!",
        description: "Another Merchant trap. Poisons instead of restoring sanity.",
        source: ["The Merchant (Entrance)"],
        tips: "DO NOT DRINK — Merchant potions are ALL traps"
    },
    "potion_of_life": {
        type: "consumable",
        displayNameEs: "Poción de vida",
        aliases: ["poción de vida", "life potion"],
        effect: "TRAP: Poisons the user!",
        description: "The third Merchant trap potion. All three purchased potions are poison.",
        source: ["The Merchant (Entrance)"],
        tips: "NEVER buy from The Merchant — all his potions are poisoned"
    },

    // === MISC COMMON ITEMS ===
    "silver_coin": {
        type: "currency",
        displayNameEs: "Moneda de plata",
        aliases: ["moneda de plata", "silver coin", "silver", "plata"],
        effect: "Currency. Used to buy from merchants and NPCs.",
        description: "Silver coins used as currency in the dungeons.",
        source: ["Enemy drops", "Found", "Chests"],
        tips: "Save coins for essential purchases"
    },
    "carrots": {
        type: "food",
        displayNameEs: "Zanahorias",
        aliases: ["zanahorias", "zanahoria", "carrot"],
        effect: "Restores small amount of Hunger.",
        description: "Simple vegetable that provides minor hunger restoration.",
        source: ["Found growing in farm areas"],
        tips: "Minor food item"
    },
    "cheese": {
        type: "food",
        displayNameEs: "Queso",
        aliases: ["queso", "cheese"],
        effect: "Restores moderate Hunger.",
        description: "Cheese that satisfies hunger. A relatively safe food item.",
        source: ["Found"],
        tips: "Decent food source with no side effects"
    },
    "torch": {
        type: "tool",
        displayNameEs: "Antorcha",
        aliases: ["antorcha", "torch"],
        effect: "Lights dark areas. Consumed over time.",
        description: "A lit torch that illuminates dark dungeon corridors. Burns out after extended use.",
        source: ["Found", "Common in early areas"],
        tips: "Essential for dark areas - always carry spares"
    }
};


// ============================================================================
// LOCATIONS - Dungeon areas with tips
// ============================================================================
FearHungerKB.locations = {
    // === OVERWORLD / STARTING AREA ===
    "overworld_start": {
        displayName: "Porch of the Dungeon",
        displayNameEs: "Pórtico de la Mazmorra",
        lore: "A dead horse lies rotting by the gate, its saddlebags torn open. Wooden crates are scattered around—someone left in a hurry. Two paths ahead: the main entrance, a heavy iron gate half-open, and a narrow stone stairway along the outer wall leading to a side entrance.",
        ambience: "cold wind, grey sky, carrion stench, distant thunder",
        enemies: [],
        tips: ["Two entrances: main gate and side stairs", "Loot the crates before entering"],
        dangers: ["No combat here, but darkness awaits inside"]
    },

    // === BASEMENT ===
    "basement": {
        displayName: "Basement",
        displayNameEs: "Sótano",
        lore: "Damp stone corridors stretch in every direction. Torch sconces line the walls, most of them burned out. The air smells of rust and old blood. Guard patrols echo from somewhere deeper.",
        ambience: "dripping water, distant footsteps, flickering torchlight",
        levels: ["Level 2", "Level 3"],
        enemies: ["Guard", "Elite Guard"],
        tips: ["Weapons table has random loot", "Flip side has alternate version"],
        dangers: ["Guards patrol", "Dark corners hide enemies"]
    },

    // === FORTRESS ===
    "entrance": {
        displayName: "Level 1 - Entrance",
        displayNameEs: "Nivel 1 - Entrada",
        lore: "The fortress entrance is a claustrophobic maze of torchlit corridors. Guards in rusted armor patrol between checkpoints. The stone walls are stained with something dark. Somewhere ahead, a heavy door groans on its hinges.",
        ambience: "echoing footsteps, metallic clanking, suffocating dread",
        enemies: ["Guard", "Old Knight"],
        tips: ["Starting area", "Guard patrols"],
        dangers: ["Alert system can summon Ballista Guards"]
    },
    "courtyard": {
        displayName: "Level 1 - Courtyard",
        displayNameEs: "Nivel 1 - Patio",
        lore: "An open courtyard under a sliver of grey sky. Guard towers overlook the grounds, manned by sentries with ballistae. A few withered trees cling to cracked flagstones. Hidden passages connect to the inner hall.",
        ambience: "open air, creaking watchtowers, bird cries",
        enemies: ["Guard", "Guard (Ballista)"],
        tips: ["Hidden areas accessible", "Dagger pickup with Demon Kid/Girl"],
        dangers: ["Open area - can be flanked"]
    },
    "inner_hall": {
        displayName: "Level 1 - Inner Hall",
        displayNameEs: "Nivel 1 - Sala Interior",
        lore: "The inner hall reeks of death. Long corridors with alcoves and locked doors. Something large stalks these hallways—you can hear its breathing. Trortur's secret chamber lies hidden behind a mechanism in the wall.",
        ambience: "heavy breathing nearby, grinding stone, smell of decay",
        enemies: ["Guard", "Elite Guard", "Priest", "Crow Mauler"],
        tips: ["Trortur's secret chamber here", "Light all torches for vault", "Crow Mauler stalks this area"],
        dangers: ["Crow Mauler is deadly", "Multiple enemy types"]
    },
    "backyard": {
        displayName: "Level 1 - Backyard",
        displayNameEs: "Nivel 1 - Patio Trasero",
        lore: "An overgrown courtyard choked with dead vines. Eerie silence, broken only by the occasional scrape of something moving above. The Crow Mauler considers this its domain.",
        ambience: "dead silence, rustling above, moonlight through cracks",
        enemies: ["Crow Mauler"],
        tips: ["Crow Mauler territory"],
        dangers: ["Bring Red Vial"]
    },

    // === UNDERGROUND ===
    "blood_pit": {
        displayName: "Level 2 - Blood Pit",
        displayNameEs: "Nivel 2 - Pozo de Sangre",
        lore: "The floor is slick with old blood. Torture chambers line the walls, their implements still glistening. Something groans from the pit—the Human Hydra, a mass of fused bodies still alive, reaching with a dozen broken hands.",
        ambience: "groaning, dripping blood, metallic stench, screams below",
        enemies: ["Guard", "Elite Guard", "Human Hydra", "Bloody Man"],
        tips: ["Human Hydra for stat farming", "Torture chambers"],
        dangers: ["Grim atmosphere - sanity drain"]
    },
    "shit_pit": {
        displayName: "Level 2 - Shit Pit",
        displayNameEs: "Nivel 2 - Pozo de Mierda",
        lore: "The stench here is unbearable. Waste from the entire fortress collects in this pit. Despite the filth, useful items were discarded here. The locals avoid this place.",
        ambience: "overwhelming stench, buzzing flies, squelching",
        enemies: ["Various"],
        tips: ["Unpleasant but has loot"],
        dangers: ["Disease risk"]
    },
    "prisons": {
        displayName: "Level 3 - Prisons",
        displayNameEs: "Nivel 3 - Prisiones",
        lore: "Iron cells stretch in rows, most of them rusted shut. Skeletal prisoners rattle their chains. The Iron Shakespeare patrols endlessly, an automaton of judgment. Some prisoners may still be worth rescuing.",
        ambience: "chains rattling, distant weeping, iron scraping stone",
        enemies: ["Skeleton", "Mumbler", "Iron Shakespeare", "Prisoner"],
        tips: ["Prisoners can be recruited!", "Iron Shakespeare guards area"],
        dangers: ["Dark cells", "Ambush potential"]
    },
    "caverns": {
        displayName: "Level 4 - Caverns",
        displayNameEs: "Nivel 4 - Cavernas",
        lore: "Natural caves beneath the fortress. Bioluminescent fungi cast an eerie blue glow on wet stone. Spider webs hang thick in corners. Deeper in, the Cavedweller merchants have set up a crude market—they trade, but don't trust them.",
        ambience: "dripping water, blue glow, skittering legs, echoes",
        enemies: ["Maneba", "Jaggedjaw", "Cave Spider", "Cavegnome", "Cavedweller"],
        tips: ["Cavedweller merchants!", "Spiders poison", "Cavemother deeper"],
        dangers: ["Poison common", "Cave-ins"]
    },
    "mines": {
        displayName: "Level 5-6 - Mines",
        displayNameEs: "Nivel 5-6 - Minas",
        lore: "Abandoned mining tunnels stretch deeper than any map records. Mining equipment lies scattered, rusted through. Spectral miners wander their old routes, oblivious to their own death. The Altar of Darkness waits on Level 6.",
        ambience: "ghostly whispers, pickaxe echoes, cold draft, darkness",
        enemies: ["Miner Spectre", "Cavedweller", "Cavedweller (Spear)"],
        tips: ["Spectres haunt here", "Altar of Darkness on Level 6"],
        dangers: ["Ghosts", "Cave collapse risk"]
    },
    "catacombs": {
        displayName: "Level 7 - Catacombs",
        displayNameEs: "Nivel 7 - Catacumbas",
        lore: "Ancient burial chambers. Bones stacked in every alcove, arranged with unsettling care. The Salmonsnake lurks in the underground waters. Deeper within, the Skin Granny waits—a creature that wears the faces of the dead.",
        ambience: "bone dust, stagnant water, whispered prayers, absolute darkness",
        enemies: ["Skeleton", "Scarab", "Gaunt Knight", "Salmonsnake", "Skin Granny"],
        tips: ["Gaunt Knight drops best armor", "Skin Granny VERY dangerous", "Salmonsnake in water"],
        dangers: ["SKIN GRANNY - bring Penance armor or Iron mask!"]
    },

    // === THICKET ===
    "thicket": {
        displayName: "Thicket (Levels 2-5)",
        displayNameEs: "Espesura (Niveles 2-5)",
        lore: "A twisted underground forest grown from corrupted soil. The trees are pale and leafless, their roots drinking something that isn't water. Infection spreads fast here—every scratch risks parasites. The Butterfly hovers between the branches, beautiful and deadly.",
        ambience: "rustling branches, spore clouds, buzzing insects, unnatural growth",
        enemies: ["Priest", "Lizardman", "Lizardmage", "Night Lurch", "Lord of Flies", "Butterfly"],
        tips: ["INFECTION common here", "Stock green herbs", "Night Lurch accepts rotten meat", "Butterfly can be spared"],
        dangers: ["Infection spreads fast", "Multiple enemy types"]
    },

    // === THE DEPTHS ===
    "gauntlet": {
        displayName: "The Gauntlet (Levels 8-9)",
        displayNameEs: "El Desafío (Niveles 8-9)",
        lore: "A passage deliberately designed to kill. Every step is a test. The strongest creatures in the dungeon call this home. Only those with purpose survive the gauntlet.",
        ambience: "oppressive heat, rumbling, distant roars, trembling ground",
        enemies: ["Greater Mumbler", "Greater Blight", "Various"],
        tips: ["Challenge area", "Tough enemies only"],
        dangers: ["No easy fights here"]
    },

    // === MA'HABRE ===
    "mahabre": {
        displayName: "Ma'habre",
        displayNameEs: "Ma'habre",
        lore: "The ancient city, older than memory. Its architecture defies geometry—spiraling towers, inverted arches, streets that fold back on themselves. The Yellow King once ruled here. Moonless soldiers guard its secrets, and Yellow Mages channel power from forgotten gods.",
        ambience: "timeless silence, golden dust, impossible geometry, cosmic dread",
        enemies: ["Moonless", "Moonless Guard", "Yellow Mage", "Harvestman", "Night Lurch", "Francóis"],
        tips: ["Ancient city", "Yellow King territory", "Moonless can be recruited", "Many secrets"],
        dangers: ["Yellow mages are dangerous", "Endgame area"]
    },
    "tombs_of_gods": {
        displayName: "Tombs of the Gods",
        displayNameEs: "Tumbas de los Dioses",
        lore: "Burial chambers of entities that should never have existed. The air vibrates with latent divinity. Traces of Sylvian and Gro-goroth seep through the walls like fever dreams made stone.",
        ambience: "vibrating air, divine pressure, reality warping, ancient sorrow",
        enemies: ["Traces of Sylvian", "Traces of Gro-goroth"],
        tips: ["Old god echoes here", "Endgame content"],
        dangers: ["Divine level threats"]
    },
    "tower_of_endless": {
        displayName: "Tower of Endless",
        displayNameEs: "Torre del Infinito",
        lore: "A tower that stretches upward without end. Each floor harder than the last. Yellow Mages, Black Witches, White Angels—every floor is a death sentence for the unprepared. At the top, the Lady of Moon waits.",
        ambience: "vertigo, howling wind, distant chanting, ascending madness",
        enemies: ["Yellow Mage", "Black Witch", "White Angel", "Lady of Moon"],
        tips: ["Vertical progression", "Boss at top", "Multiple powerful enemies"],
        dangers: ["Endgame difficulty throughout"]
    },
    "hall_of_gods": {
        displayName: "Hall of the Gods",
        displayNameEs: "Sala de los Dioses",
        lore: "A vast, echoing chamber built for beings larger than human understanding. The Old Guardian stands watch, ancient and immovable. The walls are carved with histories that predate language.",
        ambience: "echoing vastness, sacred stillness, weight of ages",
        enemies: ["Old Guardian"],
        tips: ["Sacred area", "Old Guardian guards it"],
        dangers: ["Powerful guardian"]
    },
    "temple_of_torment": {
        displayName: "Temple of Torment",
        displayNameEs: "Templo del Tormento",
        lore: "The dark priests' stronghold. Pain is worshipped here. Isayah and Valteil oversee rituals of unspeakable cruelty. The Tormented One writhes in eternal agony at the temple's heart.",
        ambience: "chanting, screaming, incense, blood-soaked stone",
        enemies: ["Isayah", "Valteil", "Tormented One"],
        tips: ["Dark priest headquarters", "Multiple bosses"],
        dangers: ["Boss gauntlet"]
    },
    "void": {
        displayName: "The Void",
        displayNameEs: "El Vacío",
        lore: "Reality has stopped pretending here. The ground shifts, colors invert, sounds play backwards. Blight creatures swim through the air like fish through water. The Red Man watches from everywhere and nowhere.",
        ambience: "reality dissolving, inverted sounds, nausea, whispers from inside your skull",
        enemies: ["Blight", "Greater Blight", "Red Man", "Nameless"],
        tips: ["Reality breaks down", "Void corruption"],
        dangers: ["Sanity drains fast", "Existential threats"]
    },
    "bottom": {
        displayName: "Level 10 - The Bottom",
        displayNameEs: "Nivel 10 - El Fondo",
        lore: "The very bottom. Below everything. The God of Fear and Hunger resides here, a being born from humanity's collective terror. The air itself recoils from this place. This is where it ends—one way or another.",
        ambience: "absolute silence, then everything at once, finality, cosmic terror",
        enemies: ["God of Fear and Hunger"],
        tips: ["Final area", "Ending A location", "The Girl ascends here"],
        dangers: ["FINAL BOSS"]
    }
};

// ============================================================================
// CHARACTERS - Playable and recruitable
// ============================================================================
FearHungerKB.characters = {
    "cahara": {
        displayName: "Cahara",
        class: "Mercenary",
        soul: "Endless",
        startingWeapon: "Scimitar",
        startingArmor: "Leather vest",
        weaponRestrictions: "All except Dagger and Skeletal arm",
        personality: ["rogue", "survivor", "practical", "morally flexible"],
        speechStyle: "Street-smart, direct, survival-focused",
        uniqueTraits: ["Steal skill", "Lock picking", "Fastest character"],
        tips: "Best for new players. Steal lets you get items without combat."
    },
    "darce": {
        displayName: "D'arce",
        class: "Knight",
        soul: "Dominating",
        startingWeapon: "Long sword OR Iron spear",
        startingArmor: "Plate mail OR Iron cuirass",
        startingShield: "Eagle crest shield (with sword)",
        weaponRestrictions: "All except Dagger and Skeletal arm",
        personality: ["noble", "honorable", "determined", "righteous"],
        speechStyle: "Formal, knightly, protective",
        uniqueTraits: ["Heavy armor user", "Shield proficiency", "Holy magic potential"],
        tips: "Tankiest character. Choose sword+shield for defense or spear for damage."
    },
    "enki": {
        displayName: "Enki",
        class: "Dark Priest",
        soul: "Enlightened",
        startingWeapon: "Short sword",
        startingArmor: "High priest's robe",
        weaponRestrictions: "Swords, axes, and maces ONLY",
        personality: ["scholarly", "curious", "occult-focused", "detached"],
        speechStyle: "Intellectual, mystical, clinical",
        uniqueTraits: ["Magic focused", "Best caster", "Ritual knowledge", "Spirit anchor for Ending S"],
        tips: "Best magic user. Limited weapons but powerful spells. Ending S is unique to him."
    },
    "ragnvaldr": {
        displayName: "Ragnvaldr",
        class: "Outlander",
        soul: "Tormented",
        startingWeapon: "Short bow",
        startingArmor: "Fur armor",
        startingShield: "Wooden buckler",
        weaponRestrictions: "All except Dagger and Skeletal arm",
        personality: ["vengeful", "strong", "silent", "trauma-driven"],
        speechStyle: "Few words, intense, focused on family",
        uniqueTraits: ["Highest base stats", "Rage mechanic", "Seeking family"],
        tips: "Strongest raw stats but tragic backstory. Pure combat focus."
    },
    "girl": {
        displayName: "The Girl",
        recruitable: true,
        class: "Child",
        weaponRestrictions: "Dagger and Skeletal arm ONLY",
        startingArmor: "Black dress",
        personality: ["innocent", "mysterious", "divine connection"],
        speechStyle: "Childlike but with hidden depth",
        uniqueTraits: ["Becomes God of Fear and Hunger", "Dagger/Peculiar Doll important"],
        tips: "EQUIP HER WITH DAGGER before final boss to skip turns!"
    },
    "legarde": {
        displayName: "Le'garde",
        recruitable: true,
        class: "Captain",
        startingArmor: "Plate mail",
        weaponRestrictions: "All except Dagger and Skeletal arm",
        personality: ["leader", "ambitious", "charismatic", "mad"],
        uniqueTraits: ["Party goal character", "Multiple endings involve him"],
        tips: "Finding him is a main objective. His fate affects endings."
    },
    "nashrah": {
        displayName: "Nas'hrah",
        recruitable: true,
        class: "Floating Head",
        weaponRestrictions: "Cannot use ANY weapons",
        personality: ["ancient", "sarcastic", "knowledgeable", "manipulative"],
        speechStyle: "Mocking, wise, cryptic",
        uniqueTraits: ["Magic advice", "Cannot equip anything", "Wisdom source"],
        tips: "Useful for magic knowledge but can't fight. Can take Girl's slot in final boss."
    },
    "skeleton": {
        displayName: "Skeleton",
        recruitable: true,
        class: "Undead",
        weaponRestrictions: "All except Claymores and Spears",
        personality: ["simple", "loyal", "undead"],
        uniqueTraits: ["Counter-magic kills instantly", "Immune to some effects"],
        tips: "Recruit from prisons. Weak to magic but useful party member."
    },
    "moonless": {
        displayName: "Moonless",
        displayNameEs: "Lobo Solitario",
        recruitable: true,
        class: "Corrupted",
        weaponRestrictions: "Cannot use ANY weapons",
        personality: ["lost", "corrupted", "tragic", "loyal once fed"],
        uniqueTraits: ["God of Depths corruption", "Unique abilities", "Recruited by feeding it food"],
        tips: "Feed it any food item during battle to recruit. Becomes a loyal party member. Cannot use weapons but has powerful unique abilities."
    },
    "marriage": {
        displayName: "Marriage",
        recruitable: true,
        class: "Fusion",
        weaponRestrictions: "All except Dagger and Skeletal arm",
        uniqueTraits: ["Created via Marriage of Flesh ritual", "Combined being"],
        tips: "Result of ritual. Powerful but requires sacrifice."
    },
    "marriage_fusion": {
        displayName: "Marriage (Fusion)",
        recruitable: true,
        class: "Greater Fusion",
        weaponRestrictions: "Claymore, Sergal spear, and Crude sword ONLY",
        uniqueTraits: ["Stronger marriage form", "Limited weapons but powerful"],
        tips: "Advanced fusion form. Very powerful."
    },
    "demon_kid": {
        displayName: "Demon Kid",
        recruitable: true,
        weaponRestrictions: "Dagger and Skeletal arm ONLY",
        uniqueTraits: ["Small but useful", "Accesses small spaces"],
        tips: "Can reach places others can't."
    },
    "blood_golem": {
        displayName: "Blood Golem",
        recruitable: true,
        class: "Summon",
        weaponRestrictions: "Cannot use ANY weapons",
        uniqueTraits: ["Summonable via skill", "Useful for final boss"],
        tips: "Summon during God of Fear and Hunger phase transitions!"
    },
    "ghoul": {
        displayName: "Ghoul",
        recruitable: true,
        class: "Undead",
        weaponRestrictions: "Cannot use ANY weapons",
        personality: ["mindless", "hungry"],
        tips: "Basic undead ally. Limited use."
    }
};

// ============================================================================
// NPCS - Non-playable characters with info
// ============================================================================
FearHungerKB.npcs = {
    "nosramus": {
        displayName: "Nosramus",
        role: "Sage",
        location: "Various",
        tips: "Gives Spirit anchor to Enki. Source of knowledge."
    },
    "the_merchant": {
        displayName: "The Merchant",
        role: "Shop",
        location: "Various safe rooms",
        tips: "Sells valuable items. Save money for keys and soul stones."
    },
    "cavedweller_merchant": {
        displayName: "Cavedweller (Merchant)",
        role: "Shop",
        location: "Caverns",
        tips: "Underground merchant. Different stock than main merchant."
    },
    "pocketcat": {
        displayName: "Pocketcat",
        role: "Mysterious entity",
        location: "Various",
        tips: "Appears in strange places. Has books about it. Connected to deeper lore."
    },
    "buckman": {
        displayName: "Buckman",
        role: "Prisoner/NPC",
        location: "Prisons",
        tips: "Has a letter. Part of dungeon lore."
    },
    "trortur": {
        displayName: "Trortur",
        role: "Boss/NPC",
        location: "Inner Hall - Secret Chamber",
        tips: "PICKPOCKET for vault key! Vault has Penance armor."
    }
};

// ============================================================================
// GODS - Deities and their domains
// ============================================================================
FearHungerKB.gods = {
    "gro_goroth": {
        displayName: "Gro-goroth",
        domain: "Destruction, Violence",
        description: "Old god of destruction. Source of violent magic.",
        tips: "Affinity affects dark magic power."
    },
    "sylvian": {
        displayName: "Sylvian",
        domain: "Love, Fertility, Nature",
        description: "Old goddess of love and fertility. Marriage rituals connect to her.",
        tips: "Marriage of Flesh is her domain."
    },
    "god_of_depths": {
        displayName: "God of the Depths",
        domain: "Ocean, Corruption, Moonless",
        description: "God corrupting the dungeon. Creates Moonless beings.",
        tips: "Source of the Moonless corruption."
    },
    "rher": {
        displayName: "Rher",
        domain: "Moon, Dreams, Madness",
        description: "Moon god. Connected to Lady of Moon.",
        tips: "Dream and nightmare magic."
    },
    "alll_mer": {
        displayName: "Alll-mer",
        domain: "Ascension, New Gods",
        description: "Template for ascension. Created by Fellowship.",
        tips: "What some seek to become."
    },
    "vinushka": {
        displayName: "Vinushka",
        domain: "Stars, Cosmos",
        description: "Outer god of the stars.",
        tips: "Cosmic-level entity."
    }
};

// ============================================================================
// BOOKS - Important books and their knowledge
// ============================================================================
FearHungerKB.books = {
    "alchemillia_vol1": {
        displayName: "Alchemillia Vol. 1",
        teaches: "Basic herb mixing recipes",
        recipes: ["Red + Blue herb", "Red + Green herb", "2x Blue herb = Blue vial"]
    },
    "alchemillia_vol2": {
        displayName: "Alchemillia Vol. 2",
        teaches: "Advanced potion crafting",
        recipes: ["Blue vial + Purple vial = White vial"]
    },
    "alchemillia_vol3": {
        displayName: "Alchemillia Vol. 3",
        teaches: "Master potion crafting",
        recipes: ["2x Blue vial = Light blue vial"]
    },
    "assassins_handbook": {
        displayName: "Assassin's Handbook I",
        teaches: "Disguise crafting",
        recipes: ["2x Pale skin = Ghoul outfit", "2x Guard skin = Guard outfit", "Lord of flies fur = Fur outfit"]
    },
    "pinecone_pig_instructions": {
        displayName: "Pinecone Pig Instructions",
        teaches: "Pinecone pig crafting",
        recipes: ["Pinecone + Stick = Pinecone pig"]
    }
};

// ============================================================================
// STATUS EFFECTS - From wiki (Status_Effects_F&H1). Icon descriptions for "I see X icon"
// ============================================================================
FearHungerKB.statusEffects = {
    "phobia": {
        name: "Phobia",
        iconDescription: "eye, watching, phobia icon, creepy eye",
        effect: "-50% Evasion, +50% Physical damage received.",
        cure: "Equip Everwatching talisman to prevent. Caused by enemies triggering character's phobia.",
        causedBy: ["Enemies that trigger phobia"]
    },
    "erotofobia": {
        name: "Erotofobia",
        altNames: ["Erotophobia"],
        iconDescription: "eye, phobia icon",
        effect: "Phobia debuff (-50% Evasion, +50% Physical damage received). Triggered by sexual or erotic encounters/enemies.",
        cure: "Avoid triggers. Equip Everwatching talisman to prevent. Each character has a unique phobia — this is the fear of sexuality/eroticism.",
        causedBy: ["Seeing sexual content", "Certain enemy attacks", "Character-specific trait"]
    },
    "pantofobia": {
        name: "Pantofobia",
        altNames: ["Panphobia", "Pantophobia"],
        iconDescription: "eye, phobia icon",
        effect: "Phobia debuff (-50% Evasion, +50% Physical damage received). Triggered by everything — the fear of all things.",
        cure: "Very hard to avoid. Equip Everwatching talisman. This is the fear of everything.",
        causedBy: ["Various triggers", "Character-specific trait"]
    },
    "escotofobia": {
        name: "Escotofobia",
        altNames: ["Scotophobia", "Nyctophobia"],
        iconDescription: "eye, phobia icon",
        effect: "Phobia debuff (-50% Evasion, +50% Physical damage received). Triggered by darkness.",
        cure: "Keep torch lit. Equip Everwatching talisman. This is the fear of darkness.",
        causedBy: ["Darkness", "Unlit areas", "Character-specific trait"]
    },
    "zoofobia": {
        name: "Zoofobia",
        altNames: ["Zoophobia"],
        iconDescription: "eye, phobia icon",
        effect: "Phobia debuff (-50% Evasion, +50% Physical damage received). Triggered by animals/creatures.",
        cure: "Avoid animal-type enemies. Equip Everwatching talisman. This is the fear of animals.",
        causedBy: ["Animal enemies", "Character-specific trait"]
    },
    "necrofobia": {
        name: "Necrofobia",
        altNames: ["Necrophobia"],
        iconDescription: "eye, phobia icon",
        effect: "Phobia debuff (-50% Evasion, +50% Physical damage received). Triggered by corpses and undead.",
        cure: "Avoid corpses and undead enemies. Equip Everwatching talisman. This is the fear of death/dead things.",
        causedBy: ["Undead enemies", "Corpses", "Character-specific trait"]
    },
    "fasmofobia": {
        name: "Fasmofobia",
        altNames: ["Phasmophobia"],
        iconDescription: "eye, phobia icon",
        effect: "Phobia debuff (-50% Evasion, +50% Physical damage received). Triggered by ghosts and spectral entities.",
        cure: "Avoid ghost-type enemies. Equip Everwatching talisman. This is the fear of ghosts/phantoms.",
        causedBy: ["Ghost enemies", "Spectral encounters", "Character-specific trait"]
    },
    "rabdofobia": {
        name: "Rabdofobia",
        altNames: ["Rhabdophobia"],
        iconDescription: "eye, phobia icon",
        effect: "Phobia debuff (-50% Evasion, +50% Physical damage received). Triggered by magic and being beaten/punished.",
        cure: "Avoid magic-using enemies. Equip Everwatching talisman. This is the fear of magic/being beaten.",
        causedBy: ["Magic attacks", "Being beaten", "Character-specific trait"]
    },
    "teratofobia": {
        name: "Teratofobia",
        altNames: ["Teratophobia"],
        iconDescription: "eye, phobia icon",
        effect: "Phobia debuff (-50% Evasion, +50% Physical damage received). Triggered by deformed creatures and monsters.",
        cure: "Avoid monster-type enemies. Equip Everwatching talisman. This is the fear of monsters/deformed beings.",
        causedBy: ["Monster enemies", "Deformed creatures", "Character-specific trait"]
    },
    "confused": {
        name: "Confused",
        iconDescription: "spiral, dizzy, confused icon",
        effect: "Skip 2 turns.",
        cure: "Wait 2 turns, end battle, or get hit by Locust swarm / Blunting attacks. Equipping Plate helmet, Gaunt bascinet or Penance armor causes it.",
        causedBy: ["Locust swarm", "Blunting attacks", "Gaunt bascinet helmet"]
    },
    "fracture": {
        name: "Fracture",
        iconDescription: "bone, crack, fracture icon",
        effect: "-20% Max Body (eventually -4% Max Body).",
        cure: "Marriage of Flesh, Favor from Lady of Moon. Caused by Blunting attacks.",
        causedBy: ["Blunting attacks", "Marriage of Flesh"]
    },
    "bleeding": {
        name: "Bleeding",
        altNames: ["Sangrando", "Sangrado", "Bleed"],
        iconDescription: "blood, drop, bleeding icon",
        effect: "-3% Body per turn.",
        cure: "Cloth fragment. Salmonsnake soul or Ring of the still-blood prevent. Caused by Stabbing, Chains of torment, arrow trap, rusty nails, losing limbs, Penance armor.",
        causedBy: ["Stabbing attacks", "Chains of torment", "Arrow trap", "Rusty nails", "Losing limbs", "Penance armor"]
    },
    "poisoned": {
        name: "Poisoned",
        altNames: ["Envenenado", "Envenenada", "Veneno", "Poison"],
        iconDescription: "green, poison, vial, poisoned icon",
        effect: "-10% Body per turn.",
        cure: "White vial, Mix of red and green. Thorned ring prevents. Caused by Cave spider, Lizardman, Cavedweller (Spear), Black witch, God of Fear and Hunger, Mumbler head kill, poison trap, Worm juice, Rotten food.",
        causedBy: ["Cave spider", "Lizardman", "Black witch", "Poison trap", "Worm juice", "Rotten food"]
    },
    "toxic": {
        name: "Toxic",
        altNames: ["Tóxico", "Tóxica", "Intoxicado", "Intoxicada"],
        iconDescription: "purple, toxic, severe poison icon",
        effect: "-20% Body per turn.",
        cure: "White vial, Mix of red and green. Caused by Body Snatcher toxic dart.",
        causedBy: ["Body Snatcher toxic dart"]
    },
    "infected_arm": {
        name: "Infected arm",
        altNames: ["Infección de brazo", "Brazo infectado", "Infected Arm"],
        iconDescription: "infection, arm, worm in arm, infected icon",
        effect: "Death if not treated in time (about 7 location changes).",
        cure: "Green herb, Mix of red and green. Salmonsnake soul or Ring of the still-blood prevent. Amputate with Bonesaw. Caused by Stabbing, Biting, Scratching, bookshelf rat.",
        causedBy: ["Stabbing", "Biting", "Scratching attacks", "Bookshelf rat"]
    },
    "infected_leg": {
        name: "Infected leg",
        altNames: ["Infección de pierna", "Pierna infectada", "Infected Leg"],
        iconDescription: "infection, leg, infected leg icon",
        effect: "Death if not treated.",
        cure: "Green herb, Mix of red and green. Amputate. Caused by Stabbing/Biting/Scratching, rusty nails.",
        causedBy: ["Stabbing", "Biting", "Scratching", "Rusty nails"]
    },
    "blindness": {
        name: "Blindness",
        altNames: ["Ceguera", "Ciego", "Ciega", "Blind"],
        iconDescription: "dark, black, blind, eye closed icon",
        effect: "-75% Hit Rate; screen turns black outside combat if on protagonist.",
        cure: "Equip Iron mask to prevent. Caused by Flock of crows.",
        causedBy: ["Flock of crows", "Iron mask causes it when equipped"]
    },
    "critical_state": {
        name: "Critical state",
        iconDescription: "critical, danger, skull, red icon",
        effect: "On enemy attack or heal, reduces Body to 1.",
        cure: "Salmonsnake soul, end battle, healing. Caused by Night Lurch, Embryo, Skin Granny skills.",
        causedBy: ["Night Lurch", "Embryo", "Skin Granny certain skills"]
    },
    "burning": {
        name: "Burning",
        altNames: ["Quemándose", "Quemado", "Quemada", "Ardiendo", "En llamas"],
        iconDescription: "fire, flame, burning icon",
        effect: "-10% Body per turn.",
        cure: "Salmonsnake soul, Water vial, end battle. Caused by Priest lantern, Iron Shakespeare Cinder, Francóis Pyromancy trick.",
        causedBy: ["Priest lantern", "Iron Shakespeare", "Francóis Pyromancy trick"]
    },
    "paralyzed": {
        name: "Paralyzed",
        iconDescription: "lightning, zap, paralyzed icon",
        effect: "Skip turns indefinitely.",
        cure: "End battle. Caused by Body Snatcher paralysis dart.",
        causedBy: ["Body Snatcher paralysis dart"]
    },
    "parasites": {
        name: "Parasites",
        altNames: ["Parásitos", "Parasito", "Gusanos"],
        iconDescription: "worm, worms, parasite icon, small worm icon",
        effect: "Doubles the depletion of Hunger.",
        cure: "Worm juice cures parasites. Caused by Maneba's Injection, Raw meat, Rotten meat, Rotten Meatpie.",
        causedBy: ["Maneba Injection", "Raw meat", "Rotten meat", "Rotten Meatpie"]
    },
    "brain_flower": {
        name: "Brain Flower",
        altNames: ["Flor cerebral", "Flor del cerebro", "Brain flower"],
        iconDescription: "flower, brain, flower on head icon",
        effect: "-50% Hit Rate, attacks random allies.",
        cure: "Worm juice. Caused by pollen from infected enemies.",
        causedBy: ["Pollen from infected enemies"]
    },
    "severe_anal_bleeding": {
        name: "Severe anal bleeding",
        iconDescription: "anal bleed, severe bleeding icon",
        effect: "Character pauses at random; heavy blood loss.",
        cure: "Marriage of Flesh, Lady of Moon favor. Caused by losing to Guard, Night Lurch attacks.",
        causedBy: ["Losing battle to Guard", "Night Lurch certain attacks"]
    },
    "curse": {
        name: "Curse",
        altNames: ["Maldición", "Maldito", "Maldita", "Cursed"],
        iconDescription: "curse, countdown, skull icon",
        effect: "Countdown from 5, -1 per turn; 0 = instant death.",
        cure: "Purifying talisman. Caused by Gro-goroth, Valteil.",
        causedBy: ["Gro-goroth", "Valteil"]
    },
    "soul_sucked": {
        name: "Soul Sucked",
        iconDescription: "soul, mind drain icon",
        effect: "-50% Max Mind, permanently (Marriage, Nas'hrah, Baby Demon, Ghoul).",
        cure: "Spirit Anchor, Marriage of Flesh, Lady of Moon favor. Caused by Mumbler Soul Binding.",
        causedBy: ["Mumbler Soul Binding"]
    },
    "ruin": {
        name: "Ruin (I-III)",
        altNames: ["Ruina", "Envejecimiento", "Ruin"],
        iconDescription: "ruin, age, aging icon",
        effect: "Rapidly ages character. Stage III = heart attack death.",
        cure: "Marriage of Flesh, Lady of Moon favor. Caused by Miner Spectre Ruin attack.",
        causedBy: ["Miner Spectre Ruin attack"]
    },
    "hunger": {
        name: "Hunger (I-V)",
        iconDescription: "hunger, stomach, empty stomach icon",
        effect: "I: Body max 90, 50% damage. II: max 80. III: max 70, 30% damage. IV: max 50, legs disabled. V: eyes disabled, max 30, starvation death.",
        cure: "Consuming any food (next hunger tick removes).",
        causedBy: ["Reaching hunger thresholds"]
    },
    "fear": {
        name: "Fear (I-V)",
        iconDescription: "fear, mind, sanity icon",
        effect: "Learn suicide skill (protagonist), panophobic, low mind events.",
        cure: "Sorcerer's stone in combat, Ale, Bottle of whiskey, Wine vial, Elixir of mind, Blue demon powder, Tobacco, Opium powder.",
        causedBy: []
    }
};

/**
 * Get status effect by name or by icon description (e.g. "worm icon" -> Parasites)
 */
FearHungerKB.getStatusEffect = function (nameOrDescription) {
    if (!nameOrDescription) return null;
    const q = nameOrDescription.toLowerCase().trim();
    for (const key in this.statusEffects) {
        const s = this.statusEffects[key];
        if (s.name.toLowerCase() === q || key.replace(/_/g, ' ') === q) return s;
        if (s.altNames && s.altNames.some(alt => alt.toLowerCase() === q)) return s;
        if (s.iconDescription && s.iconDescription.split(/,\s*/).some(desc => desc.toLowerCase().includes(q) || q.includes(desc.toLowerCase())))
            return s;
    }
    return null;
};

/**
 * Get status effect summary for AI prompt (all effects with icon hints)
 */
FearHungerKB.getStatusEffectsForPrompt = function () {
    const lines = [];
    for (const key in this.statusEffects) {
        const s = this.statusEffects[key];
        lines.push(`${s.name} (icon: ${s.iconDescription}): ${s.effect} Cure: ${s.cure}`);
    }
    return lines.join('\n');
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get enemy data by name (fuzzy matching)
 */
FearHungerKB.getEnemy = function (name) {
    if (!name) return null;
    const nameLower = name.toLowerCase();
    const normalized = nameLower.replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');

    // Spanish → English enemy name translation for game compatibility
    const esTranslations = {
        'guardia': 'guard', 'guardia de élite': 'elite_guard',
        'sacerdote': 'priest', 'esqueleto': 'skeleton',
        'maneba': 'maneba', 'mandíbula dentada': 'jaggedjaw',
        'gnomo de las cavernas': 'cavegnome', 'araña de las cuevas': 'cave_spider',
        'hombre lagarto': 'lizardman', 'mago lagarto amarillo': 'lizardmage',
        'acechador nocturno': 'night_lurch', 'habitante de las cavernas': 'cavedweller',
        'mago amarillo': 'yellow_mage', 'espectro minero': 'miner_spectre',
        'murmurador': 'mumbler', 'murmurador mayor': 'greater_mumbler',
        'escarabajo': 'scarab', 'guardián moonless': 'moonless_guard',
        'ghoul sangriento': 'bloody_man', 'ladrón de cuerpos': 'body_snatcher',
        'señor de las moscas': 'lord_of_flies', 'útero': 'uterus',
        'embrión': 'embryo', 'hombre rojo': 'red_man', 'cosechador': 'harvestman',
        'moldeado': 'male_molded', 'moldeada': 'female_molded',
        'plaga': 'blight', 'prisionero': 'prisoner', 'moonless': 'moonless',
        'devorador de cuervos': 'crow_mauler', 'hidra': 'human_hydra',
        'hidra humana': 'human_hydra', 'lobo solitario': 'moonless',
        'barras de hierro': 'iron_bars', 'puerta de metal': 'iron_bars',
        'puerta de madera': 'iron_bars',
        'mariposa': 'butterfly', 'bruja negra': 'black_witch',
        'shakespeare de hierro': 'iron_shakespeare', 'trortur': 'trortur',
        'caballero antiguo': 'old_knight', 'espectro asesino': 'assassin_spectre',
        'madre de las cavernas': 'cavemother', 'ser seymor': 'ser_seymor',
        'caballero demacrado': 'gaunt_knight', 'isayah': 'isayah',
        'salmonsnake': 'salmonsnake', 'abuela piel': 'skin_granny',
        'sin nombre': 'nameless', 'viejo guardián': 'old_guardian',
        'ángel blanco': 'white_angel', 'dama lunar': 'lady_of_moon',
        'valteil': 'valteil', 'atormentado': 'tormented_one',
        'francóis': 'francois', 'gran plaga': 'greater_blight',
        'huellas de sylvian': 'traces_sylvian', 'huellas de gro-goroth': 'traces_grogoroth',
        'dios del miedo y el hambre': 'god_of_fear_and_hunger',
        'caballero espectro': 'assassin_spectre',
        'rey amarillo': 'yellow_king'
    };

    // Try Spanish translation first
    const esKey = esTranslations[nameLower];
    if (esKey) {
        if (this.enemies[esKey]) return { ...this.enemies[esKey], key: esKey, isBoss: false };
        if (this.bosses[esKey]) return { ...this.bosses[esKey], key: esKey, isBoss: true };
    }

    // Check regular enemies (exact key, displayName, displayNameEs, altNames)
    for (const key in this.enemies) {
        const enemy = this.enemies[key];
        if (key === normalized ||
            enemy.displayName.toLowerCase() === nameLower ||
            (enemy.displayNameEs && enemy.displayNameEs.toLowerCase() === nameLower) ||
            (enemy.altNames && enemy.altNames.some(alt => alt.toLowerCase() === nameLower))) {
            return { ...enemy, key: key, isBoss: false };
        }
    }

    // Check bosses (exact key, displayName, displayNameEs, altNames)
    for (const key in this.bosses) {
        const boss = this.bosses[key];
        if (key === normalized ||
            boss.displayName.toLowerCase() === nameLower ||
            (boss.displayNameEs && boss.displayNameEs.toLowerCase() === nameLower) ||
            (boss.altNames && boss.altNames.some(alt => alt.toLowerCase() === nameLower))) {
            return { ...boss, key: key, isBoss: true };
        }
    }

    // Fuzzy match (includes check on both EN and ES names)
    const allEnemies = { ...this.enemies, ...this.bosses };
    for (const key in allEnemies) {
        const e = allEnemies[key];
        if (key.includes(normalized) || normalized.includes(key) ||
            e.displayName.toLowerCase().includes(nameLower) ||
            nameLower.includes(e.displayName.toLowerCase()) ||
            (e.displayNameEs && (e.displayNameEs.toLowerCase().includes(nameLower) ||
                nameLower.includes(e.displayNameEs.toLowerCase())))) {
            return { ...e, key: key, isBoss: !!e.boss };
        }
    }

    return null;
};

/**
 * Get item data by name
 */
FearHungerKB.getItem = function (name) {
    if (!name) return null;
    const ITEM_SYNONYMS = {
        'frasco': 'vial', 'pocion': 'vial', 'poción': 'vial',
        'botella': 'vial', 'pasto': 'hierba', 'planta': 'hierba',
        'trapo': 'fragmento de tela', 'tela': 'fragmento de tela',
        'vendaje': 'fragmento de tela', 'venda': 'fragmento de tela',
        'cura': 'fragmento de tela', 'antídoto': 'vial blanco',
        'antidoto': 'vial blanco', 'monoculo': 'monocle',
        'monóculo': 'monocle'
    };
    let expandedName = name;
    const words = name.toLowerCase().split(/\s+/);
    for (const word of words) {
        if (ITEM_SYNONYMS[word]) {
            expandedName = name.toLowerCase().replace(word, ITEM_SYNONYMS[word]);
            break;
        }
    }
    const normalized = expandedName.toLowerCase().replace(/[^a-záéíóúñü0-9]/g, '_').replace(/_+/g, '_');
    const nameLower = expandedName.toLowerCase();

    // Exact match: key, displayName, displayNameEs, or key-as-words
    for (const key in this.items) {
        const item = this.items[key];
        if (key === normalized ||
            item.displayName?.toLowerCase() === nameLower ||
            item.displayNameEs?.toLowerCase() === nameLower ||
            key.replace(/_/g, ' ') === nameLower) {
            return { ...item, key: key };
        }
        // Check aliases
        if (item.aliases) {
            for (const alias of item.aliases) {
                if (alias.toLowerCase() === nameLower) {
                    return { ...item, key: key };
                }
            }
        }
    }

    // Fuzzy match
    for (const key in this.items) {
        const item = this.items[key];
        if (key.includes(normalized) || normalized.includes(key)) {
            return { ...item, key: key };
        }
        // Fuzzy alias match
        if (item.aliases) {
            for (const alias of item.aliases) {
                const aliasNorm = alias.toLowerCase().replace(/[^a-záéíóúñü0-9]/g, '_').replace(/_+/g, '_');
                if (aliasNorm.includes(normalized) || normalized.includes(aliasNorm)) {
                    return { ...item, key: key };
                }
            }
        }
        // Fuzzy displayNameEs match
        if (item.displayNameEs) {
            const esNorm = item.displayNameEs.toLowerCase().replace(/[^a-záéíóúñü0-9]/g, '_').replace(/_+/g, '_');
            if (esNorm.includes(normalized) || normalized.includes(esNorm)) {
                return { ...item, key: key };
            }
        }
    }

    return null;
};

/**
 * Get location data by name
 */
FearHungerKB.getLocation = function (name) {
    if (!name) return null;
    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');

    for (const key in this.locations) {
        if (key === normalized ||
            this.locations[key].displayName.toLowerCase().includes(name.toLowerCase())) {
            return { ...this.locations[key], key: key };
        }
    }

    return null;
};

/**
 * Get character data by name
 */
FearHungerKB.getCharacter = function (name) {
    if (!name) return null;
    const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');

    for (const key in this.characters) {
        if (key === normalized ||
            this.characters[key].displayName.toLowerCase() === name.toLowerCase()) {
            return { ...this.characters[key], key: key };
        }
    }

    return null;
};

/**
 * Build combat prompt enhancement for an enemy
 */
FearHungerKB.getCombatPrompt = function (enemyName) {
    const enemy = this.getEnemy(enemyName);
    if (!enemy) return "";

    let prompt = `\n=== KNOWLEDGE: ${enemy.displayName} ===\n`;
    prompt += `Danger: ${enemy.danger}/10 | Confidence: ${Math.round(enemy.confidence * 100)}%\n`;

    if (enemy.limbPriority && enemy.limbPriority.length > 0) {
        prompt += `Limb Priority: ${enemy.limbPriority.join(' → ')}\n`;
    }

    if (enemy.coinFlipTurn) {
        prompt += `⚠️ COIN FLIP TURN: ${enemy.coinFlipTurn} - GUARD!\n`;
    }

    if (enemy.tactics) {
        prompt += `Tactics: ${enemy.tactics}\n`;
    }

    if (enemy.hints && enemy.hints.length > 0) {
        prompt += `Hints: ${enemy.hints.slice(0, 2).join('; ')}\n`;
    }

    if (enemy.mistakes && enemy.mistakes.length > 0) {
        prompt += `AVOID: ${enemy.mistakes[0]}\n`;
    }

    return prompt;
};

/**
 * Get all entity names for color coding
 */
FearHungerKB.getAllEntityNames = function () {
    const names = {
        enemies: [],
        items: [],
        locations: [],
        characters: []
    };

    for (const key in this.enemies) {
        names.enemies.push(this.enemies[key].displayName);
    }
    for (const key in this.bosses) {
        names.enemies.push(this.bosses[key].displayName);
    }
    for (const key in this.items) {
        names.items.push(key.replace(/_/g, ' '));
    }
    for (const key in this.locations) {
        names.locations.push(this.locations[key].displayName);
    }
    for (const key in this.characters) {
        names.characters.push(this.characters[key].displayName);
    }

    return names;
};

/**
 * Answer a question about an item
 */
FearHungerKB.askAboutItem = function (itemName) {
    const item = this.getItem(itemName);
    if (!item) return `I don't know about "${itemName}".`;

    let response = item.description || "";
    if (item.effect) response += ` Effect: ${item.effect}.`;
    if (item.tips) response += ` Tip: ${item.tips}`;
    if (item.source) response += ` Found: ${item.source.join(', ')}.`;

    return response;
};

/**
 * Get survival wisdom for general tips
 */
FearHungerKB.survivalWisdom = [
    "Always have cloth fragments for bleeding.",
    "Green herbs cure infection - stock up before Thicket.",
    "Red Vial blinds Crow Mauler - never fight it without one.",
    "Guard outfit lets you pass guards unnoticed.",
    "Human Hydra can't attack - use it to farm stats.",
    "Penance armor protects from instant death attacks.",
    "Coin flip attacks can be blocked by defending.",
    "Night Lurch accepts rotten meat via Talk option.",
    "Save soul stones for boss corpses - souls are powerful.",
    "Dagger or Peculiar Doll on Girl skips turns in final boss.",
    "Assassin's Handbook I teaches disguise crafting.",
    "Cavedweller merchants sell unique items.",
    "Gaunt Knight drops the best armor set.",
    "Pickpocket Trortur for the vault key.",
    "Counter-magic instantly kills Skeletons."
];

/**
 * Get enemy hints for AI context
 * Returns normalized object for AI consumption
 */
FearHungerKB.getEnemyHints = function (name) {
    const enemy = this.getEnemy(name);
    if (!enemy) return null;

    return {
        name: enemy.displayNameEs || enemy.displayName,
        priority: enemy.limbPriority || [],
        coinFlipTurn: enemy.coinFlipTurn || null,
        hints: enemy.hints || [],
        mistakes: enemy.mistakes || [],
        dangerLevel: enemy.danger !== undefined ? enemy.danger : 1,
        tactics: enemy.tactics || null,
        special: enemy.special || null
    };
};

// ============================================================================
// META — version, game info, confidence definitions
// ============================================================================
FearHungerKB.meta = {
    version: "2.1.0",
    game_version: "1.4",
    language: "es",
    confidence_note: "verified = wiki confirmed, partial = community data, inferred = AI-generated"
};

// ============================================================================
// CORE GAME MECHANICS — essential knowledge for the AI
// ============================================================================
FearHungerKB.gameMechanics = {
    coin_flip: {
        description: "Many enemies have a COIN FLIP turn — at a specific turn number, the game flips a coin. If you lose (50% chance), your character DIES INSTANTLY. This is the core survival mechanic of Fear & Hunger.",
        how_it_works: "On the coin flip turn, a coin is tossed. Heads = survive, Tails = instant death. There is NO way to guarantee survival.",
        strategy: "You MUST kill enemies or remove their ability to coin flip BEFORE the coin flip turn arrives. For guards (turn 2), kill their weapon arm or torso before turn 2. For skeletons (turn 3), you have more time.",
        key_info: "If a player says they 'failed the coin toss' or 'lost the coin flip', it means they DIED from an enemy's instant-kill move. Advise them to kill faster next time or target the right limb first."
    },
    no_leveling: {
        description: "Fear & Hunger has NO experience points and NO leveling system. Stats can only be increased through: (1) Equipping better gear, (2) Using stat-boosting items like Blue vials, (3) The Human Hydra with Ring of Wraiths or Sorcerer's Stone.",
        key_info: "NEVER mention 'leveling up', 'gaining XP', 'experience points', or 'level'. The game does not have these concepts."
    },
    limb_targeting: {
        description: "In combat, enemies have individual limbs (arms, legs, head, torso). Each limb is a separate target. Destroying limbs has specific effects: removing arms prevents attacks, removing legs prevents escape, destroying torso kills the enemy.",
        strategy: "Always prioritize the weapon arm or the limb that enables the enemy's most dangerous attack."
    },
    hunger: {
        description: "All characters get hungry over time. Hunger has 5 levels (Hambre LVL 1-5). At high hunger levels, characters lose stats and eventually die. Feed characters with food items to prevent this."
    },
    saving: {
        description: "The game only saves at specific ritual circles. Death is permanent — no auto-saves, no checkpoints."
    }
};

// ============================================================================
// QUERY API — efficient retrieval methods
// ============================================================================

/**
 * Fuzzy search across all entity types
 * @param {string} query - search term (partial, plural, or exact)
 * @returns {Array<{key: string, type: string, displayName: string, data: object, score: number}>}
 */
FearHungerKB.fuzzySearch = function (query) {
    if (!query) return [];
    const q = query.toLowerCase().replace(/s\b/g, '').trim(); // strip trailing plurals
    const results = [];

    const searchIn = (source, type) => {
        for (const key in source) {
            const data = source[key];
            const displayName = (data.displayName || key.replace(/_/g, ' ')).toLowerCase();
            const keyNorm = key.replace(/_/g, ' ');

            let score = 0;
            if (displayName === q || keyNorm === q) score = 1.0;
            else if (displayName.includes(q) || q.includes(displayName)) score = 0.8;
            else if (keyNorm.includes(q) || q.includes(keyNorm)) score = 0.7;
            else {
                // Word overlap
                const qWords = q.split(/\s+/).filter(w => w.length > 2);
                const nameWords = displayName.split(/\s+/).filter(w => w.length > 2);
                const overlap = qWords.filter(w => nameWords.some(nw => nw.includes(w) || w.includes(nw))).length;
                if (overlap > 0) score = 0.3 + (overlap / Math.max(qWords.length, nameWords.length)) * 0.4;
            }

            if (score > 0.2) {
                results.push({ key, type, displayName: data.displayName || key.replace(/_/g, ' '), data, score });
            }
        }
    };

    searchIn(this.items, 'item');
    searchIn(this.enemies, 'enemy');
    searchIn(this.bosses, 'boss');
    searchIn(this.characters, 'character');
    searchIn(this.locations, 'location');
    searchIn(this.npcs, 'npc');
    searchIn(this.gods, 'god');
    searchIn(this.statusEffects, 'status');

    return results.sort((a, b) => b.score - a.score).slice(0, 10);
};

/**
 * Find items by tag (when tags are available)
 */
FearHungerKB.findItemsByTag = function (tag) {
    const results = [];
    for (const key in this.items) {
        const item = this.items[key];
        if (item.tags && item.tags.includes(tag)) {
            results.push({ key, ...item });
        }
        // Fallback: check type field
        if (!item.tags && item.type === tag) {
            results.push({ key, ...item });
        }
    }
    return results;
};

/**
 * Find items that have a specific effect type
 */
FearHungerKB.findItemsByEffect = function (effectType) {
    const results = [];
    for (const key in this.items) {
        const item = this.items[key];
        if (item.effects && item.effects.some(e => e.type === effectType)) {
            results.push({ key, ...item });
        }
        // Fallback: check text effect field
        if (!item.effects && item.effect && item.effect.toLowerCase().includes(effectType.toLowerCase())) {
            results.push({ key, ...item });
        }
    }
    return results;
};

/**
 * Get all healing items (shortcut)
 */
FearHungerKB.getHealingItems = function () {
    return this.findItemsByEffect('heal').concat(
        this.findItemsByTag('healing')
    ).filter((v, i, a) => a.findIndex(t => t.key === v.key) === i); // dedupe
};

/**
 * Get formatted battle advice for an enemy
 */
FearHungerKB.getBattleAdvice = function (enemyName) {
    const enemy = this.getEnemy(enemyName);
    if (!enemy) return null;

    let advice = `=== ${enemy.displayName} ===\n`;
    advice += `Danger: ${enemy.danger}/10\n`;
    if (enemy.limbPriority && enemy.limbPriority.length) {
        advice += `Attack priority: ${enemy.limbPriority.join(' → ')}\n`;
    }
    if (enemy.coinFlipTurn) {
        advice += `⚠️ GUARD on turn ${enemy.coinFlipTurn}!\n`;
    }
    if (enemy.tactics) advice += `Strategy: ${enemy.tactics}\n`;
    if (enemy.weaknesses) advice += `Weaknesses: ${enemy.weaknesses.join(', ')}\n`;
    if (enemy.resistances) advice += `Resists: ${enemy.resistances.join(', ')}\n`;
    if (enemy.hints && enemy.hints.length) {
        advice += `Tips: ${enemy.hints.slice(0, 3).join('; ')}\n`;
    }
    if (enemy.mistakes && enemy.mistakes.length) {
        advice += `DON'T: ${enemy.mistakes.join('; ')}\n`;
    }
    return advice;
};

/**
 * Resolve a map ID to a location name
 * @param {number} mapId - RPG Maker map ID
 * @returns {string|null} - location display name or null
 */
FearHungerKB.resolveMapId = function (mapId) {
    for (const key in this.locations) {
        const loc = this.locations[key];
        if (loc.mapIds && loc.mapIds.includes(mapId)) {
            return loc.displayName;
        }
    }
    return null;
};

console.log("[FearHungerKB] Knowledge Base v" + FearHungerKB.meta.version + " loaded: " +
    Object.keys(FearHungerKB.enemies).length + " enemies, " +
    Object.keys(FearHungerKB.bosses).length + " bosses, " +
    Object.keys(FearHungerKB.items).length + " items, " +
    Object.keys(FearHungerKB.locations).length + " locations, " +
    Object.keys(FearHungerKB.characters).length + " characters, " +
    (FearHungerKB.statusEffects ? Object.keys(FearHungerKB.statusEffects).length : 0) + " status effects");
