# Pacific Climate Fingerprints

The `raw/` directory contains the source downloads used to prepare the Pacific
Climate Fingerprints visualisation. Intermediate outputs live in `processed/`;
browser-ready data are published from `assets/data/pacific-climate-fingerprints/`.

- `scripts/pacific-climate-fingerprints/prepare_climate_data.R` rebuilds the
  climate observations from source files 09, 10, 11 and 13.
- `scripts/pacific-climate-fingerprints/prepare_context_data.py` rebuilds the
  global and territory context tables.
- `scripts/pacific-climate-fingerprints/refresh-context-data.ps1` refreshes the
  NOAA series and the Pacific Data Hub population series before rebuilding the
  context tables.
- `scripts/pacific-climate-fingerprints/download_official_datasets.R` rebuilds
  the official-link inventory and refreshes the challenge downloads.
- `scripts/pacific-climate-fingerprints/optimize_eez_geojson.py` simplifies and
  rounds the browser EEZ layer at a tolerance below one map pixel. Run it after
  replacing the public EEZ source; its optimization signature prevents repeated
  simplification.

The `metadata/` directory contains the source-link inventory and summary tables.
The browser EEZ layer is published in optimized form as
`assets/data/pacific-climate-fingerprints/eez.geojson`. Other unique spatial
sources remain in `raw/geospatial/`; the very large land-area source is kept
locally but ignored by Git because it is not used by the published visualisation.

Files 16 through 21 currently contain the error response returned by the source
API ("Could not find Dataflow..."). They are retained as provenance only and are
not used by the visualisation.

Files 06 and 08 are byte-identical because two challenge links request the same
disaggregated agricultural-production dataset. Both names are retained so the
numbered downloads continue to match `official_datasets_links.csv`.
