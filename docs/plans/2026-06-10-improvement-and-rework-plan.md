# Noss — Improvement & Rework Plan (2026-06-10)

Audit of real code state after the 2026-05-28 game-spine plan. That plan's Phases 1–3 are
largely implemented (commander profiles + save slots, XP tracks, owned ships + shipyard).
Phase 4 (logistics) is half done. This plan covers: what is broken, what to finish,
what to add next.

## What the game is (intent)

A 2D Newtonian/Keplerian spaceflight sandbox-trader, Elite-Dangerous-flavored
(Sidewinder/Adder hulls, power pips, cockpit HUD) but simulation-honest:
real Sol-system data (JPL-sourced moons, small bodies, rings), real nearby stars
(HYG subset, 50 ly), summed-gravity flight, autopilot assists, docking, trading,
mining, contracts, upgrades, multi-ship ownership, commander progression.
Design ethos from README: no faked data, local-system sim + galaxy-atlas split.

## Current state vs the May plan

| Spine phase | Status |
|---|---|
| 1. Profiles / save lifecycle | DONE — `saveSystem.ts`, MainMenu, autosave 5 s, legacy migration |
| 2. Progression core | PARTIAL+ — trade, operations, mining, docking count, play time, star-arrival XP now wired in; body scanning and first-visit bookkeeping still missing |
| 3. Ship ownership | DONE first pass — `ownedShips[]`, shipyard buy/switch, berthing |
| 4. Logistics | PARTIAL+ — refuel + passenger capacity gate exist; fuel burns and cargo mass affects physics; deadlines, port fuel pricing, market refresh, and richer mining yield still missing |

---

## 2026-06-11 tracking update (session 2 — tutorial implementation, interrupted by usage limit)

Source inspection after commits `790586b`, `d52b2e7`, `43d0a47`, `db26e1d`,
`ed897a6`, `64827cc`, and the preceding flight/perf commits.

### Tutorial/Quest UI implementation progress (2026-06-11 late session)

| Layer | Status | Files |
|---|---|---|
| Tutorial state types | DONE | `src/types.ts`: `TutorialStepId` type, `SpaceContract.isTutorial`/`trainingMissionId`, `GameState.*` (6 tutorial fields) |
| Tutorial helper module | DONE | `src/utils/tutorial.ts`: step order, reward calc, dock-target picker, contract builder, `upsertTutorialContract`, `getTutorialObjective` |
| Save version bump | DONE | `src/utils/saveSystem.ts`: `SAVE_VERSION` 3→4 for new save shape |
| Default tutorial state (new game) | DONE | `src/utils/gameData.ts`: `createInitialState` now seeds `tutorialStartBodyId`, `tutorialTargetBodyId`, `activeTutorialStep="bay-clearance"`, tutorial contract in contract list |
| Custom initial state (career pick) | DONE | `src/app/systems/bootstrap.ts`: `createCustomInitialState` now accepts `tutorialMode:"start"|"skip"`, seeds all tutorial fields |
| Save migration (old profiles) | DONE | `src/app/systems/bootstrap.ts`: `migrateLoadedState` infers veteran status from docking count / contracts completed / playtime, upserts tutorial contract |
| Tutorial prompt UI (new-game form) | DONE | `src/components/MainMenu.tsx`: Start/Skip/Do Not Ask Again controls, localStorage pref, `onCreateProfile` prop extended with `tutorialMode` |
| TutorialHud component | DONE | `src/components/TutorialHud.tsx`: top-center strip + expandable overlay panel, driven by real `getTutorialObjective`, pin/open-contracts/skip buttons wired |
| App.tsx wiring | DONE first pass | `onCreateProfile` passes `tutorialMode`, `<TutorialHud>` is mounted, flight/docking/contract progression triggers are wired, and skip/resume/pin/open-contract handlers exist |
| ContractsPanel tutorial handling | DONE first pass | Contract board now has a separate Flight Training lane, hides the tutorial paid run until unlocked, preserves accepted training jobs, and supports Resume Training |
| Build verification | NOT RUN | 2026-06-13: skipped because Boris explicitly disallows test/build runs without specific approval |

**2026-06-13 follow-up**: App integration is now wired. The first paid run was changed from a passenger manifest to a 1t sealed courier delivery because the starter ship has `passengerCapacity: 0`. Static source inspection only; no build/test/browser verification was run.

### Items previously tracked

| Item | Current status | Evidence / note |
|---|---|---|
| 0.1 Fuel never burns | IMPLEMENTED, needs balance pass | `integrateSpacecraft` burns propellant from thrust / Isp / g0; `App.tsx` has a fuel-sim toggle and HUD surfacing. Need decide default fuel rules and tune starter tank/Isp. |
| Tier 1.1 Cargo mass into physics | IMPLEMENTED | `getShipCargoMassKg()` exists and `totalMass = dryMass + fuelLevel + cargoMass`. Transfer planner delta-v budget also includes cargo mass. |
| 0.2 Interstellar layer | IMPLEMENTED | `GalacticMap.tsx` is now mounted from `App.tsx` through a gated `mapMode === "galaxy"` path. `handleWarpToStar()` is live, consumes He-3, and is gated behind the new `galactic_chart` upgrade plus warp capability. The old unused `selectedWarpWarp` state was removed. |
| 0.3 Progression hooks | IMPLEMENTED | Mining XP/tons, docking count, total play time, contract XP, reputation, first-visit star tracking, body scans, survey-data sale loop, and discovery persistence are now wired. Repeat star arrivals use `discoveredStarIds` to avoid overcounting. |
| 0.4 Contracts finite | IMPLEMENTED | Contracts now carry deadlines, expire/fail with reputation loss, render countdowns in `ContractsPanel`, and refresh per-port on the game-day clock instead of staying as static Sol-only startup content. |
| 0.5 Crash respawn | MOSTLY IMPLEMENTED | Crash rescue now chooses nearest body with repair/refuel/port and docks there when possible; cargo reset uses canonical `luxury` through `normalizeCargoManifest`. Fallback still places ship near 1 AU in current local frame if no rescue port exists. |
| 0.6 Hygiene | MOSTLY IMPLEMENTED | Package metadata was renamed from `react-example`, the stale Gemini capability was removed from `metadata.json`, unused `@google/genai` / `express` / `dotenv` deps were removed, and dead `selectedWarpWarp` state was deleted. Remaining hygiene is mostly optional cleanup like chunking / bundle size work. |
| Tier 1.2 Deadlines | IMPLEMENTED | `SpaceContract.deadline` now drives countdown UI, acceptance gating, expiry/failure, and reputation effects in both `ContractsPanel` and `App.tsx`. |
| Tier 1.3 Refuel pricing by port | IMPLEMENTED | `onRefuel` now uses the active docked port fuel market price and stock instead of hardcoded `tons * 400`, and the UI shows live station price / availability. |
| Tier 1.4 Mining yield by body | IMPLEMENTED | Mining now uses explicit body/class heuristics via `src/utils/mining.ts` instead of the old body-name shortcut. Ice bodies/comets bias water, rocky/metallic bodies bias ore, and gas giants are excluded from mining. |
| Tier 2.1 Market dynamics | IMPLEMENTED BASIC LOOP | Markets now refresh on the game-day clock with restock drift and simple daily price movement instead of staying static after manual trades. This is still lightweight economy logic, not a deep sim. |
| Tier 2.2 Reputation effects | IMPLEMENTED BASIC LOOP | Reputation now affects contract generation quality and shipyard pricing/availability gates. It is no longer just a passive completion counter, though faction permits and richer diplomacy are still future work. |
| Tier 2.3 Exploration gameplay | IMPLEMENTED BASIC LOOP | `systemScannerRange` still gates visible bodies, and the HUD now supports unknown contacts, active scans, body-scan progression, stored survey data, and cartography-style survey sale at docked markets. There is still room to deepen exploration content later. |
| Tier 2.4 Per-ship docked location | IMPLEMENTED BASIC RULE | Activation is restricted to hulls whose `homePortId` matches current `dockedPortId`; no transfer/ferry service yet. |
| Tier 2.5 Time-warp safety | IMPLEMENTED | Autopilot/proximity warp-down guards remain in place, and world systems now advance off the chosen game clock/day boundary so contract expiry, contract refresh, and market refresh stay aligned with time warp. Battery still uses its own real-time model by design. |
| Galactic unlock rule | DECIDED | Restore Galactic Map only as a locked navigation instrument. Requires both FTL Drive and Galactic Scanner installation. Reveals nearest stars progressively and lazy-loads/generates system detail only when targeted or entered. |
| Content population | NEW TRACK | Station inventories, parts, shipyard stock, quests, dialogue, and faction flavor need expansion before Galactic Map feels earned. EDCD Coriolis data can inform categories/stat ranges, but NOSS needs original names/text because EDCD JSON data is Frontier IP. |

## Current undecided principles to discuss

These decisions affect multiple future features. Decide them before expanding content too far.

1. **Interstellar travel model**
   - DECIDED direction: restore/mount the Galactic Map as a scanner/FTL chart.
   - Gate it behind both FTL Drive and Galactic Scanner installation.
   - Keep He-3 + warp drive as the main star-to-star mechanic.
   - Reveal only closest stars inside scanner range; do not expose the whole 50 ly subset at once.
   - Lazy-load/generate star-system details when a star is selected, targeted, or entered.
   - Keep the map visually honest: an instrument view with scanner haze, not a full Milky Way simulation.

2. **Fuel realism vs fun**
   - Current formula is now real enough to matter.
   - Need decide if fuel simulation is a core default, a realism toggle, or only disabled for debug.
   - Balance target should be "fuel constrains route planning" rather than "new player burns dry in one minute".

3. **Tutorial/onboarding scope**
   - Best first content now is optional and mechanic-driven.
   - Candidate chain: undock -> orient -> short burn -> match speed -> dock at nearest station.
   - Next step after that: Earth/Luna transfer or a station-to-station courier contract.

4. **Economy model**
   - Need decide whether markets are deterministic daily snapshots, simulated inventories, or light procedural refresh.
   - Recommended minimum: seeded daily contracts + market restock toward baseline + player buy/sell price pressure.

5. **Exploration model**
   - Decide if exploration means passive scanner reveal only, active scan action, or survey contracts.
   - Recommended minimum: visible unknown contacts, scan action, `bodiesScanned`, first-discovery XP, and survey-data sale at ports.

6. **Clock model**
   - Physics, mining, contracts, markets, and battery do not all currently answer the same "does time warp count?" question.
   - Recommended principle: world systems use `gameDt`; cockpit/operator comfort systems may use `realDt` only when intentionally arcade.

7. **Content source policy**
   - EDCD Coriolis local repo can be used as reference for ship/module schema, mass/cost/rating ranges, and category coverage.
   - Do not copy Frontier/Elite JSON names, descriptions, or game text into NOSS as-is.
   - Use generated/original NOSS names and descriptions; keep EDCD-derived facts limited to private balancing reference unless licensing is clarified.

## Galactic restoration design

Decision baseline:

- Galactic Map is hidden/disabled until ship has both:
  - FTL Drive capability (`warpCapacity`)
  - Galactic Scanner / navigation suite upgrade
- Scanner reveal is progressive:
  - starter scanner: local system bodies only, no Galactic Map
  - Galactic Scanner I: nearest reachable stars only, small LY radius
  - Galactic Scanner II/III: wider nearby-star bubble and better target detail
- System data must load smart:
  - galaxy view reads compact HYG star metadata only
  - playable planetary systems are generated lazily by `getOrCreatePlayableStar`
  - do not generate all nearby star systems at startup
- Player-facing requirement:
  - shipyard/parts economy must make Galactic access feel earned
  - stations need parts, ship stock, contracts, and dialogue that point toward the unlock path

Implementation consequences:

- Add a distinct Galactic Scanner upgrade or capability flag; current `sensor_i`/`sensor_ii`
  improve scan range but do not clearly mean "galactic navigation terminal unlocked".
- Mount `GalacticMap.tsx` through a real HUD/map mode only when the unlock rule passes.
- Disable or relabel the FTL drive upgrade until scanner gating exists, so the player does
  not buy a dead drive.
- Station inventories should decide where FTL/scanner parts are sold, probably only major
  shipyards/research ports first.

## Content population track

Why it comes before or alongside Galactic Map restoration:

- FTL + scanner unlock needs parts that are sold somewhere.
- Star travel needs reasons to leave: contracts, survey jobs, faction messages, shipyard goals.
- Stations should feel different enough that "go to port X" is content, not just coordinates.

Near-term content slices:

Approved scope principle:

- Do not build a huge ship or module database.
- Start with one meaningful ship per role/class, around 6-8 ships total.
- Start with only the parts needed for the current loops and Galactic unlock, around 10-12 parts total.
- Populate existing major stations first; do not create dozens of new stations just to hold inventory.
- Every new item should either support flight, contracts, station identity, or Galactic unlock.

1. **Station archetypes**
   - Core shipyard, research array, refinery depot, ice port, military patrol base,
     freeport, passenger hub, frontier relay.
   - Each archetype controls services, inventory bias, contract types, fuel price, and dialogue.
2. **Parts/inventory**
   - Split generic `UPGRADES` into station-stocked parts over time.
   - Include FTL Drive and Galactic Scanner as separate unlocks.
   - Use EDCD module categories only as structure inspiration: standard drive/sensors/power,
     internal cargo/passenger/refinery/fuel scoop, hardpoint scanner/mining/security modules.
3. **Ships**
   - Expand shipyard stock by station archetype and faction.
   - Keep NOSS-original ship names or rewrite legacy Elite-style names before broad release.
   - Use EDCD ship stats only for rough mass/cost/role balancing.
4. **Quest templates**
   - Add tutorial contracts, station-to-station courier work, survey unlock jobs,
     mining procurement, He-3 supply chains, and FTL calibration missions.
5. **Dialogue**
   - Add station/faction lines that hint at local economy and available parts.
   - Keep dialogue compact and procedural-friendly.

First-pass ship set:

- Starter craft: existing starter Sidewinder-equivalent; keep for now, later rename/reflavor if needed.
- Orbital Courier: fast, low cargo, good first paid contracts, poor mining.
- Utility Hauler: early cargo upgrade, sluggish when loaded, cheap to maintain.
- Crew Ferry: passenger pods, safe handling, modest cargo.
- Prospector: mining + survey hybrid, better drill/sensor defaults.
- Survey Cutter: exploration/scanner ship, lower cargo, better star reveal and data storage.
- Belt Tug: heavy translation authority, tow/salvage future role, poor long-range efficiency.
- Frontier Tender: expensive long-range support craft with fuel, parts, and scan buffer capacity.

First-pass part set:

- FTL Drive: enables star-to-star jumps but does not show Galactic Map alone.
- Galactic Scanner Package: unlocks Galactic Map when paired with FTL Drive.
- Precision Star Tracker: improves arrival/targeting quality after jump.
- Sensor Mast: improves local body scans and survey contracts.
- Cargo Rack: basic freight capacity upgrade.
- Passenger Pod Rack: unlocks passenger contracts.
- Fuel Tank: longer range at higher mass.
- Efficient Engine: lower fuel burn / higher Isp.
- High-Thrust Engine: higher acceleration at higher fuel draw.
- Mining Laser: faster extraction and mining contracts.
- Docking Lidar Ring: easier approach/docking tolerance, tutorial-friendly.
- Data Core Buffer: stores survey data for sale/turn-in.

First station inventory rule:

- Traffic Exchange: courier contracts, fuel, Docking Lidar Ring, small ships.
- Drydock Spine: shipyard, hulls, Cargo Rack, Passenger Pod Rack, Fuel Tank.
- Fuel Cracking Yard: fuel, Fuel Tank, Efficient Engine, He-3 contracts.
- Survey Bureau Annex: Galactic Scanner Package, Sensor Mast, Data Core Buffer, survey contracts.
- Hab Ring Market: Passenger Pod Rack, courier/passenger missions, light cargo.
- Mining Dispatch Node: Mining Laser, Prospector ship, ore/water contracts.
- Research Quarantine Port: Sensor Mast, Data Core Buffer, cold-chain/sample contracts.
- Frontier Relay Station: FTL Drive, Precision Star Tracker, Frontier Tender, chart-extension contracts.

Quest UI / tutorial frontend plan:

| Sub-item | Status |
|---|---|
| Replace flat contract card stack with clearer mission board | NOT DONE |
| Separate normal contracts from tutorial/flight training | DONE first pass — `ContractsPanel` has a Flight Training lane and excludes tutorial jobs from the normal contract stack |
| Add optional tutorial prompt on new commander creation (Start/Skip/Do Not Ask Again) | DONE — `MainMenu.tsx` |
| Add tutorial mission modal for step-by-step instructions (compact overlay, pin/target, minimize) | DONE — `TutorialHud.tsx` |
| Add mission detail modal from contracts panel (accept/abandon/track, blocked-state) | NOT DONE |
| Add small active-objective HUD strip | PARTIAL — TutorialHud top strip exists; general active-contract strip not yet separate |
| Store tutorial state in save/profile | DONE — `types.ts`, `gameData.ts`, `bootstrap.ts` (+ migration) |
| Tutorial must be optional and recoverable | DONE first pass — Start/Skip choice is honored, HUD skip exists, and contract board has Resume Training |

First tutorial chain:

| Step | Status |
|---|---|
| 1. Bay Clearance | WIRED — completes when the undocked ship clears the start body's docking envelope |
| 2. Hold a Vector | WIRED — completes when the player pins the practice target and burns while generally aligned |
| 3. Match Speed | WIRED — completes when the player is near the practice target and relative speed is within approach tolerance |
| 4. Docking Practice | WIRED — completes after docking at the tutorial target body |
| 5. First Paid Run | WIRED — unlocks a real training courier delivery in the contract board and completes through normal contract hand-in |

First Galactic unlock chain:

1. Buy/install FTL Drive at a major shipyard.
2. Buy/install Galactic Scanner at Survey Bureau Annex or Frontier Relay.
3. Complete a `Calibration Sweep` contract in local system.
4. Galactic Map unlocks and reveals only the closest stars inside scanner range.
5. Complete `Chart Extension` or `First Fold Calibration` to make the first jump feel earned.

Seed station archetypes:

- Traffic Exchange: docking, refuel, manifests, courier jobs, route updates.
- Drydock Spine: repair, hull refit, shipyard, structural parts, salvage intake.
- Fuel Cracking Yard: ice/volatile/He-3 processing, fuel systems, raw feedstock demand.
- Survey Bureau Annex: scanner parts, star leads, telemetry contracts, exploration unlock path.
- Hab Ring Market: passenger berths, consumer cargo, crew transfers, light upgrades.
- Mining Dispatch Node: ore hauling, tug work, drill parts, hazard pay.
- Research Quarantine Port: samples, anomaly contracts, controlled deliveries, restricted dock windows.
- Frontier Relay Station: emergency maintenance, sparse stock, high-value intel, long comms delay.

Seed quest/contract templates:

- Priority Manifest: deadline cargo between named ports.
- Orbital Ferry: passenger transfer with smooth/on-time docking bonus.
- Fuel Margin Run: carry fuel canisters to low-reserve station.
- Survey Pass: close telemetry pass around a moon, asteroid, or station corridor.
- Calibration Sweep: visit navigation beacons in sequence to align scanner network.
- Cold Chain Transfer: fragile medical/research cargo, delay and damage sensitive.
- Belt Pickup: recover prepared freight pods from mining site.
- Tug Assist: match velocity with disabled barge/cargo rack and bring it home.
- Parts Rush: deliver module to drydock where a ship is grounded.
- Chart Extension: use Galactic Scanner at system edge and return star data.
- Black Box Return: locate drifting recorder beacon and hand it in.
- Settlement Resupply: mixed essentials to remote base.

Seed upgrade/ship-role concepts:

- Upgrades: FTL Spool Injector, Galactic Scanner Package, Precision Star Tracker,
  Extended Cryo Tankage, Thermal Radiator Vanes, Docking Lidar Ring, Modular Cargo
  Rack, Survey Sensor Mast, Reaction Control Upgrade, Hull Patch Weave, Tow Clamp
  Assembly, Data Core Buffer.
- Roles: Orbital Courier, Utility Hauler, Crew Ferry, Belt Tug, Survey Cutter,
  Frontier Tender, Cold Cargo Runner, Salvage Skiff.

EDCD Coriolis mapping notes:

- Ship JSON shape: `properties`, `retailCost`, `bulkheads`, `slots`, `defaults`.
- Useful ship fields for private balancing: mass, shield/armour, pitch/roll/yaw,
  crew, retail cost, slot counts.
- Useful module categories for NOSS station stock taxonomy:
  - standard core: power plant, thrusters, FTL/FSD-like drive, life support,
    power distributor, sensors, fuel tank
  - optional internal: shields, cargo racks, docking computer, assist computer,
    refinery, fuel scoop, passenger cabins, repair/reinforcement packages
  - utility/hardpoint: scanner tools, heat sinks, boosters, mining tools, future weapons
- Do not publish copied EDCD JSON as NOSS game data unless licensing is resolved.

## Tier 0 — Broken things to fix first

### 0.1 Fuel never burns (biggest sim lie)
**2026-06-11 status: IMPLEMENTED, balance/design still open.**

`integrateSpacecraft` (`src/utils/physics.ts`) now burns fuel inside the substep loop
from thrust / Isp / g0 and clamps the remaining tank level. `App.tsx` also has a fuel
simulation toggle for testing.

Remaining work is balance, not the formula: starter tank, Isp, thrust, fuel availability,
and refuel pricing need to make route planning matter without making early flight
punishing.

### 0.2 Interstellar layer is half-amputated
**2026-06-11 status: PARTIAL. The map component and warp handler exist, but the map is
not mounted in `App.tsx`; the product decision remains open.**

Commit `7ddb6c8` "remove galactic map" left:
- `GalacticMap.tsx` (698 lines) orphaned — imported nowhere
- `handleWarpToStar` defined in `App.tsx`, never called
- `selectedWarpWarp` state unused
- the 25 000¢ **warp drive upgrade still purchasable** but does nothing
- only remaining interstellar route: sublight escape past 50 AU → drift in ly-space at
  `v/9.46e15` ly/s — at escape speeds (~tens of km/s) crossing 4 ly takes ~10¹² game-seconds.
  Unreachable at sane timeScale. Interstellar travel is effectively dead content.

Decide one:
- **A (recommended):** restore a galaxy chart as an honest scanner UI (reuse the orphan,
  strip decorative haze), re-wire `handleWarpToStar`, keep the warp upgrade + He-3 cost.
- **B:** commit to slow-boat realism — give interstellar mode its own high warp factors
  (10⁶–10⁹×) + target-star steering UI, delete warp upgrade.
- Either way: delete the dead path not chosen.

### 0.3 Progression hooks missing (Phase 2 unfinished)
**2026-06-11 status: PARTIAL+. Mining, docking, play-time, contract, reputation, and
star-arrival hooks exist. Missing: body scanning and first-visit/discovery tracking.**

Wired now:
- mining tick in `App.tsx` -> `tonsMined += harvestRate`, mining XP
- star arrival / warp -> exploration XP + `starsVisited`
- docking completion -> `dockingCount++`
- game loop -> accumulate `totalPlayTimeSec`
- contract completion -> career XP + faction reputation

Still missing:
- first-visit set, so star arrivals can overcount
- body scanning action and `bodiesScanned`
- survey-data sale loop

### 0.4 Contracts are finite — game runs out of content
**2026-06-11 status: OPEN.**

`generateInitialContracts()` runs once at save creation, Sol-only. Completed contracts
stay as dead "REWARD CLAIMED" cards. No contracts at any other star.
Fix: contract generator per port, refreshed on docking / arrival (seeded by port id +
game-day so it's stable within a day). Remove completed ones after N days.

### 0.5 Crash respawn teleports across the galaxy
**2026-06-11 status: MOSTLY IMPLEMENTED. Nearest-port rescue exists; canonical `luxury`
cargo reset exists. Fallback still needs thought for systems with no rescue ports.**

Crash handling now tries to respawn at the nearest repair/refuel/port body in the
current system and dock the ship there. Cargo reset uses canonical `luxury` through
`normalizeCargoManifest`.

Still decide fallback behavior for generated systems with no reachable rescue port:
nearest stable orbit, emergency beacon, insurance tow, or forced restart at the current
system's primary service port once one is generated.

### 0.6 Dead code / hygiene sweep
**2026-06-11 status: PARTIAL. README updated; package/deps/metadata and unused warp
state still need cleanup.**

- `src/utils/autopilot.ts` is 1 line (re-export?) — fold into `spaceFlightAutopilot.ts`
- `package.json` name still `react-example`; `@google/genai`, `express`, `dotenv` unused deps
- README structure section was updated on 2026-06-11; keep it current when architecture moves
- `metadata.json` claims Gemini capability — not true anymore

## Tier 1 — Finish Phase 4 (logistics) properly

1. **Cargo mass into physics.** DONE first pass. `totalMass` now includes cargo mass via
   `getShipCargoMassKg()`, and transfer planning also includes cargo in ship mass.
   Follow-up: expose enough feedback in HUD/market so players understand why a full hold
   makes the ship sluggish.
2. **Deadlines.** `SpaceContract.deadline` exists, never enforced. Enforce + show countdown;
   expired → contract fails, small rep hit. Instant route-planning pressure.
3. **Refuel pricing by port.** Flat 400¢/t everywhere kills fuel-logistics play; price it
   from the port's own fuel market price.
4. **Mining yield by body.** Current rule: name contains "luna/ice" → water, else ore.
   The generated small-body data carries class/spectral info — map C-type → water+ore,
   S/M-type → ore, ring/comet → water/he3 traces. Makes prospecting a real activity.

## Tier 2 — Systems that pay rent (new features)

1. **Market dynamics.** Comment in `App.tsx` promises market refresh; nothing implemented.
   Slow restock toward baseline + player-trade price impact + small per-day drift.
   Without it the trade loop is solved after one spreadsheet.
2. **Reputation effects.** Rep is collected (+2/contract) but spends nowhere. Gate
   higher-reward contract tiers and shipyard stock by faction rep — closes the loop.
3. **Exploration gameplay.** Ship has `systemScannerRange` + scanner upgrades; add a scan
   action: unscanned bodies show as unknown contacts, scanning awards exploration XP +
   `bodiesScanned`, sells survey data at ports. Turns sensors line into a career.
4. **Per-ship docked location enforcement.** Owned ships have `homePortId`; active ship
   switching works. Add transfer/ferry costs so a hull berthed at Mars isn't free to use from Luna.
5. **Time-warp safety.** Autopilot gains are tuned in real-dt; at timeScale ≥1000 near a
   body the substeps (max 15) get coarse. Auto-limit timeScale by proximity (KSP rule).
   Also battery charges on `realDt` while world runs on `gameDt` — pick one clock.

## Tier 3 — Bigger bets (only after Tiers 0–2)

- Encounters / security career (the only XP track with zero content)
- Living traffic / highways (explicitly deferred in May plan — still deferred)
- Galaxy subset expansion past 50 ly with chunked loading
- Sound, tutorial/onboarding flow, gamepad support
- Bundle diet: `sol-small-body-candidates.ts` (12 k lines) + `sol-moons.ts` (10 k lines)
  imported statically — dynamic-import per system entry; HYG JSON already split by Vite.

## Suggested execution order

1. Tier 0 fixes 0.1–0.5 in one slice each (0.6 anytime)
2. Tier 1.1 + 1.2 (cargo mass + deadlines) — small code, big gameplay
3. Tier 2.1 market dynamics, then 2.2 reputation
4. Re-evaluate: galaxy map decision (0.2) quality may bump Tier 3 galaxy work

Verification standard per slice (same as May plan): manual in-app check, save survives
reload, `npm run lint`, `npm run build`.
