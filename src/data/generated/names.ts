/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Game text data: names for ships, manufacturers, parts, bases, stations,
 * traders, refuelers, and bandits in the Newtonian Orbit Space Simulator.
 *
 * Follows existing conventions: Faulcon DeLacy ship names, mythological/
 * geographic + function station naming, 2086 gritty near-future aesthetic.
 */

// ─── Ship Manufacturers ─────────────────────────────────────────────────────

export interface Manufacturer {
  id: string;
  name: string;
  origin: string;
  specialty: string;
  description: string;
}

export const SHIP_MANUFACTURERS: Manufacturer[] = [
  {
    id: "faulcon_delacy",
    name: "Faulcon DeLacy",
    origin: "Sol — Earth (London)",
    specialty: "Starter and multi-role vessels",
    description: "Humanity's oldest active shipbuilder. Reliable frames that have seeded colony ships across fifty light years.",
  },
  {
    id: "core_dynamics",
    name: "Core Dynamics",
    origin: "Sol — Mars (Olympus Mons)",
    specialty: "Military-grade hulls and heavy freighters",
    description: "Mars-based industrial giant. Known for over-engineered armour plates and frame-shift resilient power plants.",
  },
  {
    id: "gutamaya",
    name: "Gutamaya",
    origin: "Sol — Earth (Mumbai Orbital)",
    specialty: "Luxury and high-performance vessels",
    description: "Producers of elegant, fast-lined vessels with superior power response curves. A Gutamaya bridge is a statement of wealth.",
  },
  {
    id: "zorgon_peterson",
    name: "Zorgon Peterson",
    origin: "Sol — Venus (Aphrodite Aero-Station)",
    specialty: "Industrial and utilitarian frames",
    description: "No-frills vessels built for the belt. Zorgon Peterson ships run hot, run heavy, and run forever.",
  },
  {
    id: "lakon_spaceways",
    name: "Lakon Spaceways",
    origin: "Alpha Centauri — New Hope",
    specialty: "Exploration and science vessels",
    description: "Extra-Solar first light. Lakon pioneered the first interstellar survey frames. Their cockpits are legendary for field of view.",
  },
  {
    id: "kestrel_propulsion",
    name: "Kestrel Propulsion",
    origin: "Sol — Mercury (Hermal Yards)",
    specialty: "Thrusters and drive components",
    description: "Inner-system thruster specialists. Kestrel high-flow plasma drives are the standard in civilian and light-combat vessels.",
  },
  {
    id: "vodel_heavy_industries",
    name: "Vodel Heavy Industries",
    origin: "Sol — Jupiter (Ganymede Orbital)",
    specialty: "Bulk freight and station modules",
    description: "Jovian-system industrial powerhouse. Vodel builds the frames that build the colonies.",
  },
  {
    id: "nebula_refit",
    name: "Nebula Refit Collective",
    origin: "Various — fringe outposts",
    specialty: "Refurbished and salvaged vessels",
    description: "Not a true manufacturer. A network of fringe shipyards that rebuild, re-engine, and repurpose anything with a pressure hull.",
  },
  {
    id: "zvezda_shipbuilding",
    name: "Zvezda Shipbuilding",
    origin: "Sol — Earth (Baikonur)",
    specialty: "Heavy frames and deep-space tugs",
    description: "Russian-orbit yards known for rugged, cold-rated vessels built to function without maintenance for years.",
  },
  {
    id: "gromov_design",
    name: "Gromov Design Bureau",
    origin: "Sol — Luna (Lunapolis)",
    specialty: "High-thrust propulsion and combat frames",
    description: "Gromov engines are loud, powerful, and slightly unreliable. Belters trust them anyway.",
  },
  {
    id: "soyuz_orbital",
    name: "Soyuz Orbital Group",
    origin: "Sol — Earth (Star City)",
    specialty: "Crew transport and rescue frames",
    description: "Descendants of the old Soviet space program. Soyuz capsules still outnumber any other crew-rated vessel in Sol.",
  },
  {
    id: "nakamura_drive",
    name: "Nakamura Drive Works",
    origin: "Sol — Earth (Tokyo Orbital)",
    specialty: "Precision drives and sensor platforms",
    description: "Meticulous Japanese engineering adapted for vacuum. Nakamura ion thrusters set the efficiency standard.",
  },
  {
    id: "hayabusa_heavy",
    name: "Hayabusa Heavy Industries",
    origin: "Sol — Mars (Kasei Valley)",
    specialty: "Exploration frames and lightweight alloys",
    description: "Mars-based Japanese-industrial consortium. Known for tensile-strength composites and minimalist hull designs.",
  },
  {
    id: "liberty_dynamics",
    name: "Liberty Dynamics",
    origin: "Sol — Earth (Cape York)",
    specialty: "Planetary landers and orbital assembly",
    description: "Descendant of the old NASA contractor network. Liberty tugs handle most Sol orbital construction.",
  },
  {
    id: "odyssey_works",
    name: "Odyssey Works",
    origin: "Sol — Luna (Mare Orientale)",
    specialty: "Deep-range survey and research vessels",
    description: "Spiritual successor to the Voyager and Pioneer programs. Every Odyssey ship carries a golden record tribute plate.",
  },
  {
    id: "terran_unity",
    name: "Terran Unity Shipyards",
    origin: "Sol — Earth (Geneva Orbital)",
    specialty: "Grand fleet construction and cruiser frames",
    description: "The oldest continuously operating orbital yard. Its ways have launched generation ships, colony vessels, and defence monitors.",
  },
];

// ─── Ship Models ─────────────────────────────────────────────────────────────

export interface ShipModel {
  id: string;
  name: string;
  manufacturerId: string;
  class: "starter" | "multi" | "combat" | "freighter" | "explorer" | "luxury" | "salvage";
  description: string;
  baseCost: number;
}

export const SHIP_MODELS: ShipModel[] = [
  // Faulcon DeLacy
  { id: "ship_sidewinder", name: "Sidewinder Mk I", manufacturerId: "faulcon_delacy", class: "starter", description: "Standard starter vessel. Egress-rated hull, minimal cargo, still flying a century after introduction.", baseCost: 32000 },
  { id: "ship_eagle", name: "Eagle Mk II", manufacturerId: "faulcon_delacy", class: "combat", description: "Light combat frame built for speed and small hardpoints. Favoured by pirate hunters and system patrol.", baseCost: 114000 },
  { id: "ship_viper", name: "Viper Mk III", manufacturerId: "faulcon_delacy", class: "combat", description: "Military heritage. Fast, agile, twin-engine config. Standard system authority interceptor.", baseCost: 143000 },
  { id: "ship_cobra", name: "Cobra Mk III", manufacturerId: "faulcon_delacy", class: "multi", description: "Legendary multi-role frame. Enough cargo for trading, enough guns for survival, enough speed to run.", baseCost: 380000 },
  { id: "ship_type6", name: "Type-6 Transporter", manufacturerId: "faulcon_delacy", class: "freighter", description: "Civilian medium freighter. Spacious hold. Poor shields. Popular with independent traders.", baseCost: 1045000 },

  // Core Dynamics
  { id: "ship_dropship", name: "Federal Dropship", manufacturerId: "core_dynamics", class: "combat", description: "Assault-certified hull with heavy armour distribution. Slow turn rate, high mass tolerance.", baseCost: 14000000 },
  { id: "ship_gunship", name: "Federal Gunship", manufacturerId: "core_dynamics", class: "combat", description: "Hardpoint-heavy variant of the Dropship frame. Seven weapon mounts. Needs escort against agile targets.", baseCost: 36000000 },
  { id: "ship_corvette", name: "Federal Corvette", manufacturerId: "core_dynamics", class: "combat", description: "Galactic Navy command vessel. Maximum firepower. Requires rank clearance to purchase.", baseCost: 187000000 },
  { id: "ship_t9", name: "Type-9 Heavy", manufacturerId: "core_dynamics", class: "freighter", description: "Ultra-heavy bulk transport. Largest cargo hold in known space. Docking it is a skill.", baseCost: 76500000 },

  // Gutamaya
  { id: "ship_imperial_eagle", name: "Imperial Eagle", manufacturerId: "gutamaya", class: "combat", description: "Gutamaya's light combat entry. Faster than the standard Eagle, thinner armour, cleaner lines.", baseCost: 168000 },
  { id: "ship_courier", name: "Imperial Courier", manufacturerId: "gutamaya", class: "multi", description: "High-speed courier with three medium hardpoints in a tiny hull. Outruns anything that outguns it.", baseCost: 2420000 },
  { id: "ship_clipper", name: "Imperial Clipper", manufacturerId: "gutamaya", class: "multi", description: "Gutamaya's signature medium frame. Fast, agile for its size, spacious cargo. A favourite among independent skippers.", baseCost: 22200000 },
  { id: "ship_cutter", name: "Imperial Cutter", manufacturerId: "gutamaya", class: "luxury", description: "Flagship-grade vessel. Massive cargo, massive shields, massive price. The ultimate statement of naval ambition.", baseCost: 213000000 },

  // Zorgon Peterson
  { id: "ship_hauler", name: "Hauler", manufacturerId: "zorgon_peterson", class: "freighter", description: "Budget freighter. Slow, ugly, cheap. Flown by every starting miner and data courier at some point.", baseCost: 53000 },
  { id: "ship_adder", name: "Adder", manufacturerId: "zorgon_peterson", class: "multi", description: "Compact multi-role with a single medium hardpoint. Efficient fuel consumption. Common exploration starter.", baseCost: 89000 },
  { id: "ship_python", name: "Python", manufacturerId: "zorgon_peterson", class: "multi", description: "Medium ship with large-ship capability. Largest cargo rack that fits a medium landing pad. The independent commander's workhorse.", baseCost: 56600000 },
  { id: "ship_anaconda", name: "Anaconda", manufacturerId: "zorgon_peterson", class: "explorer", description: "Long-range exploration and multi-crew command. Massive jump range, enormous module bay. A ship to end the journey in.", baseCost: 147000000 },

  // Lakon Spaceways
  { id: "ship_asp_explorer", name: "Asp Explorer", manufacturerId: "lakon_spaceways", class: "explorer", description: "The benchmark exploration vessel. Legendary jump range and cockpit visibility. Crossed more light years than any other frame.", baseCost: 6660000 },
  { id: "ship_diamondback", name: "Diamondback Explorer", manufacturerId: "lakon_spaceways", class: "explorer", description: "Hardy surveyor with military-grade heat efficiency. Flown deep into uncharted nebula by the Lakon Cartographic Survey.", baseCost: 1890000 },
  { id: "ship_keelback", name: "Keelback", manufacturerId: "lakon_spaceways", class: "freighter", description: "Type-6 derived light freighter with a fighter bay. For traders who expect company in the belt.", baseCost: 3090000 },
  { id: "ship_type10", name: "Type-10 Defender", manufacturerId: "lakon_spaceways", class: "combat", description: "Core Dynamics T9 hull refitted by Lakon with heavy weapon hardpoints. Floating fortress.", baseCost: 124000000 },

  // Zvezda Shipbuilding
  { id: "ship_sputnik", name: "Sputnik-class Transport", manufacturerId: "zvezda_shipbuilding", class: "freighter", description: "Simple unpressurised cargo sled. No cabin, no life support, just a frame with thrusters. Used for bulk ore in the belt.", baseCost: 18000 },
  { id: "ship_kosmos", name: "Kosmos-class Surveyor", manufacturerId: "zvezda_shipbuilding", class: "explorer", description: "Deep-range probe bus with extended fuel pods. No cockpit — controlled remotely or via drone link. Cheap to replace.", baseCost: 45000 },

  // Gromov Design Bureau
  { id: "ship_buran", name: "Buran-class Interceptor", manufacturerId: "gromov_design", class: "combat", description: "Reaction-driven combat frame with oversized engine bells. Turns on a dime. Runs out of fuel on a nickel.", baseCost: 231000 },
  { id: "ship_molniya", name: "Molniya-class Patrol Boat", manufacturerId: "gromov_design", class: "combat", description: "High-eccentricity orbit patrol frame. Guns are secondary to its sensor package. Finds you before you find it.", baseCost: 470000 },

  // Soyuz Orbital Group
  { id: "ship_soyuz", name: "Soyuz-M Crew Ferry", manufacturerId: "soyuz_orbital", class: "multi", description: "Upgraded legacy crew capsule with bolt-on cargo rings. Carries 4 crew and 30 tons. The workhorse of Sol crew transfer.", baseCost: 220000 },

  // Nakamura Drive Works
  { id: "ship_tsukuba", name: "Tsukuba-class Science Vessel", manufacturerId: "nakamura_drive", class: "explorer", description: "Multi-spectrum survey platform with Nakamura's signature low-noise ion drives. Every data buoy in Sol was placed by a Tsukuba.", baseCost: 1320000 },
  { id: "ship_akatsuki", name: "Akatsuki-class Courier", manufacturerId: "nakamura_drive", class: "multi", description: "Ultra-light courier designed for maximum acceleration. No cargo, no weapons, just a drive and a data core.", baseCost: 85000 },

  // Hayabusa Heavy Industries
  { id: "ship_hayabusa", name: "Hayabusa-class Prospector", manufacturerId: "hayabusa_heavy", class: "explorer", description: "Lightweight asteroid prospector. Composite hull keeps mass low. Twin sample return pods.", baseCost: 290000 },
  { id: "ship_kaguya", name: "Kaguya-class Orbital Transporter", manufacturerId: "hayabusa_heavy", class: "freighter", description: "Arachnid-configuration cargo frame. Modular holds can swap between dry cargo, fuel bladders, or passenger modules.", baseCost: 890000 },

  // Liberty Dynamics
  { id: "ship_liberty", name: "Liberty-class Lander", manufacturerId: "liberty_dynamics", class: "multi", description: "Planetary surface-to-orbit shuttle. Reinforced heat shield, deployable landing struts, short-range EDL profile.", baseCost: 360000 },
  { id: "ship_pioneer", name: "Pioneer-class Colony Ship", manufacturerId: "liberty_dynamics", class: "freighter", description: "Slow, capacious, built for one job: moving people and equipment to new worlds. No combat role. No need.", baseCost: 5400000 },
  { id: "ship_endeavour", name: "Endeavour-class Tug", manufacturerId: "liberty_dynamics", class: "multi", description: "Orbital pusher tug. Massive tractor beam emitter on the nose. Moves station modules and dead ships.", baseCost: 1250000 },

  // Odyssey Works
  { id: "ship_odyssey", name: "Odyssey-class Pathfinder", manufacturerId: "odyssey_works", class: "explorer", description: "Flagship of the Odyssey Works line. Fitted with a full biosphere, redundant drives, and a library of Earth culture.", baseCost: 8900000 },
  { id: "ship_horizon", name: "Horizon-class Deep Surveyor", manufacturerId: "odyssey_works", class: "explorer", description: "Extended-range surveyor with synthetic-aperture lidar. Maps planetary surfaces at 1 cm resolution from orbit.", baseCost: 3400000 },

  // Terran Unity Shipyards (30k Warhammer inspired — expeditionary fleets pre-Star-Crusade)
  { id: "ship_crusader", name: "Crusader-class Fleet Tender", manufacturerId: "terran_unity", class: "freighter", description: "Mobile supply depot for expeditionary fleets. Carries fuel, ammunition, and replacement parts for a full squadron.", baseCost: 22000000 },
  { id: "ship_excelsior", name: "Excelsior-class Command Carrier", manufacturerId: "terran_unity", class: "luxury", description: "Fleet flagship frame. Designed for multi-month deployments beyond Sol. Quarters for 200 crew and 50 passengers.", baseCost: 98000000 },

  // Nebula Refit Collective
  { id: "ship_junkyard", name: "Junkyard Dog", manufacturerId: "nebula_refit", class: "salvage", description: "Literally welded from scrap hulls. Every unit is unique. If it flies and holds cargo, it's a Junkyard Dog.", baseCost: 9000 },
];

// ─── Ship Parts / Components ─────────────────────────────────────────────────

export interface ShipPart {
  id: string;
  name: string;
  category: "engine" | "fuelTank" | "cargo" | "sensor" | "drill" | "warp" | "shield" | "powerPlant" | "thruster";
  manufacturer: string;
  description: string;
  tier: 1 | 2 | 3;
}

export const SHIP_PARTS: ShipPart[] = [
  // Engines
  { id: "part_engine_kestrel", name: "Kestrel High-Flow Plasma Thruster", category: "engine", manufacturer: "Kestrel Propulsion", description: "Standard civilian plasma drive. Efficient at cruise, anemic at boost.", tier: 1 },
  { id: "part_engine_helios", name: "Helios Fusion Drive Core", category: "engine", manufacturer: "Faulcon DeLacy", description: "Catalytic magnetic-confinement fusion torch. Generates enormous thrust with astronomical efficiency.", tier: 2 },
  { id: "part_engine_tyr", name: "Tyr Annihilation Drive", category: "engine", manufacturer: "Core Dynamics", description: "Military-grade matter-antimatter injector. Never fly this without hull reinforcement.", tier: 3 },

  // Fuel Tanks
  { id: "part_tank_composite", name: "Carbon-Fiber Fuel Tank Kit", category: "fuelTank", manufacturer: "Zorgon Peterson", description: "Lightweight composite replacement for standard steel tanks. Cuts dry mass significantly.", tier: 1 },
  { id: "part_tank_cryo", name: "Cryogenic Cryo-Grid Storage", category: "fuelTank", manufacturer: "Vodel Heavy Industries", description: "Insulated containment holding high-density slush hydrogen. Triples standard fuel capacity.", tier: 2 },
  { id: "part_tank_quantum", name: "Quantum-State Fuel Lattice", category: "fuelTank", manufacturer: "Lakon Spaceways", description: "Experimental Bose-Einstein condensate storage. Holds fuel as near-solid. Extreme density.", tier: 3 },

  // Cargo
  { id: "part_cargo_expanders", name: "Cargo Bay Expanders", category: "cargo", manufacturer: "Faulcon DeLacy", description: "Structural shelves and compartment dividers. Maximises void space in standard bays.", tier: 1 },
  { id: "part_cargo_compression", name: "Sub-Space Storage Compression", category: "cargo", manufacturer: "Vodel Heavy Industries", description: "Electromagnetic field compression folds cargo pallets into subspace. Expensive, worth every credit.", tier: 2 },
  { id: "part_cargo_dimensional", name: "Phase-Shift Cargo Matrix", category: "cargo", manufacturer: "Gutamaya", description: "Luxury-grade phased storage. Nearly doubles capacity. Gutamaya only installs on approved vessels.", tier: 3 },

  // Sensors
  { id: "part_sensor_array", name: "Deep Field Scanner Array", category: "sensor", manufacturer: "Lakon Spaceways", description: "Extended-range stellar cartography suite. Standard on all post-2080 survey vessels.", tier: 1 },
  { id: "part_sensor_interferometer", name: "Long-Baseline Survey Interferometer", category: "sensor", manufacturer: "Core Dynamics", description: "Phased sensor rig with gigameter baseline. Resolves planetary surface features at 20 AU.", tier: 2 },
  { id: "part_sensor_quantum", name: "Quantum Entanglement Imager", category: "sensor", manufacturer: "Gutamaya", description: "Instantaneous image reconstruction across any range. Obscenely expensive. Obscenely useful.", tier: 3 },

  // Drills
  { id: "part_drill_laser", name: "Heavy-Pulse Mining Laser", category: "drill", manufacturer: "Kestrel Propulsion", description: "Thermal-focus pulsed laser for asteroid surface ablation. Four times faster than core drills.", tier: 1 },
  { id: "part_drill_plasma", name: "Plasma Cutter Borehead", category: "drill", manufacturer: "Zorgon Peterson", description: "High-temperature plasma lance. Cuts through nickel-iron like butter. Needs heavy power draw.", tier: 2 },
  { id: "part_drill_disruptor", name: "Sub-Sonic Resonance Disruptor", category: "drill", manufacturer: "Core Dynamics", description: "Frequencies that shatter ore veins from the inside. Silent, clean, terrifyingly efficient.", tier: 3 },

  // Warp Drives
  { id: "part_warp_hyper", name: "Hyper-Resonant Warp Drive", category: "warp", manufacturer: "Faulcon DeLacy", description: "Civilian-grade stellar displacement drive. Consumes one He3 per jump. Range: 10 LY.", tier: 1 },
  { id: "part_warp_frame_shift", name: "Frame-Shift Drive v2", category: "warp", manufacturer: "Lakon Spaceways", description: "Second-generation warp engine. Range: 25 LY. Reduced He3 consumption by 30%.", tier: 2 },
  { id: "part_warp_void", name: "Void Phase Drive", category: "warp", manufacturer: "Core Dynamics", description: "Experimental phase-space folding engine. Range: 50 LY. Fuel efficiency curves are classified.", tier: 3 },

  // Shields
  { id: "part_shield_standard", name: "Kinetic Absorption Shield Grid", category: "shield", manufacturer: "Faulcon DeLacy", description: "Standard civilian shield generator. Absorbs micrometeoroid impacts and light weapons.", tier: 1 },
  { id: "part_shield_prismatic", name: "Prismatic Shield Generator", category: "shield", manufacturer: "Core Dynamics", description: "Military-grade multi-layer shielding. Higher strength, higher mass, higher power draw.", tier: 2 },
  { id: "part_shield_biweave", name: "Bi-Weave Thermal Shield", category: "shield", manufacturer: "Gutamaya", description: "Fast-regen shield array favoured by bounty hunters. Weaker per hit but ready again quickly.", tier: 2 },

  // Power Plants
  { id: "part_power_standard", name: "Fusion Cell Power Plant", category: "powerPlant", manufacturer: "Faulcon DeLacy", description: "Reliable 6.4 MW fusion cell. Powers all standard modules without issues.", tier: 1 },
  { id: "part_power_highcap", name: "High-Capacity Reactor Core", category: "powerPlant", manufacturer: "Core Dynamics", description: "12 MW military reactor. Supports heavy weapon loadouts and reinforced shields.", tier: 2 },
  { id: "part_power_antimatter", name: "Antimatter Catalyst Plant", category: "powerPlant", manufacturer: "Core Dynamics", description: "30 MW antimatter annihilation reactor. Overkill for any civilian frame. Overkill is the point.", tier: 3 },

  // Thrusters
  { id: "part_thruster_standard", name: "Gimballed Plasma Thrusters", category: "thruster", manufacturer: "Kestrel Propulsion", description: "3-axis gimballed plasma jets. Standard fare for ships under 500 tons.", tier: 1 },
  { id: "part_thruster_enhanced", name: "Enhanced Drive Tuning", category: "thruster", manufacturer: "Kestrel Propulsion", description: "Performance calibration and nozzle redesign. Boosts top speed by 15%.", tier: 2 },
  { id: "part_thruster_dirty", name: "Dirty Drive Tuning", category: "thruster", manufacturer: "Nebula Refit Collective", description: "Unstable but extreme thruster overclock. Illegal in core systems. Very popular in the belt.", tier: 3 },

  // Engines (Russian/Japanese/30k)
  { id: "part_engine_rd180", name: "RD-180 Open-Cycle Thruster", category: "engine", manufacturer: "Zvezda Shipbuilding", description: "Russian-designed gas-generator cycle engine. Simple, powerful, cheap. Eats fuel but never fails to light.", tier: 1 },
  { id: "part_engine_nakamura", name: "Nakamura Ion Cascade Drive", category: "engine", manufacturer: "Nakamura Drive Works", description: "Multi-stage ion accelerator. Low thrust, extreme efficiency. Run it for months without refuel.", tier: 2 },
  { id: "part_engine_unity", name: "Unity Torch Drive", category: "engine", manufacturer: "Terran Unity Shipyards", description: "Expeditionary-grade fusion torch. Designed for fleet operations beyond Sol. Massive burn endurance.", tier: 3 },

  // Fuel Tanks
  { id: "part_tank_sputnik", name: "Sputnik External Bladder Rig", category: "fuelTank", manufacturer: "Zvezda Shipbuilding", description: "External drop-tank kit for civilian frames. Adds 8,000 kg fuel capacity. Jettisonable in combat.", tier: 1 },
  { id: "part_tank_kibo", name: "Kibo High-Density Hydride Tank", category: "fuelTank", manufacturer: "Hayabusa Heavy Industries", description: "Metal-hydride storage cells. Holds hydrogen at near-solid density. Heavier but far more compact.", tier: 2 },

  // Cargo
  { id: "part_cargo_modular", name: "Modular Container Grid", category: "cargo", manufacturer: "Liberty Dynamics", description: "Standardized interlocking cargo pallets. Universal interface. Load and reconfigure in minutes.", tier: 1 },
  { id: "part_cargo_orbital", name: "Orbital Crane Assembly", category: "cargo", manufacturer: "Odyssey Works", description: "Zero-g cargo manipulator arm. Handles containers up to 50 tons. Docking not required for transfer.", tier: 2 },

  // Sensors
  { id: "part_sensor_phased", name: "Phased-Array LIDAR Suite", category: "sensor", manufacturer: "Nakamura Drive Works", description: "High-resolution phased-array LIDAR. Resolves ship-class objects at 0.5 AU. Japanese precision optics.", tier: 1 },
  { id: "part_sensor_synthetic", name: "Synthetic Aperture Radar Array", category: "sensor", manufacturer: "Terran Unity", description: "SAR imaging system with ground-penetrating capability. Maps subsurface structures from orbit.", tier: 2 },

  // Drills
  { id: "part_drill_thermal", name: "Thermal Lance Penetrator", category: "drill", manufacturer: "Gromov Design Bureau", description: "Overpowered thermal drill. Burns through rock, ice, and light armour. Overheats quickly. Very Russian.", tier: 1 },
  { id: "part_drill_sonic", name: "Resonant Fracture Hammer", category: "drill", manufacturer: "Hayabusa Heavy Industries", description: "Low-frequency sonic pulveriser. Breaks ore along crystal boundaries. Clean extraction, minimal waste.", tier: 2 },

  // Warp Drives
  { id: "part_warp_soyuz", name: "Soyuz-Guidance Warp Module", category: "warp", manufacturer: "Soyuz Orbital Group", description: "Civilian warp module with triple-redundant guidance. Safe, certified, and slow. Range: 8 LY.", tier: 1 },
  { id: "part_warp_horizon", name: "Horizon Fold Drive", category: "warp", manufacturer: "Odyssey Works", description: "Second-gen fold engine with navigational AI. Range: 30 LY. Requires Odyssey-approved nav computer.", tier: 2 },

  // Shields
  { id: "part_shield_ablation", name: "Ablative Heat Shield Matrix", category: "shield", manufacturer: "Liberty Dynamics", description: "Single-use thermal ablation coating. Burns away on re-entry or under laser fire. Cheap and effective.", tier: 1 },
  { id: "part_shield_unity", name: "Unity Pattern Deflector", category: "shield", manufacturer: "Terran Unity Shipyards", description: "Expeditionary fleet-grade shield array. Generates overlapping deflection fields for squadron coverage.", tier: 3 },

  // Power Plants
  { id: "part_power_rtg", name: "Radioisotope Thermoelectric Generator", category: "powerPlant", manufacturer: "Soyuz Orbital Group", description: "Solid-state RTG. No moving parts. Runs for 30 years. Low output but absolutely reliable.", tier: 1 },
  { id: "part_power_fusion", name: "Tokamak Fusion Cell", category: "powerPlant", manufacturer: "Nakamura Drive Works", description: "Compact magnetic-confinement fusion. 18 MW output. Japanese efficiency standards. Clean, cool, quiet.", tier: 2 },

  // Thrusters
  { id: "part_thruster_russian", name: "Gimbal-Gimbal Vernier Set", category: "thruster", manufacturer: "Gromov Design Bureau", description: "Six-axis vernier thruster cluster. Coarse but powerful. Docking with these is an art form.", tier: 1 },
  { id: "part_thruster_japanese", name: "Reaction Control Sphere", category: "thruster", manufacturer: "Nakamura Drive Works", description: "Spherical RCS array with micro-Newton precision. Station-keeping accuracy to the centimeter.", tier: 2 },
];

// ─── Planetary Bases ─────────────────────────────────────────────────────────

export interface PlanetaryBase {
  id: string;
  name: string;
  bodyId: string;
  type: "planetary" | "moon" | "orbital" | "deep_space";
  faction: string;
  description: string;
  services: string[];
}

export const PLANETARY_BASES: PlanetaryBase[] = [
  // Sol — Earth
  { id: "base_earth_1", name: "Tether City One", bodyId: "sol_earth", type: "planetary", faction: "United Sol Directorate", description: "The original equatorial space elevator terminus. Below it: Earth. Above it: the whole system.", services: ["repair", "refuel", "markets", "contracts", "shipyard"] },

  // Sol — Luna
  { id: "base_luna_1", name: "Shackleton Crater Base", bodyId: "sol_moon", type: "moon", faction: "United Sol Directorate", description: "Luna's oldest permanent settlement, buried under the south pole rim. Water ice mine and transit hub.", services: ["repair", "refuel", "markets", "shipyard"] },
  { id: "base_luna_2", name: "Tranquility Research Station", bodyId: "sol_moon", type: "moon", faction: "Lunar Science Council", description: "Geodesic dome complex at Mare Tranquillitatis. Low-gravity materials science labs.", services: ["refuel", "contracts"] },

  // Sol — Mars
  { id: "base_mars_1", name: "Olympus Overlook", bodyId: "sol_mars", type: "planetary", faction: "Mars Colonial Authority", description: "Cliff-side habitat ring on the caldera rim. Core Dynamics corporate sector nearby.", services: ["repair", "refuel", "markets", "contracts", "shipyard"] },
  { id: "base_mars_2", name: "Valles Marineris Mining Collective", bodyId: "sol_mars", type: "planetary", faction: "Belt Miners Syndicate", description: "Deep canyon settlement built into the northern wall. Heavy rare-earth extraction operations.", services: ["refuel", "markets", "contracts"] },

  // Sol — Mercury
  { id: "base_mercury_1", name: "Hermes Thermal Outpost", bodyId: "sol_mercury", type: "planetary", faction: "Mercury Solar Energy Authority", description: "Solar-baked thermal collector station on the dayside terminator. Constant power surplus.", services: ["refuel", "markets"] },

  // Sol — Venus
  { id: "base_venus_1", name: "Aphrodite Cloud City", bodyId: "sol_venus", type: "orbital", faction: "Venus Atmospheric Collective", description: "Aerostat habitat network floating at 55 km altitude. Breathable pressure, corrosive environment.", services: ["refuel", "markets", "contracts"] },

  // Sol — Ganymede
  { id: "base_ganymede_1", name: "Ganymede Subsurface Port", bodyId: "sol_ganymede", type: "moon", faction: "Jovian Economic Zone", description: "Heated cavern port under Ganymede's ice crust. Ship traffic enters through a thermal borehole.", services: ["repair", "refuel", "markets", "shipyard"] },

  // Sol — Titan
  { id: "base_titan_1", name: "Titan Ice Station", bodyId: "sol_titan", type: "moon", faction: "Saturnine Hydrocarbon Board", description: "Methane and ethane harvesting platform on Titan's northern lake district. Cold. Very cold.", services: ["refuel", "markets"] },

  // Sol — Ceres
  { id: "base_ceres_1", name: "Dawn City Hub", bodyId: "sol_ceres", type: "planetary", faction: "Belt Miners Syndicate", description: "The belt's largest independent port. Hollowed asteroid with spin-gravity residential ring.", services: ["repair", "refuel", "markets", "contracts", "shipyard"] },

  // Sol — Europa
  { id: "base_europa_1", name: "Europa Subglacial Station", bodyId: "sol_europa", type: "moon", faction: "Jovian Economic Zone", description: "Under-ice research habitat drilling into the subsurface ocean. Biolab clearance required.", services: ["refuel", "contracts"] },

  // Sol — Callisto
  { id: "base_callisto_1", name: "Callisto Fuel Depot Gamma", bodyId: "sol_callisto", type: "moon", faction: "Jovian Economic Zone", description: "Remote refuelling platform. Low traffic, low security. A favourite meeting point for independent operators.", services: ["refuel", "markets"] },

  // Sol — Enceladus
  { id: "base_enceladus_1", name: "Enceladus Cryo-Depot", bodyId: "sol_enceladus", type: "moon", faction: "Saturnine Hydrocarbon Board", description: "Cryo-extraction facility harvesting Enceladus' water plumes. Pure ice, minimal processing.", services: ["refuel"] },

  // Sol — Earth (Russian/Japanese)
  { id: "base_earth_2", name: "Baikonur-2 Spaceport", bodyId: "sol_earth", type: "planetary", faction: "Soyuz Orbital Group", description: "Rebuilt Kazakh spaceport with modern orbital elevator adjunct. The launch rates rival Cape York.", services: ["repair", "refuel", "shipyard"] },
  { id: "base_earth_3", name: "Tsukuba Science City", bodyId: "sol_earth", type: "planetary", faction: "Nakamura Drive Works", description: "Japanese orbital research campus. Low-g materials lab and Nakamura's primary R&D floor.", services: ["repair", "contracts"] },

  // Sol — Luna
  { id: "base_luna_3", name: "Gagarin Point", bodyId: "sol_moon", type: "moon", faction: "Soyuz Orbital Group", description: "Luna-side crew transfer hub. Russian-built, international crew. Soyuz ferries dock here daily.", services: ["refuel", "markets", "shipyard"] },
  { id: "base_luna_4", name: "Sakura Gardens Habitat", bodyId: "sol_moon", type: "moon", faction: "Hayabusa Heavy Industries", description: "Pressurised crater habitat with hydroponic gardens. Low-g food production for Earth orbital markets.", services: ["markets", "contracts"] },

  // Sol — Mars
  { id: "base_mars_3", name: "Kasei Valley Industrial Zone", bodyId: "sol_mars", type: "planetary", faction: "Hayabusa Heavy Industries", description: "Mars-side fabrication campus. Hayabusa's primary hull assembly line. Composite weaving and nano-forging.", services: ["repair", "markets", "shipyard"] },
  { id: "base_mars_4", name: "Liberty Landing Strip", bodyId: "sol_mars", type: "planetary", faction: "Liberty Dynamics", description: "Equatorial runway complex for Liberty landers. Surface-to-orbit cargo link for Mars colonies.", services: ["repair", "refuel", "shipyard"] },

  // Sol — Venus
  { id: "base_venus_2", name: "Venera Drift Station", bodyId: "sol_venus", type: "orbital", faction: "Zvezda Shipbuilding", description: "Russian aerostat research platform. Studies Venusian super-rotation. Zvezda tests new alloys in the corrosive atmosphere.", services: ["refuel", "contracts"] },

  // Sol — Io
  { id: "base_io_1", name: "Pioneer Geothermal Tap", bodyId: "sol_io", type: "moon", faction: "United Sol Directorate", description: "Geothermal station tapping Io's volcanic flux to power the Jovian relay network. Constant seismic tremors.", services: ["refuel"] },

  // Sol — Jupiter (Japanese)
  { id: "base_jupiter_1", name: "Kibo Radiation Lab", bodyId: "sol_jupiter", type: "orbital", faction: "Nakamura Drive Works", description: "Jovian magnetosphere research station. Studies high-radiation belt for Nakamura drive shielding.", services: ["contracts"] },

  // Sol — Titan
  { id: "base_titan_2", name: "Lomonosov Cryo-Lab", bodyId: "sol_titan", type: "moon", faction: "Zvezda Shipbuilding", description: "Russian cryogenic research station in Titan's northern basin. Tests hull materials at 94 K.", services: ["refuel", "markets"] },

  // Sol — Iapetus
  { id: "base_iapetus_1", name: "Kagami Ridge Observatory", bodyId: "sol_iapetus", type: "moon", faction: "Nakamura Drive Works", description: "Optical observatory on Iapetus's equatorial ridge. Ultra-clear vacuum. Minimal light pollution.", services: ["contracts"] },

  // Kuiper Belt / Fringe
  { id: "base_kuiper_1", name: "Arktika Frontier Station", bodyId: "", type: "deep_space", faction: "Gromov Design Bureau", description: "Gromov's trans-Neptunian test range. Cold-rated engine trials and long-duration crew isolation studies.", services: ["refuel"] },
  { id: "base_fringe_1", name: "Unity Landing Zone", bodyId: "", type: "deep_space", faction: "Terran Unity Shipyards", description: "Forward expeditionary staging base. Pre-fabricated hexagonal hab modules assembled by the first fleet tender.", services: ["repair", "refuel", "markets", "shipyard"] },
  { id: "base_fringe_2", name: "The Anvil", bodyId: "", type: "deep_space", faction: "Terran Unity Shipyards", description: "Deep-space forge station. Processes raw asteroids into hull plates on site. No civilian traffic allowed.", services: ["repair", "shipyard"] },
];

// ─── Space Stations ──────────────────────────────────────────────────────────

export interface SpaceStation {
  id: string;
  name: string;
  orbitBodyId: string;
  type: "orbital" | "asteroid" | "deep_space" | "shipyard" | "research";
  faction: string;
  description: string;
  services: string[];
}

export const SPACE_STATIONS: SpaceStation[] = [
  { id: "station_earth_low", name: "Orbital Tether One", orbitBodyId: "sol_earth", type: "orbital", faction: "United Sol Directorate", description: "Earth's primary orbital hub at geosync altitude. Every major shipping line has a berth here.", services: ["repair", "refuel", "markets", "contracts", "shipyard", "shipyard"] },
  { id: "station_earth_mid", name: "Armstrong Station", orbitBodyId: "sol_earth", type: "orbital", faction: "United Sol Directorate", description: "Legacy deep-space dock from the first orbital construction era. Museum wing on deck 7.", services: ["refuel", "markets", "shipyard"] },
  { id: "station_mars_phobos", name: "Phobos Drydock", orbitBodyId: "sol_mars", type: "orbital", faction: "Mars Colonial Authority", description: "High-capacity shipyard anchored to Phobos orbit. Core Dynamics retrofit bay on the lower ring.", services: ["repair", "refuel", "shipyard", "contracts"] },
  { id: "station_ganymede", name: "Ganymede Logistics Hub", orbitBodyId: "sol_ganymede", type: "orbital", faction: "Jovian Economic Zone", description: "Jupiter's primary cargo transfer station. Thousands of containers cycle through daily.", services: ["repair", "refuel", "markets", "contracts"] },
  { id: "station_titan", name: "Titan Float Station", orbitBodyId: "sol_titan", type: "orbital", faction: "Saturnine Hydrocarbon Board", description: "Aerostat mooring platform above Titan's haze layer. Primary hydrocarbon export hub.", services: ["refuel", "markets"] },
  { id: "station_uranus", name: "Titania Relay", orbitBodyId: "sol_uranus", type: "orbital", faction: "United Sol Directorate", description: "Deep-space communications relay and waypoint for outer-system traffic.", services: ["refuel"] },
  { id: "station_neptune", name: "Triton Frontier Port", orbitBodyId: "sol_neptune", type: "orbital", faction: "Neptune Outer-System Authority", description: "The last major port before the Kuiper Belt. A refuel point for deep-range explorers.", services: ["refuel", "repair", "markets", "contracts"] },
  { id: "station_pluto", name: "Charon Gate", orbitBodyId: "sol_pluto", type: "orbital", faction: "Kuiper Frontier Collective", description: "Binary-system transit portal. Independent-aligned and lightly regulated. Anything goes past Charon.", services: ["refuel", "markets", "contracts", "shipyard"] },
  { id: "station_belt_capricorn", name: "Capricorn Station", orbitBodyId: "sol_ceres", type: "asteroid", faction: "Belt Miners Syndicate", description: "Hollowed M-type asteroid at the belt's inner edge. Mining guild administrative centre.", services: ["repair", "refuel", "markets", "contracts"] },
  { id: "station_belt_lyra", name: "Lyra Freeport", orbitBodyId: "sol_vesta", type: "asteroid", faction: "Independent Belt Alliance", description: "Unofficial free-trade zone in the belt. No scans, no tariffs, no questions.", services: ["refuel", "markets", "contracts"] },
  { id: "station_alpha_primary", name: "New Hope Station", orbitBodyId: "star_alphacent", type: "orbital", faction: "Alpha Centauri Administration", description: "Extra-solar humanity's first permanent station. Orbiting Alpha Centauri A's habitable zone inner edge.", services: ["repair", "refuel", "markets", "shipyard", "contracts"] },
  { id: "station_sirius_industrial", name: "Sirius Industrial Platform", orbitBodyId: "star_sirius", type: "orbital", faction: "Sirius Corporation", description: "Massive industrial processing station near Sirius A. Processes belt ore into finished alloys.", services: ["repair", "refuel", "markets"] },
  { id: "station_sirius_research", name: "Sirius Science Ring", orbitBodyId: "star_sirius", type: "research", faction: "Sirius Corporation", description: "Toroidal research habitat. Known for quantum material studies and classified biotech.", services: ["refuel", "contracts"] },
  { id: "station_l_lyrae_free", name: "Wolf Freeport", orbitBodyId: "", type: "deep_space", faction: "Independent Belt Alliance", description: "Deep-space freeport at a Lagrangian point. Rumoured to have an unregistered shipyard.", services: ["refuel", "markets", "contracts", "shipyard"] },

  // Russian-style stations
  { id: "station_mir2", name: "Mir-2 Commercial Hub", orbitBodyId: "sol_earth", type: "orbital", faction: "Soyuz Orbital Group", description: "Evolution of the original Mir program. Now a multi-ring commercial station with Russian, Japanese, and USD sectors.", services: ["refuel", "markets", "contracts"] },
  { id: "station_zarya", name: "Zarya Outbound Gate", orbitBodyId: "sol_luna", type: "orbital", faction: "Zvezda Shipbuilding", description: "Luna-side departure node for outer-system traffic. Zvezda operates the main refit bay here.", services: ["refuel", "repair", "markets"] },
  { id: "station_vostok", name: "Vostok Transfer Station", orbitBodyId: "sol_mars", type: "orbital", faction: "Gromov Design Bureau", description: "Martian high-orbit transfer point. Connects surface landers to interplanetary traffic via rotating hub.", services: ["refuel", "markets", "shipyard"] },

  // Japanese-style stations
  { id: "station_kaguya", name: "Kaguya Orbital Port", orbitBodyId: "sol_luna", type: "orbital", faction: "Hayabusa Heavy Industries", description: "Luna's most efficient cargo station. Japanese automated sorting systems process containers in seconds.", services: ["refuel", "markets", "contracts", "shipyard"] },
  { id: "station_zenith", name: "Zenith Research Platform", orbitBodyId: "star_alphacent", type: "research", faction: "Nakamura Drive Works", description: "Alpha Centauri's premier zero-g lab. Nakamura runs long-duration drive tests in the adjacent solar wind tunnel.", services: ["refuel", "contracts"] },

  // US space program inspired
  { id: "station_liberty", name: "Liberty Orbital Assembly", orbitBodyId: "sol_earth", type: "shipyard", faction: "Liberty Dynamics", description: "Earth orbit's largest shipyard. Liberty Dynamics builds planetary landers and tugs in its twelve construction bays.", services: ["repair", "refuel", "shipyard", "contracts"] },
  { id: "station_pioneer", name: "Pioneer Navigation Beacon", orbitBodyId: "", type: "deep_space", faction: "Odyssey Works", description: "Deep-space navigation waypoint and emergency shelter. Deployed by Odyssey Works along the most travelled interstellar routes.", services: ["refuel"] },
  { id: "station_odyssey", name: "Odyssey Mission Control", orbitBodyId: "sol_luna", type: "research", faction: "Odyssey Works", description: "Lunar farside mission control for deep-space assets. Houses the golden record archive vault.", services: ["refuel", "contracts"] },

  // Warhammer 30k-inspired (pre-Star-Crusade expeditionary)
  { id: "station_unity", name: "Unity Fleet Anchorage", orbitBodyId: "", type: "deep_space", faction: "Terran Unity Shipyards", description: "Deep-space fleet assembly point. A ring of tethered habitats surrounding a central command spire. Expeditionary fleets form up here.", services: ["repair", "refuel", "shipyard", "contracts"] },
  { id: "station_crusade", name: "Crusade Supply Depot", orbitBodyId: "star_sirius", type: "orbital", faction: "Terran Unity Shipyards", description: "Sirius-side logistics hub for Terran Unity. Massive container banks and fuel bladders support fleet movements towards the fringe.", services: ["refuel", "markets", "shipyard"] },
  { id: "station_terra_gate", name: "Terra Gate Station", orbitBodyId: "sol_earth", type: "orbital", faction: "United Sol Directorate", description: "High-security gateway station regulating all interstellar traffic leaving Sol. Customs, quarantine, and fleet registry.", services: ["refuel", "markets", "contracts"] },
];

// ─── Independent Traders (NPC names) ─────────────────────────────────────────

export interface Trader {
  name: string;
  callsign: string;
  shipModelId: string;
  reputation: "friendly" | "neutral" | "hostile" | "unknown";
  preferredRoutes: string[];
  hailPhrase: string;
}

export const TRADERS: Trader[] = [
  { name: "Elena Volkov", callsign: "Dust Runner", shipModelId: "ship_cobra", reputation: "friendly", preferredRoutes: ["Earth — Mars", "Earth — Ceres"], hailPhrase: "Dust Runner to traffic control. Hauling machinery to Mars orbit. Nothing special today." },
  { name: "Idris Banu", callsign: "Silk Road", shipModelId: "ship_type6", reputation: "neutral", preferredRoutes: ["Ceres — Jupiter", "Mars — Venus"], hailPhrase: "Silk Road requesting lane priority. Cargo: processed metals. Standard manifest filed with USD." },
  { name: "Mei-Lin Cheng", callsign: "Jade Tiger", shipModelId: "ship_python", reputation: "friendly", preferredRoutes: ["Sol — Alpha Centauri", "Sol — Sirius"], hailPhrase: "Jade Tiger inbound from Alpha Centauri. Running luxury goods. Gutamaya parts manifest. Open for inspection." },
  { name: "Oleg Stoyanov", callsign: "Bear Claw", shipModelId: "ship_t9", reputation: "neutral", preferredRoutes: ["Jupiter — Earth", "Belt — Inner Planets"], hailPhrase: "Bear Claw heavy, full hold. Thrust to decel is already calculated. Do not make me recalc." },
  { name: "Sofia Reyes", callsign: "North Star", shipModelId: "ship_addeer", reputation: "friendly", preferredRoutes: ["Ceres — Belt outposts", "Titan — Neptune"], hailPhrase: "North Star here. Small cargo, cold route. Just passing through the outer lanes." },
  { name: "Kaelen Vance", callsign: "Ghost Freight", shipModelId: "ship_keelback", reputation: "unknown", preferredRoutes: ["Sol — Unknown", "Fringe — Fringe"], hailPhrase: "Ghost Freight. No manifest. No scan request. Just passing." },

  // Russian traders
  { name: "Dmitri Voronov", callsign: "Siberian Star", shipModelId: "ship_cobra", reputation: "friendly", preferredRoutes: ["Ceres — Titan", "Earth — Mars"], hailPhrase: "Siberian Star on the Mars run. Hauling vodka. Actually, liquid electronics coolant. Very expensive." },
  { name: "Nadia Petrova", callsign: "Zarya Runner", shipModelId: "ship_type6", reputation: "neutral", preferredRoutes: ["Venus — Earth", "Jupiter — Saturn"], hailPhrase: "Zarya Runner inbound. Cargo: processed gases from Venera platform. Manifests attached." },
  { name: "Alexei Morozov", callsign: "Yakutsk", shipModelId: "ship_kosmos", reputation: "friendly", preferredRoutes: ["Belt — Fringe", "Kuiper — Inner"], hailPhrase: "Yakutsk coming in from the cold. Probe data from beyond 60 AU. Who wants first look?" },

  // Japanese traders
  { name: "Yuki Tanaka", callsign: "Rising Sun", shipModelId: "ship_hayabusa", reputation: "friendly", preferredRoutes: ["Earth — Alpha Centauri", "Luna — Mars"], hailPhrase: "Rising Sun on approach. Precision alloys and optical components. Nakamura-certified." },
  { name: "Takeshi Mori", callsign: "Kumo Freight", shipModelId: "ship_kaguya", reputation: "neutral", preferredRoutes: ["Mars — Ceres", "Jupiter — Belt"], hailPhrase: "Kumo Freight. Cargo: food modules and water recyclers for Kasei Valley. Schedule is tight." },

  // Independent fringe trader
  { name: "Zara Orlov", callsign: "Broken Compass", shipModelId: "ship_junkyard", reputation: "unknown", preferredRoutes: ["Fringe — Fringe", "Unknown"], hailPhrase: "Broken Compass. I got salvage, I got data, I got fuel. What do you need? Name your price." },
];

// ─── Refuelers ───────────────────────────────────────────────────────────────

export interface Refueler {
  id: string;
  name: string;
  operator: string;
  serviceArea: string;
  fuelTypes: string[];
  hailPhrase: string;
}

export const REFUELERS: Refueler[] = [
  { id: "refuel_std_1", name: "Metis Fuel Service", operator: "Jovian Economic Zone", serviceArea: "Jupiter — Saturn", fuelTypes: ["hydrogen", "he3"], hailPhrase: "Metis Fuel Service on station at Jovian L2. Tanker rig is hot. Approach vector attached." },
  { id: "refuel_std_2", name: "Belt Tanker Co-op", operator: "Belt Miners Syndicate", serviceArea: "Ceres — Asteroid Belt", fuelTypes: ["hydrogen"], hailPhrase: "Belt Tanker Co-op, three units available at Ceres beacon. All fuel filtered and metered." },
  { id: "refuel_std_3", name: "Heron Cryo-Fuel", operator: "Saturnine Hydrocarbon Board", serviceArea: "Saturn — Titan orbit", fuelTypes: ["methane", "hydrogen"], hailPhrase: "Heron Cryo-Fuel anchored at Titan L1. Methane processing active. Cold transfer only." },
  { id: "refuel_std_4", name: "Polaris Fuel-Cache", operator: "Neptune Outer-System Authority", serviceArea: "Uranus — Neptune — Kuiper", fuelTypes: ["hydrogen", "he3"], hailPhrase: "Polaris Cache buoy at Triton approach. Pre-paid fuel pods available. Lock code on channel 9." },
  { id: "refuel_ind_1", name: "Wayfarer Depot", operator: "Independent Belt Alliance", serviceArea: "Fringe systems", fuelTypes: ["hydrogen", "synth-fusion"], hailPhrase: "Wayfarer Depot this side of the beacon. Fuel's a bit hot but it burns. No questions asked." },
  { id: "refuel_mobile_1", name: "Nomad Tanker", operator: "Nebula Refit Collective", serviceArea: "Mobile — anywhere", fuelTypes: ["hydrogen"], hailPhrase: "Nomad Tanker drifting at these coordinates. Readings show you're low. Heel up and hail back." },

  // Russian refuelers
  { id: "refuel_ru_1", name: "Volga Fuel Service", operator: "Zvezda Shipbuilding", serviceArea: "Earth — Mars corridor", fuelTypes: ["hydrogen", "he3"], hailPhrase: "Volga Fuel Service at Earth-Mars L1. Dedicated tanker station. Comrades get discount." },
  { id: "refuel_ru_2", name: "Siberia Cryo-Tanker", operator: "Gromov Design Bureau", serviceArea: "Belt — Jupiter belt crossing", fuelTypes: ["hydrogen", "methane"], hailPhrase: "Siberia Cryo-Tanker at Ceres beacon. Cold hydrogen, cold prices. Pay in ore or credits." },
  { id: "refuel_ru_3", name: "Ural Depot", operator: "Soyuz Orbital Group", serviceArea: "Mars — Venus transit lane", fuelTypes: ["hydrogen"], hailPhrase: "Ural Depot anchoring in transfer orbit. My tank is your tank, as they say. Come alongside." },

  // Japanese refuelers
  { id: "refuel_jp_1", name: "Yamato Fuel Consortium", operator: "Hayabusa Heavy Industries", serviceArea: "Luna — Earth — Alpha Centauri", fuelTypes: ["hydrogen", "he3"], hailPhrase: "Yamato Fuel Consortium at Luna L1. Filtered hydrogen, premium He3, and complimentary green tea in the waiting lounge." },
  { id: "refuel_jp_2", name: "Tsukuba Resupply Co.", operator: "Nakamura Drive Works", serviceArea: "Alpha Centauri — Sol route", fuelTypes: ["hydrogen"], hailPhrase: "Tsukuba Resupply at the Alpha Centauri beacon. Precision metered fuel transfers. No impurities guaranteed." },

  // US/historical refueler
  { id: "refuel_us_1", name: "Liberty Tanker Fleet", operator: "Liberty Dynamics", serviceArea: "Mars — Earth — Venus triangle", fuelTypes: ["hydrogen", "he3", "synth-fusion"], hailPhrase: "Liberty Tanker on station. Three fuel grades available. All Liberty stock passes NATO-2098 purity standards." },
];

// ─── Bandits / Pirates ───────────────────────────────────────────────────────

export interface Bandit {
  id: string;
  name: string;
  callsign: string;
  shipModelId: string;
  threatLevel: "low" | "medium" | "high" | "extreme";
  territory: string;
  motivation: "loot" | "territory" | "ransom" | "revenge" | "anarchy";
  hailPhrase: string;
}

export const BANDITS: Bandit[] = [
  { id: "bandit_belt_1", name: "Riko Vance", callsign: "Belt Reaper", shipModelId: "ship_eagle", threatLevel: "low", territory: "Asteroid Belt — Ceres approach", motivation: "loot", hailPhrase: "Belt Reaper here. You're in my claim lane. Drop 8 tons of ore and you can pass." },
  { id: "bandit_belt_2", name: "Suka Fire-Eye", callsign: "Red Talon", shipModelId: "ship_viper", threatLevel: "medium", territory: "Inner Belt — Mars transfer corridor", motivation: "loot", hailPhrase: "Red Talon to unidentified trader. Cut thrust and prep cargo transfer. I have missiles on your drive cone." },
  { id: "bandit_gas_1", name: "Jorge Salt", callsign: "Gas Eater", shipModelId: "ship_cobra", threatLevel: "medium", territory: "Jupiter — Saturn fuel lanes", motivation: "territory", hailPhrase: "Gas Eater owns this route. Any tanker refuels here pays the scoop tax. That's 30%." },
  { id: "bandit_outer_1", name: "Voss", callsign: "Nightingale", shipModelId: "ship_python", threatLevel: "high", territory: "Uranus — Neptune deep lanes", motivation: "ransom", hailPhrase: "Nightingale has you on passive track. One distress call and I blow your comms array. He3 or your hull." },
  { id: "bandit_fringe_1", name: "Korr", callsign: "Dead Signal", shipModelId: "ship_dropship", threatLevel: "high", territory: "Alpha Centauri approach — interstellar buffer", motivation: "loot", hailPhrase: "Dead Signal. You're outside the patrol envelope. Nobody hears you. Jettison cargo and warp out." },
  { id: "bandit_anarch_1", name: "Maraxis", callsign: "Black Gate", shipModelId: "ship_anaconda", threatLevel: "extreme", territory: "Unknown — appears anywhere", motivation: "anarchy", hailPhrase: "Black Gate to all channels. I don't want your cargo. I want you to watch your canopy crack." },
  { id: "bandit_belt_3", name: "Lena Croft", callsign: "Rust Claw", shipModelId: "ship_hauler", threatLevel: "low", territory: "Ceres — Lyra Freeport route", motivation: "loot", hailPhrase: "Rust Claw. You know the drill. Half your ore or I pop your cargo hatch." },
  { id: "bandit_outlaw_1", name: "Dante Kross", callsign: "Iron Tide", shipModelId: "ship_gunship", threatLevel: "extreme", territory: "Sol inner system — Earth to Mars", motivation: "revenge", hailPhrase: "Iron Tide. Security forces at Mars already know. After I am done with you they will not find enough to scan." },

  // Russian bandits
  { id: "bandit_belt_4", name: "Sergei Razin", callsign: "Vory", shipModelId: "ship_molniya", threatLevel: "medium", territory: "Belt — Ceres to Earth transit", motivation: "loot", hailPhrase: "Vory patrul. Ty v nashikh vodakh. Pay the transit tax or we take the whole hold. Your choice." },
  { id: "bandit_outer_2", name: "Viktor Kuznetsov", callsign: "Siberian Ghost", shipModelId: "ship_buran", threatLevel: "high", territory: "Saturn — Neptune deep lanes", motivation: "ransom", hailPhrase: "Siberian Ghost. We have been tracking you since Titan. Your fuel is low. Our patience is lower. He3 now." },
  { id: "bandit_belt_5", name: "Katya Volkova", callsign: "Snow Leopard", shipModelId: "ship_viper", threatLevel: "medium", territory: "Earth — Mars corridor", motivation: "loot", hailPhrase: "Snow Leopard to target. Pulled your cargo manifest from the station network. That He3 load? It's mine now." },

  // Japanese-inspired bandits (Ronin style)
  { id: "bandit_fringe_2", name: "Kenji Kurosawa", callsign: "Ronin", shipModelId: "ship_akatsuki", threatLevel: "medium", territory: "Alpha Centauri — Sol route", motivation: "revenge", hailPhrase: "Ronin. I have no faction. No master. No mercy. Your cargo is my fee. Cut thrust." },
  { id: "bandit_belt_6", name: "Miki Fujimoto", callsign: "Red Komainu", shipModelId: "ship_eagle", threatLevel: "low", territory: "Belt — Ceres approach", motivation: "loot", hailPhrase: "Red Komainu. This is my claim sector. Leave 5 tons or I report your transponder to the Syndicate." },

  // US space program / fringe inspired
  { id: "bandit_fringe_3", name: "Cora Mitchell", callsign: "Rogue Probe", shipModelId: "ship_horizon", threatLevel: "high", territory: "Unknown — deep space", motivation: "anarchy", hailPhrase: "Rogue Probe. Your ship has data I want. I can crack your nav computer from here. Transmit your logs or I erase them." },
  { id: "bandit_outer_3", name: "Jack Stone", callsign: "Heavy Hand", shipModelId: "ship_t9", threatLevel: "medium", territory: "Mars — Jupiter belt crossing", motivation: "loot", hailPhrase: "Heavy Hand. This is a heavily armed freighter, not a warship. Do not let the cargo hold fool you. Drop 10 tons." },

  // Warhammer 30k inspired (expeditionary gone rogue — a disbanded fleet element)
  { id: "bandit_fringe_4", name: "Castellan", callsign: "Expeditionary", shipModelId: "ship_crusader", threatLevel: "extreme", territory: "Fringe — deep interstellar", motivation: "territory", hailPhrase: "Expeditionary. We were left behind by the fleet. Now this sector is our claim. Turn back or be recycled for parts." },
  { id: "bandit_anarch_2", name: "The Herald", callsign: "Herald", shipModelId: "ship_excelsior", threatLevel: "extreme", territory: "Unknown — appears in fringe systems", motivation: "anarchy", hailPhrase: "Herald. I bring word from the dark between stars. Your transgression is noted. Prepare for judgement." },
];
