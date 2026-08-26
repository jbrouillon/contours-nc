# Build the climate tables used by Pacific Climate Fingerprints ----------------

library(readr)
library(dplyr)
library(purrr)

script_arg <- grep("^--file=", commandArgs(trailingOnly = FALSE), value = TRUE)
if (length(script_arg) != 1) {
  stop("Run this script with Rscript.")
}

script_path <- normalizePath(
  sub("^--file=", "", script_arg[[1]]),
  winslash = "/",
  mustWork = TRUE
)
project_root <- normalizePath(
  file.path(dirname(script_path), "..", ".."),
  winslash = "/",
  mustWork = TRUE
)
raw_dir <- file.path(project_root, "data", "pacific-climate-fingerprints", "raw")
public_output_dir <- file.path(project_root, "assets", "data", "pacific-climate-fingerprints")
processed_output_dir <- file.path(project_root, "data", "pacific-climate-fingerprints", "processed")
dir.create(public_output_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(processed_output_dir, recursive = TRUE, showWarnings = FALSE)

degree_c <- paste0(intToUtf8(176), "C")

sources <- tribble(
  ~file, ~indicator, ~label, ~unit, ~multiplier, ~legacy_signal,
  "09_DF_CLIMATE_CHANGE_A_SST_ANOM_.csv", "ocean", "Sea-surface temperature anomaly", degree_c, 1, "sea",
  "10_DF_CLIMATE_CHANGE_A_ST_ANOM_.csv", "land", "Land-surface temperature anomaly", degree_c, 1, "land",
  "11_DF_CLIMATE_CHANGE_A_RAIN_ANOM_.csv", "rain", "Annual rainfall anomaly", "mm", 1, "rain",
  "13_DF_CLIMATE_CHANGE_A_SEA_LVL_.csv", "sea_level", "Sea-level anomaly", "cm", 100, NA_character_
)

read_source <- function(file) {
  read_csv(file.path(raw_dir, file), show_col_types = FALSE)
}

climate_obs <- pmap_dfr(
  filter(sources, !is.na(legacy_signal)),
  function(file, indicator, label, unit, multiplier, legacy_signal) {
    read_source(file) |>
      transmute(
        GEO_PICT,
        signal = legacy_signal,
        TIME_PERIOD = as.numeric(TIME_PERIOD),
        OBS_VALUE = as.numeric(OBS_VALUE)
      )
  }
)

climate_interactive <- pmap_dfr(
  sources,
  function(file, indicator, label, unit, multiplier, legacy_signal) {
    read_source(file) |>
      transmute(
        code = GEO_PICT,
        indicator = indicator,
        year = as.integer(TIME_PERIOD),
        value = as.numeric(OBS_VALUE) * multiplier,
        standard_error = if_else(
          ERROR_TYPE == "SE",
          as.numeric(ERROR_VAL) * abs(multiplier),
          NA_real_
        )
      )
  }
) |>
  filter(!is.na(code), !is.na(year), !is.na(value)) |>
  arrange(indicator, code, year)

write_csv(climate_obs, file.path(processed_output_dir, "climate_obs.csv"))
write_csv(
  climate_interactive,
  file.path(public_output_dir, "climate_interactive.csv"),
  na = ""
)

message("Wrote processed climate_obs.csv to ", processed_output_dir)
message("Wrote browser-ready climate_interactive.csv to ", public_output_dir)
