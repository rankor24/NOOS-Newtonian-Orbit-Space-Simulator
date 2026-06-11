/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { OwnedShipRecord, ShipState } from "../types";
import { SHIP_MODELS, SHIP_MANUFACTURERS } from "../data/generated/names";
import { createStarterShip } from "./gameData";

export interface ShipyardCatalogEntry {
  id: string;
  name: string;
  manufacturer: string;
  class: string;
  description: string;
  baseCost: number;
  template: ShipState;
}

function makeShipFromModel(modelId: string): ShipState {
  const base = createStarterShip();
  switch (modelId) {
    case "ship_hauler":
      return { ...base, id: `ship_${modelId}`, hullId: modelId, name: "Hauler", manufacturer: "Zorgon Peterson", cargoCapacity: 12, cargoCapacityTons: 12, dryMass: 32000, engineThrust: 2200000, maxFuel: 5000, fuelLevel: 5000 };
    case "ship_adder":
      return { ...base, id: `ship_${modelId}`, hullId: modelId, name: "Adder", manufacturer: "Zorgon Peterson", cargoCapacity: 8, cargoCapacityTons: 8, dryMass: 28000, engineThrust: 2800000, maxFuel: 4500, fuelLevel: 4500, scannerRangeLy: 8 };
    case "ship_soyuz":
      return { ...base, id: `ship_${modelId}`, hullId: modelId, name: "Soyuz-M Crew Ferry", manufacturer: "Soyuz Orbital Group", cargoCapacity: 6, cargoCapacityTons: 6, passengerCapacity: 4, passengerPodSlots: 1, dryMass: 30000, engineThrust: 2400000, maxFuel: 5200, fuelLevel: 5200 };
    case "ship_kaguya":
      return { ...base, id: `ship_${modelId}`, hullId: modelId, name: "Kaguya-class Orbital Transporter", manufacturer: "Hayabusa Heavy Industries", cargoCapacity: 18, cargoCapacityTons: 18, passengerCapacity: 2, passengerPodSlots: 1, dryMass: 36000, engineThrust: 2100000, maxFuel: 6500, fuelLevel: 6500 };
    default:
      return base;
  }
}

export function getShipyardCatalog(): ShipyardCatalogEntry[] {
  const allowed = ["ship_sidewinder", "ship_hauler", "ship_adder", "ship_soyuz", "ship_kaguya"];
  return SHIP_MODELS.filter((model) => allowed.includes(model.id)).map((model) => ({
    id: model.id,
    name: model.name,
    manufacturer: SHIP_MANUFACTURERS.find((m) => m.id === model.manufacturerId)?.name || "Independent Yard",
    class: model.class,
    description: model.description,
    baseCost: model.baseCost,
    template: makeShipFromModel(model.id),
  }));
}

export function createOwnedShipFromCatalog(modelId: string, portId: string): OwnedShipRecord | null {
  const catalog = getShipyardCatalog();
  const entry = catalog.find((item) => item.id === modelId);
  if (!entry) return null;
  const shipId = `${modelId}_${Date.now()}`;
  return {
    id: shipId,
    hullId: modelId,
    name: entry.name,
    ship: { ...entry.template, id: shipId, hullId: modelId, name: entry.name },
    homePortId: portId,
  };
}
