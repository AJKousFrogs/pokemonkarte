// Player-selectable decks. Each deck is 12 cards (Pokédex ids, duplicates allowed).
// `unlockLevel` is the campaign level that must be BEATEN before the deck opens up
// (0 = available from the start).

export const DECKS = [
  {
    key: 'ember',
    name: 'Ember Squad',
    icon: '🔥',
    desc: 'Aggressive fire attackers that burn through anything green or icy.',
    unlockLevel: 0,
    cards: [6, 257, 59, 59, 38, 38, 136, 136, 229, 229, 143, 123],
  },
  {
    key: 'tidal',
    name: 'Tidal Wave',
    icon: '🌊',
    desc: 'Durable water Pokémon that outlast the opposition.',
    unlockLevel: 0,
    cards: [9, 260, 130, 131, 131, 134, 134, 121, 121, 143, 461, 461],
  },
  {
    key: 'verdant',
    name: 'Verdant Grove',
    icon: '🌿',
    desc: 'Fast grass strikers with healing staying power.',
    unlockLevel: 0,
    cards: [3, 254, 103, 103, 123, 123, 134, 143, 254, 103, 123, 95],
  },
  {
    key: 'volt',
    name: 'Volt Storm',
    icon: '⚡',
    desc: 'High-voltage speed and paralysis pressure.',
    unlockLevel: 2,
    cards: [25, 25, 26, 26, 135, 135, 125, 125, 181, 466, 466, 143],
  },
  {
    key: 'mind',
    name: 'Mind Bender',
    icon: '🔮',
    desc: 'Psychic and dark tricksters that drain and disrupt.',
    unlockLevel: 4,
    cards: [65, 65, 94, 94, 196, 196, 197, 197, 282, 359, 359, 448],
  },
  {
    key: 'iron',
    name: 'Iron Fist',
    icon: '🥊',
    desc: 'Heavy hitters in steel and stone. Slow, but devastating.',
    unlockLevel: 6,
    cards: [68, 68, 76, 112, 95, 212, 212, 376, 448, 448, 248, 143],
  },
  {
    key: 'dragon',
    name: 'Dragon Fury',
    icon: '🐉',
    desc: 'Late-game monsters with colossal attacks.',
    unlockLevel: 8,
    cards: [149, 149, 445, 445, 635, 635, 130, 248, 248, 376, 376, 143],
  },
  {
    key: 'legends',
    name: 'Legends Awakened',
    icon: '🌟',
    desc: 'The champions’ reward: a deck of pure legend.',
    unlockLevel: 10,
    cards: [150, 151, 249, 250, 384, 382, 383, 144, 145, 146, 491, 493],
  },
];

export function getDeck(key) {
  const d = DECKS.find((x) => x.key === key);
  if (!d) throw new Error(`Unknown deck: ${key}`);
  return d;
}
