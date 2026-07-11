// Core battle engine. Pure logic, no DOM — the UI and the test harness both
// drive battles exclusively through the functions exported here.
//
// Rules summary:
//   - Each side runs a 12-card deck; every card is a Pokémon.
//   - One active Pokémon, up to 3 on the bench.
//   - Draw 1 card at the start of your turn; you may attach 1 energy per turn
//     (some enemy trainers periodically get 2 — see doubleEnergyEvery).
//   - Attacks require (but do not consume) energy. Attacking ends your turn.
//   - Retreating consumes energy equal to the Pokémon's retreat cost.
//   - A KO scores a prize. First side to reach its prize target wins; a side
//     that cannot field a replacement Pokémon loses immediately.

import { getPokemon } from '../data/pokedex.js';
import { typeMultiplier } from '../data/typechart.js';

export const BENCH_SIZE = 3;
export const HAND_LIMIT = 8;

let uidCounter = 0;

function makeCard(pokedexId, hpBonus = 0) {
  const base = getPokemon(pokedexId);
  return {
    uid: ++uidCounter,
    base,
    hp: base.hp + hpBonus,
    maxHp: base.hp + hpBonus,
    energy: 0,
    paralyzed: false,
    burned: false,
    shield: 0,
  };
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeSide(name, deckIds, opts, rng) {
  const cards = shuffle(deckIds, rng).map((id) => makeCard(id, opts.hpBonus));
  const hand = cards.splice(0, opts.handSize);
  const active = hand.shift(); // first drawn Pokémon leads
  return {
    name,
    deck: cards,
    hand,
    active,
    bench: [],
    discard: [],
    prizes: 0,
    prizeTarget: opts.prizeTarget,
    damageBonus: opts.damageBonus,
    doubleEnergyEvery: opts.doubleEnergyEvery,
    energyBudget: 0,
    attackedThisTurn: false,
  };
}

export function newBattle({ playerName = 'You', playerDeckIds, level, rng = Math.random }) {
  const state = {
    rng,
    level,
    turn: 'player',
    turnNumber: 0,
    winner: null,
    pendingPromote: null, // { side, options: [{from, index, card}] } — player must choose
    log: [],
    player: makeSide(playerName, playerDeckIds, {
      hpBonus: 0,
      damageBonus: 0,
      doubleEnergyEvery: 0,
      handSize: level.playerHandSize,
      prizeTarget: level.playerPrizeTarget,
    }, rng),
    enemy: makeSide(level.trainer, level.deck, {
      hpBonus: level.aiHpBonus,
      damageBonus: level.aiDamageBonus,
      doubleEnergyEvery: level.doubleEnergyEvery,
      handSize: 5,
      prizeTarget: level.aiPrizeTarget,
    }, rng),
  };
  log(state, `${level.trainer} wants to battle!`);
  log(state, `Win condition — you: ${level.playerPrizeTarget} KOs, ${level.trainer}: ${level.aiPrizeTarget} KOs.`);
  startTurn(state);
  return state;
}

export function log(state, msg) {
  state.log.push({ turn: state.turnNumber, msg });
}

function side(state, who) {
  return who === 'player' ? state.player : state.enemy;
}

function opponentOf(who) {
  return who === 'player' ? 'enemy' : 'player';
}

export function startTurn(state) {
  if (state.winner) return;
  const who = state.turn;
  const s = side(state, who);
  state.turnNumber++;
  s.attackedThisTurn = false;

  // Energy income (harder levels let the AI bank double energy periodically).
  s.energyBudget = 1;
  if (s.doubleEnergyEvery > 0 && state.turnNumber > 1
      && Math.ceil(state.turnNumber / 2) % s.doubleEnergyEvery === 0) {
    s.energyBudget = 2;
    log(state, `${s.name} is charging up — 2 energy this turn!`);
  }

  // Draw.
  if (s.deck.length > 0 && s.hand.length < HAND_LIMIT) {
    s.hand.push(s.deck.shift());
    if (who === 'player') log(state, `You drew ${s.hand[s.hand.length - 1].base.name}.`);
  }
}

export function playToBench(state, who, handIndex) {
  const s = side(state, who);
  if (state.winner || state.turn !== who || state.pendingPromote) return false;
  if (s.bench.length >= BENCH_SIZE) return false;
  const card = s.hand[handIndex];
  if (!card) return false;
  s.hand.splice(handIndex, 1);
  s.bench.push(card);
  log(state, `${s.name} benched ${card.base.name}.`);
  return true;
}

// target: 'active' or a bench index.
export function attachEnergy(state, who, target) {
  const s = side(state, who);
  if (state.winner || state.turn !== who || state.pendingPromote) return false;
  if (s.energyBudget <= 0) return false;
  const card = target === 'active' ? s.active : s.bench[target];
  if (!card) return false;
  card.energy++;
  s.energyBudget--;
  log(state, `${s.name} attached energy to ${card.base.name} (${card.energy}⚡).`);
  return true;
}

export function canRetreat(state, who) {
  const s = side(state, who);
  return !!s.active && !s.active.paralyzed && s.bench.length > 0
    && s.active.energy >= s.active.base.retreat;
}

export function retreat(state, who, benchIndex) {
  const s = side(state, who);
  if (state.winner || state.turn !== who || state.pendingPromote) return false;
  if (!canRetreat(state, who)) return false;
  const incoming = s.bench[benchIndex];
  if (!incoming) return false;
  s.active.energy -= s.active.base.retreat; // retreat cost is spent
  s.active.burned = false;                  // fresh air cures burns
  s.bench[benchIndex] = s.active;
  s.active = incoming;
  log(state, `${s.name} retreated to ${incoming.base.name}.`);
  return true;
}

export function affordableAttacks(card) {
  if (!card) return [];
  return card.base.attacks
    .map((atk, i) => ({ atk, i }))
    .filter(({ atk }) => card.energy >= atk.cost);
}

// Expected damage of `atk` from attacker card vs defender card (before shield).
export function attackDamage(atk, attacker, defender, damageBonus = 0) {
  if (atk.damage === 0) return 0;
  let mult = typeMultiplier(attacker.base.type, defender.base.type);
  if (atk.effect?.pierce) mult = Math.max(1, mult);
  return Math.floor((atk.damage + damageBonus) * mult);
}

export function attack(state, who, attackIndex) {
  const s = side(state, who);
  const o = side(state, opponentOf(who));
  if (state.winner || state.turn !== who || state.pendingPromote) return false;
  if (!s.active || !o.active || s.attackedThisTurn) return false;
  if (s.active.paralyzed) {
    log(state, `${s.active.base.name} is paralyzed and can't attack!`);
    endTurn(state);
    return true;
  }
  const atk = s.active.base.attacks[attackIndex];
  if (!atk || s.active.energy < atk.cost) return false;

  s.attackedThisTurn = true;
  const attacker = s.active;
  const defender = o.active;
  let dmg = attackDamage(atk, attacker, defender, s.damageBonus);
  const mult = typeMultiplier(attacker.base.type, defender.base.type);

  // One-shot damage shield on the defender.
  if (dmg > 0 && defender.shield > 0) {
    const absorbed = Math.min(defender.shield, dmg);
    dmg -= absorbed;
    defender.shield = 0;
    log(state, `${defender.base.name}'s barrier absorbed ${absorbed} damage!`);
  }

  defender.hp -= dmg;
  let note = '';
  if (!atk.effect?.pierce) {
    if (mult > 1) note = ' It’s super effective!';
    else if (mult < 1) note = ' It’s not very effective…';
  }
  log(state, `${attacker.base.name} used ${atk.name} — ${dmg} damage.${note}`);

  applyEffects(state, who, atk, attacker, defender, dmg);
  resolveKnockouts(state);
  if (!state.winner) endTurn(state);
  return true;
}

function applyEffects(state, who, atk, attacker, defender, dmgDealt) {
  const e = atk.effect;
  if (!e) return;
  const s = side(state, who);
  const o = side(state, opponentOf(who));

  if (e.heal && attacker.hp > 0) {
    const healed = Math.min(e.heal, attacker.maxHp - attacker.hp);
    attacker.hp += healed;
    if (healed > 0) log(state, `${attacker.base.name} healed ${healed} HP.`);
  }
  if (e.drain && dmgDealt > 0 && attacker.hp > 0) {
    const healed = Math.min(Math.floor(dmgDealt / 2), attacker.maxHp - attacker.hp);
    attacker.hp += healed;
    if (healed > 0) log(state, `${attacker.base.name} drained ${healed} HP.`);
  }
  if (e.recoil) {
    attacker.hp -= e.recoil;
    log(state, `${attacker.base.name} took ${e.recoil} recoil damage.`);
  }
  if (e.paralyze && defender.hp > 0 && state.rng() < e.paralyze) {
    defender.paralyzed = true;
    log(state, `${defender.base.name} is paralyzed!`);
  }
  if (e.burn && defender.hp > 0 && state.rng() < e.burn) {
    defender.burned = true;
    log(state, `${defender.base.name} is burned!`);
  }
  if (e.snipe && o.bench.length > 0) {
    const target = o.bench[Math.floor(state.rng() * o.bench.length)];
    target.hp -= e.snipe;
    log(state, `${target.base.name} on the bench took ${e.snipe} splash damage!`);
  }
  if (e.shield) {
    attacker.shield = e.shield;
    log(state, `${attacker.base.name} raised a barrier (${e.shield}).`);
  }
  if (e.discardSelf) {
    const lost = Math.min(e.discardSelf, attacker.energy);
    attacker.energy -= lost;
    if (lost > 0) log(state, `${attacker.base.name} discarded ${lost} energy.`);
  }
}

function resolveKnockouts(state) {
  for (const who of ['player', 'enemy']) {
    const s = side(state, who);
    const o = side(state, opponentOf(who));

    // Benched casualties (snipe damage) go straight to the discard pile.
    for (let i = s.bench.length - 1; i >= 0; i--) {
      if (s.bench[i].hp <= 0) {
        const ko = s.bench.splice(i, 1)[0];
        s.discard.push(ko);
        o.prizes++;
        log(state, `${ko.base.name} was knocked out on the bench! (${o.name}: ${o.prizes}/${o.prizeTarget} KOs)`);
      }
    }

    if (s.active && s.active.hp <= 0) {
      const ko = s.active;
      s.discard.push(ko);
      s.active = null;
      o.prizes++;
      log(state, `${ko.base.name} was knocked out! (${o.name}: ${o.prizes}/${o.prizeTarget} KOs)`);
    }
  }
  checkWinner(state);
  if (state.winner) return;

  // Field replacements for any side that lost its active.
  for (const who of ['player', 'enemy']) {
    const s = side(state, who);
    if (s.active) continue;
    const from = s.bench.length > 0 ? 'bench' : 'hand';
    const pool = from === 'bench' ? s.bench : s.hand;
    if (pool.length === 0) {
      state.winner = opponentOf(who);
      log(state, `${s.name} has no Pokémon left! ${side(state, state.winner).name} wins!`);
      return;
    }
    if (who === 'player' && pool.length > 1) {
      state.pendingPromote = {
        side: who,
        from,
        options: pool.map((card, index) => ({ index, card })),
      };
    } else {
      autoPromote(state, who);
    }
  }
}

function autoPromote(state, who) {
  const s = side(state, who);
  const o = side(state, opponentOf(who));
  const pool = s.bench.length > 0 ? s.bench : s.hand;
  // Pick the replacement with the best type match-up, then the most HP.
  let best = 0;
  let bestScore = -Infinity;
  pool.forEach((card, i) => {
    const offense = o.active ? typeMultiplier(card.base.type, o.active.base.type) : 1;
    const score = offense * 100 + card.hp;
    if (score > bestScore) { bestScore = score; best = i; }
  });
  promote(state, who, best);
}

export function promote(state, who, index) {
  const s = side(state, who);
  if (s.active) return false;
  const pool = s.bench.length > 0 ? s.bench : s.hand;
  const card = pool[index];
  if (!card) return false;
  pool.splice(index, 1);
  s.active = card;
  if (state.pendingPromote?.side === who) state.pendingPromote = null;
  log(state, `${s.name} sent out ${card.base.name}!`);
  return true;
}

function checkWinner(state) {
  if (state.winner) return;
  if (state.player.prizes >= state.player.prizeTarget) {
    state.winner = 'player';
    log(state, `${state.player.name} collected all the prizes — victory!`);
  } else if (state.enemy.prizes >= state.enemy.prizeTarget) {
    state.winner = 'enemy';
    log(state, `${state.enemy.name} collected all the prizes — defeat…`);
  }
}

export function endTurn(state) {
  if (state.winner) return;
  const who = state.turn;
  const s = side(state, who);

  // Burn ticks at the end of the burned side's turn, then may wear off.
  if (s.active?.burned) {
    s.active.hp -= 10;
    log(state, `${s.active.base.name} is hurt by its burn (10).`);
    if (state.rng() < 0.5) {
      s.active.burned = false;
      log(state, `${s.active.base.name}'s burn wore off.`);
    }
    resolveKnockouts(state);
    if (state.winner) return;
  }

  // Paralysis wears off at the end of the owner's turn (one attack skipped).
  if (s.active?.paralyzed) {
    s.active.paralyzed = false;
    log(state, `${s.active.base.name} shook off its paralysis.`);
  }

  state.turn = opponentOf(who);
  startTurn(state);
}
