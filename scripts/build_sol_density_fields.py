from __future__ import annotations

import json
import pathlib
import time

ROOT = pathlib.Path.cwd()
OUT_PATH = ROOT / "src" / "data" / "generated" / "sol-features.ts"
AU = 1.496e11
KM = 1000.0

FEATURES = [
    {
        "id": "sol_main_asteroid_belt",
        "name": "Main Asteroid Belt",
        "type": "belt",
        "parentId": None,
        "innerRadius": 2.1 * AU,
        "outerRadius": 3.3 * AU,
        "color": "#78716c",
        "opacity": 0.12,
        "labelColor": "rgba(231,229,228,0.8)",
        "description": "Primary asteroid concentration between Mars and Jupiter. Visual density field only; not per-object gravity.",
        "source": "NASA asteroid belt facts + Atlas class distribution (generated static density field)",
    },
    {
        "id": "sol_jupiter_rings",
        "name": "Jupiter Rings",
        "type": "ring",
        "parentId": "sol_jupiter",
        "innerRadius": 92_000 * KM,
        "outerRadius": 226_000 * KM,
        "color": "#fbbf24",
        "opacity": 0.1,
        "labelColor": "rgba(251,191,36,0.78)",
        "description": "Faint Jovian dust ring system: halo, main ring, Amalthea gossamer, Thebe gossamer.",
        "source": "NASA Jupiter facts page ring summary (approximate aggregate radii)",
    },
    {
        "id": "sol_jupiter_trojans",
        "name": "Jupiter Trojan Swarms",
        "type": "belt",
        "parentId": "sol_jupiter",
        "innerRadius": 0.72 * AU,
        "outerRadius": 0.98 * AU,
        "color": "#92400e",
        "opacity": 0.08,
        "labelColor": "rgba(251,191,36,0.7)",
        "description": "Approximate co-orbital Trojan swarm band around Jupiter's orbital distance.",
        "source": "Atlas TJN class distribution (render-only approximation)",
    },
    {
        "id": "sol_saturn_rings",
        "name": "Saturn Rings",
        "type": "ring",
        "parentId": "sol_saturn",
        "innerRadius": 67_000 * KM,
        "outerRadius": 282_000 * KM,
        "color": "#fef3c7",
        "opacity": 0.2,
        "labelColor": "rgba(254,240,138,0.8)",
        "description": "Aggregate Saturn ring envelope covering the bright main system plus faint outer structures.",
        "source": "NASA Saturn facts page (~282,000 km extent for main system; aggregate visual envelope)",
    },
    {
        "id": "sol_uranus_rings",
        "name": "Uranus Rings",
        "type": "ring",
        "parentId": "sol_uranus",
        "innerRadius": 38_000 * KM,
        "outerRadius": 103_000 * KM,
        "color": "#a5f3fc",
        "opacity": 0.16,
        "labelColor": "rgba(165,243,252,0.8)",
        "description": "Aggregate Uranian ring zone covering the narrow main rings and faint outer mu/nu rings.",
        "source": "NASA Uranus facts page ring summary (approximate aggregate radii)",
    },
    {
        "id": "sol_neptune_rings",
        "name": "Neptune Rings",
        "type": "ring",
        "parentId": "sol_neptune",
        "innerRadius": 42_000 * KM,
        "outerRadius": 63_000 * KM,
        "color": "#93c5fd",
        "opacity": 0.14,
        "labelColor": "rgba(147,197,253,0.8)",
        "description": "Aggregate Neptunian ring arcs and ring-zone envelope.",
        "source": "NASA Neptune facts page ring summary (approximate aggregate radii)",
    },
    {
        "id": "sol_kuiper_belt",
        "name": "Kuiper Belt",
        "type": "belt",
        "parentId": None,
        "innerRadius": 30 * AU,
        "outerRadius": 50 * AU,
        "color": "#1d4ed8",
        "opacity": 0.08,
        "labelColor": "rgba(147,197,253,0.8)",
        "description": "Trans-Neptunian small-body belt beyond Neptune. Visual density field only.",
        "source": "NASA Kuiper Belt facts",
    },
    {
        "id": "sol_scattered_disk",
        "name": "Scattered Disk",
        "type": "cloud",
        "parentId": None,
        "innerRadius": 50 * AU,
        "outerRadius": 1_000 * AU,
        "color": "#3730a3",
        "opacity": 0.045,
        "labelColor": "rgba(165,180,252,0.65)",
        "description": "Sparse dynamically hot outer small-body region overlapping the Kuiper Belt outer edge.",
        "source": "NASA Kuiper Belt facts (scattered disk continues to nearly 1,000 AU)",
    },
    {
        "id": "sol_oort_cloud_inner",
        "name": "Inner Oort Cloud",
        "type": "cloud",
        "parentId": None,
        "innerRadius": 2_000 * AU,
        "outerRadius": 20_000 * AU,
        "color": "#334155",
        "opacity": 0.025,
        "labelColor": "rgba(148,163,184,0.65)",
        "description": "Very approximate inner Oort Cloud visualization envelope. Theoretical population, not directly observed object list.",
        "source": "NASA Oort Cloud facts",
    },
    {
        "id": "sol_oort_cloud_outer",
        "name": "Outer Oort Cloud",
        "type": "cloud",
        "parentId": None,
        "innerRadius": 20_000 * AU,
        "outerRadius": 100_000 * AU,
        "color": "#475569",
        "opacity": 0.015,
        "labelColor": "rgba(148,163,184,0.5)",
        "description": "Far outer theoretical comet reservoir shell. Render-only label field, no per-object simulation.",
        "source": "NASA Oort Cloud facts",
    },
]


def main() -> None:
    metadata = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "notes": [
            "Ring radii are aggregate gameplay envelopes, not full sub-ring catalogs.",
            "Belts/clouds are render-only density regions and do not contribute gravity.",
            "Numeric ranges follow the scientific checklist sources and current curated approximations.",
        ],
    }

    content = (
        'import { SystemFeature } from "../../types";\n\n'
        f"export const SOL_SYSTEM_FEATURES_METADATA = {json.dumps(metadata, indent=2)} as const;\n\n"
        f"export const SOL_SYSTEM_FEATURES: SystemFeature[] = {json.dumps(FEATURES, indent=2)};\n"
    )
    OUT_PATH.write_text(content, encoding="utf8")
    print(f"Wrote {len(FEATURES)} system features to {OUT_PATH}")


if __name__ == "__main__":
    main()
