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
| Post-hit i-frames | 3 s | none — protection windows removed | ❌ removed | `TIME_INVINCIBLE=3000` | — |
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
| Miniboss soldier | 8-way ring | 8-way ring every 2.4 s | ✅ | 8 shot entries | `miniboss_soldier.pattern` |
| Miniboss tower | 8-way @450 ms cd | 8-way ring every 1.8 s | ✅ | shots array | `miniboss_tower.pattern` |
| Acid on death | 6 types, 1–3 s pools | acid pools (3/5/7 dmg) via `world.hazards` | ✅ | `deadshot` blocks | `damageEnemy` + hazard tick |
| Corpse split | slime2→2 slime1, slug→2 slime2 | implemented on death | ✅ | `deadspawn` | 2 children, 0.25 s spawn delay |
| Manager briefcase | destroyable 10-dmg projectile | rotating 20 hp briefcase drops on death, is shot down by bullets, hits for 10 | ✅ | `deadshot{frame:shot_briefcase}` | `ZH.updateBriefcases`, bullet collision |
| Mass shove | mass 1/2/5 pushes hunter | reptiles 1, bats/toxics 2, minibosses/bosses 5 push the hunter; fence-clamped | ✅ | `mass` values | `shoveHunter` |
| Miniboss HP | 2500–6000 | 2500–6000 (toxics corrected) | ✅ | table | `ENEMY_TYPES` |
| Miniboss drops | tower→1500 coin, toxic2→500 coin, spider→3-card chest | tower→1500, toxic2→500, spider→3-card chest | ✅ | `deaddrop` | `DROP_DATA` map |
| Static turrets | yes | yes | ✅ | `static:!0` | table |

## 6. Bosses and boss zones

| Feature | GameSnacks | Ours | Status | Check 1 | Check 2 |
|---|---|---|---|---|---|
| Boss count | 6 | 7 (`boss_fighter` extra) | 🟡 | `BossesData` | `ZH.BOSS_TYPES` |
| Boss HP | 7,500–10,000 | 8,000–14,000 | 🟡 | table | runtime |
| Scripted steps | 2–18 steps per boss | step counts and per-step durations now match the original behaviour lists (tower 9, reptile 5, soldier 8, dragon 2, spider 18, mutant 4) | ✅ | `behaviour[]` | `updateBossBehaviour` |
| Charge windup | 700/500 ms | 700/500 ms telegraphed lane, dash, recovery | ✅ | `duration[0]` | `BOSS_TYPES.behaviour` charge steps |
| Teleport | mutant, 1 s | 350 ms purple windup, 260 px reposition, clamped | ✅ | step 3 | `startBossStep` / `updateBossAct` |
| Summon adds | reptile 4, mutant 4, spider 3 | reptile 4, mutant 4, spider 3 as list steps | ✅ | `spawns[]` | `bossPattern` summon |
| 12-way tower ring | yes | 12-way ring and fan follow-up | ✅ | 12 shots | `boss_tower.behaviour` |
| Dragon stream | 10 shots @350 ms | 10 shots @120 ms plus a fan follow-up | ✅ | shots with delays | `boss_dragon.behaviour` |
| Spider egg mortar | r190, 20 dmg | marked arc, 190 px radius, 20 dmg, lands and explodes | ✅ | ATTACK steps | `spawnMortar` / `updateMortars` |
| Boss-zone **data** | rect 1000–3072 px | present, same sizes, 2 bosses in S4–S8 | ✅ | level JSON | `levels.js` + runtime |
| Boss-zone **enforcement** | fence, player confined, kill all mobs | fence drawn, player clamped, normal bodies cleared | ✅ | `BossZone` collision | `bossZoneFence` / `clearNonBosses` |
| Per-boss HP bars | one per boss | one bar per boss in the zone | ✅ | HUD | `pushHud` bosses array + ui.js |

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
| Magnet | pulls **gems only** | pulls gems only | ✅ | pickup code | `pk.pulling` loop (gems only) |
| Food | heals 100 | food drop heals 100 | ✅ | `BONUS_FOOD` | pickup branch + render |
| Medkit | heals `firstaid` | heals 45/60 | 🟡 | pickup code | values |
| Treasure cards | 1/3/5 cards | 1/3/5 supported; drops carry the count | 🟡 | `ShowSkillSlots(data)` | `showLevelUp(count)`; reroll still shared |
| Chest reroll | 1,500×(n+1), max 3 | chest 1,500×(n+1), max 3; level-up 500×n, max 5 | ✅ | `MAX_CHESTS_REROLLS` | `lu-reroll` + `G.luChest` |
| Level-up reroll | 500×(n+1) max 5 | same | ✅ | price helper | `ui.js` |
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

## 11. Still genuinely missing after this pass

| # | Missing system | Check 1 | Check 2 |
|---|---|---|---|
| 1 | Full 2–18-step fidelity | original step chains include roam and retreat segments | step counts and per-step durations now match the original behaviour lists for all six bosses (counts and timings pulled from the bundle); attack-kind fidelity for tower's cluster bomb (ATTACK3) still uses ring/fan steps |
| 2 | Spider poison-fan fragments | poison fan leaves a 10-dmg acid fragment | implemented as acid mortars that spawn 10-dmg acid pools (✅) |
| 3 | Per-boss HP bars | one bar per boss in the original | one shared HUD boss bar |
| 4 | Music beds | menu / run / boss tracks | no boss or menu bed wired |
| 5 | Rewarded ads and suspended runs | platform ad and snapshot services | not implemented |
| 6 | Gems-only magnet | `pullOnlyExps` behaviour | our magnet marks every drop |

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

**Still open after later passes:** full step-sequence fidelity (roam/retreat,
delayed volleys, poison fragments), per-boss HP bars, the music beds, rewarded
ads and suspended runs, and the gems-only magnet. The boss step interpreter,
arena fence, manager briefcase, heavy-body shove and chest-specific reroll sink
are now implemented; see §18–§19.

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

## 16. Implemented in this pass — no passive healing, no force field

| Change | Where | Verified by |
|---|---|---|
| Force field removed entirely: no shield clock, cell drops, pickup, HUD row, store upgrade, render ring or damage gate | `entities.js`, `game.js`, `ui.js`, `storage.js`, `index.html` | `sim.test.js` asserts `ZH.SHIELD`/`openShield` are gone; browser: no field row, bites land |
| Passive HP regeneration removed: survivor regen powers, the Energy Drink tick and the roadkill +2 are all gone | `Powers.update`, `updateSurvivor`, `game.js` | `sim.test.js`; browser: 5 s of updates left a probe at 50 HP |
| Universal 3% lifesteal default removed; only a lifesteal power returns health on damage | `damageEnemy` | tests + source |
| Every level-up card screen carries a **10 s auto-pick countdown** | `ui.js` `showLevelUpCard` | browser: timer counts down and auto-picks |
| Gift boxes are earned every 30 kills instead of a 40 s timer | `game.js` | source; full suite |
| Energy Drink repurposed to 3–15% damage reduction (its regen tick is gone) | `weapons.js` | `sim.test.js` |

All 11 test files pass; browser ran BUILD 30 with `frameErrors: 0`. Lifesteal
is the one deliberate exception: those survivor powers still return health when
they deal damage, but nothing ticks health back on a timer.

## 17. Ring reload

| Change | Where | Verified by |
|---|---|---|
| Manual reload and the primary gun's auto-reload spin up to six missing rounds around the hunter; tapping R/RELOAD seats the round in the notch, and four perfect seats arm a 5 s +20% damage HOT MAG | `ZH.RELOAD_RING`, `entities.js`, `Game.reload`, `autoFire`, player render | `reload.test.js`; browser: pips, seat, HOT MAG |
| Pause → RELOAD switches back to the old flat 60%-faster reload | `settings.ringReload`, `ui.js` | browser toggle |

All 12 test files pass; browser ran BUILD 31 with `frameErrors: 0`.

## 18. Boss parity pass

| Change | Where | Verified by |
|---|---|---|
| Boss zones seal visibly, clear every normal body on entry, and still clamp the hunter inside the rect | `Game.activateBossZone`, `bossZoneFence`, `ZH.clearNonBosses` | `boss.test.js`; browser |
| Bosses carry one readable signature pattern: 12-way tower ring, soldier fan, 10-shot dragon stream, reptile/mutant/spider summons | `BOSS_TYPES.pattern`, `bossPattern` | `boss.test.js` |
| Miniboss soldier and tower fire 8-way rings on their own clock | `ENEMY_TYPES.pattern` | `boss.test.js` |
| Chests keep the original's 1,500 × (n+1) reroll sink and three-reroll cap, separate from level-up rerolls | `ui.js` `luChest` | browser: `REROLL · 1500` |

All 13 test files pass; browser ran BUILD 32 with `frameErrors: 0`.

## 19. Boss behaviour, briefcase, shove and egg mortar

| Change | Where | Verified by |
|---|---|---|
| Bosses cycle multi-step lists instead of one repeating pattern: chase → charge / teleport / mortar / summon / ring / fan / stream → next step | `BOSS_TYPES.behaviour`, `updateBossBehaviour`, `startBossStep` | `boss.test.js`: every boss exposes a list and the old ring/fan/stream/summon steps remain |
| Charge has a 700/500 ms windup, a locked dash and a recovery; a dashed lane and growing ring draw during the windup | `updateBossAct`, `game.js` render | `boss.test.js`: windup phase, no movement, then dash; browser: 30 windup frames, `dashMoved: 72`, `chargeDashes: 1` |
| Mutant teleports 260 px after a 350 ms purple windup; the destination is clamped inside the boss-zone rect | `startBossStep`, `updateBossAct`, `clampInZone` | `boss.test.js`; browser: `teleported: true`, `teleportInFence: true` |
| Spider egg mortar is a lobbed projectile with a marked landing circle; it lands, bursts for 20 damage in a 190 px radius and leaves a shockwave | `spawnMortar`, `updateMortars`, `game.js` render | `boss.test.js`: still airborne at 0.45 s, booms at 1.25 s; browser: `midAir: 1`, `mortarBooms: 1`, HP 100 → 80 |
| Manager drops a rotating 20 hp briefcase; bullets damage it, 30 damage destroys it, and an unshot one deals 10 on contact | `damageEnemy`, `updateBriefcases`, projectile collision | `boss.test.js`; browser: 20 → 12 hp, destroyed, `briefcaseBreaks: 1` |
| Mass 1/2/5 bodies shove the hunter; bosses/minibosses use mass 5 and the shove is fence-clamped | `shoveHunter`, `mass` in enemy tables | `boss.test.js`: player displaced 28.6 px; browser: `shoveCount: 1`, `shoveDelta: -28.6` |
| Bosses stay clamped during a dash and teleport, and normal bodies are still cleared on zone entry | `clampInZone`, `activateBossZone` | browser: `fence: true`, `bosses: 2`, tower volley still 12 rounds |

Browser ran BUILD 33 with `frameErrors: 0`; the forced zone showed a telegraphed charge, a teleport, a landing mortar, a destroyed briefcase and a mass shove, with the tower's 12-way ring still intact.

**Still honestly missing:** exact per-boss step counts and timings, menu music bed (only run + boss beds exist), rewarded ads and suspended-run snapshots, and the gems-only magnet.

## 20. Boss roam, delayed volleys and poison fragments

| Change | Where | Verified by |
|---|---|---|
| Bosses run `roam` and `retreat` movement steps: roam wanders on a slowly rotating heading, retreat backs away from the hunter | `updateBossBehaviour`, `startBossStep` (`moveMode`) | probe: roam moved the boss; `boss.test.js` asserts the kinds exist |
| Soldier fires a delayed second volley 0.5 s after the first, five rounds each | `bossPattern` fan `volleys`/`volleyGap`, `fanQueue` tick | probe: 5 → 10 rounds over 0.67 s |
| Spider's poison fan is three acid mortars that land and leave 10-dmg acid pools instead of hitting directly | `spawnMortar` `acid` flag, `updateMortars` | probe: 3 mortars, 3 booms, 3 hazards; `boss.test.js` asserts an acid step |
| Acid hazards now tick damage over time and render on the street | `updateHazards`, `game.js` | source reviewed |

All 13 test files pass; cache-busting bumped to BUILD 35, entities v41, game v46.
