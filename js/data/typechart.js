// Type effectiveness chart.
// STRONG[atk] lists defender types that take 2x damage.
// WEAK[atk] lists defender types that take 0.5x damage.

export const TYPES = [
  'normal', 'fire', 'water', 'grass', 'electric', 'ice',
  'fighting', 'psychic', 'dark', 'dragon', 'steel', 'flying',
];

const STRONG = {
  normal: [],
  fire: ['grass', 'ice', 'steel'],
  water: ['fire'],
  grass: ['water'],
  electric: ['water', 'flying'],
  ice: ['grass', 'dragon', 'flying'],
  fighting: ['normal', 'ice', 'dark', 'steel'],
  psychic: ['fighting'],
  dark: ['psychic'],
  dragon: ['dragon'],
  steel: ['ice', 'flying'],
  flying: ['grass', 'fighting'],
};

const WEAK = {
  normal: ['steel'],
  fire: ['water', 'dragon'],
  water: ['grass', 'dragon'],
  grass: ['fire', 'dragon', 'flying', 'steel'],
  electric: ['grass', 'dragon'],
  ice: ['fire', 'water', 'steel'],
  fighting: ['psychic', 'flying'],
  psychic: ['dark', 'steel'],
  dark: ['fighting'],
  dragon: ['steel'],
  steel: ['fire', 'water', 'electric'],
  flying: ['electric', 'steel'],
};

export function typeMultiplier(attackType, defendType) {
  if (STRONG[attackType]?.includes(defendType)) return 2;
  if (WEAK[attackType]?.includes(defendType)) return 0.5;
  return 1;
}

export const TYPE_ICONS = {
  normal: '⭐', fire: '🔥', water: '💧', grass: '🌿', electric: '⚡',
  ice: '❄️', fighting: '🥊', psychic: '🔮', dark: '🌙', dragon: '🐉',
  steel: '⚙️', flying: '🪽',
};

export const TYPE_COLORS = {
  normal: '#a8a878', fire: '#f08030', water: '#6890f0', grass: '#78c850',
  electric: '#f8d030', ice: '#98d8d8', fighting: '#c03028', psychic: '#f85888',
  dark: '#705848', dragon: '#7038f8', steel: '#b8b8d0', flying: '#a890f0',
};
