/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CelestialBody, ShipState } from "../types";

const G = 6.6743e-11; // Gravitational Constant m^3 kg^-1 s^-2
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

/**
 * Calculate Sphere of Influence (SOI) radius for a planet orbiting a star.
 * SOI = a * (m_planet / m_star)^(2/5)
 * If star mass is not available, we assume a standard mass ratio or default.
 */
export function getSphereOfInfluence(body: CelestialBody, starMass: number = 1.989e30): number {
  if (body.type === "star" || !body.parentId) return Infinity;
  
  if (body.type === "moon") {
    // Moons orbit planets. Scale relative to parent planet
    return body.semiMajorAxis * Math.pow((body.mass ?? 0) / 5.972e24, 0.4); // approximated bound
  }

  // Planet orbiting star
  return body.semiMajorAxis * Math.pow((body.mass ?? 0) / starMass, 0.4);
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
  // First locate star
  const star = bodies.find((b) => b.type === "star") || null;
  let dominantBody: CelestialBody | null = star;
  let dominantDist = star ? Math.hypot(shipX, shipY) : Infinity;
  let activeSOI = Infinity;

  // Check planets & moons to see if ship is inside their SOI
  for (const body of bodies) {
    if (body.type === "star") continue;

    const absPos = posCache ? getCachedPosition(posCache, body.id) : getAbsoluteBodyPosition(body.id, bodies, time);
    const dist = Math.hypot(shipX - absPos.x, shipY - absPos.y);
    const soi = getSphereOfInfluence(body, starMass);

    if (dist < soi) {
      // Ship is within this planet/moon's sphere of influence
      dominantBody = body;
      dominantDist = dist;
      activeSOI = soi;
      // We check if this body has child moons which the player could be closer to
      break;
    }
  }

  // If inside a planet, check its moons specifically
  if (dominantBody && dominantBody.type === "planet") {
    const moons = bodies.filter((b) => b.parentId === dominantBody!.id && b.type === "moon");
    for (const moon of moons) {
      const absPos = posCache ? getCachedPosition(posCache, moon.id) : getAbsoluteBodyPosition(moon.id, bodies, time);
      const dist = Math.hypot(shipX - absPos.x, shipY - absPos.y);
      const soi = getSphereOfInfluence(moon, dominantBody!.mass ?? 0);
      if (dist < soi) {
        dominantBody = moon;
        dominantDist = dist;
        activeSOI = soi;
        break;
      }
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

  // Handle extreme time-warp by sub-stepping the orbital integration
  // Doing a max of 20 sub-steps to prevent browser freezes, while maintaining orbit integration accuracy
  const maxSubsteps = 15;
  const substeps = Math.min(maxSubsteps, Math.ceil(dt / 300)); // e.g. if dt is 3600s (1hr), do 15 steps
  const subDt = dt / substeps;

  for (let s = 0; s < substeps; s++) {
    const currentSimTime = timeStart + s * subDt;

    // 1. Calculate active gravity acceleration from star + all real bodies
    let { accX, accY } = getSummedGravityAcceleration(x, y, bodies, currentSimTime, starMass, posCache);

    // Add continuous thrust if operating thrusters
    const totalMass = dryMass + fuelLevel;
    if (thrustScale > 0 && fuelLevel > 0) {
      const thrustAcc = (engineThrust * thrustScale) / totalMass;
      accX += thrustAcc * Math.cos(heading) * thrustDirection;
      accY += thrustAcc * Math.sin(heading) * thrustDirection;
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
  };
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
  
  // Space tethers like Earth "Orbital Tether One" extend to geostationary orbit
  if (body.stationName && (body.stationName.toLowerCase().includes("tether") || body.id === "sol_earth" || body.name === "Earth")) {
    return {
      maxDistance: body.radius + 36.0e6, // up to 36,000 km altitude (space tethers are massive)
      maxSpeed: 2500, // up to 2,500 m/s relative speed
    };
  }

  // Large celestial ports
  if (body.type === "planet") {
    return {
      maxDistance: body.radius + 5.0e6, // up to 5,000 km altitude (more generous)
      maxSpeed: 1500, // up to 1,500 m/s for easier maneuvering
    };
  }

  // Moons or smaller asteroid bodies containing stations
  return {
    maxDistance: body.radius + 2.0e6, // up to 2,000 km altitude
    maxSpeed: 1000, // up to 1,000 m/s
  };
}

