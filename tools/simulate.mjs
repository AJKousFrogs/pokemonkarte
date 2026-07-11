// Difficulty-curve simulator: pits an AI-piloted player against every level
// with every deck and prints win rates. Used to balance the campaign.
//
//   node tools/simulate.mjs            # strategic player bot (skilled play)
//   node tools/simulate.mjs greedy     # greedy player bot (casual play)
//   node tools/simulate.mjs greedy 500 # 500 games per cell

import { newBattle } from '../js/engine/battle.js';
import { aiTakeTurn } from '../js/engine/ai.js';
import { LEVELS } from '../js/data/levels.js';
import { DECKS } from '../js/data/decks.js';

const playerTier = process.argv[2] || 'strategic';
const N = Number(process.argv[3]) || 200;

// Deterministic RNG so runs are reproducible.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function playGame(deck, level, rng) {
  const state = newBattle({ playerDeckIds: deck.cards, level, rng });
  let guard = 0;
  while (!state.winner && guard++ < 500) {
    if (state.turn === 'player' || state.pendingPromote?.side === 'player') {
      aiTakeTurn(state, playerTier, 'player');
    } else {
      aiTakeTurn(state, level.ai, 'enemy');
    }
  }
  if (guard >= 500) throw new Error(`stalled game: deck=${deck.key} level=${level.id}`);
  return state.winner;
}

let seed = 1;
console.log(`win-rate of ${playerTier} player bot, ${N} games per cell:\n`);
console.log('level'.padEnd(28), ...DECKS.map((d) => d.key.padEnd(9)));
for (const level of LEVELS) {
  const row = [];
  for (const deck of DECKS) {
    let wins = 0;
    for (let i = 0; i < N; i++) {
      const rng = mulberry32(seed++ * 104729);
      if (playGame(deck, level, rng) === 'player') wins++;
    }
    row.push(((wins / N) * 100).toFixed(0).padStart(3) + '%'.padEnd(6));
  }
  console.log(`L${level.id} ${level.trainer}`.padEnd(28), ...row);
}
