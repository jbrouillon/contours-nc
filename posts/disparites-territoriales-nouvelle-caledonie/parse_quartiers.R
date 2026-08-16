# Donnees infracommunales du Grand Noumea, RP 2014 et RP 2019 -------------
#
# Ce script construit trois objets principaux :
# - quartiers_2014 et quartiers_2019 : 61 quartiers, sans agregats ;
# - quartiers_indicateurs : empilement des deux millesimes ;
# - quartiers_evolution : taux 2014/2019 et variations en points.
#
# Les douze taux sont exprimes de 0 a 100. Leurs numerateurs et denominateurs
# sont conserves dans les tables pour eviter toute ambiguite d'univers.

suppressPackageStartupMessages({
  library(dplyr)
  library(readxl)
  library(tibble)
})

locate_quartiers_project <- function() {
  starts <- getwd()
  args <- commandArgs(trailingOnly = FALSE)
  file_arg <- grep("^--file=", args, value = TRUE)

  if (length(file_arg) > 0) {
    script_path <- sub("^--file=", "", file_arg[[1]])
    starts <- c(dirname(normalizePath(script_path, mustWork = FALSE)), starts)
  }

  for (start in unique(starts)) {
    current <- normalizePath(start, winslash = "/", mustWork = TRUE)

    for (i in seq_len(8)) {
      target <- file.path(
        current,
        "data",
        "population",
        "rp2019-quartiers-communes-plus-de-10000-habitants.xls"
      )

      if (file.exists(target)) {
        return(current)
      }

      parent <- dirname(current)
      if (identical(parent, current)) break
      current <- parent
    }
  }

  stop("Impossible de localiser la racine du projet Contours NC.")
}

quartiers_project_dir <- locate_quartiers_project()
quartiers_population_dir <- file.path(quartiers_project_dir, "data", "population")

quartiers_files <- c(
  `2014` = file.path(
    quartiers_population_dir,
    "rp2014-quartiers-communes-plus-de-10000-habitants.xls"
  ),
  `2019` = file.path(
    quartiers_population_dir,
    "rp2019-quartiers-communes-plus-de-10000-habitants.xls"
  )
)

missing_quartiers_files <- quartiers_files[!file.exists(quartiers_files)]
if (length(missing_quartiers_files) > 0) {
  stop(
    "Fichier(s) infracommunal(aux) manquant(s) :\n",
    paste(missing_quartiers_files, collapse = "\n")
  )
}

quartiers_aggregate_labels <- c(
  "NOUMEA",
  "DUMBEA",
  "MONT-DORE",
  "MONT-DORE (LE)",
  "PAITA",
  "GRAND NOUMEA"
)

canonical_quartier <- function(x) {
  x <- trimws(gsub("[[:space:]]+", " ", as.character(x)))

  recode(
    x,
    "Receiving, Motor Pool" = "Motor pool, Receiving",
    "Doniambo, Montagne Coupée, Vallée du Tir" =
      "Vallée du tir, Doniambo, Montagne coupée",
    "Vallée du tir, Doniambo, Montagne Coupée" =
      "Vallée du tir, Doniambo, Montagne coupée",
    "Vallée du génie, Centre-ville" = "Vallée du génie, Centre ville",
    "Numbo-Koumourou" = "Numbo-Koumourou, Tindu",
    .default = x
  )
}

read_quartier_sheet <- function(path, sheet, columns) {
  raw <- read_excel(
    path,
    sheet = sheet,
    col_names = FALSE,
    .name_repair = "minimal"
  )

  values <- lapply(
    unname(columns),
    function(column) suppressWarnings(as.numeric(raw[[column]]))
  )

  out <- data.frame(
    source_row = seq_len(nrow(raw)),
    quartier_source = as.character(raw[[1]]),
    values,
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  names(out)[-(1:2)] <- names(columns)

  total_name <- tail(names(columns), 1)
  keep <- !is.na(out[[total_name]]) &
    !(trimws(out$quartier_source) %in% quartiers_aggregate_labels)

  out <- out[keep, , drop = FALSE]
  out$quartier <- canonical_quartier(out$quartier_source)
  rownames(out) <- NULL

  if (nrow(out) != 61) {
    stop(
      sprintf(
        "%s (%s) : 61 quartiers attendus, %s trouves.",
        basename(path),
        sheet,
        nrow(out)
      )
    )
  }

  if (anyDuplicated(out$quartier)) {
    stop(sprintf("%s (%s) : libelles de quartier dupliques.", basename(path), sheet))
  }

  as_tibble(out)
}

assert_sum <- function(data, parts, total, label) {
  observed <- rowSums(data[, parts, drop = FALSE])
  bad <- which(observed != data[[total]])

  if (length(bad) > 0) {
    stop(
      label,
      " : controle d'additivite en echec pour ",
      paste(data$quartier[bad], collapse = ", ")
    )
  }
}

assert_equal <- function(left, right, quartiers, label) {
  bad <- which(left != right)

  if (length(bad) > 0) {
    stop(
      label,
      " : effectifs incoherents pour ",
      paste(quartiers[bad], collapse = ", ")
    )
  }
}

assert_same_quartiers <- function(tables, year) {
  reference <- tables$langue$quartier

  for (table_name in names(tables)) {
    current <- tables[[table_name]]$quartier
    bad <- which(reference != current)

    if (length(bad) > 0) {
      details <- paste0(
        "ligne ",
        bad,
        " : ",
        reference[bad],
        " != ",
        current[bad]
      )

      stop(
        "RP ",
        year,
        " : alignement des quartiers incorrect dans ",
        table_name,
        " (",
        paste(details, collapse = "; "),
        ")."
      )
    }
  }

  invisible(reference)
}

read_quartier_tables <- function(year) {
  year <- as.character(year)
  path <- quartiers_files[[year]]

  if (identical(year, "2014")) {
    csp_sheet <- "P13GN"
    csp_columns <- c(
      agriculteurs_artisans_commercants = 16,
      cadres_prof_intermediaires = 17,
      employes = 18,
      ouvriers = 19,
      retraites = 20,
      autres_inactifs = 21,
      population_15_plus = 22
    )
    status_sheet <- "P11GN"
    status_columns <- c(
      independants = 10,
      cdd_stagiaires = 11,
      cdi = 12,
      emplois_statut = 13
    )
    electricity_columns <- c(
      raccordes_reseau_electrique = 2,
      non_raccordes_reseau_electrique = 3,
      population_residences_principales = 4
    )
    household_equipment_columns <- c(
      avec_internet = 12,
      sans_internet = 13,
      population_menages_equipement = 14
    )
    vehicle_columns <- c(
      avec_automobile = 2,
      sans_automobile = 3,
      population_menages_vehicules = 8
    )
  } else if (identical(year, "2019")) {
    csp_sheet <- "P11GN"
    csp_columns <- c(
      agriculteurs_artisans_commercants = 2,
      cadres_prof_intermediaires = 3,
      employes = 4,
      ouvriers = 5,
      retraites = 6,
      autres_inactifs = 7,
      population_15_plus = 8
    )
    status_sheet <- "P13GN"
    status_columns <- c(
      independants = 2,
      cdd_stagiaires = 3,
      cdi = 4,
      emplois_statut = 5
    )
    electricity_columns <- c(
      raccordes_reseau_electrique = 2,
      non_raccordes_reseau_electrique = 3,
      population_residences_principales = 8
    )
    household_equipment_columns <- c(
      avec_internet = 8,
      sans_internet = 9,
      population_menages_equipement = 10
    )
    vehicle_columns <- c(
      sans_automobile = 2,
      avec_automobile = 3,
      population_menages_vehicules = 8
    )
  } else {
    stop("Millesime non pris en charge : ", year)
  }

  tables <- list(
    naissance = read_quartier_sheet(
      path,
      "P02GN",
      c(
        nes_nouvelle_caledonie = 12,
        nes_wallis_polynesie = 13,
        nes_metropole_dom = 14,
        nes_etranger = 15,
        population_totale = 16
      )
    ),
    langue = read_quartier_sheet(
      path,
      "P09GN",
      c(
        sans_connaissance_langue_kanak = 10,
        comprend_langue_kanak = 11,
        parle_langue_kanak = 12,
        population_15_plus = 13
      )
    ),
    activite = read_quartier_sheet(
      path,
      "P10GN",
      c(
        actifs_ayant_emploi = 14,
        chomeurs_recensement = 15,
        eleves_etudiants = 16,
        retraites_activite = 17,
        autres_inactifs_activite = 18,
        population_15_plus = 19
      )
    ),
    csp = read_quartier_sheet(path, csp_sheet, csp_columns),
    statut = read_quartier_sheet(path, status_sheet, status_columns),
    electricite = read_quartier_sheet(
      path,
      "R5GNp",
      electricity_columns
    ),
    diplome = read_quartier_sheet(
      path,
      "P08GN",
      c(
        sans_diplome = 20,
        population_15_plus_diplome = 28
      )
    ),
    occupation = read_quartier_sheet(
      path,
      "R2GNp",
      c(
        proprietaires = 2,
        loges_gratuitement = 3,
        locataires = 4,
        population_residences_principales_occupation = 7
      )
    ),
    eau = read_quartier_sheet(
      path,
      "R6GNp",
      c(
        avec_eau_courante_interieure = 2,
        sans_eau_courante_interieure = 3,
        population_residences_principales_eau = 4
      )
    ),
    equipement_menages = read_quartier_sheet(
      path,
      "M2GNp",
      household_equipment_columns
    ),
    vehicules = read_quartier_sheet(
      path,
      "M3GNp",
      vehicle_columns
    )
  )

  assert_same_quartiers(tables, year)

  assert_sum(
    tables$naissance,
    c(
      "nes_nouvelle_caledonie",
      "nes_wallis_polynesie",
      "nes_metropole_dom",
      "nes_etranger"
    ),
    "population_totale",
    paste("RP", year, "P02GN")
  )

  assert_sum(
    tables$langue,
    c(
      "sans_connaissance_langue_kanak",
      "comprend_langue_kanak",
      "parle_langue_kanak"
    ),
    "population_15_plus",
    paste("RP", year, "P09GN")
  )
  assert_sum(
    tables$activite,
    c(
      "actifs_ayant_emploi",
      "chomeurs_recensement",
      "eleves_etudiants",
      "retraites_activite",
      "autres_inactifs_activite"
    ),
    "population_15_plus",
    paste("RP", year, "P10GN")
  )
  assert_sum(
    tables$csp,
    c(
      "agriculteurs_artisans_commercants",
      "cadres_prof_intermediaires",
      "employes",
      "ouvriers",
      "retraites",
      "autres_inactifs"
    ),
    "population_15_plus",
    paste("RP", year, csp_sheet)
  )
  assert_sum(
    tables$statut,
    c("independants", "cdd_stagiaires", "cdi"),
    "emplois_statut",
    paste("RP", year, status_sheet)
  )
  assert_sum(
    tables$electricite,
    c("raccordes_reseau_electrique", "non_raccordes_reseau_electrique"),
    "population_residences_principales",
    paste("RP", year, "R5GNp")
  )
  assert_sum(
    tables$occupation,
    c("proprietaires", "loges_gratuitement", "locataires"),
    "population_residences_principales_occupation",
    paste("RP", year, "R2GNp")
  )
  assert_sum(
    tables$eau,
    c("avec_eau_courante_interieure", "sans_eau_courante_interieure"),
    "population_residences_principales_eau",
    paste("RP", year, "R6GNp")
  )
  assert_sum(
    tables$equipement_menages,
    c("avec_internet", "sans_internet"),
    "population_menages_equipement",
    paste("RP", year, "M2GNp")
  )
  assert_sum(
    tables$vehicules,
    c("avec_automobile", "sans_automobile"),
    "population_menages_vehicules",
    paste("RP", year, "M3GNp")
  )

  assert_equal(
    tables$langue$population_15_plus,
    tables$activite$population_15_plus,
    tables$langue$quartier,
    paste("RP", year, "P09GN/P10GN")
  )
  assert_equal(
    tables$langue$population_15_plus,
    tables$csp$population_15_plus,
    tables$langue$quartier,
    paste("RP", year, "P09GN/CSP")
  )

  emplois_csp <- rowSums(
    tables$csp[, c(
      "agriculteurs_artisans_commercants",
      "cadres_prof_intermediaires",
      "employes",
      "ouvriers"
    )]
  )

  assert_equal(
    tables$activite$actifs_ayant_emploi,
    emplois_csp,
    tables$langue$quartier,
    paste("RP", year, "emploi P10GN/CSP")
  )
  assert_equal(
    tables$activite$actifs_ayant_emploi,
    tables$statut$emplois_statut,
    tables$langue$quartier,
    paste("RP", year, "emploi P10GN/statut")
  )

  list(
    naissance = tables$naissance,
    langue = tables$langue,
    activite = tables$activite,
    csp = tables$csp,
    statut = tables$statut,
    electricite = tables$electricite,
    diplome = tables$diplome,
    occupation = tables$occupation,
    eau = tables$eau,
    equipement_menages = tables$equipement_menages,
    vehicules = tables$vehicules,
    emplois_csp = emplois_csp
  )
}

build_quartiers_year <- function(year) {
  tables <- read_quartier_tables(year)
  n <- nrow(tables$langue)
  commune <- rep(
    c("Nouméa", "Dumbéa", "Mont-Dore", "Païta"),
    c(31, 10, 12, 8)
  )

  if (length(commune) != n) {
    stop("Decoupage communal inattendu pour le RP ", year, ".")
  }

  population_active <-
    tables$activite$actifs_ayant_emploi + tables$activite$chomeurs_recensement
  connait_langue_kanak <-
    tables$langue$comprend_langue_kanak + tables$langue$parle_langue_kanak
  nes_hors_nc <-
    tables$naissance$nes_wallis_polynesie +
    tables$naissance$nes_metropole_dom +
    tables$naissance$nes_etranger
  employes_ouvriers <- tables$csp$employes + tables$csp$ouvriers

  tibble(
    annee = as.integer(year),
    id_quartier = sprintf("GN%02d", seq_len(n)),
    commune = commune,
    quartier = tables$langue$quartier,
    population_totale = as.integer(tables$naissance$population_totale),
    nes_hors_nc = as.integer(nes_hors_nc),
    taux_nes_hors_nc = 100 * nes_hors_nc / population_totale,
    population_15_plus = as.integer(tables$langue$population_15_plus),
    comprend_langue_kanak = as.integer(tables$langue$comprend_langue_kanak),
    parle_langue_kanak = as.integer(tables$langue$parle_langue_kanak),
    connait_langue_kanak = as.integer(connait_langue_kanak),
    taux_connaissance_langue_kanak = 100 *
      connait_langue_kanak / population_15_plus,
    actifs_ayant_emploi = as.integer(tables$activite$actifs_ayant_emploi),
    chomeurs_recensement = as.integer(tables$activite$chomeurs_recensement),
    population_active = as.integer(population_active),
    taux_chomage_recensement = 100 *
      chomeurs_recensement / population_active,
    cadres_prof_intermediaires =
      as.integer(tables$csp$cadres_prof_intermediaires),
    employes = as.integer(tables$csp$employes),
    ouvriers = as.integer(tables$csp$ouvriers),
    employes_ouvriers = as.integer(employes_ouvriers),
    emplois_csp = as.integer(tables$emplois_csp),
    taux_cadres_prof_intermediaires = 100 *
      cadres_prof_intermediaires / emplois_csp,
    taux_employes_ouvriers = 100 * employes_ouvriers / emplois_csp,
    independants = as.integer(tables$statut$independants),
    cdd_stagiaires = as.integer(tables$statut$cdd_stagiaires),
    cdi = as.integer(tables$statut$cdi),
    emplois_statut = as.integer(tables$statut$emplois_statut),
    taux_cdd_stagiaires = 100 * cdd_stagiaires / emplois_statut,
    sans_diplome = as.integer(tables$diplome$sans_diplome),
    population_15_plus_diplome =
      as.integer(tables$diplome$population_15_plus_diplome),
    taux_sans_diplome = 100 * sans_diplome / population_15_plus_diplome,
    locataires = as.integer(tables$occupation$locataires),
    population_residences_principales_occupation =
      as.integer(tables$occupation$population_residences_principales_occupation),
    taux_locataires = 100 *
      locataires / population_residences_principales_occupation,
    population_residences_principales =
      as.integer(tables$electricite$population_residences_principales),
    raccordes_reseau_electrique =
      as.integer(tables$electricite$raccordes_reseau_electrique),
    non_raccordes_reseau_electrique =
      as.integer(tables$electricite$non_raccordes_reseau_electrique),
    taux_non_raccordement_electrique = 100 *
      non_raccordes_reseau_electrique / population_residences_principales,
    sans_eau_courante_interieure =
      as.integer(tables$eau$sans_eau_courante_interieure),
    population_residences_principales_eau =
      as.integer(tables$eau$population_residences_principales_eau),
    taux_sans_eau_courante_interieure = 100 *
      sans_eau_courante_interieure / population_residences_principales_eau,
    sans_internet = as.integer(tables$equipement_menages$sans_internet),
    population_menages_equipement =
      as.integer(tables$equipement_menages$population_menages_equipement),
    taux_sans_internet = 100 * sans_internet / population_menages_equipement,
    sans_automobile = as.integer(tables$vehicules$sans_automobile),
    population_menages_vehicules =
      as.integer(tables$vehicules$population_menages_vehicules),
    taux_sans_automobile = 100 *
      sans_automobile / population_menages_vehicules
  )
}

quartiers_2014 <- build_quartiers_year(2014)
quartiers_2019 <- build_quartiers_year(2019)

if (!identical(quartiers_2014$id_quartier, quartiers_2019$id_quartier) ||
    !identical(quartiers_2014$commune, quartiers_2019$commune) ||
    !identical(quartiers_2014$quartier, quartiers_2019$quartier)) {
  stop("L'alignement exact des 61 quartiers entre 2014 et 2019 a echoue.")
}

quartiers_indicateurs <- bind_rows(quartiers_2014, quartiers_2019)

quartiers_rate_columns <- c(
  "taux_nes_hors_nc",
  "taux_chomage_recensement",
  "taux_cadres_prof_intermediaires",
  "taux_employes_ouvriers",
  "taux_cdd_stagiaires",
  "taux_connaissance_langue_kanak",
  "taux_non_raccordement_electrique",
  "taux_sans_diplome",
  "taux_locataires",
  "taux_sans_eau_courante_interieure",
  "taux_sans_internet",
  "taux_sans_automobile"
)

quartiers_rate_labels <- c(
  taux_nes_hors_nc = "Nés hors de Nouvelle-Calédonie",
  taux_chomage_recensement = "Chômage au sens du recensement",
  taux_cadres_prof_intermediaires = "Cadres et professions intermédiaires",
  taux_employes_ouvriers = "Employés et ouvriers",
  taux_cdd_stagiaires = "CDD et stagiaires",
  taux_connaissance_langue_kanak = "Comprend ou parle une langue kanak",
  taux_non_raccordement_electrique = "Non-raccordement au réseau électrique",
  taux_sans_diplome = "Sans diplôme",
  taux_locataires = "Locataires",
  taux_sans_eau_courante_interieure = "Sans eau courante à l’intérieur",
  taux_sans_internet = "Sans accès à internet",
  taux_sans_automobile = "Sans automobile"
)

quartiers_evolution <- quartiers_2014 |>
  select(id_quartier, commune, quartier, all_of(quartiers_rate_columns)) |>
  rename_with(
    ~ paste0(.x, "_2014"),
    all_of(quartiers_rate_columns)
  ) |>
  inner_join(
    quartiers_2019 |>
      select(id_quartier, commune, quartier, all_of(quartiers_rate_columns)) |>
      rename_with(
        ~ paste0(.x, "_2019"),
        all_of(quartiers_rate_columns)
      ),
    by = c("id_quartier", "commune", "quartier")
  )

for (rate in quartiers_rate_columns) {
  quartiers_evolution[[paste0(rate, "_evolution_pp")]] <-
    quartiers_evolution[[paste0(rate, "_2019")]] -
    quartiers_evolution[[paste0(rate, "_2014")]]
}

quartiers_distribution <- bind_rows(lapply(quartiers_rate_columns, function(rate) {
  values_2014 <- quartiers_2014[[rate]]
  values_2019 <- quartiers_2019[[rate]]
  q14 <- quantile(values_2014, c(0.1, 0.5, 0.9), names = FALSE, type = 7)
  q19 <- quantile(values_2019, c(0.1, 0.5, 0.9), names = FALSE, type = 7)

  tibble(
    variable = rate,
    indicateur = unname(quartiers_rate_labels[[rate]]),
    rho_spearman_2014_2019 = cor(
      values_2014,
      values_2019,
      method = "spearman"
    ),
    p10_2014 = q14[[1]],
    mediane_2014 = q14[[2]],
    p90_2014 = q14[[3]],
    ecart_p90_p10_2014 = q14[[3]] - q14[[1]],
    p10_2019 = q19[[1]],
    mediane_2019 = q19[[2]],
    p90_2019 = q19[[3]],
    ecart_p90_p10_2019 = q19[[3]] - q19[[1]],
    evolution_ecart_p90_p10 =
      (q19[[3]] - q19[[1]]) - (q14[[3]] - q14[[1]])
  )
}))

dissimilarity_index <- function(numerator, denominator) {
  complement <- denominator - numerator
  0.5 * sum(abs(
    numerator / sum(numerator) - complement / sum(complement)
  ))
}

quartiers_rate_universes <- list(
  taux_nes_hors_nc = c("nes_hors_nc", "population_totale"),
  taux_chomage_recensement = c("chomeurs_recensement", "population_active"),
  taux_cadres_prof_intermediaires = c(
    "cadres_prof_intermediaires",
    "emplois_csp"
  ),
  taux_employes_ouvriers = c("employes_ouvriers", "emplois_csp"),
  taux_cdd_stagiaires = c("cdd_stagiaires", "emplois_statut"),
  taux_connaissance_langue_kanak = c(
    "connait_langue_kanak",
    "population_15_plus"
  ),
  taux_non_raccordement_electrique = c(
    "non_raccordes_reseau_electrique",
    "population_residences_principales"
  ),
  taux_sans_diplome = c("sans_diplome", "population_15_plus_diplome"),
  taux_locataires = c(
    "locataires",
    "population_residences_principales_occupation"
  ),
  taux_sans_eau_courante_interieure = c(
    "sans_eau_courante_interieure",
    "population_residences_principales_eau"
  ),
  taux_sans_internet = c("sans_internet", "population_menages_equipement"),
  taux_sans_automobile = c(
    "sans_automobile",
    "population_menages_vehicules"
  )
)

quartiers_dissimilarite <- bind_rows(lapply(
  names(quartiers_rate_universes),
  function(rate) {
    universe <- quartiers_rate_universes[[rate]]
    d14 <- dissimilarity_index(
      quartiers_2014[[universe[[1]]]],
      quartiers_2014[[universe[[2]]]]
    )
    d19 <- dissimilarity_index(
      quartiers_2019[[universe[[1]]]],
      quartiers_2019[[universe[[2]]]]
    )

    tibble(
      variable = rate,
      indicateur = unname(quartiers_rate_labels[[rate]]),
      indice_2014 = d14,
      indice_2019 = d19,
      evolution = d19 - d14
    )
  }
))

if (sys.nframe() == 0L) {
  message(
    "Jeux construits : ",
    nrow(quartiers_2014),
    " quartiers en 2014 et ",
    nrow(quartiers_2019),
    " quartiers en 2019."
  )
  print(quartiers_distribution, n = Inf, width = Inf)
}
