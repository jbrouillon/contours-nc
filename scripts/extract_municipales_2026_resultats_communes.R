library(dplyr)
library(pdftools)
library(readr)
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
raw_dir <- file.path(project_dir, "data", "elections", "data_raw", "municipales_2026")
out_dir <- file.path(project_dir, "data", "elections", "data_processed", "municipales_2026")
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

pdf_sources <- tribble(
  ~tour, ~date_scrutin, ~path, ~source_url,
  1L, "2026-03-15",
  file.path(raw_dir, "municipales_2026_t1_resultats_988_0135.pdf"),
  "https://www.nouvelle-caledonie.gouv.fr/contenu/telechargement/13122/109633/file/Municipales%2B2026%2B-%2BR%C3%A9sultats%2B-%2B988%2B-%2BNouvelle-Cal%C3%A9donie_2026-03-17_01h35.pdf",
  2L, "2026-03-22",
  file.path(raw_dir, "municipales_2026_t2_resultats_complets_988.pdf"),
  "https://www.nouvelle-caledonie.gouv.fr/contenu/telechargement/13139/109771/file/R%C3%A9sultats%2B-%2BMunicipales%2B2026%2B-%2BR%C3%A9sultats%2Bcomplets%2B-%2B988%2B-%2BNouvelle-Cal%C3%A9donie_2026-03-23_04h08.pdf"
)

missing <- pdf_sources$path[!file.exists(pdf_sources$path)]
if (length(missing) > 0) {
  stop("PDF municipaux manquants: ", paste(missing, collapse = ", "))
}

parse_number_fr <- function(x) {
  x |>
    str_replace_all("\\s+", "") |>
    str_replace(",", ".") |>
    as.numeric()
}

strip_left_stats <- function(line) {
  line |>
    str_replace(
      "^\\s*(Inscrits|Votants|Abstentions|Exprimés|Exprimes|Blancs|Nuls)\\s+[0-9 ]+(?:\\s+[0-9,]+%)?(?:\\s+[0-9,]+%)?\\s+",
      ""
    ) |>
    str_squish()
}

is_footer_or_header <- function(x) {
  if (is.na(x) || !nzchar(x)) return(TRUE)
  if (str_detect(x, "^[0-9,]+%?(\\s+[0-9,]+%?)*$")) return(TRUE)
  str_detect(
    x,
    regex(
      "^(Résultats|Departement|Département|988 -|Commune :|\\* Calcul|[0-9]+ / [0-9]+|Edité|Edite|Inscrits\\s+Votants|Candidatures|Voix|Sièges|Sieges|%\\s+Inscrits)",
      ignore_case = TRUE
    )
  )
}

parse_page <- function(page_text, page, tour, date_scrutin, source_url, source_pdf) {
  lines <- str_split(page_text, "\n", simplify = FALSE)[[1]]
  commune_line <- lines[str_detect(lines, "Commune\\s*:")][1]
  commune_match <- str_match(commune_line, "Commune\\s*:\\s*([0-9]+)\\s*-\\s*(.+?)\\s*$")

  if (is.na(commune_match[1, 1])) {
    return(tibble())
  }

  commune_code_short <- commune_match[1, 2]
  commune <- str_squish(commune_match[1, 3])

  rows <- list()
  current <- 0L

  for (line in lines) {
    work <- strip_left_stats(line)
    if (!nzchar(work)) next

    row_match <- str_match(
      work,
      "^(?:(L[A-Z]+)\\s+)?(?:(?:N°|Nº)\\s*([0-9]+)\\s*-\\s*)?(.+?)\\s+([0-9][0-9 ]*)\\s+([0-9,]+)%\\s+([0-9,]+)%\\s+([0-9]+)\\s*$"
    )

    if (!is.na(row_match[1, 1])) {
      current <- length(rows) + 1L
      rows[[current]] <- tibble(
        tour = tour,
        date_scrutin = date_scrutin,
        page = page,
        commune_code = paste0("988", str_pad(commune_code_short, 2, pad = "0")),
        commune_code_court = commune_code_short,
        commune = commune,
        nuance = na_if(row_match[1, 2], ""),
        numero_liste_municipale = suppressWarnings(as.integer(row_match[1, 3])),
        tete_liste = str_squish(row_match[1, 4]),
        voix = parse_number_fr(row_match[1, 5]),
        pct_inscrits = parse_number_fr(row_match[1, 6]),
        pct_exprimes = parse_number_fr(row_match[1, 7]),
        sieges = as.integer(row_match[1, 8]),
        liste_municipale = NA_character_,
        source_pdf = source_pdf,
        source_url = source_url
      )
      next
    }

    if (current > 0L && !is_footer_or_header(work)) {
      old <- coalesce(rows[[current]]$liste_municipale, "")
      rows[[current]]$liste_municipale <- str_squish(paste(old, work, sep = " "))
    }
  }

  bind_rows(rows)
}

parse_pdf <- function(path, tour, date_scrutin, source_url) {
  txt <- pdf_text(path)
  bind_rows(lapply(seq_along(txt), function(i) {
    parse_page(
      page_text = txt[[i]],
      page = i,
      tour = tour,
      date_scrutin = date_scrutin,
      source_url = source_url,
      source_pdf = file.path("data", "elections", "data_raw", "municipales_2026", basename(path))
    )
  }))
}

all_rounds <- bind_rows(lapply(seq_len(nrow(pdf_sources)), function(i) {
  parse_pdf(
    path = pdf_sources$path[i],
    tour = pdf_sources$tour[i],
    date_scrutin = pdf_sources$date_scrutin[i],
    source_url = pdf_sources$source_url[i]
  )
}))

round_totals <- all_rounds |>
  group_by(commune_code, commune, tour) |>
  summarise(total_sieges_tour = sum(sieges, na.rm = TRUE), .groups = "drop")

selected_rounds <- round_totals |>
  group_by(commune_code) |>
  arrange(desc(total_sieges_tour), desc(tour), .by_group = TRUE) |>
  slice(1) |>
  ungroup() |>
  select(commune_code, tour_retenu = tour, total_sieges_commune = total_sieges_tour)

final_results <- all_rounds |>
  inner_join(selected_rounds, by = "commune_code") |>
  filter(tour == tour_retenu) |>
  arrange(as.integer(commune_code_court), numero_liste_municipale, desc(sieges), tete_liste)

write_csv(
  all_rounds,
  file.path(out_dir, "municipales_2026_resultats_communes_listes_tours.csv"),
  na = ""
)

write_csv(
  final_results,
  file.path(out_dir, "municipales_2026_resultats_communes_listes.csv"),
  na = ""
)

checks <- list(
  n_communes = n_distinct(final_results$commune_code),
  n_listes = nrow(final_results),
  n_listes_avec_sieges = sum(final_results$sieges > 0, na.rm = TRUE),
  sieges_total = sum(final_results$sieges, na.rm = TRUE),
  communes_sans_sieges = final_results |>
    group_by(commune_code, commune) |>
    summarise(total = sum(sieges, na.rm = TRUE), .groups = "drop") |>
    filter(total == 0) |>
    nrow()
)

print(checks)
