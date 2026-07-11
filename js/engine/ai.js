// Trainer AI. Three tiers, used by the campaign's difficulty curve:
//   random    — plays legal moves with no planning (early levels)
//   greedy    — always benches, powers its active, picks the biggest hit
//   strategic — plays type match-ups, spreads energy, retreats when losing,
//               and goes for lethal whenever it can
//
// The AI drives the same public engine API as the human player, and can pilot
// either side (the campaign uses it for the enemy; the simulator uses it to
// benchmark how winnable each level is).

import {
  playToBench, attachEnergy, attack, retreat, endTurn, promote,
  affordableAttacks, attackDamage, canRetreat, BENCH_SIZE,
} from './battle.js';
import { typeMultiplier } from '../data/typechart.js';

export function aiTakeTurn(state, tier, who = 'enemy') {
  const opp = who === 'enemy' ? 'player' : 'enemy';
  if (state.winner) return;

  if (state.pendingPromote?.side === who) aiPromote(state, tier, who, opp);
  if (state.turn !== who) return;

  benchPhase(state, tier, who, opp);
  energyPhase(state, tier, who, opp);
  if (tier === 'strategic') retreatPhase(state, who, opp);

  // Attack phase — attack() ends the turn; otherwise pass explicitly.
  if (!attackPhase(state, tier, who, opp)) endTurn(state);
}

export function aiPromote(state, tier, who, opp) {
  const options = state.pendingPromote.options;
  let best = 0;
  let bestScore = -Infinity;
  options.forEach(({ index, card }) => {
    const offense = state[opp].active
      ? typeMultiplier(card.base.type, state[opp].active.base.type) : 1;
    const power = Math.max(...card.base.attacks.map((a) => a.damage));
    const score = (tier === 'strategic' ? offense * 80 : 0) + power + card.hp;
    if (score > bestScore) { bestScore = score; best = index; }
  });
  promote(state, who, best);
}

function benchPhase(state, tier, who, opp) {
  const s = state[who];
  while (s.bench.length < BENCH_SIZE && s.hand.length > 0) {
    let idx = 0;
    if (tier === 'random') {
      if (state.rng() < 0.4) break; // random AI sometimes forgets to bench
      idx = Math.floor(state.rng() * s.hand.length);
    } else {
      // Bench the card with the best long-term value vs the opposing active.
      let bestScore = -Infinity;
      s.hand.forEach((card, i) => {
        const offense = state[opp].active
          ? typeMultiplier(card.base.type, state[opp].active.base.type) : 1;
        const power = Math.max(...card.base.attacks.map((a) => a.damage));
        const score = (tier === 'strategic' ? offense * 60 : 0) + power + card.hp / 2;
        if (score > bestScore) { bestScore = score; idx = i; }
      });
    }
    if (!playToBench(state, who, idx)) break;
  }
}

function energyPhase(state, tier, who, opp) {
  const s = state[who];
  while (s.energyBudget > 0) {
    let target = 'active';
    if (tier === 'random') {
      const spots = ['active', ...s.bench.keys()];
      target = spots[Math.floor(state.rng() * spots.length)];
    } else if (tier === 'strategic') {
      target = strategicEnergyTarget(state, who, opp);
    }
    if (!attachEnergy(state, who, target)) {
      if (!attachEnergy(state, who, 'active')) break;
    }
  }
}

// Strategic energy: finish charging the active's best attack first; once the
// active is fully charged, build up the bench attacker with the best match-up.
function strategicEnergyTarget(state, who, opp) {
  const s = state[who];
  if (s.active) {
    const maxCost = Math.max(...s.active.base.attacks.map((a) => a.cost));
    if (s.active.energy < maxCost) return 'active';
  }
  let best = 'active';
  let bestScore = -Infinity;
  s.bench.forEach((card, i) => {
    const maxCost = Math.max(...card.base.attacks.map((a) => a.cost));
    if (card.energy >= maxCost) return; // already charged
    const offense = state[opp].active
      ? typeMultiplier(card.base.type, state[opp].active.base.type) : 1;
    const score = offense * 50 + Math.max(...card.base.attacks.map((a) => a.damage)) - card.energy * 5;
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return best;
}

function retreatPhase(state, who, opp) {
  const s = state[who];
  const active = s.active;
  const oppActive = state[opp].active;
  if (!active || !oppActive || !canRetreat(state, who)) return;

  const currentBest = bestAttackValue(active, oppActive, s.damageBonus);
  const inDanger = active.hp <= active.maxHp * 0.3;
  const badMatchup = typeMultiplier(oppActive.base.type, active.base.type) > 1;
  if (!inDanger && !badMatchup) return;

  // Only retreat into something that can attack right now and hits harder.
  let bestIdx = -1;
  let bestVal = currentBest;
  s.bench.forEach((card, i) => {
    if (card.hp <= active.hp && !inDanger) return;
    const val = bestAttackValue(card, oppActive, s.damageBonus);
    if (val > bestVal) { bestVal = val; bestIdx = i; }
  });
  if (bestIdx >= 0) retreat(state, who, bestIdx);
}

function bestAttackValue(card, defender, damageBonus) {
  const options = affordableAttacks(card);
  if (options.length === 0) return 0;
  return Math.max(...options.map(({ atk }) => attackDamage(atk, card, defender, damageBonus)));
}

function attackPhase(state, tier, who, opp) {
  const s = state[who];
  const active = s.active;
  const defender = state[opp].active;
  if (!active || !defender) return false;

  if (active.paralyzed) {
    // attack() logs the paralysis and ends the turn.
    return attack(state, who, 0);
  }

  const options = affordableAttacks(active);
  if (options.length === 0) return false;

  let choice;
  if (tier === 'random') {
    choice = options[Math.floor(state.rng() * options.length)];
  } else {
    // Prefer a guaranteed KO; otherwise maximize damage. Strategic AI also
    // values utility attacks (heal/shield) when no KO is on the table.
    let bestScore = -Infinity;
    for (const opt of options) {
      const dmg = Math.max(0, attackDamage(opt.atk, active, defender, s.damageBonus) - defender.shield);
      let score = dmg;
      if (dmg >= defender.hp) score += 1000; // lethal
      if (tier === 'strategic') {
        const e = opt.atk.effect || {};
        if (e.heal && active.hp < active.maxHp - 20) score += e.heal / 2;
        if (e.shield && active.hp < active.maxHp * 0.5) score += e.shield / 2;
        if (e.paralyze) score += 30 * e.paralyze;
        if (e.discardSelf && dmg < defender.hp) score -= 25; // don't dump energy for nothing
      }
      if (score > bestScore) { bestScore = score; choice = opt; }
    }
  }
  return attack(state, who, choice.i);
}
