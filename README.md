# Sky Courier — Island Run

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/jesky1/makefun-flight-game-20261126/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/jesky1/makefun-flight-game-20261126/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**Sky Courier** is a flight game that runs in a desktop browser from static files,
with no network request. You fly a little orange courier plane in chase view over
a painted island archipelago — sea, beaches, forest islands, a city grid and a
runway — with the aircraft in frame, the instruments lit, and altitude, speed and
heading on the HUD. Thread all six target rings, then put the plane down on the
runway for the landing bonus. Too slow and the wing stalls; the ground is not a
suggestion.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Or open `game/index.html` directly from the files — the game needs nothing else.

## How to play

- **← → or A / D** — bank and turn
- **↑ ↓ or W / S** — pitch (push forward: nose down, pull back: nose up)
- **Mouse** — steer by pointing where you want the nose to go
- **SHIFT** — throttle up, **CTRL** — throttle down
- **SPACE / click** — start, **P** — pause

Fly through a ring: **+100 pts and +12 s**. Land on the runway after the last
ring: **+500**. You have 4 minutes on the clock; each ring buys you 12 more
seconds. The best score is kept in the browser.

## What is in here

- `game/` — the playable game: `index.html`, `styles.css` and `src/` (config,
  random, world, input, render, shots, main), plain ES modules, no library.
- `main.ts` — the entrypoint (Node 22): copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json` with the vendored make.fun library.
- `screenshots/` — four real renders of the game's own code: title, mid-flight,
  rings, and final approach.
- `vendor/makefun-game.ts` — the kit's copy, unchanged.
- `shots.json` — the four screenshot scenes (`?shot=title|play|rings|land`).

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
