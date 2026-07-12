// All screens and DOM rendering. The UI drives the battle engine through its
// public API only; game rules live in js/engine/.

import { POKEDEX, getPokemon, artSources } from './data/pokedex.js';
import { getTrainer } from './data/trainers.js';
import { TYPE_ICONS, TYPE_COLORS, TYPES, typeMultiplier } from './data/typechart.js';
import { DECKS } from './data/decks.js';
import { LEVELS } from './data/levels.js';
import {
  newBattle, playToBench, attachEnergy, attack, retreat, endTurn, promote,
  playTrainer, attackDamage, canRetreat, BENCH_SIZE,
} from './engine/battle.js';
import { aiTakeTurn } from './engine/ai.js';
import {
  loadSave, unlockedDecks, markSeen, recordWin, recordLoss, resetSave,
} from './storage.js';

const app = document.getElementById('app');

let screen = 'menu';        // menu | levels | deckpick | battle | dex
let currentLevel = null;
let currentDeck = null;
let battle = null;
let benchMode = null;       // null | 'retreat' | 'switch' (switch = free, via trainer card)
let switchHandIdx = -1;     // hand index of the Switch card being played
let lastSeenLog = 0;
let enemyThinking = false;
let resultModal = null;     // { win, newCatches, unlockedDeck }
let dexDetail = null;       // pokedex entry shown in modal
let dexFilter = { q: '', type: '', gen: '', status: '' };
let helpOpen = false;       // in-battle "how to play" overlay

// ---------------------------------------------------------------- helpers

function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content;
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function typeChip(type) {
  return `<span class="type-chip" style="background:${TYPE_COLORS[type]}">${TYPE_ICONS[type]} ${type}</span>`;
}

// Every Pokémon gets its own photo, with graceful fallback down the source
// list and finally to a type glyph (pattern ported from Phantom Gate TCG).
function spriteImg(base, cls = '', lazy = false) {
  const srcs = artSources(base.id);
  const onerr = "var s=JSON.parse(this.dataset.s);var i=(+this.dataset.i||0)+1;"
    + "if(i<s.length){this.dataset.i=i;this.src=s[i];}"
    + "else{this.outerHTML='<span class=\\'glyph\\'>'+this.dataset.g+'</span>';}";
  return `<img class="sprite ${cls}" ${lazy ? 'loading="lazy"' : ''} src="${srcs[2]}"
    data-s="${esc(JSON.stringify(srcs))}" data-i="2" data-g="${TYPE_ICONS[base.type]}"
    onerror="${onerr}" alt="${esc(base.name)}">`;
}

// Bigger art (official artwork first) for detail views.
function artworkImg(base, cls = '') {
  const srcs = artSources(base.id);
  const onerr = "var s=JSON.parse(this.dataset.s);var i=(+this.dataset.i||0)+1;"
    + "if(i<s.length){this.dataset.i=i;this.src=s[i];}"
    + "else{this.outerHTML='<span class=\\'glyph\\'>'+this.dataset.g+'</span>';}";
  return `<img class="artwork ${cls}" loading="lazy" src="${srcs[0]}"
    data-s="${esc(JSON.stringify(srcs))}" data-i="0" data-g="${TYPE_ICONS[base.type]}"
    onerror="${onerr}" alt="${esc(base.name)}">`;
}

export function render() {
  app.innerHTML = '';
  app.appendChild(topbar());
  const view = { menu, levels, deckpick, battle: battleScreen, dex }[screen]();
  view.firstElementChild?.classList.add('fade-in');
  app.appendChild(view);
  if (resultModal) app.appendChild(resultOverlay());
  if (dexDetail) app.appendChild(dexOverlay());
  if (helpOpen) app.appendChild(helpOverlay());
  if (battle?.pendingPromote?.side === 'player' && screen === 'battle' && !resultModal) {
    app.appendChild(promoteOverlay());
  }
  const entries = app.querySelector('.logbox .entries');
  if (entries) entries.scrollTop = entries.scrollHeight;
}

function go(next) {
  screen = next;
  benchMode = null;
  switchHandIdx = -1;
  render();
}

function topbar() {
  const frag = h(`
    <div class="topbar">
      <div class="title">🎴 Pokémon <span>Karte</span></div>
      <nav>
        <button data-nav="menu">Menu</button>
        <button data-nav="levels">Campaign</button>
        <button data-nav="dex">Pokédex</button>
      </nav>
    </div>`);
  frag.querySelectorAll('[data-nav]').forEach((b) => {
    b.onclick = () => {
      if (screen === 'battle' && battle && !battle.winner
          && !confirm('Leave the battle? It will count as a loss.')) return;
      if (screen === 'battle' && battle && !battle.winner) recordLoss();
      battle = null;
      resultModal = null;
      go(b.dataset.nav);
    };
  });
  return frag;
}

// ---------------------------------------------------------------- menu

function menu() {
  const save = loadSave();
  const frag = h(`
    <div>
      <div class="menu-hero">
        <h1>Pokémon <em>Karte</em></h1>
        <p>A card-battle campaign in ten escalating levels. Outplay ever-smarter trainers,
           unlock new decks, fill your Pokédex — and survive the Hall of Origin.</p>
        <div class="menu-actions">
          <button class="btn-primary" data-act="campaign">⚔️ Campaign</button>
          <button data-act="dex">📖 Pokédex</button>
          <button class="btn-danger" data-act="reset">Reset progress</button>
        </div>
        <div class="menu-stats">
          Levels beaten: ${save.beatenLevel}/${LEVELS.length} ·
          Battles won: ${save.wins} · lost: ${save.losses} ·
          Pokédex: ${save.caught.length}/${POKEDEX.length} caught
        </div>
      </div>
    </div>`);
  frag.querySelector('[data-act="campaign"]').onclick = () => go('levels');
  frag.querySelector('[data-act="dex"]').onclick = () => go('dex');
  frag.querySelector('[data-act="reset"]').onclick = () => {
    if (confirm('Wipe all campaign progress and Pokédex data?')) { resetSave(); render(); }
  };
  return frag;
}

// ---------------------------------------------------------------- level map

function levelMods(level) {
  const mods = [];
  if (level.aiHpBonus) mods.push(`+${level.aiHpBonus} enemy HP`);
  if (level.aiDamageBonus) mods.push(`+${level.aiDamageBonus} enemy damage`);
  if (level.doubleEnergyEvery) mods.push('enemy charges extra energy');
  if (level.playerHandSize < 5) mods.push(`your hand: ${level.playerHandSize}`);
  if (level.playerPrizeTarget > level.aiPrizeTarget) {
    mods.push(`KOs needed — you: ${level.playerPrizeTarget}, foe: ${level.aiPrizeTarget}`);
  }
  return mods;
}

function levels() {
  const save = loadSave();
  const frag = h(`<div><h2 style="margin-bottom:14px">Campaign</h2><div class="level-grid"></div></div>`);
  const grid = frag.querySelector('.level-grid');
  for (const level of LEVELS) {
    const beaten = level.id <= save.beatenLevel;
    const isNext = level.id === save.beatenLevel + 1;
    const locked = !beaten && !isNext;
    const badge = beaten ? '<span class="badge done">Beaten</span>'
      : isNext ? '<span class="badge next">Next</span>'
      : '<span class="badge lock">🔒 Locked</span>';
    const mods = levelMods(level).map((m) => `<span class="mod-chip">${m}</span>`).join('');
    const card = h(`
      <div class="level-card ${locked ? 'locked' : ''}">
        ${badge}
        <div class="lvl-head">
          <div class="lvl-icon">${level.icon}</div>
          <div>
            <div class="lvl-no">Level ${level.id} · ${level.ai} AI</div>
            <div class="lvl-title">${esc(level.title)} — ${esc(level.trainer)}</div>
          </div>
        </div>
        <div class="blurb">${esc(level.blurb)}</div>
        ${mods ? `<div class="lvl-mods">${mods}</div>` : ''}
      </div>`);
    if (!locked) {
      card.firstElementChild.onclick = () => { currentLevel = level; go('deckpick'); };
    }
    grid.appendChild(card);
  }
  return frag;
}

// ---------------------------------------------------------------- deck picker

function deckpick() {
  const save = loadSave();
  const frag = h(`
    <div>
      <h2 style="margin-bottom:4px">Choose your deck</h2>
      <p style="color:var(--text-dim);margin-bottom:14px">
        vs ${esc(currentLevel.trainer)} — ${esc(currentLevel.title)}. Type match-ups decide battles: pick wisely.
      </p>
      <div class="deck-grid"></div>
    </div>`);
  const grid = frag.querySelector('.deck-grid');
  for (const deck of DECKS) {
    const locked = deck.unlockLevel > save.beatenLevel;
    const minis = deck.cards.map((code) => {
      if (typeof code === 'string') {
        const t = getTrainer(code);
        return `<span class="mini-type trainer" title="${esc(t.name)}">${t.icon}</span>`;
      }
      const p = getPokemon(code);
      return `<span class="mini-type" title="${esc(p.name)}" style="background:${TYPE_COLORS[p.type]}">${spriteImg(p, 'mini')}</span>`;
    }).join('');
    const card = h(`
      <div class="deck-card ${locked ? 'locked' : ''}">
        <div class="deck-icon">${deck.icon}</div>
        <h3>${esc(deck.name)}</h3>
        <div class="desc">${esc(deck.desc)}</div>
        <div class="mini-cards">${minis}</div>
        ${locked ? `<div style="margin-top:10px;font-size:12.5px;color:var(--text-dim)">🔒 Beat level ${deck.unlockLevel} to unlock</div>` : ''}
      </div>`);
    if (!locked) card.firstElementChild.onclick = () => startBattle(currentLevel, deck);
    grid.appendChild(card);
  }
  return frag;
}

// ---------------------------------------------------------------- battle

function startBattle(level, deck) {
  currentDeck = deck;
  battle = newBattle({ playerDeckIds: deck.cards, level });
  markSeen(level.deck);
  lastSeenLog = battle.log.length;
  resultModal = null;
  enemyThinking = false;
  playing = false;
  bannerText = battle.log[battle.log.length - 1]?.msg
    || `${level.trainer} wants to battle! First to ${level.playerPrizeTarget} KOs wins.`;
  // Show the how-to-play card automatically on the very first battle.
  if (!localStorage.getItem('pokemonkarte-help-seen')) {
    helpOpen = true;
    localStorage.setItem('pokemonkarte-help-seen', '1');
  }
  go('battle');
  maybeEnemyTurn(); // the coin flip may have given the trainer the first turn
}

// ----- action → animation pipeline ------------------------------------
// Every game action goes through act(): the engine appends log entries with
// fx metadata, then animateDelta() replays them one at a time — banner text,
// floating damage numbers, energy pulses, KO fades — before the final render.

let playing = false;
let bannerText = '';

const FX_DELAY = {
  hit: 900, ko: 950, promote: 700, heal: 650, energy: 550,
  status: 650, bench: 450, trainer: 700, default: 500,
};

function act(fn) {
  if (!battle || playing || battle.winner) return;
  const from = battle.log.length;
  const ok = fn();
  if (ok === false) { render(); return; }
  animateDelta(from, () => {
    render();
    if (battle.winner) return finishBattle();
    maybeEnemyTurn();
  });
}

function animateDelta(from, done) {
  if (!battle) return;
  const entries = battle.log.slice(from);
  if (entries.length === 0) { done(); return; }
  playing = true;
  document.querySelector('.bstage')?.classList.add('locked');
  const speed = entries.length > 8 ? 0.6 : 1;
  let i = 0;
  const step = () => {
    if (!battle || i >= entries.length) {
      playing = false;
      done();
      return;
    }
    const entry = entries[i++];
    bannerText = entry.msg;
    const bannerEl = document.getElementById('event-banner');
    if (bannerEl) {
      bannerEl.textContent = entry.msg;
      bannerEl.classList.remove('pop');
      void bannerEl.offsetWidth; // restart the pop animation
      bannerEl.classList.add('pop');
    }
    applyFx(entry.fx);
    const kind = entry.fx?.kind || 'default';
    setTimeout(step, (FX_DELAY[kind] || FX_DELAY.default) * speed);
  };
  step();
}

function applyFx(fx) {
  if (!fx?.uid) return;
  const el = document.querySelector(`[data-uid="${fx.uid}"]`);
  if (!el) return;
  const flash = (cls, ms = 700) => { el.classList.add(cls); setTimeout(() => el.classList.remove(cls), ms); };
  if (fx.kind === 'hit') { flash('shake', 620); if (fx.amount > 0) floatNum(el, `−${fx.amount}`, 'dmg'); }
  else if (fx.kind === 'heal') { flash('glow-heal'); floatNum(el, `+${fx.amount}`, 'heal'); }
  else if (fx.kind === 'energy') { flash('glow-energy'); floatNum(el, '+⚡', 'energy'); }
  else if (fx.kind === 'ko') el.classList.add('ko');
  else if (fx.kind === 'status') flash('shake-mild', 620);
  else if (fx.kind === 'promote' || fx.kind === 'bench') flash('glow-in');
}

function floatNum(el, text, cls) {
  const span = document.createElement('span');
  span.className = `float-num ${cls}`;
  span.textContent = text;
  el.appendChild(span);
  setTimeout(() => span.remove(), 1200);
}

function maybeEnemyTurn() {
  if (!battle || battle.winner || enemyThinking || playing) return;
  if (battle.turn !== 'enemy' || battle.pendingPromote) return;
  enemyThinking = true;
  bannerText = `${battle.enemy.name} is thinking…`;
  render();
  setTimeout(() => {
    if (!battle || battle.winner) { enemyThinking = false; return; }
    const from = battle.log.length;
    aiTakeTurn(battle, currentLevel.ai, 'enemy');
    animateDelta(from, () => {
      enemyThinking = false;
      render();
      if (battle.winner) return finishBattle();
    });
  }, 800);
}

function finishBattle() {
  const win = battle.winner === 'player';
  const save = loadSave();
  const before = new Set(save.caught);
  const beatenBefore = save.beatenLevel;
  if (win) recordWin(currentLevel); else recordLoss();
  const newCatches = win ? currentLevel.rewardCatch.filter((id) => !before.has(id)) : [];
  const unlockedDeck = win
    ? DECKS.find((d) => d.unlockLevel > beatenBefore && d.unlockLevel <= loadSave().beatenLevel)
    : null;
  resultModal = { win, newCatches, unlockedDeck };
  render();
}

// ----- cards ------------------------------------------------------------

// size: 'active' (big, in the arena) | 'hand' | 'chip' (bench)
function pcard(card, { size = 'hand', attacks = false, selectable = false, badge = '' } = {}) {
  if (card.kind === 'trainer') return tcard(card, { size, selectable });
  const base = card.base;
  const pct = Math.max(0, Math.min(100, (card.hp / card.maxHp) * 100));
  const barClass = pct <= 30 ? 'low' : pct <= 60 ? 'mid' : '';
  const statuses = [
    card.paralyzed ? '<span title="Paralyzed">💫</span>' : '',
    card.burned ? '<span title="Burned">🔥</span>' : '',
    card.poisoned ? '<span title="Poisoned">☠️</span>' : '',
    card.shield > 0 ? `<span title="Barrier ${card.shield}">🛡️</span>` : '',
  ].join('');

  let attackHtml = '';
  if (attacks) {
    const defender = battle.enemy.active;
    attackHtml = '<div class="attack-list">' + base.attacks.map((atk, i) => {
      const afford = card.energy >= atk.cost;
      const usable = afford && battle.turn === 'player' && !battle.winner
        && battle.turnNumber > 1
        && !battle.pendingPromote && !battle.player.attackedThisTurn && !enemyThinking && !playing;
      const dmg = defender ? attackDamage(atk, card, defender, battle.player.damageBonus) : atk.damage;
      const eff = defender && !atk.effect?.pierce
        ? typeMultiplier(base.type, defender.base.type) : 1;
      const effIcon = eff > 1 ? ' ▲' : eff < 1 ? ' ▼' : '';
      const pips = Array.from({ length: atk.cost }, (_, k) =>
        `<span class="pip ${k < card.energy ? 'on' : ''}">⚡</span>`).join('');
      return `<button class="attack-btn" data-atk="${i}" ${usable ? '' : 'disabled'}>
        <span class="atk-name">${pips || '·'} ${esc(atk.name)}</span>
        <span class="dmg">${atk.damage === 0 ? '—' : dmg + effIcon}</span>
      </button>`;
    }).join('') + '</div>';
  }

  const frag = h(`
    <div class="pcard ${size} ${selectable ? 'selectable' : ''} ${base.rarity === 'legendary' ? 'legendary' : ''}"
         data-uid="${card.uid}" style="--tc:${TYPE_COLORS[base.type]}">
      ${badge ? `<span class="pbadge ${badge === 'READY' ? 'ready' : 'charge'}">${badge}</span>` : ''}
      <div class="head">
        <span>${TYPE_ICONS[base.type]}</span><span>${base.rarity === 'legendary' ? '★ LEGEND' : esc(base.rarity)}</span>
      </div>
      <div class="statuses">${statuses}</div>
      <div class="art">${spriteImg(base)}</div>
      <div class="nm">${esc(base.name)}</div>
      <div class="hpbar ${barClass}"><div style="width:${pct}%"></div></div>
      <div class="hptxt"><strong>${Math.max(0, card.hp)}</strong>/${card.maxHp} HP</div>
      <div class="energy">${card.energy > 0 ? '⚡'.repeat(Math.min(card.energy, 6)) + (card.energy > 6 ? `+${card.energy - 6}` : '') : '<span class="noenergy">no energy</span>'}</div>
      ${attackHtml}
    </div>`);
  return frag;
}

// Trainer (support) card.
function tcard(card, { size = 'hand', selectable = false } = {}) {
  const t = card.trainer;
  return h(`
    <div class="pcard tcard ${size} ${selectable ? 'selectable' : ''}" data-uid="${card.uid}" title="${esc(t.desc)}">
      <div class="head trainer-head"><span>${t.icon}</span><span>${t.category === 'supporter' ? 'SUPPORTER' : 'ITEM'}</span></div>
      <div class="art"><span class="glyph">${t.icon}</span></div>
      <div class="nm">${esc(t.name)}</div>
      <div class="tdesc">${esc(t.desc)}</div>
    </div>`);
}

function diamonds(side) {
  return '◆'.repeat(side.prizes) + '◇'.repeat(Math.max(0, side.prizeTarget - side.prizes));
}

// ----- the battle screen -------------------------------------------------

function battleScreen() {
  if (!battle) { go('levels'); return h('<div></div>'); }
  const b = battle;
  const you = b.player;
  const foe = b.enemy;
  const yourTurn = b.turn === 'player' && !b.winner && !enemyThinking && !playing;
  const canGiveEnergy = yourTurn && you.energyBudget > 0 && !b.pendingPromote;

  // Contextual hint when nothing is animating.
  let idleHint = bannerText;
  if (yourTurn && !playing) {
    if (b.turnNumber === 1) idleHint = 'First turn: bench Pokémon and attach energy — attacking starts next turn (official rule).';
    else if (benchMode === 'switch') idleHint = 'Switch: tap a bench Pokémon to swap in for free.';
    else if (benchMode === 'retreat') idleHint = `Retreat: tap a bench Pokémon to swap in (costs ⚡${you.active ? you.active.base.retreat : 0}).`;
    else if (canGiveEnergy) idleHint = '⚡ Tap one of your Pokémon to give it energy.';
    else if (you.active && affordableAttack(you.active) && !you.attackedThisTurn) idleHint = 'Choose an attack — or play cards first.';
    else idleHint = 'Not enough energy to attack. Play cards, then end your turn.';
  }

  const frag = h(`
    <div class="bstage">
      <div class="statusbar">
        <span class="turnchip ${yourTurn ? 'you' : 'foe'}">
          ${b.winner ? '🏁 Battle over' : yourTurn ? `Turn ${Math.ceil(b.turnNumber / 2)} · YOUR MOVE` : `Turn ${Math.ceil(b.turnNumber / 2)} · ${esc(foe.name.toUpperCase())}`}
        </span>
        <span class="score" title="Knock-outs scored — fill all diamonds to win">
          <span class="you-score">You ${diamonds(you)}</span>
          <span class="foe-score">${diamonds(foe)} ${esc(foe.name)}</span>
        </span>
        <button class="help-btn" id="btn-help" title="How to play">?</button>
      </div>

      <section class="zone foe-zone">
        <div class="zone-title">${currentLevel.icon} ${esc(foe.name)}
          <span class="dim">· ${foe.hand.length} in hand · ${foe.deck.length} in deck</span>
        </div>
        <div class="bench-strip" id="foe-bench"></div>
        <div class="arena-row"><div class="arena-slot" id="foe-active"></div></div>
      </section>

      <div class="event-banner pop" id="event-banner">${esc(idleHint)}</div>

      <section class="zone you-zone">
        <div class="arena-row"><div class="arena-slot" id="you-active"></div></div>
        <div class="bench-strip" id="you-bench"></div>
        <div class="zone-title">Your bench <span class="dim">· ${you.bench.length}/${BENCH_SIZE} — benched Pokémon wait here until you retreat or switch</span></div>
      </section>

      <section class="hand-zone">
        <div class="zone-title">🎴 Your hand (${you.hand.length})
          <span class="dim">· tap a Pokémon to bench it · tap a Trainer to use it</span>
        </div>
        <div class="hand-strip" id="hand"></div>
      </section>

      <div class="action-bar">
        <span class="energy-chip ${you.energyBudget > 0 && yourTurn ? 'has' : ''}">⚡ ${you.energyBudget} to attach</span>
        <span class="deckcount ${you.deck.length <= 3 ? 'warn' : 'dim'}">deck ${you.deck.length}${you.deck.length <= 3 ? ' ⚠' : ''}</span>
        <span class="spacer"></span>
        <button id="btn-retreat" ${yourTurn && (benchMode || canRetreat(b, 'player')) ? '' : 'disabled'}>
          ${benchMode ? '✖ Cancel' : `Retreat ⚡${you.active ? you.active.base.retreat : 0}`}</button>
        <button id="btn-end" class="btn-primary" ${yourTurn ? '' : 'disabled'}>End turn ▶</button>
      </div>

      <details class="logbox">
        <summary>📜 Battle log (${b.log.length})</summary>
        <div class="entries"></div>
      </details>
    </div>`);

  // ---- enemy field
  const foeBench = frag.querySelector('#foe-bench');
  foe.bench.forEach((c) => foeBench.appendChild(pcard(c, { size: 'chip' })));
  for (let i = foe.bench.length; i < BENCH_SIZE; i++) foeBench.appendChild(h('<div class="empty-slot"></div>'));
  if (foe.active) frag.querySelector('#foe-active').appendChild(pcard(foe.active, { size: 'active' }));

  // ---- your active (attacks + READY badge)
  if (you.active) {
    const ready = affordableAttack(you.active) && !you.attackedThisTurn;
    const badge = !yourTurn ? '' : ready ? 'READY' : 'NEEDS ⚡';
    const activeCard = pcard(you.active, {
      size: 'active', attacks: true, badge,
      selectable: canGiveEnergy && !benchMode,
    });
    activeCard.querySelectorAll('[data-atk]').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        act(() => attack(b, 'player', Number(btn.dataset.atk)));
      };
    });
    if (canGiveEnergy && !benchMode) {
      activeCard.firstElementChild.onclick = () => act(() => attachEnergy(b, 'player', 'active'));
      activeCard.firstElementChild.title = 'Tap to attach ⚡ energy';
    }
    frag.querySelector('#you-active').appendChild(activeCard);
  }

  // ---- your bench
  const youBench = frag.querySelector('#you-bench');
  you.bench.forEach((c, i) => {
    const selectable = (benchMode && yourTurn) || (canGiveEnergy && !benchMode);
    const cardEl = pcard(c, { size: 'chip', selectable });
    if (benchMode && yourTurn) {
      cardEl.firstElementChild.onclick = () => {
        const mode = benchMode;
        const trainerIdx = switchHandIdx;
        benchMode = null;
        switchHandIdx = -1;
        if (mode === 'switch') act(() => playTrainer(b, 'player', trainerIdx, i));
        else act(() => retreat(b, 'player', i));
      };
    } else if (canGiveEnergy) {
      cardEl.firstElementChild.onclick = () => act(() => attachEnergy(b, 'player', i));
      cardEl.firstElementChild.title = 'Tap to attach ⚡ energy';
    }
    youBench.appendChild(cardEl);
  });
  for (let i = you.bench.length; i < BENCH_SIZE; i++) {
    youBench.appendChild(h('<div class="empty-slot">bench<br>slot</div>'));
  }

  // ---- hand
  const hand = frag.querySelector('#hand');
  you.hand.forEach((c, i) => {
    const actable = yourTurn && !b.pendingPromote && !benchMode;
    if (c.kind === 'trainer') {
      const cardEl = pcard(c, { size: 'hand', selectable: actable });
      if (actable) {
        cardEl.firstElementChild.onclick = () => {
          if (c.trainer.key === 'switch') {
            if (you.bench.length === 0 || !you.active) { setBanner('Switch needs a benched Pokémon.'); return; }
            benchMode = 'switch';
            switchHandIdx = i;
            render();
          } else if (c.trainer.category === 'supporter' && you.supporterUsedThisTurn) {
            setBanner('Only one Supporter card per turn (official rule).');
          } else {
            act(() => playTrainer(b, 'player', i));
          }
        };
      }
      hand.appendChild(cardEl);
    } else {
      const canPlay = actable && you.bench.length < BENCH_SIZE;
      const cardEl = pcard(c, { size: 'hand', selectable: canPlay });
      if (actable) {
        cardEl.firstElementChild.onclick = () => {
          if (!canPlay) { setBanner('Your bench is full (3/3).'); return; }
          act(() => playToBench(b, 'player', i));
        };
      }
      hand.appendChild(cardEl);
    }
  });
  if (you.hand.length === 0) hand.appendChild(h('<div class="dim" style="padding:8px">No cards in hand — you draw 1 each turn.</div>'));

  // ---- action buttons
  frag.querySelector('#btn-help').onclick = () => { helpOpen = true; render(); };
  frag.querySelector('#btn-retreat').onclick = () => {
    benchMode = benchMode ? null : 'retreat';
    switchHandIdx = -1;
    render();
  };
  frag.querySelector('#btn-end').onclick = () => { benchMode = null; act(() => { endTurn(b); }); };

  // ---- log
  const entries = frag.querySelector('.entries');
  b.log.forEach((entry, i) => {
    entries.appendChild(h(`<div class="${i >= lastSeenLog ? 'recent' : ''}">${esc(entry.msg)}</div>`));
  });
  if (yourTurn) lastSeenLog = b.log.length;

  return frag;
}

function affordableAttack(card) {
  return card.base.attacks.some((atk) => card.energy >= atk.cost);
}

function setBanner(text) {
  bannerText = text;
  const el = document.getElementById('event-banner');
  if (el) {
    el.textContent = text;
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }
}

// ---------------------------------------------------------------- overlays

function helpOverlay() {
  const frag = h(`
    <div class="overlay">
      <div class="modal help-modal">
        <h2>How a turn works</h2>
        <div class="help-steps">
          <div class="help-step"><span class="step-no">1</span>
            <div><strong>Play cards from your hand</strong><br>
            Tap a Pokémon to put it on your bench (max 3). Tap a Trainer card to use its effect — it never ends your turn.</div></div>
          <div class="help-step"><span class="step-no">2</span>
            <div><strong>Attach your ⚡ energy</strong><br>
            You get 1 energy per turn. Tap any of your Pokémon (glowing gold) to power it up. Attacks need energy to use — but don't spend it.</div></div>
          <div class="help-step"><span class="step-no">3</span>
            <div><strong>Attack (or retreat)</strong><br>
            When your active Pokémon shows <span style="color:#7fd493;font-weight:700">READY</span>, tap an attack. ▲ means super effective (×2), ▼ resisted (×½). Attacking ends your turn. Official rules: the coin-flip winner goes first but can't attack on the game's very first turn, you may retreat only once per turn, and only one Supporter card per turn.</div></div>
          <div class="help-step"><span class="step-no">4</span>
            <div><strong>Win by knock-outs</strong><br>
            Each KO fills one of your diamonds ◆ at the top. Fill them all before your opponent does — and watch your deck: if you can't draw a card at the start of your turn, you lose (deck-out). 💫 paralysis skips a turn, 🔥 burn deals 20 between turns, ☠️ poison deals 10 and doesn't wear off, 🛡️ barriers absorb one hit. Retreating cures conditions.</div></div>
        </div>
        <div class="btns"><button class="btn-primary">Got it!</button></div>
      </div>
    </div>`);
  frag.querySelector('button.btn-primary').onclick = () => { helpOpen = false; render(); };
  frag.querySelector('.overlay').onclick = (e) => {
    if (e.target.classList.contains('overlay')) { helpOpen = false; render(); }
  };
  return frag;
}

function promoteOverlay() {
  const pending = battle.pendingPromote;
  const frag = h(`
    <div class="overlay">
      <div class="modal">
        <h2>Choose your next Pokémon</h2>
        <p class="sub">${esc(battle.player.active === null ? 'Your active Pokémon was knocked out.' : '')}
          Send in a replacement from your ${pending.from}.</p>
        <div class="choices"></div>
      </div>
    </div>`);
  const choices = frag.querySelector('.choices');
  pending.options.forEach(({ index, card }) => {
    const el = pcard(card, { size: 'hand', selectable: true });
    el.firstElementChild.onclick = () => {
      promote(battle, 'player', index);
      render();
      maybeEnemyTurn();
    };
    choices.appendChild(el);
  });
  return frag;
}

function resultOverlay() {
  const { win, newCatches, unlockedDeck } = resultModal;
  const confetti = win
    ? `<div class="confetti">${Array.from({ length: 16 }, (_, i) =>
        `<i style="left:${4 + i * 6}%;animation-delay:${(i % 8) * 0.21}s;background:${['#ffcb05', '#ff5b60', '#58d68b', '#6890f0', '#f85888', '#a890f0'][i % 6]}"></i>`).join('')}</div>`
    : '';
  const frag = h(`
    <div class="overlay">
      <div class="modal">
        ${confetti}
        <h2>${win ? '🏆 Victory!' : '💀 Defeat…'}</h2>
        <p class="sub">${win
          ? `You beat ${esc(currentLevel.trainer)} at ${esc(currentLevel.title)}!`
          : `${esc(currentLevel.trainer)} was too strong this time. Try a different deck — type match-ups matter.`}</p>
        ${win && newCatches.length ? `<div><strong>New Pokédex catches:</strong><div class="reward-row" id="rewards"></div></div>` : ''}
        ${win && unlockedDeck ? `<p style="margin-top:14px">🎉 New deck unlocked: <strong>${unlockedDeck.icon} ${esc(unlockedDeck.name)}</strong></p>` : ''}
        <div class="btns">
          <button data-act="retry">${win ? 'Rematch' : 'Retry'}</button>
          <button data-act="deck">Change deck</button>
          <button class="btn-primary" data-act="map">Back to campaign</button>
        </div>
      </div>
    </div>`);
  const rewards = frag.querySelector('#rewards');
  if (rewards) {
    newCatches.forEach((id) => {
      const base = getPokemon(id);
      rewards.appendChild(h(`
        <div style="text-align:center">
          <div class="reward-art">${spriteImg(base)}</div>
          <div style="font-size:12.5px;font-weight:600">${esc(base.name)}</div>
          <div>${typeChip(base.type)}</div>
        </div>`));
    });
  }
  frag.querySelector('[data-act="retry"]').onclick = () => startBattle(currentLevel, currentDeck);
  frag.querySelector('[data-act="deck"]').onclick = () => { battle = null; resultModal = null; go('deckpick'); };
  frag.querySelector('[data-act="map"]').onclick = () => { battle = null; resultModal = null; go('levels'); };
  return frag;
}

// ---------------------------------------------------------------- pokédex

const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function dex() {
  const save = loadSave();
  const seenSet = new Set(save.seen);
  const caughtSet = new Set(save.caught);
  const legendaries = POKEDEX.filter((p) => p.rarity === 'legendary');

  const frag = h(`
    <div>
      <h2>Pokédex</h2>
      <div class="dex-progress">
        Seen ${save.seen.length}/${POKEDEX.length} · Caught ${save.caught.length}/${POKEDEX.length}
        · Legendaries caught: ${legendaries.filter((p) => caughtSet.has(p.id)).length}/${legendaries.length} ★
      </div>
      <div class="dex-controls">
        <input type="search" id="dex-q" placeholder="Search name or #number…" value="${esc(dexFilter.q)}">
        <select id="dex-type">
          <option value="">All types</option>
          ${TYPES.map((t) => `<option value="${t}" ${dexFilter.type === t ? 'selected' : ''}>${TYPE_ICONS[t]} ${t}</option>`).join('')}
        </select>
        <select id="dex-gen">
          <option value="">All generations</option>
          ${GENERATIONS.map((g) => `<option value="${g}" ${dexFilter.gen === String(g) ? 'selected' : ''}>Gen ${g}</option>`).join('')}
        </select>
        <select id="dex-status">
          <option value="">Everything</option>
          <option value="caught" ${dexFilter.status === 'caught' ? 'selected' : ''}>✅ Caught</option>
          <option value="seen" ${dexFilter.status === 'seen' ? 'selected' : ''}>👁 Seen</option>
          <option value="legendary" ${dexFilter.status === 'legendary' ? 'selected' : ''}>★ Legendary</option>
        </select>
      </div>
      <div class="dex-count"></div>
      <div class="dex-grid"></div>
    </div>`);

  const q = dexFilter.q.trim().toLowerCase();
  const filtered = POKEDEX.filter((p) => {
    if (q && !p.name.toLowerCase().includes(q) && String(p.id) !== q.replace('#', '')) return false;
    if (dexFilter.type && p.type !== dexFilter.type) return false;
    if (dexFilter.gen && String(p.gen) !== dexFilter.gen) return false;
    if (dexFilter.status === 'caught' && !caughtSet.has(p.id)) return false;
    if (dexFilter.status === 'seen' && !seenSet.has(p.id)) return false;
    if (dexFilter.status === 'legendary' && p.rarity !== 'legendary') return false;
    return true;
  });
  frag.querySelector('.dex-count').textContent = `${filtered.length} Pokémon shown`;

  const grid = frag.querySelector('.dex-grid');
  for (const p of filtered) {
    const seen = seenSet.has(p.id);
    const caught = caughtSet.has(p.id);
    const entry = h(`
      <div class="dex-entry ${seen ? '' : 'unseen'} ${p.rarity === 'legendary' && seen ? 'legendary' : ''}">
        <div class="dex-no">#${String(p.id).padStart(4, '0')} · G${p.gen}</div>
        <div class="dex-icon">${seen ? spriteImg(p, '', true) : '❔'}</div>
        <div class="dex-name">${seen ? esc(p.name) : '???'}</div>
        <div class="dex-status">${caught ? '✅ Caught' : seen ? '👁 Seen' : ''}</div>
      </div>`);
    if (seen) entry.firstElementChild.onclick = () => { dexDetail = p; render(); };
    grid.appendChild(entry);
  }

  frag.querySelector('#dex-q').oninput = (e) => { dexFilter.q = e.target.value; render(); refocus('dex-q'); };
  frag.querySelector('#dex-type').onchange = (e) => { dexFilter.type = e.target.value; render(); };
  frag.querySelector('#dex-gen').onchange = (e) => { dexFilter.gen = e.target.value; render(); };
  frag.querySelector('#dex-status').onchange = (e) => { dexFilter.status = e.target.value; render(); };
  return frag;
}

// Re-focus the search box after a render triggered by typing.
function refocus(id) {
  const el = document.getElementById(id);
  if (el) {
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }
}

function dexOverlay() {
  const p = dexDetail;
  const frag = h(`
    <div class="overlay">
      <div class="modal dex-detail">
        <div class="art">${artworkImg(p)}</div>
        <h2>${esc(p.name)} <span style="font-size:14px;color:var(--text-dim)">#${String(p.id).padStart(4, '0')} · Gen ${p.gen}</span></h2>
        <div style="margin:6px 0 10px">${typeChip(p.type)}
          ${p.rarity === 'legendary' ? '<span class="type-chip" style="background:var(--accent)">★ legendary</span>' : ''}
        </div>
        <div>${p.hp} HP · retreat cost ⚡${p.retreat}</div>
        <div>
          ${p.attacks.map((a) => `
            <div class="atk">
              <span>${'⚡'.repeat(a.cost) || '·'} <strong>${esc(a.name)}</strong></span>
              <span>${a.damage > 0 ? a.damage + ' dmg' : '—'}</span>
            </div>`).join('')}
        </div>
        <p class="desc">${esc(p.desc)}</p>
        <div class="btns"><button class="btn-primary">Close</button></div>
      </div>
    </div>`);
  frag.querySelector('button').onclick = () => { dexDetail = null; render(); };
  frag.querySelector('.overlay').onclick = (e) => {
    if (e.target.classList.contains('overlay')) { dexDetail = null; render(); }
  };
  return frag;
}
