# Noss Game Spine / Progression Implementation Plan

> For Hermes: use this as the source-of-truth roadmap for turning Noss from a flight/economy simulation into an actual game loop.

Goal: add the minimum game-plumbing that creates persistence, progression, ship management, and meaningful logistics so Noss becomes a game instead of only a simulation.

Architecture: keep the current single-app React state architecture, but introduce a small set of explicit game-domain systems inside the existing TypeScript model: commander profiles/save lifecycle, player progression, persistent ship ownership, and logistics constraints. Defer living-traffic/highway simulation until the core play loops are working.

Tech Stack: React, TypeScript, current local state model in `src/App.tsx`, `src/types.ts`, `src/utils/gameData.ts`, browser localStorage persistence.

---

## Current Reality Audit

Based on real code as of 2026-05-28:

- `src/App.tsx`
  - already loads one save blob from `localStorage.getItem("newtonian_orbit_save")`
  - already autosaves full `gameState` back to localStorage on every state change
  - has no explicit save slots, no manual save, no save metadata, no new-game flow, no delete/reset flow
- `src/utils/gameData.ts`
  - builds initial state with credits, ship, contracts, markets
  - no player progression object
  - no commander profile data
- `src/types.ts`
  - has `GameState`, `ShipState`, `SpaceContract`, etc.
  - no `PlayerProfile`, no XP tracks, no reputation, no owned-ship roster, no save metadata
- `src/App.tsx`
  - `unlockedUpgrades` is a separate React state array instead of saved `GameState`
  - this is the first thing that should be fixed before deeper progression work
- `src/types.ts`
  - `ShipState` currently has one scalar `cargoCapacity`, one `fuelLevel`, one `maxFuel`
  - this is enough for a starter loop, but not enough for meaningful transport/refuel/specialization gameplay
- `src/utils/gameData.ts`
  - current upgrade system mutates the one active ship directly
  - there is no concept of owned hulls, stored hulls, active hull selection, or shipyard inventory progression

Conclusion: the project does not need more content first. It needs a durable gameplay state model.

---

## Reprioritized Near-Term Scope

Do these now:

1. Save lifecycle and commander identity
2. Player progression core
3. Ship improvement / ownership / management
4. Cargo, mass, fuel, and refueling logistics

Explicitly postpone for later:
- space highways
- ambient traffic lanes
- patrol/pirate/tanker traffic systems
- lane-based encounters

Reason:
- until mining, transport, refueling, upgrading, and progression are satisfying, highways are mostly visual dressing
- the game first needs reasons to earn credits, upgrade ships, and make route decisions

---

## Recommended Build Order

### Phase 1 — Save lifecycle and commander identity
Must come first. Without this, the rest of the systems feel temporary and migration pain compounds.

Build:
- new game
- load game
- delete/reset game
- commander profile metadata
- explicit save schema versioning
- move all progression-critical state into `GameState`

### Phase 2 — Player progression core
This is the real “game spine”.

Build:
- career XP buckets
- commander level summary
- statistics/counters
- unlock thresholds
- faction/issuer reputation

### Phase 3 — Ship improvement and management
This makes money matter and creates mid-term goals.

Build:
- persistent upgrade ownership
- persistent installed module state
- owned ships roster
- active ship switching at shipyards
- module-based ship specialization

### Phase 4 — Logistics: cargo, transport, mass, fuel, refueling
This makes travel and economic play actually interesting.

Build:
- cargo classes / capacity partitions
- passenger/transport pods
- cargo mass consequences
- explicit refueling interactions
- stronger route planning pressure

---

## Strong Design Opinions

### 1. Save system: profile-first, not single-blob-first
Recommendation:
- keep localStorage for now
- wrap saves in commander profiles instead of one anonymous blob
- include metadata:
  - commander name
  - createdAt / updatedAt
  - playtime
  - current star/body/port
  - credits
  - commander level summary
  - active ship name/model

Do not build cloud sync now.

### 2. Progression: track-based XP, not one flat number
Recommendation:
- use separate XP tracks plus a derived overall commander rating
- tracks:
  - Mining
  - Trade
  - Exploration
  - Operations
  - Security

Why:
- Noss already wants multiple careers
- one flat XP bar hides what the player is actually becoming good at

### 3. Research tree: postpone full research system
Recommendation:
- begin with unlock thresholds, not a complex research tree
- unlocks should come from:
  - track rank thresholds
  - reputation thresholds
  - port/shipyard access

Research can come later if the game proves it needs a longer strategic layer.

### 4. Ships: owned assets, not one mutable blob forever
Recommendation:
- convert current one-ship model into:
  - `ownedShips[]`
  - `activeShipId`
- each ship should persist:
  - hull id/model
  - name/callsign
  - installed modules/upgrades
  - cargo layout
  - passenger pod layout
  - fuel state
  - location

### 5. Cargo and fuel: move from one scalar toward simple module-driven constraints
Recommendation:
- keep it readable, not spreadsheet hell
- first useful split:
  - commodity cargo capacity
  - passenger berth capacity
  - fuel tank capacity
  - utility/module slots
- tie mass to handling and range carefully, but don’t overcomplicate the first pass

---

## Implementation Plan by Phase

## Phase 1: Commander Profiles and Real Save Lifecycle

Objective: make the game feel owned, restartable, and persistent.

Files likely involved:
- Modify: `src/types.ts`
- Modify: `src/App.tsx`
- Modify: `src/utils/gameData.ts`
- Create: `src/utils/saveSystem.ts`
- Create: `src/components/ProfilePanel.tsx` or `src/components/CommanderMenu.tsx`

### Required data-model changes

Add save/profile types such as:
- `saveVersion`
- `CommanderProfile`
- `CommanderProfileSummary`
- `SaveSlotIndex` or profile registry

Add to `GameState` immediately:
- `saveVersion`
- `commanderName`
- `unlockedUpgradeIds`

This is the minimum viable foundation.

### Tasks

1. Create save schema constants and profile storage keys
2. Create save/load helpers in `src/utils/saveSystem.ts`
3. Migrate current raw single-save behavior into the helper layer
4. Add backward-compat loader for existing `newtonian_orbit_save`
5. Move `unlockedUpgrades` from React component state into `GameState`
6. Add `createNewGameState(commanderName?: string)` instead of anonymous starter state only
7. Add simple UI actions:
   - New Game
   - Load Commander
   - Delete Commander
8. Add profile metadata summary rendering

### Verification

- existing single-save users still load successfully
- create a new commander
- reload page
- load same commander with same credits/ship/logs/upgrades
- create second commander
- switch between profiles with no state bleed
- `npm run lint`
- `npm run build`

---

## Phase 2: Player Progression Core

Objective: make actions produce permanent, legible progress.

Files likely involved:
- Modify: `src/types.ts`
- Modify: `src/utils/gameData.ts`
- Modify: `src/App.tsx`
- Create: `src/utils/progression.ts`
- Create: `src/components/CommanderPanel.tsx`

### Required data-model changes

Add types for:
- `CareerTrackId`
- `CareerProgress`
- `CommanderStats`
- `FactionReputationMap`
- `PlayerProfile`

Suggested first profile shape:
- `name`
- `totalPlayTimeSec`
- `overallLevel`
- `careerXp`
- `careerRanks`
- `stats`
- `reputation`

Suggested initial stats counters:
- `tonsMined`
- `tonsBought`
- `tonsSold`
- `tradeProfit`
- `contractsCompleted`
- `bodiesScanned`
- `starsVisited`
- `dockingCount`
- `kills` (safe to start at 0)

### First XP hooks

Award XP from actual game actions:
- Mining XP from mined tonnage
- Trade XP from realized profitable sales, not just purchases
- Operations XP from contract completion
- Exploration XP from first-time visits / scans / new star arrivals
- Reputation XP from issuer faction contracts

### UI outputs

Expose a commander panel showing:
- commander level
- current career ranks
- top stats
- next unlock targets

### Verification

- mining increases mining stats/XP
- selling at profit increases trade stats/XP
- completing contract increases operations stats/XP
- first-time exploration events increase exploration XP
- profile persists across reload
- `npm run lint`
- `npm run build`

---

## Phase 3: Ship Improvement, Ownership, and Management

Objective: make credits, upgrades, and shipyards matter long-term.

Files likely involved:
- Modify: `src/types.ts`
- Modify: `src/utils/gameData.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/UpgradesPanel.tsx`
- Create: `src/utils/shipManagement.ts`
- Create: `src/components/ShipyardPanel.tsx`

### Required structural change

Current model:
- `gameState.ship`

Target model:
- `gameState.activeShipId`
- `gameState.ownedShips[]`

Each owned ship should hold at minimum:
- unique ship instance id
- chassis model/hull id
- display name/callsign
- installed upgrade ids
- derived ship stats/state
- current cargo manifest
- fuel state
- location/docked port if stored remotely later

### Tasks

1. Create ship-instance type separate from generic starter template
2. Convert current starter ship into first owned hull on new save creation
3. Replace `gameState.ship` access with selected active ship helper access
4. Make upgrades persist on the owned hull, not on global transient UI state
5. Add shipyard operations:
   - install upgrade
   - switch active ship
   - buy second hull later or via debug/dev bootstrap first
6. Keep first pass simple:
   - no resale market yet
   - no storage fees yet
   - no hull damage/repair economy yet

### Important design constraint

Do not overbuild module simulation immediately.
First version can treat upgrades/modules as installed records that drive derived stats.
That is enough to create ownership and progression.

### Verification

- purchased upgrades persist on reload
- upgrades belong to the correct owned ship
- active ship switch preserves per-ship cargo/fuel/loadout
- new commander starts with one valid starter hull
- `npm run lint`
- `npm run build`

---

## Phase 4: Cargo, Transport Pods, Mass Limits, Fuel, and Refueling

Objective: create meaningful logistical play and route planning.

Files likely involved:
- Modify: `src/types.ts`
- Modify: `src/App.tsx`
- Modify: `src/utils/gameData.ts`
- Modify: `src/components/MarketPanel.tsx`
- Modify: `src/components/ContractsPanel.tsx`
- Create: `src/utils/logistics.ts`

### Recommended first-pass model

Split current ship capacity into distinct operational capacities:
- `cargoCapacityTons`
- `passengerCapacity`
- `fuelCapacityKg`
- `moduleSlots` or simple optional slot counts

Add optional ship config concepts:
- cargo rack
- passenger pod
- auxiliary fuel tank

### Gameplay changes

1. Passenger jobs require passenger pods
2. Cargo hauling uses commodity cargo capacity only
3. Refueling becomes an explicit port action with actual restored fuel
4. Range pressure matters more because ship role/loadout affects endurance
5. Cargo mass should affect total mass and therefore acceleration/fuel pressure at least in a simple readable way

### Mining / hauling / transport implications

This phase should directly improve the still-weak core loops:
- mining becomes constrained by cargo and trip planning
- hauling becomes constrained by actual freight capacity and route economics
- passenger transport becomes a distinct ship-role path
- refueling becomes a service, not just flavor

### Verification

- cannot accept passenger-style transport without required pod capacity
- cargo cannot exceed installed freight capacity
- refuel action restores real fuel state and charges credits
- increased cargo mass has visible operational consequence if implemented in first pass
- `npm run lint`
- `npm run build`

---

## Recommended MVP Cut

If the goal is “make this feel like a game as fast as possible,” the best MVP cut is:

1. Commander profiles
2. Save schema + persistent upgrade state
3. XP tracks + commander panel
4. Owned ships + active ship selection groundwork
5. Explicit refuel gameplay
6. Cargo/passenger split

That is enough to create:
- persistence
- identity
- goals
- spending decisions
- ship specialization
- route planning pressure

---

## Best Immediate Coding Slice

If starting implementation now, do this first slice:

### Slice A — Persistence foundation
- add `saveVersion` to `GameState`
- add `commanderName` to `GameState`
- add `unlockedUpgradeIds` to `GameState`
- create `saveSystem.ts`
- migrate raw localStorage access into helper layer
- add New Game / Load / Delete commander flow

### Slice B — Progression-ready player profile
Immediately after Slice A:
- add `playerProfile` object to `GameState`
- add XP tracks and stats counters
- surface minimal commander summary UI

This is the highest-leverage starting point because everything else depends on it.

---

## Explicit Deferral Note

Do not spend near-term implementation effort on:
- traffic highways
- moving background civilian ships
- patrol lanes
- pirate interception systems
- ambient lane events

Those systems should wait until these are already fun:
- mining
- hauling
- contracts
- refueling
- upgrading
- multi-ship progression

---

## Verification Standard

After each phase:
- verify behavior manually in-app
- verify save survives reload
- verify no cross-profile state leakage
- run:
  - `npm run lint`
  - `npm run build`

Known non-blocking warning:
- Vite large bundle warning remains non-blocking unless doing bundle optimization
