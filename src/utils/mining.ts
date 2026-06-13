import { CelestialBody, ShipState } from "../types";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function hasAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

export function isMineableBody(body: CelestialBody | null): boolean {
  if (!body || body.hasMarket) return false;
  if (body.type === "asteroid" || body.type === "moon" || body.type === "comet" || body.type === "belt" || body.type === "ring") return true;
  const desc = `${body.name} ${body.description}`.toLowerCase();
  return body.type === "planet" && hasAny(desc, ["gas giant", "hydrogen", "helium", "atmosphere", "methane"]);
}

export function getMiningYieldProfile(body: CelestialBody): Array<{ resourceId: keyof ShipState["cargo"]; share: number }> {
  const desc = `${body.name} ${body.description}`.toLowerCase();

  if (body.type === "planet" && hasAny(desc, ["gas giant", "hydrogen", "helium", "atmosphere", "methane"])) {
    return [
      { resourceId: "he3", share: 0.55 },
      { resourceId: "fuel", share: 0.3 },
      { resourceId: "water", share: 0.15 },
    ];
  }

  if (body.type === "comet" || hasAny(desc, ["ice", "icy", "frost", "cryo", "glacier"])) {
    return [
      { resourceId: "water", share: 0.68 },
      { resourceId: "ore", share: 0.18 },
      { resourceId: "fuel", share: 0.1 },
      { resourceId: "he3", share: 0.04 },
    ];
  }

  if (body.type === "asteroid" || body.type === "belt" || body.type === "ring") {
    return [
      { resourceId: "ore", share: 0.72 },
      { resourceId: "water", share: 0.16 },
      { resourceId: "fuel", share: 0.07 },
      { resourceId: "he3", share: 0.05 },
    ];
  }

  return [
    { resourceId: "ore", share: 0.52 },
    { resourceId: "water", share: 0.32 },
    { resourceId: "fuel", share: 0.1 },
    { resourceId: "he3", share: 0.06 },
  ];
}

export function applyMiningYield(ship: ShipState, body: CelestialBody, tons: number): { cargo: ShipState["cargo"]; minedTons: number } {
  const capacity = ship.cargoCapacityTons ?? ship.cargoCapacity;
  const currentCargo = Object.values(ship.cargo).reduce((sum, value) => sum + (value || 0), 0);
  const availableSpace = Math.max(0, capacity - currentCargo);
  const minedTons = clamp(tons, 0, availableSpace);
  if (minedTons <= 0) return { cargo: ship.cargo, minedTons: 0 };

  const cargo = { ...ship.cargo };
  for (const yieldPart of getMiningYieldProfile(body)) {
    cargo[yieldPart.resourceId] = (cargo[yieldPart.resourceId] || 0) + minedTons * yieldPart.share;
  }
  return { cargo, minedTons };
}

export function summarizeMiningYield(body: CelestialBody): string {
  return getMiningYieldProfile(body)
    .filter((entry) => entry.share >= 0.08)
    .map((entry) => `${String(entry.resourceId).toUpperCase()} ${(entry.share * 100).toFixed(0)}%`)
    .join(" • ");
}
