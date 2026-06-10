import { CelestialBody } from "../../types";
import { SOL_MOONS_GENERATED } from "./sol-moons";
import { SOL_SMALL_BODIES_GENERATED } from "./sol-small-bodies";
import { SPACE_STATIONS, type SpaceStation } from "./names";

const AU = 1.496e11;
const DAY_SEC = 86400;
const G = 6.6743e-11;

const ORBIT_BODY_ALIASES: Record<string, string> = {
  sol_luna: "sol_moon",
};

const sol = (body: Omit<CelestialBody, "parentId"> & { parentId?: string | null }): CelestialBody => ({
  parentId: "star_sol",
  source: "JPL approximate positions + curated physical values",
  epoch: "curated-static",
  gravitySource: body.mass != null && body.mass > 0,
  ...body,
});

const moon = (body: Omit<CelestialBody, "type" | "hasMarket">): CelestialBody => ({
  type: "moon",
  hasMarket: false,
  source: "Curated Pluto-system values",
  epoch: "curated-static",
  gravitySource: body.mass != null && body.mass > 0,
  ...body,
});

const SOL_MAJOR_BODIES: CelestialBody[] = [
  sol({
    id: "sol_mercury",
    name: "Mercury",
    type: "planet",
    mass: 3.30103e23,
    radius: 2439400,
    color: "#9ca3af",
    description: "Innermost planet. Fast year, high solar flux, deep gravity well for early-system transfer planning.",
    hasMarket: true,
    stationName: "Hermes Thermal Outpost",
    semiMajorAxis: 0.38709893 * AU,
    eccentricity: 0.20563069,
    orbitalPeriod: 87.9691 * DAY_SEC,
    inclination: 0.1223,
    argumentOfPeriapsis: 0.5083,
    meanAnomalyAtEpoch: 3.0507,
  }),
  sol({
    id: "sol_venus",
    name: "Venus",
    type: "planet",
    mass: 4.86731e24,
    radius: 6051800,
    color: "#eab308",
    description: "Dense hot world under thick clouds. Useful waypoint for inner-system transfer geometry.",
    hasMarket: true,
    stationName: "Aphrodite Aero-Station",
    semiMajorAxis: 0.72333199 * AU,
    eccentricity: 0.00677323,
    orbitalPeriod: 224.701 * DAY_SEC,
    inclination: 0.0592,
    argumentOfPeriapsis: 0.9579,
    meanAnomalyAtEpoch: 0.8804,
  }),
  sol({
    id: "sol_earth",
    name: "Earth",
    type: "planet",
    mass: 5.97217e24,
    radius: 6371008,
    color: "#3b82f6",
    description: "Human homeworld. Main economic hub and starter-zone anchor body.",
    hasMarket: true,
    stationName: "Tether City One",
    semiMajorAxis: 1.00000011 * AU,
    eccentricity: 0.01671022,
    orbitalPeriod: 365.256 * DAY_SEC,
    inclination: 0,
    argumentOfPeriapsis: 1.9933,
    meanAnomalyAtEpoch: 6.2399,
  }),
  sol({
    id: "sol_mars",
    name: "Mars",
    type: "planet",
    mass: 6.41691e23,
    radius: 3389500,
    color: "#f97316",
    description: "Red terrestrial world with major industrial expansion and transfer-orbit relevance.",
    hasMarket: true,
    stationName: "Olympus Overlook",
    semiMajorAxis: 1.52366231 * AU,
    eccentricity: 0.09341233,
    orbitalPeriod: 686.98 * DAY_SEC,
    inclination: 0.0323,
    argumentOfPeriapsis: 5.0004,
    meanAnomalyAtEpoch: 0.3386,
  }),
  sol({
    id: "sol_jupiter",
    name: "Jupiter",
    type: "planet",
    mass: 1.898125e27,
    radius: 69911000,
    color: "#fed7aa",
    description: "Largest planet in Sol. Dominant outer-system gravity source.",
    hasMarket: true,
    stationName: "Kibo Radiation Lab",
    semiMajorAxis: 5.20336301 * AU,
    eccentricity: 0.04839266,
    orbitalPeriod: 4332.59 * DAY_SEC,
    inclination: 0.0228,
    argumentOfPeriapsis: 4.7799,
    meanAnomalyAtEpoch: 0.3494,
  }),
  sol({
    id: "sol_saturn",
    name: "Saturn",
    type: "planet",
    mass: 5.68317e26,
    radius: 58232000,
    color: "#fef08a",
    description: "Ringed giant with major moon system and strong outer-system economy potential.",
    hasMarket: true,
    stationName: undefined,
    semiMajorAxis: 9.53707032 * AU,
    eccentricity: 0.0541506,
    orbitalPeriod: 10759.22 * DAY_SEC,
    inclination: 0.0434,
    argumentOfPeriapsis: 5.9235,
    meanAnomalyAtEpoch: 5.5480,
  }),
  sol({
    id: "sol_uranus",
    name: "Uranus",
    type: "planet",
    mass: 8.68103e25,
    radius: 25362000,
    color: "#67e8f9",
    description: "Ice giant with tilted rotation axis and extensive moon system.",
    hasMarket: true,
    stationName: undefined,
    semiMajorAxis: 19.19126393 * AU,
    eccentricity: 0.04716771,
    orbitalPeriod: 30688.5 * DAY_SEC,
    inclination: 0.0135,
    argumentOfPeriapsis: 1.6889,
    meanAnomalyAtEpoch: 2.4820,
  }),
  sol({
    id: "sol_neptune",
    name: "Neptune",
    type: "planet",
    mass: 1.02413e26,
    radius: 24622000,
    color: "#2563eb",
    description: "Outer ice giant. Gateway to Kuiper Belt gameplay.",
    hasMarket: true,
    stationName: undefined,
    semiMajorAxis: 30.06896348 * AU,
    eccentricity: 0.00858587,
    orbitalPeriod: 60182.0 * DAY_SEC,
    inclination: 0.0309,
    argumentOfPeriapsis: 4.7739,
    meanAnomalyAtEpoch: 4.6734,
  }),
  sol({
    id: "sol_pluto",
    name: "Pluto",
    type: "dwarfPlanet",
    mass: 1.303e22,
    radius: 1188300,
    color: "#cbd5e1",
    description: "Dwarf planet in resonant outer Sol orbit. Marker for Kuiper Belt frontier.",
    hasMarket: true,
    stationName: undefined,
    semiMajorAxis: 39.482 * AU,
    eccentricity: 0.2488,
    orbitalPeriod: 90560 * DAY_SEC,
    inclination: 0.2992,
    argumentOfPeriapsis: 1.9853,
    meanAnomalyAtEpoch: 0.2490,
  }),
];

const SOL_PLUTO_MOONS: CelestialBody[] = [
  {
    id: "sol_charon",
    name: "Charon",
    type: "moon",
    mass: 1.586e21,
    radius: 606000,
    color: "#94a3b8",
    parentId: "sol_pluto",
    description: "Largest Pluto moon. Binary-like dwarf-planet partner in gameplay terms.",
    hasMarket: true,
    stationName: "Charon Gate",
    semiMajorAxis: 19573000,
    eccentricity: 0.0002,
    orbitalPeriod: 6.38723 * DAY_SEC,
    inclination: 0.0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 0.7,
  },
  moon({
    id: "sol_styx",
    name: "Styx",
    mass: 7.5e15,
    radius: 8000,
    color: "#cbd5e1",
    parentId: "sol_pluto",
    description: "Small Pluto moon.",
    semiMajorAxis: 42656000,
    eccentricity: 0.0058,
    orbitalPeriod: 20.16155 * DAY_SEC,
    inclination: 0.0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 0.5,
  }),
  moon({
    id: "sol_nix",
    name: "Nix",
    mass: 4.5e16,
    radius: 19600,
    color: "#e2e8f0",
    parentId: "sol_pluto",
    description: "Small Pluto moon.",
    semiMajorAxis: 48694000,
    eccentricity: 0.0020,
    orbitalPeriod: 24.85463 * DAY_SEC,
    inclination: 0.0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 1.7,
  }),
  moon({
    id: "sol_kerberos",
    name: "Kerberos",
    mass: 1.6e16,
    radius: 12000,
    color: "#cbd5e1",
    parentId: "sol_pluto",
    description: "Small Pluto moon.",
    semiMajorAxis: 57783000,
    eccentricity: 0.0032,
    orbitalPeriod: 32.16756 * DAY_SEC,
    inclination: 0.0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 2.3,
  }),
  moon({
    id: "sol_hydra",
    name: "Hydra",
    mass: 4.8e16,
    radius: 25500,
    color: "#94a3b8",
    parentId: "sol_pluto",
    description: "Outermost major Pluto moon.",
    semiMajorAxis: 64738000,
    eccentricity: 0.0059,
    orbitalPeriod: 38.20177 * DAY_SEC,
    inclination: 0.0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 1.1,
  }),
];

const SOL_ORBIT_PARENTS: CelestialBody[] = [
  ...SOL_MAJOR_BODIES,
  ...SOL_MOONS_GENERATED.filter(
    (b) => !(/^[Ss]\d/.test(b.name) || /^[Ss]\//.test(b.name) || /^[Ss]_\d/.test(b.name) || /\d{4}/.test(b.name) || /^[Ss]\s*\d/.test(b.name))
  ),
  ...SOL_PLUTO_MOONS,
  ...SOL_SMALL_BODIES_GENERATED.filter(
    (b) => !(/^[Ss]\d/.test(b.name) || /^[Ss]\//.test(b.name) || /^[Ss]_\d/.test(b.name) || /\d{4}/.test(b.name) || /^[Ss]\s*\d/.test(b.name))
  ),
];

const STATION_ALTITUDE_BY_ID: Record<string, number> = {
  station_earth_low: 35_786_000,
  station_earth_mid: 24_000_000,
  station_mir2: 18_000_000,
  station_liberty: 42_000_000,
  station_mars_phobos: 17_000_000,
  station_vostok: 20_000_000,
  station_ganymede: 2_500_000,
  station_titan: 1_800_000,
  station_uranus: 90_000_000,
  station_neptune: 80_000_000,
  station_pluto: 8_000_000,
  station_belt_capricorn: 800_000,
  station_belt_lyra: 800_000,
  station_zarya: 3_500_000,
  station_kaguya: 4_000_000,
  station_odyssey: 6_000_000,
};

function resolveOrbitBodyId(orbitBodyId: string): string {
  return ORBIT_BODY_ALIASES[orbitBodyId] || orbitBodyId;
}

function getStationDisplayColor(station: SpaceStation): string {
  if (station.type === "shipyard") return "#38bdf8";
  if (station.type === "research") return "#22d3ee";
  if (station.type === "asteroid") return "#f59e0b";
  return "#a78bfa";
}

function getDefaultStationAltitude(parent: CelestialBody): number {
  const radius = parent.radius ?? 0;
  if (parent.type === "moon") return Math.max(1_500_000, radius * 1.5);
  if (parent.type === "asteroid" || parent.type === "comet") return Math.max(500_000, radius * 4);
  if (parent.type === "dwarfPlanet") return Math.max(5_000_000, radius * 4);
  return Math.max(12_000_000, radius * 1.2);
}

function getStationPhase(stationId: string): number {
  let hash = 0;
  for (let i = 0; i < stationId.length; i += 1) {
    hash = (hash * 31 + stationId.charCodeAt(i)) >>> 0;
  }
  return (hash / 0xffffffff) * Math.PI * 2;
}

function makeStationBody(station: SpaceStation, parent: CelestialBody): CelestialBody {
  const altitude = STATION_ALTITUDE_BY_ID[station.id] ?? getDefaultStationAltitude(parent);
  const semiMajorAxis = (parent.radius ?? 0) + altitude;
  const parentMass = parent.mass ?? 0;
  const orbitalPeriod = parentMass > 0
    ? 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / (G * parentMass))
    : DAY_SEC;

  return {
    id: station.id,
    name: station.name,
    type: "station",
    mass: 0,
    radius: station.type === "shipyard" ? 1_800 : station.type === "asteroid" ? 3_000 : 900,
    gravitySource: false,
    color: getStationDisplayColor(station),
    parentId: parent.id,
    description: station.description,
    hasMarket: true,
    stationName: station.name,
    source: "Curated station orbit catalog",
    epoch: "curated-static",
    semiMajorAxis,
    eccentricity: 0,
    orbitalPeriod,
    inclination: 0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: getStationPhase(station.id),
  };
}

const SOL_SPACE_STATIONS: CelestialBody[] = SPACE_STATIONS.flatMap((station) => {
  if (!station.orbitBodyId) return [];
  const parentId = resolveOrbitBodyId(station.orbitBodyId);
  const parent = SOL_ORBIT_PARENTS.find((body) => body.id === parentId);
  if (!parent) return [];
  return [makeStationBody(station, parent)];
});

export const SOL_BODIES_GENERATED: CelestialBody[] = [
  ...SOL_ORBIT_PARENTS,
  ...SOL_SPACE_STATIONS,
];
