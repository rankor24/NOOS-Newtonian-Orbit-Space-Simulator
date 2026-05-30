import { SystemFeature } from "../../types";

export const SOL_SYSTEM_FEATURES_METADATA = {
  "generatedAt": "2026-05-27T17:00:18Z",
  "notes": [
    "Ring radii are aggregate gameplay envelopes, not full sub-ring catalogs.",
    "Belts/clouds are render-only density regions and do not contribute gravity.",
    "Numeric ranges follow the scientific checklist sources and current curated approximations."
  ]
} as const;

export const SOL_SYSTEM_FEATURES: SystemFeature[] = [
  {
    "id": "sol_main_asteroid_belt",
    "name": "Main Asteroid Belt",
    "type": "belt",
    "parentId": null,
    "innerRadius": 314160000000.0,
    "outerRadius": 493680000000.0,
    "color": "#78716c",
    "opacity": 0.12,
    "labelColor": "rgba(231,229,228,0.8)",
    "description": "Primary asteroid concentration between Mars and Jupiter. Visual density field only; not per-object gravity.",
    "source": "NASA asteroid belt facts + Atlas class distribution (generated static density field)"
  },
  {
    "id": "sol_jupiter_rings",
    "name": "Jupiter Rings",
    "type": "ring",
    "parentId": "sol_jupiter",
    "innerRadius": 92000000.0,
    "outerRadius": 226000000.0,
    "color": "#fbbf24",
    "opacity": 0.1,
    "labelColor": "rgba(251,191,36,0.78)",
    "description": "Faint Jovian dust ring system: halo, main ring, Amalthea gossamer, Thebe gossamer.",
    "source": "NASA Jupiter facts page ring summary (approximate aggregate radii)"
  },
  {
    "id": "sol_jupiter_trojans",
    "name": "Jupiter Trojan Swarms",
    "type": "belt",
    "parentId": "sol_jupiter",
    "innerRadius": 107712000000.0,
    "outerRadius": 146608000000.0,
    "color": "#92400e",
    "opacity": 0.08,
    "labelColor": "rgba(251,191,36,0.7)",
    "description": "Approximate co-orbital Trojan swarm band around Jupiter's orbital distance.",
    "source": "Atlas TJN class distribution (render-only approximation)"
  },
  {
    "id": "sol_saturn_rings",
    "name": "Saturn Rings",
    "type": "ring",
    "parentId": "sol_saturn",
    "innerRadius": 67000000.0,
    "outerRadius": 282000000.0,
    "color": "#fef3c7",
    "opacity": 0.2,
    "labelColor": "rgba(254,240,138,0.8)",
    "description": "Aggregate Saturn ring envelope covering the bright main system plus faint outer structures.",
    "source": "NASA Saturn facts page (~282,000 km extent for main system; aggregate visual envelope)"
  },
  {
    "id": "sol_uranus_rings",
    "name": "Uranus Rings",
    "type": "ring",
    "parentId": "sol_uranus",
    "innerRadius": 38000000.0,
    "outerRadius": 103000000.0,
    "color": "#a5f3fc",
    "opacity": 0.16,
    "labelColor": "rgba(165,243,252,0.8)",
    "description": "Aggregate Uranian ring zone covering the narrow main rings and faint outer mu/nu rings.",
    "source": "NASA Uranus facts page ring summary (approximate aggregate radii)"
  },
  {
    "id": "sol_neptune_rings",
    "name": "Neptune Rings",
    "type": "ring",
    "parentId": "sol_neptune",
    "innerRadius": 42000000.0,
    "outerRadius": 63000000.0,
    "color": "#93c5fd",
    "opacity": 0.14,
    "labelColor": "rgba(147,197,253,0.8)",
    "description": "Aggregate Neptunian ring arcs and ring-zone envelope.",
    "source": "NASA Neptune facts page ring summary (approximate aggregate radii)"
  },
  {
    "id": "sol_kuiper_belt",
    "name": "Kuiper Belt",
    "type": "belt",
    "parentId": null,
    "innerRadius": 4488000000000.0,
    "outerRadius": 7480000000000.0,
    "color": "#1d4ed8",
    "opacity": 0.08,
    "labelColor": "rgba(147,197,253,0.8)",
    "description": "Trans-Neptunian small-body belt beyond Neptune. Visual density field only.",
    "source": "NASA Kuiper Belt facts"
  },
  {
    "id": "sol_scattered_disk",
    "name": "Scattered Disk",
    "type": "cloud",
    "parentId": null,
    "innerRadius": 7480000000000.0,
    "outerRadius": 149600000000000.0,
    "color": "#3730a3",
    "opacity": 0.045,
    "labelColor": "rgba(165,180,252,0.65)",
    "description": "Sparse dynamically hot outer small-body region overlapping the Kuiper Belt outer edge.",
    "source": "NASA Kuiper Belt facts (scattered disk continues to nearly 1,000 AU)"
  },
  {
    "id": "sol_oort_cloud_inner",
    "name": "Inner Oort Cloud",
    "type": "cloud",
    "parentId": null,
    "innerRadius": 299200000000000.0,
    "outerRadius": 2992000000000000.0,
    "color": "#334155",
    "opacity": 0.025,
    "labelColor": "rgba(148,163,184,0.65)",
    "description": "Very approximate inner Oort Cloud visualization envelope. Theoretical population, not directly observed object list.",
    "source": "NASA Oort Cloud facts"
  },
  {
    "id": "sol_oort_cloud_outer",
    "name": "Outer Oort Cloud",
    "type": "cloud",
    "parentId": null,
    "innerRadius": 2992000000000000.0,
    "outerRadius": 1.496e+16,
    "color": "#475569",
    "opacity": 0.015,
    "labelColor": "rgba(148,163,184,0.5)",
    "description": "Far outer theoretical comet reservoir shell. Render-only label field, no per-object simulation.",
    "source": "NASA Oort Cloud facts"
  }
];
