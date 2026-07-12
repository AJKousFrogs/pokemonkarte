// The full Pokédex: all 1025 Pokémon, expanded from the generated compact
// data in pokedex.gen.js (see tools/generate-pokedex.mjs).
//
// Attack effect vocabulary (interpreted by the battle engine):
//   heal: n         heal the attacker n HP after dealing damage
//   recoil: n       attacker takes n damage
//   paralyze: p     chance (0..1) to paralyze the defender (skips its next attack)
//   burn: p         chance (0..1) to burn the defender (20 between turns, coin-flip cure)
//   poison: p       chance (0..1) to poison the defender (10 between turns, no self-cure)
//   drain: true     heal the attacker for half the damage dealt
//   snipe: n        also hit one random benched enemy for n
//   discardSelf: n  discard n energy from the attacker after the attack
//   pierce: true    damage is never resisted (multiplier is at least 1x)
//   shield: n       reduce the next damage this Pokémon takes by n

import { POKEDEX_RAW } from './pokedex.gen.js';

const RARITY = { c: 'common', u: 'uncommon', r: 'rare', l: 'legendary' };

function expandAttack([name, cost, damage, effect]) {
  return effect ? { name, cost, damage, effect } : { name, cost, damage };
}

export const POKEDEX = POKEDEX_RAW.map(
  ([id, name, type, hp, retreat, rarity, gen, genusText, a1, a2]) => ({
    id, name, type, hp, retreat,
    rarity: RARITY[rarity],
    gen,
    desc: genusText,
    attacks: [expandAttack(a1), expandAttack(a2)],
  }));

const BY_ID = new Map(POKEDEX.map((p) => [p.id, p]));

export function getPokemon(id) {
  const p = BY_ID.get(id);
  if (!p) throw new Error(`Unknown Pokémon id: ${id}`);
  return p;
}

export const LEGENDARY_IDS = POKEDEX.filter((p) => p.rarity === 'legendary').map((p) => p.id);

// Every Pokémon's own photo, served from the PokeAPI sprite CDN (same source
// the original Phantom Gate build used). Ordered best-first; the UI falls
// back down the list if an image fails to load.
const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

export function artSources(id) {
  return [
    `${SPRITES}/other/official-artwork/${id}.png`,
    `${SPRITES}/other/home/${id}.png`,
    `${SPRITES}/${id}.png`,
  ];
}
