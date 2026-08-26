# Data sources

- Pacific climate anomalies: Pacific Data Hub, `DF_CLIMATE_CHANGE` (SPC), annual territory-level series.
- Rainfall storytelling keeps the source's reported standard error. “Clearly wetter” and “clearly drier” mean that the annual anomaly lies more than two reported standard errors from zero; observations inside that band are shown as near the reference.
- The globe contains 21 EEZ polygons. Pitcairn (`PN`) has a climate series and appears in the 22-territory ribbon atlas, but it has no polygon in the supplied map geometry.
- Population size and growth: Pacific Data Hub, `DF_NMDI_POP` (SPC), indicators `NMDI0001` and `NMDI0002`. Population values are projections/estimates where marked by the source.
- Meteorological monitoring network: Pacific Data Hub, `DF_CLIMATE_CHANGE`, indicator `METEO_MONITOR_NET`.
- Oceanic Niño Index: NOAA Climate Prediction Center, seasonal three-month ONI values. The interface uses the arithmetic mean of the available seasonal values for each calendar year as narrative context; this is not a replacement for NOAA's operational event classification.
- Atmospheric CO₂: NOAA Global Monitoring Laboratory, annual mean at Mauna Loa, expressed in ppm.

Rebuild the climate tables with `scripts/pacific-climate-fingerprints/prepare_climate_data.R`.
Refresh the external context data with `scripts/pacific-climate-fingerprints/refresh-context-data.ps1`, then render the Quarto page.
