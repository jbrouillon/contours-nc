# Download the official challenge datasets from the Pacific Data Hub -----------

library(rvest)
library(dplyr)
library(stringr)
library(tibble)
library(readr)
library(purrr)
library(httr2)

script_arg <- grep("^--file=", commandArgs(trailingOnly = FALSE), value = TRUE)
if (length(script_arg) != 1) {
  stop("Run this script with Rscript.")
}

script_path <- normalizePath(
  sub("^--file=", "", script_arg[[1]]),
  winslash = "/",
  mustWork = TRUE
)
project_root <- normalizePath(
  file.path(dirname(script_path), "..", ".."),
  winslash = "/",
  mustWork = TRUE
)
data_root <- file.path(project_root, "data", "pacific-climate-fingerprints")
raw_dir <- file.path(data_root, "raw")
metadata_dir <- file.path(data_root, "metadata")
dir.create(raw_dir, recursive = TRUE, showWarnings = FALSE)
dir.create(metadata_dir, recursive = TRUE, showWarnings = FALSE)

challenge_url <- "https://pacificdatavizchallenge.org/fr#official-datasets--theme"

nodes <- read_html(challenge_url) |>
  html_elements("a")

links <- tibble(
  label = html_text2(nodes),
  href = html_attr(nodes, "href")
) |>
  filter(
    !is.na(href),
    str_detect(href, "stats\\.pacificdata\\.org|pacificdata\\.org/data")
  ) |>
  mutate(
    href = if_else(
      str_starts(href, "http"),
      href,
      paste0("https://pacificdatavizchallenge.org", href)
    )
  ) |>
  distinct()

write_csv(links, file.path(metadata_dir, "official_datasets_links.csv"))

api_links <- links |>
  mutate(
    href_decoded = URLdecode(href),
    dataset_id = str_match(href_decoded, "df\\[id\\]=([^&]+)")[, 2],
    query_key = str_match(href_decoded, "dq=([^&]+)")[, 2]
  ) |>
  filter(!is.na(dataset_id), !is.na(query_key)) |>
  distinct(label, href, dataset_id, query_key) |>
  mutate(
    api_url = paste0(
      "https://stats-nsi-stable.pacificdata.org/rest/v1/data/SPC,",
      dataset_id,
      ",1.0/",
      query_key
    )
  )

results <- map_dfr(seq_len(nrow(api_links)), function(i) {
  filename <- paste0(
    sprintf("%02d", i),
    "_",
    api_links$dataset_id[i],
    "_",
    gsub("[^A-Za-z0-9]+", "_", api_links$query_key[i]),
    ".csv"
  )
  target <- file.path(raw_dir, filename)
  message("Downloading dataset ", i, " of ", nrow(api_links))

  tryCatch({
    request(api_links$api_url[i]) |>
      req_headers(Accept = "text/csv") |>
      req_perform(path = target)

    tibble(
      i = i,
      status = "OK",
      dataset_id = api_links$dataset_id[i],
      query_key = api_links$query_key[i],
      file = filename,
      error = NA_character_
    )
  }, error = function(error) {
    tibble(
      i = i,
      status = "ERROR",
      dataset_id = api_links$dataset_id[i],
      query_key = api_links$query_key[i],
      file = filename,
      error = conditionMessage(error)
    )
  })
})

write_csv(results, file.path(metadata_dir, "download_results.csv"))
print(count(results, status))
