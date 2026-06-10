/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface StarData {
  id: string;
  name: string;
  className: "O" | "B" | "A" | "F" | "G" | "K" | "M";
  color: string;
  temp: number;
  x: number;
  y: number;
  z: number;
  radius: number;
  mass: number;
  isPopulated: boolean;
  description: string;
  planets: CelestialBody[];
  systemFeatures?: SystemFeature[];
}

export type BodyType = "star" | "planet" | "dwarfPlanet" | "moon" | "asteroid" | "comet" | "station" | "belt" | "ring";

export interface CelestialBody {
  id: string;
  name: string;
  type: BodyType;
  mass: number | null;
  gm?: number | null;
  radius: number | null;
  radiusEstimate?: boolean;
  massEstimate?: boolean;
  gravitySource?: boolean;
  color: string;
  parentId: string | null;
  description: string;
  hasMarket: boolean;
  stationName?: string;
  source?: string;
  epoch?: string;
  semiMajorAxis: number;
  eccentricity: number;
  orbitalPeriod: number;
  inclination: number;
  longitudeOfAscendingNode?: number;
  argumentOfPeriapsis: number;
  meanAnomalyAtEpoch: number;
}

export type SystemFeatureType = "ring" | "belt" | "cloud";

export interface SystemFeature {
  id: string;
  name: string;
  type: SystemFeatureType;
  parentId: string | null;
  innerRadius: number;
  outerRadius: number;
  color: string;
  opacity?: number;
  labelColor?: string;
  description?: string;
  source?: string;
}

export interface ResourceMarket {
  id: string;
  name: string;
  buyPrice: number;
  sellPrice: number;
  available: number;
  maxCapacity: number;
  basePrice: number;
}

export interface MarketState {
  [portId: string]: {
    [resourceId: string]: ResourceMarket;
  };
}

export interface CargoItem {
  id: string;
  name: string;
  amount: number;
  massPerUnit: number;
}

export interface ShipUpgrade {
  id: string;
  name: string;
  description: string;
  cost: number;
  unlocked: boolean;
  category: "engine" | "fuelTank" | "cargo" | "sensor" | "drill" | "warp" | "passenger";
  modifier: (ship: ShipState) => ShipState;
}

export interface ShipState {
  id?: string;
  hullId?: string;
  name: string;
  manufacturer?: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  pitchDegPerSec?: number;
  yawDegPerSec?: number;
  throttlePercent: number;
  powerDistribution: {
    shields: number;
    engines: number;
    weapons: number;
  };
  /** Legacy Elite-derived flavor data. Not used by Newtonian flight physics. */
  maxCruiseSpeed: number;
  /** Legacy Elite-derived flavor data. Not used by Newtonian flight physics. */
  maxBoostSpeed: number;
  baseShieldStrength: number;
  baseArmour: number;
  dryMass: number;
  fuelLevel: number;
  maxFuel: number;
  engineThrust: number;
  engineIsp: number;
  cargoCapacity: number;
  cargoCapacityTons?: number;
  passengerCapacity: number;
  passengerCount: number;
  passengerPodSlots: number;
  cargo: { [resourceId: string]: number };
  miningPower: number;
  warpCapacity: boolean;
  maxWarpRange: number;
  scannerRangeLy: number;
  systemScannerRange: number;
  battery: number;
  maxBattery: number;
  installedUpgradeIds: string[];
}

export type CareerTrackId = "mining" | "trade" | "exploration" | "operations" | "security";

export interface CareerProgress {
  xp: number;
  level: number;
}

export interface CommanderStats {
  tonsMined: number;
  tonsBought: number;
  tonsSold: number;
  tradeProfit: number;
  contractsCompleted: number;
  bodiesScanned: number;
  starsVisited: number;
  dockingCount: number;
  refuels: number;
  kills: number;
}

export interface PlayerProfile {
  totalPlayTimeSec: number;
  overallLevel: number;
  career: Record<CareerTrackId, CareerProgress>;
  reputation: Record<string, number>;
  stats: CommanderStats;
}

export interface OwnedShipRecord {
  id: string;
  hullId: string;
  name: string;
  ship: ShipState;
  homePortId: string | null;
}

export interface SpaceContract {
  id: string;
  title: string;
  description: string;
  type: "delivery" | "mining" | "orbit" | "passenger";
  originId: string;
  destinationId: string;
  reward: number;
  issuerPortId?: string;
  issuerName?: string;
  issuerFaction?: string;
  destinationPortId?: string;
  destinationName?: string;
  routeTag?: string;
  cargoType?: string;
  amount?: number;
  passengerCount?: number;
  completed: boolean;
  accepted: boolean;
  deadline?: number;
  targetOrbitSemiMajorAxis?: number;
  targetOrbitEccentricity?: number;
}

export interface MissionLog {
  timestamp: string;
  text: string;
  type: "info" | "success" | "warning";
}

export interface InterstellarState {
  originStarId: string;
  targetStarId: string | null;
  xLy: number;
  yLy: number;
  vxLyPerSec: number;
  vyLyPerSec: number;
}

export interface GameState {
  saveVersion: number;
  profileId: string;
  commanderName: string;
  createdAt: string;
  updatedAt: string;
  activeStarId: string;
  flightMode: "local-system" | "interstellar";
  interstellar: InterstellarState | null;
  gameTime: number;
  timeScale: number;
  playerCredits: number;
  playerProfile: PlayerProfile;
  ship: ShipState;
  ownedShips: OwnedShipRecord[];
  activeShipId: string;
  unlockedUpgradeIds: string[];
  markets: MarketState;
  contracts: SpaceContract[];
  logs: MissionLog[];
  selectedBodyId: string | null;
  miningTargetId: string | null;
  isDocked: boolean;
  dockedBodyId: string | null;
  dockedPortId: string | null;
}
