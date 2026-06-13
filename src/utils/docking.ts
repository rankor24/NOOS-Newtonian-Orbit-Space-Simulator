import { CelestialBody, ShipState } from "../types";
import { getAbsoluteBodyPosition, getBodyVelocity, getDockingSpecs } from "./physics";

export interface DockingClearanceState {
  bodyId: string;
  portId: string;
  holdStartedAt: number | null;
}

export interface DockingDepartureLock {
  bodyId: string;
  releaseDistance: number;
}

export function getDockingParkingRadius(body: CelestialBody) {
  const bodyRadius = body.radius ?? 0;
  if (body.type === "station") return bodyRadius + Math.max(4_000, bodyRadius * 2);
  if (body.type === "planet") return bodyRadius + 50_000;
  return bodyRadius + 20_000;
}

export function hasClearedDepartureLock(
  lock: DockingDepartureLock | null,
  ship: ShipState,
  bodies: CelestialBody[],
  gameTime: number,
) {
  if (!lock) return true;
  const body = bodies.find((entry) => entry.id === lock.bodyId);
  if (!body) return true;
  const bodyPos = getAbsoluteBodyPosition(body.id, bodies, gameTime);
  const distance = Math.hypot(ship.x - bodyPos.x, ship.y - bodyPos.y);
  return distance >= lock.releaseDistance;
}

export function isDepartureLockActive(
  lock: DockingDepartureLock | null,
  targetBodyId: string,
  ship: ShipState,
  bodies: CelestialBody[],
  gameTime: number,
) {
  return lock?.bodyId === targetBodyId && !hasClearedDepartureLock(lock, ship, bodies, gameTime);
}

export function buildUndockState(
  ship: ShipState,
  dockBody: CelestialBody,
  bodies: CelestialBody[],
  gameTime: number,
): { ship: ShipState; departureLock: DockingDepartureLock } {
  const bodyPos = getAbsoluteBodyPosition(dockBody.id, bodies, gameTime);
  const bodyVelocity = getBodyVelocity(dockBody.id, bodies, gameTime);
  const offsetX = ship.x - bodyPos.x;
  const offsetY = ship.y - bodyPos.y;
  const offsetLength = Math.hypot(offsetX, offsetY);
  const ux = offsetLength > 1 ? offsetX / offsetLength : 1;
  const uy = offsetLength > 1 ? offsetY / offsetLength : 0;
  const departureRadius = dockBody.type === "station"
    ? (dockBody.radius ?? 0) + 25_000
    : (dockBody.radius ?? 0) + Math.max(1_500_000, (dockBody.radius ?? 0) * 0.08);
  const targetMass = dockBody.type === "star" ? (dockBody.mass ?? 0) * 1.989e30 : (dockBody.mass ?? 0);
  const circularSpeed = targetMass > 0 ? Math.sqrt((6.6743e-11 * targetMass) / Math.max(1, departureRadius)) : 0;
  const tangentX = -uy;
  const tangentY = ux;

  return {
    ship: {
      ...ship,
      x: bodyPos.x + ux * departureRadius,
      y: bodyPos.y + uy * departureRadius,
      vx: bodyVelocity.vx + tangentX * circularSpeed,
      vy: bodyVelocity.vy + tangentY * circularSpeed,
      throttlePercent: 0,
    },
    departureLock: {
      bodyId: dockBody.id,
      releaseDistance: getDockingSpecs(dockBody).maxDistance * 1.05,
    },
  };
}
