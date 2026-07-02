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
  "pro_pays" = "#9b5f8f",
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

famille_detail_labels <- c(
  "droite_nationale" = "Droite nationale",
  "loyaliste_droite" = "Loyalistes",
  "centre_non_ind" = "Centre non-ind.",
  "autres_non_ind" = "Autres non-indépendantistes",
  "oceanien" = "Éveil / océanien",
  "pro_pays" = "Pro-pays / souverainistes",
  "uc_flnks" = "UC-FLNKS / FLNKS",
  "uni_palika" = "UNI / Palika",
  "autres_ind" = "Autres indépendantistes",
  "autres_listes" = "Autres listes"
)

famille_detail_colors <- c(
  "droite_nationale" = "#7a4a28",
  "loyaliste_droite" = "#305f9f",
  "centre_non_ind" = "#67a9cf",
  "autres_non_ind" = "#7f9bb7",
  "oceanien" = "#55a6b8",
  "pro_pays" = "#9b5f8f",
  "uc_flnks" = "#2f925d",
  "uni_palika" = "#f0c52f",
  "autres_ind" = "#b6483b",
  "autres_listes" = "#8a7d72"
)

famille_detail_order <- names(famille_detail_labels)

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
    str_detect(axe, "dynamique autochtone|nation autochtone|parti travailliste") |
      str_detect(famille, "dynamique autochtone|nation autochtone|parti travailliste") |
      str_detect(liste, "dynamique autochtone|nation autochtone|parti travailliste") ~ "autres_ind",
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

congres_nuances_voix_long <- tribble(
  ~annee, ~category, ~valeur,
  1989, "droite_nationale", 9037,
  1989, "loyaliste_droite", 27777,
  1989, "centre_non_ind", 1931,
  1989, "oceanien", 2429,
  1989, "uc_flnks", 17898,
  1989, "autres_ind", 3401,
  1995, "droite_nationale", 6455,
  1995, "loyaliste_droite", 25977,
  1995, "centre_non_ind", 10903,
  1995, "oceanien", 1113,
  1995, "uc_flnks", 14005,
  1995, "uni_palika", 7017,
  1995, "autres_ind", 4072,
  1995, "autres_listes", 2249,
  1999, "droite_nationale", 7286,
  1999, "loyaliste_droite", 30774,
  1999, "centre_non_ind", 8417,
  1999, "uc_flnks", 14778,
  1999, "uni_palika", 6166,
  1999, "autres_ind", 11194,
  1999, "autres_listes", 706,
  2004, "droite_nationale", 6684,
  2004, "loyaliste_droite", 21880,
  2004, "centre_non_ind", 20328,
  2004, "autres_non_ind", 2971,
  2004, "pro_pays", 1907,
  2004, "uc_flnks", 10623,
  2004, "uni_palika", 14651,
  2004, "autres_ind", 10517,
  2009, "droite_nationale", 2591,
  2009, "loyaliste_droite", 24192,
  2009, "centre_non_ind", 27561,
  2009, "autres_non_ind", 1125,
  2009, "pro_pays", 4189,
  2009, "uc_flnks", 16589,
  2009, "uni_palika", 10162,
  2009, "autres_ind", 10149,
  2014, "droite_nationale", 2706,
  2014, "loyaliste_droite", 29318,
  2014, "centre_non_ind", 27424,
  2014, "pro_pays", 2190,
  2014, "uc_flnks", 25891,
  2014, "uni_palika", 10929,
  2014, "autres_ind", 6808,
  2019, "droite_nationale", 2707,
  2019, "loyaliste_droite", 31874,
  2019, "centre_non_ind", 15097,
  2019, "oceanien", 6077,
  2019, "pro_pays", 1971,
  2019, "uc_flnks", 25524,
  2019, "uni_palika", 12679,
  2019, "autres_ind", 6518,
  2019, "autres_listes", 7716,
  2026, "droite_nationale", 1885,
  2026, "loyaliste_droite", 45825,
  2026, "centre_non_ind", 9961,
  2026, "oceanien", 8399,
  2026, "pro_pays", 4428,
  2026, "uc_flnks", 27206,
  2026, "uni_palika", 16503,
  2026, "autres_ind", 6222
) |>
  mutate(
    category = factor(category, levels = famille_detail_order)
  ) |>
  arrange(annee, category) |>
  mutate(category = as.character(category))

congres_nuances_sieges_long <- tribble(
  ~annee, ~category, ~valeur,
  1989, "droite_nationale", 5,
  1989, "loyaliste_droite", 27,
  1989, "oceanien", 2,
  1989, "uc_flnks", 19,
  1989, "autres_ind", 1,
  1995, "droite_nationale", 4,
  1995, "loyaliste_droite", 22,
  1995, "centre_non_ind", 9,
  1995, "uc_flnks", 12,
  1995, "uni_palika", 5,
  1995, "autres_ind", 2,
  1999, "droite_nationale", 4,
  1999, "loyaliste_droite", 24,
  1999, "centre_non_ind", 3,
  1999, "uc_flnks", 12,
  1999, "uni_palika", 6,
  1999, "autres_ind", 5,
  2004, "droite_nationale", 4,
  2004, "loyaliste_droite", 16,
  2004, "centre_non_ind", 16,
  2004, "uc_flnks", 7,
  2004, "uni_palika", 8,
  2004, "autres_ind", 3,
  2009, "loyaliste_droite", 15,
  2009, "centre_non_ind", 16,
  2009, "uc_flnks", 11,
  2009, "uni_palika", 8,
  2009, "autres_ind", 4,
  2014, "loyaliste_droite", 14,
  2014, "centre_non_ind", 15,
  2014, "uc_flnks", 15,
  2014, "uni_palika", 7,
  2014, "autres_ind", 3,
  2019, "loyaliste_droite", 18,
  2019, "centre_non_ind", 7,
  2019, "oceanien", 3,
  2019, "uc_flnks", 15,
  2019, "uni_palika", 9,
  2019, "autres_ind", 2,
  2026, "loyaliste_droite", 24,
  2026, "oceanien", 4,
  2026, "uc_flnks", 16,
  2026, "uni_palika", 7,
  2026, "autres_ind", 3
) |>
  mutate(
    category = factor(category, levels = famille_detail_order)
  ) |>
  arrange(annee, category) |>
  mutate(category = as.character(category))

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
