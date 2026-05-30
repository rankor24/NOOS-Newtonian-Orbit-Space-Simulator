#!/usr/bin/env python3
import argparse
import csv
import json
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a compact nearby-stars JSON subset from hyg_v42.csv"
    )
    parser.add_argument(
        "--input",
        default="hyg_v42.csv",
        help="Path to HYG CSV file relative to repo root",
    )
    parser.add_argument(
        "--output",
        default="src/data/generated/hyg-stars-near-sol-50ly.json",
        help="Output JSON path relative to repo root",
    )
    parser.add_argument(
        "--max-distance-ly",
        type=float,
        default=50.0,
        help="Maximum distance from Sol in light years",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Optional max number of stars to keep after sorting by distance (0 = no limit)",
    )
    return parser.parse_args()


def to_float(value: str, default: float = 0.0) -> float:
    if value is None:
        return default
    value = value.strip()
    if value == "":
        return default
    try:
        return float(value)
    except ValueError:
        return default


def clean_name(row: dict[str, str]) -> str:
    for key in ("proper", "bf", "gl", "hd", "hip"):
        raw = (row.get(key) or "").strip()
        if raw:
            if key in {"hd", "hip"}:
                return f"{key.upper()} {raw}"
            return raw
    return f"HYG {row['id']}"


def spectral_class(spect: str) -> str:
    spect = (spect or "").strip().upper()
    if not spect:
        return "Unknown"
    lead = spect[0]
    return lead if lead in {"O", "B", "A", "F", "G", "K", "M"} else "Unknown"


def main() -> int:
    args = parse_args()
    repo_root = Path(__file__).resolve().parent.parent
    input_path = repo_root / args.input
    output_path = repo_root / args.output

    stars: list[dict] = []
    with input_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            dist = to_float(row.get("dist", ""), default=-1.0)
            if dist < 0 or dist > args.max_distance_ly:
                continue

            x = to_float(row.get("x", ""))
            y = to_float(row.get("y", ""))
            z = to_float(row.get("z", ""))
            mag = to_float(row.get("mag", ""), default=99.0)
            absmag = to_float(row.get("absmag", ""), default=99.0)
            ci = to_float(row.get("ci", ""), default=0.0)
            spect = (row.get("spect") or "").strip()
            proper = (row.get("proper") or "").strip()

            if row.get("id") == "0" or proper.lower() == "sol":
                star_id = "star_sol"
            else:
                star_id = f"hyg_{row['id']}"

            stars.append(
                {
                    "id": star_id,
                    "hygId": int(row["id"]),
                    "name": clean_name(row),
                    "properName": proper or None,
                    "distanceLy": round(dist, 4),
                    "x": round(x, 4),
                    "y": round(y, 4),
                    "z": round(z, 4),
                    "magnitude": round(mag, 4),
                    "absoluteMagnitude": round(absmag, 4),
                    "spectralType": spect or None,
                    "spectralClass": spectral_class(spect),
                    "colorIndex": round(ci, 4),
                    "hasKnownName": bool(proper),
                }
            )

    stars.sort(key=lambda item: (item["distanceLy"], item["magnitude"], item["name"]))
    if args.limit > 0:
        stars = stars[: args.limit]

    payload = {
        "source": input_path.name,
        "generatedBy": "scripts/build_hyg_subset.py",
        "maxDistanceLy": args.max_distance_ly,
        "count": len(stars),
        "notes": [
            "This is a compact navigational subset for galaxy-map use, not a full-physics simulation dataset.",
            "Coordinates are relative to Sol in light years, based on HYG v4.2 columns x/y/z.",
            "Use this for scanner range, map rendering, and star selection. Generate full planetary systems lazily.",
        ],
        "stars": stars,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    print(f"Wrote {len(stars)} stars to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
