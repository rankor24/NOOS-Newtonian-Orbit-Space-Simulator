# Newtonian Orbit Space Simulator

Playable 2D spaceflight sandbox in React + TypeScript.

The project has moved past prototype-only flight. Core Newtonian flight, summed gravity,
orbit-aware targeting, docking flow, progression shell, contracts, mining, trading,
ship ownership, and cockpit HUD performance work are all live enough to build more
content on top.

## Current state

What is real now:

- Newtonian local-system flight with thrust, gravity, autopilot assists, and docking
- real-feeling Sol data pipeline plus nearby-star interstellar layer
- commander profiles, save/load, autosave, owned ships, shipyard, contracts
- Elite-inspired cockpit HUD and map-driven play loop
- recent performance work that made flight much more playable

What is still unsettled:

- long-term interstellar design direction
- economy/progression depth beyond the current first pass
- onboarding/tutorial mission flow
- content density and mission variety

Recent commits that changed the active baseline:

- `790586b` orbit reference handling fix
- `d52b2e7` sim loop decoupled from React for performance
- `43d0a47` HUD-aware camera viewport
- `db26e1d` docking and progression hooks pass
- `ed897a6` control tooltips
- `64827cc` ship sprite LOD, warp-down, docking rebalance

## Read this first

Primary project docs:

- `docs/plans/2026-06-10-improvement-and-rework-plan.md`
  - current audit of what is implemented, broken, undecided, and next
- `docs/plans/2026-06-10-core-flight-mechanics-rework.md`
  - flight model and handling direction
- `docs/plans/2026-05-28-game-spine-progression-plan.md`
  - earlier progression spine plan; parts are already implemented

If you only read one file before making feature decisions, read:
`docs/plans/2026-06-10-improvement-and-rework-plan.md`

## Suggested next content

Now that flight and performance are playable, the highest-value next layer is content
that teaches players how to use the ship while exercising existing systems.

Good near-term additions:

1. Optional tutorial mission: undock, orient, accelerate, match speed, dock
2. Guided early route: Earth orbit or station to Luna
3. Slightly bigger tutorial chain: nearest station delivery or passenger hop
4. More contract variety around current mechanics before expanding systems

Recommended tutorial shape:

- keep it optional
- use real existing controls, not special tutorial-only rules
- reward first successful docking / first transfer / first contract completion
- prefer Earth-to-Moon or nearest station over long exposition

## Project layout

```text
newtonian-orbit-space-simulator/
  README.md
  package.json
  src/
    App.tsx
    app/systems/
    components/
    data/
      generated/
    utils/
  docs/
    plans/
    research/
    svg/
  scripts/
```

Important files and folders:

- `src/App.tsx`
  - main game shell, top-level state, action wiring
- `src/components/StarSystemCanvas.tsx`
  - star-system rendering and navigation view
- `src/components/EliteCockpitHud.tsx`
  - cockpit HUD, panels, flight readouts
- `src/components/MainMenu.tsx`
  - commander profile flow and game start
- `src/data/stars.ts`
  - star catalog and system generation entry point
- `src/data/generated/`
  - generated Sol and nearby-star runtime data
- `src/utils/physics.ts`
  - gravity, orbital math, ship integration, cargo mass helpers
- `src/utils/spaceFlightAutopilot.ts`
  - flight guidance and approach behavior
- `src/utils/saveSystem.ts`
  - save slots, commander profiles, autosave lifecycle
- `src/utils/progression.ts`
  - XP/progression helpers
- `scripts/`
  - data-build and verification scripts

## Run

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm run lint
npm run build
npm run test:autopilot
npm run test:rails
npm run build:hyg-subset
```

## Development notes

- Source of truth is the React project in this repo.
- Prefer inspecting plan docs before changing core direction.
- Reuse existing flight, HUD, and progression systems before inventing replacements.
- For new content, bias toward missions/contracts/tutorials that sit on top of the
  now-playable flight loop instead of adding another unfinished system.
