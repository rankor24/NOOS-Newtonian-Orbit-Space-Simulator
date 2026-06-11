export const SOL_SOURCES_GENERATED = {
  "generatedAt": "2026-05-27T16:46:04.365Z",
  "moonSources": {
    "satelliteElements": "https://ssd.jpl.nasa.gov/sats/elem/",
    "satellitePhysical": "https://ssd.jpl.nasa.gov/sats/phys_par/",
    "atlasFallback": "C:\\Users\\Boris\\Code\\asteroids_atlas_of_space-main\\data\\moons.csv"
  },
  "counts": {
    "importedMoonRows": 454,
    "importedPhysicalRows": 47,
    "gravityEnabledMoons": 28,
    "withMass": 41,
    "withRadius": 146,
    "byParent": {
      "sol_earth": 1,
      "sol_jupiter": 115,
      "sol_mars": 2,
      "sol_neptune": 16,
      "sol_saturn": 291,
      "sol_uranus": 29
    }
  },
  "notes": [
    "JPL sat mean elements drive orbit import.",
    "JPL sat phys params drive GM/radius where available.",
    "Atlas moons.csv used only as radius fallback.",
    "Tiny moons without reliable GM stay gravitySource:false."
  ]
} as const;
