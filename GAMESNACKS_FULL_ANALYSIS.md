# GameSnacks “Zombie Hunter SURVIVAL” — full reverse-engineering report

Every number below was read out of the shipped bundle at `zh_orig_src/js_game.js`
(1,920,197 bytes, Phaser 3, build **1.0.1 / 05.09.2023**, profile id `inl-srvvr`)
and the parsed level files in `zh_orig_assets/extracted_levels/`.
Nothing here is from memory or from the earlier notes.

Reproduce it with `node analysis/extract_gamesnacks.js`, which writes:

| Artifact | Contents |
|---|---|
| `analysis/orig_01_constants.txt` | sounds, GameData, difficulty, bonus ids, global constants |
| `analysis/orig_02_enemies_bosses.txt` | full `EnemiesData` + `BossesData` tables and every shot/boss pattern |
| `analysis/orig_03_levels.txt` | `GameLevels` wave tables |
| `analysis/orig_04_skills.txt` | coin skills, prices, reroll/continue constants, Level + wave scheduler |
| `analysis/orig_05_weapons.txt` | `Player`, bonuses, pickups |
| `analysis/orig_06_pickups.txt` | bonus system, box drop table, drop logic |
| `analysis/orig_07_systems.txt` | XP curve, skill slots, addWeapon/addSupply, supplies |
| `analysis/gamesnacks_extract.json` | machine-readable tables (weapons, levels, enemies, constants) |

---

## 1. Build facts and global constants

| Constant | Value | Meaning |
|---|---|---|
| `TIME_LEVEL_COMPLETED` | `1,200,000` ms | 20 minutes to win a stage |
| `DELAY_GAME_WON` | `5,000` ms | victory hold before the results dialog |
| `DELAY_HIDE_HAZARD_INFO` | `3,000` ms | “INCOMING BOSS” banner time |
| `TIME_INVINCIBLE` | `3,000` ms | i-frames after a hit |
| `FREQ_LOW / MID / HI` | `700 / 350 / 100` ms | spawn cadence per wave |
| `MAX_ENEMIES` | `500` | hard pool size |
| `BOSS_ZONE_GRID_SIZE` | `80` px | fence grid step |
| `LEVEL_TIMES_MUL` | `1` | clock multiplier |
| `PLAYER_SCALE` | `0.75` | hunter sprite scale |
| `LEVEL_TOP / LEVEL_GAP` | `185 / 20` px | map margins |
| Resolution | 790 × 1300 default (max 790 × 1700) | portrait-first layout |

**Difficulty** (`DIFFICULTY_NORMAL/HARD/INSANE = 0/1/2`)

| Multiplier | HARD | INSANE |
|---|---|---|
| Enemy HP | ×2 | ×4 |
| Enemy damage | ×2 | ×4 |
| Enemy speed | ×1.15 | ×1.5 |
| Stage rewards | ×1.5 | ×2.5 |
| Money pickups | ×1.5 | ×2.5 |

**Bonus ids:** `BONUS_COIN=1, BONUS_MAGNET=2, BONUS_MEDKIT=3, BONUS_BOMB=4, BONUS_FOOD=5, BONUS_TREASURE=10`.
`BOMB_BONUS_RADIUS=900`, `BOMB_BONUS_DAMAGE=500` (the pickup itself calls
`damageEnemiesInRadius(player, 900, 10 × attack)`).

**Box drop weights** (the treasure box payout table):
coin 15, coin×3 20, pile 15, pouch 10, magnet 10, medkit 25, bomb 5.

---

## 2. Control and combat model (exact)

`updateMovement(dt)`:
- `vectr` = keyboard vector (WASD/arrows) or thumbstick offset.
- Dead zone: `|v| < radius3` → 0; otherwise normalize and scale
  `(|v| − radius3) / (2 × radius3)` → analog 0…1.
- `facing = vectr.angle()` — **the arrow points where you walk**.
- Position is applied per axis with rejection against the boss-zone fence,
  static enemies and static bosses (`spriteInCollisionWithZone`).
- Player speed 0.3 px/ms = **300 px/s**.
- No ammo, no reload, no dash, no jetpack — the original has none of these.

`damagePlayer(dmg)`:
`dmg × levelMultiplier × difficultyDMG − defense%`, floored at 0, then 3 s
`TIME_INVINCIBLE` with a 500 ms alpha flicker.

`incExps(v)` = `3 × floor(v + v·exp_bonus/100 + v·learning/100)`.
`getExpsToLevelUp()` = `floor(1000 × 1.25^(level−1))`.

---

## 3. Weapons — 14 base, 14 evolutions, 5 starting choices

Starting primaries (`PrimaryWeapons`): **Axe, Flamethrower, Crossbow, Gun, Sword**.
The other nine are found in-run: Bazooka, Boomerang, Drill, Launcher, SpikedBall,
Circular, Tesla, Molotov, Forcefield.

Evolution rule everywhere: `level > 5` **and** the paired supply owned.
Damage always scales with `attack` (POWER).

| Weapon | cooldown | damage (× attack) | count / radius | evolves via | → evolution |
|---|---|---|---|---|---|
| Axe | 2500 ms | 5, ×1.25/1.5/1.75/2/4 by level | radius 80 →88/96/112/120, 200 evolved | Supplements | Battleaxe |
| Crossbow | 1500 ms | 3, ×1.25/1.5/1.75/2 by level | 3 bolts → 4/5/6/7, range 300 | ActionGloves | Shotgun |
| Flamethrower | 2000 ms, 100 ms stream | 2 | targets 1 → 2/3/10, life 400 | Handbook | Plasmagun |
| Gun | 1000 ms | 4, ×2.5 evolved | burst `level+1`, 150 ms gap; evolved 160 ms | AmmoBooster | Uzi |
| Sword | 500 ms | 5 | range `250 × scale` (0.8 → 1.7), evolved hits both sides | Kevlar | Scimitars |
| Drill | 2000 ms, 250 ms burst | 3 | 1/2/3 drills, speed 100 → 400 | Scope | Lasergun |
| Bazooka | 2000 ms | 5, ×2/×2/×4/×4/×8 | radius 100 → 200, 1/2/3 rockets | Propane | Nuke |
| Boomerang | 3000 ms | 6, ×2 at 5, ×4 evolved | 1 → 2 blades, life 2500 | Magnet | Neckbreaker |
| Circular | 8000 ms | 1 | 2 saws → 3/4/5/6/7, radius 100 → 220 | Chronometer | Ripper |
| Tesla | 2500 ms | 5 | chain radius 50 → 60/70/80/90/200 | ActionGloves | Thunderorb |
| SpikedBall | 3000 ms | 4, ×1.5/×2/×2/×2.5 | 1/2/3 balls, bounce 3; evolved 8-way | Sneakers | Biliard |
| Forcefield | 350 ms tick (150 evolved) | 3, ×1.3…×2.5 | radius 60 → 100 (evolved 80), eats shots | EnergyDrink | Domain |
| Launcher | 8000 ms | 2, ×1.5/×2/×2.5 | 25/50/100 rockets, radius 80 | AmmoBooster | Airstrike (10 screen strikes) |
| Molotov | 3000 ms | 1, ×1.25/1.5/1.75/2/2.5 | `level+1` bottles, radius 70 → 180 | Detector | Canister |

Notable per-weapon behaviour read from the prototypes:
- Crossbow is a **fan along the walk direction** with pierce, count grows with level.
- Gun is the only primary that **auto-targets the closest enemy** (falls back to
  bosses inside a boss zone) and fires a burst, not a single shot.
- Drill/Tesla/Bazooka/Boomerang also target the nearest body.
- Sword hits every enemy inside a radius; Scimitars additionally attack behind.
- Circular saws **destroy enemy projectiles**.
- Forcefield damages on a 350 ms tick and invalidates enemy shots in radius.
- Airstrike drops 10 strikes at random screen points, 100 ms apart.

There is **no magazine, ammo count or reload in the original**.

---

## 4. Supplies — 12 passives, 5 levels each (level 0 = not owned)

`Kevlar AmmoBooster Handbook Scope Propane Magnet Chronometer EnergyDrink ActionGloves Sneakers Detector Supplements`

Verified bonus arrays (`bonus[level]`, index 0 = level 0):

| Supply | Bonus | Values |
|---|---|---|
| Kevlar | `defense` | 0 / 10 / 20 / 30 / 40 / 50 |
| AmmoBooster | `attack_bonus` | 0 / 0.1 / 0.2 / 0.3 / 0.4 / 0.5 |
| Handbook | `exp_bonus` | 0 / 8 / 16 / 24 / 32 / 40 |

The rest follow the same 6-entry pattern and map to `shot_range_bonus`
(Scope), blast radius (Propane), `pickup_range_bonus` (Magnet),
`cooldown_bonus` (Chronometer), `regen_bonus` (EnergyDrink), `speed_bonus`
(Sneakers), `fortune` (Detector) and max HP (Supplements).

Supplies are **not** picked up from the floor — they are offered as
level-up cards and level up in place.

---

## 5. Enemies — 28 combat types + box + treasure

`speed` is px/ms (×1000 for px/s). `attackDelay` in ms.

| type | speed | hp | range | dmg | cd | bonus | mass | notes |
|---|---|---|---|---|---|---|---|---|
| zombieA | .13 | 10 | 40 | 4 | 1000 | 100 | – | |
| zombieB | .12 | 11 | 40 | 4 | 1000 | 100 | – | |
| zombieC | .11 | 12 | 40 | 4 | 1000 | 100 | – | |
| zombieD | .10 | 13 | 40 | 4 | 1000 | 100 | – | |
| tower1 | 0 | 200 | 125 | 5 | 350 | 300 | – | static melee turret |
| tower2 | 0 | 700 | 125 | 5 | 350 | 3000 | – | static, shot 5 dmg / 3 s / 600 px |
| reptile | .25 | 50 | 40 | 6 | 1000 | 300 | 1 | |
| cop | .10 | 25 | 50 | 5 | 1000 | 300 | – | ranged, shot 5 dmg / 3 s |
| bat | .50 | 10 | 40 | 3 | 1000 | 100 | 2 | fastest |
| builder | .10 | 300 | 40 | 10 | 1000 | 1000 | – | |
| spider1 | .15 | 200 | 40 | 20 | 1000 | 1000 | – | |
| spider2 | .20 | 400 | 40 | 30 | 1000 | 3000 | – | |
| toxic1 | .20 | 10 | 10 | 5 | 1000 | 300 | 2 | **acid pool on death** |
| toxic2 | .25 | 150 | 10 | 7 | 1000 | 1000 | 2 | acid pool |
| slime1 | .15 | 10 | 10 | 3 | 1000 | 100 | – | acid pool |
| slime2 | .10 | 100 | 10 | 5 | 1000 | 300 | – | acid + **splits into 2 slime1** |
| slug | .05 | 500 | 10 | 20 | 1000 | 3000 | – | **splits into 2 slime2** |
| assault1 | .15 | 400 | 50 | 7 | 1000 | 3000 | – | 3 staggered shots (2.5/2.8/3.1 s) |
| assault2 | .15 | 400 | 50 | 7 | 1000 | 3000 | – | 3-shot fan at −20/0/+20° |
| manager | .10 | 15 | 50 | 3 | 1000 | 300 | – | **throws a briefcase** (10 dmg, destroyable) |
| miniboss_builder | .15 | 4000 | 60 | 20 | 1000 | 10 000 | 5 | drop: **magnet** |
| miniboss_fighter | .20 | 5500 | 60 | 25 | 1000 | 10 000 | 5 | drop: 1000 coin |
| miniboss_spider | .30 | 5000 | 60 | 40 | 1000 | 10 000 | 5 | drop: chest ×3 |
| miniboss_reptile | .30 | 3500 | 60 | 30 | 1000 | 10 000 | 5 | drop: chest ×1 |
| miniboss_soldier | .10 | 4500 | 60 | 7 | 1000 | 10 000 | 5 | **8-way ring**, drop: bomb |
| miniboss_tower | 0 | 6000 | 125 | 5 | 450 | 10 000 | – | static, **8-way ring**, drop: 1500 coin |
| miniboss_toxic1 | .30 | 2500 | 60 | 20 | 1000 | 10 000 | 5 | acid, drop: medkit |
| miniboss_toxic2 | .25 | 3000 | 60 | 20 | 1000 | 10 000 | 5 | acid + 3 staggered shots, drop: 500 coin |

`box` and `treasure` are the two non-combat entries (10 hp, no damage).

Death effects: `deadshot` spawns a lingering hazard — acid (5/7 dmg, 2–3 s) for
toxic1/2, slime1/2 and miniboss toxins; a **briefcase projectile** (10 dmg,
rotating, destroyable) for the manager. `deadspawn` is the corpse split.

---

## 6. Bosses — 6 types, scripted behaviour lists

All bosses: `attackDelay 1500`, `meleeDelay 200`, deaddrop chest (1/3/5).

| boss | hp | speed | scale | signature script |
|---|---|---|---|---|
| boss_tower | 10 000 | 0 (static) | .85 | 9 steps: 3-way bounce ring → 12-way ring → cluster shards (20 dmg) |
| boss_reptile | 8 000 | .25 | 1.0 | chase 6 s → 3 charges (windup 700 ms, speed .7) → spawn 4 reptiles 350 ms apart |
| boss_soldier | 9 000 | .25 | .95 | roam 4 s → 4× 5-way fan (second volley +500 ms) → 3× grenade (30 dmg, radius 80) |
| boss_dragon | 7 500 | .25 | 1.0 | chase 4 s → 10-shot stream, one every 350 ms (20 dmg each) |
| boss_spider | 8 500 | .15 | .95 | roam + egg mortar (radius 190, 20 dmg) + 3-way poison + spawn 3 spider1 |
| boss_mutant | 9 500 | .15 | 1.0 | chase 6 s → charge (speed .7) → **teleport** → spawn 4 slime2 |

Movement vocabulary: `CHASE 0, CHARGE 1, ROAM 2, RETREAT 3, TELEPORT 4, SPAWN 5, ATTACK 10`.
Each behaviour entry carries `duration: [delay, active, cooldown]` in ms, and may
carry `shots[]` (with `angleInc`, `delay`, `homing`, `grenade`, `explosive`,
`fragment`) or `spawns[]` (enemy type, count, radius).

**Boss zone:** on activation the game builds a rectangular fence on an 80 px grid
(1000–1600 px depending on the stage), plays fence animations, **kills every
normal enemy at the boss**, teleports the player inside the limits, spawns the
bosses at 80 % of the half-extents (tower gets `spawnRadius 50`), shows a boss
HP bar per boss and switches music to `music_boss`.

---

## 7. Levels — 8 stages, measured

| Stage | tile | waves | boss waves | last authored wave | max caps seen | rewards |
|---|---|---|---|---|---|---|
| Stage1 | bg1 | 33 | 2 | 630 s | 1…200 | 1000 / 1500 / 2500 |
| Stage2 | bg2 | 35 | 2 | 630 s | 1…150 | 2000 / 3000 / 5000 |
| Stage3 | bg3 | 36 | 2 | 630 s | 2…150 | 3000 / 4500 / 7500 |
| Stage4 | bg4 | 43 | 2 | 630 s | 1…150 | 4000 / 6000 / 10000 |
| Stage5 | bg5 | 43 | 2 | 630 s | 1…200 | 5000 / 7500 / 12500 |
| Stage6 | bg6 | 53 | 2 | 630 s | 1…300 | 6000 / 9000 / 15000 |
| Stage7 | bg7 | 66 | 2 | 630 s | 1…300 | 8000 / 12000 / 20000 |
| Stage8 | bg8 | 61 | 2 | 630 s | 1…300 | 8000 / 16000 / 24000 |

Every stage: `timeToTreasure = 15 000` ms, 2 boss zones, waves end at 630 s but
the run goes to 1200 s (the engine recycles waves once the ladder is spent).

### Wave scheduler (source behaviour)

```
updateInactiveWave(wave):
  if (startTime − time) > 3s: return
  if (startTime − time) > 0 and boss wave: show "INCOMING_BOSS" for 3s
  else activateWave(wave)

activateWave(wave):
  wave.active = true
  if wave.bossZone: create rect zone, killAllEnemiesAtBoss(),
                    movePlayerFromOuterLimits(), spawnBosses(), music_boss
  if time >= wave.timeOfEnd: deactivate

updateActiveWave(wave, dt):
  if wave.bosses: updateWaveBosses()        // does nothing while bosses live
  else:
    if bosses alive: return                 // normal waves freeze in a boss zone
    wave.delay -= dt
    if wave.delay <= 0: wave.delay = wave.frequency; spawn one enemy

spawn:
  if countEnemiesOfType(enemy) >= maxEnemies:
      destroyEnemyOfTypeFarAway(enemy)      // recycle the farthest body
  spawn at half-diagonal × 1.3 (×2.2 near map edges) around the player
  miniboss waves also show "INCOMING_MINIBOSS" for 3s
  total counter decrements when present
```

Treasure: a box spawns **every 15 s** at the edge of the screen, not once per run.

---

## 8. XP, cards, rerolls, continues

- Level-up pauses the scene, hides the joystick, pauses anims, shows
  `ShowSkillSlots(n)` where **n is 3 for a level-up** and **1/3/5 for a chest**
  (`ShowSkillSlots(bonus.data)`).
- Reroll costs: level-up `500 × (n+1)`, max **5** resets
  (`MAX_RESETS_LEVELUP`); chest `1500 × (n+1)`, max **3** (`MAX_CHESTS_REROLLS`).
- Continue: `2500 × n`, max **2** (`MAX_CONTINUES`).
- Skill slots offer: new weapon / weapon level / new supply / supply level.
- Meta skills (max 30) and their price ladder:
  `0,0,1000,3000,6000,10000,15000,21000,28000,36000,45000,…,435000`.
- Values (level 1 → 30): POWER 10 → 880, HEALTH 100 → 4450, ARMOR 0 → 43.5,
  AID 25 → 2350, FORTUNE 0 → 435, LEARNING 0 → 297.5.
- Stage unlock: previous stage's recorded time must reach 1,200,000 ms
  (`IsLevelLocked`), records kept per difficulty.

---

## 9. Economy, missions, idle rewards

- Coins drop as pickups (300 / 500 / 1000 / 1500 sprites) and from crates.
- **13 mission types**: daily login, watch ad, kill enemies, kill minibosses,
  kill bosses, survive X minutes, buy X upgrades, earn X gold, collect X exp,
  deal X damage, receive X damage, heal X points, open X crates, plus
  complete-4 and complete-10 mission chains.
- **Big filing coffer**: 25 coins per 15-minute segment, up to 168 h
  (`672 segments → 16,800 coins`).
- Rewarded ads exist as a reroll/continue option (`REWARDED_ADS_ENABLED`).
- Onboarding flag stored in the save (`OnboardingPassed`), save schema `0.4`.

## 10. Audio and presentation

38 sound definitions, including **three music beds**: `music_menu`,
`music_ingame`, `music_boss`; per-weapon shot sounds (`gun2`, `laser`,
`sword`, `rocket`, `lightning`, `molotov`, `forcefield`), pickup sounds
(`coin`, `magnet`, `medkit`, `bomb`, `exp`), UI sounds (`slot_tick`,
`levelup`, `upgrade_click`, `reward_button`).
Sprite-atlas art (`pak_actors`, `pak_game`), fence and explosion animations,
hazard text in the top HUD, per-boss HP bars, chest light pulse + navigation
arrow to the nearest chest.

---

# Gap analysis: original → this build

Verified by reading our implementation next to the tables above.

## Still missing (ranked by gameplay impact)

1. **Scripted boss AI.** The original bosses run behaviour lists: chase, charge
   with windup, roam, retreat, teleport, spawn adds, and timed attack patterns
   (12-way rings, delayed second volleys, homing rockets, egg mortars, poison
   fans). Ours walk at the hunter and fire one straight shot. This is the
   largest single gap.
2. **Boss-zone geometry.** Original: 80 px fence grid the player collides with,
   all normal enemies killed at activation, player moved inside, per-boss HP
   bars, boss music. Ours: clock freeze only — you can walk out of the fight.
3. **Death hazards and corpse splits.** `deadshot` acid pools (toxic/slime),
   the manager's briefcase projectile, and `deadspawn` (slime2 → 2 slime1,
   slug → 2 slime2). We have none of these.
4. **Chest card counts and chest rerolls.** Chests open 1, 3 or 5 cards and
   reroll at 1500 × (n+1), max 3. Ours always opens 3 and reuses the level-up
   reroll sink.
5. **Food pickup** (heals 100) and the bomb's real formula (10 × attack in a
   900 px radius; ours kills all normal bodies and chips bosses 8 %).
6. **Magnet semantics.** Original pulls **exp gems only**; ours marks every drop.
7. **Player collision with heavy bodies** (`mass` 1/2/5) and with static
   enemies/bosses. Ours has enemy-vs-enemy separation but the hunter can stand
   inside a miniboss.
8. **Wave ceilings.** Original allows up to 300 concurrent bodies of one type at
   100 ms cadence and recycles the farthest body at the cap. Ours deliberately
   opens at 6 near / 22 hard and ramps to 27 / 88 by minute 20 — a design
   choice, but a real divergence.
9. **Victory beat.** 5 s `DELAY_GAME_WON` before the results dialog.
10. **Music.** Three original tracks; we ship SFX only.
11. **Missions + idle coffer + onboarding.** 13 mission types, 168 h coffer,
    rewarded-ad rerolls. We have daily rewards and redeem codes instead.
12. **Roster accuracy.** Our `BOSS_TYPES` adds `boss_fighter` (not in the
    original's six) and uses 8 000–14 000 HP where the original is 7 500–10 000.

## Where this build is already ahead

- **Ammo and manual tactical reload** (the original has no magazines at all).
- **Jetpack** with ignition cost/kick and dry-tank lock, **combat roll** with
  i-frames.
- **20 base weapons + 20 evolutions** (original: 14 + 14).
- **35 playable survivors**, each with a unique power.
- **Store, upgrades, characters, daily rewards, redeem codes**, prestige roster.
- **20 stages** (vs 8), **endless mode**, 19-district endless city with weather.
- **Local leaderboard** with sanitising, hit/knockback/shockwave feedback layer,
  damage numbers, red hurt vignette, bomb whiteout.

## Suggested order of work

1. Boss behaviour lists (reuse `duration:[delay,active,cooldown]` and
   `shots[]`/`spawns[]`, which map cleanly onto our projectile/enemy model).
2. Boss-zone fence + kill-all-at-boss + per-boss bars.
3. `deadshot` pools and `deadspawn` splits.
4. Chest card counts (1/3/5) and the 1500-based reroll sink.
5. Food pickup, magnet semantics, bomb formula.
6. Player collision with `mass` bodies.
7. 5 s victory beat and a music bed.
