# Newtonian Orbit Space Simulator

A browser game prototype built with Vite + React + TypeScript.

Current state: this is already a playable Newtonian-style spaceflight sandbox with trading, mining, contracts, upgrades, docking, interstellar warp jumps, local save/load, and two map layers:

- star-system flight map
- galaxy navigation map

The important truth today:

- local flight gameplay is real and already substantial
- galaxy navigation already uses a generated nearby-star HYG subset
- the decorative galaxy haze is still stylized, not astronomically accurate Milky Way structure
- the game still simulates one active star system at a time, not the whole galaxy at once

So the README below documents the true current state, not the original template story.

## What works today

Core gameplay already implemented:

- Newtonian-style ship movement with gravity, thrust, fuel burn, and battery drain/charge
- Kepler-based orbital positions for planets, moons, stations, and asteroids
- autopilot helpers:
  - match relative velocity
  - circularize orbit
- docking checks based on distance + relative velocity
- asteroid/moon mining
- market buy/sell loop
- ship upgrades
- mission/contracts panel
- interstellar warp map between star systems
- local save in browser `localStorage`
- theme switching for cockpit UI
- scanner-range star reveal logic in the galaxy map
- lazy creation of playable systems when a star is visited/targeted

Verified now:

- `npm run lint` works
- `npm run build` works

Build note:

- production build succeeds, but Vite warns that the main JS bundle is large (~2.5 MB before gzip warning threshold analysis)

## What is still fake / placeholder

Important so future work stays grounded:

1. Galaxy background is still decorative
   - `src/components/GalacticMap.tsx` draws stylized scanner haze / dust.
   - That visual layer is not real Milky Way topology.

2. Runtime star data is only a nearby subset
   - the game imports `src/data/generated/hyg-stars-near-sol-50ly.json`
   - this is far better than a fake handcrafted galaxy, but it is still only a nearby subset, not the whole HYG catalog

3. Star-system simulation is local, not galaxy-wide
   - active flight sim assumes the current star sits at local `(0, 0)` in its own system frame
   - that is correct for gameplay
   - it also means there is no full-galaxy physics simulation running in the background

4. Full HYG runtime integration is not done
   - `hyg_v42.csv` is source input for preprocessing
   - the browser game does not load the raw CSV directly
   - there is still no chunked whole-galaxy loader, spatial index, or full level-of-detail pipeline for all ~120k stars

5. Some repo/template leftovers remain
   - `package.json` still says `"name": "react-example"`
   - `@google/genai` dependency exists but is not part of the current game loop

## Real project structure

File tree as confirmed today:

```text
newtonian-orbit-space-simulator/
  README.md
  hyg_v42.csv
  index.html
  package-lock.json
  package.json
  tsconfig.json
  vite.config.ts
  src/
    App.tsx
    main.tsx
    types.ts
    components/
      ContractsPanel.tsx
      GalacticMap.tsx
      MarketPanel.tsx
      StarSystemCanvas.tsx
      UpgradesPanel.tsx
    data/
      stars.ts
      generated/
        hyg-stars-near-sol-50ly.json
    utils/
      gameData.ts
      physics.ts
  scripts/
    build_hyg_subset.py
```

Also present locally but not core source-of-truth code:

- `dist/` build output
- `node_modules/`
- `.hermes/` local agent planning notes

## What each important file does

### Root

- `package.json`
  - scripts and dependencies
  - Vite dev server runs on port 3000

- `hyg_v42.csv`
  - raw real star catalog source data
  - used offline as preprocessing input
  - not loaded directly by the browser game at runtime

- `scripts/build_hyg_subset.py`
  - preprocesses HYG CSV into a compact nearby-stars JSON subset
  - current output used by the game: `src/data/generated/hyg-stars-near-sol-50ly.json`
  - this is the right architecture direction: use real star metadata, not full raw CSV at runtime

- `vite.config.ts`
  - Vite config

- `tsconfig.json`
  - TypeScript config

### App entry

- `src/main.tsx`
  - React entry point

- `src/App.tsx`
  - main game shell
  - owns overall game state
  - game loop
  - local save/load
  - tab switching
  - autopilot state
  - docking/trading/mining/upgrade/contract actions
  - warp between stars

### Game data and rules

- `src/types.ts`
  - core TypeScript models for stars, bodies, ship, markets, contracts, and overall game state

- `src/data/stars.ts`
  - imports the generated HYG nearby-star subset
  - builds `GALAXY_STARS` from real nearby-star coordinates
  - keeps Sol special-cased with authored system bodies
  - lazily generates playable planetary systems for visited stars

- `src/utils/gameData.ts`
  - starting ship and player state
  - resource definitions
  - market generation
  - upgrades
  - initial contracts
  - in-game time formatting

- `src/utils/physics.ts`
  - orbital math
  - Kepler solver
  - body position calculations
  - sphere-of-influence logic
  - ship integration step
  - orbit metrics
  - route prediction

### UI panels

- `src/components/StarSystemCanvas.tsx`
  - local star-system map
  - planets, stations, asteroids, ship, projected path, and orbital visuals

- `src/components/GalacticMap.tsx`
  - galaxy view
  - star nodes
  - warp target selection
  - scanner-range filtering
  - decorative haze background layered over real nearby-star coordinates
  - this is the file most related to the “Sol in the center of the Milky Way” problem

- `src/components/MarketPanel.tsx`
  - docking, mining, cargo, buying, and selling

- `src/components/UpgradesPanel.tsx`
  - upgrade shop and ship stat display

- `src/components/ContractsPanel.tsx`
  - available contracts and completion logic

## How to run it

From the project folder:

```bash
npm install
npm run dev
```

Open the local Vite URL shown in terminal.

Other useful commands:

```bash
npm run lint
npm run build
npm run preview
npm run build:hyg-subset
```

## How the game currently thinks about space

There are really 2 coordinate layers.

### 1. Star-system layer
This is the playable flight sim.

- units: mostly meters
- current star is treated as local system center `(0, 0)`
- planets/moons/stations orbit inside that local frame
- ship physics is calculated here

### 2. Galaxy layer
This is the interstellar navigation / warp map.

- units: light years
- stars have `x/y/z` coordinates from the generated nearby-star HYG subset
- used for display, scanner range, and warp checks
- not a full galaxy simulation

That split is normal.

The real problem is visual honesty: decorative galaxy haze can still make the map feel like “the whole Milky Way”, while the actual data model is a nearby real-star subset plus one active local system at a time.

## Can the game use real data from `hyg_v42.csv`?

Yes.

But the right answer is not “load all 120k stars and simulate them all the time.”
That would be the wrong architecture.

## Practical answer

Best approach:

- use real HYG stars as a galaxy database
- do not simulate all of them physically
- only render and interact with a filtered subset near the player / scanner range / current zoom level
- keep star-system flight simulation local to one active system at a time

That matches both realism and performance.

Your idea is good:

- ship scanners should not reveal the whole galaxy
- the game should only reveal a radius around the current ship/system
- that radius can grow with upgrades

That is believable and technically sane.

## Recommended design for real star integration

### Use HYG for galaxy-scale metadata
For each star, keep lightweight data such as:

- id
- proper name if available
- spectral class
- brightness / magnitude if useful
- x/y/z position
- distance
- approximate display color

Do not generate full planetary systems for all stars at startup.

### Generate detailed systems lazily
Only when player targets or enters a star system:

- load that star’s metadata
- generate or load that system’s planets/stations
- keep ship physics local to that system only

Mental model:

- galaxy = atlas / database
- active system = detailed playable scene

### Use scanner radius / level of detail
Possible layers:

- short range: stars visible/selectable
- medium range: more stars visible with less info
- long range: faint density only
- unreachable stars: not interactable yet

That gives:

- real data source
- cheap runtime
- believable progression

### Preprocess CSV before runtime
Do not parse a ~34 MB CSV directly in the browser game.

Better:

1. convert CSV to a compact JSON or chunked format
2. strip unused columns
3. split by radius bands or 3D sectors if needed
4. load only needed chunks

Current first milestone is already in place:

- preprocess HYG into a smaller nearby-stars JSON
- current project uses `src/data/generated/hyg-stars-near-sol-50ly.json`
- next step is improving presentation, filtering, and expansion beyond that subset

## Recommended implementation path

Smallest safe path:

### Phase 1 — Make the galaxy map visually honest
- stop visually implying Sol is the center of the Milky Way
- keep the decorative background only if it clearly reads as scanner visualization
- otherwise remove it and keep a cleaner chart look

### Phase 2 — Expand the real subset pipeline
- keep preprocessing stars within a chosen radius from Sol
- current runtime subset is 50 light years
- next practical options are 100 ly, chunking, or region-based loading
- keep current warp gameplay rules

### Phase 3 — Deepen scanner-range gameplay
- base scanner range
- upgradeable scanner radius
- only show/select stars inside range
- maybe show weak unknown contacts beyond range

### Phase 4 — Generate/load systems on demand
- when entering a star, build its local planetary system
- keep full Newtonian simulation only for the current active system

## What I would not do

I would not:

- simulate gravity from all 120k stars
- create 120k full planetary systems at startup
- parse the raw CSV directly in the render loop
- pretend the decorative haze is “real galaxy structure”

## Good next tasks

Best next technical steps, in order:

1. make galaxy map visually honest
   - reduce or relabel decorative haze

2. improve the HYG importer pipeline
   - extract only useful columns
   - support different radii or chunk outputs

3. reduce legacy/manual star-data leftovers in `src/data/stars.ts`
   - keep Sol special-cased
   - keep imported subset as the galaxy truth source

4. deepen scanner-range filtering / UX in galaxy map
   - visible stars = stars inside scanner range
   - better affordances for reachable vs unreachable targets

5. only later think about chunking larger portions of the full catalog

## Dev notes for future work

If you work on galaxy realism, start here:

- `src/components/GalacticMap.tsx`
- `src/data/stars.ts`
- `src/types.ts`
- `scripts/build_hyg_subset.py`

If you work on flight/orbits, start here:

- `src/utils/physics.ts`
- `src/components/StarSystemCanvas.tsx`
- `src/App.tsx`

If you work on economy/progression, start here:

- `src/utils/gameData.ts`
- `src/components/MarketPanel.tsx`
- `src/components/UpgradesPanel.tsx`
- `src/components/ContractsPanel.tsx`

## Current honest summary

This project is already a solid playable prototype.

Truthfully, today it is:
- a Newtonian local-system space sandbox
- with a nearby real-star warp/navigation layer built from a generated HYG subset
- plus a stylized scanner-haze presentation on top

It is not yet:
- a full-galaxy HYG runtime
- a physically complete Milky Way model
- a whole-galaxy simulation with chunking/indexing/LOD across all ~120k stars

But yes: real star data is already useful here as navigational data, and the right next move is to deepen that approach instead of trying to simulate the whole galaxy at once.
