# 🎴 Pokémon Karte

A Pokémon card-battle campaign for the browser — the code behind
[phantom-gate-tcg.netlify.app](https://phantom-gate-tcg.netlify.app).
All **1025 Pokémon** (each with its own artwork), **22 themed decks**,
trainer support cards, the full 18-type chart, and a ten-level campaign
that gets brutally hard at the top. No frameworks, no build step, no
dependencies — plain ES modules.

## Run it

Serve the folder with any static server and open it in a browser:

```bash
python3 -m http.server 8000
# or: npx serve
```

Then visit <http://localhost:8000>. (Opening `index.html` directly from disk
won't work — ES modules require an HTTP origin.) Pokémon artwork is loaded
from the PokeAPI sprite CDN with graceful fallback.

## How to play

The rules follow the **official Pokémon TCG rulebook**, scaled down for
mobile play (16-card decks, 3-card bench, KO targets instead of 6 prizes):

- **Setup**: a coin flip decides who goes first; the starting player cannot
  attack on the game's very first turn. If your opening hand has no Pokémon
  you mulligan — and your opponent draws an extra card.
- **Field**: one active Pokémon, up to 3 on the bench. Click hand cards to
  bench them.
- **Energy**: you get 1 energy per turn — click one of your Pokémon to attach
  it. Attacks *require* energy but don't consume it; retreating *does* spend
  it, and you may retreat **only once per turn**.
- **Trainer cards**: Items (🧴 Potion, 🔄 Switch, 🔋 Energy Boost) can be
  played freely; **only one Supporter** (🧪 Professor's Research) per turn.
  Playing them never ends your turn.
- **Attack**: attacks end your turn. Damage follows the full 18-type chart
  (▲ super effective ×2, ▼ resisted ×0.5).
- **Win**: reach your KO target, knock out every opposing Pokémon — or
  **deck them out**: a player who cannot draw at the start of their turn loses.
- **Special Conditions** (per the rulebook): 💫 paralysis blocks attacking and
  retreating for a turn, 🔥 burn deals 20 between turns with a coin-flip cure,
  ☠️ poison deals 10 and never wears off on its own, 🛡️ barriers absorb one
  hit. Moving to the bench cures all conditions.

## The Pokédex

All 1025 species from Gen 1–9, generated deterministically from official
PokeAPI base-stat data (`tools/generate-pokedex.mjs`): HP, attacks, costs,
retreat, and rarity all derive from real stats, and 94 legendaries/mythicals
form the endgame tier. Browse with search, type, generation and
caught/seen/legendary filters. Enemy Pokémon are marked *seen* when you face
them; winning levels and unlocking decks *catches* them.

## Decks (22)

One deck per type — Blaze Legion, Tidal Force, Verdant Bloom, Volt Storm,
Wild Frontier, Swarm Tactics, Sky Riders, Stone Wall, Quake Makers, Iron
Fist, Toxic Veil, Mind Benders, Moonlight Court, Frostbite, Steel Bastion,
Midnight Pack, Phantom Gate, Dragon Fury — plus four special sets: Starter
Legacy, Eevee Family, Mythic Whisper, and Legends Awakened (beat the game).
Fire/Water/Grass are available from the start; the rest unlock as you climb.
Deck strength scales with unlock level, and **picking the right counter-type
per opponent is the core strategic decision**.

## The campaign (it gets hard)

| Levels | Opponents | What changes |
|---|---|---|
| 1–2 | Youngster, Bug Catcher | Random AI. Warm-up. |
| 3–5 | Sailor, Ace Trainer, Sabrina | Greedy AI, first handicaps, trainer cards, Mew. |
| 6–8 | Surge, Lorelei, Lance | **Strategic AI** that plays match-ups, retreats, and uses support cards; legendary birds, Kyogre, Rayquaza; +20 HP/+20 damage; extra energy; smaller hands. |
| 9 | Champion Cynthia | Her true team led by twin Garchomp, backed by Dialga, Palkia, Giratina, Darkrai. |
| 10 | The Original One | Arceus and eleven other legendaries, +30 HP, fast energy — you need 5 KOs, it needs 3. |

## Project layout

```
index.html               entry point
css/style.css            all styling
js/main.js               bootstrap
js/ui.js                 screens & DOM (menu, campaign, deck picker, battle, Pokédex)
js/storage.js            localStorage save (progress, Pokédex, stats)
js/data/typechart.js     full 18-type effectiveness, icons, colors
js/data/pokedex.gen.js   GENERATED: all 1025 Pokémon cards
js/data/pokedex.js       expander + sprite CDN sources
js/data/decks.js         GENERATED: the 22 player decks
js/data/trainers.js      trainer (support) card definitions
js/data/levels.js        the 10-level campaign & difficulty modifiers
js/engine/battle.js      pure battle engine (no DOM)
js/engine/ai.js          trainer AI: random / greedy / strategic tiers
tools/generate-pokedex.mjs  data pipeline from official PokeAPI CSVs
tools/simulate.mjs       balance harness — AI-vs-AI win-rate matrix
```

## Balancing

The engine is pure JavaScript, so difficulty is tuned by simulation:

```bash
node tools/simulate.mjs            # strategic bot ≈ skilled player
node tools/simulate.mjs greedy     # greedy bot ≈ casual player
```

Current tuning (strategic bot, best unlocked deck): ~100% on L1–4 *if* you
counter-pick correctly, ~90% mid-game, 20–45% through the Elite Four and
Champion, and ~6% against the Hall of Origin. Humans outperform the bot, so
the finale is brutal but beatable.

## Regenerating the Pokédex

```bash
node tools/generate-pokedex.mjs          # fetches PokeAPI CSVs from GitHub
node tools/generate-pokedex.mjs ./csv    # or use a local CSV directory
```

## History

This codebase merges two earlier efforts: the original **Phantom Gate TCG**
(a single-file build deployed to Netlify by drag-and-drop — its sprite
pipeline and trainer cards live on here) and the modular engine written for
this repository (AI tiers, campaign difficulty system, simulation balancing).
