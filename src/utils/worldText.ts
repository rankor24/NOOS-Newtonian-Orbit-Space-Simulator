import { CelestialBody, ShipState, SpaceContract } from "../types";
import {
  PLANETARY_BASES,
  SPACE_STATIONS,
  SHIP_MANUFACTURERS,
  SHIP_MODELS,
  SHIP_PARTS,
  TRADERS,
  REFUELERS,
} from "../data/generated/names";
import {
  STATION_APPROACH_HAILS,
  STATION_SCAN_RESPONSES,
  DOCKING_APPROVED,
  DOCKING_DENIED,
  STATION_PROTOCOLS,
  SHIP_ACKNOWLEDGMENTS,
  DEPARTURE_MESSAGES,
  REFUELER_HAILS,
  FACTION_AUTOMATED_MESSAGES,
  PLAYER_ACTION_MESSAGES,
  pickRandom,
} from "../data/generated/comm-dialogues";

export type PortRecord = {
  id: string;
  bodyId: string;
  orbitBodyId?: string;
  name: string;
  faction: string;
  description: string;
  services: string[];
  kind: "planetary" | "station";
  bodyType: CelestialBody["type"] | "unknown";
  bodyName: string;
};

const JOB_CARGO_LABELS: Record<string, string> = {
  water: "Water Ice",
  fuel: "Hydrogen Fuel",
  ore: "Metal Ore",
  machinery: "Machinery",
  luxury: "Luxuries",
  he3: "Helium-3 Gas",
};

export function getPortsForBody(body: CelestialBody | null | undefined): PortRecord[] {
  if (!body) return [];

  const stations = SPACE_STATIONS.filter((entry) => entry.id === body.id).map((entry) => ({
    id: entry.id,
    bodyId: body.id,
    orbitBodyId: entry.orbitBodyId,
    name: entry.name,
    faction: entry.faction,
    description: entry.description,
    services: entry.services,
    kind: "station" as const,
    bodyType: body.type,
    bodyName: body.name,
  }));

  if (body.type === "station") {
    if (stations.length > 0) return stations;
    if (!body.hasMarket) return [];

    return [{
      id: body.id,
      bodyId: body.id,
      orbitBodyId: body.parentId || undefined,
      name: body.stationName || body.name,
      faction: "Independent Traffic Control",
      description: body.description,
      services: ["repair", "refuel", "markets"],
      kind: "station",
      bodyType: body.type,
      bodyName: body.name,
    }];
  }

  const bases = PLANETARY_BASES.filter((entry) => entry.bodyId === body.id).map((entry) => ({
    id: entry.id,
    bodyId: body.id,
    name: entry.name,
    faction: entry.faction,
    description: entry.description,
    services: entry.services,
    kind: "planetary" as const,
    bodyType: body.type,
    bodyName: body.name,
  }));

  if (bases.length > 0) return bases;

  if (!body.hasMarket) return [];

  return [{
    id: body.id,
    bodyId: body.id,
    name: body.stationName || `${body.name} Port Authority`,
    faction: "Independent Traffic Control",
    description: body.description,
    services: ["repair", "refuel", "markets"],
    kind: body.type === "moon" || body.type === "planet" || body.type === "dwarfPlanet" ? "planetary" : "station",
    bodyType: body.type,
    bodyName: body.name,
  }];
}

export function getBodyPortRecord(body: CelestialBody | null | undefined): PortRecord | null {
  return getPortsForBody(body)[0] || null;
}

export function getAllPortsForBodies(bodies: CelestialBody[]): PortRecord[] {
  return bodies.flatMap((body) => getPortsForBody(body));
}

export function findPortByBodyId(bodyId: string, bodies: CelestialBody[]): PortRecord | null {
  const body = bodies.find((entry) => entry.id === bodyId);
  return getBodyPortRecord(body);
}

export function getDisplayPortName(body: CelestialBody | null | undefined): string {
  return getBodyPortRecord(body)?.name || body?.stationName || body?.name || "Unknown Port";
}

export function getDisplayPortDescription(body: CelestialBody | null | undefined): string {
  return getBodyPortRecord(body)?.description || body?.description || "No port data available.";
}

export function getDisplayPortFaction(body: CelestialBody | null | undefined): string {
  return getBodyPortRecord(body)?.faction || "Independent";
}

export function getDisplayPortServices(body: CelestialBody | null | undefined): string[] {
  return getBodyPortRecord(body)?.services || [];
}

export function pickPortForBody(body: CelestialBody | null | undefined, service?: string): PortRecord | null {
  const ports = getPortsForBody(body);
  if (!service) return ports[0] || null;
  return ports.find((port) => port.services.includes(service)) || ports[0] || null;
}

export function generateDockingDeniedMessage(body: CelestialBody | null | undefined): string {
  return `${getDisplayPortName(body)} traffic control: ${pickRandom(DOCKING_DENIED)}`;
}

export function generateDockingGrantedSequence(body: CelestialBody | null | undefined): string[] {
  const portName = getDisplayPortName(body);
  const faction = getDisplayPortFaction(body);
  return [
    `${portName} control: ${pickRandom(STATION_APPROACH_HAILS)}`,
    `${portName} control: ${pickRandom(STATION_SCAN_RESPONSES)}`,
    `${portName} control: ${pickRandom(DOCKING_APPROVED)}`,
    `Ship: ${pickRandom(SHIP_ACKNOWLEDGMENTS)}`,
    `[${faction}] ${pickRandom(STATION_PROTOCOLS)}`,
    `${portName}: ${pickRandom(PLAYER_ACTION_MESSAGES)}`,
  ];
}

export function generateUndockingSequence(body: CelestialBody | null | undefined): string[] {
  const portName = getDisplayPortName(body);
  return [
    `${portName} control: ${pickRandom(DEPARTURE_MESSAGES)}`,
    `${portName}: ${pickRandom(PLAYER_ACTION_MESSAGES)}`,
  ];
}

export function getAmbientTrafficLine(body: CelestialBody | null | undefined): string | null {
  if (!body) return null;

  const pool: string[] = [];
  const ports = getPortsForBody(body);
  const bodyName = body.name.toLowerCase();
  const portTokens = ports.map((port) => port.name.toLowerCase());

  for (const trader of TRADERS) {
    const routeMatch = trader.preferredRoutes.some((route) => {
      const lower = route.toLowerCase();
      return lower.includes(bodyName) || portTokens.some((token) => lower.includes(token));
    });
    if (routeMatch) {
      pool.push(`${trader.callsign}: ${trader.hailPhrase}`);
    }
  }

  for (const refueler of REFUELERS) {
    const area = refueler.serviceArea.toLowerCase();
    if (area.includes(bodyName) || portTokens.some((token) => area.includes(token)) || area.includes("anywhere") || area.includes("mobile")) {
      pool.push(`${refueler.name}: ${refueler.hailPhrase}`);
    }
  }

  for (const port of ports) {
    pool.push(`[${port.faction}] ${pickRandom(FACTION_AUTOMATED_MESSAGES)}`);
  }

  pool.push(pickRandom(REFUELER_HAILS));
  pool.push(pickRandom(FACTION_AUTOMATED_MESSAGES));

  return pool.length ? pickRandom(pool) : null;
}

export function getShipFlavor(ship: ShipState): { modelName: string; manufacturerName: string; manufacturerDescription?: string } {
  const model = SHIP_MODELS.find((entry) => entry.name === ship.name) || SHIP_MODELS.find((entry) => ship.name.includes(entry.name));
  const manufacturer = model
    ? SHIP_MANUFACTURERS.find((entry) => entry.id === model.manufacturerId)
    : SHIP_MANUFACTURERS.find((entry) => entry.name === ship.manufacturer);

  return {
    modelName: model?.name || ship.name,
    manufacturerName: manufacturer?.name || ship.manufacturer || "Independent Yard",
    manufacturerDescription: manufacturer?.description,
  };
}

export function getUpgradeFlavorName(upgradeName: string): string {
  const part = SHIP_PARTS.find((entry) => entry.name === upgradeName);
  return part?.name || upgradeName;
}

export function getPortMarketProfile(port: PortRecord): { priceBias: Partial<Record<string, number>>; capacityBias: number; specialties: string[] } {
  const faction = port.faction.toLowerCase();
  const services = new Set(port.services);
  const body = port.bodyName.toLowerCase();
  const profile = {
    priceBias: {} as Partial<Record<string, number>>,
    capacityBias: 1,
    specialties: [] as string[],
  };

  if (services.has("shipyard")) {
    profile.priceBias.machinery = 0.75;
    profile.priceBias.ore = 0.85;
    profile.specialties.push("shipbuilding");
    profile.capacityBias += 0.6;
  }
  if (services.has("refuel")) {
    profile.priceBias.fuel = 0.7;
    profile.specialties.push("refueling");
  }
  if (services.has("contracts")) {
    profile.specialties.push("dispatch");
  }
  if (body.includes("jupiter") || body.includes("ganymede") || body.includes("europa") || body.includes("callisto") || body.includes("io")) {
    profile.priceBias.he3 = 0.45;
    profile.priceBias.fuel = 0.6;
    profile.specialties.push("jovian-logistics");
  }
  if (body.includes("titan") || body.includes("enceladus") || body.includes("saturn")) {
    profile.priceBias.fuel = 0.75;
    profile.priceBias.water = 0.8;
    profile.specialties.push("cryo-chemicals");
  }
  if (body.includes("ceres") || body.includes("vesta") || body.includes("belt")) {
    profile.priceBias.ore = 0.45;
    profile.priceBias.water = 0.7;
    profile.priceBias.machinery = 1.5;
    profile.specialties.push("belt-mining");
  }
  if (body.includes("mars")) {
    profile.priceBias.ore = 0.65;
    profile.priceBias.machinery = 1.15;
    profile.specialties.push("martian-industry");
  }
  if (body.includes("earth") || body.includes("moon")) {
    profile.priceBias.luxury = 0.8;
    profile.priceBias.machinery = 0.85;
    profile.capacityBias += 1.2;
    profile.specialties.push("core-logistics");
  }

  if (faction.includes("soyuz") || faction.includes("zvezda") || faction.includes("gromov")) {
    profile.priceBias.fuel = Math.min(profile.priceBias.fuel ?? 1, 0.72);
    profile.priceBias.machinery = Math.min(profile.priceBias.machinery ?? 1, 0.95);
    profile.specialties.push("russian-heavy-industry");
  }
  if (faction.includes("nakamura") || faction.includes("hayabusa")) {
    profile.priceBias.luxury = Math.min(profile.priceBias.luxury ?? 1.05, 0.92);
    profile.priceBias.machinery = Math.min(profile.priceBias.machinery ?? 1.1, 0.9);
    profile.specialties.push("japanese-precision-tech");
  }
  if (faction.includes("belt miners") || faction.includes("independent belt")) {
    profile.priceBias.ore = Math.min(profile.priceBias.ore ?? 1, 0.4);
    profile.priceBias.machinery = Math.max(profile.priceBias.machinery ?? 1, 1.55);
    profile.specialties.push("independent-hauling");
  }

  return profile;
}

export function makePortContract(contract: SpaceContract, issuer: PortRecord, destination: PortRecord, routeTag: string): SpaceContract {
  return {
    ...contract,
    issuerPortId: issuer.id,
    issuerName: issuer.name,
    issuerFaction: issuer.faction,
    destinationPortId: destination.id,
    destinationName: destination.name,
    routeTag,
  };
}

export function getPortContractTemplates(issuer: PortRecord, destination: PortRecord): Array<{
  title: string;
  description: string;
  type: SpaceContract["type"];
  cargoType?: string;
  amount?: number;
  reward: number;
}> {
  const faction = issuer.faction.toLowerCase();
  const issuerName = issuer.name;
  const destinationName = destination.name;
  const destinationBody = destination.bodyName;

  if (faction.includes("soyuz") || faction.includes("zvezda") || faction.includes("gromov")) {
    return [
      {
        title: `Cryo Logistics to ${destinationBody}`,
        description: `${issuerName} needs reactor coolant, structural tanks, and propellant hardware moved to ${destinationName}. Expect disciplined manifests and heavy cargo tolerance requirements.`,
        type: "delivery",
        cargoType: "fuel",
        amount: 6,
        reward: 6200,
      },
      {
        title: `Russian Yard Machinery Run`,
        description: `${issuer.faction} procurement office is dispatching industrial machinery to ${destinationName}. Delivery windows are tight and penalties for delay are severe.`,
        type: "delivery",
        cargoType: "machinery",
        amount: 5,
        reward: 7100,
      },
    ];
  }

  if (faction.includes("nakamura") || faction.includes("hayabusa")) {
    return [
      {
        title: `Precision Component Transfer`,
        description: `${issuerName} is moving high-value instrument packages and fabrication tooling to ${destinationName}. Handle cargo carefully and keep approach vectors clean.`,
        type: "delivery",
        cargoType: "machinery",
        amount: 4,
        reward: 6800,
      },
      {
        title: `Research Consumables Dispatch`,
        description: `${issuer.faction} laboratories require refined support cargo at ${destinationName}. Scientific operations are waiting on your shipment.`,
        type: "delivery",
        cargoType: "luxury",
        amount: 3,
        reward: 5400,
      },
    ];
  }

  if (faction.includes("jovian")) {
    return [
      {
        title: `He3 Transfer Window`,
        description: `${issuerName} is shipping Helium-3 canisters toward ${destinationName}. Match schedules with the drydock handling team on arrival.`,
        type: "delivery",
        cargoType: "he3",
        amount: 4,
        reward: 12000,
      },
      {
        title: `Europa Research Relay`,
        description: `${issuer.faction} requests a close orbital telemetry pass near ${destinationBody} for updated route clearance and sensor calibration.`,
        type: "orbit",
        reward: 5200,
      },
    ];
  }

  if (faction.includes("belt miners") || faction.includes("independent belt")) {
    return [
      {
        title: `Ore Shuttle Contract`,
        description: `${issuerName} needs processed ore and mining kits redistributed toward ${destinationName}. Belt schedules are chaotic, but the payout is honest.`,
        type: "delivery",
        cargoType: "ore",
        amount: 8,
        reward: 6400,
      },
      {
        title: `Water Haul for the Belt`,
        description: `${issuer.faction} is short on water buffers and ice stock. Deliver the contracted mass to ${destinationName} and keep the reclamation crews running.`,
        type: "delivery",
        cargoType: "water",
        amount: 8,
        reward: 5900,
      },
    ];
  }

  if (faction.includes("saturnine") || faction.includes("hydrocarbon")) {
    return [
      {
        title: `Cryo Fuel Exchange`,
        description: `${issuerName} is dispatching volatile cryo-stock to ${destinationName}. Maintain thermal stability and avoid hot approaches.`,
        type: "delivery",
        cargoType: "fuel",
        amount: 5,
        reward: 6500,
      },
      {
        title: `Outer System Methane Relay`,
        description: `${issuer.faction} requires outer-system support cargo and return tankage routed through ${destinationName}.`,
        type: "delivery",
        cargoType: "water",
        amount: 6,
        reward: 6000,
      },
    ];
  }

  return [
    {
      title: `System Freight Dispatch`,
      description: `${issuerName} has contracted a routine logistics haul to ${destinationName}. Keep the cargo intact and file your arrival manifest on docking.`,
      type: "delivery",
      cargoType: "machinery",
      amount: 4,
      reward: 4200,
    },
    {
      title: `Traffic Survey Pass`,
      description: `${issuer.faction} needs an orbital verification pass near ${destinationBody} to validate approach lanes and navigation telemetry.`,
      type: "orbit",
      reward: 4500,
    },
  ];
}

export function describeCargoType(cargoType: string | undefined): string {
  return cargoType ? (JOB_CARGO_LABELS[cargoType] || cargoType) : "Cargo";
}
