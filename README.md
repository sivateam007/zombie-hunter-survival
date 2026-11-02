# Zombie Hunter: Survival 🧟

A complete top-down survival shooter in the spirit of GameSnacks' **Zombie Hunter: Survival**:
four chapters, fifteen hand-authored missions, boss fights, endless night, a permanent upgrade
economy and a persistent leaderboard.

Everything you see is drawn at runtime — **no sprite sheets, no image downloads, no licensed art**.
The hunter and every zombie are a small skeletal rig whose limbs are solved with two-bone inverse
kinematics each frame, so walking, aiming, reloading, reeling from a hit and dying are all real
animation rather than frame swaps. [anime.js](js/vendor/anime.min.js) drives every screen change,
card stagger, count-up and banner.

![chapters](https://img.shields.io/badge/chapters-4-ffb347)
![missions](https://img.shields.io/badge/missions-15-ffb347)
![bosses](https://img.shields.io/badge/bosses-4-e0492f)
![weapons](https://img.shields.io/badge/weapons-6-9be15d)
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

Touch-first, no keyboard needed. Everything is driven on screen:

| Input | Action |
| --- | --- |
| Thumbstick (bottom-left) | Move — your hunter aims where they walk |
| — | Weapons fire automatically |
| `ROLL` (bottom-right) | Combat roll (i-frames) |
| `RELOAD` (bottom-right) | Reload early; it also auto-reloads on an empty magazine |
| `II` (top-right) | Pause |

The thumbstick works with a finger or a mouse drag, so it plays the same on a phone and on a
desktop browser. The buttons use pointer events, so they respond to touch, mouse and pen alike.

---

## What is in the game

**Four chapters, fifteen missions, four bosses**

| # | Mission | Chapter | Boss |
| --- | --- | --- | --- |
| 1 | First Contact | Ashfall Streets | |
| 2 | Pharmacy Run | Ashfall Streets | |
| 3 | Alley Ambush | Ashfall Streets | |
| 4 | Rott | Ashfall Streets | **ROTT** — charges across the street |
| 5 | Loading Bay | Rust Meat Plant | |
| 6 | Kill Floor | Rust Meat Plant | |
| 7 | Cold Storage | Rust Meat Plant | |
| 8 | The Butcher | Rust Meat Plant | **THE BUTCHER** — ground slam, summons |
| 9 | Triage | Mercy Hospital | |
| 10 | Quarantine Ward | Mercy Hospital | |
| 11 | Morgue Lights | Mercy Hospital | |
| 12 | Matron | Mercy Hospital | **MATRON** — acid volleys, spitter summons |
| 13 | Stairwell | Rooftop Last Stand | |
| 14 | The Helipad | Rooftop Last Stand | |
| 15 | The Warden | Rooftop Last Stand | **THE WARDEN** — every trick at once |

**Six weapons**, each with its own feel, recoil kick, spread, pierce and sound: M9 sidearm,
Kestrel SMG, Marrow 12g, Vanguard AR, Longshot .338 and the Cinderthrower (which sets zombies
alight). Weapons unlock through mission milestones *and* can be bought early.

**Five zombie classes** plus bosses: walkers, sprinters, crawlers that drag themselves along the
floor, acid-spitting spitters, and brutes that soak damage. The horde steers around props,
separates from itself so it never turns into a single blob, and telegraphs every attack.

**Eight permanent upgrades** — damage, magazine size, reload speed, max health, movement, armour,
dash cooldown and scavenging — bought with scrap in the safehouse Arsenal. Prices escalate per
level and each upgrade has a visible pip track.

**Endless Night** — an endless escalating wave curve where every fifth wave is a boss. Your best
wave is submitted to the server leaderboard.

**Readability and feel** — bullet tracers, muzzle bloom, blood decals that stay on the ground,
rolling dash ghosts, hit markers, camera lead toward the aim, screen shake that can be turned off,
low-health vignette, warning rings before a boss ability, floating damage/scrap text and a
per-chapter colour grade.

---

## Project layout

```
index.html            markup for the HUD and every screen
css/style.css         presentation layer (dark industrial theme, responsive)
js/rig.js             skeletal character rig: IK limbs, poses, hunter + zombie art
js/arena.js           four procedurally generated chapters, cached to offscreen canvases
js/weapons.js         arsenal and upgrade tables
js/levels.js          chapters, 15 missions, wave data, bosses, endless curve
js/entities.js        player, zombie and boss AI, bullets, shockwaves, pickups
js/game.js            loop, camera, wave director, rendering, input, modes
js/ui.js              screens, shop, briefing, results, leaderboard, HUD
js/anim.js            anime.js motion helper
js/audio.js           synthesised WebAudio SFX and the ambient bed
js/storage.js         localStorage save, unlocks, upgrades, records
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
atomically to `data/leaderboard.json`. Static serving denies `server/`, `data/`, `test/` and any
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
