# Sol scientific simulation research + implementation checklist

Date: 2026-05-27
Project: Newtonian Orbit Space Simulator
Scope: Sol starter system first. Keep gameplay/simulation 2D (`x/y`, `vx/vy`, heading). No hidden Z mechanics.

## Goal

Make Sol feel like home system, not placeholder system:

- all 8 planets
- all known natural moons from authoritative source
- major dwarf planets / trans-Neptunian objects useful for Sol geography
- planetary rings
- asteroid belt
- Kuiper Belt + scattered disk
- Oort Cloud representation
- improved ship gravity: sum acceleration vectors from real gravitational bodies, not single sphere-of-influence switch only

## Source hierarchy

Use official / primary-ish sources first:

1. **JPL Horizons API** — best source for accurate ephemerides / state vectors.
   - https://ssd-api.jpl.nasa.gov/doc/horizons.html
   - Use when we need position/velocity at epoch.
2. **JPL planetary physical parameters** — planet/dwarf mass, radius, density, rotation, period.
   - https://ssd.jpl.nasa.gov/planets/phys_par.html
3. **JPL approximate planet positions** — Keplerian elements for 1800–2050 or 3000 BC–3000 AD.
   - https://ssd.jpl.nasa.gov/planets/approx_pos.html
4. **JPL planetary satellite mean elements** — all known planetary satellites in one table.
   - https://ssd.jpl.nasa.gov/sats/elem/
   - Current parsed table count: **460 satellite rows**.
   - Warning from JPL: mean elements describe general orbit shape; not intended for accurate ephemeris computation. Horizons needed for precision.
5. **JPL planetary satellite physical parameters** — GM/radius/density where available.
   - https://ssd.jpl.nasa.gov/sats/phys_par/
   - Current parsed physical table count: **47 satellite rows**.
   - Important: many tiny/irregular moons have orbit data but no reliable mass/radius. Do not invent real gravity values silently.
6. **JPL SBDB Query API** — asteroid/comet/TNO catalog fields.
   - https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html
7. **NASA Kuiper Belt facts**
   - https://science.nasa.gov/solar-system/kuiper-belt/facts/
8. **NASA Oort Cloud facts**
   - https://science.nasa.gov/solar-system/oort-cloud/facts/
9. **NASA planet pages for rings**
   - Jupiter: https://science.nasa.gov/jupiter/facts/
   - Saturn: https://science.nasa.gov/saturn/facts/
   - Uranus: https://science.nasa.gov/uranus/facts/
   - Neptune: https://science.nasa.gov/neptune/facts/

## Current code truth

Current file: `src/data/stars.ts`

Current authored Sol has:

- Mercury
- Venus
- Earth
- Luna, but **Moon distance is scaled 10x outward** (`0.00257 * AU * 10`) for gameplay visibility. This is scientifically false.
- Mars
- Ceres Station
- 6 fake belt asteroids
- Jupiter
- Saturn

Missing / incomplete:

- Uranus
- Neptune
- Pluto / dwarf planets / major trans-Neptunian bodies
- nearly all moons
- all real ring systems
- proper asteroid belt distribution
- Kuiper Belt / scattered disk
- Oort Cloud
- summed gravity model

Current physics file: `src/utils/physics.ts`

- Body positions use Kepler ellipse in 2D.
- Ship gravity currently uses dominant gravity source / SOI style logic, not full vector sum from all relevant bodies.
- `inclination` is stored but ignored in 2D gameplay. Keep as metadata or projection hint only.

## Scientific honesty decisions

### 2D compromise

Real Solar System is 3D. Project rule says 2D only. So:

- keep real `a`, `e`, `period`, `argumentOfPeriapsis`, `meanAnomalyAtEpoch`
- store inclination/node as metadata
- project to ecliptic XY for gameplay
- do not fake Z gameplay

### Gravity compromise

For ship acceleration, use vector sum:

```text
a_ship = Σ G * body.mass / r² * direction_to_body
```

But only bodies with defensible mass/GM should contribute by default.

Classification:

- **gravitySource: true** for Sun, planets, major moons, dwarf planets with real mass/GM.
- **gravitySource: false** for tiny moons / asteroids without real mass unless we explicitly estimate and mark `massEstimate: true`.
- Rings/belts/Oort Cloud should not be individual gravity particles. Use visual/density fields and maybe aggregate mass approximation later, clearly marked.

Reason: adding fake mass for hundreds of tiny moons would look scientific but be dishonest.

## Required schema additions

Add or extend types:

```ts
type BodyType = "star" | "planet" | "dwarfPlanet" | "moon" | "asteroid" | "comet" | "station" | "belt" | "ring";

interface CelestialBody {
  id: string;
  name: string;
  type: BodyType;
  mass: number | null;        // kg, null if unknown
  gm?: number;                // km^3/s^2 or m^3/s^2, choose one and document
  radius: number | null;      // meters, null if unknown
  radiusEstimate?: boolean;
  massEstimate?: boolean;
  gravitySource?: boolean;
  parentId: string | null;
  semiMajorAxis: number;
  eccentricity: number;
  orbitalPeriod: number;
  inclination: number;
  longitudeOfAscendingNode?: number;
  argumentOfPeriapsis: number;
  meanAnomalyAtEpoch: number;
  epoch?: string;
  source?: string;
}

interface RingSystem {
  parentId: string;
  rings: Array<{
    name: string;
    innerRadius: number; // meters from planet center if known
    outerRadius: number; // meters from planet center if known
    width?: number;
    opacity: number;
    color: string;
    source: string;
  }>;
}

interface BeltRegion {
  id: string;
  name: string;
  innerAU: number;
  outerAU: number;
  renderMode: "density-ring" | "sampled-bodies";
  source: string;
}
```

## Body checklist

### Star

- [ ] Sun — mass/radius/GM real; central gravity source.

### Planets

Use JPL physical + orbital data.

- [ ] Mercury
- [ ] Venus
- [ ] Earth
- [ ] Mars
- [ ] Jupiter
- [ ] Saturn
- [ ] Uranus
- [ ] Neptune

### Earth system

JPL satellite mean elements count: 1.

- [ ] Moon — fix distance to real 384,400 km semi-major axis; remove current 10x scaling.

### Mars system

JPL satellite mean elements count: 2.

- [ ] Phobos
- [ ] Deimos

### Jupiter system

JPL satellite mean elements count: 115.

Implementation rule:

- import all 115 orbit rows from JPL table
- mark major/physical-param moons with real radius/GM where JPL physical table provides it
- render tiny irregular moons with LOD labels only when zoomed in / selected

Must include at minimum visible major moons:

- [ ] Io
- [ ] Europa
- [ ] Ganymede
- [ ] Callisto
- [ ] Amalthea
- [ ] Thebe
- [ ] Adrastea
- [ ] Metis
- [ ] all remaining JPL Jupiter satellite rows imported

### Saturn system

JPL satellite mean elements count: 291.

Implementation rule:

- import all 291 orbit rows from JPL table
- render with LOD; do not label all at far zoom
- Titan/Enceladus/Rhea/Iapetus etc get high-priority display and gravity if mass known

Must include at minimum visible major moons:

- [ ] Mimas
- [ ] Enceladus
- [ ] Tethys
- [ ] Dione
- [ ] Rhea
- [ ] Titan
- [ ] Hyperion
- [ ] Iapetus
- [ ] Phoebe
- [ ] all remaining JPL Saturn satellite rows imported

### Uranus system

JPL satellite mean elements count parsed: 30 rows.

Must include:

- [ ] Miranda
- [ ] Ariel
- [ ] Umbriel
- [ ] Titania
- [ ] Oberon
- [ ] Cordelia
- [ ] Ophelia
- [ ] Bianca
- [ ] Cressida
- [ ] Desdemona
- [ ] Juliet
- [ ] Portia
- [ ] Rosalind
- [ ] Belinda
- [ ] Puck
- [ ] Perdita
- [ ] Mab
- [ ] Cupid
- [ ] Caliban
- [ ] Sycorax
- [ ] Prospero
- [ ] Setebos
- [ ] Stephano
- [ ] Trinculo
- [ ] Francisco
- [ ] Margaret
- [ ] Ferdinand
- [ ] S/2023 U1
- [ ] S/2025 U1
- [ ] any duplicate/source-name issue resolved from JPL table before import

Note: parsed table showed `Puck` twice. Need verify if one row is duplicated or parsing/official-table quirk before implementation.

### Neptune system

JPL satellite mean elements count: 16.

- [ ] Triton
- [ ] Naiad
- [ ] Thalassa
- [ ] Despina
- [ ] Galatea
- [ ] Larissa
- [ ] Proteus
- [ ] Hippocamp
- [ ] Nereid
- [ ] Halimede
- [ ] Psamathe
- [ ] Sao
- [ ] Laomedeia
- [ ] Neso
- [ ] S/2002 N5
- [ ] S/2021 N1

### Pluto / dwarf planets / TNO starter set

Pluto is not one of 8 planets, but useful for outer Sol navigation.

- [ ] Pluto
- [ ] Charon
- [ ] Styx
- [ ] Nix
- [ ] Kerberos
- [ ] Hydra
- [ ] Ceres
- [ ] Vesta
- [ ] Pallas
- [ ] Hygiea
- [ ] Eris
- [ ] Haumea
- [ ] Makemake
- [ ] Orcus
- [ ] Quaoar
- [ ] Sedna
- [ ] Arrokoth optional landmark

Use JPL SBDB/Horizons for orbital elements and physical data where available.

## Ring checklist

Use NASA planet pages for descriptive ring systems. Use a ring data table/source for exact radii before final numeric implementation.

- [ ] Jupiter ring system — faint dust rings discovered by Voyager 1; dust likely from inner moons.
- [ ] Saturn ring system — D, C, B, Cassini Division, A, F, G, E, Phoebe ring. NASA states main system extends up to ~282,000 km from Saturn, main rings ~10 m vertical height.
- [ ] Uranus ring system — Zeta, 6, 5, 4, Alpha, Beta, Eta, Gamma, Delta, Lambda, Epsilon, Nu, Mu.
- [ ] Neptune ring system — Galle, Leverrier, Lassell, Arago, Adams + arcs Liberté, Egalité, Fraternité, Courage.

## Belt / region checklist

### Main asteroid belt

NASA: most asteroids orbit between Mars and Jupiter; total asteroid mass less than Moon.

- [ ] render as density ring between roughly Mars/Jupiter
- [ ] import selected real major asteroids from JPL SBDB
- [ ] include Ceres, Vesta, Pallas, Hygiea as high-priority bodies
- [ ] sample smaller asteroids deterministically from SBDB query or seeded distribution

### Kuiper Belt

NASA facts:

- inner edge starts near Neptune orbit: ~30 AU
- main region ends ~50 AU
- scattered disk overlaps outer edge and continues to nearly 1,000 AU
- more than 2,000 TNOs cataloged; estimated hundreds of thousands >100 km
- total mass no more than about 10% Earth mass

Checklist:

- [ ] density ring 30–50 AU
- [ ] scattered disk 50–1000 AU
- [ ] real major KBO/TNO landmarks imported
- [ ] no attempt to render all objects at once

### Oort Cloud

NASA facts:

- theoretical spherical shell, icy comet-like objects
- inner edge often described around 2,000–5,000 AU
- outer edge around 10,000–100,000 AU
- may contain hundreds of billions/trillions of bodies

2D game representation:

- [ ] render as far outer halo/density field only
- [ ] no normal per-object simulation
- [ ] optional rare long-period comet spawns from Oort source
- [ ] label as theoretical / not directly observed body catalog

## Gravity implementation plan

Current model: dominant body / SOI.

Target model:

1. Keep Kepler body positions for planets/moons.
2. Compute ship acceleration as vector sum from `gravitySource` bodies.
3. Always include Sun + 8 planets.
4. Include major moons and dwarf planets with reliable GM/mass.
5. Ignore or disable gravity for unknown-mass tiny moons by default.
6. Keep collision/docking/mining separate from gravity.
7. Use softening/min-radius clamp near body center to avoid numerical explosion.
8. Keep SOI only for UI/context labels, not as only gravity source.

Pseudo:

```ts
function computeGravityAcceleration(ship, bodies, time) {
  let ax = 0;
  let ay = 0;
  for (const body of bodies) {
    if (!body.gravitySource || !body.mass) continue;
    const pos = getAbsoluteBodyPosition(body.id, bodies, time);
    const dx = pos.x - ship.x;
    const dy = pos.y - ship.y;
    const r2 = Math.max(dx * dx + dy * dy, body.radius * body.radius);
    const r = Math.sqrt(r2);
    const a = G * body.mass / r2;
    ax += (dx / r) * a;
    ay += (dy / r) * a;
  }
  return { ax, ay };
}
```

## Implementation order

### Phase 1 — data pipeline, no gameplay change

- [x] create `scripts/fetch_sol_sources.*` or static source JSON builder
- [x] extract JPL planet physical/orbital data
- [ ] extract JPL satellite orbital elements: expected 460 rows
- [ ] extract JPL satellite physical params: expected 47 rows
- [x] output generated JSON/TS data under `src/data/generated/sol-*`
- [x] save source URLs + fetch date in generated metadata

Status note:
- live/generated now exists for `sol-bodies`, `sol-features`, `sol-moons`, `sol-small-bodies`, `sol-small-body-candidates`, `sol-sources`
- small-body runtime builder now uses `sbdb.api?sstr=...` after `sbdb_query.api` exact-object lookup failed with HTTP 400

### Phase 2 — Sol body model

- [x] extend `BodyType`
- [x] support `mass: null`, `radius: null`, `gravitySource`, source metadata
- [x] replace authored Sol bodies with generated/curated Sol data
- [x] fix Moon scale
- [x] add Uranus/Neptune
- [x] add all moons as data, with LOD rendering protection

Status note:
- generated Sol moons file exists
- JPL `sats/elem` currently has 460 raw data rows = 455 non-Pluto rows + 5 Pluto rows
- one Uranus `Puck` row is duplicated in the JPL table, so current generated non-Pluto unique moon count is 454
- Pluto's 5 moons are curated separately in `sol-bodies.ts`
- checklist verification result: raw-source expectation of 460 rows is satisfied; runtime unique moon objects differ because of the duplicated JPL Puck row and separate Pluto handling

### Phase 3 — rings/belts visuals

- [x] add ring schema/rendering
- [x] add Jupiter/Saturn/Uranus/Neptune rings
- [x] add belt region rendering with zoom LOD
- [x] add Oort/Kuiper labels and visibility rules

Status note:
- `scripts/build_sol_density_fields.py` now generates aggregate ring envelopes + belt/cloud render regions with source metadata
- ring numbers are still approximate gameplay envelopes, not final table-quality sub-ring catalogs

### Phase 4 — summed gravity

- [x] add vector-sum gravity function
- [x] integrate ship with summed gravity
- [x] keep SOI label for HUD only
- [x] test at Earth orbit, Moon flyby, Jupiter system, far outer system

Status note:
- gravity summation is live in `src/utils/physics.ts`
- scenario verification run completed:
  - Earth low orbit: ~8.69 m/s², dominant body Earth
  - Moon flyby (~1000 km altitude): ~0.652 m/s², dominant body Moon
  - Jupiter high orbit: ~22.58 m/s², dominant body Jupiter
  - 600 AU outer-system check: tiny sun-dominated acceleration magnitude ~1.65e-8 m/s², no SOI-only cutoff regression found

### Phase 5 — verification checklist

- [x] `npm run lint`
- [x] `npm run build`
- [x] confirm 8 planets present
- [x] confirm Moon real distance
- [x] confirm all JPL satellite orbit rows imported: 460 expected
- [x] confirm physical satellite rows imported: 47 expected
- [ ] confirm rings visible for Jupiter/Saturn/Uranus/Neptune
- [ ] confirm main belt / Kuiper / scattered disk / Oort visual layers visible at right zoom
- [x] confirm gravity vector sum active and no SOI-only gravity regression

## Open research gaps before numeric finalization

- exact ring radii/widths for Jupiter/Saturn/Uranus/Neptune from table-quality source
- exact planet Kepler elements chosen: JPL approximate table vs Horizons state-vector snapshot converted to 2D elements
- how many small-body objects to import from SBDB at runtime vs generated seed samples
- whether to include Pluto system as normal navigable outer body from start or scanner-discovered landmark
- how to treat unknown-mass moons: zero-gravity visual bodies vs estimated mass flagged clearly

---

# Local Atlas dataset addendum

Date added: 2026-05-27
Local repo: `C:\Users\Boris\Code\asteroids_atlas_of_space-main`
Source read first: `README.md`

## What this repo is

This is Eleanor Lutz's **Mapping The Solar System** repo. It is not a live simulator dataset; it is a processed cartography dataset built from NASA/JPL sources for a poster/map.

Important README facts:

- primary small-body source: JPL Small-Body Database Search Engine
- TNO diameters merged from NASA Planetary Science Institute dataset
- planets/moons compiled separately from JPL SSD + NASA NSSDC
- orbit trajectory CSVs fetched from NASA Horizons
- trajectories are historical/sample paths, mostly around 1998–2000, used for drawing orbit tails
- repo includes output files, so do **not** rerun Horizons scraper unless needed

## License caution

README states:

- code: GPL-3.0
- created data files: ODC Open Database License
- original NASA/JPL data retains original source terms
- artwork: CC BY-NC-ND

Implementation rule:

- do **not** copy repo code into Noss unless license decision made.
- OK to use repo as local research/reference and source-location map.
- Prefer generating our own reduced data from official NASA/JPL APIs/sources for game runtime.
- If importing processed CSV data directly, add attribution + license note and keep generated dataset separated.

## Local Atlas file map

Useful files found without scanning raw 2GB blindly:

```text
asteroids_atlas_of_space-main/
  README.md
  1_split_query_datasets.ipynb
  2_merge_TNO_diameter_data.ipynb
  3_fetch_data.ipynb
  4_log_scale_plotting.ipynb
  data/
    all_asteroids.csv                 ~75 MB
    all_asteroids_wrangled.csv         ~69 MB
    all_comets.csv                    ~311 KB
    all_comets_wrangled.csv           ~270 KB
    large_asteroids.csv               ~409 KB
    small_asteroids.csv               ~1.1 MB
    any_inner_asteroids.csv           ~378 KB
    any_outer_asteroids.csv           ~692 KB
    large_comets.csv                  ~1.7 KB
    planets.csv                       ~824 B
    moons.csv                         ~16.5 KB
    planets/                          9 Horizons trajectory CSVs
    moons/                            185 Horizons trajectory CSVs
    large_asteroids/                  2,715 Horizons trajectory CSVs
    small_asteroids/                  7,469 Horizons trajectory CSVs
    any_inner_asteroids/              trajectory CSVs
    any_outer_asteroids/              5,001 trajectory CSVs
    large_comets/                     13 trajectory CSVs
    diameters/                        TNO/Centaur diameter source files
    plotting_functions/colors.csv
```

## Local Atlas table schemas

### `data/planets.csv`

Columns:

```text
name, full_name, diameter, mean_radius, end_time, begin_time, horizons, class, per
```

Rows sampled:

- Mercury `[199]`, diameter 4878.8 km, radius 2439.4 km, period 88.0 d
- Venus `[299]`, diameter 12103.6 km, radius 6051.8 km, period 224.7 d
- Earth `[399]`, diameter 12742.0168 km, radius 6371.0084 km, period 365.2 d

Usefulness:

- quick planet radius/period reference only
- too thin for gravity; no mass/GM in this CSV
- we still need JPL physical params for mass/GM

### `data/moons.csv`

Columns:

```text
name, name_plain, horizons, mean_radius_km, diameter, end_time, begin_time, class, number
```

Stats:

- rows: 185
- radius/diameter known: 172
- planets represented:
  - Earth: 1
  - Mars: 2
  - Jupiter: 79
  - Saturn: 62
  - Uranus: 27
  - Neptune: 14

Usefulness:

- good older curated moon list with Horizon IDs and radii
- incomplete versus current JPL satellite element table (current parsed JPL count 460)
- good as cross-check / fallback for major moon radius/name/Horizons ID
- not enough for “all current moons” because discoveries changed since 2019

### `data/all_asteroids_wrangled.csv`

Columns:

```text
id, spkid, full_name, pdes, name, neo, pha, diameter, prefix, q, per, class
```

Stats:

- rows: 794,562
- diameter known: 139,308
- named: 21,897
- class counts:
  - MBA 705,913 — main belt asteroid
  - OMB 23,712 — outer main belt
  - IMB 17,007 — inner main belt
  - MCA 16,909 — Mars-crossing asteroid
  - APO 10,988 — Apollo NEO
  - AMO 7,486 — Amor NEO
  - TJN 7,236 — Jupiter Trojan
  - TNO 3,218 — trans-Neptunian object
  - ATE 1,503 — Aten NEO
  - CEN 475 — Centaur
  - AST 95
  - IEO 19 — Atira/interior-Earth object
  - HYA 1

Usefulness:

- excellent for belt/TNO population sampling and class distribution
- not needed wholesale in browser runtime
- useful for offline preprocessing to select:
  - largest objects by class
  - named objects
  - representative samples per class/radial band
  - NEO/PHA gameplay contacts

Critical limitation:

- has perihelion `q` and period `per`, but not full orbital elements (`a`, `e`, `i`, `Ω`, `ω`, `M`) in this wrangled CSV.
- For dynamic Kepler sim, need JPL SBDB API/Horizons or parse trajectory files / original SBDB with more fields.

### `data/all_comets_wrangled.csv`

Stats:

- rows: 3,568
- diameter known: 105
- named: 3,457
- classes:
  - PAR 1,837
  - JFc 667
  - COM 544
  - HYP 348
  - HTC 86
  - ETc 57
  - JFC 15
  - CTc 14

Usefulness:

- good for comet source selection
- Oort Cloud gameplay can spawn long-period comet landmarks from this, but not all as live bodies

## Trajectory CSVs

Trajectory files have columns:

```text
JDTDB, Calendar Date (TDB), X, Y, Z
```

Units from Horizons output appear km. Examples:

- `data/planets/399.csv` Earth path around 1998–2000
- `data/moons/ganymede.csv`
- `data/large_asteroids/DES=+2000001.csv` Ceres
- `data/any_outer_asteroids/DES=+2002624.csv`

Usefulness:

- good for visual orbit ribbons / historical path verification
- not ideal primary runtime sim format because no velocities and large file count
- not needed if we use Kepler elements or Horizons API state vectors

## Improved data strategy using Atlas

### Do not import all objects

Browser runtime should not load 794k asteroids + 3.5k comets + thousands trajectory files.

Use three layers:

1. **Core physical bodies** — full sim / gravity.
   - Sun
   - 8 planets
   - major moons with reliable GM/mass
   - dwarf planets / large asteroids with reliable mass
2. **Navigable landmarks** — Kepler orbit, selectable/minable, usually no gravity unless mass known.
   - Ceres, Vesta, Pallas, Hygiea
   - largest named asteroids per class
   - Pluto/Charon system, Eris, Haumea, Makemake, Quaoar, Orcus, Sedna
   - selected comets
3. **Density fields** — visual only / procedural samples.
   - main belt
   - Jupiter Trojans
   - Centaurs
   - Kuiper Belt
   - scattered disk
   - Oort Cloud

### Suggested import selection from Atlas

Use `all_asteroids_wrangled.csv` offline to produce small generated files:

- top 200 largest `MBA/IMB/OMB` with known diameter
- top 100 named Jupiter Trojans `TJN`
- top 100 Centaurs `CEN`
- all known named/large `TNO` with known diameter, capped maybe 300
- all `NEO/PHA` larger than threshold for gameplay hazards, capped maybe 200

For each selected object, fetch proper elements from JPL SBDB API:

```text
fields=spkid,full_name,pdes,name,diameter,GM,e,a,q,i,om,w,ma,per,epoch,class
```

Reason: Atlas wrangled CSV tells us **what to pick**, JPL SBDB gives us **sim-ready elements**.

### What Atlas improves in original plan

Original plan said “use SBDB / import selected objects.” Now concrete local checklist:

- [ ] use Atlas `all_asteroids_wrangled.csv` as candidate index
- [ ] derive runtime object shortlist by class/diameter/name/gameplay priority
- [ ] use Atlas class counts to tune visual density:
  - main belt dominates by far
  - Trojans significant
  - TNO/Centaurs sparse but important for outer Sol
- [ ] use Atlas `moons.csv` only as older cross-check, not final all-moons source
- [ ] use current JPL `sats/elem` for final all-moons list because Atlas has 185 moons, current JPL table has 460 rows
- [ ] use Atlas trajectory CSVs only for visual validation or map-art style, not primary runtime

## Revised implementation che
cklist additions

### Offline preprocessing scripts

- [ ] `scripts/build_sol_major_bodies.py` or `.ts`
  - reads official JPL planet/satellite sources
  - writes planets + all current moons
- [ ] `scripts/select_sol_small_bodies.py`
  - reads local Atlas `all_asteroids_wrangled.csv` / `all_comets_wrangled.csv`
  - selects capped shortlist by class/diameter/name
  - calls or prepares calls to JPL SBDB API for full elements
  - writes compact generated JSON
- [ ] `scripts/build_sol_density_fields.py`
  - computes per-class/radial density bins from Atlas counts
  - writes render-only belt metadata

### Runtime generated files

- [ ] `src/data/generated/sol-planets.json`
- [ ] `src/data/generated/sol-moons.json`
- [ ] `src/data/generated/sol-small-bodies.json`
- [ ] `src/data/generated/sol-belts.json`
- [ ] `src/data/generated/sol-rings.json`
- [ ] `src/data/generated/sol-sources.json`

### Validation counts

- [ ] Atlas asteroid candidate rows processed: 794,562 expected
- [ ] Atlas comet candidate rows processed: 3,568 expected
- [ ] Atlas moon cross-check rows: 185 expected
- [ ] Current JPL satellite element rows: 460 expected
- [ ] selected runtime small bodies count stays sane: target 500–2,000, not 800k
- [ ] generated density fields preserve class/radial distribution summary

## Important correction to previous plan

Previous plan listed “all moons” using current JPL table, good. Local Atlas does **not** replace that because its moon list is older/incomplete.

Previous plan under-specified small-body selection. New rule:

- Atlas = local candidate catalog + class distribution + diameter/name shortlist.
- JPL SBDB/Horizons = authoritative sim elements for selected objects.
- Browser runtime = compact selected bodies + density fields, not full Atlas.
