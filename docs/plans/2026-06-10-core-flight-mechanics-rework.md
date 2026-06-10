# Noss — Core Flight Mechanics Rework (2026-06-10)

Companion to `2026-06-10-improvement-and-rework-plan.md`. Scope: spaceflight feel,
speeds, gravity, orbits, autopilot, docking. Goal: finalize core mechanics before
content work.

## The root problem: two flight paradigms in one codebase

The code mixes two incompatible models and never chose:

| Elite Dangerous layer | KSP/Newtonian layer |
|---|---|
| `maxCruiseSpeed` 6,000,000 m/s (2 % c), boost speed | `engineThrust` 2.5 MN on ~38 t → 65 m/s² real acceleration |
| supercruise speed curve in `spaceFlightAutopilot.ts` (`sqrt(range)` Elite formula, gravity-well slowdown) | unlimited Newtonian velocity, no speed cap anywhere in the integrator |
| power pips, shields, boost, hardpoints | Kepler ephemerides, vis-viva, Isp, summed gravity |
| travel = "supercruise there" | travel = time warp ×86400 |

Consequences today:
- `maxCruiseSpeed/maxBoostSpeed` affect nothing physical — only an autopilot speed cap
- the autopilot *plans* like Elite (supercruise curve up to 6×10⁶ m/s) but the ship
  can only *accelerate* like KSP (65 m/s²) — reaching the planned speed takes ~26 h
  of game time, so the guidance spends its life in a state it can't achieve
- the player's actual travel tool is the ×86400 warp button, where the physics
  integrator and the autopilot both degrade (below)

**Decision needed (the one real design fork):**
- **A — Sim-honest (recommended):** travel = time warp + on-rails orbits (KSP model).
  Elite fields (cruise/boost speed, supercruise curve) become flavor or get deleted.
  Cheapest, most consistent with the project's "no faked data" ethos, reuses the
  existing warp UI.
- **B — Elite-style cruise drive:** add a real "cruise mode" flight state where the
  6×10⁶ m/s numbers are genuine (separate drive, instant accel curve, gravity wells
  limit speed — the supercruise function already encodes this). More new code; time
  warp demoted. Picks the Elite identity.
- Hybrid (A for physics, B as late-game drive tech) is possible later; don't start there.

The rest of this plan assumes **A**; items marked (¶) survive unchanged under B.

---

## 1. Orbits & gravity: go on-rails when coasting  ← biggest single win

### Today
`integrateSpacecraft` always numerically integrates (Euler-Cromer), capped at
**15 substeps of ≥300 s** at high warp. At ×86400 a frame is ~1440 s of game time →
288 s steps. A low parking orbit (period ~7000 s) gets ~24 integration points per
revolution with a non-symplectic integrator → orbits visibly decay/precess at warp.
Stable orbiting — the literal name of the game — is not stable.

### Fix: rails + patched conics (KSP architecture)
- **Coasting (throttle 0, no autopilot burn):** stop integrating. Convert ship state
  to Keplerian elements relative to the dominant gravity body once, then propagate
  analytically each frame (`solveKepler` already exists). Orbits become *exact* at
  any time warp, forever, for free CPU.
- **Under thrust:** numeric integration as now, but with adaptive substep:
  `subDt ≤ min(300 s, orbitalPeriod(dominantBody, r)/120)`, substep count uncapped
  within a frame budget (drop warp instead of dropping accuracy).
- **SOI transition while on rails:** when the conic crosses an SOI boundary,
  re-anchor elements to the new body (patched conics). Summed-gravity stays for
  powered flight only.
- **Auto warp limits (¶):** KSP rule — max allowed timeScale shrinks with altitude
  over the dominant body. Prevents both integrator abuse and crash tunneling.

### Bug fixes regardless (¶)
1. **Moon SOI formula wrong** — `getSphereOfInfluence` divides moon mass by the
   *Earth* constant (`5.972e24`) instead of the parent planet's mass. Ganymede's SOI
   comes out ~8× too large; every non-Luna moon is wrong. Use
   `a × (m_moon / m_parent)^(2/5)`.
2. **Dominant-body pick is array-order dependent** — first SOI hit wins (`break`).
   Should select the deepest nested SOI containing the ship.
3. **Crash tunneling** — collision checked only at the post-frame position; at high
   warp a ship can pass through a planet between samples. Check per substep (or
   segment-vs-circle). On rails: check conic periapsis vs body radius — analytic,
   perfect.
4. **Star crash radius hardcoded** to `6.96e8 × 0.5` (half a solar radius) for every
   star. Use the active star's actual radius.
5. **Route prediction wrong near bodies** — `predictShipRoute` does 96 Euler steps
   over up to 5 days (≈4500 s/step). On rails the predicted path is just the conic:
   draw it exactly, and mark **periapsis / apoapsis / SOI entry** points. This turns
   the trajectory line from decoration into the main navigation instrument.

---

## 2. Flight speeds & travel times

With paradigm A settled:
- **Delete the supercruise curve** from `spaceFlightAutopilot.ts` (or fence it behind
  the future cruise-drive tech). Autopilot plans within real acceleration.
- **Keep real accelerations** (45–65 m/s² starter range is generous but fine for 2D fun).
- **Travel time knob = warp + transfer planning**, not fake velocity. Earth→Mars at
  65 m/s² brachistochrone ≈ 2 days game time ≈ seconds at ×86400 — totally playable
  once orbits are warp-stable (item 1).
- `maxCruiseSpeed`/`maxBoostSpeed`/`minThrustPercent` in `ships.ts`: keep as data,
  mark unused, or remove from `ShipState` to stop implying mechanics that don't exist.

## 3. Autopilot

### Today
- Gains and turn rate are tuned in **real-time dt** while physics runs in
  **game-time dt** — at ×600+ the controller reacts 600× too slowly relative to the
  world: overshoots, oscillation, missed brake phases. This is the main
  "autopilot feels broken at warp" cause.
- `approach-target` is an impressive 6-phase machine (accelerate/capture/coast/
  brake/match/arrived) but built around the unreachable supercruise speeds.
- Manual rotation: player keys snap heading ±5° instantly; autopilot is rate-limited
  at 0.9 rad/s — two different rotation realities. Ship profile already has
  `pitchDegPerSec`/`yawDegPerSec` — unused.

### Plan
1. **Time-domain fix (¶):** run all guidance in game-time (turn rate × gameDt,
   capped), and/or auto-clamp warp to ≤×60 whenever a burn phase is active.
   On rails, "autopilot during coast" is just waiting — warp freely.
2. **Attitude model (¶):** one rotation-rate constant per hull (from the Coriolis
   pitch/yaw data), applied to BOTH manual keys and autopilot. Heading becomes a
   real state, not a teleport.
3. **New basic hold modes (cheap, big QoL) (¶):** prograde / retrograde / radial ±
   / target / anti-target hold. These are one `atan2` each — most of the plumbing
   (align-target) already exists.
4. **Transfer autopilot ("Go To Body"):** replaces the supercruise approach for
   interplanetary legs — raise/lower orbit to a transfer conic, coast on rails
   (player warps), circularize at destination, then hand off to the existing
   terminal approach logic for the last few thousand km. The existing
   `approach-target` shrinks to its honest job: terminal rendezvous + station
   alignment.
5. **Surface the guidance numbers (¶):** `brakingDistance`, closing speed, phase —
   already computed, barely shown. Cockpit needs: time-to-periapsis, ETA, Δv
   remaining (trivial once fuel burn exists: Δv = Isp·g₀·ln(m₀/m₁)).

## 4. Docking

### Today
Binary teleport: inside (huge) sphere + below (generous) speed → docked, ship pinned
at radius+1000 m. Envelopes: planets 5000 km altitude @1500 m/s, Earth-tether
36,000 km @2500 m/s. Undock: clean release into circular parking orbit (good, keep).

### Plan (¶)
1. **Keep "soft-dock" arcade philosophy** — full manual airlock flying is out of
   scope for 2D — but make it a *sequence*, not a boolean:
   request clearance (docked-body comms line) → hold inside approach envelope for
   ~10 s while alignment ≥ tolerance → clamps engage. Uses the existing
   `stationAirlockHeading` math that's already in the guidance and currently wasted.
2. **Tighten envelopes** to make approach autopilot/skill matter:
   stations ~50 km @ 25 m/s, moons/planet ports ~200 km @ 50 m/s, tether special-case
   stays large but speed-limited. (Numbers to tune in playtest; current ones make
   the whole terminal phase skippable.)
3. **Denied-with-reason** already exists (distance/speed message) — extend with the
   clearance step so docking has a comms beat.
4. **Pin-while-docked** stays as is.

## 5. Orbiting as gameplay (closing the loop)

Once 1–4 land, these become trivially possible and finally make "orbit" a verb:
- orbit-type contracts can require *holding* a specific orbit (a, e tolerance) for
  N game-hours — currently they check instantaneous position+speed only
- periapsis/apoapsis markers + circularize-at-apoapsis prompt = the classic
  two-burn teaching loop
- station-keeping near a body at warp costs nothing (on rails) — parked mining ships
  later become viable

---

## Execution order (each slice verifiable in-app)

| # | Slice | Touches | Risk |
|---|---|---|---|
| 1 | SOI formula + dominant-body fix + star crash radius | `physics.ts` | low |
| 2 | Fuel burn (Tier 0.1 from main plan) + Δv readout | `physics.ts`, HUD | low |
| 3 | On-rails coast + patched conic + exact trajectory line + per-substep crash check | `physics.ts`, `App.tsx`, `StarSystemCanvas.tsx` | **high — the big one** |
| 4 | Autopilot game-time fix + attitude rates + hold modes | `App.tsx`, `useCockpitControls.ts`, `spaceFlightAutopilot.ts` | medium |
| 5 | Transfer autopilot (Go To Body) | new `transferPlanner.ts` | medium |
| 6 | Docking sequence + envelope tightening | `App.tsx`, `physics.ts`, HUD | low |
| 7 | Delete/fence Elite speed layer per paradigm decision | `ships.ts`, `types.ts`, guidance | low |

Slice 3 is the keystone — slices 4–6 get dramatically simpler after it (autopilot
coast phases vanish, prediction is exact, crash check is analytic).

Verification per slice: manual flight test (park in LEO at ×86400 for 10 min —
orbit must not drift), `npm run test:autopilot`, `npm run lint`, `npm run build`.
Add autopilot test cases for: terminal approach at ×1/×60/×600, circularize from
eccentric orbit, SOI handoff Earth→Luna.
