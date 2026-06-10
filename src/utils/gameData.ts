/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameState, ResourceMarket, MarketState, SpaceContract, ShipUpgrade, ShipState, PlayerProfile, OwnedShipRecord, CelestialBody } from "../types";
import { STARS, AU } from "../data/stars";
import { DEFAULT_POWER_DISTRIBUTION, SIDEWINDER_STARTER_PROFILE } from "../data/ships";
import { getAbsoluteBodyPosition, getBodyVelocity } from "./physics";
import {
  getAllPortsForBodies,
  getPortContractTemplates,
  getPortMarketProfile,
  makePortContract,
} from "./worldText";
import { SAVE_VERSION } from "./saveSystem";

const START_STATION_ID = "station_earth_low";
const START_PORT_ID = "station_earth_low";

export const RESOURCE_TYPES = [
  { id: "water", name: "Water Ice", basePrice: 150, mass: 1000, desc: "Liquid water ice blocks mined from space craters." },
  { id: "fuel", name: "Hydrogen Fuel", basePrice: 400, mass: 1000, desc: "Refined rocket fuel, critical for spacecraft engines." },
  { id: "ore", name: "Metal Ore", basePrice: 220, mass: 1000, desc: "Raw hematite and platinum-group minerals." },
  { id: "machinery", name: "Machinery", basePrice: 850, mass: 1000, desc: "Industrial fabricators and maintenance bots." },
  { id: "luxury", name: "Luxuries", basePrice: 1750, mass: 500, desc: "Terran vintage foods and zero-g bio-flora." },
  { id: "he3", name: "Helium-3 Gas", basePrice: 3800, mass: 500, desc: "Rare energy isotope mined from gas giant atmospheres." }
];

export function normalizeCargoManifest(cargo: ShipState["cargo"] | undefined): ShipState["cargo"] {
  const normalized = { ...(cargo || {}) };
  if (normalized.luxuries) {
    normalized.luxury = (normalized.luxury || 0) + normalized.luxuries;
    delete normalized.luxuries;
  }
  for (const resource of RESOURCE_TYPES) {
    normalized[resource.id] = Math.max(0, normalized[resource.id] || 0);
  }
  return normalized;
}

export const UPGRADES: ShipUpgrade[] = [
  {
    id: "tank_i",
    name: "Carbon-Fiber Fuel Tank Kit",
    description: "Replaces starting heavy tanks with light composites. Increases fuel limit to 12,000 kg and drops ship dry mass by 500 kg.",
    cost: 4800,
    unlocked: false,
    category: "fuelTank",
    modifier: (ship) => ({ ...ship, maxFuel: 12000 }),
  },
  {
    id: "tank_ii",
    name: "Cryogenic Cryo-Grid Storage",
    description: "Insulated containment holding high density liquid helium. Upgrades fuel limit to 30,000 kg.",
    cost: 16500,
    unlocked: false,
    category: "fuelTank",
    modifier: (ship) => ({ ...ship, maxFuel: 30000 }),
  },
  {
    id: "engine_i",
    name: "Kestrel High-Flow Plasma Thruster",
    description: "Advanced magnetoplasmadynamic engine. Increases continuous thrust to 3,500,000 N and boosts efficiency (Isp = 4,500,000s).",
    cost: 8500,
    unlocked: false,
    category: "engine",
    modifier: (ship) => ({ ...ship, engineThrust: Math.max(ship.engineThrust, 3500000), engineIsp: 4500000 }),
  },
  {
    id: "engine_ii",
    name: "Helios Fusion Drive Core",
    description: "A catalytic magnetic-confinement fusion torch. Generates 6,500,000 N thrust with astronomical efficiency (Isp = 9,500,000s).",
    cost: 32000,
    unlocked: false,
    category: "engine",
    modifier: (ship) => ({ ...ship, engineThrust: Math.max(ship.engineThrust, 6500000), engineIsp: 9500000 }),
  },
  {
    id: "cargo_i",
    name: "Cargo Bay Expanders",
    description: "Installs lightweight cargo structural shelves. Expands cargo space to 40 Metric Tons.",
    cost: 6000,
    unlocked: false,
    category: "cargo",
    modifier: (ship) => ({ ...ship, cargoCapacity: 40, cargoCapacityTons: 40 }),
  },
  {
    id: "cargo_ii",
    name: "Sub-space Storage Compression",
    description: "Reorients structural frames with electromagnetic compression. Expands cargo space to 120 Metric Tons.",
    cost: 21000,
    unlocked: false,
    category: "cargo",
    modifier: (ship) => ({ ...ship, cargoCapacity: 120, cargoCapacityTons: 120 }),
  },
  {
    id: "drill_i",
    name: "Heavy-Pulse Mining Laser",
    description: "Replaces core drills with high-yield thermal focus lasers. Accelerates asteroid mining extraction speed by 400%.",
    cost: 7200,
    unlocked: false,
    category: "drill",
    modifier: (ship) => ({ ...ship, miningPower: 4.0 }),
  },
  {
    id: "sensor_i",
    name: "Deep Field Scanner Array",
    description: "Upgrades stellar cartography and local object detection. Extends star reveal radius to 12 light years and local body scan radius to 8 AU.",
    cost: 6400,
    unlocked: false,
    category: "sensor",
    modifier: (ship) => ({ ...ship, scannerRangeLy: 12, systemScannerRange: 8 * AU }),
  },
  {
    id: "sensor_ii",
    name: "Long-Baseline Survey Interferometer",
    description: "High-gain phased sensor rig for deep navigation. Extends star reveal radius to 24 light years and local body scan radius to 20 AU.",
    cost: 16800,
    unlocked: false,
    category: "sensor",
    modifier: (ship) => ({ ...ship, scannerRangeLy: 24, systemScannerRange: 20 * AU }),
  },
  {
    id: "passenger_i",
    name: "Orbital Transfer Pod Rack",
    description: "Installs compact passenger transfer pods. Enables 4 passenger berths for crew, courier, and civilian transport contracts.",
    cost: 5200,
    unlocked: false,
    category: "passenger",
    modifier: (ship) => ({ ...ship, passengerCapacity: 4, passengerPodSlots: 1 }),
  },
  {
    id: "warp_drive",
    name: "Hyper-Resonant Warp Drive",
    description: "Enables stellar jumps up to 10 Light Years relative distance. Consumes 1 unit of Helium-3 per stellar jump.",
    cost: 25000,
    unlocked: false,
    category: "warp",
    modifier: (ship) => ({ ...ship, warpCapacity: true, maxWarpRange: 10 }),
  },
];

export function generateMarketsForStar(starId: string): { [portId: string]: { [resId: string]: ResourceMarket } } {
  const result: { [portId: string]: { [resId: string]: ResourceMarket } } = {};
  const star = STARS.find((s) => s.id === starId);
  if (!star) return {};

  const ports = getAllPortsForBodies(star.planets).filter((port) => port.services.includes("markets") || port.services.includes("refuel") || port.services.includes("shipyard"));

  for (const port of ports) {
    const body = star.planets.find((entry) => entry.id === port.bodyId);
    if (!body) continue;
    const economyBody = body.type === "station" && body.parentId
      ? star.planets.find((entry) => entry.id === body.parentId) || body
      : body;

    const market: { [resId: string]: ResourceMarket } = {};
    const profile = getPortMarketProfile(port);

    for (const res of RESOURCE_TYPES) {
      let buyCoeff = 1.0;
      let capacityCoeff = 1.0;

      if (economyBody.id === "sol_earth") {
        if (res.id === "machinery") buyCoeff = 0.5;
        if (res.id === "luxury") buyCoeff = 0.7;
        if (res.id === "ore" || res.id === "water") buyCoeff = 1.6;
        capacityCoeff = 3.0;
      } else if (economyBody.id === "sol_mars") {
        if (res.id === "ore") buyCoeff = 0.4;
        if (res.id === "machinery") buyCoeff = 1.3;
        if (res.id === "water") buyCoeff = 1.2;
      } else if (economyBody.id === "sol_luna" || economyBody.id === "sol_moon") {
        if (res.id === "fuel") buyCoeff = 0.6;
        if (res.id === "machinery") buyCoeff = 1.2;
      } else if (economyBody.id === "sol_ceres") {
        if (res.id === "water" || res.id === "ore") buyCoeff = 0.3;
        if (res.id === "machinery" || res.id === "luxury" || res.id === "fuel") buyCoeff = 1.8;
      } else if (body.type === "station" && (body.id.includes("jupiter") || economyBody.id === "sol_jupiter" || economyBody.parentId === "sol_jupiter")) {
        if (res.id === "fuel") buyCoeff = 0.4;
        if (res.id === "he3") buyCoeff = 0.2;
        if (res.id === "luxury") buyCoeff = 2.0;
      } else {
        if (economyBody.description.toLowerCase().includes("gas")) {
          if (res.id === "fuel" || res.id === "he3") buyCoeff = 0.4;
          if (res.id === "luxury") buyCoeff = 1.8;
        } else {
          if (res.id === "ore") buyCoeff = 0.6;
          if (res.id === "machinery") buyCoeff = 1.4;
        }
      }

      if (profile.priceBias[res.id] != null) buyCoeff *= profile.priceBias[res.id] as number;
      capacityCoeff *= profile.capacityBias;

      const buyPrice = Math.max(25, Math.round(res.basePrice * buyCoeff));
      const sellPrice = Math.round(buyPrice * 0.82);
      const capacity = Math.max(25, Math.round(100 * capacityCoeff));
      const portSeed = port.id.length + res.id.length;
      market[res.id] = {
        id: res.id,
        name: res.name,
        buyPrice,
        sellPrice,
        available: Math.max(0, Math.floor(capacity * (0.35 + ((portSeed * 17) % 40) / 100))),
        maxCapacity: capacity,
        basePrice: res.basePrice,
      };
    }

    result[port.id] = market;
  }

  return result;
}

export function generateInitialContracts(): SpaceContract[] {
  const sol = STARS.find((star) => star.id === "star_sol");
  if (!sol) return [];

  const ports = getAllPortsForBodies(sol.planets).filter((port) => port.services.includes("contracts"));
  const routePairs = [
    ["base_earth_2", "station_mars_phobos"],
    ["base_luna_4", "base_ceres_1"],
    ["station_ganymede", "station_earth_low"],
    ["station_mir2", "base_venus_2"],
    ["base_mars_2", "station_belt_capricorn"],
    ["base_jupiter_1", "base_europa_1"],
    ["station_kaguya", "base_mars_3"],
    ["base_venus_1", "base_luna_3"],
  ];

  const procedural = routePairs.flatMap(([originPortId, destinationPortId], routeIndex) => {
    const issuer = ports.find((port) => port.id === originPortId);
    const destination = ports.find((port) => port.id === destinationPortId);
    if (!issuer || !destination) return [];

    return getPortContractTemplates(issuer, destination).map((template, templateIndex) => makePortContract({
      id: `contract_sol_${routeIndex + 1}_${templateIndex + 1}`,
      title: template.title,
      description: template.description,
      type: template.type,
      originId: issuer.bodyId,
      destinationId: destination.bodyId,
      reward: template.reward,
      cargoType: template.cargoType,
      amount: template.amount,
      passengerCount: template.type === "passenger" ? Math.max(1, Math.ceil((template.amount || 2) / 2)) : undefined,
      completed: false,
      accepted: false,
    }, issuer, destination, `${issuer.name} → ${destination.name}`));
  });

  procedural.push({
    id: "contract_passenger_sol_1",
    title: "Orbital Civilian Transfer",
    description: "Transfer 3 civilian passengers from Selene Transfer Ring to Phobos Exchange in secured transport pods.",
    type: "passenger",
    originId: "sol_luna",
    destinationId: "sol_phobos",
    issuerPortId: "base_luna_4",
    issuerName: "Selene Civic Shuttle Office",
    issuerFaction: "Luna Civic Port Authority",
    destinationPortId: "station_mars_phobos",
    destinationName: "Phobos Exchange",
    routeTag: "Luna → Phobos",
    reward: 5800,
    passengerCount: 3,
    completed: false,
    accepted: false,
  });

  return procedural;
}

export function createDefaultPlayerProfile(): PlayerProfile {
  return {
    totalPlayTimeSec: 0,
    overallLevel: 1,
    career: {
      mining: { xp: 0, level: 1 },
      trade: { xp: 0, level: 1 },
      exploration: { xp: 0, level: 1 },
      operations: { xp: 0, level: 1 },
      security: { xp: 0, level: 1 },
    },
    reputation: {},
    stats: {
      tonsMined: 0,
      tonsBought: 0,
      tonsSold: 0,
      tradeProfit: 0,
      contractsCompleted: 0,
      bodiesScanned: 0,
      starsVisited: 0,
      dockingCount: 0,
      refuels: 0,
      kills: 0,
    },
  };
}

export function createStarterShip(): ShipState {
  return {
    id: "starter_sidewinder_ship",
    hullId: SIDEWINDER_STARTER_PROFILE.id,
    name: SIDEWINDER_STARTER_PROFILE.name,
    manufacturer: SIDEWINDER_STARTER_PROFILE.manufacturer,
    x: 1.0 * AU + 2.5e7,
    y: 0,
    vx: 0,
    vy: 29780 + 1500,
    heading: Math.PI / 2,
    throttlePercent: 0,
    powerDistribution: DEFAULT_POWER_DISTRIBUTION,
    // Preserved for old saves/catalog flavor only; physics does not cap Newtonian velocity.
    maxCruiseSpeed: SIDEWINDER_STARTER_PROFILE.baseCruiseSpeed,
    maxBoostSpeed: SIDEWINDER_STARTER_PROFILE.baseBoostSpeed,
    baseShieldStrength: SIDEWINDER_STARTER_PROFILE.baseShieldStrength,
    baseArmour: SIDEWINDER_STARTER_PROFILE.baseArmour,
    dryMass: SIDEWINDER_STARTER_PROFILE.hullMassKg + 8800,
    fuelLevel: 4000,
    maxFuel: 4000,
    engineThrust: 2500000,
    // Game-scale Isp (1000x chemical): keeps Tsiolkovsky honest while giving a delta-v
    // budget (~4,000 km/s) that covers brachistochrone transfer legs across the inner system.
    engineIsp: 3600000,
    cargoCapacity: 4,
    cargoCapacityTons: 4,
    passengerCapacity: 0,
    passengerCount: 0,
    passengerPodSlots: 0,
    cargo: normalizeCargoManifest({ water: 0, fuel: 0, ore: 0, machinery: 0, luxury: 0, he3: 0 }),
    miningPower: 1.0,
    warpCapacity: false,
    maxWarpRange: 0,
    scannerRangeLy: 6,
    systemScannerRange: 3 * AU,
    battery: SIDEWINDER_STARTER_PROFILE.defaultModules.powerDistributor.engineCapMj,
    maxBattery: SIDEWINDER_STARTER_PROFILE.defaultModules.powerDistributor.engineCapMj,
    installedUpgradeIds: [],
  };
}

function placeShipNearBody(ship: ShipState, bodies: CelestialBody[], bodyId: string, gameTime: number): ShipState {
  const body = bodies.find((entry) => entry.id === bodyId);
  if (!body) return ship;

  const bodyPos = getAbsoluteBodyPosition(body.id, bodies, gameTime);
  const bodyVelocity = getBodyVelocity(body.id, bodies, gameTime);
  const parentPos = body.parentId ? getAbsoluteBodyPosition(body.parentId, bodies, gameTime) : { x: 0, y: 0 };
  const awayX = bodyPos.x - parentPos.x;
  const awayY = bodyPos.y - parentPos.y;
  const awayLength = Math.hypot(awayX, awayY);
  const ux = awayLength > 1 ? awayX / awayLength : 1;
  const uy = awayLength > 1 ? awayY / awayLength : 0;
  const parkingDistance = (body.radius ?? 0) + 180_000;

  return {
    ...ship,
    x: bodyPos.x + ux * parkingDistance,
    y: bodyPos.y + uy * parkingDistance,
    vx: bodyVelocity.vx,
    vy: bodyVelocity.vy,
    heading: Math.atan2(-uy, -ux),
    throttlePercent: 0,
  };
}

export function createInitialState(commanderName = "Commander"): GameState {
  const initialMarkets: MarketState = {};
  STARS.forEach((s) => {
    Object.assign(initialMarkets, generateMarketsForStar(s.id));
  });

  const sol = STARS.find((star) => star.id === "star_sol") || STARS[0];
  const initialShip = placeShipNearBody(createStarterShip(), sol.planets, START_STATION_ID, 0);
  const shipRecord: OwnedShipRecord = {
    id: initialShip.id || "starter_sidewinder_ship",
    hullId: initialShip.hullId || SIDEWINDER_STARTER_PROFILE.id,
    name: initialShip.name,
    ship: initialShip,
    homePortId: START_PORT_ID,
  };

  return {
    saveVersion: SAVE_VERSION,
    profileId: `cmdr_${Date.now()}`,
    commanderName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    activeStarId: "star_sol",
    flightMode: "local-system",
    interstellar: null,
    gameTime: 0,
    timeScale: 60,
    playerCredits: 2000,
    playerProfile: createDefaultPlayerProfile(),
    ship: initialShip,
    ownedShips: [shipRecord],
    activeShipId: shipRecord.id,
    unlockedUpgradeIds: [],
    markets: initialMarkets,
    contracts: generateInitialContracts(),
    logs: [
      {
        timestamp: "Year 2086, Day 01 - 00:00:00",
        text: `Log initialized. ${commanderName} online in Sidewinder-class starter ship near Orbital Tether One high Earth orbit.`,
        type: "info",
      },
    ],
    selectedBodyId: START_STATION_ID,
    miningTargetId: null,
    isDocked: false,
    dockedBodyId: null,
    dockedPortId: null,
  };
}

export function formatGameTime(totalSeconds: number): string {
  const baseYear = 2086;
  const years = Math.floor(totalSeconds / 31557600);
  const remYear = totalSeconds % 31557600;
  const days = Math.floor(remYear / 86400);
  const remDay = remYear % 86400;
  const hours = Math.floor(remDay / 3600);
  const remHour = remDay % 3600;
  const minutes = Math.floor(remHour / 60);
  const seconds = Math.floor(remHour % 60);

  const yrStr = String(baseYear + years);
  const dStr = String(days + 1).padStart(3, "0");
  const hStr = String(hours).padStart(2, "0");
  const mStr = String(minutes).padStart(2, "0");
  const sStr = String(seconds).padStart(2, "0");

  return `Year ${yrStr}, Day ${dStr} - ${hStr}:${mStr}:${sStr}`;
}
