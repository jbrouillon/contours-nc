pacman::p_load(tidyverse,sf)

source("sst_warming.r",encoding = "utf8")
source("st_warming.r",encoding = "utf8")
source("rainfall.r",encoding = "utf8")


climate_obs <- bind_rows(
  sst |>
    transmute(
      GEO_PICT,
      signal = "sea",
      TIME_PERIOD = as.numeric(TIME_PERIOD),
      OBS_VALUE = as.numeric(OBS_VALUE)
    ),
  st |>
    transmute(
      GEO_PICT,
      signal = "land",
      TIME_PERIOD = as.numeric(TIME_PERIOD),
      OBS_VALUE = as.numeric(OBS_VALUE)
    ),
  rain |>
    transmute(
      GEO_PICT,
      signal = "rain",
      TIME_PERIOD = as.numeric(TIME_PERIOD),
      OBS_VALUE = as.numeric(OBS_VALUE)
    )
)

write_csv(climate_obs, "climate_obs.csv")
write_csv(climate_obs, "climate_obs.csv")

pacific_islands <- read_sf("geospatial/Pacific islands region land area.geojson")
