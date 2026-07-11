# 🎴 Pokémon Karte

A Pokémon card-battle campaign for the browser. Ten escalating levels, eight
unlockable decks, a 56-entry Pokédex, and fifteen legendary Pokémon guarding
the endgame. No frameworks, no build step, no dependencies — plain ES modules.

## Run it

Serve the folder with any static server and open it in a browser:

```bash
python3 -m http.server 8000
# or: npx serve
```

Then visit <http://localhost:8000>. (Opening `index.html` directly from disk
won't work — ES modules require an HTTP origin.)

## How to play

- **Field**: one active Pokémon, up to 3 on the bench. Click hand cards to
  bench them.
- **Energy**: you get 1 energy per turn — click one of your Pokémon to attach
  it. Attacks *require* energy but don't consume it; retreating *does* spend it.
- **Attack**: attacks end your turn. Damage follows the type chart
  (▲ super effective ×2, ▼ resisted ×0.5).
- **Win**: knock out enough Pokémon to hit your KO target before the trainer
  hits theirs — or run your opponent out of Pokémon.
- **Statuses**: 💫 paralysis skips an attack, 🔥 burn ticks 10 per turn,
  🛡️ barriers absorb the next hit.

## The campaign (it gets hard)

| Levels | Opponents | What changes |
|---|---|---|
| 1–2 | Youngster, Bug Catcher | Random AI. Warm-up. |
| 3–5 | Sailor, Ace Trainer, Gym Leader Sabrina | Greedy AI, first stat handicaps, Mew appears. |
| 6–8 | Surge, Elite Four Lorelei & Lance | **Strategic AI** that plays match-ups and retreats; legendary birds, Rayquaza, Ho-Oh; enemy HP/damage bonuses; extra enemy energy; smaller opening hands. |
| 9 | Champion Cynthia | Dialga, Palkia, Giratina, Darkrai behind +20 HP / +10 damage. |
| 10 | The Original One | An all-legendary deck led by Arceus, +30 HP, +20 damage, fast energy — and you need 5 KOs while it needs only 3. |

Winning a level catches new Pokédex entries and unlocks decks:
**Ember Squad / Tidal Wave / Verdant Grove** (start) → **Volt Storm** (L2) →
**Mind Bender** (L4) → **Iron Fist** (L6) → **Dragon Fury** (L8) →
**Legends Awakened** (beat the game).

Deck choice matters more than anything: a fire deck that cruises past Bug
Catcher Rina gets washed away at Vermilion Docks.

## Project layout

```
index.html            entry point
css/style.css         all styling
js/main.js            bootstrap
js/ui.js              screens & DOM (menu, campaign, deck picker, battle, Pokédex)
js/storage.js         localStorage save (progress, Pokédex, stats)
js/data/typechart.js  type effectiveness, icons, colors
js/data/pokedex.js    all 56 Pokémon cards (attacks, effects, rarity)
js/data/decks.js      the 8 player decks + unlock levels
js/data/levels.js     the 10-level campaign & difficulty modifiers
js/engine/battle.js   pure battle engine (no DOM)
js/engine/ai.js       trainer AI: random / greedy / strategic tiers
tools/simulate.mjs    balance harness — AI-vs-AI win-rate matrix
```

## Balancing

The engine is pure JavaScript, so difficulty is tuned by simulation:

```bash
node tools/simulate.mjs            # strategic bot ≈ skilled player
node tools/simulate.mjs greedy     # greedy bot ≈ casual player
```

Current tuning (strategic bot, best unlocked deck): ~100% on L1–3, 75–90% on
L4–6, ~20% through the Elite Four and Champion, and ~1–2% against the Hall of
Origin. Humans outperform the bot, so the finale is brutal but beatable.
