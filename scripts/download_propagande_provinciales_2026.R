#!/usr/bin/env Rscript

# Télécharge les circulaires numériques publiées par le Haut-commissariat
# pour les élections provinciales de 2026 et construit un manifeste.

suppressPackageStartupMessages({
  library(dplyr)
  library(purrr)
  library(readr)
  library(rvest)
  library(stringi)
  library(stringr)
  library(tibble)
  library(xml2)
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

slugify <- function(x) {
  x |>
    stri_trans_general("Latin-ASCII") |>
    str_to_lower() |>
    str_replace_all("[^a-z0-9]+", "-") |>
    str_replace_all("(^-|-$)", "")
}

project_dir <- find_project_root()
base_url <- "https://www.nouvelle-caledonie.gouv.fr"
raw_dir <- file.path(
  project_dir, "data", "elections", "data_raw", "provinciales_2026",
  "propagande_electronique"
)
dir.create(raw_dir, recursive = TRUE, showWarnings = FALSE)

pages <- tribble(
  ~province, ~province_slug, ~page_path,
  "Province Sud", "province-sud", paste0(
    "/Actions-de-l-Etat/Elections/Elections-2026/Elections-provinciales-2026/",
    "Propagande-electronique/Province-Sud"
  ),
  "Province Nord", "province-nord", paste0(
    "/Actions-de-l-Etat/Elections/Elections-2026/Elections-provinciales-2026/",
    "Propagande-electronique/Province-Nord"
  ),
  "Province des Îles Loyauté", "iles-loyaute", paste0(
    "/Actions-de-l-Etat/Elections/Elections-2026/Elections-provinciales-2026/",
    "Propagande-electronique/Province-des-Iles-Loyaute"
  )
) |>
  mutate(page_url = paste0(base_url, page_path))

read_page_links <- function(province, province_slug, page_path, page_url) {
  handle <- curl::new_handle(useragent = "Mozilla/5.0")
  response <- curl::curl_fetch_memory(page_url, handle = handle)
  if (response$status_code != 200) {
    stop("Échec HTTP ", response$status_code, " pour ", page_url)
  }
  page <- read_html(rawToChar(response$content))

  tibble(
    label = page |>
      html_elements("a[href*='/contenu/telechargement/']") |>
      html_text2(),
    href = page |>
      html_elements("a[href*='/contenu/telechargement/']") |>
      html_attr("href")
  ) |>
    mutate(
      label = str_squish(label),
      source_url = url_absolute(href, base_url),
      download_id = str_match(href, "/telechargement/([0-9]+)/")[, 2]
    ) |>
    filter(!is.na(download_id)) |>
    group_by(download_id) |>
    summarise(
      liste_nom = {
        labels <- label[!str_detect(label, regex("^Télécharger", ignore_case = TRUE))]
        if (length(labels)) labels[[1]] else label[[1]]
      },
      source_url = source_url[[1]],
      .groups = "drop"
    ) |>
    mutate(
      province = province,
      province_slug = province_slug,
      page_url = page_url,
      numero_liste = suppressWarnings(as.integer(
        str_match(URLdecode(source_url), "/file/([0-9]{1,2})(?:[^0-9]|$)")[, 2]
      )),
      fichier = sprintf("%02d_%s.pdf", numero_liste, slugify(liste_nom))
    ) |>
    arrange(numero_liste)
}

manifest <- pmap_dfr(pages, read_page_links)

if (anyNA(manifest$numero_liste)) {
  stop("Impossible d'identifier le numéro d'au moins une liste dans les URL.")
}

download_one <- function(province_slug, fichier, source_url) {
  province_dir <- file.path(raw_dir, province_slug)
  dir.create(province_dir, recursive = TRUE, showWarnings = FALSE)
  destination <- file.path(province_dir, fichier)

  if (!file.exists(destination) || file.size(destination) == 0) {
    handle <- curl::new_handle(useragent = "Mozilla/5.0")
    curl::curl_download(source_url, destination, quiet = TRUE, handle = handle)
  }

  destination
}

manifest <- manifest |>
  mutate(
    chemin_absolu = pmap_chr(
      list(province_slug, fichier, source_url),
      download_one
    ),
    chemin = str_replace(
      normalizePath(chemin_absolu, winslash = "/", mustWork = TRUE),
      fixed(paste0(normalizePath(project_dir, winslash = "/"), "/")),
      ""
    ),
    taille_octets = file.size(chemin_absolu),
    md5 = unname(tools::md5sum(chemin_absolu)),
    date_collecte = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z")
  ) |>
  select(
    province, numero_liste, liste_nom, fichier, chemin, taille_octets, md5,
    page_url, source_url, date_collecte
  ) |>
  arrange(factor(province, levels = pages$province), numero_liste)

manifest_path <- file.path(raw_dir, "manifest.csv")
write_excel_csv(manifest, manifest_path)

cat(
  sprintf(
    "%d circulaires téléchargées ou vérifiées (%s).\n",
    nrow(manifest), manifest_path
  )
)
