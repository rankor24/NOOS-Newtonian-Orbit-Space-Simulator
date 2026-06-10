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
| 2. Progression core | PARTIAL — types + panel exist; only trade/operations XP ever awarded |
| 3. Ship ownership | DONE first pass — `ownedShips[]`, shipyard buy/switch, berthing |
| 4. Logistics | PARTIAL — refuel + passenger capacity gate exist; cargo mass has no physical effect; fuel doesn't burn |

---

## Tier 0 — Broken things to fix first

### 0.1 Fuel never burns (biggest sim lie)
`integrateSpacecraft` (`src/utils/physics.ts`) destructures `fuelLevel` and returns it
unchanged. No code anywhere decrements fuel. Consequences: refueling, fuel tanks
upgrades, `engineIsp`, the "out of fuel" throttle cut in `App.tsx` are all dead weight.

Fix: mass-flow burn inside the substep loop — `mdot = thrust*throttle/(Isp*g0)`,
`fuelLevel -= mdot*subDt`, clamp at 0 and kill thrust. `totalMass` already includes
`fuelLevel`, so acceleration improves as tanks drain — free realism. Then balance
starter tank (4 000 kg, Isp 3 600 s ≈ 2.5 MN → ~70 kg/s at full throttle ≈ under a
minute of full burn; either raise Isp, raise tank, or treat throttle as duty-cycle).
Balancing is the real work, not the formula.

### 0.2 Interstellar layer is half-amputated
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
Never awarded anywhere: mining XP / `tonsMined`, exploration XP / `starsVisited` /
`bodiesScanned`, `dockingCount`, `totalPlayTimeSec`. Five of five stats panels show 0 forever.
- mining tick in `App.tsx` → `tonsMined += harvestRate`, mining XP
- star arrival (both arrival paths) → first-visit check → exploration XP + `starsVisited`
- `handleDockActivate` → `dockingCount++`
- autosave interval → accumulate `totalPlayTimeSec`

### 0.4 Contracts are finite — game runs out of content
`generateInitialContracts()` runs once at save creation, Sol-only. Completed contracts
stay as dead "REWARD CLAIMED" cards. No contracts at any other star.
Fix: contract generator per port, refreshed on docking / arrival (seeded by port id +
game-day so it's stable within a day). Remove completed ones after N days.

### 0.5 Crash respawn teleports across the galaxy
Crash handler resets ship to `x = 1 AU` "at Earth" regardless of active system —
in Alpha Centauri you respawn at 1 AU from that star, log text lies about Earth.
Also: cargo reset uses key `luxuries`, but the resource id is `luxury` (same phantom key
in `createStarterShip`). Harmless but wrong; fix the key everywhere.
Better crash rule: respawn docked at nearest port in the *current* system; if none, nearest body orbit.

### 0.6 Dead code / hygiene sweep
- `src/utils/autopilot.ts` is 1 line (re-export?) — fold into `spaceFlightAutopilot.ts`
- `package.json` name still `react-example`; `@google/genai`, `express`, `dotenv` unused deps
- README structure section badly outdated (no mention of HUD, MainMenu, app/systems, sol datasets)
- `metadata.json` claims Gemini capability — not true anymore

## Tier 1 — Finish Phase 4 (logistics) properly

1. **Cargo mass into physics.** `totalMass = dryMass + fuelLevel` ignores cargo.
   One line (`+ cargoMassKg`) makes hauling decisions real: full hold = sluggish ship,
   more fuel per burn once 0.1 lands. RESOURCE_TYPES already has per-unit mass — use it
   (cargo stored in tons, mass field is kg/ton).
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
