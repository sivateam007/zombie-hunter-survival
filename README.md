# Meow Zombie Hunter 🐱

A cat-eared top-down survival shooter in the classic horde-survivor genre:
eleven chapters, twenty hand-authored missions, boss fights, endless night, a permanent upgrade
economy and a persistent leaderboard.

Everything you see is drawn at runtime — **no sprite sheets, no image downloads, no licensed art**.
The hunter and every zombie are a small skeletal rig whose limbs are solved with two-bone inverse
kinematics each frame, so walking, aiming, reloading, reeling from a hit and dying are all real
animation rather than frame swaps. [anime.js](js/vendor/anime.min.js) drives every screen change,
card stagger, count-up and banner.

![chapters](https://img.shields.io/badge/chapters-11-ffb347)
![missions](https://img.shields.io/badge/missions-20-ffb347)
![boss types](https://img.shields.io/badge/boss%20types-6-e0492f)
![weapons](https://img.shields.io/badge/weapons-20-9be15d)
![districts](https://img.shields.io/badge/districts-25-6da8ff)
![deps](https://img.shields.io/badge/npm%20dependencies-0-8d9793)

---

## Play

```bash
npm start          # http://localhost:8080
```

No install step: the server is dependency-free Node, the client is plain ES5-era JavaScript
(it runs on old Android WebViews too) with anime.js vendored locally, so the game is fully
playable offline once loaded.

### Controls

Touch, keyboard or gamepad — whichever is in your hands:

| Input | Action |
| --- | --- |
| Thumbstick (bottom-left) | Move — the gun auto-aims at the nearest visible zombie |
| `WASD` / arrows | Move on a keyboard |
| Mouse | Aim — the pointer is the crosshair |
| Gamepad | Left stick moves, right stick aims, A flies, B rolls |
| — | Weapons fire automatically |
| `ROLL` / `Shift` | Combat roll (i-frames) |
| `RELOAD` / `R` | Reload early; it also auto-reloads on an empty magazine |
| `II` / `Esc` / `P` | Pause |

The thumbstick works with a finger or a mouse drag, so it plays the same on a phone and on a
desktop browser. The buttons use pointer events, so they respond to touch, mouse and pen alike,
and every input source can be blended mid-run without switching modes.

---

## What is in the game

**Eleven chapters, twenty missions, six boss types**

| # | Chapter | District | Boss zone |
| --- | --- | --- | --- |
| 1 | The Streets | Ashfall Streets | Soldier, Tower |
| 2 | The Streets | Palm Grove | Dragon, Reptile |
| 3 | The Factory | Rust Meat Plant | Mutant, Spider |
| 4 | The Factory | Freight Yards | Reptile, Dragon, Spider, Mutant |
| 5 | The Hospital | Mercy Hospital | Tower, Soldier, Reptile |
| 6 | The Rooftops | Rooftop Last Stand | Mutant, Soldier, Spider, Dragon |
| 7 | The Rooftops | Neon Downtown | Soldier, Dragon, Tower, Mutant |
| 8 | The Last Stand | Harbour Docks | Soldier, Tower, Spider, Reptile |
| 9 | Downtown | Galleria Plaza | Soldier, Tower |
| 10 | Downtown | Canal Quarter | Spider, Reptile |
| 11 | The Outskirts | Overgrown Park | Soldier, Spider |
| 12 | The Outskirts | Greyfield Airstrip | Soldier, Tower, Spider, Reptile |
| 13 | The Undercity | Metro Interchange | Soldier, Mutant, Tower |
| 14 | The Undercity | Freight Yards | Dragon, Spider, Reptile |
| 15 | The Last Mile | Overgrown Park | Tower, Soldier, Spider, Dragon |
| 16 | The Last Mile | Canal Quarter | Soldier, Mutant, Dragon, Tower, Spider, Reptile |

**Twenty weapons** across seven families — sidearm, SMG, shotgun, rifle, marksman rifle,
flamethrower and heavy explosives — each with its own recoil, spread, pierce and sound. The M9
sidearm, Kestrel SMG, Marrow 12g, Vanguard AR, Longshot .338, Rocket Launcher and Cinderthrower
are the first of each line. Rocket and grenade launchers evolve into Doomsday and Siegebreaker;
weapons unlock through mission milestones *and* can be bought early.

**Level-up timer** — every card screen carries a 10-second countdown; if it runs out the first
offer is auto-picked, so a run can never hang on the chooser.

**Jetpack** — hold the cyan JET button (or Space on a desktop) to fly. The fuel bar drains while
airborne and recharges on the ground; bites pass underneath while the jets are lit, but ranged
fire still connects.

**Five zombie classes** plus bosses: walkers, sprinters, crawlers that drag themselves along the
floor, acid-spitting spitters, and brutes that soak damage. The horde steers around props,
separates from itself so it never turns into a single blob, and telegraphs every attack.

**Six permanent skills** — power, health, armour, aid, fortune and learning — thirty levels
bought with scrap in the safehouse Arsenal. Prices escalate per level and each skill has a
visible pip track.

**Six survivors** — buy and equip a roster of hunters from the safehouse. Each has its own
palette and a small stat perk: speed, max vitals, scrap, damage, or a mix. The selected survivor
is applied to every new run after the permanent skills.

**Daily drops and redeem codes** — one scrap drop per day plus one-time codes (`SIVA1000`,
`ZOMBIEBUFF`, `GAMESNACKS`) entered in the store. Codes can also unlock survivors.

**No free healing** — health never ticks back up. Medkits, food and gift boxes are the only heals;
lifesteal survivor powers still return a share of the damage they deal.

**A living city** — multi-lane ambient traffic with headlights cruises the road districts, canal
chunks are crossed by several footbridges, and blocks carry more barricades, wrecks, crates,
containers and other roadside obstacles. Traffic and props are decorative and never alter zombie AI.

**Endless Night** — an endless escalating wave curve where every fifth wave is a boss. Your best
wave is submitted to the server leaderboard.

**Twenty-wave stages** — every stage is 20 waves of 60 seconds, the authored 20-minute survival
window. Clear wave 20 and the next stage deploys automatically with your level, XP, weapons and
supplies carried over, so a campaign is one continuous run rather than a trip back to the menu.

**Idle siege** — the HUD SIEGE meter fills while the hunter holds position. When it fills, groups of
zombies burst in from a full ring around the player, faster and tougher as the run goes on. Camping
is not a strategy here.

**A board with a crowd on it** — sixty cat callsigns seed the leaderboard on both the Node server
and the offline fallback, so a fresh install never opens onto a single line.

**Readability and feel** — bullet tracers, muzzle bloom, blood decals that stay on the ground,
rolling dash ghosts, hit markers, camera lead toward the aim, screen shake that can be turned off,
low-health vignette, warning rings before a boss ability, floating damage/scrap text and a
per-district colour grade.

---

## Project layout

```
index.html            markup for the HUD and every screen
css/style.css         presentation layer (dark industrial theme, responsive)
js/rig.js             skeletal character rig: IK limbs, poses, hunter + zombie art
js/arena.js           endless city districts with compatible neighbours, cached to offscreen canvases
js/weapons.js         arsenal and upgrade tables
js/levels.js          chapters, 12 missions, wave data, bosses, endless curve
js/entities.js        player, zombie and boss AI, bullets, shockwaves, pickups
js/game.js            loop, camera, wave director, rendering, input, modes
js/ui.js              screens, shop, briefing, results, leaderboard, HUD
js/anim.js            anime.js motion helper
js/audio.js           synthesised WebAudio SFX and the ambient bed
js/storage.js         localStorage save, unlocks, upgrades, records
js/roster.js          cat callsigns shared by the offline board and the server seed
js/net.js             leaderboard client with an offline fallback
js/main.js            bootstrap
server/index.js       static file server + leaderboard API (no dependencies)
server/ledger.js      JSON ledger with ranking, sanitising and atomic writes
test/                 campaign, simulation, save, ledger and HTTP integration tests
```

### How the characters are drawn

`ZH.Rig.draw()` receives a world position, a facing, an aim angle and a pose. It:

1. plants both feet with a sine-driven stride and re-solves the legs through 2-bone IK, so the
   knees bend instead of the whole leg rotating;
2. solves the trigger arm and the support arm toward the weapon grip (the support hand dives to
   the magazine well while reloading);
3. draws tapered capsule limbs, then the torso, head and weapon, with a shadow under the feet.

Poses blend continuously: `moving`, `walkPhase`, `recoil`, `reload`, `hurt`, `dead`, `crouch`.
Crawlers add a ground-hugging rotation, spitters get a glowing acid gut, bosses grow bone spurs.

---

## Server and leaderboard

`server/index.js` is a single Node process (Node 18+) with **no npm dependencies**:

* `GET /api/health` — Render health check
* `GET /api/leaderboard?mode=endless|campaign` — top 50
* `POST /api/score` — `{ name, mode, wave, kills, score }`

Rows are validated, clamped, deduped per callsign (best run wins), capped per mode and written
atomically to `data/leaderboard.json`. On startup the server seeds the sixty cat callsigns from
`js/roster.js` (idempotent, best run kept); `SEED_BOARD=off` disables it for isolated testing. Static serving denies `server/`, `data/`, `test/` and any
dotfile, blocks path traversal, and revalidates code on every load so a deploy can never serve a
stale build. If the API is unreachable the client falls back to your local record.

```bash
npm test
```

runs the campaign-data checks, a headless simulation (zombie approach, shooting, reload, dash
i-frames, pickups, separation, armour), the save/purchase maths, the ledger ranking and a real
HTTP integration test that boots the server, checks static routes, the traversal guard and two
score submissions.

---

## Deploying to Render

`render.yaml` is ready to go:

1. push this folder to a Git repository;
2. in Render choose **New → Blueprint** and point it at the repo (or create a Web Service with
   `Runtime: Node`, build `echo no deps`, start `node server/index.js`, health check `/api/health`);
3. Render sets `PORT` automatically; the server listens on it.

**Persistence note:** on Render's free plan the filesystem is ephemeral, so the leaderboard resets
when the instance redeploys. For a board that survives restarts, attach a Render **disk** (paid
plans) mounted at `/data` and set `DATA_FILE=/data/leaderboard.json`. Everything else — progress,
coins, upgrades — lives in the player's browser (`localStorage`), so gameplay is never lost.

Environment variables the server understands:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | set by Render |
| `HOST` | `0.0.0.0` | bind address |
| `DATA_FILE` | `data/leaderboard.json` | where scores are stored |
| `LOG_REQUESTS` | off | set to `1` for request logging |

---

## Notes on originality

This is an original implementation of a well-worn genre, not a port: the mission list, wave
composition, boss behaviours, weapon stats, economy, UI and all artwork were authored for this
project. The only third-party code is anime.js 3.2.2 (MIT), vendored in `js/vendor/`.

Built for the QSP Boys.
