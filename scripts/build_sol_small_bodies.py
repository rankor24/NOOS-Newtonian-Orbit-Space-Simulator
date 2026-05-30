from __future__ import annotations

import argparse
import csv
import json
import math
import pathlib
import time
import urllib.parse
import urllib.request
from collections import defaultdict

ROOT = pathlib.Path.cwd()
ATLAS_ROOT = pathlib.Path(r"C:\Users\Boris\Code\asteroids_atlas_of_space-main")
ASTEROIDS_CSV = ATLAS_ROOT / "data" / "all_asteroids_wrangled.csv"
COMETS_CSV = ATLAS_ROOT / "data" / "all_comets_wrangled.csv"
OUT_PATH = ROOT / "src" / "data" / "generated" / "sol-small-body-candidates.ts"

SBDB_BASE = "https://ssd-api.jpl.nasa.gov/sbdb_query.api"
SBDB_FIELDS = ["spkid", "full_name", "pdes", "name", "diameter", "GM", "e", "a", "q", "i", "om", "w", "ma", "per", "epoch", "class"]

CLASS_LIMITS = {
    "MBA": 120,
    "IMB": 60,
    "OMB": 60,
    "TJN": 100,
    "TNO": 220,
    "CEN": 100,
    "APO": 80,
    "AMO": 60,
    "ATE": 30,
    "MCA": 40,
}

REQUIRED_NAMES = {
    "Ceres", "Vesta", "Pallas", "Hygiea",
    "Eris", "Haumea", "Makemake", "Orcus", "Quaoar", "Sedna", "Arrokoth",
}

REQUIRED_COMETS = {"Halley", "Hale-Bopp", "Encke", "Hyakutake"}


def parse_float(value: str | None) -> float | None:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def normalize_name(row: dict[str, str]) -> str:
    return (row.get("name") or row.get("full_name") or row.get("pdes") or "").strip()


def score_row(row: dict[str, str]) -> tuple[int, float, int]:
    name = normalize_name(row)
    named = 1 if row.get("name") else 0
    required = 1 if name in REQUIRED_NAMES else 0
    diameter = parse_float(row.get("diameter")) or -1.0
    return (required, diameter, named)


def load_ranked_asteroid_candidates() -> tuple[list[dict], dict]:
    buckets: dict[str, list[dict]] = defaultdict(list)
    stats = {
        "rows": 0,
        "selected": 0,
        "byClass": {},
    }

    with ASTEROIDS_CSV.open("r", encoding="utf8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            stats["rows"] += 1
            body_class = (row.get("class") or "").strip()
            if body_class not in CLASS_LIMITS:
                continue
            name = normalize_name(row)
            diameter = parse_float(row.get("diameter"))
            if not name and diameter is None:
                continue
            if body_class == "TNO" and not (name or diameter):
                continue
            buckets[body_class].append(row)

    selected: list[dict] = []
    by_class: dict[str, int] = {}
    for body_class, limit in CLASS_LIMITS.items():
        ranked = sorted(buckets.get(body_class, []), key=score_row, reverse=True)
        picked = ranked[:limit]
        by_class[body_class] = len(picked)
        selected.extend(picked)

    required_map = {}
    for row in selected:
        required_map[normalize_name(row)] = row

    if len(required_map) < len(REQUIRED_NAMES):
        with ASTEROIDS_CSV.open("r", encoding="utf8", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                name = normalize_name(row)
                if name in REQUIRED_NAMES and name not in required_map:
                    selected.append(row)
                    required_map[name] = row

    deduped = []
    seen = set()
    for row in selected:
        key = (row.get("spkid") or row.get("pdes") or row.get("full_name") or "").strip()
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(row)

    stats["selected"] = len(deduped)
    stats["byClass"] = by_class
    return deduped, stats


def load_ranked_comet_candidates(limit: int = 40) -> tuple[list[dict], dict]:
    rows = []
    stats = {"rows": 0, "selected": 0}
    with COMETS_CSV.open("r", encoding="utf8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            stats["rows"] += 1
            rows.append(row)

    def comet_score(row: dict[str, str]) -> tuple[int, float, int]:
        name = normalize_name(row)
        required = 1 if any(token.lower() in name.lower() for token in REQUIRED_COMETS) else 0
        diameter = parse_float(row.get("diameter")) or -1.0
        named = 1 if row.get("name") else 0
        return (required, diameter, named)

    ranked = sorted(rows, key=comet_score, reverse=True)
    picked = ranked[:limit]
    stats["selected"] = len(picked)
    return picked, stats


def row_to_candidate(row: dict[str, str], body_kind: str) -> dict:
    name = normalize_name(row)
    return {
        "bodyKind": body_kind,
        "name": name,
        "fullName": (row.get("full_name") or "").strip() or name,
        "spkid": (row.get("spkid") or "").strip() or None,
        "pdes": (row.get("pdes") or "").strip() or None,
        "class": (row.get("class") or "").strip() or None,
        "diameterKm": parse_float(row.get("diameter")),
        "perihelionAU": parse_float(row.get("q")),
        "periodDays": parse_float(row.get("per")),
        "named": bool(row.get("name")),
        "source": f"Atlas {body_kind} shortlist candidate",
    }


def fetch_sbdb_for_candidate(candidate: dict) -> dict | None:
    params = {
        "fields": ",".join(SBDB_FIELDS),
        "limit": "1",
    }
    if candidate.get("spkid"):
        params["sb-ns"] = "spkid"
        params["sstr"] = candidate["spkid"]
    elif candidate.get("pdes"):
        params["sb-ns"] = "pdes"
        params["sstr"] = candidate["pdes"]
    else:
        params["sb-ns"] = "name"
        params["sstr"] = candidate["name"]

    url = f"{SBDB_BASE}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=20) as response:
        payload = json.loads(response.read().decode("utf8"))
    rows = payload.get("data") or []
    fields = payload.get("fields") or []
    if not rows:
        return None
    values = rows[0]
    return {field: values[idx] if idx < len(values) else None for idx, field in enumerate(fields)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fetch-sbdb", action="store_true", help="Fetch live SBDB rows for shortlisted candidates")
    parser.add_argument("--fetch-limit", type=int, default=24, help="How many shortlisted objects to enrich live from SBDB")
    args = parser.parse_args()

    asteroid_rows, asteroid_stats = load_ranked_asteroid_candidates()
    comet_rows, comet_stats = load_ranked_comet_candidates()

    asteroid_candidates = [row_to_candidate(row, "asteroid") for row in asteroid_rows]
    comet_candidates = [row_to_candidate(row, "comet") for row in comet_rows]
    candidates = asteroid_candidates + comet_candidates

    sbdb_samples = []
    if args.fetch_sbdb:
        for candidate in candidates[: args.fetch_limit]:
            try:
                sbdb = fetch_sbdb_for_candidate(candidate)
            except Exception as exc:
                sbdb = {"error": str(exc)}
            sbdb_samples.append({
                "name": candidate["name"],
                "class": candidate.get("class"),
                "sbdb": sbdb,
            })
            time.sleep(0.15)

    output = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "atlasSources": {
            "asteroids": str(ASTEROIDS_CSV),
            "comets": str(COMETS_CSV),
        },
        "selectionRules": {
            "classLimits": CLASS_LIMITS,
            "requiredNames": sorted(REQUIRED_NAMES),
            "requiredComets": sorted(REQUIRED_COMETS),
        },
        "stats": {
            "asteroids": asteroid_stats,
            "comets": comet_stats,
            "totalCandidates": len(candidates),
        },
        "candidates": candidates,
        "sbdbSamples": sbdb_samples,
    }

    content = "export const SOL_SMALL_BODY_CANDIDATES = " + json.dumps(output, indent=2) + " as const;\n"
    OUT_PATH.write_text(content, encoding="utf8")

    print(f"Wrote {len(candidates)} candidates to {OUT_PATH}")
    print(json.dumps(output["stats"], indent=2))


if __name__ == "__main__":
    main()
