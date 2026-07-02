library(dplyr)
library(ggplot2)
library(glue)
library(htmltools)
library(jsonlite)
library(readr)
library(scales)
library(stringr)
library(tibble)
library(tidyr)

this_article_dir <- if (exists("article_dir")) {
  article_dir
} else {
  file.path("posts", "provinciales-2026-renouvellement-elus")
}

source(
  file.path(this_article_dir, "..", "provinciales-2026-qui-part-qui-reste", "analysis.R"),
  local = environment(),
  encoding = "UTF-8"
)

path_resultats_2026 <- file.path(
  project_dir,
  "data", "elections", "data_processed", "provinciales_2026",
  "provinciales_2026_resultats_province_listes.csv"
)

path_resultats_municipales_2026 <- file.path(
  project_dir,
  "data", "elections", "data_processed", "municipales_2026",
  "municipales_2026_resultats_communes_listes.csv"
)

if (!file.exists(path_resultats_2026)) {
  stop("Fichier de resultats manquant: ", path_resultats_2026)
}

if (!file.exists(path_resultats_municipales_2026)) {
  stop("Fichier de resultats municipaux manquant: ", path_resultats_municipales_2026)
}

resultats_2026_listes <- read_csv(
  path_resultats_2026,
  show_col_types = FALSE,
  locale = locale(encoding = "UTF-8")
) |>
  filter(commune == "Total") |>
  select(
    province, numero_liste,
    liste_resultat = liste,
    etiquette, nuance, couleur,
    voix, pct_exprimes, pct_inscrits,
    sieges_province, sieges_congres,
    source, source_note
  ) |>
  mutate(
    sieges_province = as.integer(coalesce(sieges_province, 0L)),
    sieges_congres = as.integer(coalesce(sieges_congres, 0L))
  )

source_resultats_url <- resultats_2026_listes |>
  distinct(source) |>
  pull(source) |>
  first()

source_resultats_note <- resultats_2026_listes |>
  distinct(source_note) |>
  pull(source_note) |>
  first()

resultats_municipales_2026 <- read_csv(
  path_resultats_municipales_2026,
  show_col_types = FALSE,
  locale = locale(encoding = "UTF-8")
) |>
  transmute(
    commune_code,
    commune,
    numero_liste_municipale = as.integer(numero_liste_municipale),
    liste_municipale_resultats = liste_municipale,
    nuance_municipale = nuance,
    tete_liste_municipale = tete_liste,
    voix_municipales = voix,
    pct_exprimes_municipales = pct_exprimes,
    sieges_municipaux = as.integer(coalesce(sieges, 0L)),
    tour_retenu_municipales = as.integer(tour_retenu),
    source_pdf_municipales = source_pdf,
    source_url_municipales = source_url
  )

municipales_2026_detail <- municipales_2026 |>
  mutate(numero_liste_municipale = suppressWarnings(as.integer(numero_liste_municipale))) |>
  filter(
    !is.na(numero_liste_municipale),
    numero_liste_municipale < 100,
    !str_detect(liste_municipale, regex("^\\s*-\\s*Nouvelle-Cal[ée]donie", ignore_case = TRUE))
  ) |>
  left_join(
    resultats_municipales_2026,
    by = c("commune_code", "commune", "numero_liste_municipale")
  ) |>
  mutate(
    sieges_municipaux = replace_na(sieges_municipaux, 0L),
    elu_municipal_2026 = rang_municipal <= sieges_municipaux,
    liste_municipale_resultats = coalesce(liste_municipale_resultats, liste_municipale),
    municipal_label_detail = glue(
      "{display_text(liste_municipale_resultats)} ({display_text(commune)})"
    ),
    municipal_elected_label_detail = if_else(
      elu_municipal_2026,
      glue("{display_text(commune)} - {display_text(liste_municipale_resultats)}"),
      NA_character_
    )
  )

municipales_detail_tokens <- municipales_2026_detail$nom_cle_municipales |>
  lapply(name_tokens)

municipal_detail_match_indices <- function(x) {
  tokens <- name_tokens(x)
  if (length(tokens) < 2) return(integer())

  which(vapply(municipales_detail_tokens, function(municipal_tokens) {
    length(municipal_tokens) >= 2 &&
      (all(tokens %in% municipal_tokens) || all(municipal_tokens %in% tokens))
  }, logical(1)))
}

candidate_keys_2026 <- candidats |>
  filter(annee == 2026) |>
  distinct(nom_cle_comparaison) |>
  pull(nom_cle_comparaison)

municipal_matches_2026 <- bind_rows(lapply(candidate_keys_2026, function(key) {
  idx <- municipal_detail_match_indices(key)
  if (length(idx) == 0) return(tibble())

  municipales_2026_detail[idx, ] |>
    mutate(nom_cle_comparaison = key)
}))

municipal_candidate_summary <- municipal_matches_2026 |>
  group_by(nom_cle_comparaison) |>
  summarise(
    candidat_municipal_2026_detail = TRUE,
    elu_municipal_2026 = any(elu_municipal_2026, na.rm = TRUE),
    communes_municipales = paste(sort(unique(display_text(commune))), collapse = " ; "),
    communes_elues_municipales = paste(
      sort(unique(display_text(commune[elu_municipal_2026]))),
      collapse = " ; "
    ),
    listes_municipales = paste(sort(unique(municipal_label_detail)), collapse = " ; "),
    listes_elues_municipales = paste(
      sort(unique(na.omit(municipal_elected_label_detail))),
      collapse = " ; "
    ),
    nb_candidatures_municipales = n(),
    nb_mandats_municipaux = sum(elu_municipal_2026, na.rm = TRUE),
    .groups = "drop"
  ) |>
  mutate(
    communes_elues_municipales = na_if(communes_elues_municipales, ""),
    listes_elues_municipales = na_if(listes_elues_municipales, "")
  )

origin_meta <- tribble(
  ~origin_code, ~origin_label, ~origin_short, ~origin_note, ~origin_color, ~origin_order,
  "sortant_2019", "Élu 2019 reconduit", "Sortant 2019", "Déjà élu dans une assemblée provinciale issue du scrutin 2019.", "#264653", 1L,
  "ancien_candidat_2019", "Candidat 2019 non élu", "Candidat 2019", "Déjà candidat aux provinciales 2019, mais non élu alors.", "#6d8f71", 2L,
  "elu_municipal_2026_non_2019", "Élu municipal 2026, absent des provinciales 2019", "Élu municipal", "Absent des provinciales 2019, mais élu sur une liste municipale 2026.", "#2f8fb8", 3L,
  "candidat_municipal_2026_non_2019", "Candidat municipal 2026 non élu, absent des provinciales 2019", "Candidat municipal", "Absent des provinciales 2019, mais candidat aux municipales 2026 sans siège municipal repéré.", "#c77d2a", 4L,
  "jamais_candidat_repere", "Non repéré dans les sources", "Non repéré", "Non retrouvé dans les listes provinciales 2019 ni dans les municipales 2026 utilisées ici.", "#e76f51", 5L
)

origin_levels <- origin_meta$origin_code

municipal_anchor_meta <- tribble(
  ~municipal_anchor_code, ~municipal_anchor_label, ~municipal_anchor_short, ~municipal_anchor_color, ~municipal_anchor_order,
  "elu_municipal_2026", "Élu municipal 2026", "Élu municipal", "#2f8fb8", 1L,
  "candidat_municipal_2026_non_elu", "Candidat municipal 2026 non élu", "Candidat municipal", "#c77d2a", 2L,
  "pas_de_candidature_municipale", "Pas de candidature municipale repérée", "Pas de signal municipal", "#c9c9c9", 3L
)

municipal_anchor_levels <- municipal_anchor_meta$municipal_anchor_code

source_hatvp_metzdorf_yamamoto <- "https://www.hatvp.fr/fiche-nominative/?declarant=metzdorf-nicolas"
source_lemonde_perrin_saint_louis <- "https://www.lemonde.fr/article-offert/88c7b6965381-6653399/en-nouvelle-caledonie-la-route-de-saint-louis-impasse-securitaire-et-politique"
source_mnc_ukeiwe <- "https://www.mncparis.fr/actualites/album-photos/temps-d-echange-a-la-mnc-entre-une-delegation-de-l-association-des-policiers-caledoniens-en-france-et-marie-laure-ukeiwe-collaboratrice-de-la-presidence-de-la-province-sud-a-propos-des-realites-que-vivent-les-agents-caledoniens-en"
source_facebook_rossard <- "https://www.facebook.com/xavierrossard.nc/"

profile_signal_meta <- tribble(
  ~nom_cle_comparaison, ~profile_signal_label, ~profile_signal_detail, ~profile_signal_source,
  "NICOLAS YAMAMOTO", "Collab. parlementaire", "Collaborateur parlementaire de Nicolas Metzdorf", source_hatvp_metzdorf_yamamoto,
  "FLORENT PERRIN", "Collab. province Sud", "Collaborateur au cabinet de la présidente de la province Sud", source_lemonde_perrin_saint_louis,
  "LAURE MARIE UKEIWE", "Collab. province Sud", "Collaboratrice de la présidence de la province Sud", source_mnc_ukeiwe,
  "ROSSARD XAVIER", "Dir. cab. Rassemblement-LR", "Directeur de cabinet du groupe Rassemblement-LR au Congrès de la Nouvelle-Calédonie", source_facebook_rossard
)

province_label_2026 <- function(x) {
  recode(
    clean_label(x),
    "Province des Iles" = "Province des Îles",
    .default = clean_label(x)
  )
}

province_short_2026 <- function(x) {
  recode(
    clean_label(x),
    "Province des Iles" = "Îles",
    "Province Nord" = "Nord",
    "Province Sud" = "Sud",
    .default = clean_label(x)
  )
}

pretty_list_label <- function(x) {
  clean_label(x, missing = "Liste non renseignée") |>
    str_replace_all(regex("\\bIles\\b", ignore_case = TRUE), "Îles") |>
    str_replace_all(regex("\\bEveil\\b", ignore_case = TRUE), "Éveil")
}

match_side_2026 <- matches_enriched |>
  arrange(desc(elu_2019), rang_2019) |>
  distinct(nom_cle_comparaison_2026, .keep_all = TRUE) |>
  select(
    nom_cle_comparaison_2026,
    nom_cle_comparaison_2019,
    province_2019,
    liste_id_2019,
    liste_nom_court_2019,
    rang_2019,
    elu_2019_match = elu_2019,
    meme_liste_court,
    meme_axe_politique
  )

elus_2026_base <- candidats |>
  filter(annee == 2026) |>
  left_join(resultats_2026_listes, by = c("province", "numero_liste")) |>
  mutate(
    sieges_province = coalesce(sieges_province, 0L),
    sieges_congres = coalesce(sieges_congres, 0L),
    elu_province_2026 = rang <= sieges_province,
    elu_congres_2026 = rang <= sieges_congres
  )

elus_2026 <- elus_2026_base |>
  left_join(
    match_side_2026,
    by = c("nom_cle_comparaison" = "nom_cle_comparaison_2026")
  ) |>
  left_join(
    municipal_candidate_summary,
    by = "nom_cle_comparaison"
  ) |>
  left_join(
    profile_signal_meta,
    by = "nom_cle_comparaison"
  ) |>
  mutate(
    candidat_municipal_2026_detail = coalesce(candidat_municipal_2026_detail, FALSE),
    elu_municipal_2026 = coalesce(elu_municipal_2026, FALSE),
    communes_municipales = na_if(coalesce(communes_municipales, ""), ""),
    communes_elues_municipales = na_if(coalesce(communes_elues_municipales, ""), ""),
    listes_municipales = na_if(coalesce(listes_municipales, ""), ""),
    listes_elues_municipales = na_if(coalesce(listes_elues_municipales, ""), ""),
    nb_candidatures_municipales = replace_na(nb_candidatures_municipales, 0L),
    nb_mandats_municipaux = replace_na(nb_mandats_municipaux, 0L),
    ancien_elu_2019 = coalesce(elu_2019_match, FALSE),
    origin_code = case_when(
      ancien_elu_2019 ~ "sortant_2019",
      !is.na(nom_cle_comparaison_2019) ~ "ancien_candidat_2019",
      elu_municipal_2026 ~ "elu_municipal_2026_non_2019",
      candidat_municipal_2026_detail ~ "candidat_municipal_2026_non_2019",
      TRUE ~ "jamais_candidat_repere"
    ),
    municipal_anchor_code = case_when(
      elu_municipal_2026 ~ "elu_municipal_2026",
      candidat_municipal_2026_detail ~ "candidat_municipal_2026_non_elu",
      TRUE ~ "pas_de_candidature_municipale"
    ),
    municipal_anchor_label = recode(
      municipal_anchor_code,
      "elu_municipal_2026" = "Élu municipal 2026",
      "candidat_municipal_2026_non_elu" = "Candidat municipal 2026 non élu",
      "pas_de_candidature_municipale" = "Pas de candidature municipale repérée"
    ),
    nouveau_elu_provincial = !ancien_elu_2019,
    province_label = province_label_2026(province),
    province_short = province_short_2026(province),
    liste_label = pretty_list_label(coalesce(etiquette, liste_nom_court)),
    liste_long_label = pretty_list_label(liste_nom_court),
    axe_label = axis_display(axe_politique),
    origin_code = factor(origin_code, levels = origin_levels)
  ) |>
  left_join(origin_meta, by = c("origin_code" = "origin_code")) |>
  left_join(
    municipal_anchor_meta |>
      select(
        municipal_anchor_code,
        municipal_anchor_short,
        municipal_anchor_color,
        municipal_anchor_order
      ),
    by = "municipal_anchor_code"
  )

elus_province_2026 <- elus_2026 |>
  filter(elu_province_2026)

elus_congres_2026 <- elus_2026 |>
  filter(elu_congres_2026)

n_elus_2026 <- nrow(elus_province_2026)
n_elus_congres_2026 <- nrow(elus_congres_2026)
n_elus_2019 <- candidats |>
  filter(annee == 2019, elu_2019) |>
  distinct(nom_cle_comparaison) |>
  nrow()

n_sortants_representes_2026 <- matches_enriched |>
  filter(elu_2019) |>
  distinct(nom_cle_comparaison_2019) |>
  nrow()

n_sortants_reelus_2026 <- elus_province_2026 |>
  filter(ancien_elu_2019) |>
  distinct(nom_cle_comparaison) |>
  nrow()

n_sortants_representes_non_elus <- n_sortants_representes_2026 - n_sortants_reelus_2026
n_sortants_absents_2026 <- n_elus_2019 - n_sortants_representes_2026
n_nouveaux_elus_2026 <- n_elus_2026 - n_sortants_reelus_2026
pct_nouveaux_elus_2026 <- n_nouveaux_elus_2026 / n_elus_2026
pct_sortants_reelus_2026 <- n_sortants_reelus_2026 / n_elus_2026

n_sortants_congres_2026 <- elus_congres_2026 |>
  filter(ancien_elu_2019) |>
  nrow()

n_nouveaux_congres_2026 <- n_elus_congres_2026 - n_sortants_congres_2026

n_elus_provinciaux_candidats_municipaux_2026 <- elus_province_2026 |>
  filter(candidat_municipal_2026_detail) |>
  nrow()

n_elus_provinciaux_elus_municipaux_2026 <- elus_province_2026 |>
  filter(elu_municipal_2026) |>
  nrow()

n_elus_provinciaux_candidats_municipaux_non_elus_2026 <-
  n_elus_provinciaux_candidats_municipaux_2026 - n_elus_provinciaux_elus_municipaux_2026

n_jamais_candidats_reperes_2026 <- elus_province_2026 |>
  filter(origin_code == "jamais_candidat_repere") |>
  nrow()

n_jamais_candidats_reperes_congres_2026 <- elus_congres_2026 |>
  filter(origin_code == "jamais_candidat_repere") |>
  nrow()

n_nouveaux_elus_provinciaux_jamais_candidats_reperes_2026 <- elus_province_2026 |>
  filter(nouveau_elu_provincial, origin_code == "jamais_candidat_repere") |>
  nrow()

n_nouveaux_elus_provinciaux_candidats_municipaux_2026 <- elus_province_2026 |>
  filter(nouveau_elu_provincial, candidat_municipal_2026_detail) |>
  nrow()

n_nouveaux_elus_provinciaux_elus_municipaux_2026 <- elus_province_2026 |>
  filter(nouveau_elu_provincial, elu_municipal_2026) |>
  nrow()

pct_elus_provinciaux_candidats_municipaux_2026 <-
  n_elus_provinciaux_candidats_municipaux_2026 / n_elus_2026

pct_elus_provinciaux_elus_municipaux_2026 <-
  n_elus_provinciaux_elus_municipaux_2026 / n_elus_2026

pct_jamais_candidats_reperes_2026 <- n_jamais_candidats_reperes_2026 / n_elus_2026

origin_summary <- elus_province_2026 |>
  count(origin_code, origin_label, origin_short, origin_color, origin_order, name = "n") |>
  right_join(origin_meta, by = c("origin_code", "origin_label", "origin_short", "origin_color", "origin_order")) |>
  mutate(
    n = replace_na(n, 0L),
    pct = n / n_elus_2026
  ) |>
  arrange(origin_order)

origin_count <- function(code) {
  origin_summary |>
    filter(origin_code == code) |>
    pull(n) |>
    first() |>
    coalesce(0L)
}

municipal_anchor_summary <- elus_province_2026 |>
  count(municipal_anchor_code, municipal_anchor_label, name = "n") |>
  right_join(municipal_anchor_meta, by = c("municipal_anchor_code", "municipal_anchor_label")) |>
  mutate(
    n = replace_na(n, 0L),
    pct = n / n_elus_2026
  ) |>
  arrange(municipal_anchor_order)

province_totals <- elus_province_2026 |>
  count(province, province_label, province_short, name = "total") |>
  mutate(
    province_order_plot = match(province, province_order)
  )

province_origin_plot <- province_totals |>
  expand_grid(origin_code = origin_levels) |>
  left_join(
    elus_province_2026 |>
      count(province, origin_code, name = "n"),
    by = c("province", "origin_code")
  ) |>
  mutate(n = replace_na(n, 0L)) |>
  left_join(origin_meta, by = "origin_code") |>
  mutate(
    pct = if_else(total > 0, n / total, 0),
    province_label = factor(province_label, levels = province_totals$province_label[order(province_totals$province_order_plot)])
  ) |>
  arrange(province_order_plot, origin_order)

province_stats <- province_totals |>
  left_join(
    elus_province_2026 |>
      group_by(province) |>
      summarise(
        sortants = sum(ancien_elu_2019, na.rm = TRUE),
        nouveaux = sum(nouveau_elu_provincial, na.rm = TRUE),
        anciens_2019_non_elus = sum(origin_code == "ancien_candidat_2019", na.rm = TRUE),
        elus_municipaux_non_2019 = sum(origin_code == "elu_municipal_2026_non_2019", na.rm = TRUE),
        candidats_municipaux_non_elus_non_2019 = sum(origin_code == "candidat_municipal_2026_non_2019", na.rm = TRUE),
        jamais_candidats_reperes = sum(origin_code == "jamais_candidat_repere", na.rm = TRUE),
        candidats_municipaux = sum(candidat_municipal_2026_detail, na.rm = TRUE),
        elus_municipaux = sum(elu_municipal_2026, na.rm = TRUE),
        .groups = "drop"
      ),
    by = "province"
  ) |>
  mutate(pct_nouveaux = nouveaux / total)

province_row <- function(province_name) {
  province_stats |>
    filter(province == province_name) |>
    slice(1)
}

elus_list_summary <- elus_province_2026 |>
  group_by(
    province, province_label, province_short,
    numero_liste, liste_id, liste_label, liste_long_label,
    etiquette, axe_label, couleur,
    sieges_province, sieges_congres
  ) |>
  summarise(
    sortants = sum(origin_code == "sortant_2019", na.rm = TRUE),
    anciens_2019_non_elus = sum(origin_code == "ancien_candidat_2019", na.rm = TRUE),
    elus_municipaux_non_2019 = sum(origin_code == "elu_municipal_2026_non_2019", na.rm = TRUE),
    candidats_municipaux_non_elus_non_2019 = sum(origin_code == "candidat_municipal_2026_non_2019", na.rm = TRUE),
    jamais_candidats_reperes = sum(origin_code == "jamais_candidat_repere", na.rm = TRUE),
    nouveaux = sum(nouveau_elu_provincial, na.rm = TRUE),
    candidats_municipaux = sum(candidat_municipal_2026_detail, na.rm = TRUE),
    elus_municipaux = sum(elu_municipal_2026, na.rm = TRUE),
    .groups = "drop"
  ) |>
  mutate(
    pct_nouveaux = nouveaux / sieges_province,
    pct_sortants = sortants / sieges_province,
    renouvellement_label = case_when(
      sortants == 0 ~ "Aucun sortant 2019 élu",
      pct_nouveaux < 0.5 ~ "Sortants majoritaires",
      pct_nouveaux < 1 ~ "Mixte",
      TRUE ~ "Aucun sortant 2019 élu"
    ),
    plot_order = dense_rank(
      paste0(
        sprintf("%02d", match(province, province_order)),
        "_",
        sprintf("%03d", 100 - sieges_province),
        "_",
        sprintf("%02d", numero_liste)
      )
    ),
    list_display = glue("{province_short} - {liste_label}")
  ) |>
  arrange(match(province, province_order), desc(sieges_province), numero_liste)

list_row <- function(province_name, numero_liste_value) {
  elus_list_summary |>
    filter(province == province_name, numero_liste == numero_liste_value) |>
    slice(1)
}

province_chart_slug <- function(province_name) {
  recode(
    clean_label(province_name),
    "Province des Iles" = "iles",
    "Province Nord" = "nord",
    "Province Sud" = "sud",
    .default = str_replace_all(str_to_lower(clean_label(province_name)), "[^a-z0-9]+", "-")
  )
}

list_chart_height <- function(data, row_height = 42, base_height = 158, min_height = 310) {
  max(min_height, base_height + n_distinct(data$liste_id) * row_height)
}

geography_chart_height <- function(data, row_height = 32, base_height = 158, min_height = 310) {
  group_count <- n_distinct(data$commune)
  subgroup_count <- n_distinct(data$geo_anchor_short)
  row_count <- group_count * subgroup_count
  max(min_height, base_height + row_count * row_height + max(0, group_count - 1) * 10)
}

list_keys <- elus_list_summary |>
  select(
    province, province_label, province_short,
    numero_liste, liste_id, liste_label, list_display,
    axe_label, couleur, sieges_province, sieges_congres,
    pct_nouveaux, plot_order
  )

list_origin_plot <- list_keys |>
  expand_grid(origin_code = origin_levels) |>
  left_join(
    elus_province_2026 |>
      count(liste_id, origin_code, name = "n"),
    by = c("liste_id", "origin_code")
  ) |>
  mutate(n = replace_na(n, 0L)) |>
  left_join(origin_meta, by = "origin_code") |>
  arrange(plot_order, origin_order)

list_municipal_plot <- list_keys |>
  expand_grid(municipal_anchor_code = municipal_anchor_levels) |>
  left_join(
    elus_province_2026 |>
      count(liste_id, municipal_anchor_code, name = "n"),
    by = c("liste_id", "municipal_anchor_code")
  ) |>
  mutate(n = replace_na(n, 0L)) |>
  left_join(municipal_anchor_meta, by = "municipal_anchor_code") |>
  arrange(plot_order, municipal_anchor_order)

province_municipal_plot <- province_totals |>
  expand_grid(municipal_anchor_code = municipal_anchor_levels) |>
  left_join(
    elus_province_2026 |>
      count(province, municipal_anchor_code, name = "n"),
    by = c("province", "municipal_anchor_code")
  ) |>
  mutate(n = replace_na(n, 0L)) |>
  left_join(municipal_anchor_meta, by = "municipal_anchor_code") |>
  mutate(
    pct = if_else(total > 0, n / total, 0),
    province_label = factor(province_label, levels = province_totals$province_label[order(province_totals$province_order_plot)])
  ) |>
  arrange(province_order_plot, municipal_anchor_order)

municipal_geography <- elus_province_2026 |>
  filter(candidat_municipal_2026_detail, !is.na(communes_municipales)) |>
  separate_rows(communes_municipales, sep = "\\s*;\\s*") |>
  filter(nzchar(communes_municipales)) |>
  count(province, province_label, communes_municipales, name = "n_elus_provinciaux") |>
  arrange(match(province, province_order), desc(n_elus_provinciaux), communes_municipales)

municipal_geography_elected <- elus_province_2026 |>
  filter(elu_municipal_2026, !is.na(communes_elues_municipales)) |>
  separate_rows(communes_elues_municipales, sep = "\\s*;\\s*") |>
  filter(nzchar(communes_elues_municipales)) |>
  count(province, province_label, commune = communes_elues_municipales, name = "n_elus_provinciaux_elus_municipaux") |>
  arrange(match(province, province_order), desc(n_elus_provinciaux_elus_municipaux), commune)

municipal_geography_top <- municipal_geography |>
  group_by(commune = communes_municipales) |>
  summarise(
    n_elus_provinciaux = sum(n_elus_provinciaux),
    provinces = paste(sort(unique(province_label)), collapse = " ; "),
    .groups = "drop"
  ) |>
  arrange(desc(n_elus_provinciaux), commune)

municipal_geography_elected_top <- municipal_geography_elected |>
  group_by(commune) |>
  summarise(
    n_elus_provinciaux_elus_municipaux = sum(n_elus_provinciaux_elus_municipaux),
    provinces = paste(sort(unique(province_label)), collapse = " ; "),
    .groups = "drop"
  ) |>
  arrange(desc(n_elus_provinciaux_elus_municipaux), commune)

municipal_geography_elected_rows <- elus_province_2026 |>
  filter(elu_municipal_2026, !is.na(communes_elues_municipales)) |>
  separate_rows(communes_elues_municipales, sep = "\\s*;\\s*") |>
  filter(nzchar(communes_elues_municipales)) |>
  transmute(
    nom_cle_comparaison,
    province,
    province_label,
    province_short,
    commune = communes_elues_municipales,
    geo_anchor_short = "Élus municipaux",
    geo_anchor_order = 1L,
    geo_fill_style = "hachure",
    status = liste_label,
    color = coalesce(couleur, "#8a8277"),
    order = as.integer(numero_liste)
  )

municipal_geography_candidate_rows <- elus_province_2026 |>
  filter(candidat_municipal_2026_detail, !is.na(communes_municipales)) |>
  separate_rows(communes_municipales, sep = "\\s*;\\s*") |>
  filter(nzchar(communes_municipales)) |>
  transmute(
    nom_cle_comparaison,
    province,
    province_label,
    province_short,
    commune = communes_municipales,
    geo_anchor_short = "Candidats non élus",
    geo_anchor_order = 2L,
    geo_fill_style = "cross-hatch",
    status = liste_label,
    color = coalesce(couleur, "#8a8277"),
    order = as.integer(numero_liste)
  ) |>
  anti_join(
    municipal_geography_elected_rows |>
      select(nom_cle_comparaison, commune),
    by = c("nom_cle_comparaison", "commune")
  )

municipal_geography_plot <- bind_rows(
  municipal_geography_elected_rows,
  municipal_geography_candidate_rows
) |>
  count(
    province, province_label, province_short,
    commune, geo_anchor_short, geo_anchor_order, geo_fill_style,
    status, color, order,
    name = "n"
  ) |>
  group_by(province, commune) |>
  mutate(
    total_commune = sum(n)
  ) |>
  ungroup() |>
  mutate(
    category = commune
  ) |>
  arrange(
    match(province, province_order),
    desc(total_commune),
    commune,
    geo_anchor_order,
    order
  )

n_communes_ancrage_municipal <- municipal_geography |>
  distinct(communes_municipales) |>
  nrow()

n_communes_ancrage_mandat_municipal <- municipal_geography_elected |>
  distinct(commune) |>
  nrow()

sortants_funnel <- tibble(
  step = c("Élus provinciaux 2019", "Sortants candidats en 2026", "Sortants réélus en 2026"),
  short_step = c("Élus 2019", "Se représentent", "Réélus"),
  n = c(n_elus_2019, n_sortants_representes_2026, n_sortants_reelus_2026),
  note = c(
    "Base des assemblées provinciales issues du scrutin de 2019.",
    glue("{fmt_int(n_sortants_absents_2026)} sortants ne sont pas retrouvés comme candidats provinciaux 2026."),
    glue("{fmt_int(n_sortants_representes_non_elus)} sortants candidats ne retrouvent pas de siège provincial.")
  ),
  color = c("#8a8277", "#4f7c8a", "#264653")
)

congress_origin_summary <- elus_congres_2026 |>
  count(origin_code, origin_label, origin_short, origin_color, origin_order, name = "n") |>
  right_join(origin_meta, by = c("origin_code", "origin_label", "origin_short", "origin_color", "origin_order")) |>
  mutate(
    n = replace_na(n, 0L),
    pct = n / n_elus_congres_2026
  ) |>
  arrange(origin_order)

full_renewal_lists <- elus_list_summary |>
  filter(sortants == 0) |>
  arrange(desc(sieges_province), province)

sortants_majority_lists <- elus_list_summary |>
  filter(pct_sortants > 0.5) |>
  arrange(desc(pct_sortants), desc(sieges_province))

format_list_sentence <- function(dat) {
  if (nrow(dat) == 0) return("aucune liste")
  paste(
    glue("{dat$liste_label} ({fmt_int(dat$sieges_province)} sièges)"),
    collapse = ", "
  )
}

full_renewal_lists_text <- format_list_sentence(full_renewal_lists)
sortants_majority_lists_text <- format_list_sentence(sortants_majority_lists)

make_stat_card <- function(value, label, note) {
  tags$article(
    class = "renouv-stat-card",
    tags$div(class = "renouv-stat-value", value),
    tags$div(class = "renouv-stat-label", label),
    tags$p(class = "renouv-stat-note", note)
  )
}

stat_cards <- function() {
  tags$div(
    class = "renouv-stat-grid",
    make_stat_card(
      fmt_int(n_nouveaux_elus_2026),
      "nouveaux élus provinciaux",
      glue("Soit {fmt_pct(pct_nouveaux_elus_2026)} des {fmt_int(n_elus_2026)} sièges provinciaux attribués en 2026.")
    ),
    make_stat_card(
      fmt_int(n_sortants_reelus_2026),
      "élus 2019 reconduits",
      glue("{fmt_int(n_sortants_representes_2026)} sortants se représentaient ; {fmt_int(n_sortants_representes_non_elus)} ne retrouvent pas de siège.")
    ),
    make_stat_card(
      fmt_int(n_elus_provinciaux_elus_municipaux_2026),
      "élus provinciaux déjà élus municipaux",
      glue("{fmt_int(n_elus_provinciaux_candidats_municipaux_2026)} élus provinciaux étaient candidats aux municipales 2026 ; {fmt_int(n_elus_provinciaux_candidats_municipaux_non_elus_2026)} ne décrochent pas de siège municipal.")
    ),
    make_stat_card(
      fmt_int(n_jamais_candidats_reperes_2026),
      "élus non repérés",
      glue("Ni élus/candidats provinciaux 2019, ni candidats municipaux 2026 dans les sources exploitées ici, soit {fmt_pct(pct_jamais_candidats_reperes_2026)} des élus provinciaux.")
    ),
    make_stat_card(
      glue("{fmt_int(n_sortants_congres_2026)} / {fmt_int(n_elus_congres_2026)}"),
      "sièges du Congrès tenus par des sortants 2019",
      glue("Le Congrès compte donc {fmt_int(n_nouveaux_congres_2026)} élus non sortants de 2019.")
    )
  )
}

render_list_summary_table <- function() {
  rows <- elus_list_summary |>
    transmute(
      Province = province_label,
      Liste = liste_label,
      `Sièges province` = fmt_int(sieges_province),
      Congrès = fmt_int(sieges_congres),
      `Sortants 2019` = fmt_int(sortants),
      `Autres élus` = fmt_int(nouveaux),
      `Élus municipaux` = fmt_int(elus_municipaux),
      `Candidats municipaux non élus` = fmt_int(candidats_municipaux - elus_municipaux),
      `Non repérés` = fmt_int(jamais_candidats_reperes),
      `% nouveaux` = fmt_pct(pct_nouveaux)
    )

  tags$div(
    class = "renouv-table",
    tags$table(
      tags$thead(
        tags$tr(lapply(names(rows), tags$th))
      ),
      tags$tbody(
        lapply(seq_len(nrow(rows)), function(i) {
          tags$tr(lapply(rows[i, ], function(x) tags$td(as.character(x))))
        })
      )
    )
  )
}

origin_badge <- function(code, label) {
  meta <- origin_meta |>
    filter(origin_code == as.character(code)) |>
    slice(1)
  tags$span(
    class = "renouv-origin-badge",
    style = glue("--badge-color: {meta$origin_color};"),
    label
  )
}

roster_detail_chip <- function(text, title = NULL, href = NULL) {
  if (is.null(text) || is.na(text) || !nzchar(text)) return(NULL)

  attrs <- list(
    class = "renouv-roster-commune",
    title = title
  )

  if (!is.null(href) && !is.na(href) && nzchar(href)) {
    return(do.call(
      tags$a,
      c(attrs, list(href = href, target = "_blank", rel = "noopener noreferrer", text))
    ))
  }

  do.call(tags$span, c(attrs, list(text)))
}

provincial_2019_chip <- function(row) {
  if (is.na(row$nom_cle_comparaison_2019)) return(NULL)

  statut <- if (isTRUE(row$ancien_elu_2019)) "élu" else "candidat"
  roster_detail_chip(
    glue("Prov. 2019 : {statut} - {display_text(row$liste_nom_court_2019)}"),
    title = "Présence dans les listes provinciales 2019"
  )
}

municipal_2026_chip <- function(row) {
  if (!isTRUE(row$candidat_municipal_2026_detail)) return(NULL)

  if (isTRUE(row$elu_municipal_2026)) {
    return(roster_detail_chip(
      glue("Mun. 2026 : {display_text(row$communes_elues_municipales)}"),
      title = glue("Élu municipal 2026 - {display_text(row$listes_elues_municipales)}")
    ))
  }

  roster_detail_chip(
    glue("Mun. 2026 : candidat - {display_text(row$communes_municipales)}"),
    title = glue("Candidat municipal non élu - {display_text(row$listes_municipales)}")
  )
}

profile_signal_chip <- function(row) {
  roster_detail_chip(
    row$profile_signal_label,
    title = row$profile_signal_detail,
    href = row$profile_signal_source
  )
}

render_elected_roster <- function() {
  roster <- elus_province_2026 |>
    arrange(match(province, province_order), numero_liste, rang) |>
    mutate(
      group_key = glue("{province}__{numero_liste}"),
      name_label = str_squish(nom_prenoms),
      origin_label_display = origin_label
    )

  groups <- split(roster, roster$group_key)

  tags$details(
    class = "renouv-details",
    tags$summary("Voir le détail nominatif des élus classés par origine"),
    tags$div(
      class = "renouv-roster",
      lapply(groups, function(dat) {
        first_row <- dat[1, ]
        tags$section(
          class = "renouv-roster-list",
          tags$h3(glue("{first_row$province_label} - {first_row$liste_label}")),
          tags$p(
            class = "renouv-roster-meta",
            glue("{fmt_int(first_row$sieges_province)} sièges provinciaux, dont {fmt_int(first_row$sieges_congres)} au Congrès")
          ),
          tags$ol(
            lapply(seq_len(nrow(dat)), function(i) {
              row <- dat[i, ]
              tags$li(
                tags$span(class = "renouv-roster-rank", fmt_int(row$rang)),
                tags$span(class = "renouv-roster-name", row$name_label),
                origin_badge(row$origin_code, row$origin_short),
                provincial_2019_chip(row),
                municipal_2026_chip(row),
                profile_signal_chip(row)
              )
            })
          )
        )
      })
    )
  )
}

sketch_chart <- function(id, type, data, caption, options = list()) {
  payload <- list(
    type = type,
    data = data,
    options = options
  )

  json <- toJSON(
    payload,
    dataframe = "rows",
    auto_unbox = TRUE,
    na = "null",
    null = "null",
    digits = 8
  )

  cat(
    '<div id="', id, '" class="renouv-sketch" data-renouv-chart="', type, '"></div>\n',
    '<script type="application/json" id="', id, '-data">', json, '</script>\n',
    '<p class="renouv-sketch-caption">', caption, '</p>\n',
    '<script>window.ContoursRenouvellement && window.ContoursRenouvellement.render("', id, '");</script>\n',
    sep = ""
  )
}

build_preview_image <- function(
  path = file.path(project_dir, "images", "previews", "provinciales-2026-renouvellement-elus.png")
) {
  dir.create(dirname(path), recursive = TRUE, showWarnings = FALSE)

  width <- 2000
  height <- 1050
  paper <- "#fffdf8"
  ink <- "#282522"
  muted <- "#625d55"
  grid_color <- "#ded8cf"
  seat_px <- 30
  x0 <- 470
  card_x <- 70
  card_w <- 310
  card_h <- 168
  bar_h <- 64
  row_y <- c(335, 595, 835)

  draw_text <- function(label, x, y, size, color = ink, face = "plain",
                        just = c("left", "center")) {
    grid::grid.text(
      label,
      x = grid::unit(x, "native"),
      y = grid::unit(y, "native"),
      just = just,
      gp = grid::gpar(col = color, fontsize = size, fontface = face, fontfamily = "sans")
    )
  }

  draw_hachured_rect <- function(x, y, w, h, color) {
    if (w <= 0 || h <= 0) return(invisible(NULL))

    grid::grid.rect(
      x = grid::unit(x, "native"),
      y = grid::unit(y, "native"),
      width = grid::unit(w, "native"),
      height = grid::unit(h, "native"),
      just = c("left", "top"),
      gp = grid::gpar(fill = grDevices::adjustcolor(color, alpha.f = 0.32), col = NA)
    )
    grid::pushViewport(grid::viewport(
      x = grid::unit(x, "native"),
      y = grid::unit(y, "native"),
      width = grid::unit(w, "native"),
      height = grid::unit(h, "native"),
      just = c("left", "top"),
      xscale = c(0, w),
      yscale = c(h, 0),
      clip = "on"
    ))
    for (start in seq(-h, w, by = 13)) {
      grid::grid.segments(
        x0 = grid::unit(start, "native"),
        y0 = grid::unit(h, "native"),
        x1 = grid::unit(start + h, "native"),
        y1 = grid::unit(0, "native"),
        gp = grid::gpar(col = grDevices::adjustcolor(color, alpha.f = 0.82), lwd = 2)
      )
    }
    grid::popViewport()
    grid::grid.rect(
      x = grid::unit(x, "native"),
      y = grid::unit(y, "native"),
      width = grid::unit(w, "native"),
      height = grid::unit(h, "native"),
      just = c("left", "top"),
      gp = grid::gpar(fill = NA, col = color, lwd = 2)
    )
  }

  label_color <- function(color) {
    ink
  }

  grDevices::png(path, width = width, height = height, res = 180, bg = paper)
  on.exit(grDevices::dev.off(), add = TRUE)
  grid::grid.newpage()
  grid::pushViewport(grid::viewport(xscale = c(0, width), yscale = c(height, 0)))
  grid::grid.rect(gp = grid::gpar(fill = paper, col = NA))

  draw_text("Provinciales 2026 : renouvellement réel", 70, 74, 23, face = "bold")
  draw_text(
    glue("{fmt_int(n_nouveaux_elus_2026)} nouveaux élus provinciaux · {fmt_int(n_elus_provinciaux_elus_municipaux_2026)} élus municipaux · {fmt_int(n_jamais_candidats_reperes_2026)} profils non repérés"),
    70, 118, 13, color = muted, face = "bold"
  )

  preview_provinces <- tibble(province = province_order) |>
    left_join(province_totals, by = "province") |>
    mutate(
      province_label = province_label_2026(province),
      y = row_y
    )

  for (i in seq_len(nrow(preview_provinces))) {
    province_row_i <- preview_provinces[i, ]
    y <- province_row_i$y
    total <- province_row_i$total
    bar_w <- total * seat_px
    axis_y <- y - 88
    bar_y <- y - 28

    draw_text(province_row_i$province_label, card_x + 32, y - 14, 17, face = "bold")
    draw_text(glue("{fmt_int(total)} sièges"), card_x + 32, y + 28, 11, color = muted, face = "bold")

    ticks <- c(0, total / 2, total)
    for (tick in ticks) {
      tx <- x0 + tick * seat_px
      grid::grid.segments(
        x0 = grid::unit(tx, "native"),
        y0 = grid::unit(axis_y + 24, "native"),
        x1 = grid::unit(tx, "native"),
        y1 = grid::unit(bar_y + bar_h + 20, "native"),
        gp = grid::gpar(col = grid_color, lwd = 2, lty = "dashed")
      )
      draw_text(fmt_int(tick), tx, axis_y, 9, color = muted, face = "bold", just = c("center", "center"))
    }

    cursor <- x0
    province_segments <- province_origin_plot |>
      filter(province == province_row_i$province) |>
      arrange(origin_order)

    for (j in seq_len(nrow(province_segments))) {
      segment <- province_segments[j, ]
      segment_w <- segment$n * seat_px
      draw_hachured_rect(cursor, bar_y, segment_w, bar_h, segment$origin_color)
      if (segment_w >= 54 && segment$n > 0) {
        draw_text(fmt_int(segment$n), cursor + segment_w / 2, bar_y + bar_h / 2, 11, color = label_color(segment$origin_color), face = "bold", just = c("center", "center"))
      }
      cursor <- cursor + segment_w
    }

    draw_text(glue("{fmt_int(total)} sièges"), x0 + bar_w + 18, bar_y + bar_h / 2, 11, color = muted, face = "bold")
  }

  legend_x <- 415
  legend_y <- 970
  legend_items <- origin_meta |>
    arrange(origin_order)
  cursor <- legend_x
  for (i in seq_len(nrow(legend_items))) {
    item <- legend_items[i, ]
    draw_hachured_rect(cursor, legend_y - 18, 34, 30, item$origin_color)
    draw_text(item$origin_short, cursor + 45, legend_y, 11, face = "bold")
    cursor <- cursor + max(270, nchar(item$origin_short) * 12 + 90)
  }

  draw_text("contours.nc - Jonas Brouillon", width - 70, height - 36, 11, color = "#8a8277", face = "bold", just = c("right", "center"))
  grid::popViewport()
  invisible(path)
}
