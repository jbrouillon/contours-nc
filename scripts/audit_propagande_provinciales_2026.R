#!/usr/bin/env Rscript

# Audit lexical des transcriptions des professions de foi. Le dictionnaire
# LibreOffice sert uniquement a reperer les formes a relire : les termes
# caledoniens et les noms propres restent ensuite valides manuellement.

suppressPackageStartupMessages({
  library(dplyr)
  library(readr)
  library(stringi)
})

find_project_root <- function(path = getwd()) {
  path <- normalizePath(path, winslash = "/", mustWork = TRUE)
  repeat {
    if (file.exists(file.path(path, "_quarto.yml"))) return(path)
    parent <- dirname(path)
    if (identical(parent, path)) stop("Racine du projet Quarto introuvable.")
    path <- parent
  }
}

project_dir <- find_project_root()
source(
  file.path(project_dir, "posts", "provinciales-2026-professions-foi", "analysis.R"),
  local = environment(), encoding = "UTF-8"
)

dictionary_url <- paste0(
  "https://raw.githubusercontent.com/LibreOffice/dictionaries/",
  "master/fr_FR/fr.dic"
)

dictionary <- readLines(dictionary_url, encoding = "UTF-8", warn = FALSE) |>
  tail(-1) |>
  sub(pattern = "/.*$", replacement = "") |>
  stri_trans_general("Latin-ASCII") |>
  tolower() |>
  gsub(pattern = "[^a-z-]", replacement = "") |>
  unique()

known_local <- c(
  "betico", "cafaat", "caldoche", "cfp", "chefferie", "chefferies",
  "coutumier", "coutumiere", "do", "flnks", "kanak", "kanaky", "kamo",
  "koniambo", "lifou", "mare", "nickel", "ouvea", "palika", "ruamm",
  "sodil", "taneo", "tiga", "tribu", "tribus", "ucc", "vavouto"
)

suspect_terms <- tokens |>
  count(document_id, word_ascii, sort = TRUE) |>
  filter(
    n >= 2,
    !word_ascii %in% dictionary,
    !word_ascii %in% known_local
  ) |>
  left_join(
    documents |> select(document_id, province, numero_liste, liste_nom_court),
    by = "document_id"
  ) |>
  arrange(province, numero_liste, desc(n), word_ascii)

audit_documents <- tokens_before_stopwords |>
  count(document_id, name = "tokens_alphabetiques") |>
  left_join(
    noise_tokens |> count(document_id, name = "artefacts_exclus"),
    by = "document_id"
  ) |>
  mutate(
    artefacts_exclus = coalesce(artefacts_exclus, 0L),
    part_artefacts = artefacts_exclus / tokens_alphabetiques
  ) |>
  left_join(
    documents |>
      select(document_id, province, numero_liste, liste_nom_court),
    by = "document_id"
  ) |>
  select(
    province, numero_liste, liste_nom_court, document_id,
    tokens_alphabetiques, artefacts_exclus, part_artefacts
  ) |>
  arrange(province, numero_liste)

artifact_inventory <- noise_tokens |>
  count(word_ascii, sort = TRUE, name = "occurrences") |>
  left_join(
    noise_tokens |>
      distinct(word_ascii, document_id) |>
      count(word_ascii, name = "documents"),
    by = "word_ascii"
  )

write_excel_csv(
  audit_documents,
  file.path(processed_dir, "audit_ocr_documents.csv")
)
write_excel_csv(
  artifact_inventory,
  file.path(processed_dir, "artefacts_ocr_exclus.csv")
)

print(
  suspect_terms |>
    group_by(document_id, liste_nom_court) |>
    slice_head(n = 10) |>
    ungroup(),
  n = Inf
)

message(
  sum(audit_documents$artefacts_exclus), " occurrences de ",
  nrow(artifact_inventory), " formes parasites confirmees exclues."
)
