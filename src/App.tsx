/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import { useState, useEffect, useMemo, useRef, useCallback, type SetStateAction } from "react";
import { StarSystemCanvas } from "./components/StarSystemCanvas";
import { GalacticMap } from "./components/GalacticMap";
import { EliteCockpitHud } from "./components/EliteCockpitHud";
import { DockingSequenceModal } from "./components/DockingSequenceModal";
import { TutorialHud } from "./components/TutorialHud";
import { STARS, AU, getOrCreatePlayableStar } from "./data/stars";
import { MainMenu } from "./components/MainMenu";
import { createInitialState, formatGameTime, normalizeCargoManifest, RESOURCE_TYPES, UPGRADES, generateMarketsForStar } from "./utils/gameData";
import { DEFAULT_POWER_DISTRIBUTION } from "./data/ships";
import { GameState, CelestialBody, SpaceContract, TutorialStepId } from "./types";
import { getDominantGravitySource, integrateSpacecraft, computeOrbitMetrics, getAbsoluteBodyPosition, getBodyVelocity, buildBodyPositionCache, BodyPosCache, getDockingSpecs, getShipCargoMassKg, getSphereOfInfluence, propagateKeplerianCoast, resolveOrbitReferenceBody } from "./utils/physics";
import { awardCareerXp, addReputation } from "./utils/progression";
import { refreshMarkets } from "./utils/economy";
import { canScanBody, getTotalSurveyDataValue, recordStarDiscovery, scanBody } from "./utils/exploration";
import { expireAcceptedContracts, getContractCompletionStatus, refreshContractsForPorts } from "./utils/contracts";
import {
  buildUndockState,
  type DockingClearanceState,
  type DockingDepartureLock,
  getDockingParkingRadius,
  hasClearedDepartureLock,
  isDepartureLockActive,
} from "./utils/docking";
import { applyMiningYield, isMineableBody } from "./utils/mining";
import {
  completeTutorialStep,
  formatTutorialRewardLabel,
  getFirstIncompleteTutorialStep,
  reconcileFirstPaidRunTutorialContract,
  TUTORIAL_CONTRACT_ID,
  TUTORIAL_STEP_TITLES,
} from "./utils/tutorial";
import { listCommanderProfiles, loadBestAvailableProfile, loadCommanderProfile, loadLegacySingleSave, saveCommanderProfile, deleteCommanderProfile, clearLegacySingleSave } from "./utils/saveSystem";
import { createOwnedShipFromCatalog, getShipyardCatalog } from "./utils/shipManagement";
import { computeApproachGuidance } from "./utils/spaceFlightAutopilot";
import type { ApproachGuidance } from "./utils/spaceFlightAutopilot";
import { computeTransferGuidance } from "./utils/transferPlanner";
import { getPortsForBody, pickDockingPortForBody, pickPortForBody, getAllPortsForBodies } from "./utils/worldText";
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
Anchor,
AlertTriangle,
RotateCw,
Terminal,
Activity,
History
} from "lucide-react";

const DOCKING_HOLD_SECONDS = 4;
const MAX_HEADING_STEP_PER_FRAME = 0.35; // cap game-time rotation so high warp cannot snap headings instantly
const METERS_PER_LIGHT_YEAR = 9.4607e15;
const SYSTEM_ESCAPE_RADIUS_METERS = 50 * AU;
const STAR_ARRIVAL_RADIUS_LY = 0.02;
const SUN_RADIUS_METERS = 6.957e8;
const CIRCULARIZE_SUCCESS_ECCENTRICITY = 0.12;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const angleDelta = (target: number, current: number) => Math.atan2(Math.sin(target - current), Math.cos(target - current));
const segmentDistance = (
  ax: number,
  ay: number,
  bx: number,
  by: number,
  px: number,
  py: number
) => {
  const abx = bx - ax;
  const aby = by - ay;
  const ab2 = abx * abx + aby * aby;
  if (ab2 <= 1e-9) return Math.hypot(px - ax, py - ay);
  const t = clamp(((px - ax) * abx + (py - ay) * aby) / ab2, 0, 1);
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
};

const getDockingApproachHeading = (
  ship: GameState["ship"],
  body: CelestialBody,
  bodyPos: { x: number; y: number },
  bodyVelocity: { vx: number; vy: number }
) => {
  const offsetX = ship.x - bodyPos.x;
  const offsetY = ship.y - bodyPos.y;
  const distance = Math.max(1, Math.hypot(offsetX, offsetY));
  const ux = offsetX / distance;
  const uy = offsetY / distance;
  const tangentX = -uy;
  const tangentY = ux;
  const relVx = ship.vx - bodyVelocity.vx;
  const relVy = ship.vy - bodyVelocity.vy;
  const tangentialSpeed = relVx * tangentX + relVy * tangentY;
  const orbitSign = Math.abs(tangentialSpeed) > 1 ? Math.sign(tangentialSpeed) : 1;
  return Math.atan2(tangentY * orbitSign, tangentX * orbitSign);
};

const getCargoUsedTons = (ship: GameState["ship"]) =>
  Object.values(ship.cargo).reduce((total, amount) => total + (amount || 0), 0);

const getActiveFlightTutorialCompletion = (
  state: GameState,
  ship: GameState["ship"],
  bodies: CelestialBody[],
  gameTime: number,
  throttlePercent: number,
): TutorialStepId | null => {
  if (state.tutorialSkipped || state.tutorialCompleted || !state.activeTutorialStep || state.isDocked) return null;

  if (state.activeTutorialStep === "bay-clearance") {
    const startBody = state.tutorialStartBodyId ? bodies.find((body) => body.id === state.tutorialStartBodyId) : null;
    if (!startBody) return null;
    const startPos = getAbsoluteBodyPosition(startBody.id, bodies, gameTime);
    const distance = Math.hypot(ship.x - startPos.x, ship.y - startPos.y);
    return distance > getDockingSpecs(startBody).maxDistance * 1.05 ? "bay-clearance" : null;
  }

  const targetBody = state.tutorialTargetBodyId ? bodies.find((body) => body.id === state.tutorialTargetBodyId) : null;
  if (!targetBody || state.selectedBodyId !== targetBody.id) return null;
  const targetPos = getAbsoluteBodyPosition(targetBody.id, bodies, gameTime);
  const targetVelocity = getBodyVelocity(targetBody.id, bodies, gameTime);
  const dx = targetPos.x - ship.x;
  const dy = targetPos.y - ship.y;
  const distance = Math.hypot(dx, dy);
  const relSpeed = Math.hypot(ship.vx - targetVelocity.vx, ship.vy - targetVelocity.vy);
  const targetBearing = Math.atan2(dy, dx);
  const targetAlignment = Math.cos(angleDelta(targetBearing, ship.heading));
  const targetDockingSpecs = getDockingSpecs(targetBody);

  if (state.activeTutorialStep === "hold-vector") {
    return Math.abs(throttlePercent) >= 5 && targetAlignment > 0.5 ? "hold-vector" : null;
  }

  if (state.activeTutorialStep === "match-speed") {
    const approachDistance = Math.max(targetDockingSpecs.maxDistance * 8, (targetBody.radius ?? 0) + 5_000_000);
    const approachSpeed = Math.max(targetDockingSpecs.maxSpeed * 1.25, 450);
    return distance <= approachDistance && relSpeed <= approachSpeed ? "match-speed" : null;
  }

  return null;
};

const formatTutorialProgressLog = (
  stepId: TutorialStepId,
  nextStep: TutorialStepId | null,
  reward: ReturnType<typeof completeTutorialStep>["reward"],
) => {
  const rewardLabel = formatTutorialRewardLabel(reward);
  const rewardText = rewardLabel ? ` Awarded ${rewardLabel}.` : "";
  const nextText = nextStep ? ` Next: ${TUTORIAL_STEP_TITLES[nextStep]}.` : " Flight training complete.";
  return `Flight Training: ${TUTORIAL_STEP_TITLES[stepId]} certified.${rewardText}${nextText}`;
};

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
const [requestedManagementTab, setRequestedManagementTab] = useState<"dock-main" | "market" | "upgrades" | "contracts" | null>(null);
const [mapMode, setMapMode] = useState<"star" | "ship" | "target" | "galaxy">("star");
const [isThrusting, setIsThrusting] = useState<boolean>(false);
const [showDockingSequence, setShowDockingSequence] = useState(false);
const [pendingDockingCompletion, setPendingDockingCompletion] = useState<{
  bodyId: string;
  portId: string;
  ship: GameState["ship"];
} | null>(null);
// Written every tick by the autopilot; the HUD reads it via the 10 Hz snapshot below.
const approachGuidanceRef = useRef<ApproachGuidance | null>(null);
// Effective warp actually applied this tick and why it was limited, for the HUD readout.
const warpStatusRef = useRef<{ effective: number; reason: "dock-hold" | "ap-guard" | "proximity" | null }>({ effective: 1, reason: null });
const fpsCounterRef = useRef({ frames: 0, startedAt: performance.now(), value: 0 });
const [dockingClearance, setDockingClearance] = useState<DockingClearanceState | null>(null);

// Customizable Cockpit UI Theme State
const [uiTheme, setUiTheme] = useState<"amber" | "blue" | "green" | "red">(() => {
return (localStorage.getItem("newtonian_theme") as any) || "amber";
});

// Settings: fuel simulation toggle (off = free testing flights, tanks never drain)
const [fuelSimEnabled, setFuelSimEnabled] = useState<boolean>(() => localStorage.getItem("newtonian_fuel_sim") !== "off");
const fuelSimRef = useRef(fuelSimEnabled);
useEffect(() => {
  fuelSimRef.current = fuelSimEnabled;
  localStorage.setItem("newtonian_fuel_sim", fuelSimEnabled ? "on" : "off");
}, [fuelSimEnabled]);

// Custom Autopilot Toggles
const [autopilotMode, setAutopilotMode] = useState<"none" | "match-speed" | "circularize" | "align-target" | "approach-target" | "goto-target" | "hold-prograde" | "hold-retrograde" | "hold-radial-out" | "hold-radial-in" | "hold-anti-target">("none");

const syncOwnedShips = (state: GameState): GameState => ({
...state,
ownedShips: state.ownedShips.map((entry) => entry.id === state.activeShipId ? { ...entry, name: state.ship.name, ship: state.ship } : entry),
});

// References for rapid simulation tick updates to avoid closure issues
const stateRef = useRef(gameState);
const commitGameState = useCallback((updater: SetStateAction<GameState>, renderNow = true) => {
  const next = typeof updater === "function"
    ? (updater as (state: GameState) => GameState)(stateRef.current)
    : updater;

  stateRef.current = next;

  if (renderNow) {
    setGameState(next);
  }

  return next;
}, []);
const autopilotRef = useRef(autopilotMode);
autopilotRef.current = autopilotMode;
const dockingClearanceRef = useRef(dockingClearance);
dockingClearanceRef.current = dockingClearance;
const departureLockRef = useRef<DockingDepartureLock | null>(null);
const applyDockingClearance = useCallback((next: DockingClearanceState | null) => {
  dockingClearanceRef.current = next;
  setDockingClearance(next);
}, []);
const showDockingSequenceRef = useRef(showDockingSequence);
showDockingSequenceRef.current = showDockingSequence;
const tutorialManifestBlockedRef = useRef(false);
useEffect(() => {
if (!gameState.isDocked || dockingClearance === null) return;
applyDockingClearance(null);
}, [applyDockingClearance, gameState.isDocked, dockingClearance]);
useEffect(() => {
if (!gameState.isDocked) return;
departureLockRef.current = null;
}, [gameState.isDocked]);
useEffect(() => {
  const result = reconcileFirstPaidRunTutorialContract(stateRef.current);
  if (result.changed) {
    tutorialManifestBlockedRef.current = false;
    commitGameState(result.state);
    const loadedText = result.loadedCargoTons > 0 ? ` Loaded ${result.loadedCargoTons}t manifest cargo.` : "";
    addConsoleLog(`Training Desk: First Paid Run manifest active.${loadedText} Deliver it and submit from the contract board.`, "info");
    return;
  }
  if (result.blocked && !tutorialManifestBlockedRef.current) {
    tutorialManifestBlockedRef.current = true;
    addConsoleLog("Training Desk: clear 1t cargo space so the First Paid Run manifest can be loaded.", "warning");
    return;
  }
  if (!result.blocked) {
    tutorialManifestBlockedRef.current = false;
  }
}, [
  commitGameState,
  gameState.activeTutorialStep,
  gameState.contracts,
  gameState.ship.cargo,
  gameState.ship.cargoCapacity,
  gameState.ship.cargoCapacityTons,
  gameState.tutorialCompleted,
  gameState.tutorialSkipped,
]);
useEffect(() => {
if (!gameState.isDocked || gameState.timeScale === 1) return;
commitGameState((prev) => (prev.isDocked && prev.timeScale !== 1 ? { ...prev, timeScale: 1 } : prev));
}, [commitGameState, gameState.isDocked, gameState.timeScale]);
const pressedKeysRef = useRef({ thrust: false, steerLeft: false, steerRight: false, circMode: false, matchMode: false });

// The DOM cockpit re-renders from this 10 Hz snapshot instead of every animation frame;
// only the canvas map needs per-frame data. Text readouts at 10 Hz are indistinguishable.
const [hudSnapshot, setHudSnapshot] = useState<{
  state: GameState;
  guidance: ApproachGuidance | null;
  warp: { effective: number; reason: "dock-hold" | "ap-guard" | "proximity" | null };
  fps: number;
}>(() => ({ state: gameState, guidance: null, warp: { effective: 1, reason: null }, fps: 0 }));
useEffect(() => {
  const id = setInterval(() => {
    setGameState(stateRef.current);
    setHudSnapshot({
      state: stateRef.current,
      guidance: approachGuidanceRef.current,
      warp: warpStatusRef.current,
      fps: fpsCounterRef.current.value,
    });
  }, 100);
  return () => clearInterval(id);
}, []);

const getFrameState = useCallback(() => stateRef.current, []);

useEffect(() => {
  const persist = () => {
    const current = stateRef.current;
    const synced = syncOwnedShips(current);
    saveCommanderProfile(synced, synced.profileId);
    setProfileSummaries(listCommanderProfiles());
  };
  // localStorage writes are synchronous and stall the frame loop, so autosave
  // sparingly and flush on tab close instead of hammering every few seconds.
  const interval = setInterval(persist, 30000);
  window.addEventListener("beforeunload", persist);
  return () => {
    clearInterval(interval);
    window.removeEventListener("beforeunload", persist);
  };
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

// Selected object info — HUD-facing orbital math runs on the 10 Hz snapshot, not per frame.
const hudState = hudSnapshot.state;
const dockedBody = useMemo(
  () => (gameState.dockedBodyId ? systemBodies.find((body) => body.id === gameState.dockedBodyId) || null : null),
  [gameState.dockedBodyId, systemBodies],
);
const dockedPortRecord = useMemo(() => {
  if (!gameState.dockedBodyId || !gameState.dockedPortId) return null;
  return dockedBody ? getPortsForBody(dockedBody).find((port) => port.id === gameState.dockedPortId) || null : null;
}, [dockedBody, gameState.dockedBodyId, gameState.dockedPortId]);
const pendingDockingBody = useMemo(
  () => (pendingDockingCompletion ? systemBodies.find((body) => body.id === pendingDockingCompletion.bodyId) || null : null),
  [pendingDockingCompletion, systemBodies],
);
const pendingDockingPort = useMemo(() => {
  if (!pendingDockingCompletion || !pendingDockingBody) return null;
  return getPortsForBody(pendingDockingBody).find((port) => port.id === pendingDockingCompletion.portId) || null;
}, [pendingDockingBody, pendingDockingCompletion]);
const dockedFactionReputation = dockedPortRecord ? gameState.playerProfile.reputation[dockedPortRecord.faction] || 0 : 0;
const galacticMapUnlocked = gameState.ship.warpCapacity && gameState.ship.installedUpgradeIds.includes("galactic_chart");
const shipyardCatalog = getShipyardCatalog().filter((entry) => (
  dockedPortRecord && dockedPortRecord.services.includes("shipyard")
    ? dockedFactionReputation >= 8 || entry.baseCost <= (dockedFactionReputation >= 4 ? 20000 : 10000)
    : true
));
const selectedPortName = dockedPortRecord?.name || gameState.dockedPortId || "current port";
const dockedPortInventory = gameState.ownedShips.filter((entry) => entry.homePortId === gameState.dockedPortId);
const hudDerived = useMemo(() => {
  const selectedBody = systemBodies.find((b) => b.id === hudState.selectedBodyId) || null;
  const selectedBodyPosition = selectedBody
    ? getAbsoluteBodyPosition(selectedBody.id, systemBodies, hudState.gameTime)
    : null;
  const selectedBodyVelocity = selectedBody
    ? getBodyVelocity(selectedBody.id, systemBodies, hudState.gameTime)
    : { vx: 0, vy: 0 };
  const dockingDistance = selectedBodyPosition
    ? Math.hypot(hudState.ship.x - selectedBodyPosition.x, hudState.ship.y - selectedBodyPosition.y)
    : Infinity;
  const dockingRelativeSpeed = selectedBody
    ? Math.hypot(hudState.ship.vx - selectedBodyVelocity.vx, hudState.ship.vy - selectedBodyVelocity.vy)
    : Infinity;
  const targetBearing = selectedBodyPosition
    ? Math.atan2(selectedBodyPosition.y - hudState.ship.y, selectedBodyPosition.x - hudState.ship.x)
    : null;
  const dockingSpecs = getDockingSpecs(selectedBody);
  const selectedBodyPorts = getPortsForBody(selectedBody);
  const canDockAtSelectedBody = !!selectedBody &&
    selectedBodyPorts.length > 0 &&
    dockingDistance < dockingSpecs.maxDistance &&
    dockingRelativeSpeed < dockingSpecs.maxSpeed;
  const domGravity = getDominantGravitySource(
    hudState.ship.x,
    hudState.ship.y,
    systemBodies,
    hudState.gameTime,
    activeStar.mass * 1.989e30
  );
  const orbitReferenceBody = resolveOrbitReferenceBody(selectedBody, domGravity.body || systemBodies[0], systemBodies);
  const relativeOrbit = computeOrbitMetrics(
    hudState.ship,
    orbitReferenceBody,
    systemBodies,
    hudState.gameTime
  );
  return {
    selectedBody,
    selectedBodyPorts,
    dockingDistance,
    dockingRelativeSpeed,
    targetBearing,
    canDockAtSelectedBody,
    domGravity,
    relativeOrbit,
  };
}, [hudState, systemBodies, activeStar]);
const {
  selectedBody,
  selectedBodyPorts,
  dockingDistance,
  dockingRelativeSpeed,
  targetBearing,
  canDockAtSelectedBody,
  domGravity,
  relativeOrbit,
} = hudDerived;
const departureLockedAtSelectedBody = !!selectedBody
  && isDepartureLockActive(departureLockRef.current, selectedBody.id, hudState.ship, systemBodies, hudState.gameTime);
const canScanSelectedBody = canScanBody(gameState.ship, selectedBody, systemBodies, gameState.gameTime);
const selectedBodyScanned = !!selectedBody && gameState.scannedBodyIds.includes(selectedBody.id);
const surveyDataValue = getTotalSurveyDataValue(gameState.surveyDataByBody);

useEffect(() => {
  if (!galacticMapUnlocked && mapMode === "galaxy") {
    setMapMode("star");
  }
}, [galacticMapUnlocked, mapMode]);

const activeTheme = THEMES[uiTheme];

// Unified Game loop
useEffect(() => {
  let lastTime = performance.now();
  let frameId: number;

  const tick = async () => {
const now = performance.now();
// Clamp the frame delta: a GC pause, autosave write or background tab otherwise
// multiplies into a huge game-time jump at high warp (1 s stall x 86400 = a day).
const realDt = Math.min((now - lastTime) / 1000, 0.1);
lastTime = now;
const fpsCounter = fpsCounterRef.current;
fpsCounter.frames += 1;
const fpsElapsed = now - fpsCounter.startedAt;
if (fpsElapsed >= 500) {
fpsCounter.value = Math.round((fpsCounter.frames / fpsElapsed) * 1000);
fpsCounter.frames = 0;
fpsCounter.startedAt = now;
}

// Ensure stable framerate ticks
if (realDt <= 0) {
frameId = requestAnimationFrame(tick);
return;
}

const current = stateRef.current;
if (showDockingSequenceRef.current) {
frameId = requestAnimationFrame(tick);
return;
}
let gameDt = realDt * current.timeScale; // Game seconds elapsed; safety guards may clamp this below.

    // Build position cache once per tick â€” all physics calls reuse this
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
const destinationPorts = getAllPortsForBodies(dest.planets).filter((port) => port.services.includes("contracts"));
setAutopilotMode("none");
commitGameState((prev) => {
const discovery = recordStarDiscovery(prev.playerProfile, prev.discoveredStarIds, arrivalStar.id);
return ({
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
contracts: refreshContractsForPorts(prev.contracts, destinationPorts, current.gameTime + gameDt, discovery.playerProfile.reputation),
contractsLastRefreshDay: Math.floor((current.gameTime + gameDt) / 86400),
ship: {
...prev.ship,
x: SYSTEM_ESCAPE_RADIUS_METERS * 0.8,
y: 0,
vx: 0,
vy: 18000,
throttlePercent: 0,
},
playerProfile: {
...discovery.playerProfile,
totalPlayTimeSec: discovery.playerProfile.totalPlayTimeSec + realDt,
},
discoveredStarIds: discovery.discoveredStarIds,
});
});
addConsoleLog(`Navigation: Entered ${arrivalStar.name} local frame. System bodies resolved from star database.`, "success");
} else {
commitGameState((prev) => ({
...prev,
gameTime: current.gameTime + gameDt,
activeStarId: current.interstellar?.originStarId ?? prev.activeStarId,
interstellar: current.interstellar ? { ...current.interstellar, xLy: nextX, yLy: nextY } : null,
playerProfile: { ...prev.playerProfile, totalPlayTimeSec: prev.playerProfile.totalPlayTimeSec + realDt },
}), false);
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
        const parkingRadius = getDockingParkingRadius(dockBody);
        const ux = offsetLength > 1 ? offsetX / offsetLength : 1;
        const uy = offsetLength > 1 ? offsetY / offsetLength : 0;

        if (autopilotRef.current !== "none") {
          setAutopilotMode("none");
        }
        setIsThrusting(false);
        commitGameState((prev) => ({
          ...prev,
          gameTime: current.gameTime + gameDt,
          miningTargetId: null,
          playerProfile: { ...prev.playerProfile, totalPlayTimeSec: prev.playerProfile.totalPlayTimeSec + realDt },
          ship: {
            ...prev.ship,
            x: dockPos.x + ux * parkingRadius,
            y: dockPos.y + uy * parkingRadius,
            vx: dockVelocity.vx,
            vy: dockVelocity.vy,
            throttlePercent: 0,
          },
        }), false);

        frameId = requestAnimationFrame(tick);
        return;
      }
    }

    // --- 1. Autopilot Core Control Loop ---
    let targetHeading = current.ship.heading;
    const attitudeHoldModes = new Set(["align-target", "hold-prograde", "hold-retrograde", "hold-radial-out", "hold-radial-in", "hold-anti-target"]);
    let throttleCommand = (autopilotRef.current === "none" || attitudeHoldModes.has(autopilotRef.current))
      ? current.ship.throttlePercent
      : 0;
    // Guidance runs once per frame, so at high warp one frame can cover millions of km
    // and blow straight past the brake point. Transfer/approach modes set this guard to
    // cap the time step at ~5% of time-to-target (KSP-style auto warp-down near events).
    let autopilotTimeGuardSeconds: number | null = null;

    const tickDomGravity = getDominantGravitySource(
      current.ship.x,
      current.ship.y,
      systemBodiesRef.current,
      current.gameTime,
      activeStarRef.current.mass * 1.989e30,
      posCache
    );
    const selectedTickBody = systemBodiesRef.current.find((b) => b.id === current.selectedBodyId) || null;
    const orbitReferenceBody = resolveOrbitReferenceBody(
      selectedTickBody,
      tickDomGravity.body || systemBodiesRef.current[0],
      systemBodiesRef.current
    );
    const activeTargetBody = selectedTickBody || tickDomGravity.body || orbitReferenceBody;

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
      // Bearing must come from this tick's data: the loop closure is created once on
      // mount, so the render-scope targetBearing would be frozen at its mount value.
      const tickTargetBearing = current.selectedBodyId ? Math.atan2(-dy, -dx) : null;
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
        if (!orbitReferenceBody) {
          throttleCommand = 0;
          setAutopilotMode("none");
          addConsoleLog("Autopilot: Circularize aborted (no valid gravity reference).", "warning");
        } else {
        const orbitBodyPos = posCache.get(orbitReferenceBody.id) || getAbsoluteBodyPosition(orbitReferenceBody.id, systemBodiesRef.current, current.gameTime);
        const orbitBodyVelocity = getBodyVelocity(orbitReferenceBody.id, systemBodiesRef.current, current.gameTime);
        const orbitDx = current.ship.x - orbitBodyPos.x;
        const orbitDy = current.ship.y - orbitBodyPos.y;
        const orbitRelVx = current.ship.vx - orbitBodyVelocity.vx;
        const orbitRelVy = current.ship.vy - orbitBodyVelocity.vy;
        const tickRelativeOrbit = computeOrbitMetrics(
          current.ship,
          orbitReferenceBody,
          systemBodiesRef.current,
          current.gameTime,
          posCache
        );
        // Circularize around the valid gravity body. Station targets resolve to parent bodies.
        const G_const = 6.6743e-11;
        const bodyMass = orbitReferenceBody.type === "star" ? orbitReferenceBody.mass * 1.989e30 : orbitReferenceBody.mass;
        const dist = Math.hypot(orbitDx, orbitDy);
        const safeDist = Math.max(1, dist);
        const v_circular = bodyMass && bodyMass > 0 ? Math.sqrt((G_const * bodyMass) / safeDist) : 0;
        const orbitalDirection = orbitDx * orbitRelVy - orbitDy * orbitRelVx >= 0 ? 1 : -1;
        const tangentX = (-orbitDy / safeDist) * orbitalDirection;
        const tangentY = (orbitDx / safeDist) * orbitalDirection;
        const desiredRelVx = tangentX * v_circular;
        const desiredRelVy = tangentY * v_circular;
        desiredDeltaVx = desiredRelVx - orbitRelVx;
        desiredDeltaVy = desiredRelVy - orbitRelVy;
        const speedError = Math.hypot(desiredDeltaVx, desiredDeltaVy);
        const hasBoundOrbit = !!tickRelativeOrbit &&
          tickRelativeOrbit.eccentricity < CIRCULARIZE_SUCCESS_ECCENTRICITY &&
          tickRelativeOrbit.apoapsisAltitude !== null &&
          tickRelativeOrbit.periapsisAltitude > 0;

        if (speedError > 15) {
          targetHeading = Math.atan2(desiredDeltaVy, desiredDeltaVx);
          const angleError = Math.abs(angleDelta(targetHeading, current.ship.heading));
          throttleCommand = angleError < 0.35 ? clamp((speedError / 3000) * 100, 8, 65) : 0;
        } else if (hasBoundOrbit) {
          throttleCommand = 0;
          setAutopilotMode("none");
          addConsoleLog(`Autopilot: Orbit circularized around ${orbitReferenceBody.name}. Eccentricity: ${tickRelativeOrbit.eccentricity.toFixed(3)}`, "success");
        } else {
          throttleCommand = 0;
          setAutopilotMode("none");
          addConsoleLog(`Autopilot: Circularize paused around ${orbitReferenceBody.name}; orbit not closed. Eccentricity: ${tickRelativeOrbit?.eccentricity.toFixed(3) ?? "unknown"}`, "warning");
        }
        }
} else if (autopilotRef.current === "align-target") {
// Steer towards target bearing and keep manual throttle control active!
if (tickTargetBearing !== null) {
targetHeading = tickTargetBearing;
} else {
throttleCommand = 0;
setAutopilotMode("none");
addConsoleLog("Autopilot: Target alignment disengaged (no active target).", "warning");
}
} else if (autopilotRef.current === "hold-anti-target") {
if (tickTargetBearing !== null) {
targetHeading = tickTargetBearing + Math.PI;
} else {
throttleCommand = 0;
setAutopilotMode("none");
addConsoleLog("Autopilot: Anti-target hold disengaged (no active target).", "warning");
}
} else if (autopilotRef.current === "hold-prograde") {
const velocityReferenceBody = orbitReferenceBody || tickDomGravity.body || systemBodiesRef.current[0];
const velocityReference = velocityReferenceBody
? getBodyVelocity(velocityReferenceBody.id, systemBodiesRef.current, current.gameTime)
: { vx: 0, vy: 0 };
const progradeVx = current.ship.vx - velocityReference.vx;
const progradeVy = current.ship.vy - velocityReference.vy;
const speed = Math.hypot(progradeVx, progradeVy);
if (speed > 0.1) targetHeading = Math.atan2(progradeVy, progradeVx);
} else if (autopilotRef.current === "hold-retrograde") {
const velocityReferenceBody = orbitReferenceBody || tickDomGravity.body || systemBodiesRef.current[0];
const velocityReference = velocityReferenceBody
? getBodyVelocity(velocityReferenceBody.id, systemBodiesRef.current, current.gameTime)
: { vx: 0, vy: 0 };
const progradeVx = current.ship.vx - velocityReference.vx;
const progradeVy = current.ship.vy - velocityReference.vy;
const speed = Math.hypot(progradeVx, progradeVy);
if (speed > 0.1) targetHeading = Math.atan2(progradeVy, progradeVx) + Math.PI;
} else if (autopilotRef.current === "hold-radial-out" || autopilotRef.current === "hold-radial-in") {
const radialBody = tickDomGravity.body || systemBodiesRef.current[0];
const radialPos = posCache.get(radialBody.id) || getAbsoluteBodyPosition(radialBody.id, systemBodiesRef.current, current.gameTime);
const radialHeading = Math.atan2(current.ship.y - radialPos.y, current.ship.x - radialPos.x);
targetHeading = autopilotRef.current === "hold-radial-out" ? radialHeading : radialHeading + Math.PI;
} else if (autopilotRef.current === "goto-target") {
if (current.selectedBodyId) {
const bodyRadius = activeTargetBody.radius ?? 0;
const shipMass = current.ship.dryMass + current.ship.fuelLevel + getShipCargoMassKg(current.ship);
const maxAccel = current.ship.engineThrust / shipMass;
const targetMass = activeTargetBody.type === "star"
? (activeTargetBody.mass ?? 0) * 1.989e30
: (activeTargetBody.mass ?? 0);
const activeSpecs = getDockingSpecs(activeTargetBody);
const terminalDistance = Math.max(activeSpecs.maxDistance * 8, bodyRadius + 20_000_000);
const guidance = computeTransferGuidance({
dx,
dy,
relVx,
relVy,
maxAcceleration: maxAccel,
targetMass,
bodyRadius,
terminalDistance,
terminalSpeed: Math.max(25, activeSpecs.maxSpeed * 0.5),
deltaVBudget: current.ship.engineIsp * 9.80665 * Math.log(shipMass / Math.max(1, current.ship.dryMass)),
});
if (guidance.phase === "arrived") {
const terminalGuidance = computeApproachGuidance({
dx,
dy,
relVx,
relVy,
maxAcceleration: maxAccel,
arrivalDistance: activeSpecs.maxDistance * 0.9,
arrivalSpeed: Math.max(50, activeSpecs.maxSpeed * 0.35),
safetyDistance: 400000,
maxCruiseClosingSpeed: 4500,
stationApproach: activeTargetBody.type === "station",
currentHeading: current.ship.heading,
targetMass,
bodyRadius,
});
approachGuidanceRef.current = terminalGuidance;
if (terminalGuidance.etaSeconds !== null && Number.isFinite(terminalGuidance.etaSeconds)) {
autopilotTimeGuardSeconds = Math.max(realDt, terminalGuidance.etaSeconds * 0.05);
}

if (terminalGuidance.phase === "arrived") {
throttleCommand = 0;
setAutopilotMode("none");
addConsoleLog(`Autopilot: GO TO complete around ${activeTargetBody.name || "target"}. Velocity matched within docking envelope.`, "success");
} else {
targetHeading = terminalGuidance.targetHeading;
const angleError = Math.abs(angleDelta(targetHeading, current.ship.heading));
throttleCommand = angleError < 0.25 ? terminalGuidance.throttlePercent : 0;
}
} else {
approachGuidanceRef.current = guidance;
if (guidance.etaSeconds !== null && Number.isFinite(guidance.etaSeconds)) {
autopilotTimeGuardSeconds = Math.max(realDt, guidance.etaSeconds * 0.05);
}
targetHeading = guidance.targetHeading;
const angleError = Math.abs(angleDelta(targetHeading, current.ship.heading));
throttleCommand = angleError < 0.25 ? guidance.throttlePercent : 0;
}
} else {
throttleCommand = 0;
setAutopilotMode("none");
addConsoleLog("Autopilot: Go-to-body aborted (no active target selected).", "warning");
}
} else if (autopilotRef.current === "approach-target") {
// APPR: Newtonian automatic approach and docking deceleration assist!
if (current.selectedBodyId) {
const bodyRadius = activeTargetBody.radius ?? 0;
const shipMass = current.ship.dryMass + current.ship.fuelLevel + getShipCargoMassKg(current.ship);
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
arrivalSpeed: Math.max(50, activeSpecs.maxSpeed * 0.35),
safetyDistance: 400000,
maxCruiseClosingSpeed: 4500,
stationApproach: activeTargetBody.type === "station",
currentHeading: current.ship.heading,
targetMass,
bodyRadius,
});
approachGuidanceRef.current = guidance;
if (guidance.etaSeconds !== null && Number.isFinite(guidance.etaSeconds)) {
autopilotTimeGuardSeconds = Math.max(realDt, guidance.etaSeconds * 0.05);
}

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
} else {
approachGuidanceRef.current = null;
}

// Keep ship rotating towards target headings with the same hull rate used for manual steering.
let finalHeading = current.ship.heading;
const steeringEnginePips = current.ship.powerDistribution?.engines ?? DEFAULT_POWER_DISTRIBUTION.engines;
const hullTurnRate = ((current.ship.yawDegPerSec ?? current.ship.pitchDegPerSec ?? 16) * Math.PI) / 180;
// Smart proximity warp-down for ANY closing approach, manual or autopilot:
// keep at least ~REACTION_REAL_SECONDS of real time before surface contact at the
// current closing rate, so the pilot can react and dock instead of colliding.
const REACTION_REAL_SECONDS = 6;
let proximityGuardSeconds: number | null = null;
if (!current.isDocked) {
const guardBodies: CelestialBody[] = [];
const guardSelected = current.selectedBodyId ? systemBodiesRef.current.find((b) => b.id === current.selectedBodyId) : null;
if (guardSelected) guardBodies.push(guardSelected);
if (tickDomGravity.body && tickDomGravity.body.id !== guardSelected?.id) guardBodies.push(tickDomGravity.body);
for (const guardBody of guardBodies) {
const guardPos = posCache.get(guardBody.id) || getAbsoluteBodyPosition(guardBody.id, systemBodiesRef.current, current.gameTime);
const guardVel = getBodyVelocity(guardBody.id, systemBodiesRef.current, current.gameTime);
const offsetX = current.ship.x - guardPos.x;
const offsetY = current.ship.y - guardPos.y;
const relVelX = current.ship.vx - guardVel.vx;
const relVelY = current.ship.vy - guardVel.vy;
const guardDist = Math.max(1, Math.hypot(offsetX, offsetY));
const closingSpeed = -(offsetX * relVelX + offsetY * relVelY) / guardDist;
if (closingSpeed <= 10) continue; // not approaching, or drifting slowly
const surfaceDistance = Math.max(0, guardDist - (guardBody.radius ?? 0));
const timeToContact = surfaceDistance / closingSpeed;
const guard = Math.max(realDt, (realDt * timeToContact) / REACTION_REAL_SECONDS);
proximityGuardSeconds = proximityGuardSeconds === null ? guard : Math.min(proximityGuardSeconds, guard);
}
}

let warpLimitReason: "dock-hold" | "ap-guard" | "proximity" | null = null;
if (dockingClearanceRef.current?.holdStartedAt != null && current.timeScale > 1) {
// Docking control restricts time compression: the 10 s alignment hold must pass in real time.
gameDt = realDt;
warpLimitReason = "dock-hold";
}
if (autopilotTimeGuardSeconds !== null && current.timeScale > 1 && gameDt > autopilotTimeGuardSeconds) {
// Auto warp-down near the target: never step past ~5% of time-to-target per frame.
gameDt = Math.max(realDt, autopilotTimeGuardSeconds);
warpLimitReason = "ap-guard";
}
if (proximityGuardSeconds !== null && gameDt > proximityGuardSeconds) {
gameDt = Math.max(realDt, proximityGuardSeconds);
warpLimitReason = "proximity";
}
warpStatusRef.current = { effective: Math.max(1, Math.round(gameDt / realDt)), reason: warpLimitReason };
const headingStep = Math.min(MAX_HEADING_STEP_PER_FRAME, hullTurnRate * (0.7 + steeringEnginePips / 100) * gameDt);
if (autopilotRef.current !== "none") {
const diff = angleDelta(targetHeading, current.ship.heading);
if (Math.abs(diff) < headingStep) {
finalHeading = targetHeading;
} else {
finalHeading += Math.sign(diff) * headingStep;
}
} else if (pressedKeysRef.current.steerLeft || pressedKeysRef.current.steerRight) {
const manualDirection = (pressedKeysRef.current.steerRight ? 1 : 0) - (pressedKeysRef.current.steerLeft ? 1 : 0);
finalHeading += manualDirection * headingStep;
}

// --- 2. Integrate Spacecraft Positions ---
let updatedShip = { ...current.ship, heading: finalHeading };
if (!fuelSimRef.current) {
  updatedShip.fuelLevel = updatedShip.maxFuel;
}

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
const hasUsablePropellant = !fuelSimRef.current || updatedShip.fuelLevel > 0;
const actualThrottlePercent = hasUsablePropellant && !isPowerLocked
? Math.max(-100, Math.min(100, throttleCommand * enginePowerScale))
: 0;

updatedShip.throttlePercent = throttleCommand;
updatedShip.battery = netBattery;

    // Physics motion solver step
    const isCoastingOnRails = Math.abs(actualThrottlePercent) <= 0.001 && (autopilotRef.current === "none" || autopilotRef.current === "goto-target" || attitudeHoldModes.has(autopilotRef.current));
    const railCoastReferenceBody = tickDomGravity.body || systemBodiesRef.current[0];
    const railCoastShip = isCoastingOnRails
      ? propagateKeplerianCoast(
        updatedShip,
        railCoastReferenceBody,
        systemBodiesRef.current,
        current.gameTime,
        gameDt,
        activeStarRef.current.mass * 1.989e30
      )
      : null;
    updatedShip = railCoastShip || integrateSpacecraft(
      updatedShip,
      systemBodiesRef.current,
      current.gameTime,
      gameDt,
      actualThrottlePercent,
      activeStarRef.current.mass * 1.989e30,
      // No posCache here: sub-stepping advances sim time, cache would be frozen at t=gameTime.
      undefined,
      fuelSimRef.current
);

if (!fuelSimRef.current) {
// Fuel sim disabled in settings: physics still applies thrust, tanks never drain.
updatedShip.fuelLevel = updatedShip.maxFuel;
} else if (updatedShip.fuelLevel <= 0.1 && updatedShip.throttlePercent !== 0) {
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
commitGameState((prev) => ({
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
playerProfile: { ...prev.playerProfile, totalPlayTimeSec: prev.playerProfile.totalPlayTimeSec + realDt },
ship: { ...updatedShip, throttlePercent: 0 },
}));
      addConsoleLog(targetStar
        ? `Navigation: ${activeStarRef.current.name} gravity well escaped. Deep-space cruise projected toward ${targetStar.name}.`
        : `Navigation: ${activeStarRef.current.name} gravity well escaped. Deep-space cruise active. No forward star locked.`, "success");
      frameId = requestAnimationFrame(tick);
      return;
    }

    if (!current.isDocked && departureLockRef.current && hasClearedDepartureLock(departureLockRef.current, updatedShip, systemBodiesRef.current, current.gameTime)) {
      departureLockRef.current = null;
    }

    const activeClearance = dockingClearanceRef.current;
    if (activeClearance && !current.isDocked) {
      const dockBody = systemBodiesRef.current.find((body) => body.id === activeClearance.bodyId);
      const dockPort = dockBody ? pickDockingPortForBody(dockBody) : null;
      if (!dockBody || !dockPort || dockPort.id !== activeClearance.portId) {
        applyDockingClearance(null);
      } else if (isDepartureLockActive(departureLockRef.current, dockBody.id, updatedShip, systemBodiesRef.current, current.gameTime)) {
        applyDockingClearance(null);
      } else {
        const dockPos = getAbsoluteBodyPosition(dockBody.id, systemBodiesRef.current, current.gameTime);
        const dockVelocity = getBodyVelocity(dockBody.id, systemBodiesRef.current, current.gameTime);
        const dockSpecs = getDockingSpecs(dockBody);
        const distance = Math.hypot(updatedShip.x - dockPos.x, updatedShip.y - dockPos.y);
        const relSpeed = Math.hypot(updatedShip.vx - dockVelocity.vx, updatedShip.vy - dockVelocity.vy);
        const captureLeashDistance = dockSpecs.maxDistance * 1.6;
        const captureLeashSpeed = Math.max(dockSpecs.maxSpeed * 2.5, dockSpecs.maxSpeed + 250);
        const insideCaptureLeash = distance < captureLeashDistance && relSpeed < captureLeashSpeed;

        if (!insideCaptureLeash) {
          if (activeClearance.holdStartedAt !== null) {
            applyDockingClearance(null);
            addConsoleLog(`Docking control: capture aborted at ${dockBody.stationName || dockBody.name}. Re-enter the docking approach zone.`, "warning");
          }
        } else if (activeClearance.holdStartedAt === null) {
          applyDockingClearance({ ...activeClearance, holdStartedAt: current.gameTime });
        } else {
          const parkingRadius = getDockingParkingRadius(dockBody);
          const offsetX = updatedShip.x - dockPos.x;
          const offsetY = updatedShip.y - dockPos.y;
          const offsetLength = Math.hypot(offsetX, offsetY);
          const ux = offsetLength > 1 ? offsetX / offsetLength : Math.cos(updatedShip.heading);
          const uy = offsetLength > 1 ? offsetY / offsetLength : Math.sin(updatedShip.heading);
          const parkingX = dockPos.x + ux * parkingRadius;
          const parkingY = dockPos.y + uy * parkingRadius;
          const positionBlend = clamp(gameDt / 1.8, 0, 0.45);
          const velocityBlend = clamp(gameDt / 0.8, 0, 0.65);
          const approachHeading = getDockingApproachHeading(updatedShip, dockBody, dockPos, dockVelocity);
          updatedShip = {
            ...updatedShip,
            x: updatedShip.x + (parkingX - updatedShip.x) * positionBlend,
            y: updatedShip.y + (parkingY - updatedShip.y) * positionBlend,
            vx: updatedShip.vx + (dockVelocity.vx - updatedShip.vx) * velocityBlend,
            vy: updatedShip.vy + (dockVelocity.vy - updatedShip.vy) * velocityBlend,
            heading: approachHeading,
            throttlePercent: 0,
          };
          throttleCommand = 0;
          setIsThrusting(false);

          if (current.gameTime - activeClearance.holdStartedAt >= DOCKING_HOLD_SECONDS) {
          setAutopilotMode("none");
          setIsThrusting(false);
          applyDockingClearance(null);
          commitGameState((prev) => ({ ...prev, timeScale: 1 }));
          setPendingDockingCompletion({
            bodyId: dockBody.id,
            portId: dockPort.id,
            ship: {
              ...updatedShip,
              x: parkingX,
              y: parkingY,
              vx: dockVelocity.vx,
              vy: dockVelocity.vy,
              throttlePercent: 0,
            },
          });
          showDockingSequenceRef.current = true;
          setShowDockingSequence(true);
          frameId = requestAnimationFrame(tick);
          return;
          }
        }
      }
    }

    // --- 3. Manage Mining Operations ---
    let appendMarkets = { ...current.markets };
    let logsList = [...current.logs];
    let creditsVal = current.playerCredits;
    let playerProfileVal = current.playerProfile;

    if (current.miningTargetId && current.miningTargetId === current.selectedBodyId) {
      const mineNode = systemBodiesRef.current.find((b) => b.id === current.miningTargetId);
      if (mineNode) {
        const minePos = getAbsoluteBodyPosition(mineNode.id, systemBodiesRef.current, current.gameTime);
        const mDist = Math.hypot(updatedShip.x - minePos.x, updatedShip.y - minePos.y);

        if (mDist < 5e5) {
          const harvestRate = updatedShip.miningPower * 0.0003 * gameDt;
          const mined = applyMiningYield(updatedShip, mineNode, harvestRate);

          if (mined.minedTons > 0) {
            updatedShip.cargo = mined.cargo;
            playerProfileVal = awardCareerXp({
              ...playerProfileVal,
              stats: { ...playerProfileVal.stats, tonsMined: playerProfileVal.stats.tonsMined + mined.minedTons },
            }, "mining", Math.max(1, Math.round(mined.minedTons * 20)));

            if (mined.minedTons < harvestRate) {
              commitGameState((g) => ({ ...g, miningTargetId: null }));
              addConsoleLog("Drill Computer: Cargo inventory reached max tonnage capacity. Drills disengaged.", "warning");
            }
          } else {
            commitGameState((g) => ({ ...g, miningTargetId: null }));
            addConsoleLog("Drill Computer: Cargo inventory is completely full.", "warning");
          }
        } else {
          commitGameState((g) => ({ ...g, miningTargetId: null }));
          addConsoleLog("Drill Computer: Signal lost. Mining lasers disengaged (out of range).", "warning");
        }
      }
    }

// --- 4. Celestial Frame Crash and Friction Safety boundary ---
// Check proximity with every planet/moon/star. If inside body radius, ship crashes!
let crashDetected = false;
let crashedBodyName = "";
let crashDockBodyId: string | null = null;
let crashDockPortId: string | null = null;
const railImpactMetrics = railCoastShip
? computeOrbitMetrics(current.ship, railCoastReferenceBody, systemBodiesRef.current, current.gameTime, posCache)
: null;
if (
railImpactMetrics &&
railImpactMetrics.periapsisAltitude <= 0 &&
(railImpactMetrics.timeToPeriapsis === null || railImpactMetrics.timeToPeriapsis <= gameDt)
) {
crashDetected = true;
crashedBodyName = railCoastReferenceBody.name;
}

// Star check
const centerDist = Math.hypot(updatedShip.x, updatedShip.y);
const activeStarRadiusMeters = Math.max(1, activeStarRef.current.radius) * SUN_RADIUS_METERS;
const starSegmentDist = segmentDistance(current.ship.x, current.ship.y, updatedShip.x, updatedShip.y, 0, 0);
if (!crashDetected && (centerDist < activeStarRadiusMeters || starSegmentDist < activeStarRadiusMeters)) {
crashDetected = true;
crashedBodyName = `${activeStarRef.current.name} Photosphere`;
}

// Body checks using frame cache
if (!crashDetected) for (const body of systemBodiesRef.current) {
const absByp = posCache.get(body.id);
if (!absByp) continue;
const dist = Math.hypot(updatedShip.x - absByp.x, updatedShip.y - absByp.y);
const pathDist = segmentDistance(current.ship.x, current.ship.y, updatedShip.x, updatedShip.y, absByp.x, absByp.y);
if (dist < body.radius || pathDist < body.radius) {
crashDetected = true;
crashedBodyName = body.name;
break;
}
}

if (crashDetected) {
const rescue = systemBodiesRef.current
.map((body) => {
const port = pickPortForBody(body, "repair") || pickPortForBody(body, "refuel") || pickPortForBody(body);
const bodyPos = posCache.get(body.id) || getAbsoluteBodyPosition(body.id, systemBodiesRef.current, current.gameTime);
return port ? { body, port, bodyPos, distance: Math.hypot(updatedShip.x - bodyPos.x, updatedShip.y - bodyPos.y) } : null;
})
.filter((entry): entry is NonNullable<typeof entry> => entry !== null)
.sort((a, b) => a.distance - b.distance)[0] || null;

if (rescue) {
const bodyVelocity = getBodyVelocity(rescue.body.id, systemBodiesRef.current, current.gameTime);
const parentPos = rescue.body.parentId
? getAbsoluteBodyPosition(rescue.body.parentId, systemBodiesRef.current, current.gameTime)
: { x: 0, y: 0 };
const awayX = rescue.bodyPos.x - parentPos.x;
const awayY = rescue.bodyPos.y - parentPos.y;
const awayLength = Math.hypot(awayX, awayY);
const ux = awayLength > 1 ? awayX / awayLength : 1;
const uy = awayLength > 1 ? awayY / awayLength : 0;
const parkingRadius = getDockingParkingRadius(rescue.body);
updatedShip.x = rescue.bodyPos.x + ux * parkingRadius;
updatedShip.y = rescue.bodyPos.y + uy * parkingRadius;
updatedShip.vx = bodyVelocity.vx;
updatedShip.vy = bodyVelocity.vy;
updatedShip.heading = Math.atan2(-uy, -ux);
crashDockBodyId = rescue.body.id;
crashDockPortId = rescue.port.id;
} else {
const resetPos = 1.0 * AU + 2.5e7;
updatedShip.x = resetPos;
updatedShip.y = 0;
updatedShip.vx = 0;
updatedShip.vy = 29780 + 1500;
}
updatedShip.fuelLevel = Math.max(1000, updatedShip.fuelLevel);
updatedShip.throttlePercent = 0;
updatedShip.cargo = normalizeCargoManifest({ water: 0, fuel: 0, ore: 0, machinery: 0, luxury: 0, he3: 0 });
creditsVal = Math.max(500, creditsVal - 1000); // crash penalty

setIsThrusting(false);
setAutopilotMode("none");
departureLockRef.current = null;

addConsoleLog(`CRUNCH! Spaceship breached boundary layer around ${crashedBodyName}. Rescue crews refitted the hull at ${rescue?.port.name || activeStarRef.current.name} for 1,000 cr.`, "warning");
}

// Refresh dynamic markets slowly over time to simulate a trade economy (every 1 game day)
const updatedTimeValue = current.gameTime + gameDt;
const currentDay = Math.floor(updatedTimeValue / 86400);
const expiredContracts = expireAcceptedContracts(current.contracts, updatedTimeValue);
let nextContracts = expiredContracts.contracts;
let nextContractsRefreshDay = current.contractsLastRefreshDay;
let nextMarketsRefreshDay = current.marketsLastUpdatedDay;
let tutorialSkippedVal = current.tutorialSkipped;
let tutorialCompletedVal = current.tutorialCompleted;
let activeTutorialStepVal = current.activeTutorialStep;
let completedTrainingMissionIdsVal = current.completedTrainingMissionIds;

for (const failedContract of expiredContracts.failed) {
  playerProfileVal = addReputation(playerProfileVal, failedContract.issuerFaction, -3);
  if (failedContract.type === "passenger") {
    updatedShip.passengerCount = Math.max(0, updatedShip.passengerCount - (failedContract.passengerCount || 0));
  }
  logsList = [{
    timestamp: formatGameTime(updatedTimeValue),
    text: `Contract expired: ${failedContract.title}. ${failedContract.issuerFaction || failedContract.issuerName || "Local broker"} reputation reduced.`,
    type: "warning",
  }, ...logsList].slice(0, 40);
}

if (currentDay > current.marketsLastUpdatedDay) {
  appendMarkets = refreshMarkets(current.markets, currentDay - current.marketsLastUpdatedDay);
  nextMarketsRefreshDay = currentDay;
}

if (currentDay > current.contractsLastRefreshDay || expiredContracts.failed.length > 0) {
  const contractPorts = getAllPortsForBodies(systemBodiesRef.current).filter((port) => port.services.includes("contracts"));
  nextContracts = refreshContractsForPorts(nextContracts, contractPorts, updatedTimeValue, playerProfileVal.reputation);
  nextContractsRefreshDay = currentDay;
}

const flightTutorialStep = !crashDetected
  ? getActiveFlightTutorialCompletion(current, updatedShip, systemBodiesRef.current, updatedTimeValue, actualThrottlePercent)
  : null;
if (flightTutorialStep) {
  const completion = completeTutorialStep({
    ...current,
    gameTime: updatedTimeValue,
    playerCredits: creditsVal,
    playerProfile: playerProfileVal,
    ship: updatedShip,
    contracts: nextContracts,
    markets: appendMarkets,
  }, flightTutorialStep);

  if (completion.completed) {
    creditsVal = completion.state.playerCredits;
    updatedShip = completion.state.ship;
    tutorialSkippedVal = completion.state.tutorialSkipped;
    tutorialCompletedVal = completion.state.tutorialCompleted;
    activeTutorialStepVal = completion.state.activeTutorialStep;
    completedTrainingMissionIdsVal = completion.state.completedTrainingMissionIds;
    logsList = [{
      timestamp: formatGameTime(updatedTimeValue),
      text: formatTutorialProgressLog(flightTutorialStep, completion.nextStep, completion.reward),
      type: "success",
    }, ...logsList].slice(0, 40);
  }
}

commitGameState((prev) => ({
...prev,
gameTime: updatedTimeValue,
ship: updatedShip,
playerCredits: creditsVal,
playerProfile: { ...playerProfileVal, totalPlayTimeSec: playerProfileVal.totalPlayTimeSec + realDt },
markets: appendMarkets,
marketsLastUpdatedDay: nextMarketsRefreshDay,
contracts: nextContracts,
contractsLastRefreshDay: nextContractsRefreshDay,
 tutorialSkipped: tutorialSkippedVal,
 tutorialCompleted: tutorialCompletedVal,
 activeTutorialStep: activeTutorialStepVal,
 completedTrainingMissionIds: completedTrainingMissionIdsVal,
logs: logsList,
...(crashDetected ? {
selectedBodyId: crashDockBodyId,
miningTargetId: null,
isDocked: !!crashDockBodyId,
dockedBodyId: crashDockBodyId,
dockedPortId: crashDockPortId,
} : {}),
}), false);

frameId = requestAnimationFrame(tick);
};

frameId = requestAnimationFrame(tick);
return () => cancelAnimationFrame(frameId);
}, []);

// Command logs helper
const addConsoleLog = (text: string, type: "info" | "success" | "warning" = "info") => {
const formatted = formatGameTime(stateRef.current.gameTime);
commitGameState((prev) => ({
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

commitGameState((prev) => {
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

addConsoleLog(`Acquired ${amount}t of ${resMarket.name} for ${totalCost}Â¢. Cargo weight increased.`, "info");
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

commitGameState((prev) => {
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

addConsoleLog(`Disposed ${amount}t of ${resMarket.name} to refinery bay. Credited +${payout}Â¢.`, "success");
};

// Docking triggers
const handleDockActivate = () => {
if (!selectedBody || selectedBodyPorts.length === 0) return;
if (isDepartureLockActive(departureLockRef.current, selectedBody.id, stateRef.current.ship, systemBodiesRef.current, stateRef.current.gameTime)) {
const releaseKm = Math.round((departureLockRef.current?.releaseDistance || 0) / 1000);
addConsoleLog(
`Docking denied by ${selectedBody.stationName || selectedBody.name}: departure corridor still active. Clear beyond ${releaseKm.toLocaleString()} km before requesting fresh clearance.`,
"warning"
);
return;
}
if (!canDockAtSelectedBody) {
const activeSpecs = getDockingSpecs(selectedBody);
const maxAltKm = Math.round((activeSpecs.maxDistance - selectedBody.radius) / 1000);
addConsoleLog(
`Docking denied by ${selectedBody.stationName || selectedBody.name}: close to within ${maxAltKm.toLocaleString()} km altitude and reduce relative speed below ${activeSpecs.maxSpeed.toLocaleString()} m/s.`,
"warning"
);
return;
}

const dockingPort = pickDockingPortForBody(selectedBody);
if (!dockingPort) {
addConsoleLog(`Docking denied by ${selectedBody.stationName || selectedBody.name}: no active port record found.`, "warning");
return;
}

applyDockingClearance({ bodyId: selectedBody.id, portId: dockingPort.id, holdStartedAt: null });
addConsoleLog(`Docking control: clearance granted by ${selectedBody.stationName || selectedBody.name}. Hold approach corridor for ${DOCKING_HOLD_SECONDS}s to begin manual docking sequence.`, "info");
};

const handleUndockActivate = () => {
setAutopilotMode("none");
setIsThrusting(false);
applyDockingClearance(null);
showDockingSequenceRef.current = false;
setShowDockingSequence(false);
setPendingDockingCompletion(null);
commitGameState((prev) => {
const dockBody = systemBodiesRef.current.find((body) => body.id === prev.dockedBodyId);
if (!dockBody) {
departureLockRef.current = null;
return {
...prev,
isDocked: false,
dockedBodyId: null,
dockedPortId: null,
ship: { ...prev.ship, throttlePercent: 0 },
};
}

const undocked = buildUndockState(prev.ship, dockBody, systemBodiesRef.current, prev.gameTime);
departureLockRef.current = undocked.departureLock;

return {
...prev,
isDocked: false,
dockedBodyId: null,
dockedPortId: null,
selectedBodyId: dockBody.id,
ship: undocked.ship,
};
});
addConsoleLog(`âœ— Spaceport clamps released. Attitude thrusters ready. Space pressure sealed. Safe flight, Commander.`, "info");
};

// Asteroid Drilling toggle trigger
const handleToggleMining = () => {
if (!selectedBody || !isMineableBody(selectedBody)) {
addConsoleLog("Drill Computer: selected target has no mineable strata signature.", "warning");
return;
}
if (gameState.miningTargetId === selectedBody.id) {
commitGameState((prev) => ({ ...prev, miningTargetId: null }));
addConsoleLog("Drill Computer: Thermal laser miners offline.", "info");
} else {
commitGameState((prev) => ({ ...prev, miningTargetId: selectedBody.id }));
addConsoleLog(`Drill Computer: Focused thermal drills pointing at ${selectedBody.name}. Excelsior siphons armed.`, "success");
}
};

const handleScanSelectedBody = () => {
if (!selectedBody) return;
if (selectedBodyScanned) {
addConsoleLog(`Survey Computer: ${selectedBody.name} already resolved in the cartographic database.`, "info");
return;
}
if (!canScanSelectedBody) {
addConsoleLog("Survey Computer: target outside scanner envelope.", "warning");
return;
}
commitGameState((prev) => {
const result = scanBody(prev.playerProfile, prev.scannedBodyIds, prev.surveyDataByBody, selectedBody);
return {
...prev,
playerProfile: result.playerProfile,
scannedBodyIds: result.scannedBodyIds,
surveyDataByBody: result.surveyDataByBody,
};
});
addConsoleLog(`Survey Computer: ${selectedBody.name} resolved and cartographic data archived for later sale.`, "success");
};

const handleSellSurveyData = () => {
if (!gameState.isDocked || !gameState.dockedPortId) return;
if (surveyDataValue <= 0) {
addConsoleLog("Cartography Desk: no unsold survey packets in ship memory.", "info");
return;
}
commitGameState((prev) => ({
...prev,
playerCredits: prev.playerCredits + getTotalSurveyDataValue(prev.surveyDataByBody),
surveyDataByBody: {},
}));
addConsoleLog(`Cartography Desk: sold survey telemetry package for ${surveyDataValue.toLocaleString()}¢.`, "success");
};

// Accepting Space commission contracts
const handleAcceptContract = (id: string) => {
const target = gameState.contracts.find((c) => c.id === id);
if (!target || target.accepted || target.completed || target.failed) return;
if (target.deadline && target.deadline <= gameState.gameTime) {
addConsoleLog(`Operations: ${target.title} is already past its filing deadline.`, "warning");
return;
}
if (target.issuerPortId && gameState.dockedPortId !== target.issuerPortId) {
addConsoleLog("Operations: dock at the issuing port to sign this contract.", "warning");
return;
}
if (target.type === "passenger") {
  const freeBerths = Math.max(0, (gameState.ship.passengerCapacity || 0) - (gameState.ship.passengerCount || 0));
  if (freeBerths < (target.passengerCount || 0)) {
    addConsoleLog("Operations: insufficient passenger berths for this manifest.", "warning");
    return;
  }
}
const deliveryAmount = target.type === "delivery" ? target.amount || 0 : 0;
if (deliveryAmount > 0) {
  const cargoLimit = gameState.ship.cargoCapacityTons ?? gameState.ship.cargoCapacity;
  if (getCargoUsedTons(gameState.ship) + deliveryAmount > cargoLimit) {
    addConsoleLog("Operations: clear cargo space before loading this mission manifest.", "warning");
    return;
  }
}
commitGameState((prev) => {
let nextShip = prev.ship;
if (target.type === "passenger") {
  nextShip = { ...nextShip, passengerCount: nextShip.passengerCount + (target.passengerCount || 0) };
}
if (deliveryAmount > 0 && target.cargoType) {
  nextShip = {
    ...nextShip,
    cargo: {
      ...nextShip.cargo,
      [target.cargoType]: (nextShip.cargo[target.cargoType] || 0) + deliveryAmount,
    },
  };
}
return {
...prev,
ship: nextShip,
contracts: prev.contracts.map((c) => (c.id === id ? { ...c, accepted: true, failed: false } : c)),
};
});
addConsoleLog(`Operations: Commission underwritten: "${target.title}".${deliveryAmount > 0 ? ` Loaded ${deliveryAmount}t ${target.cargoType || "cargo"}.` : ""} Check destination criteria to complete.`, "info");
};

// Delivering and claiming mission bounties
const handleCompleteContract = (id: string) => {
const contract = gameState.contracts.find((c) => c.id === id);
if (!contract || !contract.accepted || contract.completed || contract.failed) return;
if (contract.deadline && contract.deadline <= gameState.gameTime) {
addConsoleLog(`Operations: ${contract.title} has already expired.`, "warning");
return;
}
const completionStatus = getContractCompletionStatus(contract, gameState, systemBodiesRef.current);
if (!completionStatus.ok) {
addConsoleLog(`Operations: ${contract.title} cannot be completed: ${completionStatus.reason}`, "warning");
return;
}

let firstRunTutorialCompletion: ReturnType<typeof completeTutorialStep> | null = null;
commitGameState((prev) => {
const copyShipCargo = { ...prev.ship.cargo };
if (contract.type === "delivery" && contract.cargoType) {
copyShipCargo[contract.cargoType] = Math.max(0, (copyShipCargo[contract.cargoType] || 0) - (contract.amount || 0));
}

let nextProfile = awardCareerXp({
...prev.playerProfile,
stats: { ...prev.playerProfile.stats, contractsCompleted: prev.playerProfile.stats.contractsCompleted + 1 },
}, contract.type === "delivery" ? "trade" : "operations", Math.max(25, Math.round(contract.reward / 120)));
nextProfile = addReputation(nextProfile, contract.issuerFaction, 2);
const nextState = {
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

if (contract.id === TUTORIAL_CONTRACT_ID) {
firstRunTutorialCompletion = completeTutorialStep(nextState, "first-paid-run");
return firstRunTutorialCompletion.state;
}

return nextState;
});

addConsoleLog(`MISSION ACCOMPLISHED: Delivered payloads or matched telemetry specifications for "${contract.title}". Credited +${contract.reward}¢ reward package.`, "success");
if (firstRunTutorialCompletion?.completed) {
addConsoleLog(formatTutorialProgressLog("first-paid-run", firstRunTutorialCompletion.nextStep, firstRunTutorialCompletion.reward), "success");
}
};

const handleSelectTutorialBody = (bodyId: string) => {
if (!systemBodiesRef.current.some((body) => body.id === bodyId)) return;
commitGameState((prev) => ({ ...prev, selectedBodyId: bodyId }));
setMapMode("target");
};

const handleOpenContracts = () => {
setActiveTab("contracts");
if (stateRef.current.isDocked) {
setRequestedManagementTab("contracts");
} else {
addConsoleLog("Operations: contract board access requires docking at a station or port.", "info");
}
};

const handleSkipTutorial = () => {
commitGameState((prev) => ({
...prev,
tutorialSkipped: true,
activeTutorialStep: null,
}));
addConsoleLog("Flight Training: guidance skipped. Resume it later from the contract board.", "info");
};

const handleResumeTutorial = () => {
let resumedStep: TutorialStepId | null = null;
commitGameState((prev) => {
if (prev.tutorialCompleted) return prev;
resumedStep = prev.activeTutorialStep || getFirstIncompleteTutorialStep(prev.completedTrainingMissionIds) || "bay-clearance";
return {
...prev,
tutorialSkipped: false,
activeTutorialStep: resumedStep,
};
});
if (resumedStep) {
addConsoleLog(`Flight Training: guidance resumed at ${TUTORIAL_STEP_TITLES[resumedStep]}.`, "info");
}
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

commitGameState((prev) => {
const updatedShipState = { ...findUpgrade.modifier(prev.ship), installedUpgradeIds: [...prev.ship.installedUpgradeIds, upgradeId] };
return {
...prev,
playerCredits: prev.playerCredits - findUpgrade.cost,
unlockedUpgradeIds: [...prev.unlockedUpgradeIds, upgradeId],
ship: updatedShipState,
};
});

addConsoleLog(`âœ“ UPGRADE CONCLUDED: ${findUpgrade.name} installed successfully. Space telemetry modules synced.`, "success");
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
commitGameState((prev) => ({
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
commitGameState((prev) => ({
...prev,
activeShipId: target.id,
ship: { ...target.ship, x: prev.ship.x, y: prev.ship.y, vx: prev.ship.vx, vy: prev.ship.vy, heading: prev.ship.heading },
}));
addConsoleLog(`Shipyard: active command transferred to ${target.name}.`, "success");
};

const handleWarpToStar = async (starId: string) => {
const { getOrCreatePlayableStar } = await import("./data/stars");
const dest = getOrCreatePlayableStar(starId);
if (!dest || !gameState.ship.warpCapacity || !galacticMapUnlocked) return;

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
const destinationPorts = getAllPortsForBodies(dest.planets).filter((port) => port.services.includes("contracts"));

commitGameState((prev) => {
const discovery = recordStarDiscovery(prev.playerProfile, prev.discoveredStarIds, starId);
return ({
...prev,
activeStarId: starId,
selectedBodyId: dest.planets[0]?.id || null, // lock first planet of new star
isDocked: false,
dockedBodyId: null,
dockedPortId: null,
markets: {
...prev.markets,
...destinationMarkets,
},
contracts: refreshContractsForPorts(prev.contracts, destinationPorts, prev.gameTime, discovery.playerProfile.reputation),
contractsLastRefreshDay: Math.floor(prev.gameTime / 86400),
playerProfile: discovery.playerProfile,
discoveredStarIds: discovery.discoveredStarIds,
ship: {
...prev.ship,
x: highOrbitPos,
y: 0,
vx: 0,
vy: 18000, // safe initial speed
cargo: updatedCargo,
},
});
});

addConsoleLog(`ðŸŒŒ COGNITIVE WAVEFOLD INITIATED: Spacetime folded relative to ${dest.name} coordinates. Quantum engine depleted 1,000kg of Helium-3. Standard space entry captures successful.`, "success");
};

const {
pressedKeys,
setShipHeading,
setThrottlePercent,
setPowerDistribution,
} = useCockpitControls({
autopilotMode,
selectedBodyExists: !!selectedBody,
setAutopilotMode,
setGameState: commitGameState,
setIsThrusting,
addConsoleLog,
stateRef,
});
pressedKeysRef.current = pressedKeys;

const mapView = mapMode === "galaxy" ? (
  <GalacticMap
    ship={hudState.ship}
    activeStarId={hudState.activeStarId}
    interstellar={hudState.interstellar}
    onWarpToStar={handleWarpToStar}
    logs={hudState.logs.map((entry) => `${entry.timestamp} ${entry.text}`)}
    credits={hudState.playerCredits}
    uiTheme={uiTheme}
  />
) : (
  <StarSystemCanvas
    bodies={systemBodies}
    getFrameState={getFrameState}
    selectedBodyId={hudState.selectedBodyId}
    onSelectBody={(id) => commitGameState((g) => ({ ...g, selectedBodyId: id }))}
    isDocked={hudState.isDocked}
    isThrusting={Math.abs(hudState.ship.throttlePercent) > 0 || autopilotMode !== "none"}
    miningActive={hudState.miningTargetId !== null}
    miningTargetId={hudState.miningTargetId}
    starColor={activeStar.color}
    uiTheme={uiTheme}
    cameraModeOverride={mapMode === "galaxy" ? "star" : mapMode}
    autopilotMode={autopilotMode}
    viewportInsets={{ top: 72, bottom: 264 }}
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
      if (loaded?.ship?.cargo) commitGameState(migrateLoadedState(loaded));
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
      commitGameState(fresh);
      setProfileSummaries(listCommanderProfiles());
    }}
    onDeleteProfile={() => {
      if (profileSummaries.length <= 1) return;
      deleteCommanderProfile(gameState.profileId);
      const next = listCommanderProfiles();
      setProfileSummaries(next);
      const loaded = next[0] ? loadCommanderProfile(next[0].id) : null;
      if (loaded?.ship?.cargo) commitGameState(migrateLoadedState(loaded));
    }}
    onBuy={executeBuy}
    onSell={executeSell}
    onDock={handleDockActivate}
    onUndock={handleUndockActivate}
    onRefuel={() => {
      const missingFuel = Math.max(0, gameState.ship.maxFuel - gameState.ship.fuelLevel);
      if (!gameState.isDocked || !gameState.dockedPortId || missingFuel <= 0) return;
      const portId = gameState.dockedPortId;
      const localMarket = gameState.markets[portId];
      const fuelMarket = localMarket?.fuel;
      if (!fuelMarket) {
        addConsoleLog("Refuel control: dockyard propellant market data unavailable.", "warning");
        return;
      }

      const tons = Math.ceil(missingFuel / 1000);
      if (fuelMarket.available < tons) {
        addConsoleLog(`Refuel control: station stock only has ${fuelMarket.available}t hydrogen available; ${tons}t needed for full transfer.`, "warning");
        return;
      }

      const cost = tons * fuelMarket.buyPrice;
      if (gameState.playerCredits < cost) {
        addConsoleLog(`Refuel control: insufficient credits for propellant transfer. Need ${cost}¢ at ${fuelMarket.buyPrice}¢/t.`, "warning");
        return;
      }
      commitGameState((prev) => ({
        ...prev,
        playerCredits: prev.playerCredits - cost,
        markets: {
          ...prev.markets,
          [portId]: {
            ...prev.markets[portId],
            fuel: {
              ...prev.markets[portId].fuel,
              available: prev.markets[portId].fuel.available - tons,
            },
          },
        },
        ship: { ...prev.ship, fuelLevel: prev.ship.maxFuel },
        playerProfile: {
          ...prev.playerProfile,
          stats: { ...prev.playerProfile.stats, refuels: prev.playerProfile.stats.refuels + 1 },
        },
      }));
      addConsoleLog(`Refuel control: tanks topped off (+${tons}t hydrogen), debit ${cost}¢ at ${fuelMarket.buyPrice}¢/t.`, "success");
    }}
    onSellSurveyData={handleSellSurveyData}
    onToggleMining={handleToggleMining}
    onSelectPort={(portId) => commitGameState((prev) => prev.isDocked ? { ...prev, dockedPortId: portId } : prev)}
    onBuyShip={handleBuyShip}
    onActivateShip={handleActivateOwnedShip}
    onUnlockUpgrade={handleUnlockUpgrade}
    onAcceptContract={handleAcceptContract}
    onCompleteContract={handleCompleteContract}
    onResumeTutorial={handleResumeTutorial}
  />
);

  if (isInMainMenu) {
    return (
      <MainMenu
        profiles={profileSummaries}
        onSelectProfile={(profileId) => {
          const loaded = loadCommanderProfile(profileId);
          if (loaded?.ship?.cargo) {
            commitGameState(migrateLoadedState(loaded));
            setIsInMainMenu(false);
          }
        }}
        onDeleteProfile={(profileId, profileName) => {
          if (window.confirm(`Are you sure you want to permanently delete Commander ${profileName}? This process is irreversible.`)) {
            deleteCommanderProfile(profileId);
            setProfileSummaries(listCommanderProfiles());
          }
        }}
        onCreateProfile={({ name, starId, profession, tutorialMode }) => {
          const newState = createCustomInitialState(name, starId, profession, tutorialMode);
          saveCommanderProfile(newState, newState.profileId);
          commitGameState(newState);
          setProfileSummaries(listCommanderProfiles());
          setIsInMainMenu(false);
        }}
        uiTheme={uiTheme}
        setUiTheme={setUiTheme}
      />
    );
  }

const selectedBodyParent = selectedBody?.parentId ? systemBodies.find((body) => body.id === selectedBody.parentId) : null;
const targetSoi = selectedBody && selectedBody.parentId
? getSphereOfInfluence(
selectedBody,
!selectedBodyParent || selectedBodyParent.type === "star" ? activeStar.mass * 1.989e30 : selectedBodyParent.mass ?? activeStar.mass * 1.989e30
)
: null;

return (
<div className={`elite-root elite-theme-${uiTheme}`}>
<div className="elite-map-layer">{mapView}</div>
<div className="elite-vignette" />
<div className="elite-scanline" />
<TutorialHud
gameState={hudState}
bodies={systemBodies}
onSelectBody={handleSelectTutorialBody}
onOpenContracts={handleOpenContracts}
onSkipTutorial={handleSkipTutorial}
/>
{showDockingSequence && pendingDockingCompletion && pendingDockingBody && pendingDockingPort ? (
  <DockingSequenceModal
    ship={pendingDockingCompletion.ship}
    body={pendingDockingBody}
    port={pendingDockingPort}
    onAbort={() => {
      showDockingSequenceRef.current = false;
      setShowDockingSequence(false);
      setPendingDockingCompletion(null);
      addConsoleLog(`Docking sequence aborted at ${pendingDockingBody.stationName || pendingDockingBody.name}. Return to the approach corridor for a fresh clearance.`, "warning");
    }}
    onComplete={() => {
      const completion = pendingDockingCompletion;
      if (!completion || !pendingDockingBody) return;
      let dockingTutorialCompletion: ReturnType<typeof completeTutorialStep> | null = null;
      commitGameState((prev) => {
        const nextState = {
          ...prev,
          isDocked: true,
          dockedBodyId: completion.bodyId,
          dockedPortId: completion.portId,
          timeScale: 1,
          miningTargetId: null,
          selectedBodyId: completion.bodyId,
          playerProfile: {
            ...prev.playerProfile,
            stats: { ...prev.playerProfile.stats, dockingCount: prev.playerProfile.stats.dockingCount + 1 },
          },
          ship: completion.ship,
        };

        if (completion.bodyId === prev.tutorialTargetBodyId) {
          dockingTutorialCompletion = completeTutorialStep(nextState, "docking-practice");
          return dockingTutorialCompletion.state;
        }

        return nextState;
      });
      showDockingSequenceRef.current = false;
      setShowDockingSequence(false);
      setPendingDockingCompletion(null);
      setRequestedManagementTab("dock-main");
      addConsoleLog(`Docking clamps engaged at ${pendingDockingBody.stationName || pendingDockingBody.name}. Trade networks unlocked.`, "success");
      if (dockingTutorialCompletion?.completed) {
        addConsoleLog(formatTutorialProgressLog("docking-practice", dockingTutorialCompletion.nextStep, dockingTutorialCompletion.reward), "success");
      }
    }}
  />
) : null}
<EliteCockpitHud
gameState={hudState}
activeStar={activeStar}
selectedBody={selectedBody}
targetSoi={targetSoi}
canDock={canDockAtSelectedBody && !departureLockedAtSelectedBody}
dockingDistance={dockingDistance}
dockingRelativeSpeed={dockingRelativeSpeed}
dockingClearance={dockingClearance}
targetBearing={targetBearing}
domGravityName={domGravity.body ? domGravity.body.name : activeStar.name}
relativeOrbit={relativeOrbit}
approachGuidance={hudSnapshot.guidance}
warpStatus={hudSnapshot.warp}
fps={hudSnapshot.fps}
mapMode={mapMode}
setMapMode={setMapMode}
activePanel={activePanel}
activeTab={activeTab}
setActiveTab={setActiveTab}
requestedManagementTab={requestedManagementTab}
onRequestedManagementTabHandled={() => setRequestedManagementTab(null)}
dockedPortRecord={dockedPortRecord}
uiTheme={uiTheme}
setUiTheme={setUiTheme}
fuelSimEnabled={fuelSimEnabled}
onToggleFuelSim={() => setFuelSimEnabled((prev) => !prev)}
autopilotMode={autopilotMode}
setAutopilotMode={setAutopilotMode}
setThrottlePercent={setThrottlePercent}
setPowerDistribution={setPowerDistribution}
setTimeScale={(value) => {
  if (value === 1) {
    warpStatusRef.current = { effective: 1, reason: null };
  }
  commitGameState((g) => ({ ...g, timeScale: value }));
}}
onSetShipHeading={setShipHeading}
onClearTarget={() => commitGameState((g) => ({ ...g, selectedBodyId: null }))}
onDock={handleDockActivate}
onUndock={handleUndockActivate}
onToggleMining={handleToggleMining}
onScanSelectedBody={handleScanSelectedBody}
canScanSelectedBody={canScanSelectedBody}
selectedBodyScanned={selectedBodyScanned}
galacticMapUnlocked={galacticMapUnlocked}
onExitToMainMenu={() => setIsInMainMenu(true)}
/>
</div>
);
}



