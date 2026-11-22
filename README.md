# MIDNIGHT VAULT — 3 nights, 3 guards, 2 cameras, 7 loot, 5-state guard AI, raycast vision cones, alarm meter — top-down heist stealth, offline

[![make.fun](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/people871/makefun-best-heist-game-20261122-0559/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/people871/makefun-best-heist-game-20261122-0559/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)

**MIDNIGHT VAULT** is an original top-down 2D heist stealth game: slip past patrolling guards and sweeping security cameras, crack the vault, pocket the loot, and reach the glowing green EXIT before the alarm locks the doors down. Every guard carries a raycast vision cone — yellow on patrol, red when chasing — and a graduated suspicion meter gives you a chance to break line of sight before you are SPOTTED.

## What is in the game

- **3 nights, one hand-built vault floor** — Night 1 The Quiet Gallery, Night 2 The Double Shift, Night 3 The Lockdown Crew. Guards get faster, suspicion fills faster, cameras sweep faster and the alarm decays slower each night. 7 loot in all per night (6 small gems + the vault's 500).
- **Guard AI with 5 states** — patrol → suspicious (a glimpse or a noise) → chase → search → return to patrol. Waypoint patrols with pauses and slow scans, a "?" when suspicious and "!" when chasing, a suspicion arc over each guard's head, and a 4-second memory of your last-known position.
- **Vision cones with line of sight** — each cone is a 13-ray fan that stops at walls, crates, desks and pillars, so cover reads exactly as it plays. Detection fills faster up close and centred; it drains when you break sight. Guards never see through walls.
- **Cover you can read at a glance** — dark shadow tiles shrink your visibility to 0.25; hiding vents hide you completely unless a guard is almost on top of you; crates, desks and pillars block sight and movement.
- **Hearing is positional** — walking is loud enough for a nearby guard to hear, sneaking is nearly silent, and a thrown coin (click or F, 3 per night) sends the nearest guard in earshot to investigate the landing spot. Noise alone never raises the alarm.
- **2 sweeping security cameras** — rotating cones with a blind spot; while one sees you the alarm climbs fast. Hold E at the power box to cut the nearest camera for 12 seconds.
- **One alarm meter, three bands** — 0–39 calm (green), 40–69 hunted (amber — guards move 20% faster), 70–100 lockdown (red — the exit seals for 5 seconds and a fourth guard spawns at the entrance). At 100 the run is not lost — lockdown is the punishment, not a game over.
- **Scoring and ratings** — 100 per gem, 500 for the vault, a time bonus, +500 for a GHOST clear (never spotted). Ratings: GHOST / SHADOW / LOUD. Best heist score in localStorage.
- **HUD + minimap** — night name and objective, a live alarm meter with its band, loot / coins / timer / score, and a minimap with guards, gems, vault and exit.
- **Synthesised sound only** — footsteps, coin clinks, alert stings, camera beeps, the vault crack, win jingle and a night drone, all WebAudio oscillators and filtered noise. No audio files. M to mute.
- **Pause (P/Esc), restart (R), back to title (L), pick a night (1/2/3)**. Win a night by cracking the vault (hold E, 2 s) or pocketing 4 loot, then reaching the EXIT. Get caught by a guard during a chase and the night is over.

## How to run it (offline, no build step)

```sh
node serve.ts
# open http://localhost:8080 — WASD/arrows to move, SHIFT to sneak,
# E to crack the vault / cut the power, click (or F) to throw a coin,
# P to pause, R to restart, L for the title screen
```

The game is vanilla JavaScript ES modules under `game/` — no dependencies, no network requests, no assets. Self-test: open `http://localhost:8080/?selftest=1` (34 scripted checks against the real rules).

## File map

| File | What it does |
|---|---|
| `game/src/config.js` | All tuning numbers, colours and the hand-built 40×21 vault floor |
| `game/src/random.js` | Seeded RNG (mulberry32) — same seed, same game |
| `game/src/level.js` | Tile queries, line of sight, raycasts, circle collision, BFS reachability |
| `game/src/guards.js` | Guard FSM (patrol / suspicious / chase / search), vision, hearing |
| `game/src/cameras.js` | Sweeping cameras, detection, disable timer |
| `game/src/world.js` | The rules: thief, loot, vault, power box, alarm bands, nights, scoring |
| `game/src/audio.js` | Synthesised WebAudio sounds, no audio files |
| `game/src/input.js` | Keyboard + mouse, one-shot action flags |
| `game/src/render.js` | Canvas drawing: room, cones, guards, cameras, HUD, minimap, screens |
| `game/src/shots.js` | The 4 staged screenshot scenes |
| `game/src/selftest.js` | 34 scripted checks against the real rules |
| `game/src/main.js` | Boot, fixed-step loop, screen machine, `?shot=` / `?selftest=` |
| `main.ts` | Hands game/ + screenshots/ to /output and writes dossier.json |
| `serve.ts` | Tiny static server for local play |
