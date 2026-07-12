// Trainer cards — support cards mixed into every deck (ported from the
// original Phantom Gate TCG build). Playing one never ends your turn.
//
// Categories follow the official rulebook: Items can be played freely,
// but only one SUPPORTER may be played per turn.

export const TRAINERS = {
  potion: {
    key: 'potion', name: 'Potion', icon: '🧴', category: 'item',
    desc: 'Heal 30 damage from your most injured Pokémon.',
  },
  switch: {
    key: 'switch', name: 'Switch', icon: '🔄', category: 'item',
    desc: 'Swap your Active Pokémon with one on your bench — no energy cost. Cures its conditions.',
  },
  research: {
    key: 'research', name: 'Professor’s Research', icon: '🧪', category: 'supporter',
    desc: 'Discard the rest of your hand and draw 4 cards. Only one Supporter per turn.',
  },
  energize: {
    key: 'energize', name: 'Energy Boost', icon: '🔋', category: 'item',
    desc: 'Attach 1 extra energy this turn.',
  },
};

export function getTrainer(key) {
  const t = TRAINERS[key];
  if (!t) throw new Error(`Unknown trainer card: ${key}`);
  return t;
}
