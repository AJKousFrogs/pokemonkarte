// Core battle engine. Pure logic, no DOM — the UI and the test harness both
// drive battles exclusively through the functions exported here.
//
// Rules follow the official Pokémon TCG rulebook, scaled down for mobile
// (16-card decks, 3-card bench, KO targets instead of 6 prizes):
//   - A coin flip decides who goes first; the starting player cannot attack
//     on the game's very first turn.
//   - Draw 1 card at the start of your turn — if you cannot, you lose
//     (deck-out). Mulligans give the opponent an extra card.
//   - Attach 1 energy per turn. Attacks require but do not consume energy;
//     attacking ends your turn.
//   - Retreat only once per turn (spends energy). Items are unlimited but
//     only one Supporter card may be played per turn.
//   - Special Conditions: burn 20 between turns (coin-flip cure), poison 10
//     (no self-cure), paralysis blocks attack/retreat for a turn. Moving to
//     the bench cures all conditions.
//   - Win by reaching your KO target, opponent having no Pokémon, or deck-out.

import { getPokemon } from '../data/pokedex.js';
import { getTrainer } from '../data/trainers.js';
import { typeMultiplier } from '../data/typechart.js';

export const BENCH_SIZE = 3;
export const HAND_LIMIT = 8;

let uidCounter = 0;

// Deck entries are Pokédex ids (numbers) or trainer-card keys (strings).
function makeCard(code, hpBonus = 0) {
  if (typeof code === 'string') {
    return { uid: ++uidCounter, kind: 'trainer', trainer: getTrainer(code) };
  }
  const base = getPokemon(code);
  return {
    uid: ++uidCounter,
    kind: 'poke',
    base,
    hp: base.hp + hpBonus,
    maxHp: base.hp + hpBonus,
    energy: 0,
    paralyzed: false,
    burned: false,
    poisoned: false,
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

function makeSide(name, deckCodes, opts, rng) {
  // Mulligan (rulebook p.8): reshuffle until the opening hand contains a
  // Pokémon to lead with. Each reshuffle lets the opponent draw an extra card.
  let cards;
  let mulligans = 0;
  for (; ; mulligans++) {
    cards = shuffle(deckCodes, rng).map((code) => makeCard(code, opts.hpBonus));
    if (cards.slice(0, opts.handSize).some((c) => c.kind === 'poke') || mulligans >= 20) break;
  }
  const hand = cards.splice(0, opts.handSize);
  const active = hand.splice(hand.findIndex((c) => c.kind === 'poke'), 1)[0];
  return {
    name,
    deck: cards,
    hand,
    active,
    bench: [],
    discard: [],
    prizes: 0,
    mulligans,
    prizeTarget: opts.prizeTarget,
    damageBonus: opts.damageBonus,
    doubleEnergyEvery: opts.doubleEnergyEvery,
    energyBudget: 0,
    attackedThisTurn: false,
    retreatedThisTurn: false,
    supporterUsedThisTurn: false,
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

  // Mulligan compensation (rulebook): draw an extra card per opposing mulligan.
  for (const [who, opp] of [['player', 'enemy'], ['enemy', 'player']]) {
    const extras = Math.min(side(state, opp).mulligans,
      HAND_LIMIT - side(state, who).hand.length, side(state, who).deck.length);
    for (let i = 0; i < extras; i++) side(state, who).hand.push(side(state, who).deck.shift());
    if (extras > 0) {
      log(state, `${side(state, opp).name} mulliganed — ${side(state, who).name} draws ${extras} extra card${extras > 1 ? 's' : ''}.`);
    }
  }

  // Coin flip decides who goes first (rulebook, Setting Up to Play, step 2).
  state.turn = rng() < 0.5 ? 'player' : 'enemy';
  log(state, `Coin flip: ${side(state, state.turn).name === 'You' ? 'You go' : `${side(state, state.turn).name} goes`} first! (No attacking on the very first turn.)`);
  startTurn(state);
  return state;
}

export function log(state, msg, fx = null) {
  state.log.push({ turn: state.turnNumber, msg, fx });
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
  s.retreatedThisTurn = false;
  s.supporterUsedThisTurn = false;

  // Energy income (harder levels let the AI bank double energy periodically).
  s.energyBudget = 1;
  if (s.doubleEnergyEvery > 0 && state.turnNumber > 1
      && Math.ceil(state.turnNumber / 2) % s.doubleEnergyEvery === 0) {
    s.energyBudget = 2;
    log(state, `${s.name} is charging up — 2 energy this turn!`);
  }

  // Draw. Official rule: if you cannot draw at the start of your turn
  // because your deck is empty, you lose the game.
  if (s.deck.length === 0) {
    state.winner = opponentOf(who);
    log(state, `${s.name} has no cards left to draw — ${side(state, state.winner).name} wins by deck-out!`);
    return;
  }
  if (s.hand.length < HAND_LIMIT) {
    const drawn = s.deck.shift();
    s.hand.push(drawn);
    if (who === 'player') {
      log(state, `You drew ${drawn.kind === 'poke' ? drawn.base.name : drawn.trainer.name}.`);
    }
    if (s.deck.length > 0 && s.deck.length <= 3) {
      log(state, `⚠ ${s.name === 'You' ? 'Your deck is' : `${s.name}'s deck is`} down to ${s.deck.length} card${s.deck.length > 1 ? 's' : ''} — deck-out means defeat!`);
    }
  }
}

export function playToBench(state, who, handIndex) {
  const s = side(state, who);
  if (state.winner || state.turn !== who || state.pendingPromote) return false;
  if (s.bench.length >= BENCH_SIZE) return false;
  const card = s.hand[handIndex];
  if (!card || card.kind !== 'poke') return false;
  s.hand.splice(handIndex, 1);
  s.bench.push(card);
  log(state, `${s.name} benched ${card.base.name}.`, { kind: 'bench', uid: card.uid });
  return true;
}

// Play a trainer card from hand. `arg` is the bench index for Switch.
// Trainer cards never end the turn.
export function playTrainer(state, who, handIndex, arg) {
  const s = side(state, who);
  if (state.winner || state.turn !== who || state.pendingPromote) return false;
  const card = s.hand[handIndex];
  if (!card || card.kind !== 'trainer') return false;
  const key = card.trainer.key;

  // Official rule: only one Supporter card per turn.
  if (card.trainer.category === 'supporter' && s.supporterUsedThisTurn) return false;

  if (key === 'potion') {
    const targets = [s.active, ...s.bench].filter((c) => c && c.hp < c.maxHp);
    if (targets.length === 0) return false;
    targets.sort((a, b) => (b.maxHp - b.hp) - (a.maxHp - a.hp));
    const t = targets[0];
    const healed = Math.min(30, t.maxHp - t.hp);
    t.hp += healed;
    log(state, `${s.name} used Potion — ${t.base.name} healed ${healed} HP.`, { kind: 'heal', uid: t.uid, amount: healed });
  } else if (key === 'switch') {
    const incoming = s.bench[arg];
    if (!incoming || !s.active) return false;
    cureConditions(s.active); // moving to the bench cures Special Conditions
    s.bench[arg] = s.active;
    s.active = incoming;
    log(state, `${s.name} used Switch — ${incoming.base.name} is now active!`, { kind: 'promote', uid: incoming.uid });
  } else if (key === 'research') {
    if (s.deck.length === 0) return false;
    const discarded = s.hand.filter((_, i) => i !== handIndex);
    s.discard.push(...discarded);
    s.hand = [card];
    const drawn = s.deck.splice(0, 4);
    s.hand.push(...drawn);
    log(state, `${s.name} used Professor’s Research — discarded ${discarded.length}, drew ${drawn.length}.`, { kind: 'trainer' });
  } else if (key === 'energize') {
    s.energyBudget++;
    log(state, `${s.name} used Energy Boost — +1 energy this turn!`, { kind: 'trainer' });
  } else {
    return false;
  }

  if (card.trainer.category === 'supporter') s.supporterUsedThisTurn = true;
  const idx = s.hand.indexOf(card);
  s.hand.splice(idx, 1);
  s.discard.push(card);
  return true;
}

// Moving to the bench cures all Special Conditions (rulebook).
function cureConditions(card) {
  card.paralyzed = false;
  card.burned = false;
  card.poisoned = false;
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
  log(state, `${s.name} attached energy to ${card.base.name} (${card.energy}⚡).`, { kind: 'energy', uid: card.uid });
  return true;
}

export function canRetreat(state, who) {
  const s = side(state, who);
  return !!s.active && !s.active.paralyzed && !s.retreatedThisTurn
    && s.bench.length > 0 && s.active.energy >= s.active.base.retreat;
}

export function retreat(state, who, benchIndex) {
  const s = side(state, who);
  if (state.winner || state.turn !== who || state.pendingPromote) return false;
  if (!canRetreat(state, who)) return false;
  const incoming = s.bench[benchIndex];
  if (!incoming) return false;
  s.active.energy -= s.active.base.retreat; // retreat cost is spent
  cureConditions(s.active);                 // benching cures Special Conditions
  s.retreatedThisTurn = true;               // only one retreat per turn
  s.bench[benchIndex] = s.active;
  s.active = incoming;
  log(state, `${s.name} retreated to ${incoming.base.name}.`, { kind: 'promote', uid: incoming.uid });
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
  if (state.turnNumber === 1) {
    log(state, `No attacking on the very first turn of the game!`);
    return false;
  }
  if (s.active.paralyzed) {
    log(state, `${s.active.base.name} is paralyzed and can't attack!`, { kind: 'status', uid: s.active.uid });
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
    log(state, `${defender.base.name}'s barrier absorbed ${absorbed} damage!`, { kind: 'status', uid: defender.uid });
  }

  defender.hp -= dmg;
  let note = '';
  if (!atk.effect?.pierce) {
    if (mult > 1) note = ' It’s super effective!';
    else if (mult < 1) note = ' It’s not very effective…';
  }
  log(state, `${attacker.base.name} used ${atk.name} — ${dmg} damage.${note}`, { kind: 'hit', uid: defender.uid, amount: dmg });

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
    if (healed > 0) log(state, `${attacker.base.name} healed ${healed} HP.`, { kind: 'heal', uid: attacker.uid, amount: healed });
  }
  if (e.drain && dmgDealt > 0 && attacker.hp > 0) {
    const healed = Math.min(Math.floor(dmgDealt / 2), attacker.maxHp - attacker.hp);
    attacker.hp += healed;
    if (healed > 0) log(state, `${attacker.base.name} drained ${healed} HP.`, { kind: 'heal', uid: attacker.uid, amount: healed });
  }
  if (e.recoil) {
    attacker.hp -= e.recoil;
    log(state, `${attacker.base.name} took ${e.recoil} recoil damage.`, { kind: 'hit', uid: attacker.uid, amount: e.recoil });
  }
  if (e.paralyze && defender.hp > 0 && state.rng() < e.paralyze) {
    defender.paralyzed = true;
    log(state, `${defender.base.name} is paralyzed!`, { kind: 'status', uid: defender.uid });
  }
  if (e.burn && defender.hp > 0 && state.rng() < e.burn) {
    defender.burned = true;
    log(state, `${defender.base.name} is burned!`, { kind: 'status', uid: defender.uid });
  }
  if (e.poison && defender.hp > 0 && state.rng() < e.poison) {
    defender.poisoned = true;
    log(state, `${defender.base.name} is poisoned!`, { kind: 'status', uid: defender.uid });
  }
  if (e.snipe && o.bench.length > 0) {
    const target = o.bench[Math.floor(state.rng() * o.bench.length)];
    target.hp -= e.snipe;
    log(state, `${target.base.name} on the bench took ${e.snipe} splash damage!`, { kind: 'hit', uid: target.uid, amount: e.snipe });
  }
  if (e.shield) {
    attacker.shield = e.shield;
    log(state, `${attacker.base.name} raised a barrier (${e.shield}).`, { kind: 'status', uid: attacker.uid });
  }
  if (e.discardSelf) {
    const lost = Math.min(e.discardSelf, attacker.energy);
    attacker.energy -= lost;
    if (lost > 0) log(state, `${attacker.base.name} discarded ${lost} energy.`, { kind: 'energy', uid: attacker.uid });
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
        log(state, `${ko.base.name} was knocked out on the bench! (${o.name}: ${o.prizes}/${o.prizeTarget} KOs)`, { kind: 'ko', uid: ko.uid });
      }
    }

    if (s.active && s.active.hp <= 0) {
      const ko = s.active;
      s.discard.push(ko);
      s.active = null;
      o.prizes++;
      log(state, `${ko.base.name} was knocked out! (${o.name}: ${o.prizes}/${o.prizeTarget} KOs)`, { kind: 'ko', uid: ko.uid });
    }
  }
  checkWinner(state);
  if (state.winner) return;

  // Field replacements for any side that lost its active.
  for (const who of ['player', 'enemy']) {
    const s = side(state, who);
    if (s.active) continue;
    const from = s.bench.length > 0 ? 'bench' : 'hand';
    const options = promoteOptions(s, from);
    if (options.length === 0) {
      state.winner = opponentOf(who);
      log(state, `${s.name} has no Pokémon left! ${side(state, state.winner).name} wins!`);
      return;
    }
    if (who === 'player' && options.length > 1) {
      state.pendingPromote = { side: who, from, options };
    } else {
      autoPromote(state, who, options);
    }
  }
}

// Promotable cards with their absolute index in the pool (hands may also hold
// trainer cards, which can't be sent into battle).
function promoteOptions(s, from) {
  const pool = from === 'bench' ? s.bench : s.hand;
  return pool.map((card, index) => ({ index, card })).filter(({ card }) => card.kind === 'poke');
}

function autoPromote(state, who, options) {
  const s = side(state, who);
  const o = side(state, opponentOf(who));
  // Pick the replacement with the best type match-up, then the most HP.
  let best = options[0].index;
  let bestScore = -Infinity;
  for (const { index, card } of options) {
    const offense = o.active ? typeMultiplier(card.base.type, o.active.base.type) : 1;
    const score = offense * 100 + card.hp;
    if (score > bestScore) { bestScore = score; best = index; }
  }
  promote(state, who, best);
}

export function promote(state, who, index) {
  const s = side(state, who);
  if (s.active) return false;
  const pool = s.bench.length > 0 ? s.bench : s.hand;
  const card = pool[index];
  if (!card || card.kind !== 'poke') return false;
  pool.splice(index, 1);
  s.active = card;
  if (state.pendingPromote?.side === who) state.pendingPromote = null;
  log(state, `${s.name} sent out ${card.base.name}!`, { kind: 'promote', uid: card.uid });
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

  // Special Conditions tick between turns (rulebook):
  // Burned = 2 damage counters (20), then a coin flip to recover.
  if (s.active?.burned) {
    s.active.hp -= 20;
    log(state, `${s.active.base.name} is hurt by its burn (20).`, { kind: 'hit', uid: s.active.uid, amount: 20 });
    if (state.rng() < 0.5) {
      s.active.burned = false;
      log(state, `${s.active.base.name}'s burn wore off.`);
    }
    resolveKnockouts(state);
    if (state.winner) return;
  }
  // Poisoned = 1 damage counter (10); it does not wear off on its own.
  if (s.active?.poisoned) {
    s.active.hp -= 10;
    log(state, `${s.active.base.name} is hurt by poison (10).`, { kind: 'hit', uid: s.active.uid, amount: 10 });
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
