"""Build compact narrative context datasets from downloaded official sources."""

from __future__ import annotations

import csv
from collections import defaultdict
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
RAW = PROJECT_ROOT / "data" / "pacific-climate-fingerprints" / "raw"
DATA = PROJECT_ROOT / "assets" / "data" / "pacific-climate-fingerprints"


def parse_oni() -> dict[int, dict[str, object]]:
    by_year: dict[int, list[tuple[str, float]]] = defaultdict(list)
    with (RAW / "noaa_oni.ascii.txt").open(encoding="utf-8") as source:
        for line in source:
            fields = line.split()
            if len(fields) != 4 or not fields[1].isdigit():
                continue
            season, year, _, anomaly = fields
            by_year[int(year)].append((season, float(anomaly)))

    output: dict[int, dict[str, object]] = {}
    for year, values in by_year.items():
        mean = sum(value for _, value in values) / len(values)
        peak_season, peak = max(values, key=lambda item: abs(item[1]))
        phase = "El Niño" if mean >= 0.5 else "La Niña" if mean <= -0.5 else "Neutral / mixed"
        output[year] = {
            "oni_mean": round(mean, 2),
            "oni_peak": round(peak, 2),
            "oni_peak_season": peak_season,
            "enso_phase": phase,
            "oni_seasons": len(values),
        }
    return output


def parse_co2() -> dict[int, dict[str, float]]:
    output: dict[int, dict[str, float]] = {}
    with (RAW / "noaa_co2_annmean_mlo.txt").open(encoding="utf-8") as source:
        for line in source:
            if line.startswith("#") or not line.strip():
                continue
            year, mean, uncertainty = line.split()[:3]
            output[int(year)] = {
                "co2_ppm": float(mean),
                "co2_uncertainty": float(uncertainty),
            }
    return output


def write_global_context() -> None:
    oni = parse_oni()
    co2 = parse_co2()
    years = sorted(set(oni) | set(co2))
    fields = [
        "year",
        "co2_ppm",
        "co2_uncertainty",
        "oni_mean",
        "oni_peak",
        "oni_peak_season",
        "enso_phase",
        "oni_seasons",
    ]
    with (DATA / "global_context.csv").open("w", newline="", encoding="utf-8") as target:
        writer = csv.DictWriter(target, fieldnames=fields)
        writer.writeheader()
        for year in years:
            writer.writerow({"year": year, **co2.get(year, {}), **oni.get(year, {})})


def read_csv_index(path: Path) -> dict[tuple[str, int], dict[str, str]]:
    output: dict[tuple[str, int], dict[str, str]] = {}
    with path.open(encoding="utf-8-sig") as source:
        for row in csv.DictReader(source):
            if not row.get("GEO_PICT") or not row.get("TIME_PERIOD"):
                continue
            output[(row["GEO_PICT"], int(row["TIME_PERIOD"]))] = row
    return output


def write_territory_context() -> None:
    population = read_csv_index(RAW / "27_DF_NMDI_POP_A_NMDI0001_T_T_T_T_Z.csv")
    stations = read_csv_index(RAW / "24_DF_CLIMATE_CHANGE_A_METEO_MONITOR_NET_.csv")
    station_latest: dict[str, tuple[int, float]] = {}
    for (code, year), row in stations.items():
        if row.get("OBS_VALUE") and (code not in station_latest or year > station_latest[code][0]):
            station_latest[code] = (year, float(row["OBS_VALUE"]))

    fields = [
        "code",
        "year",
        "population",
        "population_status",
        "station_count_latest",
        "station_year_latest",
    ]
    with (DATA / "territory_context.csv").open("w", newline="", encoding="utf-8") as target:
        writer = csv.DictWriter(target, fieldnames=fields)
        writer.writeheader()
        for key in sorted(population):
            code, year = key
            pop_row = population[key]
            station_year, station_count = station_latest.get(code, ("", ""))
            writer.writerow({
                "code": code,
                "year": year,
                "population": pop_row.get("OBS_VALUE", ""),
                "population_status": pop_row.get("OBS_STATUS", ""),
                "station_count_latest": station_count,
                "station_year_latest": station_year,
            })


if __name__ == "__main__":
    DATA.mkdir(exist_ok=True)
    write_global_context()
    write_territory_context()
    print("Wrote assets/data/pacific-climate-fingerprints/global_context.csv and territory_context.csv")
