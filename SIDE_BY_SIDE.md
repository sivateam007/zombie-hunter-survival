# Side-by-side: GameSnacks Zombie Hunter vs Meow Zombie Hunter

Every row was checked **twice**: `Check 1` is the original's mined value
(`analysis/teardown.json`, `levels_full.md`, `weapons_full.md`); `Check 2` is
this repo's source or runtime table. A row marked ❌ was confirmed missing by two
independent checks — a source search *and* reading the owning function — so
"not found" alone never counts.

Legend: ✅ parity · 🟡 partial/different · ❌ missing · ➕ ours only.

## 1. Rules and timing

| Feature | GameSnacks | Ours | Status | Check 1 (original) | Check 2 (ours) |
|---|---|---|---|---|---|
| Run length | 1,200,000 ms | `ZH.TIME_LEVEL_COMPLETED = 1200` | ✅ | `TIME_LEVEL_COMPLETED` | `js/game.js` win gate ~line 1101 |
| Victory hold | 5,000 ms before results | 5 s `victory` state, then results | ✅ | `DELAY_GAME_WON` | `game.js` `victoryT`, banner + win sting |
| Boss warning | 3 s banner | 3 s `WARNING` banner + flash | ✅ | `DELAY_HIDE_HAZARD_INFO=3000` | `game.js` ~413 `wave.startTime - 3` |
| Post-hit i-frames | 3 s | shield timeline, 3 s `levelup`/`hit` | ✅ | `TIME_INVINCIBLE=3000` | `ZH.SHIELD` {hit:3} |
| Continues | 2,500×n, max 2 | same | ✅ | `getPriceForContinue`, `MAX_CONTINUES=2` | `ui.js:492` comment + `showContinue` |
| Difficulty multipliers | HP/dmg ×2, ×4; speed 1.15/1.5; rewards 1.5/2.5 | same three tiers | ✅ | difficulty tables | `ZH.CONFIG/diff` + `healthMultiplier` |
| Stage unlock | previous record ≥ 20 min | record gate | ✅ | `IsLevelLocked` | `storage.js`/`game-patch.js` |
| Enemy field cap | 500 (`MAX_ENEMIES`), wave max up to 300 | 6→27 near, 22→88 hard | 🟡 deliberate | `MAX_ENEMIES=500`, max 300 | `ZH.HORDE.ramp` |
| Portrait layout | 790×1300 | responsive full-screen | 🟡 | resolution constants | CSS/canvas |

## 2. Player, XP, skills

| Feature | GameSnacks | Ours | Status | Check 1 | Check 2 |
|---|---|---|---|---|---|
| Base speed | 0.3 px/ms | 0.3 | ✅ | `resetAttribs` speed .3 | `entities.js` survivor speed |
| Pickup range | 50 | 150 base | 🟡 ours wider | `pickup_range=50` | `updatePickups` `150 × …` |
| Regen | `regen_bonus` tick every 5 s | **removed**: health only from packs, gifts and lifesteal powers | ❌ by design | `regen_time=5000` | `updateSurvivor`, `Powers.update` |
| XP to level | `floor(1000×1.25^(level−1))` | same | ✅ | `getExpsToLevelUp` | `Game.expNeeded` |
| XP gain | `3×floor(v + v·exp% + v·learning%)` | exp bonus only, no ×3/learning | 🟡 | `incExps` | `updatePickups` exp branch |
| POWER at 30 | 880 | 880 | ✅ | skills array | `ZH.skillValue('power',30)` |
| HEALTH at 30 | 4450 | 4450 | ✅ | skills array | runtime |
| DEFENSE at 30 | 43.5 | 43.5 | ✅ | skills array | runtime |
| FIRSTAID at 30 | **2350** | **2200** | 🟡 curve differs | skills array | runtime |
| FORTUNE at 30 | 435 | 435 | ✅ | skills array | runtime |
| LEARNING at 30 | **297.5** | **217.5** | 🟡 curve differs | skills array | runtime |
| Skill cap / ladder | 30 levels, 0→435,000 | same six, same cap | ✅ | `MAX_PLAYER_SKILL` | `storage.js` |

## 3. Weapons

| Feature | GameSnacks | Ours | Status | Check 1 | Check 2 |
|---|---|---|---|---|---|
| Roster | 14 base + 14 evolutions | 40 = 20 base + 20 evolved | ➕ | `weapons_full.md` | `ZH.WEAPONS` keys |
| Starting primaries | Axe, Flamethrower, Crossbow, Gun, Sword | same five + extras | ✅ | `PrimaryWeapons` | `WEAPON_ORDER` |
| Evolution rule | level > 5 **and** paired supply | same | ✅ | prototypes | `effectiveWeapon` |
| Gun cadence | burst `level+1` @150 ms | burst, mag 30, reload 1.2 s | 🟡 ours adds ammo | `Gun` getters | `ZH.WEAPONS.gun` |
| Crossbow | fan + pierce | fan + pierce | ✅ | prototype | `weapons.js` |
| Circular | 2→7 saws, eats enemy shots | same | ✅ | `Circular` update | `entities.js` projectile purge |
| Forcefield | 350 ms tick (150 evo), eats shots | same | ✅ | prototype | `weapons.js`/`entities.js` |
| Bazooka multipliers | 2/2/4/4/8 | same | ✅ | `getDamage` | `weaponLevelMul` |
| SpikedBall multipliers | 1.5/2/2/2.5 | same | ✅ | `getDamage` | table |
| Ammo / reload | **none in the original** | magazine + manual tactical reload | ➕ | no ammo fields | `test/jetpack`, `ui.js` RELOAD |
| Extra guns | — | rocketlauncher, grenadelauncher, smg, grenade, sniper, katana, minigun, railgun, nodachi | ➕ | — | `ZH.WEAPONS` |

## 4. Supplies

| Feature | GameSnacks | Ours | Status | Check 1 | Check 2 |
|---|---|---|---|---|---|
| Count | 12, 5 levels each | 14, 5 levels each | ➕/🟡 | `teardown.json` supplies | `ZH.SUPPLY_IDS` |
| Kevlar | defense 0/10/20/30/40/50 | same | ✅ | `bonus` array | `storage.js` supplies |
| AmmoBooster | attack_bonus .1–.5 | same | ✅ | array | table |
| Handbook | exp_bonus 8–40 | same | ✅ | array | table |
| Scope | shot_range_bonus .1–.5 | same | ✅ | array | table |
| Propane | **shot_speed_bonus** | shot speed | ✅ | array | table |
| Magnet | pickup_range_bonus .5/2/3/4/5 | pickup reach | ✅ | array | table |
| Chronometer | **attack_bonus** .1–.5 | attack | ✅ | array | table |
| ActionGloves | cooldown_bonus .08–.4 | same | ✅ | array | table |
| Supplements | **attack_bonus** .2–1.0 | same | ✅ | array | table |
| Detector | cash_bonus 8–40 | same | ✅ | array | table |
| No `health_bonus` source | confirmed | n/a | ✅ | resetAttribs | — |

## 5. Enemies

| Feature | GameSnacks | Ours | Status | Check 1 | Check 2 |
|---|---|---|---|---|---|
| Roster | 28 combat + box + treasure | 28 combat | ✅/🟡 | `EnemiesData` | `ZH.ENEMY_TYPES` |
| Assault1 | 3 shots at 2500/2800/3100 ms | staggered burst | ✅ | shots array | `entities.js` enemy fire |
| Assault2 | −20/0/+20° fan | spread fan | ✅ | shots array | enemy fire |
| Miniboss soldier | 8-way ring | 8-way ring? | 🟡 | 8 shot entries | single fan in code — verify per-type |
| Miniboss tower | 8-way @450 ms cd | cd 0.45, one aimed shot | 🟡 | shots array | `BOSS/ENEMY_TYPES` table |
| Acid on death | 6 types, 1–3 s pools | acid pools (3/5/7 dmg) via `world.hazards` | ✅ | `deadshot` blocks | `damageEnemy` + hazard tick |
| Corpse split | slime2→2 slime1, slug→2 slime2 | implemented on death | ✅ | `deadspawn` | 2 children, 0.25 s spawn delay |
| Manager briefcase | destroyable 10-dmg projectile | plain melee/ranged body | ❌ | `deadshot{frame:shot_briefcase}` | no briefcase |
| Mass shove | mass 1/2/5 pushes hunter | separation only | ❌ | `mass` values | `entities.js` separation loop |
| Miniboss HP | 2500–6000 | 3000–6000 (toxics inflated) | 🟡 | table | `ENEMY_TYPES` |
| Miniboss drops | tower→1500 coin, toxic2→500 coin, spider→3-card chest | tower→1500, toxic2→500, spider→3-card chest | ✅ | `deaddrop` | `DROP_DATA` map |
| Static turrets | yes | yes | ✅ | `static:!0` | table |

## 6. Bosses and boss zones

| Feature | GameSnacks | Ours | Status | Check 1 | Check 2 |
|---|---|---|---|---|---|
| Boss count | 6 | 7 (`boss_fighter` extra) | 🟡 | `BossesData` | `ZH.BOSS_TYPES` |
| Boss HP | 7,500–10,000 | 8,000–14,000 | 🟡 | table | runtime |
| Scripted steps | 2–18 steps per boss | chase + shoot | ❌ | `behaviour[]` | no behaviour list in `createBoss`/update |
| Charge windup | 700/500 ms | none | ❌ | `duration[0]` | no charge state |
| Teleport | mutant, 1 s | none | ❌ | step 3 | no teleport code |
| Summon adds | reptile 4, mutant 4, spider 3 | none | ❌ | `spawns[]` | no spawn step |
| 12-way tower ring | yes | single shot | ❌ | 12 shots | boss fire code |
| Dragon stream | 10 shots @350 ms | none | ❌ | shots with delays | boss fire code |
| Spider egg mortar | r190, 20 dmg | none | ❌ | ATTACK steps | no grenade AI |
| Boss-zone **data** | rect 1000–3072 px | present, same sizes, 2 bosses in S4–S8 | ✅ | level JSON | `levels.js` + runtime |
| Boss-zone **enforcement** | fence, player confined, kill all mobs | player clamped in the rect; no fence art or kill-all | 🟡 | `BossZone` collision | `bossZoneRect` in `updateSurvivor` |
| Per-boss HP bars | one per boss | single bar | 🟡 | HUD | `pushHud` single boss |

## 7. Stages and waves

| Feature | GameSnacks | Ours | Status | Check 1 | Check 2 |
|---|---|---|---|---|---|
| Stages | 8 | 20 (first 8 mirrored) | ➕ | `GameLevels` | `ZH.STAGES` |
| Waves | 370 | 730 | ➕ | `levels_full.md` | runtime |
| Authored ladder end | 630 s | same for S1–S8 | ✅ | level JSON | `levels.js` |
| Boss waves | 300 s and 600 s, 30 s | same for S1–S8 | ✅ | bossWaves | `levels.js` |
| Bosses per zone | 1 (S1–3), 2 (S4–8) | same | ✅ | level JSON | `levels.js` |
| Cadence | 700/350/100 ms | 1250/800/500 ms → ×0.54 | 🟡 deliberate | `FREQ_*` | `ZH.HORDE.interval` |
| Far-body recycle | farthest of type at cap | leash teleport | 🟡 | `destroyEnemyOfTypeFarAway` | `entities.js` leash |
| Treasure | every 15 s at edge | every 15 s near player | 🟡 placement | `timeToTreasure` | `game.js` treasure block |
| Wave totals | `total` caps per wave | spawned counter | ✅ | wave records | `wave.spawned` |

## 8. Pickups and economy

| Feature | GameSnacks | Ours | Status | Check 1 | Check 2 |
|---|---|---|---|---|---|
| Coin faces | 100/300/500/1000/1500 | `value` 5 default, gifts 250–800 | 🟡 | coin sprites/data | drop code |
| Box drop table | coin15/coin×3 20/pile15/pouch10/magnet10/medkit25/bomb5 | rare 0.4 % bomb, 1 % medikit | 🟡 | `BOMB_*` table | `entities.js` drops |
| Bomb effect | 10×attack in 900 px | 10×attack in 900 px, bosses included | ✅ | `BOMB_BONUS_RADIUS` | bomb branch |
| Magnet | pulls **gems only** | vacuums every drop | 🟡 | pickup code | `pk.pulling` loop |
| Food | heals 100 | food drop heals 100 | ✅ | `BONUS_FOOD` | pickup branch + render |
| Medkit | heals `firstaid` | heals 45/60 | 🟡 | pickup code | values |
| Treasure cards | 1/3/5 cards | 1/3/5 supported; drops carry the count | 🟡 | `ShowSkillSlots(data)` | `showLevelUp(count)`; reroll still shared |
| Chest reroll | 1,500×(n+1), max 3 | shared 500×n, max 5 | ❌ | `MAX_CHESTS_REROLLS` | `lu-reroll` |
| Level-up reroll | 500×(n+1) max 5 | same | ✅ | price helper | `ui.js` |
| Force field | none | earned cell every 40 kills / boss, 150 s | ➕ | — | `ZH.SHIELD`, `shieldGiftDue` |
| Gift box | none | random reward | ➕ | — | gift branch |

## 9. Missions, idle, meta

| Feature | GameSnacks | Ours | Status | Check 1 | Check 2 |
|---|---|---|---|---|---|
| Missions | 15 entries, 3 active, ×2/×4 tiers | 6 slots, same table, ×2/×4 tiers, 24 h refresh | ✅ | `missions.json` table | `js/missions.js`, `missions.test.js` |
| Coffer | 25/15 min, 168 h, starts +158 h | 672 segments, 16,800 cap, same +10 h start (1,000 coins) | ✅ | `CofferTime` maths | `cofferState`, `missions.test.js` |
| Rewarded ads | reroll/continue | none | ❌ | `REWARDED_ADS_ENABLED` | no ad code |
| Suspended run | `SavedGame` snapshot | none | ❌ | save schema | no snapshot |
| Store / characters | none | store, 35 survivors | ➕ | — | `storage.js`, `powers.js` |
| Leaderboard | platform score | local ledger + 60 cat callsigns seeded on both boards | ✅ | `GameSnacks.score` | `waves.test.js`, live board |

## 10. Audio and presentation

| Feature | GameSnacks | Ours | Status | Check 1 | Check 2 |
|---|---|---|---|---|---|
| Music beds | 3 tracks, per-track volume | one drone/wind bed, now started at stage start | ✅/🟡 | `music_menu/ingame/boss` | `startStage` calls `startMusic()` |
| Weapon SFX | 14 keys | per-weapon synth | ✅ | sound list | `audio.js` |
| Pickup SFX | coin/medkit/magnet/exp | same | ✅ | sound list | `audio.js` |
| Hit feedback | flash + blood | flash, knockback, numbers, decals | ✅/➕ | source | `entities.js` |
| Blast FX | explosion anim | shockwave ring + light | ✅ | source | `game.js` render |
| Weather/districts | per-stage background | 19 districts, rain/ash | ➕ | — | `arena.js` |

## 11. Verified-missing list (each confirmed twice)

| # | Missing system | Check 1 | Check 2 |
|---|---|---|---|
| 1 | Boss behaviour interpreter | 30+ step entries in `teardown.json` | `createBoss` has no phase/step state |
| 2 | Boss arena confinement | rect sizes in level data | `activateBossZone` spawns only, no fence/collision |
| 3 | Kill-all-at-boss | `killAllEnemiesAtBoss()` in source | escort is added instead |
| 4 | Acid `deadshot` pools | 6 enemy blocks + boss step | no `acid`/`hazard` symbols in `js/` |
| 5 | `deadspawn` splits | slime2/slug blocks | no split on death |
| 6 | Manager briefcase | `shot_briefcase.png`, 10 dmg | no briefcase projectile |
| 7 | Food pickup | `BONUS_FOOD=5`, heals 100 | no `food` type |
| 8 | 1/3/5 chest cards | `ShowSkillSlots(data)` with 1/3/5 | `showLevelUp()` always 3 |
| 9 | Chest reroll sink | `1500×(n+1)`, max 3 | single 500×n sink, max 5 |
| 10 | 5 s victory hold | `DELAY_GAME_WON=5000` | results opened inline |
| 11 | Music playback | 3 beds with volumes | `startMusic` never invoked |
| 12 | Player mass collision | `mass` 1/2/5 | separation only, no shove |
| 13 | Gems-only magnet | `pullOnlyExps` behaviour | magnet flags all drops |

## 12. Corrections to earlier notes

- **Music is not absent — it is unwired.** `audio.js` builds a music bus and
  `startMusic()`, but nothing calls it, so no track ever plays.
- **Boss-zone rects already exist in our data** (matching sizes, 2 boss waves in
  stages 4–8). What's missing is enforcement, not the data.
- **Firstaid and learning curves diverge at max level** (2200 vs 2350,
  217.5 vs 297.5) — a parity bug, not just a missing feature.
- **Two miniboss drops are wrong**: our tower drops a bomb (original: 1,500
  coins) and our toxic2 drops 1,000 coins (original: 500).
- Earlier claim "26 enemy types" was wrong; the original has **28 combat types**
  plus box/treasure, which we match.

## 13. Implemented in this pass

| Change | Where | Verified by |
|---|---|---|
| Miniboss payouts corrected (tower 1,500 · toxic2 500 · fighter 1,000; reptile 1-card, spider 3-card chest) | `entities.js` `DEADDROP`/`DROP_DATA` | `sim.test.js` §10 asserts the exact values |
| Acid `deadshot` pools for toxic1/2, slime1/2 and both miniboss toxins (3/5/7 dmg, 1–3 s) | `entities.js` `damageEnemy` + hazard tick | `sim.test.js` §10b: one hazard on slime2 death |
| `deadspawn`: slime2 → 2 slime1, slug → 2 slime2 | `entities.js` death branch | `sim.test.js` §10b: two children |
| Food pickup heals a flat 100 and drops rarely | `entities.js` + `game.js` render | `sim.test.js` §10b: 10 → 110 |
| Bomb now `10 × attack` in a 900 px radius, bosses included | `entities.js` bomb branch | existing bomb test still passes |
| Music actually starts on stage entry | `game.js` `startStage` → `ZH.Audio.startMusic()` | no test; call site checked |
| 5 s victory hold (`victory` state, banner, win sting) before results | `game.js` `update`/win gate | state machine reviewed; `victoryT = 5` |
| Boss arena is now a real rect: hunter clamped inside, zone banner, cleared on boss death | `game.js` `activateBossZone`, `entities.js` `updateSurvivor` | clamp probe returned x = 40 for a ±40 rect |
| Chests can open 1/3/5 cards; drops carry the count | `ui.js` `showLevelUp(count)`, `pickOffers(count)` | source reviewed; treasure passes `pk.value` |
| Cache-busting versions bumped | `index.html` entities 29 · game 36 · ui 20 · BUILD 23 | file inspected |

**Still open:** boss step interpreter, arena fence art and kill-all-at-boss,
manager briefcase, gems-only magnet, heavy-body shove, chest-specific reroll
sink, rewarded ads and suspended runs, and the three distinct music beds
(we start one bed).

## 14. Implemented in this pass — contracts and the coffer

| Change | Where | Verified by |
|---|---|---|
| Six contracts: daily patrol, three rolled tiers, 4- and 10-claim chains | `js/missions.js` `generate()` | `missions.test.js`: 6 slots, distinct types, tiers 1/2/3 |
| Original table: 3,000 base, 6,000 / 12,000 tiers, exact targets (1,000 kills → 100,000; 10,000 scrap → 75,000; …) | `SPECS` | test asserts all twelve ladders + chain payouts |
| Progress from real play: kills, bosses, minibosses, survival minutes, purchases, scrap, XP, damage dealt/taken, healing, crates | `entities.js`, `game.js`, `storage.js` | test drives progress, caps at target, pays once |
| Claims pay into the bank and multiply by difficulty (x1 / x1.5 / x2.5) | `Missions.claim` | test: tier-2 = 6,000; insane boss = 7,500 |
| 4- and 10-contract chains advance per claim | same | test: `missionsDone` → chain value |
| 24 h refresh replaces claimed slots; daily patrol resets on the calendar day | `refresh`, `ensure` | test: claimed slot regenerated, daily claimable again |
| Idle coffer: 672 × 25 = 16,800 cap, +158 h fresh save = 1,000 coins, claim resets to full 168 h | `cofferState`, `claimCoffer` | test: 1,000 → +25/segment → 16,800 cap → claim empties → refills |
| Board screen: coffer progress, mission bars, claim buttons, live countdown | `index.html`, `ui.js`, `css/style.css` | source reviewed; page loads with BUILD 24 |

**Reading correction:** the earlier note called the +158 h coffer "almost
full". The actual formula (`672 − ceil(minutesLeft/15)`) means a fresh save
holds **10 h of segments = 1,000 coins**, and fills over the next 158 h.

## 15. Implemented in this pass — wave stages, idle siege, practice board

| Change | Where | Verified by |
|---|---|---|
| A stage is **20 waves × 60 s** = the authored 1,200 s window, so wave 20 and the 20-minute clear are the same moment | `ZH.WAVE_SECONDS`, `ZH.WAVES_PER_STAGE`, `waveNumber` | `waves.test.js` asserts 20 × 60 = `TIME_LEVEL_COMPLETED` and the clamp |
| HUD reads **WAVE n / 20**; endless keeps counting past the campaign length | `pushHud`, `updateHud`, `index.html` | browser: BUILD 25 shows `/20` |
| Surviving wave 20 **deploys the next stage automatically**, carrying level, XP, weapons, supplies and vitals | `finishStage`, `captureRun`, `restoreRun` | browser: stage 1 → Stage 2 with SMG lvl 3 and power lvl 2 intact, WAVE 1/20, `frameErrors: 0` |
| Standing still 0.8 s arms the **siege**: 2–4 bodies burst in from a full ring at 290–430 px, 1.1 s → 0.3 s cadence, tougher enemies (+85% by minute 20), +34 over the field cap | `updateSiege`, `ZH.SIEGE` | `waves.test.js`; browser: ring spawns and SURROUNDED state |
| SIEGE meter in the HUD fills while standing, red and pulsing when surrounded | `index.html`, `ui.js`, `css/style.css` | browser: CLEAR → HOLDING → SURROUNDED |
| Every cleared wave pays `20 + 8×wave` scrap (× difficulty); wave 20 pays with the stage payout | `waveClearReward`, `game.js` | `waves.test.js` |
| Wave banner every fifth wave, siege warning, stage-clear banner, carried-run toast | `game.js`, `ui.js` | browser, live run |
| **60 cat callsigns** seed both boards and the offline fallback; server seed is idempotent | `js/roster.js`, `server/index.js`, `ledger.seed`, `net.js` | `waves.test.js`; `/api/leaderboard` returns 50 ranked rows |

**Why 60-second waves:** the stage's authored boss ladders run to 630 s and the
20-minute clock is the existing win. Twenty 60-second waves fit that window
exactly, so auto-advance triggers on wave 20 without skipping a single scripted
boss zone. Shorter waves would have cut content off the end of every stage.

## 16. Implemented in this pass — no passive healing, earned force field

| Change | Where | Verified by |
|---|---|---|
| Passive HP regeneration removed: survivor regen powers, the Energy Drink tick and the roadkill +2 are all gone | `Powers.update`, `updateSurvivor`, `game.js` | `shield.test.js`; browser: 5 s of updates left a probe at 50 HP |
| Universal 3% lifesteal default removed; only a lifesteal power returns health on damage | `damageEnemy` | tests + source |
| Force field arms only from an earned cell: every 40th kill and every boss, **150 s** | `ZH.SHIELD`, `SHIELD.killGiftEvery`, `shieldGiftDue` | `shield.test.js`; browser: 40th kill dropped a cell, pickup → 150 s |
| Bites, rolls, level-ups, car crashes and revives no longer arm a field | `entities.js`, `game.js` | browser: bite 100 → 88, shield stayed 0 |
| Gift boxes are earned every 30 kills instead of a 40 s timer | `game.js` | source; full suite |
| Energy Drink repurposed to 3–15% damage reduction (its regen tick is gone) | `weapons.js` | `sim.test.js` |

All 12 test files pass; browser ran BUILD 27 with `frameErrors: 0`. Lifesteal
is the one deliberate exception: those survivor powers still return health when
they deal damage, but nothing ticks health back on a timer.
