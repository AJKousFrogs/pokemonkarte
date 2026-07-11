// Trainer cards — support cards mixed into every deck (ported from the
// original Phantom Gate TCG build). Playing one never ends your turn.

export const TRAINERS = {
  potion: {
    key: 'potion', name: 'Potion', icon: '🧴',
    desc: 'Heal 30 damage from your most injured Pokémon.',
  },
  switch: {
    key: 'switch', name: 'Switch', icon: '🔄',
    desc: 'Swap your Active Pokémon with one on your bench — no energy cost.',
  },
  research: {
    key: 'research', name: 'Professor’s Research', icon: '🧪',
    desc: 'Discard the rest of your hand and draw 4 cards.',
  },
  energize: {
    key: 'energize', name: 'Energy Boost', icon: '🔋',
    desc: 'Attach 1 extra energy this turn.',
  },
};

export function getTrainer(key) {
  const t = TRAINERS[key];
  if (!t) throw new Error(`Unknown trainer card: ${key}`);
  return t;
}
