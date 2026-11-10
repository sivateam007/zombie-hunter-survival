# GameSnacks “Zombie Hunter” vs Meow Zombie Hunter — full comparison

Source of truth for the original: the shipped Phaser bundle under `zh_orig_src/`
(`game.min.js`, cross-checked against `zh_orig_assets/extracted_levels/level_*.json`)
and the parser outputs in `zh_analysis.json` / `original_stages_dump.json`.
Numbers below are read from that bundle, not remembered.

Legend: **✅ done**, **🟡 partial**, **❌ missing**.

---

## 1. Core loop

| Aspect | GameSnacks | Ours | Status |
|---|---|---|---|
| Genre | Arena survivor, move = aim, weapons auto-fire | Same | ✅ |
| Camera | Follows the player over a large scrolling map | Procedural endless city, follow camera | ✅ (+ we have 19 districts) |
| Win condition | Survive 20 min (`TIME_LEVEL_COMPLETED = 1 200 000 ms`) | Same 1 200 s | ✅ |
| Victory delay | 5 s (`DELAY_GAME_WON`) after the timer | Results screen immediately | ❌ missing polish |
| Difficulty | NORMAL / HARD (×2 HP/DMG) / INSANE (×4) | Same three, same multipliers | ✅ |
| Continues | `2 500 × n`, max 2 | Same (`CONTINUE_MAX = 2`) | ✅ |
| Score | `GameSnacks.score.update(kills)` | kills × 10 + 500 win bonus | ✅ |
| Pause | Phaser pause overlay | DOM pause with stick release | ✅ |

## 2. Controls

| Aspect | GameSnacks | Ours | Status |
|---|---|---|---|
| Movement | Joystick + WASD/arrows, analog dead zone | Thumbstick, WASD/arrows, gamepad | ✅ |
| Aim | Move direction, or nearest enemy for auto-target guns | Same + optional mouse aim | ✅ |
| Fire | Automatic, no button | Automatic | ✅ |
| Reload | Automatic only | Automatic **+ manual tactical reload** (R, gamepad X, RELOAD button; 60 % of the auto time, works on a partial mag) | ✅ ours is deeper |
| Dash / roll | None in the original | Combat roll on Shift/B, 0.35 s i-frames | ✅ ours adds |
| Jetpack | None in the original | Hold-to-fly with ignition fee, kick, dry-tank lock | ✅ ours adds |

## 3. Weapons

Original: 14 base weapons, each evolving at level 6 while its paired supply is owned.
Ours: **20 base + 20 evolved**, same evolution rule (`level > 5` + supply).

| Weapon | Original | Ours | Notes |
|---|---|---|---|
| Axe → Battleaxe | ✅ orbit | ✅ | 2 axes, orbit radius 70 |
| Crossbow → Shotgun | ✅ fan, pierce 2 | ✅ | |
| Flamethrower → Plasmagun | ✅ stream 100 ms | ✅ | |
| Gun → Uzi | ✅ burst then cooldown | ✅ | close-range trigger at 0.18 s |
| Sword → Scimitars | ✅ melee arc | ✅ | |
| Drill → Lasergun | ✅ burst | ✅ | |
| Bazooka → Nuke | ✅ rocket, blast 100 | ✅ | |
| Boomerang → Neckbreaker | ✅ returns | ✅ | |
| Circular → Ripper | ✅ orbits, eats shots | ✅ | |
| Tesla → Thunderorb | ✅ chain + AoE | ✅ | |
| SpikedBall → Biliard | ✅ bounce 3 | ✅ | |
| Forcefield → Domain | ✅ aura + eats shots | ✅ | |
| Launcher → Airstrike | ✅ rotating salvo | ✅ | |
| Molotov → Canister | ✅ lobbed fire | ✅ | |
| Extra ours | — | rocketlauncher, grenadelauncher, sniper, railgun, katana, nodachi… | ✅ |
| Projectile art | Shared sprite atlas | Per-weapon silhouettes, tracers, rockets, rings | ✅ ours is richer |

## 4. Supplies / passives

Original: Kevlar, AmmoBooster, Handbook, Scope, Propane, Magnet, Chronometer, ActionGloves,
EnergyDrink, Sneakers, Detector, Supplements + Coins/Medikit pickups.
Ours: the same 12 stat supplies at 5 levels each, plus coin skills. ✅

## 5. Enemies

Original roster: 26 combat types (4 zombie skins, slime1/2, bat, toxic1/2, manager, cop,
reptile, slug, builder, spider1/2, tower1/2, assault1/2, 8 minibosses, 7 bosses).
Ours: the same table in `js/entities.js`, same base HP/speed/damage/cooldown values. ✅

Missing behaviours, in priority order:

| Original behaviour | Ours | Status |
|---|---|---|
| Ranged `shots` arrays with per-shot `angleInc` (assault2 fires −20/0/+20°) | one spread value | 🟡 close, not identical |
| Boss movement archetypes (`BOSS_MOVEMENT_CHASE/CHARGE/ROAM/RETREAT/TELEPORT/SPAWN/ATTACK`) | bosses walk straight at you | ❌ **biggest boss-fight gap** |
| Boss pattern shots (bouncing tower shots, egg grenades that explode) | single straight shots | ❌ |
| Death hazard (`deadshot` acid pools from toxic1/2, slime1) | none | ❌ |
| Miniboss deaddrops (bomb / medkit / magnet / chest / coins) | ✅ now implemented per type | ✅ |
| Collision `mass` (heavy bodies shove the player) | soft separation between enemies | 🟡 separation yes, player shove no |
| Static turrets that never move but shoot | ✅ | ✅ |

## 6. Pickups

| Pickup | Original | Ours | Status |
|---|---|---|---|
| Exp gems | ✅ | ✅ | ✅ |
| Coins / scrap | ✅ | ✅ | ✅ |
| Medikit | ✅ | ✅ (spawns from minibosses + rare drops) | ✅ |
| Magnet | ✅ | ✅ (marks every drop and vacuums it) | ✅ |
| Bomb (screen clear) | ✅ | ✅ (kills all normal bodies, chips bosses, white flash) | ✅ |
| Treasure chest | ✅ (3-card reroll, `MAX_CHESTS_REROLLS = 3`) | ✅ chest + level-up cards, 5 rerolls | 🟡 chest-specific reroll cap not separated |
| Shield cell | ❌ (3 s i-frames only) | ✅ 25 s force field on pickup | ✅ ours adds |
| Gift box | ❌ | ✅ random reward | ✅ ours adds |

## 7. Progression & meta

| Aspect | Original | Ours | Status |
|---|---|---|---|
| In-run XP | `expsToLevel = floor(1000 × 1.25^(level−1))` | Same formula | ✅ |
| Level-up | pauses, 3 cards, reroll `500 × (n+1)`, max 5 | Same, `500 × n`, max 5 | ✅ |
| Primary choice | `DialogSelectPrimary` before deploy | Loadout screen, saved as `currentWeapon` | ✅ |
| Meta skills | POWER/HEALTH/DEFENSE/FIRSTAID/FORTUNE/LEARNING to lvl 30 | Same six, same price curve | ✅ |
| Stage unlock | record time on previous stage ≥ 20 min | same record-time gate | ✅ |
| Stages | 8 stages (6 parsed with full waves) | 20 stages with 30-wave ladders | ✅ ours extends |
| Characters | one sprite | 35 rigged survivors, each with a power | ✅ ours adds |
| Daily reward / redeem codes / store | ❌ | ✅ | ✅ ours adds |
| Leaderboard | GameSnacks service | our Node leaderboard + input sanitising | ✅ |

## 8. Waves & boss zones

| Aspect | Original | Ours | Status |
|---|---|---|---|
| Wave record | `{enemy, freq, max, startTime, duration}` concurrent | same parser, same table | ✅ |
| Spawn cadence | LOW 700 / MID 350 / HI 100 ms | 1.25 / 0.8 / 0.5 s at medium, ramping to 0.54× by minute 20 | 🟡 ours is deliberately lighter early |
| Wave cap | `max` concurrent per wave | per-wave cap × run ramp, shared field cap | ✅ |
| Boss zone | 1200×1200 rect, timer + all waves freeze until bosses die | timer freezes, no physical rect | 🟡 no arena walls |
| Pre-boss warning | 3 s hazard banner (`DELAY_HIDE_HAZARD_INFO`) | ✅ 3 s WARNING banner + red flash + audio | ✅ |
| Boss escort | other waves frozen inside the zone | ✅ escort grows from 2 to 10 | ✅ ours adds |
| Treasure at `timeToTreasure` | 15 s | same | ✅ |

## 9. Presentation

| Aspect | Original | Ours | Status |
|---|---|---|---|
| Art | Phaser sprite atlas | procedurally drawn rigs + districts | 🟡 stylised, not sprite parity |
| Hit feedback | flash + blood sprites | flash, knockback, damage numbers, sparks, splash decals | ✅ |
| Blast feedback | explosion animation | additive light + expanding shockwave ring | ✅ |
| Screen damage | red flash | red edge pulse + low-HP pulse + bomb whiteout | ✅ |
| Weather / districts | fixed background per stage | 19 districts with rain/ash/dust, lightning | ✅ ours adds |
| Audio | SFX + music | SFX per weapon/event | 🟡 no music track |

---

## 10. What is still genuinely missing (ranked)

1. **Boss AI archetypes** — charge, retreat, teleport, spawn-minions, attack patterns.
   Right now every boss is “walk at the player and shoot”. This is the largest gap.
2. **Boss zone geometry** — the original confines the fight to a rect and freezes waves;
   we freeze the clock but the player can run away.
3. **Death hazards** — acid pools from toxic/slime deaths (the `deadshot` effect).
4. **Per-shot angle tables** — exact `angleInc` fans (assault2, miniboss_soldier 8-way,
   miniboss_tower 8-way) instead of one spread value.
5. **Chest-specific reroll cap** (`MAX_CHESTS_REROLLS = 3`) as a separate currency sink.
6. **5 s victory delay** with a “zone cleared” beat before the results screen.
7. **Music bed** — the original has a soundtrack; we only have SFX.
8. **Player shove from heavy bodies** (`mass`): a miniboss should push the hunter aside.

## 11. Where we are already ahead

Manual tactical reload, dash with i-frames, jetpack, 35 playable survivors with unique
powers, store/characters/upgrade economy, daily rewards, redeem codes, prestige roster,
endless mode, 20 stages (vs 8), local leaderboard with sanitising, 19-district endless
city, and the full hit/knockback/shockwave feedback layer.
