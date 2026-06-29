suppressPackageStartupMessages({
  library(dplyr)
  library(forcats)
  library(here)
  library(jsonlite)
  library(readr)
  library(scales)
  library(stringr)
  library(tibble)
  library(tidyr)
})

knitr::opts_chunk$set(results = "asis")

project_dir <- here::here()
data_dir <- file.path(project_dir, "data", "elections", "data_processed", "provinciales_2026")

resultats <- read_csv(
  file.path(data_dir, "provinciales_2026_resultats_province_listes.csv"),
  show_col_types = FALSE
)
participation <- read_csv(
  file.path(data_dir, "provinciales_historique_participation_1989_2026.csv"),
  show_col_types = FALSE
)
blocs <- read_csv(
  file.path(data_dir, "provinciales_historique_blocs_provinces_1989_2026.csv"),
  show_col_types = FALSE
)
congres <- read_csv(
  file.path(data_dir, "provinciales_historique_blocs_congres_1989_2026.csv"),
  show_col_types = FALSE
)

referentiel_listes <- read_csv(
  file.path(
    project_dir,
    "data",
    "outputs_provinciales_candidats",
    "provinciales_referentiel_listes_politiques_2019_2026.csv"
  ),
  show_col_types = FALSE
)

province_order <- c("Province Sud", "Province Nord", "Province des Iles")

province_labels <- c(
  "Province Sud" = "Sud",
  "Province Nord" = "Nord",
  "Province des Iles" = "Îles",
  "Nouvelle-Caledonie" = "Nouvelle-Calédonie"
)

bloc_labels <- c(
  "anti_independantiste" = "Non-indépendantistes",
  "independantiste" = "Indépendantistes",
  "autres_listes" = "Autres / pro-pays"
)

bloc_colors <- c(
  "anti_independantiste" = "#305f9f",
  "independantiste" = "#2f925d",
  "autres_listes" = "#8a7d72"
)

territory_colors <- c(
  "Nouvelle-Caledonie" = "#282522",
  "Province Sud" = "#c86a4a",
  "Province Nord" = "#7769a6",
  "Province des Iles" = "#b76f95"
)

group_colors <- c(
  "LL-LR" = "#305f9f",
  "LL-LR Nord" = "#305f9f",
  "Avenir en confiance" = "#305f9f",
  "Calédonie ensemble" = "#67a9cf",
  "Agissons Nord" = "#6f87ad",
  "UC-FLNKS" = "#2f925d",
  "UNI / Palika" = "#f0c52f",
  "Palika Îles" = "#f0c52f",
  "FLNKS Sud" = "#2f925d",
  "Éveil océanien" = "#55a6b8",
  "Nation autochtone" = "#b6483b",
  "PT / Dynamique autochtone" = "#b6483b",
  "Parti travailliste" = "#b6483b",
  "Dynamique autochtone" = "#b6483b"
)

axe_labels <- c(
  "uc_flnks" = "UC-FLNKS / FLNKS",
  "uni_palika" = "UNI / Palika",
  "autres_ind" = "Autres indépendantistes",
  "pro_pays" = "Pro-pays / souverainistes",
  "oceanien" = "Éveil / nuance océanienne",
  "centre_non_ind" = "Centre non-indépendantiste",
  "loyaliste_droite" = "Loyalistes",
  "droite_nationale" = "Droite nationale",
  "autres_axes" = "Autres listes"
)

axe_colors <- c(
  "uc_flnks" = "#2f925d",
  "uni_palika" = "#f0c52f",
  "autres_ind" = "#88a96d",
  "pro_pays" = "#4f8f6a",
  "oceanien" = "#55a6b8",
  "centre_non_ind" = "#67a9cf",
  "loyaliste_droite" = "#305f9f",
  "droite_nationale" = "#7a4a28",
  "autres_axes" = "#8a7d72"
)

axe_order <- names(axe_labels)

famille_labels <- c(
  "non_ind" = "Non-indépendantistes",
  "eveil_oceanien" = "Éveil océanien",
  "independantiste" = "Indépendantistes",
  "autres_listes" = "Autres / pro-pays"
)

famille_colors <- c(
  "non_ind" = "#305f9f",
  "eveil_oceanien" = "#55a6b8",
  "independantiste" = "#2f925d",
  "autres_listes" = "#8a7d72"
)

famille_order <- names(famille_labels)

annees_scrutins <- c(1989, 1995, 1999, 2004, 2009, 2014, 2019, 2026)

fmt_num <- function(x, digits = 1) {
  number(x, accuracy = 10^-digits, decimal.mark = ",", big.mark = " ")
}

fmt_int <- function(x) {
  number(round(x), accuracy = 1, decimal.mark = ",", big.mark = " ")
}

fmt_pct <- function(x, digits = 1) {
  paste0(fmt_num(x, digits), " %")
}

wrap_label <- function(x, width = 26) {
  str_wrap(x, width = width)
}

province_factor <- function(x) {
  factor(x, levels = province_order)
}

province_short <- function(x) {
  unname(province_labels[as.character(x)])
}

bloc_label_factor <- function(x) {
  factor(unname(bloc_labels[x]), levels = unname(bloc_labels))
}

famille_label_factor <- function(x) {
  factor(unname(famille_labels[x]), levels = unname(famille_labels))
}

groupe_congres <- function(province, numero_liste, etiquette) {
  case_when(
    province == "Province Sud" & numero_liste == 10 ~ "LL-LR",
    province == "Province Nord" & numero_liste == 1 ~ "LL-LR",
    province == "Province Sud" & numero_liste == 1 ~ "Éveil océanien",
    province == "Province Sud" & numero_liste == 2 ~ "UC-FLNKS",
    province == "Province Nord" & numero_liste == 3 ~ "UC-FLNKS",
    province == "Province des Iles" & numero_liste == 5 ~ "UC-FLNKS",
    province == "Province Nord" & numero_liste == 5 ~ "UNI / Palika",
    province == "Province des Iles" & numero_liste == 1 ~ "UNI / Palika",
    province == "Province des Iles" & numero_liste == 4 ~ "Nation autochtone",
    TRUE ~ etiquette
  )
}

groupe_assemblee_2019 <- function(province, numero_liste, liste_nom_court) {
  case_when(
    province == "Province Sud" & numero_liste == 3 ~ "Avenir en confiance",
    province == "Province Sud" & numero_liste == 6 ~ "Éveil océanien",
    province == "Province Sud" & numero_liste == 7 ~ "FLNKS Sud",
    province == "Province Sud" & numero_liste == 11 ~ "Calédonie ensemble",
    province == "Province Nord" & numero_liste == 1 ~ "UNI / Palika",
    province == "Province Nord" & numero_liste == 2 ~ "Agissons Nord",
    province == "Province Nord" & numero_liste == 6 ~ "UC-FLNKS",
    province == "Province des Iles" & numero_liste == 2 ~ "UC-FLNKS",
    province == "Province des Iles" & numero_liste == 3 ~ "Parti travailliste",
    province == "Province des Iles" & numero_liste == 5 ~ "Dynamique autochtone",
    province == "Province des Iles" & numero_liste == 8 ~ "Palika Îles",
    TRUE ~ liste_nom_court
  )
}

groupe_assemblee_2026 <- function(province, numero_liste, etiquette) {
  case_when(
    province == "Province Sud" & numero_liste == 10 ~ "LL-LR",
    province == "Province Sud" & numero_liste == 1 ~ "Éveil océanien",
    province == "Province Sud" & numero_liste == 2 ~ "FLNKS Sud",
    province == "Province Nord" & numero_liste == 1 ~ "LL-LR Nord",
    province == "Province Nord" & numero_liste == 3 ~ "UC-FLNKS",
    province == "Province Nord" & numero_liste == 5 ~ "UNI / Palika",
    province == "Province des Iles" & numero_liste == 1 ~ "Palika Îles",
    province == "Province des Iles" & numero_liste == 4 ~ "Nation autochtone",
    province == "Province des Iles" & numero_liste == 5 ~ "UC-FLNKS",
    TRUE ~ etiquette
  )
}

axe_politique_id <- function(axe_politique, famille_politique, liste_nom_court = NA_character_) {
  axe <- str_to_lower(coalesce(axe_politique, ""))
  famille <- str_to_lower(coalesce(famille_politique, ""))
  liste <- str_to_lower(coalesce(liste_nom_court, ""))

  case_when(
    str_detect(axe, "oceanien|océanien") | str_detect(famille, "eveil|éveil|oceanien|océanien") ~ "oceanien",
    str_detect(axe, "uni|palika") | str_detect(famille, "uni|palika") ~ "uni_palika",
    str_detect(axe, "uc-flnks") |
      str_detect(famille, "uc-flnks|flnks") |
      str_detect(liste, "kanaky pour tous|flnks") ~ "uc_flnks",
    str_detect(axe, "souverainiste|pro-pays") ~ "pro_pays",
    str_detect(axe, "centre non") | str_detect(famille, "caledonie ensemble|calédonie ensemble|centre") ~ "centre_non_ind",
    str_detect(axe, "droite nationale|rassemblement national") ~ "droite_nationale",
    str_detect(axe, "loyaliste") ~ "loyaliste_droite",
    str_detect(axe, "independantiste|indépendantiste") ~ "autres_ind",
    TRUE ~ "autres_axes"
  )
}

eveil_2019 <- tibble(
  annee = 2019,
  province = "Province Sud",
  voix = 6077,
  sieges_province = 4,
  sieges_congres = 3
)

eveil_2026 <- resultats |>
  filter(province == "Province Sud", etiquette == "Éveil océanien") |>
  transmute(
    annee = 2026,
    province,
    voix,
    sieges_province,
    sieges_congres
  )

eveil_historique <- bind_rows(eveil_2019, eveil_2026)

congres_familles <- congres |>
  mutate(
    famille = case_when(
      bloc_historique == "anti_independantiste" ~ "non_ind",
      bloc_historique == "independantiste" ~ "independantiste",
      TRUE ~ "autres_listes"
    )
  ) |>
  left_join(
    eveil_historique |>
      group_by(annee) |>
      summarise(
        eveil_voix = sum(voix),
        eveil_sieges_congres = sum(sieges_congres),
        .groups = "drop"
      ),
    by = "annee"
  ) |>
  mutate(
    voix = if_else(famille == "non_ind", voix - coalesce(eveil_voix, 0), voix),
    sieges_congres = if_else(
      famille == "non_ind",
      sieges_congres - coalesce(eveil_sieges_congres, 0),
      sieges_congres
    )
  ) |>
  select(annee, famille, voix, sieges_congres, exprimes, pct_exprimes, source) |>
  bind_rows(
    eveil_historique |>
      group_by(annee) |>
      summarise(
        famille = "eveil_oceanien",
        voix = sum(voix),
        sieges_congres = sum(sieges_congres),
        .groups = "drop"
      ) |>
      left_join(
        participation |>
          filter(territoire == "Nouvelle-Caledonie") |>
          select(annee, exprimes, source),
        by = "annee"
      ) |>
      mutate(pct_exprimes = 100 * voix / exprimes)
  ) |>
  mutate(
    famille = factor(famille, levels = famille_order),
    famille_label = famille_label_factor(as.character(famille))
  ) |>
  arrange(annee, famille)

axes_2019 <- referentiel_listes |>
  filter(annee == 2019) |>
  transmute(
    annee,
    province,
    numero_liste,
    etiquette = liste_nom_court,
    axe = axe_politique_id(axe_politique, famille_politique, liste_nom_court),
    voix = voix_2019,
    sieges_congres = replace_na(sieges_congres_2019, 0),
    sieges_province = replace_na(sieges_province_total_2019, 0)
  )

axes_2026 <- resultats |>
  mutate(annee = 2026) |>
  left_join(
    referentiel_listes |>
      filter(annee == 2026) |>
      select(annee, province, numero_liste, axe_politique, famille_politique, liste_nom_court),
    by = c("annee", "province", "numero_liste")
  ) |>
  transmute(
    annee,
    province,
    numero_liste,
    etiquette,
    axe = axe_politique_id(axe_politique, famille_politique, etiquette),
    voix,
    sieges_congres,
    sieges_province
  )

axes_provinces <- bind_rows(axes_2019, axes_2026) |>
  group_by(annee, province, axe) |>
  summarise(
    voix = sum(voix, na.rm = TRUE),
    sieges_congres = sum(sieges_congres, na.rm = TRUE),
    sieges_province = sum(sieges_province, na.rm = TRUE),
    .groups = "drop"
  ) |>
  left_join(
    participation |>
      filter(annee %in% c(2019, 2026), territoire %in% province_order) |>
      select(annee, province = territoire, exprimes),
    by = c("annee", "province")
  ) |>
  mutate(
    pct_exprimes = 100 * voix / exprimes,
    axe = factor(axe, levels = axe_order),
    axe_label = factor(unname(axe_labels[as.character(axe)]), levels = unname(axe_labels))
  ) |>
  arrange(province_factor(province), axe, annee)

abstention_composition <- participation |>
  filter(annee %in% c(2019, 2026), territoire %in% province_order) |>
  mutate(
    province = territoire,
    abstentions = inscrits - votants
  ) |>
  group_by(annee) |>
  mutate(
    total_abstentions = sum(abstentions),
    pct_total_abstentions = 100 * abstentions / total_abstentions
  ) |>
  ungroup() |>
  mutate(
    province_label = province_short(province),
    couleur = unname(territory_colors[province])
  )

abstention_value <- function(annee_value, province_value, column) {
  abstention_composition |>
    filter(annee == annee_value, province == province_value) |>
    pull({{ column }}) |>
    first()
}

congres_2026_groupes <- resultats |>
  filter(sieges_congres > 0) |>
  mutate(groupe = groupe_congres(province, numero_liste, etiquette)) |>
  group_by(groupe) |>
  summarise(
    sieges = sum(sieges_congres),
    voix = sum(voix),
    .groups = "drop"
  ) |>
  mutate(
    famille = case_when(
      groupe == "LL-LR" ~ "non_ind",
      groupe == "Éveil océanien" ~ "eveil_oceanien",
      TRUE ~ "independantiste"
    ),
    couleur = unname(group_colors[groupe])
  )

congres_2019_groupes <- tibble(
  groupe = c(
    "PT / Dynamique autochtone",
    "UC-FLNKS",
    "UNI / Palika",
    "Éveil océanien",
    "Calédonie ensemble",
    "Avenir en confiance"
  ),
  sieges = c(2, 15, 9, 3, 7, 18),
  famille = c(
    rep("independantiste", 3),
    "eveil_oceanien",
    rep("non_ind", 2)
  )
) |>
  mutate(
    voix = NA_real_,
    couleur = unname(group_colors[groupe])
  )

uncount_sieges <- function(data, order) {
  data |>
    arrange(match(groupe, order)) |>
    tidyr::uncount(sieges, .id = "siege_groupe") |>
    group_by(groupe) |>
    mutate(total_groupe = n()) |>
    ungroup() |>
    mutate(siege = row_number())
}

ordre_congres_2019 <- c(
  "PT / Dynamique autochtone",
  "UC-FLNKS",
  "UNI / Palika",
  "Éveil océanien",
  "Calédonie ensemble",
  "Avenir en confiance"
)

ordre_congres_2026 <- c(
  "Nation autochtone",
  "UC-FLNKS",
  "UNI / Palika",
  "Éveil océanien",
  "LL-LR"
)

sieges_congres_2019 <- congres_2019_groupes |>
  uncount_sieges(ordre_congres_2019)

sieges_congres_2026 <- congres_2026_groupes |>
  uncount_sieges(ordre_congres_2026)

assemblees_2019_groupes <- referentiel_listes |>
  filter(annee == 2019, replace_na(sieges_province_total_2019, 0) > 0) |>
  transmute(
    annee,
    province,
    groupe = groupe_assemblee_2019(province, numero_liste, liste_nom_court),
    sieges = sieges_province_total_2019,
    famille = case_when(
      groupe == "Éveil océanien" ~ "eveil_oceanien",
      axe_politique_id(axe_politique, famille_politique, liste_nom_court) %in%
        c("loyaliste_droite", "centre_non_ind", "droite_nationale") ~ "non_ind",
      TRUE ~ "independantiste"
    ),
    couleur = unname(group_colors[groupe])
  )

assemblees_2026_groupes <- resultats |>
  filter(sieges_province > 0) |>
  mutate(groupe = groupe_assemblee_2026(province, numero_liste, etiquette)) |>
  transmute(
    annee = 2026,
    province,
    groupe,
    sieges = sieges_province,
    famille = case_when(
      groupe == "Éveil océanien" ~ "eveil_oceanien",
      bloc_historique == "anti_independantiste" ~ "non_ind",
      TRUE ~ "independantiste"
    ),
    couleur = unname(group_colors[groupe])
  )

ordre_assemblees <- tribble(
  ~annee, ~province, ~groupe, ~ordre,
  2019, "Province Sud", "FLNKS Sud", 1,
  2019, "Province Sud", "Éveil océanien", 2,
  2019, "Province Sud", "Calédonie ensemble", 3,
  2019, "Province Sud", "Avenir en confiance", 4,
  2026, "Province Sud", "FLNKS Sud", 1,
  2026, "Province Sud", "Éveil océanien", 2,
  2026, "Province Sud", "LL-LR", 3,
  2019, "Province Nord", "UC-FLNKS", 1,
  2019, "Province Nord", "UNI / Palika", 2,
  2019, "Province Nord", "Agissons Nord", 3,
  2026, "Province Nord", "UC-FLNKS", 1,
  2026, "Province Nord", "UNI / Palika", 2,
  2026, "Province Nord", "LL-LR Nord", 3,
  2019, "Province des Iles", "Parti travailliste", 1,
  2019, "Province des Iles", "Dynamique autochtone", 2,
  2019, "Province des Iles", "UC-FLNKS", 3,
  2019, "Province des Iles", "Palika Îles", 4,
  2026, "Province des Iles", "Nation autochtone", 1,
  2026, "Province des Iles", "UC-FLNKS", 2,
  2026, "Province des Iles", "Palika Îles", 3
)

assemblees_province_groupes <- bind_rows(assemblees_2019_groupes, assemblees_2026_groupes) |>
  left_join(ordre_assemblees, by = c("annee", "province", "groupe")) |>
  mutate(
    ordre = replace_na(ordre, 99L),
    couleur = replace_na(couleur, "#8a7d72")
  ) |>
  arrange(province_factor(province), annee, ordre)

sieges_assemblees_province <- assemblees_province_groupes |>
  tidyr::uncount(sieges, .id = "siege_groupe") |>
  group_by(annee, province, groupe) |>
  mutate(total_groupe = n()) |>
  ungroup() |>
  arrange(province_factor(province), annee, ordre, siege_groupe) |>
  mutate(siege = row_number())

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
    '<div id="', id, '" class="bilan-sketch" data-sketch-chart="', type, '"></div>\n',
    '<script type="application/json" id="', id, '-data">', json, '</script>\n',
    '<p class="bilan-sketch-caption">', caption, '</p>\n',
    '<script>window.ContoursSketch && window.ContoursSketch.render("', id, '");</script>\n',
    sep = ""
  )
}
