// Generates js/data/pokedex.gen.js (all 1025 Pokémon as playable cards) and
// js/data/decks.js (18 type decks + special decks) from official PokeAPI data.
//
//   node tools/generate-pokedex.mjs [csvDir]
//
// With no argument the PokeAPI CSVs are fetched from GitHub; pass a directory
// containing pokemon.csv etc. to run offline. Card stats are derived
// deterministically from base stats, so regenerating is reproducible.

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSV_BASE = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv';
const csvDir = process.argv[2];

async function loadCsv(name) {
  let text;
  if (csvDir && existsSync(join(csvDir, `${name}.csv`))) {
    text = readFileSync(join(csvDir, `${name}.csv`), 'utf8');
  } else {
    const res = await fetch(`${CSV_BASE}/${name}.csv`);
    if (!res.ok) throw new Error(`fetch ${name}.csv: ${res.status}`);
    text = await res.text();
  }
  const [header, ...rows] = text.trim().split('\n');
  const cols = header.split(',');
  return rows.map((r) => {
    // PokeAPI CSVs quote fields containing commas.
    const cells = r.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) =>
      c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"'));
    return Object.fromEntries(cols.map((c, i) => [c, cells[i]]));
  });
}

const MAX_ID = 1025;

const [pokemon, ptypes, pstats, species, types, speciesNames] = await Promise.all([
  loadCsv('pokemon'), loadCsv('pokemon_types'), loadCsv('pokemon_stats'),
  loadCsv('pokemon_species'), loadCsv('types'), loadCsv('pokemon_species_names'),
]);

const typeName = new Map(types.map((t) => [t.id, t.identifier]));
const genus = new Map(speciesNames.filter((n) => n.local_language_id === '9')
  .map((n) => [Number(n.pokemon_species_id), n.genus]));

const mons = new Map(); // id -> record
for (const p of pokemon) {
  const id = Number(p.id);
  if (id > MAX_ID || p.is_default !== '1') continue;
  mons.set(id, { id, name: null, types: [], stats: {}, legendary: false, mythical: false, gen: 1 });
}
for (const s of species) {
  const id = Number(s.id);
  const m = mons.get(id);
  if (!m) continue;
  m.name = cap(s.identifier);
  m.legendary = s.is_legendary === '1';
  m.mythical = s.is_mythical === '1';
  m.gen = Number(s.generation_id);
}
for (const t of ptypes) {
  const m = mons.get(Number(t.pokemon_id));
  if (m) m.types[Number(t.slot) - 1] = typeName.get(t.type_id);
}
const STAT_KEYS = { 1: 'hp', 2: 'atk', 3: 'def', 4: 'spatk', 5: 'spdef', 6: 'speed' };
for (const s of pstats) {
  const m = mons.get(Number(s.pokemon_id));
  if (m) m.stats[STAT_KEYS[s.stat_id]] = Number(s.base_stat);
}

function cap(s) {
  // "mr-mime" -> "Mr. Mime"-ish; keep it simple but readable.
  const SPECIAL = {
    'nidoran-f': 'Nidoran♀', 'nidoran-m': 'Nidoran♂', 'mr-mime': 'Mr. Mime',
    'mime-jr': 'Mime Jr.', 'farfetchd': "Farfetch'd", 'sirfetchd': "Sirfetch'd",
    'ho-oh': 'Ho-Oh', 'porygon-z': 'Porygon-Z', 'type-null': 'Type: Null',
    'jangmo-o': 'Jangmo-o', 'hakamo-o': 'Hakamo-o', 'kommo-o': 'Kommo-o',
    'tapu-koko': 'Tapu Koko', 'tapu-lele': 'Tapu Lele', 'tapu-bulu': 'Tapu Bulu',
    'tapu-fini': 'Tapu Fini', 'mr-rime': 'Mr. Rime', 'great-tusk': 'Great Tusk',
    'scream-tail': 'Scream Tail', 'brute-bonnet': 'Brute Bonnet', 'flutter-mane': 'Flutter Mane',
    'slither-wing': 'Slither Wing', 'sandy-shocks': 'Sandy Shocks', 'iron-treads': 'Iron Treads',
    'iron-bundle': 'Iron Bundle', 'iron-hands': 'Iron Hands', 'iron-jugulis': 'Iron Jugulis',
    'iron-moth': 'Iron Moth', 'iron-thorns': 'Iron Thorns', 'wo-chien': 'Wo-Chien',
    'chien-pao': 'Chien-Pao', 'ting-lu': 'Ting-Lu', 'chi-yu': 'Chi-Yu',
    'roaring-moon': 'Roaring Moon', 'iron-valiant': 'Iron Valiant', 'walking-wake': 'Walking Wake',
    'iron-leaves': 'Iron Leaves', 'raging-bolt': 'Raging Bolt', 'iron-boulder': 'Iron Boulder',
    'iron-crown': 'Iron Crown', 'gouging-fire': 'Gouging Fire',
  };
  if (SPECIAL[s]) return SPECIAL[s];
  return s.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

// Primary card type: slot 1, except pure flavor upgrade when slot 1 is normal.
function cardType(m) {
  if (m.types[0] === 'normal' && m.types[1]) return m.types[1];
  return m.types[0];
}

// ---- deterministic card derivation ------------------------------------

const LIGHT_NAMES = {
  normal: ['Tackle', 'Quick Attack', 'Scratch', 'Headbutt', 'Pound'],
  fire: ['Ember', 'Flame Claw', 'Singe', 'Hot Snout', 'Fire Fang'],
  water: ['Bubble', 'Splash Jab', 'Aqua Jet', 'Water Gun', 'Fin Slap'],
  grass: ['Vine Whip', 'Razor Leaf', 'Seed Shot', 'Leafage', 'Sprout Slam'],
  electric: ['Spark', 'Jolt', 'Static Zap', 'Charge Beam', 'Shock Bite'],
  ice: ['Ice Shard', 'Frost Nip', 'Powder Snow', 'Chill Touch', 'Snowball'],
  fighting: ['Karate Chop', 'Low Kick', 'Jab', 'Double Kick', 'Palm Strike'],
  poison: ['Poison Sting', 'Acid', 'Sludge Toss', 'Venom Fang', 'Smog'],
  ground: ['Mud-Slap', 'Sand Attack', 'Dig Strike', 'Mud Shot', 'Stomp'],
  flying: ['Peck', 'Gust', 'Wing Slap', 'Air Cutter', 'Swoop'],
  psychic: ['Confusion', 'Psybeam', 'Mind Poke', 'Zen Jab', 'Psywave'],
  bug: ['Bug Bite', 'Fury Cutter', 'Pin Jab', 'String Shot', 'Twineedle'],
  rock: ['Rock Throw', 'Pebble Blast', 'Smack Down', 'Rock Tomb', 'Boulder Bash'],
  ghost: ['Lick', 'Shadow Sneak', 'Astonish', 'Night Shade', 'Spook'],
  dragon: ['Dragon Breath', 'Twister', 'Dragon Tail', 'Scale Slash', 'Fang Rush'],
  dark: ['Bite', 'Feint Attack', 'Snarl', 'Sucker Punch', 'Night Slash'],
  steel: ['Metal Claw', 'Bullet Punch', 'Iron Jab', 'Gyro Hit', 'Steel Fang'],
  fairy: ['Fairy Wind', 'Charm Strike', 'Sparkle Jab', 'Pixie Dust', 'Twinkle Tackle'],
};

const HEAVY_NAMES = {
  normal: ['Body Slam', 'Hyper Beam', 'Giga Impact', 'Double-Edge', 'Mega Kick'],
  fire: ['Flamethrower', 'Fire Blast', 'Heat Wave', 'Flare Blitz', 'Inferno'],
  water: ['Hydro Pump', 'Surf', 'Aqua Tail', 'Origin Pulse', 'Tidal Crash'],
  grass: ['Solar Beam', 'Leaf Storm', 'Power Whip', 'Giga Drain', 'Petal Blizzard'],
  electric: ['Thunderbolt', 'Thunder', 'Zap Cannon', 'Wild Charge', 'Volt Tackle'],
  ice: ['Ice Beam', 'Blizzard', 'Glacial Lance', 'Freeze-Dry', 'Avalanche'],
  fighting: ['Dynamic Punch', 'Close Combat', 'Aura Sphere', 'Sky Uppercut', 'Cross Chop'],
  poison: ['Sludge Bomb', 'Gunk Shot', 'Venoshock', 'Poison Jab', 'Toxic Flood'],
  ground: ['Earthquake', 'Earth Power', 'Precipice Blades', 'High Horsepower', 'Fissure'],
  flying: ['Brave Bird', 'Hurricane', 'Sky Attack', 'Aeroblast', 'Dual Wingbeat'],
  psychic: ['Psychic', 'Psystrike', 'Future Sight', 'Moonblast', 'Prismatic Laser'],
  bug: ['Megahorn', 'X-Scissor', 'Bug Buzz', 'First Impression', 'Leech Life'],
  rock: ['Stone Edge', 'Rock Slide', 'Head Smash', 'Rock Wrecker', 'Meteor Beam'],
  ghost: ['Shadow Ball', 'Phantom Force', 'Shadow Force', 'Spirit Shackle', 'Poltergeist'],
  dragon: ['Dragon Claw', 'Draco Meteor', 'Outrage', 'Dragon Rush', 'Roar of Time'],
  dark: ['Crunch', 'Dark Pulse', 'Foul Play', 'Wicked Blow', 'Night Daze'],
  steel: ['Iron Head', 'Meteor Mash', 'Flash Cannon', 'Heavy Slam', 'Behemoth Blade'],
  fairy: ['Moonblast', 'Play Rough', 'Dazzling Gleam', 'Light of Ruin', 'Spirit Break'],
};

// Heavy-attack side effects per type; picked by id so siblings differ.
function heavyEffect(type, id, dmg, legendary) {
  const pick = (arr) => arr[id % arr.length];
  const e = pick({
    fire: [{ burn: 0.4 }, { burn: 0.3 }, { recoil: 20 }],
    water: [{ heal: 20 }, null, { paralyze: 0.2 }],
    grass: [{ drain: true }, { heal: 20 }, null],
    electric: [{ paralyze: 0.3 }, { paralyze: 0.2 }, { recoil: 10 }],
    ice: [{ paralyze: 0.3 }, { snipe: 20 }, null],
    fighting: [{ recoil: 10 }, { paralyze: 0.2 }, null],
    poison: [{ poison: 0.5 }, { poison: 0.4 }, { drain: true }],
    ground: [{ snipe: 20 }, { recoil: 10 }, null],
    flying: [{ snipe: 10 }, { recoil: 20 }, null],
    psychic: [{ paralyze: 0.3 }, { shield: 20 }, { pierce: true }],
    bug: [{ drain: true }, { snipe: 10 }, null],
    rock: [{ recoil: 10 }, { snipe: 20 }, null],
    ghost: [{ drain: true }, { pierce: true }, { paralyze: 0.2 }],
    dragon: [null, { recoil: 20 }, { pierce: true }],
    dark: [{ drain: true }, { paralyze: 0.2 }, null],
    steel: [{ shield: 20 }, { pierce: true }, null],
    fairy: [{ heal: 20 }, { paralyze: 0.2 }, null],
    normal: [{ heal: 20 }, { paralyze: 0.2 }, null],
  }[type] || [null]);
  const out = { ...(e || {}) };
  // Big finishers dump energy so they can't be spammed.
  if (dmg >= 110) out.discardSelf = legendary && dmg >= 130 ? 2 : 1;
  return Object.keys(out).length ? out : null;
}

function buildCard(m) {
  const type = cardType(m);
  const bst = Object.values(m.stats).reduce((a, b) => a + b, 0);
  const off = Math.max(m.stats.atk, m.stats.spatk);
  const legendary = m.legendary || m.mythical;

  const hp = Math.max(50, Math.min(200, 40 + Math.round((m.stats.hp * 1.2) / 10) * 10));
  const retreat = m.stats.speed >= 110 ? 0 : m.stats.speed >= 85 ? 1 : m.stats.speed >= 55 ? 2 : m.stats.speed >= 30 ? 3 : 4;
  const rarity = legendary ? 'l' : bst >= 540 ? 'r' : bst >= 440 ? 'u' : 'c';

  const dmg1 = 10 + Math.min(3, Math.floor(off / 40)) * 10;
  const dmg2 = Math.max(20, Math.min(legendary ? 150 : 130, Math.round((off * 0.85) / 10) * 10));
  const cost2 = 2 + (bst >= 480 ? 1 : 0) + (bst >= 600 ? 1 : 0);

  const a1 = [LIGHT_NAMES[type][m.id % LIGHT_NAMES[type].length], 1, dmg1, null];
  const a2 = [HEAVY_NAMES[type][m.id % HEAVY_NAMES[type].length], cost2, dmg2,
    heavyEffect(type, m.id, dmg2, legendary)];

  return {
    id: m.id, name: m.name, type, hp, retreat, rarity,
    genus: genus.get(m.id) || '', gen: m.gen, bst,
    legendary, mythical: m.mythical, attacks: [a1, a2],
  };
}

const cards = [...mons.values()].sort((a, b) => a.id - b.id).map(buildCard);
console.log(`built ${cards.length} cards (${cards.filter((c) => c.legendary).length} legendary/mythical)`);

// ---- emit pokedex.gen.js ----------------------------------------------

const rows = cards.map((c) => JSON.stringify([
  c.id, c.name, c.type, c.hp, c.retreat, c.rarity, c.gen,
  c.genus, c.attacks[0], c.attacks[1],
]));
writeFileSync(join(ROOT, 'js/data/pokedex.gen.js'),
`// GENERATED by tools/generate-pokedex.mjs — do not edit by hand.
// Row: [id, name, type, hp, retreat, rarity(c/u/r/l), gen, genus,
//       [atkName, cost, damage, effect|null] x2]
export const POKEDEX_RAW = [
${rows.join(',\n')}
];
`);

// ---- emit decks.js ------------------------------------------------------

const byId = new Map(cards.map((c) => [c.id, c]));
const DEFAULT_TRAINERS = ['potion', 'switch', 'research', 'energize'];

// Deck strength scales with when the deck unlocks: early decks draw from the
// classic ~530-BST tier, late unlocks reach the 600-BST monsters.
function typeDeck(type, unlockLevel) {
  const cap = [540, 545, 550, 560, 570, 580, 590, 600, 620][unlockLevel] ?? 620;
  const pool = cards.filter((c) => c.type === type && !c.legendary && c.bst <= cap)
    .sort((a, b) => b.bst - a.bst);
  const top = pool.slice(0, 8).map((c) => c.id);
  return [...top, ...top.slice(0, 4), ...DEFAULT_TRAINERS];
}

const TYPE_DECK_META = {
  fire: ['Blaze Legion', '🔥', 'Aggressive burners that melt grass, bugs, ice and steel.', 0],
  water: ['Tidal Force', '🌊', 'Durable water attackers that drown fire and stone.', 0],
  grass: ['Verdant Bloom', '🌿', 'Draining strikers that feast on water, ground and rock.', 0],
  electric: ['Volt Storm', '⚡', 'Fast paralysis pressure. Terror of the seas and skies.', 1],
  normal: ['Wild Frontier', '⭐', 'Balanced bruisers with huge HP pools.', 1],
  bug: ['Swarm Tactics', '🐛', 'Relentless swarms that unsettle psychics and dark types.', 2],
  flying: ['Sky Riders', '🪽', 'Swift aerial hunters that dive on grass, bugs and brawlers.', 2],
  rock: ['Stone Wall', '🪨', 'Ancient armor. Crushes fire, ice and everything airborne.', 3],
  ground: ['Quake Makers', '⛰️', 'Earthshakers that bury fire, electric, poison and steel.', 3],
  fighting: ['Iron Fist', '🥊', 'Heavy hitters that flatten normal, rock, dark and steel.', 4],
  poison: ['Toxic Veil', '☠️', 'Corrosive attrition that poisons grass and fairies.', 4],
  psychic: ['Mind Benders', '🔮', 'Disruption, barriers and devastating late-game power.', 5],
  fairy: ['Moonlight Court', '🧚', 'Charming tricksters that end dragons and dark types.', 5],
  ice: ['Frostbite', '❄️', 'Freezing control that shatters dragons, grass and flyers.', 6],
  steel: ['Steel Bastion', '⚙️', 'Impenetrable armor with piercing counterattacks.', 6],
  dark: ['Midnight Pack', '🌙', 'Draining night hunters that stalk psychics and ghosts.', 7],
  ghost: ['Phantom Gate', '👻', 'Spirits that slip through barriers and drain the living.', 7],
  dragon: ['Dragon Fury', '🐉', 'Late-game monsters with colossal attacks.', 8],
};

const SPECIAL_DECKS = [
  { key: 'starters', name: 'Starter Legacy', icon: '🎒', unlockLevel: 8,
    desc: 'The fully evolved starters of Kanto, Johto and Hoenn.',
    cards: [3, 6, 9, 154, 157, 160, 254, 257, 260, 6, 9, 3, ...DEFAULT_TRAINERS] },
  { key: 'eevee', name: 'Eevee Family', icon: '🦊', unlockLevel: 9,
    desc: 'Every eeveelution, ready to adapt to any opponent.',
    cards: [134, 135, 136, 196, 197, 470, 471, 700, 133, 133, 133, 133, ...DEFAULT_TRAINERS] },
  { key: 'mythic', name: 'Mythic Whisper', icon: '🌠', unlockLevel: 9,
    desc: 'Elusive mythical Pokémon from every corner of the world.',
    cards: [151, 251, 385, 490, 491, 492, 494, 647, 719, 720, 802, 807, ...DEFAULT_TRAINERS] },
  { key: 'legends', name: 'Legends Awakened', icon: '🌟', unlockLevel: 10,
    desc: 'The champions’ reward: a deck of pure legend.',
    cards: [150, 249, 250, 382, 383, 384, 483, 484, 487, 643, 644, 493, ...DEFAULT_TRAINERS] },
];

const deckObjs = [
  ...Object.entries(TYPE_DECK_META).map(([type, [name, icon, desc, unlockLevel]]) => ({
    key: type, name, icon, desc, unlockLevel, cards: typeDeck(type, unlockLevel),
  })),
  ...SPECIAL_DECKS,
];

for (const d of deckObjs) {
  for (const c of d.cards) {
    if (typeof c === 'number' && !byId.has(c)) throw new Error(`deck ${d.key}: unknown id ${c}`);
  }
}

writeFileSync(join(ROOT, 'js/data/decks.js'),
`// GENERATED by tools/generate-pokedex.mjs — do not edit by hand.
// ${deckObjs.length} player decks: one per type plus special sets. Each deck is
// 12 Pokémon (ids) + 4 trainer cards (strings). unlockLevel is the campaign
// level that must be beaten before the deck opens (0 = available from start).

export const DECKS = ${JSON.stringify(deckObjs, null, 2)};

export function getDeck(key) {
  const d = DECKS.find((x) => x.key === key);
  if (!d) throw new Error(\`Unknown deck: \${key}\`);
  return d;
}
`);

console.log(`wrote ${deckObjs.length} decks`);
