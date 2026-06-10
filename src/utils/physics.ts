/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CelestialBody, ShipState } from "../types";

const G = 6.6743e-11; // Gravitational Constant m^3 kg^-1 s^-2
const G0 = 9.80665;
const MIN_GRAVITY_DISTANCE = 1e4;

function addGravityFromPoint(
  accX: number,
  accY: number,
  sourceMass: number,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  minDistance: number = MIN_GRAVITY_DISTANCE
): { accX: number; accY: number } {
  if (sourceMass <= 0) return { accX, accY };

  const dx = sourceX - targetX;
  const dy = sourceY - targetY;
  const distance = Math.hypot(dx, dy);
  if (distance <= minDistance) return { accX, accY };

  const acceleration = (G * sourceMass) / (distance * distance);
  return {
    accX: accX + acceleration * (dx / distance),
    accY: accY + acceleration * (dy / distance),
  };
}

export function getSummedGravityAcceleration(
  shipX: number,
  shipY: number,
  bodies: CelestialBody[],
  time: number,
  starMass: number = 1.989e30,
  posCache?: BodyPosCache
): { accX: number; accY: number } {
  let accX = 0;
  let accY = 0;

  const starGravity = addGravityFromPoint(accX, accY, starMass, 0, 0, shipX, shipY);
  accX = starGravity.accX;
  accY = starGravity.accY;

  // Only consider bodies within a reasonable distance of the ship (10 AU cutoff)
  const MAX_GRAVITY_DISTANCE = 10 * 1.496e11; // 10 AU
  for (const body of bodies) {
    if (!body.gravitySource || body.mass == null || body.mass <= 0) continue;
    const absPos = posCache
      ? getCachedPosition(posCache, body.id)
      : getAbsoluteBodyPosition(body.id, bodies, time);
    const distToBody = Math.hypot(shipX - absPos.x, shipY - absPos.y);
    if (distToBody > MAX_GRAVITY_DISTANCE) continue; // skip distant bodies
    const bodyGravity = addGravityFromPoint(
      accX,
      accY,
      body.mass,
      absPos.x,
      absPos.y,
      shipX,
      shipY,
      Math.max(MIN_GRAVITY_DISTANCE, (body.radius ?? 0) * 0.25)
    );
    accX = bodyGravity.accX;
    accY = bodyGravity.accY;
  }

  return { accX, accY };
}

/**
 * Solve Kepler's equation E - e * sin(E) = M
 * using Newton-Raphson iteration.
 */
export function solveKepler(M: number, e: number): number {
  let E = M; // Initial guess
  const tolerance = 1e-6;
  const maxIterations = 30;

  for (let i = 0; i < maxIterations; i++) {
    const deltaE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= deltaE;
    if (Math.abs(deltaE) < tolerance) break;
  }
  return E;
}

/**
 * Calculates the 2D local position of a celestial body relative to its parent
 * using its Keplerian orbit details at a given game time (seconds).
 */
export function getRelativeKeplerianPosition(body: CelestialBody, time: number): { x: number; y: number } {
  // 1. Calculate Mean Anomaly (M)
  // M = M_starting + mean_motion * offset
  const meanMotion = (2 * Math.PI) / body.orbitalPeriod;
  let M = body.meanAnomalyAtEpoch + meanMotion * time;
  M = M % (2 * Math.PI);
  if (M < 0) M += 2 * Math.PI;

  // 2. Solve for Eccentric Anomaly (E)
  const E = solveKepler(M, body.eccentricity);

  // 3. Coordinate positions in orbital plane (relative to periapsis focus)
  const xOrbial = body.semiMajorAxis * (Math.cos(E) - body.eccentricity);
  const yOrbial = body.semiMajorAxis * Math.sqrt(1 - body.eccentricity * body.eccentricity) * Math.sin(E);

  // 4. Apply Argument of Periapsis rotation
  const cosW = Math.cos(body.argumentOfPeriapsis);
  const sinW = Math.sin(body.argumentOfPeriapsis);

  const xRel = xOrbial * cosW - yOrbial * sinW;
  const yRel = xOrbial * sinW + yOrbial * cosW;

  return { x: xRel, y: yRel };
}

/**
 * Precompute absolute positions for all bodies at a given time.
 * Returns a Map<bodyId, {x, y}> usable for O(1) lookups.
 * Bodies are sorted by depth so parent positions are always computed first.
 */
export type BodyPosCache = Map<string, { x: number; y: number }>;

export function buildBodyPositionCache(bodies: CelestialBody[], time: number): BodyPosCache {
  const cache: BodyPosCache = new Map();
  // Depth-sort: star (no parent) first, then planets (parent=star), then moons, etc.
  const depth = (b: CelestialBody): number => {
    let d = 0;
    let cur: CelestialBody | undefined = b;
    while (cur?.parentId) { d++; cur = bodies.find((p) => p.id === cur!.parentId); }
    return d;
  };
  const sorted = [...bodies].sort((a, b) => depth(a) - depth(b));
  for (const body of sorted) {
    if (!body.parentId) {
      cache.set(body.id, { x: 0, y: 0 });
    } else {
      const rel = getRelativeKeplerianPosition(body, time);
      const parent = cache.get(body.parentId) || { x: 0, y: 0 };
      cache.set(body.id, { x: parent.x + rel.x, y: parent.y + rel.y });
    }
  }
  return cache;
}

export function getCachedPosition(cache: BodyPosCache, bodyId: string): { x: number; y: number } {
  return cache.get(bodyId) || { x: 0, y: 0 };
}

/**
 * Recursively resolves the absolute coordinates of a body in the system's global reference frame.
 * Prefer buildBodyPositionCache + getCachedPosition for batch lookups.
 */
export function getAbsoluteBodyPosition(
  bodyId: string,
  allBodies: CelestialBody[],
  time: number
): { x: number; y: number } {
  const body = allBodies.find((b) => b.id === bodyId);
  if (!body) return { x: 0, y: 0 };

  if (!body.parentId) {
    // If it has no parent, it's the central star (at global 0,0)
    return { x: 0, y: 0 };
  }

  // Get relative position to parent
  const rel = getRelativeKeplerianPosition(body, time);

  // Get parent's absolute position
  const parentPos = getAbsoluteBodyPosition(body.parentId, allBodies, time);

  return {
    x: parentPos.x + rel.x,
    y: parentPos.y + rel.y,
  };
}

export function getBodyVelocity(
  bodyId: string,
  allBodies: CelestialBody[],
  time: number,
  sampleSeconds: number = 1
): { vx: number; vy: number } {
  const dt = Math.max(0.001, sampleSeconds);
  const current = getAbsoluteBodyPosition(bodyId, allBodies, time);
  const next = getAbsoluteBodyPosition(bodyId, allBodies, time + dt);
  return {
    vx: (next.x - current.x) / dt,
    vy: (next.y - current.y) / dt,
  };
}

function getBodyDepth(body: CelestialBody, allBodies: CelestialBody[]): number {
  let depth = 0;
  let current: CelestialBody | undefined = body;
  const seen = new Set<string>();

  while (current?.parentId && !seen.has(current.id)) {
    seen.add(current.id);
    depth += 1;
    current = allBodies.find((entry) => entry.id === current!.parentId);
  }

  return depth;
}

function getParentMass(body: CelestialBody, allBodies: CelestialBody[], starMass: number): number {
  if (!body.parentId) return starMass;
  const parent = allBodies.find((entry) => entry.id === body.parentId);
  if (!parent) return starMass;
  return parent.type === "star" ? starMass : parent.mass ?? starMass;
}

/**
 * Calculate Sphere of Influence (SOI) radius for a body orbiting its parent.
 * SOI = a * (m_body / m_parent)^(2/5)
 */
export function getSphereOfInfluence(body: CelestialBody, parentMass: number = 1.989e30): number {
  if (body.type === "star" || !body.parentId) return Infinity;
  if ((body.mass ?? 0) <= 0 || parentMass <= 0) return 0;
  return body.semiMajorAxis * Math.pow((body.mass ?? 0) / parentMass, 0.4);
}

/**
 * Finds the dominant gravity source (Active Body) influencing the ship.
 * Returns the body and the relative distance to it.
 */
export function getDominantGravitySource(
  shipX: number,
  shipY: number,
  bodies: CelestialBody[],
  time: number,
  starMass: number = 1.989e30,
  posCache?: BodyPosCache
): { body: CelestialBody | null; distance: number; soi: number } {
  const star = bodies.find((b) => b.type === "star") || null;
  let dominantBody: CelestialBody | null = star;
  let dominantDist = star ? Math.hypot(shipX, shipY) : Infinity;
  let activeSOI = Infinity;
  let dominantDepth = star ? 0 : -1;

  for (const body of bodies) {
    if (body.type === "star") continue;

    const absPos = posCache ? getCachedPosition(posCache, body.id) : getAbsoluteBodyPosition(body.id, bodies, time);
    const dist = Math.hypot(shipX - absPos.x, shipY - absPos.y);
    const parentMass = getParentMass(body, bodies, starMass);
    const soi = getSphereOfInfluence(body, parentMass);
    if (soi <= 0 || dist >= soi) continue;

    const depth = getBodyDepth(body, bodies);
    const isBetterNestedMatch = depth > dominantDepth;
    const isSameDepthCloser = depth === dominantDepth && dist / soi < dominantDist / activeSOI;

    if (isBetterNestedMatch || isSameDepthCloser) {
      dominantBody = body;
      dominantDist = dist;
      activeSOI = soi;
      dominantDepth = depth;
    }
  }

  return { body: dominantBody, distance: dominantDist, soi: activeSOI };
}

/**
 * Newtonian physics state integrator using sub-stepping Euler-Cromer integration
 * to maintain orbital integration fidelity during High Warp factors (e.g. 1000x / 10000x).
 */
export function integrateSpacecraft(
  ship: ShipState,
  bodies: CelestialBody[],
  timeStart: number,
  dt: number,
  throttlePercent: number,
  starMass: number = 1.989e30,
  posCache?: BodyPosCache
): ShipState {
  let { x, y, vx, vy, fuelLevel, dryMass, heading, engineThrust, engineIsp } = ship;
  const clampedThrottle = Math.max(-100, Math.min(100, throttlePercent));
  const thrustScale = Math.abs(clampedThrottle) / 100;
  const thrustDirection = clampedThrottle >= 0 ? 1 : -1;

  const referenceBody = getDominantGravitySource(x, y, bodies, timeStart, starMass, posCache).body;
  const referencePos = referenceBody
    ? (posCache ? getCachedPosition(posCache, referenceBody.id) : getAbsoluteBodyPosition(referenceBody.id, bodies, timeStart))
    : { x: 0, y: 0 };
  const referenceMu = referenceBody
    ? G * (referenceBody.type === "star" ? starMass : referenceBody.mass ?? 0)
    : 0;
  const referenceDistance = Math.max(1, Math.hypot(x - referencePos.x, y - referencePos.y));
  const localOrbitPeriod = referenceMu > 0
    ? 2 * Math.PI * Math.sqrt((referenceDistance * referenceDistance * referenceDistance) / referenceMu)
    : Infinity;
  const maxSubDt = Math.min(300, Number.isFinite(localOrbitPeriod) ? localOrbitPeriod / 120 : 300);
  const maxSubsteps = 240;
  const substeps = Math.min(maxSubsteps, Math.max(1, Math.ceil(dt / Math.max(1, maxSubDt))));
  const subDt = dt / substeps;

  for (let s = 0; s < substeps; s++) {
    const currentSimTime = timeStart + s * subDt;

    // 1. Calculate active gravity acceleration from star + all real bodies
    let { accX, accY } = getSummedGravityAcceleration(x, y, bodies, currentSimTime, starMass, posCache);

    // Add continuous thrust if operating thrusters
    const totalMass = dryMass + fuelLevel;
    if (thrustScale > 0 && fuelLevel > 0) {
      const requestedThrust = engineThrust * thrustScale;
      const safeIsp = Math.max(1, engineIsp);
      const requestedFuelBurn = (requestedThrust / (safeIsp * G0)) * subDt;
      const fuelFractionAvailable = requestedFuelBurn > 0 ? Math.min(1, fuelLevel / requestedFuelBurn) : 1;
      const effectiveThrust = requestedThrust * fuelFractionAvailable;
      const thrustAcc = effectiveThrust / totalMass;
      accX += thrustAcc * Math.cos(heading) * thrustDirection;
      accY += thrustAcc * Math.sin(heading) * thrustDirection;
      fuelLevel = Math.max(0, fuelLevel - requestedFuelBurn);
    }

    // Standard Euler-Cromer integration
    vx += accX * subDt;
    vy += accY * subDt;
    x += vx * subDt;
    y += vy * subDt;
  }

  return {
    ...ship,
    x,
    y,
    vx,
    vy,
    fuelLevel,
  };
}

/**
 * Calculates essential orbit metrics relative to selected body (altitude, speed, escape speed, orbital status).
 */
export interface OrbitMetrics {
  altitude: number;
  relVx: number;
  relVy: number;
  relSpeed: number;
  escapeVelocity: number;
  circularVelocity: number;
  semimajorAxis: number;
  eccentricity: number;
  periapsisAltitude: number;
  apoapsisAltitude: number | null;
  orbitPeriod: number | null;
  timeToPeriapsis: number | null;
}

export function computeOrbitMetrics(
  ship: ShipState,
  targetBody: CelestialBody | null,
  bodies: CelestialBody[],
  time: number,
  posCache?: BodyPosCache
): OrbitMetrics | null {
  if (!targetBody) return null;

  const bodyPos = posCache ? getCachedPosition(posCache, targetBody.id) : getAbsoluteBodyPosition(targetBody.id, bodies, time);
  const dx = ship.x - bodyPos.x;
  const dy = ship.y - bodyPos.y;
  const distance = Math.hypot(dx, dy);

  // Target true radius
  const bodyRadius = targetBody.radius ?? 0;
  const altitude = Math.max(0, distance - bodyRadius);

  const targetVelocity = getBodyVelocity(targetBody.id, bodies, time);

  const relVx = ship.vx - targetVelocity.vx;
  const relVy = ship.vy - targetVelocity.vy;
  const relSpeed = Math.hypot(relVx, relVy);

  // Escape velocity relative to active body: v = sqrt(2 * G * M / r)
  const baseMass = targetBody.mass ?? 0;
  const trueMass = targetBody.type === "star" ? baseMass * 1.989e30 : baseMass;
  const escapeVelocity = Math.sqrt((2 * G * trueMass) / distance);

  // Circular velocity: v = sqrt(G * M / r)
  const circularVelocity = Math.sqrt((G * trueMass) / distance);

  // Semi-major axis and eccentricity of relative orbit
  // Vis-viva: v^2 = G * M * (2/r - 1/a) => 1/a = 2/r - v^2/(G*M)
  const mu = G * trueMass;
  const invA = mu > 0 ? 2.0 / distance - (relSpeed * relSpeed) / mu : 0;
  const semimajorAxis = invA !== 0 ? 1.0 / invA : Infinity;

  // Specific Angular Momentum: h = r x v = rx * vy - ry * vx
  const h = dx * relVy - dy * relVx;
  // Specific orbital energy: epsilon = v^2 / 2 - mu / r
  const epsilon = (relSpeed * relSpeed) / 2.0 - mu / distance;
  // ccrentricity: e = sqrt(1 + 2 * epsilon * h^2 / mu^2)
  let eccentricityVal = mu > 0 ? 1 + (2 * epsilon * h * h) / (mu * mu) : 0;
  const eccentricity = eccentricityVal > 0 ? Math.sqrt(eccentricityVal) : 0;
  const semiLatusRectum = mu > 0 ? (h * h) / mu : Infinity;
  const periapsisRadius = eccentricity > 0
    ? semiLatusRectum / (1 + eccentricity)
    : semimajorAxis;
  const apoapsisRadius = eccentricity < 1 && semimajorAxis > 0
    ? semimajorAxis * (1 + eccentricity)
    : null;
  const orbitPeriod = eccentricity < 1 && semimajorAxis > 0 && mu > 0
    ? 2 * Math.PI * Math.sqrt((semimajorAxis * semimajorAxis * semimajorAxis) / mu)
    : null;
  let timeToPeriapsis: number | null = null;
  if (orbitPeriod !== null && eccentricity > 1e-6 && eccentricity < 1 && semimajorAxis > 0 && mu > 0) {
    const dotRv = dx * relVx + dy * relVy;
    const eVecX = ((relSpeed * relSpeed - mu / distance) * dx - dotRv * relVx) / mu;
    const eVecY = ((relSpeed * relSpeed - mu / distance) * dy - dotRv * relVy) / mu;
    const eMag = Math.hypot(eVecX, eVecY);
    if (eMag > 1e-6) {
      const cosNu = (eVecX * dx + eVecY * dy) / (eMag * distance);
      const sinNu = (eVecX * dy - eVecY * dx) / (eMag * distance);
      const nu = Math.atan2(sinNu, cosNu);
      const cosE = (eMag + Math.cos(nu)) / (1 + eMag * Math.cos(nu));
      const sinE = (Math.sqrt(1 - eMag * eMag) * Math.sin(nu)) / (1 + eMag * Math.cos(nu));
      const eccentricAnomaly = Math.atan2(sinE, cosE);
      const meanAnomaly = ((eccentricAnomaly - eMag * Math.sin(eccentricAnomaly)) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      const meanMotion = Math.sqrt(mu / (semimajorAxis * semimajorAxis * semimajorAxis));
      const timeSincePeriapsis = meanAnomaly / meanMotion;
      timeToPeriapsis = orbitPeriod - timeSincePeriapsis;
      if (timeToPeriapsis < 1) timeToPeriapsis = 0;
    }
  }

  return {
    altitude,
    relVx,
    relVy,
    relSpeed,
    escapeVelocity,
    circularVelocity,
    semimajorAxis,
    eccentricity,
    periapsisAltitude: periapsisRadius - bodyRadius,
    apoapsisAltitude: apoapsisRadius === null ? null : apoapsisRadius - bodyRadius,
    orbitPeriod,
    timeToPeriapsis,
  };
}

export function propagateKeplerianCoast(
  ship: ShipState,
  targetBody: CelestialBody | null,
  bodies: CelestialBody[],
  timeStart: number,
  dt: number,
  starMass: number = 1.989e30,
  patchDepth: number = 2
): ShipState | null {
  if (!targetBody || dt <= 0) return null;

  const mu = G * (targetBody.type === "star" ? starMass : targetBody.mass ?? 0);
  if (mu <= 0) return null;

  const targetPos0 = getAbsoluteBodyPosition(targetBody.id, bodies, timeStart);
  const targetVel0 = getBodyVelocity(targetBody.id, bodies, timeStart);
  const rx = ship.x - targetPos0.x;
  const ry = ship.y - targetPos0.y;
  const vx = ship.vx - targetVel0.vx;
  const vy = ship.vy - targetVel0.vy;
  const r = Math.hypot(rx, ry);
  const v2 = vx * vx + vy * vy;
  if (r <= 1 || !Number.isFinite(r) || !Number.isFinite(v2)) return null;

  const energy = v2 / 2 - mu / r;
  if (energy >= 0) return null;

  const a = -mu / (2 * energy);
  const h = rx * vy - ry * vx;
  if (Math.abs(h) < 1e-6 || !Number.isFinite(a) || a <= 0) return null;

  const eVecX = ((v2 - mu / r) * rx - (rx * vx + ry * vy) * vx) / mu;
  const eVecY = ((v2 - mu / r) * ry - (rx * vx + ry * vy) * vy) / mu;
  const e = Math.hypot(eVecX, eVecY);
  if (e >= 1 || e < 1e-8) {
    const meanMotion = Math.sqrt(mu / (a * a * a));
    const angle0 = Math.atan2(ry, rx);
    const direction = h >= 0 ? 1 : -1;
    const angle = angle0 + direction * meanMotion * dt;
    const radius = a;
    const speed = Math.sqrt(mu / radius);
    const targetPos1 = getAbsoluteBodyPosition(targetBody.id, bodies, timeStart + dt);
    const targetVel1 = getBodyVelocity(targetBody.id, bodies, timeStart + dt);
    const circularResult = {
      ...ship,
      x: targetPos1.x + Math.cos(angle) * radius,
      y: targetPos1.y + Math.sin(angle) * radius,
      vx: targetVel1.vx - Math.sin(angle) * speed * direction,
      vy: targetVel1.vy + Math.cos(angle) * speed * direction,
    };
    return patchCoastIfSoiChanges(circularResult, ship, targetBody, bodies, timeStart, dt, starMass, patchDepth);
  }

  const cosNu = (eVecX * rx + eVecY * ry) / (e * r);
  const sinNu = (eVecX * ry - eVecY * rx) / (e * r);
  const nu = Math.atan2(sinNu, cosNu);
  const cosE0 = (e + Math.cos(nu)) / (1 + e * Math.cos(nu));
  const sinE0 = (Math.sqrt(1 - e * e) * Math.sin(nu)) / (1 + e * Math.cos(nu));
  const E0 = Math.atan2(sinE0, cosE0);
  const M0 = E0 - e * Math.sin(E0);
  const meanMotion = Math.sqrt(mu / (a * a * a));
  const E = solveKepler(M0 + meanMotion * dt, e);
  const orbitalX = a * (Math.cos(E) - e);
  const orbitalY = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const edotDenominator = 1 - e * Math.cos(E);
  if (Math.abs(edotDenominator) < 1e-8) return null;

  const localVx = -a * meanMotion * Math.sin(E) / edotDenominator;
  const localVy = a * meanMotion * Math.sqrt(1 - e * e) * Math.cos(E) / edotDenominator;
  const periapsisAngle = Math.atan2(eVecY, eVecX);
  const cosW = Math.cos(periapsisAngle);
  const sinW = Math.sin(periapsisAngle);
  const direction = h >= 0 ? 1 : -1;
  const targetPos1 = getAbsoluteBodyPosition(targetBody.id, bodies, timeStart + dt);
  const targetVel1 = getBodyVelocity(targetBody.id, bodies, timeStart + dt);

  const result = {
    ...ship,
    x: targetPos1.x + orbitalX * cosW - orbitalY * sinW * direction,
    y: targetPos1.y + orbitalX * sinW + orbitalY * cosW * direction,
    vx: targetVel1.vx + localVx * cosW - localVy * sinW * direction,
    vy: targetVel1.vy + localVx * sinW + localVy * cosW * direction,
  };
  return patchCoastIfSoiChanges(result, ship, targetBody, bodies, timeStart, dt, starMass, patchDepth);
}

function patchCoastIfSoiChanges(
  result: ShipState,
  startShip: ShipState,
  startBody: CelestialBody,
  bodies: CelestialBody[],
  timeStart: number,
  dt: number,
  starMass: number,
  patchDepth: number
): ShipState | null {
  if (patchDepth <= 0) return result;

  const endCache = buildBodyPositionCache(bodies, timeStart + dt);
  const endDominant = getDominantGravitySource(result.x, result.y, bodies, timeStart + dt, starMass, endCache).body;
  if (!endDominant || endDominant.id === startBody.id) return result;

  let low = 0;
  let high = dt;
  let transitionShip: ShipState | null = result;

  for (let i = 0; i < 18; i++) {
    const mid = (low + high) / 2;
    const midShip = propagateKeplerianCoast(startShip, startBody, bodies, timeStart, mid, starMass, 0);
    if (!midShip) return result;

    const midCache = buildBodyPositionCache(bodies, timeStart + mid);
    const midDominant = getDominantGravitySource(midShip.x, midShip.y, bodies, timeStart + mid, starMass, midCache).body;
    if (midDominant?.id === startBody.id) {
      low = mid;
    } else {
      high = mid;
      transitionShip = midShip;
    }
  }

  if (!transitionShip) return result;
  return propagateKeplerianCoast(transitionShip, endDominant, bodies, timeStart + high, dt - high, starMass, patchDepth - 1) ?? result;
}

/**
 * Predict future path of the spacecraft with optional commanded thrust.
 * Returns a series of points relative to the star system origin.
 */
export function predictShipRoute(
  ship: ShipState,
  bodies: CelestialBody[],
  timeStart: number,
  duration: number,
  stepsCount: number = 100,
  throttlePercent: number = 0,
  posCache?: BodyPosCache
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const dt = duration / stepsCount;

  // Clone ship just to integrate
  let tempShip = { ...ship };
  const starMass = 1.989e30;

  for (let i = 0; i <= stepsCount; i++) {
    points.push({ x: tempShip.x, y: tempShip.y });
    if (i === stepsCount) break;

    if (Math.abs(throttlePercent) <= 0.001) {
      const cache = posCache ?? buildBodyPositionCache(bodies, timeStart + i * dt);
      const dominant = getDominantGravitySource(tempShip.x, tempShip.y, bodies, timeStart + i * dt, starMass, cache);
      const coastShip = propagateKeplerianCoast(tempShip, dominant.body || bodies[0], bodies, timeStart + i * dt, dt, starMass);
      if (coastShip) {
        tempShip = coastShip;
        continue;
      }
    }

    tempShip = integrateSpacecraft(tempShip, bodies, timeStart + i * dt, dt, throttlePercent, starMass, posCache);
  }

  return points;
}

/**
 * Resolves the maximum docking distance (absolute center distance) and
 * maximum relative speed limit allowable for a celestial body and its station setup.
 */
export function getDockingSpecs(body: CelestialBody | null): { maxDistance: number; maxSpeed: number } {
  if (!body) return { maxDistance: 1.2e6, maxSpeed: 600 };

  if (body.type === "station") {
    const isTether = body.name.toLowerCase().includes("tether") || body.stationName?.toLowerCase().includes("tether");
    return {
      maxDistance: (body.radius ?? 0) + (isTether ? 250_000 : 50_000),
      maxSpeed: 25,
    };
  }

  if (body.type === "planet") {
    return {
      maxDistance: body.radius + 200_000,
      maxSpeed: 50,
    };
  }

  // Moons or smaller asteroid bodies containing stations
  return {
    maxDistance: body.radius + 200_000,
    maxSpeed: 50,
  };
}

