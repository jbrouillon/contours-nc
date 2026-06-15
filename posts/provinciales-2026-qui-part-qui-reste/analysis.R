library(dplyr)
library(forcats)
library(ggplot2)
library(glue)
library(htmltools)
library(readr)
library(scales)
library(stringr)
library(tibble)
library(tidyr)

find_project_root <- function(path = getwd()) {
  path <- normalizePath(path, winslash = "/", mustWork = TRUE)
  repeat {
    if (file.exists(file.path(path, "_quarto.yml"))) return(path)
    parent <- dirname(path)
    if (identical(parent, path)) return(normalizePath(getwd(), winslash = "/", mustWork = TRUE))
    path <- parent
  }
}

project_dir <- find_project_root()
out_dir <- file.path(project_dir, "data", "outputs_provinciales_candidats")

path_match <- file.path(out_dir, "provinciales_candidats_correspondances_2019_2026_haute_confiance.csv")
path_qual <- file.path(out_dir, "provinciales_candidats_2019_2026_qualifies.csv")
path_ref <- file.path(out_dir, "provinciales_referentiel_listes_politiques_2019_2026.csv")
path_municipales <- file.path(out_dir, "municipales_2026_candidats_pdf_extraits.csv")

missing_files <- c(path_match, path_qual, path_ref, path_municipales)[!file.exists(c(path_match, path_qual, path_ref, path_municipales))]
if (length(missing_files) > 0) {
  stop("Fichiers manquants: ", paste(missing_files, collapse = ", "))
}

matches <- read_csv(path_match, show_col_types = FALSE, locale = locale(encoding = "UTF-8"))
candidats <- read_csv(path_qual, show_col_types = FALSE, locale = locale(encoding = "UTF-8"))
ref_listes <- read_csv(path_ref, show_col_types = FALSE, locale = locale(encoding = "UTF-8"))
municipales_2026 <- read_csv(path_municipales, show_col_types = FALSE, locale = locale(encoding = "UTF-8"))

source_wikipedia_2019 <- "https://fr.wikipedia.org/wiki/%C3%89lections_provinciales_n%C3%A9o-cal%C3%A9doniennes_de_2019#Forces_en_pr%C3%A9sence"

excluded_list_ids <- c("2026_Province Sud_04")

manual_match_exclusions <- tribble(
  ~nom_cle_comparaison_2019, ~nom_cle_comparaison_2026, ~raison_exclusion,
  "CHRISTOPHE CREUGNET JEAN", "CHALIOT CHRISTOPHE JEAN", "Prénoms communs seulement, pas de nom de famille stable commun.",
  "BIROT JEAN MARC", "ACHIMOIN JEAN MARC", "Prénoms communs seulement, pas de nom de famille stable commun.",
  "BERNARD JOSUE NENOU PWATAHO", "NENOU PWATAHO RAYMOND", "Nom de famille commun mais aucun prénom compatible.",
  "ANNE LAURE OBRY", "ANNE GERMAINE LAURE NICOLI SIMONE", "Prénoms communs seulement, pas de nom de famille stable commun.",
  "HENRICK JEAN POUAOUANDE TABOUAI YVES", "BAUDRY JEAN YVES", "Prénoms communs seulement, pas de nom de famille stable commun.",
  "JEAN MARC PEAROU", "JEAN MARC ROBERT", "Prénoms communs seulement, pas de nom de famille stable commun.",
  "FRANCE MANDAOUE MARIE", "FRANCE MARIE MATSUDA", "Prénoms communs seulement, pas de nom de famille stable commun.",
  "BRUMOERE JEAN PIERRE", "JEAN PIERRE SELEFEN", "Prénoms communs seulement, pas de nom de famille stable commun.",
  "FERE JEAN PIERRE", "FARINO JEAN PIERRE", "Prénoms communs seulement, pas de nom de famille stable commun.",
  "CLAIRE HAOCAS MARIE", "CLAIRE JACINTHE KAICHOU MARIE TOURA", "Prénoms communs seulement, pas de nom de famille stable commun.",
  "JEAN MALEJAC YVES", "JEAN KARTODIMEDJO YVES", "Prénoms communs seulement, pas de nom de famille stable commun.",
  "MARIE REBY THERESE", "CHRISTELLE KERFOURN LILIANE MARIE THERESE", "Prénoms communs seulement, pas de nom de famille stable commun.",
  "FAVREAU GABRIEL JEAN", "GABRIEL JEAN PABOU", "Prénoms communs seulement, pas de nom de famille stable commun.",
  "JEAN KOTOPEU PHILIPPE", "ALPHONSE JEAN PHILIPPE THIA", "Prénoms communs seulement, pas de nom de famille stable commun.",
  "CONDOYA MAY POIWI ROSE", "ASKARTI MAY ROSE", "Prénoms communs seulement, pas de nom de famille stable commun.",
  "ELE ELE HMAEA", "APUERI ELE HMAEA HNAWIA SIMONE", "Nom d'épouse commun mais personne différente, sexe différent dans les arrêtés.",
  "HOLUE JEAN NOEL", "JEAN NOEL SOLE", "Prénoms communs seulement, pas de nom de famille stable commun.",
  "JEAN MARC NEDENON", "JEAN MARC VOUDIJO", "Prénoms communs seulement, pas de nom de famille stable commun.",
  "DARRAS JEAN LOUIS", "JEAN LOUIS NEWEDOU", "Prénoms communs seulement, pas de nom de famille stable commun.",
  "FLORINDA LAUFOU MARIE ROSE", "MARIE NEKOENG ROSE", "Prénoms communs seulement, pas de nom de famille stable commun.",
  "JEAN KUILAGI PIERRE", "JEAN MALO PIERRE", "Prénoms communs seulement, pas de nom de famille stable commun.",
  "ANGLEBERMES JEAN LOUIS MARIE PAUL", "AYAWA JEAN MARIE", "Prénoms communs seulement, pas de nom de famille stable commun.",
  "CLAUDE KOMEDJIE MARIE STELLE", "CLAUDE MARIE SIRET", "Prénoms communs seulement, pas de nom de famille stable commun et sexe différent dans les arrêtés.",
  "GOWET JEAN MICHEL", "JEAN MICHEL WAITREU", "Prénoms communs seulement, pas de nom de famille stable commun.",
  "DANARADJOU JEAN PAUL", "HAUDRA JEAN JUNIOR PAUL", "Prénoms communs seulement, pas de nom de famille stable commun.",
  "CHARLES GEORGES OLIVIER TESTEMALLE", "CHARLES OLIVIER", "Prénoms communs seulement, pas de nom de famille stable commun.",
  "ANNE DHERSIN MARIE", "ANNE MARIE SOLANGE WAHMOWE", "Prénoms communs seulement, pas de nom de famille stable commun.",
  "CHANEL FLORES PIERRE", "CHANEL NONMOIRA PIERRE", "Prénoms communs seulement, pas de nom de famille stable commun.",
  "FRANCOISE HMEUN MARIE", "AGOURERE FRANCOISE MARIE", "Prénoms communs seulement, pas de nom de famille stable commun.",
  "JOELLE KAOUMA MARIE", "JULIEN KAOUMA MALAWIE MARIE MINDIA", "Nom commun + prénom très générique seulement.",
  "JEAN WAIMO YVES", "JEAN POITHILI YVES", "Prénoms communs seulement, pas de nom de famille stable commun.",
  "CHRISTINE MARIE MINDIA", "CHRISTINE MARIE NEWEDOU", "Prénoms communs seulement, pas de nom de famille stable commun."
)

candidats <- candidats %>%
  filter(!liste_id %in% excluded_list_ids)

ref_listes <- ref_listes %>%
  filter(!liste_id %in% excluded_list_ids)

matches <- matches %>%
  filter(
    !liste_id_2019 %in% excluded_list_ids,
    !liste_id_2026 %in% excluded_list_ids
  ) %>%
  anti_join(
    manual_match_exclusions %>%
      select(nom_cle_comparaison_2019, nom_cle_comparaison_2026),
    by = c("nom_cle_comparaison_2019", "nom_cle_comparaison_2026")
  ) %>%
  filter(province_2019 == province_2026)

manual_list_qualifications <- tribble(
  ~liste_id, ~camp_institutionnel_manual, ~famille_politique_manual, ~composante_politique_manual, ~axe_politique_manual, ~axe_politique_ordre_manual, ~source_qualification_politique_manual, ~notes_qualification_manual,
  "2019_Province Sud_05", "Non-independantiste / loyaliste", "CNR / droite anti-independantiste", "CNR / droite anti-independantiste", "Loyaliste droite", 6L, source_wikipedia_2019, "Wikipedia 2019 qualifie Caledonie nouvelle et reunie de droite anti-independantiste, nationalisme caledonien.",
  "2019_Province Sud_08", "Oceanien / transversal", "ACT / ecologiste-transversal", "ACT / ecologiste-transversal", "Oceanien / transversal", 4L, source_wikipedia_2019, "Wikipedia 2019 qualifie l'Alliance citoyenne pour la transition d'attrape-tout, ecologisme et democratie directe.",
  "2019_Province Sud_09", "Oceanien / transversal", "Construire autrement / transversal", "Construire autrement / transversal", "Oceanien / transversal", 4L, source_wikipedia_2019, "Wikipedia 2019 qualifie Construire autrement d'attrape-tout, transformisme et anti-corruption.",
  "2019_Province Sud_10", "Non-independantiste / autonomiste modere", "Destin commun caledonien / centre anti-independantiste", "Destin commun caledonien / centre anti-independantiste", "Centre non-independantiste", 5L, source_wikipedia_2019, "Wikipedia 2019 qualifie Destin commun caledonien de centre anti-independantiste.",
  "2019_Province des Iles_04", "Non-independantiste / loyaliste", "Avec nous / droite anti-independantiste", "Avec nous / droite anti-independantiste", "Loyaliste droite", 6L, source_wikipedia_2019, "Wikipedia 2019 qualifie Avec nous de droite anti-independantiste, liberal-conservatisme.",
  "2019_Province des Iles_06", "Non-independantiste / autonomiste modere", "Caledonie Ensemble / centre non-independantiste", "Caledonie Ensemble / centre non-independantiste", "Centre non-independantiste", 5L, source_wikipedia_2019, "Wikipedia 2019 rattache Nouvelle vision des Iles a Caledonie ensemble et au centre droit anti-independantiste."
)

apply_manual_list_qualifications <- function(dat) {
  dat <- dat %>%
    left_join(manual_list_qualifications, by = "liste_id") %>%
    mutate(
      camp_institutionnel = coalesce(camp_institutionnel_manual, camp_institutionnel),
      famille_politique = coalesce(famille_politique_manual, famille_politique),
      axe_politique = coalesce(axe_politique_manual, axe_politique),
      axe_politique_ordre = coalesce(axe_politique_ordre_manual, as.integer(axe_politique_ordre)),
      qualification_a_verifier = if_else(
        !is.na(axe_politique_manual),
        FALSE,
        coalesce(as.logical(qualification_a_verifier), FALSE)
      ),
      source_qualification_politique = coalesce(
        source_qualification_politique_manual,
        source_qualification_politique
      ),
      notes_qualification = coalesce(notes_qualification_manual, notes_qualification)
    )

  if ("composante_politique_candidat" %in% names(dat)) {
    dat <- dat %>%
      mutate(
        composante_politique_candidat = coalesce(
          composante_politique_manual,
          composante_politique_candidat
        )
      )
  }

  dat %>%
    select(-ends_with("_manual"))
}

refine_independentist_axis <- function(dat) {
  component_cols <- intersect(
    c("composante_politique_candidat", "composante_politique", "famille_politique", "liste_nom_court"),
    names(dat)
  )
  component <- rep("", nrow(dat))
  for (col in component_cols) {
    component <- str_squish(paste(component, coalesce(as.character(dat[[col]]), "")))
  }

  dat$.component_axis <- str_squish(component)

  dat %>%
    mutate(
      axe_politique = case_when(
        camp_institutionnel == "Independantiste / souverainiste" &
          str_detect(.component_axis, regex("\\b(UNI|Palika)\\b", ignore_case = TRUE)) ~
          "Independantiste UNI / Palika",
        camp_institutionnel == "Independantiste / souverainiste" &
          str_detect(.component_axis, regex("\\b(UC-FLNKS|FLNKS)\\b", ignore_case = TRUE)) ~
          "Independantiste UC-FLNKS",
        camp_institutionnel == "Independantiste / souverainiste" ~
          "Autres independantistes",
        TRUE ~ axe_politique
      ),
      axe_politique_ordre = case_when(
        axe_politique == "Independantiste UC-FLNKS" ~ 1L,
        axe_politique == "Autres independantistes" ~ 2L,
        axe_politique == "Independantiste UNI / Palika" ~ 3L,
        axe_politique == "Souverainiste / pro-pays" ~ 4L,
        axe_politique == "Oceanien / transversal" ~ 5L,
        axe_politique == "Centre non-independantiste" ~ 6L,
        axe_politique == "Loyaliste droite" ~ 7L,
        axe_politique == "Droite nationale anti-independantiste" ~ 8L,
        axe_politique == "A preciser" ~ 9L,
        TRUE ~ as.integer(axe_politique_ordre)
      )
    ) %>%
    select(-.component_axis)
}

candidats <- apply_manual_list_qualifications(candidats)
ref_listes <- apply_manual_list_qualifications(ref_listes)

candidats <- refine_independentist_axis(candidats)
ref_listes <- refine_independentist_axis(ref_listes)

refresh_match_side <- function(dat, year, suffix) {
  side_ref <- ref_listes %>%
    filter(annee == year) %>%
    select(
      province, numero_liste, liste_id,
      camp_institutionnel, famille_politique, axe_politique, axe_politique_ordre
    ) %>%
    rename_with(~ paste0(.x, "_ref"), -c(province, numero_liste, liste_id))

  join_by_side <- c(
    setNames("province", paste0("province_", suffix)),
    setNames("numero_liste", paste0("numero_liste_", suffix)),
    setNames("liste_id", paste0("liste_id_", suffix))
  )

  dat %>%
    left_join(side_ref, by = join_by_side) %>%
    mutate(
      "{paste0('camp_institutionnel_', suffix)}" := coalesce(
        camp_institutionnel_ref,
        .data[[paste0("camp_institutionnel_", suffix)]]
      ),
      "{paste0('famille_politique_', suffix)}" := coalesce(
        famille_politique_ref,
        .data[[paste0("famille_politique_", suffix)]]
      ),
      "{paste0('axe_politique_', suffix)}" := coalesce(
        axe_politique_ref,
        .data[[paste0("axe_politique_", suffix)]]
      ),
      "{paste0('axe_politique_ordre_', suffix)}" := coalesce(
        axe_politique_ordre_ref,
        as.integer(.data[[paste0("axe_politique_ordre_", suffix)]])
      )
    ) %>%
    select(-ends_with("_ref"))
}

matches <- matches %>%
  refresh_match_side(2019, "2019") %>%
  refresh_match_side(2026, "2026") %>%
  mutate(
    meme_camp = camp_institutionnel_2019 == camp_institutionnel_2026,
    meme_axe_politique = axe_politique_2019 == axe_politique_2026
  )

theme_set(theme_minimal(base_size = 12))
theme_update(
  plot.margin = margin(10, 28, 18, 8),
  legend.position = "bottom",
  legend.box = "vertical"
)

fmt_int <- function(x) {
  number(x, accuracy = 1, big.mark = " ", decimal.mark = ",")
}

fmt_pct <- function(x) {
  percent(x, accuracy = 0.1, decimal.mark = ",")
}

fmt_count <- function(n, singular, plural = paste0(singular, "s")) {
  word <- ifelse(abs(n) > 1, plural, singular)
  paste(fmt_int(n), word)
}

clean_label <- function(x, missing = "Non renseigne") {
  x <- ifelse(is.na(x) | !nzchar(x), missing, x)
  str_squish(x)
}

wrap_lab <- function(x, width = 28) {
  str_wrap(x, width = width)
}

normalize_name_key <- function(x) {
  out <- iconv(x, from = "", to = "ASCII//TRANSLIT", sub = "")
  out <- ifelse(is.na(out), x, out)
  out %>%
    str_to_upper() %>%
    str_replace_all("[^A-Z0-9]+", " ") %>%
    str_squish()
}

name_stop_tokens <- c("EP", "EPOUSE", "VVE", "VEUVE", "NEE", "NE", "M", "MME")

name_tokens <- function(x) {
  tokens <- normalize_name_key(x) %>%
    str_split("\\s+") %>%
    unlist(use.names = FALSE)
  tokens <- tokens[nchar(tokens) > 1 & !tokens %in% name_stop_tokens]
  unique(tokens)
}

municipales_2026 <- municipales_2026 %>%
  mutate(numero_liste_municipale = suppressWarnings(as.integer(numero_liste_municipale))) %>%
  filter(
    !is.na(numero_liste_municipale),
    numero_liste_municipale < 100,
    !str_detect(liste_municipale, regex("^\\s*-\\s*Nouvelle-Cal[ée]donie", ignore_case = TRUE))
  )

municipales_token_list <- municipales_2026 %>%
  distinct(nom_cle_municipales) %>%
  pull(nom_cle_municipales) %>%
  lapply(name_tokens)

is_municipales_2026_candidate <- function(x) {
  tokens <- name_tokens(x)
  if (length(tokens) < 2) return(FALSE)
  any(vapply(municipales_token_list, function(municipal_tokens) {
    length(municipal_tokens) >= 2 &&
      (all(tokens %in% municipal_tokens) || all(municipal_tokens %in% tokens))
  }, logical(1)))
}

axis_levels <- c(
  "Independantiste UC-FLNKS",
  "Autres independantistes",
  "Independantiste UNI / Palika",
  "Souverainiste / pro-pays",
  "Oceanien / transversal",
  "Centre non-independantiste",
  "Loyaliste droite",
  "Droite nationale anti-independantiste",
  "A preciser",
  "Municipales 2026",
  "Transition"
)

axis_palette <- c(
  "Independantiste UC-FLNKS" = "#007a3d",
  "Autres independantistes" = "#b6483b",
  "Independantiste UNI / Palika" = "#f0c52f",
  "Souverainiste / pro-pays" = "#4f8f6a",
  "Oceanien / transversal" = "#8b5fbf",
  "Centre non-independantiste" = "#2f8fb8",
  "Loyaliste droite" = "#305f9f",
  "Droite nationale anti-independantiste" = "#7a4a28",
  "A preciser" = "#8d99a6",
  "Municipales 2026" = "#c77d2a",
  "Transition" = "#b8b8b8"
)

axis_display <- function(x) {
  label <- clean_label(x)
  recode(
    label,
    "Independantiste UC-FLNKS" = "UC-FLNKS",
    "Autres independantistes" = "Autres indépendantistes",
    "Independantiste UNI / Palika" = "UNI / Palika",
    "Oceanien / transversal" = "Transversal / océanien",
    "Centre non-independantiste" = "Centre non-indépendantiste",
    "Droite nationale anti-independantiste" = "Droite nationale anti-indépendantiste",
    "A preciser" = "Sans rattachement clair",
    .default = label
  )
}

province_display <- function(x) {
  label <- clean_label(x)
  recode(
    label,
    "Province des Iles" = "Province des Îles",
    .default = label
  )
}

display_text <- function(x) {
  clean_label(x, missing = "Non renseigné") %>%
    str_replace_all(fixed("L'Eveil"), "L’Éveil") %>%
    str_replace_all(regex("\\bCALEDONIE\\b"), "CALÉDONIE") %>%
    str_replace_all(regex("\\bCALEDONIENS\\b"), "CALÉDONIENS") %>%
    str_replace_all(regex("\\bCALEDONIENNE\\b"), "CALÉDONIENNE") %>%
    str_replace_all(regex("\\bINDEPENDANCE\\b"), "INDÉPENDANCE") %>%
    str_replace_all(regex("\\bUNITE\\b"), "UNITÉ") %>%
    str_replace_all(regex("\\bSOUVERAINETE\\b"), "SOUVERAINETÉ") %>%
    str_replace_all(regex("\\bSOLIDARITE\\b"), "SOLIDARITÉ") %>%
    str_replace_all(regex("\\bDIVERSITE\\b"), "DIVERSITÉ") %>%
    str_replace_all(regex("\\bPROGRES\\b"), "PROGRÈS") %>%
    str_replace_all(regex("\\bGENERATION\\b"), "GÉNÉRATION") %>%
    str_replace_all(regex("\\bOUVEA\\b"), "OUVÉA") %>%
    str_replace_all(regex("\\bPAITA\\b"), "PAÏTA") %>%
    str_replace_all(regex("\\bDUMBEA\\b"), "DUMBÉA") %>%
    str_replace_all(regex("\\bYATE\\b"), "YATÉ") %>%
    str_replace_all(regex("\\bPOINDIMIE\\b"), "POINDIMIÉ") %>%
    str_replace_all(regex("\\bEveil\\b", ignore_case = TRUE), "Éveil") %>%
    str_replace_all(regex("\\bIles\\b", ignore_case = TRUE), "Îles") %>%
    str_replace_all(regex("\\boceanien\\b", ignore_case = TRUE), "océanien") %>%
    str_replace_all(regex("\\bCaledonie\\b", ignore_case = TRUE), "Calédonie") %>%
    str_replace_all(regex("\\bCaledoniens\\b", ignore_case = TRUE), "Calédoniens") %>%
    str_replace_all(regex("\\bCaledonienne\\b", ignore_case = TRUE), "Calédonienne") %>%
    str_replace_all(regex("\\bcaledonien\\b", ignore_case = TRUE), "calédonien") %>%
    str_replace_all(regex("\\bfrancaise\\b", ignore_case = TRUE), "française") %>%
    str_replace_all(regex("\\bfrancais\\b", ignore_case = TRUE), "français") %>%
    str_replace_all(regex("\\bindependance\\b", ignore_case = TRUE), "indépendance") %>%
    str_replace_all(regex("\\bindependantiste\\b", ignore_case = TRUE), "indépendantiste") %>%
    str_replace_all(regex("\\bunite\\b", ignore_case = TRUE), "unité") %>%
    str_replace_all(regex("\\bsouverainete\\b", ignore_case = TRUE), "souveraineté") %>%
    str_replace_all(regex("\\bsolidarite\\b", ignore_case = TRUE), "solidarité") %>%
    str_replace_all(regex("\\bdiversite\\b", ignore_case = TRUE), "diversité") %>%
    str_replace_all(regex("\\bprogres\\b", ignore_case = TRUE), "progrès") %>%
    str_replace_all(regex("\\bgeneration\\b", ignore_case = TRUE), "génération") %>%
    str_replace_all(regex("\\breunis\\b", ignore_case = TRUE), "réunis") %>%
    str_replace_all(fixed("S'engager"), "S’engager") %>%
    str_replace_all(regex("\\boeuvrer\\b", ignore_case = TRUE), "œuvrer") %>%
    str_replace_all(regex("\\belargi\\b", ignore_case = TRUE), "élargi") %>%
    str_replace_all(regex("\\bOuvea\\b", ignore_case = TRUE), "Ouvéa") %>%
    str_replace_all(regex("\\bPaita\\b", ignore_case = TRUE), "Païta") %>%
    str_replace_all(regex("\\bDumbea\\b", ignore_case = TRUE), "Dumbéa") %>%
    str_replace_all(regex("\\bYate\\b", ignore_case = TRUE), "Yaté") %>%
    str_replace_all(regex("\\bPoindimie\\b", ignore_case = TRUE), "Poindimié") %>%
    str_replace_all(regex("\\becologiste\\b", ignore_case = TRUE), "écologiste") %>%
    str_replace_all(regex("\\bdemocratie\\b", ignore_case = TRUE), "démocratie") %>%
    str_replace_all(regex("\\bmodere\\b", ignore_case = TRUE), "modéré") %>%
    str_replace_all(regex("\\breunie\\b", ignore_case = TRUE), "réunie") %>%
    str_replace_all(regex("\\bliberal\\b", ignore_case = TRUE), "libéral")
}

origin_display <- function(x) {
  label <- clean_label(x)
  recode(
    label,
    "Elu 2019 qui se represente" = "Élu 2019 qui se représente",
    "Candidat provincial 2019 non elu" = "Candidat provincial 2019 non élu",
    "Candidat municipal 2026, absent des provinciales 2019" = "Candidat municipal 2026, absent des provinciales 2019",
    "Non retrouve en provinciales 2019" = "Non retrouvé en provinciales 2019",
    .default = label
  )
}

municipales_2026 <- municipales_2026 %>%
  mutate(
    municipal_label = glue("{display_text(liste_municipale)} ({display_text(commune)})")
  )

municipales_detail_tokens <- municipales_2026$nom_cle_municipales %>%
  lapply(name_tokens)

municipal_match_labels <- function(x) {
  tokens <- name_tokens(x)
  if (length(tokens) < 2) return(NA_character_)

  hits <- vapply(municipales_detail_tokens, function(municipal_tokens) {
    length(municipal_tokens) >= 2 &&
      (all(tokens %in% municipal_tokens) || all(municipal_tokens %in% tokens))
  }, logical(1))

  labels <- unique(municipales_2026$municipal_label[hits])
  labels <- labels[!is.na(labels) & nzchar(labels)]
  if (length(labels) == 0) return(NA_character_)
  paste(labels, collapse = " ; ")
}

origin_palette <- c(
  "Elu 2019 qui se represente" = "#12395b",
  "Candidat provincial 2019 non elu" = "#5f6c7b",
  "Candidat municipal 2026, absent des provinciales 2019" = "#c77d2a",
  "Non retrouve en provinciales 2019" = "#c84f3a"
)

turnover_palette <- c(
  "Retrouve en 2026" = "#264653",
  "Non retrouve en 2026" = "#c9c9c9",
  "Deja candidat en 2019" = "#264653",
  "Non retrouve en provinciales 2019" = "#e76f51"
)

match_flow_palette <- c(
  "Meme liste" = "#264653",
  "Meme famille, autre liste" = "#4f7c8a",
  "Meme camp, autre famille" = "#6d8f71",
  "Change de camp" = "#e76f51",
  "Change de province" = "#7b3f98"
)

province_order <- c("Province des Iles", "Province Nord", "Province Sud")
province_seats_total <- c(
  "Province des Iles" = 14L,
  "Province Nord" = 22L,
  "Province Sud" = 40L
)

first_rank_limit <- function(province_name) {
  unname(province_seats_total[[province_name]]/2)
}

first_rank_scope <- function(province_name) {
  glue("{fmt_int(first_rank_limit(province_name))} premières places")
}

first_rank_scope_note <- function(province_name) {
  glue("{first_rank_scope(province_name)}, soit la moitié des sièges provinciaux à pourvoir")
}

same_clean <- function(x, y) {
  !is.na(x) & !is.na(y) & clean_label(x) == clean_label(y)
}

destination_category <- function(
  province_2019,
  province_2026,
  liste_nom_court_2019,
  liste_nom_court_2026,
  famille_politique_2019,
  famille_politique_2026,
  axe_politique_2019,
  axe_politique_2026
) {
  case_when(
    province_2026 != province_2019 ~ "Autre province",
    same_clean(liste_nom_court_2019, liste_nom_court_2026) ~ "Même liste",
    same_clean(famille_politique_2019, famille_politique_2026) ~ "Même famille politique, autre liste",
    same_clean(axe_politique_2019, axe_politique_2026) ~ "Même grand camp, autre famille",
    TRUE ~ "Autre grand camp dans la province"
  )
}

axis_order <- function(x) {
  match(clean_label(x), axis_levels, nomatch = length(axis_levels) + 1L)
}

shade_color <- function(hex, amount = 0) {
  rgb <- grDevices::col2rgb(hex)
  target <- if (amount >= 0) matrix(255, nrow = 3) else matrix(0, nrow = 3)
  mixed <- round(rgb + (target - rgb) * abs(amount))
  grDevices::rgb(mixed[1], mixed[2], mixed[3], maxColorValue = 255)
}

list_color_ref <- ref_listes %>%
  mutate(
    axe = clean_label(axe_politique),
    axe_ordre = coalesce(as.integer(axe_politique_ordre), axis_order(axe)),
    base_color = axis_palette[axe],
    base_color = coalesce(base_color, "#8d99a6")
  ) %>%
  arrange(match(province, province_order), annee, axe_ordre, numero_liste) %>%
  group_by(province, annee, axe) %>%
  mutate(
    shade = if (dplyr::n() == 1L) 0 else seq(-0.18, 0.24, length.out = dplyr::n()),
    liste_color = mapply(shade_color, base_color, shade, USE.NAMES = FALSE)
  ) %>%
  ungroup() %>%
  select(annee, province, numero_liste, liste_id, liste_color)

candidats <- candidats %>%
  left_join(list_color_ref, by = c("annee", "province", "numero_liste", "liste_id"))

ref_listes <- ref_listes %>%
  left_join(list_color_ref, by = c("annee", "province", "numero_liste", "liste_id"))

is_true <- function(x) {
  coalesce(as.logical(x), FALSE)
}

candidats <- candidats %>%
  mutate(
    elu_2019 = if_else(
      annee == 2019,
      is_true(elu_congres_2019) | is_true(elu_assemblee_province_2019),
      FALSE
    ),
    candidat_municipales_2026 = if_else(
      annee == 2026,
      vapply(nom_cle_comparaison, is_municipales_2026_candidate, logical(1)),
      FALSE
    ),
    municipales_2026_labels = if_else(
      annee == 2026,
      vapply(nom_cle_comparaison, municipal_match_labels, character(1)),
      NA_character_
    )
  )

candidats_2019_statut <- candidats %>%
  filter(annee == 2019) %>%
  transmute(
    nom_cle_comparaison_2019 = nom_cle_comparaison,
    province_2019 = province,
    liste_id_2019 = liste_id,
    elu_2019,
    mandat_2019,
    rang_2019_reference = rang
  )

matches_enriched <- matches %>%
  left_join(
    candidats_2019_statut,
    by = c("nom_cle_comparaison_2019", "province_2019", "liste_id_2019")
  ) %>%
  mutate(elu_2019 = coalesce(elu_2019, FALSE))

list_label <- function(numero_liste, liste_nom_court, axe) {
  paste0(sprintf("%02d", numero_liste), " - ", display_text(liste_nom_court))
}

make_turnover_data <- function(province_name) {
  candidats %>%
    filter(province == province_name, annee %in% c(2019, 2026)) %>%
    mutate(
      statut_renouvellement = case_when(
        annee == 2019 & nom_cle_comparaison %in% matches$nom_cle_comparaison_2019 ~
          "Retrouve en 2026",
        annee == 2019 ~
          "Non retrouve en 2026",
        annee == 2026 & nom_cle_comparaison %in% matches$nom_cle_comparaison_2026 ~
          "Deja candidat en 2019",
        TRUE ~
          "Non retrouve en provinciales 2019"
      ),
      millesime = if_else(annee == 2019, "Listes 2019", "Listes 2026"),
      axe = clean_label(axe_politique),
      axe_order = coalesce(as.integer(axe_politique_ordre), axis_order(axe)),
      liste_label = paste0(sprintf("%02d", numero_liste), " - ", display_text(liste_nom_court), "\n", axis_display(axe)),
      liste_label_plot = paste(millesime, liste_label, sep = " :: ")
    ) %>%
    count(
      millesime,
      annee,
      numero_liste,
      axe,
      axe_order,
      liste_label,
      liste_label_plot,
      statut_renouvellement,
      name = "n"
    ) %>%
    arrange(annee, axe_order, numero_liste) %>%
    mutate(
      liste_label_plot = factor(liste_label_plot, levels = rev(unique(liste_label_plot))),
      statut_renouvellement = factor(statut_renouvellement, levels = names(turnover_palette))
    )
}

plot_province_turnover <- function(province_name) {
  dat <- make_turnover_data(province_name) %>%
    group_by(liste_label_plot) %>%
    mutate(
      total_liste = sum(n, na.rm = TRUE),
      label_segment = if_else(n >= 4, fmt_int(n), ""),
      label_color = if_else(
        as.character(statut_renouvellement) %in% c("Retrouve en 2026", "Deja candidat en 2019"),
        "white",
        "#2b2b2b"
      )
    ) %>%
    ungroup()

  ggplot(dat, aes(x = n, y = liste_label_plot, fill = statut_renouvellement)) +
    geom_col(width = 0.76, color = "white", linewidth = 0.24) +
    geom_text(
      aes(label = label_segment, color = label_color),
      position = position_stack(vjust = 0.5),
      size = 3.2,
      fontface = "bold",
      show.legend = FALSE
    ) +
    facet_wrap(~millesime, scales = "free_y", ncol = 2) +
    scale_y_discrete(labels = function(x) wrap_lab(sub("^.* :: ", "", x), 34)) +
    scale_x_continuous(expand = expansion(mult = c(0, 0.12))) +
    scale_fill_manual(values = turnover_palette, drop = FALSE) +
    scale_color_identity() +
    guides(fill = guide_legend(title = NULL, nrow = 2)) +
    labs(
      title = glue("{province_name} - renouvellement par liste"),
      subtitle = "Listes triées sur l'axe indépendantiste vers loyaliste. La partie sombre correspond aux noms retrouvés d'un scrutin à l'autre.",
      x = "Nombre de candidats",
      y = NULL
    ) +
    theme(
      panel.grid.major.y = element_blank(),
      panel.grid.minor = element_blank(),
      legend.position = "bottom",
      legend.text = element_text(size = 10),
      axis.text.y = element_text(size = 9.2, lineheight = 0.92),
      axis.title.x = element_text(margin = margin(t = 8)),
      strip.text = element_text(face = "bold"),
      plot.title = element_text(face = "bold", size = 15),
      plot.subtitle = element_text(color = "#555555"),
      plot.margin = margin(12, 34, 18, 8)
    )
}

make_matched_side_blocks <- function(province_name, year, side, flows_side) {
  if (!"block_axe" %in% names(flows_side)) {
    flows_side <- flows_side %>% mutate(block_axe = NA_character_)
  }

  actual_counts <- flows_side %>%
    filter(!synthetic) %>%
    count(block_id, block_label, name = "n")

  actual <- actual_counts %>%
    left_join(
      candidats %>%
        filter(province == province_name, annee == year) %>%
        distinct(
          block_id = as.character(liste_id),
          annee, province, numero_liste, liste_nom_court,
          camp_institutionnel, famille_politique, axe_politique, axe_politique_ordre, liste_color
        ),
      by = "block_id"
    ) %>%
    mutate(
      synthetic = FALSE,
      side = side,
      axe = clean_label(axe_politique),
      order_group = coalesce(as.integer(axe_politique_ordre), axis_order(axe)),
      order_list = numero_liste
    )

  synthetic <- flows_side %>%
    filter(synthetic) %>%
    mutate(block_axe = coalesce(block_axe, "Transition")) %>%
    count(block_id, block_label, block_axe, name = "n") %>%
    mutate(
      annee = year,
      province = province_name,
      numero_liste = NA_integer_,
      liste_nom_court = block_label,
      camp_institutionnel = "Transition",
      famille_politique = "Transition",
      axe_politique = block_axe,
      axe_politique_ordre = 99L,
      synthetic = TRUE,
      side = side,
      axe = block_axe,
      order_group = axis_order(block_axe),
      order_list = 999L
    )

  bind_rows(actual, synthetic) %>%
    arrange(order_group, order_list, block_label) %>%
    mutate(
      gap = 2,
      n_display = pmax(n, 6),
      ymin = lag(cumsum(n_display + gap), default = 0),
      ymax = ymin + n_display,
      ymid = (ymin + ymax) / 2,
      x = if_else(side == "2019", 0, 1)
    )
}

prepare_province_matched_flow <- function(province_name, max_rank_2026 = Inf) {
  source_matches <- matches_enriched %>%
    filter(province_2019 == province_name | province_2026 == province_name) %>%
    mutate(
      in_source_province = province_2019 == province_name,
      in_target_province = province_2026 == province_name,
      destination_detail = destination_category(
        province_2019,
        province_2026,
        liste_nom_court_2019,
        liste_nom_court_2026,
        famille_politique_2019,
        famille_politique_2026,
        axe_politique_2019,
        axe_politique_2026
      ),
      statut_flux = case_when(
        !in_source_province | !in_target_province ~ "Change de province",
        destination_detail == "Même liste" ~ "Meme liste",
        destination_detail == "Même famille politique, autre liste" ~ "Meme famille, autre liste",
        destination_detail == "Même grand camp, autre famille" ~ "Meme camp, autre famille",
        TRUE ~ "Change de camp"
      )
    )

  if (is.finite(max_rank_2026)) {
    source_matches <- source_matches %>%
      filter(in_target_province, rang_2026 <= max_rank_2026)
  }

  flows <- source_matches %>%
    transmute(
      nom_cle_comparaison = paste(nom_cle_comparaison_2019, nom_cle_comparaison_2026, sep = " -> "),
      nom_affiche = coalesce(nom_prenoms_2026, nom_affiche_2026, nom_prenoms_2019, nom_affiche_2019),
      statut_flux = factor(statut_flux, levels = names(match_flow_palette)),
      statut_2019 = if_else(elu_2019, "Elu 2019", "Candidat 2019 non elu"),
      source_axe = if_else(
        in_source_province,
        clean_label(axe_politique_2019),
        "Transition"
      ),
      target_axe = if_else(
        in_target_province,
        clean_label(axe_politique_2026),
        "Transition"
      ),
      source_block = if_else(
        in_source_province,
        as.character(liste_id_2019),
        paste0("synthetic_2019_other_", province_name)
      ),
      source_label = if_else(
        in_source_province,
        list_label(numero_liste_2019, liste_nom_court_2019, axe_politique_2019),
        "2019 : autre province"
      ),
      source_synthetic = !in_source_province,
      target_block = if_else(
        in_target_province,
        as.character(liste_id_2026),
        paste0("synthetic_2026_other_", province_name)
      ),
      target_label = if_else(
        in_target_province,
        list_label(numero_liste_2026, liste_nom_court_2026, axe_politique_2026),
        "2026 : autre province"
      ),
      target_synthetic = !in_target_province,
      rang_2019 = if_else(in_source_province, as.numeric(rang_2019), NA_real_),
      rang_2026 = if_else(in_target_province, as.numeric(rang_2026), NA_real_)
    )

  left_blocks <- make_matched_side_blocks(
    province_name,
    2019,
    "2019",
    flows %>%
      transmute(
        block_id = source_block,
        block_label = source_label,
        synthetic = source_synthetic,
        block_axe = source_axe
      )
  )

  right_blocks <- make_matched_side_blocks(
    province_name,
    2026,
    "2026",
    flows %>%
      transmute(
        block_id = target_block,
        block_label = target_label,
        synthetic = target_synthetic,
        block_axe = target_axe
      )
  )

  blocks <- bind_rows(left_blocks, right_blocks)

  flows_pos <- flows %>%
    left_join(
      left_blocks %>% select(source_block = block_id, source_ymin = ymin, source_n = n, source_height = n_display),
      by = "source_block"
    ) %>%
    left_join(
      right_blocks %>% select(target_block = block_id, target_ymin = ymin, target_n = n, target_height = n_display),
      by = "target_block"
    ) %>%
    arrange(source_block, rang_2019, nom_affiche) %>%
    group_by(source_block) %>%
    mutate(source_rank_local = row_number()) %>%
    ungroup() %>%
    arrange(target_block, rang_2026, nom_affiche) %>%
    group_by(target_block) %>%
    mutate(target_rank_local = row_number()) %>%
    ungroup() %>%
    mutate(
      y0 = source_ymin + (source_rank_local - 0.5) * source_height / pmax(source_n, 1),
      y1 = target_ymin + (target_rank_local - 0.5) * target_height / pmax(target_n, 1)
    )

  list(
    flows = flows_pos,
    blocks = blocks,
    max_y = max(blocks$ymax, na.rm = TRUE)
  )
}

plot_province_matched_flow <- function(province_name, max_rank_2026 = Inf) {
  dat <- prepare_province_matched_flow(province_name, max_rank_2026)
  scope <- if (is.finite(max_rank_2026)) {
    glue("{max_rank_2026} premières places des listes 2026")
  } else {
    "noms retrouvés uniquement"
  }
  reference_note <- if (is.finite(max_rank_2026)) {
    places_observees <- candidats %>%
      filter(annee == 2026, province == province_name, rang <= max_rank_2026) %>%
      nrow()
    glue(
      "Population dessinée : {fmt_count(nrow(dat$flows), 'nom retrouvé', 'noms retrouvés')} dans ces {fmt_int(places_observees)} places observées ; les autres candidats ne sont pas tracés."
    )
  } else {
    candidats_2026_province <- candidats %>%
      filter(annee == 2026, province == province_name) %>%
      nrow()
    glue(
      "Population dessinée : {fmt_count(nrow(dat$flows), 'nom retrouvé', 'noms retrouvés')} dont le parcours touche la province ; les noms non retrouvés des {fmt_int(candidats_2026_province)} candidatures 2026 ne sont pas tracés."
    )
  }
  edge_dat <- dat$flows %>%
    group_by(source_block, target_block, source_axe, statut_flux) %>%
    summarise(
      n = n(),
      elus_2019 = sum(statut_2019 == "Elu 2019", na.rm = TRUE),
      y0 = mean(y0, na.rm = TRUE),
      y1 = mean(y1, na.rm = TRUE),
      .groups = "drop"
    )

  ggplot() +
    geom_curve(
      data = edge_dat,
      aes(
        x = 0.08,
        xend = 0.92,
        y = y0,
        yend = y1
      ),
      curvature = 0.16,
      color = "white",
      linewidth = 5.2,
      lineend = "round",
      alpha = 0.72
    ) +
    geom_curve(
      data = edge_dat,
      aes(
        x = 0.08,
        xend = 0.92,
        y = y0,
        yend = y1,
        color = source_axe,
        linewidth = n
      ),
      curvature = 0.16,
      lineend = "round",
      alpha = 0.9
    ) +
    geom_rect(
      data = dat$blocks,
      aes(
        xmin = x - 0.05,
        xmax = x + 0.05,
        ymin = ymin,
        ymax = ymax,
        fill = axe
      ),
      color = "white",
      linewidth = 0.3,
      alpha = 0.92
    ) +
    geom_text(
      data = dat$blocks %>% filter(side == "2019"),
      aes(x = -0.07, y = ymid, label = wrap_lab(block_label, 24)),
      hjust = 1,
      size = 2.75,
      lineheight = 0.9
    ) +
    geom_text(
      data = dat$blocks %>% filter(side == "2026"),
      aes(x = 1.07, y = ymid, label = wrap_lab(block_label, 24)),
      hjust = 0,
      size = 2.75,
      lineheight = 0.9
    ) +
    annotate("text", x = 0, y = -4, label = "2019", fontface = "bold", size = 4) +
    annotate("text", x = 1, y = -4, label = "2026", fontface = "bold", size = 4) +
    scale_y_reverse(limits = c(dat$max_y + 2, -7), expand = expansion(mult = c(0.01, 0.02))) +
    scale_x_continuous(limits = c(-0.42, 1.42), breaks = NULL) +
    scale_fill_manual(values = axis_palette, breaks = names(axis_palette), labels = axis_display, drop = FALSE) +
    scale_color_manual(values = axis_palette, breaks = names(axis_palette), labels = axis_display, drop = FALSE) +
    scale_linewidth_continuous(range = c(0.8, 5), breaks = pretty_breaks(4)) +
    guides(
      fill = "none",
      color = guide_legend(title = "Axe politique de départ", override.aes = list(alpha = 0.9, linewidth = 1.5), nrow = 2),
      linewidth = guide_legend(title = "Noms")
    ) +
    labs(
      title = glue("{province_display(province_name)} - flux des {scope}"),
      subtitle = glue("Chaque trait prend la couleur politique de son point de départ ; son épaisseur indique le nombre de noms retrouvés.\n{reference_note}"),
      x = NULL,
      y = NULL
    ) +
    theme(
      panel.grid = element_blank(),
      axis.text = element_blank(),
      legend.position = "bottom",
      legend.box = "vertical",
      legend.spacing.y = grid::unit(0.12, "cm"),
      plot.title = element_text(face = "bold", size = 15),
      plot.subtitle = element_text(color = "#555555"),
      plot.margin = margin(10, 112, 14, 112)
    )
}

hex_to_rgba <- function(hex, alpha = 0.45) {
  rgb <- grDevices::col2rgb(hex)
  sprintf("rgba(%s,%s,%s,%.2f)", rgb[1], rgb[2], rgb[3], alpha)
}

make_2026_origin_data <- function(province_name, max_rank = Inf) {
  candidats %>%
    filter(
      annee == 2026,
      province == province_name,
      rang <= max_rank
    ) %>%
    left_join(
      matches_enriched %>%
        select(
          nom_cle_comparaison_2026,
          province_2019,
          numero_liste_2019,
          liste_id_2019,
          liste_nom_court_2019,
          axe_politique_2019,
          elu_2019_source = elu_2019
        ),
      by = c("nom_cle_comparaison" = "nom_cle_comparaison_2026")
    ) %>%
    mutate(
      origine_2026 = case_when(
        is.na(province_2019) & candidat_municipales_2026 ~ "Candidat municipal 2026, absent des provinciales 2019",
        is.na(province_2019) ~ "Non retrouve en provinciales 2019",
        elu_2019_source ~ "Elu 2019 qui se represente",
        TRUE ~ "Candidat provincial 2019 non elu"
      ),
      origine_2026 = factor(origine_2026, levels = names(origin_palette)),
      axe = clean_label(axe_politique),
      axe_order = coalesce(as.integer(axe_politique_ordre), axis_order(axe)),
      liste_label = paste0(sprintf("%02d", numero_liste), " - ", display_text(liste_nom_court))
    )
}

origin_scope_title <- function(max_rank = Inf) {
  if (is.finite(max_rank)) {
    glue("les {max_rank} premières places")
  } else {
    "toute la liste"
  }
}

plot_origin_by_list <- function(province_name, max_rank = Inf) {
  dat <- make_2026_origin_data(province_name, max_rank)

  list_levels <- dat %>%
    distinct(liste_label, axe_order, numero_liste) %>%
    arrange(axe_order, numero_liste) %>%
    pull(liste_label)

  plot_dat <- dat %>%
    count(liste_label, axe, axe_order, numero_liste, origine_2026, name = "n") %>%
    mutate(
      liste_label = factor(liste_label, levels = rev(list_levels)),
      label_segment = if_else(n >= 3, fmt_int(n), ""),
      label_color = if_else(
        as.character(origine_2026) %in% c(
          "Elu 2019 qui se represente",
          "Candidat municipal 2026, absent des provinciales 2019",
          "Non retrouve en provinciales 2019"
        ),
        "white",
        "#1f2937"
      )
    )

  axis_marks <- plot_dat %>%
    distinct(liste_label, axe)

  ggplot(plot_dat, aes(x = n, y = liste_label, fill = origine_2026)) +
    geom_col(width = 0.76, color = "white", linewidth = 0.22) +
    geom_text(
      aes(label = label_segment, color = label_color),
      position = position_stack(vjust = 0.5),
      size = 3,
      fontface = "bold",
      show.legend = FALSE
    ) +
    geom_point(
      data = axis_marks,
      aes(x = -1.4, y = liste_label, color = axe),
      inherit.aes = FALSE,
      shape = 15,
      size = 4.6
    ) +
    expand_limits(x = -2.6) +
    scale_y_discrete(labels = function(x) wrap_lab(x, 34)) +
    scale_x_continuous(
      labels = function(x) ifelse(x < 0, "", fmt_int(x)),
      expand = expansion(mult = c(0.01, 0.08))
    ) +
    scale_fill_manual(values = origin_palette, labels = origin_display, drop = FALSE) +
    scale_color_manual(values = axis_palette, labels = axis_display, drop = FALSE) +
    guides(
      fill = guide_legend(title = "Origine des candidats 2026", nrow = 2, byrow = TRUE),
      color = guide_legend(title = "Axe politique de la liste", nrow = 2, byrow = TRUE)
    ) +
    labs(
      title = glue("{province_display(province_name)} - origine des candidats 2026 par liste"),
      subtitle = glue("Lecture sur {origin_scope_title(max_rank)}. Le carré coloré à gauche signale l'axe politique de la liste."),
      x = "Nombre de candidats",
      y = NULL
    ) +
    coord_cartesian(clip = "off") +
    theme(
      panel.grid.major.y = element_blank(),
      panel.grid.minor = element_blank(),
      axis.text.y = element_text(size = 9.3, lineheight = 0.92),
      legend.position = "bottom",
      legend.box = "vertical",
      legend.text = element_text(size = 9.4),
      plot.title = element_text(face = "bold", size = 15),
      plot.subtitle = element_text(color = "#555555"),
      plot.margin = margin(12, 26, 18, 12)
    )
}

plot_origin_by_axis <- function(province_name, max_rank = Inf) {
  dat <- make_2026_origin_data(province_name, max_rank) %>%
    count(axe, axe_order, origine_2026, name = "n")

  axis_levels_plot <- dat %>%
    distinct(axe, axe_order) %>%
    arrange(axe_order) %>%
    pull(axe)

  dat <- dat %>%
    mutate(
      axe = factor(axe, levels = rev(axis_levels_plot)),
      label_segment = if_else(n >= 3, fmt_int(n), ""),
      label_color = if_else(
        as.character(origine_2026) %in% c(
          "Elu 2019 qui se represente",
          "Candidat municipal 2026, absent des provinciales 2019",
          "Non retrouve en provinciales 2019"
        ),
        "white",
        "#1f2937"
      )
    )

  ggplot(dat, aes(x = n, y = axe, fill = origine_2026)) +
    geom_col(width = 0.72, color = "white", linewidth = 0.24) +
    geom_text(
      aes(label = label_segment, color = label_color),
      position = position_stack(vjust = 0.5),
      size = 3.2,
      fontface = "bold",
      show.legend = FALSE
    ) +
    scale_y_discrete(labels = function(x) wrap_lab(axis_display(x), 32)) +
    scale_x_continuous(labels = label_number(big.mark = " ", decimal.mark = ","), expand = expansion(mult = c(0, 0.08))) +
    scale_fill_manual(values = origin_palette, labels = origin_display, drop = FALSE) +
    scale_color_identity() +
    guides(fill = guide_legend(title = "Origine des candidats 2026", nrow = 2, byrow = TRUE)) +
    labs(
      title = glue("{province_display(province_name)} - composition par axe politique"),
      subtitle = glue("Lecture sur {origin_scope_title(max_rank)} ; UC-FLNKS, autres indépendantistes et UNI/Palika sont séparés."),
      x = "Nombre de candidats",
      y = NULL
    ) +
    theme(
      panel.grid.major.y = element_blank(),
      panel.grid.minor = element_blank(),
      axis.text.y = element_text(size = 9.4, lineheight = 0.92),
      legend.position = "bottom",
      plot.title = element_text(face = "bold", size = 15),
      plot.subtitle = element_text(color = "#555555")
    )
}

first_ranks_2026_summary <- function(province_name, max_rank = first_rank_limit(province_name)) {
  expected_cols <- names(origin_palette)

  out <- make_2026_origin_data(province_name, max_rank = max_rank) %>%
    count(
      province,
      liste_id,
      numero_liste,
      liste_nom_court,
      axe_politique,
      origine_2026,
      name = "n"
    ) %>%
    tidyr::pivot_wider(
      names_from = origine_2026,
      values_from = n,
      values_fill = 0
    )

  for (col in expected_cols) {
    if (!col %in% names(out)) out[[col]] <- 0L
  }

  out %>%
    mutate(
      total_first_ranks = rowSums(pick(all_of(expected_cols)), na.rm = TRUE),
      liste = paste0(sprintf("%02d", numero_liste), " - ", display_text(liste_nom_court))
    ) %>%
    arrange(axis_order(axe_politique), numero_liste) %>%
    transmute(
      ListeId = liste_id,
      Numero = numero_liste,
      Liste = liste,
      Axe = axe_politique,
      `Elu 2019 qui se represente` = `Elu 2019 qui se represente`,
      `Candidat provincial 2019 non elu` = `Candidat provincial 2019 non elu`,
      `Municipal 2026 absent provinciales 2019` = `Candidat municipal 2026, absent des provinciales 2019`,
      `Non retrouve en provinciales 2019` = `Non retrouve en provinciales 2019`,
      Total = total_first_ranks
    )
}

listes_table <- ref_listes %>%
  transmute(
    Province = province,
    Annee = annee,
    `No` = sprintf("%02d", numero_liste),
    Liste = display_text(liste_nom_court),
    Axe = axe_politique,
    `Qualification politique` = camp_institutionnel,
    `Famille` = display_text(famille_politique),
    `À vérifier` = if_else(qualification_a_verifier, "Oui", "Non"),
    axe_ordre = axe_politique_ordre
  ) %>%
  arrange(match(Province, province_order), Annee, axe_ordre, `No`) %>%
  select(-axe_ordre)

safe_share <- function(n, d) {
  ifelse(is.na(d) | d == 0, NA_real_, n / d)
}

axis_color <- function(axis) {
  color <- axis_palette[clean_label(axis)]
  coalesce(color, "#8d99a6")
}

municipal_axis_overrides <- tribble(
  ~pattern, ~axis,
  # La page Wikipedia des municipales 2026 donne pour Mike Samadi
  # l'etiquette SE-LOY-R-LR-CE et la nuance LDVD.
  "AGISSONS POUR KONE", "Loyaliste droite",
  "DUMBEA AU SERVICE DU PEUPLE", "Independantiste UC-FLNKS"
)

municipal_source_axis <- function(label) {
  vapply(label, function(one_label) {
    key <- normalize_name_key(one_label)
    override <- municipal_axis_overrides %>%
      filter(str_detect(key, pattern)) %>%
      slice_head(n = 1)
    if (nrow(override) > 0) {
      return(override$axis[[1]])
    }

    case_when(
      str_detect(key, "\\bUNI\\b|UNION NATIONALE POUR L INDEPENDANCE|PALIKA") ~ "Independantiste UNI / Palika",
      str_detect(key, "\\bUC\\b|UNION CALEDONIENNE|FLNKS") ~ "Independantiste UC-FLNKS",
      str_detect(key, "KANAKY|NATIONALISTE|PARTI TRAVAILLISTE|NATION SOUVERAINE") ~ "Autres independantistes",
      str_detect(key, "SOUVERAINETE CALEDONIENNE|UNITE PAYS") ~ "Souverainiste / pro-pays",
      str_detect(key, "RASSEMBLEMENT NATIONAL|FRANCE CALEDONIE|CALEDONIE FRANCAISE|IDENTITE") ~ "Droite nationale anti-independantiste",
      str_detect(key, "LOYALISTE|AVEC VOUS POUR NOUMEA|DUMBEA AVANT TOUT|ESPRIT PAITA|NOUMEA POUR TOUS|NOUMEA LE RENOUVEAU|PASSIONNEMENT DUMBEA|TOUS ENSEMBLE POUR LE MONT DORE|POUR NOUMEA UNE ENERGIE NOUVELLE") ~ "Loyaliste droite",
      TRUE ~ "A preciser"
    )
  }, character(1), USE.NAMES = FALSE)
}

municipal_source_color <- function(label) {
  axis_color(municipal_source_axis(label))
}

axis_badge <- function(axis) {
  color <- axis_color(axis)
  htmltools::tags$span(
    class = "prov-axis-badge",
    style = glue("border-color: {color}; background: {hex_to_rgba(color, 0.12)};"),
    axis_display(axis)
  )
}

stat_card <- function(value, label, note = NULL, accent = "#2f6b45") {
  htmltools::tags$article(
    class = "prov-stat-card",
    style = glue("border-top-color: {accent};"),
    htmltools::tags$div(class = "prov-stat-value", value),
    htmltools::tags$div(class = "prov-stat-label", label),
    if (!is.null(note) && !is.na(note) && nzchar(note)) {
      htmltools::tags$p(class = "prov-stat-note", note)
    }
  )
}

tag_grid <- function(class, children) {
  do.call(htmltools::tags$div, c(list(class = class), children))
}

province_profile <- function(province_name) {
  c19 <- candidats %>% filter(province == province_name, annee == 2019)
  c26 <- candidats %>% filter(province == province_name, annee == 2026)
  same <- matches_enriched %>% filter(province_2019 == province_name, province_2026 == province_name)
  out <- matches_enriched %>% filter(province_2019 == province_name, province_2026 != province_name)
  incoming <- matches_enriched %>% filter(province_2026 == province_name, province_2019 != province_name)
  elus_2019_df <- c19 %>% filter(elu_2019)
  elus_representes <- matches_enriched %>% filter(province_2019 == province_name, elu_2019)

  tibble(
    province = province_name,
    candidats_2019 = nrow(c19),
    candidats_2026 = nrow(c26),
    listes_2019 = n_distinct(c19$liste_id),
    listes_2026 = n_distinct(c26$liste_id),
    retrouves_meme_province = nrow(same),
    departs_autre_province = nrow(out),
    arrives_autre_province = nrow(incoming),
    elus_2019 = nrow(elus_2019_df),
    elus_2019_representes = nrow(elus_representes),
    elus_2019_representes_meme_province = sum(same$elu_2019, na.rm = TRUE),
    candidats_2019_non_elus_representes_meme_province = sum(!same$elu_2019, na.rm = TRUE),
    sortants_non_retrouves = sum(!c19$nom_cle_comparaison %in% matches$nom_cle_comparaison_2019),
    nouveaux_2026 = sum(!c26$nom_cle_comparaison %in% matches$nom_cle_comparaison_2026),
    elus_2019_non_retrouves = nrow(elus_2019_df) - nrow(elus_representes),
    part_retrouves_2019 = safe_share(nrow(same) + nrow(out), nrow(c19)),
    part_elus_2019_representes = safe_share(nrow(elus_representes), nrow(elus_2019_df)),
    part_nouveaux_2026 = safe_share(
      sum(!c26$nom_cle_comparaison %in% matches$nom_cle_comparaison_2026),
      nrow(c26)
    )
  )
}

profile_iles <- province_profile("Province des Iles")
profile_nord <- province_profile("Province Nord")
profile_sud <- province_profile("Province Sud")
province_profiles <- bind_rows(profile_iles, profile_nord, profile_sud)

profile_scalar <- function(profile, field) {
  if (!field %in% names(profile)) {
    stop("Champ absent dans le profil: ", field, " ; champs disponibles: ", paste(names(profile), collapse = ", "))
  }
  if (nrow(profile) == 0) {
    stop("Profil vide pour le champ: ", field)
  }
  profile[[field]][[1]]
}

iles_listes_2019 <- profile_scalar(profile_iles, "listes_2019")
iles_listes_2026 <- profile_scalar(profile_iles, "listes_2026")
iles_candidats_2019 <- profile_scalar(profile_iles, "candidats_2019")
iles_candidats_2026 <- profile_scalar(profile_iles, "candidats_2026")
iles_retrouves_meme_province <- profile_scalar(profile_iles, "retrouves_meme_province")
iles_arrives_autre_province <- profile_scalar(profile_iles, "arrives_autre_province")
iles_departs_autre_province <- profile_scalar(profile_iles, "departs_autre_province")
iles_elus_2019 <- profile_scalar(profile_iles, "elus_2019")
iles_elus_2019_representes <- profile_scalar(profile_iles, "elus_2019_representes")
iles_anciens_non_elus_representes <- profile_scalar(profile_iles, "candidats_2019_non_elus_representes_meme_province")
iles_nouveaux_2026 <- profile_scalar(profile_iles, "nouveaux_2026")
iles_part_nouveaux_2026 <- profile_scalar(profile_iles, "part_nouveaux_2026")

nord_listes_2019 <- profile_scalar(profile_nord, "listes_2019")
nord_listes_2026 <- profile_scalar(profile_nord, "listes_2026")
nord_retrouves_meme_province <- profile_scalar(profile_nord, "retrouves_meme_province")
nord_elus_2019 <- profile_scalar(profile_nord, "elus_2019")
nord_elus_2019_representes <- profile_scalar(profile_nord, "elus_2019_representes")
nord_nouveaux_2026 <- profile_scalar(profile_nord, "nouveaux_2026")
nord_part_nouveaux_2026 <- profile_scalar(profile_nord, "part_nouveaux_2026")

sud_candidats_2019 <- profile_scalar(profile_sud, "candidats_2019")
sud_candidats_2026 <- profile_scalar(profile_sud, "candidats_2026")
sud_listes_2019 <- profile_scalar(profile_sud, "listes_2019")
sud_listes_2026 <- profile_scalar(profile_sud, "listes_2026")
sud_retrouves_meme_province <- profile_scalar(profile_sud, "retrouves_meme_province")
sud_departs_autre_province <- profile_scalar(profile_sud, "departs_autre_province")
sud_elus_2019 <- profile_scalar(profile_sud, "elus_2019")
sud_elus_2019_representes <- profile_scalar(profile_sud, "elus_2019_representes")
sud_nouveaux_2026 <- profile_scalar(profile_sud, "nouveaux_2026")
sud_part_nouveaux_2026 <- profile_scalar(profile_sud, "part_nouveaux_2026")

first_ranks_profile <- function(province_name) {
  first_ranks_2026_summary(province_name) %>%
    summarise(
      province = province_name,
      first_ranks_total = sum(Total, na.rm = TRUE),
      first_ranks_elus_2019 = sum(`Elu 2019 qui se represente`, na.rm = TRUE),
      first_ranks_candidats_2019_non_elus = sum(`Candidat provincial 2019 non elu`, na.rm = TRUE),
      first_ranks_municipaux = sum(`Municipal 2026 absent provinciales 2019`, na.rm = TRUE),
      first_ranks_non_retrouves = sum(`Non retrouve en provinciales 2019`, na.rm = TRUE),
      .groups = "drop"
    )
}

first_ranks_profiles <- bind_rows(lapply(province_order, first_ranks_profile))
first_ranks_iles <- first_ranks_profiles %>% filter(province == "Province des Iles") %>% slice(1)
first_ranks_nord <- first_ranks_profiles %>% filter(province == "Province Nord") %>% slice(1)
first_ranks_sud <- first_ranks_profiles %>% filter(province == "Province Sud") %>% slice(1)

head_list_profile <- function(province_name) {
  dat <- make_2026_origin_data(province_name, max_rank = 1)
  tibble(
    province = province_name,
    tetes_total = nrow(dat),
    tetes_elus_2019 = sum(dat$origine_2026 == "Elu 2019 qui se represente", na.rm = TRUE),
    tetes_anciens_non_elus = sum(dat$origine_2026 == "Candidat provincial 2019 non elu", na.rm = TRUE),
    tetes_municipales = sum(dat$origine_2026 == "Candidat municipal 2026, absent des provinciales 2019", na.rm = TRUE),
    tetes_non_retrouvees = sum(dat$origine_2026 == "Non retrouve en provinciales 2019", na.rm = TRUE)
  ) %>%
    mutate(
      tetes_deja_2019 = tetes_elus_2019 + tetes_anciens_non_elus,
      part_tetes_deja_2019 = safe_share(tetes_deja_2019, tetes_total)
    )
}

head_list_profiles <- bind_rows(lapply(province_order, head_list_profile))

leading_2019_lists <- ref_listes %>%
  filter(annee == 2019, !is.na(voix_2019)) %>%
  mutate(
    voix_2019 = as.numeric(voix_2019),
    sieges_congres_2019 = as.numeric(sieges_congres_2019),
    sieges_province_total_2019 = as.numeric(sieges_province_total_2019)
  ) %>%
  group_by(province) %>%
  arrange(desc(voix_2019), numero_liste, .by_group = TRUE) %>%
  mutate(rang_resultat_2019 = row_number()) %>%
  slice_head(n = 3) %>%
  ungroup()

destination_summary <- function(dat, province_name, max_destinations = 3) {
  if (nrow(dat) == 0) return("Aucun nom relié aux listes 2026")

  dat %>%
    mutate(
      destination = if_else(
        province_2026 == province_name,
        paste0(sprintf("%02d", numero_liste_2026), " - ", display_text(liste_nom_court_2026)),
        paste0(province_display(province_2026), " - ", sprintf("%02d", numero_liste_2026), " - ", display_text(liste_nom_court_2026))
      )
    ) %>%
    count(destination, sort = TRUE) %>%
    slice_head(n = max_destinations) %>%
    transmute(piece = glue("{destination} ({fmt_int(n)})")) %>%
    pull(piece) %>%
    paste(collapse = " ; ")
}

leading_list_analysis <- function(part_retrouves, elus_representes, elus_total, meme_axe, retrouves) {
  continuity <- case_when(
    part_retrouves >= 0.45 ~ "La continuité nominative est nette",
    part_retrouves >= 0.25 ~ "La continuité existe, mais elle ne structure pas toute la liste",
    TRUE ~ "La continuité nominative est limitée"
  )

  elected <- case_when(
    elus_total == 0 ~ "sans effet sortant direct, faute d’élu provincial en 2019",
    elus_representes == elus_total ~ "avec tous les élus 2019 retrouvés",
    elus_representes > 0 ~ glue("avec {fmt_count(elus_representes, 'élu retrouvé', 'élus retrouvés')} sur {fmt_count(elus_total, 'élu', 'élus')}"),
    TRUE ~ "sans élu 2019 retrouvé dans les listes 2026"
  )

  axis <- if (retrouves == 0) {
    "La recomposition ne passe donc pas par des trajectoires individuelles identifiées."
  } else if (meme_axe / retrouves >= 0.75) {
    "Les noms retrouvés restent surtout dans le même espace politique."
  } else if (meme_axe / retrouves >= 0.4) {
    "Les trajectoires se partagent entre maintien dans le même espace politique et déplacements plus transversaux."
  } else {
    "Les noms retrouvés signalent plutôt une dispersion vers d’autres espaces politiques."
  }

  glue("{continuity}, {elected}. {axis}")
}

leading_2019_profile <- function(province_name) {
  rows <- leading_2019_lists %>% filter(province == province_name)

  bind_rows(lapply(seq_len(nrow(rows)), function(i) {
    item <- rows[i, ]
    c19 <- candidats %>% filter(annee == 2019, liste_id == item$liste_id)
    matched <- matches_enriched %>% filter(liste_id_2019 == item$liste_id)
    elus_total <- sum(c19$elu_2019, na.rm = TRUE)
    elus_representes <- sum(matched$elu_2019, na.rm = TRUE)
    retrouves <- nrow(matched)
    meme_axe <- sum(matched$axe_politique_2019 == matched$axe_politique_2026, na.rm = TRUE)

    tibble(
      province = province_name,
      rang_resultat_2019 = item$rang_resultat_2019,
      liste_id = item$liste_id,
      liste_nom_court = display_text(item$liste_nom_court),
      axe_politique = item$axe_politique,
      voix_2019 = item$voix_2019,
      sieges_congres_2019 = item$sieges_congres_2019,
      sieges_province_total_2019 = item$sieges_province_total_2019,
      candidats_2019 = nrow(c19),
      retrouves_2026 = retrouves,
      part_retrouves_2026 = safe_share(retrouves, nrow(c19)),
      elus_total = elus_total,
      elus_representes = elus_representes,
      meme_axe = meme_axe,
      destinations = destination_summary(matched, province_name),
      analyse = leading_list_analysis(
        safe_share(retrouves, nrow(c19)),
        elus_representes,
        elus_total,
        meme_axe,
        retrouves
      )
    )
  }))
}

render_turnover_cards <- function() {
  elus_2019_total <- sum(candidats$annee == 2019 & candidats$elu_2019, na.rm = TRUE)
  elus_representes_total <- sum(matches_enriched$elu_2019, na.rm = TRUE)
  anciens_non_elus_total <- n_matches - elus_representes_total
  municipaux_2026_total <- sum(candidats$annee == 2026 & candidats$candidat_municipales_2026, na.rm = TRUE)
  candidats_2026_card <- candidats %>%
    filter(annee == 2026) %>%
    mutate(
      retrouve_provinciales_2019 = nom_cle_comparaison %in% matches$nom_cle_comparaison_2026,
      retrouve_dans_sources_candidatures = retrouve_provinciales_2019 | candidat_municipales_2026
    )
  deja_reperes_candidature <- sum(candidats_2026_card$retrouve_dans_sources_candidatures, na.rm = TRUE)
  jamais_reperes_provinciales_municipales <- sum(!candidats_2026_card$retrouve_dans_sources_candidatures, na.rm = TRUE)

  cards <- list(
    stat_card(
      fmt_int(deja_reperes_candidature),
      "Déjà repérés dans une candidature",
      glue("{fmt_pct(deja_reperes_candidature / n_2026)} des candidatures 2026, via provinciales 2019 ou municipales 2026"),
      "#2f6b45"
    ),
    stat_card(
      fmt_int(n_matches),
      "Déjà candidats aux provinciales 2019",
      glue("{fmt_pct(n_matches / n_2026)} des candidatures 2026"),
      "#1f2937"
    ),
    stat_card(
      fmt_int(elus_representes_total),
      "Élus 2019 qui se représentent",
      glue("sur {fmt_int(elus_2019_total)} élus repérés dans les listes 2019"),
      "#12395b"
    ),
    stat_card(
      fmt_int(anciens_non_elus_total),
      "Candidats 2019 non élus retrouvés",
      "Noms déjà présents sur une liste 2019, sans mandat provincial repéré",
      "#4f7c8a"
    ),
    stat_card(
      fmt_int(municipaux_2026_total),
      "Candidats aussi aux municipales 2026",
      glue("{fmt_pct(municipaux_2026_total / n_2026)} des candidatures provinciales 2026"),
      "#c9822b"
    ),
    stat_card(
      fmt_int(jamais_reperes_provinciales_municipales),
      "Non retrouvés dans ces deux sources",
      glue("{fmt_pct(jamais_reperes_provinciales_municipales / n_2026)} des candidatures 2026"),
      "#9a4f43"
    ),
    stat_card(
      fmt_int(n_2026 - n_matches),
      "Pas retrouvés en provinciales 2019",
      glue("{fmt_pct((n_2026 - n_matches) / n_2026)} des candidatures 2026"),
      "#c84f3a"
    )
  )
  tag_grid("prov-stat-grid prov-stat-grid-three", cards)
}

render_axis_summary <- function() {
  axis_summary <- ref_listes %>%
    distinct(province, annee, liste_id, axe_politique) %>%
    count(province, annee, axe_politique, name = "n") %>%
    arrange(match(province, province_order), annee, axis_order(axe_politique))

  cards <- lapply(province_order, function(province_name) {
    year_blocks <- lapply(c(2019, 2026), function(year) {
      year_data <- axis_summary %>% filter(province == province_name, annee == year)
      chips <- lapply(seq_len(nrow(year_data)), function(i) {
        axis <- year_data$axe_politique[[i]]
        color <- axis_color(axis)
        htmltools::tags$span(
          class = "prov-axis-chip",
          style = glue("--chip-color: {color};"),
          htmltools::tags$i(),
          glue("{year_data$n[[i]]} - {axis_display(axis)}")
        )
      })
      htmltools::tags$section(
        class = "prov-axis-year",
        htmltools::tags$h4(year),
        htmltools::tags$p(glue("{fmt_int(sum(year_data$n))} listes")),
        tag_grid("prov-chip-list", chips)
      )
    })

    htmltools::tags$article(
      class = "prov-axis-card",
      htmltools::tags$h3(province_display(province_name)),
      tag_grid("prov-axis-years", year_blocks)
    )
  })

  tag_grid("prov-axis-grid", cards)
}

render_list_reference <- function(province_name) {
  dat <- listes_table %>% filter(Province == province_name)
  year_blocks <- lapply(sort(unique(dat$Annee)), function(year) {
    rows <- dat %>% filter(Annee == year)
    items <- lapply(seq_len(nrow(rows)), function(i) {
      item <- rows[i, ]
      htmltools::tags$li(
        class = "prov-list-item",
        htmltools::tags$span(class = "prov-list-num", item[["No"]]),
        htmltools::tags$span(
          class = "prov-list-main",
          htmltools::tags$strong(item[["Liste"]]),
          htmltools::tags$small(item[["Famille"]])
        ),
        axis_badge(item[["Axe"]]),
        if (identical(item[["À vérifier"]], "Oui")) {
          htmltools::tags$span(class = "prov-warning", "À vérifier")
        }
      )
    })
    htmltools::tags$section(
      class = "prov-list-year",
      htmltools::tags$h4(year),
      do.call(htmltools::tags$ul, c(list(class = "prov-list"), items))
    )
  })

  htmltools::tags$details(
    class = "prov-details",
    htmltools::tags$summary(glue("Référentiel des listes - {province_display(province_name)}")),
    tag_grid("prov-list-grid", year_blocks)
  )
}

stack_legend <- function() {
  items <- list(
    list(class = "prov-stack-elected", label = "Élus 2019 représentés"),
    list(class = "prov-stack-stable", label = "Candidats 2019 non élus"),
    list(class = "prov-stack-municipal", label = "Municipales 2026, non repérés en provinciales 2019"),
    list(class = "prov-stack-new", label = "Non repérés en 2019 ni dans les municipales 2026")
  )

  htmltools::tags$div(
    class = "prov-card-legend",
    lapply(items, function(item) {
      htmltools::tags$span(
        htmltools::tags$i(class = item$class),
        item$label
      )
    })
  )
}

collapsible_block <- function(summary, ..., open = FALSE) {
  htmltools::tags$details(
    class = "prov-card-details",
    open = if (open) NA else NULL,
    htmltools::tags$summary(summary),
    htmltools::tagList(...)
  )
}

collapsible_card <- function(class, summary, ..., open = TRUE) {
  htmltools::tags$details(
    class = paste(class, "prov-card-details prov-card-item"),
    open = if (open) NA else NULL,
    htmltools::tags$summary(summary),
    htmltools::tags$div(class = "prov-card-body", htmltools::tagList(...))
  )
}

stack_values <- function(item) {
  c(
    item[["Elu 2019 qui se represente"]],
    item[["Candidat provincial 2019 non elu"]],
    item[["Municipal 2026 absent provinciales 2019"]],
    item[["Non retrouve en provinciales 2019"]]
  )
}

stack_legend_items <- function(values) {
  labels <- c(
    "Élus 2019",
    "Candidats 2019 non élus",
    "Municipales 2026",
    "Non repérés 2019"
  )
  classes <- c(
    "prov-stack-elected",
    "prov-stack-stable",
    "prov-stack-municipal",
    "prov-stack-new"
  )
  keep <- !is.na(values) & values > 0
  htmltools::tags$div(
    class = "prov-stack-local-legend",
    lapply(which(keep), function(i) {
      htmltools::tags$span(
        htmltools::tags$i(class = classes[[i]]),
        labels[[i]]
      )
    })
  )
}

render_stack_bar <- function(values, label) {
  widths <- 100 * values / max(sum(values, na.rm = TRUE), 1)
  htmltools::tags$div(
    class = "prov-stack-row",
    htmltools::tags$span(class = "prov-stack-title", label),
    htmltools::tags$div(
      class = "prov-stack-bar",
      htmltools::tags$span(class = "prov-stack-elected", style = glue("width: {widths[[1]]}%;")),
      htmltools::tags$span(class = "prov-stack-stable", style = glue("width: {widths[[2]]}%;")),
      htmltools::tags$span(class = "prov-stack-municipal", style = glue("width: {widths[[3]]}%;")),
      htmltools::tags$span(class = "prov-stack-new", style = glue("width: {widths[[4]]}%;"))
    )
  )
}

render_candidate_source_bars <- function(card_rows, top_limit = Inf) {
  top_label <- if (is.finite(top_limit)) {
    glue("dans les {top_limit} premières places")
  } else {
    "dans les premières places"
  }

  old_sources <- card_rows %>%
    filter(!is.na(liste_id_2019)) %>%
    mutate(
      source_kind = "Provinciales 2019",
      source_label = if_else(
        province_2019 == province,
        display_text(liste_nom_court_2019),
        glue("{display_text(liste_nom_court_2019)} ({province_display(province_2019)})")
      ),
      source_color = axis_color(axe_politique_2019)
    ) %>%
    group_by(source_kind, source_label, source_color) %>%
    summarise(
      n = n(),
      n_top = sum(rang <= top_limit, na.rm = TRUE),
      .groups = "drop"
    )

  municipal_sources <- card_rows %>%
    filter(
      is.na(liste_id_2019),
      candidat_municipales_2026,
      !is.na(municipales_2026_labels)
    ) %>%
    tidyr::separate_rows(municipales_2026_labels, sep = "\\s*;\\s*") %>%
    mutate(
      source_kind = "Municipales 2026",
      source_label = display_text(municipales_2026_labels),
      source_color = municipal_source_color(municipales_2026_labels)
    ) %>%
    group_by(source_kind, source_label, source_color) %>%
    summarise(
      n = n(),
      n_top = sum(rang <= top_limit, na.rm = TRUE),
      .groups = "drop"
    )

  sources <- bind_rows(old_sources, municipal_sources) %>%
    arrange(source_kind != "Provinciales 2019", desc(n), source_label)

  if (nrow(sources) == 0) return(NULL)

  max_count <- max(sources$n, na.rm = TRUE)
  rows <- lapply(seq_len(nrow(sources)), function(i) {
    item <- sources[i, ]
    width <- 100 * item$n / max(max_count, 1)
    top_width <- 100 * item$n_top / max(item$n, 1)
    count_label <- if (item$n_top > 0) {
      glue("{fmt_count(item$n, 'nom', 'noms')}, dont {fmt_int(item$n_top)} {top_label}")
    } else {
      fmt_count(item$n, "nom", "noms")
    }
    htmltools::tags$div(
      class = "prov-detail-row",
      htmltools::tags$div(
        class = "prov-detail-head",
        htmltools::tags$span(
          class = "prov-detail-label",
          htmltools::tags$i(style = glue("background: {item$source_color};")),
          htmltools::tags$span(
            item$source_label,
            htmltools::tags$small(item$source_kind)
          )
        ),
        htmltools::tags$strong(count_label)
      ),
      htmltools::tags$div(
        class = "prov-detail-meter",
        htmltools::tags$span(
          class = "prov-detail-fill",
          style = glue("width: {width}%; background: {item$source_color};"),
          htmltools::tags$span(
            class = "prov-detail-highlight",
            style = glue("width: {top_width}%;")
          )
        )
      )
    )
  })

  htmltools::tags$section(
    class = "prov-source-breakdown",
    htmltools::tags$h4("Origines détaillées de la liste complète"),
    htmltools::tags$p(
      class = "prov-detail-note",
      glue("La barre compte toute la liste ; la partie hachurée signale les noms aussi présents {top_label}.")
    ),
    do.call(htmltools::tags$div, c(list(class = "prov-detail-bars"), rows))
  )
}

sentence_join <- function(x) {
  x <- x[!is.na(x) & nzchar(x)]
  if (length(x) == 0) return("")
  if (length(x) == 1) return(x)
  paste0(paste(head(x, -1), collapse = ", "), " et ", tail(x, 1))
}

new_list_summary <- function(province_name) {
  make_2026_origin_data(province_name, max_rank = Inf) %>%
    group_by(liste_id, numero_liste, liste_nom_court, axe_politique) %>%
    summarise(
      total = n(),
      anciens_provinciaux_2019 = sum(!is.na(province_2019), na.rm = TRUE),
      municipaux_2026_hors_2019 = sum(is.na(province_2019) & candidat_municipales_2026, na.rm = TRUE),
      non_reperes_sources = sum(is.na(province_2019) & !candidat_municipales_2026, na.rm = TRUE),
      .groups = "drop"
    ) %>%
    arrange(anciens_provinciaux_2019, desc(municipaux_2026_hors_2019), numero_liste)
}

new_list_names <- function(dat, count_col = NULL) {
  if (nrow(dat) == 0) return("")
  labels <- lapply(seq_len(nrow(dat)), function(i) {
    item <- dat[i, ]
    name <- display_text(item$liste_nom_court)
    if (is.null(count_col)) return(name)
    glue("{name} ({fmt_count(item[[count_col]], 'nom', 'noms')})")
  })
  sentence_join(unlist(labels))
}

new_list_subject <- function(dat, count_col = NULL) {
  prefix <- if (nrow(dat) == 1) "la liste " else "les listes "
  paste0(prefix, new_list_names(dat, count_col))
}

new_list_verb <- function(dat, singular, plural) {
  if (nrow(dat) == 1) singular else plural
}

new_list_pronoun <- function(dat) {
  if (nrow(dat) == 1) "elle" else "elles"
}

new_list_possessive <- function(dat) {
  if (nrow(dat) == 1) "ses" else "leurs"
}

new_list_newest_phrase <- function(dat) {
  if (nrow(dat) == 1) "elle apparaît comme la plus neuve" else "elles apparaissent comme les plus neuves"
}

render_new_lists_note <- function(province_name) {
  dat <- new_list_summary(province_name)
  without_2019 <- dat %>% filter(anciens_provinciaux_2019 == 0)
  with_municipal <- without_2019 %>% filter(municipaux_2026_hors_2019 > 0)
  without_municipal <- without_2019 %>% filter(municipaux_2026_hors_2019 == 0)
  almost_new <- dat %>% filter(anciens_provinciaux_2019 > 0, anciens_provinciaux_2019 <= 2)

  paragraphs <- list()

  if (nrow(without_2019) > 0) {
    paragraphs <- append(paragraphs, list(htmltools::tags$p(glue(
      "Les listes les plus nouvelles au regard de cette comparaison sont celles où aucun nom n’est retrouvé dans les listes provinciales 2019. Deux cas sont donc à distinguer : celles qui font quand même apparaître des candidats repérés aux municipales 2026, et celles où aucun de ces deux repères ne ressort. Cela ne veut pas dire qu’elles seraient sans histoire politique : cela veut dire que leurs candidats ne ressortent pas dans les sources utilisées ici."
    ))))
  }

  if (nrow(with_municipal) > 0) {
    prefix <- if (nrow(without_municipal) > 0) "Premier cas : " else "Dans cette province, "
    paragraphs <- append(paragraphs, list(htmltools::tags$p(glue(
      "{prefix}{new_list_subject(with_municipal, 'municipaux_2026_hors_2019')} {new_list_verb(with_municipal, 'ne compte', 'ne comptent')} aucun candidat retrouvé aux provinciales 2019, mais {new_list_verb(with_municipal, 'fait', 'font')} apparaître des candidats aussi présents aux municipales 2026. La nouveauté provinciale s’appuie donc au moins en partie sur des profils déjà engagés localement."
    ))))
  }

  if (nrow(without_municipal) > 0) {
    prefix <- if (nrow(with_municipal) > 0) "Second cas : " else "Dans cette province, "
    paragraphs <- append(paragraphs, list(htmltools::tags$p(glue(
      "{prefix}{new_list_subject(without_municipal)} {new_list_verb(without_municipal, 'ne fait', 'ne font')} ressortir ni candidat retrouvé aux provinciales 2019, ni candidat repéré aux municipales 2026. Dans cette lecture par les noms, {new_list_newest_phrase(without_municipal)} ; cela ne préjuge pas de {new_list_possessive(without_municipal)} réseaux militants ou politiques."
    ))))
  }

  if (nrow(without_2019) == 0 && nrow(almost_new) > 0) {
    almost_intro <- if (nrow(almost_new) == 1) {
      glue("La liste la plus proche d’une nouveauté nominative est {new_list_names(almost_new, 'anciens_provinciaux_2019')}")
    } else {
      glue("Les listes les plus proches d’une nouveauté nominative sont {new_list_names(almost_new, 'anciens_provinciaux_2019')}")
    }
    paragraphs <- append(paragraphs, list(htmltools::tags$p(glue(
      "Aucune liste n’est totalement sans nom retrouvé aux provinciales 2019. {almost_intro} : {new_list_pronoun(almost_new)} {new_list_verb(almost_new, 'a', 'ont')} seulement quelques anciens candidats aux provinciales repérés, et se {new_list_verb(almost_new, 'lit', 'lisent')} surtout par {if (nrow(almost_new) == 1) 'ses' else 'leurs'} profils municipaux ou par des noms non retrouvés dans les sources utilisées ici."
    ))))
  } else if (nrow(almost_new) > 0) {
    prior_subject <- if (nrow(without_2019) == 1) "cette liste" else "ces listes"
    paragraphs <- append(paragraphs, list(htmltools::tags$p(glue(
      "À côté de {prior_subject} sans continuité provinciale retrouvée, {new_list_subject(almost_new, 'anciens_provinciaux_2019')} {new_list_verb(almost_new, 'garde', 'gardent')} seulement une continuité nominative très faible avec 2019."
    ))))
  }

  if (length(paragraphs) == 0) return(NULL)

  htmltools::tags$div(
    class = "prov-new-list-note",
    htmltools::tags$h5("Les listes les plus nouvelles"),
    htmltools::tagList(paragraphs)
  )
}

render_first_ranks_cards <- function(province_name) {
  limit <- first_rank_limit(province_name)
  dat <- first_ranks_2026_summary(province_name, max_rank = limit)
  all_dat <- first_ranks_2026_summary(province_name, max_rank = Inf)
  source_detail <- make_2026_origin_data(province_name, max_rank = Inf)
  legend <- stack_legend()
  cards <- lapply(seq_len(nrow(dat)), function(i) {
    item <- dat[i, ]
    all_item <- all_dat %>% filter(ListeId == item[["ListeId"]]) %>% slice(1)
    source_rows <- source_detail %>% filter(liste_id == item[["ListeId"]])
    total <- item[["Total"]]
    elected <- item[["Elu 2019 qui se represente"]]
    stable <- item[["Candidat provincial 2019 non elu"]]
    municipal <- item[["Municipal 2026 absent provinciales 2019"]]
    new <- item[["Non retrouve en provinciales 2019"]]
    top_values <- stack_values(item)
    all_values <- stack_values(all_item)

    collapsible_card(
      "prov-rank-card",
      htmltools::tags$span(
        class = "prov-card-summary",
        htmltools::tags$strong(item[["Liste"]]),
        axis_badge(item[["Axe"]])
      ),
      htmltools::tags$div(
        class = "prov-stack-group",
        htmltools::tags$div(
          class = "prov-stack-bars",
          render_stack_bar(all_values, glue("Liste complète - {fmt_int(all_item[['Total']])} candidats")),
          render_stack_bar(top_values, glue("{first_rank_scope(province_name)} - {fmt_int(total)} candidats"))
        ),
        stack_legend_items(all_values + top_values)
      ),
      render_candidate_source_bars(source_rows, top_limit = limit),
      htmltools::tags$div(
        class = "prov-rank-counts",
        htmltools::tags$strong(glue("Dans les {first_rank_scope(province_name)}")),
        htmltools::tags$span(fmt_count(elected, "élu 2019 représenté", "élus 2019 représentés")),
        htmltools::tags$span(fmt_count(stable, "candidat 2019 non élu", "candidats 2019 non élus")),
        htmltools::tags$span(fmt_count(municipal, "candidat municipal 2026 absent des provinciales 2019", "candidats municipaux 2026 absents des provinciales 2019")),
        htmltools::tags$span(fmt_count(new, "autre nom non retrouvé en provinciales 2019", "autres noms non retrouvés en provinciales 2019"))
      )
    )
  })
  htmltools::tagList(
    legend,
    tag_grid("prov-rank-grid", cards)
  )
}

leading_destination_data <- function(liste_id, elected = TRUE, include_missing = FALSE) {
  target_liste_id <- liste_id
  total_source <- candidats %>%
    filter(annee == 2019, liste_id == target_liste_id, elu_2019 == elected) %>%
    nrow()

  matched <- matches_enriched %>%
    filter(liste_id_2019 == target_liste_id, elu_2019 == elected) %>%
    mutate(
      destination_label = if_else(
        province_2026 == province_2019,
        display_text(liste_nom_court_2026),
        glue("{display_text(liste_nom_court_2026)} ({province_display(province_2026)})")
      ),
      destination_color = axis_color(axe_politique_2026)
    ) %>%
    count(destination_label, destination_color, name = "n")

  missing_n <- max(total_source - sum(matched$n), 0)
  if (include_missing && missing_n > 0) {
    matched <- bind_rows(
      matched,
      tibble(
        destination_label = "Non retrouvé en 2026",
        destination_color = turnover_palette[["Non retrouve en 2026"]],
        n = missing_n
      )
    )
  }

  matched %>%
    mutate(part = safe_share(n, total_source)) %>%
    arrange(desc(n), destination_label)
}

render_destination_list_bars <- function(dat, title, empty_text = NULL) {
  visible <- dat %>% filter(n > 0)

  if (nrow(visible) == 0) {
    if (is.null(empty_text)) return(NULL)
    return(htmltools::tags$section(
      class = "prov-destination-list",
      htmltools::tags$h5(title),
      htmltools::tags$p(class = "prov-focus-caption", empty_text)
    ))
  }

  max_count <- max(visible$n, na.rm = TRUE)
  rows <- lapply(seq_len(nrow(visible)), function(i) {
    item <- visible[i, ]
    width <- 100 * item$n / max(max_count, 1)
    htmltools::tags$div(
      class = "prov-detail-row",
      htmltools::tags$div(
        class = "prov-detail-head",
        htmltools::tags$span(
          class = "prov-detail-label",
          htmltools::tags$i(style = glue("background: {item$destination_color};")),
          item$destination_label
        ),
        htmltools::tags$strong(fmt_count(item$n, "nom", "noms"))
      ),
      htmltools::tags$div(
        class = "prov-detail-meter",
        htmltools::tags$span(style = glue("width: {width}%; background: {item$destination_color};"))
      )
    )
  })

  htmltools::tags$section(
    class = "prov-destination-list",
    htmltools::tags$h5(title),
    do.call(htmltools::tags$div, c(list(class = "prov-detail-bars"), rows))
  )
}

render_leading_destination_bars <- function(liste_id) {
  elected <- leading_destination_data(liste_id, elected = TRUE, include_missing = TRUE)
  other <- leading_destination_data(liste_id, elected = FALSE, include_missing = FALSE)

  other_block <- render_destination_list_bars(
    other,
    "Candidats 2019 non élus retrouvés en 2026"
  )

  htmltools::tags$section(
    class = "prov-focus-destination prov-leader-destination",
    htmltools::tags$h4("Principales destinations 2026"),
    render_destination_list_bars(
      elected,
      "Élus 2019",
      "Aucun élu sortant repéré dans cette liste."
    ),
    other_block
  )
}

render_leading_2019_cards <- function(province_name) {
  dat <- leading_2019_profile(province_name)
  cards <- lapply(seq_len(nrow(dat)), function(i) {
    item <- dat[i, ]

    metrics <- list(
      list(
        label = "Résultat 2019",
        value = glue("{fmt_int(item$voix_2019)} voix"),
        note = glue("{fmt_count(item$sieges_province_total_2019, 'siège', 'sièges')} province, dont {fmt_count(item$sieges_congres_2019, 'siège', 'sièges')} au Congrès")
      ),
      list(
        label = "Noms retrouvés en 2026",
        value = glue("{fmt_int(item$retrouves_2026)} / {fmt_int(item$candidats_2019)}"),
        note = fmt_pct(item$part_retrouves_2026)
      ),
      list(
        label = "Élus 2019 retrouvés",
        value = glue("{fmt_int(item$elus_representes)} / {fmt_int(item$elus_total)}"),
        note = "sur les élus repérés dans la liste 2019"
      )
    )

    collapsible_card(
      "prov-leader-card",
      htmltools::tags$span(
        class = "prov-card-summary prov-leader-summary",
        htmltools::tags$span(class = "prov-leader-rank", glue("#{item$rang_resultat_2019} en 2019")),
        htmltools::tags$strong(item$liste_nom_court),
        axis_badge(item$axe_politique)
      ),
      htmltools::tags$p(class = "prov-leader-analysis", item$analyse),
      htmltools::tags$dl(
        class = "prov-leader-metrics",
        lapply(metrics, function(metric) {
          htmltools::tagList(
            htmltools::tags$dt(metric$label),
            htmltools::tags$dd(
              htmltools::tags$strong(metric$value),
              if (!is.null(metric$note)) htmltools::tags$small(metric$note)
            )
          )
        })
      ),
      render_leading_destination_bars(item$liste_id)
    )
  })

  htmltools::tagList(
    tag_grid("prov-leader-grid", cards)
  )
}

render_flow_summary_cards <- function(flow_summary) {
  cards <- lapply(province_order, function(province_name) {
    dat <- flow_summary %>% filter(province == province_name)
    rows <- lapply(seq_len(nrow(dat)), function(i) {
      htmltools::tags$li(
        htmltools::tags$span(dat$indicateur[[i]]),
        htmltools::tags$strong(glue("{fmt_int(dat$n[[i]])} - {fmt_pct(dat$part[[i]])}"))
      )
    })

    htmltools::tags$article(
      class = "prov-flow-card",
      htmltools::tags$h3(province_display(province_name)),
      do.call(htmltools::tags$ul, c(list(class = "prov-flow-list"), rows))
    )
  })
  tag_grid("prov-flow-grid", cards)
}

province_destination_data <- function(province_name, elected = TRUE, include_missing = FALSE) {
  total_source <- candidats %>%
    filter(annee == 2019, province == province_name, elu_2019 == elected) %>%
    nrow()

  matched <- matches_enriched %>%
    filter(province_2019 == province_name, elu_2019 == elected) %>%
    mutate(
      destination_label = if_else(
        province_2026 == province_2019,
        display_text(liste_nom_court_2026),
        glue("{display_text(liste_nom_court_2026)} ({province_display(province_2026)})")
      ),
      destination_color = axis_color(axe_politique_2026)
    ) %>%
    count(destination_label, destination_color, name = "n")

  missing_n <- max(total_source - sum(matched$n), 0)
  if (include_missing && missing_n > 0) {
    matched <- bind_rows(
      matched,
      tibble(
        destination_label = "Non retrouvé en 2026",
        destination_color = turnover_palette[["Non retrouve en 2026"]],
        n = missing_n
      )
    )
  }

  matched %>%
    mutate(part = safe_share(n, total_source)) %>%
    arrange(desc(n), destination_label)
}

render_province_destination_bars <- function(province_name) {
  elected <- province_destination_data(province_name, elected = TRUE, include_missing = TRUE)
  other <- province_destination_data(province_name, elected = FALSE, include_missing = FALSE)
  other_block <- render_destination_list_bars(
    other,
    "Candidats 2019 non élus retrouvés en 2026"
  )

  htmltools::tags$section(
    class = "prov-focus-destination",
    htmltools::tags$h4("Principales destinations 2026"),
    render_destination_list_bars(
      elected,
      "Élus 2019",
      "Aucun élu 2019 repéré dans cette province."
    ),
    other_block
  )
}

render_institutional_focus_cards <- function() {
  cards <- lapply(province_order, function(province_name) {
    profile <- province_profiles %>% filter(province == province_name) %>% slice(1)
    first_ranks <- first_ranks_profiles %>% filter(province == province_name) %>% slice(1)
    heads <- head_list_profiles %>% filter(province == province_name) %>% slice(1)
    first_ranks_deja_2019 <- first_ranks$first_ranks_elus_2019 + first_ranks$first_ranks_candidats_2019_non_elus
    first_ranks_non_retrouves <- first_ranks$first_ranks_municipaux + first_ranks$first_ranks_non_retrouves

    rows <- list(
      list(
        label = "Élus 2019 qui se représentent",
        value = glue("{fmt_int(profile$elus_2019_representes)} / {fmt_int(profile$elus_2019)}"),
        note = fmt_pct(profile$part_elus_2019_representes)
      ),
      list(
        label = "Candidats 2019 non élus retrouvés",
        value = fmt_int(profile$candidats_2019_non_elus_representes_meme_province),
        note = "retrouvés dans la même province, hors élus sortants"
      ),
      list(
        label = "Têtes de liste déjà candidates en 2019",
        value = glue("{fmt_int(heads$tetes_deja_2019)} / {fmt_int(heads$tetes_total)}"),
        note = glue("{fmt_count(heads$tetes_elus_2019, 'élu', 'élus')}, {fmt_count(heads$tetes_anciens_non_elus, 'candidat 2019', 'candidats 2019')}, {fmt_count(heads$tetes_municipales, 'municipal 2026', 'municipaux 2026')}")
      ),
      list(
        label = "Premières places observées",
        value = fmt_int(first_ranks$first_ranks_total),
        note = glue("{first_rank_scope_note(province_name)} par liste ; ce n’est pas une projection de sièges")
      ),
      list(
        label = glue("{first_rank_scope(province_name)} déjà présentes en 2019"),
        value = glue("{fmt_int(first_ranks_deja_2019)} / {fmt_int(first_ranks$first_ranks_total)}"),
        note = glue("{fmt_count(first_ranks$first_ranks_elus_2019, 'élu 2019', 'élus 2019')} ; {fmt_count(first_ranks$first_ranks_candidats_2019_non_elus, 'candidat 2019 non élu', 'candidats 2019 non élus')}")
      ),
      list(
        label = "Premières places non retrouvées en provinciales 2019",
        value = glue("{fmt_int(first_ranks_non_retrouves)} / {fmt_int(first_ranks$first_ranks_total)}"),
        note = glue("dont {fmt_count(first_ranks$first_ranks_municipaux, 'candidat municipal 2026', 'candidats municipaux 2026')} repérés")
      )
    )

    items <- lapply(rows, function(row) {
      htmltools::tags$li(
        htmltools::tags$span(
          row$label,
          htmltools::tags$small(row$note)
        ),
        htmltools::tags$strong(row$value)
      )
    })

    htmltools::tags$article(
      class = "prov-flow-card prov-focus-card",
      htmltools::tags$h3(province_display(province_name)),
      render_province_destination_bars(province_name),
      do.call(htmltools::tags$ul, c(list(class = "prov-focus-list"), items))
    )
  })

  tag_grid("prov-flow-grid", cards)
}
