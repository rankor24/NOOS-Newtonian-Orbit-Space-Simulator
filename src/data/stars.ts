/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StarData, CelestialBody } from "../types";
import hygSubset from "./generated/hyg-stars-near-sol-50ly.json";
import { SOL_BODIES_GENERATED } from "./generated/sol-bodies";
import { SOL_SYSTEM_FEATURES } from "./generated/sol-features";

// Conversions
export const AU = 1.496e11; // meters
export const MINUTE_SEC = 60;
export const HOUR_SEC = 3600;
export const DAY_SEC = 86400;
export const YEAR_SEC = 31557600;

export const SPECTRAL_DETAILS = {
  O: { color: "#3b82f6", temp: 35000, desc: "Brilliant Blue Titan" },
  B: { color: "#60a5fa", temp: 15000, desc: "Luminous Blue-White Star" },
  A: { color: "#e0f2fe", temp: 9000, desc: "Aesthetic White Star" },
  F: { color: "#fef08a", temp: 6800, desc: "Warm Yellow-White Star" },
  G: { color: "#f59e0b", temp: 5800, desc: "Yellow Dwarf Star" },
  K: { color: "#ea580c", temp: 4500, desc: "Mellow Orange Dwarf" },
  M: { color: "#ef4444", temp: 3200, desc: "Cool Red Dwarf Star" },
};

// Seed-based random number generator to make procedural generation predictable
export function makeRandom(seedStr: string) {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(31, h) + seedStr.charCodeAt(i) | 0;
  }
  return function() {
    h = Math.imul(h ^ h >>> 16, 2246822507);
    h = Math.imul(h ^ h >>> 13, 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

// Actual real star registry (scaled Cartesian coordinates in light-years)
export const REAL_STARS: Omit<StarData, "planets">[] = [
  {
    id: "star_sol",
    name: "Sol",
    className: "G",
    color: "#f59e0b",
    temp: 5778,
    x: 0,
    y: 0,
    z: 0,
    radius: 1.0,
    mass: 1.0,
    isPopulated: true,
    description: "The birthplace of humanity. Highly colonized with active trade orbits.",
  },
  {
    id: "star_alphacent",
    name: "Alpha Centauri",
    className: "G",
    color: "#ea580c",
    temp: 5790,
    x: -3.1,
    y: 2.8,
    z: -1.2,
    radius: 1.2,
    mass: 1.1,
    isPopulated: true,
    description: "Our closest stellar neighbor. Sol's first extrasolar colonies flourish here.",
  },
  {
    id: "star_proxima",
    name: "Proxima Centauri",
    className: "M",
    color: "#ef4444",
    temp: 3042,
    x: -3.15,
    y: 2.82,
    z: -1.25,
    radius: 0.15,
    mass: 0.12,
    isPopulated: false,
    description: "A small red dwarf tidally bound to Alpha Centauri. Wild, high radiation belts.",
  },
  {
    id: "star_sirius",
    name: "Sirius A",
    className: "A",
    color: "#e0f2fe",
    temp: 9940,
    x: -3.5,
    y: -7.2,
    z: -3.1,
    radius: 1.71,
    mass: 2.06,
    isPopulated: true,
    description: "The Dog Star. Outstanding shine. A massive industrial colony mines its systems.",
  },
  {
    id: "star_barnard",
    name: "Barnard's Star",
    className: "M",
    color: "#f97316",
    temp: 3134,
    x: -0.1,
    y: 5.9,
    z: 0.3,
    radius: 0.19,
    mass: 0.14,
    isPopulated: false,
    description: "Our third closest system. Very high proper motion drifting through the cosmos.",
  },
  {
    id: "star_vega",
    name: "Vega",
    className: "A",
    color: "#60a5fa",
    temp: 9600,
    x: 18.2,
    y: 11.2,
    z: 14.5,
    radius: 2.36,
    mass: 2.135,
    isPopulated: false,
    description: "Brilliant, rapid rotator surrounded by a heavy metal-rich planet-forming dust ring.",
  },
  {
    id: "star_arcturus",
    name: "Arcturus",
    className: "K",
    color: "#f97316",
    temp: 4286,
    x: -12.4,
    y: 34.5,
    z: -3.8,
    radius: 25.4,
    mass: 1.08,
    isPopulated: false,
    description: "A massive bloated orange giant. Fierce solar winds scour the inner system naked.",
  },
  {
    id: "star_betelgeuse",
    name: "Betelgeuse",
    className: "M",
    color: "#ef4444",
    temp: 3500,
    x: 120.0,
    y: -480.0,
    z: -350.0,
    radius: 887.0,
    mass: 16.5,
    isPopulated: false,
    description: "A colossal red supergiant nearing the end of its life. Unchecked cosmic resources.",
  },
  {
    id: "star_polaris",
    name: "Polaris",
    className: "F",
    color: "#fef08a",
    temp: 6015,
    x: 34.0,
    y: 430.0,
    z: 120.0,
    radius: 37.5,
    mass: 5.4,
    isPopulated: false,
    description: "The northern star of Earth lore. A yellow supergiant guiding navigation arrays.",
  },
  {
    id: "star_aldid",
    name: "Aldebaran",
    className: "K",
    color: "#f97316",
    temp: 3910,
    x: 42.0,
    y: -44.0,
    z: -27.0,
    radius: 44.1,
    mass: 1.16,
    isPopulated: false,
    description: "The Eye of Taurus. An orange giant holding several extremely high mass gas giants.",
  },
  {
    id: "star_rigel",
    name: "Rigel",
    className: "B",
    color: "#3b82f6",
    temp: 12100,
    x: 210.0,
    y: -790.0,
    z: -280.0,
    radius: 78.9,
    mass: 21.0,
    isPopulated: false,
    description: "A blue supergiant illuminating the Orion region, burning intensely bright.",
  }
];

// Helper to construct exact orbits for the SOL system
export function generateSolBodies(): CelestialBody[] {
  return SOL_BODIES_GENERATED;
}

// Procedural System Planet Generator based on Star properties
export function populateProceduralSystem(star: Omit<StarData, "planets">): CelestialBody[] {
  if (star.id === "star_sol") {
    return generateSolBodies();
  }

  const bodies: CelestialBody[] = [];
  const parentId = star.id;
  const rand = makeRandom(star.id);

  // Determine number of planets
  const planetCount = Math.floor(rand() * 5) + 3; // 3 to 7 planets

  const namePrefixes = ["Prime", "Beta", "Gamma", "Secundus", "Tertia", "V", "Exodus", "Golgotha", "Haven", "Nova"];

  // Outer orbital spacing is exponential
  let currentSemiMajorAxis = 0.4 * AU * (0.8 + rand() * 0.4);

  for (let i = 0; i < planetCount; i++) {
    const sizeRoll = rand();
    const isGasGiant = sizeRoll > 0.6;
    
    // Size and properties
    let radius = isGasGiant ? (25000000 + rand() * 35000000) : (2000000 + rand() * 5000000);
    let mass = isGasGiant ? (1e26 + rand() * 9e26) : (1e24 + rand() * 8e24);
    let color = isGasGiant 
      ? ["#60a5fa", "#f59e0b", "#475569", "#701a75", "#1e3a8a"][Math.floor(rand() * 5)]
      : ["#a1a1aa", "#ca8a04", "#b45309", "#dc2626", "#047857"][Math.floor(rand() * 5)];

    const nameIdx = Math.floor(rand() * namePrefixes.length);
    const bodyName = `${star.name} ${namePrefixes[nameIdx]} ${i + 1}`;
    
    // Keplerian Orbit specs
    const semiMajorAxis = currentSemiMajorAxis;
    const eccentricity = rand() * 0.15; // Realistic low-eccentricity
    // Kepler's Third Law to find period: T^2 = (4 * pi^2 / (G * M_star)) * a^3
    const G = 6.6743e-11;
    const M_star = star.mass * 1.989e30;
    const orbitalPeriod = Math.sqrt((4 * Math.PI * Math.PI * Math.pow(semiMajorAxis, 3)) / (G * M_star));

    const isPlanetPopulated = star.isPopulated && (i === 1 || i === 2) && (rand() > 0.3);

    const planetId = `${star.id}_planet_${i}`;
    bodies.push({
      id: planetId,
      name: bodyName,
      type: isGasGiant ? "planet" : "planet",
      mass,
      radius,
      color,
      parentId,
      description: isGasGiant 
        ? "A dense gas giant containing rich atmospheric elements and high orbital stations."
        : "A rocky terrestrial body with highly varied mineral outcroppings and rough topography.",
      hasMarket: isPlanetPopulated,
      stationName: isPlanetPopulated ? `${bodyName} Orbital Terminal` : undefined,
      semiMajorAxis,
      eccentricity,
      orbitalPeriod,
      inclination: rand() * 0.1,
      argumentOfPeriapsis: rand() * Math.PI * 2,
      meanAnomalyAtEpoch: rand() * Math.PI * 2,
    });

    // Sub-bodies: Moon or Asteroids orbiting planets occasionally
    if (!isGasGiant && rand() > 0.6) {
      bodies.push({
        id: `${star.id}_moon_${i}`,
        name: `${bodyName} Moon A`,
        type: "moon",
        mass: mass * 0.012,
        radius: radius * 0.25,
        color: "#a1a1aa",
        parentId: planetId,
        description: "A cratered barren satellite, ideal for landing and setting up fuel miners.",
        hasMarket: false,
        semiMajorAxis: radius * (5 + rand() * 5),
        eccentricity: 0.02 + rand() * 0.05,
        orbitalPeriod: orbitalPeriod * 0.08,
        inclination: rand() * 0.05,
        argumentOfPeriapsis: rand() * Math.PI * 2,
        meanAnomalyAtEpoch: rand() * Math.PI * 2,
      });
    } else if (isGasGiant && rand() > 0.4) {
      // Station
      const stationRoll = rand();
      bodies.push({
        id: `${star.id}_station_${i}`,
        name: `${bodyName} Gas Harvester`,
        type: "station",
        mass: 1e18,
        radius: 200000,
        color: "#c084fc",
        parentId: planetId,
        description: "An automated gas skimming outpost suspended in the upper magnetosphere.",
        hasMarket: true,
        stationName: `${bodyName} Float Hub`,
        semiMajorAxis: radius * (3 + rand() * 3),
        eccentricity: 0,
        orbitalPeriod: orbitalPeriod * 0.04,
        inclination: 0,
        argumentOfPeriapsis: 0,
        meanAnomalyAtEpoch: rand() * Math.PI * 2,
      });
    }

    // Step out next planetary orbit spacing
    currentSemiMajorAxis *= (1.4 + rand() * 0.7); // Exponential spacing
  }

  // Also stick some asteroids in the outer system
  const asteroidBeltStart = currentSemiMajorAxis * 0.8;
  for (let a = 1; a <= 4; a++) {
    const angle = (a * 1.57) % (Math.PI * 2);
    const astAxis = asteroidBeltStart + (a * 0.15 * AU);
    const G = 6.6743e-11;
    const M_star = star.mass * 1.989e30;
    const orbitalPeriod = Math.sqrt((4 * Math.PI * Math.PI * Math.pow(astAxis, 3)) / (G * M_star));

    bodies.push({
      id: `${star.id}_asteroid_${a}`,
      name: `${star.name} Field Asteroid ${a * 91}`,
      type: "asteroid",
      mass: 1e16,
      radius: 40000,
      color: "#4b5563",
      parentId,
      description: "An ancient cold rock orbiting in the star's twilight zone, rich in copper and deuterium ice.",
      hasMarket: false,
      semiMajorAxis: astAxis,
      eccentricity: 0.05 + rand() * 0.08,
      orbitalPeriod,
      inclination: rand() * 0.08,
      argumentOfPeriapsis: rand() * Math.PI * 2,
      meanAnomalyAtEpoch: angle,
    });
  }

  return bodies;
}

type HygSubsetStar = {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  spectralType: string | null;
  properName: string | null;
  hasKnownName: boolean;
};

function normalizeSpectralClass(input: string | null | undefined): StarData["className"] {
  const spect = (input || "").toUpperCase();
  for (const char of spect) {
    if (char === "O" || char === "B" || char === "A" || char === "F" || char === "G" || char === "K" || char === "M") {
      return char;
    }
  }
  return "M";
}

function galaxyDescription(name: string, className: StarData["className"], hasKnownName: boolean): string {
  const classDesc = SPECTRAL_DETAILS[className].desc;
  return hasKnownName
    ? `${name} is a real catalogued ${classDesc.toLowerCase()} represented from the HYG star dataset.`
    : `A real catalogued ${classDesc.toLowerCase()} from the HYG star dataset.`;
}

export const GALAXY_STARS: Omit<StarData, "planets">[] = (hygSubset.stars as HygSubsetStar[]).map((star) => {
  const className = normalizeSpectralClass(star.spectralType);
  const spec = SPECTRAL_DETAILS[className];
  return {
    id: star.id,
    name: star.name,
    className,
    color: spec.color,
    temp: spec.temp,
    x: star.x,
    y: star.y,
    z: star.z,
    radius: star.id === "star_sol" ? 1.0 : 0.2 + (className === "O" ? 8 : className === "B" ? 4 : className === "A" ? 2 : className === "F" ? 1.3 : className === "G" ? 1.0 : className === "K" ? 0.8 : 0.45),
    mass: star.id === "star_sol" ? 1.0 : className === "O" ? 16 : className === "B" ? 6 : className === "A" ? 2.2 : className === "F" ? 1.4 : className === "G" ? 1.0 : className === "K" ? 0.8 : 0.25,
    isPopulated: star.id === "star_sol" || !!star.properName,
    description: star.id === "star_sol"
      ? "The birthplace of humanity. Highly colonized with active trade orbits."
      : galaxyDescription(star.name, className, star.hasKnownName),
  };
});

// Playable star cache. Start with Sol only; create other systems lazily when first warped to.
export const STARS: StarData[] = GALAXY_STARS.filter((star) => star.id === "star_sol").map((star) => ({
  ...star,
  planets: populateProceduralSystem(star),
  systemFeatures: star.id === "star_sol" ? SOL_SYSTEM_FEATURES : undefined,
}));

export function getGalaxyStar(starId: string): Omit<StarData, "planets"> | undefined {
  return GALAXY_STARS.find((star) => star.id === starId);
}

export function getOrCreatePlayableStar(starId: string): StarData | undefined {
  const existing = STARS.find((star) => star.id === starId);
  if (existing) return existing;

  const galaxyStar = getGalaxyStar(starId);
  if (!galaxyStar) return undefined;

  const playableStar: StarData = {
    ...galaxyStar,
    planets: populateProceduralSystem(galaxyStar),
    systemFeatures: galaxyStar.id === "star_sol" ? SOL_SYSTEM_FEATURES : undefined,
  };
  STARS.push(playableStar);
  return playableStar;
}
