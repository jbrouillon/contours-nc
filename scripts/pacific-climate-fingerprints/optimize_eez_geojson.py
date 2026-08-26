"""Simplify the browser EEZ layer without changing its visible map shape.

The default tolerance (0.02 degree) stays well below one screen pixel on the
900 px-wide Pacific map. Coordinates are rounded after simplification to make
the asset substantially smaller and more compressible.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INPUT = PROJECT_ROOT / "assets" / "data" / "pacific-climate-fingerprints" / "eez.geojson"


def point_segment_distance(point: list[float], start: list[float], end: list[float]) -> float:
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    if dx == 0 and dy == 0:
        return math.hypot(point[0] - start[0], point[1] - start[1])
    position = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy)
    position = max(0.0, min(1.0, position))
    nearest_x = start[0] + position * dx
    nearest_y = start[1] + position * dy
    return math.hypot(point[0] - nearest_x, point[1] - nearest_y)


def rdp(points: list[list[float]], tolerance: float) -> list[list[float]]:
    if len(points) <= 2:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        start_index, end_index = stack.pop()
        furthest_index = -1
        furthest_distance = tolerance
        for index in range(start_index + 1, end_index):
            distance = point_segment_distance(points[index], points[start_index], points[end_index])
            if distance > furthest_distance:
                furthest_index = index
                furthest_distance = distance
        if furthest_index >= 0:
            keep[furthest_index] = True
            stack.append((start_index, furthest_index))
            stack.append((furthest_index, end_index))
    return [point for point, retained in zip(points, keep) if retained]


def circular_arc(points: list[list[float]], start: int, end: int) -> list[list[float]]:
    if start <= end:
        return points[start : end + 1]
    return points[start:] + points[: end + 1]


def clean_ring(points: list[list[float]], precision: int) -> list[list[float]]:
    rounded: list[list[float]] = []
    for point in points:
        candidate = [round(point[0], precision), round(point[1], precision)]
        if not rounded or candidate != rounded[-1]:
            rounded.append(candidate)
    if rounded and rounded[0] != rounded[-1]:
        rounded.append(rounded[0])
    return rounded


def simplify_ring(ring: list[list[float]], tolerance: float, precision: int) -> list[list[float]]:
    points = ring[:-1] if len(ring) > 1 and ring[0] == ring[-1] else ring[:]
    if len(points) < 5:
        return clean_ring(points, precision)

    first_anchor = max(
        range(1, len(points)),
        key=lambda index: (points[index][0] - points[0][0]) ** 2 + (points[index][1] - points[0][1]) ** 2,
    )
    second_anchor = max(
        range(len(points)),
        key=lambda index: (
            (points[index][0] - points[first_anchor][0]) ** 2
            + (points[index][1] - points[first_anchor][1]) ** 2
        ),
    )
    first_arc = rdp(circular_arc(points, first_anchor, second_anchor), tolerance)
    second_arc = rdp(circular_arc(points, second_anchor, first_anchor), tolerance)
    simplified = first_arc + second_arc[1:-1]
    cleaned = clean_ring(simplified, precision)
    return cleaned if len(cleaned) >= 4 else clean_ring(points, precision)


def point_count(value: object) -> int:
    if isinstance(value, list):
        if len(value) >= 2 and isinstance(value[0], (int, float)):
            return 1
        return sum(point_count(item) for item in value)
    return 0


def simplify_geometry(geometry: dict, tolerance: float, precision: int) -> dict:
    if geometry.get("type") == "Polygon":
        coordinates = [simplify_ring(ring, tolerance, precision) for ring in geometry["coordinates"]]
    elif geometry.get("type") == "MultiPolygon":
        coordinates = [
            [simplify_ring(ring, tolerance, precision) for ring in polygon]
            for polygon in geometry["coordinates"]
        ]
    else:
        raise ValueError(f"Unsupported geometry: {geometry.get('type')}")
    return {"type": geometry["type"], "coordinates": coordinates}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--tolerance", type=float, default=0.02)
    parser.add_argument("--precision", type=int, default=4)
    args = parser.parse_args()

    source = json.loads(args.input.read_text(encoding="utf-8"))
    signature = {"tolerance": args.tolerance, "precision": args.precision}
    output = args.output or args.input
    if source.get("contoursOptimization") == signature:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(source, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"EEZ already optimized with tolerance {args.tolerance} and precision {args.precision}")
        print(f"Wrote {output} ({output.stat().st_size / 1024:.1f} KB)")
        return

    before_points = sum(point_count(feature["geometry"]["coordinates"]) for feature in source["features"])
    optimized = {
        "type": "FeatureCollection",
        "contoursOptimization": signature,
        "features": [
            {
                "type": "Feature",
                "properties": {"country": feature["properties"]["country"]},
                "geometry": simplify_geometry(feature["geometry"], args.tolerance, args.precision),
            }
            for feature in source["features"]
        ],
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(optimized, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    after_points = sum(point_count(feature["geometry"]["coordinates"]) for feature in optimized["features"])
    print(f"EEZ points: {before_points:,} -> {after_points:,}")
    print(f"Wrote {output} ({output.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
