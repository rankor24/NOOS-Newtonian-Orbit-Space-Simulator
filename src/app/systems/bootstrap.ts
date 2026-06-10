import { AU, STARS, getOrCreatePlayableStar } from "../../data/stars";
import { SIDEWINDER_STARTER_PROFILE, DEFAULT_POWER_DISTRIBUTION } from "../../data/ships";
import { GameState, MissionLog, ShipState } from "../../types";
import { createDefaultPlayerProfile, createInitialState, normalizeCargoManifest } from "../../utils/gameData";
import { getAbsoluteBodyPosition, getBodyVelocity } from "../../utils/physics";

export const normalizePowerDistribution = (
  input: Partial<ShipState["powerDistribution"]> | undefined
): ShipState["powerDistribution"] => {
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

export const createCustomInitialState = (
  name: string,
  starId: string,
  profession: "miner" | "merchant" | "explorer"
): GameState => {
  getOrCreatePlayableStar(starId);
  const tempState = createInitialState(name);

  let startingCredits = 2000;
  let miningXp = 0;
  let tradeXp = 0;
  let explorationXp = 0;
  const ship = { ...tempState.ship };

  if (profession === "merchant") {
    startingCredits = 3500;
    tradeXp = 500;
    ship.cargo = normalizeCargoManifest({ water: 0, fuel: 0, ore: 0, machinery: 1, luxury: 2, he3: 0 });
  } else if (profession === "miner") {
    startingCredits = 1500;
    miningXp = 500;
    ship.miningPower = 4.0;
    ship.installedUpgradeIds = ["drill_i"];
    ship.cargo = normalizeCargoManifest({ water: 2, fuel: 0, ore: 1, machinery: 0, luxury: 0, he3: 0 });
  } else if (profession === "explorer") {
    startingCredits = 1200;
    explorationXp = 500;
    ship.scannerRangeLy = 12;
    ship.systemScannerRange = 8 * AU;
    ship.installedUpgradeIds = ["sensor_i"];
    ship.cargo = normalizeCargoManifest({ water: 0, fuel: 0, ore: 0, machinery: 0, luxury: 0, he3: 1 });
  }

  let startBodyId = tempState.selectedBodyId || "station_earth_low";
  let startPortId = tempState.ownedShips[0]?.homePortId || "station_earth_low";
  const activePlayableStar = getOrCreatePlayableStar(starId) || STARS[0];
  const starPlanets = activePlayableStar.planets;

  if (starId !== "star_sol") {
    const startBody = starPlanets.find((body) => body.hasMarket) || starPlanets[0];
    if (startBody) {
      startBodyId = startBody.id;
      startPortId = startBody.id;

      const planetPos = getAbsoluteBodyPosition(startBody.id, starPlanets, 0);
      const planetVelocity = getBodyVelocity(startBody.id, starPlanets, 0);
      ship.x = planetPos.x + 2.5e7;
      ship.y = planetPos.y;
      ship.vx = planetVelocity.vx;
      ship.vy = planetVelocity.vy + 1500;
    }
  }

  const ownedShipRecord = {
    id: ship.id || "starter_sidewinder_ship",
    hullId: ship.hullId || SIDEWINDER_STARTER_PROFILE.id,
    name: ship.name,
    ship,
    homePortId: startPortId,
  };

  const logs: MissionLog[] = [
    {
      timestamp: "Year 2086, Day 01 - 00:00:00",
      text: `Flight Certificate Activated. Commander ${name} online around ${activePlayableStar.name}. Starting alignment verified.`,
      type: "info",
    },
    {
      timestamp: "Year 2086, Day 01 - 00:00:01",
      text: `License Type: ${profession === "miner" ? "Asteroid Miner" : profession === "merchant" ? "Merchant Courier" : "Stellar Cartographer"} (Rank 2 Secured).`,
      type: "success",
    },
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
    ship,
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
        security: { xp: 0, level: 1 },
      },
    },
    logs,
  };
};

export const migrateLoadedState = (parsed: any): GameState => {
  const parsedState = { ...(parsed || {}) };
  delete (parsedState as Record<string, unknown>)[["selected", "PortId"].join("")];
  const fallback = createInitialState(parsedState?.commanderName || "Commander");
  const ship = {
    ...fallback.ship,
    ...(parsedState?.ship || {}),
    maxCruiseSpeed: Math.max(parsedState?.ship?.maxCruiseSpeed ?? 0, fallback.ship.maxCruiseSpeed),
    maxBoostSpeed: Math.max(parsedState?.ship?.maxBoostSpeed ?? 0, fallback.ship.maxBoostSpeed),
    engineThrust: Math.max(parsedState?.ship?.engineThrust ?? 0, fallback.ship.engineThrust),
    // Isp rebalance migration to game-scale (1000x chemical): chemical-era saves
    // (3600/4500/9500) scale x1000; the brief 100x-era saves (360k/450k/950k) scale x10.
    engineIsp: (() => {
      const saved = parsedState?.ship?.engineIsp ?? 0;
      if (saved >= 1000000) return saved;
      if (saved >= 100000) return saved * 10;
      return Math.max(saved * 1000, fallback.ship.engineIsp);
    })(),
    fuelLevel: (parsedState?.ship?.fuelLevel ?? 0) > 0 ? parsedState.ship.fuelLevel : fallback.ship.fuelLevel,
    battery: (parsedState?.ship?.battery ?? 0) > 0 ? parsedState.ship.battery : fallback.ship.battery,
    powerDistribution: normalizePowerDistribution(parsedState?.ship?.powerDistribution),
    cargo: normalizeCargoManifest(parsedState?.ship?.cargo ?? fallback.ship.cargo),
    cargoCapacityTons: parsedState?.ship?.cargoCapacityTons ?? parsedState?.ship?.cargoCapacity ?? fallback.ship.cargoCapacityTons,
    passengerCapacity: parsedState?.ship?.passengerCapacity ?? 0,
    passengerCount: parsedState?.ship?.passengerCount ?? 0,
    passengerPodSlots: parsedState?.ship?.passengerPodSlots ?? 0,
    installedUpgradeIds: parsedState?.ship?.installedUpgradeIds ?? parsedState?.unlockedUpgradeIds ?? [],
  };
  const activeShipId = parsedState?.activeShipId || ship.id || fallback.activeShipId;
  const ownedShips = Array.isArray(parsedState?.ownedShips) && parsedState.ownedShips.length > 0
    ? parsedState.ownedShips.map((entry: any) => {
        const entryShip = entry?.id === activeShipId ? ship : { ...ship, ...(entry?.ship || {}) };
        return {
          ...entry,
          ship: {
            ...entryShip,
            cargo: normalizeCargoManifest(entryShip.cargo),
          },
        };
      })
    : [{ id: activeShipId, hullId: ship.hullId || "starter_sidewinder_ship", name: ship.name, ship, homePortId: parsedState?.dockedPortId || "base_earth_1" }];

  return {
    ...fallback,
    ...parsedState,
    ship,
    ownedShips,
    activeShipId,
    unlockedUpgradeIds: parsedState?.unlockedUpgradeIds ?? ship.installedUpgradeIds ?? [],
    playerProfile: {
      ...createDefaultPlayerProfile(),
      ...(parsedState?.playerProfile || {}),
      career: { ...createDefaultPlayerProfile().career, ...(parsedState?.playerProfile?.career || {}) },
      reputation: { ...(parsedState?.playerProfile?.reputation || {}) },
      stats: { ...createDefaultPlayerProfile().stats, ...(parsedState?.playerProfile?.stats || {}) },
    },
    commanderName: parsedState?.commanderName ?? fallback.commanderName,
    saveVersion: parsedState?.saveVersion ?? fallback.saveVersion,
    profileId: parsedState?.profileId ?? fallback.profileId,
    createdAt: parsedState?.createdAt ?? fallback.createdAt,
    updatedAt: parsedState?.updatedAt ?? fallback.updatedAt,
  };
};
