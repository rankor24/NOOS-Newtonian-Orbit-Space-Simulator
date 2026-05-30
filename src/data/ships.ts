/**
 * Simplified starter ship data derived from local EDCD Coriolis JSON.
 * Source files:
 * - C:\Users\Boris\.opensrc\repos\github.com\EDCD\coriolis-data\master\ships\sidewinder.json
 * - C:\Users\Boris\.opensrc\repos\github.com\EDCD\coriolis-data\master\modules\standard\thrusters.json
 * - C:\Users\Boris\.opensrc\repos\github.com\EDCD\coriolis-data\master\modules\standard\power_distributor.json
 * - C:\Users\Boris\.opensrc\repos\github.com\EDCD\coriolis-data\master\modules\standard\power_plant.json
 * - C:\Users\Boris\.opensrc\repos\github.com\EDCD\coriolis-data\master\modules\internal\shield_generator.json
 */

export const SIDEWINDER_STARTER_PROFILE = {
  id: "sidewinder_starter",
  name: "Sidewinder Mk I",
  manufacturer: "Faulcon DeLacy",
  sourceShip: "Elite Dangerous Sidewinder",
  retailCost: 32000,
  hullMassKg: 25000,
  baseCruiseSpeed: 220,
  baseBoostSpeed: 320,
  minThrustPercent: 45.454,
  baseShieldStrength: 40,
  baseArmour: 60,
  hardness: 20,
  heatCapacity: 140,
  pitchDegPerSec: 42,
  rollDegPerSec: 110,
  yawDegPerSec: 16,
  hardpoints: {
    small: 2,
    utility: 2,
  },
  defaultModules: {
    thrusters: {
      classRating: "2E",
      massKg: 2500,
      powerMw: 2,
      optimalMassKg: 48000,
      maxMassKg: 72000,
    },
    powerPlant: {
      classRating: "2E",
      massKg: 2500,
      generationMw: 6.4,
    },
    powerDistributor: {
      classRating: "1E",
      massKg: 1300,
      engineCapMj: 8,
      engineRechargeMw: 0.4,
      systemCapMj: 8,
      systemRechargeMw: 0.4,
      weaponCapMj: 10,
      weaponRechargeMw: 1.2,
    },
    shieldGenerator: {
      classRating: "2E",
      massKg: 2500,
      optimalMassKg: 55000,
      multiplier: 0.8,
      regenMw: 1,
    },
  },
};

export const DEFAULT_POWER_DISTRIBUTION = {
  shields: 33,
  engines: 34,
  weapons: 33,
};
