import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUT_PATH = path.join(ROOT, "src", "data", "generated", "sol-moons.ts");
const MANIFEST_PATH = path.join(ROOT, "src", "data", "generated", "sol-sources.ts");
const ATLAS_MOONS_PATH = path.join("C:", "Users", "Boris", "Code", "asteroids_atlas_of_space-main", "data", "moons.csv");
const SAT_ELEM_URL = "https://ssd.jpl.nasa.gov/sats/elem/";
const SAT_PHYS_URL = "https://ssd.jpl.nasa.gov/sats/phys_par/";

const PLANET_TO_PARENT = {
  Earth: "sol_earth",
  Mars: "sol_mars",
  Jupiter: "sol_jupiter",
  Saturn: "sol_saturn",
  Uranus: "sol_uranus",
  Neptune: "sol_neptune",
};

const PLANET_COLORS = {
  Earth: "#cbd5e1",
  Mars: "#a8a29e",
  Jupiter: "#d6d3d1",
  Saturn: "#e5e7eb",
  Uranus: "#cbd5e1",
  Neptune: "#bfdbfe",
};

const MARKET_OVERRIDES = {
  Moon: { hasMarket: true, stationName: "Shackleton Crater Base" },
  Ganymede: { hasMarket: true, stationName: "Ganymede Logistics Hub" },
  Titan: { hasMarket: true, stationName: "Titan Ice Station" },
  Triton: { hasMarket: true, stationName: "Triton Frontier Port" },
};

const MAJOR_GRAVITY_MOONS = new Set([
  "Moon", "Phobos", "Deimos",
  "Io", "Europa", "Ganymede", "Callisto", "Amalthea", "Thebe", "Adrastea", "Metis",
  "Mimas", "Enceladus", "Tethys", "Dione", "Rhea", "Titan", "Hyperion", "Iapetus", "Phoebe",
  "Miranda", "Ariel", "Umbriel", "Titania", "Oberon", "Puck",
  "Triton", "Proteus", "Nereid"
]);

function cleanCell(text) {
  return text
    .replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, "")
    .replace(/<sub[^>]*>[\s\S]*?<\/sub>/gi, "")
    .replace(/<code[^>]*>[\s\S]*?<\/code>/gi, "")
    .replace(/<a[^>]*>|<\/a>/gi, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#160;/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugifyMoon(name) {
  return name
    .replace(/^S\//, "S")
    .replace(/[()]/g, "")
    .replace(/['’]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function parseNumber(text) {
  const match = `${text}`.replace(/,/g, "").match(/-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?/);
  return match ? Number(match[0]) : null;
}

function parseTableById(html, tableId) {
  const tableMatch = html.match(new RegExp(`<table[^>]*id=["']${tableId}["'][\\s\\S]*?<\\/table>`, "i"));
  if (!tableMatch) throw new Error(`Table ${tableId} not found`);
  const rows = [...tableMatch[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]);
  return rows.map((rowHtml) => {
    const cells = [...rowHtml.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((m) => cleanCell(m[1]));
    return cells;
  }).filter((cells) => cells.length > 0);
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${url}: ${res.status}`);
  return await res.text();
}

async function loadAtlasMoonFallbacks() {
  const csv = await fs.readFile(ATLAS_MOONS_PATH, "utf8");
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(",");
  const idxName = header.indexOf("name_plain");
  const idxRadius = header.indexOf("mean_radius_km");
  const idxHorizons = header.indexOf("horizons");
  const map = new Map();
  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    const name = cols[idxName]?.trim();
    if (!name) continue;
    map.set(name.toLowerCase(), {
      radiusKm: parseNumber(cols[idxRadius]),
      horizons: cols[idxHorizons]?.trim() || null,
    });
  }
  return map;
}

function buildDescription(planet, moon, hasMass, hasRadius) {
  const status = [];
  status.push(`${planet} moon`);
  if (!hasMass) status.push("mass pending better source");
  if (!hasRadius) status.push("radius estimated/min fallback");
  return `${status.join("; ")}. Imported from JPL satellite tables for scientific Sol roster.`;
}

async function main() {
  const [elemHtml, physHtml, atlasFallbacks] = await Promise.all([
    fetchText(SAT_ELEM_URL),
    fetchText(SAT_PHYS_URL),
    loadAtlasMoonFallbacks(),
  ]);

  const elemRows = parseTableById(elemHtml, "sat_elem");
  const physRows = parseTableById(physHtml, "sat_phys_par");

  const physByCode = new Map();
  for (const row of physRows.slice(1)) {
    const [planet, satellite, code, gmCell, radiusCell] = row;
    if (!PLANET_TO_PARENT[planet] || !code) continue;
    const gmKm3s2 = parseNumber(gmCell);
    const radiusKm = parseNumber(radiusCell);
    physByCode.set(code, { satellite, gmKm3s2, radiusKm });
  }

  const moons = [];
  const seenIds = new Set();

  for (const row of elemRows.slice(1)) {
    const [_, planet, satellite, code, , , , aKmCell, eCell, wDegCell, mDegCell, iDegCell, , pDaysCell] = row;
    if (!PLANET_TO_PARENT[planet]) continue;
    if (!satellite || !code) continue;

    const id = `sol_${slugifyMoon(satellite)}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const phys = physByCode.get(code);
    const fallback = atlasFallbacks.get(satellite.toLowerCase()) || atlasFallbacks.get(slugifyMoon(satellite).replace(/_/g, ""));

    const radiusKm = phys?.radiusKm ?? fallback?.radiusKm ?? null;
    const gmKm3s2 = phys?.gmKm3s2 ?? null;
    const gm = gmKm3s2 != null ? gmKm3s2 * 1e9 : null;
    const massKg = gm != null ? gm / 6.6743e-11 : null;
    const radiusMeters = radiusKm != null ? radiusKm * 1000 : null;
    const gravitySource = gm != null && MAJOR_GRAVITY_MOONS.has(satellite);

    const override = MARKET_OVERRIDES[satellite] || { hasMarket: false };

    moons.push({
      id,
      name: satellite,
      type: "moon",
      mass: massKg,
      gm,
      radius: radiusMeters,
      radiusEstimate: phys?.radiusKm == null && fallback?.radiusKm != null,
      massEstimate: false,
      gravitySource,
      color: PLANET_COLORS[planet],
      parentId: PLANET_TO_PARENT[planet],
      description: buildDescription(planet, satellite, gmKm3s2 != null, radiusKm != null),
      hasMarket: override.hasMarket,
      stationName: override.stationName,
      source: gmKm3s2 != null || radiusKm != null
        ? "JPL sats/elem + JPL sats/phys_par"
        : fallback?.radiusKm != null
          ? "JPL sats/elem + Atlas moons.csv fallback"
          : "JPL sats/elem",
      epoch: "mean-element-table",
      semiMajorAxis: (parseNumber(aKmCell) ?? 0) * 1000,
      eccentricity: parseNumber(eCell) ?? 0,
      orbitalPeriod: (parseNumber(pDaysCell) ?? 0) * 86400,
      inclination: ((parseNumber(iDegCell) ?? 0) * Math.PI) / 180,
      argumentOfPeriapsis: ((parseNumber(wDegCell) ?? 0) * Math.PI) / 180,
      meanAnomalyAtEpoch: ((parseNumber(mDegCell) ?? 0) * Math.PI) / 180,
    });
  }

  moons.sort((a, b) => a.parentId.localeCompare(b.parentId) || a.semiMajorAxis - b.semiMajorAxis || a.name.localeCompare(b.name));

  const content = `import { CelestialBody } from "../../types";\n\nexport const SOL_MOONS_GENERATED: CelestialBody[] = ${JSON.stringify(moons, null, 2)};\n`;
  await fs.writeFile(OUT_PATH, content, "utf8");

  const counts = moons.reduce((acc, moon) => {
    acc[moon.parentId] = (acc[moon.parentId] || 0) + 1;
    return acc;
  }, {});
  const manifest = {
    generatedAt: new Date().toISOString(),
    moonSources: {
      satelliteElements: SAT_ELEM_URL,
      satellitePhysical: SAT_PHYS_URL,
      atlasFallback: ATLAS_MOONS_PATH,
    },
    counts: {
      importedMoonRows: moons.length,
      importedPhysicalRows: physRows.length - 1,
      gravityEnabledMoons: moons.filter((moon) => moon.gravitySource).length,
      withMass: moons.filter((moon) => moon.mass != null).length,
      withRadius: moons.filter((moon) => moon.radius != null).length,
      byParent: counts,
    },
    notes: [
      "JPL sat mean elements drive orbit import.",
      "JPL sat phys params drive GM/radius where available.",
      "Atlas moons.csv used only as radius fallback.",
      "Tiny moons without reliable GM stay gravitySource:false.",
    ],
  };
  const manifestContent = `export const SOL_SOURCES_GENERATED = ${JSON.stringify(manifest, null, 2)} as const;\n`;
  await fs.writeFile(MANIFEST_PATH, manifestContent, "utf8");

  console.log(`Wrote ${moons.length} moons to ${OUT_PATH}`);
  console.log(`Wrote source manifest to ${MANIFEST_PATH}`);
  console.log(JSON.stringify(counts, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
