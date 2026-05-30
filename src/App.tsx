/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { StarSystemCanvas } from "./components/StarSystemCanvas";
import { EliteCockpitHud } from "./components/EliteCockpitHud";
import { STARS, AU, getOrCreatePlayableStar } from "./data/stars";
import { MainMenu } from "./components/MainMenu";
import { createInitialState, createDefaultPlayerProfile, formatGameTime, RESOURCE_TYPES, UPGRADES, generateMarketsForStar } from "./utils/gameData";
import { DEFAULT_POWER_DISTRIBUTION, SIDEWINDER_STARTER_PROFILE } from "./data/ships";
import { GameState, CelestialBody, SpaceContract, MissionLog, ShipState } from "./types";
import { getDominantGravitySource, integrateSpacecraft, computeOrbitMetrics, getAbsoluteBodyPosition, buildBodyPositionCache, BodyPosCache, getDockingSpecs } from "./utils/physics";
import { awardCareerXp, addReputation } from "./utils/progression";
import { listCommanderProfiles, loadBestAvailableProfile, loadCommanderProfile, loadLegacySingleSave, saveCommanderProfile, deleteCommanderProfile, clearLegacySingleSave } from "./utils/saveSystem";
import { createOwnedShipFromCatalog, getShipyardCatalog } from "./utils/shipManagement";
import { computeApproachGuidance } from "./utils/autopilot";

const MarketPanel = lazy(() => import("./components/MarketPanel").then((m) => ({ default: m.MarketPanel })));
const UpgradesPanel = lazy(() => import("./components/UpgradesPanel").then((m) => ({ default: m.UpgradesPanel })));
const ContractsPanel = lazy(() => import("./components/ContractsPanel").then((m) => ({ default: m.ContractsPanel })));
const CommanderPanel = lazy(() => import("./components/CommanderPanel").then((m) => ({ default: m.CommanderPanel })));
const ProfilePanel = lazy(() => import("./components/ProfilePanel").then((m) => ({ default: m.ProfilePanel })));

const LazyPanelFallback = () => (
  <div className="rounded-xl border border-stone-800 bg-stone-900/70 p-4 text-xs text-stone-500">Loading module...</div>
);
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

const normalizePowerDistribution = (input: Partial<ShipState["powerDistribution"]> | undefined): ShipState["powerDistribution"] => {
const shields = Math.max(0, input?.shields ?? DEFAULT_POWER_DISTRIBUTION.shields);
const engines = Math.max(0, input?.engines ?? DEFAULT_POWER_DISTRIBUTION.engines);
const weapons = Math.max(0, input?.weapons ?? DEFAULT_POWER_DISTRIBUTION.weapons);
const total = shields + engines + weapons;
if (total <= 0) return DEFAULT_POWER_DISTRIBUTION;

const normalizedShields = Math.round((shields / total) * 100);
const normalizedEngines = Math.round((engines / total) * 100);
return {
shields: normalizedShields,
engines: normalizedEngines,
weapons: 100 - normalizedShields - normalizedEngines,
};
};

function getBodyVelocity(body: CelestialBody, bodies: CelestialBody[], time: number): { vx: number; vy: number } {
if (!body.parentId) return { vx: 0, vy: 0 };
const dt = 1;
const current = getAbsoluteBodyPosition(body.id, bodies, time);
const next = getAbsoluteBodyPosition(body.id, bodies, time + dt);
return { vx: next.x - current.x, vy: next.y - current.y };
}

const createCustomInitialState = (
  name: string,
  starId: string,
  profession: "miner" | "merchant" | "explorer"
): GameState => {
  // Ensure the playable star is built lazily under the stars core registry
  getOrCreatePlayableStar(starId);
  
  // Create solid initial state
  const tempState = createInitialState(name);
  
  // Custom modifications:
  let startingCredits = 2000;
  let miningXp = 0;
  let tradeXp = 0;
  let explorationXp = 0;
  
  const ship = { ...tempState.ship };
  
  if (profession === "merchant") {
    startingCredits = 3500; // Starting capital
    tradeXp = 500; // rank 2 Trade
    ship.cargo = { water: 0, fuel: 0, ore: 0, machinery: 1, luxuries: 2, he3: 0 };
  } else if (profession === "miner") {
    startingCredits = 1500;
    miningXp = 500; // rank 2 Mining
    ship.miningPower = 4.0; // drill_i bonus
    ship.installedUpgradeIds = ["drill_i"];
    ship.cargo = { water: 2, fuel: 0, ore: 1, machinery: 0, luxuries: 0, he3: 0 };
  } else if (profession === "explorer") {
    startingCredits = 1200;
    explorationXp = 500; // rank 2 Exploration
    ship.scannerRangeLy = 12; // sensor_i bonus
    ship.systemScannerRange = 8 * AU; // sensor_i range
    ship.installedUpgradeIds = ["sensor_i"];
    ship.cargo = { water: 0, fuel: 0, ore: 0, machinery: 0, luxuries: 0, he3: 1 }; // starting Helium-3!
  }
  
  // Coordinate positioning around active starting star:
  let startBodyId = "sol_earth";
  let startPortId = "base_earth_1";
  
  const activePlayableStar = getOrCreatePlayableStar(starId) || STARS[0];
  const starPlanets = activePlayableStar.planets;
  
  if (starId !== "star_sol") {
    // Look for first populated planetary body or fallback
    const startBody = starPlanets.find(b => b.hasMarket) || starPlanets[0];
    if (startBody) {
      startBodyId = startBody.id;
      startPortId = startBody.id; // defaults as planet-id port
      
      const planetPos = getAbsoluteBodyPosition(startBody.id, starPlanets, 0);
      ship.x = planetPos.x + 2.5e7; // Orbit distance around selected body
      ship.y = planetPos.y;
      
      // Calculate planet velocity to matching flight orbital track
      const dt = 1;
      const t0 = getAbsoluteBodyPosition(startBody.id, starPlanets, 0);
      const t1 = getAbsoluteBodyPosition(startBody.id, starPlanets, dt);
      const planetVx = t1.x - t0.x;
      const planetVy = t1.y - t0.y;
      
      ship.vx = planetVx;
      ship.vy = planetVy + 1500; // Stable tangential orbital velocity delta
    }
  }

  const ownedShipRecord = {
    id: ship.id || "starter_sidewinder_ship",
    hullId: ship.hullId || SIDEWINDER_STARTER_PROFILE.id,
    name: ship.name,
    ship: ship,
    homePortId: startPortId
  };

  const logs: MissionLog[] = [
    {
      timestamp: "Year 2086, Day 01 - 00:00:00",
      text: `Flight Certificate Activated. Commander ${name} online around ${activePlayableStar.name}. Starting alignment verified.`,
      type: "info"
    },
    {
      timestamp: "Year 2086, Day 01 - 00:00:01",
      text: `License Type: ${profession === "miner" ? "Asteroid Miner" : profession === "merchant" ? "Merchant Courier" : "Stellar Cartographer"} (Rank 2 Secured).`,
      type: "success"
    }
  ];

  return {
    ...tempState,
    profileId: `cmdr_${Date.now()}`,
    activeStarId: starId,
    commanderName: name,
    playerCredits: startingCredits,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    selectedBodyId: startBodyId,
    selectedPortId: startPortId,
    ship: ship,
    ownedShips: [ownedShipRecord],
    activeShipId: ownedShipRecord.id,
    playerProfile: {
      ...tempState.playerProfile,
      overallLevel: 1,
      career: {
        mining: { xp: miningXp, level: miningXp > 0 ? 2 : 1 },
        trade: { xp: tradeXp, level: tradeXp > 0 ? 2 : 1 },
        exploration: { xp: explorationXp, level: explorationXp > 0 ? 2 : 1 },
        operations: { xp: 0, level: 1 },
        security: { xp: 0, level: 1 }
      }
    },
    logs
  };
};

export default function App() {
const migrateLoadedState = (parsed: any): GameState => {
const fallback = createInitialState(parsed?.commanderName || "Commander");
const ship = {
...fallback.ship,
...(parsed?.ship || {}),
fuelLevel: (parsed?.ship?.fuelLevel ?? 0) > 0 ? parsed.ship.fuelLevel : fallback.ship.fuelLevel,
battery: (parsed?.ship?.battery ?? 0) > 0 ? parsed.ship.battery : fallback.ship.battery,
powerDistribution: normalizePowerDistribution(parsed?.ship?.powerDistribution),
cargoCapacityTons: parsed?.ship?.cargoCapacityTons ?? parsed?.ship?.cargoCapacity ?? fallback.ship.cargoCapacityTons,
passengerCapacity: parsed?.ship?.passengerCapacity ?? 0,
passengerCount: parsed?.ship?.passengerCount ?? 0,
passengerPodSlots: parsed?.ship?.passengerPodSlots ?? 0,
installedUpgradeIds: parsed?.ship?.installedUpgradeIds ?? parsed?.unlockedUpgradeIds ?? [],
};
const activeShipId = parsed?.activeShipId || ship.id || fallback.activeShipId;
const ownedShips = Array.isArray(parsed?.ownedShips) && parsed.ownedShips.length > 0
? parsed.ownedShips.map((entry: any) => ({ ...entry, ship: entry?.id === activeShipId ? ship : { ...ship, ...(entry?.ship || {}) } }))
: [{ id: activeShipId, hullId: ship.hullId || 'starter_sidewinder_ship', name: ship.name, ship, homePortId: parsed?.dockedPortId || fallback.selectedPortId }];
return {
...fallback,
...parsed,
ship,
ownedShips,
activeShipId,
unlockedUpgradeIds: parsed?.unlockedUpgradeIds ?? ship.installedUpgradeIds ?? [],
playerProfile: {
...createDefaultPlayerProfile(),
...(parsed?.playerProfile || {}),
career: { ...createDefaultPlayerProfile().career, ...(parsed?.playerProfile?.career || {}) },
reputation: { ...(parsed?.playerProfile?.reputation || {}) },
stats: { ...createDefaultPlayerProfile().stats, ...(parsed?.playerProfile?.stats || {}) },
},
commanderName: parsed?.commanderName ?? fallback.commanderName,
saveVersion: parsed?.saveVersion ?? fallback.saveVersion,
profileId: parsed?.profileId ?? fallback.profileId,
createdAt: parsed?.createdAt ?? fallback.createdAt,
updatedAt: parsed?.updatedAt ?? fallback.updatedAt,
};
};

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
? getBodyVelocity(selectedBody, systemBodies, gameState.gameTime)
: { vx: 0, vy: 0 };
const shipyardCatalog = getShipyardCatalog();
const selectedPortName = gameState.dockedPortId || gameState.selectedPortId || "current port";
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
const posCacheForRender = posCacheRef.current;
const domGravity = getDominantGravitySource(
gameState.ship.x,
gameState.ship.y,
systemBodies,
gameState.gameTime,
activeStar.mass * 1.989e30,
posCacheForRender
);

// Compute real-time relative orbital parameters
const relativeOrbit = computeOrbitMetrics(
gameState.ship,
domGravity.body || systemBodies[0],
systemBodies,
gameState.gameTime,
posCacheForRender
);

// Themes database matching colors across HUD modules
const THEMES = {
amber: {
colorName: "Retro Amber / Elite",
accent: "text-amber-500",
accentLight: "text-amber-400",
accentHover: "hover:text-amber-300",
bgAccent: "bg-amber-500",
bgAccentMuted: "bg-amber-500/10",
bgAccentHover: "hover:bg-amber-400",
borderAccent: "border-amber-500/30",
borderAccentFocus: "border-amber-400",
borderTabActive: "border-t-2 border-t-amber-500",
textTabActive: "text-amber-400",
statusGlow: "shadow-amber-500/5",
statusText: "text-amber-400 animate-pulse",
comLinkColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
headerPingColor: "bg-amber-400",
headerIconStyle: "bg-amber-500/10 border-amber-500/40 text-amber-400",
autopilotCircularizeStyle: "bg-amber-500/20 border-amber-500 text-amber-400 shadow-md shadow-amber-500/25",
bgBadge: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
accentHex: "#f59e0b",

// Core Layout Palette mapping to override "brown" stone in other themes
bodyBg: "bg-stone-950",
panelBg: "bg-stone-900/90",
panelBorder: "border-stone-800/80",
innerBg: "bg-stone-950/80",
innerBorder: "border-stone-850",
buttonBg: "bg-stone-900",
buttonHover: "hover:bg-stone-800",
tabHeaderBg: "bg-stone-950",
textMuted: "text-stone-500",
textNormal: "text-stone-400",
statusBarBg: "bg-stone-950 border border-stone-850",
borderTabNormal: "border-stone-800/60",
hudGlowRadial: "bg-[radial-gradient(ellipse_at_center,rgba(245,158,11,0.025)_0%,rgba(0,0,0,0)_85%)]",
starColorOverride: "",
},
blue: {
colorName: "Deep Space Blue",
accent: "text-sky-500",
accentLight: "text-sky-400",
accentHover: "hover:text-sky-300",
bgAccent: "bg-sky-500",
bgAccentMuted: "bg-sky-500/10",
bgAccentHover: "hover:bg-sky-400",
borderAccent: "border-sky-500/30",
borderAccentFocus: "border-sky-400",
borderTabActive: "border-t-2 border-t-sky-500",
textTabActive: "text-sky-400",
statusGlow: "shadow-sky-500/5",
statusText: "text-sky-400 animate-pulse",
comLinkColor: "bg-sky-500/10 text-sky-400 border-sky-500/20",
headerPingColor: "bg-sky-400",
headerIconStyle: "bg-sky-500/10 border-sky-500/40 text-sky-400",
autopilotCircularizeStyle: "bg-sky-500/20 border-sky-500 text-sky-400 shadow-md shadow-sky-500/25",
bgBadge: "bg-sky-500/10 text-sky-400 border border-sky-500/20",
accentHex: "#0ea5e9",

// Core Layout Palette mapping to override "brown" stone in other themes
bodyBg: "bg-slate-950",
panelBg: "bg-slate-900/90",
panelBorder: "border-slate-800/80",
innerBg: "bg-slate-955/80 md:bg-slate-950/80",
innerBorder: "border-slate-850",
buttonBg: "bg-slate-900",
buttonHover: "hover:bg-slate-800",
tabHeaderBg: "bg-slate-950",
textMuted: "text-slate-500",
textNormal: "text-slate-400",
statusBarBg: "bg-slate-950 border border-slate-850",
borderTabNormal: "border-slate-800/60",
hudGlowRadial: "bg-[radial-gradient(ellipse_at_center,rgba(14,165,233,0.025)_0%,rgba(0,0,0,0)_85%)]",
starColorOverride: "",
},
green: {
colorName: "Matrix Green",
accent: "text-emerald-500",
accentLight: "text-emerald-400",
accentHover: "hover:text-emerald-300",
bgAccent: "bg-emerald-500",
bgAccentMuted: "bg-emerald-500/10",
bgAccentHover: "hover:bg-emerald-400",
borderAccent: "border-emerald-500/30",
borderAccentFocus: "border-emerald-400",
borderTabActive: "border-t-2 border-t-emerald-500",
textTabActive: "text-emerald-400",
statusGlow: "shadow-emerald-500/5",
statusText: "text-emerald-400 animate-pulse",
comLinkColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
headerPingColor: "bg-emerald-400",
headerIconStyle: "bg-emerald-500/10 border-emerald-500/40 text-emerald-400",
autopilotCircularizeStyle: "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-md shadow-emerald-500/25",
bgBadge: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
accentHex: "#10b981",

// Core Layout Palette mapping to override "brown" stone in other themes
bodyBg: "bg-[#040805]",
panelBg: "bg-[#0b140e]/95",
panelBorder: "border-[#152a1a]",
innerBg: "bg-[#060c08]",
innerBorder: "border-[#1c3a23]",
buttonBg: "bg-[#0c1810]",
buttonHover: "hover:bg-[#183120]",
tabHeaderBg: "bg-[#0b140e]",
textMuted: "text-[#4a6b52]",
textNormal: "text-[#7ca685]",
statusBarBg: "bg-[#060c08] border border-[#1c3a23]",
borderTabNormal: "border-[#152a1a]/60",
hudGlowRadial: "bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.025)_0%,rgba(0,0,0,0)_85%)]",
starColorOverride: "",
},
red: {
colorName: "Red Battle Mode",
accent: "text-rose-500",
accentLight: "text-rose-450",
accentHover: "hover:text-rose-300",
bgAccent: "bg-rose-600",
bgAccentMuted: "bg-rose-500/10",
bgAccentHover: "hover:bg-rose-550",
borderAccent: "border-rose-500/30",
borderAccentFocus: "border-rose-400",
borderTabActive: "border-t-2 border-t-rose-600",
textTabActive: "text-rose-450",
statusGlow: "shadow-rose-500/5",
statusText: "text-rose-500 animate-pulse",
comLinkColor: "bg-rose-500/15 text-rose-400 border-rose-500/20",
headerPingColor: "bg-rose-400",
headerIconStyle: "bg-rose-500/10 border-rose-500/40 text-rose-450",
autopilotCircularizeStyle: "bg-rose-500/20 border-rose-550 text-rose-450 shadow-md shadow-rose-550/25",
bgBadge: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
accentHex: "#f43f5e",

// Core Layout Palette mapping to override "brown" stone in other themes
bodyBg: "bg-[#090405]",
panelBg: "bg-[#14080a]/95",
panelBorder: "border-[#2d1215]",
innerBg: "bg-[#090304]",
innerBorder: "border-[#3d181d]",
buttonBg: "bg-[#180a0c]",
buttonHover: "hover:bg-[#2d1215]",
tabHeaderBg: "bg-[#14080a]",
textMuted: "text-[#7a3b40]",
textNormal: "text-[#bd646b]",
statusBarBg: "bg-[#090304] border border-[#3d181d]",
borderTabNormal: "border-[#2d1215]/60",
hudGlowRadial: "bg-[radial-gradient(ellipse_at_center,rgba(244,63,94,0.025)_0%,rgba(0,0,0,0)_85%)]",
starColorOverride: "",
}
};

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
      const dtVel = 1.0;
      const nextCache = buildBodyPositionCache(systemBodiesRef.current, current.gameTime + dtVel);
      const nextBodyPos = nextCache.get(activeTargetBody.id) || targetBodyPos;
      const targetVx = nextBodyPos.x - targetBodyPos.x;
      const targetVy = nextBodyPos.y - targetBodyPos.y;

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
});

if (guidance.phase === "arrived") {
throttleCommand = 0;
setAutopilotMode("none");
addConsoleLog(`Autopilot: Approach secure around ${activeTargetBody.name || "target"}. Velocity matched within docking envelope.`, "success");
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
if (!gameState.isDocked || !gameState.dockedBodyId) return;
const bodyId = gameState.dockedBodyId;
const localMarket = gameState.markets[bodyId];
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
const copyLocal = { ...copyMarkets[bodyId] };
copyLocal[resourceId] = {
...copyLocal[resourceId],
available: copyLocal[resourceId].available - amount,
};
copyMarkets[bodyId] = copyLocal;

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
if (!gameState.isDocked || !gameState.dockedBodyId) return;
const bodyId = gameState.dockedBodyId;
const localMarket = gameState.markets[bodyId];
if (!localMarket) return;
const resMarket = localMarket[resourceId];
if (!resMarket) return;

const shipCount = gameState.ship.cargo[resourceId] || 0;
if (shipCount < amount) return;

const payout = resMarket.sellPrice * amount;

setGameState((prev) => {
const copyMarkets = { ...prev.markets };
const copyLocal = { ...copyMarkets[bodyId] };
copyLocal[resourceId] = {
...copyLocal[resourceId],
available: Math.min(copyLocal[resourceId].maxCapacity, copyLocal[resourceId].available + amount),
};
copyMarkets[bodyId] = copyLocal;

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

setGameState((prev) => ({
...prev,
isDocked: true,
dockedBodyId: selectedBody.id,
}));

addConsoleLog(`✓ Spaceport tether established at ${selectedBody.stationName || selectedBody.name}. Standard atmospheres balanced. Trade networks unlocked.`, "success");
setActiveTab("market"); // Open market tab instantly upon docking for frictionless UX!
};

const handleUndockActivate = () => {
setGameState((prev) => ({
...prev,
isDocked: false,
dockedBodyId: null,
}));
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

// Track visual states for pressed keyboard buttons to light up real cockpit displays
const [pressedKeys, setPressedKeys] = useState<{
thrust: boolean;
steerLeft: boolean;
steerRight: boolean;
circMode: boolean;
matchMode: boolean;
}>({
thrust: false,
steerLeft: false,
steerRight: false,
circMode: false,
matchMode: false,
});

// Listen to keyboard controls for steering & thrusting
useEffect(() => {
const handleKeyDown = (e: KeyboardEvent) => {
const activeEl = document.activeElement;
// If typing in an input field (such as a search box or text log), suppress overrides
if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
return;
}

const key = e.key.toLowerCase();

if (key === "arrowleft" || key === "a") {
handleRotateShip(-Math.PI / 36); // rotate 5 degrees left
setPressedKeys((p) => ({ ...p, steerLeft: true }));
} else if (key === "arrowright" || key === "d") {
handleRotateShip(Math.PI / 36);  // rotate 5 degrees right
setPressedKeys((p) => ({ ...p, steerRight: true }));
} else if (key === "arrowup" || key === "w") {
e.preventDefault(); // maintain scroll viewport integrity
if (autopilotMode === "none" || autopilotMode === "align-target") {
setThrottlePercent(stateRef.current.ship.throttlePercent + 10);
}
setPressedKeys((p) => ({ ...p, thrust: true }));
} else if (key === "arrowdown" || key === "s") {
e.preventDefault();
if (autopilotMode === "none" || autopilotMode === "align-target") {
setThrottlePercent(stateRef.current.ship.throttlePercent - 10);
}
setPressedKeys((p) => ({ ...p, thrust: true }));
} else if (e.key === " ") {
e.preventDefault();
if (autopilotMode === "none" || autopilotMode === "align-target") {
setThrottlePercent(0);
}
setPressedKeys((p) => ({ ...p, thrust: true }));
} else if (key === "c") {
setPressedKeys((p) => ({ ...p, circMode: true }));
if (selectedBody) {
setAutopilotMode((prev) => (prev === "circularize" ? "none" : "circularize"));
} else {
addConsoleLog("Guidance: Select planetary orbit target before circularization request.", "warning");
}
} else if (key === "m") {
setPressedKeys((p) => ({ ...p, matchMode: true }));
if (selectedBody) {
setAutopilotMode((prev) => (prev === "match-speed" ? "none" : "match-speed"));
} else {
addConsoleLog("Guidance: Select orbit target before match-speed request.", "warning");
}
}
};

const handleKeyUp = (e: KeyboardEvent) => {
const activeEl = document.activeElement;
if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
return;
}

const key = e.key.toLowerCase();

if (key === "arrowleft" || key === "a") {
setPressedKeys((p) => ({ ...p, steerLeft: false }));
} else if (key === "arrowright" || key === "d") {
setPressedKeys((p) => ({ ...p, steerRight: false }));
} else if (key === "arrowup" || key === "w" || key === "arrowdown" || key === "s" || e.key === " ") {
setPressedKeys((p) => ({ ...p, thrust: false }));
} else if (key === "c") {
setPressedKeys((p) => ({ ...p, circMode: false }));
} else if (key === "m") {
setPressedKeys((p) => ({ ...p, matchMode: false }));
}
};

window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);
return () => {
window.removeEventListener("keydown", handleKeyDown);
window.removeEventListener("keyup", handleKeyUp);
};
}, [autopilotMode, selectedBody]);

// Handle active heading controls
const handleRotateShip = (amount: number) => {
setAutopilotMode("none"); // break autopilots when player steers manually
setGameState((prev) => ({
...prev,
ship: {
...prev.ship,
heading: (prev.ship.heading + amount) % (Math.PI * 2),
},
}));
};

const setShipHeading = (heading: number) => {
const normalized = ((heading % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
setAutopilotMode("none");
setGameState((prev) => ({
...prev,
ship: {
...prev.ship,
heading: normalized,
},
}));
};

const setThrottlePercent = (value: number) => {
const next = Math.max(-100, Math.min(100, Math.round(value)));
setGameState((prev) => ({
...prev,
ship: {
...prev.ship,
throttlePercent: next,
},
}));
setIsThrusting(next !== 0);
};

const setPowerDistribution = (channel: "shields" | "engines" | "weapons", value: number) => {
const nextValue = Math.max(0, Math.min(100, Math.round(value)));
setGameState((prev) => ({
...prev,
ship: (() => {
const current = prev.ship.powerDistribution ?? DEFAULT_POWER_DISTRIBUTION;
const otherChannels = (["shields", "engines", "weapons"] as const).filter((key) => key !== channel);
const remaining = 100 - nextValue;
const currentOtherTotal = otherChannels.reduce((sum, key) => sum + current[key], 0);
const firstOther = currentOtherTotal > 0
? Math.round((current[otherChannels[0]] / currentOtherTotal) * remaining)
: Math.round(remaining / 2);
const balancedDistribution = {
...current,
[channel]: nextValue,
[otherChannels[0]]: firstOther,
[otherChannels[1]]: remaining - firstOther,
};

return {
...prev.ship,
powerDistribution: balancedDistribution,
};
})(),
}));
};

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
  <Suspense fallback={<LazyPanelFallback />}>
    <>
<div className="space-y-4 mb-4">
<ProfilePanel
currentProfileId={gameState.profileId}
profiles={profileSummaries}
onSelectProfile={(profileId) => { const loaded = loadCommanderProfile(profileId); if (loaded?.ship?.cargo) setGameState(migrateLoadedState(loaded)); }}
onSaveProfile={() => { const synced = syncOwnedShips(gameState); saveCommanderProfile(synced, synced.profileId); setProfileSummaries(listCommanderProfiles()); addConsoleLog(`Save control: commander profile saved for ${gameState.commanderName}.`, "success"); }}
onCreateProfile={() => { const name = window.prompt("Commander name?", "Commander") || "Commander"; const fresh = createInitialState(name); saveCommanderProfile(fresh, fresh.profileId); setGameState(fresh); setProfileSummaries(listCommanderProfiles()); }}
onDeleteProfile={() => { if (profileSummaries.length <= 1) return; deleteCommanderProfile(gameState.profileId); const next = listCommanderProfiles(); setProfileSummaries(next); const loaded = next[0] ? loadCommanderProfile(next[0].id) : null; if (loaded?.ship?.cargo) setGameState(migrateLoadedState(loaded)); }}
/>
<CommanderPanel commanderName={gameState.commanderName} profile={gameState.playerProfile} credits={gameState.playerCredits} />
</div>
{activeTab === "market" && (
<MarketPanel
gameState={gameState}
onBuy={executeBuy}
onSell={executeSell}
onDock={handleDockActivate}
onUndock={handleUndockActivate}
onRefuel={() => {
const missingFuel = Math.max(0, gameState.ship.maxFuel - gameState.ship.fuelLevel);
const tons = Math.ceil(missingFuel / 1000);
const cost = tons * 400;
if (!gameState.isDocked || !gameState.dockedPortId || missingFuel <= 0) return;
if (gameState.playerCredits < cost) { addConsoleLog("Refuel control: insufficient credits for propellant transfer.", "warning"); return; }
setGameState((prev) => ({ ...prev, playerCredits: prev.playerCredits - cost, ship: { ...prev.ship, fuelLevel: prev.ship.maxFuel }, playerProfile: { ...prev.playerProfile, stats: { ...prev.playerProfile.stats, refuels: prev.playerProfile.stats.refuels + 1 } } }));
addConsoleLog(`Refuel control: tanks topped off (+${tons}t hydrogen), debit ${cost}¢.`, "success");
}}
onToggleMining={handleToggleMining}
onSelectPort={(portId) => setGameState((prev) => ({ ...prev, selectedPortId: portId }))}
onBuyShip={handleBuyShip}
onActivateShip={handleActivateOwnedShip}
shipyardCatalog={shipyardCatalog}
dockedPortInventory={dockedPortInventory}
bodies={systemBodies}
/>
)}
{activeTab === "upgrades" && (
<UpgradesPanel
ship={gameState.ship}
playerCredits={gameState.playerCredits}
unlockedUpgradeIds={gameState.unlockedUpgradeIds}
onUnlockUpgrade={handleUnlockUpgrade}
/>
)}
{activeTab === "contracts" && (
<ContractsPanel
gameState={gameState}
bodies={systemBodies}
onAcceptContract={handleAcceptContract}
onCompleteContract={handleCompleteContract}
/>
)}
</>
</Suspense>
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



