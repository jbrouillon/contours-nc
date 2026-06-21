#!/usr/bin/env Rscript

# OCR reproductible des professions de foi téléchargées. Le script accepte
# éventuellement un slug de province : province-sud, province-nord ou
# iles-loyaute. Les sorties sont séparées par province afin de permettre une
# exécution parallèle sans collision d'écriture.

suppressPackageStartupMessages({
  library(dplyr)
  library(readr)
  library(stringr)
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
raw_dir <- file.path(
  project_dir, "data", "elections", "data_raw", "provinciales_2026",
  "propagande_electronique"
)
processed_dir <- file.path(
  project_dir, "data", "elections", "data_processed", "provinciales_2026",
  "propagande_electronique"
)
dir.create(processed_dir, recursive = TRUE, showWarnings = FALSE)

manifest <- read_csv(file.path(raw_dir, "manifest.csv"), show_col_types = FALSE) |>
  mutate(province_slug = case_when(
    province == "Province Sud" ~ "province-sud",
    province == "Province Nord" ~ "province-nord",
    TRUE ~ "iles-loyaute"
  ))

args <- commandArgs(trailingOnly = TRUE)
if (length(args)) {
  if (!args[[1]] %in% unique(manifest$province_slug)) {
    stop("Province inconnue : ", args[[1]])
  }
  manifest <- filter(manifest, province_slug == args[[1]])
}

extract_with_pymupdf <- function(path) {
  code <- paste(
    "import pathlib, pymupdf, sys",
    "doc = pymupdf.open(pathlib.Path(sys.argv[1]))",
    "sys.stdout.write('\\n\\n--- PAGE ---\\n\\n'.join(page.get_text() for page in doc))",
    sep = "\n"
  )
  result <- processx::run(
    "py", c("-c", code, normalizePath(path, winslash = "/")),
    timeout = 60000, error_on_status = FALSE, echo = FALSE
  )
  if (result$status == 0) result$stdout else ""
}

ocr_with_pymupdf <- function(path, dpi = 220) {
  render_dir <- tempfile("propagande_pages_")
  dir.create(render_dir)
  on.exit(unlink(render_dir, recursive = TRUE, force = TRUE), add = TRUE)

  code <- paste(
    "import pathlib, pymupdf, sys",
    "source, target, dpi = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]), int(sys.argv[3])",
    "doc = pymupdf.open(source)",
    "zoom = dpi / 72",
    "paths = []",
    "for i, page in enumerate(doc):",
    "    out = target / f'page_{i + 1:03d}.png'",
    "    page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False).save(out)",
    "    paths.append(str(out))",
    "sys.stdout.write('\\n'.join(paths))",
    sep = "\n"
  )
  result <- processx::run(
    "py",
    c(
      "-c", code, normalizePath(path, winslash = "/"),
      normalizePath(render_dir, winslash = "/"), as.character(dpi)
    ),
    timeout = 120000, error_on_status = FALSE, echo = FALSE
  )
  if (result$status != 0) stop("Échec du rendu PyMuPDF : ", result$stderr)

  images <- str_split(result$stdout, "\\r?\\n")[[1]]
  images <- images[nzchar(images)]
  engine <- tesseract::tesseract("fra+eng")
  paste(
    vapply(images, tesseract::ocr, character(1), engine = engine),
    collapse = "\n\n--- PAGE ---\n\n"
  )
}

native_text_is_usable <- function(text) {
  # Certains PDF exposent un calque texte assez long mais corrompu : les
  # lettres accentuees disparaissent au lieu d'etre decodees. Dans un tract
  # politique francais de plus de 2 000 caracteres, moins de deux caracteres
  # accentues ou ligatures est un signal suffisamment fort pour forcer l'OCR.
  nchar(text) >= 2000 &&
    str_count(text, "[àâäçéèêëîïôöùûüÿœæÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸŒÆ]") >= 2
}

extract_one <- function(path, destination, dpi = 220) {
  if (file.exists(destination) && file.size(destination) > 100) {
    cached <- readr::read_file(destination)
    if (native_text_is_usable(cached)) {
      return(list(text = cached, methode = "cache existant"))
    }
  }

  native <- tryCatch(
    callr::r(
      function(path) {
        suppressPackageStartupMessages(library(pdftools))
        paste(pdf_text(path), collapse = "\n\n--- PAGE ---\n\n")
      },
      args = list(path = path), timeout = 60, show = FALSE
    ),
    error = function(e) ""
  )

  if (native_text_is_usable(native)) {
    text <- native
    methode <- "texte natif (Poppler)"
  } else {
    native_pymupdf <- tryCatch(extract_with_pymupdf(path), error = function(e) "")
    if (native_text_is_usable(native_pymupdf)) {
      text <- native_pymupdf
      methode <- "texte natif (PyMuPDF)"
    } else {
      text <- ocr_with_pymupdf(path, dpi = dpi)
      methode <- "OCR Tesseract après rendu PyMuPDF"
    }
  }

  write_file(text, destination)
  list(text = text, methode = methode)
}

results <- vector("list", nrow(manifest))

for (i in seq_len(nrow(manifest))) {
  row <- manifest[i, ]
  source_path <- file.path(project_dir, row$chemin)
  province_dir <- file.path(processed_dir, row$province_slug)
  dir.create(province_dir, recursive = TRUE, showWarnings = FALSE)
  text_path <- file.path(province_dir, str_replace(row$fichier, "\\.pdf$", ".txt"))

  message(
    sprintf(
      "[%s %02d] OCR de %s",
      row$province_slug, row$numero_liste, row$liste_nom
    )
  )
  started <- Sys.time()
  extraction <- extract_one(source_path, text_path)
  text <- extraction$text
  elapsed <- as.numeric(difftime(Sys.time(), started, units = "secs"))

  results[[i]] <- tibble(
    province = row$province,
    province_slug = row$province_slug,
    numero_liste = row$numero_liste,
    liste_nom = row$liste_nom,
    fichier_pdf = row$chemin,
    fichier_texte = str_replace(
      normalizePath(text_path, winslash = "/", mustWork = TRUE),
      fixed(paste0(normalizePath(project_dir, winslash = "/"), "/")),
      ""
    ),
    caracteres_ocr = nchar(text),
    mots_ocr = str_count(text, boundary("word")),
    secondes_ocr = round(elapsed, 1),
    dpi = 220L,
    moteur = extraction$methode,
    text = text
  )
}

results <- bind_rows(results)
slug <- if (length(args)) args[[1]] else "toutes-provinces"

corpus <- results |>
  transmute(
    document_id = paste(province_slug, sprintf("%02d", numero_liste), sep = "_"),
    text
  )

corpus_file <- if (length(args)) {
  paste0("corpus_ocr_", slug, ".csv")
} else {
  "corpus_ocr.csv"
}

write_excel_csv(corpus, file.path(processed_dir, corpus_file))
write_excel_csv(
  select(results, -text),
  file.path(processed_dir, paste0("manifest_extraction_", slug, ".csv"))
)

message(sum(results$caracteres_ocr), " caractères extraits de ", nrow(results), " documents.")
