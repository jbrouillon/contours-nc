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
    if (identical(parent, path)) stop("Racine du projet Quarto introuvable.", call. = FALSE)
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

fmt_delta <- function(x) {
  case_when(
    x > 0 ~ paste0("+", fmt_int(x)),
    x < 0 ~ fmt_int(x),
    TRUE ~ "0"
  )
}

project_dir <- find_project_root()
data_dir <- file.path(project_dir, "data", "elections", "data_processed", "provinciales_2026")

resultats <- read_csv(
  file.path(data_dir, "provinciales_2026_resultats_province_listes.csv"),
  show_col_types = FALSE
)

total_exprimes_nc <- resultats |>
  distinct(province, exprimes) |>
  summarise(total = sum(exprimes), .groups = "drop") |>
  pull(total)

total_inscrits_nc <- resultats |>
  distinct(province, inscrits) |>
  summarise(total = sum(inscrits), .groups = "drop") |>
  pull(total)

threshold_5_voix <- total_exprimes_nc * 0.05
threshold_3_voix <- total_exprimes_nc * 0.03

province_congres_seats <- tribble(
  ~province, ~sieges_total,
  "Province Sud", 32L,
  "Province Nord", 15L,
  "Province des Iles", 7L
)

province_bougival_congres_seats <- tribble(
  ~province, ~sieges_total,
  "Province Sud", 37L,
  "Province Nord", 14L,
  "Province des Iles", 5L
)

province_assembly_seats <- resultats |>
  group_by(province) |>
  summarise(sieges_total = as.integer(sum(sieges_province, na.rm = TRUE)), .groups = "drop") |>
  mutate(province_order = match(province, province_congres_seats$province)) |>
  arrange(province_order) |>
  select(province, sieges_total)

groupe_reference <- tribble(
  ~province, ~numero_liste, ~group_id, ~groupe, ~famille, ~couleur_groupe, ~segment_order,
  "Province Sud", 1, "eveil", "Éveil océanien", "Pivot océanien", "#0099a8", 7,
  "Province Sud", 2, "uc_flnks", "UC-FLNKS / FLNKS", "Indépendantiste", "#248a5b", 4,
  "Province Sud", 3, "rn_mcf", "RN-MCFNC", "Droite nationale", "#7a4a28", 17,
  "Province Sud", 5, "une_province", "Une Province pour tous", "Centre non-indépendantiste", "#c44e7f", 9,
  "Province Sud", 6, "sknc", "SKNC", "Indépendantiste souverainiste", "#b6483b", 1,
  "Province Sud", 7, "faire_pays", "Faire Pays", "Pro-pays / souverainiste", "#d95f02", 6,
  "Province Sud", 8, "caledonie_francaise", "Pour une Calédonie française", "Droite nationale", "#244e78", 15,
  "Province Sud", 9, "nous_reunis", "Nous, réunis", "Centre non-indépendantiste", "#7b61a8", 8,
  "Province Sud", 10, "ll_lr", "LL-LR", "Loyaliste", "#305f9f", 10,
  "Province Sud", 11, "uni_palika", "UNI / Palika", "UNI / Palika", "#e5b422", 5,
  "Province Sud", 12, "espoir", "Un espoir pour demain", "Centre droit non-indépendantiste", "#6f7d95", 12,
  "Province Nord", 1, "ll_lr", "LL-LR", "Loyaliste", "#305f9f", 10,
  "Province Nord", 2, "alternative_nord", "Alternative Nord", "UPK / Parti travailliste", "#b6483b", 1,
  "Province Nord", 3, "uc_flnks", "UC-FLNKS / FLNKS", "Indépendantiste", "#248a5b", 4,
  "Province Nord", 4, "faire_pays", "Faire Pays", "Pro-pays / souverainiste", "#d95f02", 6,
  "Province Nord", 5, "uni_palika", "UNI / Palika", "UNI / Palika", "#e5b422", 5,
  "Province des Iles", 1, "uni_palika", "UNI / Palika", "UNI / Palika", "#e5b422", 5,
  "Province des Iles", 2, "nouveau_souffle", "Un nouveau souffle", "Loyaliste", "#305f9f", 14,
  "Province des Iles", 3, "baselaia", "Baselaia", "UC dissidente", "#7aa874", 2,
  "Province des Iles", 4, "nation", "Nation autochtone", "Dynamique autochtone", "#8a6f26", 3,
  "Province des Iles", 5, "uc_flnks", "UC-FLNKS / FLNKS", "Indépendantiste", "#248a5b", 4,
  "Province des Iles", 6, "upk", "UPK", "UPK", "#b6483b", 1,
  "Province des Iles", 7, "ucc", "UCC", "UC dissidente / PT", "#7aa874", 2
)

resultats_sim <- resultats |>
  left_join(groupe_reference, by = c("province", "numero_liste")) |>
  mutate(
    couleur_groupe = coalesce(couleur_groupe, couleur),
    groupe = coalesce(groupe, etiquette),
    famille = coalesce(famille, nuance),
    segment_order = coalesce(segment_order, 99)
  )

if (any(is.na(resultats_sim$group_id))) {
  missing_groups <- resultats_sim |>
    filter(is.na(group_id)) |>
    transmute(province, numero_liste, etiquette)
  stop(
    "Groupes de simulation manquants : ",
    paste(apply(missing_groups, 1, paste, collapse = " / "), collapse = "; "),
    call. = FALSE
  )
}

groupes_nc <- resultats_sim |>
  group_by(group_id, groupe, famille, couleur = couleur_groupe, segment_order) |>
  summarise(
    voix = sum(voix, na.rm = TRUE),
    sieges_actuels = sum(sieges_congres, na.rm = TRUE),
    provinces = paste(unique(province), collapse = " + "),
    .groups = "drop"
  ) |>
  mutate(
    pct_exprimes_nc = 100 * voix / total_exprimes_nc,
    pct_inscrits_nc = 100 * voix / total_inscrits_nc,
    eligible_5_inscrits = pct_inscrits_nc >= 5,
    eligible_5 = pct_exprimes_nc >= 5,
    eligible_3 = pct_exprimes_nc >= 3
  ) |>
  arrange(desc(voix))

diviseurs_methode <- function(sieges_total, methode = c("jefferson", "sainte_lague")) {
  methode <- match.arg(methode)
  if (methode == "jefferson") {
    seq_len(sieges_total)
  } else {
    seq(1, by = 2, length.out = sieges_total)
  }
}

attribuer_congres_par_province <- function(
  data,
  seuil_pct,
  methode = c("jefferson", "sainte_lague"),
  seuil_base = c("exprimes", "inscrits"),
  sieges_par_province = province_congres_seats
) {
  methode <- match.arg(methode)
  seuil_base <- match.arg(seuil_base)

  attribuer_sieges_par_province_detail(data, sieges_par_province, seuil_pct, methode, seuil_base) |>
    group_by(group_id, groupe, famille, couleur, segment_order) |>
    summarise(sieges = sum(sieges), .groups = "drop")
}

attribuer_sieges_par_province_detail <- function(
  data,
  sieges_par_province,
  seuil_pct,
  methode = c("jefferson", "sainte_lague"),
  seuil_base = c("exprimes", "inscrits")
) {
  methode <- match.arg(methode)
  seuil_base <- match.arg(seuil_base)
  seuil_col <- if (seuil_base == "exprimes") "pct_exprimes" else "pct_inscrits"

  sieges_par_province |>
    pmap_dfr(function(province, sieges_total) {
      dat <- data |>
        filter(.data$province == .env$province)
      eligibles <- dat |>
        filter(.data[[seuil_col]] >= seuil_pct)

      if (nrow(eligibles) == 0) {
        return(tibble(
          province = character(),
          group_id = character(),
          groupe = character(),
          famille = character(),
          couleur = character(),
          segment_order = numeric(),
          sieges = integer()
        ))
      }

      tidyr::crossing(
        numero_liste = eligibles$numero_liste,
        diviseur = diviseurs_methode(sieges_total, methode)
      ) |>
        left_join(
          eligibles |>
            select(numero_liste, voix),
          by = "numero_liste"
        ) |>
        mutate(quotient = voix / diviseur) |>
        arrange(desc(quotient), desc(voix), numero_liste) |>
        slice_head(n = sieges_total) |>
        count(numero_liste, name = "sieges") |>
        left_join(
          eligibles |>
            select(
              numero_liste, province, group_id, groupe, famille,
              couleur = couleur_groupe, segment_order
            ),
          by = "numero_liste"
        )
    })
}

attribuer_plus_forte_moyenne <- function(
  data,
  seuil_pct,
  sieges_total = 54,
  methode = c("jefferson", "sainte_lague"),
  seuil_base = c("exprimes", "inscrits")
) {
  methode <- match.arg(methode)
  seuil_base <- match.arg(seuil_base)
  seuil_col <- if (seuil_base == "exprimes") "pct_exprimes_nc" else "pct_inscrits_nc"

  eligibles <- data |>
    filter(.data[[seuil_col]] >= seuil_pct)

  if (nrow(eligibles) == 0) {
    return(tibble(group_id = character(), sieges = integer()))
  }

  tidyr::crossing(
    group_id = eligibles$group_id,
    diviseur = diviseurs_methode(sieges_total, methode)
  ) |>
    left_join(
      eligibles |>
        select(group_id, groupe, voix),
      by = "group_id"
    ) |>
    mutate(quotient = voix / diviseur) |>
    arrange(desc(quotient), desc(voix), groupe) |>
    slice_head(n = sieges_total) |>
    count(group_id, name = "sieges")
}

simulation_prov_5_inscrits <- attribuer_congres_par_province(resultats_sim, 5, "jefferson", "inscrits") |>
  rename(sieges_prov_5_inscrits = sieges)

simulation_prov_5_inscrits_sl <- attribuer_congres_par_province(resultats_sim, 5, "sainte_lague", "inscrits") |>
  rename(sieges_prov_5_inscrits_sl = sieges)

simulation_prov_5 <- attribuer_congres_par_province(resultats_sim, 5, "jefferson", "exprimes") |>
  rename(sieges_prov_5 = sieges)

simulation_prov_3 <- attribuer_congres_par_province(resultats_sim, 3, "jefferson", "exprimes") |>
  rename(sieges_prov_3 = sieges)

simulation_prov_5_sl <- attribuer_congres_par_province(resultats_sim, 5, "sainte_lague", "exprimes") |>
  rename(sieges_prov_5_sl = sieges)

simulation_prov_3_sl <- attribuer_congres_par_province(resultats_sim, 3, "sainte_lague", "exprimes") |>
  rename(sieges_prov_3_sl = sieges)

simulation_bougival_5_inscrits <- attribuer_congres_par_province(
  resultats_sim, 5, "jefferson", "inscrits", province_bougival_congres_seats
) |>
  rename(sieges_bougival_5_inscrits = sieges)

simulation_bougival_5_inscrits_sl <- attribuer_congres_par_province(
  resultats_sim, 5, "sainte_lague", "inscrits", province_bougival_congres_seats
) |>
  rename(sieges_bougival_5_inscrits_sl = sieges)

simulation_bougival_5 <- attribuer_congres_par_province(
  resultats_sim, 5, "jefferson", "exprimes", province_bougival_congres_seats
) |>
  rename(sieges_bougival_5 = sieges)

simulation_bougival_5_sl <- attribuer_congres_par_province(
  resultats_sim, 5, "sainte_lague", "exprimes", province_bougival_congres_seats
) |>
  rename(sieges_bougival_5_sl = sieges)

simulation_bougival_3 <- attribuer_congres_par_province(
  resultats_sim, 3, "jefferson", "exprimes", province_bougival_congres_seats
) |>
  rename(sieges_bougival_3 = sieges)

simulation_bougival_3_sl <- attribuer_congres_par_province(
  resultats_sim, 3, "sainte_lague", "exprimes", province_bougival_congres_seats
) |>
  rename(sieges_bougival_3_sl = sieges)

assemblees_actuelles <- resultats_sim |>
  group_by(province, group_id, groupe, famille, couleur = couleur_groupe, segment_order) |>
  summarise(
    voix = sum(voix, na.rm = TRUE),
    pct_exprimes = 100 * sum(voix, na.rm = TRUE) / first(exprimes),
    sieges_assem_actuels = sum(sieges_province, na.rm = TRUE),
    .groups = "drop"
  )

simulation_assem_5_inscrits_sl <- attribuer_sieges_par_province_detail(
  resultats_sim, province_assembly_seats, 5, "sainte_lague", "inscrits"
) |>
  rename(sieges_assem_5_inscrits_sl = sieges)

simulation_assem_5 <- attribuer_sieges_par_province_detail(
  resultats_sim, province_assembly_seats, 5, "jefferson"
) |>
  rename(sieges_assem_5 = sieges)

simulation_assem_3 <- attribuer_sieges_par_province_detail(
  resultats_sim, province_assembly_seats, 3, "jefferson"
) |>
  rename(sieges_assem_3 = sieges)

simulation_assem_5_sl <- attribuer_sieges_par_province_detail(
  resultats_sim, province_assembly_seats, 5, "sainte_lague"
) |>
  rename(sieges_assem_5_sl = sieges)

simulation_assem_3_sl <- attribuer_sieges_par_province_detail(
  resultats_sim, province_assembly_seats, 3, "sainte_lague"
) |>
  rename(sieges_assem_3_sl = sieges)

simulation_assemblees <- assemblees_actuelles |>
  left_join(
    simulation_assem_5_inscrits_sl |>
      select(province, group_id, sieges_assem_5_inscrits_sl),
    by = c("province", "group_id")
  ) |>
  left_join(
    simulation_assem_5 |>
      select(province, group_id, sieges_assem_5),
    by = c("province", "group_id")
  ) |>
  left_join(
    simulation_assem_3 |>
      select(province, group_id, sieges_assem_3),
    by = c("province", "group_id")
  ) |>
  left_join(
    simulation_assem_5_sl |>
      select(province, group_id, sieges_assem_5_sl),
    by = c("province", "group_id")
  ) |>
  left_join(
    simulation_assem_3_sl |>
      select(province, group_id, sieges_assem_3_sl),
    by = c("province", "group_id")
  ) |>
  mutate(
    sieges_assem_5_inscrits_sl = replace_na(sieges_assem_5_inscrits_sl, 0L),
    sieges_assem_5 = replace_na(sieges_assem_5, 0L),
    sieges_assem_3 = replace_na(sieges_assem_3, 0L),
    sieges_assem_5_sl = replace_na(sieges_assem_5_sl, 0L),
    sieges_assem_3_sl = replace_na(sieges_assem_3_sl, 0L),
    delta_assem_5_inscrits_sl = sieges_assem_5_inscrits_sl - sieges_assem_actuels,
    delta_assem_5 = sieges_assem_5 - sieges_assem_actuels,
    delta_assem_3 = sieges_assem_3 - sieges_assem_actuels,
    delta_assem_5_sl = sieges_assem_5_sl - sieges_assem_actuels,
    delta_assem_3_sl = sieges_assem_3_sl - sieges_assem_actuels,
    ecart_methode_assem_5_inscrits = sieges_assem_5_inscrits_sl - sieges_assem_actuels,
    ecart_methode_assem_5 = sieges_assem_5_sl - sieges_assem_5,
    ecart_methode_assem_3 = sieges_assem_3_sl - sieges_assem_3
  ) |>
  left_join(
    province_assembly_seats |>
      mutate(province_order = row_number()),
    by = "province"
  ) |>
  arrange(province_order, desc(voix))

assemblee_total_check <- simulation_assemblees |>
  group_by(province, sieges_total) |>
  summarise(
    sieges_assem_actuels = sum(sieges_assem_actuels),
    sieges_assem_5_inscrits_sl = sum(sieges_assem_5_inscrits_sl),
    sieges_assem_5 = sum(sieges_assem_5),
    sieges_assem_3 = sum(sieges_assem_3),
    sieges_assem_5_sl = sum(sieges_assem_5_sl),
    sieges_assem_3_sl = sum(sieges_assem_3_sl),
    .groups = "drop"
  )

stopifnot(all(assemblee_total_check$sieges_assem_actuels == assemblee_total_check$sieges_total))
stopifnot(all(assemblee_total_check$sieges_assem_5_inscrits_sl == assemblee_total_check$sieges_total))
stopifnot(all(assemblee_total_check$sieges_assem_5 == assemblee_total_check$sieges_total))
stopifnot(all(assemblee_total_check$sieges_assem_3 == assemblee_total_check$sieges_total))
stopifnot(all(assemblee_total_check$sieges_assem_5_sl == assemblee_total_check$sieges_total))
stopifnot(all(assemblee_total_check$sieges_assem_3_sl == assemblee_total_check$sieges_total))

simulation_groupes <- groupes_nc |>
  left_join(
    simulation_prov_5_inscrits |>
      select(group_id, sieges_prov_5_inscrits),
    by = "group_id"
  ) |>
  left_join(
    simulation_prov_5_inscrits_sl |>
      select(group_id, sieges_prov_5_inscrits_sl),
    by = "group_id"
  ) |>
  left_join(
    simulation_prov_5 |>
      select(group_id, sieges_prov_5),
    by = "group_id"
  ) |>
  left_join(
    simulation_prov_3 |>
      select(group_id, sieges_prov_3),
    by = "group_id"
  ) |>
  left_join(
    simulation_prov_5_sl |>
      select(group_id, sieges_prov_5_sl),
    by = "group_id"
  ) |>
  left_join(
    simulation_prov_3_sl |>
      select(group_id, sieges_prov_3_sl),
    by = "group_id"
  ) |>
  left_join(
    attribuer_plus_forte_moyenne(groupes_nc, 5, methode = "jefferson", seuil_base = "inscrits") |>
      rename(sieges_nc_5_inscrits = sieges),
    by = "group_id"
  ) |>
  left_join(
    attribuer_plus_forte_moyenne(groupes_nc, 5, methode = "sainte_lague", seuil_base = "inscrits") |>
      rename(sieges_nc_5_inscrits_sl = sieges),
    by = "group_id"
  ) |>
  left_join(
    attribuer_plus_forte_moyenne(groupes_nc, 5, methode = "jefferson", seuil_base = "exprimes") |>
      rename(sieges_nc_5 = sieges),
    by = "group_id"
  ) |>
  left_join(
    attribuer_plus_forte_moyenne(groupes_nc, 3, methode = "jefferson", seuil_base = "exprimes") |>
      rename(sieges_nc_3 = sieges),
    by = "group_id"
  ) |>
  left_join(
    attribuer_plus_forte_moyenne(groupes_nc, 5, methode = "sainte_lague", seuil_base = "exprimes") |>
      rename(sieges_nc_5_sl = sieges),
    by = "group_id"
  ) |>
  left_join(
    attribuer_plus_forte_moyenne(groupes_nc, 3, methode = "sainte_lague", seuil_base = "exprimes") |>
      rename(sieges_nc_3_sl = sieges),
    by = "group_id"
  ) |>
  left_join(
    attribuer_plus_forte_moyenne(groupes_nc, 0, methode = "jefferson") |>
      rename(sieges_nc_integrale = sieges),
    by = "group_id"
  ) |>
  left_join(
    attribuer_plus_forte_moyenne(groupes_nc, 0, methode = "sainte_lague") |>
      rename(sieges_nc_integrale_sl = sieges),
    by = "group_id"
  ) |>
  left_join(
    simulation_bougival_5_inscrits |>
      select(group_id, sieges_bougival_5_inscrits),
    by = "group_id"
  ) |>
  left_join(
    simulation_bougival_5_inscrits_sl |>
      select(group_id, sieges_bougival_5_inscrits_sl),
    by = "group_id"
  ) |>
  left_join(
    simulation_bougival_5 |>
      select(group_id, sieges_bougival_5),
    by = "group_id"
  ) |>
  left_join(
    simulation_bougival_5_sl |>
      select(group_id, sieges_bougival_5_sl),
    by = "group_id"
  ) |>
  left_join(
    simulation_bougival_3 |>
      select(group_id, sieges_bougival_3),
    by = "group_id"
  ) |>
  left_join(
    simulation_bougival_3_sl |>
      select(group_id, sieges_bougival_3_sl),
    by = "group_id"
  ) |>
  mutate(
    sieges_prov_5_inscrits = replace_na(sieges_prov_5_inscrits, 0L),
    sieges_prov_5_inscrits_sl = replace_na(sieges_prov_5_inscrits_sl, 0L),
    sieges_prov_5 = replace_na(sieges_prov_5, 0L),
    sieges_prov_3 = replace_na(sieges_prov_3, 0L),
    sieges_prov_5_sl = replace_na(sieges_prov_5_sl, 0L),
    sieges_prov_3_sl = replace_na(sieges_prov_3_sl, 0L),
    sieges_nc_5_inscrits = replace_na(sieges_nc_5_inscrits, 0L),
    sieges_nc_5_inscrits_sl = replace_na(sieges_nc_5_inscrits_sl, 0L),
    sieges_nc_5 = replace_na(sieges_nc_5, 0L),
    sieges_nc_3 = replace_na(sieges_nc_3, 0L),
    sieges_nc_5_sl = replace_na(sieges_nc_5_sl, 0L),
    sieges_nc_3_sl = replace_na(sieges_nc_3_sl, 0L),
    sieges_nc_integrale = replace_na(sieges_nc_integrale, 0L),
    sieges_nc_integrale_sl = replace_na(sieges_nc_integrale_sl, 0L),
    sieges_bougival_5_inscrits = replace_na(sieges_bougival_5_inscrits, 0L),
    sieges_bougival_5_inscrits_sl = replace_na(sieges_bougival_5_inscrits_sl, 0L),
    sieges_bougival_5 = replace_na(sieges_bougival_5, 0L),
    sieges_bougival_5_sl = replace_na(sieges_bougival_5_sl, 0L),
    sieges_bougival_3 = replace_na(sieges_bougival_3, 0L),
    sieges_bougival_3_sl = replace_na(sieges_bougival_3_sl, 0L),
    delta_prov_5_inscrits = sieges_prov_5_inscrits - sieges_actuels,
    delta_prov_5_inscrits_sl = sieges_prov_5_inscrits_sl - sieges_actuels,
    delta_prov_5 = sieges_prov_5 - sieges_actuels,
    delta_prov_3 = sieges_prov_3 - sieges_actuels,
    delta_prov_5_sl = sieges_prov_5_sl - sieges_actuels,
    delta_prov_3_sl = sieges_prov_3_sl - sieges_actuels,
    delta_nc_5_inscrits = sieges_nc_5_inscrits - sieges_actuels,
    delta_nc_5_inscrits_sl = sieges_nc_5_inscrits_sl - sieges_actuels,
    delta_nc_5 = sieges_nc_5 - sieges_actuels,
    delta_nc_3 = sieges_nc_3 - sieges_actuels,
    delta_nc_5_sl = sieges_nc_5_sl - sieges_actuels,
    delta_nc_3_sl = sieges_nc_3_sl - sieges_actuels,
    delta_nc_integrale = sieges_nc_integrale - sieges_actuels,
    delta_nc_integrale_sl = sieges_nc_integrale_sl - sieges_actuels,
    delta_bougival_5_inscrits = sieges_bougival_5_inscrits - sieges_actuels,
    delta_bougival_5_inscrits_sl = sieges_bougival_5_inscrits_sl - sieges_actuels,
    delta_bougival_5 = sieges_bougival_5 - sieges_actuels,
    delta_bougival_5_sl = sieges_bougival_5_sl - sieges_actuels,
    delta_bougival_3 = sieges_bougival_3 - sieges_actuels,
    delta_bougival_3_sl = sieges_bougival_3_sl - sieges_actuels,
    ecart_methode_prov_5_inscrits = sieges_prov_5_inscrits_sl - sieges_prov_5_inscrits,
    ecart_methode_prov_5 = sieges_prov_5_sl - sieges_prov_5,
    ecart_methode_prov_3 = sieges_prov_3_sl - sieges_prov_3,
    ecart_methode_nc_5_inscrits = sieges_nc_5_inscrits_sl - sieges_nc_5_inscrits,
    ecart_methode_nc_5 = sieges_nc_5_sl - sieges_nc_5,
    ecart_methode_nc_3 = sieges_nc_3_sl - sieges_nc_3,
    ecart_methode_nc_integrale = sieges_nc_integrale_sl - sieges_nc_integrale,
    ecart_methode_bougival_5_inscrits = sieges_bougival_5_inscrits_sl - sieges_bougival_5_inscrits,
    ecart_methode_bougival_5 = sieges_bougival_5_sl - sieges_bougival_5,
    ecart_methode_bougival_3 = sieges_bougival_3_sl - sieges_bougival_3
  )

stopifnot(sum(simulation_groupes$sieges_actuels) == 54)
stopifnot(sum(simulation_groupes$sieges_prov_5_inscrits) == 54)
stopifnot(sum(simulation_groupes$sieges_prov_5_inscrits_sl) == 54)
stopifnot(sum(simulation_groupes$sieges_prov_5) == 54)
stopifnot(sum(simulation_groupes$sieges_prov_3) == 54)
stopifnot(sum(simulation_groupes$sieges_prov_5_sl) == 54)
stopifnot(sum(simulation_groupes$sieges_prov_3_sl) == 54)
stopifnot(sum(simulation_groupes$sieges_nc_5_inscrits) == 54)
stopifnot(sum(simulation_groupes$sieges_nc_5_inscrits_sl) == 54)
stopifnot(sum(simulation_groupes$sieges_nc_5) == 54)
stopifnot(sum(simulation_groupes$sieges_nc_3) == 54)
stopifnot(sum(simulation_groupes$sieges_nc_5_sl) == 54)
stopifnot(sum(simulation_groupes$sieges_nc_3_sl) == 54)
stopifnot(sum(simulation_groupes$sieges_nc_integrale) == 54)
stopifnot(sum(simulation_groupes$sieges_nc_integrale_sl) == 54)
stopifnot(sum(simulation_groupes$sieges_bougival_5_inscrits) == 56)
stopifnot(sum(simulation_groupes$sieges_bougival_5_inscrits_sl) == 56)
stopifnot(sum(simulation_groupes$sieges_bougival_5) == 56)
stopifnot(sum(simulation_groupes$sieges_bougival_5_sl) == 56)
stopifnot(sum(simulation_groupes$sieges_bougival_3) == 56)
stopifnot(sum(simulation_groupes$sieges_bougival_3_sl) == 56)

prov_5_inscrits_identique_actuel <- all(simulation_groupes$sieges_prov_5_inscrits == simulation_groupes$sieges_actuels)
integrale_identique_3 <- all(simulation_groupes$sieges_nc_integrale == simulation_groupes$sieges_nc_3)
stopifnot(integrale_identique_3)

integrale_sl_identique_3_sl <- all(simulation_groupes$sieges_nc_integrale_sl == simulation_groupes$sieges_nc_3_sl)

scenario_levels <- c("sieges_actuels", "sieges_nc_5", "sieges_nc_3")
scenario_labels <- c(
  "sieges_actuels" = "Système actuel · 5 % inscrits",
  "sieges_nc_5" = "Sans clé provinciale, seuil 5 %",
  "sieges_nc_3" = "Sans clé provinciale, seuil 3 %"
)

composition_long <- simulation_groupes |>
  select(group_id, groupe, famille, couleur, segment_order, all_of(scenario_levels)) |>
  pivot_longer(
    cols = all_of(scenario_levels),
    names_to = "scenario",
    values_to = "sieges"
  ) |>
  mutate(
    scenario_label = unname(scenario_labels[scenario]),
    scenario_order = match(scenario, scenario_levels)
  ) |>
  arrange(scenario_order, segment_order, groupe)

composition_seats <- composition_long |>
  filter(sieges > 0) |>
  arrange(scenario_order, segment_order, groupe) |>
  tidyr::uncount(sieges, .id = "siege_groupe") |>
  group_by(scenario, group_id) |>
  mutate(total_groupe = n()) |>
  ungroup() |>
  group_by(scenario) |>
  mutate(siege = row_number()) |>
  ungroup()

make_composition_seats <- function(data, scenario_levels, scenario_labels) {
  data |>
    select(group_id, groupe, famille, couleur, segment_order, all_of(scenario_levels)) |>
    pivot_longer(
      cols = all_of(scenario_levels),
      names_to = "scenario",
      values_to = "sieges"
    ) |>
    mutate(
      scenario_label = unname(scenario_labels[scenario]),
      scenario_order = match(scenario, scenario_levels)
    ) |>
    filter(sieges > 0) |>
    arrange(scenario_order, segment_order, groupe) |>
    tidyr::uncount(sieges, .id = "siege_groupe") |>
    group_by(scenario, group_id) |>
    mutate(total_groupe = n()) |>
    ungroup() |>
    group_by(scenario) |>
    mutate(siege = row_number()) |>
    ungroup()
}

make_assemblee_seats <- function(data, scenario_levels, scenario_labels) {
  data |>
    select(
      province, province_order, group_id, groupe, famille, couleur,
      segment_order, all_of(scenario_levels)
    ) |>
    pivot_longer(
      cols = all_of(scenario_levels),
      names_to = "scenario",
      values_to = "sieges"
    ) |>
    mutate(
      scenario_label = unname(scenario_labels[scenario]),
      scenario_order = match(scenario, scenario_levels)
    ) |>
    filter(sieges > 0) |>
    arrange(province_order, scenario_order, segment_order, groupe) |>
    tidyr::uncount(sieges, .id = "siege_groupe") |>
    group_by(province, scenario, group_id) |>
    mutate(total_groupe = n()) |>
    ungroup() |>
    group_by(province, scenario) |>
    mutate(siege = row_number()) |>
    ungroup()
}

scenario_assem_levels <- c(
  "sieges_assem_actuels",
  if (any(simulation_assemblees$ecart_methode_assem_5_inscrits != 0)) "sieges_assem_5_inscrits_sl",
  "sieges_assem_5",
  if (any(simulation_assemblees$ecart_methode_assem_5 != 0)) "sieges_assem_5_sl",
  "sieges_assem_3",
  if (any(simulation_assemblees$ecart_methode_assem_3 != 0)) "sieges_assem_3_sl"
)
scenario_assem_labels <- c(
  "sieges_assem_actuels" = "Actuel · 5 % inscrits · Jefferson",
  "sieges_assem_5_inscrits_sl" = "5 % inscrits · Sainte-Laguë",
  "sieges_assem_5" = "5 % exprimés · Jefferson",
  "sieges_assem_5_sl" = "5 % exprimés · Sainte-Laguë",
  "sieges_assem_3" = "3 % exprimés · Jefferson",
  "sieges_assem_3_sl" = "3 % exprimés · Sainte-Laguë"
)

composition_assemblee_seats <- make_assemblee_seats(
  simulation_assemblees,
  scenario_assem_levels,
  scenario_assem_labels
)

scenario_prov_levels <- c(
  "sieges_actuels",
  if (any(simulation_groupes$ecart_methode_prov_5_inscrits != 0)) "sieges_prov_5_inscrits_sl",
  "sieges_prov_5",
  if (any(simulation_groupes$ecart_methode_prov_5 != 0)) "sieges_prov_5_sl",
  "sieges_prov_3",
  if (any(simulation_groupes$ecart_methode_prov_3 != 0)) "sieges_prov_3_sl"
)
scenario_prov_labels <- c(
  "sieges_actuels" = "Actuel · 5 % inscrits · Jefferson",
  "sieges_prov_5_inscrits_sl" = "Prov. 5 % inscrits · Sainte-Laguë",
  "sieges_prov_5" = "Prov. 5 % exprimés · Jefferson",
  "sieges_prov_5_sl" = "Prov. 5 % exprimés · Sainte-Laguë",
  "sieges_prov_3" = "Prov. 3 % exprimés · Jefferson",
  "sieges_prov_3_sl" = "Prov. 3 % exprimés · Sainte-Laguë"
)

scenario_nc_levels <- c(
  "sieges_actuels",
  "sieges_nc_5_inscrits",
  if (any(simulation_groupes$ecart_methode_nc_5_inscrits != 0)) "sieges_nc_5_inscrits_sl",
  "sieges_nc_5",
  if (any(simulation_groupes$ecart_methode_nc_5 != 0)) "sieges_nc_5_sl",
  "sieges_nc_3",
  if (any(simulation_groupes$ecart_methode_nc_3 != 0)) "sieges_nc_3_sl"
)
scenario_nc_labels <- c(
  "sieges_actuels" = "Actuel · avec clé provinciale",
  "sieges_nc_5_inscrits" = "Sans clé prov. · 5 % inscrits · Jefferson",
  "sieges_nc_5_inscrits_sl" = "Sans clé prov. · 5 % inscrits · Sainte-Laguë",
  "sieges_nc_5" = "Sans clé prov. · 5 % exprimés · Jefferson",
  "sieges_nc_5_sl" = "Sans clé prov. · 5 % exprimés · Sainte-Laguë",
  "sieges_nc_3" = "Sans clé prov. · 3 % exprimés · Jefferson",
  "sieges_nc_3_sl" = "Sans clé prov. · 3 % exprimés · Sainte-Laguë"
)

scenario_bougival_levels <- c(
  "sieges_actuels",
  "sieges_bougival_5_inscrits",
  if (any(simulation_groupes$ecart_methode_bougival_5_inscrits != 0)) "sieges_bougival_5_inscrits_sl",
  "sieges_bougival_5",
  if (any(simulation_groupes$ecart_methode_bougival_5 != 0)) "sieges_bougival_5_sl",
  "sieges_bougival_3",
  if (any(simulation_groupes$ecart_methode_bougival_3 != 0)) "sieges_bougival_3_sl"
)

scenario_bougival_labels <- c(
  "sieges_actuels" = "Actuel · 54 sièges",
  "sieges_bougival_5_inscrits" = "Bougival · 5 % inscrits · Jefferson",
  "sieges_bougival_5_inscrits_sl" = "Bougival · 5 % inscrits · Sainte-Laguë",
  "sieges_bougival_5" = "Bougival · 5 % exprimés · Jefferson",
  "sieges_bougival_5_sl" = "Bougival · 5 % exprimés · Sainte-Laguë",
  "sieges_bougival_3" = "Bougival · 3 % exprimés · Jefferson",
  "sieges_bougival_3_sl" = "Bougival · 3 % exprimés · Sainte-Laguë"
)

composition_prov_seats <- make_composition_seats(
  simulation_groupes,
  scenario_prov_levels,
  scenario_prov_labels
)

composition_nc_seats <- make_composition_seats(
  simulation_groupes,
  scenario_nc_levels,
  scenario_nc_labels
)

composition_bougival_seats <- make_composition_seats(
  simulation_groupes,
  scenario_bougival_levels,
  scenario_bougival_labels
)

threshold_detail <- simulation_groupes |>
  filter(group_id %in% c(
    "uni_palika", "eveil", "nous_reunis", "faire_pays",
    "une_province", "nation", "espoir"
  )) |>
  arrange(desc(pct_exprimes_nc))

delta_long <- simulation_groupes |>
  select(group_id, groupe, couleur, delta_nc_5, delta_nc_3) |>
  pivot_longer(
    cols = c(delta_nc_5, delta_nc_3),
    names_to = "scenario",
    values_to = "delta"
  ) |>
  filter(delta != 0) |>
  mutate(
    scenario_label = case_when(
      scenario == "delta_nc_5" ~ "Seuil 5 %",
      TRUE ~ "Seuil 3 %"
    ),
    scenario_order = if_else(scenario == "delta_nc_5", 1L, 2L)
  ) |>
  group_by(groupe) |>
  mutate(max_abs_delta = max(abs(delta))) |>
  ungroup() |>
  arrange(scenario_order, desc(max_abs_delta), desc(delta))

share_eligible_5 <- simulation_groupes |>
  filter(eligible_5) |>
  summarise(value = 100 * sum(voix) / total_exprimes_nc, .groups = "drop") |>
  pull(value)

share_eligible_3 <- simulation_groupes |>
  filter(eligible_3) |>
  summarise(value = 100 * sum(voix) / total_exprimes_nc, .groups = "drop") |>
  pull(value)

share_between_3_5 <- simulation_groupes |>
  filter(eligible_3, !eligible_5) |>
  summarise(value = 100 * sum(voix) / total_exprimes_nc, .groups = "drop") |>
  pull(value)

new_seats_nc_3 <- simulation_groupes |>
  filter(sieges_actuels == 0) |>
  summarise(value = sum(sieges_nc_3), .groups = "drop") |>
  pull(value)

new_seats_prov_5 <- simulation_groupes |>
  filter(sieges_actuels == 0) |>
  summarise(value = sum(sieges_prov_5), .groups = "drop") |>
  pull(value)

new_seats_nc_5_inscrits <- simulation_groupes |>
  filter(sieges_actuels == 0) |>
  summarise(value = sum(sieges_nc_5_inscrits), .groups = "drop") |>
  pull(value)

new_seats_prov_3 <- simulation_groupes |>
  filter(sieges_actuels == 0) |>
  summarise(value = sum(sieges_prov_3), .groups = "drop") |>
  pull(value)

changed_seats_prov_5_inscrits <- sum(pmax(simulation_groupes$delta_prov_5_inscrits, 0), na.rm = TRUE)
changed_seats_prov_5 <- sum(pmax(simulation_groupes$delta_prov_5, 0), na.rm = TRUE)
changed_seats_prov_3 <- sum(pmax(simulation_groupes$delta_prov_3, 0), na.rm = TRUE)
changed_seats_nc_5_inscrits <- sum(pmax(simulation_groupes$delta_nc_5_inscrits, 0), na.rm = TRUE)
changed_seats_nc_5 <- sum(pmax(simulation_groupes$delta_nc_5, 0), na.rm = TRUE)
changed_seats_nc_3 <- sum(pmax(simulation_groupes$delta_nc_3, 0), na.rm = TRUE)
changed_seats_prov_5_inscrits_sl <- sum(pmax(simulation_groupes$delta_prov_5_inscrits_sl, 0), na.rm = TRUE)
changed_seats_prov_5_sl <- sum(pmax(simulation_groupes$delta_prov_5_sl, 0), na.rm = TRUE)
changed_seats_prov_3_sl <- sum(pmax(simulation_groupes$delta_prov_3_sl, 0), na.rm = TRUE)
changed_seats_nc_5_inscrits_sl <- sum(pmax(simulation_groupes$delta_nc_5_inscrits_sl, 0), na.rm = TRUE)
changed_seats_nc_5_sl <- sum(pmax(simulation_groupes$delta_nc_5_sl, 0), na.rm = TRUE)
changed_seats_nc_3_sl <- sum(pmax(simulation_groupes$delta_nc_3_sl, 0), na.rm = TRUE)
changed_seats_bougival_5_inscrits <- sum(pmax(simulation_groupes$delta_bougival_5_inscrits, 0), na.rm = TRUE)
changed_seats_bougival_5_inscrits_sl <- sum(pmax(simulation_groupes$delta_bougival_5_inscrits_sl, 0), na.rm = TRUE)
changed_seats_bougival_5 <- sum(pmax(simulation_groupes$delta_bougival_5, 0), na.rm = TRUE)
changed_seats_bougival_3 <- sum(pmax(simulation_groupes$delta_bougival_3, 0), na.rm = TRUE)
changed_seats_bougival_5_sl <- sum(pmax(simulation_groupes$delta_bougival_5_sl, 0), na.rm = TRUE)
changed_seats_bougival_3_sl <- sum(pmax(simulation_groupes$delta_bougival_3_sl, 0), na.rm = TRUE)
changed_seats_assem_5_inscrits_sl <- sum(pmax(simulation_assemblees$delta_assem_5_inscrits_sl, 0), na.rm = TRUE)
changed_seats_assem_5 <- sum(pmax(simulation_assemblees$delta_assem_5, 0), na.rm = TRUE)
changed_seats_assem_3 <- sum(pmax(simulation_assemblees$delta_assem_3, 0), na.rm = TRUE)
changed_seats_assem_5_sl <- sum(pmax(simulation_assemblees$delta_assem_5_sl, 0), na.rm = TRUE)
changed_seats_assem_3_sl <- sum(pmax(simulation_assemblees$delta_assem_3_sl, 0), na.rm = TRUE)

method_moved_prov_5_inscrits <- sum(pmax(simulation_groupes$ecart_methode_prov_5_inscrits, 0), na.rm = TRUE)
method_moved_prov_5 <- sum(pmax(simulation_groupes$ecart_methode_prov_5, 0), na.rm = TRUE)
method_moved_prov_3 <- sum(pmax(simulation_groupes$ecart_methode_prov_3, 0), na.rm = TRUE)
method_moved_nc_5_inscrits <- sum(pmax(simulation_groupes$ecart_methode_nc_5_inscrits, 0), na.rm = TRUE)
method_moved_nc_5 <- sum(pmax(simulation_groupes$ecart_methode_nc_5, 0), na.rm = TRUE)
method_moved_nc_3 <- sum(pmax(simulation_groupes$ecart_methode_nc_3, 0), na.rm = TRUE)
method_moved_bougival_5_inscrits <- sum(pmax(simulation_groupes$ecart_methode_bougival_5_inscrits, 0), na.rm = TRUE)
method_moved_bougival_5 <- sum(pmax(simulation_groupes$ecart_methode_bougival_5, 0), na.rm = TRUE)
method_moved_bougival_3 <- sum(pmax(simulation_groupes$ecart_methode_bougival_3, 0), na.rm = TRUE)
method_moved_assem_5_inscrits <- sum(pmax(simulation_assemblees$ecart_methode_assem_5_inscrits, 0), na.rm = TRUE)
method_moved_assem_5 <- sum(pmax(simulation_assemblees$ecart_methode_assem_5, 0), na.rm = TRUE)
method_moved_assem_3 <- sum(pmax(simulation_assemblees$ecart_methode_assem_3, 0), na.rm = TRUE)

new_seats_assem_5 <- simulation_assemblees |>
  filter(sieges_assem_actuels == 0) |>
  summarise(value = sum(sieges_assem_5), .groups = "drop") |>
  pull(value)

new_seats_assem_3 <- simulation_assemblees |>
  filter(sieges_assem_actuels == 0) |>
  summarise(value = sum(sieges_assem_3), .groups = "drop") |>
  pull(value)

voix_sans_siege_actuel <- simulation_groupes |>
  filter(sieges_actuels == 0) |>
  summarise(voix = sum(voix), .groups = "drop") |>
  pull(voix)

voix_sans_siege_nc_5 <- simulation_groupes |>
  filter(sieges_nc_5 == 0) |>
  summarise(voix = sum(voix), .groups = "drop") |>
  pull(voix)

voix_sans_siege_nc_3 <- simulation_groupes |>
  filter(sieges_nc_3 == 0) |>
  summarise(voix = sum(voix), .groups = "drop") |>
  pull(voix)

pct_sans_siege_actuel <- 100 * voix_sans_siege_actuel / total_exprimes_nc
pct_sans_siege_nc_5 <- 100 * voix_sans_siege_nc_5 / total_exprimes_nc
pct_sans_siege_nc_3 <- 100 * voix_sans_siege_nc_3 / total_exprimes_nc

majorite_absolue <- 28L

groupes_non_indep <- c(
  "ll_lr", "nous_reunis", "une_province", "espoir",
  "rn_mcf", "caledonie_francaise", "nouveau_souffle"
)
groupes_indep_pro_pays <- c(
  "uc_flnks", "uni_palika", "faire_pays", "nation",
  "sknc", "alternative_nord", "ucc", "baselaia", "upk"
)

sieges_bloc <- function(group_ids, column) {
  sum(simulation_groupes[[column]][simulation_groupes$group_id %in% group_ids], na.rm = TRUE)
}

bloc_triptyque <- function(column) {
  paste(
    fmt_int(sieges_bloc(groupes_non_indep, column)),
    fmt_int(sieges_bloc("eveil", column)),
    fmt_int(sieges_bloc(groupes_indep_pro_pays, column)),
    sep = " / "
  )
}

get_sieges <- function(group_id_value, column) {
  simulation_groupes |>
    filter(group_id == group_id_value) |>
    pull({{ column }}) |>
    first()
}

get_assem_sieges <- function(province_value, group_id_value, column) {
  simulation_assemblees |>
    filter(province == province_value, group_id == group_id_value) |>
    pull({{ column }}) |>
    first()
}

get_delta <- function(group_id_value, column) {
  simulation_groupes |>
    filter(group_id == group_id_value) |>
    pull({{ column }}) |>
    first()
}

method_diff_data <- function(scope = c("province", "nc", "bougival")) {
  scope <- match.arg(scope)
  scenarios <- if (scope == "province") {
    tribble(
      ~scenario_label, ~jefferson_col, ~sainte_lague_col, ~ecart_col, ~scenario_order,
      "5 % inscrits", "sieges_prov_5_inscrits", "sieges_prov_5_inscrits_sl", "ecart_methode_prov_5_inscrits", 1L,
      "5 % exprimés", "sieges_prov_5", "sieges_prov_5_sl", "ecart_methode_prov_5", 2L,
      "3 % exprimés", "sieges_prov_3", "sieges_prov_3_sl", "ecart_methode_prov_3", 3L
    )
  } else if (scope == "nc") {
    tribble(
      ~scenario_label, ~jefferson_col, ~sainte_lague_col, ~ecart_col, ~scenario_order,
      "5 % inscrits", "sieges_nc_5_inscrits", "sieges_nc_5_inscrits_sl", "ecart_methode_nc_5_inscrits", 1L,
      "5 % exprimés", "sieges_nc_5", "sieges_nc_5_sl", "ecart_methode_nc_5", 2L,
      "3 % exprimés", "sieges_nc_3", "sieges_nc_3_sl", "ecart_methode_nc_3", 3L
    )
  } else {
    tribble(
      ~scenario_label, ~jefferson_col, ~sainte_lague_col, ~ecart_col, ~scenario_order,
      "Bougival, 5 % inscrits", "sieges_bougival_5_inscrits", "sieges_bougival_5_inscrits_sl", "ecart_methode_bougival_5_inscrits", 1L,
      "Bougival, 5 % exprimés", "sieges_bougival_5", "sieges_bougival_5_sl", "ecart_methode_bougival_5", 2L,
      "Bougival, 3 % exprimés", "sieges_bougival_3", "sieges_bougival_3_sl", "ecart_methode_bougival_3", 3L
    )
  }

  pmap_dfr(scenarios, function(scenario_label, jefferson_col, sainte_lague_col, ecart_col, scenario_order) {
    simulation_groupes |>
      transmute(
        scenario_label = scenario_label,
        scenario_order = scenario_order,
        group_id,
        groupe,
        couleur,
        segment_order,
        jefferson = .data[[jefferson_col]],
        sainte_lague = .data[[sainte_lague_col]],
        ecart = .data[[ecart_col]]
      )
  }) |>
    filter(ecart != 0) |>
    arrange(scenario_order, desc(abs(ecart)), desc(ecart), segment_order, groupe)
}

assemblee_method_diff_data <- function() {
  scenarios <- tribble(
    ~scenario_label, ~jefferson_col, ~sainte_lague_col, ~ecart_col, ~scenario_order,
    "5 % inscrits", "sieges_assem_actuels", "sieges_assem_5_inscrits_sl", "ecart_methode_assem_5_inscrits", 1L,
    "5 % exprimés", "sieges_assem_5", "sieges_assem_5_sl", "ecart_methode_assem_5", 2L,
    "3 % exprimés", "sieges_assem_3", "sieges_assem_3_sl", "ecart_methode_assem_3", 3L
  )

  pmap_dfr(scenarios, function(scenario_label, jefferson_col, sainte_lague_col, ecart_col, scenario_order) {
    simulation_assemblees |>
      transmute(
        province,
        province_order,
        scenario_label = scenario_label,
        scenario_order = scenario_order,
        group_id,
        groupe,
        couleur,
        segment_order,
        jefferson = .data[[jefferson_col]],
        sainte_lague = .data[[sainte_lague_col]],
        ecart = .data[[ecart_col]]
      )
  }) |>
    filter(ecart != 0) |>
    arrange(province_order, scenario_order, desc(abs(ecart)), desc(ecart), segment_order, groupe)
}

method_table <- function(scope = c("province", "nc", "bougival")) {
  scope <- match.arg(scope)
  dat <- method_diff_data(scope) |>
    mutate(
      jefferson_label = fmt_int(jefferson),
      sainte_lague_label = fmt_int(sainte_lague),
      ecart_label = fmt_delta(ecart)
    )

  if (nrow(dat) == 0) {
    return(tags$div(
      class = "prop-note",
      "Avec ces voix, Sainte-Laguë donne exactement la même composition que Jefferson/D'Hondt dans ces scénarios."
    ))
  }

  headers <- c("Scénario", "Groupe", "Jefferson", "Sainte-Laguë", "Écart")

  tagList(tags$div(
    class = "prop-table prop-table-compact",
    tags$table(
      tags$thead(tags$tr(lapply(headers, tags$th))),
      tags$tbody(lapply(seq_len(nrow(dat)), function(i) {
        row <- dat[i, ]
        tags$tr(
          tags$td(row$scenario_label),
          tags$td(
            class = "prop-table-group",
            tags$span(class = "prop-swatch", style = paste0("--swatch:", row$couleur, ";")),
            tags$span(row$groupe)
          ),
          tags$td(row$jefferson_label),
          tags$td(row$sainte_lague_label),
          tags$td(
            class = if (row$ecart > 0) "prop-delta-pos" else "prop-delta-neg",
            row$ecart_label
          )
        )
      }))
    )
  ))
}

assemblee_method_table <- function() {
  dat <- assemblee_method_diff_data() |>
    mutate(
      jefferson_label = fmt_int(jefferson),
      sainte_lague_label = fmt_int(sainte_lague),
      ecart_label = fmt_delta(ecart)
    )

  if (nrow(dat) == 0) {
    return(tags$div(
      class = "prop-note",
      "Avec ces voix, Sainte-Laguë donne exactement les mêmes compositions provinciales que Jefferson/D'Hondt."
    ))
  }

  headers <- c("Province", "Scénario", "Groupe", "Jefferson", "Sainte-Laguë", "Écart")

  tagList(tags$div(
    class = "prop-table prop-table-compact",
    tags$table(
      tags$thead(tags$tr(lapply(headers, tags$th))),
      tags$tbody(lapply(seq_len(nrow(dat)), function(i) {
        row <- dat[i, ]
        tags$tr(
          tags$td(row$province),
          tags$td(row$scenario_label),
          tags$td(
            class = "prop-table-group",
            tags$span(class = "prop-swatch", style = paste0("--swatch:", row$couleur, ";")),
            tags$span(row$groupe)
          ),
          tags$td(row$jefferson_label),
          tags$td(row$sainte_lague_label),
          tags$td(
            class = if (row$ecart > 0) "prop-delta-pos" else "prop-delta-neg",
            row$ecart_label
          )
        )
      }))
    )
  ))
}

stat_cards <- function() {
  cards <- tribble(
    ~value, ~label, ~note,
    fmt_int(changed_seats_assem_5), "sièges provinciaux changeraient à 5 %", "surtout dans le Sud et aux Îles",
    fmt_int(changed_seats_assem_3), "sièges provinciaux changeraient à 3 %", paste0(fmt_int(new_seats_assem_3), " iraient à des listes aujourd'hui sans élu provincial"),
    fmt_int(changed_seats_prov_3), "sièges du Congrès bougeraient avec la clé actuelle", "si le seuil provincial passait à 3 % des exprimés",
    fmt_int(changed_seats_nc_3), "sièges du Congrès bougeraient sans clé provinciale", "à 3 % des exprimés NC"
  )

  tagList(tags$div(
    class = "prop-stat-grid",
    pmap(cards, function(value, label, note) {
      tags$article(
        class = "prop-stat-card",
        tags$div(class = "prop-stat-value", value),
        tags$div(class = "prop-stat-label", label),
        tags$p(class = "prop-stat-note", note)
      )
    })
  ))
}

simulation_table <- function() {
  dat <- simulation_groupes |>
    filter(
      voix >= 1000 |
        sieges_actuels > 0 |
        sieges_prov_5_inscrits > 0 |
        sieges_prov_5 > 0 |
        sieges_prov_3 > 0 |
        sieges_nc_5_inscrits > 0 |
        sieges_nc_5 > 0 |
        sieges_nc_3 > 0 |
        sieges_bougival_5_inscrits > 0 |
        sieges_bougival_5 > 0 |
        sieges_bougival_3 > 0
    ) |>
    arrange(desc(voix)) |>
    mutate(
      voix_label = fmt_int(voix),
      pct_label = fmt_pct(pct_exprimes_nc),
      actuel_label = fmt_int(sieges_actuels),
      prov_5_inscrits_label = fmt_int(sieges_prov_5_inscrits),
      prov_5_label = fmt_int(sieges_prov_5),
      prov_3_label = fmt_int(sieges_prov_3),
      nc_5_inscrits_label = fmt_int(sieges_nc_5_inscrits),
      nc_5_label = fmt_int(sieges_nc_5),
      nc_3_label = fmt_int(sieges_nc_3),
      bougival_5_inscrits_label = fmt_int(sieges_bougival_5_inscrits),
      bougival_5_label = fmt_int(sieges_bougival_5),
      bougival_3_label = fmt_int(sieges_bougival_3)
    )

  headers <- c(
    "Groupe simulé", "Voix", "% exprimés NC",
    "Actuel", "Prov. 5 % inscr.", "Prov. 5 % expr.", "Prov. 3 % expr.",
    "Sans clé prov. 5 % inscr.", "Sans clé prov. 5 % expr.", "Sans clé prov. 3 % expr.",
    "Bougival 5 % inscr.", "Bougival 5 % expr.", "Bougival 3 % expr."
  )

  tagList(tags$div(
    class = "prop-table",
    tags$table(
      tags$thead(tags$tr(lapply(headers, tags$th))),
      tags$tbody(lapply(seq_len(nrow(dat)), function(i) {
        row <- dat[i, ]
        tags$tr(
          tags$td(
            class = "prop-table-group",
            tags$span(class = "prop-swatch", style = paste0("--swatch:", row$couleur, ";")),
            tags$span(row$groupe)
          ),
          tags$td(row$voix_label),
          tags$td(row$pct_label),
          tags$td(row$actuel_label),
          tags$td(row$prov_5_inscrits_label),
          tags$td(row$prov_5_label),
          tags$td(row$prov_3_label),
          tags$td(row$nc_5_inscrits_label),
          tags$td(row$nc_5_label),
          tags$td(row$nc_3_label),
          tags$td(row$bougival_5_inscrits_label),
          tags$td(row$bougival_5_label),
          tags$td(row$bougival_3_label)
        )
      }))
    )
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
    '<div id="', id, '" class="prop-sketch" data-prop-chart="', type, '"></div>\n',
    '<script type="application/json" id="', id, '-data">', json, '</script>\n',
    '<p class="prop-sketch-caption">', caption, '</p>\n',
    '<script>window.ContoursProportionnelle && window.ContoursProportionnelle.render("', id, '");</script>\n',
    sep = ""
  )
}
