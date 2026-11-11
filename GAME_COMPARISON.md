# GameSnacks “Zombie Hunter SURVIVAL” vs Meow Zombie Hunter — corrected comparison

Original facts come from the shipped bundle `zh_orig_src/js_game.js` (build 1.0.1,
05.09.2023) plus the eight parsed stage files in `zh_orig_assets/extracted_levels/`.
The complete evidence table is in **[GAMESNACKS_FULL_ANALYSIS.md](GAMESNACKS_FULL_ANALYSIS.md)**;
the raw extracts are in `analysis/orig_0*.txt`.

Legend: **✅ done**, **🟡 partial**, **❌ missing**.

---

## 1. Core loop

| Aspect | GameSnacks | Ours | Status |
|---|---|---|---|
| Genre | Arena survivor, move = aim, auto-fire | Same | ✅ |
| Win condition | Survive **1,200,000 ms** (20 min) | Same 1,200 s | ✅ |
| Victory delay | `DELAY_GAME_WON = 5,000 ms` hold | Results screen immediately | ❌ |
| Difficulty | NORMAL / HARD (×2 HP+dmg, ×1.15 speed) / INSANE (×4, ×1.5) | Same three tiers | ✅ |
| Continues | `2,500 × n`, max **2** | Same | ✅ |
| Stage unlock | previous stage record ≥ 20 min | same record gate | ✅ |
| Music | 3 beds (`music_menu`, `music_ingame`, `music_boss`) | SFX only | ❌ |

## 2. Controls

| Aspect | GameSnacks | Ours | Status |
|---|---|---|---|
| Movement | Analog stick + WASD/arrows, dead zone `radius3`, speed 0.3 px/ms | Same, plus gamepad | ✅ |
| Aim | Walk direction; Gun/Drill/Tesla/Bazooka/Boomerang auto-target nearest | Same + optional mouse aim | ✅ |
| Fire | Automatic | Automatic | ✅ |
| Ammo | **none — no magazine, no reload anywhere in the bundle** | magazine + auto reload | ✅ ours adds |
| Manual reload | n/a | R / gamepad X / RELOAD button, 60 % of auto time, works on a partial mag | ✅ ours adds |
| Dash | none | Shift/B combat roll, 0.35 s i-frames | ✅ ours adds |
| Jetpack | none | hold to fly: ignition fee, kick, dry-tank lock, no recharge while held | ✅ ours adds |

## 3. Weapons

Original: **14 base weapons, 14 evolutions**, five selectable primaries
(Axe, Flamethrower, Crossbow, Gun, Sword). Every evolution needs `level > 5`
**and** its paired supply. Ours registers **40 weapons = 20 base + 20 evolved**.

| Weapon (→ evo, supply) | Original numbers | Ours | Status |
|---|---|---|---|
| Axe → Battleaxe (Supplements) | cd 2500, dmg 5×atk, radius 80→120 (200 evo) | ✅ orbit axes | ✅ |
| Crossbow → Shotgun (ActionGloves) | cd 1500, fan + pierce, range 300, count scales with level | ✅ fan + pierce | ✅ |
| Flamethrower → Plasmagun (Handbook) | cd 2000, 100 ms stream, 1/2/3/10 targets | ✅ | ✅ |
| Gun → Uzi (AmmoBooster) | cd 1000, burst `level+1` @150 ms, auto-target | ✅ | ✅ |
| Sword → Scimitars (Kevlar) | cd 500, range 250×scale, evo hits behind | ✅ | ✅ |
| Drill → Lasergun (Scope) | cd 2000, 250 ms burst, 1/2/3, speed 100→400 | ✅ | ✅ |
| Bazooka → Nuke (Propane) | cd 2000, blast 100→200, dmg ×2…×8 | ✅ | ✅ |
| Boomerang → Neckbreaker (Magnet) | cd 3000, 1→2 blades, life 2500 | ✅ returns | ✅ |
| Circular → Ripper (Chronometer) | cd 8000, 2→7 saws, radius 100→220, eats shots | ✅ | ✅ |
| Tesla → Thunderorb (ActionGloves) | cd 2500, chain radius 50→200 | ✅ | ✅ |
| SpikedBall → Biliard (Sneakers) | cd 3000, 1/2/3 balls, bounce 3, evo 8-way | ✅ | ✅ |
| Forcefield → Domain (EnergyDrink) | 350 ms tick (150 evo), radius 60→100, eats shots | ✅ | ✅ |
| Launcher → Airstrike (AmmoBooster) | cd 8000, 25/50/100 rockets, evo 10 screen strikes | ✅ | ✅ |
| Molotov → Canister (Detector) | cd 3000, `level+1` bottles, radius 70→180 | ✅ | ✅ |
| Extra ours | — | rocket launcher, grenade launcher, sniper, railgun, katana, nodachi… | ✅ ours adds |

## 4. Supplies

Original: **12 passives, 5 levels each**, offered as cards, never floor drops:
Kevlar (defense 10/20/30/40/50), AmmoBooster (`attack_bonus` .1–.5),
Handbook (`exp_bonus` 8–40), Scope, Propane, Magnet, Chronometer, EnergyDrink,
ActionGloves, Sneakers, Detector, Supplements.
Ours: **14** passives at 5 levels (the original's 12 plus two extras) and coin skills. ✅

## 5. Enemies and bosses

Original roster: **28 combat types** — 4 zombies, tower1/2, reptile, cop, bat,
builder, spider1/2, toxic1/2, slime1/2, slug, assault1/2, manager, and 8 minibosses —
plus `box` and `treasure` as non-combat entries. **Bosses: 6**
(tower 10,000 HP · reptile 8,000 · soldier 9,000 · dragon 7,500 · spider 8,500 ·
mutant 9,500).
Ours: the same 28-type roster; **7 bosses** with 8,000–14,000 HP, including
`boss_fighter`, which the original does not have. 🟡 roster parity, boss numbers differ.

| Original behaviour | Ours | Status |
|---|---|---|
| Boss behaviour lists: chase / charge with 700 ms windup / roam / retreat / teleport / spawn adds | bosses walk at you | ❌ **largest gap** |
| Timed boss patterns: 12-way rings, delayed second volleys, 10-shot streams @350 ms, egg mortars (radius 190), poison fans, grenades | one straight shot each | ❌ |
| Boss-zone fence: 80 px grid rect, **1,000–3,072 px** (stage 7–8 largest), player collides, **all normal enemies killed at the boss**, player moved inside; stages 4–8 send **two bosses per zone** | timer freeze only; you can walk out | ❌ |
| Per-boss HP bars + boss music | single HUD bar, no music | 🟡 |
| `deadshot` on death: acid pools (toxic1/2, slime1/2, miniboss toxins), manager's destroyable briefcase (10 dmg) | none | ❌ |
| `deadspawn`: slime2 → 2× slime1, slug → 2× slime2 | none | ❌ |
| Per-shot `angleInc` tables: assault1 3 staggered shots (2.5/2.8/3.1 s), assault2 ±20° fan, miniboss_soldier 8-way, miniboss_tower 8-way @450 ms | single spread value | 🟡 |
| Miniboss deaddrops (bomb / medkit / magnet / chest / 500–1500 coins) | ✅ per type | ✅ |
| Collision `mass` 1/2/5 shoving the hunter | enemy separation only, no player shove | 🟡 |
| Static turrets (tower1/2, miniboss_tower) | ✅ | ✅ |
| Far-body recycling at the `MAX_ENEMIES = 500` / wave `max` cap | leash teleport | 🟡 different approach |

## 6. Pickups

| Pickup | Original | Ours | Status |
|---|---|---|---|
| Exp gems | ✅, magnet pulls **gems only** | ✅, magnet marks every drop | 🟡 |
| Coins | 300 / 500 / 1,000 / 1,500 sprites | ✅ | ✅ |
| Medikit | heals `firstaid` attribute | ✅ | ✅ |
| Food | heals **100** flat | none | ❌ |
| Bomb | `10 × attack` damage in a **900 px** radius + shake | kills all normal bodies, chips bosses 8 %, white flash | 🟡 different formula |
| Treasure chest | opens **1, 3 or 5 cards** (`ShowSkillSlots(data)`), reroll `1,500 × (n+1)`, max 3 | always 3 cards, shared 5-reroll sink | ❌ |
| Magnet / gift box | magnet yes, others no | magnet pickup + gift boxes every 30 kills; force field removed | ➖ |

## 7. Progression and meta

| Aspect | Original | Ours | Status |
|---|---|---|---|
| XP curve | `floor(1000 × 1.25^(level−1))`; gains `3 × floor(v + v·exp% + v·learning%)` | Same formula | ✅ |
| Level-up | pauses scene, 3 cards, reroll `500 × (n+1)`, max 5 | Same, max 5 | ✅ |
| Meta skills | POWER/HEALTH/ARMOR/AID/FORTUNE/LEARNING, max 30, price ladder to 435,000 | Same six, same curve | ✅ |
| Stages | **8**, waves 33/35/36/43/43/53/66/61, 2 boss zones each, ladder ends at 630 s, run to 1,200 s | 20 stages, mirrored ladders for 1–7 plus a 30-wave stage 8 and endless; each stage is 20 × 60 s waves and clears into the next automatically | ✅ ours extends |
| Missions | **15 entries** (13 tracked types incl. daily login/ad-watch/kills/bosses/survive/spend/earn/exp/damage/heal/crates, plus the 4- and 10-mission chains), 3 active per cycle with ×2/×4 reward tiers | 6 slots on the same table, ×2/×4 tiers, 24 h refresh, chains | ✅ |
| Idle coffer | 25 coins / 15 min, cap 168 h = 16,800; a fresh save starts at **+158 h** | same curve; +158 h start is worth 1,000 coins | ✅ |
| Characters | one hunter | 35 rigged survivors with powers | ✅ ours adds |
| Store / daily / codes / leaderboard | GameSnacks service only | ours + local leaderboard with sanitising | ✅ ours adds |

## 8. Waves and pacing

| Aspect | Original | Ours | Status |
|---|---|---|---|
| Wave record | `{enemy, freq, max, startTime, duration, bosses, bossZone}` | same shape | ✅ |
| Cadence | LOW 700 / MID 350 / HI 100 ms | 1.25 / 0.8 / 0.5 s at medium, ramping; first 2 min unchanged | 🟡 deliberately lighter |
| Concurrency | up to wave `max` (as high as 300), `MAX_ENEMIES = 500` | 6→27 near / 22→88 hard by minute 20 | 🟡 deliberate |
| Pre-boss warning | 3 s `INCOMING_BOSS` / `INCOMING_MINIBOSS` banner | ✅ 3 s WARNING + red flash + audio | ✅ |
| Boss escort | all non-boss waves frozen while bosses live | escort grows 2 → 10 | 🟡 ours adds enemies |
| Treasure | box every **15 s** at the screen edge | same | ✅ |
| Stage progression | one stage per run, back to the menu | clear wave 20, next stage auto-deploys with the run carried over | ✅ ours adds |
| Idle pressure | none | standing still fills a siege meter, then bursts of tougher zombies ring the player | ✅ ours adds |
| Wave clear | none | `20 + 8×wave` scrap per cleared wave, multiplied by difficulty | ✅ ours adds |
| Board population | platform score service | 60 seeded cat callsigns + real submissions | ✅ ours adds |

## 9. Presentation

| Aspect | Original | Ours | Status |
|---|---|---|---|
| Resolution | portrait 790×1300 (max height 1700) | responsive full-screen | 🟡 different layout |
| Hit feedback | flash + blood sprites | flash, knockback, damage numbers, sparks, decals | ✅ ours richer |
| Blast feedback | explosion animation | additive light + shockwave ring | ✅ |
| Damage screen | red flash | edge pulse + low-HP pulse + bomb whiteout | ✅ |
| Audio | 38 sounds incl. 3 music tracks | per-weapon/event SFX | 🟡 no music |

---

## 10. Ranked gaps

1. **Scripted boss AI** — charge/teleport/spawn-adds behaviour lists and timed volleys.
2. **Boss-zone geometry** — 80 px fence, kill-all-at-boss, player confined.
3. **`deadshot` + `deadspawn`** — acid pools on six enemy types, the manager's briefcase, slime/slug corpse splits.
4. **Chest card counts (1/3/5) and the 1,500-based chest reroll sink.**
5. **Food pickup** and the real bomb formula (`10 × attack`, 900 px).
6. **Magnet = gems only**, and **player shove from `mass` bodies**.
7. **Three distinct music tracks** — we start one bed.

## 11. Where we are ahead

Manual tactical reload and magazines, dash with i-frames, jetpack, 20 base weapons
(vs 14), 35 survivors with unique powers, store/characters/upgrades, daily rewards,
redeem codes, prestige roster, 20 stages + endless mode, 19-district endless city with
weather, local leaderboard with sanitising, and the full hit/knockback/shockwave/
vignette feedback layer.
