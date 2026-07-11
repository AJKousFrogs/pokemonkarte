// The campaign. Levels get progressively harder to win:
//   - smarter AI tiers (random → greedy → strategic)
//   - enemy stat handicaps (bonus HP / bonus damage)
//   - extra enemy energy income (doubleEnergyEvery)
//   - asymmetric prize targets (you must score more KOs than the AI needs)
//   - smaller starting hands for the player at the top of the ladder
//
// Beating a level marks its enemy Pokémon as seen, catches the reward
// Pokémon, and unlocks any deck whose unlockLevel it satisfies.

export const LEVELS = [
  {
    id: 1,
    trainer: 'Youngster Ben',
    title: 'Route 1 Scuffle',
    icon: '🧢',
    ai: 'random',
    deck: [25, 25, 95, 123, 123, 121, 136, 134, 103, 38, 59, 125],
    aiHpBonus: 0, aiDamageBonus: 0, doubleEnergyEvery: 0,
    playerHandSize: 5, playerPrizeTarget: 3, aiPrizeTarget: 4,
    rewardCatch: [25, 123],
    blurb: 'A friendly warm-up. Ben mostly picks moves at random.',
  },
  {
    id: 2,
    trainer: 'Bug Catcher Rina',
    title: 'Viridian Thicket',
    icon: '🐛',
    ai: 'random',
    deck: [123, 123, 123, 103, 103, 3, 254, 95, 95, 134, 121, 143],
    aiHpBonus: 0, aiDamageBonus: 0, doubleEnergyEvery: 0,
    playerHandSize: 5, playerPrizeTarget: 3, aiPrizeTarget: 4,
    rewardCatch: [103, 95],
    blurb: 'Swarms of grass Pokémon. Fire types feast here.',
  },
  {
    id: 3,
    trainer: 'Sailor Drake',
    title: 'Vermilion Docks',
    icon: '⚓',
    ai: 'greedy',
    deck: [9, 130, 131, 131, 134, 134, 121, 121, 260, 461, 143, 125],
    aiHpBonus: 0, aiDamageBonus: 0, doubleEnergyEvery: 0,
    playerHandSize: 5, playerPrizeTarget: 4, aiPrizeTarget: 4,
    rewardCatch: [131, 121],
    blurb: 'Drake always goes for the biggest hit. Bring lightning.',
  },
  {
    id: 4,
    trainer: 'Ace Trainer Milo',
    title: 'Celadon Arena',
    icon: '🎯',
    ai: 'greedy',
    deck: [59, 59, 26, 26, 125, 466, 68, 112, 196, 197, 143, 135],
    aiHpBonus: 0, aiDamageBonus: 0, doubleEnergyEvery: 0,
    playerHandSize: 5, playerPrizeTarget: 4, aiPrizeTarget: 4,
    rewardCatch: [26, 135, 196],
    blurb: 'A balanced roster with a bit more muscle (+10 HP).',
  },
  {
    id: 5,
    trainer: 'Gym Leader Sabrina',
    title: 'Saffron Gym',
    icon: '🥇',
    ai: 'greedy',
    deck: [65, 65, 94, 94, 196, 196, 282, 282, 197, 359, 448, 151],
    aiHpBonus: 10, aiDamageBonus: 0, doubleEnergyEvery: 0,
    playerHandSize: 5, playerPrizeTarget: 4, aiPrizeTarget: 4,
    rewardCatch: [65, 94, 282],
    blurb: 'Psychic disruption everywhere, and her attacks hit 10 harder. Mew has been sighted at her side.',
  },
  {
    id: 6,
    trainer: 'Gym Leader Surge',
    title: 'Power Plant Showdown',
    icon: '⚡',
    ai: 'strategic',
    deck: [26, 26, 135, 135, 461, 125, 181, 181, 466, 466, 145, 461],
    aiHpBonus: 20, aiDamageBonus: 10, doubleEnergyEvery: 0,
    playerHandSize: 5, playerPrizeTarget: 4, aiPrizeTarget: 4,
    rewardCatch: [181, 466, 448],
    blurb: 'Surge plays type match-ups now — and Zapdos answers his call.',
  },
  {
    id: 7,
    trainer: 'Elite Four Lorelei',
    title: 'Frozen Summit',
    icon: '❄️',
    ai: 'strategic',
    deck: [131, 131, 461, 461, 134, 121, 130, 260, 144, 144, 9, 382],
    aiHpBonus: 20, aiDamageBonus: 10, doubleEnergyEvery: 4,
    playerHandSize: 5, playerPrizeTarget: 4, aiPrizeTarget: 4,
    rewardCatch: [144, 461, 130],
    blurb: 'Twin Articuno and the sea titan Kyogre guard the summit.',
  },
  {
    id: 8,
    trainer: 'Elite Four Lance',
    title: 'Dragon’s Den',
    icon: '🐉',
    ai: 'strategic',
    deck: [149, 149, 445, 445, 635, 635, 130, 248, 384, 376, 143, 250],
    aiHpBonus: 20, aiDamageBonus: 20, doubleEnergyEvery: 3,
    playerHandSize: 4, playerPrizeTarget: 5, aiPrizeTarget: 4,
    rewardCatch: [149, 445, 635, 145],
    blurb: 'Rayquaza and Ho-Oh join Lance’s dragons. He charges energy fast; your opening hand is smaller.',
  },
  {
    id: 9,
    trainer: 'Champion Cynthia',
    title: 'Hall of the Champion',
    icon: '👑',
    ai: 'strategic',
    deck: [445, 445, 448, 448, 376, 376, 483, 484, 487, 491, 282, 248],
    aiHpBonus: 20, aiDamageBonus: 10, doubleEnergyEvery: 4,
    playerHandSize: 4, playerPrizeTarget: 4, aiPrizeTarget: 4,
    rewardCatch: [376, 248, 146, 483, 484],
    blurb: 'Dialga, Palkia, Giratina and Darkrai stand between you and the title.',
  },
  {
    id: 10,
    trainer: 'The Original One',
    title: 'Hall of Origin',
    icon: '🌌',
    ai: 'strategic',
    deck: [493, 150, 249, 384, 382, 383, 487, 491, 483, 484, 250, 151],
    aiHpBonus: 30, aiDamageBonus: 10, doubleEnergyEvery: 3,
    playerHandSize: 4, playerPrizeTarget: 5, aiPrizeTarget: 3,
    rewardCatch: [150, 151, 249, 250, 382, 383, 384, 487, 491, 493],
    blurb: 'Every legend at once, led by Arceus. Five KOs to win; three losses and it’s over.',
  },
];

export function getLevel(id) {
  const l = LEVELS.find((x) => x.id === id);
  if (!l) throw new Error(`Unknown level: ${id}`);
  return l;
}
