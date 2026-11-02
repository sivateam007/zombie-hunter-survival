# GameSnacks Zombie Hunter — Full Analysis

## Game URL
https://gamesnacks.com/games/6ctmcm40nbff0

## What We Analyzed
Downloaded the original game, extracted its JS source and level data, and parsed all 6 stages. This document summarizes the complete structure: stages, waves, enemies, bosses, rewards, and control model.

---

## Control Model (decisive difference)

Our current game: player stands in one spot and shoots. Touch-joystick / pointer input exists but movement is not tied to aiming, and the player does not move around the arena.

The original GameSnacks game:
- **Survivor-style movement + aiming.** The player walks around the arena freely (WASD or virtual joystick on mobile) and the weapon aims toward the nearest enemy automatically. There is no separate "fire button" — weapons fire automatically against the closest target (with per-weapon fire rate/cooldown).
- Movement and aiming are independent: you move in one direction and the gun aims at a different enemy if one is closer.
- This is the core gameplay loop the user wants replicated.

---

## Stage Structure (all 6 stages)

All stages: **timeToTreasure = 15 seconds** (the countdown before the treasure chest spawns). Multiplayer-style multiplier scales each stage: 1x, 1.5x, 2.25x, 3.5x, 4.75x, 7.61x.

| Stage | Tile/Map | Multiplier | Rewards (before mult) | Bosses |
|-------|----------|------------|----------------------|--------|
| Stage1 | bg1 / map_lv1.png | 1x | 1000 / 1500 / 2500 | boss_soldier, boss_tower |
| Stage2 | bg2 / map_lv2.png | 1.5x | 2000 / 3000 / 5000 | boss_dragon, boss_reptile, boss_fighter, boss_spider, boss_reptile |
| Stage3 | bg3 / map_lv3.png | 2.25x | 3000 / 4500 / 7500 | boss_mutant, boss_spider |
| Stage4 | bg4 / map_lv4.png (2048x2048) | 3.5x | 4000 / 6000 / 10000 | boss_reptile+boss_dragon, boss_spider+boss_mutant |
| Stage5 | bg5 / map_lv5.png | 4.75x | 5000 / 7500 / 12500 | boss_tower+boss_soldier, boss_tower+boss_reptile |
| Stage6 | bg6 / map_lv6.png (1024 wide) | 7.61x | 6000 / 9000 / 15000 | boss_mutant+boss_soldier, boss_spider+boss_dragon |

Each stage is a **timed survival** stage: 3 waves of zombies (A/B/C/D) fill the early/mid game, then boss zones activate, minibosses spawn throughout, and the stage ends when the player dies or beats the clock and collects treasure.

Stage size varies: Stage4 is 2048x2048, Stage6 is 1024 wide (tall).

---

## Full Enemy Roster (from wave data)

Confirmed enemy types that appear in the wave schedules:

**Zombies (core):**
- zombieA, zombieB, zombieC, zombieD — four zombie variants, the backbone of every stage. Low/medium/high frequency, scaling counts.

**Human-type enemies:**
- cop — low frequency human enemy, appears with total counts (e.g. total:50, max:10)
- manager — low frequency, appears in Stage2+
- assault1, assault2 — low frequency human attackers, Stage5+

**Special/monster enemies:**
- builder — high frequency building-type enemy, max 100-200, appears in every stage
- reptile — high frequency, appears Stage2+
- toxic1, toxic2 — toxic/chemical enemy, Stage3+
- slime1, slime2 — slime enemy, Stage3+
- bat — flying enemy, MID/HI frequency, appears in every stage
- spider1, spider2 — spider enemies, high frequency, Stage2+
- tower1, tower2 — stationary turret towers, Stage5+
- slug — medium frequency, Stage4+

**Minibosses (total:1, max:1, LOW frequency, 30s windows):**
- miniboss_builder, miniboss_reptile, miniboss_fighter, miniboss_spider, miniboss_toxic1, miniboss_toxic2, miniboss_soldier, miniboss_tower

**Bosses (bossZone with rect arena, single 30s window):**
- boss_soldier, boss_tower, boss_dragon, boss_reptile, boss_mutant, boss_spider

---

## Boss Zone Structure

Each boss wave has this shape:

```
bossZone: { type:"rect", width:1200, height:1200 }  // Stage1
bossZone: { type:"rect", width:1024, height:1024 }  // Stage2
bossZone: { type:"rect", width:1000, height:1000 }  // Stage3
bossZone: { type:"rect", width:? (Stage4 large map)
bossZone: { type:"rect", width:1600, height:? }     // Stage5
bossZone: { type:"rect", width:? }                   // Stage6
```

bosses: [{ type:"boss_soldier" }] — one or two boss types in a single 30-second window.

The boss zone is a rectangular sub-area of the map where the boss spawns and the fight is confined.

---

## Wave Timing Pattern (all stages)

The wave schedule follows a repeatable structure per stage:

1. **Zombie wave A** — 0-120s (LOW/MID/HI frequency ramp), then a LOW tail
2. **Zombie wave B** — overlaps, same ramp pattern
3. **Zombie wave C** — appears Stage1+
4. **Zombie wave D** — appears Stage1+
5. **Builder/special wave** — around 540s, HI frequency, high count
6. **Boss wave** — at 600s (10 minutes in), 30s window, bossZone active
7. **Minibosses + filler waves** — scattered 30s windows throughout the second half
8. Some stages have an **early boss** at 300s (5 minutes) with a second boss at 600s

Total stage duration is effectively infinite survival — the 15s timeToTreasure is the countdown to the treasure spawn (the win condition). The player can also die anytime.

---

## Rewards & Progression

Rewards array: [base, mid, high] — appears to map to score tiers or treasure contents.
- Stage1: [1000, 1500, 2500]
- Stage2: [2000, 3000, 5000]
- Stage3: [3000, 4500, 7500]
- Stage4: [4000, 6000, 10000]
- Stage5: [5000, 7500, 12500]
- Stage6: [6000, 9000, 15000]

These are multiplied by the stage multiplier (1x → 7.61x).

---

## Weapon Catalog (extracted from JS source)

The original game has a large weapons array. From the extracted data we confirmed weapon names include:

**Melee/Throws:**
- Boomerang
-

**Guns:**
- Pistol, Rifle, SMG, Shotgun, Ak47/Ak-47

**Special/Heavy:**
- Tesla (electric beam weapon)
- Forcefield (defensive barrier)
- Ripper (object-destroyer / building breaker)
- Nuke (explosive area weapon)
- Sniper / Snip(e)r
- Freezeblast / Freeze
- Firework / Incendiary
- Bang / Grenade
- Mez (incapacitate/stun weapon — confirmed in enemy data references)
- Zero / Sphere
- Gravity gun / beam pull weapon (MEZ-type weapons appear in enemy data)
- Many more — the catalog is very large (14+ weapons per the earlier extraction notes)

Weapon properties include fire rate, damage, spread, projectile speed, splash, piercing, special effects (freeze, mez/incapacitate, gravity pull, building destroy, area damage).

---

## Enemy Stats (from extracted enemy data)

The enemy data file (enemies_data_full.json / enemies_region) contains per-enemy stats:
- HP, speed, damage, size, behavior flags
- Mez resistance / mez duration (for the MEZ weapon system)
- Drop rates, experience values

Specific values were being extracted when the analysis was interrupted. The data file is large and structured.

---

## What Our Game Has vs What's Missing

### Has
- Anime-style character rigging (rig.js, anim.js)
- Anime.js UI animations
- Procedural arena generation (arena.js)
- Weapon system (weapons.js) with some weapons
- Level/stage system (levels.js) — but with 15 short missions, not the original's 6 survival stages
- HUD/UI (ui.js)
- Audio (audio.js)
- Network/leaderboard (net.js)
- Save/storage (storage.js)
- Menu system (main.js)

### Missing / Needs to match original

1. **Movement model** — player must move freely around the arena with WASD/joystick, aim independently at nearest enemy, auto-fire with no fire button. This is the #1 priority the user asked for.

2. **Weapon catalog** — expand to match the full original catalog (Tesla, Boomerang, Forcefield, Ripper, Nuke, Sniper, Freezeblast, Firework, Mez, Gravity gun, etc.) with proper per-weapon behavior.

3. **Auto-fire + closest-target aiming** — weapons fire automatically at the nearest enemy on their cooldown, not on a button press.

4. **Stage structure** — replace 15 short missions with 6 timed survival stages matching the original's wave schedules, boss zones, timeToTreasure=15s, and multipliers.

5. **Enemy roster** — add all missing enemy types (zombieA-D, cop, manager, assault1/2, builder, reptile, toxic1/2, slime1/2, bat, spider1/2, tower1/2, slug) plus all minibosses and bosses with proper stats.

6. **Boss zones** — implement rect boss arenas with boss spawn windows.

7. **XP / level-up** — the original has an XP system with level-ups and a 3-card choice (new weapon / level weapon / supply). Our current game has a simplified level-up.

8. **Meta progression** — coin-skills (POWER, HEALTH, DEFENSE, FIRSTAID, FORTUNE, LEARNING), difficulties, continues system.

9. **Enemy animations** — proper sprites/animations for all enemy types, not just circles.

10. **Weapon animations/visuals** — proper projectile visuals, muzzle flash, hit effects for all weapons.

---

## Next Steps (user priority order)

1. **Fix movement first** — make the player walk around the arena with WASD + virtual joystick, aim at nearest enemy, auto-fire. This is what the user explicitly asked for and what makes the game feel like the original.

2. **Port all 6 stages** from the parsed wave data into levels.js.

3. **Expand weapons** to the full catalog.

4. **Add missing enemies** with proper behavior.

5. **Add XP/level-up, meta skills, continues** to match the original meta loop.

6. **Polish visuals** — enemy sprites, weapon projectiles, boss arenas, effects.

---

## Files in This Project

- `js/game.js` — main game loop, state machine
- `js/levels.js` — stage definitions (current 15-mission version)
- `js/weapons.js` — weapon definitions
- `js/arena.js` — procedural arena generation
- `js/entities.js` — entity management
- `js/rig.js` — character rigging (anime-style)
- `js/anim.js` — anime.js animations
- `js/ui.js` — HUD and screens
- `js/audio.js` — sound
- `js/net.js` — leaderboard
- `js/storage.js` — save data
- `js/main.js` — bootstrap, menu
- `js/game-patch.js` — patches applied to game.js
- `index.html` — main HTML
- `css/style.css` — styles
- `css/ui.css` — UI styles
- `zh_orig_assets/extracted_levels/level_1.json` through `level_6.json` — parsed original stage data
- `zh_orig_assets/js_game.js` — original game JS source
- `zh_orig_assets/weapons_prototypes.json` — weapon data
- `parse_all_levels.js` — parser that successfully extracts all 6 stages
