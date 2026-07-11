// Persistent progress (localStorage): campaign progress, Pokédex, stats.

import { DECKS } from './data/decks.js';

const KEY = 'pokemonkarte-save-v1';

function defaultSave() {
  return {
    beatenLevel: 0,      // highest campaign level beaten
    seen: [],            // Pokédex ids encountered in battle
    caught: [],          // Pokédex ids owned (deck cards + level rewards)
    wins: 0,
    losses: 0,
  };
}

let save = null;

export function loadSave() {
  if (save) return save;
  try {
    save = { ...defaultSave(), ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    save = defaultSave();
  }
  syncDeckCatches();
  return save;
}

function persist() {
  localStorage.setItem(KEY, JSON.stringify(save));
}

// Every card in an unlocked deck counts as caught.
function syncDeckCatches() {
  for (const deck of DECKS) {
    if (deck.unlockLevel <= save.beatenLevel) markCaught(deck.cards);
  }
}

export function unlockedDecks() {
  return DECKS.filter((d) => d.unlockLevel <= save.beatenLevel);
}

export function markSeen(ids) {
  for (const id of ids) if (!save.seen.includes(id)) save.seen.push(id);
  persist();
}

export function markCaught(ids) {
  for (const id of ids) {
    if (!save.caught.includes(id)) save.caught.push(id);
    if (!save.seen.includes(id)) save.seen.push(id);
  }
  persist();
}

export function recordWin(level) {
  save.wins++;
  if (level.id > save.beatenLevel) save.beatenLevel = level.id;
  markCaught(level.rewardCatch);
  syncDeckCatches();
  persist();
}

export function recordLoss() {
  save.losses++;
  persist();
}

export function resetSave() {
  save = defaultSave();
  syncDeckCatches();
  persist();
}
