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
  lastSeenLog = 0;
  resultModal = null;
  enemyThinking = false;
  go('battle');
}

function afterPlayerAction() {
  if (!battle) return;
  if (battle.winner) return finishBattle();
  render();
  maybeEnemyTurn();
}

function maybeEnemyTurn() {
  if (!battle || battle.winner || enemyThinking) return;
  if (battle.turn !== 'enemy' || battle.pendingPromote) return;
  enemyThinking = true;
  render();
  setTimeout(() => {
    enemyThinking = false;
    if (!battle || battle.winner) return;
    aiTakeTurn(battle, currentLevel.ai, 'enemy');
    if (battle.winner) return finishBattle();
    render();
  }, 900);
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

function pcard(card, { small = false, attacks = false, selectable = false, hideHp = false } = {}) {
  if (card.kind === 'trainer') return tcard(card, { small, selectable });
  const base = card.base;
  const pct = Math.max(0, Math.min(100, (card.hp / card.maxHp) * 100));
  const barClass = pct <= 30 ? 'low' : pct <= 60 ? 'mid' : '';
  const statuses = [
    card.paralyzed ? '<span title="Paralyzed">💫</span>' : '',
    card.burned ? '<span title="Burned">🔥</span>' : '',
    card.shield > 0 ? `<span title="Barrier ${card.shield}">🛡️</span>` : '',
  ].join('');
  let attackHtml = '';
  if (attacks) {
    const defender = battle.enemy.active;
    attackHtml = '<div class="attack-list">' + base.attacks.map((atk, i) => {
      const afford = card.energy >= atk.cost;
      const usable = afford && battle.turn === 'player' && !battle.winner
        && !battle.pendingPromote && !battle.player.attackedThisTurn && !enemyThinking;
      const dmg = defender ? attackDamage(atk, card, defender, battle.player.damageBonus) : atk.damage;
      const eff = defender && !atk.effect?.pierce
        ? typeMultiplier(base.type, defender.base.type) : 1;
      const effIcon = eff > 1 ? ' ▲' : eff < 1 ? ' ▼' : '';
      return `<button class="attack-btn" data-atk="${i}" ${usable ? '' : 'disabled'}>
        <span>${'⚡'.repeat(atk.cost) || '·'} ${esc(atk.name)}</span>
        <span class="dmg">${atk.damage === 0 ? '—' : dmg + effIcon}</span>
      </button>`;
    }).join('') + '</div>';
  }
  const frag = h(`
    <div class="pcard ${small ? 'small' : ''} ${selectable ? 'selectable' : ''} ${base.rarity === 'legendary' ? 'legendary' : ''}">
      <div class="head" style="background:${TYPE_COLORS[base.type]}">
        <span>${TYPE_ICONS[base.type]}</span><span>${base.rarity === 'legendary' ? '★ LEGEND' : esc(base.rarity)}</span>
      </div>
      <div class="statuses">${statuses}</div>
      <div class="art">${spriteImg(base)}</div>
      <div class="nm">${esc(base.name)}</div>
      ${hideHp ? '' : `
        <div class="hpbar ${barClass}"><div style="width:${pct}%"></div></div>
        <div class="hptxt">${Math.max(0, card.hp)}/${card.maxHp} HP</div>`}
      <div class="energy">${card.energy > 0 ? '⚡'.repeat(Math.min(card.energy, 8)) + (card.energy > 8 ? `×${card.energy}` : '') : ''}</div>
      ${attackHtml}
    </div>`);
  return frag;
}

// Trainer (support) card.
function tcard(card, { small = false, selectable = false } = {}) {
  const t = card.trainer;
  return h(`
    <div class="pcard tcard ${small ? 'small' : ''} ${selectable ? 'selectable' : ''}" title="${esc(t.desc)}">
      <div class="head" style="background:var(--accent);color:#1a1a06">
        <span>${t.icon}</span><span>TRAINER</span>
      </div>
      <div class="art"><span class="glyph">${t.icon}</span></div>
      <div class="nm">${esc(t.name)}</div>
      <div class="tdesc">${esc(t.desc)}</div>
    </div>`);
}

function battleScreen() {
  if (!battle) { go('levels'); return h('<div></div>'); }
  const b = battle;
  const you = b.player;
  const foe = b.enemy;
  const yourTurn = b.turn === 'player' && !b.winner && !enemyThinking;

  const frag = h(`
    <div class="battle">
      <div class="field">
        <div class="turn-banner ${yourTurn ? 'you' : 'foe'}">
          ${b.winner ? 'Battle over' : yourTurn ? '🟢 Your turn' : `🔴 ${esc(foe.name)} is thinking…`}
        </div>

        <div class="side-panel">
          <div class="side-head">
            <span class="who">${currentLevel.icon} ${esc(foe.name)}</span>
            <span class="meta">
              KOs: <span class="prizes">${foe.prizes}/${foe.prizeTarget}</span> ·
              hand ${foe.hand.length} · deck ${foe.deck.length}
            </span>
          </div>
          <div class="row" id="foe-field"></div>
        </div>

        <div class="side-panel">
          <div class="side-head">
            <span class="who">🎒 You (${esc(currentDeck.name)})</span>
            <span class="meta">
              KOs: <span class="prizes">${you.prizes}/${you.prizeTarget}</span> ·
              deck ${you.deck.length}
            </span>
          </div>
          <div class="row" id="you-field"></div>
          <div class="bench-label" style="margin-top:8px">Hand — click a card to bench it (${you.bench.length}/${BENCH_SIZE} benched)</div>
          <div class="hand-row" id="hand"></div>
        </div>

        <div class="action-bar" id="actions"></div>
      </div>

      <div class="logbox">
        <h3>Battle log</h3>
        <div class="entries"></div>
      </div>
    </div>`);

  // --- enemy field: active first, then bench
  const foeField = frag.querySelector('#foe-field');
  if (foe.active) foeField.appendChild(pcard(foe.active));
  if (foe.bench.length) {
    const benchWrap = h('<div><div class="bench-label">Bench</div><div class="row"></div></div>');
    foe.bench.forEach((c) => benchWrap.querySelector('.row').appendChild(pcard(c, { small: true })));
    foeField.appendChild(benchWrap);
  }

  // --- player field
  const youField = frag.querySelector('#you-field');
  const canGiveEnergy = yourTurn && you.energyBudget > 0 && !b.pendingPromote;
  if (you.active) {
    const activeCard = pcard(you.active, { attacks: true, selectable: canGiveEnergy && !benchMode });
    activeCard.querySelectorAll('[data-atk]').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        attack(b, 'player', Number(btn.dataset.atk));
        afterPlayerAction();
      };
    });
    if (canGiveEnergy && !benchMode) {
      activeCard.firstElementChild.onclick = () => { attachEnergy(b, 'player', 'active'); afterPlayerAction(); };
      activeCard.firstElementChild.title = 'Attach ⚡ energy';
    }
    youField.appendChild(activeCard);
  }
  if (you.bench.length) {
    const benchWrap = h(`<div><div class="bench-label">${benchMode ? 'Click who takes over!' : 'Bench'}</div><div class="row"></div></div>`);
    you.bench.forEach((c, i) => {
      const selectable = (benchMode && yourTurn) || (canGiveEnergy && !benchMode);
      const cardEl = pcard(c, { small: true, selectable });
      if (benchMode && yourTurn) {
        cardEl.firstElementChild.onclick = () => {
          const mode = benchMode;
          const trainerIdx = switchHandIdx;
          benchMode = null;
          switchHandIdx = -1;
          if (mode === 'switch') playTrainer(b, 'player', trainerIdx, i);
          else retreat(b, 'player', i);
          afterPlayerAction();
        };
      } else if (canGiveEnergy) {
        cardEl.firstElementChild.onclick = () => { attachEnergy(b, 'player', i); afterPlayerAction(); };
        cardEl.firstElementChild.title = 'Attach ⚡ energy';
      }
      benchWrap.querySelector('.row').appendChild(cardEl);
    });
    youField.appendChild(benchWrap);
  }

  // --- hand (Pokémon bench on click; trainer cards play their effect)
  const hand = frag.querySelector('#hand');
  you.hand.forEach((c, i) => {
    const actable = yourTurn && !b.pendingPromote && !benchMode;
    if (c.kind === 'trainer') {
      const cardEl = pcard(c, { small: true, selectable: actable });
      if (actable) {
        cardEl.firstElementChild.onclick = () => {
          if (c.trainer.key === 'switch') {
            if (you.bench.length === 0 || !you.active) return;
            benchMode = 'switch';
            switchHandIdx = i;
            render();
          } else {
            playTrainer(b, 'player', i);
            afterPlayerAction();
          }
        };
      }
      hand.appendChild(cardEl);
    } else {
      const canPlay = actable && you.bench.length < BENCH_SIZE;
      const cardEl = pcard(c, { small: true, selectable: canPlay });
      if (canPlay) cardEl.firstElementChild.onclick = () => { playToBench(b, 'player', i); afterPlayerAction(); };
      hand.appendChild(cardEl);
    }
  });

  // --- action bar
  const actions = frag.querySelector('#actions');
  const hint = benchMode === 'switch'
    ? 'Switch: pick a bench Pokémon to swap in for free.'
    : benchMode === 'retreat'
      ? 'Pick a bench Pokémon to switch in (retreat spends energy).'
      : canGiveEnergy
        ? 'Click one of your Pokémon to attach energy, then attack or end your turn.'
        : yourTurn ? 'Attack with your active Pokémon, or end your turn.' : '';
  actions.appendChild(h(`
    <span class="energy-chip">⚡ energy left: ${you.energyBudget}</span>
    <span class="hint">${hint}</span>`));
  const retreatBtn = h(`<button ${yourTurn && (benchMode || canRetreat(b, 'player')) ? '' : 'disabled'}>
    ${benchMode ? 'Cancel' : `Retreat (⚡${you.active ? you.active.base.retreat : 0})`}</button>`);
  retreatBtn.firstElementChild.onclick = () => {
    benchMode = benchMode ? null : 'retreat';
    switchHandIdx = -1;
    render();
  };
  actions.appendChild(retreatBtn);
  const endBtn = h(`<button class="btn-primary" ${yourTurn ? '' : 'disabled'}>End turn ▶</button>`);
  endBtn.firstElementChild.onclick = () => { benchMode = null; endTurn(b); afterPlayerAction(); };
  actions.appendChild(endBtn);

  // --- log
  const entries = frag.querySelector('.entries');
  const recentFrom = lastSeenLog;
  b.log.forEach((entry, i) => {
    entries.appendChild(h(`<div class="${i >= recentFrom ? 'recent' : ''}">${esc(entry.msg)}</div>`));
  });
  if (yourTurn) lastSeenLog = b.log.length;

  return frag;
}

// ---------------------------------------------------------------- overlays

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
    const el = pcard(card, { small: true, selectable: true });
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
  const frag = h(`
    <div class="overlay">
      <div class="modal">
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
