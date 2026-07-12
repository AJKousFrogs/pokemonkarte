// The campaign. Levels get progressively harder to win:
//   - smarter AI tiers (random → greedy → strategic)
//   - enemy stat handicaps (bonus HP / bonus damage)
//   - extra enemy energy income (doubleEnergyEvery)
//   - trainer cards in enemy decks (the AI knows how to use them)
//   - asymmetric prize targets (you must score more KOs than the AI needs)
//   - bigger boss decks (deck-out pressure works against you, not them)
//   - smaller starting hands for the player at the top of the ladder
//
// Enemy decks mix Pokédex ids (numbers) and trainer cards (strings).
// Beating a level marks its enemy Pokémon as seen, catches the reward
// Pokémon, and unlocks any deck whose unlockLevel it satisfies.

export const LEVELS = [
  {
    id: 1,
    trainer: 'Youngster Ben',
    title: 'Route 1 Scuffle',
    icon: '🧢',
    ai: 'random',
    deck: [16, 19, 10, 13, 21, 25, 32, 43, 54, 66, 74, 69],
    aiHpBonus: 0, aiDamageBonus: 0, doubleEnergyEvery: 0,
    playerHandSize: 5, playerPrizeTarget: 3, aiPrizeTarget: 4,
    rewardCatch: [25, 16, 21],
    blurb: 'A friendly warm-up against route Pokémon. Ben mostly picks moves at random.',
  },
  {
    id: 2,
    trainer: 'Bug Catcher Rina',
    title: 'Viridian Thicket',
    icon: '🐛',
    ai: 'random',
    deck: [12, 15, 46, 48, 123, 127, 165, 167, 10, 13, 11, 14],
    aiHpBonus: 0, aiDamageBonus: 0, doubleEnergyEvery: 0,
    playerHandSize: 5, playerPrizeTarget: 3, aiPrizeTarget: 4,
    rewardCatch: [123, 127, 12],
    blurb: 'Swarms of bug Pokémon. Fire and flying types feast here.',
  },
  {
    id: 3,
    trainer: 'Sailor Drake',
    title: 'Vermilion Docks',
    icon: '⚓',
    ai: 'greedy',
    deck: [55, 61, 73, 86, 87, 90, 91, 116, 117, 129, 130, 72, 'potion'],
    aiHpBonus: 0, aiDamageBonus: 0, doubleEnergyEvery: 0,
    playerHandSize: 5, playerPrizeTarget: 4, aiPrizeTarget: 4,
    rewardCatch: [130, 87, 117],
    blurb: 'Drake always goes for the biggest hit, and packs a Potion. Bring lightning or grass.',
  },
  {
    id: 4,
    trainer: 'Ace Trainer Milo',
    title: 'Celadon Arena',
    icon: '🎯',
    ai: 'greedy',
    deck: [59, 26, 65, 68, 94, 112, 121, 131, 143, 128, 135, 115, 'potion', 'switch'],
    aiHpBonus: 0, aiDamageBonus: 0, doubleEnergyEvery: 0,
    playerHandSize: 5, playerPrizeTarget: 4, aiPrizeTarget: 4,
    rewardCatch: [59, 135, 143],
    blurb: 'A balanced all-star roster with support cards. No single deck counters it all.',
  },
  {
    id: 5,
    trainer: 'Gym Leader Sabrina',
    title: 'Saffron Gym',
    icon: '🥇',
    ai: 'greedy',
    deck: [64, 65, 65, 80, 96, 97, 102, 103, 122, 124, 151, 79, 'potion', 'research'],
    aiHpBonus: 10, aiDamageBonus: 10, doubleEnergyEvery: 0,
    playerHandSize: 5, playerPrizeTarget: 4, aiPrizeTarget: 4,
    rewardCatch: [65, 122, 124],
    blurb: 'Psychic disruption everywhere (+10 HP). Mew has been sighted at her side.',
  },
  {
    id: 6,
    trainer: 'Gym Leader Surge',
    title: 'Power Plant Showdown',
    icon: '⚡',
    ai: 'strategic',
    deck: [26, 462, 101, 125, 135, 145, 181, 466, 479, 405, 131, 143, 125, 181, 26, 'energize', 'potion', 'potion'],
    aiHpBonus: 20, aiDamageBonus: 20, doubleEnergyEvery: 0,
    playerHandSize: 5, playerPrizeTarget: 4, aiPrizeTarget: 4,
    rewardCatch: [181, 466, 405],
    blurb: 'Surge plays type match-ups now — and Zapdos answers his call. Ground types laugh at him.',
  },
  {
    id: 7,
    trainer: 'Elite Four Lorelei',
    title: 'Frozen Summit',
    icon: '❄️',
    ai: 'strategic',
    deck: [87, 91, 131, 131, 144, 144, 461, 365, 471, 478, 473, 382, 91, 473, 'potion', 'switch', 'research'],
    aiHpBonus: 20, aiDamageBonus: 10, doubleEnergyEvery: 4,
    playerHandSize: 5, playerPrizeTarget: 4, aiPrizeTarget: 4,
    rewardCatch: [144, 461, 471, 131],
    blurb: 'Twin Articuno and the sea titan Kyogre guard the summit.',
  },
  {
    id: 8,
    trainer: 'Elite Four Lance',
    title: 'Dragon’s Den',
    icon: '🐉',
    ai: 'strategic',
    deck: [130, 142, 148, 149, 149, 230, 373, 376, 445, 635, 384, 250, 149, 373, 445, 'energize', 'potion', 'switch', 'potion'],
    aiHpBonus: 20, aiDamageBonus: 20, doubleEnergyEvery: 3,
    playerHandSize: 4, playerPrizeTarget: 4, aiPrizeTarget: 4,
    rewardCatch: [149, 445, 635, 145],
    blurb: 'Rayquaza and Ho-Oh join Lance’s dragons. He charges energy fast; your opening hand is smaller.',
  },
  {
    id: 9,
    trainer: 'Champion Cynthia',
    title: 'Hall of the Champion',
    icon: '👑',
    ai: 'strategic',
    deck: [442, 445, 445, 350, 407, 448, 468, 423, 483, 484, 487, 491,
      448, 468, 350, 442,
      'potion', 'switch', 'research', 'energize', 'potion'],
    aiHpBonus: 20, aiDamageBonus: 10, doubleEnergyEvery: 4,
    playerHandSize: 4, playerPrizeTarget: 4, aiPrizeTarget: 4,
    rewardCatch: [445, 448, 468, 483, 484, 146],
    blurb: 'Her true team — led by twin Garchomp — backed by Dialga, Palkia, Giratina and Darkrai.',
  },
  {
    id: 10,
    trainer: 'The Original One',
    title: 'Hall of Origin',
    icon: '🌌',
    ai: 'strategic',
    deck: [493, 150, 491, 717, 382, 383, 384, 483, 484, 487, 643, 250,
      644, 717, 150, 384, 491, 487,
      'potion', 'switch', 'research', 'energize', 'potion', 'energize'],
    aiHpBonus: 30, aiDamageBonus: 10, doubleEnergyEvery: 3,
    playerHandSize: 4, playerPrizeTarget: 5, aiPrizeTarget: 3,
    rewardCatch: [150, 249, 250, 382, 383, 384, 487, 491, 643, 644, 493, 151],
    blurb: 'Every legend at once, led by Arceus. Five KOs to win; three losses and it’s over.',
  },
];

export function getLevel(id) {
  const l = LEVELS.find((x) => x.id === id);
  if (!l) throw new Error(`Unknown level: ${id}`);
  return l;
}
