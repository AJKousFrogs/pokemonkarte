// The full Pokédex. Every card in the game references one of these entries.
//
// Attack effect vocabulary (interpreted by the battle engine):
//   heal: n         heal the attacker n HP after dealing damage
//   recoil: n       attacker takes n damage
//   paralyze: p     chance (0..1) to paralyze the defender (skips its next attack)
//   burn: p         chance (0..1) to burn the defender (10 damage per turn)
//   drain: true     heal the attacker for half the damage dealt
//   snipe: n        also hit one random benched enemy for n
//   discardSelf: n  discard n energy from the attacker after the attack
//   pierce: true    damage is never resisted (multiplier is at least 1x)
//   shield: n       reduce the next damage this Pokémon takes by n

export const POKEDEX = [
  // ---- Regulars -------------------------------------------------------
  { id: 3,   name: 'Venusaur',   type: 'grass',    hp: 120, retreat: 3, rarity: 'rare',
    desc: 'The flower on its back releases a soothing scent.',
    attacks: [
      { name: 'Razor Leaf',   cost: 1, damage: 30 },
      { name: 'Solar Beam',   cost: 3, damage: 70 },
    ] },
  { id: 6,   name: 'Charizard',  type: 'fire',     hp: 130, retreat: 3, rarity: 'rare',
    desc: 'Its fiery breath can melt boulders.',
    attacks: [
      { name: 'Flame Claw',   cost: 1, damage: 30 },
      { name: 'Fire Blast',   cost: 3, damage: 90, effect: { discardSelf: 1 } },
    ] },
  { id: 9,   name: 'Blastoise',  type: 'water',    hp: 130, retreat: 3, rarity: 'rare',
    desc: 'The jets of water it spouts can punch through steel.',
    attacks: [
      { name: 'Bite',         cost: 1, damage: 30 },
      { name: 'Hydro Pump',   cost: 3, damage: 80 },
    ] },
  { id: 25,  name: 'Pikachu',    type: 'electric', hp: 60,  retreat: 1, rarity: 'common',
    desc: 'It stores electricity in its cheek pouches.',
    attacks: [
      { name: 'Quick Attack', cost: 1, damage: 20 },
      { name: 'Thunder Jolt', cost: 2, damage: 40, effect: { paralyze: 0.3 } },
    ] },
  { id: 26,  name: 'Raichu',     type: 'electric', hp: 90,  retreat: 1, rarity: 'uncommon',
    desc: 'Its tail discharges electricity into the ground.',
    attacks: [
      { name: 'Spark',        cost: 1, damage: 30 },
      { name: 'Thunderbolt',  cost: 3, damage: 80, effect: { discardSelf: 1 } },
    ] },
  { id: 38,  name: 'Ninetales',  type: 'fire',     hp: 90,  retreat: 1, rarity: 'uncommon',
    desc: 'Each of its nine tails holds a mystical power.',
    attacks: [
      { name: 'Will-O-Wisp',  cost: 1, damage: 20, effect: { burn: 0.5 } },
      { name: 'Fire Spin',    cost: 2, damage: 50 },
    ] },
  { id: 59,  name: 'Arcanine',   type: 'fire',     hp: 110, retreat: 2, rarity: 'uncommon',
    desc: 'A legendary Chinese Pokémon admired for its beauty.',
    attacks: [
      { name: 'Flame Wheel',  cost: 2, damage: 40, effect: { heal: 10 } },
      { name: 'Flare Blitz',  cost: 3, damage: 80, effect: { recoil: 20 } },
    ] },
  { id: 65,  name: 'Alakazam',   type: 'psychic',  hp: 80,  retreat: 1, rarity: 'rare',
    desc: 'Its brain cells multiply until it dies.',
    attacks: [
      { name: 'Confusion',    cost: 1, damage: 20, effect: { paralyze: 0.3 } },
      { name: 'Psychic',      cost: 3, damage: 70 },
    ] },
  { id: 68,  name: 'Machamp',    type: 'fighting', hp: 120, retreat: 2, rarity: 'rare',
    desc: 'It punches with its four arms at blinding speed.',
    attacks: [
      { name: 'Karate Chop',  cost: 1, damage: 30 },
      { name: 'Dynamic Punch',cost: 3, damage: 80, effect: { paralyze: 0.25 } },
    ] },
  { id: 76,  name: 'Golem',      type: 'fighting', hp: 120, retreat: 3, rarity: 'uncommon',
    desc: 'Its boulder-like body is extremely hard.',
    attacks: [
      { name: 'Rock Throw',   cost: 1, damage: 30 },
      { name: 'Earthquake',   cost: 3, damage: 70, effect: { recoil: 10 } },
    ] },
  { id: 94,  name: 'Gengar',     type: 'dark',     hp: 90,  retreat: 1, rarity: 'rare',
    desc: 'It hides in shadows and steals the life of its prey.',
    attacks: [
      { name: 'Lick',         cost: 1, damage: 20, effect: { paralyze: 0.4 } },
      { name: 'Shadow Ball',  cost: 3, damage: 70, effect: { drain: true } },
    ] },
  { id: 95,  name: 'Onix',       type: 'fighting', hp: 100, retreat: 3, rarity: 'common',
    desc: 'It burrows through the ground at fifty miles per hour.',
    attacks: [
      { name: 'Tackle',       cost: 1, damage: 20 },
      { name: 'Rock Slide',   cost: 2, damage: 40, effect: { snipe: 10 } },
    ] },
  { id: 103, name: 'Exeggutor',  type: 'grass',    hp: 100, retreat: 2, rarity: 'uncommon',
    desc: 'Each of its three heads thinks independently.',
    attacks: [
      { name: 'Seed Bomb',    cost: 1, damage: 30 },
      { name: 'Egg Barrage',  cost: 3, damage: 60, effect: { snipe: 20 } },
    ] },
  { id: 112, name: 'Rhydon',     type: 'fighting', hp: 110, retreat: 3, rarity: 'uncommon',
    desc: 'Its horn can crush even uncut diamonds.',
    attacks: [
      { name: 'Horn Attack',  cost: 1, damage: 30 },
      { name: 'Horn Drill',   cost: 3, damage: 80 },
    ] },
  { id: 121, name: 'Starmie',    type: 'water',    hp: 80,  retreat: 1, rarity: 'uncommon',
    desc: 'Its central core glows with the seven colors of the rainbow.',
    attacks: [
      { name: 'Swift',        cost: 1, damage: 20, effect: { pierce: true } },
      { name: 'Bubble Beam',  cost: 2, damage: 40, effect: { paralyze: 0.2 } },
    ] },
  { id: 123, name: 'Scyther',    type: 'grass',    hp: 80,  retreat: 0, rarity: 'uncommon',
    desc: 'Its blade-like forearms slice through logs.',
    attacks: [
      { name: 'Fury Cutter',  cost: 1, damage: 30 },
      { name: 'Slash',        cost: 2, damage: 50 },
    ] },
  { id: 125, name: 'Electabuzz', type: 'electric', hp: 90,  retreat: 1, rarity: 'common',
    desc: 'It appears near power plants during blackouts.',
    attacks: [
      { name: 'Thunder Punch',cost: 2, damage: 40 },
      { name: 'Discharge',    cost: 3, damage: 60, effect: { paralyze: 0.2 } },
    ] },
  { id: 130, name: 'Gyarados',   type: 'water',    hp: 120, retreat: 3, rarity: 'rare',
    desc: 'Once it appears, it goes on a rampage until everything is destroyed.',
    attacks: [
      { name: 'Thrash',       cost: 2, damage: 50, effect: { recoil: 10 } },
      { name: 'Hyper Beam',   cost: 4, damage: 100, effect: { discardSelf: 2 } },
    ] },
  { id: 131, name: 'Lapras',     type: 'water',    hp: 110, retreat: 2, rarity: 'uncommon',
    desc: 'It ferries people across the sea on its back.',
    attacks: [
      { name: 'Ice Beam',     cost: 2, damage: 40, effect: { paralyze: 0.3 } },
      { name: 'Surf',         cost: 3, damage: 60 },
    ] },
  { id: 134, name: 'Vaporeon',   type: 'water',    hp: 100, retreat: 1, rarity: 'uncommon',
    desc: 'Its cell structure is similar to water molecules.',
    attacks: [
      { name: 'Aqua Ring',    cost: 1, damage: 20, effect: { heal: 20 } },
      { name: 'Water Pulse',  cost: 2, damage: 50 },
    ] },
  { id: 135, name: 'Jolteon',    type: 'electric', hp: 80,  retreat: 0, rarity: 'uncommon',
    desc: 'It concentrates negative ions to fire off lightning.',
    attacks: [
      { name: 'Double Kick',  cost: 1, damage: 30 },
      { name: 'Pin Missile',  cost: 2, damage: 40, effect: { snipe: 20 } },
    ] },
  { id: 136, name: 'Flareon',    type: 'fire',     hp: 90,  retreat: 1, rarity: 'uncommon',
    desc: 'Its body temperature can reach 1,650 degrees.',
    attacks: [
      { name: 'Ember',        cost: 1, damage: 30, effect: { burn: 0.3 } },
      { name: 'Flame Burst',  cost: 2, damage: 50 },
    ] },
  { id: 143, name: 'Snorlax',    type: 'normal',   hp: 140, retreat: 4, rarity: 'rare',
    desc: 'It eats 900 pounds of food every day, then sleeps.',
    attacks: [
      { name: 'Rest',         cost: 1, damage: 0, effect: { heal: 40 } },
      { name: 'Body Slam',    cost: 3, damage: 70, effect: { paralyze: 0.3 } },
    ] },
  { id: 149, name: 'Dragonite',  type: 'dragon',   hp: 130, retreat: 2, rarity: 'rare',
    desc: 'It circles the globe in just sixteen hours.',
    attacks: [
      { name: 'Wing Attack',  cost: 2, damage: 40 },
      { name: 'Dragon Rush',  cost: 4, damage: 100 },
    ] },
  { id: 181, name: 'Ampharos',   type: 'electric', hp: 110, retreat: 2, rarity: 'uncommon',
    desc: 'The light from its tail can be seen from space.',
    attacks: [
      { name: 'Zap Cannon',   cost: 3, damage: 60, effect: { paralyze: 0.4 } },
      { name: 'Giga Volt',    cost: 4, damage: 90, effect: { discardSelf: 1 } },
    ] },
  { id: 196, name: 'Espeon',     type: 'psychic',  hp: 90,  retreat: 0, rarity: 'uncommon',
    desc: 'It predicts its foe’s actions with its fine hair.',
    attacks: [
      { name: 'Psybeam',      cost: 1, damage: 30 },
      { name: 'Morning Sun',  cost: 2, damage: 40, effect: { heal: 20 } },
    ] },
  { id: 197, name: 'Umbreon',    type: 'dark',     hp: 100, retreat: 1, rarity: 'uncommon',
    desc: 'When agitated, it sprays a poisonous sweat.',
    attacks: [
      { name: 'Feint Attack', cost: 1, damage: 30, effect: { pierce: true } },
      { name: 'Moonlight Fang', cost: 2, damage: 40, effect: { drain: true } },
    ] },
  { id: 212, name: 'Scizor',     type: 'steel',    hp: 100, retreat: 1, rarity: 'rare',
    desc: 'Its steel pincers are harder than diamond.',
    attacks: [
      { name: 'Metal Claw',   cost: 1, damage: 30 },
      { name: 'Bullet Punch', cost: 2, damage: 50 },
    ] },
  { id: 229, name: 'Houndoom',   type: 'dark',     hp: 90,  retreat: 1, rarity: 'uncommon',
    desc: 'Its eerie howl makes other Pokémon tremble.',
    attacks: [
      { name: 'Dark Fang',    cost: 1, damage: 30 },
      { name: 'Inferno Howl', cost: 3, damage: 60, effect: { burn: 0.5 } },
    ] },
  { id: 248, name: 'Tyranitar',  type: 'dark',     hp: 140, retreat: 3, rarity: 'rare',
    desc: 'Its rampages level mountains and bury rivers.',
    attacks: [
      { name: 'Crunch',       cost: 2, damage: 50 },
      { name: 'Stone Edge',   cost: 4, damage: 110, effect: { discardSelf: 1 } },
    ] },
  { id: 254, name: 'Sceptile',   type: 'grass',    hp: 100, retreat: 1, rarity: 'rare',
    desc: 'The leaves on its arms are as sharp as swords.',
    attacks: [
      { name: 'Leaf Blade',   cost: 2, damage: 50 },
      { name: 'Giga Drain',   cost: 3, damage: 60, effect: { drain: true } },
    ] },
  { id: 257, name: 'Blaziken',   type: 'fire',     hp: 110, retreat: 1, rarity: 'rare',
    desc: 'Its kicks can shatter concrete.',
    attacks: [
      { name: 'Blaze Kick',   cost: 2, damage: 50, effect: { burn: 0.2 } },
      { name: 'Sky Uppercut', cost: 3, damage: 80 },
    ] },
  { id: 260, name: 'Swampert',   type: 'water',    hp: 120, retreat: 2, rarity: 'rare',
    desc: 'It can swim while towing a large ship.',
    attacks: [
      { name: 'Mud Shot',     cost: 1, damage: 30 },
      { name: 'Muddy Water',  cost: 3, damage: 70 },
    ] },
  { id: 282, name: 'Gardevoir',  type: 'psychic',  hp: 100, retreat: 1, rarity: 'rare',
    desc: 'It will create a small black hole to protect its trainer.',
    attacks: [
      { name: 'Calm Mind',    cost: 1, damage: 0, effect: { shield: 30 } },
      { name: 'Moonblast',    cost: 3, damage: 70 },
    ] },
  { id: 359, name: 'Absol',      type: 'dark',     hp: 90,  retreat: 1, rarity: 'uncommon',
    desc: 'It appears when it senses an impending disaster.',
    attacks: [
      { name: 'Night Slash',  cost: 1, damage: 30 },
      { name: 'Doom Blade',   cost: 3, damage: 70 },
    ] },
  { id: 376, name: 'Metagross',  type: 'steel',    hp: 130, retreat: 3, rarity: 'rare',
    desc: 'Four brains joined by a complex neural network.',
    attacks: [
      { name: 'Iron Head',    cost: 2, damage: 50 },
      { name: 'Meteor Mash',  cost: 4, damage: 90 },
    ] },
  { id: 445, name: 'Garchomp',   type: 'dragon',   hp: 120, retreat: 1, rarity: 'rare',
    desc: 'It flies at sonic speed to hunt its prey.',
    attacks: [
      { name: 'Dragon Claw',  cost: 2, damage: 50 },
      { name: 'Draco Meteor', cost: 4, damage: 110, effect: { discardSelf: 2 } },
    ] },
  { id: 448, name: 'Lucario',    type: 'fighting', hp: 100, retreat: 1, rarity: 'rare',
    desc: 'It reads its opponent’s aura to predict attacks.',
    attacks: [
      { name: 'Force Palm',   cost: 1, damage: 30, effect: { paralyze: 0.2 } },
      { name: 'Aura Sphere',  cost: 3, damage: 70, effect: { pierce: true } },
    ] },
  { id: 461, name: 'Weavile',    type: 'ice',      hp: 80,  retreat: 0, rarity: 'uncommon',
    desc: 'It attacks in perfectly coordinated packs.',
    attacks: [
      { name: 'Ice Shard',    cost: 1, damage: 30 },
      { name: 'Night Slash',  cost: 2, damage: 50 },
    ] },
  { id: 466, name: 'Electivire', type: 'electric', hp: 110, retreat: 2, rarity: 'rare',
    desc: 'It pushes voltage through its tails into its foes.',
    attacks: [
      { name: 'Wild Charge',  cost: 2, damage: 50, effect: { recoil: 10 } },
      { name: 'Giga Impact',  cost: 4, damage: 100, effect: { discardSelf: 1 } },
    ] },
  { id: 635, name: 'Hydreigon',  type: 'dragon',   hp: 120, retreat: 2, rarity: 'rare',
    desc: 'Its three heads devour anything that moves.',
    attacks: [
      { name: 'Tri Attack',   cost: 2, damage: 40, effect: { snipe: 20 } },
      { name: 'Dragon Pulse', cost: 4, damage: 90 },
    ] },

  // ---- Legendaries ----------------------------------------------------
  { id: 144, name: 'Articuno',   type: 'ice',      hp: 120, retreat: 2, rarity: 'legendary',
    desc: 'A legendary bird that freezes the air around it.',
    attacks: [
      { name: 'Frost Wind',   cost: 2, damage: 40, effect: { paralyze: 0.4 } },
      { name: 'Blizzard',     cost: 4, damage: 90, effect: { snipe: 20 } },
    ] },
  { id: 145, name: 'Zapdos',     type: 'electric', hp: 120, retreat: 2, rarity: 'legendary',
    desc: 'A legendary bird said to live inside thunderclouds.',
    attacks: [
      { name: 'Static Field', cost: 2, damage: 40, effect: { paralyze: 0.3 } },
      { name: 'Thunder Storm',cost: 4, damage: 100, effect: { recoil: 20 } },
    ] },
  { id: 146, name: 'Moltres',    type: 'fire',     hp: 120, retreat: 2, rarity: 'legendary',
    desc: 'A legendary bird whose wings burn with eternal flame.',
    attacks: [
      { name: 'Wing Ember',   cost: 2, damage: 40, effect: { burn: 0.4 } },
      { name: 'Sky Inferno',  cost: 4, damage: 100, effect: { discardSelf: 1 } },
    ] },
  { id: 150, name: 'Mewtwo',     type: 'psychic',  hp: 140, retreat: 2, rarity: 'legendary',
    desc: 'A Pokémon created by genetic manipulation.',
    attacks: [
      { name: 'Barrier',      cost: 1, damage: 20, effect: { shield: 30 } },
      { name: 'Psystrike',    cost: 4, damage: 120, effect: { pierce: true } },
    ] },
  { id: 151, name: 'Mew',        type: 'psychic',  hp: 100, retreat: 0, rarity: 'legendary',
    desc: 'Said to contain the genetic code of all Pokémon.',
    attacks: [
      { name: 'Ancient Power',cost: 2, damage: 40, effect: { heal: 20 } },
      { name: 'Genesis Wave', cost: 3, damage: 70, effect: { pierce: true } },
    ] },
  { id: 249, name: 'Lugia',      type: 'psychic',  hp: 140, retreat: 2, rarity: 'legendary',
    desc: 'The guardian of the seas, sleeping in a deep trench.',
    attacks: [
      { name: 'Aeroblast',    cost: 3, damage: 70 },
      { name: 'Tempest Wing', cost: 4, damage: 110, effect: { discardSelf: 1 } },
    ] },
  { id: 250, name: 'Ho-Oh',      type: 'fire',     hp: 140, retreat: 2, rarity: 'legendary',
    desc: 'Its feathers bring eternal happiness.',
    attacks: [
      { name: 'Sacred Flame', cost: 3, damage: 60, effect: { burn: 0.5 } },
      { name: 'Sunset Blaze', cost: 4, damage: 110, effect: { recoil: 20 } },
    ] },
  { id: 382, name: 'Kyogre',     type: 'water',    hp: 150, retreat: 3, rarity: 'legendary',
    desc: 'It expanded the oceans with torrential rain.',
    attacks: [
      { name: 'Deep Current', cost: 2, damage: 40, effect: { heal: 20 } },
      { name: 'Origin Pulse', cost: 4, damage: 120, effect: { discardSelf: 1 } },
    ] },
  { id: 383, name: 'Groudon',    type: 'fighting', hp: 150, retreat: 4, rarity: 'legendary',
    desc: 'It raised the continents from the sea.',
    attacks: [
      { name: 'Magma Fist',   cost: 2, damage: 50 },
      { name: 'Precipice Blades', cost: 4, damage: 120, effect: { recoil: 20 } },
    ] },
  { id: 384, name: 'Rayquaza',   type: 'dragon',   hp: 150, retreat: 2, rarity: 'legendary',
    desc: 'It lives in the ozone layer, descending only to quell clashes.',
    attacks: [
      { name: 'Dragon Ascent',cost: 3, damage: 70 },
      { name: 'Sky Judgment', cost: 5, damage: 140, effect: { discardSelf: 2 } },
    ] },
  { id: 483, name: 'Dialga',     type: 'steel',    hp: 140, retreat: 3, rarity: 'legendary',
    desc: 'It has the power to control time itself.',
    attacks: [
      { name: 'Metal Burst',  cost: 2, damage: 50 },
      { name: 'Roar of Time', cost: 4, damage: 120, effect: { discardSelf: 2 } },
    ] },
  { id: 484, name: 'Palkia',     type: 'water',    hp: 140, retreat: 3, rarity: 'legendary',
    desc: 'It can distort space with a single thought.',
    attacks: [
      { name: 'Aqua Rift',    cost: 2, damage: 50 },
      { name: 'Spacial Rend', cost: 4, damage: 110, effect: { snipe: 20 } },
    ] },
  { id: 487, name: 'Giratina',   type: 'dragon',   hp: 150, retreat: 3, rarity: 'legendary',
    desc: 'Banished to the Distortion World for its violence.',
    attacks: [
      { name: 'Shadow Force', cost: 3, damage: 70, effect: { pierce: true } },
      { name: 'Distortion Rend', cost: 4, damage: 110, effect: { drain: true } },
    ] },
  { id: 491, name: 'Darkrai',    type: 'dark',     hp: 120, retreat: 1, rarity: 'legendary',
    desc: 'It lulls its foes into endless nightmares.',
    attacks: [
      { name: 'Bad Dreams',   cost: 2, damage: 40, effect: { paralyze: 0.5 } },
      { name: 'Dark Void',    cost: 4, damage: 90, effect: { drain: true } },
    ] },
  { id: 493, name: 'Arceus',     type: 'normal',   hp: 160, retreat: 2, rarity: 'legendary',
    desc: 'The Original One, said to have shaped the universe.',
    attacks: [
      { name: 'Cosmic Barrier', cost: 2, damage: 40, effect: { shield: 40 } },
      { name: 'Judgment',     cost: 5, damage: 150, effect: { pierce: true, discardSelf: 2 } },
    ] },
];

const BY_ID = new Map(POKEDEX.map((p) => [p.id, p]));

export function getPokemon(id) {
  const p = BY_ID.get(id);
  if (!p) throw new Error(`Unknown Pokémon id: ${id}`);
  return p;
}

export const LEGENDARY_IDS = POKEDEX.filter((p) => p.rarity === 'legendary').map((p) => p.id);
