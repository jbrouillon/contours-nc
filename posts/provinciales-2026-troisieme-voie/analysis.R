suppressPackageStartupMessages({
  library(dplyr)
  library(htmltools)
  library(jsonlite)
  library(purrr)
  library(readr)
  library(scales)
  library(stringr)
  library(tibble)
  library(tidyr)
})

knitr::opts_chunk$set(results = "asis")

find_project_root <- function(path = getwd()) {
  path <- normalizePath(path, winslash = "/", mustWork = TRUE)
  repeat {
    if (file.exists(file.path(path, "_quarto.yml"))) return(path)
    parent <- dirname(path)
    if (identical(parent, path)) stop("Racine du projet Quarto introuvable.")
    path <- parent
  }
}

fmt_num <- function(x, digits = 1) {
  number(x, accuracy = 10^-digits, decimal.mark = ",", big.mark = " ")
}

fmt_int <- function(x) {
  number(round(x), accuracy = 1, decimal.mark = ",", big.mark = " ")
}

fmt_pct <- function(x, digits = 1) {
  paste0(fmt_num(x, digits), " %")
}

project_dir <- find_project_root()
data_dir <- file.path(project_dir, "data", "elections", "data_processed", "provinciales_2026")
raw_propagande_dir <- file.path(
  project_dir, "data", "elections", "data_raw", "provinciales_2026",
  "propagande_electronique"
)

resultats <- read_csv(
  file.path(data_dir, "provinciales_2026_resultats_province_listes.csv"),
  show_col_types = FALSE
)

manifest <- read_csv(
  file.path(raw_propagande_dir, "manifest.csv"),
  show_col_types = FALSE
) |>
  mutate(
    province_key = case_when(
      province == "Province Sud" ~ "Province Sud",
      province == "Province Nord" ~ "Province Nord",
      TRUE ~ "Province des Iles"
    ),
    document_id = paste(
      case_when(
        province_key == "Province Sud" ~ "province-sud",
        province_key == "Province Nord" ~ "province-nord",
        TRUE ~ "iles-loyaute"
      ),
      sprintf("%02d", numero_liste),
      sep = "_"
    )
  )

resultats_total_nc <- resultats |>
  distinct(province, inscrits, exprimes) |>
  summarise(
    inscrits = sum(inscrits),
    exprimes = sum(exprimes),
    .groups = "drop"
  )

result_keys <- tribble(
  ~list_id, ~province, ~numero_liste,
  "eveil", "Province Sud", 1,
  "kanaky_pour_tous", "Province Sud", 2,
  "une_province", "Province Sud", 5,
  "faire_pays", "Province Sud", 7,
  "faire_pays", "Province Nord", 4,
  "nous_reunis", "Province Sud", 9,
  "ll_lr", "Province Sud", 10,
  "unis_pour_le_pays", "Province Sud", 11,
  "espoir", "Province Sud", 12
)

list_results <- result_keys |>
  left_join(
    resultats |>
      select(
        province, numero_liste, inscrits, exprimes, voix, pct_exprimes,
        pct_inscrits, sieges_province, sieges_congres
      ),
    by = c("province", "numero_liste")
  ) |>
  group_by(list_id) |>
  summarise(
    voix = sum(voix, na.rm = TRUE),
    inscrits_scope = sum(inscrits, na.rm = TRUE),
    exprimes_scope = sum(exprimes, na.rm = TRUE),
    pct_exprimes_scope = 100 * voix / exprimes_scope,
    pct_inscrits_scope = 100 * voix / inscrits_scope,
    sieges_province = sum(sieges_province, na.rm = TRUE),
    sieges_congres = sum(sieges_congres, na.rm = TRUE),
    provinces_presence = paste(unique(province), collapse = " + "),
    .groups = "drop"
  )

program_positions <- tribble(
  ~list_id, ~label, ~short_label, ~famille, ~role, ~color, ~x_institution, ~y_economie, ~institution, ~economie, ~angle, ~mesure1, ~mesure2, ~mesure3, ~document_id, ~core_third_way, ~neighbor,
  "ll_lr", "Les Loyalistes et Le Rassemblement", "LL-LR", "Pôle loyaliste", "référence", "#305f9f", 0.45, 0.75, "Ancrage français et majorité concentrée", "Baisse des prélèvements, sécurité, propriété", "Le pôle de droite loyaliste concentre l'offre non-indépendantiste représentée.", "Tolérance zéro et moyens supplémentaires pour l'ordre public.", "Baisse des impôts, du coût du travail et suppression de certains droits.", "Accession à la propriété et réduction du logement social nouveau.", "province-sud_10", FALSE, FALSE,
  "kanaky_pour_tous", "Kanaky pour tous", "Kanaky pour tous", "Pôle UC-FLNKS", "référence", "#2f925d", 4.55, 3.45, "Accession préparée à la pleine souveraineté", "Boucliers sociaux, insertion, production locale", "Le pôle UC-FLNKS articule souveraineté, justice sociale et emploi local.", "Bouclier prix famille-retraité et plan manger local et moins cher.", "Aides au logement, transports aidés et clauses sociales.", "Parcours d'insertion et travail alternatif pour la jeunesse.", "province-sud_02", FALSE, FALSE,
  "eveil", "Éveil océanien", "Éveil océanien", "Pivot océanien / transversal", "troisième voie", "#55a6b8", 2.05, 2.55, "Sortir des blocs par la paix sociale", "Fiscalité sociale, aides ciblées, participation", "Une troisième voie de cohésion : moins doctrinale sur le statut, plus centrée sur la paix sociale, la participation et le refus de l'alignement sur la droite.", "Aménagements fiscaux et sociaux temporaires pour le pouvoir d'achat.", "Aides sociales ciblées sur les ménages précaires.", "Assemblées citoyennes et réforme fiscale et sociale avec les partenaires.", "province-sud_01", TRUE, FALSE,
  "une_province", "Une Province pour tous", "Une Province pour tous", "Centre autonomiste", "troisième voie", "#67a9cf", 2.70, 2.15, "Émancipation négociée, lien maintenu", "Réduction des inégalités et relance économique", "L'héritage Calédonie Ensemble : ni rupture souverainiste immédiate, ni loyalisme de confrontation.", "Négociations institutionnelles dès le lendemain du scrutin.", "Lien avec la France et l'Europe revisité progressivement.", "Relance économique et réduction des inégalités territoriales.", "province-sud_05", TRUE, FALSE,
  "nous_reunis", "Nous, réunis !", "Nous, réunis", "Centre gestionnaire", "troisième voie", "#8db8d1", 1.85, 2.45, "Reconstruire avant de trancher", "Prix, transports, production locale", "Une ligne de réparation économique immédiate, moins structurée par le statut que par la sortie de crise.", "Panier de produits essentiels et ticket Tanéo à 200 F.", "Simplifications fiscales et accès à la commande publique.", "Fonds pour la production locale et agriculture sur terres coutumières.", "province-sud_09", TRUE, FALSE,
  "espoir", "Un espoir pour demain", "Un espoir pour demain", "Centre droit de stabilité", "troisième voie", "#829dbd", 1.25, 1.35, "Pacte de stabilité avant le reste", "Simplification, énergie, maîtrise des dépenses", "La version la plus gestionnaire et prudente : donner de la visibilité aux ménages et investisseurs avant l'accord final.", "Pacte de stabilité pour ménages et investisseurs.", "Réduction des doublons et des dépenses publiques.", "Stratégie nickel, énergie moins chère, formation professionnelle.", "province-sud_12", TRUE, FALSE,
  "faire_pays", "Faire Pays", "Faire Pays", "Souverainiste pro-pays", "troisième voie", "#4f8f6a", 3.70, 2.85, "Souveraineté partagée et progressive", "Dignité quotidienne, services essentiels, travail", "La variante pro-pays : elle va plus loin sur la souveraineté, mais la formule comme partenariat et progression.", "Aides à la scolarité, cantine, transport et Pass Mobilité.", "Couverture médicale gratuite et allègement des charges sur le travail.", "Institutions plus efficaces et moins coûteuses ; souveraineté partagée étape par étape.", "province-sud_07", TRUE, FALSE,
  "unis_pour_le_pays", "Unis pour le Pays", "Unis pour le Pays", "Voisin souverainiste", "voisinage", "#f0c52f", 3.45, 2.95, "Souveraineté en partenariat avec la France", "Province sociale, santé, économie coutumière", "Un voisin de l'espace pro-pays : indépendantiste, mais utile pour comprendre la zone de la souveraineté partenariale.", "Diagnostic social et étude d'un revenu de solidarité citoyenne.", "Plan de résorption des squats, santé mentale et addictions.", "Soutien aux sites miniers, TPE, économie coutumière et transports.", "province-sud_11", FALSE, TRUE
) |>
  left_join(list_results, by = "list_id") |>
  left_join(
    manifest |>
      select(document_id, source_url),
    by = "document_id"
  ) |>
  mutate(
    voix = replace_na(voix, 0),
    pct_exprimes_scope = replace_na(pct_exprimes_scope, 0),
    pct_inscrits_scope = replace_na(pct_inscrits_scope, 0),
    sieges_province = replace_na(sieges_province, 0),
    sieges_congres = replace_na(sieges_congres, 0)
  )

third_core_ids <- c("eveil", "une_province", "nous_reunis", "espoir", "faire_pays")
third_sud_nums <- c(1, 5, 7, 9, 12)

third_sud <- resultats |>
  filter(province == "Province Sud", numero_liste %in% third_sud_nums)

centre_nonind_sud <- resultats |>
  filter(province == "Province Sud", numero_liste %in% c(5, 9, 12))

third_sud_no_seat <- resultats |>
  filter(province == "Province Sud", numero_liste %in% c(5, 7, 9, 12))

third_sud_with_neighbor <- resultats |>
  filter(province == "Province Sud", numero_liste %in% c(5, 7, 9, 11, 12))

third_all <- result_keys |>
  filter(list_id %in% third_core_ids) |>
  left_join(resultats, by = c("province", "numero_liste"))

third_sud_voix <- sum(third_sud$voix)
third_sud_pct <- 100 * third_sud_voix / first(third_sud$exprimes)
third_sud_sieges <- sum(third_sud$sieges_province)
centre_nonind_sud_voix <- sum(centre_nonind_sud$voix)
centre_nonind_sud_pct <- 100 * centre_nonind_sud_voix / first(centre_nonind_sud$exprimes)
third_sud_no_seat_voix <- sum(third_sud_no_seat$voix)
third_sud_no_seat_pct <- 100 * third_sud_no_seat_voix / first(third_sud_no_seat$exprimes)
third_sud_with_neighbor_voix <- sum(third_sud_with_neighbor$voix)
third_sud_with_neighbor_pct <- 100 * third_sud_with_neighbor_voix / first(third_sud_with_neighbor$exprimes)
third_all_voix <- sum(third_all$voix)
third_all_pct_nc <- 100 * third_all_voix / resultats_total_nc$exprimes

sud_threshold_pct_exprimes <- resultats |>
  filter(province == "Province Sud") |>
  slice(1) |>
  transmute(value = 100 * (0.05 * inscrits) / exprimes) |>
  pull(value)

vote_bar_ids <- c(
  "ll_lr", "kanaky_pour_tous", "eveil", "nous_reunis", "une_province",
  "faire_pays", "unis_pour_le_pays", "espoir"
)

vote_bars <- result_keys |>
  filter(province == "Province Sud", list_id %in% vote_bar_ids) |>
  left_join(resultats, by = c("province", "numero_liste")) |>
  select(list_id, province, numero_liste, voix, pct_exprimes, pct_inscrits, sieges_province, sieges_congres) |>
  left_join(
    program_positions |>
      select(list_id, label, short_label, famille, role, color, core_third_way, neighbor),
    by = "list_id"
  ) |>
  mutate(
    category = case_when(
      role == "référence" ~ "Pôles représentés",
      neighbor ~ "Voisinage pro-pays",
      TRUE ~ "Troisième voie retenue"
    ),
    threshold = sud_threshold_pct_exprimes
  ) |>
  arrange(desc(pct_exprimes))

position_points <- program_positions |>
  select(
    list_id, label, short_label, famille, role, color, x_institution, y_economie,
    voix, pct_exprimes_scope, pct_inscrits_scope, sieges_province,
    sieges_congres, core_third_way, neighbor
  )

theme_matrix <- tribble(
  ~list_id, ~theme, ~score,
  "ll_lr", "Lien France", 3, "ll_lr", "Accord négocié", 1, "ll_lr", "Souveraineté partagée", 0, "ll_lr", "Stabilité", 2, "ll_lr", "Cohésion", 1, "ll_lr", "Participation", 0, "ll_lr", "Institutions", 2, "ll_lr", "Sécurité", 3,
  "kanaky_pour_tous", "Lien France", 0, "kanaky_pour_tous", "Accord négocié", 2, "kanaky_pour_tous", "Souveraineté partagée", 1, "kanaky_pour_tous", "Stabilité", 1, "kanaky_pour_tous", "Cohésion", 2, "kanaky_pour_tous", "Participation", 2, "kanaky_pour_tous", "Institutions", 1, "kanaky_pour_tous", "Sécurité", 1,
  "eveil", "Lien France", 1, "eveil", "Accord négocié", 2, "eveil", "Souveraineté partagée", 1, "eveil", "Stabilité", 2, "eveil", "Cohésion", 3, "eveil", "Participation", 3, "eveil", "Institutions", 2, "eveil", "Sécurité", 1,
  "une_province", "Lien France", 2, "une_province", "Accord négocié", 3, "une_province", "Souveraineté partagée", 2, "une_province", "Stabilité", 2, "une_province", "Cohésion", 2, "une_province", "Participation", 1, "une_province", "Institutions", 1, "une_province", "Sécurité", 0,
  "nous_reunis", "Lien France", 2, "nous_reunis", "Accord négocié", 1, "nous_reunis", "Souveraineté partagée", 0, "nous_reunis", "Stabilité", 2, "nous_reunis", "Cohésion", 2, "nous_reunis", "Participation", 1, "nous_reunis", "Institutions", 1, "nous_reunis", "Sécurité", 1,
  "espoir", "Lien France", 3, "espoir", "Accord négocié", 2, "espoir", "Souveraineté partagée", 0, "espoir", "Stabilité", 3, "espoir", "Cohésion", 1, "espoir", "Participation", 1, "espoir", "Institutions", 2, "espoir", "Sécurité", 1,
  "faire_pays", "Lien France", 1, "faire_pays", "Accord négocié", 3, "faire_pays", "Souveraineté partagée", 3, "faire_pays", "Stabilité", 2, "faire_pays", "Cohésion", 2, "faire_pays", "Participation", 2, "faire_pays", "Institutions", 3, "faire_pays", "Sécurité", 0,
  "unis_pour_le_pays", "Lien France", 1, "unis_pour_le_pays", "Accord négocié", 3, "unis_pour_le_pays", "Souveraineté partagée", 3, "unis_pour_le_pays", "Stabilité", 2, "unis_pour_le_pays", "Cohésion", 2, "unis_pour_le_pays", "Participation", 2, "unis_pour_le_pays", "Institutions", 2, "unis_pour_le_pays", "Sécurité", 0
) |>
  left_join(
    program_positions |>
      select(list_id, label, short_label, color, role, core_third_way, neighbor),
    by = "list_id"
  ) |>
  mutate(
    theme = factor(
      theme,
      levels = c(
        "Lien France", "Accord négocié", "Souveraineté partagée", "Stabilité",
        "Cohésion", "Participation", "Institutions", "Sécurité"
      )
    ),
    short_label = factor(
      short_label,
      levels = c(
        "LL-LR", "Kanaky pour tous", "Éveil océanien", "Une Province pour tous",
        "Nous, réunis", "Un espoir pour demain", "Faire Pays", "Unis pour le Pays"
      )
    )
  )

eco_social_levers <- tribble(
  ~list_id, ~theme, ~score,
  "ll_lr", "Vie chère", 2, "ll_lr", "Charges / fiscalité", 3, "ll_lr", "Entreprises", 3, "ll_lr", "Nickel", 1, "ll_lr", "Pauvreté", 1, "ll_lr", "Santé / aides", 1, "ll_lr", "Production locale", 1, "ll_lr", "Jeunesse / insertion", 1,
  "kanaky_pour_tous", "Vie chère", 3, "kanaky_pour_tous", "Charges / fiscalité", 0, "kanaky_pour_tous", "Entreprises", 1, "kanaky_pour_tous", "Nickel", 1, "kanaky_pour_tous", "Pauvreté", 3, "kanaky_pour_tous", "Santé / aides", 3, "kanaky_pour_tous", "Production locale", 3, "kanaky_pour_tous", "Jeunesse / insertion", 3,
  "eveil", "Vie chère", 2, "eveil", "Charges / fiscalité", 2, "eveil", "Entreprises", 2, "eveil", "Nickel", 0, "eveil", "Pauvreté", 2, "eveil", "Santé / aides", 2, "eveil", "Production locale", 1, "eveil", "Jeunesse / insertion", 1,
  "une_province", "Vie chère", 1, "une_province", "Charges / fiscalité", 1, "une_province", "Entreprises", 2, "une_province", "Nickel", 1, "une_province", "Pauvreté", 2, "une_province", "Santé / aides", 2, "une_province", "Production locale", 1, "une_province", "Jeunesse / insertion", 1,
  "nous_reunis", "Vie chère", 3, "nous_reunis", "Charges / fiscalité", 2, "nous_reunis", "Entreprises", 3, "nous_reunis", "Nickel", 0, "nous_reunis", "Pauvreté", 2, "nous_reunis", "Santé / aides", 2, "nous_reunis", "Production locale", 3, "nous_reunis", "Jeunesse / insertion", 1,
  "espoir", "Vie chère", 2, "espoir", "Charges / fiscalité", 2, "espoir", "Entreprises", 2, "espoir", "Nickel", 3, "espoir", "Pauvreté", 1, "espoir", "Santé / aides", 1, "espoir", "Production locale", 1, "espoir", "Jeunesse / insertion", 2,
  "faire_pays", "Vie chère", 2, "faire_pays", "Charges / fiscalité", 2, "faire_pays", "Entreprises", 1, "faire_pays", "Nickel", 0, "faire_pays", "Pauvreté", 3, "faire_pays", "Santé / aides", 3, "faire_pays", "Production locale", 1, "faire_pays", "Jeunesse / insertion", 2,
  "unis_pour_le_pays", "Vie chère", 1, "unis_pour_le_pays", "Charges / fiscalité", 1, "unis_pour_le_pays", "Entreprises", 2, "unis_pour_le_pays", "Nickel", 2, "unis_pour_le_pays", "Pauvreté", 3, "unis_pour_le_pays", "Santé / aides", 3, "unis_pour_le_pays", "Production locale", 2, "unis_pour_le_pays", "Jeunesse / insertion", 2
) |>
  left_join(
    program_positions |>
      select(list_id, label, short_label, color, role, core_third_way, neighbor),
    by = "list_id"
  ) |>
  mutate(
    theme = factor(
      theme,
      levels = c(
        "Vie chère", "Charges / fiscalité", "Entreprises", "Nickel",
        "Pauvreté", "Santé / aides", "Production locale", "Jeunesse / insertion"
      )
    ),
    short_label = factor(
      short_label,
      levels = c(
        "LL-LR", "Kanaky pour tous", "Éveil océanien", "Une Province pour tous",
        "Nous, réunis", "Un espoir pour demain", "Faire Pays", "Unis pour le Pays"
      )
    )
  )

stat_cards <- function() {
  cards <- tribble(
    ~value, ~label, ~note,
    fmt_pct(third_sud_pct), "des exprimés dans le Sud", "Éveil océanien + trois centres non-indépendantistes + Faire Pays",
    fmt_int(third_sud_no_seat_voix), "voix sans siège", paste0(fmt_pct(third_sud_no_seat_pct), " des exprimés sudistes hors Éveil"),
    as.character(third_sud_sieges), "sièges provinciaux", "tous portés par l'Éveil océanien",
    fmt_pct(third_all_pct_nc), "des exprimés NC", paste0(fmt_int(third_all_voix), " voix en ajoutant Faire Pays Nord")
  )

  tagList(tags$div(
    class = "tv-stat-grid",
    pmap(cards, function(value, label, note) {
      tags$article(
        class = "tv-stat-card",
        tags$div(class = "tv-stat-value", value),
        tags$div(class = "tv-stat-label", label),
        tags$p(class = "tv-stat-note", note)
      )
    })
  ))
}

program_cards <- function() {
  dat <- program_positions |>
    filter(core_third_way | neighbor) |>
    arrange(
      factor(
        list_id,
        levels = c("eveil", "une_province", "nous_reunis", "espoir", "faire_pays", "unis_pour_le_pays")
      )
    )

  tagList(tags$div(
    class = "tv-program-grid",
    pmap(dat, function(
      list_id, label, short_label, famille, role, color, x_institution, y_economie,
      institution, economie, angle, mesure1, mesure2, mesure3, document_id,
      core_third_way, neighbor, voix, inscrits_scope, exprimes_scope,
      pct_exprimes_scope, pct_inscrits_scope, sieges_province, sieges_congres,
      provinces_presence, source_url
    ) {
      tags$article(
        class = paste("tv-program-card", if (neighbor) "tv-program-card--neighbor" else ""),
        style = paste0("--list-color:", color, ";"),
        tags$div(
          class = "tv-program-card__top",
          tags$span(class = "tv-program-card__family", famille),
          tags$span(
            class = "tv-program-card__result",
            paste0(fmt_int(voix), " voix · ", fmt_pct(pct_exprimes_scope), " expr.")
          )
        ),
        tags$h3(label),
        tags$p(class = "tv-program-card__angle", angle),
        tags$dl(
          class = "tv-program-card__axes",
          tags$dt("Institutionnel"),
          tags$dd(institution),
          tags$dt("Économie"),
          tags$dd(economie)
        ),
        tags$ul(
          tags$li(mesure1),
          tags$li(mesure2),
          tags$li(mesure3)
        ),
        if (!is.na(source_url) && nzchar(source_url)) {
          tags$a(
            class = "tv-program-card__source",
            href = source_url,
            target = "_blank",
            rel = "noopener",
            "Circulaire officielle"
          )
        }
      )
    })
  ))
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
    '<div id="', id, '" class="tv-sketch" data-tv-chart="', type, '"></div>\n',
    '<script type="application/json" id="', id, '-data">', json, '</script>\n',
    '<p class="tv-sketch-caption">', caption, '</p>\n',
    '<script>window.ContoursTroisiemeVoie && window.ContoursTroisiemeVoie.render("', id, '");</script>\n',
    sep = ""
  )
}
