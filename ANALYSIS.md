# Zombie Hunter (GameSnacks) — Full Analysis

Reverse-engineered from the shipped bundle (`6ctmcm40nbff0.h5games.usercontent.goog`, Phaser 3,
1.9 MB `game.js`). This is the design document the clone is built against.

**Headline finding:** the original is **not** a twin-stick mouse-aim shooter. It is a
*Vampire-Survivors-style arena survivor*: you **move** with joystick/keyboard, **all weapons fire
automatically** — most of them along your *movement direction*, others at the nearest enemy.
Standing still is wrong play; the whole game is about never stopping.

---

## 1. Movement & aiming (the exact model)

```
updateMovement(dt):
  moveAmount = player.speed * dt
  vectr = keyboard vector (Arrows / WASD / FHTD legacy keys, -1/0/1 per axis)
  if joystick held: vectr = thumb offset; if |vectr| < radius3 → 0 (dead zone),
      else analog: vectr.normalize(); vectr *= (|v| - radius3) / (2 * radius3)   # 0..1
  vectr *= moveAmount
  if |vectr| > 0:
      sprDirArrow.rotation = vectr.angle()        # facing = MOVEMENT direction
      sprBody.play("hero_walk")
  move X, reject if collides with bossZone / static enemies / bosses
  move Y, same rejection
```

- Player speed base: **0.3 px/ms (300 px/s)**, modified by meta-skill speed.
- Facing **is** the move direction — the arrow sprite (`man_arrow.png`) points where you walk.
- **Every weapon reads `Player.sprDirArrow.rotation` or auto-targets the nearest enemy** —
  there is no mouse aim anywhere in the original.
- Hit invincibility: **3 s**, sprite alpha flickers.
- Regen: heals `regen_bonus`% of max HP every `regen_time` (base 5000 ms).
- Damage taken: `dmg × levelMultiplier × difficultyDMG − defense%` (floor 0).

## 2. Weapons — 14 base weapons, each with an evolution (level 6)

Evolution rule: `level > 5` **and** the paired supply is owned → weapon transforms
(`getName` switches to `evoName`, projectile/behavior changes).

| # | Weapon | Fire model (from source) | Cooldown | Evolves via | → Evolution |
|---|--------|--------------------------|----------|-------------|-------------|
| 1 | Axe | Orbiting axes anchored to player (`anchorAngle/Radius`, spin) | 2500 | Supplements | Battleaxe |
| 2 | Crossbow | Fan of bolts along **move direction**, spread 2π/40, pierce 2 | 1500 | ActionGloves | Shotgun |
| 3 | Flamethrower | Continuous stream every **100 ms** from 40 px ahead, velocity = aim + player velocity | 2000 | Handbook | Plasmagun |
| 4 | Gun | **Auto-targets nearest enemy** in range; burst (150 ms gaps, `level+1` shots) | 1000 | AmmoBooster | Uzi |
| 5 | Sword | Melee arc in facing hemisphere, hits all in radius; evo = both sides | 500 | Kevlar | Scimitars |
| 6 | Drill | Burst toward **nearest enemy** (250 ms); evo = lightning drill | 2000 | Scope | Lasergun |
| 7 | Bazooka | Rocket at **nearest enemy**, `explosive`, radius 100, hits 100 targets | 2000 | Propane | Nuke |
| 8 | Boomerang | Thrown at **nearest enemy**, returns; evo = two opposite | 3000 | Magnet | Neckbreaker |
| 9 | Circular (Saw) | Orbiting saws, `killEnmShots` = **destroys enemy bullets** | 8000 | Chronometer | Ripper |
| 10 | Tesla | Chain lightning: random enemy in range 500, AoE radius damage | 2500 | ActionGloves | Thunderorb |
| 11 | SpikedBall | Bouncing balls at nearest enemy (bounce 3); evo = 8-way burst | 3000 | Sneakers | Biliard |
| 12 | Forcefield | Aura: damages all in radius every 350 ms + **eats enemy projectiles** | — | EnergyDrink | Domain |
| 13 | Launcher | Rockets at rotating aim points around player (2π/count); evo = random screen strikes | 8000 | AmmoBooster | Airstrike |
| 14 | Molotov | Lobs fire bombs at rotating aim points, leaves fire radius | 3000 | Detector | Canister |

All weapons scale with player `attack` (meta-skill POWER), `attack_bonus`, cooldown/range/speed
bonuses from supplies, and weapon `level` (each level-up = `levelUp()`).

## 3. Supplies — 14 passive items (level up in-run, evolve weapons)

Kevlar (defense%), AmmoBooster (cooldown%), Handbook (exp%), Scope (range),
Propane (blast radius), Magnet (pickup range), Chronometer (cooldown), ActionGloves (attack%),
EnergyDrink (regen), Sneakers (speed), Detector (luck/fortune), Supplements (HP),
plus Coins and Medikit (instant pickups).

## 4. Progression loop

- **In-run XP**: enemies drop exp gems → `incExps(v) = 3 × floor(v + v·exp_bonus% + v·learning%)`.
- **Level-up**: `expsToLevel = floor(1000 × 1.25^(level−1))` → game pauses, joystick hides,
  **1 of 3 cards** offered (`ShowSkillSlots(3)`): new weapon, level a weapon, or a supply.
  Reroll costs coins: `500 × (reroll+1)`, max 5.
- **Starting loadout**: `DialogSelectPrimary` — you pick your **primary weapon** at deploy.
- **Death**: `AskToContinue` — pay `2500 × n` coins (max 2 continues) or game over.
- **Meta-skills** (persist, bought with coins, max level 30 each):
  POWER (attack), HEALTH, DEFENSE, FIRSTAID, FORTUNE, LEARNING — prices 0 → 435,000.
- **Difficulty**: HARD = enemy HP×2, DMG×2, speed×1.15, rewards×1.5;
  INSANE = HP×4, DMG×4, speed×1.5, rewards×2.5.
- Score: `GameSnacks.score.update(enemiesKilled)`.

## 5. Levels — 8 stages (`GameLevels`), time-scheduled waves

- **Win = survive 20 minutes** (`TIME_LEVEL_COMPLETED = 1,200,000 ms`), then 5 s victory delay.
  Next stage unlocks when your record time on the previous stage reaches the threshold.
- Each stage: `{name, tile bg, map image, timeToTreasure: 15 s, rewards:[…], waves:[…]}`.
- Map is large and scrolling (up to 2048×2048), camera follows player.
- **Wave record**: `{enemy, freq, max, startTime, duration}` — all waves run **concurrently**;
  a wave activates when `level.time ≥ startTime` and despawns its slot at `start+duration`.
  `startTime` restarts per enemy family (they overlap intentionally — e.g. zombieA/B/C/D are
  **skins of the basic zombie**, all active from t=0).
- **Spawn cadence**: `FREQ_LOW = 700 ms`, `FREQ_MID = 350 ms`, `FREQ_HI = 100 ms` between spawns,
  capped by wave `max`. Hazard banner warns 3 s before boss waves.
- **Boss zones**: a wave may carry `{bossZone:{type:"rect",width:1200,height:1200},
  bosses:[{type:"boss_soldier"}]}` — activating it **freezes the level timer and all other waves**
  until every boss is dead (`BossZone.instance.bossZoneActive` gate everywhere).
- Treasure chests spawn on `timeToTreasure`; `rewards` pay out on completion per difficulty.
- End-of-stage offers: rerolls, continues, chest rerolls (`MAX_CHESTS_REROLLS = 3`).

## 6. Enemies — 26 combat types (+ box/treasure)

`EnemiesData[key] = {scale, speed, health, range, damage, attackDelay, bonus}`

| type | scale | speed px/ms | hp | range | dmg | atk cd | coin bonus | notes |
|------|-------|-----------|-----|-------|-----|--------|-----------|-------|
| zombieA/B/C/D | .85 | .13/.12/.11/.10 | 10–13 | 40 | 4 | 1000 | 100 | basic zombie skins |
| slime1 / slime2 | .85 | .15/.10 | 10/100 | 10 | 3/5 | 1000 | 100/300 | swarming |
| bat | .85 | **.50** | 10 | 40 | 3 | 1000 | 100 | fastest |
| toxic1 / toxic2 | 1.0 | .20/.25 | 10/150 | 10 | 5/7 | 1000 | 300/1000 | melee |
| manager | .85 | .10 | 15 | 50 | 3 | 1000 | 300 | |
| cop | .85 | .10 | 25 | 50 | 5 | 1000 | 300 | **ranged (SHOTS)** |
| reptile | .85 | .25 | 50 | 40 | 6 | 1000 | 300 | mass 1 |
| slug | .85 | .05 | 500 | 10 | 20 | 1000 | 3000 | tanky |
| builder | .85 | .10 | 300 | 40 | 10 | 1000 | 1000 | |
| spider1 / spider2 | .85 | .15/.20 | 200/400 | 40 | 20/30 | 1000 | 1000/3000 | |
| slime2, tower1/2 | .9 | 0 (static) | 200/700 | 125 | 5 | 350/3000 | 300/3000 | turrets, tower2 ranged |
| assault1 / assault2 | .85 | .15 | 400 | 50 | 7 | 1000 | 3000 | **ranged bursts** |
| miniboss_builder | .85 | .15 | 4000 | 60 | 20 | 1000 | 10 000 | mass 5, HP bar, drops item |
| miniboss_fighter | .85 | .20 | 5500 | 60 | 25 | 1000 | 10 000 | mass 5, HP bar, drop |
| miniboss_spider | .85 | .30 | 5000 | 60 | 40 | 1000 | 10 000 | mass 5, HP bar, drop |
| miniboss_reptile | .85 | .30 | 3500 | 60 | 30 | 1000 | 10 000 | mass 5, HP bar, drop |
| miniboss_soldier | .85 | .10 | 4500 | 60 | 7 | 1000 | 10 000 | ranged, HP bar, drop |
| miniboss_tower | .90 | 0 | 6000 | 125 | 5 | 450 | 10 000 | static turret, ranged, drop |

- Melee enemies attack every `attackDelay` ms when inside `range`; HP scaled by stage multiplier
  and difficulty. `mass` = push-through weight (bosses shove the player's collision aside).
- Ranged types spawn `shots` projectiles (assault2 fires 3-bullet spread −20/0/+20°).

## 7. Pickups & bonuses

Coins, medikit, magnet (vacuums loot), bomb (screen clear), food, treasure chest,
exp gems. Chests open a **3-card rerollable choice** (reroll `1500 × (n+1)`).
`pickup_range` base 50 px — Magnet supply widens it.

## 8. Gap list vs. our current clone

| Aspect | Original | Our clone (current) |
|--------|----------|--------------------|
| Aim | **Movement direction + auto-target** | mouse aim (twin-stick) |
| Movement | joystick/WASD, never stops, no fire button | mouse + RMB/fire |
| Weapons | 14 + 14 evolutions, all automatic | 6 manual weapons |
| Weapon unlock | level-up cards (1 of 3) mid-run | shop between runs |
| Levels | 8 stages × 20-min survival, timed concurrent waves | 15 short wave missions |
| Enemy roster | 26 types incl. turrets & 6 minibosses | ~8 types + 4 bosses |
| Meta | 6 coin-skills to lvl 30, 3 difficulties, continues | 8 upgrades, endless mode |
| Boss fight | separate 1200×1200 boss zone, timer freezes | boss in arena with HP bar |

**Rebuild scope:** convert the clone to survivor-style control (move = aim, auto-fire),
port the 14-weapon catalog with evolution rules, replace 15 missions with 8 × 20-min stages
(scaled down if needed for session length), port the 26-enemy table, add the 3-card level-up
chooser and XP curve, keep our rigged characters and anime.js UI, keep the Node leaderboard.
