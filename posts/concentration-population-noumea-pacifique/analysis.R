library(dplyr)
library(gt)
library(htmltools)
library(jsonlite)
library(purrr)
library(readxl)
library(scales)
library(sf)
library(tidyr)

article_input <- knitr::current_input(dir = TRUE)
if (is.null(article_input)) {
  article_input <- file.path(getwd(), "posts", "concentration-population-noumea-pacifique", "index.qmd")
}

project_dir <- normalizePath(file.path(dirname(article_input), "..", ".."), winslash = "/", mustWork = TRUE)
data_path <- function(...) file.path(project_dir, "data", ...)
image_path <- function(...) file.path(project_dir, "images", ...)

pop_xls_path <- data_path("population", "rp-population_0.xls")
internal_migration_xls_path <- data_path("population", "rp-migrations-internes.xls")
external_migration_xls_path <- data_path("population", "rp-migrations-externes.xls")
origin_xls_path <- data_path("population", "rp-population-origine_0.xls")
evolution_xlsx_path <- data_path("population", "evolution-population_0.xlsx")
births_xlsx_path <- data_path("population", "natalite-fecondite.xlsx")
deaths_xlsx_path <- data_path("population", "mortalite-esperance-de-vie.xlsx")
work_commune_xlsx_path <- data_path("population", "rp-commune-travail.xlsx")
communes_geojson_path <- data_path("02_geospatial", "vecteurs", "nc_communes_simp.geojson")

required_files <- c(
  population = pop_xls_path,
  migrations_internes = internal_migration_xls_path,
  migrations_externes = external_migration_xls_path,
  origine = origin_xls_path,
  evolution = evolution_xlsx_path,
  natalite = births_xlsx_path,
  mortalite = deaths_xlsx_path,
  commune_travail = work_commune_xlsx_path,
  communes = communes_geojson_path
)

missing_files <- required_files[!file.exists(required_files)]
if (length(missing_files) > 0) {
  stop("Fichiers manquants :\n", paste(missing_files, collapse = "\n"))
}

fmt_int <- function(x) {
  number(x, accuracy = 1, decimal.mark = ",", big.mark = " ")
}

fmt_num <- function(x, digits = 1) {
  number(x, accuracy = 10^-digits, decimal.mark = ",", big.mark = " ")
}

fmt_pct <- function(x, digits = 1) {
  paste0(fmt_num(x, digits), " %")
}

fmt_pp <- function(x, digits = 1) {
  paste0(ifelse(x > 0, "+", ""), fmt_num(x, digits), " pt")
}

clean_population <- function(x) {
  x <- as.character(x)
  out <- rep(NA_real_, length(x))
  ok <- !is.na(x) & !grepl("^\\s*(NS|N/A)", x, ignore.case = TRUE)
  values <- gsub("\\s*\\([^)]*\\)", "", x[ok])
  values <- gsub("[^0-9]", "", values)
  out[ok] <- suppressWarnings(as.numeric(values))
  out
}

clean_number <- function(x) {
  x <- as.character(x)
  x <- trimws(x)
  x[x %in% c("", "-", "nd", "nd.", "NS", "N/A")] <- NA_character_
  x <- gsub("\\s", "", x)
  x <- gsub(",", ".", x, fixed = TRUE)
  suppressWarnings(as.numeric(x))
}

normalize_key <- function(x) {
  x |>
    iconv(from = "", to = "ASCII//TRANSLIT") |>
    toupper() |>
    gsub("[^A-Z0-9]", "", x = _)
}

pop_raw <- read_excel(
  pop_xls_path,
  sheet = "commune et province",
  col_names = FALSE,
  col_types = rep("text", 15)
)

years <- as.integer(unlist(pop_raw[6, 2:12], use.names = FALSE))

population_long <- pop_raw[7:43, 1:12] |>
  setNames(c("territoire", years)) |>
  pivot_longer(
    -territoire,
    names_to = "annee",
    values_to = "population_raw"
  ) |>
  mutate(
    annee = as.integer(annee),
    population = clean_population(population_raw),
    type = case_when(
      territoire == "Nouvelle-Calédonie" ~ "total",
      territoire %in% c("Province des îles Loyauté", "Province Nord", "Province Sud") ~ "province",
      TRUE ~ "commune"
    ),
    territoire_key = normalize_key(territoire)
  )

communes_2019 <- population_long |>
  filter(type == "commune", annee == 2019) |>
  arrange(desc(population))

grand_noumea_communes <- c("Nouméa", "Dumbéa", "Mont-Dore", "Païta")
hors_grand_noumea <- population_long |>
  filter(type == "commune", !territoire %in% grand_noumea_communes)

zone_series <- population_long |>
  mutate(
    zone = case_when(
      territoire == "Nouvelle-Calédonie" ~ "Nouvelle-Calédonie",
      territoire == "Province Sud" ~ "Province Sud",
      territoire == "Nouméa" ~ "Nouméa",
      territoire %in% c("Dumbéa", "Mont-Dore", "Païta") ~ "Couronne périurbaine",
      type == "commune" ~ "Reste des communes",
      TRUE ~ NA_character_
    )
  ) |>
  filter(!is.na(zone)) |>
  group_by(zone, annee) |>
  summarise(population = sum(population, na.rm = TRUE), .groups = "drop") |>
  bind_rows(
    population_long |>
      filter(territoire %in% grand_noumea_communes) |>
      group_by(annee) |>
      summarise(population = sum(population, na.rm = TRUE), .groups = "drop") |>
      mutate(zone = "Grand Nouméa")
  )

total_series <- zone_series |>
  filter(zone == "Nouvelle-Calédonie") |>
  select(annee, total = population)

zone_series <- zone_series |>
  left_join(total_series, by = "annee") |>
  mutate(part = 100 * population / total)

zone_colors <- c(
  "Nouméa" = "#c54832",
  "Couronne périurbaine" = "#d6a21f",
  "Grand Nouméa" = "#2f6b45",
  "Province Sud" = "#2f6f8f",
  "Reste des communes" = "#7a8c8d"
)

share_series <- zone_series |>
  filter(zone %in% c("Nouméa", "Couronne périurbaine", "Grand Nouméa", "Province Sud")) |>
  transmute(
    annee,
    serie = zone,
    valeur = part,
    population,
    couleur = unname(zone_colors[zone])
  )

population_series <- zone_series |>
  filter(zone %in% c("Nouméa", "Couronne périurbaine", "Reste des communes")) |>
  transmute(
    annee,
    serie = zone,
    valeur = population,
    couleur = unname(zone_colors[zone])
  )

latest_total <- total_series |> filter(annee == 2019) |> pull(total)
noumea_1956 <- zone_series |> filter(zone == "Nouméa", annee == 1956) |> slice(1)
noumea_2019 <- zone_series |> filter(zone == "Nouméa", annee == 2019) |> slice(1)
grand_noumea_1956 <- zone_series |> filter(zone == "Grand Nouméa", annee == 1956) |> slice(1)
grand_noumea_2019 <- zone_series |> filter(zone == "Grand Nouméa", annee == 2019) |> slice(1)
province_sud_2019 <- zone_series |> filter(zone == "Province Sud", annee == 2019) |> slice(1)
couronne_2019 <- zone_series |> filter(zone == "Couronne périurbaine", annee == 2019) |> slice(1)
hors_gn_2019 <- zone_series |> filter(zone == "Reste des communes", annee == 2019) |> slice(1)

second_commune_2019 <- communes_2019 |> slice(2)
fifth_commune_2019 <- communes_2019 |> slice(5)
top4_2019 <- communes_2019 |> slice_head(n = 4)

rank_2019 <- communes_2019 |>
  slice_head(n = 12) |>
  mutate(
    groupe = if_else(territoire %in% grand_noumea_communes, "Grand Nouméa", "Autres communes"),
    couleur = if_else(groupe == "Grand Nouméa", "#2f6b45", "#7a8c8d")
  ) |>
  transmute(
    commune = territoire,
    population,
    groupe,
    couleur
  )

pacific_capital_examples <- tibble::tribble(
  ~cas, ~region, ~agglomeration, ~annee, ~population_totale, ~population_noyau, ~population_elargie, ~noyau_lecture, ~elargi_lecture, ~estimation, ~note_lecture, ~source_lecture,
  "Nouvelle-Calédonie", "Mélanésie", "Grand Nouméa", "2019", latest_total, noumea_2019$population, grand_noumea_2019$population, "Nouméa", "Grand Nouméa (4 communes)", FALSE, "Agglomération communale utilisée dans l'article.", "ISEE",
  "Polynésie française", "Polynésie", "Grand Papeete", "2022", 278786, 26654, 124274, "Papeete", "Zone urbaine Mahina–Punaauia (6 communes)", FALSE, "Périmètre continu autour de Papeete, sans prendre toute l'île de Tahiti.", "ISPF",
  "Samoa", "Polynésie", "Grand Apia", "2021", 205557, 35974, 111281, "Apia", "Apia + Nord-Ouest Upolu (périmètre large)", TRUE, "Périmètre large : Apia Urban Area et région North West Upolu.", "Samoa Bureau of Statistics",
  "Kiribati", "Micronésie", "South Tarawa", "2020", 119940, 18429, 63439, "Betio", "South Tarawa (district-capitale)", FALSE, "Le district-capitale est plus parlant que Betio seule.", "Kiribati NSO / SPC",
  "Tonga", "Polynésie", "Grand Nuku'alofa", "2021", 100179, NA_real_, 34142, NA_character_, "Greater Nuku'alofa (11 villages)", FALSE, "La capitale seule n'est pas isolée dans la donnée mobilisée.", "Tonga Statistics Department / SPC",
  "Fidji", "Mélanésie", "Grand Suva", "2017", 884887, 93874, 268423, "Suva", "Grand Suva (4 villes)", FALSE, "Suva est la capitale politique ; Nadi et Lautoka portent aussi des fonctions d'entrée.", "Fiji Bureau of Statistics / UN-Habitat",
  "Îles Salomon", "Mélanésie", "Grand Honiara", "2019", 721455, 130176, 169721, "Honiara", "Greater Honiara (ville + franges)", TRUE, "Périmètre fonctionnel plus large que le conseil municipal.", "Solomon Islands NSO / UN-Habitat",
  "Vanuatu", "Mélanésie", "Grand Port Vila", "2020 / estim.", 300019, 49034, 114000, "Port Vila", "Greater Port Vila (espace fonctionnel)", TRUE, "Périmètre fonctionnel : la croissance périurbaine dépasse la limite municipale.", "Vanuatu NSO / UN-Habitat",
  "Tuvalu", "Polynésie", "Funafuti", "2022", 10643, NA_real_, 6613, NA_character_, "Funafuti (île-capitale)", FALSE, "Le périmètre correspond à l'île-capitale, pas à une commune urbaine.", "Tuvalu Central Statistics Division",
  "Îles Marshall", "Micronésie", "Majuro", "2021", 42418, 14149, 23156, "Delap-Uliga-Djarrit", "Majuro Atoll", FALSE, "Delap-Uliga-Djarrit forme le noyau urbain de Majuro.", "RMI Census / UNESCO-IOC",
  "Guam", "Micronésie", "Greater Hagåtña", "2020", 153836, 13522, 44212, "Hagåtña", "Greater Hagåtña", TRUE, "Périmètres repris du rapport Blue Pacific ; le recensement américain détaille aussi les CDP.", "UN-Habitat / U.S. Census Bureau",
  "Palau", "Micronésie", "Koror", "2020", 17614, 318, 11400, "Melekeok", "Koror (pôle économique)", FALSE, "Cas de dissociation : capitale politique à Melekeok, principal pôle urbain à Koror.", "Palau Office of Planning and Statistics",
  "Papouasie-Nouvelle-Guinée", "Mélanésie", "Grand Port Moresby", "2019 / estim.", 9000000, NA_real_, 760000, NA_character_, "Greater Port Moresby", TRUE, "Ordre de grandeur : estimation NSO/NCDC citée par UN-Habitat.", "UN-Habitat"
) |>
  mutate(
    noyau = 100 * population_noyau / population_totale,
    elargi = 100 * population_elargie / population_totale
  )

zone_from_commune <- function(x) {
  key <- normalize_key(x)
  case_when(
    key == "NOUMEA" ~ "Nouméa",
    key %in% c("DUMBEA", "MONTDORE", "PAITA") ~ "Couronne périurbaine",
    TRUE ~ "Reste du territoire"
  )
}

read_commune_events <- function(path) {
  raw <- read_excel(
    path,
    sheet = 5,
    col_names = FALSE,
    col_types = rep("text", 22)
  )

  event_years <- as.integer(gsub("[^0-9]", "", unlist(raw[6, 2:22], use.names = FALSE)))

  raw[7:39, 1:22] |>
    setNames(c("commune", event_years)) |>
    pivot_longer(-commune, names_to = "annee", values_to = "valeur") |>
    mutate(
      annee = as.integer(annee),
      valeur = replace_na(clean_number(valeur), 0),
      zone = zone_from_commune(commune)
    )
}

births_by_commune <- read_commune_events(births_xlsx_path) |>
  rename(naissances = valeur)

deaths_by_commune <- read_commune_events(deaths_xlsx_path) |>
  rename(deces = valeur)

natural_balance_by_zone <- births_by_commune |>
  full_join(deaths_by_commune, by = c("commune", "annee", "zone")) |>
  group_by(zone, annee) |>
  summarise(
    naissances = sum(naissances, na.rm = TRUE),
    deces = sum(deces, na.rm = TRUE),
    solde_naturel = naissances - deces,
    .groups = "drop"
  )

natural_zone_colors <- c(
  "Nouméa" = "#c54832",
  "Couronne périurbaine" = "#d6a21f",
  "Reste du territoire" = "#7a8c8d"
)

natural_balance_series <- natural_balance_by_zone |>
  transmute(
    annee,
    serie = zone,
    valeur = solde_naturel,
    couleur = unname(natural_zone_colors[zone])
  )

natural_period_summary <- natural_balance_by_zone |>
  filter(annee %in% c(2005:2007, 2023:2025)) |>
  mutate(periode = if_else(annee <= 2007, "2005-2007", "2023-2025")) |>
  group_by(zone, periode) |>
  summarise(
    naissances = mean(naissances),
    deces = mean(deces),
    solde_naturel = mean(solde_naturel),
    .groups = "drop"
  )

natural_noumea_early <- natural_period_summary |>
  filter(zone == "Nouméa", periode == "2005-2007") |>
  slice(1)

natural_noumea_recent <- natural_period_summary |>
  filter(zone == "Nouméa", periode == "2023-2025") |>
  slice(1)

natural_crown_early <- natural_period_summary |>
  filter(zone == "Couronne périurbaine", periode == "2005-2007") |>
  slice(1)

natural_crown_recent <- natural_period_summary |>
  filter(zone == "Couronne périurbaine", periode == "2023-2025") |>
  slice(1)

grand_noumea_natural_by_year <- natural_balance_by_zone |>
  filter(zone %in% c("Nouméa", "Couronne périurbaine")) |>
  group_by(annee) |>
  summarise(
    naissances = sum(naissances),
    deces = sum(deces),
    solde_naturel = sum(solde_naturel),
    .groups = "drop"
  )

grand_noumea_natural_2019 <- grand_noumea_natural_by_year |>
  filter(annee == 2019) |>
  slice(1)

grand_noumea_natural_2025 <- grand_noumea_natural_by_year |>
  filter(annee == 2025) |>
  slice(1)

work_years <- c(1989L, 1996L, 2009L, 2014L, 2019L)

read_work_communes <- function(year) {
  raw <- read_excel(
    work_commune_xlsx_path,
    sheet = as.character(year),
    col_names = FALSE,
    col_types = "text",
    .name_repair = "minimal"
  )

  work_communes <- as.character(unlist(raw[7, 2:34], use.names = FALSE))

  raw[8:40, 1:34] |>
    setNames(c("commune_residence", work_communes)) |>
    pivot_longer(
      -commune_residence,
      names_to = "commune_travail",
      values_to = "actifs"
    ) |>
    mutate(
      annee = year,
      actifs = replace_na(clean_number(actifs), 0),
      zone_residence = zone_from_commune(commune_residence),
      zone_travail = zone_from_commune(commune_travail)
    )
}

work_od_communes <- map_dfr(work_years, read_work_communes)

commute_zone_od_history <- work_od_communes |>
  group_by(annee, zone_residence, zone_travail) |>
  summarise(actifs = sum(actifs), .groups = "drop") |>
  complete(
    annee = work_years,
    zone_residence = c("Nouméa", "Couronne périurbaine", "Reste du territoire"),
    zone_travail = c("Nouméa", "Couronne périurbaine", "Reste du territoire"),
    fill = list(actifs = 0)
  )

commute_residents_history <- commute_zone_od_history |>
  group_by(annee, zone = zone_residence) |>
  summarise(actifs_residents = sum(actifs), .groups = "drop")

commute_jobs_history <- commute_zone_od_history |>
  group_by(annee, zone = zone_travail) |>
  summarise(emplois = sum(actifs), .groups = "drop")

commute_totals_history <- commute_zone_od_history |>
  group_by(annee) |>
  summarise(total = sum(actifs), .groups = "drop")

commute_zone_summary_history <- full_join(
  commute_residents_history,
  commute_jobs_history,
  by = c("annee", "zone")
) |>
  left_join(commute_totals_history, by = "annee") |>
  mutate(
    part_actifs_residents = 100 * actifs_residents / total,
    part_emplois = 100 * emplois / total,
    ratio_emplois_actifs = emplois / actifs_residents
  )

commute_history_series <- commute_zone_summary_history |>
  filter(zone == "Nouméa") |>
  select(annee, part_actifs_residents, part_emplois) |>
  pivot_longer(-annee, names_to = "serie", values_to = "valeur") |>
  mutate(
    serie = recode(
      serie,
      part_actifs_residents = "Personnes en emploi qui habitent à Nouméa",
      part_emplois = "Personnes qui travaillent à Nouméa"
    ),
    couleur = if_else(serie == "Personnes qui travaillent à Nouméa", "#2f6b45", "#d6a21f")
  )

commute_zone_od <- commute_zone_od_history |>
  filter(annee == 2019) |>
  select(-annee)

commute_total <- sum(commute_zone_od$actifs)

commute_residents <- commute_residents_history |>
  filter(annee == 2019) |>
  select(-annee)

commute_jobs <- commute_jobs_history |>
  filter(annee == 2019) |>
  select(-annee)

commute_zone_summary <- commute_zone_summary_history |>
  filter(annee == 2019) |>
  select(-annee, -total)

workplace_comparison <- bind_rows(
  commute_zone_summary |>
    transmute(
      zone,
      mesure = "Personnes en emploi qui y habitent",
      valeur = part_actifs_residents,
      couleur = "#d6a21f"
    ),
  commute_zone_summary |>
    transmute(
      zone,
      mesure = "Personnes qui y travaillent",
      valeur = part_emplois,
      couleur = "#2f6b45"
    )
)

commute_noumea <- commute_zone_summary |>
  filter(zone == "Nouméa") |>
  slice(1)

commute_noumea_1989 <- commute_zone_summary_history |>
  filter(annee == 1989, zone == "Nouméa") |>
  slice(1)

commute_crown <- commute_zone_summary |>
  filter(zone == "Couronne périurbaine") |>
  slice(1)

crown_to_noumea <- commute_zone_od |>
  filter(zone_residence == "Couronne périurbaine", zone_travail == "Nouméa") |>
  pull(actifs)

noumea_to_crown <- commute_zone_od |>
  filter(zone_residence == "Nouméa", zone_travail == "Couronne périurbaine") |>
  pull(actifs)

crown_to_noumea_share <- 100 * crown_to_noumea / commute_crown$actifs_residents

crown_to_noumea_history <- commute_zone_od_history |>
  filter(zone_residence == "Couronne périurbaine", zone_travail == "Nouméa") |>
  transmute(annee, crown_to_noumea = actifs) |>
  left_join(
    commute_residents_history |>
      filter(zone == "Couronne périurbaine") |>
      select(annee, actifs_residents),
    by = "annee"
  ) |>
  mutate(part = 100 * crown_to_noumea / actifs_residents)

crown_to_noumea_1989 <- crown_to_noumea_history |>
  filter(annee == 1989) |>
  slice(1)

grand_noumea_work_summary <- commute_zone_summary |>
  filter(zone %in% c("Nouméa", "Couronne périurbaine")) |>
  summarise(
    actifs_residents = sum(actifs_residents),
    emplois = sum(emplois),
    part_actifs_residents = 100 * actifs_residents / commute_total,
    part_emplois = 100 * emplois / commute_total
  )

commute_cards <- tibble::tribble(
  ~value, ~label, ~note,
  fmt_pct(commute_noumea$part_emplois), "des personnes en emploi travaillent à Nouméa", paste0("alors que ", fmt_pct(commute_noumea$part_actifs_residents), " y habitent."),
  fmt_pct(crown_to_noumea_share), "des travailleurs de la couronne vont à Nouméa", paste0(fmt_int(crown_to_noumea), " personnes en 2019, contre ", fmt_int(noumea_to_crown), " dans l'autre sens."),
  fmt_pct(grand_noumea_work_summary$part_emplois), "des personnes en emploi travaillent dans le Grand Nouméa", paste0("et ", fmt_pct(grand_noumea_work_summary$part_actifs_residents), " y habitent.")
)

clean_region <- function(x) {
  x <- trimws(gsub("\\s*\\([a-e]\\)", "", x))
  x <- gsub("^Iles", "Îles", x)
  x
}

region_colors <- c(
  "Grand Nouméa" = "#2f6b45",
  "Nord Ouest" = "#d6a21f",
  "Sud rural" = "#2f6f8f",
  "Nord Est" = "#c54832",
  "Îles Loyauté" = "#7a8c8d"
)

internal_migration_raw <- read_excel(
  internal_migration_xls_path,
  sheet = "evolution",
  col_names = FALSE,
  col_types = rep("text", 10)
)

internal_blocks <- tibble::tribble(
  ~periode, ~annee, ~duree, ~rows,
  "1989-1996", 1996L, 7, 75:79,
  "1996-2004", 2004L, 8, 61:65,
  "2004-2009", 2009L, 5, 47:51,
  "2009-2014", 2014L, 5, 28:32,
  "2014-2019", 2019L, 5, 10:14
)

internal_region_migrations <- purrr::pmap_dfr(internal_blocks, function(periode, annee, duree, rows) {
  internal_migration_raw[rows, c(1, 8, 9, 10)] |>
    setNames(c("region", "arrivees_internes", "departs_internes", "solde_interne")) |>
    mutate(
      periode = periode,
      annee = annee,
      duree = duree,
      region = clean_region(region),
      arrivees_internes = clean_number(arrivees_internes),
      departs_internes = clean_number(departs_internes),
      solde_interne = clean_number(solde_interne),
      arrivees_internes_annuelles = arrivees_internes / duree,
      departs_internes_annuels = departs_internes / duree,
      solde_interne_annuel = solde_interne / duree
    )
})

internal_balance_series <- internal_region_migrations |>
  transmute(
    annee,
    periode,
    duree,
    serie = region,
    valeur = solde_interne,
    couleur = unname(region_colors[region])
  )

external_migration_raw <- read_excel(
  external_migration_xls_path,
  sheet = "evolution",
  col_names = FALSE,
  col_types = rep("text", 6)
)

external_blocks <- tibble::tribble(
  ~periode, ~annee, ~duree, ~rows,
  "1989-1996", 1996L, 7, 64:68,
  "1996-2004", 2004L, 8, 51:55,
  "2004-2009", 2009L, 5, 38:42,
  "2009-2014", 2014L, 5, 24:28,
  "2014-2019", 2019L, 5, 9:13
)

external_region_migrations <- purrr::pmap_dfr(external_blocks, function(periode, annee, duree, rows) {
  external_migration_raw[rows, 1:4] |>
    setNames(c("region", "metropole_dom_com", "etranger", "total_externe_entrant")) |>
    mutate(
      periode = periode,
      annee = annee,
      duree = duree,
      region = clean_region(region),
      metropole_dom_com = clean_number(metropole_dom_com),
      etranger = clean_number(etranger),
      total_externe_entrant = clean_number(total_externe_entrant),
      total_externe_entrant_annuel = total_externe_entrant / duree
    )
})

external_entries_series <- external_region_migrations |>
  group_by(periode, annee) |>
  summarise(
    grand_noumea = sum(total_externe_entrant[region == "Grand Nouméa"], na.rm = TRUE),
    reste = sum(total_externe_entrant[region != "Grand Nouméa"], na.rm = TRUE),
    .groups = "drop"
  ) |>
  pivot_longer(c(grand_noumea, reste), names_to = "serie", values_to = "valeur") |>
  mutate(
    zone = periode,
    mesure = recode(serie, grand_noumea = "Grand Nouméa", reste = "Reste du territoire"),
    couleur = if_else(mesure == "Grand Nouméa", "#2f6b45", "#7a8c8d")
  )

external_entries_xmax <- ceiling(max(external_entries_series$valeur, na.rm = TRUE) / 5000) * 5000

grand_noumea_migration_sources_series <- internal_region_migrations |>
  filter(region == "Grand Nouméa") |>
  select(periode, annee, arrivees_internes) |>
  left_join(
    external_region_migrations |>
      filter(region == "Grand Nouméa") |>
      select(periode, annee, arrivees_exterieures = total_externe_entrant),
    by = c("periode", "annee")
  ) |>
  transmute(
    periode,
    annee,
    arrivees_internes,
    arrivees_exterieures
  ) |>
  pivot_longer(
    c(arrivees_internes, arrivees_exterieures),
    names_to = "serie",
    values_to = "valeur"
  ) |>
  mutate(
    zone = periode,
    mesure = recode(
      serie,
      arrivees_internes = "Arrivées internes",
      arrivees_exterieures = "Arrivées extérieures"
    ),
    couleur = recode(
      mesure,
      "Arrivées internes" = "#2f6b45",
      "Arrivées extérieures" = "#c54832"
    )
  )

grand_noumea_migration_sources_xmax <- ceiling(max(grand_noumea_migration_sources_series$valeur, na.rm = TRUE) / 5000) * 5000

birth_origin_raw <- read_excel(
  origin_xls_path,
  sheet = "lieu naissance",
  col_names = FALSE,
  col_types = "text"
)

birth_origin_long <- birth_origin_raw[6:10, 1:8] |>
  setNames(c("origine", 1983, 1989, 1996, 2004, 2009, 2014, 2019)) |>
  pivot_longer(-origine, names_to = "annee", values_to = "part") |>
  mutate(
    annee = as.integer(annee),
    part = clean_number(part)
  )

installation_raw <- read_excel(
  origin_xls_path,
  sheet = "date installation",
  col_names = FALSE,
  col_types = rep("text", 33)
)

installation_2019 <- installation_raw[8:48, c(1, 27:33)] |>
  setNames(c("territoire", "ne_en_nc", "avant_1990", "de_1990_1999", "de_2000_2014", "de_2015_2019", "non_declaree", "total")) |>
  mutate(
    across(-territoire, clean_number),
    territoire_key = normalize_key(territoire)
  )

population_components_raw <- read_excel(
  evolution_xlsx_path,
  sheet = "Evolution Population",
  col_names = FALSE,
  col_types = rep("text", 7)
)

population_components <- population_components_raw[7:nrow(population_components_raw), 1:7] |>
  setNames(c("annee", "population_1er_janvier", "population_moyenne", "solde_naturel", "solde_migratoire_apparent", "taux_naturel", "taux_annuel")) |>
  mutate(
    across(everything(), clean_number),
    annee = as.integer(annee)
  ) |>
  filter(!is.na(annee))

growth_components_series <- population_components |>
  filter(
    annee <= 2022,
    !is.na(solde_naturel),
    !is.na(solde_migratoire_apparent)
  ) |>
  select(annee, solde_naturel, solde_migratoire_apparent) |>
  pivot_longer(-annee, names_to = "serie", values_to = "valeur") |>
  mutate(
    serie = recode(
      serie,
      solde_naturel = "Naissances moins décès",
      solde_migratoire_apparent = "Bilan estimé des migrations"
    ),
    couleur = if_else(serie == "Naissances moins décès", "#2f6b45", "#c54832")
  )

growth_rates_series <- population_components |>
  filter(annee <= 2022, !is.na(taux_annuel)) |>
  mutate(
    taux_migratoire_apparent = if_else(
      !is.na(taux_annuel) & !is.na(taux_naturel),
      taux_annuel - taux_naturel,
      NA_real_
    )
  ) |>
  select(annee, taux_annuel, taux_naturel, taux_migratoire_apparent) |>
  pivot_longer(-annee, names_to = "serie", values_to = "valeur") |>
  filter(!is.na(valeur)) |>
  mutate(
    valeur = valeur * 100,
    serie = recode(
      serie,
      taux_annuel = "Accroissement total",
      taux_naturel = "Accroissement naturel",
      taux_migratoire_apparent = "Accroissement migratoire apparent"
    ),
    couleur = recode(
      serie,
      "Accroissement total" = "#2f6f8f",
      "Accroissement naturel" = "#2f6b45",
      "Accroissement migratoire apparent" = "#c54832"
    )
  )

internal_gn_recent <- internal_region_migrations |>
  filter(region == "Grand Nouméa", periode == "2014-2019") |>
  slice(1)

internal_gn_1989_1996 <- internal_region_migrations |>
  filter(region == "Grand Nouméa", periode == "1989-1996") |>
  slice(1)

internal_gn_1996_2004 <- internal_region_migrations |>
  filter(region == "Grand Nouméa", periode == "1996-2004") |>
  slice(1)

internal_gn_2009_2014 <- internal_region_migrations |>
  filter(region == "Grand Nouméa", periode == "2009-2014") |>
  slice(1)

internal_no_2009_2014 <- internal_region_migrations |>
  filter(region == "Nord Ouest", periode == "2009-2014") |>
  slice(1)

external_gn_recent <- external_region_migrations |>
  filter(region == "Grand Nouméa", periode == "2014-2019") |>
  slice(1)

external_gn_1989_1996 <- external_region_migrations |>
  filter(region == "Grand Nouméa", periode == "1989-1996") |>
  slice(1)

external_total_recent <- external_region_migrations |>
  filter(periode == "2014-2019") |>
  summarise(total = sum(total_externe_entrant, na.rm = TRUE)) |>
  pull(total)

external_rest_recent <- external_total_recent - external_gn_recent$total_externe_entrant
external_gn_share_recent <- 100 * external_gn_recent$total_externe_entrant / external_total_recent

recent_installed_gn <- installation_2019 |>
  filter(territoire == "Grand Nouméa") |>
  slice(1)

recent_installed_nc <- installation_2019 |>
  filter(territoire == "Nouvelle-Calédonie") |>
  slice(1)

recent_install_share_gn <- 100 * recent_installed_gn$de_2015_2019 / recent_installed_nc$de_2015_2019
recent_install_share_gn_population <- 100 * recent_installed_gn$de_2015_2019 / recent_installed_gn$total

born_nc_2014 <- birth_origin_long |>
  filter(origine == "Nouvelle-Calédonie", annee == 2014) |>
  pull(part)

born_nc_2019 <- birth_origin_long |>
  filter(origine == "Nouvelle-Calédonie", annee == 2019) |>
  pull(part)

recent_population_components <- population_components |>
  filter(annee >= 2019, annee <= 2022)

recent_apparent_migration <- sum(recent_population_components$solde_migratoire_apparent, na.rm = TRUE)
recent_natural_balance <- sum(recent_population_components$solde_naturel, na.rm = TRUE)

growth_cards <- tibble::tribble(
  ~value, ~label, ~note,
  paste0(ifelse(internal_gn_recent$solde_interne > 0, "+", ""), fmt_int(internal_gn_recent$solde_interne)), "habitants gagnés face aux autres régions", "dans le Grand Nouméa entre 2014 et 2019.",
  fmt_pct(external_gn_share_recent), "des arrivants de l'extérieur vivent dans le Grand Nouméa", paste0("entre 2014 et 2019, soit ", fmt_int(external_gn_recent$total_externe_entrant), " personnes."),
  fmt_int(recent_apparent_migration), "entrées moins sorties estimées, 2019-2022", paste0("pour toute la Nouvelle-Calédonie, malgré ", fmt_int(recent_natural_balance), " naissances de plus que de décès.")
)

communes_geojson_text <- paste(readLines(communes_geojson_path, encoding = "UTF-8", warn = FALSE), collapse = "\n")

map_population <- population_long |>
  filter(type == "commune") |>
  transmute(
    commune = territoire,
    key = territoire_key,
    annee,
    population,
    isGrandNoumea = territoire %in% grand_noumea_communes
  )

summary_cards <- tibble::tribble(
  ~value, ~label, ~note,
  fmt_pct(grand_noumea_2019$part), "de la population en 2019", paste0("dans les quatre communes du Grand Nouméa, soit ", fmt_int(grand_noumea_2019$population), " habitants."),
  fmt_pct(province_sud_2019$part), "dans la Province Sud", "la concentration se joue donc aussi à l'échelle des provinces.",
  fmt_int(couronne_2019$population), "habitants hors Nouméa", paste0("dans Dumbéa, Mont-Dore et Païta en 2019, contre ", fmt_int(noumea_2019$population), " à Nouméa.")
)

table_zones <- zone_series |>
  filter(
    zone %in% c("Nouméa", "Couronne périurbaine", "Grand Nouméa", "Reste des communes", "Province Sud"),
    annee %in% c(1956, 1983, 1996, 2009, 2019)
  ) |>
  select(zone, annee, population, part) |>
  arrange(factor(zone, levels = c("Nouméa", "Couronne périurbaine", "Grand Nouméa", "Reste des communes", "Province Sud")), annee)

details_gt <- function(summary_text, gt_table) {
  tags$details(
    class = "capital-data-details",
    tags$summary(summary_text),
    tags$div(
      class = "capital-data-details-body",
      HTML(gt::as_raw_html(gt_table))
    )
  )
}

table_zones_gt <- table_zones |>
  gt() |>
  fmt_number(columns = c(population), decimals = 0, sep_mark = " ", dec_mark = ",") |>
  fmt_number(columns = c(part), decimals = 1, dec_mark = ",") |>
  cols_label(
    zone = "zone",
    annee = "année",
    population = "population",
    part = "part de la population (%)"
  ) |>
  tab_source_note("Source : ISEE, recensements de la population, données communales et provinciales.")

pacific_city_table <- pacific_capital_examples |>
  transmute(
    territoire = cas,
    annee,
    capitale_seule = coalesce(noyau_lecture, "non isolée"),
    ville_associee = elargi_lecture,
    population_totale,
    population_capitale = population_noyau,
    population_associee = population_elargie,
    part_capitale = if_else(is.na(noyau), NA_character_, fmt_pct(noyau)),
    part_associee = fmt_pct(elargi),
    lecture = if_else(estimation, paste0(note_lecture, " *"), note_lecture),
    source = source_lecture
  ) |>
  arrange(desc(population_associee / population_totale), territoire)

pacific_city_table_gt <- pacific_city_table |>
  gt() |>
  fmt_number(
    columns = c(population_totale, population_capitale, population_associee),
    decimals = 0,
    sep_mark = " ",
    dec_mark = ","
  ) |>
  sub_missing(columns = everything(), missing_text = "non isolée") |>
  cols_label(
    territoire = "pays ou territoire",
    annee = "année",
    capitale_seule = "capitale seule",
    ville_associee = "ville associée / agglomération",
    population_totale = "population totale",
    population_capitale = "population capitale",
    population_associee = "population associée",
    part_capitale = "part capitale",
    part_associee = "part associée",
    lecture = "lecture",
    source = "source"
  ) |>
  tab_source_note("* Périmètre large, fonctionnel ou estimé : comparaison utile, mais moins stricte qu'une limite communale.")

sketch_payload <- function(id, type, data, caption = NULL, options = list()) {
  payload <- list(
    type = type,
    data = data,
    options = options
  )

  tagList(
    tags$div(
      id = id,
      class = "capital-sketch",
      `data-sketch-chart` = options$aria %||% caption %||% "Graphique"
    ),
    tags$script(
      type = "application/json",
      id = paste0(id, "-data"),
      HTML(toJSON(payload, auto_unbox = TRUE, dataframe = "rows", na = "null", digits = 8))
    ),
    tags$script(HTML(sprintf("window.ContoursConcentrationNoumea && window.ContoursConcentrationNoumea.render('%s');", id))),
    if (!is.null(caption)) tags$p(class = "capital-sketch-caption", caption)
  )
}

map_payload <- function(id, data, geojson_text, caption = NULL, options = list()) {
  payload <- list(
    type = "cartogram",
    data = data,
    geojson = jsonlite::fromJSON(geojson_text, simplifyVector = FALSE),
    options = options
  )

  tagList(
    tags$div(
      id = id,
      class = "capital-sketch capital-map",
      `data-sketch-chart` = options$aria %||% caption %||% "Carte animée"
    ),
    tags$script(
      type = "application/json",
      id = paste0(id, "-data"),
      HTML(toJSON(payload, auto_unbox = TRUE, dataframe = "rows", na = "null", digits = 8))
    ),
    tags$script(HTML(sprintf("window.ContoursConcentrationNoumea && window.ContoursConcentrationNoumea.render('%s');", id))),
    if (!is.null(caption)) tags$p(class = "capital-sketch-caption", caption)
  )
}

`%||%` <- function(x, y) {
  if (is.null(x)) y else x
}

create_preview <- function(path = image_path("previews", "concentration-population-noumea-pacifique.png")) {
  if (!requireNamespace("ggplot2", quietly = TRUE) || !requireNamespace("ragg", quietly = TRUE)) {
    return(invisible(FALSE))
  }

  dir.create(dirname(path), recursive = TRUE, showWarnings = FALSE)

  plot_data <- share_series |>
    filter(serie %in% c("Nouméa", "Couronne périurbaine", "Grand Nouméa")) |>
    mutate(serie = factor(serie, levels = c("Grand Nouméa", "Nouméa", "Couronne périurbaine")))

  p <- ggplot2::ggplot(plot_data, ggplot2::aes(annee, valeur, color = serie)) +
    ggplot2::geom_line(linewidth = 1.6, lineend = "round") +
    ggplot2::geom_point(size = 2.8) +
    ggplot2::scale_color_manual(values = zone_colors) +
    ggplot2::scale_y_continuous(labels = label_number(suffix = " %", decimal.mark = ","), limits = c(0, 72)) +
    ggplot2::labs(
      title = "Population autour de Nouméa",
      subtitle = "Nouméa, couronne périurbaine et Grand Nouméa depuis 1956",
      x = NULL,
      y = "Part de la population",
      color = NULL,
      caption = "Source : INSEE-ISEE, recensements de la population"
    ) +
    ggplot2::theme_minimal(base_family = "sans", base_size = 14) +
    ggplot2::theme(
      plot.background = ggplot2::element_rect(fill = "#fffdf8", color = NA),
      panel.background = ggplot2::element_rect(fill = "#fffdf8", color = NA),
      panel.grid.minor = ggplot2::element_blank(),
      panel.grid.major = ggplot2::element_line(color = "#ded8cf"),
      plot.title = ggplot2::element_text(face = "bold", size = 30, color = "#252525"),
      plot.subtitle = ggplot2::element_text(size = 15, color = "#625d55"),
      legend.position = "bottom",
      legend.text = ggplot2::element_text(face = "bold"),
      plot.caption = ggplot2::element_text(color = "#625d55")
    )

  ragg::agg_png(path, width = 1200, height = 630, res = 144, background = "#fffdf8")
  print(p)
  grDevices::dev.off()
  invisible(TRUE)
}
