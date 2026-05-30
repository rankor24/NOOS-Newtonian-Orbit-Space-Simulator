from __future__ import annotations

import json
import math
import pathlib
import time
import urllib.parse
import urllib.request

ROOT = pathlib.Path.cwd()
CANDIDATE_PATH = ROOT / "src" / "data" / "generated" / "sol-small-body-candidates.ts"
OUT_PATH = ROOT / "src" / "data" / "generated" / "sol-small-bodies.ts"

SBDB_BASE = "https://ssd-api.jpl.nasa.gov/sbdb.api"
AU = 1.496e11
DAY_SEC = 86400
G = 6.6743e-11

TARGETS = [
    "Ceres", "Vesta", "Pallas", "Hygiea",
    "Eris", "Haumea", "Makemake", "Orcus", "Quaoar", "Sedna",
]

BODY_META = {
    "Ceres": {"id": "sol_ceres", "type": "dwarfPlanet", "color": "#78716c", "hasMarket": True, "stationName": "Dawn City Hub"},
    "Vesta": {"id": "sol_vesta", "type": "asteroid", "color": "#9a8c7c", "hasMarket": False},
    "Pallas": {"id": "sol_pallas", "type": "asteroid", "color": "#94a3b8", "hasMarket": False},
    "Hygiea": {"id": "sol_hygiea", "type": "asteroid", "color": "#84a98c", "hasMarket": False},
    "Eris": {"id": "sol_eris", "type": "dwarfPlanet", "color": "#bfdbfe", "hasMarket": False},
    "Haumea": {"id": "sol_haumea", "type": "dwarfPlanet", "color": "#e0f2fe", "hasMarket": False},
    "Makemake": {"id": "sol_makemake", "type": "dwarfPlanet", "color": "#fed7aa", "hasMarket": False},
    "Orcus": {"id": "sol_orcus", "type": "dwarfPlanet", "color": "#cbd5e1", "hasMarket": False},
    "Quaoar": {"id": "sol_quaoar", "type": "dwarfPlanet", "color": "#93c5fd", "hasMarket": False},
    "Sedna": {"id": "sol_sedna", "type": "dwarfPlanet", "color": "#fda4af", "hasMarket": False},
}


def load_candidates() -> list[dict]:
    text = CANDIDATE_PATH.read_text(encoding="utf8")
    prefix = "export const SOL_SMALL_BODY_CANDIDATES = "
    suffix = " as const;\n"
    if not text.startswith(prefix):
        raise RuntimeError("Candidate file format changed")
    payload = text[len(prefix):]
    if payload.endswith(suffix):
        payload = payload[:-len(suffix)]
    data = json.loads(payload)
    return data["candidates"]


def fetch_sbdb(candidate: dict) -> dict:
    query = candidate.get("name") or candidate.get("pdes") or candidate.get("spkid")
    url = f"{SBDB_BASE}?{urllib.parse.urlencode({'sstr': query})}"
    with urllib.request.urlopen(url, timeout=20) as response:
        payload = json.loads(response.read().decode("utf8"))
    if "object" not in payload or "orbit" not in payload:
        raise RuntimeError(f"No SBDB result for {candidate['name']}")
    return payload


def f(value):
    if value in (None, ""):
        return None
    try:
        return float(value)
    except Exception:
        return None


def build_body(name: str, candidate: dict, sbdb: dict) -> dict:
    meta = BODY_META[name]
    orbit_elements = {item.get('name'): item.get('value') for item in sbdb.get('orbit', {}).get('elements', [])}
    obj = sbdb.get('object', {})
    diameter_km = candidate.get("diameterKm")
    radius_m = diameter_km * 500 if diameter_km is not None else None
    gm = None
    mass = gm / G if gm is not None else None
    semi_major_axis_m = (f(orbit_elements.get("a")) or 0.0) * AU
    period_s = (f(orbit_elements.get("per")) or candidate.get("periodDays") or 0.0) * DAY_SEC
    inclination = math.radians(f(orbit_elements.get("i")) or 0.0)
    node = math.radians(f(orbit_elements.get("om")) or 0.0)
    peri = math.radians(f(orbit_elements.get("w")) or 0.0)
    mean_anomaly = math.radians(f(orbit_elements.get("ma")) or 0.0)

    return {
        "id": meta["id"],
        "name": name,
        "type": meta["type"],
        "mass": mass,
        "gm": gm,
        "radius": radius_m,
        "radiusEstimate": gm is None and radius_m is not None,
        "massEstimate": False,
        "gravitySource": mass is not None,
        "color": meta["color"],
        "parentId": "star_sol",
        "description": f"{name} imported from Atlas shortlist and enriched from JPL SBDB.",
        "hasMarket": meta.get("hasMarket", False),
        "stationName": meta.get("stationName"),
        "source": "Atlas shortlist + JPL SBDB API",
        "epoch": str(sbdb.get("orbit", {}).get("epoch") or "sbdb-api"),
        "semiMajorAxis": semi_major_axis_m,
        "eccentricity": f(orbit_elements.get("e")) or 0.0,
        "orbitalPeriod": period_s,
        "inclination": inclination,
        "longitudeOfAscendingNode": node,
        "argumentOfPeriapsis": peri,
        "meanAnomalyAtEpoch": mean_anomaly,
        "sbdbClass": ((obj.get("orbit_class") or {}).get("code")) or candidate.get("class"),
    }


def main() -> None:
    candidates = load_candidates()
    candidates_by_name = {item["name"]: item for item in candidates}
    bodies = []
    for name in TARGETS:
        candidate = candidates_by_name.get(name)
        if not candidate:
            raise RuntimeError(f"Missing candidate for {name}")
        sbdb = fetch_sbdb(candidate)
        bodies.append(build_body(name, candidate, sbdb))
        time.sleep(0.15)

    content = 'import { CelestialBody } from "../../types";\n\nexport const SOL_SMALL_BODIES_GENERATED: (CelestialBody & { sbdbClass?: string | null })[] = ' + json.dumps(bodies, indent=2) + ';\n'
    OUT_PATH.write_text(content, encoding="utf8")
    print(f"Wrote {len(bodies)} runtime small bodies to {OUT_PATH}")
    print(json.dumps([{k: b[k] for k in ['name','type','mass','radius','semiMajorAxis']} for b in bodies], indent=2))


if __name__ == "__main__":
    main()
