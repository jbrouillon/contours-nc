library(dplyr)
library(here)
library(jsonlite)
library(readr)
library(sf)
library(stringr)
library(tidyr)

project_dir <- here::here()
post_dir <- file.path(project_dir, "posts", "provinciales-2026-geographie-forces-politiques")
out_dir <- file.path(post_dir, "data")
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

raw_2026_dir <- file.path(project_dir, "data", "elections", "data_raw", "provinciales_2026")
processed_dir <- file.path(project_dir, "data", "elections", "data_processed")
source_2026_province <- file.path(
  processed_dir, "provinciales_2026", "provinciales_2026_resultats_province_listes.csv"
)
source_2019_bureaux <- file.path(processed_dir, "provinciales_2019_bureaux_geolocalises.csv")
source_2019_listes <- file.path(processed_dir, "provinciales_2019_listes_long_geolocalisees.csv")
source_geo <- file.path(processed_dir, "bureaux_reference_geolocalises.csv")
source_provinces <- file.path(
  project_dir, "data", "elections", "data_raw", "referentiels_geographiques",
  "provinces", "Provinces.geojson"
)
source_listes_2019 <- file.path(
  project_dir, "data", "outputs_provinciales_candidats",
  "provinciales_referentiel_listes_politiques_2019_2026.csv"
)
source_communes_geo <- file.path(
  project_dir, "data", "elections", "data_raw", "referentiels_geographiques",
  "communes", "communes_rgp_2019_v2.geojson"
)

pdf_specs <- list(
  list(
    province = "Province Sud",
    file = file.path(raw_2026_dir, "PROVINCIALES_2026_PSUD_Resultats_BV.pdf"),
    expected = 153L,
    list_numbers = c(1L, 2L, 3L, 5L, 6L, 7L, 8L, 9L, 10L, 11L, 12L),
    commune_patterns = c(
      "Boulouparis" = "^Boulouparis", "Bourail" = "^Bourail",
      "Dumbéa" = "^Dumb.a", "Farino" = "^Farino",
      "Ile des Pins" = "^Ile des Pins", "La Foa" = "^La Foa",
      "Moindou" = "^Moindou", "Mont-Dore" = "^Mont-Dore",
      "Nouméa" = "^Noum.a", "Païta" = "^Pa.ta",
      "Poya Sud" = "^Poya Sud", "Sarraméa" = "^Sarram.a",
      "Thio" = "^Thio", "Yaté" = "^Yat."
    )
  ),
  list(
    province = "Province Nord",
    file = file.path(raw_2026_dir, "PROVINCIALES_2026_PNORD_Resultats_BV.pdf"),
    expected = 95L,
    list_numbers = 1:5,
    commune_patterns = c(
      "Bélep" = "^B.lep", "Canala" = "^Canala",
      "Hienghène" = "^Hiengh.ne", "Houaïlou" = "^Houailou",
      "Kaala-Gomen" = "^Kaala Gomen", "Koné" = "^Kon.",
      "Kouaoua" = "^Kouaoua", "Koumac" = "^Koumac",
      "Ouégoa" = "^Ou.goa", "Poindimié" = "^Poindimi.",
      "Ponérihouen" = "^Pon.rihouen", "Pouébo" = "^Pou.bo",
      "Pouembout" = "^Pouembout", "Poum" = "^Poum",
      "Poya Nord" = "^Poya Nord", "Touho" = "^Touho", "Voh" = "^Voh"
    )
  ),
  list(
    province = "Province des Iles",
    file = file.path(raw_2026_dir, "PROVINCIALES_2026_PIL_Resultats_BV.pdf"),
    expected = 49L,
    list_numbers = 1:7,
    commune_patterns = c(
      "Lifou" = "^Lifou", "Maré" = "^Mar.", "Ouvéa" = "^Ouv.a"
    )
  )
)

required_files <- c(
  vapply(pdf_specs, `[[`, character(1), "file"),
  source_2026_province, source_2019_bureaux, source_2019_listes,
  source_geo, source_provinces, source_communes_geo, source_listes_2019
)
missing_files <- required_files[!file.exists(required_files)]
if (length(missing_files) > 0) {
  stop("Fichiers manquants :\n", paste(missing_files, collapse = "\n"))
}

fmt_code_bv <- function(x) str_pad(as.character(x), width = 4, pad = "0")

find_pdftotext <- function() {
  found <- Sys.which("pdftotext")
  if (nzchar(found)) return(unname(found))
  candidates <- c(
    "C:/Program Files/Git/mingw64/bin/pdftotext.exe",
    "C:/Program Files/poppler/Library/bin/pdftotext.exe"
  )
  candidates <- candidates[file.exists(candidates)]
  if (length(candidates) == 0) stop("pdftotext est requis pour extraire les tableaux 2026.")
  candidates[[1]]
}

parse_number_fr <- function(x) as.numeric(str_replace(str_remove(x, "%$"), ",", "."))

stat_pattern <- paste0(
  "(\\d+)\\s+(\\d+)\\s+([0-9]+,[0-9]+)%\\s+",
  "(\\d+)\\s+([0-9]+,[0-9]+)%\\s+",
  "(\\d+)\\s+([0-9]+,[0-9]+)%\\s+",
  "(\\d+)\\s+([0-9]+,[0-9]+)%\\s+",
  "(\\d+)\\s+([0-9]+,[0-9]+)%"
)

# Les PDF sont des pages tabulaires. Certains noms de bureaux longs repoussent
# les compteurs sur la ligne suivante : chaque ligne de départ est donc recollée
# à ses éventuelles continuations avant lecture de la séquence de nombres.
parse_pdf_bureaux <- function(spec) {
  pdf_lines <- system2(
    find_pdftotext(),
    # Sans -enc, pdftotext produit du Latin-1 sous Windows : les accents des
    # noms de bureaux devenaient des caractères de remplacement.
    args = c("-enc", "UTF-8", "-raw", shQuote(spec$file), "-"),
    stdout = TRUE,
    stderr = TRUE
  )

  record_start <- function(line) {
    hits <- names(spec$commune_patterns)[vapply(
      spec$commune_patterns,
      function(pattern) str_detect(line, paste0(pattern, "\\s+\\d+\\s+")),
      logical(1)
    )]
    if (length(hits) == 0) NA_character_ else hits[[1]]
  }

  records <- list()
  active <- NULL
  for (line in pdf_lines) {
    # Les milliers sont séparés par une espace fine insécable (« 1 848 »).
    line <- str_squish(str_remove_all(line, "(?<=\\d)[\\x{202F}\\x{00A0}](?=\\d{3})"))
    commune <- record_start(line)
    if (!is.na(commune)) {
      if (!is.null(active)) records[[length(records) + 1]] <- active
      active <- list(commune = commune, text = line)
    } else if (!is.null(active)) {
      active$text <- str_squish(paste(active$text, line))
    }
  }
  if (!is.null(active)) records[[length(records) + 1]] <- active

  parse_record <- function(record) {
    commune_pattern <- spec$commune_patterns[[record$commune]]
    prefix <- str_match(
      record$text,
      paste0("(", str_remove(commune_pattern, "\\^"), ")\\s+(\\d+)\\s+(.*)$")
    )
    if (any(is.na(prefix))) stop("Impossible de lire le début de ligne : ", record$text)

    bureau_num <- as.integer(prefix[, 3])
    remainder <- prefix[, 4]
    match_pos <- regexpr(stat_pattern, remainder, perl = TRUE)
    if (match_pos[[1]] < 1) stop("Compteurs introuvables pour : ", record$text)

    stat_text <- regmatches(remainder, match_pos)
    stat_values <- str_match(stat_text, paste0("^", stat_pattern, "$"))[, -1]
    after_stats <- substring(remainder, match_pos[[1]] + attr(match_pos, "match.length"))
    candidate_pairs <- str_match_all(after_stats, "(\\d+)\\s+([0-9]+,[0-9]+)%")[[1]][, 2:3, drop = FALSE]
    if (nrow(candidate_pairs) < length(spec$list_numbers)) {
      stop("Résultats de listes incomplets pour ", spec$province, " / ", record$commune, " ", bureau_num)
    }
    candidate_pairs <- candidate_pairs[seq_along(spec$list_numbers), , drop = FALSE]

    tibble(
      province = spec$province,
      commune = record$commune,
      bureau_num = bureau_num,
      code_bv = fmt_code_bv(bureau_num),
      bureau_nom_pdf = str_squish(substr(remainder, 1, match_pos[[1]] - 1)),
      inscrits = parse_number_fr(stat_values[[1]]),
      votants = parse_number_fr(stat_values[[2]]),
      participation = parse_number_fr(stat_values[[3]]),
      abstentions = parse_number_fr(stat_values[[4]]),
      abstention = parse_number_fr(stat_values[[5]]),
      nuls = parse_number_fr(stat_values[[6]]),
      pct_nuls = parse_number_fr(stat_values[[7]]),
      blancs = parse_number_fr(stat_values[[8]]),
      pct_blancs = parse_number_fr(stat_values[[9]]),
      exprimes = parse_number_fr(stat_values[[10]]),
      pct_exprimes_votants = parse_number_fr(stat_values[[11]]),
      !!!setNames(
        as.list(parse_number_fr(candidate_pairs[, 1])),
        paste0("voix_", spec$list_numbers)
      )
    )
  }

  wide <- bind_rows(lapply(records, parse_record))
  if (nrow(wide) != spec$expected) {
    stop("Extraction incomplète pour ", spec$province, " : ", nrow(wide), " au lieu de ", spec$expected, ".")
  }
  candidate_columns <- paste0("voix_", spec$list_numbers)
  row_audit <- wide |>
    mutate(voix_total_listes = rowSums(across(all_of(candidate_columns)))) |>
    filter(
      inscrits != votants + abstentions |
        voix_total_listes != exprimes |
        votants != nuls + blancs + exprimes
    )
  if (nrow(row_audit) > 0) stop("Contrôle arithmétique en échec pour ", spec$province, ".")

  long <- wide |>
    pivot_longer(
      cols = all_of(candidate_columns),
      names_to = "numero_liste",
      names_prefix = "voix_",
      values_to = "voix"
    ) |>
    mutate(numero_liste = as.integer(numero_liste)) |>
    select(province, commune, code_bv, numero_liste, voix)

  list(wide = wide, long = long)
}

parsed_2026 <- lapply(pdf_specs, parse_pdf_bureaux)
bureaux_2026_wide <- bind_rows(lapply(parsed_2026, `[[`, "wide"))
bureaux_2026_long <- bind_rows(lapply(parsed_2026, `[[`, "long"))

geo_reference <- read_csv(source_geo, show_col_types = FALSE) |>
  mutate(code_bv = fmt_code_bv(code_bv))

commune_geo_names <- c(
  "Boulouparis" = "Bouloupari", "Bourail" = "Bourail", "Dumbéa" = "Dumbéa",
  "Farino" = "Farino", "Ile des Pins" = "L'Ile-des-Pins", "La Foa" = "La Foa",
  "Moindou" = "Moindou", "Mont-Dore" = "Le Mont-Dore", "Nouméa" = "Nouméa",
  "Païta" = "Païta", "Poya Sud" = "Poya", "Sarraméa" = "Sarraméa",
  "Thio" = "Thio", "Yaté" = "Yaté", "Bélep" = "Belep", "Canala" = "Canala",
  "Hienghène" = "Hienghène", "Houaïlou" = "Houaïlou", "Kaala-Gomen" = "Kaala-Gomen",
  "Koné" = "Koné", "Kouaoua" = "Kouaoua", "Koumac" = "Koumac", "Ouégoa" = "Ouégoa",
  "Poindimié" = "Poindimié", "Ponérihouen" = "Ponérihouen", "Pouébo" = "Pouébo",
  "Pouembout" = "Pouembout", "Poum" = "Poum", "Poya Nord" = "Poya",
  "Touho" = "Touho", "Voh" = "Voh", "Lifou" = "Lifou", "Maré" = "Maré", "Ouvéa" = "Ouvéa"
)

bureaux_2026_wide <- bureaux_2026_wide |>
  mutate(commune_geo = unname(commune_geo_names[commune])) |>
  left_join(
    geo_reference |>
      select(
        commune_geo = commune, code_bv, bureau_nom_reference = bureau_nom,
        longitude, latitude, geo_source, iris_codgeo, iris_libgeo
      ),
    by = c("commune_geo", "code_bv")
  ) |>
  mutate(
    bureau_nom = coalesce(na_if(bureau_nom_pdf, ""), bureau_nom_reference),
    spatial_include = !(
      province == "Province des Iles" &
        commune == "Lifou" &
        code_bv %in% c("0001", "0027", "0028")
    )
  )

if (anyNA(bureaux_2026_wide$longitude) || anyNA(bureaux_2026_wide$latitude)) {
  missing_geo <- bureaux_2026_wide |>
    filter(is.na(longitude) | is.na(latitude)) |>
    select(province, commune, code_bv, bureau_nom_pdf)
  stop("Géolocalisation 2026 incomplète :\n", paste(capture.output(missing_geo), collapse = "\n"))
}

listes_2026_reference <- read_csv(source_2026_province, show_col_types = FALSE) |>
  distinct(province, numero_liste, liste, etiquette, bloc_historique, nuance, couleur)

bureaux_2026_long <- bureaux_2026_long |>
  left_join(
    bureaux_2026_wide |>
      select(
        province, commune, code_bv, bureau_nom, inscrits, votants, exprimes,
        longitude, latitude, iris_codgeo, iris_libgeo
      ),
    by = c("province", "commune", "code_bv")
  ) |>
  left_join(listes_2026_reference, by = c("province", "numero_liste")) |>
  mutate(pct_exprimes = 100 * voix / exprimes)

official_totals <- read_csv(source_2026_province, show_col_types = FALSE) |>
  select(province, numero_liste, voix_officielles = voix)
extracted_totals <- bureaux_2026_long |>
  group_by(province, numero_liste) |>
  summarise(voix_extraites = sum(voix), .groups = "drop")
total_audit <- official_totals |>
  left_join(extracted_totals, by = c("province", "numero_liste")) |>
  filter(voix_officielles != voix_extraites)
if (nrow(total_audit) > 0) {
  stop("Les totaux extraits des PDF ne correspondent pas aux totaux officiels par liste.")
}

# Les sources 2019 et 2026 n'orthographient pas toutes les communes de la même
# façon ; les noms 2026 servent de référence pour les synthèses communales.
commune_names_2019 <- c("Houailou" = "Houaïlou", "Kaala Gomen" = "Kaala-Gomen")
harmonise_commune_2019 <- function(x) {
  ifelse(x %in% names(commune_names_2019), unname(commune_names_2019[x]), x)
}

bureaux_2019 <- read_csv(
  source_2019_bureaux,
  show_col_types = FALSE,
  col_types = cols(code_bv = col_character())
) |>
  mutate(
    commune = harmonise_commune_2019(commune),
    code_bv = fmt_code_bv(code_bv),
    spatial_include = !(
      province == "Province des Iles" & commune == "Lifou" & code_bv == "0001"
    )
  )
bureaux_2019_long <- read_csv(
  source_2019_listes,
  show_col_types = FALSE,
  col_types = cols(code_bv = col_character())
) |>
  mutate(
    commune = harmonise_commune_2019(commune),
    code_bv = fmt_code_bv(code_bv),
    numero_liste = as.integer(numero_liste)
  )

# Les regroupements privilégient des continuités politiques interprétables.
# Le bloc indépendantiste reprend le classement historique du jeu consolidé ;
# Faire Pays reste donc hors de ce total en 2026.
# UNI-Palika reprend le jaune des listes UNI publié dans les résultats 2026.
force_definitions <- tribble(
  ~province, ~force, ~force_label, ~force_short, ~couleur, ~ordre,
  "Province Sud", "bloc_independantiste", "Vote indépendantiste", "Indépendantistes", "#2f925d", 1,
  "Province Sud", "loyaliste", "Droite loyaliste", "Loyalistes", "#305f9f", 2,
  "Province Sud", "centre_non_ind", "Centre non-indépendantiste", "Centre", "#67a9cf", 3,
  "Province Sud", "oceanien", "Éveil océanien", "Éveil océanien", "#16a5ad", 4,
  "Province Sud", "droite_nationale", "Droite nationale", "Droite nationale", "#7a4a28", 5,
  "Province Sud", "participation", "Participation", "Participation", "#d18b24", 6,
  "Province Nord", "bloc_independantiste", "Bloc indépendantiste", "Indépendantistes", "#2f925d", 1,
  "Province Nord", "uc_flnks", "Union calédonienne – FLNKS", "UC-FLNKS", "#3b7e4f", 2,
  "Province Nord", "uni_palika", "UNI – Palika", "UNI-Palika", "#f0c52f", 3,
  "Province Nord", "autres_ind_nord", "Autres listes indépendantistes", "Autres indép.", "#b6483b", 4,
  "Province Nord", "non_ind_nord", "Listes non-indépendantistes", "Non-indép.", "#305f9f", 5,
  "Province Nord", "participation", "Participation", "Participation", "#d18b24", 6,
  "Province des Iles", "bloc_independantiste", "Bloc indépendantiste", "Indépendantistes", "#2f925d", 1,
  "Province des Iles", "uc_flnks", "Union calédonienne – FLNKS", "UC-FLNKS", "#3b7e4f", 2,
  "Province des Iles", "uni_palika", "UNI – Palika", "UNI-Palika", "#f0c52f", 3,
  "Province des Iles", "dynamique_autochtone", "Dynamique autochtone", "Dyn. autochtone", "#d18b24", 4,
  "Province des Iles", "autres_ind_iles", "Autres listes indépendantistes", "Autres indép.", "#b6483b", 5,
  "Province des Iles", "non_ind_iles", "Listes non-indépendantistes", "Non-indép.", "#305f9f", 6,
  "Province des Iles", "participation", "Participation", "Participation", "#8a6b34", 7
)

force_mapping <- tribble(
  ~province, ~annee, ~numero_liste, ~force,
  "Province Sud", 2019, 1, "bloc_independantiste",
  "Province Sud", 2019, 4, "bloc_independantiste",
  "Province Sud", 2019, 7, "bloc_independantiste",
  "Province Sud", 2019, 3, "loyaliste",
  "Province Sud", 2019, 11, "centre_non_ind",
  "Province Sud", 2019, 6, "oceanien",
  "Province Sud", 2019, 2, "droite_nationale",
  "Province Sud", 2026, 2, "bloc_independantiste",
  "Province Sud", 2026, 6, "bloc_independantiste",
  "Province Sud", 2026, 11, "bloc_independantiste",
  "Province Sud", 2026, 10, "loyaliste",
  "Province Sud", 2026, 5, "centre_non_ind",
  "Province Sud", 2026, 9, "centre_non_ind",
  "Province Sud", 2026, 12, "centre_non_ind",
  "Province Sud", 2026, 1, "oceanien",
  "Province Sud", 2026, 3, "droite_nationale",
  "Province Sud", 2026, 8, "droite_nationale",
  "Province Nord", 2019, 1, "bloc_independantiste",
  "Province Nord", 2019, 4, "bloc_independantiste",
  "Province Nord", 2019, 5, "bloc_independantiste",
  "Province Nord", 2019, 6, "bloc_independantiste",
  "Province Nord", 2019, 6, "uc_flnks",
  "Province Nord", 2019, 1, "uni_palika",
  "Province Nord", 2019, 4, "autres_ind_nord",
  "Province Nord", 2019, 5, "autres_ind_nord",
  "Province Nord", 2019, 2, "non_ind_nord",
  "Province Nord", 2019, 3, "non_ind_nord",
  "Province Nord", 2026, 2, "bloc_independantiste",
  "Province Nord", 2026, 3, "bloc_independantiste",
  "Province Nord", 2026, 5, "bloc_independantiste",
  "Province Nord", 2026, 3, "uc_flnks",
  "Province Nord", 2026, 5, "uni_palika",
  "Province Nord", 2026, 2, "autres_ind_nord",
  "Province Nord", 2026, 1, "non_ind_nord",
  "Province des Iles", 2019, 1, "bloc_independantiste",
  "Province des Iles", 2019, 2, "bloc_independantiste",
  "Province des Iles", 2019, 3, "bloc_independantiste",
  "Province des Iles", 2019, 5, "bloc_independantiste",
  "Province des Iles", 2019, 7, "bloc_independantiste",
  "Province des Iles", 2019, 8, "bloc_independantiste",
  "Province des Iles", 2019, 2, "uc_flnks",
  "Province des Iles", 2019, 8, "uni_palika",
  "Province des Iles", 2019, 5, "dynamique_autochtone",
  "Province des Iles", 2019, 1, "autres_ind_iles",
  "Province des Iles", 2019, 3, "autres_ind_iles",
  "Province des Iles", 2019, 7, "autres_ind_iles",
  "Province des Iles", 2019, 4, "non_ind_iles",
  "Province des Iles", 2019, 6, "non_ind_iles",
  "Province des Iles", 2026, 1, "bloc_independantiste",
  "Province des Iles", 2026, 3, "bloc_independantiste",
  "Province des Iles", 2026, 4, "bloc_independantiste",
  "Province des Iles", 2026, 5, "bloc_independantiste",
  "Province des Iles", 2026, 6, "bloc_independantiste",
  "Province des Iles", 2026, 7, "bloc_independantiste",
  "Province des Iles", 2026, 5, "uc_flnks",
  "Province des Iles", 2026, 1, "uni_palika",
  "Province des Iles", 2026, 4, "dynamique_autochtone",
  "Province des Iles", 2026, 3, "autres_ind_iles",
  "Province des Iles", 2026, 6, "autres_ind_iles",
  "Province des Iles", 2026, 7, "autres_ind_iles",
  "Province des Iles", 2026, 2, "non_ind_iles"
)

make_force_rows <- function(base, votes, year) {
  base_minimal <- base |>
    transmute(
      province, annee = year, commune, code_bv, bureau_nom, longitude, latitude,
      inscrits, votants, exprimes, spatial_include, iris_codgeo, iris_libgeo
    )

  aggregated_votes <- votes |>
    inner_join(
      force_mapping |> filter(annee == year),
      by = c("province", "numero_liste"),
      relationship = "many-to-many"
    ) |>
    group_by(province, commune, code_bv, force) |>
    summarise(voix = sum(voix), .groups = "drop")

  political_forces <- force_definitions |>
    filter(force != "participation") |>
    select(province, force)

  scores <- base_minimal |>
    inner_join(political_forces, by = "province", relationship = "many-to-many") |>
    left_join(aggregated_votes, by = c("province", "commune", "code_bv", "force")) |>
    mutate(voix = replace_na(voix, 0), denominateur = exprimes, pct = 100 * voix / denominateur)

  participation <- base_minimal |>
    mutate(force = "participation", voix = votants, denominateur = inscrits, pct = 100 * voix / denominateur)

  bind_rows(scores, participation) |>
    left_join(force_definitions, by = c("province", "force"))
}

force_rows_2019 <- make_force_rows(bureaux_2019, bureaux_2019_long, 2019)
force_rows_2026 <- make_force_rows(bureaux_2026_wide, bureaux_2026_long, 2026)
bureaux_forces <- bind_rows(force_rows_2019, force_rows_2026) |>
  arrange(province, ordre, annee, commune, code_bv)

province_summary <- bureaux_forces |>
  group_by(province, annee, force, force_label, force_short, couleur, ordre) |>
  summarise(voix = sum(voix), base = sum(denominateur), score = 100 * voix / base, bureaux = n(), .groups = "drop") |>
  group_by(province, force) |>
  mutate(
    score_2019 = score[annee == 2019][1],
    score_2026 = score[annee == 2026][1],
    evolution_points = score_2026 - score_2019
  ) |>
  ungroup()

commune_summary <- bureaux_forces |>
  group_by(province, annee, commune, force, force_label, couleur, ordre) |>
  summarise(
    voix = sum(voix), base = sum(denominateur), score = 100 * voix / base,
    inscrits = sum(inscrits), votants = sum(votants), exprimes = sum(exprimes),
    .groups = "drop"
  ) |>
  group_by(province, commune, force) |>
  mutate(
    score_2019 = score[annee == 2019][1],
    score_2026 = score[annee == 2026][1],
    evolution_points = score_2026 - score_2019
  ) |>
  ungroup()

office_winners_2026 <- bureaux_2026_long |>
  group_by(province, commune, code_bv) |>
  slice_max(voix, n = 1, with_ties = FALSE) |>
  ungroup() |>
  transmute(
    province, commune, code_bv, bureau_nom, inscrits, votants, exprimes,
    numero_liste, liste, etiquette, voix, pct_exprimes, longitude, latitude
  )

write_csv(
  bureaux_2026_wide |>
    select(
      province, commune, code_bv, bureau_nom, inscrits, votants, participation,
      abstentions, abstention, nuls, blancs, exprimes, longitude, latitude,
      geo_source, spatial_include, iris_codgeo, iris_libgeo, starts_with("voix_")
    ),
  file.path(out_dir, "provinciales_2026_bureaux_nc.csv")
)
write_csv(
  bureaux_2026_long |>
    select(
      province, commune, code_bv, bureau_nom, inscrits, votants, exprimes,
      numero_liste, liste, etiquette, voix, pct_exprimes, longitude, latitude
    ),
  file.path(out_dir, "provinciales_2026_listes_bureaux_nc.csv")
)
write_csv(
  bureaux_forces |>
    select(
      province, annee, commune, code_bv, bureau_nom, longitude, latitude,
      inscrits, votants, exprimes, force, force_label, force_short, couleur,
      ordre, voix, denominateur, pct, spatial_include, iris_codgeo, iris_libgeo
    ),
  file.path(out_dir, "bureaux_forces_2019_2026.csv")
)
write_csv(province_summary, file.path(out_dir, "synthese_province.csv"))
write_csv(commune_summary, file.path(out_dir, "synthese_communes.csv"))

# Listes individuelles -------------------------------------------------------
# Les listes ne se succèdent pas terme à terme entre 2019 et 2026 : chacune est
# cartographiée pour son année seule. Les voix par bureau sont publiées sans
# répéter les attributs des bureaux, déjà présents dans bureaux_forces.

# Noms courts du référentiel 2019, saisis sans accents : seuls les accents et
# apostrophes typographiques sont rétablis pour l'affichage.
liste_labels_2019 <- c(
  "L'Avenir en confiance" = "L’Avenir en confiance",
  "L'Eveil oceanien" = "L’Éveil océanien",
  "Caledoniens Ensemble" = "Calédoniens ensemble",
  "Caledoniens Ensemble Nord" = "Calédoniens ensemble (Nord)",
  "Caledonie nouvelle et reunie" = "Calédonie nouvelle et réunie",
  "Destin commun caledonien" = "Destin commun calédonien",
  "Nouvelle vision des Iles" = "Nouvelle vision des Îles",
  "MNIS Iles" = "MNIS Îles",
  "Palika Iles" = "Palika Îles",
  "Unitaire Kanaky Generation" = "Unitaire Kanaky Génération"
)
display_label_2019 <- function(x) {
  ifelse(x %in% names(liste_labels_2019), unname(liste_labels_2019[x]), x)
}

# Couleur d'une liste 2019 : celle de la famille politique à laquelle elle est
# rattachée dans force_mapping (famille la plus spécifique), sinon un gris.
couleurs_2019 <- force_mapping |>
  filter(annee == 2019) |>
  left_join(force_definitions |> select(province, force, couleur), by = c("province", "force")) |>
  mutate(priorite = if_else(force == "bloc_independantiste", 2L, 1L)) |>
  arrange(province, numero_liste, priorite) |>
  distinct(province, numero_liste, .keep_all = TRUE) |>
  select(province, numero_liste, couleur)

listes_2019 <- read_csv(source_listes_2019, show_col_types = FALSE) |>
  filter(annee == 2019) |>
  transmute(
    province, annee = 2019L, numero_liste = as.integer(numero_liste),
    liste_nom, liste_label = display_label_2019(liste_nom_court),
    voix_reference = voix_2019
  ) |>
  left_join(couleurs_2019, by = c("province", "numero_liste")) |>
  mutate(couleur = coalesce(couleur, "#7d7468"))

listes_2026 <- listes_2026_reference |>
  transmute(
    province, annee = 2026L, numero_liste = as.integer(numero_liste),
    liste_nom = liste,
    liste_label = if_else(
      str_detect(liste, fixed(etiquette)) | str_starts(etiquette, fixed(liste)),
      liste,
      paste0(liste, " (", etiquette, ")")
    ),
    voix_reference = NA_real_,
    couleur
  )

listes_voix <- bind_rows(
  bureaux_2019_long |>
    transmute(province, annee = 2019L, commune, code_bv, numero_liste, voix),
  bureaux_2026_long |>
    transmute(province, annee = 2026L, commune, code_bv, numero_liste, voix)
) |>
  mutate(liste_id = sprintf("%d-%02d", annee, numero_liste))

exprimes_annee <- bureaux_forces |>
  filter(force == "participation") |>
  group_by(province, annee) |>
  summarise(exprimes = sum(exprimes), .groups = "drop")

listes_catalogue <- bind_rows(listes_2019, listes_2026) |>
  mutate(
    liste_id = sprintf("%d-%02d", annee, numero_liste),
    liste_label = str_replace_all(liste_label, "'", "’")
  ) |>
  left_join(
    listes_voix |> group_by(province, annee, liste_id) |> summarise(voix = sum(voix), .groups = "drop"),
    by = c("province", "annee", "liste_id")
  ) |>
  left_join(exprimes_annee, by = c("province", "annee")) |>
  mutate(score = 100 * voix / exprimes) |>
  group_by(province, annee) |>
  mutate(ordre = rank(-voix, ties.method = "first")) |>
  ungroup()

# Contrôles : toutes les listes ont des voix, et les voix 2019 recalculées à
# partir des bureaux égalent celles du référentiel.
if (anyNA(listes_catalogue$voix)) stop("Une liste du catalogue n'a aucune voix par bureau.")
audit_2019 <- listes_catalogue |>
  filter(annee == 2019, voix != voix_reference)
if (nrow(audit_2019) > 0) stop("Voix 2019 par liste différentes du référentiel.")
if (nrow(listes_voix |> distinct(province, annee, numero_liste)) != nrow(listes_catalogue)) {
  stop("Listes présentes dans les bureaux mais absentes du catalogue.")
}

write_csv(
  listes_catalogue |>
    select(province, annee, liste_id, numero_liste, liste_nom, liste_label, couleur, voix, exprimes, score, ordre),
  file.path(out_dir, "listes_2019_2026.csv")
)
write_csv(
  listes_voix |> select(province, annee, commune, code_bv, liste_id, voix),
  file.path(out_dir, "bureaux_listes_2019_2026.csv")
)
write_csv(office_winners_2026, file.path(out_dir, "vainqueurs_bureaux_2026.csv"))

province_labels <- c(
  "PROVINCE SUD" = "Province Sud",
  "PROVINCE NORD" = "Province Nord",
  "PROVINCE DES ILES" = "Province des Iles"
)
provinces_geo <- st_read(source_provinces, quiet = TRUE) |>
  st_zm(drop = TRUE, what = "ZM") |>
  st_make_valid() |>
  transmute(province = unname(province_labels[nom])) |>
  st_transform(3163)

communes_geo <- st_read(source_communes_geo, quiet = TRUE) |>
  st_zm(drop = TRUE, what = "ZM") |>
  st_make_valid() |>
  transmute(commune = as.character(commune)) |>
  st_transform(3163)

communes_by_province <- suppressWarnings(st_intersection(communes_geo, provinces_geo)) |>
  st_simplify(dTolerance = 120) |>
  st_transform(4326) |>
  select(province, commune)
provinces_export <- provinces_geo |>
  st_simplify(dTolerance = 180) |>
  st_transform(4326)

st_write(provinces_export, file.path(out_dir, "provinces.geojson"), delete_dsn = TRUE, quiet = TRUE)
st_write(communes_by_province, file.path(out_dir, "communes.geojson"), delete_dsn = TRUE, quiet = TRUE)

counts_2019 <- bureaux_2019 |> count(province, name = "bureaux")
counts_2026 <- bureaux_2026_wide |> count(province, name = "bureaux")
metadata <- list(
  title = "Géographie des forces politiques aux provinciales 2026",
  geographic_scope = "Nouvelle-Calédonie, trois provinces",
  years = c(2019, 2026),
  smoothing = list(
    method = "Noyau gaussien pondéré par les suffrages exprimés ou les inscrits",
    bandwidth_km = list("Province Sud" = 12, "Province Nord" = 12, "Province des Iles" = 8),
    display_radius_km = list("Province Sud" = 36, "Province Nord" = 36, "Province des Iles" = 24),
    note = paste(
      "Chaque score lissé est le rapport entre les voix et les exprimés lissés séparément.",
      "Pour la participation, le numérateur est le nombre de votants et le dénominateur le nombre d'inscrits."
    ),
    # Vue agrandie : une portée de 12 km uniformiserait l'agglomération. À
    # Nouméa, la distance au lieu de vote voisin le plus proche est de 0,6 km
    # en médiane et 1,5 km au plus (2026). Emprise en degrés WGS 84.
    zoom_views = list(
      grand_noumea = list(
        label = "Grand Nouméa",
        province = "Province Sud",
        communes = c("Nouméa", "Dumbéa", "Mont-Dore", "Païta"),
        bbox = c(166.34, -22.32, 166.64, -22.11),
        bandwidth_km = 1.5,
        display_radius_km = 4.5
      )
    )
  ),
  counts = list(
    bureaux_2019 = as.list(setNames(counts_2019$bureaux, counts_2019$province)),
    bureaux_2026 = as.list(setNames(counts_2026$bureaux, counts_2026$province)),
    bureaux_hors_carte = list(
      "2019" = sum(!bureaux_2019$spatial_include),
      "2026" = sum(!bureaux_2026_wide$spatial_include)
    )
  ),
  checks = list(
    arithmetic_rows_2026 = TRUE,
    official_list_totals_2026 = TRUE,
    geolocation_complete_2026 = TRUE
  ),
  sources = list(
    results_2026_bureaux = vapply(pdf_specs, function(x) file.path("data/elections/data_raw/provinciales_2026", basename(x$file)), character(1)),
    results_2026_official_totals = "data/elections/data_processed/provinciales_2026/provinciales_2026_resultats_province_listes.csv",
    results_2019 = "data/elections/data_processed/provinciales_2019_listes_long_geolocalisees.csv",
    geolocation = "data/elections/data_processed/bureaux_reference_geolocalises.csv"
  )
)
write_json(metadata, file.path(out_dir, "metadata.json"), pretty = TRUE, auto_unbox = TRUE)

cat("Exports créés :", out_dir, "\n")
print(counts_2019)
print(counts_2026)
