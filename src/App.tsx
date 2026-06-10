/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import { useState, useEffect, useRef } from "react";
import { StarSystemCanvas } from "./components/StarSystemCanvas";
import { EliteCockpitHud } from "./components/EliteCockpitHud";
import { STARS, AU, getOrCreatePlayableStar } from "./data/stars";
import { MainMenu } from "./components/MainMenu";
import { createInitialState, formatGameTime, RESOURCE_TYPES, UPGRADES, generateMarketsForStar } from "./utils/gameData";
import { DEFAULT_POWER_DISTRIBUTION } from "./data/ships";
import { GameState, CelestialBody, SpaceContract } from "./types";
import { getDominantGravitySource, integrateSpacecraft, computeOrbitMetrics, getAbsoluteBodyPosition, getBodyVelocity, buildBodyPositionCache, BodyPosCache, getDockingSpecs } from "./utils/physics";
import { awardCareerXp, addReputation } from "./utils/progression";
import { listCommanderProfiles, loadBestAvailableProfile, loadCommanderProfile, loadLegacySingleSave, saveCommanderProfile, deleteCommanderProfile, clearLegacySingleSave } from "./utils/saveSystem";
import { createOwnedShipFromCatalog, getShipyardCatalog } from "./utils/shipManagement";
import { computeApproachGuidance } from "./utils/spaceFlightAutopilot";
import { pickPortForBody } from "./utils/worldText";
import { createCustomInitialState, migrateLoadedState } from "./app/systems/bootstrap";
import { THEMES } from "./app/systems/themeSystem";
import { useCockpitControls } from "./app/systems/useCockpitControls";
import { GamePanels } from "./app/systems/GamePanels";
import {
Sparkles,
Compass,
Gauge,
ListTodo,
Globe,
Award,
Flame,
Clock,
BatteryCharging,
Coins,
Cpu,
MapPin,
Anchor,
AlertTriangle,
RotateCw,
Terminal,
Activity,
History
} from "lucide-react";

const DOCKING_RANGE_METERS = 1.2e6;
const DOCKING_MAX_REL_SPEED = 600;
const AUTOPILOT_MAX_TURN_RATE = 0.9; // rad/sec, real-time fly-by-wire rotation cap
const METERS_PER_LIGHT_YEAR = 9.4607e15;
const SYSTEM_ESCAPE_RADIUS_METERS = 50 * AU;
const STAR_ARRIVAL_RADIUS_LY = 0.02;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const angleDelta = (target: number, current: number) => Math.atan2(Math.sin(target - current), Math.cos(target - current));

export default function App() {
const [gameState, setGameState] = useState<GameState>(() => {
const best = loadBestAvailableProfile();
if ((best as any)?.ship?.cargo) return migrateLoadedState(best);
const legacy = loadLegacySingleSave();
if ((legacy as any)?.ship?.cargo) {
const migrated = migrateLoadedState(legacy);
saveCommanderProfile(migrated, migrated.profileId);
clearLegacySingleSave();
return migrated;
}
const fresh = createInitialState();
saveCommanderProfile(fresh, fresh.profileId);
return fresh;
});
const [profileSummaries, setProfileSummaries] = useState(() => listCommanderProfiles());
const [isInMainMenu, setIsInMainMenu] = useState<boolean>(true);

const [activeTab, setActiveTab] = useState<"market" | "upgrades" | "contracts">("market");
const [mapMode, setMapMode] = useState<"star" | "ship" | "target">("star");
const [isThrusting, setIsThrusting] = useState<boolean>(false);
const [selectedWarpWarp, setSelectedWarpWarp] = useState<boolean>(false);

// Customizable Cockpit UI Theme State
const [uiTheme, setUiTheme] = useState<"amber" | "blue" | "green" | "red">(() => {
return (localStorage.getItem("newtonian_theme") as any) || "amber";
});

// Custom Autopilot Toggles
const [autopilotMode, setAutopilotMode] = useState<"none" | "match-speed" | "circularize" | "align-target" | "approach-target">("none");

const syncOwnedShips = (state: GameState): GameState => ({
...state,
ownedShips: state.ownedShips.map((entry) => entry.id === state.activeShipId ? { ...entry, name: state.ship.name, ship: state.ship } : entry),
});

// References for rapid simulation tick updates to avoid closure issues
const stateRef = useRef(gameState);
stateRef.current = gameState;
const autopilotRef = useRef(autopilotMode);
autopilotRef.current = autopilotMode;

useEffect(() => {
  const interval = setInterval(() => {
    const current = stateRef.current;
    const synced = syncOwnedShips(current);
    saveCommanderProfile(synced, synced.profileId);
    setProfileSummaries(listCommanderProfiles());
  }, 5000); // 5 seconds autosave interval
  return () => clearInterval(interval);
}, []);

useEffect(() => {
localStorage.setItem("newtonian_theme", uiTheme);
}, [uiTheme]);

// Frame-level body position cache: built once per tick, reused by all physics calls
const posCacheRef = useRef<BodyPosCache>(new Map());

// Game bodies in the current active solar system
const activeStar = getOrCreatePlayableStar(gameState.activeStarId) || STARS.find((s) => s.id === gameState.activeStarId) || STARS[0];
const systemBodies = activeStar.planets;

const activeStarRef = useRef(activeStar);
activeStarRef.current = activeStar;
const systemBodiesRef = useRef(systemBodies);
systemBodiesRef.current = systemBodies;

// Selected object info
const selectedBody = systemBodies.find((b) => b.id === gameState.selectedBodyId) || null;
const selectedBodyPosition = selectedBody
? getAbsoluteBodyPosition(selectedBody.id, systemBodies, gameState.gameTime)
: null;
const selectedBodyVelocity = selectedBody
? getBodyVelocity(selectedBody.id, systemBodies, gameState.gameTime)
: { vx: 0, vy: 0 };
const shipyardCatalog = getShipyardCatalog();
const selectedPortName = gameState.dockedPortId || "current port";
const dockedPortInventory = gameState.ownedShips.filter((entry) => entry.homePortId === gameState.dockedPortId);
const dockingDistance = selectedBodyPosition
? Math.hypot(gameState.ship.x - selectedBodyPosition.x, gameState.ship.y - selectedBodyPosition.y)
: Infinity;
const dockingRelativeSpeed = selectedBody
? Math.hypot(gameState.ship.vx - selectedBodyVelocity.vx, gameState.ship.vy - selectedBodyVelocity.vy)
: Infinity;
const targetBearing = selectedBodyPosition
? Math.atan2(selectedBodyPosition.y - gameState.ship.y, selectedBodyPosition.x - gameState.ship.x)
: null;
const dockingSpecs = getDockingSpecs(selectedBody);
const canDockAtSelectedBody = !!selectedBody &&
selectedBody.hasMarket &&
dockingDistance < dockingSpecs.maxDistance &&
dockingRelativeSpeed < dockingSpecs.maxSpeed;

// Dominant orbital gravity source reference (uses frame cache)
const domGravity = getDominantGravitySource(
gameState.ship.x,
gameState.ship.y,
systemBodies,
gameState.gameTime,
activeStar.mass * 1.989e30
);

// Compute real-time relative orbital parameters
const relativeOrbit = computeOrbitMetrics(
gameState.ship,
domGravity.body || systemBodies[0],
systemBodies,
gameState.gameTime
);

const activeTheme = THEMES[uiTheme];

// Unified Game loop
useEffect(() => {
  let lastTime = performance.now();
  let frameId: number;

  const tick = async () => {
const now = performance.now();
const realDt = (now - lastTime) / 1000; // seconds
lastTime = now;

// Ensure stable framerate ticks
if (realDt <= 0) {
frameId = requestAnimationFrame(tick);
return;
}

const current = stateRef.current;
const gameDt = realDt * current.timeScale; // Game seconds elapsed

    // Build position cache once per tick — all physics calls reuse this
    const posCache = buildBodyPositionCache(systemBodiesRef.current, current.gameTime);
posCacheRef.current = posCache;

if (current.flightMode === "interstellar" && current.interstellar) {
const nextX = current.interstellar.xLy + current.interstellar.vxLyPerSec * gameDt;
const nextY = current.interstellar.yLy + current.interstellar.vyLyPerSec * gameDt;
const { GALAXY_STARS, getOrCreatePlayableStar } = await import("./data/stars");
        const arrivalStar = GALAXY_STARS
.filter((star) => star.id !== current.interstellar?.originStarId)
.find((star) => Math.hypot(star.x - nextX, star.y - nextY) <= STAR_ARRIVAL_RADIUS_LY);

if (arrivalStar) {
const dest = getOrCreatePlayableStar(arrivalStar.id);
const destinationMarkets = generateMarketsForStar(arrivalStar.id);
setAutopilotMode("none");
setGameState((prev) => ({
...prev,
activeStarId: arrivalStar.id,
flightMode: "local-system",
interstellar: null,
selectedBodyId: dest.planets[0]?.id || null,
miningTargetId: null,
isDocked: false,
dockedBodyId: null,
gameTime: current.gameTime + gameDt,
markets: { ...prev.markets, ...destinationMarkets },
ship: {
...prev.ship,
x: SYSTEM_ESCAPE_RADIUS_METERS * 0.8,
y: 0,
vx: 0,
vy: 18000,
throttlePercent: 0,
},
}));
addConsoleLog(`Navigation: Entered ${arrivalStar.name} local frame. System bodies resolved from star database.`, "success");
} else {
setGameState((prev) => ({
...prev,
gameTime: current.gameTime + gameDt,
activeStarId: current.interstellar?.originStarId ?? prev.activeStarId,
interstellar: current.interstellar ? { ...current.interstellar, xLy: nextX, yLy: nextY } : null,
}));
}

    frameId = requestAnimationFrame(tick);
    return;
}

    if (current.isDocked && current.dockedBodyId) {
      const dockBody = systemBodiesRef.current.find((body) => body.id === current.dockedBodyId);
      if (dockBody) {
        const dockPos = posCache.get(dockBody.id) || getAbsoluteBodyPosition(dockBody.id, systemBodiesRef.current, current.gameTime);
        const dockVelocity = getBodyVelocity(dockBody.id, systemBodiesRef.current, current.gameTime);
        const offsetX = current.ship.x - dockPos.x;
        const offsetY = current.ship.y - dockPos.y;
        const offsetLength = Math.hypot(offsetX, offsetY);
        const parkingRadius = (dockBody.radius ?? 0) + 1000;
        const ux = offsetLength > 1 ? offsetX / offsetLength : 1;
        const uy = offsetLength > 1 ? offsetY / offsetLength : 0;

        if (autopilotRef.current !== "none") {
          setAutopilotMode("none");
        }
        setIsThrusting(false);
        setGameState((prev) => ({
          ...prev,
          gameTime: current.gameTime + gameDt,
          miningTargetId: null,
          ship: {
            ...prev.ship,
            x: dockPos.x + ux * parkingRadius,
            y: dockPos.y + uy * parkingRadius,
            vx: dockVelocity.vx,
            vy: dockVelocity.vy,
            throttlePercent: 0,
          },
        }));

        frameId = requestAnimationFrame(tick);
        return;
      }
    }

    // --- 1. Autopilot Core Control Loop ---
    let targetHeading = current.ship.heading;
    let throttleCommand = (autopilotRef.current === "none" || autopilotRef.current === "align-target")
      ? current.ship.throttlePercent
      : 0;

    const tickDomGravity = getDominantGravitySource(
      current.ship.x,
      current.ship.y,
      systemBodiesRef.current,
      current.gameTime,
      activeStarRef.current.mass * 1.989e30,
      posCache
    );
    const activeTargetBody = systemBodiesRef.current.find((b) => b.id === current.selectedBodyId) || tickDomGravity.body;

if (autopilotRef.current !== "none" && activeTargetBody) {
// Calculate relative coordinates and velocities using frame cache
const targetBodyPos = posCache.get(activeTargetBody.id) || { x: 0, y: 0 };
const dx = current.ship.x - targetBodyPos.x;
const dy = current.ship.y - targetBodyPos.y;

      // Approximate target velocity numerically (need next frame position for velocity)
      const targetVelocity = getBodyVelocity(activeTargetBody.id, systemBodiesRef.current, current.gameTime);
      const targetVx = targetVelocity.vx;
      const targetVy = targetVelocity.vy;

      const relVx = current.ship.vx - targetVx;
      const relVy = current.ship.vy - targetVy;
      const relSpeed = Math.hypot(relVx, relVy);
      let desiredDeltaVx = 0;
      let desiredDeltaVy = 0;

      if (autopilotRef.current === "match-speed") {
        // Match selected body's velocity by burning against relative velocity.
        if (relSpeed > 5) {
          desiredDeltaVx = -relVx;
          desiredDeltaVy = -relVy;
          targetHeading = Math.atan2(desiredDeltaVy, desiredDeltaVx);

          const angleError = Math.abs(angleDelta(targetHeading, current.ship.heading));
          throttleCommand = angleError < 0.35 ? clamp((relSpeed / 2500) * 100, 8, 70) : 0;
        } else {
          // Velocity matched successfully
          throttleCommand = 0;
          setAutopilotMode("none");
          addConsoleLog("Autopilot: Relative velocity matched. Orbital station approach secured.", "success");
        }
      } else if (autopilotRef.current === "circularize") {
        const tickRelativeOrbit = computeOrbitMetrics(
          current.ship,
          tickDomGravity.body || systemBodiesRef.current[0],
          systemBodiesRef.current,
          current.gameTime,
          posCache
        );
        // Circularize around the selected body using a local tangential target velocity.
        const G_const = 6.6743e-11;
        const bodyMass = activeTargetBody.type === "star" ? activeTargetBody.mass * 1.989e30 : activeTargetBody.mass;
        const dist = Math.hypot(dx, dy);
        const v_circular = Math.sqrt((G_const * bodyMass) / dist);
        const safeDist = Math.max(1, dist);
        const orbitalDirection = dx * relVy - dy * relVx >= 0 ? 1 : -1;
        const tangentX = (-dy / safeDist) * orbitalDirection;
        const tangentY = (dx / safeDist) * orbitalDirection;
        const desiredRelVx = tangentX * v_circular;
        const desiredRelVy = tangentY * v_circular;
        desiredDeltaVx = desiredRelVx - relVx;
        desiredDeltaVy = desiredRelVy - relVy;
        const speedError = Math.hypot(desiredDeltaVx, desiredDeltaVy);

        if (speedError > 15) {
          targetHeading = Math.atan2(desiredDeltaVy, desiredDeltaVx);
          const angleError = Math.abs(angleDelta(targetHeading, current.ship.heading));
          throttleCommand = angleError < 0.35 ? clamp((speedError / 3000) * 100, 8, 65) : 0;
        } else {
          throttleCommand = 0;
          setAutopilotMode("none");
          addConsoleLog(`Autopilot: Orbit circularized successfully. Eccentricity: ${tickRelativeOrbit.eccentricity.toFixed(3)}`, "success");
        }
} else if (autopilotRef.current === "align-target") {
// Steer towards target bearing and keep manual throttle control active!
if (targetBearing !== null) {
targetHeading = targetBearing;
} else {
throttleCommand = 0;
setAutopilotMode("none");
addConsoleLog("Autopilot: Target alignment disengaged (no active target).", "warning");
}
} else if (autopilotRef.current === "approach-target") {
// APPR: Newtonian automatic approach and docking deceleration assist!
if (current.selectedBodyId) {
const bodyRadius = activeTargetBody.radius ?? 0;
const shipMass = current.ship.dryMass + current.ship.fuelLevel;
const maxDecel = current.ship.engineThrust / shipMass;
const targetMass = activeTargetBody.type === "star"
? (activeTargetBody.mass ?? 0) * 1.989e30
: (activeTargetBody.mass ?? 0);

// Compute guidance using Newtonian flight assist equations
const activeSpecs = getDockingSpecs(activeTargetBody);
const guidance = computeApproachGuidance({
dx,
dy,
relVx,
relVy,
maxAcceleration: maxDecel,
arrivalDistance: activeSpecs.maxDistance * 0.9,
arrivalSpeed: Math.min(25, activeSpecs.maxSpeed * 0.1),
safetyDistance: 400000,
maxCruiseClosingSpeed: 4500,
maxSupercruiseClosingSpeed: Math.max(current.ship.maxCruiseSpeed, 6_000_000),
stationApproach: activeTargetBody.hasMarket,
currentHeading: current.ship.heading,
targetMass,
bodyRadius,
});

if (guidance.phase === "arrived") {
throttleCommand = 0;
setAutopilotMode("none");
addConsoleLog(`Autopilot: ${guidance.phase.toUpperCase()} complete around ${activeTargetBody.name || "target"}. Velocity matched within docking envelope.`, "success");
} else {
targetHeading = guidance.targetHeading;
const angleError = Math.abs(angleDelta(targetHeading, current.ship.heading));
// Let the ship rotate first. Don't fire thrust if misaligned by more than ~14 degrees.
throttleCommand = angleError < 0.25 ? guidance.throttlePercent : 0;
}
} else {
throttleCommand = 0;
setAutopilotMode("none");
addConsoleLog("Autopilot: Approach aborted (no active target selected).", "warning");
}
}
}

// Keep ship rotating towards target headings
let finalHeading = current.ship.heading;
if (autopilotRef.current !== "none") {
const enginePips = current.ship.powerDistribution?.engines ?? DEFAULT_POWER_DISTRIBUTION.engines;
const turnSpeed = AUTOPILOT_MAX_TURN_RATE * (0.7 + enginePips / 100) * realDt;
const diff = angleDelta(targetHeading, current.ship.heading);
if (Math.abs(diff) < turnSpeed) {
finalHeading = targetHeading;
} else {
finalHeading += Math.sign(diff) * turnSpeed;
}
}

// --- 2. Integrate Spacecraft Positions ---
let updatedShip = { ...current.ship, heading: finalHeading };

// Solar battery calculations: panels gather photons based on star distance
const distToSun = Math.hypot(current.ship.x, current.ship.y);
const auDist = distToSun / AU;
const solarStrength = Math.min(2.5, 1.2 / (auDist * auDist)); // inverse square
const batteryChargeRate = solarStrength * 0.04 * realDt;
const throttleLoad = Math.abs(throttleCommand) / 100;
const enginePips = current.ship.powerDistribution?.engines ?? DEFAULT_POWER_DISTRIBUTION.engines;
const enginePowerScale = 0.65 + enginePips / 166;
const batteryDischargeRate = (0.003 + throttleLoad * 0.035) * realDt;

let netBattery = Math.min(current.ship.maxBattery, Math.max(0, current.ship.battery + batteryChargeRate - batteryDischargeRate));

const isPowerLocked = netBattery <= 0.1;
const actualThrottlePercent = updatedShip.fuelLevel > 0 && !isPowerLocked
? Math.max(-100, Math.min(100, throttleCommand * enginePowerScale))
: 0;

updatedShip.throttlePercent = throttleCommand;
updatedShip.battery = netBattery;

    // Physics motion solver step
    updatedShip = integrateSpacecraft(
      updatedShip,
      systemBodiesRef.current,
      current.gameTime,
      gameDt,
      actualThrottlePercent,
      activeStarRef.current.mass * 1.989e30
// No posCache here — sub-stepping advances sim time, cache would be frozen at t=gameTime
);

if (updatedShip.fuelLevel <= 0.1 && updatedShip.throttlePercent !== 0) {
updatedShip.throttlePercent = 0;
}

const escapedSystem = Math.hypot(updatedShip.x, updatedShip.y) > SYSTEM_ESCAPE_RADIUS_METERS;
if (escapedSystem) {
const { GALAXY_STARS } = await import("./data/stars");
        const currentGalaxyStar = GALAXY_STARS.find((star) => star.id === current.activeStarId) || GALAXY_STARS[0];
const speed = Math.hypot(updatedShip.vx, updatedShip.vy);
const ux = speed > 1 ? updatedShip.vx / speed : Math.cos(updatedShip.heading);
const uy = speed > 1 ? updatedShip.vy / speed : Math.sin(updatedShip.heading);
const targetStar = GALAXY_STARS
.filter((star) => star.id !== current.activeStarId)
.map((star) => {
const dx = star.x - currentGalaxyStar.x;
const dy = star.y - currentGalaxyStar.y;
const dist = Math.hypot(dx, dy);
const alignment = dist > 0 ? (dx / dist) * ux + (dy / dist) * uy : -1;
return { star, dist, alignment };
})
.filter((candidate) => candidate.alignment > 0.35)
.sort((a, b) => (b.alignment - a.alignment) || (a.dist - b.dist))[0]?.star || null;

setAutopilotMode("none");
setGameState((prev) => ({
...prev,
flightMode: "interstellar",
interstellar: {
originStarId: current.activeStarId,
targetStarId: targetStar?.id ?? null,
xLy: currentGalaxyStar.x,
yLy: currentGalaxyStar.y,
vxLyPerSec: updatedShip.vx / METERS_PER_LIGHT_YEAR,
vyLyPerSec: updatedShip.vy / METERS_PER_LIGHT_YEAR,
},
selectedBodyId: null,
miningTargetId: null,
isDocked: false,
dockedBodyId: null,
gameTime: current.gameTime + gameDt,
ship: { ...updatedShip, throttlePercent: 0 },
}));
      addConsoleLog(targetStar
        ? `Navigation: ${activeStarRef.current.name} gravity well escaped. Deep-space cruise projected toward ${targetStar.name}.`
        : `Navigation: ${activeStarRef.current.name} gravity well escaped. Deep-space cruise active. No forward star locked.`, "success");
      frameId = requestAnimationFrame(tick);
      return;
    }

    // --- 3. Manage Mining Operations ---
    let appendMarkets = { ...current.markets };
    let logsList = [...current.logs];
    let creditsVal = current.playerCredits;

    if (current.miningTargetId && current.miningTargetId === current.selectedBodyId) {
      // Mine continuous tick
      const mineNode = systemBodiesRef.current.find((b) => b.id === current.miningTargetId);
if (mineNode) {
const mDx = updatedShip.x - getAbsoluteBodyPosition(mineNode.id, systemBodiesRef.current, current.gameTime).x;
const mDy = updatedShip.y - getAbsoluteBodyPosition(mineNode.id, systemBodiesRef.current, current.gameTime).y;
const mDist = Math.hypot(mDx, mDy);

if (mDist < 5e5) { // under 500km bounds
// Calculate current cargo mass
let currentCargoMass = 0;
Object.keys(updatedShip.cargo).forEach((k) => currentCargoMass += updatedShip.cargo[k] || 0);

if (currentCargoMass < updatedShip.cargoCapacity) {
const harvestRate = updatedShip.miningPower * 0.0003 * gameDt; // extraction

const updatedCargo = { ...updatedShip.cargo };
// Select commodity type (ice on moons/asteroids, metal ore mostly)
const resType = mineNode.name.toLowerCase().includes("luna") || mineNode.name.toLowerCase().includes("ice") ? "water" : "ore";
updatedCargo[resType] = (updatedCargo[resType] || 0) + harvestRate;

// Constraint check
let finalCargoMass = 0;
Object.keys(updatedCargo).forEach((k) => finalCargoMass += updatedCargo[k] || 0);

if (finalCargoMass >= updatedShip.cargoCapacity) {
// Crop excess
const overage = finalCargoMass - updatedShip.cargoCapacity;
updatedCargo[resType] = Math.max(0, updatedCargo[resType] - overage);
updatedShip.cargo = updatedCargo;
setGameState((g) => ({ ...g, miningTargetId: null }));
addConsoleLog("Drill Computer: Cargo inventory reached max tonnage capacity. Drills disengaged.", "warning");
} else {
updatedShip.cargo = updatedCargo;
}
} else {
setGameState((g) => ({ ...g, miningTargetId: null }));
addConsoleLog("Drill Computer: Cargo inventory is completely full.", "warning");
}
} else {
setGameState((g) => ({ ...g, miningTargetId: null }));
addConsoleLog("Drill Computer: Signal lost. Mining lasers disengaged (out of range).", "warning");
}
}
}

// --- 4. Celestial Frame Crash and Friction Safety boundary ---
// Check proximity with every planet/moon/star. If inside body radius, ship crashes!
let crashDetected = false;
let crashedBodyName = "";

// Star check
const centerDist = Math.hypot(updatedShip.x, updatedShip.y);
if (centerDist < 6.96e8 * 0.5) { // Star corona bounds
crashDetected = true;
crashedBodyName = `${activeStarRef.current.name} Photosphere`;
}

// Body checks using frame cache
for (const body of systemBodiesRef.current) {
const absByp = posCache.get(body.id);
if (!absByp) continue;
const dist = Math.hypot(updatedShip.x - absByp.x, updatedShip.y - absByp.y);
if (dist < body.radius) {
crashDetected = true;
crashedBodyName = body.name;
break;
}
}

if (crashDetected) {
// Dynamic reset of spacecraft inside orbit of Earth or nearest habitable station
const resetPos = 1.0 * AU + 2.5e7;
updatedShip.x = resetPos;
updatedShip.y = 0;
updatedShip.vx = 0;
updatedShip.vy = 29780 + 1500;
updatedShip.fuelLevel = Math.max(1000, updatedShip.fuelLevel);
updatedShip.throttlePercent = 0;
updatedShip.cargo = { water: 0, fuel: 0, ore: 0, machinery: 0, luxuries: 0, he3: 0 };
creditsVal = Math.max(500, creditsVal - 1000); // crash penalty

setIsThrusting(false);
setAutopilotMode("none");
setGameState((g) => ({ ...g, miningTargetId: null }));

addConsoleLog(`💥 CRUNCH! Spaceship breached boundary layer around ${crashedBodyName}. Space fleet pulled distress frame. Chassis refitted at Earth for 1,000¢ liability fee.`, "warning");
}

// Refresh dynamic markets slowly over time to simulate a trade economy (every 1 game day)
// Standard static/semi-periodic random increments
const updatedTimeValue = current.gameTime + gameDt;

setGameState((prev) => ({
...prev,
gameTime: updatedTimeValue,
ship: updatedShip,
playerCredits: creditsVal,
}));

frameId = requestAnimationFrame(tick);
};

frameId = requestAnimationFrame(tick);
return () => cancelAnimationFrame(frameId);
}, []);

// Command logs helper
const addConsoleLog = (text: string, type: "info" | "success" | "warning" = "info") => {
const formatted = formatGameTime(stateRef.current.gameTime);
setGameState((prev) => ({
...prev,
logs: [
{ timestamp: formatted, text, type },
...prev.logs.slice(0, 40), // cap logs at 40
],
}));
};

// Transaction action triggers
const executeBuy = (resourceId: string, amount: number) => {
if (!gameState.isDocked || !gameState.dockedPortId) return;
const portId = gameState.dockedPortId;
const localMarket = gameState.markets[portId];
if (!localMarket) return;
const resMarket = localMarket[resourceId];
if (!resMarket || resMarket.available < amount) return;

const totalCost = resMarket.buyPrice * amount;
if (gameState.playerCredits < totalCost) {
addConsoleLog("Logistics: Insufficient credits to finance cargo container.", "warning");
return;
}

// Capacity checking
let currentCargoWeight = 0;
Object.keys(gameState.ship.cargo).forEach((k) => currentCargoWeight += gameState.ship.cargo[k] || 0);
if (currentCargoWeight + amount > gameState.ship.cargoCapacity) {
addConsoleLog("Logistics: Max chassis freight weight capacity exceeded.", "warning");
return;
}

setGameState((prev) => {
const copyMarkets = { ...prev.markets };
const copyLocal = { ...copyMarkets[portId] };
copyLocal[resourceId] = {
...copyLocal[resourceId],
available: copyLocal[resourceId].available - amount,
};
copyMarkets[portId] = copyLocal;

const copyShipCargo = { ...prev.ship.cargo };
copyShipCargo[resourceId] = (copyShipCargo[resourceId] || 0) + amount;

return {
...prev,
playerCredits: prev.playerCredits - totalCost,
markets: copyMarkets,
ship: {
...prev.ship,
cargo: copyShipCargo,
},
playerProfile: {
...prev.playerProfile,
stats: { ...prev.playerProfile.stats, tonsBought: prev.playerProfile.stats.tonsBought + amount },
},
};
});

addConsoleLog(`Acquired ${amount}t of ${resMarket.name} for ${totalCost}¢. Cargo weight increased.`, "info");
};

const executeSell = (resourceId: string, amount: number) => {
if (!gameState.isDocked || !gameState.dockedPortId) return;
const portId = gameState.dockedPortId;
const localMarket = gameState.markets[portId];
if (!localMarket) return;
const resMarket = localMarket[resourceId];
if (!resMarket) return;

const shipCount = gameState.ship.cargo[resourceId] || 0;
if (shipCount < amount) return;

const payout = resMarket.sellPrice * amount;

setGameState((prev) => {
const copyMarkets = { ...prev.markets };
const copyLocal = { ...copyMarkets[portId] };
copyLocal[resourceId] = {
...copyLocal[resourceId],
available: Math.min(copyLocal[resourceId].maxCapacity, copyLocal[resourceId].available + amount),
};
copyMarkets[portId] = copyLocal;

const copyShipCargo = { ...prev.ship.cargo };
copyShipCargo[resourceId] = Math.max(0, copyShipCargo[resourceId] - amount);

const nextProfile = awardCareerXp({
...prev.playerProfile,
stats: {
...prev.playerProfile.stats,
tonsSold: prev.playerProfile.stats.tonsSold + amount,
tradeProfit: prev.playerProfile.stats.tradeProfit + Math.max(0, payout),
},
}, "trade", amount * 12);
return {
...prev,
playerCredits: prev.playerCredits + payout,
markets: copyMarkets,
ship: {
...prev.ship,
cargo: copyShipCargo,
},
playerProfile: nextProfile,
};
});

addConsoleLog(`Disposed ${amount}t of ${resMarket.name} to refinery bay. Credited +${payout}¢.`, "success");
};

// Docking triggers
const handleDockActivate = () => {
if (!selectedBody || !selectedBody.hasMarket) return;
if (!canDockAtSelectedBody) {
const activeSpecs = getDockingSpecs(selectedBody);
const maxAltKm = Math.round((activeSpecs.maxDistance - selectedBody.radius) / 1000);
addConsoleLog(
`Docking denied by ${selectedBody.stationName || selectedBody.name}: close to within ${maxAltKm.toLocaleString()} km altitude and reduce relative speed below ${activeSpecs.maxSpeed.toLocaleString()} m/s.`,
"warning"
);
return;
}

const dockingPort = pickPortForBody(selectedBody, "markets") || pickPortForBody(selectedBody);
if (!dockingPort) {
addConsoleLog(`Docking denied by ${selectedBody.stationName || selectedBody.name}: no active port record found.`, "warning");
return;
}

setAutopilotMode("none");
setIsThrusting(false);
setGameState((prev) => ({
...prev,
isDocked: true,
dockedBodyId: selectedBody.id,
dockedPortId: dockingPort.id,
miningTargetId: null,
ship: {
...prev.ship,
vx: selectedBodyVelocity.vx,
vy: selectedBodyVelocity.vy,
throttlePercent: 0,
},
}));

addConsoleLog(`✓ Spaceport tether established at ${selectedBody.stationName || selectedBody.name}. Standard atmospheres balanced. Trade networks unlocked.`, "success");
setActiveTab("market"); // Open market tab instantly upon docking for frictionless UX!
};

const handleUndockActivate = () => {
setAutopilotMode("none");
setIsThrusting(false);
setGameState((prev) => {
const dockBody = systemBodiesRef.current.find((body) => body.id === prev.dockedBodyId);
if (!dockBody) {
return {
...prev,
isDocked: false,
dockedBodyId: null,
dockedPortId: null,
ship: { ...prev.ship, throttlePercent: 0 },
};
}

const bodyPos = getAbsoluteBodyPosition(dockBody.id, systemBodiesRef.current, prev.gameTime);
const bodyVelocity = getBodyVelocity(dockBody.id, systemBodiesRef.current, prev.gameTime);
const offsetX = prev.ship.x - bodyPos.x;
const offsetY = prev.ship.y - bodyPos.y;
const offsetLength = Math.hypot(offsetX, offsetY);
const ux = offsetLength > 1 ? offsetX / offsetLength : 1;
const uy = offsetLength > 1 ? offsetY / offsetLength : 0;
const parkingRadius = (dockBody.radius ?? 0) + Math.max(1_500_000, (dockBody.radius ?? 0) * 0.08);
const targetMass = dockBody.type === "star" ? (dockBody.mass ?? 0) * 1.989e30 : (dockBody.mass ?? 0);
const circularSpeed = targetMass > 0 ? Math.sqrt((6.6743e-11 * targetMass) / Math.max(1, parkingRadius)) : 0;
const tangentX = -uy;
const tangentY = ux;

return {
...prev,
isDocked: false,
dockedBodyId: null,
dockedPortId: null,
ship: {
...prev.ship,
x: bodyPos.x + ux * parkingRadius,
y: bodyPos.y + uy * parkingRadius,
vx: bodyVelocity.vx + tangentX * circularSpeed,
vy: bodyVelocity.vy + tangentY * circularSpeed,
throttlePercent: 0,
},
};
});
addConsoleLog(`✗ Spaceport clamps released. Attitude thrusters ready. Space pressure sealed. Safe flight, Commander.`, "info");
};

// Asteroid Drilling toggle trigger
const handleToggleMining = () => {
if (!selectedBody) return;
if (gameState.miningTargetId === selectedBody.id) {
setGameState((prev) => ({ ...prev, miningTargetId: null }));
addConsoleLog("Drill Computer: Thermal laser miners offline.", "info");
} else {
setGameState((prev) => ({ ...prev, miningTargetId: selectedBody.id }));
addConsoleLog(`Drill Computer: Focused thermal drills pointing at ${selectedBody.name}. Excelsior siphons armed.`, "success");
}
};

// Accepting Space commission contracts
const handleAcceptContract = (id: string) => {
const target = gameState.contracts.find((c) => c.id === id);
setGameState((prev) => ({
...prev,
ship: target?.type === "passenger" ? { ...prev.ship, passengerCount: prev.ship.passengerCount + (target.passengerCount || 0) } : prev.ship,
contracts: prev.contracts.map((c) => (c.id === id ? { ...c, accepted: true } : c)),
}));
addConsoleLog(`operations: Commission underwritten: "${target?.title}". Check inventory grids or orbit points to satisfy objective criteria.`, "info");
};

// Delivering and claiming mission bounties
const handleCompleteContract = (id: string) => {
const contract = gameState.contracts.find((c) => c.id === id);
if (!contract || !contract.accepted || contract.completed) return;

setGameState((prev) => {
const copyShipCargo = { ...prev.ship.cargo };
if (contract.type === "delivery" && contract.cargoType) {
copyShipCargo[contract.cargoType] = Math.max(0, (copyShipCargo[contract.cargoType] || 0) - (contract.amount || 0));
}

let nextProfile = awardCareerXp({
...prev.playerProfile,
stats: { ...prev.playerProfile.stats, contractsCompleted: prev.playerProfile.stats.contractsCompleted + 1 },
}, contract.type === "passenger" ? "operations" : contract.type === "delivery" ? "trade" : "operations", Math.max(25, Math.round(contract.reward / 120)));
nextProfile = addReputation(nextProfile, contract.issuerFaction, 2);
return {
...prev,
playerCredits: prev.playerCredits + contract.reward,
ship: {
...prev.ship,
cargo: copyShipCargo,
passengerCount: contract.type === "passenger" ? Math.max(0, prev.ship.passengerCount - (contract.passengerCount || 0)) : prev.ship.passengerCount,
},
contracts: prev.contracts.map((c) => (c.id === id ? { ...c, completed: true } : c)),
playerProfile: nextProfile,
};
});

addConsoleLog(`🏆 MISSION ACCOMPLISHED: Delivered payloads or matched telemetry specifications for "${contract.title}". Credited highly valued +${contract.reward}¢ reward package!`, "success");
};

// Engineering Upgrades purchase trigger
// Since we don't store individual unlocked indices in array of State, let's track custom state of upgrades purchased
const handleUnlockUpgrade = (upgradeId: string) => {
const findUpgrade = UPGRADES.find((u) => u.id === upgradeId);
if (!findUpgrade || gameState.unlockedUpgradeIds.includes(upgradeId)) return;

if (gameState.playerCredits < findUpgrade.cost) {
addConsoleLog("Engineering: Insufficient credit allocations to authorize blueprint manufacturing.", "warning");
return;
}

setGameState((prev) => {
const updatedShipState = { ...findUpgrade.modifier(prev.ship), installedUpgradeIds: [...prev.ship.installedUpgradeIds, upgradeId] };
return {
...prev,
playerCredits: prev.playerCredits - findUpgrade.cost,
unlockedUpgradeIds: [...prev.unlockedUpgradeIds, upgradeId],
ship: updatedShipState,
};
});

addConsoleLog(`✓ UPGRADE CONCLUDED: ${findUpgrade.name} installed successfully. Space telemetry modules synced.`, "success");
};

// Interstellar Warp Drive fold jumps
const handleBuyShip = (modelId: string) => {
if (!gameState.isDocked || !gameState.dockedPortId) return;
const model = shipyardCatalog.find((entry) => entry.id == modelId);
if (!model) return;
if (gameState.playerCredits < model.baseCost) {
addConsoleLog("Shipyard ledger: insufficient credits for hull transfer.", "warning");
return;
}
const owned = createOwnedShipFromCatalog(modelId, gameState.dockedPortId);
if (!owned) return;
setGameState((prev) => ({
...prev,
playerCredits: prev.playerCredits - model.baseCost,
ownedShips: [...prev.ownedShips, owned],
}));
addConsoleLog(`Shipyard: ${owned.name} purchased and berthed at ${selectedPortName}.`, "success");
};

const handleActivateOwnedShip = (shipId: string) => {
if (!gameState.isDocked || !gameState.dockedPortId) return;
const target = gameState.ownedShips.find((entry) => entry.id === shipId);
if (!target) return;
if (target.homePortId !== gameState.dockedPortId) {
addConsoleLog("Shipyard control: requested hull is not berthed at this station/base.", "warning");
return;
}
setGameState((prev) => ({
...prev,
activeShipId: target.id,
ship: { ...target.ship, x: prev.ship.x, y: prev.ship.y, vx: prev.ship.vx, vy: prev.ship.vy, heading: prev.ship.heading },
}));
addConsoleLog(`Shipyard: active command transferred to ${target.name}.`, "success");
};

const handleWarpToStar = async (starId: string) => {
const { getOrCreatePlayableStar } = await import("./data/stars");
const dest = getOrCreatePlayableStar(starId);
if (!dest || !gameState.ship.warpCapacity) return;

// Remove 1 Helium-3 from fuel hold
const updatedCargo = { ...gameState.ship.cargo };
const currentHe3 = updatedCargo["he3"] || 0;
if (currentHe3 < 1) {
addConsoleLog("Telemetry: Fold sequence aborted. Cargo lists insufficient Helium-3 warp catalysts.", "warning");
return;
}

updatedCargo["he3"] = Math.max(0, currentHe3 - 1);

// Set spaceship inside high orbital range of new star destination
const highOrbitPos = 0.5 * AU;
const destinationMarkets = generateMarketsForStar(starId);

setGameState((prev) => ({
...prev,
activeStarId: starId,
selectedBodyId: dest.planets[0]?.id || null, // lock first planet of new star
isDocked: false,
dockedBodyId: null,
markets: {
...prev.markets,
...destinationMarkets,
},
ship: {
...prev.ship,
x: highOrbitPos,
y: 0,
vx: 0,
vy: 18000, // safe initial speed
cargo: updatedCargo,
},
}));

addConsoleLog(`🌌 COGNITIVE WAVEFOLD INITIATED: Spacetime folded relative to ${dest.name} coordinates. Quantum engine depleted 1,000kg of Helium-3. Standard space entry captures successful.`, "success");
};

const {
pressedKeys,
handleRotateShip,
setShipHeading,
setThrottlePercent,
setPowerDistribution,
} = useCockpitControls({
autopilotMode,
selectedBodyExists: !!selectedBody,
setAutopilotMode,
setGameState,
setIsThrusting,
addConsoleLog,
stateRef,
});

const mapView = (
  <StarSystemCanvas
    bodies={systemBodies}
    ship={gameState.ship}
    selectedBodyId={gameState.selectedBodyId}
    onSelectBody={(id) => setGameState((g) => ({ ...g, selectedBodyId: id }))}
    gameTime={gameState.gameTime}
    isThrusting={Math.abs(gameState.ship.throttlePercent) > 0 || autopilotMode !== "none"}
    miningActive={gameState.miningTargetId !== null}
    miningTargetId={gameState.miningTargetId}
    starColor={activeStar.color}
    uiTheme={uiTheme}
    cameraModeOverride={mapMode}
    autopilotMode={autopilotMode}
  />
);

const activePanel = (
  <GamePanels
    activeTab={activeTab}
    gameState={gameState}
    profileSummaries={profileSummaries}
    systemBodies={systemBodies}
    shipyardCatalog={shipyardCatalog}
    dockedPortInventory={dockedPortInventory}
    onSelectProfile={(profileId) => {
      const loaded = loadCommanderProfile(profileId);
      if (loaded?.ship?.cargo) setGameState(migrateLoadedState(loaded));
    }}
    onSaveProfile={() => {
      const synced = syncOwnedShips(gameState);
      saveCommanderProfile(synced, synced.profileId);
      setProfileSummaries(listCommanderProfiles());
      addConsoleLog(`Save control: commander profile saved for ${gameState.commanderName}.`, "success");
    }}
    onCreateProfile={() => {
      const name = window.prompt("Commander name?", "Commander") || "Commander";
      const fresh = createInitialState(name);
      saveCommanderProfile(fresh, fresh.profileId);
      setGameState(fresh);
      setProfileSummaries(listCommanderProfiles());
    }}
    onDeleteProfile={() => {
      if (profileSummaries.length <= 1) return;
      deleteCommanderProfile(gameState.profileId);
      const next = listCommanderProfiles();
      setProfileSummaries(next);
      const loaded = next[0] ? loadCommanderProfile(next[0].id) : null;
      if (loaded?.ship?.cargo) setGameState(migrateLoadedState(loaded));
    }}
    onBuy={executeBuy}
    onSell={executeSell}
    onDock={handleDockActivate}
    onUndock={handleUndockActivate}
    onRefuel={() => {
      const missingFuel = Math.max(0, gameState.ship.maxFuel - gameState.ship.fuelLevel);
      const tons = Math.ceil(missingFuel / 1000);
      const cost = tons * 400;
      if (!gameState.isDocked || !gameState.dockedPortId || missingFuel <= 0) return;
      if (gameState.playerCredits < cost) {
        addConsoleLog("Refuel control: insufficient credits for propellant transfer.", "warning");
        return;
      }
      setGameState((prev) => ({
        ...prev,
        playerCredits: prev.playerCredits - cost,
        ship: { ...prev.ship, fuelLevel: prev.ship.maxFuel },
        playerProfile: {
          ...prev.playerProfile,
          stats: { ...prev.playerProfile.stats, refuels: prev.playerProfile.stats.refuels + 1 },
        },
      }));
      addConsoleLog(`Refuel control: tanks topped off (+${tons}t hydrogen), debit ${cost}¢.`, "success");
    }}
    onToggleMining={handleToggleMining}
    onSelectPort={(portId) => setGameState((prev) => prev.isDocked ? { ...prev, dockedPortId: portId } : prev)}
    onBuyShip={handleBuyShip}
    onActivateShip={handleActivateOwnedShip}
    onUnlockUpgrade={handleUnlockUpgrade}
    onAcceptContract={handleAcceptContract}
    onCompleteContract={handleCompleteContract}
  />
);

  if (isInMainMenu) {
    return (
      <MainMenu
        profiles={profileSummaries}
        onSelectProfile={(profileId) => {
          const loaded = loadCommanderProfile(profileId);
          if (loaded?.ship?.cargo) {
            setGameState(migrateLoadedState(loaded));
            setIsInMainMenu(false);
          }
        }}
        onDeleteProfile={(profileId, profileName) => {
          if (window.confirm(`Are you sure you want to permanently delete Commander ${profileName}? This process is irreversible.`)) {
            deleteCommanderProfile(profileId);
            setProfileSummaries(listCommanderProfiles());
          }
        }}
        onCreateProfile={({ name, starId, profession }) => {
          const newState = createCustomInitialState(name, starId, profession);
          saveCommanderProfile(newState, newState.profileId);
          setGameState(newState);
          setProfileSummaries(listCommanderProfiles());
          setIsInMainMenu(false);
        }}
        uiTheme={uiTheme}
        setUiTheme={setUiTheme}
      />
    );
  }

return (
<EliteCockpitHud
gameState={gameState}
activeStar={activeStar}
selectedBody={selectedBody}
canDock={canDockAtSelectedBody}
dockingDistance={dockingDistance}
dockingRelativeSpeed={dockingRelativeSpeed}
targetBearing={targetBearing}
domGravityName={domGravity.body ? domGravity.body.name : activeStar.name}
relativeOrbit={relativeOrbit}
mapView={mapView}
mapMode={mapMode}
setMapMode={setMapMode}
activePanel={activePanel}
activeTab={activeTab}
setActiveTab={setActiveTab}
uiTheme={uiTheme}
setUiTheme={setUiTheme}
autopilotMode={autopilotMode}
setAutopilotMode={setAutopilotMode}
setThrottlePercent={setThrottlePercent}
setPowerDistribution={setPowerDistribution}
setTimeScale={(value) => setGameState((g) => ({ ...g, timeScale: value }))}
onSetShipHeading={setShipHeading}
onClearTarget={() => setGameState((g) => ({ ...g, selectedBodyId: null }))}
onDock={handleDockActivate}
onUndock={handleUndockActivate}
onToggleMining={handleToggleMining}
onExitToMainMenu={() => setIsInMainMenu(true)}
/>
);
}



