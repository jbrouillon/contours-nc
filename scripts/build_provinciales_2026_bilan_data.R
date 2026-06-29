suppressPackageStartupMessages({
  library(dplyr)
  library(pdftools)
  library(purrr)
  library(readr)
  library(stringr)
  library(tibble)
})

script_arg <- grep("^--file=", commandArgs(FALSE), value = TRUE)
script_path <- if (length(script_arg) > 0) {
  normalizePath(sub("^--file=", "", script_arg[[1]]), winslash = "/", mustWork = TRUE)
} else {
  normalizePath("scripts/build_provinciales_2026_bilan_data.R", winslash = "/", mustWork = TRUE)
}

project_dir <- normalizePath(file.path(dirname(script_path), ".."), winslash = "/", mustWork = TRUE)
raw_dir <- file.path(project_dir, "data", "elections", "data_raw", "provinciales_2026")
out_dir <- file.path(project_dir, "data", "elections", "data_processed", "provinciales_2026")
pdf_path <- file.path(raw_dir, "PROVINCIALES_2026_Resultats_provisoires.pdf")

source_pdf <- paste0(
  "https://www.nouvelle-caledonie.gouv.fr/contenu/telechargement/13485/112061/",
  "file/PROVINCIALES_2026_R%C3%A9sultats_provisoires.pdf"
)

source_wiki <- c(
  "1989" = "https://fr.wikipedia.org/wiki/%C3%89lections_provinciales_n%C3%A9o-cal%C3%A9doniennes_de_1989",
  "1995" = "https://fr.wikipedia.org/wiki/%C3%89lections_provinciales_n%C3%A9o-cal%C3%A9doniennes_de_1995",
  "1999" = "https://fr.wikipedia.org/wiki/%C3%89lections_provinciales_n%C3%A9o-cal%C3%A9doniennes_de_1999",
  "2004" = "https://fr.wikipedia.org/wiki/%C3%89lections_provinciales_n%C3%A9o-cal%C3%A9doniennes_de_2004",
  "2009" = "https://fr.wikipedia.org/wiki/%C3%89lections_provinciales_n%C3%A9o-cal%C3%A9doniennes_de_2009",
  "2014" = "https://fr.wikipedia.org/wiki/%C3%89lections_provinciales_n%C3%A9o-cal%C3%A9doniennes_de_2014",
  "2019" = "https://fr.wikipedia.org/wiki/%C3%89lections_provinciales_n%C3%A9o-cal%C3%A9doniennes_de_2019",
  "2026" = "https://fr.wikipedia.org/wiki/%C3%89lections_provinciales_n%C3%A9o-cal%C3%A9doniennes_de_2026"
)

parse_int_fr <- function(x) {
  as.integer(round(parse_number(x, locale = locale(decimal_mark = ",", grouping_mark = " "))))
}

parse_pct_fr <- function(x) {
  parse_number(x, locale = locale(decimal_mark = ",", grouping_mark = " "))
}

list_meta <- tribble(
  ~province, ~numero_liste, ~code_pdf, ~liste, ~etiquette, ~bloc_historique, ~nuance, ~couleur,
  "Province Sud", 1, "LDVC", "Un autre monde est possible !", "Éveil océanien", "anti_independantiste", "Océanien / transversal", "#55a6b8",
  "Province Sud", 2, "FLNKS", "Kanaky pour tous", "FLNKS", "independantiste", "FLNKS / UC-CCAT-DUS-RDO-DA-PT", "#2f925d",
  "Province Sud", 3, "RN-MCFNC", "France Calédonie, une patrie", "RN-MCFNC", "anti_independantiste", "Droite nationale", "#7a4a28",
  "Province Sud", 5, "AUTRES", "Une Province pour tous", "DVC-Calédonie ensemble", "anti_independantiste", "Centre non-indépendantiste", "#67a9cf",
  "Province Sud", 6, "IND", "Souveraineté Kanaky Nouvelle-Calédonie", "SKNC", "independantiste", "Indépendantiste / souverainiste", "#b6483b",
  "Province Sud", 7, "AUTRES", "Faire Pays", "Faire Pays", "autres_listes", "Souverainiste / pro-pays", "#4f8f6a",
  "Province Sud", 8, "AUTRES", "Pour une Calédonie française", "Pour une Calédonie française", "anti_independantiste", "Droite nationale", "#244e78",
  "Province Sud", 9, "AUTRES", "Nous, réunis !", "Nous, réunis", "anti_independantiste", "Centre non-indépendantiste", "#8db8d1",
  "Province Sud", 10, "LL-LR", "Les Loyalistes et Le Rassemblement - Forts et unis", "LL-LR", "anti_independantiste", "Loyaliste droite", "#305f9f",
  "Province Sud", 11, "UNI", "Unis pour le Pays", "UNI", "independantiste", "UNI / Palika", "#f0c52f",
  "Province Sud", 12, "Autres", "Un espoir pour demain", "Un espoir pour demain", "anti_independantiste", "Centre droit non-indépendantiste", "#829dbd",
  "Province Nord", 1, "LL - LR", "Agissons ensemble pour le Nord", "LL-LR Nord", "anti_independantiste", "Loyaliste droite", "#305f9f",
  "Province Nord", 2, "NAT", "Alternative Nord pour un pays souverain", "Alternative Nord", "independantiste", "UPK / Parti travailliste", "#b6483b",
  "Province Nord", 3, "UC FLNKS", "UC-FLNKS", "UC-FLNKS", "independantiste", "UC-FLNKS", "#2f925d",
  "Province Nord", 4, "AUTRES", "Faire Pays", "Faire Pays", "autres_listes", "Souverainiste / pro-pays", "#4f8f6a",
  "Province Nord", 5, "UNI", "Union nationale pour l'indépendance", "UNI", "independantiste", "UNI / Palika", "#f0c52f",
  "Province des Iles", 1, "PALIKA", "Palika Îles", "Palika Îles", "independantiste", "UNI / Palika", "#f0c52f",
  "Province des Iles", 2, "NS", "Un nouveau souffle", "Un nouveau souffle", "anti_independantiste", "Loyaliste droite", "#305f9f",
  "Province des Iles", 3, "AUTRES", "Baselaia", "Baselaia", "independantiste", "UC dissidente", "#7aa874",
  "Province des Iles", 4, "DA", "Nation autochtone", "Nation autochtone / DA", "independantiste", "Dynamique autochtone", "#88a96d",
  "Province des Iles", 5, "UC FLNKS", "UC-FLNKS Îles", "UC-FLNKS Îles", "independantiste", "UC-FLNKS", "#2f925d",
  "Province des Iles", 6, "AUTRES", "S'engager et œuvrer", "UPK", "independantiste", "UPK", "#b6483b",
  "Province des Iles", 7, "UCC", "Union pour construire dans le consensus", "UCC", "independantiste", "UC dissidente / PT", "#7aa874"
)

page_lists <- list(
  `1` = list(province = "Province Sud", listes = c(1, 2, 3, 5, 6, 7)),
  `2` = list(province = "Province Sud", listes = c(8, 9, 10, 11, 12)),
  `3` = list(province = "Province Nord", listes = c(1, 2, 3, 4, 5)),
  `4` = list(province = "Province des Iles", listes = c(1, 2, 3, 4, 5, 6)),
  `5` = list(province = "Province des Iles", listes = c(7))
)

seats <- tribble(
  ~province, ~numero_liste, ~sieges_province, ~sieges_congres,
  "Province Sud", 1, 5, 4,
  "Province Sud", 2, 7, 6,
  "Province Sud", 10, 28, 22,
  "Province Nord", 1, 3, 2,
  "Province Nord", 3, 10, 7,
  "Province Nord", 5, 9, 6,
  "Province des Iles", 1, 2, 1,
  "Province des Iles", 4, 6, 3,
  "Province des Iles", 5, 6, 3
)

parse_pdf_line <- function(line, province, list_numbers) {
  first_digit <- str_locate(line, "\\d")[1, 1]
  if (is.na(first_digit)) {
    return(tibble())
  }

  commune <- str_squish(str_sub(line, 1, first_digit - 1))
  tokens <- str_extract_all(str_sub(line, first_digit), "\\d+(?:,\\d+)?%?")[[1]]
  expected <- 9 + 2 * length(list_numbers)

  if (commune == "" || length(tokens) < expected) {
    return(tibble())
  }

  tokens <- tokens[seq_len(expected)]
  idx <- seq_along(list_numbers)

  tibble(
    province = province,
    commune = commune,
    numero_liste = list_numbers,
    inscrits = parse_int_fr(tokens[[1]]),
    votants = parse_int_fr(tokens[[2]]),
    participation = parse_pct_fr(tokens[[3]]),
    abstentions = parse_int_fr(tokens[[4]]),
    abstention = parse_pct_fr(tokens[[5]]),
    nuls = parse_int_fr(tokens[[6]]),
    blancs = parse_int_fr(tokens[[7]]),
    exprimes = parse_int_fr(tokens[[8]]),
    voix = map_int(tokens[2 * idx + 8], parse_int_fr),
    pct_exprimes = map_dbl(tokens[2 * idx + 9], parse_pct_fr)
  )
}

extract_2026_results <- function() {
  if (!file.exists(pdf_path)) {
    stop("PDF manquant : ", pdf_path, call. = FALSE)
  }

  pdf_pages <- pdf_text(pdf_path)

  communes <- imap_dfr(page_lists, function(spec, page_number) {
    lines <- str_split(pdf_pages[[as.integer(page_number)]], "\n")[[1]]
    map_dfr(lines, parse_pdf_line, province = spec$province, list_numbers = spec$listes)
  }) |>
    left_join(list_meta, by = c("province", "numero_liste"))

  if (any(is.na(communes$etiquette))) {
    stop("Métadonnées de liste manquantes après extraction PDF.", call. = FALSE)
  }

  totals <- communes |>
    filter(commune == "Total") |>
    left_join(seats, by = c("province", "numero_liste")) |>
    mutate(
      sieges_province = coalesce(sieges_province, 0L),
      sieges_congres = coalesce(sieges_congres, 0L),
      pct_inscrits = 100 * voix / inscrits,
      franchit_5pct_inscrits = pct_inscrits >= 5,
      source = source_pdf,
      source_note = "Résultats provisoires, PDF édité le 28/06/2026 à 23:05:13."
    )

  communes_detail <- communes |>
    filter(commune != "Total") |>
    mutate(source = source_pdf)

  list(totals = totals, communes = communes_detail)
}

participation_rows <- tribble(
  ~annee, ~territoire, ~inscrits, ~votants, ~participation, ~exprimes,
  1989, "Nouvelle-Caledonie", 91338, 63222, 69.22, 62473,
  1989, "Province Sud", 57348, 39758, 69.33, 39181,
  1989, "Province Nord", 21535, 14937, 69.36, 14783,
  1989, "Province des Iles", 12455, 8527, 68.46, 8509,
  1995, "Nouvelle-Caledonie", 103505, 72685, 70.22, 71791,
  1995, "Province Sud", 66308, 45836, 69.13, 45113,
  1995, "Province Nord", 23039, 16453, 71.41, 16333,
  1995, "Province des Iles", 14158, 10396, 73.43, 10345,
  1999, "Nouvelle-Caledonie", 108422, NA_integer_, 74.79, 79321,
  1999, "Province Sud", 66372, NA_integer_, 76.86, 49595,
  1999, "Province Nord", 26129, NA_integer_, 67.19, 17283,
  1999, "Province des Iles", 15921, NA_integer_, 78.64, 12443,
  2004, "Nouvelle-Caledonie", 119541, 91378, 76.44, 89562,
  2004, "Province Sud", 72623, NA_integer_, 77.44, 54811,
  2004, "Province Nord", 28875, NA_integer_, 72.29, 20559,
  2004, "Province des Iles", 18043, NA_integer_, 79.07, 14191,
  2009, "Nouvelle-Caledonie", 135932, 98515, 72.48, 96558,
  2009, "Province Sud", 83648, NA_integer_, 74.25, 60573,
  2009, "Province Nord", 32677, NA_integer_, 67.43, 21667,
  2009, "Province des Iles", 19607, NA_integer_, 73.32, 14318,
  2014, "Nouvelle-Caledonie", 152457, 106650, 69.95, 105266,
  2014, "Province Sud", 96347, NA_integer_, 71.95, 68236,
  2014, "Province Nord", 35697, NA_integer_, 66.15, 23399,
  2014, "Province des Iles", 20413, NA_integer_, 67.17, 13631,
  2019, "Nouvelle-Caledonie", 169635, 112760, 66.47, 110163,
  2019, "Province Sud", 108444, NA_integer_, 67.23, 70959,
  2019, "Province Nord", 39903, NA_integer_, 64.54, 25221,
  2019, "Province des Iles", 21205, NA_integer_, 66.49, 13983
)

bloc_rows <- tribble(
  ~annee, ~province, ~bloc_historique, ~voix, ~sieges_province, ~sieges_congres,
  1989, "Province Sud", "anti_independantiste", 31000, 26, 26,
  1989, "Province Sud", "independantiste", 5752, 4, 4,
  1989, "Province Sud", "autres_listes", 2429, 2, 2,
  1989, "Province Nord", "anti_independantiste", 4746, 4, 4,
  1989, "Province Nord", "independantiste", 10037, 11, 11,
  1989, "Province Nord", "autres_listes", 0, 0, 0,
  1989, "Province des Iles", "anti_independantiste", 2999, 2, 2,
  1989, "Province des Iles", "independantiste", 5510, 5, 5,
  1989, "Province des Iles", "autres_listes", 0, 0, 0,
  1995, "Province Sud", "anti_independantiste", 35623, 29, 29,
  1995, "Province Sud", "independantiste", 6371, 3, 3,
  1995, "Province Sud", "autres_listes", 3119, 0, 0,
  1995, "Province Nord", "anti_independantiste", 5076, 4, 4,
  1995, "Province Nord", "independantiste", 11014, 11, 11,
  1995, "Province Nord", "autres_listes", 243, 0, 0,
  1995, "Province des Iles", "anti_independantiste", 2636, 2, 2,
  1995, "Province des Iles", "independantiste", 7709, 5, 5,
  1995, "Province des Iles", "autres_listes", 0, 0, 0,
  1999, "Province Sud", "anti_independantiste", 39886, 34, 27,
  1999, "Province Sud", "independantiste", 9003, 6, 5,
  1999, "Province Sud", "autres_listes", 706, 0, 0,
  1999, "Province Nord", "anti_independantiste", 4221, 4, 3,
  1999, "Province Nord", "independantiste", 13062, 18, 12,
  1999, "Province Nord", "autres_listes", 0, 0, 0,
  1999, "Province des Iles", "anti_independantiste", 2370, 2, 1,
  1999, "Province des Iles", "independantiste", 10073, 12, 6,
  1999, "Province des Iles", "autres_listes", 0, 0, 0,
  2004, "Province Sud", "anti_independantiste", 44774, 40, 32,
  2004, "Province Sud", "independantiste", 8833, 0, 0,
  2004, "Province Sud", "autres_listes", 1204, 0, 0,
  2004, "Province Nord", "anti_independantiste", 4649, 4, 3,
  2004, "Province Nord", "independantiste", 15207, 18, 12,
  2004, "Province Nord", "autres_listes", 703, 0, 0,
  2004, "Province des Iles", "anti_independantiste", 2440, 2, 1,
  2004, "Province des Iles", "independantiste", 11751, 12, 6,
  2004, "Province des Iles", "autres_listes", 0, 0, 0,
  2009, "Province Sud", "anti_independantiste", 48815, 36, 29,
  2009, "Province Sud", "independantiste", 7569, 4, 3,
  2009, "Province Sud", "autres_listes", 4189, 0, 0,
  2009, "Province Nord", "anti_independantiste", 5418, 2, 2,
  2009, "Province Nord", "independantiste", 16249, 20, 13,
  2009, "Province Nord", "autres_listes", 0, 0, 0,
  2009, "Province des Iles", "anti_independantiste", 1236, 0, 0,
  2009, "Province des Iles", "independantiste", 13082, 14, 7,
  2009, "Province des Iles", "autres_listes", 0, 0, 0,
  2014, "Province Sud", "anti_independantiste", 55947, 33, 26,
  2014, "Province Sud", "independantiste", 12289, 7, 6,
  2014, "Province Sud", "autres_listes", 0, 0, 0,
  2014, "Province Nord", "anti_independantiste", 4752, 4, 3,
  2014, "Province Nord", "independantiste", 18647, 18, 12,
  2014, "Province Nord", "autres_listes", 0, 0, 0,
  2014, "Province des Iles", "anti_independantiste", 939, 0, 0,
  2014, "Province des Iles", "independantiste", 12692, 14, 7,
  2014, "Province des Iles", "autres_listes", 0, 0, 0,
  2019, "Province Sud", "anti_independantiste", 53216, 33, 26,
  2019, "Province Sud", "independantiste", 13848, 7, 6,
  2019, "Province Sud", "autres_listes", 3895, 0, 0,
  2019, "Province Nord", "anti_independantiste", 5047, 3, 2,
  2019, "Province Nord", "independantiste", 20174, 19, 13,
  2019, "Province Nord", "autres_listes", 0, 0, 0,
  2019, "Province des Iles", "anti_independantiste", 1313, 0, 0,
  2019, "Province des Iles", "independantiste", 12670, 14, 7,
  2019, "Province des Iles", "autres_listes", 0, 0, 0
)

build_historical_tables <- function(results_2026) {
  participation <- participation_rows |>
    mutate(
      votants = coalesce(votants, as.integer(round(inscrits * participation / 100))),
      abstention = 100 - participation,
      source = unname(source_wiki[as.character(annee)])
    )

  totals_2026 <- results_2026 |>
    distinct(province, .keep_all = TRUE) |>
    transmute(
      territoire = province,
      inscrits,
      votants,
      participation,
      exprimes
    )

  total_nc_2026 <- totals_2026 |>
    summarise(
      territoire = "Nouvelle-Caledonie",
      inscrits = sum(inscrits),
      votants = sum(votants),
      participation = 100 * sum(votants) / sum(inscrits),
      exprimes = sum(exprimes)
    )

  participation_2026 <- bind_rows(totals_2026, total_nc_2026) |>
    mutate(
      annee = 2026,
      abstention = 100 - participation,
      source = source_pdf,
      .before = 1
    )

  participation <- bind_rows(participation, participation_2026)

  blocs_2026 <- results_2026 |>
    group_by(province, bloc_historique) |>
    summarise(
      voix = sum(voix),
      sieges_province = sum(sieges_province),
      sieges_congres = sum(sieges_congres),
      .groups = "drop"
    ) |>
    mutate(annee = 2026, .before = 1)

  blocs <- bind_rows(bloc_rows, blocs_2026)

  exprimes_provinces <- participation |>
    filter(territoire != "Nouvelle-Caledonie") |>
    select(annee, province = territoire, exprimes)

  blocs <- blocs |>
    left_join(exprimes_provinces, by = c("annee", "province")) |>
    mutate(
      pct_exprimes = 100 * voix / exprimes,
      source = unname(source_wiki[as.character(annee)]),
      source = if_else(annee == 2026, source_pdf, source)
    )

  congres <- blocs |>
    group_by(annee, bloc_historique) |>
    summarise(
      voix = sum(voix),
      sieges_congres = sum(sieges_congres),
      .groups = "drop"
    ) |>
    left_join(
      participation |>
        filter(territoire == "Nouvelle-Caledonie") |>
        select(annee, exprimes),
      by = "annee"
    ) |>
    mutate(
      pct_exprimes = 100 * voix / exprimes,
      source = unname(source_wiki[as.character(annee)]),
      source = if_else(annee == 2026, source_pdf, source)
    )

  list(participation = participation, blocs = blocs, congres = congres)
}

write_outputs <- function() {
  dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

  extracted <- extract_2026_results()
  historical <- build_historical_tables(extracted$totals)

  write_csv(
    extracted$totals,
    file.path(out_dir, "provinciales_2026_resultats_province_listes.csv")
  )
  write_csv(
    extracted$communes,
    file.path(out_dir, "provinciales_2026_resultats_communes_listes.csv")
  )
  write_csv(
    historical$participation,
    file.path(out_dir, "provinciales_historique_participation_1989_2026.csv")
  )
  write_csv(
    historical$blocs,
    file.path(out_dir, "provinciales_historique_blocs_provinces_1989_2026.csv")
  )
  write_csv(
    historical$congres,
    file.path(out_dir, "provinciales_historique_blocs_congres_1989_2026.csv")
  )

  exprimes_2026 <- extracted$totals |>
    distinct(province, .keep_all = TRUE) |>
    summarise(exprimes = sum(exprimes)) |>
    pull(exprimes)

  checks <- c(
    voix_2026 = sum(extracted$totals$voix),
    exprimes_2026 = exprimes_2026,
    sieges_province_2026 = sum(extracted$totals$sieges_province),
    sieges_congres_2026 = sum(extracted$totals$sieges_congres)
  )

  if (checks[["voix_2026"]] != checks[["exprimes_2026"]]) {
    diff <- checks[["exprimes_2026"]] - checks[["voix_2026"]]
    if (abs(diff) > 2) {
      stop("Les voix 2026 ne correspondent pas aux exprimés : ", paste(checks, collapse = ", "), call. = FALSE)
    }
    message(
      "Warning: official PDF list totals are not exactly equal to expressed votes (",
      sprintf("%+d", diff),
      " votes). Published list totals are kept as-is."
    )
  }

  if (checks[["sieges_province_2026"]] != 76) {
    stop("Les sièges provinciaux 2026 devraient sommer à 76.", call. = FALSE)
  }

  if (checks[["sieges_congres_2026"]] != 54) {
    stop("Les sièges Congrès 2026 devraient sommer à 54.", call. = FALSE)
  }

  message("Wrote provinciales 2026 bilan datasets:")
  for (path in sort(list.files(out_dir, pattern = "^provinciales_.*2026.*\\.csv$", full.names = TRUE))) {
    message("- ", sub(paste0("^", project_dir, "/?"), "", normalizePath(path, winslash = "/", mustWork = TRUE)))
  }
}

write_outputs()
