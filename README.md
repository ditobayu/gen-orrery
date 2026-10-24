# ORRERY//ONE

A cinematic Pomodoro machine for deep work. An animated celestial instrument measures focus, short breaks, and long breaks. Finished focus sessions become earned stars in a browser-local constellation vault.

## Run and verify

Requires Node.js 18+ and npm.

```sh
npm ci
npm run dev
```

```sh
npm test          # Timer engine tests, compatible with Node 18
npm run build    # TypeScript check and production bundle in dist/
npm run preview  # Serve the production bundle locally
```

## Using the instrument

Choose a mode, add an intention and an optional note, then begin. Pause, resume, reset, and skip are available beside the main control. Settings adjust all three durations, the number of focus sessions before a long break, sound, and reduced motion. Changes to an active or paused session's duration take effect after reset or on a subsequent session.

Completed focus windows add stars with their task, note, duration, and completion date. Skipping, resetting, or changing modes earns no star. Focus completion advances to the appropriate break; break completion returns to focus. Each next phase waits for you to begin it. The vault supports star selection, sky panning, zoom, statistics, and JSON export.

Sound starts muted. Enable it from the footer or settings; browser audio begins only after an interaction. Immersive mode removes secondary controls and requests browser fullscreen where supported.

| Key | Action |
| --- | --- |
| Space | Start, pause, or resume outside text fields and open chambers |
| F | Toggle immersive mode outside text fields and open chambers |
| Escape | Close a chamber or leave immersive mode |
| Arrow keys / Home / End | Navigate earned stars when a vault star has keyboard focus |

## Architecture and persistence

React and TypeScript run on Vite. `src/engine.ts` contains pure timer transitions and storage validation. `src/useMachine.ts` connects that engine to React, wall-clock updates, browser lifecycle events, and local storage. The deadline determines remaining time; interval ticks only refresh the display. An overdue session is completed once on return or refresh, with a stable session ID preventing duplicate stars.

`src/components/Orrery.tsx` renders the SVG instrument, `Starfield.tsx` supplies the canvas atmosphere, and `Chambers.tsx` contains settings, vault, and philosophy overlays. `src/useObservatoryAudio.ts` synthesizes the ambient sound and completion chimes with the Web Audio API.

The versioned key `orrery-one:v1` stores settings, the timer, task, note, and archive in `localStorage`. Tabs on the same origin exchange updates through browser storage events. There is no backend, account, or cloud synchronization. Data belongs to this browser and origin; clearing site data removes it. If storage is blocked or full, the current visit remains usable and the interface displays a persistence notice. Vault JSON export provides a downloadable copy of earned stars; there is no import interface.

## Hosting

Build with `npm run build`, then serve `dist/` from any static host. The application has a single page and needs no server routes or environment variables. Use a consistent origin so the browser keeps the same local archive between visits.
